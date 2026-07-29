import { TextDecoder } from 'node:util';

import { IngestionError, ingestionError } from './errors.ts';
import {
  isRecord,
  optionalString,
  parseBoundedJson,
  requireRecord,
  requireString,
  requireTimestamp,
} from './json-boundary.ts';
import type { JsonResponse, TransportRequest } from './transport.ts';
import type {
  AdvisoryCollection,
  AdvisorySource,
  CandidateCollectionResult,
  CatalogCandidate,
  GitHubCommitSource,
  GitHubCommunitySource,
  GitHubLicenseSource,
  GitHubReleaseSource,
  GitHubRepositorySource,
  GitHubTagSource,
  NpmPackageSource,
  RepositoryFileSource,
  TransportMetrics,
} from './types.ts';

const GITHUB_BODY_BYTES = 2 * 1_024 * 1_024;
const NPM_BODY_BYTES = 16 * 1_024 * 1_024;
const NPM_JSON_NODES = 400_000;
const FILE_RESPONSE_BYTES = 256 * 1_024;
const FILE_DECODED_BYTES = 64 * 1_024;
const TOTAL_FILE_DECODED_BYTES = 128 * 1_024;

export interface ProviderTransport {
  requestJson(request: TransportRequest): Promise<JsonResponse>;
  getMetrics?(): TransportMetrics;
}

export interface PublicProviderConfig {
  readonly transport: ProviderTransport;
  readonly githubToken: string;
  readonly correlationId: string;
  readonly signal?: AbortSignal;
  readonly deadlineSignal?: AbortSignal;
}

export function providerRequestBudget(candidate: CatalogCandidate): {
  readonly github: number;
  readonly npm: number;
  readonly total: number;
} {
  const expected = new Set(candidate.expectedSourceTypes);
  const github =
    2 +
    Number(expected.has('github-release')) +
    Number(expected.has('github-tag')) +
    Number(expected.has('github-license')) +
    Number(expected.has('github-community')) +
    (expected.has('github-file') ? candidate.allowlistedFiles.length : 0) +
    (expected.has('github-advisory') ? 2 : 0);
  const npm = Number(expected.has('npm-package'));
  return { github, npm, total: github + npm };
}

export async function collectCandidateSources(
  candidate: CatalogCandidate,
  collectedAt: string,
  config: PublicProviderConfig,
): Promise<CandidateCollectionResult> {
  try {
    return await collectCandidateSourcesUnsafe(candidate, collectedAt, config);
  } catch (error) {
    if (error instanceof IngestionError) {
      throw error;
    }
    throw ingestionError('ingestion.internal-invariant');
  }
}

