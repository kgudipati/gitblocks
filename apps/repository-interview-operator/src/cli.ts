import {
  closePersistenceClient,
  createPersistenceClient,
  verifyMigrations,
  type PersistenceClient,
  type MigrationVerification,
} from '@gitblocks/persistence';
import {
  createOpenAiResponsesRepositoryInterviewProviderV1,
  loadRepositoryInterviewSpecification,
  serializeCanonicalJson,
} from '@gitblocks/interviews';

import {
  runRepositoryInterviewOperatorV1,
  validateRepositoryInterviewCandidatePlanPreflightV1,
} from './operator.ts';
import {
  createRepositoryInterviewPersistenceAdapterV1,
  validateRepositoryInterviewOperatorSelectionPersistenceV1,
} from './persistence-adapter.ts';
import {
  parseRepositoryInterviewOperatorArgumentsV1,
  RepositoryInterviewOperatorConfigurationError,
} from './process-configuration.ts';
import {
  createExplicitGlobalFetchPortV1,
  createLazyEnvironmentCredentialPortV1,
  createProcessAttemptControlPortV1,
  createProcessCandidateControlFactoryV1,
  createProcessClockPortsV1,
  createProcessNoncePortV1,
  createProcessRunDeadlineControlV1,
  createProcessRunIdPortV1,
  createProcessSleeperPortV1,
  writeRepositoryInterviewOperatorReceiptFileV1,
} from './process-ports.ts';
import { serializeRepositoryInterviewOperatorReceiptV1 } from './receipt.ts';
import type { RepositoryInterviewOperatorSelectionV1 } from './operator-selection.ts';
import type { RepositoryInterviewOperatorEventV1 } from './telemetry.ts';

const MAX_CONFIGURATION_BYTES = 8 * 1024 * 1024;

export interface RepositoryInterviewOperatorCliBoundaryV1 {
  readTextFile(path: string, maximumBytes: number): Promise<string>;
  readEnvironment(name: string): string | undefined;
  createFetch(): typeof globalThis.fetch;
  writeStdout(text: string): void;
  writeStderr(text: string): void;
  writeReceipt?(path: string, content: string): Promise<void>;
  createPersistenceClient?: typeof createPersistenceClient;
  closePersistenceClient?: typeof closePersistenceClient;
  validateCandidatePlan?(candidatePlan: unknown): Promise<unknown>;
  validateModelProfile?(modelProfile: unknown): Promise<unknown>;
  parseCompleteArtifactReceipt?(text: string): unknown;
  validatePreliveClosure?(input: {
    readonly candidatePlan: unknown;
    readonly artifactReceipt: unknown;
    readonly selection: unknown;
    readonly materialization: unknown;
    readonly authorization: unknown;
    readonly modelProfile: unknown;
    readonly operatorPolicy: unknown;
    readonly specificationDigest: string;
    readonly now?: string;
  }):
    | { readonly selection: RepositoryInterviewOperatorSelectionV1 }
    | Promise<{ readonly selection: RepositoryInterviewOperatorSelectionV1 }>;
  authorizationNow?(): string;
}

