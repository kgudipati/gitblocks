import { createHash } from 'node:crypto';

import {
  createCandidateRetrievalRequestV1,
  createCapabilityRequestFromRecommendationV1,
  createRecommendationAssessmentModelFitRequestV1,
  normalizeCapabilityQueryV1,
  parseCandidateDossierV1,
  parseCandidateRetrievalMetadataAuthorityV1,
  parseCapabilityRetrievalExpansionV1,
  parseCapabilityTaxonomyV1,
  parseDeterministicCandidateProfileAuthorityV1,
  parseFitAssessmentRequestV1,
  parseOssRecommendationRequestV1,
  validateRecommendationModelAssessmentExchangeV1,
  type CandidateDossierV1,
  type CandidateRetrievalCandidateV1,
  type CandidateRetrievalAuthorityBindingsV1,
  type CandidateRetrievalMetadataAuthorityV1,
  type CandidateRetrievalResultV1,
  type CapabilityQueryNormalizationResultV1,
  type CapabilityRetrievalExpansionV1,
  type CapabilityTaxonomyV1,
  type ContractIssue,
  type DeterministicCandidateProfileAuthorityV1,
  type FitAssessmentRequestV1,
  type EvidenceNeededHardConstraintResolutionV1,
  type RecommendationRetrievalFinalistV1,
  type RecommendationAssessmentModelFitRequestV1,
  type TargetFitAssessmentResponseV1,
} from '@gitblocks/contracts';
import {
  CANDIDATE_CONSTRAINT_EVALUATION_VERSION,
  validateCandidateReferenceAuthority,
  type CandidateReferenceAuthority,
  type DeterministicCandidateProfile,
  type DeterministicCandidateProfileAuthority,
  type DeterministicProfileFieldId,
  type DeterministicProfileFieldRecord,
} from '@gitblocks/domain';
import type {
  CandidateRetrievalEngineV1,
  CandidateRetrievalOperationIssueV1,
} from '@gitblocks/retrieval';

import {
  MAX_ARTIFACT_EVIDENCE_PER_CANDIDATE,
  MAX_ARTIFACT_EVIDENCE_PER_RECOMMENDATION,
  selectCandidateArtifactEvidenceV1,
  type CandidateArtifactMaterialLoaderPort,
} from './artifact-evidence-selector.ts';

const DISCOVERY_RESULT_LIMIT = 10;
export const HOSTED_FIT_FINALIST_LIMIT = 5;
export const HOSTED_RESPONSIBLE_OPTION_LIMIT = 3;

export interface HostedDiscoverySnapshotV1 {
  readonly snapshotId: string;
  readonly snapshotRecordDigest: string;
  readonly candidateCount: number;
}

export interface FitAssessmentModelRequestV1 {
  readonly fitAssessmentRequest: RecommendationAssessmentModelFitRequestV1;
  readonly normalization: CapabilityQueryNormalizationResultV1;
  readonly retrievalFinalists: readonly RecommendationRetrievalFinalistV1[];
}

export interface FitAssessmentModelPort {
  readonly assess: (input: FitAssessmentModelRequestV1) => Promise<unknown>;
}

export interface CandidateDossierLoaderPort {
  readonly loadActiveCandidateDossier: (input: {
    readonly candidateId: string;
    readonly expectedCapabilityFamily: CandidateDossierV1['capabilityFamily'];
    readonly evidenceCutoff: string;
  }) => Promise<CandidateDossierV1>;
}

export interface HostedRecommendationClockPort {
  readonly now: () => string;
}

export interface HostedRecommendationObserverV1 {
  readonly emit: (event: HostedRecommendationEventV1) => void;
}

export interface HostedRecommendationEventV1 {
  readonly operation: 'hosted.recommendation';
  readonly recommendationRequestId: string;
  readonly stage:
    | 'validated'
    | 'normalized'
    | 'retrieved'
    | 'evidence-loaded'
    | 'model-completed'
    | 'completed'
    | 'failed';
  readonly outcome:
    | 'in-progress'
    | 'clarification-required'
    | 'unsupported'
    | 'insufficient-evidence'
    | 'no-viable-candidate'
    | 'recommend'
    | 'failed';
  readonly finalistCount: number;
  readonly responsibleOptionCount: number;
}

