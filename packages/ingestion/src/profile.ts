import {
  CONTRACT_VERSION,
  parseCandidateDossierV1,
  type CandidateDossierV1,
  type EvidenceObservationV1,
} from '@gitblocks/contracts';
import type {
  CandidateLimitationV1,
  CandidateUnknownV1,
} from '@gitblocks/persistence';

import { StableIdRegistry } from './canonical-json.ts';
import { ingestionError } from './errors.ts';
import type {
  CandidateSourceBundle,
  CapabilityFamily,
  ProfileResult,
} from './types.ts';

const RULES_VERSION = 'public-profile-rules/1.0.0';

export function profileCandidate(
  bundle: CandidateSourceBundle,
  priorObservations: readonly EvidenceObservationV1[] = [],
): ProfileResult {
  const ids = new StableIdRegistry();
  const identity = {
    candidateId: bundle.candidate.candidateId,
    displayName: bundle.candidate.displayName,
    repository: {
      host: 'github' as const,
      owner: bundle.repository.canonicalOwner,
      name: bundle.repository.canonicalRepository,
    },
    package:
      bundle.npm === null
        ? null
        : { registry: 'npm' as const, name: bundle.npm.name },
  };
  const priorById = new Map(
    priorObservations.map((observation) => [
      observation.evidenceId,
      observation,
    ]),
  );
  const observations: EvidenceObservationV1[] = [];
  const repositoryMoved = repositoryIdentityChanged(bundle);
  const add = (
    logicalIdentity: unknown,
    observation: Omit<EvidenceObservationV1, 'evidenceId'>,
  ): EvidenceObservationV1 => {
    const evidenceId = ids.create('ev', {
      rulesVersion: RULES_VERSION,
      candidateId: identity.candidateId,
      logicalIdentity,
      observation: observation.observation,
      source: evidenceSourceIdentity(observation.source),
    });
    const existing = priorById.get(evidenceId);
    const result = existing ?? { ...observation, evidenceId };
    observations.push(result);
    return result;
  };

  add(
    {
      topic: 'repository-identity',
      owner: identity.repository.owner,
      repository: identity.repository.name,
    },
    {
      kind: 'evidence',
      candidateId: identity.candidateId,
      topic: 'repository-identity',
      dimension: 'identity',
      observation: repositoryMoved
        ? `GitHub reports that catalog identity ${bundle.candidate.github.owner}/${bundle.candidate.github.repository} now resolves to ${identity.repository.owner}/${identity.repository.name}.`
        : `GitHub identifies the public repository as ${identity.repository.owner}/${identity.repository.name}.`,
      source: {
        kind: 'mutable-documentation',
        sourceType: 'official-documentation',
        sourceUrl: bundle.repository.htmlUrl,
        limitationCode: 'source-is-mutable',
        collectedAt: bundle.collectedAt,
      },
      freshness: {
        status: 'current',
        asOf: bundle.collectedAt,
        scope: 'GitHub repository identity at collection time.',
      },
      directness: 'direct',
      limitation: 'Repository metadata is mutable provider documentation.',
    },
  );

  add(
    {
      topic: 'repository-head',
      sha: bundle.commit.sha,
    },
    {
      kind: 'evidence',
      candidateId: identity.candidateId,
      topic: 'repository-head',
      dimension: 'maintenance',
      observation: `The default branch ${bundle.repository.defaultBranch} resolved to commit ${bundle.commit.sha}.`,
      source: commitSource(bundle),
      freshness: {
        status: 'current',
        asOf: bundle.collectedAt,
        scope: 'Default-branch head at collection time.',
      },
      directness: 'direct',
      limitation: null,
    },
  );

  add(
    {
      topic: 'repository-state',
      archived: bundle.repository.isArchived,
      fork: bundle.repository.isFork,
    },
    {
      kind: 'evidence',
      candidateId: identity.candidateId,
      topic: 'repository-state',
      dimension: 'maintenance',
      observation: `GitHub reports archived=${String(
        bundle.repository.isArchived,
      )} and fork=${String(bundle.repository.isFork)}.`,
      source: {
        kind: 'mutable-documentation',
        sourceType: 'official-documentation',
        sourceUrl: bundle.repository.htmlUrl,
        limitationCode: 'source-is-mutable',
        collectedAt: bundle.collectedAt,
      },
      freshness: {
        status: 'current',
        asOf: bundle.collectedAt,
        scope: 'Repository lifecycle flags at collection time.',
      },
      directness: 'direct',
      limitation: 'Repository lifecycle flags can change after collection.',
    },
  );

  const currentRelease = bundle.releases.find((release) => !release.isDraft);
  if (currentRelease !== undefined) {
    add(
      { topic: 'release-current', tag: currentRelease.tag },
      {
        kind: 'evidence',
        candidateId: identity.candidateId,
        topic: 'release-current',
        dimension: 'version-release',
        observation: `GitHub lists release ${currentRelease.tag} with prerelease=${String(
          currentRelease.isPrerelease,
        )}.`,
        source: {
          kind: 'release',
          sourceType: 'official-release',
          sourceUrl: currentRelease.htmlUrl,
          release: currentRelease.tag,
          immutableUrl: currentRelease.htmlUrl,
          publishedAt: currentRelease.publishedAt,
          collectedAt: bundle.collectedAt,
        },
        freshness: {
          status: 'current',
          asOf: bundle.collectedAt,
          scope: 'First non-draft release returned by GitHub.',
        },
        directness: 'direct',
        limitation: null,
      },
    );
  }

  if (bundle.license?.spdxId !== null && bundle.license !== null) {
    add(
      { topic: 'license-declared', spdxId: bundle.license.spdxId },
      {
        kind: 'evidence',
        candidateId: identity.candidateId,
        topic: 'license-declared',
        dimension: 'license',
        observation: `GitHub identifies the repository license as ${bundle.license.spdxId}.`,
        source: {
          ...commitSource(bundle),
          sourceType: 'license',
          sourceUrl: bundle.license.htmlUrl ?? bundle.repository.htmlUrl,
        },
        freshness: {
          status: 'current',
          asOf: bundle.collectedAt,
          scope: 'License metadata associated with the exact head commit.',
        },
        directness: 'direct',
        limitation: 'This records declared SPDX identity, not legal advice.',
      },
    );
  }

  if (bundle.community !== null) {
    add(
      {
        topic: 'security-policy',
        present: bundle.community.hasSecurityPolicy,
      },
      {
        kind: 'evidence',
        candidateId: identity.candidateId,
        topic: 'security-policy',
        dimension: 'security',
        observation: `GitHub community metadata reports security-policy presence=${String(
          bundle.community.hasSecurityPolicy,
        )}.`,
        source: {
          kind: 'mutable-documentation',
          sourceType: 'official-documentation',
          sourceUrl: `${bundle.repository.htmlUrl}/community`,
          limitationCode: 'source-is-mutable',
          collectedAt: bundle.collectedAt,
        },
        freshness: {
          status: 'current',
          asOf: bundle.collectedAt,
          scope: 'GitHub community profile at collection time.',
        },
        directness: 'direct',
        limitation:
          'Policy presence does not establish vulnerability handling quality.',
      },
    );
  }

  for (const file of bundle.files) {
    add(
      { topic: fileTopic(file.path), sha: file.sha },
      {
        kind: 'evidence',
        candidateId: identity.candidateId,
        topic: fileTopic(file.path),
        dimension:
          file.path.toLowerCase() === 'security.md'
            ? 'security'
            : 'repository-package',
        observation: `The allowlisted file ${file.path} exists at exact commit ${bundle.commit.sha}.`,
        source: {
          ...commitSource(bundle),
          sourceType: 'official-repository',
          sourceUrl: file.htmlUrl,
          immutableUrl: immutableBlobUrl(bundle, file.path),
        },
        freshness: {
          status: 'current',
          asOf: bundle.collectedAt,
          scope: 'Allowlisted file presence at the exact head commit.',
        },
        directness: 'direct',
        limitation:
          'File content is bounded untrusted data and is not executed or interpreted semantically.',
      },
    );
  }

  let npmVersionEvidenceId: string | null = null;
  if (bundle.npm !== null) {
    const npmVersion = add(
      {
        topic: 'npm-latest-version',
        name: bundle.npm.name,
        version: bundle.npm.latestVersion,
      },
      {
        kind: 'evidence',
        candidateId: identity.candidateId,
        topic: 'npm-latest-version',
        dimension: 'version-release',
        observation: `npm dist-tag latest resolves ${bundle.npm.name} to ${bundle.npm.latestVersion}.`,
        source: packageSource(bundle),
        freshness: {
          status: 'current',
          asOf: bundle.collectedAt,
          scope: 'npm latest dist-tag at collection time.',
        },
        directness: 'direct',
        limitation:
          'npm publisher-provided metadata is not independently verified.',
      },
    );
    npmVersionEvidenceId = npmVersion.evidenceId;
    const linkage = packageRepositoryLinkage(bundle);
    add(
      {
        topic: 'repository-package-linkage',
        version: bundle.npm.latestVersion,
        linkage,
      },
      {
        kind: 'evidence',
        candidateId: identity.candidateId,
        topic: 'repository-package-linkage',
        dimension: 'repository-package',
        observation:
          linkage === 'matched'
            ? 'The selected npm version links to the catalog GitHub repository.'
            : linkage === 'mismatched'
              ? 'The selected npm version links to a different GitHub repository.'
              : 'The selected npm version does not declare a supported GitHub repository link.',
        source: packageSource(bundle),
        freshness: {
          status: 'current',
          asOf: bundle.collectedAt,
          scope: `Repository declaration for npm version ${bundle.npm.latestVersion}.`,
        },
        directness: 'direct',
        limitation:
          'npm repository linkage is publisher-provided package metadata.',
      },
    );
    add(
      {
        topic: 'npm-runtime-shape',
        version: bundle.npm.latestVersion,
        engine: bundle.npm.nodeEngine,
        type: bundle.npm.moduleType,
        exports: bundle.npm.exportShape,
      },
      {
        kind: 'evidence',
        candidateId: identity.candidateId,
        topic: 'npm-runtime-shape',
        dimension: 'runtime-framework',
        observation: `npm metadata declares node-engine=${
          bundle.npm.nodeEngine ?? 'unspecified'
        }, module-type=${
          bundle.npm.moduleType ?? 'unspecified'
        }, and exports=${bundle.npm.exportShape}.`,
        source: packageSource(bundle),
        freshness: {
          status: 'current',
          asOf: bundle.collectedAt,
          scope: `Selected npm version ${bundle.npm.latestVersion}.`,
        },
        directness: 'direct',
        limitation:
          'Declarations describe package metadata and do not prove runtime compatibility.',
      },
    );
  }

  for (const advisory of bundle.advisories.advisories) {
    add(
      {
        topic: `security-advisory-${advisory.advisoryId}`,
        updatedAt: advisory.updatedAt,
        withdrawnAt: advisory.withdrawnAt,
      },
      {
        kind: 'evidence',
        candidateId: identity.candidateId,
        topic: `security-advisory-${advisory.advisoryId}`,
        dimension: 'security',
        observation: `GitHub reviewed advisory ${advisory.advisoryId} reports severity ${advisory.severity} for the selected npm version.`,
        source: {
          kind: 'security-advisory',
          sourceType: 'security-advisory',
          sourceUrl: advisory.htmlUrl,
          advisoryId: advisory.advisoryId,
          immutableUrl: `https://github.com/advisories/${advisory.advisoryId}`,
          publishedAt: advisory.publishedAt,
          collectedAt: bundle.collectedAt,
        },
        freshness: {
          status: advisory.withdrawnAt === null ? 'current' : 'stale',
          asOf: bundle.collectedAt,
          scope: 'GitHub reviewed advisory state for the exact npm version.',
        },
        directness: 'direct',
        limitation: 'Advisory databases can be incomplete or updated later.',
      },
    );
  }

  const limitations = buildLimitations(bundle, observations, ids);
  const unknowns = buildUnknowns(bundle, npmVersionEvidenceId, ids);
  const sortedObservations = [...observations].sort((left, right) =>
    left.evidenceId.localeCompare(right.evidenceId),
  );
  const evidenceCutoff = maximumEvidenceTimestamp(
    sortedObservations,
    bundle.collectedAt,
  );
  const dossier: CandidateDossierV1 = {
    contractVersion: CONTRACT_VERSION,
    identity,
    capabilityFamily: bundle.candidate.primaryCapabilityFamily,
    versionScope:
      bundle.npm?.latestVersion ?? currentRelease?.tag ?? bundle.commit.sha,
    observations: sortedObservations,
    limitations,
    unknowns,
  };
  const parsed = parseCandidateDossierV1(dossier);
  if (!parsed.ok) {
    throw ingestionError('ingestion.invalid-input');
  }
  const snapshotId = ids.create('snap', {
    rulesVersion: RULES_VERSION,
    dossier,
    evidenceCutoff,
  });
  const authoritativeTopics = [
    'repository-head',
    'repository-identity',
    'repository-state',
    ...(bundle.incompleteSourceCodes.includes('github-releases-unavailable')
      ? []
      : ['release-current']),
    ...(bundle.incompleteSourceCodes.includes('github-license-unavailable')
      ? []
      : ['license-declared']),
    ...(bundle.incompleteSourceCodes.includes('github-community-unavailable')
      ? []
      : ['security-policy']),
    ...(bundle.npm === null ? [] : ['npm-latest-version', 'npm-runtime-shape']),
    ...(bundle.advisories.complete ? ['security-advisory-*'] : []),
    ...bundle.files.map((file) => fileTopic(file.path)),
  ].sort();
  return {
    identity,
    capabilityFamilies: uniqueFamilies(bundle),
    dossier: parsed.value,
    observations: sortedObservations,
    limitations,
    unknowns,
    evidenceCutoff,
    snapshotId,
    authoritativeTopics,
  };
}

