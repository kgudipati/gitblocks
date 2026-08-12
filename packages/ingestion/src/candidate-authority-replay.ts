import {
  CONTRACT_VERSION,
  DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION,
  DETERMINISTIC_CANDIDATE_PROFILE_VERSION,
  DETERMINISTIC_PROFILE_DENOMINATOR_VERSION,
  DETERMINISTIC_PROFILE_RULES_VERSION,
  createDeterministicCandidateProfileAuthorityV1,
  createDeterministicCandidateProfileV1,
  parseCandidateDossierV1,
  type CapabilityTaxonomyV1,
  type CandidateDossierV1,
  type DeterministicCandidateProfileInputV1,
  type DeterministicCandidateProfileV1,
  type DeterministicProfileFieldRecord,
} from '@gitblocks/contracts';

import { canonicalizeJson, stableId } from './canonical-json.ts';
import type { CandidateAuthorityDecisionFieldId } from './candidate-authority-contracts.ts';
import {
  projectCandidateAuthorityDossier,
  validateCandidateAuthorityCompleteEvidence,
  type CandidateAuthorityEvidenceBinding,
} from './candidate-authority-evidence.ts';
import {
  CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_VERSION,
  parseCandidateAuthoritySourceAuthority,
  type CandidateAuthoritySourceAuthorityV1,
  type CandidateAuthoritySourceCandidateV1,
  type CandidateAuthoritySourceDatum,
} from './candidate-authority-live-contracts.ts';
import {
  candidateAuthorityImmutableGitHubFileLocation,
  isCandidateAuthorityGitObjectSha,
  isSafeCandidateAuthorityRepositoryRelativePath,
} from './candidate-authority-license-provenance.ts';
import {
  createCandidateAuthorityPartialFieldEvidence,
  projectPartialFieldEvidenceToDossier,
  type CandidateAuthorityPartialFieldEvidence,
} from './candidate-authority-partial-evidence.ts';
import type { CandidateAuthorityPartialSemanticRegistry } from './candidate-authority-partial-semantics.ts';
import {
  projectCandidateAuthorityAdvisoryState,
  projectCandidateAuthorityMaintenance,
  projectCandidateAuthorityReleaseState,
  projectCandidateAuthoritySecurityPolicyPresence,
  type CandidateAuthorityRuleResult,
} from './candidate-authority-rules.ts';
import type { CandidateAuthorityFieldPlanV4 } from './candidate-authority-readiness.ts';
import {
  CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_VERSION,
  CANDIDATE_AUTHORITY_DOSSIER_REPLAY_AUTHORITY_VERSION,
  CANDIDATE_AUTHORITY_EVIDENCE_REPLAY_AUTHORITY_VERSION,
  CANDIDATE_AUTHORITY_MAXIMUM_PARTIAL_FACT_RECORDS,
  CANDIDATE_AUTHORITY_PARTIAL_REPLAY_AUTHORITY_VERSION,
  CANDIDATE_AUTHORITY_PROFILE_REPLAY_AUTHORITY_VERSION,
  CANDIDATE_AUTHORITY_REPLAY_ALGORITHM_VERSION,
  withCanonicalAuthorityDigest,
  type CandidateAuthorityDeterministicProfileAuthorityV1,
  type CandidateAuthorityDossierAuthorityV1,
  type CandidateAuthorityDossierProjectionAuthorityV1,
  type CandidateAuthorityFitEvidenceAuthorityV1,
  type CandidateAuthorityFitEvidenceCandidateV1,
  type CandidateAuthorityPartialEvidenceAuthorityV1,
  type CandidateAuthorityReplayBundle,
} from './candidate-authority-replay-contracts.ts';
import { projectCandidateProfile } from './candidate-profile-projection.ts';
import { ingestionError } from './errors.ts';
import type { CatalogCandidate, PublicCatalog } from './types.ts';

type ProfileField = DeterministicProfileFieldRecord;
type EvidenceSource = CandidateDossierV1['observations'][number]['source'];

export interface CandidateAuthorityReplayCandidateProjection {
  readonly profile: DeterministicCandidateProfileV1;
  readonly partialEvidence: readonly CandidateAuthorityPartialFieldEvidence[];
  readonly evidence: CandidateAuthorityFitEvidenceCandidateV1;
  readonly dossier: CandidateDossierV1;
  readonly deterministicProfileDigest: string;
  readonly dossierDigest: string;
}

export function classifyCandidateAuthorityPackageRepositoryLinkage(input: {
  readonly repositoryState: 'absent' | 'supported' | 'unsupported';
  readonly declaredRepository: null | {
    readonly owner: string;
    readonly repository: string;
  };
  readonly catalogRepository: {
    readonly owner: string;
    readonly repository: string;
  };
  readonly providerCanonicalRepository: {
    readonly owner: string;
    readonly repository: string;
  };
}): 'matched' | 'mismatched' | 'undeclared' | 'unknown' {
  if (input.repositoryState === 'unsupported') return 'unknown';
  if (input.declaredRepository === null) {
    if (input.repositoryState !== 'absent') invalid();
    return 'undeclared';
  }
  if (input.repositoryState !== 'supported') invalid();
  const declaredKey = repositoryIdentityKey(
    input.declaredRepository.owner,
    input.declaredRepository.repository,
  );
  const aliases = new Set([
    repositoryIdentityKey(
      input.catalogRepository.owner,
      input.catalogRepository.repository,
    ),
    repositoryIdentityKey(
      input.providerCanonicalRepository.owner,
      input.providerCanonicalRepository.repository,
    ),
  ]);
  return aliases.has(declaredKey) ? 'matched' : 'mismatched';
}

interface CandidateProjectionCore {
  readonly profile: DeterministicCandidateProfileV1;
  readonly partialEvidence: readonly CandidateAuthorityPartialFieldEvidence[];
  readonly completeProjection: ReturnType<
    typeof projectCandidateAuthorityDossier
  >;
  readonly partialProjection: ReturnType<
    typeof projectPartialFieldEvidenceToDossier
  >;
  readonly selectedFieldIds: readonly CandidateAuthorityDecisionFieldId[];
}

