/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Provider payloads are untrusted and require explicit boundary checks. */

import {
  repositoryArtifactContentSha256,
  repositoryArtifactGitBlobObjectId,
} from '@gitblocks/contracts';

import { canonicalizeJson } from './canonical-json.ts';
import {
  CANDIDATE_AUTHORITY_LIVE_OPERATOR_VERSION,
  CANDIDATE_AUTHORITY_OPERATION_IDS,
  createCandidateAuthoritySourceAuthority,
  createCandidateAuthoritySourceCandidate,
  type CandidateAuthorityOperationId,
  type CandidateAuthorityOperationReceiptV1,
  type CandidateAuthoritySourceAuthorityV1,
  type CandidateAuthoritySourceDatum,
} from './candidate-authority-live-contracts.ts';
import { isSafeCandidateAuthorityRepositoryRelativePath } from './candidate-authority-license-provenance.ts';
import { extractRepositoryContainerBuildDeclarationFact } from './candidate-authority-dockerfile.ts';
import {
  extractApplicableSecurityAdvisoryFacts,
  extractFrameworkPeerRelationFacts,
  extractImportableRuntimePackageAdoptionFact,
  extractPublishedReleaseFacts,
  extractRecognizedLicenseSpdxFact,
  extractRepositoryPrimaryLanguageFact,
  extractRepositorySelfBuildComposeServiceFacts,
} from './candidate-authority-partial-rules.ts';
import type { CandidateAuthoritySourcePolicyV5 } from './candidate-authority-readiness.ts';
import { IngestionError, ingestionError } from './errors.ts';
import { requireRecord } from './profile-materialization-contracts.ts';
import type { JsonResponse } from './transport.ts';
import type { CatalogCandidate, PublicCatalog } from './types.ts';

export interface CandidateAuthorityLiveTransport {
  requestJson(request: {
    readonly url: URL;
    readonly provider: 'github' | 'npm';
    readonly operation: string;
    readonly maximumBytes: number;
    readonly maximumNodes: number;
    readonly requestTimeoutMilliseconds: number;
    readonly authorizationToken?: string;
    readonly githubApiVersion?: '2026-03-10';
    readonly correlationId: string;
    readonly candidateId: string;
    readonly signal?: AbortSignal;
  }): Promise<JsonResponse>;
}

export interface CandidateAuthorityAttemptMetrics {
  readonly githubAttempts: number;
  readonly npmAttempts: number;
  readonly retries: number;
  readonly perOperationAttempts: Readonly<Record<string, number>>;
}

interface OperationCounter {
  logicalRequests: number;
  establishedAbsences: number;
  qualifiedUnknowns: number;
}

interface CollectionState {
  readonly counters: Map<CandidateAuthorityOperationId, OperationCounter>;
  githubLogicalRequests: number;
  npmLogicalRequests: number;
  readonly optionalFailures: Map<string, number>;
}

interface RepositoryContext {
  readonly repositoryId: string;
  readonly canonicalOwner: string;
  readonly canonicalRepository: string;
  readonly defaultBranch: string;
  readonly archived: boolean;
  readonly primaryLanguage: string | null;
  readonly headSha: string;
  readonly rootTreeSha: string;
  readonly headCommittedAt: string;
  readonly rootTreeValue: unknown;
  readonly rootTreeOutcome: 'established-value' | 'qualified-unknown';
}

