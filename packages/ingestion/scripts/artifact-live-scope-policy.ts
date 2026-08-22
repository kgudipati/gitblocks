import {
  parseLiveProductionDatabaseUrlV1,
  type LiveDatabaseConfigV1,
} from './live-production-database.ts';

export const ARTIFACT_LIVE_GLOBAL_ACKNOWLEDGEMENT_V1 =
  'approved-non-production-public-artifact-collection';
export const ARTIFACT_LIVE_EPHEMERAL_DATABASE_SCOPE_V1 =
  'ephemeral-non-production';
export const ARTIFACT_LIVE_PERSISTENT_DATABASE_SCOPE_V1 =
  'persistent-private-alpha-dogfood';
export const ARTIFACT_LIVE_PERSISTENT_ACKNOWLEDGEMENT_V1 =
  'approved-private-alpha-persistent-dogfood-artifact-collection';
export const ARTIFACT_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1 =
  'approved-managed-production-public-artifact-collection';

export type ArtifactLiveDatabaseScopeV1 =
  | typeof ARTIFACT_LIVE_EPHEMERAL_DATABASE_SCOPE_V1
  | typeof ARTIFACT_LIVE_PERSISTENT_DATABASE_SCOPE_V1;

export interface ArtifactLiveDatabaseScopeAuthorityInputV1 {
  readonly scope: unknown;
  readonly persistentAcknowledgement: unknown;
}

export type ArtifactLiveDatabaseConfigV1 = LiveDatabaseConfigV1;

export interface ArtifactLiveDatabaseScopeInputV1 extends ArtifactLiveDatabaseScopeAuthorityInputV1 {
  readonly databaseConfig: unknown;
}

export interface ArtifactLiveDatabaseBoundaryInputV1 {
  readonly nonProductionAcknowledgement: unknown;
  readonly nonProductionScope: unknown;
  readonly nonProductionPersistentAcknowledgement: unknown;
  readonly nonProductionDatabaseConfig: unknown;
  readonly productionAcknowledgement: unknown;
  readonly productionDatabaseUrl: unknown;
}

export type ArtifactLiveDatabaseBoundaryV1 =
  | {
      readonly mode: 'non-production';
      readonly scope: ArtifactLiveDatabaseScopeV1;
      readonly databaseConfig: ArtifactLiveDatabaseConfigV1;
    }
  | {
      readonly mode: 'production';
      readonly databaseConfig: ArtifactLiveDatabaseConfigV1;
    };

export function selectArtifactLiveDatabaseBoundaryV1(
  input: ArtifactLiveDatabaseBoundaryInputV1,
): ArtifactLiveDatabaseBoundaryV1 {
  const nonProductionConfigured =
    input.nonProductionAcknowledgement !== undefined ||
    input.nonProductionScope !== undefined ||
    input.nonProductionPersistentAcknowledgement !== undefined ||
    hasConfiguredDatabaseField(input.nonProductionDatabaseConfig);
  const productionConfigured =
    input.productionAcknowledgement !== undefined ||
    input.productionDatabaseUrl !== undefined;
  if (nonProductionConfigured && productionConfigured) {
    throw new Error(
      'GITBLOCKS_ARTIFACT_ACKNOWLEDGEMENT, GITBLOCKS_ARTIFACT_DB_SCOPE, GITBLOCKS_ARTIFACT_PERSISTENT_ACK, and GITBLOCKS_ARTIFACT_DB_* are mutually exclusive with DATABASE_URL and GITBLOCKS_ARTIFACT_PRODUCTION_ACK.',
    );
  }
  if (productionConfigured) {
    if (
      input.productionAcknowledgement !==
      ARTIFACT_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1
    ) {
      throw new Error(
        'GITBLOCKS_ARTIFACT_PRODUCTION_ACK must equal approved-managed-production-public-artifact-collection.',
      );
    }
    return Object.freeze({
      mode: 'production',
      databaseConfig: parseLiveProductionDatabaseUrlV1(
        input.productionDatabaseUrl,
      ),
    });
  }

  if (
    input.nonProductionAcknowledgement !==
    ARTIFACT_LIVE_GLOBAL_ACKNOWLEDGEMENT_V1
  ) {
    throw new Error(
      'The exact non-production artifact acknowledgement is required.',
    );
  }
  const selected = validateArtifactLiveDatabaseScopeV1({
    scope: input.nonProductionScope,
    persistentAcknowledgement: input.nonProductionPersistentAcknowledgement,
    databaseConfig: input.nonProductionDatabaseConfig,
  });
  return Object.freeze({
    mode: 'non-production',
    scope: selected.scope,
    databaseConfig: selected.databaseConfig,
  });
}

