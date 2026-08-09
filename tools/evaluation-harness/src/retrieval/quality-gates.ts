import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  ftruncateSync,
  lstatSync,
  openSync,
  realpathSync,
  statSync,
  writeSync,
  fsyncSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { findGitBlocksRoot } from '../repository-root.ts';
import { generateRetrievalBaselinePredictionSetsV2 } from './baseline-generation.ts';
import {
  type RetrievalBaselineReport,
  validateRetrievalBaselineReportV2,
} from './baseline-report.ts';
import {
  RETRIEVAL_FAMILIES,
  RETRIEVAL_V2_VERSIONS,
  RETRIEVAL_VERSIONS,
  type RetrievalFamily,
  type ValidatedRetrievalCorpus,
} from './contracts.ts';
import { loadRetrievalCorpusV2 } from './corpus.ts';
import { loadRetrievalJsonFile } from './json-boundary.ts';
import { loadRetrievalIndependentReviewRecordV2 } from './reviewed-relevance.ts';
import { createRetrievalSchemaRegistry } from './schema-registry.ts';
import { retrievalSemanticDigest, retrievalStableJson } from './stable-json.ts';

export const RETRIEVAL_V2_BASELINE_REPORT_PATH =
  'verification/retrieval-v2/baseline-report.json' as const;
export const RETRIEVAL_V2_SATURATION_PROOF_PATH =
  'verification/retrieval-v2/ceiling-saturation-proof.json' as const;
export const RETRIEVAL_V2_QUALITY_GATES_PATH =
  'verification/retrieval-v2/quality-gates.json' as const;

const EXPECTED_CORPUS_DIGEST =
  '05e03c9b60f05b893b20c9f5687f387f23e5ba5076e96fad1eaec7d01175b12c';
const HISTORICAL_CEILING_NUMERATOR = 625_000;
const HISTORICAL_CEILING_DENOMINATOR = 656_249;

interface ExactFraction {
  readonly numerator: number;
  readonly denominator: number;
  readonly value: number;
}

interface SaturationCase {
  readonly caseId: string;
  readonly family: RetrievalFamily;
  readonly eligibleRelevantCount: number;
  readonly theoreticalMaximumRelevantTop10: number;
  readonly aliasExpandedRelevantTop10: number;
  readonly theoreticalCaseRecall: ExactFraction;
  readonly aliasExpandedCaseRecall: ExactFraction;
  readonly saturated: true;
}

export interface RetrievalV2CeilingSaturationProof {
  readonly proofVersion: typeof RETRIEVAL_V2_VERSIONS.saturationProof;
  readonly authorityBindings: CommonBindings;
  readonly positiveCaseCount: 25;
  readonly noEligibleCaseCount: 5;
  readonly cases: readonly SaturationCase[];
  readonly aggregate: {
    readonly saturatedCaseCount: 25;
    readonly macroExact: ExactFraction;
    readonly macroScorerValue: number;
    readonly microExact: ExactFraction;
    readonly families: readonly {
      readonly family: RetrievalFamily;
      readonly exact: ExactFraction;
      readonly scorerValue: number;
    }[];
  };
  readonly semanticDigest: string;
}

interface CommonBindings {
  readonly corpusVersion: typeof RETRIEVAL_V2_VERSIONS.corpus;
  readonly corpusSemanticDigest: string;
  readonly relevanceVersion: typeof RETRIEVAL_V2_VERSIONS.relevanceGold;
  readonly independentReviewVersion: typeof RETRIEVAL_V2_VERSIONS.independentReview;
  readonly independentReviewDigest: string;
  readonly scorerVersion: typeof RETRIEVAL_VERSIONS.scorer;
  readonly baselineReportVersion: 'retrieval-baseline-report/2.0.0';
  readonly baselineReportDigest: string;
}

