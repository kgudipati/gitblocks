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
import { operationPolicy } from './profile-materialization-policy.ts';
import type {
  ProfileMaterializationOperation,
  ProfileMaterializationProviderPolicy,
} from './profile-materialization-contracts.ts';
import type { ProfileMaterializationSourceRecordInput } from './profile-materialization-source-authority.ts';
import type { JsonResponse, TransportRequest } from './transport.ts';
import type {
  AdvisoryCollection,
  AdvisorySource,
  CandidateSourceBundle,
  CatalogCandidate,
  GitHubCommitSource,
  GitHubCommunitySource,
  GitHubLicenseSource,
  GitHubReleaseSource,
  GitHubRepositorySource,
  GitHubTagSource,
  NpmPackageSource,
  RepositoryFileSource,
} from './types.ts';
import type { ProviderTransport } from './providers.ts';

export interface ProfileMaterializationRepositorySource extends GitHubRepositorySource {
  readonly primaryLanguage: string | null;
  readonly upstreamRepository: string | null;
}

export interface ProfileMaterializationCollectionResult {
  readonly sourceRecords: readonly ProfileMaterializationSourceRecordInput[];
  readonly legacyBundle: CandidateSourceBundle | null;
  readonly qualifiedFailureCodes: readonly string[];
}

export interface ProfileMaterializationProviderConfig {
  readonly transport: ProviderTransport;
  readonly policy: ProfileMaterializationProviderPolicy;
  readonly githubToken: string;
  readonly correlationId: string;
  readonly signal?: AbortSignal;
  readonly deadlineSignal?: AbortSignal;
}

interface Collected<T> {
  readonly outcome: 'established-value' | 'established-absence' | 'unavailable';
  readonly value: T | null;
  readonly controlledCode: string | null;
}