export function generateCandidateAuthorityReplay(input: {
  readonly catalog: PublicCatalog;
  readonly taxonomy: CapabilityTaxonomyV1;
  readonly sourceAuthority: CandidateAuthoritySourceAuthorityV1;
  readonly fieldPlan: CandidateAuthorityFieldPlanV4;
  readonly partialSemanticRegistry: CandidateAuthorityPartialSemanticRegistry;
}): CandidateAuthorityReplayBundle {
  const sourceAuthority = parseCandidateAuthoritySourceAuthority(
    input.sourceAuthority,
  );
  if (
    input.catalog.candidates.length !== 150 ||
    sourceAuthority.bindings['catalogDigest'] !==
      input.catalog.manifestDigest ||
    sourceAuthority.bindings['taxonomyDigest'] !== input.taxonomy.semanticDigest
  )
    invalid();
  const catalogById = new Map(
    input.catalog.candidates.map((candidate) => [
      candidate.candidateId,
      candidate,
    ]),
  );
  const projectedCores = sourceAuthority.orderedCandidateIds.map(
    (candidateId, index) => {
      const candidate = catalogById.get(candidateId);
      const sourceCandidate = sourceAuthority.candidates[index];
      if (
        candidate === undefined ||
        sourceCandidate?.candidateId !== candidateId
      )
        invalid();
      return projectCandidateCore({
        candidate,
        catalog: input.catalog,
        taxonomy: input.taxonomy,
        sourceCandidate,
        sourceAuthorityDigest: sourceAuthority.canonicalAuthorityDigest,
        collectionCutoff: sourceAuthority.collectionCutoff,
        fieldPlan: input.fieldPlan,
        partialSemanticRegistry: input.partialSemanticRegistry,
      });
    },
  );
  const cores = restoreCandidateAuthorityReplayOrder(
    sourceAuthority.orderedCandidateIds,
    projectedCores,
    (core) => core.profile.candidateId,
  );
  const profileAuthority = createDeterministicCandidateProfileAuthorityV1({
    contractVersion: CONTRACT_VERSION,
    authorityVersion: DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION,
    denominatorVersion: DETERMINISTIC_PROFILE_DENOMINATOR_VERSION,
    catalogVersion: input.catalog.catalogVersion,
    catalogDigest: input.catalog.manifestDigest,
    taxonomyVersion: input.taxonomy.taxonomyVersion,
    taxonomySemanticDigest: input.taxonomy.semanticDigest,
    profileRulesVersion: DETERMINISTIC_PROFILE_RULES_VERSION,
    profiles: cores.map(({ profile }) => profile),
  });
  const profiles = withCanonicalAuthorityDigest({
    authorityVersion: CANDIDATE_AUTHORITY_PROFILE_REPLAY_AUTHORITY_VERSION,
    replayAlgorithmVersion: CANDIDATE_AUTHORITY_REPLAY_ALGORITHM_VERSION,
    sourceAuthorityVersion: CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_VERSION,
    sourceAuthorityDigest: sourceAuthority.canonicalAuthorityDigest,
    orderedCandidateIds: sourceAuthority.orderedCandidateIds,
    profileAuthority,
  }) as CandidateAuthorityDeterministicProfileAuthorityV1;
  const partialRecords = cores
    .flatMap(({ partialEvidence }) => partialEvidence)
    .sort(comparePartialEvidence);
  if (partialRecords.length > CANDIDATE_AUTHORITY_MAXIMUM_PARTIAL_FACT_RECORDS)
    invalid();
  const partial = withCanonicalAuthorityDigest({
    authorityVersion: CANDIDATE_AUTHORITY_PARTIAL_REPLAY_AUTHORITY_VERSION,
    replayAlgorithmVersion: CANDIDATE_AUTHORITY_REPLAY_ALGORITHM_VERSION,
    sourceAuthorityVersion: CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_VERSION,
    sourceAuthorityDigest: sourceAuthority.canonicalAuthorityDigest,
    semanticRegistryVersion: input.partialSemanticRegistry.registryVersion,
    semanticRegistryDigest:
      input.partialSemanticRegistry.registrySemanticDigest,
    orderedCandidateIds: sourceAuthority.orderedCandidateIds,
    records: partialRecords,
  }) as CandidateAuthorityPartialEvidenceAuthorityV1;
  const evidenceCandidates = cores.map((core) => evidenceCandidate(core));
  const evidence = withCanonicalAuthorityDigest({
    authorityVersion: CANDIDATE_AUTHORITY_EVIDENCE_REPLAY_AUTHORITY_VERSION,
    replayAlgorithmVersion: CANDIDATE_AUTHORITY_REPLAY_ALGORITHM_VERSION,
    sourceAuthorityDigest: sourceAuthority.canonicalAuthorityDigest,
    deterministicProfileAuthorityDigest: profiles.canonicalAuthorityDigest,
    partialFieldEvidenceAuthorityDigest: partial.canonicalAuthorityDigest,
    orderedCandidateIds: sourceAuthority.orderedCandidateIds,
    candidates: evidenceCandidates,
  }) as CandidateAuthorityFitEvidenceAuthorityV1;
  const dossiersValue = cores.map((core, index) => {
    const fitEvidence = evidenceCandidates[index];
    if (fitEvidence === undefined) invalid();
    return dossierFromEvidence(core, fitEvidence);
  });
  const dossiers = withCanonicalAuthorityDigest({
    authorityVersion: CANDIDATE_AUTHORITY_DOSSIER_REPLAY_AUTHORITY_VERSION,
    replayAlgorithmVersion: CANDIDATE_AUTHORITY_REPLAY_ALGORITHM_VERSION,
    sourceAuthorityDigest: sourceAuthority.canonicalAuthorityDigest,
    deterministicProfileAuthorityDigest: profiles.canonicalAuthorityDigest,
    fitEvidenceAuthorityDigest: evidence.canonicalAuthorityDigest,
    orderedCandidateIds: sourceAuthority.orderedCandidateIds,
    dossiers: dossiersValue,
  }) as CandidateAuthorityDossierAuthorityV1;
  const projections = cores.map((core, index) => {
    const fitEvidence = evidenceCandidates[index];
    const dossier = dossiersValue[index];
    if (fitEvidence === undefined || dossier === undefined) invalid();
    const projection = {
      candidateId: core.profile.candidateId,
      deterministicProfileDigest: core.profile.semanticProfileDigest,
      fitEvidenceDigest: fitEvidence.canonicalEvidenceDigest,
      dossierDigest: canonicalizeJson(dossier).digest,
      completeEvidenceIds: core.completeProjection.fieldEvidenceBindings
        .map(({ evidenceId }) => evidenceId)
        .sort(compare),
      partialEvidenceIds: core.partialProjection.partialFieldEvidenceBindings
        .map(({ partialEvidenceId }) => partialEvidenceId)
        .sort(compare),
    };
    return {
      ...projection,
      canonicalProjectionDigest: canonicalizeJson(projection).digest,
    };
  });
  const dossierProjection = withCanonicalAuthorityDigest({
    authorityVersion: CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_VERSION,
    replayAlgorithmVersion: CANDIDATE_AUTHORITY_REPLAY_ALGORITHM_VERSION,
    sourceAuthorityDigest: sourceAuthority.canonicalAuthorityDigest,
    deterministicProfileAuthorityDigest: profiles.canonicalAuthorityDigest,
    partialFieldEvidenceAuthorityDigest: partial.canonicalAuthorityDigest,
    fitEvidenceAuthorityDigest: evidence.canonicalAuthorityDigest,
    dossierAuthorityDigest: dossiers.canonicalAuthorityDigest,
    orderedCandidateIds: sourceAuthority.orderedCandidateIds,
    projections,
  }) as CandidateAuthorityDossierProjectionAuthorityV1;
  return Object.freeze({
    profiles,
    partial,
    evidence,
    dossiers,
    dossierProjection,
  });
}

