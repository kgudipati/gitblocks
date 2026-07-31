import { describe, expect, it } from 'vitest';

import {
  selectRepositoryInterviewSecondarySampleV1,
  validateRepositoryInterviewAuditSetV1,
  type RepositoryInterviewAuditAuthorityV1,
  type RepositoryInterviewAuditValidationResultV1,
} from '../src/repository-interview-evaluation-audit.ts';
import { loadRepositoryInterviewEvaluationCorpusV1 } from '../src/repository-interview-evaluation-corpus.ts';
import type {
  RepositoryInterviewEvaluationCorpusV1,
  RepositoryInterviewRunSummaryV1,
} from '../src/repository-interview-evaluation-contracts.ts';
import { repositoryInterviewAuditInventoryDigestV1 } from '../src/repository-interview-evaluation-digests.ts';
import { computeRepositoryInterviewGateReportV1 } from '../src/repository-interview-evaluation-gates.ts';
import { ownAndFreezeRepositoryInterviewEvaluationDataV1 } from '../src/repository-interview-evaluation-owned-data.ts';
import { findGitBlocksRoot } from '../src/repository-root.ts';
import { createRepositoryInterviewEvaluationSchemaRegistry } from '../src/repository-interview-evaluation-schema-registry.ts';
import {
  durableSyntheticExchange,
  exchangeInputsForRun,
  gateAudits,
  makeAdjudication,
  makeRun,
  primaryAudits,
} from './repository-interview-evaluation-test-fixtures.ts';

const root = findGitBlocksRoot(process.cwd());
const MALFORMED_OWNERSHIP_VALUES: readonly (readonly [
  string,
  () => unknown,
])[] = [
  [
    'sparse array',
    () => {
      const value: unknown[] = [];
      value.length = 1;
      return value;
    },
  ],
  ['extra array property', () => Object.assign([1], { unsafe: true })],
  [
    'symbol property',
    () => Object.assign({ safe: true }, { [Symbol('unsafe')]: true }),
  ],
  [
    'nonstandard prototype',
    () => {
      const value: object = { safe: true };
      Object.setPrototypeOf(value, { inherited: true });
      return value;
    },
  ],
  [
    'throwing proxy',
    () =>
      new Proxy(
        {},
        {
          ownKeys() {
            throw new Error('sentinel proxy');
          },
        },
      ),
  ],
  ['nonfinite number', () => ({ unsafe: Number.POSITIVE_INFINITY })],
];

