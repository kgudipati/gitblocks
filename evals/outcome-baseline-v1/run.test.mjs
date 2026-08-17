import assert from 'node:assert/strict';
import test from 'node:test';

import {
  captureAssessmentDiagnostics,
  renderAssessmentDiagnosticLines,
} from './run.mjs';

function modelRequest() {
  return {
    candidates: [
      {
        identity: { candidateId: 'candidate-alpha' },
        limitations: [{ limitationId: 'l1' }],
        unknowns: [{ unknownId: 'u1' }],
      },
      {
        identity: { candidateId: 'candidate-beta' },
        limitations: [{ limitationId: 'l2' }, { limitationId: 'l3' }],
        unknowns: [],
      },
    ],
  };
}

function modelResponse() {
  return {
    targetFitAssessment: {
      fitAssessment: {
        candidateAssessments: [
          {
            candidateId: 'candidate-alpha',
            disposition: 'rejected',
          },
          {
            candidateId: 'candidate-beta',
            disposition: 'viable',
          },
        ],
        inferences: [{ inferenceId: 'i1' }, { inferenceId: 'i2' }],
        materialClaims: [{ claimId: 'c1' }],
        assessmentUnknowns: [{ unknownId: 'a1' }],
        hardConstraintConflicts: [
          { conflictId: 'x1', candidateId: 'candidate-alpha' },
        ],
      },
    },
    evidenceNeededHardConstraintResolutions: [
      {
        candidateId: 'candidate-alpha',
        evaluationId: 'evaluation-1',
        state: 'conflict',
      },
      {
        candidateId: 'candidate-beta',
        evaluationId: 'evaluation-2',
        state: 'satisfied',
      },
      {
        candidateId: 'candidate-beta',
        evaluationId: 'evaluation-3',
        state: 'unresolved',
      },
    ],
  };
}

test('captures domain issues, per-candidate states, and declared catalog counts', () => {
  const diagnostics = captureAssessmentDiagnostics({
    request: modelRequest(),
    response: modelResponse(),
    validation: {
      ok: false,
      issues: [
        { code: 'domain.ranking.candidate', path: '/rankGroups/0' },
        { code: 'domain.ranking.candidate', path: '/rankGroups/1' },
        { code: 'domain.constraint.ranking', path: '/rankGroups/0' },
        { code: 'contract.pattern', path: '/ignored' },
      ],
    },
  });

  assert.deepEqual(diagnostics.domainIssueCounts, {
    'domain.constraint.ranking': 1,
    'domain.ranking.candidate': 2,
  });
  assert.deepEqual(diagnostics.catalogCounts, {
    claims: 1,
    conflicts: 1,
    inferences: 2,
    limitations: 3,
    unknowns: 2,
  });
  assert.deepEqual(diagnostics.candidates, [
    {
      candidateId: 'candidate-alpha',
      disposition: 'rejected',
      dispositions: ['rejected'],
      resolutionStates: { conflict: 1, satisfied: 0, unresolved: 0 },
      rejectedOnDeclaredConflict: true,
    },
    {
      candidateId: 'candidate-beta',
      disposition: 'viable',
      dispositions: ['viable'],
      resolutionStates: { conflict: 0, satisfied: 1, unresolved: 1 },
      rejectedOnDeclaredConflict: false,
    },
  ]);
  assert.equal(diagnostics.hasSatisfiedResolution, true);
  assert.equal(diagnostics.hasRejectedDispositionOnDeclaredConflict, true);
});

test('renders aggregate diagnostics without candidate identities or model text', () => {
  const diagnostics = captureAssessmentDiagnostics({
    request: modelRequest(),
    response: modelResponse(),
    validation: {
      ok: false,
      issues: [{ code: 'domain.ranking.candidate', path: '/candidate-alpha' }],
    },
  });
  const rendered = renderAssessmentDiagnosticLines([
    {
      fixtureId: 'fixture-one',
      diagnostics,
    },
  ]).join('\n');

  assert.match(rendered, /domain\.ranking\.candidate/);
  assert.match(rendered, /satisfied\s+\|\s+1/);
  assert.match(rendered, /rejected\s+\|\s+1/);
  assert.doesNotMatch(rendered, /candidate-alpha|candidate-beta/);
  assert.doesNotMatch(rendered, /model assertion text/);
});