export async function collectCandidateAuthoritySourceAuthority(input: {
  readonly catalog: PublicCatalog;
  readonly sourcePolicy: CandidateAuthoritySourcePolicyV5;
  readonly liveAuthorizationVersion: string;
  readonly liveAuthorizationDigest: string;
  readonly liveAuthorizationBindings: Readonly<Record<string, string>>;
  readonly executionHead: string;
  readonly githubToken: string;
  readonly collectionCutoff: string;
  readonly transport: CandidateAuthorityLiveTransport;
  readonly readAttemptMetrics: () => CandidateAuthorityAttemptMetrics;
  readonly signal?: AbortSignal;
}): Promise<CandidateAuthoritySourceAuthorityV1> {
  requireTimestamp(input.collectionCutoff);
  if (
    input.catalog.candidates.length !== 150 ||
    !/^[a-f0-9]{40}$/u.test(input.executionHead)
  )
    invalid();
  const state: CollectionState = {
    counters: new Map(
      CANDIDATE_AUTHORITY_OPERATION_IDS.map((operationId) => [
        operationId,
        { logicalRequests: 0, establishedAbsences: 0, qualifiedUnknowns: 0 },
      ]),
    ),
    githubLogicalRequests: 0,
    npmLogicalRequests: 0,
    optionalFailures: new Map(),
  };
  const results = new Array(input.catalog.candidates.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      for (;;) {
        const index = cursor;
        cursor += 1;
        const candidate = input.catalog.candidates[index];
        if (candidate === undefined) return;
        results[index] = await collectCandidate(candidate, input, state);
      }
    }),
  );
  const candidates =
    results as CandidateAuthoritySourceAuthorityV1['candidates'];
  const attempts = input.readAttemptMetrics();
  const perOperation: CandidateAuthorityOperationReceiptV1[] =
    CANDIDATE_AUTHORITY_OPERATION_IDS.map((operationId) => {
      const counter = requireCounter(state, operationId);
      return {
        operationId,
        logicalRequests: counter.logicalRequests,
        attempts: attempts.perOperationAttempts[operationId] ?? 0,
        establishedAbsences: counter.establishedAbsences,
        qualifiedUnknowns: counter.qualifiedUnknowns,
      };
    });
  const totalLogicalRequests =
    state.githubLogicalRequests + state.npmLogicalRequests;
  const totalAttempts = attempts.githubAttempts + attempts.npmAttempts;
  if (
    state.githubLogicalRequests >
      input.sourcePolicy.requestBudget.githubLogicalRequests ||
    state.npmLogicalRequests >
      input.sourcePolicy.requestBudget.npmLogicalRequests ||
    totalLogicalRequests >
      input.sourcePolicy.requestBudget.totalLogicalRequests ||
    attempts.githubAttempts >
      input.sourcePolicy.requestBudget.githubWorstCaseAttempts ||
    attempts.npmAttempts >
      input.sourcePolicy.requestBudget.npmWorstCaseAttempts ||
    totalAttempts > input.sourcePolicy.requestBudget.totalWorstCaseAttempts ||
    attempts.retries !== totalAttempts - totalLogicalRequests
  )
    invalid();
  return createCandidateAuthoritySourceAuthority({
    authorityVersion: 'candidate-authority-source-authority/1.0.0',
    operatorVersion: CANDIDATE_AUTHORITY_LIVE_OPERATOR_VERSION,
    bindings: {
      ...input.liveAuthorizationBindings,
      catalogVersion: input.catalog.catalogVersion,
      catalogDigest: input.catalog.manifestDigest,
      sourcePolicyVersion: input.sourcePolicy.policyVersion,
      sourcePolicyDigest: input.sourcePolicy.policySemanticDigest,
      liveAuthorizationVersion: input.liveAuthorizationVersion,
      liveAuthorizationDigest: input.liveAuthorizationDigest,
      collectionExecutionHead: input.executionHead,
    },
    collectionCutoff: input.collectionCutoff,
    candidateCount: 150,
    orderedCandidateIds: input.catalog.candidates.map(
      (candidate) => candidate.candidateId,
    ),
    candidates,
    effectReceipt: {
      collectionExecutions: 1,
      githubLogicalRequests: state.githubLogicalRequests,
      npmLogicalRequests: state.npmLogicalRequests,
      totalLogicalRequests,
      githubAttempts: attempts.githubAttempts,
      npmAttempts: attempts.npmAttempts,
      totalAttempts,
      retries: attempts.retries,
      perOperation,
      controlledOptionalSourceFailures: Object.fromEntries(
        [...state.optionalFailures].sort(([left], [right]) =>
          compare(left, right),
        ),
      ),
      credentialAvailable: true,
      databaseCalls: 0,
      dockerCalls: 0,
      modelCalls: 0,
      candidateExecutions: 0,
      allCandidateProjections: 0,
      coverageCalculations: 0,
    },
  });
}

async function collectCandidate(
  candidate: CatalogCandidate,
  input: Parameters<typeof collectCandidateAuthoritySourceAuthority>[0],
  state: CollectionState,
) {
  const sources: CandidateAuthoritySourceDatum[] = [];
  const metadataResponse = await requiredRequest(
    candidate,
    input,
    state,
    'github-repository-metadata',
    `/repos/${segment(candidate.github.owner)}/${segment(candidate.github.repository)}`,
  );
  const metadata = parseRepositoryMetadata(metadataResponse.value, candidate);
  sources.push(
    source('github-repository-metadata', 'established-value', 'complete', {
      repositoryId: metadata.repositoryId,
      canonicalOwner: metadata.canonicalOwner,
      canonicalRepository: metadata.canonicalRepository,
      defaultBranch: metadata.defaultBranch,
      archived: metadata.archived,
      primaryLanguage: metadata.primaryLanguage,
      partialFacts: facts(
        extractRepositoryPrimaryLanguageFact({
          primaryLanguage: metadata.primaryLanguage,
          sourceComplete: true,
        }),
      ),
    }),
  );
  const refResponse = await requiredRequest(
    candidate,
    input,
    state,
    'github-default-branch-ref',
    `/repos/${segment(candidate.github.owner)}/${segment(candidate.github.repository)}/git/ref/heads/${segment(metadata.defaultBranch)}`,
  );
  const headSha = parseGitRef(refResponse.value, metadata.defaultBranch);
  sources.push(
    source('github-default-branch-ref', 'established-value', 'complete', {
      ref: `refs/heads/${metadata.defaultBranch}`,
      objectType: 'commit',
      headSha,
    }),
  );
  const commitResponse = await requiredRequest(
    candidate,
    input,
    state,
    'github-head-commit-object',
    `/repos/${segment(candidate.github.owner)}/${segment(candidate.github.repository)}/git/commits/${headSha}`,
  );
  const commit = parseGitCommit(commitResponse.value, headSha);
  sources.push(
    source(
      'github-head-commit-object',
      'established-value',
      'complete',
      commit,
    ),
  );
  const rootTreeCollected = await optionalRequest(
    candidate,
    input,
    state,
    'github-root-tree',
    `/repositories/${metadata.repositoryId}/git/trees/${commit.rootTreeSha}`,
    false,
  );
  let rootTreeValue: unknown = null;
  let rootTreeOutcome: RepositoryContext['rootTreeOutcome'] =
    'qualified-unknown';
  if (rootTreeCollected.kind === 'value') {
    rootTreeValue = parseRootTree(
      rootTreeCollected.response.value,
      commit.rootTreeSha,
    );
    rootTreeOutcome = 'established-value';
    sources.push(
      source(
        'github-root-tree',
        'established-value',
        'complete',
        retainedRootTree(rootTreeValue),
      ),
    );
  } else {
    sources.push(
      unknownSource('github-root-tree', optionalFailureCode(rootTreeCollected)),
    );
  }
  const context: RepositoryContext = {
    ...metadata,
    headSha,
    rootTreeSha: commit.rootTreeSha,
    headCommittedAt: commit.committerDate,
    rootTreeValue,
    rootTreeOutcome,
  };
  await collectMaintenance(candidate, context, input, state, sources);
  await collectLicense(candidate, context, input, state, sources);
  await collectCommunity(candidate, input, state, sources);
  await collectReleases(candidate, input, state, sources);
  const npm = await collectNpm(candidate, input, state, sources);
  await collectAdvisories(candidate, npm, input, state, sources);
  await collectCompose(candidate, context, input, state, sources);
  await collectDockerfile(candidate, context, input, state, sources);
  return createCandidateAuthoritySourceCandidate({
    candidateId: candidate.candidateId,
    github: candidate.github,
    npmPackage: candidate.npmPackage,
    sources,
  });
}

