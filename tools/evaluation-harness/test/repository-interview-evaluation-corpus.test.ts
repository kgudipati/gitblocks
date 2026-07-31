import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  loadRepositoryInterviewEvaluationCorpusV1,
  REQUIRED_REPOSITORY_INTERVIEW_ADVERSARIAL_FIXTURE_IDS,
  REQUIRED_REPOSITORY_INTERVIEW_CALIBRATION,
  REQUIRED_REPOSITORY_INTERVIEW_CANDIDATE_IDS,
  validateRepositoryInterviewEvaluationCohortV1,
} from '../src/repository-interview-evaluation-corpus.ts';
import { repositoryInterviewEvaluationCorpusDigestV1 } from '../src/repository-interview-evaluation-digests.ts';
import { createRepositoryInterviewEvaluationSchemaRegistry } from '../src/repository-interview-evaluation-schema-registry.ts';
import type { RepositoryInterviewEvaluationCandidateV1 } from '../src/repository-interview-evaluation-contracts.ts';
import { findGitBlocksRoot } from '../src/repository-root.ts';

const root = findGitBlocksRoot(process.cwd());
const temporary: string[] = [];

afterEach(() => {
  for (const path of temporary.splice(0))
    rmSync(path, { force: true, recursive: true });
});

describe('repository-interviews-v1 corpus', () => {
  it('loads the amended exact cohort and derives all authority counts', () => {
    const corpus = loaded();
    expect(corpus.candidates.map(({ candidateId }) => candidateId)).toEqual(
      REQUIRED_REPOSITORY_INTERVIEW_CANDIDATE_IDS,
    );
    expect(corpus.derived).toEqual({
      archivedCount: 3,
      calibrationCount: 6,
      familyCounts: {
        authorization: 6,
        'audit-logging': 6,
        'background-jobs': 6,
        'rate-limiting': 6,
        webhooks: 6,
      },
      movedCount: 2,
      negativeControlCount: 5,
      readmeOnlyCount: 18,
      richDocumentationCount: 12,
    });
    expect(
      corpus.adversarialFixtures.map(({ fixtureId }) => fixtureId),
    ).toEqual(REQUIRED_REPOSITORY_INTERVIEW_ADVERSARIAL_FIXTURE_IDS);
    expect(
      corpus.candidates
        .filter(({ calibrationMember }) => calibrationMember)
        .sort(
          (a, b) => (a.calibrationOrdinal ?? 9) - (b.calibrationOrdinal ?? 9),
        )
        .map(({ candidateId }) => candidateId),
    ).toEqual(REQUIRED_REPOSITORY_INTERVIEW_CALIBRATION);
  });

  it('treats lifecycle diversity as cohort-level authority', () => {
    const corpus = loaded();
    for (const family of ['rate-limiting', 'webhooks']) {
      const members = corpus.candidates.filter(
        ({ capabilityFamily }) => capabilityFamily === family,
      );
      expect(
        members.some(
          ({ catalogStatus }) =>
            catalogStatus === 'archived' || catalogStatus === 'moved',
        ),
      ).toBe(false);
      expect(members).toHaveLength(6);
    }
  });

  it('requires exact membership, family balance, status counts, labels, and challenge coverage', () => {
    const { candidates } = loaded();
    expect(codes(validate(candidates.slice(1)))).toContain('cohort.membership');
    expect(codes(validate([...candidates, candidates[0]!]))).toContain(
      'cohort.duplicate',
    );
    expect(
      codes(
        validate(
          replace(candidates, 'rate-apisix', { capabilityFamily: 'webhooks' }),
        ),
      ),
    ).toContain('cohort.family');
    expect(
      codes(
        validate(
          replace(candidates, 'audit-vector', {
            catalogStatus: 'archived',
            selectionLabels: [
              'archived-lifecycle',
              'complex-service-or-platform',
              'likely-material-unknown',
              'rich-additional-documentation',
            ],
          }),
        ),
      ),
    ).toContain('cohort.status');
    const complexRemoved = candidates.map((candidate) =>
      candidate.capabilityFamily === 'audit-logging'
        ? {
            ...candidate,
            selectionLabels: candidate.selectionLabels.filter(
              (label) => label !== 'complex-service-or-platform',
            ),
          }
        : candidate,
    );
    expect(codes(validate(complexRemoved))).toContain('cohort.family-coverage');
    const simpleRemoved = candidates.map((candidate) =>
      candidate.capabilityFamily === 'audit-logging'
        ? {
            ...candidate,
            selectionLabels: candidate.selectionLabels.filter(
              (label) => label !== 'simple-library-or-helper',
            ),
          }
        : candidate,
    );
    expect(codes(validate(simpleRemoved))).toContain('cohort.family-coverage');
    const unknownRemoved = candidates.map((candidate) =>
      candidate.capabilityFamily === 'webhooks'
        ? {
            ...candidate,
            selectionLabels: candidate.selectionLabels.filter(
              (label) => label !== 'likely-material-unknown',
            ),
          }
        : candidate,
    );
    expect(codes(validate(unknownRemoved))).toContain('cohort.family-coverage');
  });

  it('rejects fake lifecycle labels and documentation-scope drift', () => {
    const { candidates } = loaded();
    expect(
      codes(
        validate(
          replace(candidates, 'audit-vector', {
            selectionLabels: [
              'archived-lifecycle',
              'complex-service-or-platform',
              'likely-material-unknown',
              'rich-additional-documentation',
            ],
          }),
        ),
      ),
    ).toContain('cohort.status-label');
    expect(
      codes(
        validate(
          replace(candidates, 'audit-datadog-trace-js', {
            selectionLabels: [
              'likely-material-unknown',
              'moved-repository',
              'negative-control',
              'readme-only',
              'simple-library-or-helper',
            ],
          }),
        ),
      ),
    ).toContain('cohort.status-label');
    expect(
      codes(
        validate(
          replace(candidates, 'audit-vector', {
            selectionLabels: [
              'complex-service-or-platform',
              'likely-material-unknown',
              'readme-only',
              'rich-additional-documentation',
            ],
          }),
        ),
      ),
    ).toContain('cohort.documentation-scope');
  });

  it('rejects duplicate, unsorted, unknown, and exclusive primary labels at the schema boundary', () => {
    const registry = createRepositoryInterviewEvaluationSchemaRegistry(root);
    const candidate = loaded().candidates[0]!;
    expect(
      registry.validate('candidate', {
        ...candidate,
        selectionLabels: [
          ...candidate.selectionLabels,
          candidate.selectionLabels[0],
        ],
      }),
    ).not.toHaveLength(0);
    expect(
      codes(
        validate(
          replace(loaded().candidates, candidate.candidateId, {
            selectionLabels: [...candidate.selectionLabels].reverse(),
          }),
        ),
      ),
    ).toContain('cohort.labels');
    expect(
      registry.validate('candidate', {
        ...candidate,
        selectionLabels: ['unreviewed-label'],
      }),
    ).not.toHaveLength(0);
    expect(
      registry.validate('candidate', {
        ...candidate,
        primaryStratum: 'archived-or-moved',
      }),
    ).not.toHaveLength(0);
  });

  it('requires the exact calibration membership, ordinals, and challenge diversity', () => {
    const { candidates } = loaded();
    expect(
      codes(
        validate(
          replace(candidates, 'auth-warrant', { calibrationOrdinal: 5 }),
        ),
      ),
    ).toContain('cohort.calibration-membership');
    const swapped = replace(
      replace(candidates, 'auth-warrant', {
        calibrationMember: false,
        calibrationOrdinal: null,
      }),
      'auth-cerbos-cerbos',
      { calibrationMember: true, calibrationOrdinal: 0 },
    );
    expect(codes(validate(swapped))).toContain('cohort.calibration-membership');
    const familyDrift = replace(candidates, 'auth-warrant', {
      capabilityFamily: 'background-jobs',
    });
    expect(codes(validate(familyDrift))).toContain('cohort.calibration-family');
    const challengeDrift = replace(candidates, 'auth-warrant', {
      selectionLabels: ['readme-only', 'simple-library-or-helper'],
    });
    expect(codes(validate(challengeDrift))).toContain(
      'cohort.calibration-challenge',
    );
  });

  it('detects member hash drift, missing files, extra files, and manifest order drift', () => {
    const copy = copyAuthority();
    const candidatePath = join(
      copy,
      'evals/repository-interviews-v1/candidates/audit-vector.json',
    );
    writeFileSync(
      candidatePath,
      readFileSync(candidatePath, 'utf8').replace(
        'audit-vector',
        'audit-vector-x',
      ),
    );
    expect(loadRepositoryInterviewEvaluationCorpusV1(copy).ok).toBe(false);

    const missing = copyAuthority();
    rmSync(
      join(
        missing,
        'evals/repository-interviews-v1/adversarial/instruction-override.json',
      ),
    );
    expect(loadRepositoryInterviewEvaluationCorpusV1(missing).ok).toBe(false);

    const extra = copyAuthority();
    writeFileSync(
      join(extra, 'evals/repository-interviews-v1/candidates/extra.json'),
      '{}\n',
    );
    expect(loadRepositoryInterviewEvaluationCorpusV1(extra).ok).toBe(false);

    const unexpected = copyAuthority();
    writeFileSync(
      join(
        unexpected,
        'evals/repository-interviews-v1/adversarial/unexpected.txt',
      ),
      'synthetic',
    );
    expect(loadRepositoryInterviewEvaluationCorpusV1(unexpected).ok).toBe(
      false,
    );

    const unordered = copyAuthority();
    const manifestPath = join(
      unordered,
      'evals/repository-interviews-v1/manifest.json',
    );
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      candidates: unknown[];
    };
    manifest.candidates.reverse();
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    expect(loadRepositoryInterviewEvaluationCorpusV1(unordered).ok).toBe(false);
  });

  it('keeps all twelve evaluation schemas independently named and recursively closed', () => {
    const directory = join(root, 'schemas/evaluation/repository-interviews');
    const names = [
      'adjudication-record',
      'adversarial-fixture',
      'audit-record',
      'audit-scope',
      'candidate',
      'cohort-policy',
      'gate-policy',
      'gate-report',
      'manifest',
      'review-policy',
      'rubric',
      'run-summary',
    ];
    for (const name of names) {
      const schema = JSON.parse(
        readFileSync(join(directory, `${name}.schema.json`), 'utf8'),
      ) as unknown;
      expect(JSON.stringify(schema)).toContain(
        `/repository-interviews/${name}/1.0.0`,
      );
      assertClosedObjects(schema);
    }
  });

  it('fails closed when a reviewed policy drifts from its manifest digest', () => {
    const copy = copyAuthority();
    const policyPath = join(
      copy,
      'evals/repository-interviews-v1/policy/review-policy.json',
    );
    writeFileSync(
      policyPath,
      readFileSync(policyPath, 'utf8').replace(
        '"secondarySampleNumerator": 10',
        '"secondarySampleNumerator": 9',
      ),
    );
    const result = loadRepositoryInterviewEvaluationCorpusV1(copy);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics.map(({ code }) => code)).toContain(
      'manifest.hash',
    );
  });

  it('retains bounded file and string failures for candidate documents', () => {
    const oversized = copyAuthority();
    writeFileSync(
      join(
        oversized,
        'evals/repository-interviews-v1/candidates/audit-vector.json',
      ),
      ' '.repeat(256 * 1024 + 1),
    );
    expect(loadRepositoryInterviewEvaluationCorpusV1(oversized).ok).toBe(false);
    const registry = createRepositoryInterviewEvaluationSchemaRegistry(root);
    const candidate = loaded().candidates[0]!;
    expect(
      registry.validate('candidate', {
        ...candidate,
        candidateId: 'x'.repeat(129),
      }),
    ).not.toHaveLength(0);
  });

  it('has a deterministic non-self-referential corpus digest', () => {
    const manifest = loaded().manifest;
    const { corpusDigest: ignored, ...input } = manifest;
    void ignored;
    expect(repositoryInterviewEvaluationCorpusDigestV1(input)).toBe(
      manifest.corpusDigest,
    );
    expect(repositoryInterviewEvaluationCorpusDigestV1(input)).toBe(
      repositoryInterviewEvaluationCorpusDigestV1(input),
    );
  });
});

