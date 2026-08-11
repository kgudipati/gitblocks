/* eslint-disable @typescript-eslint/no-unnecessary-condition -- These checks revalidate typed records at a persisted trust boundary. */

import {
  parseCandidateDossierV1,
  type CandidateDossierV1,
} from '@gitblocks/contracts';

import { canonicalizeJson, stableId } from './canonical-json.ts';
import type { CandidateAuthorityDecisionFieldId } from './candidate-authority-contracts.ts';
import type { CandidateAuthorityDossierProjection } from './candidate-authority-evidence.ts';
import {
  CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_V3_VERSION,
  parseCandidateAuthorityPartialSemanticRegistry,
  parseCandidateAuthorityPartialSemanticRegistryV3,
  validateCandidateAuthorityPartialFact,
  type CandidateAuthorityPartialFactCode,
  type CandidateAuthorityPartialSemanticRegistry,
} from './candidate-authority-partial-semantics.ts';
import type { CandidateAuthorityFieldPlanV4 } from './candidate-authority-readiness.ts';
import { ingestionError } from './errors.ts';

export const CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_VERSION =
  'candidate-authority-partial-field-evidence/3.0.0' as const;
export const CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_CONTRACT_DIGEST =
  '6020d9ec109e73242cf110aad468beca29b3aed79838f419c5e23d0f714b4e8e' as const;

type EvidenceSource = CandidateDossierV1['observations'][number]['source'];

export interface CandidateAuthorityPartialFieldEvidence {
  readonly authorityVersion: typeof CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_VERSION;
  readonly semanticRegistryVersion: CandidateAuthorityPartialSemanticRegistry['registryVersion'];
  readonly semanticRegistryDigest: string;
  readonly factDefinitionDigest: string;
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
    readonly factDefinitionDigest: string;
    readonly evidenceId: string;
    readonly evidenceDigest: string;
  }[];
}

type PartialEvidenceInput = Omit<
  CandidateAuthorityPartialFieldEvidence,
  | 'authorityVersion'
  | 'canonicalDigest'
  | 'factDefinitionDigest'
  | 'partialEvidenceId'
  | 'semanticRegistryDigest'
  | 'semanticRegistryVersion'
>;

export function createCandidateAuthorityPartialFieldEvidence(
  input: PartialEvidenceInput,
  registry: CandidateAuthorityPartialSemanticRegistry,
): CandidateAuthorityPartialFieldEvidence {
  validateCommonInput(input);
  const validatedRegistry = parseRegistry(registry);
  const definition = validateCandidateAuthorityPartialFact({
    registry: validatedRegistry,
    factCode: input.factCode,
    fieldId: input.fieldId,
    extractionRuleVersion: input.extractionRuleVersion,
    factValue: input.factValue,
    polarity: input.polarity,
    source: input.source,
    sourceCompleteness: input.sourceCompleteness,
  });
  const identityInput = {
    ...input,
    semanticRegistryVersion: validatedRegistry.registryVersion,
    semanticRegistryDigest: validatedRegistry.registrySemanticDigest,
    factDefinitionDigest: definition.definitionDigest,
  } as const;
  const withoutDigest = {
    authorityVersion: CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_VERSION,
    partialEvidenceId: stableId('partial-field', identityInput),
    ...identityInput,
  } as const;
  return Object.freeze({
    ...withoutDigest,
    canonicalDigest: canonicalizeJson(withoutDigest).digest,
  });
}