async function collectMaintenance(
  candidate: CatalogCandidate,
  context: RepositoryContext,
  input: Parameters<typeof collectCandidateAuthoritySourceAuthority>[0],
  state: CollectionState,
  sources: CandidateAuthoritySourceDatum[],
): Promise<void> {
  const since = new Date(
    Date.parse(input.collectionCutoff) - 90 * 24 * 60 * 60 * 1_000,
  ).toISOString();
  const params = new URLSearchParams({
    sha: context.headSha,
    since,
    until: input.collectionCutoff,
    per_page: '1',
    page: '1',
  });
  const collected = await optionalRequest(
    candidate,
    input,
    state,
    'github-maintenance-window',
    `/repos/${segment(candidate.github.owner)}/${segment(candidate.github.repository)}/commits?${params.toString()}`,
    false,
  );
  if (collected.kind !== 'value') {
    sources.push(
      unknownSource(
        'github-maintenance-window',
        optionalFailureCode(collected),
      ),
    );
    return;
  }
  const value = parseMaintenance(
    collected.response,
    since,
    input.collectionCutoff,
  );
  if (value === null) {
    markQualified(state, 'github-maintenance-window', 'pagination-unclosed');
    sources.push(
      unknownSource('github-maintenance-window', 'pagination-unclosed'),
    );
    return;
  }
  sources.push(
    source('github-maintenance-window', 'established-value', 'complete', {
      ...value,
      headSha: context.headSha,
      lastCommitAt: context.headCommittedAt,
    }),
  );
}

async function collectLicense(
  candidate: CatalogCandidate,
  context: RepositoryContext,
  input: Parameters<typeof collectCandidateAuthoritySourceAuthority>[0],
  state: CollectionState,
  sources: CandidateAuthoritySourceDatum[],
): Promise<void> {
  const collected = await optionalRequest(
    candidate,
    input,
    state,
    'github-license',
    `/repos/${segment(candidate.github.owner)}/${segment(candidate.github.repository)}/license?ref=${context.headSha}`,
    true,
  );
  if (collected.kind === 'absence') {
    sources.push(
      source('github-license', 'established-absence', 'complete', null),
    );
    return;
  }
  if (collected.kind === 'unknown') {
    sources.push(unknownSource('github-license', collected.code));
    return;
  }
  const record = requireRecord(collected.response.value);
  const license = requireRecord(record['license']);
  const spdxId = nullableString(license['spdx_id'], 64);
  const path = record['path'];
  if (!isSafeCandidateAuthorityRepositoryRelativePath(path)) invalidProvider();
  const blobSha = sha1(record['sha']);
  sources.push(
    source('github-license', 'established-value', 'complete', {
      repositoryIdentity: {
        owner: context.canonicalOwner,
        repository: context.canonicalRepository,
      },
      headSha: context.headSha,
      path,
      blobSha,
      spdxId,
      partialFacts: facts(
        extractRecognizedLicenseSpdxFact({ spdxId, sourceComplete: true }),
      ),
    }),
  );
}

async function collectCommunity(
  candidate: CatalogCandidate,
  input: Parameters<typeof collectCandidateAuthoritySourceAuthority>[0],
  state: CollectionState,
  sources: CandidateAuthoritySourceDatum[],
): Promise<void> {
  const collected = await optionalRequest(
    candidate,
    input,
    state,
    'github-community-profile',
    `/repos/${segment(candidate.github.owner)}/${segment(candidate.github.repository)}/community/profile`,
    false,
  );
  if (collected.kind !== 'value') {
    sources.push(
      unknownSource('github-community-profile', optionalFailureCode(collected)),
    );
    return;
  }
  const record = requireRecord(collected.response.value);
  const files = requireRecord(record['files']);
  const policy = files['security_policy'];
  if (policy !== null && typeof policy !== 'object') invalidProvider();
  sources.push(
    source('github-community-profile', 'established-value', 'complete', {
      securityPolicyPresent: policy !== null,
    }),
  );
}

