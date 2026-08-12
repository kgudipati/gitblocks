import postgres from 'postgres';

export async function setup(): Promise<void> {
  if (process.env['GITBLOCKS_DB_TEST_ACK'] !== 'ephemeral') {
    throw new Error('PostgreSQL integration database must be ephemeral.');
  }
  const database = requiredEnvironment('GITBLOCKS_TEST_DB_DATABASE');
  if (!database.endsWith('_test')) {
    throw new Error('PostgreSQL integration database must be a test database.');
  }
  const sql = postgres({
    host: requiredEnvironment('GITBLOCKS_TEST_DB_HOST'),
    port: parsePort(requiredEnvironment('GITBLOCKS_TEST_DB_PORT')),
    database,
    user: requiredEnvironment('GITBLOCKS_TEST_DB_OWNER'),
    password: requiredEnvironment('GITBLOCKS_TEST_DB_PASSWORD'),
    ssl: false,
    max: 1,
    connect_timeout: 5,
    idle_timeout: 5,
    onnotice: () => undefined,
    debug: false,
  });
  try {
    await sql.unsafe(`
      do $gitblocks_test_role$
      begin
        if not exists (
          select 1
          from pg_catalog.pg_roles
          where rolname = 'gitblocks_persistence_test'
        ) then
          create role gitblocks_persistence_test
            login
            password 'persistence-test-only'
            nosuperuser
            nocreatedb
            nocreaterole
            noreplication
            nobypassrls
            in role gitblocks_persistence;
        else
          grant gitblocks_persistence to gitblocks_persistence_test;
        end if;
      end
      $gitblocks_test_role$;

      do $gitblocks_serving_test_role$
      begin
        if not exists (
          select 1
          from pg_catalog.pg_roles
          where rolname = 'gitblocks_serving_test'
        ) then
          create role gitblocks_serving_test
            login
            password 'serving-test-only'
            nosuperuser
            nocreatedb
            nocreaterole
            noreplication
            nobypassrls
            in role gitblocks_serving;
        else
          grant gitblocks_serving to gitblocks_serving_test;
        end if;
      end
      $gitblocks_serving_test_role$;
    `);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error('PostgreSQL integration configuration is required.');
  }
  return value;
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PostgreSQL integration configuration is invalid.');
  }
  return port;
}