export const NOOP_HOSTED_RECOMMENDATION_OBSERVER: HostedRecommendationObserverV1 =
  Object.freeze({ emit: () => undefined });

export type HostedRecommendationResultV1 =
  | {
      readonly outcome: 'clarification-required';
      readonly normalization: CapabilityQueryNormalizationResultV1;
    }
  | {
      readonly outcome: 'unsupported';
      readonly normalization: CapabilityQueryNormalizationResultV1;
    }
  | {
      readonly outcome: 'insufficient-evidence';
      readonly reasonCode:
        | 'no-positive-candidate-evidence'
        | 'fit-assessment-insufficient-evidence';
      readonly normalization: CapabilityQueryNormalizationResultV1;
      readonly shortlist: CandidateRetrievalResultV1;
      readonly targetFitAssessment: TargetFitAssessmentResponseV1 | null;
      readonly evidenceNeededHardConstraintResolutions:
        readonly EvidenceNeededHardConstraintResolutionV1[] | null;
    }
  | {
      readonly outcome: 'no-viable-candidate';
      readonly normalization: CapabilityQueryNormalizationResultV1;
      readonly shortlist: CandidateRetrievalResultV1;
      readonly targetFitAssessment: TargetFitAssessmentResponseV1 | null;
      readonly evidenceNeededHardConstraintResolutions:
        readonly EvidenceNeededHardConstraintResolutionV1[] | null;
    }
  | {
      readonly outcome: 'recommend';
      readonly normalization: CapabilityQueryNormalizationResultV1;
      readonly responsibleOptions: readonly HostedResponsibleOptionV1[];
      readonly targetFitAssessment: TargetFitAssessmentResponseV1;
      readonly evidenceNeededHardConstraintResolutions: readonly EvidenceNeededHardConstraintResolutionV1[];
    };

export interface HostedResponsibleOptionV1 {
  readonly candidateId: string;
  readonly identity: CandidateDossierV1['identity'];
}

export type HostedRecommendationFailureV1 =
  | {
      readonly kind: 'contract';
      readonly issues: readonly ContractIssue[];
    }
  | {
      readonly kind: 'application';
      readonly code:
        | 'hosted-recommendation-not-ready'
        | 'retrieval-request-construction-failed'
        | 'finalist-evidence-load-failed'
        | 'fit-assessment-request-construction-failed'
        | 'fit-model-failed'
        | 'invalid-target-fit-response';
    }
  | {
      readonly kind: 'retrieval';
      readonly issues: readonly CandidateRetrievalOperationIssueV1[];
    };

export type HostedRecommendationOperationResultV1 =
  | {
      readonly ok: true;
      readonly result: HostedRecommendationResultV1;
    }
  | {
      readonly ok: false;
      readonly failure: HostedRecommendationFailureV1;
    };

export interface HostedRecommendationApplicationV1 {
  readonly snapshot: HostedDiscoverySnapshotV1;
  readonly recommendOss: (
    input: unknown,
  ) => Promise<HostedRecommendationOperationResultV1>;
}

export type HostedRecommendationApplicationCreationResultV1 =
  | {
      readonly ok: true;
      readonly application: HostedRecommendationApplicationV1;
    }
  | {
      readonly ok: false;
      readonly code: 'invalid-application-authority';
    };

