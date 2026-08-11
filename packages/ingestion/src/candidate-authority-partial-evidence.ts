import {
  parseCandidateDossierV1,
  type CandidateDossierV1,
} from '@gitblocks/contracts';

import { canonicalizeJson, stableId } from './canonical-json.ts';
import type { CandidateAuthorityDossierProjection } from './candidate-authority-evidence.ts';
import type { CandidateAuthorityDecisionFieldId } from './candidate-authority-contracts.ts';
import type { CandidateAuthorityFieldPlanV2 } from './candidate-authority-readiness.ts';
import { ingestionError } from './errors.ts';

export const CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_VERSION =
  'candidate-authority-partial-field-evidence/1.0.0' as const;

export const CANDIDATE_AUTHORITY_PARTIAL_FACT_CODES = Object.freeze([
  'applicable-security-advisory',
  'compose-service-declaration',
  'declared-datastore-runtime-dependency',
  'declared-framework-compatibility-dependency',
  'npm-package-ecosystem',
  'published-installable-package',
  'published-release',
  'recognized-license-spdx',
] as const);

export type CandidateAuthorityPartialFactCode =
  (typeof CANDIDATE_AUTHORITY_PARTIAL_FACT_CODES)[number];
type EvidenceSource = CandidateDossierV1['observations'][number]['source'];

export interface CandidateAuthorityPartialFieldEvidence {
  readonly authorityVersion: typeof CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_VERSION;
  readonly partialEvidenceId: string;
  readonly candidateId: string;
  readonly fieldId: CandidateAuthorityDecisionFieldId;
  readonly extractionRuleVersion: string;
  readonly factCode: CandidateAuthorityPartialFactCode;
  readonly factValue: string;
  readonly polarity: 'affirmative' | 'negative';
  readonly source: EvidenceSource;
  readonly sourceReference: {
    readonly sourceAuthorityVersion: string;
    readonly sourceAuthorityDigest: string;
    readonly sourceRecordDigest: string;
    readonly evidenceIds: readonly string[];
  };
  readonly sourceCompleteness: 'complete' | 'partial';
  readonly fieldCompleteness: 'complete' | 'partial';
  readonly unresolvedRemainder: string | null;
  readonly freshness: {
    readonly cutoff: string;
    readonly asOf: string;
  };
  readonly canonicalDigest: string;
}

export interface CandidateAuthorityPartialDossierProjection {
  readonly candidateId: string;
  readonly dossier: CandidateDossierV1;
  readonly dossierDigest: string;
  readonly partialFieldEvidenceBindings: readonly {
    readonly partialEvidenceId: string;
    readonly fieldId: CandidateAuthorityDecisionFieldId;
    readonly evidenceId: string;
    readonly evidenceDigest: string;
  }[];
}

export function createCandidateAuthorityPartialFieldEvidence(
  input: Omit<
    CandidateAuthorityPartialFieldEvidence,
    'authorityVersion' | 'canonicalDigest' | 'partialEvidenceId'
  >,
): CandidateAuthorityPartialFieldEvidence {
  if (
    !isStableId(input.candidateId) ||
    !isStableId(input.extractionRuleVersion) ||
    !CANDIDATE_AUTHORITY_PARTIAL_FACT_CODES.includes(input.factCode) ||
    input.factValue.length < 1 ||
    input.factValue.length > 500 ||
    !isTimestamp(input.freshness.cutoff) ||
    !isTimestamp(input.freshness.asOf) ||
    Date.parse(input.freshness.asOf) > Date.parse(input.freshness.cutoff) ||
    !isDigest(input.sourceReference.sourceAuthorityDigest) ||
    !isDigest(input.sourceReference.sourceRecordDigest) ||
    !isStableId(input.sourceReference.sourceAuthorityVersion) ||
    (input.source.kind === 'structured-provider-snapshot' &&
      (input.source.sourceAuthorityDigest !==
        input.sourceReference.sourceAuthorityDigest ||
        input.source.sourceRecordDigest !==
          input.sourceReference.sourceRecordDigest)) ||
    new Set(input.sourceReference.evidenceIds).size !==
      input.sourceReference.evidenceIds.length ||
    input.sourceReference.evidenceIds.some((value) => !isStableId(value)) ||
    (input.polarity === 'negative' &&
      input.sourceCompleteness !== 'complete') ||
    (input.fieldCompleteness === 'partial' &&
      (input.unresolvedRemainder === null ||
        input.unresolvedRemainder.length < 1)) ||
    (input.fieldCompleteness === 'complete' &&
      input.unresolvedRemainder !== null)
  )
    invalid();
  const withoutDigest = {
    authorityVersion: CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_VERSION,
    partialEvidenceId: stableId('partial-field', input),
    ...input,
  } as const;
  return Object.freeze({
    ...withoutDigest,
    canonicalDigest: canonicalizeJson(withoutDigest).digest,
  });
}

