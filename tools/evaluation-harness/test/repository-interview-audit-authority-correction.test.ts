import { describe, expect, it } from 'vitest';

import {
  createRepositoryInterviewAuditScopeV1,
  repositoryInterviewAdjudicationSetDigestV1,
  repositoryInterviewAuditScopeSetDigestV1,
  repositoryInterviewAuditSetDigestV1,
  repositoryInterviewRunSummaryDigestV1,
} from '../src/index.ts';
import {
  authoritativeRepositoryInterviewReviewsV1,
  validateRepositoryInterviewAuditSetV1,
} from '../src/repository-interview-evaluation-audit.ts';
import { loadRepositoryInterviewEvaluationCorpusV1 } from '../src/repository-interview-evaluation-corpus.ts';
import type {
  RepositoryInterviewAuditRecordV1,
  RepositoryInterviewAuditScopeV1,
  RepositoryInterviewRunSummaryV1,
  RepositoryInterviewUnknownFindingV1,
} from '../src/repository-interview-evaluation-contracts.ts';
import { repositoryInterviewAuditInventoryDigestV1 } from '../src/repository-interview-evaluation-digests.ts';
import { runRepositoryInterviewGateFixturesV1 } from '../src/repository-interview-evaluation-fixtures.ts';
import {
  computeRepositoryInterviewGateReportV1,
  repositoryInterviewRateExceedsMaximumV1,
} from '../src/repository-interview-evaluation-gates.ts';
import { createRepositoryInterviewEvaluationSchemaRegistry } from '../src/repository-interview-evaluation-schema-registry.ts';
import { findGitBlocksRoot } from '../src/repository-root.ts';
import {
  calibrationAudits,
  durableSyntheticExchange,
  exchangeInputsForRun,
  gateAudits,
  makeAdjudication,
  makeRun,
  primaryAudits,
} from './repository-interview-evaluation-test-fixtures.ts';

const root = findGitBlocksRoot(process.cwd());
const testCorpus = loadCorpusOnce();

describe('repository-interview durable audit scope', () => {
  it('derives a deterministic content-free inventory from a valid exchange', () => {
    const { request, execution, interview } = durableSyntheticExchange();
    const first = createRepositoryInterviewAuditScopeV1(
      request,
      execution,
      interview,
    );
    const second = createRepositoryInterviewAuditScopeV1(
      request,
      execution,
      interview,
    );
    expect(first).toEqual(second);
    expect(first.claimIds).toEqual(
      interview.claims.map(({ claimId }) => claimId),
    );
    expect(first.limitationIds).toEqual(
      interview.limitations.map(({ limitationId }) => limitationId),
    );
    expect(first.contradictionIds).toEqual(
      interview.contradictions.map(({ contradictionId }) => contradictionId),
    );
    expect(first.unknownIds).toEqual(
      interview.unknowns.map(({ unknownId }) => unknownId),
    );
    expect(JSON.stringify(first)).not.toMatch(
      /statement|rationale|citation|prompt|providerOutput/u,
    );
  });

  it('rejects an invalid exchange and binds every ID and record digest', () => {
    const { request, execution, interview } = durableSyntheticExchange();
    expect(() =>
      createRepositoryInterviewAuditScopeV1(request, execution, {
        ...interview,
        requestId: `intreq-${'f'.repeat(48)}`,
      }),
    ).toThrow('Repository interview audit scope input is invalid.');
    const scope = createRepositoryInterviewAuditScopeV1(
      request,
      execution,
      interview,
    );
    const changed = reDigestScope({
      ...scope,
      interviewRecordDigest: 'f'.repeat(64),
    });
    expect(changed.inventoryDigest).not.toBe(scope.inventoryDigest);
    expect(
      reDigestScope({
        ...scope,
        claimIds: [...scope.claimIds].reverse(),
      }).inventoryDigest,
    ).not.toBe(scope.inventoryDigest);
  });

  it('keeps the run summary success/failure union and stable IDs closed', () => {
    const registry = createRepositoryInterviewEvaluationSchemaRegistry(root);
    const run = makeRun(corpus());
    expect(registry.validate('run-summary', run)).toEqual([]);
    expect(
      registry.validate('run-summary', {
        ...run,
        candidateResults: [
          {
            ...run.candidateResults[0],
            requestId: 'request-unsafe',
          },
          ...run.candidateResults.slice(1),
        ],
      }),
    ).not.toHaveLength(0);
    expect(
      registry.validate('run-summary', {
        ...run,
        candidateResults: [
          {
            ...run.candidateResults[0],
            status: 'provider-failed',
            interviewId: null,
          },
          ...run.candidateResults.slice(1),
        ],
      }),
    ).not.toHaveLength(0);
  });
});