export function createHostedRecommendationApplication(input: {
  readonly snapshot: HostedDiscoverySnapshotV1;
  readonly taxonomy: unknown;
  readonly candidateProfileAuthority: unknown;
  readonly retrievalExpansionAuthority: unknown;
  readonly candidateRetrievalMetadataAuthority: unknown;
  readonly engine: CandidateRetrievalEngineV1;
  readonly dossierLoader: CandidateDossierLoaderPort;
  readonly artifactMaterialLoader: CandidateArtifactMaterialLoaderPort;
  readonly fitModel: FitAssessmentModelPort;
  readonly clock: HostedRecommendationClockPort;
  readonly observer?: HostedRecommendationObserverV1;
}): HostedRecommendationApplicationCreationResultV1 {
  const taxonomy = parseCapabilityTaxonomyV1(input.taxonomy);
  const profiles = parseDeterministicCandidateProfileAuthorityV1(
    input.candidateProfileAuthority,
  );
  const expansion = parseCapabilityRetrievalExpansionV1(
    input.retrievalExpansionAuthority,
  );
  const metadata = parseCandidateRetrievalMetadataAuthorityV1(
    input.candidateRetrievalMetadataAuthority,
  );
  if (
    !taxonomy.ok ||
    !profiles.ok ||
    !expansion.ok ||
    !metadata.ok ||
    profiles.value.catalogVersion !== 'public-v1' ||
    input.snapshot.candidateCount !== profiles.value.profiles.length ||
    input.engine.candidateCount !== profiles.value.profiles.length
  ) {
    return Object.freeze({ ok: false, code: 'invalid-application-authority' });
  }
  const candidateAuthority = createCandidateReferenceAuthority(profiles.domain);
  if (candidateAuthority === null) {
    return Object.freeze({ ok: false, code: 'invalid-application-authority' });
  }
  const authorityBindings = createAuthorityBindings(
    taxonomy.value,
    profiles.value,
    expansion.value,
    metadata.value,
  );
  const snapshot = Object.freeze({ ...input.snapshot });
  const observer = input.observer ?? NOOP_HOSTED_RECOMMENDATION_OBSERVER;
  const application: HostedRecommendationApplicationV1 = Object.freeze({
    snapshot,
    recommendOss: (suppliedInput: unknown) =>
      recommendOss({
        suppliedInput,
        taxonomy: taxonomy.value,
        candidateAuthority,
        authorityBindings,
        retrievalExpansionAuthority: expansion.value,
        catalogVersion: 'public-v1',
        catalogDigest: profiles.value.catalogDigest,
        engine: input.engine,
        dossierLoader: input.dossierLoader,
        artifactMaterialLoader: input.artifactMaterialLoader,
        fitModel: input.fitModel,
        clock: input.clock,
        observer,
      }),
  });
  return Object.freeze({ ok: true, application });
}

export function hostedRecommendationNotReady(): HostedRecommendationOperationResultV1 {
  return applicationFailure('hosted-recommendation-not-ready');
}

