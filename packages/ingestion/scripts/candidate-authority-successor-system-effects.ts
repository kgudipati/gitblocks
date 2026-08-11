import { execFile } from 'node:child_process';
import {
  constants,
  link,
  lstat,
  open,
  realpath,
  unlink,
  type FileHandle,
} from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

import { parseCapabilityTaxonomyV1 } from '@gitblocks/contracts';

import { collectCandidateAuthoritySourceAuthority } from '../src/candidate-authority-live-collector.ts';
import {
  CANDIDATE_AUTHORITY_SUCCESSOR_ZERO_EFFECT_AUDIT,
  type CandidateAuthoritySuccessorEffects,
} from '../src/candidate-authority-live-v6-runner.ts';
import {
  CANDIDATE_AUTHORITY_ACCEPTED_CORRECTION_PARENT,
  CANDIDATE_AUTHORITY_SUCCESSOR_MAXIMUM_SOURCE_BYTES,
  CANDIDATE_AUTHORITY_SUCCESSOR_OUTPUT_PATHS,
  CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_PATH,
  CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_STAGING_PATH,
  CANDIDATE_AUTHORITY_SUCCESSOR_STAGING_PATHS,
  parseCandidateAuthoritySuccessorFixedAuthorities,
  parseCandidateAuthoritySuccessorSourceAuthority,
} from '../src/candidate-authority-successor-contracts.ts';
import {
  CANDIDATE_AUTHORITY_FAILURE_RECORD_V2_PATH,
  CANDIDATE_AUTHORITY_FIELD_PLAN_V6_PATH,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_PATH,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V3_PATH,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_PATH,
  CANDIDATE_AUTHORITY_REPLAY_V5_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V8_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_PATH,
  materializeCandidateAuthorityFieldPlanV6,
  validateCandidateAuthorityNpmCorrectionAuthorities,
} from '../src/candidate-authority-npm-source-correction.ts';
import {
  CANDIDATE_AUTHORITY_FAILURE_RECORD_PATH,
  CANDIDATE_AUTHORITY_FIELD_PLAN_V5_PATH,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_PATH,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_PATH,
  CANDIDATE_AUTHORITY_REPLAY_V3_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V6_PATH,
  materializeCandidateAuthorityFieldPlanV5,
  parseCandidateAuthorityPostmortemAuthorities,
} from '../src/candidate-authority-postmortem.ts';
import { IngestionError, ingestionError } from '../src/errors.ts';
import {
  CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_PATH,
  CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_V3_PATH,
  parseCandidateAuthorityPartialSemanticRegistry,
  parseCandidateAuthorityPartialSemanticRegistryV3,
} from '../src/candidate-authority-partial-semantics.ts';
import {
  CANDIDATE_AUTHORITY_FIELD_PLAN_V4_PATH,
  CANDIDATE_AUTHORITY_READINESS_POLICY_V3_PATH,
  parseCandidateAuthorityFieldPlanV4,
  parseCandidateAuthorityReadinessPolicyV3,
} from '../src/candidate-authority-readiness.ts';
import { parsePublicCatalog } from '../src/manifest.ts';
import { abortableSleep, createTransport } from '../src/transport.ts';

const execFileAsync = promisify(execFile);
const CATALOG_PATH = 'catalog/public-v1/manifest.json' as const;
const TAXONOMY_PATH =
  'catalog/capability-taxonomy/1.0.0/manifest.json' as const;