function commitSource(
  bundle: CandidateSourceBundle,
): Extract<EvidenceObservationV1['source'], { readonly kind: 'git-commit' }> {
  return {
    kind: 'git-commit',
    sourceType: 'official-repository',
    sourceUrl: bundle.repository.htmlUrl,
    commitSha: bundle.commit.sha,
    immutableUrl: bundle.commit.htmlUrl,
    publishedAt: bundle.commit.committedAt,
    collectedAt: bundle.collectedAt,
  };
}

function packageSource(
  bundle: CandidateSourceBundle,
): Extract<
  EvidenceObservationV1['source'],
  { readonly kind: 'package-version' }
> {
  if (bundle.npm === null) {
    throw ingestionError('ingestion.invalid-input');
  }
  return {
    kind: 'package-version',
    sourceType: 'package-registry',
    sourceUrl: `https://registry.npmjs.org/${encodeURIComponent(
      bundle.npm.name,
    )}`,
    packageVersion: bundle.npm.latestVersion,
    immutableUrl: bundle.npm.registryUrl,
    publishedAt: bundle.npm.publishedAt,
    collectedAt: bundle.collectedAt,
  };
}

function immutableBlobUrl(bundle: CandidateSourceBundle, path: string): string {
  return `https://github.com/${encodeURIComponent(
    bundle.repository.canonicalOwner,
  )}/${encodeURIComponent(
    bundle.repository.canonicalRepository,
  )}/blob/${bundle.commit.sha}/${path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`;
}

