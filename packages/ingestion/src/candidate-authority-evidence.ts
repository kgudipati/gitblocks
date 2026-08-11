import {
  parseCandidateDossierV1,
  parseDeterministicCandidateProfileV1,
  type CandidateDossierV1,
  type DeterministicCandidateProfileV1,
  type DeterministicProfileFieldRecord,
} from '@gitblocks/contracts';

import { canonicalizeJson, stableId } from './canonical-json.ts';
import type {
  CandidateAuthorityDecisionFieldId,
  CandidateAuthorityFieldPlan,
} from './candidate-authority-contracts.ts';
import { ingestionError } from './errors.ts';

type EvidenceSource = CandidateDossierV1['observations'][number]['source'];
type ProfileField = DeterministicProfileFieldRecord;

export interface CandidateAuthorityEvidenceBinding {
  readonly fieldId: CandidateAuthorityDecisionFieldId;
  readonly fieldValueDigest: string;
  readonly source: EvidenceSource;
}

export interface CandidateAuthorityDossierProjection {
  readonly candidateId: string;
  readonly deterministicProfileDigest: string;
  readonly dossier: CandidateDossierV1;
  readonly dossierDigest: string;
  readonly fieldEvidenceBindings: readonly {
    readonly fieldId: CandidateAuthorityDecisionFieldId;
    readonly evidenceId: string;
    readonly evidenceDigest: string;
  }[];
}

export function projectCandidateAuthorityDossier(input: {
  readonly profile: DeterministicCandidateProfileV1;
  readonly fieldPlan: CandidateAuthorityFieldPlan;
  readonly evidenceBindings: readonly CandidateAuthorityEvidenceBinding[];
  readonly collectionCutoff: string;
}): CandidateAuthorityDossierProjection {
  const collectionCutoff = Date.parse(input.collectionCutoff);
  if (!Number.isFinite(collectionCutoff)) invalid();
  const parsedProfile = parseDeterministicCandidateProfileV1(input.profile);
  if (!parsedProfile.ok) invalid();
  const profile = parsedProfile.value;
  const identity = requireKnownField(profile, 'repository-identity');
  const family = requireKnownField(profile, 'capability-family');
  const packageMapping = requireKnownField(profile, 'package-identity-mapping');
  if (
    !isRecord(identity) ||
    !isRecord(family) ||
    !isRecord(packageMapping) ||
    typeof identity['displayName'] !== 'string' ||
    typeof identity['githubOwner'] !== 'string' ||
    typeof identity['githubRepository'] !== 'string' ||
    typeof family['primaryFamily'] !== 'string' ||
    (packageMapping['mapping'] !== 'mapped' &&
      packageMapping['mapping'] !== 'unmapped')
  ) {
    invalid();
  }

  const planByField = new Map(
    input.fieldPlan.fields.map((entry) => [entry.fieldId, entry]),
  );
  const bindingsByField = uniqueBindings(input.evidenceBindings);
  const observations: CandidateDossierV1['observations'][number][] = [];
  const limitations: CandidateDossierV1['limitations'][number][] = [];
  const unknowns: CandidateDossierV1['unknowns'][number][] = [];
  const fieldEvidenceBindings: CandidateAuthorityDossierProjection['fieldEvidenceBindings'][number][] =
    [];

  const profileFields = profile.fields as unknown as readonly ProfileField[];
  for (const field of profileFields) {
    if (!planByField.has(field.fieldId as CandidateAuthorityDecisionFieldId)) {
      continue;
    }
    const fieldId = field.fieldId as CandidateAuthorityDecisionFieldId;
    const plan = planByField.get(fieldId);
    if (plan === undefined) invalid();
    if (field.state === 'known') {
      const binding = bindingsByField.get(fieldId);
      if (
        binding?.fieldValueDigest !== canonicalizeJson(field.value).digest ||
        binding.source.kind !== plan.evidenceProvenanceKind
      ) {
        invalid();
      }
      const observationText = deterministicObservation(fieldId, field.value);
      const freshnessAsOf = sourceAsOf(binding.source);
      const freshnessTime = Date.parse(freshnessAsOf);
      if (!Number.isFinite(freshnessTime) || freshnessTime > collectionCutoff)
        invalid();
      const evidenceId = stableId('evidence', {
        candidateId: profile.candidateId,
        fieldId,
        fieldValueDigest: binding.fieldValueDigest,
        source: binding.source,
      });
      const mutable = binding.source.kind === 'structured-provider-snapshot';
      const observation: CandidateDossierV1['observations'][number] = {
        kind: 'evidence',
        evidenceId,
        candidateId: profile.candidateId,
        topic: plan.evidenceTopic,
        dimension: plan.evidenceDimension,
        observation: observationText,
        source: binding.source,
        freshness: {
          status: 'current',
          asOf: freshnessAsOf,
          scope: `Field ${fieldId} at the committed candidate-authority cutoff.`,
        },
        directness: 'direct',
        limitation: mutable
          ? 'Structured provider state is mutable; the claim is limited to the committed snapshot.'
          : null,
      };
      observations.push(observation);
      fieldEvidenceBindings.push({
        fieldId,
        evidenceId,
        evidenceDigest: canonicalizeJson(observation).digest,
      });
      if (mutable) {
        limitations.push({
          limitationId: stableId('limitation', {
            candidateId: profile.candidateId,
            evidenceId,
            limitationCode: 'source-is-mutable',
          }),
          limitationCode: 'source-is-mutable',
          candidateId: profile.candidateId,
          statement:
            'This deterministic field is authoritative only at the committed structured-provider snapshot.',
          evidenceIds: [evidenceId],
        });
      }
      continue;
    }
    if (field.state === 'unknown' || field.state === 'conflict') {
      if (bindingsByField.has(fieldId)) invalid();
      unknowns.push({
        scope: 'candidate',
        unknownId: stableId('unknown', {
          candidateId: profile.candidateId,
          fieldId,
          state: field.state,
        }),
        candidateId: profile.candidateId,
        topic: plan.evidenceTopic,
        statement: `Field ${fieldId} remains ${field.state} under ${plan.extractionRuleVersion}; no negative claim was inferred.`,
        evidenceIds: [],
      });
    }
  }
  if (
    [...bindingsByField.keys()].some(
      (fieldId) =>
        !profileFields.some(
          (field) => field.fieldId === fieldId && field.state === 'known',
        ),
    )
  ) {
    invalid();
  }

  const dossierCandidate = {
    contractVersion: '1.0.0',
    identity: {
      candidateId: profile.candidateId,
      displayName: identity['displayName'],
      repository: {
        host: 'github' as const,
        owner: identity['githubOwner'],
        name: identity['githubRepository'],
      },
      package:
        packageMapping['mapping'] === 'mapped' &&
        typeof packageMapping['packageName'] === 'string'
          ? {
              registry: 'npm' as const,
              name: packageMapping['packageName'],
            }
          : null,
    },
    capabilityFamily: family['primaryFamily'],
    versionScope: profile.semanticProfileDigest,
    observations: sortById(observations, 'evidenceId'),
    limitations: sortById(limitations, 'limitationId'),
    unknowns: sortById(unknowns, 'unknownId'),
  };
  const parsed = parseCandidateDossierV1(dossierCandidate);
  if (!parsed.ok) invalid();
  const dossier = parsed.value;
  return {
    candidateId: profile.candidateId,
    deterministicProfileDigest: profile.semanticProfileDigest,
    dossier,
    dossierDigest: canonicalizeJson(dossier).digest,
    fieldEvidenceBindings: [...fieldEvidenceBindings].sort((left, right) =>
      compare(left.fieldId, right.fieldId),
    ),
  };
}