describe('repository-interview exact audit closure', () => {
  it.each([
    [
      'empty',
      (review: RepositoryInterviewAuditRecordV1) => ({
        ...review,
        subjectFindings: [],
      }),
    ],
    [
      'omitted claim',
      (review: RepositoryInterviewAuditRecordV1) => ({
        ...review,
        subjectFindings: review.subjectFindings.filter(
          ({ subjectKind }) => subjectKind !== 'claim',
        ),
      }),
    ],
    [
      'omitted limitation',
      (review: RepositoryInterviewAuditRecordV1) => ({
        ...review,
        subjectFindings: review.subjectFindings.filter(
          ({ subjectKind }) => subjectKind !== 'limitation',
        ),
      }),
    ],
    [
      'omitted contradiction',
      (review: RepositoryInterviewAuditRecordV1) => ({
        ...review,
        subjectFindings: review.subjectFindings.filter(
          ({ subjectKind }) => subjectKind !== 'contradiction',
        ),
      }),
    ],
    [
      'duplicate finding',
      (review: RepositoryInterviewAuditRecordV1) => ({
        ...review,
        subjectFindings: [
          ...review.subjectFindings,
          review.subjectFindings[0]!,
        ],
      }),
    ],
  ])('rejects %s primary coverage', (_name, change) => {
    const loaded = corpus();
    const run = makeRun(loaded);
    const primaries = primaryAudits(run);
    const changed = [change(primaries[0]!), ...primaries.slice(1)];
    expect(
      issueCodes(validate(loaded, run, gateAudits(loaded, run, changed))),
    ).toContain('audit.primary-coverage');
  });

  it('rejects foreign subjects and kind/ID mismatches', () => {
    const loaded = corpus();
    const run = makeRun(loaded);
    const primaries = primaryAudits(run);
    const foreign = primaries[1]!.subjectFindings[0]!;
    const first = primaries[0]!;
    const withForeign = {
      ...first,
      subjectFindings: [foreign, ...first.subjectFindings.slice(1)],
    };
    expect(
      issueCodes(
        validate(
          loaded,
          run,
          gateAudits(loaded, run, [withForeign, ...primaries.slice(1)]),
        ),
      ),
    ).toContain('audit.subject-scope');
    const mismatched = {
      ...first,
      subjectFindings: [
        { ...first.subjectFindings[0]!, subjectKind: 'limitation' as const },
        ...first.subjectFindings.slice(1),
      ],
    };
    expect(
      issueCodes(
        validate(
          loaded,
          run,
          gateAudits(loaded, run, [mismatched, ...primaries.slice(1)]),
        ),
      ),
    ).toContain('audit.subject-scope');
  });

  it('requires exact complete coverage from both calibration reviewers', () => {
    const loaded = corpus();
    const run = makeRun(loaded, 'calibration');
    const audits = calibrationAudits(run);
    expect(validate(loaded, run, audits).ok).toBe(true);
    expect(
      issueCodes(
        validate(loaded, run, [
          audits[0]!,
          { ...audits[1]!, subjectFindings: [] },
          ...audits.slice(2),
        ]),
      ),
    ).toContain('audit.primary-coverage');
  });

  it('closes partial-support limitation and disclosed-unknown references to one scope', () => {
    const loaded = corpus();
    const run = makeRun(loaded);
    const primaries = primaryAudits(run);
    const first = primaries[0]!;
    const scope = completedScope(run, first.candidateId);
    const partial = {
      ...first.subjectFindings[0]!,
      supportVerdict: 'partially-supported' as const,
      partialSupportLimitationId: scope.limitationIds[0]!,
    };
    const disclosed = unknownFinding(scope.unknownIds[0]!, 'disclosed');
    const validPrimary = {
      ...first,
      subjectFindings: [partial, ...first.subjectFindings.slice(1)],
      unknownFindings: [disclosed],
    };
    expect(
      validate(
        loaded,
        run,
        gateAudits(loaded, run, [validPrimary, ...primaries.slice(1)]),
      ).ok,
    ).toBe(true);

    const foreignScope = completedScope(run, primaries[1]!.candidateId);
    const badLimitation = {
      ...validPrimary,
      subjectFindings: [
        {
          ...partial,
          partialSupportLimitationId: foreignScope.limitationIds[0]!,
        },
        ...first.subjectFindings.slice(1),
      ],
    };
    expect(
      issueCodes(
        validate(
          loaded,
          run,
          gateAudits(loaded, run, [badLimitation, ...primaries.slice(1)]),
        ),
      ),
    ).toContain('audit.limitation-scope');
    const badUnknown = {
      ...validPrimary,
      unknownFindings: [
        unknownFinding(foreignScope.unknownIds[0]!, 'disclosed'),
      ],
    };
    expect(
      issueCodes(
        validate(
          loaded,
          run,
          gateAudits(loaded, run, [badUnknown, ...primaries.slice(1)]),
        ),
      ),
    ).toContain('audit.unknown-scope');
  });

  it.each([
    ['disclosed', null],
    ['misstated', null],
    ['omitted', `intunknown-${'a'.repeat(48)}`],
  ] as const)(
    'rejects %s unknown closure with the wrong reference',
    (verdict, disclosedUnknownId) => {
      const loaded = corpus();
      const run = makeRun(loaded);
      const primaries = primaryAudits(run);
      const changed = {
        ...primaries[0]!,
        unknownFindings: [
          {
            ...unknownFinding(
              completedScope(run, primaries[0]!.candidateId).unknownIds[0]!,
              'disclosed',
            ),
            verdict,
            disclosedUnknownId,
          },
        ],
      };
      expect(
        issueCodes(
          validate(
            loaded,
            run,
            gateAudits(loaded, run, [changed, ...primaries.slice(1)]),
          ),
        ),
      ).toContain('audit.unknown-closure');
    },
  );
});