async function recommendOss(input: {
  readonly suppliedInput: unknown;
  readonly taxonomy: CapabilityTaxonomyV1;
  readonly candidateAuthority: CandidateReferenceAuthority;
  readonly authorityBindings: CandidateRetrievalAuthorityBindingsV1;
  readonly retrievalExpansionAuthority: CapabilityRetrievalExpansionV1;
  readonly catalogVersion: 'public-v1';
  readonly catalogDigest: string;
  readonly engine: CandidateRetrievalEngineV1;
  readonly dossierLoader: CandidateDossierLoaderPort;
  readonly artifactMaterialLoader: CandidateArtifactMaterialLoaderPort;
  readonly fitModel: FitAssessmentModelPort;
  readonly clock: HostedRecommendationClockPort;
  readonly observer: HostedRecommendationObserverV1;
}): Promise<HostedRecommendationOperationResultV1> {
  const parsed = parseOssRecommendationRequestV1(input.suppliedInput);
  if (!parsed.ok) {
    return Object.freeze({
      ok: false,
      failure: Object.freeze({ kind: 'contract', issues: parsed.issues }),
    });
  }
  const requestId = parsed.value.recommendationRequestId;
  emit(input.observer, event(requestId, 'validated', 'in-progress'));
  const normalized = normalizeCapabilityQueryV1(
    parsed.value.capabilityQuery,
    input.taxonomy,
    input.candidateAuthority,
  );
  if (!normalized.ok) {
    return Object.freeze({
      ok: false,
      failure: Object.freeze({ kind: 'contract', issues: normalized.issues }),
    });
  }
  if (normalized.value.outcome !== 'normalized') {
    emit(
      input.observer,
      event(requestId, 'completed', normalized.value.outcome),
    );
    return successful({
      outcome: normalized.value.outcome,
      normalization: normalized.value,
    });
  }
  emit(input.observer, event(requestId, 'normalized', 'in-progress'));

  let retrievalRequest;
  try {
    retrievalRequest = createCandidateRetrievalRequestV1({
      normalization: normalized.value,
      authorityBindings: input.authorityBindings,
      eligibleResultLimit: DISCOVERY_RESULT_LIMIT,
      evidenceNeededResultLimit: DISCOVERY_RESULT_LIMIT,
    });
  } catch {
    return failed(
      input.observer,
      requestId,
      'retrieval-request-construction-failed',
    );
  }
  const retrieved = input.engine.retrieve(retrievalRequest);
  if (!retrieved.ok) {
    emit(input.observer, event(requestId, 'failed', 'failed'));
    return Object.freeze({
      ok: false,
      failure: Object.freeze({ kind: 'retrieval', issues: retrieved.issues }),
    });
  }
  emit(
    input.observer,
    event(
      requestId,
      'retrieved',
      'in-progress',
      selectHostedRetrievalFinalistsV1(retrieved.result).length,
    ),
  );
  const finalists = selectHostedRetrievalFinalistsV1(retrieved.result);
  if (finalists.length === 0) {
    emit(input.observer, event(requestId, 'completed', 'no-viable-candidate'));
    return successful({
      outcome: 'no-viable-candidate',
      normalization: normalized.value,
      shortlist: retrieved.result,
      targetFitAssessment: null,
      evidenceNeededHardConstraintResolutions: null,
    });
  }
  const evidenceCutoff = trustedTimestamp(input.clock);
  if (evidenceCutoff === null || normalized.value.primaryFamilyId === null) {
    return failed(
      input.observer,
      requestId,
      'fit-assessment-request-construction-failed',
      finalists.length,
    );
  }
  const capabilityFamily = normalized.value.primaryFamilyId;
  let dossiers: readonly CandidateDossierV1[];
  try {
    dossiers = await Promise.all(
      finalists.map(async ({ candidateId }) => {
        const dossier = await input.dossierLoader.loadActiveCandidateDossier({
          candidateId,
          expectedCapabilityFamily: capabilityFamily,
          evidenceCutoff,
        });
        const parsedDossier = parseCandidateDossierV1(dossier);
        if (
          !parsedDossier.ok ||
          parsedDossier.value.identity.candidateId !== candidateId ||
          parsedDossier.value.capabilityFamily !== capabilityFamily
        ) {
          throw new Error('Finalist dossier validation failed.');
        }
        return parsedDossier.value;
      }),
    );
  } catch {
    return failed(
      input.observer,
      requestId,
      'finalist-evidence-load-failed',
      finalists.length,
    );
  }
  try {
    const materialByCandidateId = new Map(
      await Promise.all(
        finalists
          .filter(({ lane }) => lane === 'evidence-needed')
          .map(async (finalist) => {
            const dossier = dossiers.find(
              ({ identity }) => identity.candidateId === finalist.candidateId,
            );
            const commitSha =
              dossier === undefined ? null : repositoryHeadCommit(dossier);
            if (commitSha === null) {
              return [finalist.candidateId, null] as const;
            }
            const material =
              await input.artifactMaterialLoader.loadCandidateRepositoryArtifactMaterial(
                {
                  candidateId: finalist.candidateId,
                  expectedCatalogVersion: input.catalogVersion,
                  expectedCatalogDigest: input.catalogDigest,
                  commitSha,
                  evidenceCutoff,
                },
              );
            return [finalist.candidateId, material] as const;
          }),
      ),
    );
    let remainingArtifactObservations =
      MAX_ARTIFACT_EVIDENCE_PER_RECOMMENDATION;
    dossiers = dossiers.map((dossier, index) => {
      const finalist = finalists[index];
      if (finalist?.lane !== 'evidence-needed') return dossier;
      const material = materialByCandidateId.get(finalist.candidateId);
      if (material === null || material === undefined) return dossier;
      const selected = selectCandidateArtifactEvidenceV1({
        finalist,
        dossier,
        capabilityQuery: parsed.value.capabilityQuery,
        normalization: normalized.value,
        retrievalExpansionAuthority: input.retrievalExpansionAuthority,
        material,
        maximumObservations: Math.min(
          MAX_ARTIFACT_EVIDENCE_PER_CANDIDATE,
          remainingArtifactObservations,
        ),
      });
      remainingArtifactObservations -= selected.length;
      if (selected.length === 0) return dossier;
      const augmented = parseCandidateDossierV1({
        ...dossier,
        observations: [...dossier.observations, ...selected],
      });
      if (!augmented.ok) {
        throw new Error('Finalist artifact evidence validation failed.');
      }
      return augmented.value;
    });
  } catch {
    return failed(
      input.observer,
      requestId,
      'finalist-evidence-load-failed',
      finalists.length,
    );
  }
  emit(
    input.observer,
    event(requestId, 'evidence-loaded', 'in-progress', dossiers.length),
  );
  if (dossiers.every(({ observations }) => observations.length === 0)) {
    emit(
      input.observer,
      event(requestId, 'completed', 'insufficient-evidence', dossiers.length),
    );
    return successful({
      outcome: 'insufficient-evidence',
      reasonCode: 'no-positive-candidate-evidence',
      normalization: normalized.value,
      shortlist: retrieved.result,
      targetFitAssessment: null,
      evidenceNeededHardConstraintResolutions: null,
    });
  }

  let fitRequest: FitAssessmentRequestV1;
  try {
    const candidateMaximum = Math.min(
      HOSTED_RESPONSIBLE_OPTION_LIMIT,
      dossiers.length,
    );
    const candidate = {
      contractVersion: '1.0.0',
      assessmentRequestId: requestId,
      capabilityRequest: createCapabilityRequestFromRecommendationV1({
        recommendationRequest: parsed.value,
        normalization: normalized.value,
      }),
      repositoryFingerprint: parsed.value.repositoryFingerprint,
      candidates: [...dossiers],
      evidenceCutoff,
      requestedMaximumResults: candidateMaximum,
      correlationId: requestId,
    } satisfies FitAssessmentRequestV1;
    const validated = parseFitAssessmentRequestV1(candidate);
    if (!validated.ok) throw new Error('Fit request validation failed.');
    fitRequest = validated.value;
  } catch {
    return failed(
      input.observer,
      requestId,
      'fit-assessment-request-construction-failed',
      dossiers.length,
    );
  }

  let modelOutput: unknown;
  try {
    modelOutput = await input.fitModel.assess({
      fitAssessmentRequest:
        createRecommendationAssessmentModelFitRequestV1(fitRequest),
      normalization: normalized.value,
      retrievalFinalists: finalists.map(
        ({ candidateId, lane, unresolvedHardEvaluations }) => ({
          candidateId,
          lane,
          unresolvedHardEvaluations,
        }),
      ),
    });
  } catch {
    return failed(
      input.observer,
      requestId,
      'fit-model-failed',
      dossiers.length,
    );
  }
  emit(
    input.observer,
    event(requestId, 'model-completed', 'in-progress', dossiers.length),
  );
  const producedAt = trustedTimestamp(input.clock);
  if (producedAt === null) {
    return failed(
      input.observer,
      requestId,
      'invalid-target-fit-response',
      dossiers.length,
    );
  }
  const validated = validateRecommendationModelAssessmentExchangeV1({
    request: fitRequest,
    normalization: normalized.value,
    retrievalFinalists: finalists,
    response: modelOutput,
    assessmentId: mintRequestBoundAssessmentId(fitRequest),
    producedAt,
  });
  if (!validated.ok) {
    return failed(
      input.observer,
      requestId,
      'invalid-target-fit-response',
      dossiers.length,
    );
  }
  const response = validated.response.targetFitAssessment;
  const resolutions =
    validated.response.evidenceNeededHardConstraintResolutions;
  if (response.fitAssessment.outcome === 'insufficient-evidence') {
    emit(
      input.observer,
      event(requestId, 'completed', 'insufficient-evidence', dossiers.length),
    );
    return successful({
      outcome: 'insufficient-evidence',
      reasonCode: 'fit-assessment-insufficient-evidence',
      normalization: normalized.value,
      shortlist: retrieved.result,
      targetFitAssessment: response,
      evidenceNeededHardConstraintResolutions: resolutions,
    });
  }
  if (response.fitAssessment.outcome === 'no-viable-candidate') {
    emit(
      input.observer,
      event(requestId, 'completed', 'no-viable-candidate', dossiers.length),
    );
    return successful({
      outcome: 'no-viable-candidate',
      normalization: normalized.value,
      shortlist: retrieved.result,
      targetFitAssessment: response,
      evidenceNeededHardConstraintResolutions: resolutions,
    });
  }
  const responsibleCandidateIds = rankedCandidateIds(response);
  if (
    responsibleCandidateIds.length < 1 ||
    responsibleCandidateIds.length > HOSTED_RESPONSIBLE_OPTION_LIMIT
  ) {
    return failed(
      input.observer,
      requestId,
      'invalid-target-fit-response',
      dossiers.length,
    );
  }
  const dossierById = new Map(
    dossiers.map((dossier) => [dossier.identity.candidateId, dossier]),
  );
  const responsibleOptions: HostedResponsibleOptionV1[] = [];
  for (const candidateId of responsibleCandidateIds) {
    const dossier = dossierById.get(candidateId);
    if (dossier === undefined) {
      return failed(
        input.observer,
        requestId,
        'invalid-target-fit-response',
        dossiers.length,
      );
    }
    responsibleOptions.push(
      Object.freeze({ candidateId, identity: dossier.identity }),
    );
  }
  emit(
    input.observer,
    event(
      requestId,
      'completed',
      'recommend',
      dossiers.length,
      responsibleOptions.length,
    ),
  );
  return successful({
    outcome: 'recommend',
    normalization: normalized.value,
    responsibleOptions,
    targetFitAssessment: response,
    evidenceNeededHardConstraintResolutions: resolutions,
  });
}