export function projectCandidateAuthorityReplayCandidate(input: {
  readonly candidate: CatalogCandidate;
  readonly catalog: PublicCatalog;
  readonly taxonomy: CapabilityTaxonomyV1;
  readonly sourceCandidate: CandidateAuthoritySourceCandidateV1;
  readonly sourceAuthorityDigest: string;
  readonly collectionCutoff: string;
  readonly fieldPlan: CandidateAuthorityFieldPlanV4;
  readonly partialSemanticRegistry: CandidateAuthorityPartialSemanticRegistry;
  readonly sourceAuthorityVersion?: string;
}): CandidateAuthorityReplayCandidateProjection {
  const core = projectCandidateCore(input);
  const evidence = evidenceCandidate(core);
  const dossier = dossierFromEvidence(core, evidence);
  return Object.freeze({
    profile: core.profile,
    partialEvidence: core.partialEvidence,
    evidence,
    dossier,
    deterministicProfileDigest: core.profile.semanticProfileDigest,
    dossierDigest: canonicalizeJson(dossier).digest,
  });
}

export function restoreCandidateAuthorityReplayOrder<T>(
  orderedCandidateIds: readonly string[],
  values: readonly T[],
  candidateId: (value: T) => string,
): readonly T[] {
  if (
    orderedCandidateIds.length !== values.length ||
    new Set(orderedCandidateIds).size !== orderedCandidateIds.length
  )
    invalid();
  const byId = new Map(values.map((value) => [candidateId(value), value]));
  if (byId.size !== values.length) invalid();
  return Object.freeze(
    orderedCandidateIds.map((id) => byId.get(id) ?? invalid()),
  );
}

function projectCandidateCore(input: {
  readonly candidate: CatalogCandidate;
  readonly catalog: PublicCatalog;
  readonly taxonomy: CapabilityTaxonomyV1;
  readonly sourceCandidate: CandidateAuthoritySourceCandidateV1;
  readonly sourceAuthorityDigest: string;
  readonly collectionCutoff: string;
  readonly fieldPlan: CandidateAuthorityFieldPlanV4;
  readonly partialSemanticRegistry: CandidateAuthorityPartialSemanticRegistry;
  readonly sourceAuthorityVersion?: string;
}): CandidateProjectionCore {
  if (
    input.sourceCandidate.candidateId !== input.candidate.candidateId ||
    input.sourceCandidate.github.owner !== input.candidate.github.owner ||
    input.sourceCandidate.github.repository !==
      input.candidate.github.repository ||
    input.sourceCandidate.npmPackage !== input.candidate.npmPackage
  )
    invalid();
  const sources = sourceMap(input.sourceCandidate.sources);
  const base = projectCandidateProfile(
    input.candidate,
    input.catalog,
    input.taxonomy,
  );
  const repositorySnapshotId = stableId('source-snapshot', {
    candidateId: input.candidate.candidateId,
    sourceAuthorityDigest: input.sourceAuthorityDigest,
    sourceCandidateDigest: input.sourceCandidate.candidateSourceDigest,
  });
  const fields = (base.fields as unknown as readonly ProfileField[]).map(
    (field) =>
      projectCompleteField({
        field,
        candidate: input.candidate,
        sources,
        repositorySnapshotId,
        collectionCutoff: input.collectionCutoff,
      }),
  ) as DeterministicCandidateProfileInputV1['fields'];
  const profile = createDeterministicCandidateProfileV1({
    contractVersion: CONTRACT_VERSION,
    profileVersion: DETERMINISTIC_CANDIDATE_PROFILE_VERSION,
    candidateId: input.candidate.candidateId,
    catalogBinding: {
      catalogVersion: input.catalog.catalogVersion,
      catalogDigest: input.catalog.manifestDigest,
    },
    taxonomyBinding: {
      taxonomyVersion: input.taxonomy.taxonomyVersion,
      taxonomySemanticDigest: input.taxonomy.semanticDigest,
    },
    profileRulesVersion: DETERMINISTIC_PROFILE_RULES_VERSION,
    fields,
  });
  const partialEvidence = createPartialEvidence({
    candidate: input.candidate,
    profile,
    sources,
    sourceAuthorityDigest: input.sourceAuthorityDigest,
    sourceAuthorityVersion:
      input.sourceAuthorityVersion ??
      CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_VERSION,
    collectionCutoff: input.collectionCutoff,
    fieldPlan: input.fieldPlan,
    partialSemanticRegistry: input.partialSemanticRegistry,
  });
  const completeBindings = createCompleteEvidenceBindings({
    candidate: input.candidate,
    profile,
    sources,
    sourceAuthorityDigest: input.sourceAuthorityDigest,
    collectionCutoff: input.collectionCutoff,
    fieldPlan: input.fieldPlan,
  });
  const completeProjection = projectCandidateAuthorityDossier({
    profile,
    fieldPlan: input.fieldPlan,
    evidenceBindings: completeBindings,
    collectionCutoff: input.collectionCutoff,
  });
  const partialProjection = projectPartialFieldEvidenceToDossier({
    completeProjection,
    fieldPlan: input.fieldPlan,
    partialSemanticRegistry: input.partialSemanticRegistry,
    partialEvidence,
  });
  return {
    profile,
    partialEvidence,
    completeProjection,
    partialProjection,
    selectedFieldIds: input.fieldPlan.fields.map(({ fieldId }) => fieldId),
  };
}