function buildLimitations(
  bundle: CandidateSourceBundle,
  observations: readonly EvidenceObservationV1[],
  ids: StableIdRegistry,
): CandidateLimitationV1[] {
  const result: CandidateLimitationV1[] = [];
  const add = (
    limitationCode: string,
    statement: string,
    evidenceIds: readonly string[],
  ): void => {
    result.push({
      limitationId: ids.create('lim', {
        rulesVersion: RULES_VERSION,
        candidateId: bundle.candidate.candidateId,
        limitationCode,
        statement,
        evidenceIds,
      }),
      limitationCode,
      candidateId: bundle.candidate.candidateId,
      statement,
      evidenceIds: [...evidenceIds],
    });
  };
  const stateEvidence = observations.find(
    (observation) => observation.topic === 'repository-state',
  );
  if (bundle.repository.isArchived) {
    add(
      'repository-archived',
      'GitHub marks this repository as archived.',
      stateEvidence === undefined ? [] : [stateEvidence.evidenceId],
    );
  }
  if (bundle.repository.isFork) {
    add(
      'repository-is-fork',
      'GitHub marks this repository as a fork; upstream identity is not profiled.',
      stateEvidence === undefined ? [] : [stateEvidence.evidenceId],
    );
  }
  if (bundle.candidate.status === 'moved') {
    const evidence = observations.find(
      (observation) => observation.topic === 'repository-identity',
    );
    add(
      'repository-moved',
      repositoryIdentityChanged(bundle)
        ? `GitHub resolves the catalog repository ${bundle.candidate.github.owner}/${bundle.candidate.github.repository} to canonical identity ${bundle.repository.canonicalOwner}/${bundle.repository.canonicalRepository}.`
        : 'The curated catalog retains this candidate as a moved-repository control.',
      evidence === undefined ? [] : [evidence.evidenceId],
    );
  }
  if (bundle.candidate.status === 'negative-control') {
    add(
      'catalog-negative-control',
      'The curated catalog includes this candidate as an explicit negative control.',
      [],
    );
  }
  if (bundle.community?.hasSecurityPolicy === false) {
    const evidence = observations.find(
      (observation) => observation.topic === 'security-policy',
    );
    add(
      'security-policy-not-reported',
      'GitHub community metadata does not report a security policy.',
      evidence === undefined ? [] : [evidence.evidenceId],
    );
  }
  if (bundle.npm?.deprecated === true) {
    const npmEvidence = observations.find(
      (observation) => observation.topic === 'npm-latest-version',
    );
    add(
      'npm-version-deprecated',
      'npm marks the selected latest package version as deprecated.',
      npmEvidence === undefined ? [] : [npmEvidence.evidenceId],
    );
  }
  const linkage = packageRepositoryLinkage(bundle);
  if (linkage === 'mismatched') {
    const evidence = observations.find(
      (observation) => observation.topic === 'repository-package-linkage',
    );
    add(
      'package-repository-mismatch',
      'The selected npm version declares a different GitHub repository than the catalog identity.',
      evidence === undefined ? [] : [evidence.evidenceId],
    );
  }
  for (const advisory of bundle.advisories.advisories) {
    const evidence = observations.find(
      (observation) =>
        observation.topic === `security-advisory-${advisory.advisoryId}`,
    );
    add(
      'known-applicable-advisory',
      `GitHub reports reviewed advisory ${advisory.advisoryId} for the selected npm version.`,
      evidence === undefined ? [] : [evidence.evidenceId],
    );
  }
  for (const code of bundle.incompleteSourceCodes) {
    add(
      code,
      `Source collection is partial because ${code.replaceAll('-', ' ')}.`,
      [],
    );
  }
  if (!bundle.advisories.complete) {
    add(
      bundle.advisories.limitationCode ?? 'advisory-coverage-partial',
      'Security advisory coverage is partial for the selected package version.',
      [],
    );
  }
  return result.sort((left, right) =>
    left.limitationId.localeCompare(right.limitationId),
  );
}

