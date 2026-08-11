/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Provider payloads are untrusted and require explicit boundary checks. */

import { repositoryArtifactContentSha256 } from '@gitblocks/contracts';

import { canonicalizeJson } from './canonical-json.ts';
import {
  CANDIDATE_AUTHORITY_LIVE_OPERATOR_V6_VERSION,
  CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS,
  createCandidateAuthoritySuccessorSourceAuthority,
  createCandidateAuthoritySuccessorSourceCandidate,
  parseCandidateAuthorityAdvisory,
  parseCandidateAuthorityGitTree,
  parseCandidateAuthorityOptionalGitBlob,
  parseCandidateAuthorityOptionalString,
  parseCandidateAuthorityOptionalStringRecord,
  parseCandidateAuthorityReleaseWindow,
  projectCandidateAuthorityLocalSecurityPolicy,
  runCandidateAuthorityFatalCancellingWorkers,
  type CandidateAuthorityFatalCounters,
  type CandidateAuthorityOptionalProperty,
  type CandidateAuthoritySuccessorOperationId,
  type CandidateAuthoritySuccessorOperationReceipt,
  type CandidateAuthoritySuccessorRuntimeSourcePolicy,
  type CandidateAuthoritySuccessorSourceAuthority,
  type CandidateAuthoritySuccessorSourceDatum,
  type CandidateAuthorityTreeEntry,
  type CandidateAuthorityTreeResult,
} from './candidate-authority-provider-contract.ts';
import type {
  CANDIDATE_AUTHORITY_LIVE_OPERATOR_V4_VERSION,
  CANDIDATE_AUTHORITY_LIVE_OPERATOR_V5_VERSION,
} from './candidate-authority-provider-contract.ts';
import { isSafeCandidateAuthorityRepositoryRelativePath } from './candidate-authority-license-provenance.ts';
import { extractRepositoryContainerBuildDeclarationFact } from './candidate-authority-dockerfile.ts';
import {
  extractApplicableSecurityAdvisoryFacts,
  extractFrameworkPeerRelationFacts,
  extractImportableRuntimePackageAdoptionFact,
  extractPublishedReleaseFacts,
  extractRegistryResolvedPackageVersionFact,
  extractRecognizedLicenseSpdxFact,
  extractRepositoryPrimaryLanguageFact,
  extractRepositorySelfBuildComposeServiceFacts,
} from './candidate-authority-partial-rules.ts';
import { IngestionError, asSafeErrorCode, ingestionError } from './errors.ts';
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
  readonly githubLogicalRequests?: number;
  readonly npmLogicalRequests?: number;
  readonly perOperationLogicalRequests?: Readonly<Record<string, number>>;
}

interface OperationCounter {
  logicalRequests: number;
  establishedAbsences: number;
  qualifiedUnknowns: number;
}

interface CollectionState {
  readonly counters: Map<
    CandidateAuthoritySuccessorOperationId,
    OperationCounter
  >;
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
  readonly rootTree: CandidateAuthorityTreeResult;
  readonly rootTreeOutcome: 'established-value' | 'qualified-unknown';
}