function projectCompleteField(input: {
  readonly field: ProfileField;
  readonly candidate: CatalogCandidate;
  readonly sources: ReadonlyMap<string, CandidateAuthoritySourceDatum>;
  readonly repositorySnapshotId: string;
  readonly collectionCutoff: string;
}): ProfileField {
  const { field, candidate, sources, repositorySnapshotId, collectionCutoff } =
    input;
  const repository = sourceValue(sources, 'github-repository-metadata');
  const npm =
    sources.get('npm-selected-version-metadata') ??
    sources.get('npm-package-metadata');
  const repositoryScope = {
    kind: 'repository-snapshot' as const,
    snapshotId: repositorySnapshotId,
  };
  const fieldId: string = field.fieldId;
  switch (fieldId) {
    case 'package-publication-version': {
      if (
        candidate.npmPackage === null ||
        npm?.operationId !== 'npm-package-metadata'
      )
        return field;
      const value = establishedRecord(npm);
      const version = stringValue(value, 'selectedVersion');
      return structuredKnown(
        field,
        packageScope(version),
        {
          packageName: stringValue(value, 'name'),
          version,
          publishedAt: timestampValue(value, 'publishedAt'),
        },
        [npm],
      );
    }
    case 'runtime-package-format': {
      if (candidate.npmPackage === null || npm?.outcome !== 'established-value')
        return field;
      const value = establishedRecord(npm);
      const optionalStates = optionalPropertyStates(value);
      if (
        optionalStates !== null &&
        ['nodeEngine', 'type', 'exports'].some(
          (key) => optionalStates[key] === 'unsupported',
        )
      )
        return field;
      const version = npmVersion(value, npm);
      const type = nullableStringValue(value, 'type');
      const moduleFormat =
        type === null
          ? 'unspecified'
          : type === 'module'
            ? 'esm'
            : type === 'commonjs'
              ? 'commonjs'
              : null;
      const nodeEngineRange = nullableStringValue(value, 'nodeEngine');
      if (
        moduleFormat === null ||
        (nodeEngineRange !== null &&
          (nodeEngineRange.length > 100 ||
            hasControlCharacter(nodeEngineRange)))
      )
        return field;
      return structuredKnown(
        field,
        packageScope(version),
        {
          nodeEngineRange,
          moduleFormat,
          packageFormat: 'npm-package',
          exportsDeclared: booleanValue(value, 'exportsDeclared'),
        },
        [npm],
      );
    }
    case 'package-repository-linkage': {
      if (candidate.npmPackage === null || npm?.outcome !== 'established-value')
        return field;
      const value = establishedRecord(npm);
      const optionalStates = optionalPropertyStates(value);
      const repositoryState = optionalStates?.['repository'];
      if (
        repositoryState !== 'absent' &&
        repositoryState !== 'supported' &&
        repositoryState !== 'unsupported'
      )
        return field;
      const version = npmVersion(value, npm);
      const declared = value['repositoryIdentity'];
      const identity = declared === null ? null : recordValue(declared);
      const linkage = classifyCandidateAuthorityPackageRepositoryLinkage({
        repositoryState,
        declaredRepository:
          identity === null
            ? null
            : {
                owner: stringValue(identity, 'owner'),
                repository: stringValue(identity, 'repository'),
              },
        catalogRepository: candidate.github,
        providerCanonicalRepository: providerCanonicalRepositoryIdentity(
          candidate,
          sources,
        ),
      });
      if (linkage === 'unknown') return field;
      return structuredKnown(field, packageScope(version), { linkage }, [
        npm,
        sources.get('github-repository-metadata'),
      ]);
    }
    case 'license-identity': {
      const license = sources.get('github-license');
      if (license?.outcome !== 'established-value') return field;
      const spdxId = nullableStringValue(recordValue(license.value), 'spdxId');
      if (
        spdxId === null ||
        spdxId === 'NOASSERTION' ||
        !/^[A-Za-z0-9][A-Za-z0-9.+-]{0,63}$/u.test(spdxId)
      )
        return field;
      return structuredKnown(field, repositoryScope, { spdxId }, [
        license,
        sources.get('github-head-commit-object'),
      ]);
    }
    case 'archived-state':
      return structuredKnown(
        field,
        repositoryScope,
        { archived: booleanValue(repository, 'archived') },
        [sources.get('github-repository-metadata')],
      );
    case 'maintenance-activity': {
      const maintenance = sources.get('github-maintenance-window');
      if (maintenance?.outcome !== 'established-value') return field;
      const value = recordValue(maintenance.value);
      return resultField(
        field,
        repositoryScope,
        projectCandidateAuthorityMaintenance({
          snapshotAt: collectionCutoff,
          headSha: stringValue(value, 'headSha'),
          lastCommitAt: nullableTimestampValue(value, 'lastCommitAt'),
          windowOutcome: 'complete',
          commitsInPrevious90Days: countValue(value, 'count', 100_000),
        }),
        [maintenance, sources.get('github-head-commit-object')],
      );
    }
    case 'release-state-recency': {
      const release = sources.get('github-release-window');
      if (release?.outcome !== 'established-value') return field;
      const value = recordValue(release.value);
      const releases = releaseValues(value);
      return resultField(
        field,
        repositoryScope,
        projectCandidateAuthorityReleaseState({
          snapshotAt: collectionCutoff,
          outcome: 'established-value',
          complete: release.completeness === 'complete',
          releases,
          unsupportedPublishedReleaseCount:
            optionalCountValue(value, 'unsupportedPublishedReleaseCount') ?? 0,
        }),
        [release],
      );
    }
    case 'security-advisory-state': {
      const advisory = sources.get('github-advisories');
      if (
        candidate.npmPackage === null ||
        advisory?.outcome !== 'established-value' ||
        npm?.outcome !== 'established-value'
      )
        return field;
      const advisoryValue = recordValue(advisory.value);
      const npmValue = establishedRecord(npm);
      return resultField(
        field,
        packageScope(npmVersion(npmValue, npm)),
        projectCandidateAuthorityAdvisoryState({
          snapshotAt: collectionCutoff,
          expectedPackageName: candidate.npmPackage,
          expectedPackageVersion: npmVersion(npmValue, npm),
          sourcePackageName: stringValue(advisoryValue, 'packageName'),
          sourcePackageVersion: stringValue(advisoryValue, 'packageVersion'),
          outcome: 'established-value',
          complete: advisory.completeness === 'complete',
          advisories: advisoryValues(advisoryValue),
        }),
        [advisory, npm],
      );
    }
    case 'security-policy-presence': {
      const localPolicy = [
        sources.get('github-root-tree'),
        sources.get('github-security-dot-github-tree'),
        sources.get('github-security-docs-tree'),
      ].find((datum) => {
        if (datum?.outcome !== 'established-value') return false;
        return recordValue(datum.value)['securityPolicyPresent'] === true;
      });
      if (localPolicy?.outcome !== 'established-value') return field;
      return resultField(
        field,
        repositoryScope,
        projectCandidateAuthoritySecurityPolicyPresence({
          outcome: 'established-value',
          present: true,
        }),
        [localPolicy, sources.get('github-head-commit-object')],
      );
    }
    default:
      return field;
  }
}