async function collectCandidateSourcesUnsafe(
  candidate: CatalogCandidate,
  collectedAt: string,
  config: PublicProviderConfig,
): Promise<CandidateCollectionResult> {
  const repository = await getRepository(candidate, config);
  assertRepositoryIdentity(candidate, repository);
  if (!repository.isPublic) {
    throw ingestionError('ingestion.provider-identity');
  }
  const commit = await getCommit(candidate, repository.defaultBranch, config);
  const expected = new Set(candidate.expectedSourceTypes);

  let releases: readonly GitHubReleaseSource[] = [];
  if (expected.has('github-release')) {
    const outcome = await collectApprovedOptionalSource(
      () => getReleases(candidate, config),
      [],
      true,
    );
    if (outcome.outcome === 'retry-exhausted-temporary-unavailability') {
      return partialCollection('github-releases-unavailable');
    }
    releases = outcome.value;
  }

  let tags: readonly GitHubTagSource[] = [];
  if (expected.has('github-tag')) {
    const outcome = await collectApprovedOptionalSource(
      () => getTags(candidate, config),
      [],
      true,
    );
    if (outcome.outcome === 'retry-exhausted-temporary-unavailability') {
      return partialCollection('github-tags-unavailable');
    }
    tags = outcome.value;
  }

  let license: GitHubLicenseSource | null = null;
  if (expected.has('github-license')) {
    const outcome = await collectApprovedOptionalSource(
      () => getLicense(candidate, repository, commit.sha, config),
      null,
      true,
    );
    if (outcome.outcome === 'retry-exhausted-temporary-unavailability') {
      return partialCollection('github-license-unavailable');
    }
    license = outcome.value;
  }

  let community: GitHubCommunitySource | null = null;
  if (expected.has('github-community')) {
    const outcome = await collectApprovedOptionalSource(
      () => getCommunity(candidate, config),
      null,
      true,
    );
    if (outcome.outcome === 'retry-exhausted-temporary-unavailability') {
      return partialCollection('github-community-unavailable');
    }
    community = outcome.value;
  }

  const files: RepositoryFileSource[] = [];
  let totalFileBytes = 0;
  if (expected.has('github-file')) {
    for (const path of candidate.allowlistedFiles) {
      const outcome = await collectApprovedOptionalSource(
        () => getRepositoryFile(candidate, path, commit.sha, config),
        null,
        true,
      );
      if (outcome.outcome === 'retry-exhausted-temporary-unavailability') {
        return partialCollection(`github-file-unavailable-${safeCode(path)}`);
      }
      const file = outcome.value;
      if (file !== null) {
        totalFileBytes += Buffer.byteLength(file.text, 'utf8');
        if (totalFileBytes > TOTAL_FILE_DECODED_BYTES) {
          throw ingestionError('ingestion.body-too-large');
        }
        files.push(file);
      }
    }
  }

  let npm: NpmPackageSource | null = null;
  if (expected.has('npm-package')) {
    const outcome = await collectApprovedOptionalSource(
      () => getNpmPackage(candidate, config),
      null,
      false,
    );
    if (outcome.outcome === 'retry-exhausted-temporary-unavailability') {
      return partialCollection('npm-package-unavailable');
    }
    npm = outcome.value;
    if (npm === null) {
      throw ingestionError('ingestion.provider-identity');
    }
  }

  let advisories: AdvisoryCollection = {
    advisories: [],
    complete: false,
    limitationCode: 'advisory-not-requested',
  };
  if (expected.has('github-advisory')) {
    if (npm === null) {
      throw ingestionError('ingestion.internal-invariant');
    }
    const outcome = await collectApprovedOptionalSource(
      () => getAdvisories(candidate, npm, config),
      {
        advisories: [],
        complete: false,
        limitationCode: 'advisory-provider-absence',
      },
      false,
    );
    if (outcome.outcome === 'retry-exhausted-temporary-unavailability') {
      return partialCollection('github-advisories-unavailable');
    }
    advisories = outcome.value;
  }

  return {
    outcome: 'complete',
    bundle: {
      candidate,
      collectedAt,
      repository,
      commit,
      releases,
      tags,
      license,
      community,
      files,
      npm,
      advisories,
    },
  };
}

function partialCollection(sourceCode: string): CandidateCollectionResult {
  return {
    outcome: 'partial',
    incompleteSourceCodes: [sourceCode],
  };
}

type OptionalSourceOutcome<T> =
  | {
      readonly outcome: 'established-value' | 'established-absence';
      readonly value: T;
    }
  | {
      readonly outcome: 'retry-exhausted-temporary-unavailability';
    };

async function collectApprovedOptionalSource<T>(
  collect: () => Promise<T>,
  absenceValue: T,
  absenceApproved: boolean,
): Promise<OptionalSourceOutcome<T>> {
  try {
    return { outcome: 'established-value', value: await collect() };
  } catch (error) {
    if (!(error instanceof IngestionError)) {
      throw ingestionError('ingestion.internal-invariant');
    }
    if (error.code === 'ingestion.provider-not-found' && absenceApproved) {
      return { outcome: 'established-absence', value: absenceValue };
    }
    if (error.code === 'ingestion.provider-unavailable') {
      return { outcome: 'retry-exhausted-temporary-unavailability' };
    }
    throw error;
  }
}

async function getRepository(
  candidate: CatalogCandidate,
  config: PublicProviderConfig,
): Promise<GitHubRepositorySource> {
  const response = await githubRequest(
    candidate,
    config,
    'repository',
    `/repos/${encodeURIComponent(candidate.github.owner)}/${encodeURIComponent(
      candidate.github.repository,
    )}`,
  );
  const value = requireRecord(response.value);
  const owner = requireRecord(value['owner']);
  return {
    canonicalOwner: requireString(owner['login'], 100),
    canonicalRepository: requireString(value['name'], 100),
    htmlUrl: requireHttpsUrl(value['html_url'], 'github.com'),
    description: optionalString(value['description'], 500),
    homepage: optionalHttpsUrl(value['homepage']),
    topics: requireStringArray(value['topics'], 20, 100),
    defaultBranch: requireString(value['default_branch'], 255),
    isPublic: value['private'] === false,
    isFork: requireBoolean(value['fork']),
    isArchived: requireBoolean(value['archived']),
    pushedAt: requireTimestamp(value['pushed_at']),
    updatedAt: requireTimestamp(value['updated_at']),
    licenseSpdxId: parseRepositoryLicense(value['license']),
  };
}