export async function collectCandidateAuthoritySourceAuthority(input: {
  readonly catalog: PublicCatalog;
  readonly sourcePolicy: CandidateAuthoritySuccessorRuntimeSourcePolicy;
  readonly liveAuthorizationVersion: string;
  readonly liveAuthorizationDigest: string;
  readonly liveAuthorizationBindings: Readonly<Record<string, string>>;
  readonly executionHead: string;
  readonly githubToken: string;
  readonly collectionCutoff: string;
  readonly operatorVersion?:
    | typeof CANDIDATE_AUTHORITY_LIVE_OPERATOR_V4_VERSION
    | typeof CANDIDATE_AUTHORITY_LIVE_OPERATOR_V5_VERSION
    | typeof CANDIDATE_AUTHORITY_LIVE_OPERATOR_V6_VERSION;
  readonly transport: CandidateAuthorityLiveTransport;
  readonly readAttemptMetrics: () => CandidateAuthorityAttemptMetrics;
  readonly observeLogicalRequest?: (
    provider: 'github' | 'npm',
    operationId: CandidateAuthoritySuccessorOperationId,
  ) => void;
  readonly signal?: AbortSignal;
}): Promise<CandidateAuthoritySuccessorSourceAuthority> {
  requireTimestamp(input.collectionCutoff);
  if (
    input.catalog.candidates.length !== 150 ||
    !/^[a-f0-9]{40}$/u.test(input.executionHead)
  )
    invalid();
  const state: CollectionState = {
    counters: new Map(
      CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS.map((operationId) => [
        operationId,
        { logicalRequests: 0, establishedAbsences: 0, qualifiedUnknowns: 0 },
      ]),
    ),
    githubLogicalRequests: 0,
    npmLogicalRequests: 0,
    optionalFailures: new Map(),
  };
  const results = new Array(input.catalog.candidates.length);
  const indexed = input.catalog.candidates.map((candidate, index) => ({
    candidate,
    index,
  }));
  await runCandidateAuthorityFatalCancellingWorkers({
    items: indexed,
    workerCount: 5,
    ...(input.signal === undefined ? {} : { callerSignal: input.signal }),
    context: (item, error) => ({
      candidateId: item.candidate.candidateId,
      operationId:
        error instanceof CandidateAuthorityOperationFailure
          ? error.operationId
          : 'candidate-collection-invariant',
    }),
    execute: async (item, signal) => {
      results[item.index] = await collectCandidate(
        item.candidate,
        { ...input, signal },
        state,
      );
    },
    readFinalCounters: () => fatalCounters(state, input.readAttemptMetrics()),
  });
  const candidates =
    results as CandidateAuthoritySuccessorSourceAuthority['candidates'];
  const attempts = input.readAttemptMetrics();
  const perOperation: CandidateAuthoritySuccessorOperationReceipt[] =
    CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS.map((operationId) => {
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
  return createCandidateAuthoritySuccessorSourceAuthority({
    authorityVersion: 'candidate-authority-source-authority/3.0.0',
    operatorVersion:
      input.operatorVersion ?? CANDIDATE_AUTHORITY_LIVE_OPERATOR_V6_VERSION,
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
  const sources: CandidateAuthoritySuccessorSourceDatum[] = [];
  const metadata = await operation(
    candidate,
    'github-repository-metadata',
    async () => {
      const response = await requiredRequest(
        candidate,
        input,
        state,
        'github-repository-metadata',
        `/repos/${segment(candidate.github.owner)}/${segment(candidate.github.repository)}`,
      );
      return parseRepositoryMetadata(response.value, candidate);
    },
  );
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
  const headSha = await operation(
    candidate,
    'github-default-branch-ref',
    async () => {
      const response = await requiredRequest(
        candidate,
        input,
        state,
        'github-default-branch-ref',
        `/repos/${segment(candidate.github.owner)}/${segment(candidate.github.repository)}/git/ref/heads/${segment(metadata.defaultBranch)}`,
      );
      return parseGitRef(response.value, metadata.defaultBranch);
    },
  );
  sources.push(
    source('github-default-branch-ref', 'established-value', 'complete', {
      ref: `refs/heads/${metadata.defaultBranch}`,
      objectType: 'commit',
      headSha,
    }),
  );
  const commit = await operation(
    candidate,
    'github-head-commit-object',
    async () => {
      const response = await requiredRequest(
        candidate,
        input,
        state,
        'github-head-commit-object',
        `/repos/${segment(candidate.github.owner)}/${segment(candidate.github.repository)}/git/commits/${headSha}`,
      );
      return parseGitCommit(response.value, headSha);
    },
  );
  sources.push(
    source(
      'github-head-commit-object',
      'established-value',
      'complete',
      commit,
    ),
  );
  const rootTreeCollected = await operation(candidate, 'github-root-tree', () =>
    optionalRequest(
      candidate,
      input,
      state,
      'github-root-tree',
      `/repositories/${metadata.repositoryId}/git/trees/${commit.rootTreeSha}`,
      false,
    ),
  );
  let rootTreeValue: unknown = null;
  let rootTree: CandidateAuthorityTreeResult = {
    state: 'qualified-unknown',
    reason: 'tree-truncated',
  };
  let rootTreeOutcome: RepositoryContext['rootTreeOutcome'] =
    'qualified-unknown';
  if (rootTreeCollected.kind === 'value') {
    rootTreeValue = rootTreeCollected.response.value;
    rootTree = await operation(candidate, 'github-root-tree', () =>
      Promise.resolve(
        parseCandidateAuthorityGitTree({
          value: rootTreeValue,
          expectedSha: commit.rootTreeSha,
          localSemanticEntryLimit: 10_000,
        }),
      ),
    );
    if (rootTree.state === 'established-value') {
      rootTreeOutcome = 'established-value';
      const rootSecurity = projectCandidateAuthorityLocalSecurityPolicy({
        root: rootTree,
        dotGithub: null,
        docs: null,
      });
      sources.push(
        source('github-root-tree', 'established-value', 'complete', {
          ...retainedRootTree(rootTree),
          ...(rootSecurity.state === 'known' &&
          rootSecurity.path === 'SECURITY.md'
            ? {
                securityPolicyPresent: true,
                securityPolicyPath: rootSecurity.path,
                securityPolicyBlobSha: rootSecurity.blobSha,
              }
            : {}),
        }),
      );
    } else {
      markQualified(state, 'github-root-tree', rootTree.reason);
      sources.push(unknownSource('github-root-tree', rootTree.reason));
    }
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
    rootTree,
    rootTreeOutcome,
  };
  await operation(candidate, 'github-maintenance-window', () =>
    collectMaintenance(candidate, context, input, state, sources),
  );
  await operation(candidate, 'github-license', () =>
    collectLicense(candidate, context, input, state, sources),
  );
  await collectSecurityPolicies(candidate, context, input, state, sources);
  await operation(candidate, 'github-release-window', () =>
    collectReleases(candidate, input, state, sources),
  );
  const npm = await operation(candidate, 'npm-selected-version-metadata', () =>
    collectNpm(candidate, input, state, sources),
  );
  await operation(candidate, 'github-advisories', () =>
    collectAdvisories(candidate, npm, input, state, sources),
  );
  await operation(candidate, 'github-compose-json-blob', () =>
    collectCompose(candidate, context, input, state, sources),
  );
  await operation(candidate, 'github-dockerfile-blob', () =>
    collectDockerfile(candidate, context, input, state, sources),
  );
  return createCandidateAuthoritySuccessorSourceCandidate({
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
  sources: CandidateAuthoritySuccessorSourceDatum[],
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
  sources: CandidateAuthoritySuccessorSourceDatum[],
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

async function collectSecurityPolicies(
  candidate: CatalogCandidate,
  context: RepositoryContext,
  input: Parameters<typeof collectCandidateAuthoritySourceAuthority>[0],
  state: CollectionState,
  sources: CandidateAuthoritySuccessorSourceDatum[],
): Promise<void> {
  const operations = [
    {
      operationId: 'github-security-dot-github-tree' as const,
      rootPath: '.github',
      policyPath: '.github/SECURITY.md' as const,
    },
    {
      operationId: 'github-security-docs-tree' as const,
      rootPath: 'docs',
      policyPath: 'docs/SECURITY.md' as const,
    },
  ];
  const rootTree = context.rootTree;
  if (rootTree.state !== 'established-value') {
    for (const item of operations) {
      markQualified(state, item.operationId, 'root-tree-unavailable');
      sources.push(unknownSource(item.operationId, 'root-tree-unavailable'));
    }
    return;
  }
  for (const item of operations) {
    await operation(candidate, item.operationId, async () => {
      const entry = treeEntry(rootTree.entries, item.rootPath);
      if (entry === null) {
        markAbsence(state, item.operationId);
        sources.push(
          source(item.operationId, 'established-absence', 'complete', null),
        );
        return;
      }
      if (entry.mode !== '040000' || entry.type !== 'tree') {
        markQualified(state, item.operationId, 'unsupported-structured-value');
        sources.push(
          unknownSource(item.operationId, 'unsupported-structured-value'),
        );
        return;
      }
      const collected = await optionalRequest(
        candidate,
        input,
        state,
        item.operationId,
        `/repositories/${context.repositoryId}/git/trees/${entry.sha}`,
        false,
      );
      if (collected.kind !== 'value') {
        sources.push(
          unknownSource(item.operationId, optionalFailureCode(collected)),
        );
        return;
      }
      const subtree = parseCandidateAuthorityGitTree({
        value: collected.response.value,
        expectedSha: entry.sha,
        localSemanticEntryLimit: 10_000,
      });
      if (subtree.state === 'qualified-unknown') {
        markQualified(state, item.operationId, subtree.reason);
        sources.push(unknownSource(item.operationId, subtree.reason));
        return;
      }
      const policy = projectCandidateAuthorityLocalSecurityPolicy({
        root: {
          state: 'established-value',
          sha: rootTree.sha,
          entries: [],
        },
        dotGithub:
          item.operationId === 'github-security-dot-github-tree'
            ? subtree
            : null,
        docs: item.operationId === 'github-security-docs-tree' ? subtree : null,
      });
      sources.push(
        source(item.operationId, 'established-value', 'complete', {
          sha: subtree.sha,
          entries: retainedSecurityTreeEntries(subtree),
          ...(policy.state === 'known'
            ? {
                securityPolicyPresent: true,
                securityPolicyPath: item.policyPath,
                securityPolicyBlobSha: policy.blobSha,
              }
            : {}),
        }),
      );
    });
  }
}

async function collectReleases(
  candidate: CatalogCandidate,
  input: Parameters<typeof collectCandidateAuthoritySourceAuthority>[0],
  state: CollectionState,
  sources: CandidateAuthoritySuccessorSourceDatum[],
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
  const parsed = parseCandidateAuthorityReleaseWindow(collected.response.value);
  const releases = parsed.releases.map((release) => ({
    ...release,
    draft: false as const,
  }));
  const complete =
    collected.response.value.length < 5 &&
    parsed.unsupportedPublishedReleaseCount === 0;
  if (parsed.unsupportedPublishedReleaseCount > 0) {
    markQualified(
      state,
      'github-release-window',
      'unsupported-structured-value',
    );
  }
  sources.push(
    source(
      'github-release-window',
      'established-value',
      complete ? 'complete' : 'partial',
      {
        complete,
        releases,
        ignoredDraftCount: parsed.ignoredDraftCount,
        unsupportedPublishedReleaseCount:
          parsed.unsupportedPublishedReleaseCount,
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

type CollectedNpm =
  | { readonly kind: 'catalog-unmapped' }
  | {
      readonly kind: 'mapped-source-established';
      readonly name: string;
      readonly version: string;
    }
  | { readonly kind: 'mapped-source-unresolved-or-absent' };

async function collectNpm(
  candidate: CatalogCandidate,
  input: Parameters<typeof collectCandidateAuthoritySourceAuthority>[0],
  state: CollectionState,
  sources: CandidateAuthoritySuccessorSourceDatum[],
): Promise<CollectedNpm> {
  if (candidate.npmPackage === null) {
    sources.push(
      source(
        'npm-selected-version-metadata',
        'not-applicable',
        'not-applicable',
        null,
      ),
    );
    return { kind: 'catalog-unmapped' };
  }
  const collected = await optionalRequest(
    candidate,
    input,
    state,
    'npm-selected-version-metadata',
    `/${segment(candidate.npmPackage)}/latest`,
    false,
  );
  if (collected.kind !== 'value') {
    sources.push(
      unknownSource(
        'npm-selected-version-metadata',
        optionalFailureCode(collected),
      ),
    );
    return { kind: 'mapped-source-unresolved-or-absent' };
  }
  const response = collected.response;
  const root = requireRecord(response.value);
  const name = safeString(root['name'], 214);
  if (name !== candidate.npmPackage) identity();
  const version = safeString(root['version'], 100);
  if (!semver(version)) invalidProvider();
  if (root['_id'] !== undefined && root['_id'] !== `${name}@${version}`)
    identity();
  const nodeEngineProperty = parseOptionalNodeEngine(root['engines']);
  const mainProperty = parseCandidateAuthorityOptionalString(root['main'], 512);
  const moduleProperty = parseCandidateAuthorityOptionalString(
    root['module'],
    512,
  );
  const typeProperty = parseCandidateAuthorityOptionalString(root['type'], 40);
  const peerDependenciesProperty = parseCandidateAuthorityOptionalStringRecord(
    root['peerDependencies'],
    200,
  );
  const exportsProperty = parseOptionalExports(root['exports']);
  const repositoryProperty = parseOptionalNpmRepository(root['repository']);
  const nodeEngine = supportedOptionalValue(nodeEngineProperty);
  const main = supportedOptionalValue(mainProperty);
  const module = supportedOptionalValue(moduleProperty);
  const type = supportedOptionalValue(typeProperty);
  const peerDependencies = supportedOptionalValue(peerDependenciesProperty);
  const exportsValue = supportedOptionalValue(exportsProperty);
  const repositoryIdentity = supportedOptionalValue(repositoryProperty);
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
    ...facts(
      extractRegistryResolvedPackageVersionFact({
        catalogPackageName: candidate.npmPackage,
        sourcePackageName: name,
        resolvedVersion: version,
        selector: 'latest',
        sourceComplete: true,
      }),
    ),
  ];
  sources.push(
    source('npm-selected-version-metadata', 'established-value', 'complete', {
      packageName: name,
      resolvedVersion: version,
      selector: 'latest',
      repositoryIdentity,
      nodeEngine,
      exportsValue,
      exportsDeclared: exportsProperty.state !== 'absent',
      main,
      module,
      peerDependencies,
      type,
      optionalPropertyStates: {
        nodeEngine: nodeEngineProperty.state,
        exports: exportsProperty.state,
        main: mainProperty.state,
        module: moduleProperty.state,
        peerDependencies: peerDependenciesProperty.state,
        type: typeProperty.state,
        repository: repositoryProperty.state,
      },
      partialFacts,
    }),
  );
  return { kind: 'mapped-source-established', name, version };
}

async function collectAdvisories(
  candidate: CatalogCandidate,
  npm: CollectedNpm,
  input: Parameters<typeof collectCandidateAuthoritySourceAuthority>[0],
  state: CollectionState,
  sources: CandidateAuthoritySuccessorSourceDatum[],
): Promise<void> {
  if (npm.kind === 'catalog-unmapped') {
    sources.push(
      source('github-advisories', 'not-applicable', 'not-applicable', null),
    );
    return;
  }
  if (npm.kind === 'mapped-source-unresolved-or-absent') {
    markQualified(state, 'github-advisories', 'npm-version-scope-unavailable');
    sources.push(
      unknownSource('github-advisories', 'npm-version-scope-unavailable'),
    );
    return;
  }
  const advisories: {
    advisoryId: string;
    providerSeverity: 'critical' | 'high' | 'low' | 'medium' | 'unknown';
    normalizedSeverity: 'critical' | 'high' | 'low' | 'moderate' | null;
  }[] = [];
  let complete = false;
  let withdrawnExcludedCount = 0;
  let unsupportedSeverityCount = 0;
  for (let page = 1; page <= 2; page += 1) {
    const params = new URLSearchParams({
      type: 'reviewed',
      is_withdrawn: 'false',
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
    for (const value of collected.response.value) {
      const parsed = parseCandidateAuthorityAdvisory(value);
      if (parsed.kind === 'withdrawn') {
        withdrawnExcludedCount += 1;
      } else if (parsed.kind === 'unsupported') {
        unsupportedSeverityCount += 1;
      } else {
        advisories.push(parsed.advisory);
      }
    }
    if (collected.response.value.length < 100) {
      complete = true;
      break;
    }
  }
  if (unsupportedSeverityCount > 0) {
    complete = false;
    markQualified(state, 'github-advisories', 'unsupported-structured-value');
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
        withdrawnExcludedCount,
        unsupportedSeverityCount,
        partialFacts: facts(
          extractApplicableSecurityAdvisoryFacts({
            expectedPackageName: npm.name,
            expectedPackageVersion: npm.version,
            sourcePackageName: npm.name,
            sourcePackageVersion: npm.version,
            outcome: 'established-value',
            advisories: advisories.map((advisory) => ({
              advisoryId: advisory.advisoryId,
              severity: advisory.normalizedSeverity,
            })),
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
  sources: CandidateAuthoritySuccessorSourceDatum[],
): Promise<void> {
  if (context.rootTreeOutcome !== 'established-value') {
    sources.push(
      unknownSource('github-compose-json-blob', 'root-tree-unavailable'),
    );
    return;
  }
  if (context.rootTree.state !== 'established-value') invalid();
  const entry = treeEntry(context.rootTree.entries, 'compose.json');
  if (entry === null) {
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
  if (!isNormalBlob(entry)) {
    markQualified(
      state,
      'github-compose-json-blob',
      'unsupported-structured-value',
    );
    sources.push(
      unknownSource('github-compose-json-blob', 'unsupported-structured-value'),
    );
    return;
  }
  const blobCollected = await optionalRequest(
    candidate,
    input,
    state,
    'github-compose-json-blob',
    `/repositories/${context.repositoryId}/git/blobs/${entry.sha}`,
    false,
  );
  if (blobCollected.kind !== 'value') {
    sources.push(
      unknownSource(
        'github-compose-json-blob',
        optionalFailureCode(blobCollected),
      ),
    );
    return;
  }
  const verified = parseCandidateAuthorityOptionalGitBlob({
    value: blobCollected.response.value,
    expectedEntry: entry,
    semanticMaximumBytes: 262_144,
  });
  if (verified.state === 'qualified-unknown') {
    markQualified(state, 'github-compose-json-blob', verified.reason);
    sources.push(unknownSource('github-compose-json-blob', verified.reason));
    return;
  }
  const content = verified.content;
  const factsValue = facts(
    extractRepositorySelfBuildComposeServiceFacts({
      content,
      pathOutcome: 'established-value',
      contentTreeBlobIdentityVerified: true,
    }),
  );
  if (factsValue.length === 0) {
    markQualified(
      state,
      'github-compose-json-blob',
      'unsupported-optional-content',
    );
    sources.push(
      unknownSource('github-compose-json-blob', 'unsupported-optional-content'),
    );
    return;
  }
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
  sources: CandidateAuthoritySuccessorSourceDatum[],
): Promise<void> {
  if (context.rootTreeOutcome !== 'established-value') {
    sources.push(
      unknownSource('github-dockerfile-blob', 'root-tree-unavailable'),
    );
    return;
  }
  if (context.rootTree.state !== 'established-value') invalid();
  const entry = treeEntry(context.rootTree.entries, 'Dockerfile');
  if (entry === null) {
    sources.push(
      source('github-dockerfile-blob', 'established-absence', 'complete', null),
    );
    markAbsence(state, 'github-dockerfile-blob');
    return;
  }
  if (!isNormalBlob(entry)) {
    markQualified(
      state,
      'github-dockerfile-blob',
      'unsupported-structured-value',
    );
    sources.push(
      unknownSource('github-dockerfile-blob', 'unsupported-structured-value'),
    );
    return;
  }
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
  const verified = parseCandidateAuthorityOptionalGitBlob({
    value: collected.response.value,
    expectedEntry: entry,
    semanticMaximumBytes: 262_144,
  });
  if (verified.state === 'qualified-unknown') {
    markQualified(state, 'github-dockerfile-blob', verified.reason);
    sources.push(unknownSource('github-dockerfile-blob', verified.reason));
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
  if (partialFacts.length === 0) {
    markQualified(
      state,
      'github-dockerfile-blob',
      'unsupported-optional-content',
    );
    sources.push(
      unknownSource('github-dockerfile-blob', 'unsupported-optional-content'),
    );
    return;
  }
  const blob = requireRecord(collected.response.value);
  const content = verified.content;
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
  operationId: CandidateAuthoritySuccessorOperationId,
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
  operationId: CandidateAuthoritySuccessorOperationId,
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
        error.code === 'ingestion.provider-not-found' ||
        (operationId === 'npm-selected-version-metadata' &&
          error.code === 'ingestion.body-too-large'))
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
  operationId: CandidateAuthoritySuccessorOperationId,
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
  input.observeLogicalRequest?.(provider, operationId);
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

function retainedRootTree(
  value: Extract<
    CandidateAuthorityTreeResult,
    { readonly state: 'established-value' }
  >,
) {
  return {
    sha: value.sha,
    entries: [
      'compose.json',
      'Dockerfile',
      'SECURITY.md',
      '.github',
      'docs',
    ].flatMap((path) => {
      const entry = treeEntry(value.entries, path);
      return entry === null ? [] : [entry];
    }),
  };
}

function retainedSecurityTreeEntries(
  value: Extract<
    CandidateAuthorityTreeResult,
    { readonly state: 'established-value' }
  >,
): readonly CandidateAuthorityTreeEntry[] {
  const entry = treeEntry(value.entries, 'SECURITY.md');
  return entry === null ? [] : [entry];
}

function treeEntry(
  entries: readonly CandidateAuthorityTreeEntry[],
  path: string,
): CandidateAuthorityTreeEntry | null {
  const matches = entries.filter((item) => item.path === path);
  if (matches.length > 1) invalidProvider();
  if (matches.length === 0) return null;
  return matches[0] ?? null;
}

function isNormalBlob(entry: CandidateAuthorityTreeEntry): boolean {
  return (
    (entry.mode === '100644' || entry.mode === '100755') &&
    entry.type === 'blob'
  );
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

function parseOptionalNodeEngine(
  value: unknown,
): CandidateAuthorityOptionalProperty<string> {
  if (value === undefined) return { state: 'absent', value: null };
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { state: 'unsupported', value: null };
  }
  return parseCandidateAuthorityOptionalString(
    (value as Record<string, unknown>)['node'],
    100,
  );
}

function parseOptionalExports(
  value: unknown,
): CandidateAuthorityOptionalProperty<unknown> {
  if (value === undefined) return { state: 'absent', value: null };
  if (
    value === null ||
    (typeof value !== 'string' &&
      (typeof value !== 'object' || Array.isArray(value)))
  ) {
    return { state: 'unsupported', value: null };
  }
  return { state: 'supported', value };
}

function parseOptionalNpmRepository(
  value: unknown,
): CandidateAuthorityOptionalProperty<{
  readonly owner: string;
  readonly repository: string;
}> {
  if (value === undefined) return { state: 'absent', value: null };
  try {
    const parsed = parseNpmRepository(value);
    return parsed === null
      ? { state: 'unsupported', value: null }
      : { state: 'supported', value: parsed };
  } catch {
    return { state: 'unsupported', value: null };
  }
}

function supportedOptionalValue<T>(
  value: CandidateAuthorityOptionalProperty<T>,
): T | null {
  return value.state === 'supported' ? value.value : null;
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

function source(
  operationId: CandidateAuthoritySuccessorOperationId,
  outcome: CandidateAuthoritySuccessorSourceDatum['outcome'],
  completeness: CandidateAuthoritySuccessorSourceDatum['completeness'],
  value: unknown,
  limitationCode: string | null = null,
): CandidateAuthoritySuccessorSourceDatum {
  return { operationId, outcome, completeness, limitationCode, value };
}

class CandidateAuthorityOperationFailure extends IngestionError {
  public readonly operationId: CandidateAuthoritySuccessorOperationId;

  public constructor(
    operationId: CandidateAuthoritySuccessorOperationId,
    error: unknown,
  ) {
    super(asSafeErrorCode(error));
    this.name = 'CandidateAuthorityOperationFailure';
    this.operationId = operationId;
  }
}

async function operation<T>(
  _candidate: CatalogCandidate,
  operationId: CandidateAuthoritySuccessorOperationId,
  execute: () => Promise<T>,
): Promise<T> {
  try {
    return await execute();
  } catch (error) {
    if (error instanceof CandidateAuthorityOperationFailure) throw error;
    throw new CandidateAuthorityOperationFailure(operationId, error);
  }
}

function fatalCounters(
  state: CollectionState,
  attempts: CandidateAuthorityAttemptMetrics,
): CandidateAuthorityFatalCounters {
  return {
    githubLogicalRequests: state.githubLogicalRequests,
    npmLogicalRequests: state.npmLogicalRequests,
    githubAttempts: attempts.githubAttempts,
    npmAttempts: attempts.npmAttempts,
    retries: attempts.retries,
    perOperation: Object.fromEntries(
      CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS.map((operationId) => [
        operationId,
        {
          logicalRequests: requireCounter(state, operationId).logicalRequests,
          attempts: attempts.perOperationAttempts[operationId] ?? 0,
        },
      ]),
    ),
  };
}

function unknownSource(
  operationId: CandidateAuthoritySuccessorOperationId,
  code: string,
) {
  return source(operationId, 'qualified-unknown', 'partial', null, code);
}

function facts(result: ReturnType<typeof extractPublishedReleaseFacts>) {
  return result.state === 'established-facts' ? [...result.facts] : [];
}

function requireCounter(
  state: CollectionState,
  operationId: CandidateAuthoritySuccessorOperationId,
): OperationCounter {
  const value = state.counters.get(operationId);
  if (value === undefined) invalid();
  return value;
}

function markAbsence(
  state: CollectionState,
  operationId: CandidateAuthoritySuccessorOperationId,
): void {
  requireCounter(state, operationId).establishedAbsences += 1;
}

function markQualified(
  state: CollectionState,
  operationId: CandidateAuthoritySuccessorOperationId,
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