export async function runRepositoryInterviewOperatorCliV1(
  argv: readonly string[],
  boundary: RepositoryInterviewOperatorCliBoundaryV1,
): Promise<number> {
  let configuration: ReturnType<
    typeof parseRepositoryInterviewOperatorArgumentsV1
  >;
  try {
    configuration = parseRepositoryInterviewOperatorArgumentsV1(argv);
  } catch {
    boundary.writeStderr(
      'Repository interview operator configuration is invalid.\n',
    );
    return 2;
  }
  try {
    const [candidatePlanText, modelProfileText, policyText, specification] =
      await Promise.all([
        boundary.readTextFile(
          configuration.candidatePlanFile,
          MAX_CONFIGURATION_BYTES,
        ),
        boundary.readTextFile(
          configuration.modelProfileFile,
          MAX_CONFIGURATION_BYTES,
        ),
        boundary.readTextFile(
          configuration.operatorPolicyFile,
          MAX_CONFIGURATION_BYTES,
        ),
        loadRepositoryInterviewSpecification(
          configuration.specificationDirectory,
        ),
      ]);
    const parsedCandidatePlan = parseJson(candidatePlanText);
    if (
      (boundary.validateCandidatePlan === undefined) !==
      (boundary.validateModelProfile === undefined)
    )
      throw new RepositoryInterviewOperatorConfigurationError();
    const candidatePlan =
      boundary.validateCandidatePlan === undefined
        ? parsedCandidatePlan
        : await boundary.validateCandidatePlan(parsedCandidatePlan);
    const parsedModelProfile = parseJson(modelProfileText);
    const modelProfile =
      boundary.validateModelProfile === undefined
        ? parsedModelProfile
        : await boundary.validateModelProfile(parsedModelProfile);
    const policy = parseJson(policyText);
    const preflight = validateRepositoryInterviewCandidatePlanPreflightV1(
      candidatePlan,
      policy,
      modelProfile,
    );
    if (
      !preflight.ok ||
      preflight.modelProfile.providerProjectionVersion !==
        specification.manifest.openAiProjection.version ||
      preflight.modelProfile.providerProjectionDigest !==
        specification.manifest.openAiProjection.digest
    )
      throw new RepositoryInterviewOperatorConfigurationError();

    let closure: {
      readonly selection: RepositoryInterviewOperatorSelectionV1;
    } | null = null;
    if (
      configuration.artifactReceiptFile !== null &&
      configuration.selectionFile !== null &&
      configuration.selectionMaterializationFile !== null &&
      configuration.preliveAuthorizationFile !== null
    ) {
      if (
        boundary.parseCompleteArtifactReceipt === undefined ||
        boundary.validatePreliveClosure === undefined
      )
        throw new RepositoryInterviewOperatorConfigurationError();
      const [
        artifactReceiptText,
        selectionText,
        materializationText,
        authorizationText,
      ] = await Promise.all([
        boundary.readTextFile(
          configuration.artifactReceiptFile,
          MAX_CONFIGURATION_BYTES,
        ),
        boundary.readTextFile(
          configuration.selectionFile,
          MAX_CONFIGURATION_BYTES,
        ),
        boundary.readTextFile(
          configuration.selectionMaterializationFile,
          MAX_CONFIGURATION_BYTES,
        ),
        boundary.readTextFile(
          configuration.preliveAuthorizationFile,
          MAX_CONFIGURATION_BYTES,
        ),
      ]);
      const artifactReceipt =
        await boundary.parseCompleteArtifactReceipt(artifactReceiptText);
      const closureInput = {
        candidatePlan,
        artifactReceipt,
        selection: parseJson(selectionText),
        materialization: parseJson(materializationText),
        authorization: parseJson(authorizationText),
        modelProfile,
        operatorPolicy: policy,
        specificationDigest: specification.manifest.specificationDigest,
      };
      closure = await boundary.validatePreliveClosure(closureInput);
      if (!configuration.dryRun) {
        if (boundary.authorizationNow === undefined) {
          throw new RepositoryInterviewOperatorConfigurationError();
        }
        closure = await boundary.validatePreliveClosure({
          ...closureInput,
          now: boundary.authorizationNow(),
        });
      }
    }

    if (configuration.dryRun) {
      boundary.writeStdout(
        serializeCanonicalJson({
          status: 'dry-run-valid',
          candidatePlanId: preflight.candidatePlan.planId,
          candidatePlanDigest: preflight.candidatePlan.planDigest,
          candidateCount: preflight.candidatePlan.candidateIds.length,
          modelSnapshot: preflight.modelProfile.modelSnapshot,
          modelProfileDigest: preflight.modelProfileDigest,
          specificationVersion: specification.manifest.specificationVersion,
          specificationDigest: specification.manifest.specificationDigest,
          operatorPolicyDigest: preflight.policy.policyDigest,
          worstCase: preflight.worstCase,
          materializationChecked: closure !== null,
          liveAuthorizationChecked: closure !== null,
          liveReady: false,
          databaseChecked: false,
          providerChecked: false,
        }),
      );
      return 0;
    }

    if (closure === null) {
      throw new RepositoryInterviewOperatorConfigurationError();
    }

    const databasePassword = boundary.readEnvironment(
      configuration.databasePasswordEnv,
    );
    if (
      typeof databasePassword !== 'string' ||
      databasePassword.length < 1 ||
      databasePassword.length > 4_096
    )
      throw new RepositoryInterviewOperatorConfigurationError();
    const clientFactory =
      boundary.createPersistenceClient ?? createPersistenceClient;
    const closer = boundary.closePersistenceClient ?? closePersistenceClient;
    let client: PersistenceClient | undefined;
    try {
      client = clientFactory({
        host: configuration.databaseHost,
        port: configuration.databasePort,
        database: configuration.databaseName,
        username: configuration.databaseUser,
        password: databasePassword,
        ssl: configuration.databaseSsl,
        maximumConnections: preflight.policy.concurrency,
        statementTimeoutMilliseconds:
          preflight.policy.statementTimeoutMilliseconds,
        lockTimeoutMilliseconds: preflight.policy.lockTimeoutMilliseconds,
      });
      const databaseControl = Object.freeze({
        statementTimeoutMilliseconds:
          preflight.policy.statementTimeoutMilliseconds,
        lockTimeoutMilliseconds: preflight.policy.lockTimeoutMilliseconds,
      });
      const migration = await verifyMigrations(client, databaseControl);
      validatePreliveMigrationAuthority(migration);
      await validateRepositoryInterviewOperatorSelectionPersistenceV1(
        client,
        closure.selection,
        databaseControl,
      );
      const runController = new AbortController();
      const runDeadline = createProcessRunDeadlineControlV1(
        runController,
        preflight.policy.runDeadlineMilliseconds,
      );
      const persistence = createRepositoryInterviewPersistenceAdapterV1(
        client,
        {
          signal: runController.signal,
          statementTimeoutMilliseconds:
            preflight.policy.statementTimeoutMilliseconds,
          lockTimeoutMilliseconds: preflight.policy.lockTimeoutMilliseconds,
        },
      );
      const clocks = createProcessClockPortsV1();
      const credential = createLazyEnvironmentCredentialPortV1(
        configuration.openAiTokenEnv,
        (name) => boundary.readEnvironment(name),
      );
      const fetch = createExplicitGlobalFetchPortV1(boundary.createFetch());
      const provider = Object.freeze({
        forCandidate(signal: AbortSignal) {
          return createOpenAiResponsesRepositoryInterviewProviderV1({
            credential,
            fetch,
            clock: clocks.openAi,
            sleeper: createProcessSleeperPortV1(signal),
            attemptControl: createProcessAttemptControlPortV1(signal),
          });
        },
      });
      try {
        const result = await runRepositoryInterviewOperatorV1(
          {
            selection: closure.selection,
            specification,
            modelProfile: preflight.modelProfile,
            policy: preflight.policy,
            executionMode: configuration.executionMode,
            forceReason: configuration.forceReason,
            verifyImmediateReuse: configuration.verifyImmediateReuse,
          },
          {
            persistence,
            provider,
            candidateControl: createProcessCandidateControlFactoryV1(
              runController.signal,
            ),
            clock: clocks.wall,
            monotonicClock: clocks.monotonic,
            nonce: createProcessNoncePortV1(),
            runId: createProcessRunIdPortV1(),
            observer: {
              observe(event: RepositoryInterviewOperatorEventV1) {
                boundary.writeStderr(serializeCanonicalJson(event));
              },
            },
          },
        );
        if (result.receipt === null) return 1;
        const serializedReceipt = serializeRepositoryInterviewOperatorReceiptV1(
          result.receipt,
        );
        if (boundary.writeReceipt === undefined) {
          await writeRepositoryInterviewOperatorReceiptFileV1(
            configuration.receiptPath,
            serializedReceipt,
          );
        } else {
          await boundary.writeReceipt(
            configuration.receiptPath,
            serializedReceipt,
          );
        }
        return result.ok ? 0 : 1;
      } finally {
        runDeadline.dispose();
      }
    } finally {
      if (client !== undefined) await closer(client).catch(() => undefined);
    }
  } catch {
    boundary.writeStderr('Repository interview operator execution failed.\n');
    return 1;
  }
}

