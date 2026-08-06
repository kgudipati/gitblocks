import { execFile as execFileCallback } from 'node:child_process';
import {
  constants,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
} from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

import {
  closePersistenceClient,
  createPersistenceClient,
  createProfileMaterializationDatabaseOperator,
  putCatalogCandidate,
  setCandidateCapabilityFamilies,
  type ProfileMaterializationDatabaseOperator,
  type ProfileMaterializationProcessCommand,
  type ProfileMaterializationProcessResult,
} from '@gitblocks/persistence';

import { canonicalizeJson } from '../src/canonical-json.ts';
import { buildProfileMaterializationArtifacts } from '../src/profile-materialization-coverage.ts';
import { collectProfileMaterializationSources } from '../src/profile-materialization-providers.ts';
import {
  createProfileMaterializationSourceAuthority,
  type ProfileMaterializationSourceRecordInput,
} from '../src/profile-materialization-source-authority.ts';
import {
  PROFILE_MATERIALIZATION_CREDENTIAL_NAMES,
  PROFILE_MATERIALIZATION_FIXED_PATHS,
  verifyProfileMaterializationEvidence,
  type ProfileMaterializationCredentials,
  type ProfileMaterializationLiveEffects,
  type ProfileMaterializationPreflightResult,
} from '../src/profile-materialization-runner.ts';
import { createTransport, abortableSleep } from '../src/transport.ts';
import { ingestionError } from '../src/errors.ts';
import { seedPublicCatalogV1 } from '../src/catalog-seed.ts';

const execFile = promisify(execFileCallback);

export interface ProfileMaterializationSystemEffectsConfig {
  readonly repositoryRoot: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly fetch: typeof fetch;
  readonly now: () => Date;
  readonly databaseOperator?: ProfileMaterializationDatabaseOperator;
}