function createPartialEvidence(input: {
  readonly candidate: CatalogCandidate;
  readonly profile: DeterministicCandidateProfileV1;
  readonly sources: ReadonlyMap<string, CandidateAuthoritySourceDatum>;
  readonly sourceAuthorityDigest: string;
  readonly sourceAuthorityVersion: string;
  readonly collectionCutoff: string;
  readonly fieldPlan: CandidateAuthorityFieldPlanV4;
  readonly partialSemanticRegistry: CandidateAuthorityPartialSemanticRegistry;
}): CandidateAuthorityPartialFieldEvidence[] {
  const result: CandidateAuthorityPartialFieldEvidence[] = [];
  const profileByField = new Map(
    (input.profile.fields as unknown as readonly ProfileField[]).map(
      (field) => [field.fieldId, field],
    ),
  );
  for (const datum of input.sources.values()) {
    if (datum.outcome !== 'established-value') continue;
    const value = recordValue(datum.value);
    const partialFacts = value['partialFacts'];
    if (!Array.isArray(partialFacts)) continue;
    for (const rawFact of partialFacts) {
      const fact = recordValue(rawFact);
      const factCode = stringValue(fact, 'factCode');
      const definition = input.partialSemanticRegistry.definitions.find(
        (candidate) => candidate.factCode === factCode,
      );
      if (definition === undefined) invalid();
      if (profileByField.get(definition.fieldId)?.state === 'known') continue;
      const plan = input.fieldPlan.fields.find(
        (candidate) => candidate.fieldId === definition.fieldId,
      );
      if (plan === undefined) invalid();
      const source = evidenceSource({
        candidate: input.candidate,
        sources: input.sources,
        datum,
        sourceAuthorityDigest: input.sourceAuthorityDigest,
        collectionCutoff: input.collectionCutoff,
        provenanceKind: plan.evidenceProvenanceKind,
      });
      result.push(
        createCandidateAuthorityPartialFieldEvidence(
          {
            candidateId: input.candidate.candidateId,
            fieldId: definition.fieldId,
            extractionRuleVersion: definition.extractionRuleVersion,
            factCode: definition.factCode,
            factValue: stringValue(fact, 'factValue'),
            polarity: 'affirmative',
            source,
            sourceReference: {
              sourceAuthorityVersion: input.sourceAuthorityVersion,
              sourceAuthorityDigest: input.sourceAuthorityDigest,
              sourceRecordDigest: canonicalizeJson(datum).digest,
              evidenceIds: [],
            },
            sourceCompleteness:
              datum.completeness === 'complete' ? 'complete' : 'partial',
            fieldCompleteness: 'partial',
            unresolvedRemainder: plan.unresolvedRemainder,
            freshness: {
              cutoff: input.collectionCutoff,
              asOf: sourceAsOf(source),
            },
          },
          input.partialSemanticRegistry,
        ),
      );
    }
  }
  return result.sort(comparePartialEvidence);
}

