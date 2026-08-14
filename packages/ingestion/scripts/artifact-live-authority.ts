export interface ArtifactLiveMigrationVerificationV1 {
  readonly migrations: readonly { readonly version: unknown }[];
}

export function assertArtifactLiveDatabaseMigrationVersionV1(
  value: unknown,
): asserts value is 7 {
  if (value !== 7) {
    throw new Error(
      'The artifact database must be verified at migration 0007.',
    );
  }
}

export async function withVerifiedArtifactLiveDatabaseMigrationV1<Result>(
  verifyDatabaseMigrations: () => Promise<ArtifactLiveMigrationVerificationV1>,
  runAuthorizedEffects: (databaseMigrationVersion: 7) => Promise<Result>,
): Promise<Result> {
  const verification = await verifyDatabaseMigrations();
  const databaseMigrationVersion = verification.migrations.at(-1)?.version;
  assertArtifactLiveDatabaseMigrationVersionV1(databaseMigrationVersion);
  return runAuthorizedEffects(databaseMigrationVersion);
}
