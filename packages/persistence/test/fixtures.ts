import type {
  CandidateDossierV1,
  EvidenceObservationV1,
} from '@gitblocks/contracts';

export type MutableValue<Value> = Value extends readonly (infer Item)[]
  ? MutableValue<Item>[]
  : Value extends object
    ? { -readonly [Key in keyof Value]: MutableValue<Value[Key]> }
    : Value;

export function createEvidence(
  candidateId: 'candidate-alpha' | 'candidate-beta',
): MutableValue<EvidenceObservationV1> {
  const suffix = candidateId === 'candidate-alpha' ? 'alpha' : 'beta';
  const commitSha =
    candidateId === 'candidate-alpha'
      ? '0123456789abcdef0123456789abcdef01234567'
      : '89abcdef0123456789abcdef0123456789abcdef';
  return {
    kind: 'evidence',
    evidenceId: `evidence-${suffix}`,
    candidateId,
    topic: 'runtime-support',
    dimension: 'runtime-framework',
    observation: 'Official evidence establishes runtime support.',
    source: {
      kind: 'git-commit',
      sourceType: 'official-repository',
      sourceUrl: `https://github.com/example/${suffix}`,
      commitSha,
      immutableUrl: `https://github.com/example/${suffix}/tree/${commitSha}`,
      collectedAt: '2026-07-28T20:30:00Z',
      publishedAt: '2026-07-28T19:00:00Z',
    },
    freshness: {
      status: 'current',
      asOf: '2026-07-28T21:00:00Z',
      scope: 'Runtime compatibility at the pinned revision.',
    },
    directness: 'direct',
    limitation: 'No live candidate code was installed or executed.',
  };
}

export function createCandidateDossier(
  candidateId: 'candidate-alpha' | 'candidate-beta',
): MutableValue<CandidateDossierV1> {
  const suffix = candidateId === 'candidate-alpha' ? 'alpha' : 'beta';
  const evidence = createEvidence(candidateId);
  return {
    contractVersion: '1.0.0',
    identity: {
      candidateId,
      displayName: `Candidate ${suffix}`,
      repository: {
        host: 'github',
        owner: 'example',
        name: suffix,
      },
      package: {
        registry: 'npm',
        name: `example-${suffix}`,
      },
    },
    capabilityFamily: 'authorization',
    versionScope: '1.0.0',
    observations: [evidence],
    limitations: [
      {
        limitationId: `limitation-${suffix}`,
        limitationCode: 'live-validation-not-performed',
        candidateId,
        statement:
          evidence.limitation ?? 'No separate candidate limitation is known.',
        evidenceIds: [evidence.evidenceId],
      },
    ],
    unknowns: [],
  };
}