export async function collectProfileMaterializationSources(
  candidate: CatalogCandidate,
  collectedAt: string,
  config: ProfileMaterializationProviderConfig,
): Promise<ProfileMaterializationCollectionResult> {
  const sourceRecords: ProfileMaterializationSourceRecordInput[] = [];
  const qualifiedFailures: string[] = [];
  const repository = parseProfileMaterializationRepositoryResponse(
    (
      await request(
        candidate,
        config,
        'github-repository-metadata',
        `/repos/${encodeURIComponent(candidate.github.owner)}/${encodeURIComponent(candidate.github.repository)}`,
      )
    ).value,
  );
  assertRepositoryIdentity(candidate, repository);
  if (!repository.isPublic) throw ingestionError('ingestion.provider-identity');
  sourceRecords.push(
    record(candidate, collectedAt, config, 'github-repository-metadata', {
      canonicalOwner: repository.canonicalOwner,
      canonicalRepository: repository.canonicalRepository,
      topics: repository.topics,
      defaultBranch: repository.defaultBranch,
      isPublic: repository.isPublic,
      isFork: repository.isFork,
      isArchived: repository.isArchived,
      pushedAt: repository.pushedAt,
      updatedAt: repository.updatedAt,
      licenseSpdxId: repository.licenseSpdxId,
      primaryLanguage: repository.primaryLanguage,
      upstreamRepository: repository.upstreamRepository,
    }),
  );

  const commit = parseProfileMaterializationCommitResponse(
    (
      await request(
        candidate,
        config,
        'github-default-branch-head',
        `/repos/${encodeURIComponent(candidate.github.owner)}/${encodeURIComponent(candidate.github.repository)}/commits/${encodeURIComponent(repository.defaultBranch)}`,
      )
    ).value,
  );
  sourceRecords.push(
    record(
      candidate,
      collectedAt,
      config,
      'github-default-branch-head',
      { sha: commit.sha, committedAt: commit.committedAt },
      'singleton',
      commit.sha,
    ),
  );

  const expected = new Set(candidate.expectedSourceTypes);
  const releases = expected.has('github-release')
    ? await optional(
        candidate,
        config,
        'github-release',
        () =>
          request(
            candidate,
            config,
            'github-release',
            `/repos/${encodeURIComponent(candidate.github.owner)}/${encodeURIComponent(candidate.github.repository)}/releases?per_page=5&page=1`,
          ).then((response) =>
            parseProfileMaterializationReleaseResponse(response.value),
          ),
        [],
      )
    : null;
  if (releases !== null) {
    sourceRecords.push(
      outcomeRecord(
        candidate,
        collectedAt,
        config,
        'github-release',
        releases,
        {
          releases: releases.value,
        },
      ),
    );
    recordQualified(releases, qualifiedFailures);
  }

  const tags = expected.has('github-tag')
    ? await optional(
        candidate,
        config,
        'github-tag',
        () =>
          request(
            candidate,
            config,
            'github-tag',
            `/repos/${encodeURIComponent(candidate.github.owner)}/${encodeURIComponent(candidate.github.repository)}/tags?per_page=5&page=1`,
          ).then((response) =>
            parseProfileMaterializationTagResponse(response.value),
          ),
        [],
      )
    : null;
  if (tags !== null) {
    sourceRecords.push(
      outcomeRecord(candidate, collectedAt, config, 'github-tag', tags, {
        tags: tags.value,
      }),
    );
    recordQualified(tags, qualifiedFailures);
  }

  const license = expected.has('github-license')
    ? await optional(
        candidate,
        config,
        'github-license',
        () =>
          request(
            candidate,
            config,
            'github-license',
            `/repos/${encodeURIComponent(candidate.github.owner)}/${encodeURIComponent(candidate.github.repository)}/license?ref=${encodeURIComponent(commit.sha)}`,
          ).then((response) =>
            parseProfileMaterializationLicenseResponse(
              response.value,
              repository,
              commit.sha,
            ),
          ),
        null,
      )
    : null;
  if (license !== null) {
    sourceRecords.push(
      outcomeRecord(
        candidate,
        collectedAt,
        config,
        'github-license',
        license,
        license.value === null
          ? null
          : {
              spdxId: license.value.spdxId,
              path: license.value.path,
              sha: license.value.sha,
            },
        'singleton',
        commit.sha,
      ),
    );
    recordQualified(license, qualifiedFailures);
  }

  const community = expected.has('github-community')
    ? await optional(
        candidate,
        config,
        'github-community-profile',
        () =>
          request(
            candidate,
            config,
            'github-community-profile',
            `/repos/${encodeURIComponent(candidate.github.owner)}/${encodeURIComponent(candidate.github.repository)}/community/profile`,
          ).then((response) =>
            parseProfileMaterializationCommunityResponse(response.value),
          ),
        null,
      )
    : null;
  if (community !== null) {
    sourceRecords.push(
      outcomeRecord(
        candidate,
        collectedAt,
        config,
        'github-community-profile',
        community,
        community.value === null
          ? null
          : {
              healthPercentage: community.value.healthPercentage,
              securityPolicyPresent: community.value.hasSecurityPolicy,
            },
      ),
    );
    recordQualified(community, qualifiedFailures);
  }

  const files: RepositoryFileSource[] = [];
  let fileUnavailable = false;
  if (expected.has('github-file')) {
    for (const path of candidate.allowlistedFiles) {
      const collected = await optional(
        candidate,
        config,
        'github-allowlisted-file',
        () =>
          request(
            candidate,
            config,
            'github-allowlisted-file',
            `/repos/${encodeURIComponent(candidate.github.owner)}/${encodeURIComponent(candidate.github.repository)}/contents/${path
              .split('/')
              .map((part) => encodeURIComponent(part))
              .join('/')}?ref=${encodeURIComponent(commit.sha)}`,
          ).then((response) =>
            parseProfileMaterializationFileResponse(response.value, path),
          ),
        null,
      );
      if (collected.value !== null) files.push(collected.value);
      sourceRecords.push(
        outcomeRecord(
          candidate,
          collectedAt,
          config,
          'github-allowlisted-file',
          collected,
          collected.value === null
            ? null
            : { path: collected.value.path, sha: collected.value.sha },
          path,
          `${commit.sha}:${path}`,
        ),
      );
      if (collected.outcome === 'unavailable') fileUnavailable = true;
      recordQualified(collected, qualifiedFailures);
    }
  }

  let npm: NpmPackageSource | null = null;
  if (expected.has('npm-package')) {
    if (candidate.npmPackage === null) {
      throw ingestionError('ingestion.provider-identity');
    }
    npm = parseProfileMaterializationNpmResponse(
      (
        await request(
          candidate,
          config,
          'npm-package',
          `/${encodeURIComponent(candidate.npmPackage)}`,
        )
      ).value,
      candidate.npmPackage,
    );
    sourceRecords.push(
      record(
        candidate,
        collectedAt,
        config,
        'npm-package',
        {
          name: npm.name,
          selectedVersion: npm.latestVersion,
          publishedAt: npm.publishedAt,
          repositoryIdentity: repositoryIdentity(npm.repositoryUrl),
          licenseDeclaration: npm.license,
          nodeEngine: npm.nodeEngine,
          moduleType: npm.moduleType,
          exportsDeclared: npm.exportShape === 'declared',
          deprecated: npm.deprecated,
          distTags: npm.distTags,
        },
        'singleton',
        `${npm.name}@${npm.latestVersion}`,
      ),
    );
  }

  let advisories: AdvisoryCollection = {
    advisories: [],
    complete: false,
    limitationCode: 'advisory-not-requested',
  };
  let advisoryUnavailable = false;
  if (expected.has('github-advisory')) {
    if (npm === null) throw ingestionError('ingestion.internal-invariant');
    const selectedNpm = npm;
    const collected = await optional(
      candidate,
      config,
      'github-advisory',
      () => getAdvisories(candidate, selectedNpm, config),
      null,
    );
    if (collected.value !== null) advisories = collected.value;
    advisoryUnavailable = collected.outcome === 'unavailable';
    sourceRecords.push(
      outcomeRecord(
        candidate,
        collectedAt,
        config,
        'github-advisory',
        collected,
        collected.value === null
          ? null
          : {
              packageName: npm.name,
              packageVersion: npm.latestVersion,
              advisories: collected.value.advisories.map((advisory) => ({
                advisoryId: advisory.advisoryId,
                publishedAt: advisory.publishedAt,
                updatedAt: advisory.updatedAt,
                withdrawnAt: advisory.withdrawnAt,
                severity: advisory.severity,
              })),
              complete: collected.value.complete,
              limitationCode: collected.value.limitationCode,
            },
      ),
    );
    recordQualified(collected, qualifiedFailures);
  }

  const optionalUnavailable =
    releases?.outcome === 'unavailable' ||
    tags?.outcome === 'unavailable' ||
    license?.outcome === 'unavailable' ||
    community?.outcome === 'unavailable' ||
    fileUnavailable ||
    advisoryUnavailable;
  const legacyBundle: CandidateSourceBundle | null = optionalUnavailable
    ? null
    : {
        candidate,
        collectedAt,
        repository,
        commit,
        releases: releases?.value ?? [],
        tags: tags?.value ?? [],
        license: license?.value ?? null,
        community: community?.value ?? null,
        files,
        npm,
        advisories,
      };
  return {
    sourceRecords,
    legacyBundle,
    qualifiedFailureCodes: [...new Set(qualifiedFailures)].sort(),
  };
}