export interface RetrievalV2QualityGates {
  readonly qualityGateVersion: typeof RETRIEVAL_V2_VERSIONS.qualityGates;
  readonly authorityBindings: CommonBindings;
  readonly theoreticalCeilings: {
    readonly macroRecallAt10: ExactFraction & { readonly published: number };
    readonly microRecallAt10: ExactFraction & { readonly published: number };
    readonly families: readonly {
      readonly family: RetrievalFamily;
      readonly ceiling: number;
    }[];
  };
  readonly thresholdReview: {
    readonly firstTransferAttempt: {
      readonly rule: 'baseline-plus-historical-absolute-margin';
      readonly historicalMargin: 0.012705;
      readonly resultingTarget: 0.621304;
      readonly outcome: 'infeasible-above-theoretical-ceiling';
      readonly stoppedBeforeProductionV2Score: true;
    };
    readonly correctedTransfer: {
      readonly rule: 'maximum-of-ceiling-relative-and-strongest-baseline';
      readonly historicalCeilingFraction: ExactFraction;
    };
  };
  readonly strongestOrdinaryBaseline: {
    readonly baselineId: 'alias-expanded';
    readonly baselineVersion: 'retrieval-alias-expanded-baseline/1.0.0';
    readonly predictionSetDigest: string;
    readonly scoreReportDigest: string;
    readonly macroRecallAt10: number;
    readonly rawMacroRecallAt10: ExactFraction;
  };
  readonly macroTransfer: {
    readonly ceilingRelativeTarget: number;
    readonly baselineTarget: number;
    readonly selectedTarget: number;
    readonly publishedGate: number;
  };
  readonly gates: {
    readonly macroRecallAt10: number;
    readonly familyRecallAt10: readonly {
      readonly family: RetrievalFamily;
      readonly derivation: '0.90-times-reviewed-v2-family-ceiling';
      readonly floor: number;
    }[];
    readonly positiveCaseHitRate: {
      readonly numerator: 25;
      readonly denominator: 25;
    };
    readonly meanReciprocalRank: 0.9;
    readonly ndcgAt10: 0.75;
    readonly exactCorrectness: {
      readonly hardFilter: {
        readonly numerator: 4500;
        readonly denominator: 4500;
      };
      readonly prohibitedPreservation: {
        readonly numerator: 15;
        readonly denominator: 15;
      };
      readonly noEligible: { readonly numerator: 30; readonly denominator: 30 };
    };
    readonly maximumViolations: {
      readonly hardConflictResults: 0;
      readonly lane: 0;
      readonly negativeControl: 0;
      readonly exactDuplicates: 0;
      readonly controlledEquivalenceDuplicates: 0;
    };
  };
  readonly saturationProof: {
    readonly proofVersion: typeof RETRIEVAL_V2_VERSIONS.saturationProof;
    readonly proofDigest: string;
    readonly positiveCases: 25;
    readonly saturatedCases: 25;
    readonly allPositiveCasesSaturated: true;
  };
  readonly semanticDigest: string;
}

