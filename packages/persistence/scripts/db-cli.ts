import {
  checkDatabase,
  migrateDatabase,
  readInjectedDatabaseConfig,
} from './database-support.ts';

const command = process.argv[2];
const config = readInjectedDatabaseConfig();

if (config === undefined) {
  throw new Error('Explicit ephemeral PostgreSQL configuration is required.');
}

if (command === 'migrate') {
  const result = await migrateDatabase(config);
  process.stdout.write(
    `Database migrations applied (${result.postgresqlVersion}; ${String(result.migrations.length)} migration).\n`,
  );
} else if (command === 'check') {
  const result = await checkDatabase(config);
  process.stdout.write(
    `Database check passed (${result.verification.postgresqlVersion}; ${String(result.verification.migrations.length)} migration; ${String(result.forcedRlsTables)} forced-RLS tables).\n`,
  );
} else {
  throw new Error('Database command is invalid.');
}