async function getCommit(
  candidate: CatalogCandidate,
  revision: string,
  config: PublicProviderConfig,
): Promise<GitHubCommitSource> {
  const response = await githubRequest(
    candidate,
    config,
    'head-commit',
    `/repos/${encodeURIComponent(candidate.github.owner)}/${encodeURIComponent(
      candidate.github.repository,
    )}/commits/${encodeURIComponent(revision)}`,
  );
  const value = requireRecord(response.value);
  const commit = requireRecord(value['commit']);
  const committer = requireRecord(commit['committer']);
  const sha = requireString(value['sha'], 40);
  if (!/^[a-f0-9]{40}$/u.test(sha)) {
    throw ingestionError('ingestion.provider-response');
  }
  return {
    sha,
    htmlUrl: requireHttpsUrl(value['html_url'], 'github.com'),
    committedAt: requireTimestamp(committer['date']),
  };
}

async function getReleases(
  candidate: CatalogCandidate,
  config: PublicProviderConfig,
): Promise<readonly GitHubReleaseSource[]> {
  const response = await githubRequest(
    candidate,
    config,
    'releases',
    `/repos/${encodeURIComponent(candidate.github.owner)}/${encodeURIComponent(
      candidate.github.repository,
    )}/releases?per_page=5&page=1`,
  );
  if (!Array.isArray(response.value) || response.value.length > 5) {
    throw ingestionError('ingestion.provider-response');
  }
  return response.value.map((entry) => {
    const value = requireRecord(entry);
    return {
      tag: requireString(value['tag_name'], 255),
      htmlUrl: requireHttpsUrl(value['html_url'], 'github.com'),
      publishedAt: requireTimestamp(value['published_at']),
      isDraft: requireBoolean(value['draft']),
      isPrerelease: requireBoolean(value['prerelease']),
    };
  });
}

async function getTags(
  candidate: CatalogCandidate,
  config: PublicProviderConfig,
): Promise<readonly GitHubTagSource[]> {
  const response = await githubRequest(
    candidate,
    config,
    'tags',
    `/repos/${encodeURIComponent(candidate.github.owner)}/${encodeURIComponent(
      candidate.github.repository,
    )}/tags?per_page=5&page=1`,
  );
  if (!Array.isArray(response.value) || response.value.length > 5) {
    throw ingestionError('ingestion.provider-response');
  }
  return response.value.map((entry) => {
    const value = requireRecord(entry);
    const commit = requireRecord(value['commit']);
    const commitSha = requireString(commit['sha'], 40);
    if (!/^[a-f0-9]{40}$/u.test(commitSha)) {
      throw ingestionError('ingestion.provider-response');
    }
    return {
      name: requireString(value['name'], 255),
      commitSha,
    };
  });
}

async function getLicense(
  candidate: CatalogCandidate,
  repository: GitHubRepositorySource,
  commitSha: string,
  config: PublicProviderConfig,
): Promise<GitHubLicenseSource> {
  const response = await githubRequest(
    candidate,
    config,
    'license',
    `/repos/${encodeURIComponent(candidate.github.owner)}/${encodeURIComponent(
      candidate.github.repository,
    )}/license?ref=${encodeURIComponent(commitSha)}`,
  );
  const value = requireRecord(response.value);
  const license = requireRecord(value['license']);
  const path = requireRepositoryPath(value['path']);
  if (
    value['name'] !== undefined &&
    requireString(value['name'], 255) !== path.split('/').at(-1)
  ) {
    throw ingestionError('ingestion.provider-response');
  }
  const sha =
    value['sha'] === undefined || value['sha'] === null
      ? null
      : requireGitObjectSha(value['sha']);
  const immutableUrl = immutableRepositoryUrl(
    repository.canonicalOwner,
    repository.canonicalRepository,
    commitSha,
    path,
  );
  if (value['html_url'] !== undefined && value['html_url'] !== null) {
    requireHttpsUrl(value['html_url'], 'github.com');
  }
  return {
    spdxId: normalizeSpdx(license['spdx_id']),
    path,
    sha,
    sourceUrl: immutableUrl,
    immutableUrl,
  };
}