export function createRetrievalV2GateAuthorities(
  startDirectory = process.cwd(),
): {
  readonly saturationProof: RetrievalV2CeilingSaturationProof;
  readonly qualityGates: RetrievalV2QualityGates;
} {
  const repositoryRoot = findGitBlocksRoot(startDirectory);
  const loaded = loadRetrievalCorpusV2(repositoryRoot);
  if (!loaded.ok) throw new Error('Retrieval-v2 corpus validation failed.');
  const corpus = loaded.corpus;
  const review = loadRetrievalIndependentReviewRecordV2(repositoryRoot);
  const baselineValue = loadRetrievalJsonFile(
    repositoryRoot,
    RETRIEVAL_V2_BASELINE_REPORT_PATH,
    { maximumFileBytes: 2 * 1024 * 1024 },
  );
  if (
    validateRetrievalBaselineReportV2(baselineValue, repositoryRoot).length > 0
  ) {
    throw new Error('Retrieval-v2 baseline report validation failed.');
  }
  const baselineReport = baselineValue as RetrievalBaselineReport;
  const aliasPredictions =
    generateRetrievalBaselinePredictionSetsV2(repositoryRoot).aliasExpanded;
  const aliasMeasurement = baselineReport.ordinaryBaselines.find(
    ({ baselineId }) => baselineId === 'alias-expanded',
  );
  if (
    aliasMeasurement?.predictionSetDigest !== aliasPredictions.semanticDigest
  ) {
    throw new Error('Alias-expanded baseline binding is inconsistent.');
  }
  const bindings: CommonBindings = {
    corpusVersion: RETRIEVAL_V2_VERSIONS.corpus,
    corpusSemanticDigest: corpus.manifest.corpusSemanticDigest,
    relevanceVersion: RETRIEVAL_V2_VERSIONS.relevanceGold,
    independentReviewVersion: review.reviewVersion,
    independentReviewDigest: review.semanticDigest,
    scorerVersion: RETRIEVAL_VERSIONS.scorer,
    baselineReportVersion: 'retrieval-baseline-report/2.0.0',
    baselineReportDigest: baselineReport.reportSemanticDigest,
  };
  if (bindings.corpusSemanticDigest !== EXPECTED_CORPUS_DIGEST) {
    throw new Error('Retrieval-v2 gate corpus binding is inconsistent.');
  }
  const saturationProof = createSaturationProof(
    corpus,
    aliasPredictions,
    aliasMeasurement,
    bindings,
  );
  const qualityGates = createQualityGates(
    baselineReport,
    aliasMeasurement,
    saturationProof,
    bindings,
  );
  return { saturationProof, qualityGates };
}

function createSaturationProof(
  corpus: ValidatedRetrievalCorpus,
  aliasPredictions: ReturnType<
    typeof generateRetrievalBaselinePredictionSetsV2
  >['aliasExpanded'],
  aliasMeasurement: RetrievalBaselineReport['ordinaryBaselines'][number],
  bindings: CommonBindings,
): RetrievalV2CeilingSaturationProof {
  const predictions = new Map(
    aliasPredictions.predictions.map((prediction) => [
      prediction.caseId,
      prediction,
    ]),
  );
  const cases: SaturationCase[] = [];
  const familyFractions = new Map<RetrievalFamily, BigFraction[]>();
  const macroFractions: BigFraction[] = [];
  let microNumerator = 0;
  let microDenominator = 0;
  for (const bundle of corpus.retrievalCases) {
    const decisions = new Map(
      bundle.generatedProjection.decisions.map((decision) => [
        decision.candidateId,
        decision,
      ]),
    );
    const relevant = new Set(
      bundle.relevanceGold.judgments
        .filter(
          ({ candidateId, grade }) =>
            grade > 0 && decisions.get(candidateId)?.lane === 'eligible',
        )
        .map(({ candidateId }) => candidateId),
    );
    if (relevant.size === 0) continue;
    const prediction = predictions.get(bundle.query.caseId);
    if (prediction?.caseKind !== 'retrieval') {
      throw new Error('Alias-expanded prediction closure is incomplete.');
    }
    const aliasHits = new Set(
      prediction.results
        .filter(({ candidateId }) => relevant.has(candidateId))
        .map(({ candidateId }) => candidateId),
    ).size;
    const maximum = Math.min(10, relevant.size);
    if (aliasHits !== maximum) {
      throw new Error('Alias-expanded baseline does not saturate every case.');
    }
    const exact = fraction(maximum, relevant.size);
    macroFractions.push(exact);
    familyFractions.set(bundle.query.capabilityFamily, [
      ...(familyFractions.get(bundle.query.capabilityFamily) ?? []),
      exact,
    ]);
    microNumerator += maximum;
    microDenominator += relevant.size;
    cases.push({
      caseId: bundle.query.caseId,
      family: bundle.query.capabilityFamily,
      eligibleRelevantCount: relevant.size,
      theoreticalMaximumRelevantTop10: maximum,
      aliasExpandedRelevantTop10: aliasHits,
      theoreticalCaseRecall: serializeFraction(exact),
      aliasExpandedCaseRecall: serializeFraction(
        fraction(aliasHits, relevant.size),
      ),
      saturated: true,
    });
  }
  cases.sort((left, right) => compareText(left.caseId, right.caseId));
  if (
    cases.length !== 25 ||
    corpus.retrievalCases.length - cases.length !== 5
  ) {
    throw new Error('Retrieval-v2 positive/no-eligible structure changed.');
  }
  const macro = averageFractions(macroFractions);
  const families = RETRIEVAL_FAMILIES.map((family) => {
    const exact = averageFractions(familyFractions.get(family) ?? []);
    const scorerValue = aliasMeasurement.perFamily.find(
      (measurement) => measurement.family === family,
    )?.metrics.recallAt10.value;
    if (scorerValue === null || scorerValue === undefined) {
      throw new Error('Alias-expanded family measurement is incomplete.');
    }
    return { family, exact: serializeFraction(exact), scorerValue };
  });
  const macroScorerValue =
    aliasMeasurement.aggregateMetrics.macro['recallAt10']?.value;
  if (macroScorerValue !== 0.608599) {
    throw new Error('Alias-expanded macro baseline changed.');
  }
  const withoutDigest = {
    proofVersion: RETRIEVAL_V2_VERSIONS.saturationProof,
    authorityBindings: bindings,
    positiveCaseCount: 25 as const,
    noEligibleCaseCount: 5 as const,
    cases,
    aggregate: {
      saturatedCaseCount: 25 as const,
      macroExact: serializeFraction(macro),
      macroScorerValue,
      microExact: serializeFraction(fraction(microNumerator, microDenominator)),
      families,
    },
  };
  return {
    ...withoutDigest,
    semanticDigest: retrievalSemanticDigest(withoutDigest),
  };
}