function buildUnknowns(
  bundle: CandidateSourceBundle,
  npmVersionEvidenceId: string | null,
  ids: StableIdRegistry,
): CandidateUnknownV1[] {
  const unknowns: CandidateUnknownV1[] = [];
  const add = (
    topic: string,
    statement: string,
    evidenceIds: readonly string[],
  ): void => {
    unknowns.push({
      scope: 'candidate',
      unknownId: ids.create('unk', {
        rulesVersion: RULES_VERSION,
        candidateId: bundle.candidate.candidateId,
        topic,
        statement,
        evidenceIds,
      }),
      candidateId: bundle.candidate.candidateId,
      topic,
      statement,
      evidenceIds: [...evidenceIds],
    });
  };
  if (bundle.npm === null) {
    add(
      'package-version-unknown',
      'No approved npm package version is mapped for this repository.',
      [],
    );
  }
  if (
    bundle.npm !== null &&
    packageRepositoryLinkage(bundle) === 'undeclared'
  ) {
    add(
      'package-repository-linkage-unknown',
      'The selected npm version does not establish a supported GitHub repository link.',
      npmVersionEvidenceId === null ? [] : [npmVersionEvidenceId],
    );
  }
  if (bundle.license?.spdxId === null || bundle.license === null) {
    add(
      'license-identity-unknown',
      'The approved repository source did not establish a recognized SPDX license identity.',
      [],
    );
  }
  if (bundle.npm !== null && bundle.npm.nodeEngine === null) {
    add(
      'node-runtime-unknown',
      'The selected npm version does not declare a Node engine range.',
      npmVersionEvidenceId === null ? [] : [npmVersionEvidenceId],
    );
  }
  if (
    bundle.releases.every((release) => release.isDraft) &&
    !bundle.incompleteSourceCodes.includes('github-releases-unavailable')
  ) {
    add(
      'release-state-unknown',
      'The bounded GitHub release query returned no non-draft selected release.',
      [],
    );
  }
  add(
    'advisory-coverage-unknown',
    bundle.advisories.complete
      ? 'A complete bounded query returned the recorded reviewed advisories, but absence of another advisory is not proven.'
      : 'The bounded advisory query was incomplete, so advisory absence is unknown.',
    npmVersionEvidenceId === null ? [] : [npmVersionEvidenceId],
  );
  add(
    'capability-fit-unknown',
    'Catalog membership does not establish compatibility with any particular repository request.',
    [],
  );
  return unknowns.sort((left, right) =>
    left.unknownId.localeCompare(right.unknownId),
  );
}

