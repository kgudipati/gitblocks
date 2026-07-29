import { fileURLToPath } from 'node:url';

import { parseFitAssessmentResponseV1 } from '@gitblocks/contracts';
import { describe, expect, it } from 'vitest';

import {
  mapBundleForContractConformance,
  validateBundleContractConformance,
  validateCorpusContractConformance,
  validateEvaluationFieldAccounting,
} from '../src/contract-conformance.ts';
import type { CaseBundle } from '../src/contracts.ts';
import { loadCorpus } from '../src/corpus.ts';
import { stableJson } from '../src/stable-json.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

describe('product contract conformance', () => {
  it('maps and parses all ten cases without mutating the evaluation corpus', () => {
    const corpus = loadCorpus(REPOSITORY_ROOT);
    expect(corpus.ok).toBe(true);
    if (!corpus.ok) {
      return;
    }
    const before = stableJson({
      manifest: corpus.manifest,
      bundles: corpus.bundles,
    });

    const result = validateCorpusContractConformance(REPOSITORY_ROOT);

    expect(result).toEqual({
      ok: true,
      summary: {
        caseCount: 10,
        candidateCount: 40,
        contractVersion: '1.0.0',
        goldStatus: 'proposed',
        independentReviewStatus: 'not-reviewed',
        purpose: 'representability-only',
      },
      diagnostics: [],
    });
    expect(
      stableJson({ manifest: corpus.manifest, bundles: corpus.bundles }),
    ).toBe(before);
    for (const bundle of corpus.bundles) {
      const mapped = mapBundleForContractConformance(bundle);
      expect(mapped.assessmentResponse.candidateLimitations).toHaveLength(
        mapped.candidateDossiers.reduce(
          (count, dossier) => count + dossier.limitations.length,
          0,
        ),
      );
      expect(mapped.assessmentResponse.assessmentProcessing).toEqual({
        state: 'complete',
        incompleteReasonCodes: [],
      });
    }
  });

  it('fails when a decision-relevant case field is lost or unaccounted', () => {
    const bundle = firstBundle();
    const missing = structuredClone(bundle);
    delete (missing.caseDocument as unknown as Record<string, unknown>)[
      'successConditions'
    ];

    expect(
      validateEvaluationFieldAccounting(missing).map((item) => item.code),
    ).toContain('contracts.field-accounting.missing');

    const extended = structuredClone(bundle);
    (extended.caseDocument as unknown as Record<string, unknown>)[
      'decisionRelevantExtension'
    ] = 'must not disappear';
    expect(
      validateEvaluationFieldAccounting(extended).map((item) => item.code),
    ).toContain('contracts.field-accounting.unmapped');

    const changed = firstBundle();
    const identityFact =
      changed.caseDocument.repositoryProfile.identityFacts[0];
    if (identityFact === undefined) {
      throw new Error('Conformance fixture must contain an identity fact.');
    }
    changed.caseDocument.repositoryProfile.identityFacts[0] = `${identityFact} Unmapped semantic change.`;
    expect(
      validateBundleContractConformance(changed).map((item) => item.code),
    ).toContain('contracts.mapping');

    const orphanedReason = firstBundle();
    orphanedReason.caseDocument.reasonCodes.push({
      id: 'orphaned-reason',
      description: 'This reason has no product-contract disposition.',
    });
    expect(
      validateEvaluationFieldAccounting(orphanedReason).map(
        (item) => item.code,
      ),
    ).toContain('contracts.field-accounting.unmapped');
  });

  it('keeps proposed gold visibly unreviewed and refuses accepted provenance', () => {
    const bundle = firstBundle();
    expect(validateBundleContractConformance(bundle)).toEqual([]);

    const accepted = structuredClone(bundle);
    const provenance = accepted.gold.provenance as unknown as Record<
      string,
      unknown
    >;
    provenance['status'] = 'accepted';
    provenance['independentReviewStatus'] = 'accepted';
    provenance['independentReviewer'] = 'reviewer';
    provenance['reviewedAt'] = '2026-07-28T22:00:00Z';
    provenance['reviewReference'] = 'review-1';

    expect(
      validateBundleContractConformance(accepted).map((item) => item.code),
    ).toContain('contracts.provenance');
  });

  it('never turns evaluation rationale notes into product inferences', () => {
    const bundle = firstBundle();
    const rationale = 'Evaluation rationale remains inert.';
    bundle.gold.rationaleNotes = [rationale];

    expect(validateBundleContractConformance(bundle)).toEqual([]);
    const mapped = mapBundleForContractConformance(bundle);
    expect(mapped.assessmentResponse.inferences).toEqual([]);
    expect(stableJson(mapped)).not.toContain(rationale);
  });

  it('maps the repository-local verifier preference into capability intent', () => {
    const corpus = loadCorpus(REPOSITORY_ROOT);
    expect(corpus.ok).toBe(true);
    if (!corpus.ok) {
      return;
    }
    const bundle = corpus.bundles.find(
      (item) => item.caseDocument.caseId === 'webhooks-mixed-ingress-prisma',
    );
    expect(bundle).toBeDefined();
    if (bundle === undefined) {
      return;
    }

    const mapped = mapBundleForContractConformance(bundle);

    expect(
      mapped.capabilityRequest.preferences.map((item) => item.statement),
    ).toContain(
      'The team wants one maintained verifier rather than three provider-specific packages.',
    );
  });

  it('does not let evaluation-only gold fields masquerade as a product response', () => {
    const corpus = loadCorpus(REPOSITORY_ROOT);
    expect(corpus.ok).toBe(true);
    if (!corpus.ok) {
      return;
    }

    for (const bundle of corpus.bundles) {
      const parsed = parseFitAssessmentResponseV1(bundle.gold);
      expect(parsed.ok).toBe(false);
      expect(
        parsed.issues.some(
          (issue) =>
            issue.code === 'contract.additional-property' ||
            issue.code === 'contract.required',
        ),
      ).toBe(true);
    }
  });

  it('requires empty evaluation-only alternative outcomes', () => {
    const bundle = firstBundle();
    bundle.gold.allowedAlternativeOutcomes.push('insufficient-evidence');

    expect(
      validateBundleContractConformance(bundle).map((item) => item.code),
    ).toContain('contracts.field-accounting.unrepresentable');
  });

  it('refuses to invent candidate ownership for case-local evidence', () => {
    const bundle = firstBundle();
    const observation = bundle.evidence.observations[0];
    expect(observation).toBeDefined();
    if (observation === undefined) {
      return;
    }
    observation.subjectType = 'case';
    observation.candidateId = null;
    observation.sourceType = 'case-local-fact';
    observation.directness = 'case-local';

    expect(
      validateEvaluationFieldAccounting(bundle).map((item) => item.code),
    ).toContain('contracts.field-accounting.unrepresentable');
  });
});

function firstBundle(): CaseBundle {
  const corpus = loadCorpus(REPOSITORY_ROOT);
  if (!corpus.ok) {
    throw new Error('Committed corpus must load for conformance tests.');
  }
  const bundle = corpus.bundles[0];
  if (bundle === undefined) {
    throw new Error('Committed corpus must contain a conformance case.');
  }
  return structuredClone(bundle);
}