async function getCommunity(
  candidate: CatalogCandidate,
  config: PublicProviderConfig,
): Promise<GitHubCommunitySource> {
  const response = await githubRequest(
    candidate,
    config,
    'community',
    `/repos/${encodeURIComponent(candidate.github.owner)}/${encodeURIComponent(
      candidate.github.repository,
    )}/community/profile`,
  );
  const value = requireRecord(response.value);
  const files = requireRecord(value['files']);
  const health = value['health_percentage'];
  if (!Number.isInteger(health) || Number(health) < 0 || Number(health) > 100) {
    throw ingestionError('ingestion.provider-response');
  }
  return {
    healthPercentage: Number(health),
    hasSecurityPolicy: files['security'] !== null,
  };
}

async function getRepositoryFile(
  candidate: CatalogCandidate,
  path: string,
  commitSha: string,
  config: PublicProviderConfig,
): Promise<RepositoryFileSource> {
  const response = await githubRequest(
    candidate,
    config,
    `file-${safeCode(path)}`,
    `/repos/${encodeURIComponent(candidate.github.owner)}/${encodeURIComponent(
      candidate.github.repository,
    )}/contents/${path
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/')}?ref=${encodeURIComponent(commitSha)}`,
    FILE_RESPONSE_BYTES,
  );
  const value = requireRecord(response.value);
  if (value['type'] !== 'file' || value['encoding'] !== 'base64') {
    throw ingestionError('ingestion.provider-response');
  }
  const content = requireBase64Content(value['content']);
  const normalizedContent = content.replaceAll(/[\r\n]/gu, '');
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(
      normalizedContent,
    )
  ) {
    throw ingestionError('ingestion.provider-response');
  }
  let decoded: Uint8Array;
  try {
    decoded = Buffer.from(normalizedContent, 'base64');
  } catch {
    throw ingestionError('ingestion.provider-response');
  }
  if (decoded.byteLength > FILE_DECODED_BYTES) {
    throw ingestionError('ingestion.body-too-large');
  }
  if (
    !Number.isInteger(value['size']) ||
    Number(value['size']) !== decoded.byteLength
  ) {
    throw ingestionError('ingestion.provider-response');
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(decoded);
  } catch {
    throw ingestionError('ingestion.provider-response');
  }
  if (text.includes('\u0000')) {
    throw ingestionError('ingestion.provider-response');
  }
  if (path.endsWith('package.json')) {
    parseBoundedJson(
      text,
      {
        maximumBytes: FILE_DECODED_BYTES,
        maximumDepth: 32,
        maximumNodes: 10_000,
      },
      'ingestion.provider-response',
    );
  }
  const sha = requireString(value['sha'], 40);
  if (!/^[a-f0-9]{40}$/u.test(sha)) {
    throw ingestionError('ingestion.provider-response');
  }
  return {
    path,
    sha,
    htmlUrl: requireHttpsUrl(value['html_url'], 'github.com'),
    text,
  };
}