function maximumEvidenceTimestamp(
  observations: readonly EvidenceObservationV1[],
  fallback: string,
): string {
  const timestamps = observations.flatMap((observation) => {
    const source = observation.source;
    return [
      observation.freshness.asOf,
      'collectedAt' in source ? source.collectedAt : null,
      'publishedAt' in source ? source.publishedAt : null,
      'validatedAt' in source ? source.validatedAt : null,
    ].filter((value): value is string => value !== null);
  });
  return (
    timestamps.sort((left, right) => Date.parse(right) - Date.parse(left))[0] ??
    fallback
  );
}

function uniqueFamilies(
  bundle: CandidateSourceBundle,
): readonly CapabilityFamily[] {
  return [
    bundle.candidate.primaryCapabilityFamily,
    ...bundle.candidate.additionalCapabilityFamilies,
  ].sort();
}

function fileTopic(path: string): string {
  return `repository-file-${path
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replaceAll(/^-|-$/gu, '')
    .slice(0, 40)}`;
}

function packageRepositoryLinkage(
  bundle: CandidateSourceBundle,
): 'matched' | 'mismatched' | 'undeclared' {
  if (bundle.npm?.repositoryUrl === null || bundle.npm === null) {
    return 'undeclared';
  }
  let actual: URL;
  try {
    actual = new URL(bundle.npm.repositoryUrl);
  } catch {
    return 'undeclared';
  }
  const actualPath = actual.pathname
    .replace(/\/+$/u, '')
    .replace(/\.git$/u, '')
    .toLowerCase();
  const expectedPath =
    `/${bundle.repository.canonicalOwner}/${bundle.repository.canonicalRepository}`.toLowerCase();
  return actual.hostname.toLowerCase() === 'github.com' &&
    actualPath === expectedPath
    ? 'matched'
    : 'mismatched';
}