function loaded() {
  const result = loadRepositoryInterviewEvaluationCorpusV1(root);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('fixture corpus failed');
  return result.corpus;
}

function authorities() {
  interface CatalogAuthority {
    readonly candidates: readonly {
      readonly candidateId: string;
      readonly primaryCapabilityFamily: RepositoryInterviewEvaluationCandidateV1['capabilityFamily'];
      readonly status: RepositoryInterviewEvaluationCandidateV1['catalogStatus'];
    }[];
  }
  interface ArtifactAuthority {
    readonly candidates: readonly {
      readonly candidateId: string;
      readonly selections: readonly {
        readonly artifactKind: 'documentation' | 'readme';
      }[];
    }[];
  }
  const catalog = JSON.parse(
    readFileSync(join(root, 'catalog/public-v1/manifest.json'), 'utf8'),
  ) as unknown as CatalogAuthority;
  const artifacts = JSON.parse(
    readFileSync(
      join(root, 'catalog/public-v1/artifact-manifest.json'),
      'utf8',
    ),
  ) as unknown as ArtifactAuthority;
  return {
    catalog: catalog.candidates,
    artifacts: artifacts.candidates,
  };
}

function validate(
  candidates: readonly RepositoryInterviewEvaluationCandidateV1[],
) {
  const source = authorities();
  return validateRepositoryInterviewEvaluationCohortV1(
    candidates,
    source.catalog,
    source.artifacts,
  );
}