export function projectPartialFieldEvidenceToDossier(input: {
  readonly completeProjection: CandidateAuthorityDossierProjection;
  readonly fieldPlan: CandidateAuthorityFieldPlanV2;
  readonly partialEvidence: readonly CandidateAuthorityPartialFieldEvidence[];
}): CandidateAuthorityPartialDossierProjection {
  const dossier = input.completeProjection.dossier;
  const planByField = new Map(
    input.fieldPlan.fields.map((field) => [field.fieldId, field]),
  );
  const observations = [...dossier.observations];
  const limitations = [...dossier.limitations];
  const unknowns = [...dossier.unknowns];
  const bindings: CandidateAuthorityPartialDossierProjection['partialFieldEvidenceBindings'][number][] =
    [];
  const seenPartialIds = new Set<string>();
  const seenEvidenceIds = new Set(
    observations.map((observation) => observation.evidenceId),
  );

  for (const partial of [...input.partialEvidence].sort((left, right) =>
    compare(left.partialEvidenceId, right.partialEvidenceId),
  )) {
    const plan = planByField.get(partial.fieldId);
    if (
      partial.candidateId !== dossier.identity.candidateId ||
      plan === undefined ||
      !plan.deterministicExtractionEligible ||
      plan.extractionRuleVersion !== partial.extractionRuleVersion ||
      plan.evidenceProvenanceKind !== partial.source.kind ||
      (partial.source.kind === 'structured-provider-snapshot' &&
        partial.source.completenessState !== partial.sourceCompleteness) ||
      (partial.source.kind !== 'structured-provider-snapshot' &&
        partial.sourceCompleteness !== 'complete') ||
      seenPartialIds.has(partial.partialEvidenceId) ||
      partial.canonicalDigest !==
        canonicalizeJson(withoutCanonicalDigest(partial)).digest
    )
      invalid();
    seenPartialIds.add(partial.partialEvidenceId);
    const unknownIndex = unknowns.findIndex((unknown) =>
      unknown.statement.startsWith(`Field ${partial.fieldId} remains `),
    );
    if (partial.fieldCompleteness === 'partial' && unknownIndex < 0) invalid();
    const evidenceId = stableId('evidence', {
      candidateId: partial.candidateId,
      fieldId: partial.fieldId,
      partialEvidenceDigest: partial.canonicalDigest,
      source: partial.source,
    });
    if (seenEvidenceIds.has(evidenceId)) invalid();
    seenEvidenceIds.add(evidenceId);
    const observation: CandidateDossierV1['observations'][number] = {
      kind: 'evidence',
      evidenceId,
      candidateId: partial.candidateId,
      topic: plan.evidenceTopic,
      dimension: plan.evidenceDimension,
      observation: `field=${partial.fieldId}; fieldCompleteness=${partial.fieldCompleteness}; polarity=${partial.polarity}; factCode=${partial.factCode}; structuredValue=${canonicalizeJson(partial.factValue).text}`,
      source: partial.source,
      freshness: {
        status: 'current',
        asOf: partial.freshness.asOf,
        scope: `Direct deterministic fact at cutoff ${partial.freshness.cutoff}; unmentioned field concepts remain unresolved.`,
      },
      directness: 'direct',
      limitation:
        partial.fieldCompleteness === 'partial'
          ? partial.unresolvedRemainder
          : null,
    };
    observations.push(observation);
    if (unknownIndex >= 0) {
      const unknown = unknowns[unknownIndex];
      if (unknown === undefined) invalid();
      unknowns[unknownIndex] = {
        ...unknown,
        statement: `${unknown.statement} Direct evidence establishes only ${partial.factCode}; all unmentioned concepts remain unknown.`,
        evidenceIds: [...unknown.evidenceIds, evidenceId].sort(compare),
      };
    }
    if (partial.fieldCompleteness === 'partial') {
      const unresolvedRemainder = partial.unresolvedRemainder;
      if (unresolvedRemainder === null) invalid();
      limitations.push({
        limitationId: stableId('limitation', {
          candidateId: partial.candidateId,
          fieldId: partial.fieldId,
          partialEvidenceId: partial.partialEvidenceId,
        }),
        limitationCode: `field-remains-partial-${partial.fieldId}`,
        candidateId: partial.candidateId,
        statement: unresolvedRemainder,
        evidenceIds: [evidenceId],
      });
    }
    bindings.push({
      partialEvidenceId: partial.partialEvidenceId,
      fieldId: partial.fieldId,
      evidenceId,
      evidenceDigest: canonicalizeJson(observation).digest,
    });
  }

  const candidate = {
    ...dossier,
    observations: sortById(observations, 'evidenceId'),
    limitations: sortById(limitations, 'limitationId'),
    unknowns: sortById(unknowns, 'unknownId'),
  };
  const parsed = parseCandidateDossierV1(candidate);
  if (!parsed.ok) invalid();
  return {
    candidateId: dossier.identity.candidateId,
    dossier: parsed.value,
    dossierDigest: canonicalizeJson(parsed.value).digest,
    partialFieldEvidenceBindings: bindings.sort((left, right) =>
      compare(left.partialEvidenceId, right.partialEvidenceId),
    ),
  };
}

function withoutCanonicalDigest(
  value: CandidateAuthorityPartialFieldEvidence,
): Omit<CandidateAuthorityPartialFieldEvidence, 'canonicalDigest'> {
  const { canonicalDigest: ignored, ...result } = value;
  void ignored;
  return result;
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

function isStableId(value: string): boolean {
  return /^[a-z0-9][a-z0-9._/-]{0,199}$/u.test(value);
}

function isDigest(value: string): boolean {
  return /^[a-f0-9]{64}$/u.test(value);
}

function isTimestamp(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function invalid(): never {
  throw ingestionError('ingestion.invalid-input');
}