describe('repository-interview secondary and adjudication authority', () => {
  it('requires exactly the assigned secondary subject set', () => {
    const loaded = corpus();
    const run = makeRun(loaded);
    const audits = gateAudits(loaded, run);
    const secondaryIndex = audits.findIndex(
      ({ reviewerRole }) => reviewerRole === 'gate-secondary',
    );
    expect(
      issueCodes(
        validate(
          loaded,
          run,
          audits.filter((_, index) => index !== secondaryIndex),
        ),
      ),
    ).toContain('audit.secondary-count');
    expect(
      issueCodes(
        validate(
          loaded,
          run,
          audits.map((review, index) =>
            index === secondaryIndex
              ? { ...review, subjectFindings: [] }
              : review,
          ),
        ),
      ),
    ).toContain('audit.secondary-scope');

    const policyPrimaries = primaryAudits(run);
    policyPrimaries[0] = {
      ...policyPrimaries[0]!,
      policyFindings: {
        ...policyPrimaries[0]!.policyFindings,
        promptInjection: 'suspected',
      },
      subjectFindings: policyPrimaries[0]!.subjectFindings.map((value) => ({
        ...value,
        materiality: 'non-material' as const,
      })),
    };
    const policyAudits = gateAudits(loaded, run, policyPrimaries);
    expect(
      policyAudits.some(
        ({ candidateId, reviewerRole, subjectFindings }) =>
          candidateId === policyPrimaries[0]!.candidateId &&
          reviewerRole === 'gate-secondary' &&
          subjectFindings.length === 0,
      ),
    ).toBe(true);
  });

  it('resolves only exact subject disagreement keys with narrow adjudication', () => {
    const setup = subjectDisagreementSetup();
    expect(
      issueCodes(validate(setup.loaded, setup.run, setup.audits)),
    ).toContain('audit.adjudication-count');
    const adjudication = makeAdjudication(setup.primary, setup.secondary, {
      subjectResolutions: [
        {
          subjectKind: setup.primaryFinding.subjectKind,
          subjectId: setup.primaryFinding.subjectId,
          finalFinding: setup.primaryFinding,
        },
      ],
    });
    const validated = validate(setup.loaded, setup.run, setup.audits, [
      adjudication,
    ]);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(
      authoritativeRepositoryInterviewReviewsV1(validated.authority)
        .find(({ candidateId }) => candidateId === setup.primary.candidateId)!
        .subjectFindings.find(
          ({ subjectId }) => subjectId === setup.primaryFinding.subjectId,
        ),
    ).toEqual(setup.primaryFinding);
    expect(
      issueCodes(
        validate(setup.loaded, setup.run, setup.audits, [
          {
            ...adjudication,
            subjectResolutions: [
              ...adjudication.subjectResolutions,
              adjudication.subjectResolutions[0]!,
            ],
          },
        ]),
      ),
    ).toContain('audit.adjudication-closure');
    const undisputed = setup.primary.subjectFindings.find(
      ({ subjectId }) => subjectId !== setup.primaryFinding.subjectId,
    )!;
    expect(
      issueCodes(
        validate(setup.loaded, setup.run, setup.audits, [
          {
            ...adjudication,
            subjectResolutions: [
              ...adjudication.subjectResolutions,
              {
                subjectKind: undisputed.subjectKind,
                subjectId: undisputed.subjectId,
                finalFinding: undisputed,
              },
            ],
          },
        ]),
      ),
    ).toContain('audit.adjudication-closure');
    expect(
      issueCodes(
        validate(setup.loaded, setup.run, setup.audits, [
          adjudication,
          { ...adjudication, adjudicationId: `adjudication-${'e'.repeat(48)}` },
        ]),
      ),
    ).toContain('audit.adjudication-count');
  });

  it('rejects wrong source reviews and non-independent adjudicators', () => {
    const setup = subjectDisagreementSetup();
    const base = makeAdjudication(setup.primary, setup.secondary, {
      subjectResolutions: [
        {
          subjectKind: setup.primaryFinding.subjectKind,
          subjectId: setup.primaryFinding.subjectId,
          finalFinding: setup.primaryFinding,
        },
      ],
    });
    expect(
      issueCodes(
        validate(setup.loaded, setup.run, setup.audits, [
          {
            ...base,
            sourceReviewIds: [
              `review-${'a'.repeat(48)}`,
              base.sourceReviewIds[1],
            ],
          },
        ]),
      ),
    ).toContain('audit.adjudication-provenance');
    expect(
      issueCodes(
        validate(setup.loaded, setup.run, setup.audits, [
          { ...base, adjudicatorId: setup.primary.reviewerId },
        ]),
      ),
    ).toContain('audit.reviewer-independence');
  });

  it('resolves exact unknown and policy fields while preserving undisputed values', () => {
    const loaded = corpus();
    const run = makeRun(loaded);
    const primaries = primaryAudits(run);
    const baseAudits = gateAudits(loaded, run, primaries);
    const secondaryIndex = baseAudits.findIndex(
      ({ reviewerRole }) => reviewerRole === 'gate-secondary',
    );
    const secondary = baseAudits[secondaryIndex]!;
    const primaryIndex = baseAudits.findIndex(
      ({ candidateId, reviewerRole }) =>
        candidateId === secondary.candidateId &&
        reviewerRole === 'gate-primary',
    );
    const primary = baseAudits[primaryIndex]!;
    const scope = completedScope(run, primary.candidateId);
    const firstUnknown = unknownFinding(scope.unknownIds[0]!, 'disclosed');
    const secondUnknown = { ...firstUnknown, verdict: 'misstated' as const };
    const changedPrimary = {
      ...primary,
      unknownFindings: [firstUnknown],
      policyFindings: {
        ...primary.policyFindings,
        poorFitCoverage: 'sufficient' as const,
      },
    };
    const changedSecondary = {
      ...secondary,
      unknownFindings: [secondUnknown],
      policyFindings: {
        ...secondary.policyFindings,
        poorFitCoverage: 'insufficient' as const,
      },
    };
    const unilateralAudits = baseAudits.map((value, index) =>
      index === primaryIndex ? changedPrimary : value,
    );
    expect(issueCodes(validate(loaded, run, unilateralAudits))).toContain(
      'audit.adjudication-count',
    );
    const audits = baseAudits.map((value, index) =>
      index === primaryIndex
        ? changedPrimary
        : index === secondaryIndex
          ? changedSecondary
          : value,
    );
    const adjudication = makeAdjudication(changedPrimary, changedSecondary, {
      unknownResolutions: [
        {
          auditUnknownId: firstUnknown.auditUnknownId,
          finalFinding: firstUnknown,
        },
      ],
      policyResolutions: [
        { field: 'poorFitCoverage', finalValue: 'sufficient' },
      ],
    });
    const validated = validate(loaded, run, audits, [adjudication]);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const final = authoritativeRepositoryInterviewReviewsV1(
      validated.authority,
    ).find(({ candidateId }) => candidateId === primary.candidateId)!;
    expect(final.unknownFindings).toEqual([firstUnknown]);
    expect(final.policyFindings.poorFitCoverage).toBe('sufficient');
    expect(final.policyFindings.promptInjection).toBe(
      primary.policyFindings.promptInjection,
    );
  });

  it('is independent of audit and adjudication caller order', () => {
    const setup = subjectDisagreementSetup();
    const adjudication = makeAdjudication(setup.primary, setup.secondary, {
      subjectResolutions: [
        {
          subjectKind: setup.primaryFinding.subjectKind,
          subjectId: setup.primaryFinding.subjectId,
          finalFinding: setup.primaryFinding,
        },
      ],
    });
    const forward = validate(setup.loaded, setup.run, setup.audits, [
      adjudication,
    ]);
    const reverse = validate(
      setup.loaded,
      setup.run,
      [...setup.audits].reverse(),
      [adjudication].reverse(),
    );
    expect(forward.ok).toBe(true);
    expect(reverse.ok).toBe(true);
    if (!forward.ok || !reverse.ok) return;
    expect(computeRepositoryInterviewGateReportV1(forward.authority)).toEqual(
      computeRepositoryInterviewGateReportV1(reverse.authority),
    );
  });
});