function replace(
  candidates: readonly RepositoryInterviewEvaluationCandidateV1[],
  candidateId: string,
  patch: Partial<RepositoryInterviewEvaluationCandidateV1>,
): RepositoryInterviewEvaluationCandidateV1[] {
  return candidates.map((candidate) =>
    candidate.candidateId === candidateId
      ? { ...candidate, ...patch }
      : candidate,
  );
}

function codes(issues: readonly { code: string }[]) {
  return issues.map(({ code }) => code);
}

function copyAuthority(): string {
  const directory = mkdtempSync(join(tmpdir(), 'gitblocks-interview-evals-'));
  temporary.push(directory);
  cpSync(join(root, 'package.json'), join(directory, 'package.json'));
  cpSync(
    join(root, 'evals/repository-interviews-v1'),
    join(directory, 'evals/repository-interviews-v1'),
    { recursive: true },
  );
  cpSync(
    join(root, 'schemas/evaluation/repository-interviews'),
    join(directory, 'schemas/evaluation/repository-interviews'),
    { recursive: true },
  );
  cpSync(
    join(root, 'catalog/public-v1'),
    join(directory, 'catalog/public-v1'),
    { recursive: true },
  );
  return directory;
}

function assertClosedObjects(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  if (!Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (record['type'] === 'object' || record['properties'] !== undefined) {
      expect(record['additionalProperties']).toBe(false);
      expect(record['required']).toEqual(
        Object.keys(record['properties'] as Record<string, unknown>),
      );
    }
  }
  for (const child of Object.values(value)) assertClosedObjects(child);
}