function parseJson(text: string): unknown {
  if (Buffer.byteLength(text, 'utf8') > MAX_CONFIGURATION_BYTES) {
    throw new RepositoryInterviewOperatorConfigurationError();
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new RepositoryInterviewOperatorConfigurationError();
  }
}

function validatePreliveMigrationAuthority(
  migration: MigrationVerification,
): void {
  const expected = [
    [
      1,
      'evidence-persistence',
      '569d7a6d6db70b1b04cadfa8798516ce4239b1179bb2f7cdd84b27641e33755f',
    ],
    [
      2,
      'runtime-migration-verification',
      'b61cf8ad8673663c646b77e8f0ebed452898aab795aa64f52217e1271e1dc2ae',
    ],
    [
      3,
      'immutable-repository-artifacts',
      '0ea1e4698e8eec6d33320df7af4758ae6b3b4fcbe3da387bb042d074b86228dc',
    ],
    [
      4,
      'repository-interviews',
      '2cd18e7d92373215b2a540cdf12e32a7e949bfb01866616e8a44ad326e45bca0',
    ],
  ] as const;
  const expectedByVersion = new Map<number, (typeof expected)[number]>(
    expected.map((record) => [record[0], record] as const),
  );
  if (
    !/^18\.4(?:\.|\s|$)/u.test(migration.postgresqlVersion) ||
    migration.migrations.length !== expected.length ||
    migration.migrations.some((record, index) => {
      const authority = expectedByVersion.get(record.version);
      return (
        record.version !== index + 1 ||
        record.name !== authority?.[1] ||
        record.checksum !== authority[2]
      );
    })
  )
    throw new RepositoryInterviewOperatorConfigurationError();
}