export function projectPartialFieldEvidenceToDossier(input: {
  readonly completeProjection: CandidateAuthorityDossierProjection;
  readonly fieldPlan: CandidateAuthorityFieldPlanV4;
  readonly partialSemanticRegistry: CandidateAuthorityPartialSemanticRegistry;
  readonly partialEvidence: readonly CandidateAuthorityPartialFieldEvidence[];
}): CandidateAuthorityPartialDossierProjection {
  const validatedRegistry = parseRegistry(input.partialSemanticRegistry);
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
    validatePartialEvidenceRecord(partial, validatedRegistry);
    const plan = planByField.get(partial.fieldId);
    if (
      partial.candidateId !== dossier.identity.candidateId ||
      plan === undefined ||
      !plan.plannedExtractionCapable ||
      plan.extractionRuleVersion !== partial.extractionRuleVersion ||
      !plan.partialFactCodes.includes(partial.factCode) ||
      plan.evidenceProvenanceKind !== partial.source.kind ||
      (partial.source.kind === 'structured-provider-snapshot' &&
        partial.source.completenessState !== partial.sourceCompleteness) ||
      (partial.source.kind !== 'structured-provider-snapshot' &&
        partial.sourceCompleteness !== 'complete') ||
      seenPartialIds.has(partial.partialEvidenceId)
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
      observation: `field=${partial.fieldId}; fieldCompleteness=${partial.fieldCompleteness}; polarity=${partial.polarity}; factCode=${partial.factCode}; factDefinitionDigest=${partial.factDefinitionDigest}; structuredValue=${canonicalizeJson(partial.factValue).text}`,
      source: partial.source,
      freshness: {
        status: 'current',
        asOf: partial.freshness.asOf,
        scope: `Registered direct deterministic fact at cutoff ${partial.freshness.cutoff}; unregistered and unmentioned field concepts remain unresolved.`,
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
        statement: `${unknown.statement} Registered direct evidence establishes only ${partial.factCode}; all unregistered and unmentioned concepts remain unknown.`,
        evidenceIds: [...unknown.evidenceIds, evidenceId].sort(compare),
      };
    }
    if (partial.fieldCompleteness === 'partial') {
      const unresolvedRemainder = partial.unresolvedRemainder;
      if (unresolvedRemainder === null) invalid();
      const limitationCode = `field-remains-partial-${partial.fieldId}`;
      const limitationIndex = limitations.findIndex(
        (limitation) =>
          limitation.candidateId === partial.candidateId &&
          limitation.limitationCode === limitationCode,
      );
      if (limitationIndex < 0) {
        limitations.push({
          limitationId: stableId('limitation', {
            candidateId: partial.candidateId,
            fieldId: partial.fieldId,
          }),
          limitationCode,
          candidateId: partial.candidateId,
          statement: unresolvedRemainder,
          evidenceIds: [evidenceId],
        });
      } else {
        const limitation = limitations[limitationIndex];
        if (limitation?.statement !== unresolvedRemainder) invalid();
        limitations[limitationIndex] = {
          ...limitation,
          evidenceIds: [...limitation.evidenceIds, evidenceId].sort(compare),
        };
      }
    }
    bindings.push({
      partialEvidenceId: partial.partialEvidenceId,
      fieldId: partial.fieldId,
      factDefinitionDigest: partial.factDefinitionDigest,
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

function validatePartialEvidenceRecord(
  partial: CandidateAuthorityPartialFieldEvidence,
  registry: CandidateAuthorityPartialSemanticRegistry,
): void {
  validateCommonInput(partial);
  const definition = validateCandidateAuthorityPartialFact({
    registry,
    factCode: partial.factCode,
    fieldId: partial.fieldId,
    extractionRuleVersion: partial.extractionRuleVersion,
    factValue: partial.factValue,
    polarity: partial.polarity,
    source: partial.source,
    sourceCompleteness: partial.sourceCompleteness,
  });
  const {
    authorityVersion: ignoredVersion,
    canonicalDigest: ignoredDigest,
    partialEvidenceId: ignoredId,
    ...identityInput
  } = partial;
  void ignoredVersion;
  void ignoredDigest;
  void ignoredId;
  if (
    partial.authorityVersion !== CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_VERSION ||
    partial.semanticRegistryVersion !== registry.registryVersion ||
    partial.semanticRegistryDigest !== registry.registrySemanticDigest ||
    partial.factDefinitionDigest !== definition.definitionDigest ||
    partial.partialEvidenceId !== stableId('partial-field', identityInput) ||
    partial.canonicalDigest !==
      canonicalizeJson(withoutCanonicalDigest(partial)).digest
  )
    invalid();
}

function validateCommonInput(input: PartialEvidenceInput): void {
  if (
    !isStableId(input.candidateId) ||
    !isStableId(input.extractionRuleVersion) ||
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
          input.sourceReference.sourceRecordDigest ||
        input.source.completenessState !== input.sourceCompleteness)) ||
    (input.source.kind !== 'structured-provider-snapshot' &&
      input.sourceCompleteness !== 'complete') ||
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

function parseRegistry(
  registry: CandidateAuthorityPartialSemanticRegistry,
): CandidateAuthorityPartialSemanticRegistry {
  return registry.registryVersion ===
    CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_V3_VERSION
    ? parseCandidateAuthorityPartialSemanticRegistryV3(registry)
    : parseCandidateAuthorityPartialSemanticRegistry(registry);
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