async function collectReleases(
  candidate: CatalogCandidate,
  input: Parameters<typeof collectCandidateAuthoritySourceAuthority>[0],
  state: CollectionState,
  sources: CandidateAuthoritySourceDatum[],
): Promise<void> {
  const collected = await optionalRequest(
    candidate,
    input,
    state,
    'github-release-window',
    `/repos/${segment(candidate.github.owner)}/${segment(candidate.github.repository)}/releases?per_page=5&page=1`,
    false,
  );
  if (collected.kind !== 'value') {
    sources.push(
      unknownSource('github-release-window', optionalFailureCode(collected)),
    );
    return;
  }
  if (
    !Array.isArray(collected.response.value) ||
    collected.response.value.length > 5
  )
    invalidProvider();
  const releases = collected.response.value.map((entry) => {
    const release = requireRecord(entry);
    return {
      tagName: safeString(release['tag_name'], 200),
      publishedAt: timestamp(release['published_at']),
      draft: boolean(release['draft']),
      prerelease: boolean(release['prerelease']),
      htmlUrl: githubHtmlUrl(release['html_url']),
    };
  });
  const complete = releases.length < 5;
  sources.push(
    source(
      'github-release-window',
      'established-value',
      complete ? 'complete' : 'partial',
      {
        complete,
        releases,
        partialFacts: facts(
          extractPublishedReleaseFacts({
            outcome: 'established-value',
            releases,
          }),
        ),
      },
    ),
  );
}

interface CollectedNpm {
  readonly name: string;
  readonly version: string;
}

async function collectNpm(
  candidate: CatalogCandidate,
  input: Parameters<typeof collectCandidateAuthoritySourceAuthority>[0],
  state: CollectionState,
  sources: CandidateAuthoritySourceDatum[],
): Promise<CollectedNpm | null> {
  if (candidate.npmPackage === null) {
    sources.push(
      source('npm-package-metadata', 'not-applicable', 'not-applicable', null),
    );
    return null;
  }
  const response = await requiredRequest(
    candidate,
    input,
    state,
    'npm-package-metadata',
    `/${segment(candidate.npmPackage)}`,
  );
  const root = requireRecord(response.value);
  const name = safeString(root['name'], 214);
  if (name !== candidate.npmPackage) identity();
  const tags = requireRecord(root['dist-tags']);
  const version = safeString(tags['latest'], 100);
  if (!semver(version)) invalidProvider();
  const versions = requireRecord(root['versions']);
  const selected = requireRecord(versions[version]);
  const selectedName = selected['name'];
  if (selectedName !== undefined && selectedName !== name) identity();
  const selectedVersion = selected['version'];
  if (selectedVersion !== undefined && selectedVersion !== version) identity();
  const times = requireRecord(root['time']);
  const publishedAt = timestamp(times[version]);
  const engines =
    selected['engines'] === undefined
      ? null
      : requireRecord(selected['engines']);
  const nodeEngine =
    engines === null ? null : nullableString(engines['node'], 100);
  const main = nullableString(selected['main'], 512);
  const module = nullableString(selected['module'], 512);
  const type = nullableString(selected['type'], 40);
  const peerDependencies = parseStringRecord(selected['peerDependencies'], 200);
  const exportsValue = selected['exports'] ?? null;
  const repositoryIdentity = parseNpmRepository(selected['repository']);
  const partialFacts = [
    ...facts(
      extractImportableRuntimePackageAdoptionFact({
        catalogPackageName: candidate.npmPackage,
        sourcePackageName: name,
        selectedVersion: version,
        sourceComplete: true,
        exportsValue,
        main,
        module,
      }),
    ),
    ...facts(
      extractFrameworkPeerRelationFacts({
        peerDependencies,
        sourceComplete: true,
      }),
    ),
  ];
  sources.push(
    source('npm-package-metadata', 'established-value', 'complete', {
      name,
      selectedVersion: version,
      publishedAt,
      repositoryIdentity,
      nodeEngine,
      exportsValue,
      exportsDeclared: selected['exports'] !== undefined,
      main,
      module,
      peerDependencies,
      type,
      partialFacts,
    }),
  );
  return { name, version };
}