describe('repository-interview complete report provenance', () => {
  it('passes every deterministic gate boundary scenario', () => {
    const fixtures = runRepositoryInterviewGateFixturesV1(root);
    expect(fixtures.ok).toBe(true);
    expect(fixtures.scenarios).toHaveLength(16);
    expect(fixtures.scenarios.every(({ passed }) => passed)).toBe(true);
  }, 15_000);

  it('keeps operational failures outside semantic denominators', () => {
    const loaded = corpus();
    const baselineRun = makeRun(loaded);
    const primaries = primaryAudits(baselineRun);
    const lastPrimary = primaries.at(-1);
    if (lastPrimary === undefined) throw new Error('Synthetic audit missing.');
    primaries[primaries.length - 1] = {
      ...lastPrimary,
      subjectFindings: lastPrimary.subjectFindings.map((finding) => ({
        ...finding,
        materiality: 'non-material' as const,
      })),
    };
    const baseline = validate(
      loaded,
      baselineRun,
      gateAudits(loaded, baselineRun, primaries),
    );
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) return;
    const last = baselineRun.candidateResults.at(-1);
    if (last === undefined) throw new Error('Synthetic run result is missing.');
    const failedRun: RepositoryInterviewRunSummaryV1 = {
      ...baselineRun,
      candidateResults: [
        ...baselineRun.candidateResults.slice(0, -1),
        {
          ...last,
          status: 'provider-failed',
          interviewId: null,
          auditScope: null,
        },
      ],
    };
    const failed = validate(loaded, failedRun, gateAudits(loaded, failedRun));
    expect(failed.ok).toBe(true);
    if (!failed.ok) return;
    const baselineReport = computeRepositoryInterviewGateReportV1(
      baseline.authority,
    );
    const failedReport = computeRepositoryInterviewGateReportV1(
      failed.authority,
    );
    expect(failedReport.failureCodes).toContain('operational-failure');
    expect(failedReport.noncriticalUnsupported).toEqual(
      baselineReport.noncriticalUnsupported,
    );
    expect(failedReport.unknownRecall).toEqual(baselineReport.unknownRecall);
  });

  it('uses explicit validated gate-policy ratios without forging corpus authority', () => {
    const loaded = corpus();
    const run = makeRun(loaded);
    const primaries = primaryAudits(run);
    const first = primaries[0]!;
    const changedPrimary = {
      ...first,
      subjectFindings: [
        {
          ...first.subjectFindings[0]!,
          supportVerdict: 'unsupported' as const,
        },
        ...first.subjectFindings.slice(1),
      ],
    };
    const audits = gateAudits(loaded, run, [
      changedPrimary,
      ...primaries.slice(1),
    ]);
    const baseline = validate(loaded, run, audits);
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) return;
    expect(
      computeRepositoryInterviewGateReportV1(baseline.authority).failureCodes,
    ).not.toContain('noncritical-support-threshold');
    const zeroTolerancePolicy = {
      ...loaded.policies.gate,
      semanticThresholds: {
        ...loaded.policies.gate.semanticThresholds,
        unsupportedNumerator: 0,
      },
    };
    expect(
      createRepositoryInterviewEvaluationSchemaRegistry(root).validate(
        'gate-policy',
        zeroTolerancePolicy,
      ),
    ).toEqual([]);
    expect(
      repositoryInterviewRateExceedsMaximumV1(
        1,
        240,
        zeroTolerancePolicy.semanticThresholds.unsupportedNumerator,
        zeroTolerancePolicy.semanticThresholds.unsupportedDenominator,
      ),
    ).toBe(true);
    expect(issueCodes(validate({ ...loaded }, run, audits))).toContain(
      'audit.corpus-authority',
    );
  });

  it('excludes critical subjects from noncritical material denominators', () => {
    const loaded = corpus();
    const run = makeRun(loaded);
    const primaries = primaryAudits(run);
    const baseline = validate(loaded, run, gateAudits(loaded, run, primaries));
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) return;
    const baselineReport = computeRepositoryInterviewGateReportV1(
      baseline.authority,
    );
    const first = primaries[0]!;
    const criticalPrimary = {
      ...first,
      subjectFindings: first.subjectFindings.map((finding, index) =>
        index === 0
          ? {
              ...finding,
              materiality: 'critical' as const,
              criticalDomain: 'security' as const,
            }
          : finding,
      ),
    };
    const critical = validate(
      loaded,
      run,
      gateAudits(loaded, run, [criticalPrimary, ...primaries.slice(1)]),
    );
    expect(critical.ok).toBe(true);
    if (!critical.ok) return;
    const criticalReport = computeRepositoryInterviewGateReportV1(
      critical.authority,
    );
    expect(criticalReport.noncriticalUnsupported.denominator).toBe(
      baselineReport.noncriticalUnsupported.denominator - 1,
    );
    expect(criticalReport.noncriticalPartial.denominator).toBe(
      baselineReport.noncriticalPartial.denominator - 1,
    );
  });

  it('binds all authority digests and changes for different audit ownership', () => {
    const loaded = corpus();
    const run = makeRun(loaded);
    const firstAudits = gateAudits(loaded, run);
    const first = validate(loaded, run, firstAudits);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const changedAudits = firstAudits.map((audit, index) =>
      index === 0
        ? { ...audit, reviewerId: `reviewer-${'f'.repeat(32)}` }
        : audit,
    );
    const second = validate(loaded, run, changedAudits);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const firstReport = computeRepositoryInterviewGateReportV1(first.authority);
    const secondReport = computeRepositoryInterviewGateReportV1(
      second.authority,
    );
    expect(firstReport.reportDigest).not.toBe(secondReport.reportDigest);
    expect(firstReport.auditSetDigest).not.toBe(secondReport.auditSetDigest);
    expect(firstReport).toMatchObject({
      corpusDigest: run.corpusDigest,
      cohortPolicyDigest: run.cohortPolicyDigest,
      reviewPolicyDigest: run.reviewPolicyDigest,
      rubricDigest: run.rubricDigest,
      gatePolicyDigest: run.gatePolicyDigest,
      modelProfileDigest: run.modelProfileDigest,
    });
  });

  it('changes for different durable interview records with identical counts', () => {
    const loaded = corpus();
    const firstRun = makeRun(loaded);
    const first = validate(loaded, firstRun, gateAudits(loaded, firstRun));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const firstResult = firstRun.candidateResults[0]!;
    if (firstResult.status !== 'completed')
      throw new Error('Synthetic scope missing.');
    const changedScope = reDigestScope({
      ...firstResult.auditScope,
      interviewRecordDigest: 'e'.repeat(64),
    });
    const secondRun: RepositoryInterviewRunSummaryV1 = {
      ...firstRun,
      candidateResults: [
        { ...firstResult, auditScope: changedScope },
        ...firstRun.candidateResults.slice(1),
      ],
    };
    const second = validate(loaded, secondRun, gateAudits(loaded, secondRun));
    expect(issueCodes(second)).toContain('audit.scope-authority');
  });

  it('canonicalizes digest collection order and rejects unvalidated raw authority', () => {
    const loaded = corpus();
    const run = makeRun(loaded);
    const audits = gateAudits(loaded, run);
    const scopes = run.candidateResults.flatMap((result) =>
      result.status === 'completed' ? [result.auditScope] : [],
    );
    expect(repositoryInterviewRunSummaryDigestV1(run)).toMatch(
      /^[0-9a-f]{64}$/u,
    );
    expect(repositoryInterviewAuditScopeSetDigestV1(scopes)).toBe(
      repositoryInterviewAuditScopeSetDigestV1([...scopes].reverse()),
    );
    expect(repositoryInterviewAuditSetDigestV1(audits)).toBe(
      repositoryInterviewAuditSetDigestV1([...audits].reverse()),
    );
    expect(repositoryInterviewAdjudicationSetDigestV1([])).toBe(
      repositoryInterviewAdjudicationSetDigestV1([]),
    );
    expect(() => computeRepositoryInterviewGateReportV1({} as never)).toThrow(
      'Repository interview audit authority is invalid.',
    );
  });

  it('rejects run authority digest drift', () => {
    const loaded = corpus();
    const run = makeRun(loaded);
    const changed = { ...run, gatePolicyDigest: 'f'.repeat(64) };
    expect(
      issueCodes(validate(loaded, changed, gateAudits(loaded, run))),
    ).toContain('audit.run-authority');
  });
});