function createQualityGates(
  baselineReport: RetrievalBaselineReport,
  aliasMeasurement: RetrievalBaselineReport['ordinaryBaselines'][number],
  saturationProof: RetrievalV2CeilingSaturationProof,
  bindings: CommonBindings,
): RetrievalV2QualityGates {
  const macroExact = saturationProof.aggregate.macroExact;
  const historicalFraction = fraction(
    HISTORICAL_CEILING_NUMERATOR,
    HISTORICAL_CEILING_DENOMINATOR,
  );
  const ceilingRelativeTarget =
    macroExact.value * fractionValue(historicalFraction);
  const aliasMacro = aliasMeasurement.aggregateMetrics.macro['recallAt10'];
  if (aliasMacro?.value !== 0.608599 || aliasMacro.denominator !== 25) {
    throw new Error('Strongest ordinary baseline macro binding changed.');
  }
  const rawBaseline = fraction(aliasMacro.numerator, aliasMacro.denominator);
  const rawBaselineValue = fractionValue(rawBaseline);
  const selectedTarget = Math.max(ceilingRelativeTarget, rawBaselineValue);
  const publishedGate = round6(selectedTarget);
  const familyCeilings = saturationProof.aggregate.families.map(
    ({ family, scorerValue }) => ({ family, ceiling: scorerValue }),
  );
  const familyGates = familyCeilings.map(({ family, ceiling }) => ({
    family,
    derivation: '0.90-times-reviewed-v2-family-ceiling' as const,
    floor: round6(ceiling * 0.9),
  }));
  if (
    publishedGate !== 0.608599 ||
    retrievalStableJson(familyGates.map(({ floor }) => floor)) !==
      retrievalStableJson([0.603529, 0.493043, 0.428276, 0.480001, 0.733847])
  ) {
    throw new Error('Reviewed-v2 quality-gate derivation changed.');
  }
  const withoutDigest = {
    qualityGateVersion: RETRIEVAL_V2_VERSIONS.qualityGates,
    authorityBindings: bindings,
    theoreticalCeilings: {
      macroRecallAt10: {
        ...macroExact,
        published: saturationProof.aggregate.macroScorerValue,
      },
      microRecallAt10: {
        ...saturationProof.aggregate.microExact,
        published: round6(saturationProof.aggregate.microExact.value),
      },
      families: familyCeilings,
    },
    thresholdReview: {
      firstTransferAttempt: {
        rule: 'baseline-plus-historical-absolute-margin' as const,
        historicalMargin: 0.012705 as const,
        resultingTarget: 0.621304 as const,
        outcome: 'infeasible-above-theoretical-ceiling' as const,
        stoppedBeforeProductionV2Score: true as const,
      },
      correctedTransfer: {
        rule: 'maximum-of-ceiling-relative-and-strongest-baseline' as const,
        historicalCeilingFraction: serializeFraction(historicalFraction),
      },
    },
    strongestOrdinaryBaseline: {
      baselineId: 'alias-expanded' as const,
      baselineVersion: 'retrieval-alias-expanded-baseline/1.0.0' as const,
      predictionSetDigest: aliasMeasurement.predictionSetDigest,
      scoreReportDigest: aliasMeasurement.scoreReportDigest,
      macroRecallAt10: aliasMacro.value,
      rawMacroRecallAt10: serializeFraction(rawBaseline),
    },
    macroTransfer: {
      ceilingRelativeTarget,
      baselineTarget: rawBaselineValue,
      selectedTarget,
      publishedGate,
    },
    gates: {
      macroRecallAt10: publishedGate,
      familyRecallAt10: familyGates,
      positiveCaseHitRate: { numerator: 25 as const, denominator: 25 as const },
      meanReciprocalRank: 0.9 as const,
      ndcgAt10: 0.75 as const,
      exactCorrectness: {
        hardFilter: { numerator: 4500 as const, denominator: 4500 as const },
        prohibitedPreservation: {
          numerator: 15 as const,
          denominator: 15 as const,
        },
        noEligible: { numerator: 30 as const, denominator: 30 as const },
      },
      maximumViolations: {
        hardConflictResults: 0 as const,
        lane: 0 as const,
        negativeControl: 0 as const,
        exactDuplicates: 0 as const,
        controlledEquivalenceDuplicates: 0 as const,
      },
    },
    saturationProof: {
      proofVersion: saturationProof.proofVersion,
      proofDigest: saturationProof.semanticDigest,
      positiveCases: 25 as const,
      saturatedCases: 25 as const,
      allPositiveCasesSaturated: true as const,
    },
  };
  void baselineReport;
  return {
    ...withoutDigest,
    semanticDigest: retrievalSemanticDigest(withoutDigest),
  };
}