async function collectAdvisories(
  candidate: CatalogCandidate,
  npm: CollectedNpm | null,
  input: Parameters<typeof collectCandidateAuthoritySourceAuthority>[0],
  state: CollectionState,
  sources: CandidateAuthoritySourceDatum[],
): Promise<void> {
  if (npm === null) {
    sources.push(
      source('github-advisories', 'not-applicable', 'not-applicable', null),
    );
    return;
  }
  const advisories: {
    advisoryId: string;
    severity: 'critical' | 'high' | 'low' | 'moderate';
  }[] = [];
  let complete = false;
  for (let page = 1; page <= 2; page += 1) {
    const params = new URLSearchParams({
      ecosystem: 'npm',
      affects: `${npm.name}@${npm.version}`,
      per_page: '100',
      page: String(page),
    });
    const collected = await optionalRequest(
      candidate,
      input,
      state,
      'github-advisories',
      `/advisories?${params.toString()}`,
      false,
    );
    if (collected.kind !== 'value') {
      sources.push(
        unknownSource('github-advisories', optionalFailureCode(collected)),
      );
      return;
    }
    if (
      !Array.isArray(collected.response.value) ||
      collected.response.value.length > 100
    )
      invalidProvider();
    advisories.push(...collected.response.value.map(parseAdvisory));
    if (collected.response.value.length < 100) {
      complete = true;
      break;
    }
  }
  const unique = new Set(advisories.map((advisory) => advisory.advisoryId));
  if (unique.size !== advisories.length) invalidProvider();
  sources.push(
    source(
      'github-advisories',
      'established-value',
      complete ? 'complete' : 'partial',
      {
        packageName: npm.name,
        packageVersion: npm.version,
        complete,
        advisories,
        partialFacts: facts(
          extractApplicableSecurityAdvisoryFacts({
            expectedPackageName: npm.name,
            expectedPackageVersion: npm.version,
            sourcePackageName: npm.name,
            sourcePackageVersion: npm.version,
            outcome: 'established-value',
            advisories,
          }),
        ),
      },
    ),
  );
}

async function collectCompose(
  candidate: CatalogCandidate,
  context: RepositoryContext,
  input: Parameters<typeof collectCandidateAuthoritySourceAuthority>[0],
  state: CollectionState,
  sources: CandidateAuthoritySourceDatum[],
): Promise<void> {
  const contents = await optionalRequest(
    candidate,
    input,
    state,
    'github-compose-json-content',
    `/repos/${segment(candidate.github.owner)}/${segment(candidate.github.repository)}/contents/compose.json?ref=${context.headSha}`,
    true,
  );
  if (context.rootTreeOutcome !== 'established-value') {
    sources.push(
      unknownSource(
        'github-compose-json-content',
        contents.kind === 'unknown' ? contents.code : 'root-tree-unavailable',
      ),
    );
    sources.push(
      unknownSource('github-compose-json-blob', 'root-tree-unavailable'),
    );
    return;
  }
  const entry = rootEntry(context.rootTreeValue, 'compose.json');
  if (entry === null) {
    if (contents.kind === 'value') identity();
    sources.push(
      source(
        'github-compose-json-content',
        'established-absence',
        'complete',
        null,
      ),
    );
    sources.push(
      source(
        'github-compose-json-blob',
        'established-absence',
        'complete',
        null,
      ),
    );
    markAbsence(state, 'github-compose-json-blob');
    return;
  }
  requireNormalBlob(entry);
  if (contents.kind !== 'value') identity();
  const contentsValue = requireRecord(contents.response.value);
  if (
    contentsValue['path'] !== 'compose.json' ||
    contentsValue['sha'] !== entry.sha ||
    contentsValue['encoding'] !== 'base64' ||
    !Number.isSafeInteger(contentsValue['size'])
  )
    identity();
  const blobCollected = await optionalRequest(
    candidate,
    input,
    state,
    'github-compose-json-blob',
    `/repositories/${context.repositoryId}/git/blobs/${entry.sha}`,
    false,
  );
  if (blobCollected.kind !== 'value') {
    const code = optionalFailureCode(blobCollected);
    sources.push(unknownSource('github-compose-json-content', code));
    sources.push(unknownSource('github-compose-json-blob', code));
    return;
  }
  const content = verifyBlob(blobCollected.response.value, entry, 262_144);
  const factsValue = facts(
    extractRepositorySelfBuildComposeServiceFacts({
      content,
      pathOutcome: 'established-value',
      contentTreeBlobIdentityVerified: true,
    }),
  );
  sources.push(
    source('github-compose-json-content', 'established-value', 'complete', {
      path: 'compose.json',
      sha: entry.sha,
      size: Buffer.byteLength(content, 'utf8'),
    }),
  );
  sources.push(
    source('github-compose-json-blob', 'established-value', 'complete', {
      path: 'compose.json',
      sha: entry.sha,
      contentDigest: repositoryArtifactContentSha256(content),
      partialFacts: factsValue,
      parserOutcome: factsValue.length > 0 ? 'established-facts' : 'unknown',
    }),
  );
}