function createCompleteEvidenceBindings(input: {
  readonly candidate: CatalogCandidate;
  readonly profile: DeterministicCandidateProfileV1;
  readonly sources: ReadonlyMap<string, CandidateAuthoritySourceDatum>;
  readonly sourceAuthorityDigest: string;
  readonly collectionCutoff: string;
  readonly fieldPlan: CandidateAuthorityFieldPlanV4;
}): CandidateAuthorityEvidenceBinding[] {
  const bindings: CandidateAuthorityEvidenceBinding[] = [];
  for (const field of input.profile
    .fields as unknown as readonly ProfileField[]) {
    const plan = input.fieldPlan.fields.find(
      (candidate) => candidate.fieldId === field.fieldId,
    );
    if (plan === undefined || field.state !== 'known') continue;
    const data = sourcesForCompleteField(field.fieldId, input.sources);
    if (data.length < 1 || data.length > 2) invalid();
    for (const datum of data) {
      bindings.push({
        fieldId: field.fieldId as CandidateAuthorityDecisionFieldId,
        fieldValueDigest: canonicalizeJson(field.value).digest,
        sourceOperationId: datum.operationId,
        source: evidenceSource({
          candidate: input.candidate,
          sources: input.sources,
          datum,
          sourceAuthorityDigest: input.sourceAuthorityDigest,
          collectionCutoff: input.collectionCutoff,
          provenanceKind: plan.evidenceProvenanceKind,
        }),
      });
    }
  }
  return bindings.sort(
    (left, right) =>
      compare(left.fieldId, right.fieldId) ||
      completeSourceRank(left.sourceOperationId) -
        completeSourceRank(right.sourceOperationId) ||
      compare(left.sourceOperationId, right.sourceOperationId),
  );
}

function evidenceCandidate(
  core: CandidateProjectionCore,
): CandidateAuthorityFitEvidenceCandidateV1 {
  const candidate = {
    candidateId: core.profile.candidateId,
    observations: core.partialProjection.dossier.observations,
    limitations: core.partialProjection.dossier.limitations,
    unknowns: core.partialProjection.dossier.unknowns,
    completeFieldEvidenceBindings:
      core.completeProjection.fieldEvidenceBindings,
    partialFieldEvidenceBindings:
      core.partialProjection.partialFieldEvidenceBindings,
  };
  validateCandidateAuthorityCompleteEvidence({
    profile: core.profile,
    observations: candidate.observations,
    bindings: candidate.completeFieldEvidenceBindings,
    selectedFieldIds: core.selectedFieldIds,
  });
  return Object.freeze({
    ...candidate,
    canonicalEvidenceDigest: canonicalizeJson(candidate).digest,
  });
}

function dossierFromEvidence(
  core: CandidateProjectionCore,
  evidence: CandidateAuthorityFitEvidenceCandidateV1,
): CandidateDossierV1 {
  const base = core.completeProjection.dossier;
  const candidate = {
    contractVersion: base.contractVersion,
    identity: base.identity,
    capabilityFamily: base.capabilityFamily,
    versionScope: base.versionScope,
    observations: evidence.observations,
    limitations: evidence.limitations,
    unknowns: evidence.unknowns,
  };
  const parsed = parseCandidateDossierV1(candidate);
  if (!parsed.ok || parsed.value.identity.candidateId !== evidence.candidateId)
    invalid();
  if (
    canonicalizeJson(parsed.value).digest !==
    core.partialProjection.dossierDigest
  )
    invalid();
  return parsed.value;
}

function evidenceSource(input: {
  readonly candidate: CatalogCandidate;
  readonly sources: ReadonlyMap<string, CandidateAuthoritySourceDatum>;
  readonly datum: CandidateAuthoritySourceDatum;
  readonly sourceAuthorityDigest: string;
  readonly collectionCutoff: string;
  readonly provenanceKind:
    | 'approved-validation'
    | 'git-commit'
    | 'package-version'
    | 'structured-provider-snapshot';
}): EvidenceSource {
  const operationId: string = input.datum.operationId;
  if (input.provenanceKind === 'package-version') {
    const npm = sourceValue(input.sources, 'npm-package-metadata');
    const packageName = stringValue(npm, 'name');
    const version = stringValue(npm, 'selectedVersion');
    return {
      kind: 'package-version',
      sourceType: 'package-registry',
      sourceUrl: `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
      packageVersion: version,
      immutableUrl: `https://registry.npmjs.org/${encodeURIComponent(packageName)}/${version}`,
      publishedAt: timestampValue(npm, 'publishedAt'),
      collectedAt: input.collectionCutoff,
    };
  }
  if (input.provenanceKind === 'git-commit') {
    const commit = sourceValue(input.sources, 'github-head-commit-object');
    const headSha = stringValue(commit, 'headSha');
    const licenseValue =
      operationId === 'github-license' ? recordValue(input.datum.value) : null;
    const securityValue = operationId.startsWith('github-security-')
      ? recordValue(input.datum.value)
      : operationId === 'github-root-tree' &&
          recordValue(input.datum.value)['securityPolicyPresent'] === true
        ? recordValue(input.datum.value)
        : null;
    const path =
      licenseValue === null
        ? securityValue !== null
          ? securityValue['securityPolicyPath']
          : operationId === 'github-compose-json-blob'
            ? 'compose.json'
            : 'Dockerfile'
        : licenseValue['path'];
    if (!isSafeCandidateAuthorityRepositoryRelativePath(path)) invalid();
    const canonical = providerCanonicalRepositoryIdentity(
      input.candidate,
      input.sources,
    );
    const repositoryIdentity =
      licenseValue === null
        ? canonical
        : recordValue(licenseValue['repositoryIdentity']);
    const owner = stringValue(repositoryIdentity, 'owner');
    const repository = stringValue(repositoryIdentity, 'repository');
    if (licenseValue !== null) {
      const metadata = sourceValue(input.sources, 'github-repository-metadata');
      if (
        stringValue(licenseValue, 'headSha') !== headSha ||
        !isCandidateAuthorityGitObjectSha(licenseValue['blobSha']) ||
        owner !== stringValue(metadata, 'canonicalOwner') ||
        repository !== stringValue(metadata, 'canonicalRepository') ||
        repositoryIdentityKey(owner, repository) !==
          repositoryIdentityKey(canonical.owner, canonical.repository)
      )
        invalid();
    }
    const location = candidateAuthorityImmutableGitHubFileLocation({
      owner,
      repository,
      commitSha: headSha,
      path,
    });
    return {
      kind: 'git-commit',
      sourceType:
        operationId === 'github-license' ? 'license' : 'official-repository',
      sourceUrl: location.sourceUrl,
      commitSha: headSha,
      immutableUrl: location.immutableUrl,
      publishedAt: timestampValue(commit, 'committerDate'),
      collectedAt: input.collectionCutoff,
    };
  }
  if (input.provenanceKind !== 'structured-provider-snapshot') invalid();
  const npmSelected = operationId === 'npm-selected-version-metadata';
  const npm = npmSelected || operationId === 'npm-package-metadata';
  const sourceClass = sourceClassForOperation(operationId);
  const canonical = providerCanonicalRepositoryIdentity(
    input.candidate,
    input.sources,
  );
  return {
    kind: 'structured-provider-snapshot',
    sourceType: 'public-structured-provider',
    provider: npm ? 'npm' : 'github',
    sourceClass,
    sourceIdentity: stableId('source-record', {
      candidateId: input.candidate.candidateId,
      operationId,
      sourceRecordDigest: canonicalizeJson(input.datum).digest,
    }),
    sourceUrl: npmSelected
      ? `https://registry.npmjs.org/${encodeURIComponent(input.candidate.npmPackage ?? '')}/latest`
      : npm
        ? `https://registry.npmjs.org/${encodeURIComponent(input.candidate.npmPackage ?? '')}`
        : `https://api.github.com/repos/${canonical.owner}/${canonical.repository}`,
    sourceAuthorityDigest: input.sourceAuthorityDigest,
    sourceRecordDigest: canonicalizeJson(input.datum).digest,
    collectedAt: input.collectionCutoff,
    effectiveAsOf: input.collectionCutoff,
    sourceMutability: 'mutable',
    completenessState:
      input.datum.outcome === 'established-absence'
        ? 'established-absence'
        : input.datum.completeness === 'complete'
          ? 'complete'
          : 'partial',
    limitationCode: 'source-is-mutable',
  };
}