export function writeRetrievalV2GateAuthorities(
  startDirectory = process.cwd(),
): ReturnType<typeof createRetrievalV2GateAuthorities> {
  const repositoryRoot = findGitBlocksRoot(startDirectory);
  const authorities = createRetrievalV2GateAuthorities(repositoryRoot);
  writeFixedJson(
    repositoryRoot,
    RETRIEVAL_V2_SATURATION_PROOF_PATH,
    authorities.saturationProof,
  );
  writeFixedJson(
    repositoryRoot,
    RETRIEVAL_V2_QUALITY_GATES_PATH,
    authorities.qualityGates,
  );
  return authorities;
}

export function validateRetrievalV2GateAuthorities(
  startDirectory = process.cwd(),
): ReturnType<typeof createRetrievalV2GateAuthorities> {
  const repositoryRoot = findGitBlocksRoot(startDirectory);
  const registry = createRetrievalSchemaRegistry(repositoryRoot, 'v2');
  const proofValue = loadRetrievalJsonFile(
    repositoryRoot,
    RETRIEVAL_V2_SATURATION_PROOF_PATH,
  );
  const gatesValue = loadRetrievalJsonFile(
    repositoryRoot,
    RETRIEVAL_V2_QUALITY_GATES_PATH,
  );
  if (
    registry.validate('saturation-proof', proofValue).length > 0 ||
    registry.validate('quality-gates', gatesValue).length > 0
  ) {
    throw new Error('Retrieval-v2 gate authority schema validation failed.');
  }
  const proof = proofValue as RetrievalV2CeilingSaturationProof;
  const gates = gatesValue as RetrievalV2QualityGates;
  if (
    digestWithoutOwnDigest(proof) !== proof.semanticDigest ||
    digestWithoutOwnDigest(gates) !== gates.semanticDigest
  ) {
    throw new Error('Retrieval-v2 gate authority digest validation failed.');
  }
  const expected = createRetrievalV2GateAuthorities(repositoryRoot);
  if (
    retrievalStableJson(proof) !==
      retrievalStableJson(expected.saturationProof) ||
    retrievalStableJson(gates) !== retrievalStableJson(expected.qualityGates)
  ) {
    throw new Error('Retrieval-v2 committed gate authorities drifted.');
  }
  return expected;
}