export function createProfileMaterializationSystemEffects(
  config: ProfileMaterializationSystemEffectsConfig,
): ProfileMaterializationLiveEffects {
  const database =
    config.databaseOperator ??
    createProfileMaterializationDatabaseOperator({
      runProcess: runProfileMaterializationProcess,
      sleep: abortableSleep,
    });
  const cancellation = new AbortController();
  let quarantinePaths:
    | {
        readonly receipt: string;
        readonly coverage: string;
        readonly completion: string;
      }
    | undefined;
  return {
    readFixedFile: async (path) => {
      const fullPath = await fixedPath(config.repositoryRoot, path, false);
      return readNoFollow(fullPath, 32 * 1_024 * 1_024);
    },
    validateFixedPaths: async (arguments_) => {
      for (const path of [
        arguments_.catalogPath,
        arguments_.taxonomyPath,
        arguments_.providerPolicyPath,
      ]) {
        await fixedPath(config.repositoryRoot, path, false);
      }
      for (const path of [
        arguments_.runDirectory,
        PROFILE_MATERIALIZATION_FIXED_PATHS.receipt,
        PROFILE_MATERIALIZATION_FIXED_PATHS.coverage,
        PROFILE_MATERIALIZATION_FIXED_PATHS.completion,
      ]) {
        const target = await fixedPath(config.repositoryRoot, path, true);
        await requireMissing(target);
      }
    },
    readCredential: (name) => {
      if (
        !Object.values(PROFILE_MATERIALIZATION_CREDENTIAL_NAMES).includes(
          name as (typeof PROFILE_MATERIALIZATION_CREDENTIAL_NAMES)[keyof typeof PROFILE_MATERIALIZATION_CREDENTIAL_NAMES],
        )
      ) {
        throw ingestionError('ingestion.invalid-input');
      }
      const value = config.environment[name];
      if (value === undefined) throw ingestionError('ingestion.invalid-input');
      return value;
    },
    createDatabase: async (plan, credentials, signal) => {
      await database.create(plan, databaseCredentials(credentials), signal);
    },
    proveEmptyDatabase: async (plan, credentials, signal) => {
      await database.proveEmpty(plan, databaseCredentials(credentials), signal);
    },
    prepareDatabase: async (preflight, credentials, signal) => {
      const prepared = await database.prepare(
        preflight.databasePlan,
        databaseCredentials(credentials),
        signal,
      );
      const persistence = createPersistenceClient(prepared.runtimeConfig);
      try {
        await seedPublicCatalogV1({
          catalog: preflight.catalog,
          databaseMigrationVersion: 4,
          persistence: {
            putCatalogCandidate: (command, control) =>
              putCatalogCandidate(persistence, command, control),
            setCandidateCapabilityFamilies: (command, control) =>
              setCandidateCapabilityFamilies(persistence, command, control),
          },
          signal,
        });
      } finally {
        await closePersistenceClient(persistence);
      }
      return {
        migrationInventoryDigest: prepared.migrationInventoryDigest,
        migrationCount: prepared.migrationCount,
        databaseSchemaDigest: prepared.databaseSchemaDigest,
        productTableCount: prepared.productTableCount,
      };
    },
    collectSourceAuthority: async (
      _collection,
      preflight,
      credentials,
      signal,
    ) => {
      const transport = createTransport({
        fetch: config.fetch,
        sleep: abortableSleep,
        requestTimeoutMilliseconds:
          preflight.arguments.requestTimeoutMilliseconds,
        maximumRedirects: preflight.arguments.maximumRedirects,
        maximumAttempts: preflight.arguments.maximumAttempts,
        nowMilliseconds: () => config.now().getTime(),
      });
      const records = await collectCatalog(
        preflight,
        credentials.githubToken,
        transport,
        config.now().toISOString(),
        AbortSignal.any([signal, cancellation.signal]),
      );
      return createProfileMaterializationSourceAuthority({
        policy: preflight.policy,
        catalog: preflight.catalog,
        taxonomy: preflight.taxonomy,
        sourceRecords: records,
      });
    },
    publishSourceAuthority: async (collection, authority, preflight) => {
      const directory = await ensureRunDirectory(
        config.repositoryRoot,
        preflight,
      );
      const path = resolve(directory, `${collection}-source-authority.json`);
      await exclusiveWrite(
        path,
        `${canonicalizeJson(authority).text}\n`,
        0o600,
        32 * 1_024 * 1_024,
      );
    },
    materializeProfiles: (preflight, authority) =>
      buildProfileMaterializationArtifacts(
        preflight.catalog,
        preflight.taxonomy,
        authority,
      ),
    quarantineCompletionEvidence: async (evidence, preflight) => {
      const runDirectory = await ensureRunDirectory(
        config.repositoryRoot,
        preflight,
      );
      const quarantine = resolve(runDirectory, 'quarantine');
      await createPrivateDirectory(quarantine);
      const paths = {
        receipt: resolve(quarantine, 'profile-materialization-receipt.json'),
        coverage: resolve(quarantine, 'profile-materialization-coverage.json'),
        completion: resolve(
          quarantine,
          'profile-materialization-completion.md',
        ),
      };
      await exclusiveWrite(
        paths.receipt,
        `${canonicalizeJson(evidence.receipt).text}\n`,
        0o600,
        2 * 1_024 * 1_024,
      );
      await exclusiveWrite(
        paths.coverage,
        `${canonicalizeJson(evidence.coverage).text}\n`,
        0o600,
        2 * 1_024 * 1_024,
      );
      await exclusiveWrite(
        paths.completion,
        evidence.completionMarkdown,
        0o600,
        16_384,
      );
      verifyProfileMaterializationEvidence(
        JSON.parse(await readFile(paths.receipt, 'utf8')),
        JSON.parse(await readFile(paths.coverage, 'utf8')),
        await readFile(paths.completion, 'utf8'),
      );
      quarantinePaths = paths;
    },
    disposeDatabase: async (plan, signal) => {
      await database.dispose(plan, signal);
    },
    proveDisposed: async (plan, signal) => {
      await database.proveDisposed(plan, signal);
    },
    publishCompletionEvidence: async () => {
      if (quarantinePaths === undefined) {
        throw ingestionError('ingestion.internal-invariant');
      }
      const targets = [
        [
          quarantinePaths.receipt,
          await fixedPath(
            config.repositoryRoot,
            PROFILE_MATERIALIZATION_FIXED_PATHS.receipt,
            true,
          ),
        ],
        [
          quarantinePaths.coverage,
          await fixedPath(
            config.repositoryRoot,
            PROFILE_MATERIALIZATION_FIXED_PATHS.coverage,
            true,
          ),
        ],
        [
          quarantinePaths.completion,
          await fixedPath(
            config.repositoryRoot,
            PROFILE_MATERIALIZATION_FIXED_PATHS.completion,
            true,
          ),
        ],
      ] as const;
      const published: string[] = [];
      try {
        for (const [source, target] of targets) {
          await requireMissing(target);
          await rename(source, target);
          published.push(target);
        }
      } catch {
        await Promise.all(published.map((path) => rm(path, { force: true })));
        throw ingestionError('ingestion.internal-invariant');
      }
    },
    cancel: () => {
      cancellation.abort();
    },
  };
}

async function collectCatalog(
  preflight: ProfileMaterializationPreflightResult,
  githubToken: string,
  transport: ReturnType<typeof createTransport>,
  collectedAt: string,
  signal: AbortSignal,
) {
  const records: ProfileMaterializationSourceRecordInput[] = [];
  let nextIndex = 0;
  const workers = Array.from(
    { length: preflight.arguments.concurrency },
    async () => {
      for (;;) {
        const index = nextIndex;
        nextIndex += 1;
        const candidate = preflight.catalog.candidates[index];
        if (candidate === undefined) return;
        const deadline = AbortSignal.timeout(
          preflight.arguments.candidateDeadlineMilliseconds,
        );
        const candidateSignal = AbortSignal.any([signal, deadline]);
        const collected = await collectProfileMaterializationSources(
          candidate,
          collectedAt,
          {
            transport,
            policy: preflight.policy,
            githubToken,
            correlationId: preflight.databasePlan.identity.runIdDigest,
            signal: candidateSignal,
            deadlineSignal: signal,
          },
        );
        records.push(
          ...collected.sourceRecords.map((record) => ({
            ...record,
            evidenceIds: [],
          })),
        );
      }
    },
  );
  await Promise.all(workers);
  return records;
}