function requireKnownField(
  profile: DeterministicCandidateProfileV1,
  fieldId: ProfileField['fieldId'],
): unknown {
  const fields = profile.fields as unknown as readonly ProfileField[];
  const field = fields.find((candidate) => candidate.fieldId === fieldId);
  if (field?.state !== 'known') invalid();
  return field.value;
}

function uniqueBindings(
  bindings: readonly CandidateAuthorityEvidenceBinding[],
): ReadonlyMap<
  CandidateAuthorityDecisionFieldId,
  CandidateAuthorityEvidenceBinding
> {
  const result = new Map<
    CandidateAuthorityDecisionFieldId,
    CandidateAuthorityEvidenceBinding
  >();
  for (const binding of bindings) {
    if (result.has(binding.fieldId)) invalid();
    result.set(binding.fieldId, binding);
  }
  return result;
}

function deterministicObservation(
  fieldId: CandidateAuthorityDecisionFieldId,
  value: unknown,
): string {
  const text = `field=${fieldId}; state=known; structuredValue=${canonicalizeJson(value).text}`;
  if (text.length > 2_000) invalid();
  return text;
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

function sortById<T extends Readonly<Record<K, string>>, K extends string>(
  values: readonly T[],
  key: K,
): T[] {
  return [...values].sort((left, right) => compare(left[key], right[key]));
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(): never {
  throw ingestionError('ingestion.invalid-input');
}