export function assertArtifactLiveDatabaseScopeAuthorityV1(
  input: ArtifactLiveDatabaseScopeAuthorityInputV1,
): asserts input is {
  readonly scope: ArtifactLiveDatabaseScopeV1;
  readonly persistentAcknowledgement: unknown;
} {
  if (
    input.scope !== ARTIFACT_LIVE_EPHEMERAL_DATABASE_SCOPE_V1 &&
    input.scope !== ARTIFACT_LIVE_PERSISTENT_DATABASE_SCOPE_V1
  ) {
    throw new Error(
      'The artifact database must be explicitly scoped as an authorized non-production target.',
    );
  }
  if (
    input.scope === ARTIFACT_LIVE_PERSISTENT_DATABASE_SCOPE_V1 &&
    input.persistentAcknowledgement !==
      ARTIFACT_LIVE_PERSISTENT_ACKNOWLEDGEMENT_V1
  ) {
    throw new Error(
      'The exact persistent private-alpha artifact acknowledgement is required.',
    );
  }
}

export function validateArtifactLiveDatabaseScopeV1(
  input: ArtifactLiveDatabaseScopeInputV1,
): Readonly<{
  scope: ArtifactLiveDatabaseScopeV1;
  databaseConfig: ArtifactLiveDatabaseConfigV1;
}> {
  assertArtifactLiveDatabaseScopeAuthorityV1(input);
  const databaseConfig = parseDatabaseConfig(input.databaseConfig);
  if (
    input.scope === ARTIFACT_LIVE_PERSISTENT_DATABASE_SCOPE_V1 &&
    (databaseConfig.host !== '127.0.0.1' ||
      databaseConfig.database !== 'gitblocks_dogfood_test' ||
      databaseConfig.username !== 'gitblocks_persistence_dogfood' ||
      databaseConfig.ssl !== false)
  ) {
    throw new Error(
      'The persistent private-alpha artifact database configuration is not authorized.',
    );
  }
  return Object.freeze({
    scope: input.scope,
    databaseConfig,
  });
}

function parseDatabaseConfig(value: unknown): ArtifactLiveDatabaseConfigV1 {
  if (!isRecord(value)) {
    throw new Error('Artifact database configuration is incomplete.');
  }
  const host = requiredDatabaseText(value, 'host');
  const database = requiredDatabaseText(value, 'database');
  const username = requiredDatabaseText(value, 'username');
  const password = requiredDatabaseText(value, 'password');
  if (!Object.hasOwn(value, 'port')) {
    throw new Error('Artifact database configuration is incomplete.');
  }
  const port = Number(value['port']);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('Artifact database port is invalid.');
  }
  if (!Object.hasOwn(value, 'ssl')) {
    throw new Error('Artifact database configuration is incomplete.');
  }
  const ssl = value['ssl'];
  if (ssl !== 'false' && ssl !== 'require') {
    throw new Error('Artifact database SSL mode is invalid.');
  }
  return Object.freeze({
    host,
    port,
    database,
    username,
    password,
    ssl: ssl === 'require' ? 'require' : false,
  });
}

function requiredDatabaseText(
  value: Readonly<Record<string, unknown>>,
  name: 'host' | 'database' | 'username' | 'password',
): string {
  const field = value[name];
  if (
    !Object.hasOwn(value, name) ||
    typeof field !== 'string' ||
    field.length === 0
  ) {
    throw new Error('Artifact database configuration is incomplete.');
  }
  return field;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasConfiguredDatabaseField(value: unknown): boolean {
  return (
    isRecord(value) && Object.values(value).some((field) => field !== undefined)
  );
}