function subjectDisagreementSetup() {
  const loaded = corpus();
  const run = makeRun(loaded);
  const audits = gateAudits(loaded, run);
  const secondaryIndex = audits.findIndex(
    ({ reviewerRole, subjectFindings }) =>
      reviewerRole === 'gate-secondary' &&
      subjectFindings.some(
        ({ subjectKind }) => subjectKind !== 'contradiction',
      ),
  );
  const secondary = audits[secondaryIndex]!;
  const primaryIndex = audits.findIndex(
    ({ candidateId, reviewerRole }) =>
      candidateId === secondary.candidateId && reviewerRole === 'gate-primary',
  );
  const primary = audits[primaryIndex]!;
  const secondaryFindingIndex = secondary.subjectFindings.findIndex(
    ({ subjectKind }) => subjectKind !== 'contradiction',
  );
  const primaryFinding = primary.subjectFindings.find(
    ({ subjectKind, subjectId }) =>
      subjectKind ===
        secondary.subjectFindings[secondaryFindingIndex]!.subjectKind &&
      subjectId === secondary.subjectFindings[secondaryFindingIndex]!.subjectId,
  )!;
  const changedSecondary = {
    ...secondary,
    subjectFindings: secondary.subjectFindings.map((value, index) =>
      index === secondaryFindingIndex
        ? { ...value, supportVerdict: 'unsupported' as const }
        : value,
    ),
  };
  return {
    loaded,
    run,
    primary,
    secondary: changedSecondary,
    primaryFinding,
    audits: audits.map((value, index) =>
      index === secondaryIndex ? changedSecondary : value,
    ),
  };
}