interface BigFraction {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

function fraction(numerator: number, denominator: number): BigFraction {
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator <= 0
  ) {
    throw new Error('Exact retrieval fraction is invalid.');
  }
  const scale = Math.max(decimalPlaces(numerator), decimalPlaces(denominator));
  const factor = 10 ** scale;
  return reduce({
    numerator: BigInt(Math.round(numerator * factor)),
    denominator: BigInt(Math.round(denominator * factor)),
  });
}

function decimalPlaces(value: number): number {
  const text = value.toString();
  return text.includes('.') ? (text.split('.')[1]?.length ?? 0) : 0;
}

function averageFractions(values: readonly BigFraction[]): BigFraction {
  if (values.length === 0) throw new Error('Exact retrieval average is empty.');
  const sum = values.reduce(addFractions, { numerator: 0n, denominator: 1n });
  return reduce({
    numerator: sum.numerator,
    denominator: sum.denominator * BigInt(values.length),
  });
}

function addFractions(left: BigFraction, right: BigFraction): BigFraction {
  return reduce({
    numerator:
      left.numerator * right.denominator + right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  });
}

function reduce(value: BigFraction): BigFraction {
  const divisor = gcd(
    value.numerator < 0n ? -value.numerator : value.numerator,
    value.denominator,
  );
  return {
    numerator: value.numerator / divisor,
    denominator: value.denominator / divisor,
  };
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left;
  let b = right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function serializeFraction(value: BigFraction): ExactFraction {
  const numerator = Number(value.numerator);
  const denominator = Number(value.denominator);
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) {
    throw new Error('Exact retrieval fraction exceeds safe integer bounds.');
  }
  return { numerator, denominator, value: numerator / denominator };
}

function fractionValue(value: BigFraction): number {
  return Number(value.numerator) / Number(value.denominator);
}

function digestWithoutOwnDigest(value: {
  readonly semanticDigest: string;
}): string {
  const { semanticDigest, ...projection } = value;
  void semanticDigest;
  return retrievalSemanticDigest(projection);
}

function round6(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function writeFixedJson(
  repositoryRoot: string,
  relativePath: string,
  value: unknown,
): void {
  const root = resolve(repositoryRoot);
  if (realpathSync(root) !== root || !statSync(root).isDirectory()) {
    throw new Error('Retrieval-v2 gate repository root must be canonical.');
  }
  const target = join(root, relativePath);
  const parent = dirname(target);
  if (realpathSync(parent) !== parent || !statSync(parent).isDirectory()) {
    throw new Error('Retrieval-v2 gate parent must be canonical.');
  }
  if (existsSync(target) && lstatSync(target).isSymbolicLink()) {
    throw new Error('Retrieval-v2 gate target must not be a symlink.');
  }
  const bytes = Buffer.from(retrievalStableJson(value), 'utf8');
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      target,
      constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW,
      0o644,
    );
    if (!fstatSync(descriptor).isFile())
      throw new Error('Retrieval-v2 gate target is not a file.');
    ftruncateSync(descriptor, 0);
    let offset = 0;
    while (offset < bytes.length) {
      const written = writeSync(
        descriptor,
        bytes,
        offset,
        bytes.length - offset,
      );
      if (written <= 0)
        throw new Error('Retrieval-v2 gate write was incomplete.');
      offset += written;
    }
    fsyncSync(descriptor);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