async function getNpmPackage(
  candidate: CatalogCandidate,
  config: PublicProviderConfig,
): Promise<NpmPackageSource> {
  const packageName = candidate.npmPackage;
  if (packageName === null) {
    throw ingestionError('ingestion.invalid-input');
  }
  const response = await config.transport.requestJson({
    url: new URL(
      `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
    ),
    provider: 'npm',
    operation: 'package-metadata',
    maximumBytes: NPM_BODY_BYTES,
    maximumNodes: NPM_JSON_NODES,
    correlationId: config.correlationId,
    candidateId: candidate.candidateId,
    ...(config.signal === undefined ? {} : { signal: config.signal }),
    ...(config.deadlineSignal === undefined
      ? {}
      : { deadlineSignal: config.deadlineSignal }),
  });
  const value = requireRecord(response.value);
  const name = requireString(value['name'], 201);
  if (name.toLowerCase() !== packageName.toLowerCase()) {
    throw ingestionError('ingestion.provider-identity');
  }
  const distTagsRecord = requireRecord(value['dist-tags']);
  const latestVersion = requireString(distTagsRecord['latest'], 100);
  const distTags: Record<string, string> = {};
  const selectedDistTags = [
    'latest',
    ...Object.keys(distTagsRecord)
      .filter((key) => key !== 'latest')
      .sort()
      .slice(0, 19),
  ];
  for (const key of selectedDistTags) {
    distTags[key] = requireString(distTagsRecord[key], 100);
  }
  const versions = requireRecord(value['versions']);
  const selectedVersion = requireRecord(versions[latestVersion]);
  const times = requireRecord(value['time']);
  const repositoryUrl = parseNpmRepository(selectedVersion['repository']);
  const engines = isRecord(selectedVersion['engines'])
    ? optionalString(selectedVersion['engines']['node'], 100)
    : null;
  return {
    name,
    latestVersion,
    publishedAt: requireTimestamp(times[latestVersion]),
    registryUrl: `https://www.npmjs.com/package/${encodeURIComponent(name)}/v/${encodeURIComponent(latestVersion)}`,
    repositoryUrl,
    license: parseNpmLicense(selectedVersion['license']),
    nodeEngine: engines,
    moduleType: optionalString(selectedVersion['type'], 40),
    exportShape:
      selectedVersion['exports'] === undefined ? 'not-declared' : 'declared',
    deprecated: selectedVersion['deprecated'] !== undefined,
    distTags,
  };
}

async function getAdvisories(
  candidate: CatalogCandidate,
  npm: NpmPackageSource,
  config: PublicProviderConfig,
): Promise<AdvisoryCollection> {
  const advisories: AdvisorySource[] = [];
  let url = new URL('https://api.github.com/advisories');
  url.searchParams.set('type', 'reviewed');
  url.searchParams.set('ecosystem', 'npm');
  url.searchParams.set('affects', `${npm.name}@${npm.latestVersion}`);
  url.searchParams.set('sort', 'updated');
  url.searchParams.set('direction', 'asc');
  url.searchParams.set('per_page', '100');
  for (let page = 1; page <= 2; page += 1) {
    const response = await config.transport.requestJson({
      url,
      provider: 'github',
      operation: 'advisories',
      maximumBytes: GITHUB_BODY_BYTES,
      authorizationToken: config.githubToken,
      correlationId: config.correlationId,
      candidateId: candidate.candidateId,
      ...(config.signal === undefined ? {} : { signal: config.signal }),
      ...(config.deadlineSignal === undefined
        ? {}
        : { deadlineSignal: config.deadlineSignal }),
    });
    if (!Array.isArray(response.value) || response.value.length > 100) {
      throw ingestionError('ingestion.provider-response');
    }
    advisories.push(...response.value.map(parseAdvisory));
    const next = nextLink(response.headers.get('link'));
    if (next === null) {
      return { advisories, complete: true, limitationCode: null };
    }
    if (page === 2) {
      return {
        advisories,
        complete: false,
        limitationCode: 'advisory-pagination-bound',
      };
    }
    url = next;
  }
  throw ingestionError('ingestion.provider-response');
}

function parseAdvisory(value: unknown): AdvisorySource {
  const advisory = requireRecord(value);
  const advisoryId = requireString(advisory['ghsa_id'], 64);
  if (
    !/^GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}$/iu.test(
      advisoryId,
    )
  ) {
    throw ingestionError('ingestion.provider-response');
  }
  return {
    advisoryId: advisoryId.toLowerCase(),
    htmlUrl: requireHttpsUrl(advisory['html_url'], 'github.com'),
    publishedAt: requireTimestamp(advisory['published_at']),
    updatedAt: requireTimestamp(advisory['updated_at']),
    withdrawnAt:
      advisory['withdrawn_at'] === null
        ? null
        : requireTimestamp(advisory['withdrawn_at']),
    severity: requireString(advisory['severity'], 32),
  };
}

async function githubRequest(
  candidate: CatalogCandidate,
  config: PublicProviderConfig,
  operation: string,
  path: string,
  maximumBytes = GITHUB_BODY_BYTES,
): Promise<JsonResponse> {
  return config.transport.requestJson({
    url: new URL(path, 'https://api.github.com'),
    provider: 'github',
    operation,
    maximumBytes,
    authorizationToken: config.githubToken,
    correlationId: config.correlationId,
    candidateId: candidate.candidateId,
    ...(config.signal === undefined ? {} : { signal: config.signal }),
    ...(config.deadlineSignal === undefined
      ? {}
      : { deadlineSignal: config.deadlineSignal }),
  });
}

function assertRepositoryIdentity(
  candidate: CatalogCandidate,
  repository: GitHubRepositorySource,
): void {
  const identityChanged =
    repository.canonicalOwner.toLowerCase() !==
      candidate.github.owner.toLowerCase() ||
    repository.canonicalRepository.toLowerCase() !==
      candidate.github.repository.toLowerCase();
  if (identityChanged && candidate.status !== 'moved') {
    throw ingestionError('ingestion.provider-identity');
  }
}

function parseRepositoryLicense(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  return normalizeSpdx(requireRecord(value)['spdx_id']);
}

function normalizeSpdx(value: unknown): string | null {
  const identifier = optionalString(value, 100);
  return identifier === null || identifier === 'NOASSERTION'
    ? null
    : identifier;
}

function parseNpmRepository(value: unknown): string | null {
  const raw =
    typeof value === 'string'
      ? value
      : isRecord(value)
        ? optionalString(value['url'])
        : null;
  if (raw === null) {
    return null;
  }
  const normalized = raw
    .replace(/^git\+/u, '')
    .replace(/^git:\/\/github\.com\//u, 'https://github.com/')
    .replace(/^git@github\.com:/u, 'https://github.com/')
    .replace(/\.git$/u, '');
  try {
    const url = new URL(normalized);
    return url.protocol === 'https:' && url.hostname === 'github.com'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function parseNpmLicense(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.slice(0, 100);
  }
  if (isRecord(value) && typeof value['type'] === 'string') {
    return value['type'].slice(0, 100);
  }
  return null;
}

function requireBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw ingestionError('ingestion.provider-response');
  }
  return value;
}

function requireBase64Content(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > FILE_RESPONSE_BYTES
  ) {
    throw ingestionError('ingestion.provider-response');
  }
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if ((code <= 31 || code === 127) && code !== 10 && code !== 13) {
      throw ingestionError('ingestion.provider-response');
    }
  }
  return value;
}