function repositoryHeadCommit(dossier: CandidateDossierV1): string | null {
  const heads = dossier.observations.filter(
    ({ topic }) => topic === 'repository-head',
  );
  if (heads.length !== 1) return null;
  const source = heads[0]?.source;
  return source?.kind === 'git-commit' &&
    source.sourceType === 'official-repository'
    ? source.commitSha
    : null;
}

export function selectHostedRetrievalFinalistsV1(
  retrieval: Pick<
    CandidateRetrievalResultV1,
    'eligibleCandidates' | 'evidenceNeededCandidates'
  >,
): readonly CandidateRetrievalCandidateV1[] {
  const eligible = retrieval.eligibleCandidates.slice(
    0,
    HOSTED_FIT_FINALIST_LIMIT,
  );
  const remaining = HOSTED_FIT_FINALIST_LIMIT - eligible.length;
  return Object.freeze([
    ...eligible,
    ...retrieval.evidenceNeededCandidates.slice(0, remaining),
  ]);
}

function createCandidateReferenceAuthority(
  authority: DeterministicCandidateProfileAuthority,
): CandidateReferenceAuthority | null {
  const candidates: CandidateReferenceAuthority['candidates'][number][] = [];
  for (const profile of authority.profiles) {
    const family = knownField(profile, 'capability-family');
    const repository = knownField(profile, 'repository-identity');
    const packageMapping = knownField(profile, 'package-identity-mapping');
    if (family === null || repository === null || packageMapping === null) {
      return null;
    }
    candidates.push({
      candidateId: profile.candidateId,
      capabilityFamily: family.value.primaryFamily,
      repositoryKey:
        `${repository.value.githubOwner}/${repository.value.githubRepository}`.toLowerCase(),
      npmPackageKey:
        packageMapping.value.mapping === 'mapped'
          ? packageMapping.value.packageName.toLowerCase()
          : null,
    });
  }
  const validated = validateCandidateReferenceAuthority({
    catalogVersion: authority.catalogVersion,
    catalogDigest: authority.catalogDigest,
    candidates,
  });
  return validated.ok ? validated.value : null;
}