export function parseProfileMaterializationRepositoryResponse(
  input: unknown,
): ProfileMaterializationRepositorySource {
  const value = requireRecord(input);
  const owner = requireRecord(value['owner']);
  const isFork = requireBoolean(value['fork']);
  return {
    canonicalOwner: requireString(owner['login'], 100),
    canonicalRepository: requireString(value['name'], 100),
    htmlUrl: requireHttpsUrl(value['html_url'], 'github.com'),
    description: optionalString(value['description'], 500),
    homepage: optionalHttpsUrl(value['homepage']),
    topics: requireStringArray(value['topics'], 20, 100),
    defaultBranch: requireString(value['default_branch'], 255),
    isPublic: value['private'] === false,
    isFork,
    isArchived: requireBoolean(value['archived']),
    pushedAt: requireTimestamp(value['pushed_at']),
    updatedAt: requireTimestamp(value['updated_at']),
    licenseSpdxId: parseRepositoryLicense(value['license']),
    primaryLanguage:
      value['language'] === null ? null : requireString(value['language'], 100),
    upstreamRepository: isFork ? parseForkParent(value['parent']) : null,
  };
}

export function mapProfilePrimaryLanguage(
  language: string | null,
):
  | 'dotnet'
  | 'go'
  | 'java'
  | 'javascript'
  | 'php'
  | 'python'
  | 'ruby'
  | 'rust'
  | 'typescript'
  | null
  | undefined {
  if (language === null) return null;
  const mapping: Readonly<
    Record<
      string,
      Exclude<ReturnType<typeof mapProfilePrimaryLanguage>, null | undefined>
    >
  > = {
    'C#': 'dotnet',
    'F#': 'dotnet',
    Go: 'go',
    Java: 'java',
    JavaScript: 'javascript',
    PHP: 'php',
    Python: 'python',
    Ruby: 'ruby',
    Rust: 'rust',
    TypeScript: 'typescript',
  };
  return mapping[language];
}