describe('repository-interview authenticated corpus authority', () => {
  it('accepts only the exact loader-authenticated corpus object', () => {
    const loaded = corpus();
    const run = makeRun(loaded);
    const audits = gateAudits(loaded, run);
    expect(validate(loaded, run, audits).ok).toBe(true);

    const spread = { ...loaded };
    const spreadResult = validate(spread, run, audits);
    expect(issueCodes(spreadResult)).toContain('audit.corpus-authority');

    const clone = JSON.parse(JSON.stringify(loaded)) as typeof loaded;
    const cloneResult = validate(clone, run, audits);
    expect(issueCodes(cloneResult)).toContain('audit.corpus-authority');

    const gateDrift = {
      ...loaded,
      policies: {
        ...loaded.policies,
        gate: {
          ...loaded.policies.gate,
          semanticThresholds: {
            ...loaded.policies.gate.semanticThresholds,
            unsupportedNumerator: 0,
          },
        },
      },
    };
    expect(issueCodes(validate(gateDrift, run, audits))).toContain(
      'audit.corpus-authority',
    );
    const reviewDrift = {
      ...loaded,
      policies: {
        ...loaded.policies,
        review: {
          ...loaded.policies.review,
          secondarySampleNumerator: 2,
        },
      },
    };
    expect(issueCodes(validate(reviewDrift, run, audits))).toContain(
      'audit.corpus-authority',
    );
  });

  it('tests alternate sampling only through a schema-validated pure policy input', () => {
    const loaded = corpus();
    const alternate = {
      ...loaded.policies.review,
      secondarySampleNumerator: 1,
      secondarySampleDenominator: 2,
      secondarySampleRounding: 'floor' as const,
    };
    expect(
      createRepositoryInterviewEvaluationSchemaRegistry(root).validate(
        'review-policy',
        alternate,
      ),
    ).toEqual([]);
    const subjects = Array.from({ length: 5 }, (_, index) => ({
      candidateId: `synthetic-${String(index)}`,
      subjectKind: 'claim' as const,
      subjectId: `intclaim-${index.toString(16).padStart(48, '0')}`,
    }));
    expect(
      selectRepositoryInterviewSecondarySampleV1(subjects, alternate),
    ).toHaveLength(2);
    expect(
      selectRepositoryInterviewSecondarySampleV1(
        Array.from({ length: 10 }, (_, index) => ({
          ...subjects[index % subjects.length]!,
          candidateId: `committed-${String(index)}`,
        })),
        loaded.policies.review,
      ),
    ).toHaveLength(1);
  });

  it('deep-freezes the complete loader-authenticated corpus', () => {
    const loaded = corpus();
    expectDeepFrozen(loaded);
    expect(() => {
      (
        loaded.policies.gate.semanticThresholds as {
          unsupportedNumerator: number;
        }
      ).unsupportedNumerator = 0;
    }).toThrow();
  });
});