const HISTORICAL_OUTPUTS = [
  'catalog/public-v1/candidate-authority-source-authority-v1.json',
  'catalog/public-v1/candidate-authority-source-authority-v1.staging.json',
  'catalog/public-v1/candidate-authority-profiles-v1.json',
  'catalog/public-v1/candidate-authority-profiles-v1.staging.json',
  'catalog/public-v1/candidate-authority-partial-evidence-v1.json',
  'catalog/public-v1/candidate-authority-partial-evidence-v1.staging.json',
  'catalog/public-v1/candidate-authority-evidence-v1.json',
  'catalog/public-v1/candidate-authority-evidence-v1.staging.json',
  'catalog/public-v1/candidate-authority-dossiers-v1.json',
  'catalog/public-v1/candidate-authority-dossiers-v1.staging.json',
  'catalog/public-v1/candidate-authority-dossier-projection-v1.json',
  'catalog/public-v1/candidate-authority-dossier-projection-v1.staging.json',
  'catalog/public-v1/candidate-authority-readiness-report-v1.json',
  'catalog/public-v1/candidate-authority-readiness-report-v1.staging.json',
  'catalog/public-v1/candidate-authority-root-v4.json',
  'catalog/public-v1/candidate-authority-root-v4.staging.json',
  'catalog/public-v1/candidate-authority-source-authority-v2.json',
  'catalog/public-v1/candidate-authority-source-authority-v2.staging.json',
  'catalog/public-v1/candidate-authority-profiles-v2.json',
  'catalog/public-v1/candidate-authority-profiles-v2.staging.json',
  'catalog/public-v1/candidate-authority-partial-evidence-v2.json',
  'catalog/public-v1/candidate-authority-partial-evidence-v2.staging.json',
  'catalog/public-v1/candidate-authority-evidence-v2.json',
  'catalog/public-v1/candidate-authority-evidence-v2.staging.json',
  'catalog/public-v1/candidate-authority-dossiers-v2.json',
  'catalog/public-v1/candidate-authority-dossiers-v2.staging.json',
  'catalog/public-v1/candidate-authority-dossier-projection-v2.json',
  'catalog/public-v1/candidate-authority-dossier-projection-v2.staging.json',
  'catalog/public-v1/candidate-authority-readiness-report-v2.json',
  'catalog/public-v1/candidate-authority-readiness-report-v2.staging.json',
  'catalog/public-v1/candidate-authority-root-v5.json',
  'catalog/public-v1/candidate-authority-root-v5.staging.json',
  'packages/ranking',
] as const;