export function parseProfileMaterializationCommunityResponse(
  input: unknown,
): GitHubCommunitySource {
  const value = requireRecord(input);
  const files = requireRecord(value['files']);
  if (!Object.hasOwn(files, 'security')) {
    throw ingestionError('ingestion.provider-response');
  }
  const security = files['security'];
  if (security !== null && !isRecord(security)) {
    throw ingestionError('ingestion.provider-response');
  }
  const health = value['health_percentage'];
  if (!Number.isInteger(health) || Number(health) < 0 || Number(health) > 100) {
    throw ingestionError('ingestion.provider-response');
  }
  return {
    healthPercentage: Number(health),
    hasSecurityPolicy: security !== null,
  };
}

export function projectForkUpstreamState(repository: {
  readonly isFork: boolean;
  readonly upstreamRepository: string | null;
}): {
  readonly fork: boolean;
  readonly upstreamRepository: string | null;
} | null {
  if (!repository.isFork) return { fork: false, upstreamRepository: null };
  return repository.upstreamRepository === null
    ? null
    : { fork: true, upstreamRepository: repository.upstreamRepository };
}

function parseProfileMaterializationCommitResponse(
  input: unknown,
): GitHubCommitSource {
  const value = requireRecord(input);
  const commit = requireRecord(value['commit']);
  const committer = requireRecord(commit['committer']);
  const sha = requireSha(value['sha']);
  return {
    sha,
    htmlUrl: requireHttpsUrl(value['html_url'], 'github.com'),
    committedAt: requireTimestamp(committer['date']),
  };
}