function sourceClassForOperation(
  operationId: string,
): Extract<
  EvidenceSource,
  { kind: 'structured-provider-snapshot' }
>['sourceClass'] {
  switch (operationId) {
    case 'npm-selected-version-metadata':
    case 'npm-package-metadata':
      return 'package-metadata';
    case 'github-maintenance-window':
      return 'repository-maintenance';
    case 'github-repository-metadata':
      return 'repository-metadata';
    case 'github-release-window':
      return 'repository-release-state';
    case 'github-advisories':
      return 'security-advisory-index';
    default:
      invalid();
  }
}

function sourcesForCompleteField(
  fieldId: string,
  sources: ReadonlyMap<string, CandidateAuthoritySourceDatum>,
): CandidateAuthoritySourceDatum[] {
  if (fieldId === 'security-policy-presence') {
    const datum = [
      sources.get('github-root-tree'),
      sources.get('github-security-dot-github-tree'),
      sources.get('github-security-docs-tree'),
    ].find(
      (datum) =>
        datum?.outcome === 'established-value' &&
        recordValue(datum.value)['securityPolicyPresent'] === true,
    );
    return datum === undefined ? [] : [datum];
  }
  if (fieldId === 'package-repository-linkage') {
    const npm = sources.has('npm-selected-version-metadata')
      ? sources.get('npm-selected-version-metadata')
      : sources.get('npm-package-metadata');
    const github = sources.get('github-repository-metadata');
    return npm === undefined || github === undefined ? [] : [npm, github];
  }
  const operation =
    fieldId === 'package-publication-version'
      ? 'npm-package-metadata'
      : fieldId === 'runtime-package-format'
        ? sources.has('npm-selected-version-metadata')
          ? 'npm-selected-version-metadata'
          : 'npm-package-metadata'
        : fieldId === 'license-identity'
          ? 'github-license'
          : fieldId === 'archived-state'
            ? 'github-repository-metadata'
            : fieldId === 'maintenance-activity'
              ? 'github-maintenance-window'
              : fieldId === 'release-state-recency'
                ? 'github-release-window'
                : fieldId === 'security-advisory-state'
                  ? 'github-advisories'
                  : null;
  const datum = operation === null ? undefined : sources.get(operation);
  return datum === undefined ? [] : [datum];
}

function completeSourceRank(operationId: string): number {
  return operationId === 'npm-selected-version-metadata'
    ? 0
    : operationId === 'github-repository-metadata'
      ? 1
      : 2;
}

function npmVersion(
  value: Record<string, unknown>,
  source: CandidateAuthoritySourceDatum,
): string {
  return stringValue(
    value,
    (source.operationId as string) === 'npm-selected-version-metadata'
      ? 'resolvedVersion'
      : 'selectedVersion',
  );
}

function structuredKnown(
  field: ProfileField,
  versionScope: ProfileField['versionScope'],
  value: object,
  sources: readonly (CandidateAuthoritySourceDatum | undefined)[],
): ProfileField {
  return {
    fieldId: field.fieldId,
    scope: field.scope,
    state: 'known',
    stateReasonCode: 'approved-structured-field-value',
    stateRuleId: 'assign-known-approved-structured-value',
    valueExtractionRuleId: `extract-${field.fieldId}-from-structured-authority`,
    versionScope,
    sourceReferences: [structuredReference(sources)],
    value,
  } as ProfileField;
}

function resultField(
  field: ProfileField,
  versionScope: ProfileField['versionScope'],
  result: CandidateAuthorityRuleResult<unknown>,
  sources: readonly (CandidateAuthoritySourceDatum | undefined)[],
): ProfileField {
  return result.state === 'known'
    ? structuredKnown(field, versionScope, result.value as object, sources)
    : field;
}