function createAuthorityBindings(
  taxonomy: CapabilityTaxonomyV1,
  profiles: DeterministicCandidateProfileAuthorityV1,
  expansion: CapabilityRetrievalExpansionV1,
  metadata: CandidateRetrievalMetadataAuthorityV1,
): CandidateRetrievalAuthorityBindingsV1 {
  return Object.freeze({
    taxonomy: Object.freeze({
      taxonomyVersion: taxonomy.taxonomyVersion,
      taxonomySemanticDigest: taxonomy.semanticDigest,
    }),
    candidateProfiles: Object.freeze({
      authorityVersion: profiles.authorityVersion,
      semanticAuthorityDigest: profiles.semanticAuthorityDigest,
      profileRulesVersion: profiles.profileRulesVersion,
    }),
    catalog: Object.freeze({
      catalogVersion: profiles.catalogVersion,
      catalogDigest: profiles.catalogDigest,
    }),
    candidateConstraintEvaluationVersion:
      CANDIDATE_CONSTRAINT_EVALUATION_VERSION,
    retrievalExpansion: Object.freeze({
      authorityVersion: expansion.expansionVersion,
      semanticDigest: expansion.semanticDigest,
    }),
    retrievalMetadata: Object.freeze({
      authorityVersion: metadata.authorityVersion,
      authoritySemanticDigest: metadata.authoritySemanticDigest,
    }),
  });
}