describe('repository-interview durable exchange authority', () => {
  it('requires exactly one real exchange for every completed result', () => {
    const loaded = corpus();
    const run = makeRun(loaded);
    const audits = gateAudits(loaded, run);
    expect(issueCodes(validate(loaded, run, audits, [], []))).toContain(
      'audit.exchange-membership',
    );
    const exchanges = exchangeInputsForRun(run);
    const first = exchanges[0];
    if (first === undefined) throw new Error('Synthetic exchange missing.');
    expect(
      issueCodes(validate(loaded, run, audits, [], [...exchanges, first])),
    ).toContain('audit.exchange-membership');
    const extra = {
      candidateId: 'synthetic-extra',
      ...durableSyntheticExchange('synthetic-extra'),
    };
    expect(
      issueCodes(validate(loaded, run, audits, [], [...exchanges, extra])),
    ).toContain('audit.exchange-membership');

    const last = run.candidateResults.at(-1);
    if (last?.status !== 'completed')
      throw new Error('Synthetic result missing.');
    const failedRun: RepositoryInterviewRunSummaryV1 = {
      ...run,
      candidateResults: [
        ...run.candidateResults.slice(0, -1),
        {
          ...last,
          status: 'provider-failed',
          interviewId: null,
          auditScope: null,
        },
      ],
    };
    const failedAudits = audits.filter(
      ({ candidateId }) => candidateId !== last.candidateId,
    );
    expect(
      issueCodes(validate(loaded, failedRun, failedAudits, [], exchanges)),
    ).toContain('audit.exchange-membership');
  });

  it('rejects wrong candidate, roots, and unsuccessful exchanges', () => {
    const loaded = corpus();
    const run = makeRun(loaded);
    const audits = gateAudits(loaded, run);
    const exchanges = exchangeInputsForRun(run);
    const first = exchanges[0];
    const second = exchanges[1];
    if (first === undefined || second === undefined)
      throw new Error('Synthetic exchange missing.');
    expect(
      issueCodes(
        validate(
          loaded,
          run,
          audits,
          [],
          [
            { ...first, candidateId: second.candidateId },
            ...exchanges.slice(1),
          ],
        ),
      ),
    ).toContain('audit.exchange-membership');
    for (const key of ['request', 'execution', 'interview'] as const) {
      const changed = { ...first, [key]: second[key] };
      expect(
        issueCodes(
          validate(loaded, run, audits, [], [changed, ...exchanges.slice(1)]),
        ),
      ).toContain('audit.scope-authority');
    }
    expect(
      issueCodes(
        validate(
          loaded,
          run,
          audits,
          [],
          [
            {
              ...first,
              execution: {
                ...first.execution,
                outcome: {
                  ...first.execution.outcome,
                  status: 'failed',
                  failureCode: 'provider-error',
                  providerOutputDigest: null,
                },
              },
            },
            ...exchanges.slice(1),
          ],
        ),
      ),
    ).toContain('audit.scope-authority');
  });

  it('rejects a self-consistent scope that disagrees with its durable exchange', () => {
    const loaded = corpus();
    const run = makeRun(loaded);
    const first = run.candidateResults[0]!;
    if (first.status !== 'completed')
      throw new Error('Synthetic result missing.');
    const changed = {
      ...first.auditScope,
      interviewRecordDigest: 'f'.repeat(64),
    };
    const changedScope = {
      ...changed,
      inventoryDigest: repositoryInterviewAuditInventoryDigestV1(changed),
    };
    const changedRun: RepositoryInterviewRunSummaryV1 = {
      ...run,
      candidateResults: [
        { ...first, auditScope: changedScope },
        ...run.candidateResults.slice(1),
      ],
    };
    expect(
      issueCodes(
        validate(
          loaded,
          changedRun,
          gateAudits(loaded, changedRun),
          [],
          exchangeInputsForRun(run),
        ),
      ),
    ).toContain('audit.scope-authority');
  });

  it.each([
    [
      'request record digest',
      (scope: CompletedScope) => ({
        ...scope,
        requestRecordDigest: 'a'.repeat(64),
      }),
    ],
    [
      'execution record digest',
      (scope: CompletedScope) => ({
        ...scope,
        executionRecordDigest: 'b'.repeat(64),
      }),
    ],
    [
      'omitted claim',
      (scope: CompletedScope) => ({
        ...scope,
        claimIds: scope.claimIds.slice(1),
      }),
    ],
    [
      'omitted limitation',
      (scope: CompletedScope) => ({ ...scope, limitationIds: [] }),
    ],
    [
      'omitted contradiction',
      (scope: CompletedScope) => ({ ...scope, contradictionIds: [] }),
    ],
    [
      'omitted unknown',
      (scope: CompletedScope) => ({ ...scope, unknownIds: [] }),
    ],
    [
      'reordered claims',
      (scope: CompletedScope) => ({
        ...scope,
        claimIds: [...scope.claimIds].reverse(),
      }),
    ],
    [
      'foreign item',
      (scope: CompletedScope) => ({
        ...scope,
        claimIds: [...scope.claimIds, `intclaim-${'f'.repeat(48)}`],
      }),
    ],
  ])('rejects a recomputed fabricated scope with %s', (_name, change) => {
    const loaded = corpus();
    const run = makeRun(loaded);
    const first = run.candidateResults[0]!;
    if (first.status !== 'completed')
      throw new Error('Synthetic result missing.');
    const withoutDigest = change(first.auditScope);
    const fabricated = {
      ...withoutDigest,
      inventoryDigest: repositoryInterviewAuditInventoryDigestV1(withoutDigest),
    };
    const changedRun: RepositoryInterviewRunSummaryV1 = {
      ...run,
      candidateResults: [
        { ...first, auditScope: fabricated },
        ...run.candidateResults.slice(1),
      ],
    };
    expect(
      issueCodes(
        validate(
          loaded,
          changedRun,
          gateAudits(loaded, changedRun),
          [],
          exchangeInputsForRun(run),
        ),
      ),
    ).toContain('audit.scope-authority');
  });
});

