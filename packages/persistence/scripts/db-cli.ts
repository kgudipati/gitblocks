import {
  checkDatabase,
  configureAndVerifyServingLogin,
  DatabaseCommandConfigurationError,
  migrateDatabase,
  readDatabaseCommandConfig,
  ServingLoginOperatorError,
} from './database-support.ts';

const command = process.argv[2];

try {
  await run(command);
} catch (error) {
  process.stderr.write(`${safeCommandError(error)}\n`);
  process.exitCode = 1;
}

async function run(selectedCommand: string | undefined): Promise<void> {
  if (
    selectedCommand !== 'migrate' &&
    selectedCommand !== 'check' &&
    selectedCommand !== 'serving-login'
  ) {
    throw new DatabaseCommandConfigurationError(
      'Database command must be migrate, check, or serving-login.',
    );
  }
  const selected = readDatabaseCommandConfig();
  if (selected === undefined) {
    throw new DatabaseCommandConfigurationError(
      'GITBLOCKS_TEST_DB_* with GITBLOCKS_DB_TEST_ACK or DATABASE_URL with GITBLOCKS_DB_PRODUCTION_ACK is required.',
    );
  }

  if (selectedCommand === 'migrate') {
    const result = await migrateDatabase(selected.config);
    process.stdout.write(
      `Database migrations applied (${result.postgresqlVersion}; ${String(result.migrations.length)} migration).\n`,
    );
    return;
  }
  if (selectedCommand === 'check') {
    const result = await checkDatabase(selected.config);
    process.stdout.write(
      `Database check passed (${result.verification.postgresqlVersion}; ${String(result.verification.migrations.length)} migration; ${String(result.productTables)} public product tables; ${String(result.rowSecurityPolicies)} RLS policies).\n`,
    );
    return;
  }
  if (selected.mode !== 'production') {
    throw new DatabaseCommandConfigurationError(
      'DATABASE_URL and GITBLOCKS_DB_PRODUCTION_ACK are required for serving-login; GITBLOCKS_TEST_DB_* and GITBLOCKS_DB_TEST_ACK are not accepted.',
    );
  }
  const report = await configureAndVerifyServingLogin(selected.config);
  process.stdout.write(`${JSON.stringify(report)}\n`);
}

function safeCommandError(error: unknown): string {
  if (
    error instanceof DatabaseCommandConfigurationError ||
    error instanceof ServingLoginOperatorError
  ) {
    return error.message;
  }
  if (command === 'migrate') {
    return 'Database migration failed.';
  }
  if (command === 'check') {
    return 'Database check failed.';
  }
  if (command === 'serving-login') {
    return 'Serving login command failed.';
  }
  return 'Database command failed.';
}