function knownField<Id extends DeterministicProfileFieldId>(
  profile: DeterministicCandidateProfile,
  fieldId: Id,
): Extract<
  DeterministicProfileFieldRecord<Id>,
  { readonly state: 'known' }
> | null {
  const field = profile.fields.find(
    (candidate) => candidate.fieldId === fieldId,
  ) as DeterministicProfileFieldRecord<Id> | undefined;
  return field?.state === 'known' ? field : null;
}

function rankedCandidateIds(
  response: TargetFitAssessmentResponseV1,
): readonly string[] {
  const ids = new Set<string>();
  for (const group of response.fitAssessment.rankGroups) {
    for (const candidateId of group.candidateIds) ids.add(candidateId);
  }
  for (const relation of response.fitAssessment.rankRelations) {
    ids.add(relation.higherCandidateId);
    ids.add(relation.lowerCandidateId);
  }
  for (const pair of response.fitAssessment.incomparablePairs) {
    ids.add(pair.leftCandidateId);
    ids.add(pair.rightCandidateId);
  }
  return [...ids];
}

function trustedTimestamp(clock: HostedRecommendationClockPort): string | null {
  try {
    const value = clock.now();
    const parsed = Date.parse(value);
    if (
      !/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/u.test(
        value,
      ) ||
      !Number.isFinite(parsed) ||
      new Date(parsed).toISOString() !== value
    ) {
      return null;
    }
    return new Date(parsed).toISOString();
  } catch {
    return null;
  }
}

function mintRequestBoundAssessmentId(request: FitAssessmentRequestV1): string {
  const digest = createHash('sha256')
    .update('gitblocks-fit-assessment-v1\0', 'utf8')
    .update(request.assessmentRequestId, 'utf8')
    .update('\0', 'utf8')
    .update(request.correlationId, 'utf8')
    .update('\0', 'utf8')
    .update(request.evidenceCutoff, 'utf8')
    .digest('hex');
  return `assessment-${digest.slice(0, 53)}`;
}

function successful(
  result: HostedRecommendationResultV1,
): HostedRecommendationOperationResultV1 {
  return Object.freeze({ ok: true, result: Object.freeze(result) });
}

function applicationFailure(
  code: Extract<
    HostedRecommendationFailureV1,
    { readonly kind: 'application' }
  >['code'],
): HostedRecommendationOperationResultV1 {
  return Object.freeze({
    ok: false,
    failure: Object.freeze({ kind: 'application', code }),
  });
}

function failed(
  observer: HostedRecommendationObserverV1,
  requestId: string,
  code: Extract<
    HostedRecommendationFailureV1,
    { readonly kind: 'application' }
  >['code'],
  finalistCount = 0,
): HostedRecommendationOperationResultV1 {
  emit(observer, event(requestId, 'failed', 'failed', finalistCount));
  return applicationFailure(code);
}

function event(
  recommendationRequestId: string,
  stage: HostedRecommendationEventV1['stage'],
  outcome: HostedRecommendationEventV1['outcome'],
  finalistCount = 0,
  responsibleOptionCount = 0,
): HostedRecommendationEventV1 {
  return Object.freeze({
    operation: 'hosted.recommendation',
    recommendationRequestId,
    stage,
    outcome,
    finalistCount,
    responsibleOptionCount,
  });
}

function emit(
  observer: HostedRecommendationObserverV1,
  value: HostedRecommendationEventV1,
): void {
  try {
    observer.emit(value);
  } catch {
    // Telemetry must not alter recommendation semantics.
  }
}