export function createCandidateAuthoritySuccessorSystemEffects(config: {
  readonly repositoryRoot: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly fetch: typeof fetch;
  readonly now: () => Date;
}): CandidateAuthoritySuccessorEffects {
  if (
    typeof config.fetch !== 'function' ||
    typeof config.now !== 'function' ||
    typeof config.repositoryRoot !== 'string' ||
    config.repositoryRoot.length < 1
  )
    invalid();
  let metrics = emptyMetrics();
  return {
    preflight: async (acceptedHead) => {
      const [
        catalogText,
        taxonomyText,
        readinessText,
        fieldPlanV4Text,
        partialRegistryV2Text,
        partialRegistryV3Text,
        providerV1,
        providerV2,
        providerV3,
        sourceV6,
        sourceV7,
        sourceV8,
        replayV5,
        authorizationV6,
        failureRecordV1,
        failureRecordV2,
        fieldPlanV5,
        fieldPlanV6,
        replayV3,
        authorizationV4,
        git,
      ] = await Promise.all([
        readFixed(config.repositoryRoot, CATALOG_PATH, 32 * 1024 * 1024),
        readFixed(config.repositoryRoot, TAXONOMY_PATH, 4 * 1024 * 1024),
        readFixed(
          config.repositoryRoot,
          CANDIDATE_AUTHORITY_READINESS_POLICY_V3_PATH,
          4 * 1024 * 1024,
        ),
        readFixed(
          config.repositoryRoot,
          CANDIDATE_AUTHORITY_FIELD_PLAN_V4_PATH,
          4 * 1024 * 1024,
        ),
        readFixed(
          config.repositoryRoot,
          CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_PATH,
          4 * 1024 * 1024,
        ),
        readFixed(
          config.repositoryRoot,
          CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_V3_PATH,
          4 * 1024 * 1024,
        ),
        readFixed(
          config.repositoryRoot,
          CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_PATH,
          4 * 1024 * 1024,
        ),
        readFixed(
          config.repositoryRoot,
          CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_PATH,
          4 * 1024 * 1024,
        ),
        readFixed(
          config.repositoryRoot,
          CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V3_PATH,
          4 * 1024 * 1024,
        ),
        readFixed(
          config.repositoryRoot,
          CANDIDATE_AUTHORITY_SOURCE_POLICY_V6_PATH,
          4 * 1024 * 1024,
        ),
        readFixed(
          config.repositoryRoot,
          CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_PATH,
          4 * 1024 * 1024,
        ),
        readFixed(
          config.repositoryRoot,
          CANDIDATE_AUTHORITY_SOURCE_POLICY_V8_PATH,
          4 * 1024 * 1024,
        ),
        readFixed(
          config.repositoryRoot,
          CANDIDATE_AUTHORITY_REPLAY_V5_PATH,
          4 * 1024 * 1024,
        ),
        readFixed(
          config.repositoryRoot,
          CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_PATH,
          4 * 1024 * 1024,
        ),
        readFixed(
          config.repositoryRoot,
          CANDIDATE_AUTHORITY_FAILURE_RECORD_PATH,
          4 * 1024 * 1024,
        ),
        readFixed(
          config.repositoryRoot,
          CANDIDATE_AUTHORITY_FAILURE_RECORD_V2_PATH,
          4 * 1024 * 1024,
        ),
        readFixed(
          config.repositoryRoot,
          CANDIDATE_AUTHORITY_FIELD_PLAN_V5_PATH,
          4 * 1024 * 1024,
        ),
        readFixed(
          config.repositoryRoot,
          CANDIDATE_AUTHORITY_FIELD_PLAN_V6_PATH,
          4 * 1024 * 1024,
        ),
        readFixed(
          config.repositoryRoot,
          CANDIDATE_AUTHORITY_REPLAY_V3_PATH,
          4 * 1024 * 1024,
        ),
        readFixed(
          config.repositoryRoot,
          CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_PATH,
          4 * 1024 * 1024,
        ),
        readGitState(config.repositoryRoot),
        ...[
          ...HISTORICAL_OUTPUTS,
          ...CANDIDATE_AUTHORITY_SUCCESSOR_OUTPUT_PATHS,
          ...CANDIDATE_AUTHORITY_SUCCESSOR_STAGING_PATHS,
        ].map((path) => requireMissing(config.repositoryRoot, path)),
      ]);
      parseCandidateAuthorityPostmortemAuthorities({
        failureRecord: JSON.parse(failureRecordV1) as unknown,
        providerContract: JSON.parse(providerV1) as unknown,
        fieldPlan: JSON.parse(fieldPlanV5) as unknown,
        sourcePolicy: JSON.parse(sourceV6) as unknown,
        replay: JSON.parse(replayV3) as unknown,
        authorization: JSON.parse(authorizationV4) as unknown,
      });
      const fixed = parseCandidateAuthoritySuccessorFixedAuthorities({
        providerContractV1: providerV1,
        providerContractV2: providerV2,
        providerContractV3: providerV3,
        sourcePolicyV6: sourceV6,
        sourcePolicyV7: sourceV7,
        sourcePolicyV8: sourceV8,
        replayV5,
        authorizationV6,
      });
      validateCandidateAuthorityNpmCorrectionAuthorities({
        failureRecordV2: JSON.parse(failureRecordV2) as unknown,
        fieldPlanV6: JSON.parse(fieldPlanV6) as unknown,
        providerContractV3: JSON.parse(providerV3) as unknown,
        sourcePolicyV8: JSON.parse(sourceV8) as unknown,
        replayV5: JSON.parse(replayV5) as unknown,
        authorizationV6: JSON.parse(authorizationV6) as unknown,
      });
      const catalog = parsePublicCatalog(catalogText);
      const taxonomyResult = parseCapabilityTaxonomyV1(
        JSON.parse(taxonomyText) as unknown,
      );
      if (!taxonomyResult.ok) throw ingestionError('ingestion.invalid-input');
      const taxonomy = taxonomyResult.value;
      const registryV2 = parseCandidateAuthorityPartialSemanticRegistry(
        JSON.parse(partialRegistryV2Text) as unknown,
      );
      const registryV3 = parseCandidateAuthorityPartialSemanticRegistryV3(
        JSON.parse(partialRegistryV3Text) as unknown,
      );
      const readiness = parseCandidateAuthorityReadinessPolicyV3(
        JSON.parse(readinessText) as unknown,
      );
      const fieldPlanV4 = parseCandidateAuthorityFieldPlanV4(
        JSON.parse(fieldPlanV4Text) as unknown,
        readiness,
        registryV2,
      );
      const fieldPlanV5Runtime = materializeCandidateAuthorityFieldPlanV5({
        predecessor: fieldPlanV4,
        successorAuthority: JSON.parse(fieldPlanV5) as unknown,
      });
      const fieldPlanV6Runtime = materializeCandidateAuthorityFieldPlanV6({
        predecessor: fieldPlanV5Runtime,
        successorAuthority: JSON.parse(fieldPlanV6) as unknown,
        partialSemanticRegistry: registryV3,
      });
      if (
        acceptedHead !== git.head ||
        git.head !== git.originHead ||
        git.branch !== 'feat/32-codebase-conditioned-ranking' ||
        git.parentHead !== CANDIDATE_AUTHORITY_ACCEPTED_CORRECTION_PARENT ||
        git.activationCommitCount !== 1 ||
        !git.clean ||
        catalog.candidates.length !== 150 ||
        catalog.candidates.filter((candidate) => candidate.npmPackage !== null)
          .length !== 80 ||
        fieldPlanV6Runtime.fields.length !== 18 ||
        taxonomy.taxonomyVersion !==
          fixed.authorization.bindings['taxonomyVersion'] ||
        taxonomy.semanticDigest !==
          fixed.authorization.bindings['taxonomyDigest'] ||
        fixed.authorization.bindings['catalogVersion'] !==
          catalog.catalogVersion ||
        fixed.authorization.bindings['catalogDigest'] !== catalog.manifestDigest
      )
        throw ingestionError('ingestion.invalid-input');
      return {
        status: 'passed',
        acceptedHead,
        branch: 'feat/32-codebase-conditioned-ranking',
        head: git.head,
        originHead: git.originHead,
        parentHead: CANDIDATE_AUTHORITY_ACCEPTED_CORRECTION_PARENT,
        activationCommitCount: 1,
        clean: true,
        outputAndStagingPathsAbsent: true,
        catalog,
        sourcePolicy: fixed.sourcePolicy,
        authorization: fixed.authorization,
        effectAudit: CANDIDATE_AUTHORITY_SUCCESSOR_ZERO_EFFECT_AUDIT,
      };
    },
    readCredential: (name) => {
      const value = config.environment[name];
      if (
        value === undefined ||
        value.length < 1 ||
        value.length > 4096 ||
        hasControl(value)
      )
        throw ingestionError('ingestion.invalid-input');
      return value;
    },
    now: config.now,
    collect: async (input) => {
      metrics = emptyMetrics();
      const transport = createTransport({
        fetch: config.fetch,
        sleep: abortableSleep,
        requestTimeoutMilliseconds: 15_000,
        maximumRedirects: 0,
        maximumAttempts: 3,
        observer: (event) => {
          if (event.outcome === 'started') {
            metrics = {
              ...metrics,
              githubAttempts:
                metrics.githubAttempts + (event.provider === 'github' ? 1 : 0),
              npmAttempts:
                metrics.npmAttempts + (event.provider === 'npm' ? 1 : 0),
              perOperationAttempts: {
                ...metrics.perOperationAttempts,
                [event.operation]:
                  (metrics.perOperationAttempts[event.operation] ?? 0) + 1,
              },
            };
          } else if (event.outcome === 'retried') {
            metrics = { ...metrics, retries: metrics.retries + 1 };
          }
        },
      });
      return collectCandidateAuthoritySourceAuthority({
        ...input,
        transport,
        readAttemptMetrics: () => metrics,
        observeLogicalRequest: (provider, operationId) => {
          metrics = {
            ...metrics,
            githubLogicalRequests:
              metrics.githubLogicalRequests + (provider === 'github' ? 1 : 0),
            npmLogicalRequests:
              metrics.npmLogicalRequests + (provider === 'npm' ? 1 : 0),
            perOperationLogicalRequests: {
              ...metrics.perOperationLogicalRequests,
              [operationId]:
                (metrics.perOperationLogicalRequests[operationId] ?? 0) + 1,
            },
          };
        },
      });
    },
    readAttemptMetrics: () => metrics,
    stageExclusive: async (path, text) => {
      if (
        path !== CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_STAGING_PATH ||
        !text.endsWith('\n') ||
        Buffer.byteLength(text, 'utf8') >
          CANDIDATE_AUTHORITY_SUCCESSOR_MAXIMUM_SOURCE_BYTES
      )
        throw ingestionError('ingestion.invalid-input');
      await stageCompleteBytes(
        await fixedPath(config.repositoryRoot, path),
        text,
      );
    },
    publishStagedExclusive: async (stagingPath, finalPath) => {
      if (
        stagingPath !== CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_STAGING_PATH ||
        finalPath !== CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_PATH
      )
        throw ingestionError('ingestion.invalid-input');
      const staging = await fixedPath(config.repositoryRoot, stagingPath);
      const final = await fixedPath(config.repositoryRoot, finalPath);
      if (dirname(staging) !== dirname(final)) invalid();
      await publishHardLinkNoReplace(staging, final);
    },
    removeOwnedStaging: async (path) => {
      if (path !== CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_STAGING_PATH) invalid();
      const target = await fixedPath(config.repositoryRoot, path);
      try {
        await unlink(target);
        await flushDirectory(dirname(target));
      } catch (error) {
        if (!isMissing(error)) throw safeFileError(error);
      }
    },
  };
}