function completedScope(
  run: RepositoryInterviewRunSummaryV1,
  candidateId: string,
): RepositoryInterviewAuditScopeV1 {
  const result = run.candidateResults.find(
    (value) => value.candidateId === candidateId,
  );
  if (result?.status !== 'completed')
    throw new Error('Synthetic scope missing.');
  return result.auditScope;
}

function unknownFinding(
  disclosedUnknownId: string,
  verdict: RepositoryInterviewUnknownFindingV1['verdict'],
): RepositoryInterviewUnknownFindingV1 {
  return {
    auditUnknownId: `auditunknown-${'1'.repeat(48)}`,
    topic: 'security-and-trust',
    materiality: 'material',
    disclosedUnknownId: verdict === 'omitted' ? null : disclosedUnknownId,
    verdict,
  };
}

function reDigestScope(
  scope: RepositoryInterviewAuditScopeV1,
): RepositoryInterviewAuditScopeV1 {
  const { inventoryDigest: ignored, ...withoutDigest } = scope;
  void ignored;
  return {
    ...withoutDigest,
    inventoryDigest: repositoryInterviewAuditInventoryDigestV1(withoutDigest),
  };
}

function corpus() {
  return testCorpus;
}

function loadCorpusOnce() {
  const result = loadRepositoryInterviewEvaluationCorpusV1(root);
  if (!result.ok) throw new Error('Synthetic corpus authority is invalid.');
  return result.corpus;
}

function validate(
  loaded: ReturnType<typeof corpus>,
  run: RepositoryInterviewRunSummaryV1,
  audits: readonly unknown[],
  adjudications: readonly unknown[] = [],
) {
  return validateRepositoryInterviewAuditSetV1(
    root,
    loaded,
    run,
    audits,
    adjudications,
    exchangeInputsForRun(run),
  );
}

function issueCodes(result: ReturnType<typeof validate>): readonly string[] {
  return result.ok ? [] : result.issues.map(({ code }) => code);
}