function databaseCredentials(credentials: ProfileMaterializationCredentials) {
  return {
    ownerUrl: credentials.ownerUrl,
    ownerPassword: credentials.ownerPassword,
    runtimeUrl: credentials.runtimeUrl,
    runtimePassword: credentials.runtimePassword,
  };
}

async function ensureRunDirectory(
  repositoryRoot: string,
  preflight: ProfileMaterializationPreflightResult,
): Promise<string> {
  const expected = await fixedPath(
    repositoryRoot,
    preflight.arguments.runDirectory,
    true,
  );
  const parent = dirname(expected);
  await createPrivateDirectory(parent);
  await createPrivateDirectory(expected);
  return expected;
}

async function createPrivateDirectory(path: string): Promise<void> {
  try {
    await mkdir(path, { mode: 0o700 });
  } catch (error) {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('code' in error) ||
      (error as { readonly code?: unknown }).code !== 'EEXIST'
    ) {
      throw error;
    }
  }
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw ingestionError('ingestion.invalid-input');
  }
  await import('node:fs/promises').then(({ chmod }) => chmod(path, 0o700));
}

async function exclusiveWrite(
  path: string,
  contents: string,
  mode: number,
  maximumBytes: number,
): Promise<void> {
  if (Buffer.byteLength(contents, 'utf8') > maximumBytes) {
    throw ingestionError('ingestion.body-too-large');
  }
  await requireMissing(path);
  const handle = await open(
    path,
    constants.O_CREAT |
      constants.O_EXCL |
      constants.O_WRONLY |
      constants.O_NOFOLLOW,
    mode,
  );
  try {
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function requireMissing(path: string): Promise<void> {
  try {
    await lstat(path);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { readonly code?: unknown }).code === 'ENOENT'
    )
      return;
    throw error;
  }
  throw ingestionError('ingestion.invalid-input');
}

async function readNoFollow(
  path: string,
  maximumBytes: number,
): Promise<string> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maximumBytes) {
      throw ingestionError('ingestion.invalid-input');
    }
    return await handle.readFile('utf8');
  } finally {
    await handle.close();
  }
}

async function fixedPath(
  repositoryRoot: string,
  relativePath: string,
  allowMissing: boolean,
): Promise<string> {
  if (
    relativePath.startsWith('/') ||
    relativePath.includes('\\') ||
    relativePath
      .split('/')
      .some((part) => part === '' || part === '.' || part === '..')
  ) {
    throw ingestionError('ingestion.invalid-input');
  }
  const root = await realpath(repositoryRoot);
  const path = resolve(root, relativePath);
  if (!path.startsWith(`${root}${sep}`)) {
    throw ingestionError('ingestion.invalid-input');
  }
  let current = dirname(path);
  while (current !== root) {
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink())
        throw ingestionError('ingestion.invalid-input');
    } catch (error) {
      if (
        allowMissing &&
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { readonly code?: unknown }).code === 'ENOENT'
      ) {
        current = dirname(current);
        continue;
      }
      throw error;
    }
    current = dirname(current);
  }
  if (!allowMissing) {
    const stat = await lstat(path);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      (await realpath(path)) !== path
    ) {
      throw ingestionError('ingestion.invalid-input');
    }
  }
  return path;
}

async function runProfileMaterializationProcess(
  command: ProfileMaterializationProcessCommand,
  environment: Readonly<Record<string, string>>,
  signal: AbortSignal,
): Promise<ProfileMaterializationProcessResult> {
  if (
    Object.keys(environment).some(
      (name) => !command.allowedEnvironmentNames.includes(name),
    ) ||
    command.arguments.some((argument) => /(?:password|token)=/iu.test(argument))
  ) {
    throw new Error('profile-materialization.invalid-process-plan');
  }
  try {
    const result = await execFile('docker', [...command.arguments], {
      encoding: 'utf8',
      maxBuffer: command.maximumOutputBytes,
      env: {
        PATH: '/usr/local/bin:/usr/bin:/bin',
        ...environment,
      },
      signal,
    });
    return { exitCode: 0, stdout: result.stdout };
  } catch (error) {
    if (signal.aborted) {
      // The caught process error is intentionally excluded from the safe operator envelope.
      // eslint-disable-next-line preserve-caught-error
      throw new Error('profile-materialization.cancelled');
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { readonly code?: unknown }).code === 'number'
    ) {
      return {
        exitCode: (error as { readonly code: number }).code,
        stdout:
          'stdout' in error &&
          typeof (error as { readonly stdout?: unknown }).stdout === 'string'
            ? (error as { readonly stdout: string }).stdout.slice(
                0,
                command.maximumOutputBytes,
              )
            : '',
      };
    }
    // Process details can contain local runtime data and are intentionally not attached.
    // eslint-disable-next-line preserve-caught-error
    throw new Error('profile-materialization.process-failed');
  }
}