export async function validateCandidateAuthoritySuccessorPublishedSource(input: {
  readonly repositoryRoot: string;
  readonly acceptedHead: string;
}) {
  const [catalogText, sourceText, git] = await Promise.all([
    readFixed(input.repositoryRoot, CATALOG_PATH, 32 * 1024 * 1024),
    readFixed(
      input.repositoryRoot,
      CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_PATH,
      CANDIDATE_AUTHORITY_SUCCESSOR_MAXIMUM_SOURCE_BYTES,
    ),
    readGitState(input.repositoryRoot),
    ...[
      ...HISTORICAL_OUTPUTS,
      ...CANDIDATE_AUTHORITY_SUCCESSOR_OUTPUT_PATHS.filter(
        (path) => path !== CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_PATH,
      ),
      ...CANDIDATE_AUTHORITY_SUCCESSOR_STAGING_PATHS,
    ].map((path) => requireMissing(input.repositoryRoot, path)),
  ]);
  if (
    git.branch !== 'feat/32-codebase-conditioned-ranking' ||
    git.head !== input.acceptedHead ||
    git.originHead !== input.acceptedHead ||
    git.parentHead !== CANDIDATE_AUTHORITY_ACCEPTED_CORRECTION_PARENT ||
    git.activationCommitCount !== 1
  )
    invalid();
  return parseCandidateAuthoritySuccessorSourceAuthority({
    text: sourceText,
    catalog: parsePublicCatalog(catalogText),
    acceptedExecutionHead: input.acceptedHead,
  });
}

