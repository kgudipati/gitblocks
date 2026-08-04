import {
  canonicalizeCapabilityQueryInput,
  normalizeCapabilityQuery,
  validateCandidateReferenceAuthority,
  validateCapabilityQueryInput,
  type CandidateReferenceAuthority,
  type CapabilityQueryInput,
} from '@gitblocks/domain';

import { contractCanonicalDigest } from './artifact-identity.ts';
import { parseCapabilityTaxonomyV1 } from './capability-taxonomy-contracts.ts';
import {
  contractIssue,
  mapDomainIssues,
  type ContractIssue,
  type ContractParseResult,
} from './diagnostics.ts';
import { CONTRACT_VERSION } from './schema-builders.ts';
import {
  capabilityQueryInputV1Validator,
  capabilityQueryNormalizationResultV1Validator,
  structurallyValidate,
} from './structural-validation.ts';
import type {
  CapabilityQueryInputV1,
  CapabilityQueryNormalizationResultV1,
} from './capability-query-schemas.ts';

export type CapabilityQueryNormalizationOperationResult =
  | {
      readonly ok: true;
      readonly value: CapabilityQueryNormalizationResultV1;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly issues: readonly ContractIssue[];
    };

export type CapabilityQueryNormalizationExchangeValidationResult =
  | { readonly ok: true; readonly issues: readonly [] }
  | { readonly ok: false; readonly issues: readonly ContractIssue[] };

export function parseCapabilityQueryInputV1(
  value: unknown,
): ContractParseResult<CapabilityQueryInputV1, CapabilityQueryInput> {
  const structural = structurallyValidate(
    value,
    capabilityQueryInputV1Validator,
  );
  if (!structural.ok) return structural;
  const semantic = validateCapabilityQueryInput(structural.value);
  return semantic.ok
    ? {
        ok: true,
        value: structural.value,
        domain: semantic.value,
        issues: [],
      }
    : { ok: false, issues: mapDomainIssues(semantic.issues) };
}

export function parseCapabilityQueryNormalizationResultV1(
  value: unknown,
): ContractParseResult<
  CapabilityQueryNormalizationResultV1,
  CapabilityQueryNormalizationResultV1
> {
  const structural = structurallyValidate(
    value,
    capabilityQueryNormalizationResultV1Validator,
  );
  if (!structural.ok) return structural;
  const expectedDigest = capabilityQueryNormalizationSemanticDigest(
    structural.value,
  );
  const expectedId = normalizationId(expectedDigest);
  if (
    structural.value.semanticDigest !== expectedDigest ||
    structural.value.normalizationId !== expectedId
  ) {
    return {
      ok: false,
      issues: [
        contractIssue(
          'contract.literal',
          '',
          'Contract value does not match the required literal.',
        ),
      ],
    };
  }
  return {
    ok: true,
    value: structural.value,
    domain: structural.value,
    issues: [],
  };
}