async function collectDockerfile(
  candidate: CatalogCandidate,
  context: RepositoryContext,
  input: Parameters<typeof collectCandidateAuthoritySourceAuthority>[0],
  state: CollectionState,
  sources: CandidateAuthoritySourceDatum[],
): Promise<void> {
  if (context.rootTreeOutcome !== 'established-value') {
    sources.push(
      unknownSource('github-dockerfile-blob', 'root-tree-unavailable'),
    );
    return;
  }
  const entry = rootEntry(context.rootTreeValue, 'Dockerfile');
  if (entry === null) {
    sources.push(
      source('github-dockerfile-blob', 'established-absence', 'complete', null),
    );
    markAbsence(state, 'github-dockerfile-blob');
    return;
  }
  requireNormalBlob(entry);
  const collected = await optionalRequest(
    candidate,
    input,
    state,
    'github-dockerfile-blob',
    `/repositories/${context.repositoryId}/git/blobs/${entry.sha}`,
    false,
  );
  if (collected.kind !== 'value') {
    sources.push(
      unknownSource('github-dockerfile-blob', optionalFailureCode(collected)),
    );
    return;
  }
  const rule = extractRepositoryContainerBuildDeclarationFact({
    expectedRepositoryIdentity: {
      repositoryId: context.repositoryId,
      owner: candidate.github.owner,
      repository: candidate.github.repository,
    },
    observedRepositoryIdentity: {
      repositoryId: context.repositoryId,
      owner: candidate.github.owner,
      repository: candidate.github.repository,
    },
    expectedCommitObjectId: context.headSha,
    observedCommitObjectId: context.headSha,
    expectedRootTreeObjectId: context.rootTreeSha,
    rootTreeValue: context.rootTreeValue,
    blobOutcome: 'established-value',
    blobValue: collected.response.value,
  });
  const partialFacts = facts(rule);
  const blob = requireRecord(collected.response.value);
  const content = verifyBlob(collected.response.value, entry, 262_144);
  sources.push(
    source('github-dockerfile-blob', 'established-value', 'complete', {
      path: 'Dockerfile',
      sha: entry.sha,
      size: number(blob['size']),
      contentDigest: repositoryArtifactContentSha256(content),
      partialFacts,
      parserOutcome: partialFacts.length > 0 ? 'established-facts' : 'unknown',
    }),
  );
}

async function requiredRequest(
  candidate: CatalogCandidate,
  input: Parameters<typeof collectCandidateAuthoritySourceAuthority>[0],
  state: CollectionState,
  operationId: CandidateAuthorityOperationId,
  path: string,
): Promise<JsonResponse> {
  return request(candidate, input, state, operationId, path);
}

type OptionalResult =
  | { readonly kind: 'value'; readonly response: JsonResponse }
  | { readonly kind: 'absence' }
  | { readonly kind: 'unknown'; readonly code: string };

async function optionalRequest(
  candidate: CatalogCandidate,
  input: Parameters<typeof collectCandidateAuthoritySourceAuthority>[0],
  state: CollectionState,
  operationId: CandidateAuthorityOperationId,
  path: string,
  notFoundIsAbsence: boolean,
): Promise<OptionalResult> {
  try {
    return {
      kind: 'value',
      response: await request(candidate, input, state, operationId, path),
    };
  } catch (error) {
    if (
      error instanceof IngestionError &&
      error.code === 'ingestion.provider-not-found' &&
      notFoundIsAbsence
    ) {
      markAbsence(state, operationId);
      return { kind: 'absence' };
    }
    if (
      error instanceof IngestionError &&
      (error.code === 'ingestion.provider-unavailable' ||
        error.code === 'ingestion.provider-rate-limited' ||
        error.code === 'ingestion.deadline-exceeded' ||
        error.code === 'ingestion.provider-not-found')
    ) {
      markQualified(state, operationId, error.code);
      return { kind: 'unknown', code: error.code };
    }
    throw error;
  }
}

async function request(
  candidate: CatalogCandidate,
  input: Parameters<typeof collectCandidateAuthoritySourceAuthority>[0],
  state: CollectionState,
  operationId: CandidateAuthorityOperationId,
  path: string,
): Promise<JsonResponse> {
  const operation = input.sourcePolicy.operations.find(
    (candidateOperation) => candidateOperation.operationId === operationId,
  );
  if (operation === undefined) invalid();
  const provider = operation.provider;
  if (provider !== 'github' && provider !== 'npm') invalid();
  if (
    operation.host !==
    (provider === 'github' ? 'api.github.com' : 'registry.npmjs.org')
  )
    invalid();
  const counter = requireCounter(state, operationId);
  counter.logicalRequests += 1;
  if (counter.logicalRequests > operation.maximumTotalLogicalRequests)
    invalid();
  if (provider === 'github') state.githubLogicalRequests += 1;
  else state.npmLogicalRequests += 1;
  if (
    state.githubLogicalRequests > 1810 ||
    state.npmLogicalRequests > 80 ||
    state.githubLogicalRequests + state.npmLogicalRequests > 1890
  )
    invalid();
  return input.transport.requestJson({
    url: new URL(`https://${operation.host}${path}`),
    provider,
    operation: operationId,
    maximumBytes: operation.maximumResponseBytes,
    maximumNodes: operation.maximumJsonNodes,
    requestTimeoutMilliseconds: operation.timeoutMilliseconds,
    ...(provider === 'github'
      ? {
          authorizationToken: input.githubToken,
          githubApiVersion: '2026-03-10' as const,
        }
      : {}),
    correlationId: `candidate-authority:${input.collectionCutoff}`,
    candidateId: candidate.candidateId,
    ...(input.signal === undefined ? {} : { signal: input.signal }),
  });
}