function repositoryIdentityChanged(bundle: CandidateSourceBundle): boolean {
  return (
    bundle.repository.canonicalOwner.toLowerCase() !==
      bundle.candidate.github.owner.toLowerCase() ||
    bundle.repository.canonicalRepository.toLowerCase() !==
      bundle.candidate.github.repository.toLowerCase()
  );
}

function evidenceSourceIdentity(
  source: EvidenceObservationV1['source'],
): unknown {
  switch (source.kind) {
    case 'git-commit':
      return {
        kind: source.kind,
        sourceType: source.sourceType,
        sourceUrl: source.sourceUrl,
        commitSha: source.commitSha,
        immutableUrl: source.immutableUrl,
        publishedAt: source.publishedAt,
      };
    case 'tag':
      return {
        kind: source.kind,
        sourceType: source.sourceType,
        sourceUrl: source.sourceUrl,
        tag: source.tag,
        immutableUrl: source.immutableUrl,
        publishedAt: source.publishedAt,
      };
    case 'release':
      return {
        kind: source.kind,
        sourceUrl: source.sourceUrl,
        release: source.release,
        immutableUrl: source.immutableUrl,
        publishedAt: source.publishedAt,
      };
    case 'package-version':
      return {
        kind: source.kind,
        sourceUrl: source.sourceUrl,
        packageVersion: source.packageVersion,
        immutableUrl: source.immutableUrl,
        publishedAt: source.publishedAt,
      };
    case 'security-advisory':
      return {
        kind: source.kind,
        sourceUrl: source.sourceUrl,
        advisoryId: source.advisoryId,
        immutableUrl: source.immutableUrl,
        publishedAt: source.publishedAt,
      };
    case 'mutable-documentation':
      return {
        kind: source.kind,
        sourceUrl: source.sourceUrl,
        limitationCode: source.limitationCode,
      };
    case 'approved-validation':
      return source;
  }
}