function structuredReference(
  sources: readonly (CandidateAuthoritySourceDatum | undefined)[],
): ProfileField['sourceReferences'][number] {
  const present = sources.filter(
    (source): source is CandidateAuthoritySourceDatum => source !== undefined,
  );
  return {
    kind: 'structured-collection',
    sourceSnapshotId: stableId('source-snapshot', {
      sourceRecords: present.map((source) => canonicalizeJson(source).digest),
    }),
    evidenceIds: [],
    sourceTopicCodes: present
      .map(({ operationId }) => operationId)
      .sort(compare),
  };
}

function packageScope(version: string) {
  return { kind: 'package-version' as const, version };
}

function sourceMap(
  values: readonly CandidateAuthoritySourceDatum[],
): ReadonlyMap<string, CandidateAuthoritySourceDatum> {
  const map = new Map(values.map((source) => [source.operationId, source]));
  if (map.size !== values.length) invalid();
  return map;
}

function sourceValue(
  sources: ReadonlyMap<string, CandidateAuthoritySourceDatum>,
  operationId: string,
): Record<string, unknown> {
  return establishedRecord(sources.get(operationId));
}

function providerCanonicalRepositoryIdentity(
  candidate: CatalogCandidate,
  sources: ReadonlyMap<string, CandidateAuthoritySourceDatum>,
): { readonly owner: string; readonly repository: string } {
  const metadata = sourceValue(sources, 'github-repository-metadata');
  const canonicalValue = metadata['providerCanonicalRepositoryIdentity'];
  if (canonicalValue === undefined) {
    return {
      owner: stringValue(metadata, 'canonicalOwner'),
      repository: stringValue(metadata, 'canonicalRepository'),
    };
  }
  const catalog = recordValue(metadata['catalogRepositoryIdentity']);
  const canonical = recordValue(canonicalValue);
  if (
    repositoryIdentityKey(
      stringValue(catalog, 'owner'),
      stringValue(catalog, 'repository'),
    ) !==
      repositoryIdentityKey(
        candidate.github.owner,
        candidate.github.repository,
      ) ||
    !['unchanged', 'redirected'].includes(
      stringValue(metadata, 'repositoryIdentityState'),
    )
  )
    invalid();
  const owner = stringValue(canonical, 'owner');
  const repository = stringValue(canonical, 'repository');
  if (
    owner !== stringValue(metadata, 'canonicalOwner') ||
    repository !== stringValue(metadata, 'canonicalRepository')
  )
    invalid();
  return { owner, repository };
}

function repositoryIdentityKey(owner: string, repository: string): string {
  return `${owner}/${repository}`.toLowerCase();
}

function establishedRecord(
  source: CandidateAuthoritySourceDatum | undefined,
): Record<string, unknown> {
  if (source?.outcome !== 'established-value') invalid();
  return recordValue(source.value);
}

function recordValue(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    invalid();
  return value as Record<string, unknown>;
}

function stringValue(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    hasControlCharacter(value)
  )
    invalid();
  return value;
}

function nullableStringValue(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  if (value !== null && typeof value !== 'string') invalid();
  if (typeof value === 'string' && hasControlCharacter(value)) invalid();
  return value;
}

function booleanValue(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') invalid();
  return value;
}

function countValue(
  record: Record<string, unknown>,
  key: string,
  maximum: number,
): number {
  const value = record[key];
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < 0 ||
    Number(value) > maximum
  )
    invalid();
  return Number(value);
}

function timestampValue(record: Record<string, unknown>, key: string): string {
  const value = stringValue(record, key);
  if (!isTimestamp(value)) invalid();
  return value;
}

function nullableTimestampValue(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = nullableStringValue(record, key);
  if (value !== null && !isTimestamp(value)) invalid();
  return value;
}

function releaseValues(record: Record<string, unknown>) {
  const values = record['releases'];
  if (!Array.isArray(values) || values.length > 5) invalid();
  return values.map((value) => {
    const release = recordValue(value);
    return {
      tagName: stringValue(release, 'tagName'),
      publishedAt: timestampValue(release, 'publishedAt'),
      draft: booleanValue(release, 'draft'),
      prerelease: booleanValue(release, 'prerelease'),
    };
  });
}

function advisoryValues(record: Record<string, unknown>) {
  const values = record['advisories'];
  if (!Array.isArray(values) || values.length > 200) invalid();
  return values.map((value) => {
    const advisory = recordValue(value);
    const rawSeverity = Object.hasOwn(advisory, 'normalizedSeverity')
      ? advisory['normalizedSeverity']
      : advisory['severity'];
    const severity =
      rawSeverity === null
        ? null
        : typeof rawSeverity === 'string' &&
            ['critical', 'high', 'low', 'moderate'].includes(rawSeverity)
          ? (rawSeverity as 'critical' | 'high' | 'low' | 'moderate')
          : invalid();
    return {
      advisoryId: stringValue(advisory, 'advisoryId').toLowerCase(),
      severity,
    };
  });
}

function optionalCountValue(
  record: Record<string, unknown>,
  key: string,
): number | null {
  return record[key] === undefined ? null : countValue(record, key, 1_000_000);
}

function optionalPropertyStates(
  record: Record<string, unknown>,
): Record<string, unknown> | null {
  const value = record['optionalPropertyStates'];
  return value === undefined ? null : recordValue(value);
}

function sourceAsOf(source: EvidenceSource): string {
  switch (source.kind) {
    case 'structured-provider-snapshot':
      return source.effectiveAsOf;
    case 'approved-validation':
      return source.validatedAt;
    case 'git-commit':
    case 'tag':
    case 'release':
    case 'package-version':
    case 'security-advisory':
    case 'mutable-documentation':
      return source.collectedAt;
  }
}

function comparePartialEvidence(
  left: CandidateAuthorityPartialFieldEvidence,
  right: CandidateAuthorityPartialFieldEvidence,
): number {
  return (
    compare(left.candidateId, right.candidateId) ||
    compare(left.partialEvidenceId, right.partialEvidenceId)
  );
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isTimestamp(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function invalid(): never {
  throw ingestionError('ingestion.invalid-input');
}