export function normalizeCapabilityQueryV1(
  suppliedInput: unknown,
  suppliedTaxonomy: unknown,
  suppliedCandidateAuthority?: CandidateReferenceAuthority,
): CapabilityQueryNormalizationOperationResult {
  const parsedInput = parseCapabilityQueryInputV1(suppliedInput);
  if (!parsedInput.ok) return parsedInput;
  const parsedTaxonomy = parseCapabilityTaxonomyV1(suppliedTaxonomy);
  if (!parsedTaxonomy.ok) return parsedTaxonomy;

  let candidateAuthority: CandidateReferenceAuthority | undefined;
  if (
    parsedInput.value.candidateReferences.length > 0 &&
    suppliedCandidateAuthority !== undefined
  ) {
    const validation = validateCandidateReferenceAuthority(
      suppliedCandidateAuthority,
    );
    if (!validation.ok) {
      return { ok: false, issues: mapDomainIssues(validation.issues) };
    }
    candidateAuthority = validation.value;
  }
  const normalized = normalizeCapabilityQuery(
    parsedInput.domain,
    parsedTaxonomy.domain,
    candidateAuthority,
  );
  if (!normalized.ok) {
    return { ok: false, issues: mapDomainIssues(normalized.issues) };
  }

  const queryInputDigest = capabilityQueryInputDigest(parsedInput.domain);
  const candidateCatalogBinding =
    parsedInput.value.candidateReferences.length > 0 &&
    candidateAuthority !== undefined
      ? {
          catalogVersion: candidateAuthority.catalogVersion,
          catalogDigest: candidateAuthority.catalogDigest,
        }
      : null;
  const semanticValue = {
    contractVersion: CONTRACT_VERSION,
    scope: 'local-pre-approval' as const,
    queryInputId: parsedInput.value.queryInputId,
    queryInputDigest,
    taxonomyVersion: parsedTaxonomy.value.taxonomyVersion,
    taxonomySemanticDigest: parsedTaxonomy.value.semanticDigest,
    normalizerVersion: '1.0.0' as const,
    candidateCatalogBinding,
    outcome: normalized.value.outcome,
    primaryFamilyId: normalized.value.primaryFamilyId,
    normalizedCapabilityConcepts:
      normalized.value.normalizedCapabilityConcepts.map((concept) => ({
        ...concept,
        sourceTermIds: [...concept.sourceTermIds],
      })),
    normalizedConstraints: normalized.value.normalizedConstraints.map(
      (constraint) => ({
        ...constraint,
        sourceConstraintIds: [...constraint.sourceConstraintIds],
      }),
    ),
    preservedDeclarations: normalized.value.preservedDeclarations.map(
      (declaration) => ({ ...declaration }),
    ),
    resolvedCandidateReferences:
      normalized.value.resolvedCandidateReferences.map((reference) => ({
        ...reference,
      })),
    unresolvedTerms: normalized.value.unresolvedTerms.map((term) => ({
      ...term,
      sourceIds: [...term.sourceIds],
    })),
    clarifications: normalized.value.clarifications.map((clarification) => ({
      ...clarification,
      sourceIds: [...clarification.sourceIds],
      possibleConceptIds: [...clarification.possibleConceptIds],
    })),
    notices: normalized.value.notices.map((notice) => ({
      ...notice,
      sourceIds: [...notice.sourceIds],
    })),
    normalizationSteps: normalized.value.normalizationSteps.map((step) => ({
      ...step,
      inputSourceIds: [...step.inputSourceIds],
      outputIds: [...step.outputIds],
    })),
    repositoryFingerprintReference:
      normalized.value.repositoryFingerprintReference,
  } satisfies Omit<
    CapabilityQueryNormalizationResultV1,
    'normalizationId' | 'semanticDigest'
  >;
  const semanticDigest =
    capabilityQueryNormalizationSemanticDigest(semanticValue);
  const result = {
    contractVersion: semanticValue.contractVersion,
    normalizationId: normalizationId(semanticDigest),
    scope: semanticValue.scope,
    queryInputId: semanticValue.queryInputId,
    queryInputDigest: semanticValue.queryInputDigest,
    taxonomyVersion: semanticValue.taxonomyVersion,
    taxonomySemanticDigest: semanticValue.taxonomySemanticDigest,
    normalizerVersion: semanticValue.normalizerVersion,
    candidateCatalogBinding: semanticValue.candidateCatalogBinding,
    outcome: semanticValue.outcome,
    primaryFamilyId: semanticValue.primaryFamilyId,
    normalizedCapabilityConcepts: semanticValue.normalizedCapabilityConcepts,
    normalizedConstraints: semanticValue.normalizedConstraints,
    preservedDeclarations: semanticValue.preservedDeclarations,
    resolvedCandidateReferences: semanticValue.resolvedCandidateReferences,
    unresolvedTerms: semanticValue.unresolvedTerms,
    clarifications: semanticValue.clarifications,
    notices: semanticValue.notices,
    normalizationSteps: semanticValue.normalizationSteps,
    repositoryFingerprintReference:
      semanticValue.repositoryFingerprintReference,
    semanticDigest,
  } satisfies CapabilityQueryNormalizationResultV1;
  const parsedResult = parseCapabilityQueryNormalizationResultV1(result);
  return parsedResult.ok
    ? { ok: true, value: parsedResult.value, issues: [] }
    : parsedResult;
}

export function capabilityQueryInputDigest(
  value: CapabilityQueryInputV1 | CapabilityQueryInput,
): string {
  return contractCanonicalDigest(canonicalizeCapabilityQueryInput(value));
}

export function capabilityQueryNormalizationSemanticDigest(
  value:
    | CapabilityQueryNormalizationResultV1
    | Omit<
        CapabilityQueryNormalizationResultV1,
        'normalizationId' | 'semanticDigest'
      >,
): string {
  return contractCanonicalDigest({
    contractVersion: value.contractVersion,
    scope: value.scope,
    queryInputId: value.queryInputId,
    queryInputDigest: value.queryInputDigest,
    taxonomyVersion: value.taxonomyVersion,
    taxonomySemanticDigest: value.taxonomySemanticDigest,
    normalizerVersion: value.normalizerVersion,
    candidateCatalogBinding: value.candidateCatalogBinding,
    outcome: value.outcome,
    primaryFamilyId: value.primaryFamilyId,
    normalizedCapabilityConcepts: value.normalizedCapabilityConcepts,
    normalizedConstraints: value.normalizedConstraints,
    preservedDeclarations: value.preservedDeclarations,
    resolvedCandidateReferences: value.resolvedCandidateReferences,
    unresolvedTerms: value.unresolvedTerms,
    clarifications: value.clarifications,
    notices: value.notices,
    normalizationSteps: value.normalizationSteps,
    repositoryFingerprintReference: value.repositoryFingerprintReference,
  });
}

export function validateCapabilityQueryNormalizationExchangeV1(
  suppliedInput: unknown,
  suppliedResult: unknown,
  suppliedTaxonomy: unknown,
  suppliedCandidateAuthority?: CandidateReferenceAuthority,
): CapabilityQueryNormalizationExchangeValidationResult {
  const parsedResult =
    parseCapabilityQueryNormalizationResultV1(suppliedResult);
  if (!parsedResult.ok) return parsedResult;
  const expected = normalizeCapabilityQueryV1(
    suppliedInput,
    suppliedTaxonomy,
    suppliedCandidateAuthority,
  );
  if (!expected.ok) return expected;
  if (
    contractCanonicalDigest(expected.value) !==
    contractCanonicalDigest(parsedResult.value)
  ) {
    return {
      ok: false,
      issues: [
        contractIssue('domain.query.exchange', '', 'Domain validation failed.'),
      ],
    };
  }
  return { ok: true, issues: [] };
}

function normalizationId(semanticDigest: string): string {
  return `normalization-${semanticDigest.slice(0, 48)}`;
}