describe('repository-interview owned immutable audit authority', () => {
  it('retains no caller references and remains deterministic after mutation attempts', () => {
    const loaded = corpus();
    const run = makeRun(loaded);
    const audits = gateAudits(loaded, run);
    const exchanges = exchangeInputsForRun(run);
    const result = validate(loaded, run, audits, [], exchanges);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { authority } = result;
    expect(authority.run).not.toBe(run);
    expect(authority.audits).not.toBe(audits);
    expect(authority.audits[0]).not.toBe(audits[0]);
    expect(authority.audits[0]?.subjectFindings[0]).not.toBe(
      audits[0]?.subjectFindings[0],
    );
    expect(authority.corpus).not.toBe(loaded);
    expect(authority.corpus.policies.gate).not.toBe(loaded.policies.gate);
    expect(containsReference(authority, exchanges[0]!.request)).toBe(false);
    expect(containsReference(authority, exchanges[0]!.execution)).toBe(false);
    expect(containsReference(authority, exchanges[0]!.interview)).toBe(false);
    expectDeepFrozen(authority);

    const before = computeRepositoryInterviewGateReportV1(authority);
    (run as { modelProfileDigest: string }).modelProfileDigest = 'f'.repeat(64);
    (
      audits[0]!.subjectFindings[0] as { supportVerdict: string }
    ).supportVerdict = 'unsupported';
    (exchanges[0]!.request as { recordDigest: string }).recordDigest =
      'e'.repeat(64);
    audits.reverse();
    exchanges.pop();
    expect(() => {
      (
        loaded.policies.review as { secondarySampleNumerator: number }
      ).secondarySampleNumerator = 2;
    }).toThrow();
    const after = computeRepositoryInterviewGateReportV1(authority);
    expect(after).toEqual(before);
    expect(() => {
      (authority.run as { modelProfileDigest: string }).modelProfileDigest =
        'd'.repeat(64);
    }).toThrow();
    expect(computeRepositoryInterviewGateReportV1(authority)).toEqual(before);
  });

  it('owns adjudications and nested resolutions independently of callers', () => {
    const loaded = corpus();
    const run = makeRun(loaded);
    const primaries = primaryAudits(run);
    const audits = gateAudits(loaded, run, primaries);
    const secondaryIndex = audits.findIndex(
      ({ reviewerRole, subjectFindings }) =>
        reviewerRole === 'gate-secondary' && subjectFindings.length > 0,
    );
    const secondary = audits[secondaryIndex];
    if (secondary === undefined)
      throw new Error('Synthetic secondary missing.');
    const primaryIndex = audits.findIndex(
      ({ candidateId, reviewerRole }) =>
        candidateId === secondary.candidateId &&
        reviewerRole === 'gate-primary',
    );
    const primary = audits[primaryIndex];
    const disputed = secondary.subjectFindings[0];
    if (primary === undefined || disputed === undefined)
      throw new Error('Synthetic disagreement missing.');
    const changedSecondary = {
      ...secondary,
      subjectFindings: secondary.subjectFindings.map((finding, index) =>
        index === 0
          ? { ...finding, supportVerdict: 'unsupported' as const }
          : finding,
      ),
    };
    const changedAudits = audits.map((audit, index) =>
      index === secondaryIndex ? changedSecondary : audit,
    );
    const primaryFinding = primary.subjectFindings.find(
      ({ subjectKind, subjectId }) =>
        subjectKind === disputed.subjectKind &&
        subjectId === disputed.subjectId,
    );
    if (primaryFinding === undefined)
      throw new Error('Primary finding missing.');
    const adjudication = makeAdjudication(primary, changedSecondary, {
      subjectResolutions: [
        {
          subjectKind: primaryFinding.subjectKind,
          subjectId: primaryFinding.subjectId,
          finalFinding: primaryFinding,
        },
      ],
    });
    const result = validate(
      loaded,
      run,
      changedAudits,
      [adjudication],
      exchangeInputsForRun(run),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.authority.adjudications[0]).not.toBe(adjudication);
    expect(result.authority.adjudications[0]?.subjectResolutions[0]).not.toBe(
      adjudication.subjectResolutions[0],
    );
    const before = computeRepositoryInterviewGateReportV1(result.authority);
    (
      adjudication.subjectResolutions[0]!.finalFinding as {
        supportVerdict: string;
      }
    ).supportVerdict = 'contradicted';
    expect(computeRepositoryInterviewGateReportV1(result.authority)).toEqual(
      before,
    );
  });

  it('rejects a forged authority cast', () => {
    expect(() =>
      computeRepositoryInterviewGateReportV1(
        {} as RepositoryInterviewAuditAuthorityV1,
      ),
    ).toThrow('Repository interview audit authority is invalid.');
  });
});

