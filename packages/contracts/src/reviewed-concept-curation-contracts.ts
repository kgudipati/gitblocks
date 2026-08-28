import { contractCanonicalDigest } from './artifact-identity.ts';
import {
  contractIssue,
  type ContractIssue,
  type ContractParseResult,
} from './diagnostics.ts';
import { cloneOwnedJson } from './owned-json.ts';
import {
  reviewedConceptCurationAuthorityV2Validator,
  structurallyValidate,
} from './structural-validation.ts';
import {
  type ReviewedConceptClaimV2,
  type ReviewedConceptCurationAuthorityV2,
  type ReviewedConceptScopeAdmissionV2,
} from './reviewed-concept-curation-schemas.ts';

export type ReviewedConceptCurationAuthorityInputV2 = Omit<
  ReviewedConceptCurationAuthorityV2,
  'semanticAuthorityDigest'
>;

export function createReviewedConceptCurationAuthorityV2(
  input: ReviewedConceptCurationAuthorityInputV2,
): ReviewedConceptCurationAuthorityV2 {
  const owned = cloneOwnedJson(input);
  const authority = {
    ...owned,
    semanticAuthorityDigest:
      reviewedConceptCurationAuthoritySemanticDigestV2(owned),
  };
  const parsed = parseReviewedConceptCurationAuthorityV2(authority);
  if (!parsed.ok) {
    throw new Error('Reviewed concept curation authority input is invalid.');
  }
  return parsed.value;
}

export function parseReviewedConceptCurationAuthorityV2(
  value: unknown,
): ContractParseResult<
  ReviewedConceptCurationAuthorityV2,
  ReviewedConceptCurationAuthorityV2
> {
  const structural = structurallyValidate(
    value,
    reviewedConceptCurationAuthorityV2Validator,
  );
  if (!structural.ok) return structural;
  const authority = structural.value;
  const issues: ContractIssue[] = [];
  let priorClaimKey = '';
  const claimIds = new Set<string>();
  for (const [index, claim] of authority.claims.entries()) {
    const claimPath = `/claims/${String(index)}`;
    const expectedClaimDigest = reviewedConceptClaimDigestV2(claim);
    const expectedClaimId = `reviewed-claim-${expectedClaimDigest.slice(0, 48)}`;
    const claimKey = canonicalClaimKey(claim);
    if (
      claim.claimDigest !== expectedClaimDigest ||
      claim.claimId !== expectedClaimId ||
      claimKey <= priorClaimKey ||
      claimIds.has(claim.claimId) ||
      new Set(claim.basisReferences.map(contractCanonicalDigest)).size !==
        claim.basisReferences.length ||
      (claim.claimScope.kind === 'exact-version' &&
        claim.admissions.length !== 0) ||
      ((claim.fieldId === 'adoption-unit-type' ||
        claim.fieldId === 'capability-variants-features') &&
        claim.claimScope.kind !== 'candidate-lineage')
    ) {
      issues.push(literalIssue(claimPath));
    }
    claimIds.add(claim.claimId);
    priorClaimKey = claimKey;
    for (const basis of claim.basisReferences) {
      if (
        basis.kind === 'artifact-lines' &&
        (basis.endLine < basis.startLine ||
          basis.endLine - basis.startLine + 1 > 80)
      ) {
        issues.push(literalIssue(`${claimPath}/basisReferences`));
      }
    }
    let priorAdmissionDigest: string | null = null;
    for (const [admissionIndex, admission] of claim.admissions.entries()) {
      const expectedAdmissionDigest = reviewedConceptScopeAdmissionDigestV2({
        ...admission,
        claimId: claim.claimId,
        sequence: admissionIndex + 1,
        priorAdmissionDigest,
      });
      if (
        admission.claimId !== claim.claimId ||
        admission.sequence !== admissionIndex + 1 ||
        admission.priorAdmissionDigest !== priorAdmissionDigest ||
        admission.admissionDigest !== expectedAdmissionDigest ||
        admission.admissionId !==
          `scope-admission-${expectedAdmissionDigest.slice(0, 48)}`
      ) {
        issues.push(
          literalIssue(`${claimPath}/admissions/${String(admissionIndex)}`),
        );
      }
      priorAdmissionDigest = admission.admissionDigest;
    }
  }
  if (
    authority.semanticAuthorityDigest !==
    reviewedConceptCurationAuthoritySemanticDigestV2(authority)
  ) {
    issues.push(literalIssue('/semanticAuthorityDigest'));
  }
  return issues.length === 0
    ? {
        ok: true,
        value: cloneOwnedJson(authority),
        domain: cloneOwnedJson(authority),
        issues: [],
      }
    : { ok: false, issues };
}

export function reviewedConceptClaimDigestV2(
  claim: ReviewedConceptClaimV2,
): string {
  return contractCanonicalDigest({
    claimVersion: claim.claimVersion,
    candidateId: claim.candidateId,
    fieldId: claim.fieldId,
    conceptId: claim.conceptId,
    state: claim.state,
    claimScope: claim.claimScope,
    basisReferences: claim.basisReferences,
    reviewedAt: claim.reviewedAt,
    reviewerId: claim.reviewerId,
  });
}

export function reviewedConceptScopeAdmissionDigestV2(
  admission: ReviewedConceptScopeAdmissionV2,
): string {
  return contractCanonicalDigest({
    admissionVersion: admission.admissionVersion,
    claimId: admission.claimId,
    sequence: admission.sequence,
    priorAdmissionDigest: admission.priorAdmissionDigest,
    versionScope: admission.versionScope,
    admittedAt: admission.admittedAt,
    reviewerId: admission.reviewerId,
  });
}

export function reviewedConceptCurationAuthoritySemanticDigestV2(
  authority:
    | ReviewedConceptCurationAuthorityInputV2
    | ReviewedConceptCurationAuthorityV2,
): string {
  return contractCanonicalDigest({
    contractVersion: authority.contractVersion,
    authorityVersion: authority.authorityVersion,
    catalogVersion: authority.catalogVersion,
    catalogDigest: authority.catalogDigest,
    taxonomyVersion: authority.taxonomyVersion,
    taxonomySemanticDigest: authority.taxonomySemanticDigest,
    claims: authority.claims,
  });
}

export function serializeReviewedConceptCurationAuthorityV2(
  authority: ReviewedConceptCurationAuthorityV2,
): string {
  const parsed = parseReviewedConceptCurationAuthorityV2(authority);
  if (!parsed.ok) {
    throw new Error('Reviewed concept curation authority is invalid.');
  }
  return `${JSON.stringify(parsed.value, null, 2)}\n`;
}

function canonicalClaimKey(claim: ReviewedConceptClaimV2): string {
  return [
    claim.candidateId,
    claim.fieldId,
    claim.conceptId,
    claim.claimId,
  ].join('\u0000');
}

function literalIssue(instancePath: string): ContractIssue {
  return contractIssue(
    'contract.literal',
    instancePath,
    'Contract value does not match the required literal.',
  );
}