function requireStringArray(
  value: unknown,
  maximumItems: number,
  maximumLength: number,
): readonly string[] {
  if (!Array.isArray(value) || value.length > maximumItems) {
    throw ingestionError('ingestion.provider-response');
  }
  return value.map((entry) => requireString(entry, maximumLength)).sort();
}

function requireHttpsUrl(value: unknown, hostname?: string): string {
  const text = requireString(value);
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw ingestionError('ingestion.provider-response');
  }
  if (
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    (hostname !== undefined && url.hostname !== hostname)
  ) {
    throw ingestionError('ingestion.provider-response');
  }
  return url.toString();
}

function optionalHttpsUrl(value: unknown): string | null {
  if (value === null || value === '') {
    return null;
  }
  const text = requireString(value);
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw ingestionError('ingestion.provider-response');
  }
  return url.protocol === 'https:' && url.username === '' && url.password === ''
    ? url.toString()
    : null;
}

function nextLink(header: string | null): URL | null {
  if (header === null || header.length > 4_096) {
    return null;
  }
  for (const part of header.split(',')) {
    const match = /^\s*<([^>]+)>;\s*rel="([^"]+)"\s*$/u.exec(part);
    if (match?.[2] === 'next' && match[1] !== undefined) {
      try {
        return new URL(match[1]);
      } catch {
        throw ingestionError('ingestion.provider-response');
      }
    }
  }
  return null;
}

function safeCode(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .slice(0, 48);
}

function requireGitObjectSha(value: unknown): string {
  const sha = requireString(value, 40);
  if (!/^[a-f0-9]{40}$/u.test(sha)) {
    throw ingestionError('ingestion.provider-response');
  }
  return sha;
}

function requireRepositoryPath(value: unknown): string {
  const path = requireString(value, 255);
  if (
    path.startsWith('/') ||
    path.endsWith('/') ||
    path.includes('\\') ||
    path
      .split('/')
      .some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw ingestionError('ingestion.provider-response');
  }
  return path;
}

function immutableRepositoryUrl(
  owner: string,
  repository: string,
  commitSha: string,
  path: string,
): string {
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(
    repository,
  )}/blob/${commitSha}/${path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;
}