function emptyMetrics() {
  return {
    githubAttempts: 0,
    npmAttempts: 0,
    retries: 0,
    perOperationAttempts: {} as Readonly<Record<string, number>>,
    githubLogicalRequests: 0,
    npmLogicalRequests: 0,
    perOperationLogicalRequests: {} as Readonly<Record<string, number>>,
  };
}

async function readGitState(repositoryRoot: string) {
  const options = {
    cwd: repositoryRoot,
    encoding: 'utf8' as const,
    maxBuffer: 1024 * 1024,
  };
  const [branch, head, originHead, parent, count, status] = await Promise.all([
    execFileAsync('git', ['branch', '--show-current'], options),
    execFileAsync('git', ['rev-parse', 'HEAD'], options),
    execFileAsync(
      'git',
      ['rev-parse', 'origin/feat/32-codebase-conditioned-ranking'],
      options,
    ),
    execFileAsync('git', ['rev-parse', 'HEAD^'], options),
    execFileAsync(
      'git',
      [
        'rev-list',
        '--count',
        `${CANDIDATE_AUTHORITY_ACCEPTED_CORRECTION_PARENT}..HEAD`,
      ],
      options,
    ),
    execFileAsync(
      'git',
      ['status', '--porcelain=v1', '--untracked-files=all'],
      options,
    ),
  ]);
  return {
    branch: branch.stdout.trim(),
    head: head.stdout.trim(),
    originHead: originHead.stdout.trim(),
    parentHead: parent.stdout.trim(),
    activationCommitCount: Number(count.stdout.trim()),
    clean: status.stdout.length === 0,
  };
}

