import { describe, expect, it } from 'vitest';

import { canonicalizeJson } from '../src/canonical-json.ts';
import { extractApplicableSecurityAdvisoryFacts } from '../src/candidate-authority-partial-rules.ts';
import {
  normalizeCandidateAuthorityAdvisorySeverity,
  projectCandidateAuthorityLocalSecurityPolicy,
  type CandidateAuthorityTreeResult,
} from '../src/candidate-authority-provider-contract.ts';
import { projectCandidateAuthorityAdvisoryState } from '../src/candidate-authority-rules.ts';

interface ReplayFixtureCandidate {
  readonly candidateId: string;
  readonly sources: readonly {
    readonly operationId: 'github-advisories' | 'github-root-tree';
    readonly value: unknown;
  }[];
}

describe('candidate authority pure replay v3 determinism', () => {
  it('produces one canonical semantic digest for forward, repeat, reverse, and legal source permutation replay', () => {
    const fixture = candidates();
    const normal = replay(fixture);
    const repeat = replay(fixture);
    const reverse = replay([...fixture].reverse());
    const permutation = replay(
      fixture.map((candidate) => ({
        ...candidate,
        sources: [...candidate.sources].reverse(),
      })),
    );
    expect([repeat, reverse, permutation]).toEqual([normal, normal, normal]);
    expect(normal.digest).toMatch(/^[a-f0-9]{64}$/u);
  });
});

function replay(candidatesInput: readonly ReplayFixtureCandidate[]) {
  const output = candidatesInput
    .map((candidate) => {
      const sources = new Map(
        candidate.sources.map((source) => [source.operationId, source]),
      );
      const advisorySource = sources.get('github-advisories');
      const advisoryRecord = advisorySource?.value as {
        packageName: string;
        packageVersion: string;
        advisories: readonly {
          advisoryId: string;
          providerSeverity: 'medium' | 'unknown';
        }[];
      };
      const advisories = advisoryRecord.advisories.map((advisory) => ({
        advisoryId: advisory.advisoryId,
        severity:
          normalizeCandidateAuthorityAdvisorySeverity(advisory.providerSeverity)
            ?.normalizedSeverity ?? null,
      }));
      const advisoryState = projectCandidateAuthorityAdvisoryState({
        snapshotAt: '2026-08-11T12:00:00.000Z',
        expectedPackageName: advisoryRecord.packageName,
        expectedPackageVersion: advisoryRecord.packageVersion,
        sourcePackageName: advisoryRecord.packageName,
        sourcePackageVersion: advisoryRecord.packageVersion,
        outcome: 'established-value',
        complete: true,
        advisories,
      });
      const partial = extractApplicableSecurityAdvisoryFacts({
        expectedPackageName: advisoryRecord.packageName,
        expectedPackageVersion: advisoryRecord.packageVersion,
        sourcePackageName: advisoryRecord.packageName,
        sourcePackageVersion: advisoryRecord.packageVersion,
        outcome: 'established-value',
        advisories,
      });
      const rootSource = sources.get('github-root-tree');
      const security = projectCandidateAuthorityLocalSecurityPolicy({
        root: rootSource?.value as CandidateAuthorityTreeResult,
        dotGithub: null,
        docs: null,
      });
      return {
        candidateId: candidate.candidateId,
        advisoryState,
        partial,
        security,
      };
    })
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId));
  return { output, digest: canonicalizeJson(output).digest };
}

function candidates(): readonly ReplayFixtureCandidate[] {
  return [candidate('candidate-b', false), candidate('candidate-a', true)];
}

function candidate(
  candidateId: string,
  localPolicy: boolean,
): ReplayFixtureCandidate {
  return {
    candidateId,
    sources: [
      {
        operationId: 'github-root-tree',
        value: {
          state: 'established-value',
          sha: '1'.repeat(40),
          entries: localPolicy
            ? [
                {
                  path: 'SECURITY.md',
                  mode: '100644',
                  type: 'blob',
                  sha: '2'.repeat(40),
                  size: null,
                },
              ]
            : [],
        },
      },
      {
        operationId: 'github-advisories',
        value: {
          packageName: 'example',
          packageVersion: '1.2.3',
          advisories: [
            {
              advisoryId: 'ghsa-2345-6789-cfgh',
              providerSeverity: 'medium',
            },
            {
              advisoryId: 'ghsa-6789-cfgh-jmpq',
              providerSeverity: 'unknown',
            },
          ],
        },
      },
    ],
  };
}