function parseRepositoryMetadata(value: unknown, candidate: CatalogCandidate) {
  const record = requireRecord(value);
  const fullName = safeString(record['full_name'], 201);
  if (
    fullName.toLowerCase() !==
    `${candidate.github.owner}/${candidate.github.repository}`.toLowerCase()
  )
    identity();
  const parts = fullName.split('/');
  if (parts.length !== 2 || parts[0] === undefined || parts[1] === undefined)
    identity();
  const rawId = record['id'];
  if (!Number.isSafeInteger(rawId) || Number(rawId) < 1) invalidProvider();
  return {
    repositoryId: String(rawId),
    canonicalOwner: parts[0],
    canonicalRepository: parts[1],
    defaultBranch: safeString(record['default_branch'], 255),
    archived: boolean(record['archived']),
    primaryLanguage: nullableString(record['language'], 100),
  };
}

function parseGitRef(value: unknown, branch: string): string {
  const record = requireRecord(value);
  const object = requireRecord(record['object']);
  if (record['ref'] !== `refs/heads/${branch}` || object['type'] !== 'commit')
    identity();
  return sha1(object['sha']);
}

function parseGitCommit(value: unknown, expectedSha: string) {
  const record = requireRecord(value);
  if (record['sha'] !== expectedSha) identity();
  const tree = requireRecord(record['tree']);
  const author = requireRecord(record['author']);
  const committer = requireRecord(record['committer']);
  return {
    headSha: expectedSha,
    rootTreeSha: sha1(tree['sha']),
    authorDate: timestamp(author['date']),
    committerDate: timestamp(committer['date']),
  };
}

function parseRootTree(value: unknown, expectedSha: string): unknown {
  const tree = requireRecord(value);
  if (
    tree['sha'] !== expectedSha ||
    tree['truncated'] !== false ||
    !Array.isArray(tree['tree']) ||
    tree['tree'].length > 10_000
  )
    invalidProvider();
  const paths = tree['tree'].map((entry) =>
    safeString(requireRecord(entry)['path'], 255),
  );
  if (new Set(paths).size !== paths.length) invalidProvider();
  return value;
}

function retainedRootTree(value: unknown) {
  const tree = requireRecord(value);
  return {
    sha: sha1(tree['sha']),
    entries: ['compose.json', 'Dockerfile'].flatMap((path) => {
      const entry = rootEntry(value, path);
      return entry === null ? [] : [entry];
    }),
  };
}

interface TreeEntry {
  readonly path: string;
  readonly mode: string;
  readonly type: string;
  readonly sha: string;
  readonly size: number | null;
}

function rootEntry(value: unknown, path: string): TreeEntry | null {
  const tree = requireRecord(value);
  if (!Array.isArray(tree['tree'])) invalidProvider();
  const matches = tree['tree'].filter(
    (item) => requireRecord(item)['path'] === path,
  );
  if (matches.length > 1) invalidProvider();
  if (matches.length === 0) return null;
  const entry = requireRecord(matches[0]);
  return {
    path,
    mode: safeString(entry['mode'], 6),
    type: safeString(entry['type'], 16),
    sha: sha1(entry['sha']),
    size: entry['size'] === undefined ? null : number(entry['size']),
  };
}

function requireNormalBlob(entry: TreeEntry): void {
  if (
    (entry.mode !== '100644' && entry.mode !== '100755') ||
    entry.type !== 'blob'
  )
    invalidProvider();
}

function verifyBlob(
  value: unknown,
  entry: TreeEntry,
  maximumBytes: number,
): string {
  const blob = requireRecord(value);
  if (blob['sha'] !== entry.sha || blob['encoding'] !== 'base64') identity();
  const declaredSize = number(blob['size']);
  const content = safeString(
    blob['content'],
    maximumBytes * 2 + 4096,
  ).replaceAll(/\r\n|\n|\r/gu, '');
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(
      content,
    )
  )
    invalidProvider();
  const bytes = Buffer.from(content, 'base64');
  if (
    bytes.byteLength > maximumBytes ||
    bytes.byteLength !== declaredSize ||
    (entry.size !== null && entry.size !== declaredSize) ||
    bytes.toString('base64') !== content
  )
    invalidProvider();
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (
    text.includes('\0') ||
    repositoryArtifactGitBlobObjectId('sha1', text) !== entry.sha ||
    !Buffer.from(text, 'utf8').equals(bytes)
  )
    invalidProvider();
  return text;
}

function parseMaintenance(
  response: JsonResponse,
  since: string,
  until: string,
) {
  if (!Array.isArray(response.value) || response.value.length > 1)
    invalidProvider();
  const link = response.headers.get('link');
  if (link === null)
    return {
      since,
      until,
      count: response.value.length,
      paginationClosure: 'single-page',
    };
  const match = /<([^>]+)>;\s*rel="last"/u.exec(link);
  if (match?.[1] === undefined || response.value.length !== 1) return null;
  const url = new URL(match[1]);
  if (url.protocol !== 'https:' || url.hostname !== 'api.github.com')
    invalidProvider();
  const page = url.searchParams.get('page');
  if (page === null || !/^[1-9]\d{0,8}$/u.test(page)) invalidProvider();
  return {
    since,
    until,
    count: Number(page),
    paginationClosure: 'link-last-page',
  };
}

