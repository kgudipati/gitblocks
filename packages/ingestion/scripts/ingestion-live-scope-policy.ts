import {
  parseLiveProductionDatabaseUrlV1,
  type LiveDatabaseConfigV1,
} from './live-production-database.ts';

export const INGESTION_LIVE_NON_PRODUCTION_ACKNOWLEDGEMENT_V1 =
  'approved-non-production-public-ingestion-with-public-sources-only';
export const INGESTION_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1 =
  'approved-managed-production-public-ingestion-with-public-sources-only';

export interface IngestionLiveDatabaseBoundaryInputV1 {
  readonly nonProductionAcknowledgement: unknown;
  readonly nonProductionDatabaseConfig: unknown;
  readonly productionAcknowledgement: unknown;
  readonly productionDatabaseUrl: unknown;
}

export type IngestionLiveDatabaseBoundaryV1 =
  | {
      readonly mode: 'non-production';
      readonly databaseConfig: LiveDatabaseConfigV1;
    }
  | {
      readonly mode: 'production';
      readonly databaseConfig: LiveDatabaseConfigV1;
    };

export function selectIngestionLiveDatabaseAuthorityV1(
  input: IngestionLiveDatabaseBoundaryInputV1,
): IngestionLiveDatabaseBoundaryV1['mode'] {
  const nonProductionConfigured =
    input.nonProductionAcknowledgement !== undefined ||
    hasConfiguredDatabaseField(input.nonProductionDatabaseConfig);
  const productionConfigured =
    input.productionAcknowledgement !== undefined ||
    input.productionDatabaseUrl !== undefined;
  if (nonProductionConfigured && productionConfigured) {
    throw new Error(
      'GITBLOCKS_INGEST_ACKNOWLEDGEMENT and GITBLOCKS_INGEST_DB_* are mutually exclusive with DATABASE_URL and GITBLOCKS_INGEST_PRODUCTION_ACK.',
    );
  }
  if (productionConfigured) {
    if (
      input.productionAcknowledgement !==
      INGESTION_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1
    ) {
      throw new Error(
        'GITBLOCKS_INGEST_PRODUCTION_ACK must equal approved-managed-production-public-ingestion-with-public-sources-only.',
      );
    }
    return 'production';
  }
  if (
    input.nonProductionAcknowledgement !==
    INGESTION_LIVE_NON_PRODUCTION_ACKNOWLEDGEMENT_V1
  ) {
    throw new Error(
      'The exact non-production ingestion acknowledgement is required.',
    );
  }
  return 'non-production';
}

export function selectIngestionLiveDatabaseBoundaryV1(
  input: IngestionLiveDatabaseBoundaryInputV1,
): IngestionLiveDatabaseBoundaryV1 {
  const mode = selectIngestionLiveDatabaseAuthorityV1(input);
  if (mode === 'production') {
    return Object.freeze({
      mode: 'production',
      databaseConfig: parseLiveProductionDatabaseUrlV1(
        input.productionDatabaseUrl,
      ),
    });
  }

  return Object.freeze({
    mode: 'non-production',
    databaseConfig: parseNonProductionDatabaseConfig(
      input.nonProductionDatabaseConfig,
    ),
  });
}

function parseNonProductionDatabaseConfig(
  value: unknown,
): LiveDatabaseConfigV1 {
  const record = isRecord(value) ? value : {};
  const port = Number(
    requiredDatabaseEnvironmentText(record, 'port', 'GITBLOCKS_INGEST_DB_PORT'),
  );
  const ssl = requiredDatabaseEnvironmentText(
    record,
    'ssl',
    'GITBLOCKS_INGEST_DB_SSL',
  );
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('Ingestion database port is invalid.');
  }
  if (ssl !== 'false' && ssl !== 'require') {
    throw new Error('Ingestion database SSL mode is invalid.');
  }
  return Object.freeze({
    host: requiredDatabaseEnvironmentText(
      record,
      'host',
      'GITBLOCKS_INGEST_DB_HOST',
    ),
    port,
    database: requiredDatabaseEnvironmentText(
      record,
      'database',
      'GITBLOCKS_INGEST_DB_DATABASE',
    ),
    username: requiredDatabaseEnvironmentText(
      record,
      'username',
      'GITBLOCKS_INGEST_DB_USERNAME',
    ),
    password: requiredDatabaseEnvironmentText(
      record,
      'password',
      'GITBLOCKS_INGEST_DB_PASSWORD',
    ),
    ssl: ssl === 'require' ? 'require' : false,
  });
}

function requiredDatabaseEnvironmentText(
  value: Readonly<Record<string, unknown>>,
  fieldName: string,
  environmentName: string,
): string {
  const field = value[fieldName];
  if (typeof field !== 'string' || field.length === 0) {
    throw new Error(
      `Required environment configuration is missing: ${environmentName}.`,
    );
  }
  return field;
}

function hasConfiguredDatabaseField(value: unknown): boolean {
  return (
    isRecord(value) && Object.values(value).some((field) => field !== undefined)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