function parseProfileMaterializationReleaseResponse(
  input: unknown,
): readonly GitHubReleaseSource[] {
  if (!Array.isArray(input) || input.length > 5) {
    throw ingestionError('ingestion.provider-response');
  }
  return input.map((entry) => {
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

function parseProfileMaterializationTagResponse(
  input: unknown,
): readonly GitHubTagSource[] {
  if (!Array.isArray(input) || input.length > 5) {
    throw ingestionError('ingestion.provider-response');
  }
  return input.map((entry) => {
    const value = requireRecord(entry);
    const commit = requireRecord(value['commit']);
    return {
      name: requireString(value['name'], 255),
      commitSha: requireSha(commit['sha']),
    };
  });
}

function parseProfileMaterializationLicenseResponse(
  input: unknown,
  repository: ProfileMaterializationRepositorySource,
  commitSha: string,
): GitHubLicenseSource {
  const value = requireRecord(input);
  const license = requireRecord(value['license']);
  const path = requireRepositoryPath(value['path']);
  const sha =
    value['sha'] === null || value['sha'] === undefined
      ? null
      : requireSha(value['sha']);
  const immutableUrl = immutableRepositoryUrl(
    repository.canonicalOwner,
    repository.canonicalRepository,
    commitSha,
    path,
  );
  return {
    spdxId: normalizeSpdx(license['spdx_id']),
    path,
    sha,
    sourceUrl: immutableUrl,
    immutableUrl,
  };
}

function parseProfileMaterializationFileResponse(
  input: unknown,
  expectedPath: string,
): RepositoryFileSource {
  const value = requireRecord(input);
  const path = requireRepositoryPath(value['path']);
  if (
    path !== expectedPath ||
    value['type'] !== 'file' ||
    value['encoding'] !== 'base64'
  ) {
    throw ingestionError('ingestion.provider-response');
  }
  const content = requireString(value['content'], 262_144).replaceAll(
    /[\r\n]/gu,
    '',
  );
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(
      content,
    )
  ) {
    throw ingestionError('ingestion.provider-response');
  }
  const bytes = Buffer.from(content, 'base64');
  if (bytes.byteLength > 65_536 || value['size'] !== bytes.byteLength) {
    throw ingestionError('ingestion.body-too-large');
  }
  let text: string;
  try {
    text = new TextDecoder('utf8', { fatal: true }).decode(bytes);
  } catch {
    throw ingestionError('ingestion.provider-response');
  }
  if (text.includes('\u0000'))
    throw ingestionError('ingestion.provider-response');
  if (path.endsWith('package.json')) {
    parseBoundedJson(
      text,
      { maximumBytes: 65_536, maximumDepth: 32, maximumNodes: 10_000 },
      'ingestion.provider-response',
    );
  }
  return {
    path,
    sha: requireSha(value['sha']),
    htmlUrl: requireHttpsUrl(value['html_url'], 'github.com'),
    text,
  };
}

function parseProfileMaterializationNpmResponse(
  input: unknown,
  expectedPackage: string,
): NpmPackageSource {
  const value = requireRecord(input);
  const name = requireString(value['name'], 201);
  if (name.toLowerCase() !== expectedPackage.toLowerCase()) {
    throw ingestionError('ingestion.provider-identity');
  }
  const tags = requireRecord(value['dist-tags']);
  const latestVersion = requireString(tags['latest'], 100);
  if (!isSemanticVersion(latestVersion)) {
    throw ingestionError('ingestion.provider-response');
  }
  const selectedTags: Record<string, string> = {};
  for (const key of [
    'latest',
    ...Object.keys(tags)
      .filter((key) => key !== 'latest')
      .sort()
      .slice(0, 19),
  ]) {
    selectedTags[key] = requireString(tags[key], 100);
  }
  const versions = requireRecord(value['versions']);
  const selected = requireRecord(versions[latestVersion]);
  const times = requireRecord(value['time']);
  const engines = isRecord(selected['engines'])
    ? optionalString(selected['engines']['node'], 100)
    : null;
  return {
    name,
    latestVersion,
    publishedAt: requireTimestamp(times[latestVersion]),
    registryUrl: `https://www.npmjs.com/package/${encodeURIComponent(name)}/v/${encodeURIComponent(latestVersion)}`,
    repositoryUrl: parseNpmRepository(selected['repository']),
    license: parseNpmLicense(selected['license']),
    nodeEngine: engines,
    moduleType: optionalString(selected['type'], 40),
    exportShape:
      selected['exports'] === undefined ? 'not-declared' : 'declared',
    deprecated: selected['deprecated'] !== undefined,
    distTags: selectedTags,
  };
}

async function getAdvisories(
  candidate: CatalogCandidate,
  npm: NpmPackageSource,
  config: ProfileMaterializationProviderConfig,
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
    const response = await requestUrl(
      candidate,
      config,
      'github-advisory',
      url,
    );
    if (!Array.isArray(response.value) || response.value.length > 100) {
      throw ingestionError('ingestion.provider-response');
    }
    advisories.push(...response.value.map(parseAdvisory));
    const next = nextLink(response.headers.get('link'));
    if (next === null)
      return { advisories, complete: true, limitationCode: null };
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

function parseAdvisory(input: unknown): AdvisorySource {
  const value = requireRecord(input);
  const advisoryId = requireString(value['ghsa_id'], 64);
  if (
    !/^GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}$/iu.test(
      advisoryId,
    )
  ) {
    throw ingestionError('ingestion.provider-response');
  }
  return {
    advisoryId: advisoryId.toLowerCase(),
    htmlUrl: requireHttpsUrl(value['html_url'], 'github.com'),
    publishedAt: requireTimestamp(value['published_at']),
    updatedAt: requireTimestamp(value['updated_at']),
    withdrawnAt:
      value['withdrawn_at'] === null
        ? null
        : requireTimestamp(value['withdrawn_at']),
    severity: requireString(value['severity'], 32),
  };
}

async function optional<T>(
  candidate: CatalogCandidate,
  config: ProfileMaterializationProviderConfig,
  operation: ProfileMaterializationOperation,
  collect: () => Promise<T>,
  absence: T,
): Promise<Collected<T>> {
  try {
    return {
      outcome: 'established-value',
      value: await collect(),
      controlledCode: null,
    };
  } catch (error) {
    if (!(error instanceof IngestionError)) {
      throw ingestionError('ingestion.internal-invariant');
    }
    const policy = operationPolicy(config.policy, operation);
    if (
      error.code === 'ingestion.provider-not-found' &&
      policy.controlledAbsence === 'established-absence'
    ) {
      return {
        outcome: 'established-absence',
        value: absence,
        controlledCode: 'provider-not-found',
      };
    }
    if (
      error.code === 'ingestion.provider-unavailable' &&
      policy.temporaryUnavailability === 'qualified-unknown'
    ) {
      return {
        outcome: 'unavailable',
        value: null,
        controlledCode: 'provider-temporarily-unavailable',
      };
    }
    void candidate;
    throw error;
  }
}

function record(
  candidate: CatalogCandidate,
  collectedAt: string,
  config: ProfileMaterializationProviderConfig,
  operation: ProfileMaterializationOperation,
  normalizedValue: unknown,
  logicalSourceKey = 'singleton',
  immutableReference: string | null = null,
): ProfileMaterializationSourceRecordInput {
  const policy = operationPolicy(config.policy, operation);
  return {
    candidateId: candidate.candidateId,
    sourceType: policy.sourceType,
    operation,
    logicalSourceKey,
    sourceMutability: policy.sourceMutability,
    outcome: 'established-value',
    immutableReference,
    collectedAt,
    normalizedValue,
    controlledCode: null,
    evidenceIds: [],
  };
}

function outcomeRecord<T>(
  candidate: CatalogCandidate,
  collectedAt: string,
  config: ProfileMaterializationProviderConfig,
  operation: ProfileMaterializationOperation,
  collected: Collected<T>,
  normalizedValue: unknown,
  logicalSourceKey = 'singleton',
  immutableReference: string | null = null,
): ProfileMaterializationSourceRecordInput {
  if (collected.outcome === 'established-value') {
    return record(
      candidate,
      collectedAt,
      config,
      operation,
      normalizedValue,
      logicalSourceKey,
      immutableReference,
    );
  }
  const policy = operationPolicy(config.policy, operation);
  return {
    candidateId: candidate.candidateId,
    sourceType: policy.sourceType,
    operation,
    logicalSourceKey,
    sourceMutability: policy.sourceMutability,
    outcome: collected.outcome,
    immutableReference,
    collectedAt,
    normalizedValue: null,
    controlledCode: collected.controlledCode,
    evidenceIds: [],
  };
}

function recordQualified<T>(collected: Collected<T>, failures: string[]): void {
  if (
    collected.outcome === 'unavailable' &&
    collected.controlledCode !== null
  ) {
    failures.push(collected.controlledCode);
  }
}

async function request(
  candidate: CatalogCandidate,
  config: ProfileMaterializationProviderConfig,
  operation: ProfileMaterializationOperation,
  path: string,
): Promise<JsonResponse> {
  const policy = operationPolicy(config.policy, operation);
  return requestUrl(
    candidate,
    config,
    operation,
    new URL(path, `https://${policy.host}`),
  );
}

async function requestUrl(
  candidate: CatalogCandidate,
  config: ProfileMaterializationProviderConfig,
  operation: ProfileMaterializationOperation,
  url: URL,
): Promise<JsonResponse> {
  const policy = operationPolicy(config.policy, operation);
  const request: TransportRequest = {
    url,
    provider: policy.provider,
    operation,
    maximumBytes: policy.maximumResponseBytes,
    maximumNodes: policy.maximumJsonNodes,
    correlationId: config.correlationId,
    candidateId: candidate.candidateId,
    ...(policy.authentication === 'required'
      ? { authorizationToken: config.githubToken }
      : {}),
    ...(config.signal === undefined ? {} : { signal: config.signal }),
    ...(config.deadlineSignal === undefined
      ? {}
      : { deadlineSignal: config.deadlineSignal }),
  };
  return config.transport.requestJson(request);
}

function assertRepositoryIdentity(
  candidate: CatalogCandidate,
  repository: ProfileMaterializationRepositorySource,
): void {
  const moved =
    repository.canonicalOwner.toLowerCase() !==
      candidate.github.owner.toLowerCase() ||
    repository.canonicalRepository.toLowerCase() !==
      candidate.github.repository.toLowerCase();
  if (moved && candidate.status !== 'moved') {
    throw ingestionError('ingestion.provider-identity');
  }
}

function parseForkParent(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const owner = value['owner'];
  const name = value['name'];
  if (
    !isRecord(owner) ||
    typeof owner['login'] !== 'string' ||
    typeof name !== 'string'
  ) {
    return null;
  }
  if (
    !/^[A-Za-z0-9_.-]{1,100}$/u.test(owner['login']) ||
    !/^[A-Za-z0-9_.-]{1,100}$/u.test(name)
  ) {
    return null;
  }
  return `${owner['login']}/${name}`;
}

function parseRepositoryLicense(value: unknown): string | null {
  return value === null ? null : normalizeSpdx(requireRecord(value)['spdx_id']);
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
  if (raw === null) return null;
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

function repositoryIdentity(
  value: string | null,
): { readonly owner: string; readonly repository: string } | null {
  if (value === null) return null;
  try {
    const url = new URL(value);
    const parts = url.pathname
      .replace(/^\/|\/$/gu, '')
      .replace(/\.git$/u, '')
      .split('/');
    if (
      url.hostname !== 'github.com' ||
      parts.length !== 2 ||
      parts.some((part) => !/^[A-Za-z0-9_.-]{1,100}$/u.test(part))
    )
      return null;
    const [owner, repository] = parts;
    return owner === undefined || repository === undefined
      ? null
      : { owner, repository };
  } catch {
    return null;
  }
}

function parseNpmLicense(value: unknown): string | null {
  if (typeof value === 'string') return value.slice(0, 100);
  if (isRecord(value) && typeof value['type'] === 'string') {
    return value['type'].slice(0, 100);
  }
  return null;
}

function requireBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean')
    throw ingestionError('ingestion.provider-response');
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
  )
    throw ingestionError('ingestion.provider-response');
  return url.toString();
}

function optionalHttpsUrl(value: unknown): string | null {
  if (value === null || value === '') return null;
  try {
    const url = new URL(requireString(value));
    return url.protocol === 'https:' &&
      url.username === '' &&
      url.password === ''
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function requireSha(value: unknown): string {
  const sha = requireString(value, 40);
  if (!/^[a-f0-9]{40}$/u.test(sha))
    throw ingestionError('ingestion.provider-response');
  return sha;
}

function requireRepositoryPath(value: unknown): string {
  const path = requireString(value, 255);
  if (
    path.startsWith('/') ||
    path.endsWith('/') ||
    path.includes('\\') ||
    path.split('/').some((part) => part === '' || part === '.' || part === '..')
  )
    throw ingestionError('ingestion.provider-response');
  return path;
}

function immutableRepositoryUrl(
  owner: string,
  repository: string,
  sha: string,
  path: string,
): string {
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/blob/${sha}/${path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`;
}

function nextLink(header: string | null): URL | null {
  if (header === null || header.length > 4_096) return null;
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

function isSemanticVersion(value: string): boolean {
  return /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(
    value,
  );
}
