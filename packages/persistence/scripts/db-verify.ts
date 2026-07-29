import {
  checkDatabase,
  migrateDatabase,
  provisionTestDatabase,
  runDatabaseIntegrationTests,
} from './database-support.ts';

const database = await provisionTestDatabase();
try {
  const migration = await migrateDatabase(database.config);
  const before = await checkDatabase(database.config);
  await runDatabaseIntegrationTests(database.environment);
  const after = await checkDatabase(database.config);
  process.stdout.write(
    [
      'PostgreSQL verification passed',
      `(${migration.postgresqlVersion};`,
      `${String(before.verification.migrations.length)} migration;`,
      `${String(after.forcedRlsTables)} forced-RLS tables;`,
      'integration suite completed without skips).',
      '\n',
    ].join(' '),
  );
} finally {
  await database.cleanup();
}