function parseAdvisory(value: unknown): {
  readonly advisoryId: string;
  readonly severity: 'critical' | 'high' | 'low' | 'moderate';
} {
  const record = requireRecord(value);
  const advisoryId = safeString(record['ghsa_id'], 64).toUpperCase();
  if (
    !/^GHSA-[23456789CFGHJMPQRVWX]{4}-[23456789CFGHJMPQRVWX]{4}-[23456789CFGHJMPQRVWX]{4}$/u.test(
      advisoryId,
    )
  )
    invalidProvider();
  const severity = record['severity'];
  if (
    severity !== 'critical' &&
    severity !== 'high' &&
    severity !== 'low' &&
    severity !== 'moderate'
  )
    invalidProvider();
  return {
    advisoryId,
    severity,
  };
}

function parseNpmRepository(
  value: unknown,
): { owner: string; repository: string } | null {
  const raw =
    typeof value === 'string'
      ? value
      : value === undefined
        ? null
        : typeof value === 'object' && value !== null && !Array.isArray(value)
          ? (value as Record<string, unknown>)['url']
          : null;
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string' || raw.length > 1000 || hasControlCharacter(raw))
    invalidProvider();
  const normalized = raw
    .replace(/^git\+/u, '')
    .replace(/^git:\/\/github\.com\//iu, 'https://github.com/')
    .replace(/^github:/iu, 'https://github.com/')
    .replace(/^git@github\.com:/iu, 'https://github.com/');
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return null;
  }
  if (url.hostname.toLowerCase() !== 'github.com') return null;
  const parts = url.pathname
    .replace(/^\//u, '')
    .replace(/\.git$/u, '')
    .split('/');
  return parts.length >= 2 && parts[0] !== undefined && parts[1] !== undefined
    ? {
        owner: safeString(parts[0], 100),
        repository: safeString(parts[1], 100),
      }
    : null;
}

function parseStringRecord(
  value: unknown,
  maximumValue: number,
): Readonly<Record<string, string>> | null {
  if (value === undefined) return null;
  const record = requireRecord(value);
  const entries = Object.entries(record);
  if (entries.length > 1000) invalidProvider();
  return Object.fromEntries(
    entries
      .sort(([left], [right]) => compare(left, right))
      .map(([key, item]) => [
        safeString(key, 214),
        safeString(item, maximumValue),
      ]),
  );
}

function source(
  operationId: CandidateAuthorityOperationId,
  outcome: CandidateAuthoritySourceDatum['outcome'],
  completeness: CandidateAuthoritySourceDatum['completeness'],
  value: unknown,
  limitationCode: string | null = null,
): CandidateAuthoritySourceDatum {
  return { operationId, outcome, completeness, limitationCode, value };
}

function unknownSource(
  operationId: CandidateAuthorityOperationId,
  code: string,
) {
  return source(operationId, 'qualified-unknown', 'partial', null, code);
}

function facts(result: ReturnType<typeof extractPublishedReleaseFacts>) {
  return result.state === 'established-facts' ? [...result.facts] : [];
}

function requireCounter(
  state: CollectionState,
  operationId: CandidateAuthorityOperationId,
): OperationCounter {
  const value = state.counters.get(operationId);
  if (value === undefined) invalid();
  return value;
}

function markAbsence(
  state: CollectionState,
  operationId: CandidateAuthorityOperationId,
): void {
  requireCounter(state, operationId).establishedAbsences += 1;
}

function markQualified(
  state: CollectionState,
  operationId: CandidateAuthorityOperationId,
  code: string,
): void {
  requireCounter(state, operationId).qualifiedUnknowns += 1;
  const key = `${operationId}:${code}`;
  state.optionalFailures.set(key, (state.optionalFailures.get(key) ?? 0) + 1);
}

function optionalFailureCode(
  result: Exclude<OptionalResult, { readonly kind: 'value' }>,
): string {
  return result.kind === 'unknown'
    ? result.code
    : 'ingestion.provider-not-found';
}

function segment(value: string): string {
  return encodeURIComponent(value);
}
function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function sha1(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{40}$/u.test(value))
    invalidProvider();
  return value;
}
function safeString(value: unknown, maximum: number): string {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > maximum ||
    hasControlCharacter(value)
  )
    invalidProvider();
  return value;
}
function nullableString(value: unknown, maximum: number): string | null {
  return value === null || value === undefined
    ? null
    : safeString(value, maximum);
}
function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}
function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') invalidProvider();
  return value;
}
function number(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) invalidProvider();
  return Number(value);
}
function timestamp(value: unknown): string {
  const result = safeString(value, 40);
  requireTimestamp(result);
  return new Date(result).toISOString();
}
function requireTimestamp(value: string): void {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    invalidProvider();
}
function semver(value: string): boolean {
  return /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(
    value,
  );
}
function githubHtmlUrl(value: unknown): string {
  const result = safeString(value, 1000);
  const url = new URL(result);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com')
    invalidProvider();
  return result;
}
function identity(): never {
  throw ingestionError('ingestion.provider-identity');
}
function invalidProvider(): never {
  throw ingestionError('ingestion.provider-response');
}
function invalid(): never {
  throw ingestionError('ingestion.invalid-input');
}

export function sourceAuthorityCandidateSemanticDigest(value: unknown): string {
  return canonicalizeJson(value).digest;
}
