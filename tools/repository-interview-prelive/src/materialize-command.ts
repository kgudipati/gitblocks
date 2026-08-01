import type { ArtifactReceipt } from '@gitblocks/ingestion';
import { parseCompleteArtifactReceiptTextV1 } from '@gitblocks/ingestion';
import { serializeCanonicalJson } from '@gitblocks/interviews';
import {
  closePersistenceClient,
  createPersistenceClient,
  loadRepositoryArtifactSet,
  verifyMigrations,
  type PersistenceClient,
} from '@gitblocks/persistence';
import { parseRepositoryInterviewCandidatePlanV1 } from '@gitblocks/repository-interview-operator';

import {
  readBoundedNoFollowTextFileV1,
  writeExclusiveAtomicPreliveOutputsV1,
} from './file-boundary.ts';
import {
  parseRepositoryInterviewPreliveMaterializeArgumentsV1,
  type RepositoryInterviewPreliveMaterializeConfigurationV1,
} from './materialize-configuration.ts';
import { materializeRepositoryInterviewOperatorSelectionV1 } from './materialization.ts';
import { validateRepositoryInterviewPreliveFilesV1 } from './verification.ts';

const MAXIMUM_INPUT_BYTES = 8 * 1_024 * 1_024;

export interface RepositoryInterviewPreliveMaterializeBoundaryV1 {
  readonly repositoryRoot: string;
  readTextFile?(path: string, maximumBytes: number): Promise<string>;
  readEnvironment(name: string): string | undefined;
  createPersistenceClient?: typeof createPersistenceClient;
  closePersistenceClient?: typeof closePersistenceClient;
  writeOutputs?: typeof writeExclusiveAtomicPreliveOutputsV1;
  verifyMigrations?: typeof verifyMigrations;
  loadArtifactSet?(
    client: PersistenceClient,
    artifactSetId: string,
  ): ReturnType<typeof loadRepositoryArtifactSet>;
}

export async function runRepositoryInterviewPreliveMaterializeCommandV1(
  argv: readonly string[],
  boundary: RepositoryInterviewPreliveMaterializeBoundaryV1,
): Promise<void> {
  const configuration =
    parseRepositoryInterviewPreliveMaterializeArgumentsV1(argv);
  const reader = (path: string, maximumBytes: number) =>
    boundary.readTextFile === undefined
      ? readBoundedNoFollowTextFileV1(path, maximumBytes)
      : boundary.readTextFile(path, maximumBytes);
  const expected = await validateRepositoryInterviewPreliveFilesV1(
    boundary.repositoryRoot,
  );
  const [planText, receiptText] = await Promise.all([
    reader(configuration.candidatePlanFile, MAXIMUM_INPUT_BYTES),
    reader(configuration.artifactReceiptFile, MAXIMUM_INPUT_BYTES),
  ]);
  const plan = parsePlan(planText, expected.plans);
  const receipt: ArtifactReceipt = parseCompleteArtifactReceiptTextV1(
    receiptText,
    {
      catalogVersion: 'public-v1',
      catalogDigest: expected.manifest.catalogDigest,
      artifactManifestVersion: 'public-artifacts-v1',
      artifactManifestDigest: expected.manifest.artifactManifestDigest,
      candidateIds: expected.catalogCandidateIds,
    },
  );

  const password = boundary.readEnvironment(configuration.databasePasswordEnv);
  if (
    typeof password !== 'string' ||
    password.length < 1 ||
    password.length > 4_096
  ) {
    throw invalid();
  }
  const factory = boundary.createPersistenceClient ?? createPersistenceClient;
  const closer = boundary.closePersistenceClient ?? closePersistenceClient;
  let client: PersistenceClient | undefined;
  try {
    client = factory({
      host: configuration.databaseHost,
      port: configuration.databasePort,
      database: configuration.databaseName,
      username: configuration.databaseUser,
      password,
      ssl: configuration.databaseSsl,
      maximumConnections: 2,
      connectTimeoutMilliseconds: 5_000,
      idleTimeoutMilliseconds: 5_000,
      statementTimeoutMilliseconds: 10_000,
      lockTimeoutMilliseconds: 5_000,
    });
    const activeClient = client;
    const migrationVerifier = boundary.verifyMigrations ?? verifyMigrations;
    const migration = await migrationVerifier(activeClient, {
      statementTimeoutMilliseconds: 10_000,
      lockTimeoutMilliseconds: 5_000,
    });
    validateMigration(migration);
    const result = await materializeRepositoryInterviewOperatorSelectionV1(
      {
        candidatePlan: plan,
        artifactReceipt: receipt,
        fullCatalogCandidateIds: expected.catalogCandidateIds,
        selectionId: configuration.selectionId,
      },
      {
        loadRepositoryArtifactSet: (artifactSetId) =>
          boundary.loadArtifactSet === undefined
            ? loadRepositoryArtifactSet(
                activeClient,
                { artifactSetId },
                {
                  statementTimeoutMilliseconds: 10_000,
                  lockTimeoutMilliseconds: 5_000,
                },
              )
            : boundary.loadArtifactSet(activeClient, artifactSetId),
      },
    );
    const writer =
      boundary.writeOutputs ?? writeExclusiveAtomicPreliveOutputsV1;
    await writer([
      {
        path: configuration.selectionOutputPath,
        content: serializeCanonicalJson(result.selection),
      },
      {
        path: configuration.materializationOutputPath,
        content: serializeCanonicalJson(result.materialization),
      },
    ]);
  } catch {
    throw invalid();
  } finally {
    if (client !== undefined) await closer(client).catch(() => undefined);
  }
}

function parsePlan(
  text: string,
  plans: Awaited<
    ReturnType<typeof validateRepositoryInterviewPreliveFilesV1>
  >['plans'],
) {
  if (Buffer.byteLength(text, 'utf8') > MAXIMUM_INPUT_BYTES) throw invalid();
  let input: unknown;
  try {
    input = JSON.parse(text) as unknown;
  } catch {
    throw invalid();
  }
  const parsed = parseRepositoryInterviewCandidatePlanV1(input);
  if (!parsed.ok) throw invalid();
  const accepted = Object.values(plans).some(
    (plan) =>
      plan.planId === parsed.value.planId &&
      plan.planDigest === parsed.value.planDigest,
  );
  if (!accepted) throw invalid();
  return parsed.value;
}

function validateMigration(
  value: Awaited<ReturnType<typeof verifyMigrations>>,
): void {
  const checksums = [
    '569d7a6d6db70b1b04cadfa8798516ce4239b1179bb2f7cdd84b27641e33755f',
    'b61cf8ad8673663c646b77e8f0ebed452898aab795aa64f52217e1271e1dc2ae',
    '0ea1e4698e8eec6d33320df7af4758ae6b3b4fcbe3da387bb042d074b86228dc',
    '2cd18e7d92373215b2a540cdf12e32a7e949bfb01866616e8a44ad326e45bca0',
  ];
  if (
    !/^18\.4(?:\.|\s|$)/u.test(value.postgresqlVersion) ||
    value.migrations.length !== 4 ||
    value.migrations.some(
      (migration, index) =>
        migration.version !== index + 1 ||
        migration.checksum !== checksums[index],
    )
  )
    throw invalid();
}

export type { RepositoryInterviewPreliveMaterializeConfigurationV1 };

function invalid(): Error {
  const error = new Error('Repository interview materialization failed.');
  Object.defineProperty(error, 'stack', { value: undefined });
  return error;
}