async function requireMissing(
  root: string,
  relativePath: string,
): Promise<void> {
  const path = await fixedPath(root, relativePath);
  try {
    await lstat(path);
  } catch (error) {
    if (isMissing(error)) return;
    throw safeFileError(error);
  }
  invalid();
}

async function readFixed(root: string, path: string, maximumBytes: number) {
  const target = await fixedPath(root, path);
  let handle: FileHandle | undefined;
  try {
    handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maximumBytes) invalid();
    const bytes = await handle.readFile();
    if (bytes.byteLength > maximumBytes) invalid();
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    throw safeFileError(error);
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function stageCompleteBytes(path: string, text: string): Promise<void> {
  let handle: FileHandle | undefined;
  let owns = false;
  try {
    handle = await open(
      path,
      constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW |
        constants.O_WRONLY,
      0o600,
    );
    owns = true;
    await handle.writeFile(text, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await flushDirectory(dirname(path));
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (owns) await unlink(path).catch(() => undefined);
    throw safeFileError(error);
  }
}

async function publishHardLinkNoReplace(
  staging: string,
  final: string,
): Promise<void> {
  let linked = false;
  try {
    await link(staging, final);
    linked = true;
    await unlink(staging);
    await flushDirectory(dirname(final));
  } catch (error) {
    if (linked) await unlink(final).catch(() => undefined);
    throw safeFileError(error);
  }
}

async function fixedPath(
  rootInput: string,
  relativePath: string,
): Promise<string> {
  if (
    relativePath.startsWith('/') ||
    relativePath.includes('\\') ||
    relativePath
      .split('/')
      .some((part) => part === '' || part === '.' || part === '..')
  )
    invalid();
  const root = await realpath(rootInput);
  const target = resolve(root, relativePath);
  if (!target.startsWith(`${root}${sep}`)) invalid();
  let current = dirname(target);
  while (current !== root) {
    const stat = await lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) invalid();
    current = dirname(current);
  }
  return target;
}

async function flushDirectory(path: string): Promise<void> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function safeFileError(error: unknown): IngestionError {
  return error instanceof IngestionError
    ? error
    : ingestionError('ingestion.internal-invariant');
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { readonly code?: unknown }).code === 'ENOENT'
  );
}

function hasControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function invalid(): never {
  throw ingestionError('ingestion.invalid-input');
}