describe('repository-interview bounded plain-data ownership', () => {
  it('copies and freezes ordinary JSON-like data without retaining references', () => {
    const input = { nested: [{ value: 'synthetic' }], finite: 1 };
    const output = ownAndFreezeRepositoryInterviewEvaluationDataV1(input);
    expect(output).toEqual(input);
    expect(output).not.toBe(input);
    expect(output.nested).not.toBe(input.nested);
    expect(output.nested[0]).not.toBe(input.nested[0]);
    expectDeepFrozen(output);
  });

  it('rejects accessors without invoking getters', () => {
    let calls = 0;
    const input = {} as Record<string, unknown>;
    Object.defineProperty(input, 'unsafe', {
      enumerable: true,
      get() {
        calls += 1;
        throw new Error('sentinel secret');
      },
    });
    expect(() =>
      ownAndFreezeRepositoryInterviewEvaluationDataV1(input),
    ).toThrow('Repository interview evaluation input is invalid.');
    expect(calls).toBe(0);
  });

  it.each(MALFORMED_OWNERSHIP_VALUES)('rejects %s', (_name, makeValue) => {
    expect(() =>
      ownAndFreezeRepositoryInterviewEvaluationDataV1(makeValue()),
    ).toThrow('Repository interview evaluation input is invalid.');
  });

  it('rejects cycles', () => {
    const value: Record<string, unknown> = {};
    value['self'] = value;
    expect(() =>
      ownAndFreezeRepositoryInterviewEvaluationDataV1(value),
    ).toThrow('Repository interview evaluation input is invalid.');
  });
});

function corpus() {
  const result = loadRepositoryInterviewEvaluationCorpusV1(root);
  if (!result.ok) throw new Error('Synthetic corpus authority is invalid.');
  return result.corpus;
}

type FutureValidate = (
  repositoryRoot: string,
  corpus: RepositoryInterviewEvaluationCorpusV1,
  run: unknown,
  audits: readonly unknown[],
  adjudications: readonly unknown[],
  exchanges: readonly unknown[],
) => RepositoryInterviewAuditValidationResultV1;

function validate(
  loaded: RepositoryInterviewEvaluationCorpusV1,
  run: unknown,
  audits: readonly unknown[],
  adjudications: readonly unknown[] = [],
  exchanges = exchangeInputsForRun(run as RepositoryInterviewRunSummaryV1),
) {
  return (validateRepositoryInterviewAuditSetV1 as unknown as FutureValidate)(
    root,
    loaded,
    run,
    audits,
    adjudications,
    exchanges,
  );
}

function issueCodes(result: RepositoryInterviewAuditValidationResultV1) {
  return result.ok ? [] : result.issues.map(({ code }) => code);
}

type CompletedScope = Extract<
  RepositoryInterviewRunSummaryV1['candidateResults'][number],
  { readonly status: 'completed' }
>['auditScope'];

function containsReference(rootValue: unknown, reference: object): boolean {
  const seen = new Set<object>();
  const visit = (value: unknown): boolean => {
    if (value === reference) return true;
    if (value === null || typeof value !== 'object' || seen.has(value))
      return false;
    seen.add(value);
    return Object.values(value).some(visit);
  };
  return visit(rootValue);
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeepFrozen(nested, seen);
}
