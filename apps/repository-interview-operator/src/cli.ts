import {
  closePersistenceClient,
  createPersistenceClient,
  type PersistenceClient,
} from '@gitblocks/persistence';
import {
  createOpenAiResponsesRepositoryInterviewProviderV1,
  loadRepositoryInterviewSpecification,
  serializeCanonicalJson,
} from '@gitblocks/interviews';

import {
  runRepositoryInterviewOperatorV1,
  validateRepositoryInterviewOperatorPreflightV1,
} from './operator.ts';
import { createRepositoryInterviewPersistenceAdapterV1 } from './persistence-adapter.ts';
import {
  parseRepositoryInterviewOperatorArgumentsV1,
  RepositoryInterviewOperatorConfigurationError,
} from './process-configuration.ts';
import {
  createExplicitGlobalFetchPortV1,
  createLazyEnvironmentCredentialPortV1,
  createProcessAttemptControlPortV1,
  createProcessClockPortsV1,
  createProcessNoncePortV1,
  createProcessRunDeadlineControlV1,
  createProcessRunIdPortV1,
  createProcessSleeperPortV1,
  writeRepositoryInterviewOperatorReceiptFileV1,
} from './process-ports.ts';
import { serializeRepositoryInterviewOperatorReceiptV1 } from './receipt.ts';
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
    const [selectionText, modelProfileText, policyText, specification] =
      await Promise.all([
        boundary.readTextFile(
          configuration.selectionFile,
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
    const selection = parseJson(selectionText);
    const modelProfile = parseJson(modelProfileText);
    const policy = parseJson(policyText);
    const preflight = validateRepositoryInterviewOperatorPreflightV1(
      selection,
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

    if (configuration.dryRun) {
      boundary.writeStdout(
        serializeCanonicalJson({
          status: 'dry-run-valid',
          selectionId: preflight.selection.selectionId,
          selectionDigest: preflight.selection.selectionDigest,
          candidateCount: preflight.selection.members.length,
          modelSnapshot: preflight.modelProfile.modelSnapshot,
          modelProfileDigest: preflight.modelProfileDigest,
          specificationVersion: specification.manifest.specificationVersion,
          specificationDigest: specification.manifest.specificationDigest,
          operatorPolicyDigest: preflight.policy.policyDigest,
          worstCase: preflight.worstCase,
          databaseChecked: false,
          providerChecked: false,
        }),
      );
      return 0;
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
      const provider = createOpenAiResponsesRepositoryInterviewProviderV1({
        credential: createLazyEnvironmentCredentialPortV1(
          configuration.openAiTokenEnv,
          (name) => boundary.readEnvironment(name),
        ),
        fetch: createExplicitGlobalFetchPortV1(boundary.createFetch()),
        clock: clocks.openAi,
        sleeper: createProcessSleeperPortV1(),
        attemptControl: createProcessAttemptControlPortV1(runController.signal),
      });
      try {
        const result = await runRepositoryInterviewOperatorV1(
          {
            selection: preflight.selection,
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
