import assert from 'node:assert/strict';
import test from 'node:test';

import {
  captureAssessmentDiagnostics,
  captureRejectedModelSubstance,
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

test('captures only requested rejected decomposition substance with exact issues', () => {
  const response = {
    candidateAssessments: {
      f1: {
        fitJudgment: 'viable',
        reasons: [
          {
            statement: 'Reason prose is intentionally not retained.',
            evidenceIds: ['e1'],
            limitationIds: ['l1'],
            candidateUnknownIds: ['u1'],
            claims: [
              {
                topic: 'deployment-fit',
                direction: 'favorable',
                statement: 'The candidate fits the target deployment.',
                evidenceIds: ['e1'],
                inferences: [
                  {
                    topic: 'deployment-fit',
                    statement: 'Candidate evidence aligns with the target.',
                    rationale: 'The deployment forms match.',
                    evidenceIds: ['e1'],
                    repositoryFactIds: ['fact-runtime'],
                  },
                ],
              },
            ],
            assessmentUnknowns: [
              {
                topic: 'deployment-fit',
                statement: 'The edge-runtime behavior is not established.',
                evidenceIds: [],
              },
            ],
          },
        ],
        hardEvaluations: {},
      },
      f2: {
        fitJudgment: 'rejected',
        reasons: [
          {
            statement: 'Another omitted reason.',
            evidenceIds: [],
            limitationIds: [],
            candidateUnknownIds: [],
            claims: [],
            assessmentUnknowns: [],
          },
        ],
        hardEvaluations: {},
      },
    },
    orderedPositiveCandidateIds: ['f1', 'f1'],
    assessmentProcessing: {
      state: 'complete',
      incompleteReasonCodes: [],
    },
  };
  const captured = captureRejectedModelSubstance({
    request: {
      candidates: [
        {
          identity: { candidateId: 'candidate-alpha' },
          limitations: [
            {
              limitationId: 'l1',
              category: 'deployment',
              statement: 'Edge deployment support is limited.',
            },
          ],
          unknowns: [
            {
              unknownId: 'u1',
              topic: 'deployment-fit',
              statement: 'Edge-runtime compatibility is unknown.',
            },
          ],
        },
        {
          identity: { candidateId: 'candidate-beta' },
          limitations: [],
          unknowns: [],
        },
      ],
    },
    response,
    validation: {
      ok: false,
      issues: [
        {
          code: 'domain.model-decomposition.positive-order',
          path: '/orderedPositiveCandidateIds',
        },
        {
          code: 'domain.claim.unresolved-unknown',
          path: '/targetFitAssessment/fitAssessment/materialClaims/0',
        },
      ],
    },
  });

  assert.deepEqual(captured, {
    candidateAssessments: [
      {
        candidateSlot: 'f1',
        fitJudgment: 'viable',
        claims: [
          {
            reasonIndex: 0,
            claimIndex: 0,
            topic: 'deployment-fit',
            direction: 'favorable',
            statement: 'The candidate fits the target deployment.',
            evidenceIds: ['e1'],
            inferences: [
              {
                topic: 'deployment-fit',
                statement: 'Candidate evidence aligns with the target.',
                rationale: 'The deployment forms match.',
                evidenceIds: ['e1'],
                repositoryFactIds: ['fact-runtime'],
              },
            ],
          },
        ],
        assessmentUnknowns: [
          {
            reasonIndex: 0,
            unknownIndex: 0,
            topic: 'deployment-fit',
            statement: 'The edge-runtime behavior is not established.',
          },
        ],
        consideredLimitations: [
          {
            reasonIndex: 0,
            limitationId: 'l1',
          },
        ],
        consideredCandidateUnknowns: [
          {
            reasonIndex: 0,
            unknownId: 'u1',
          },
        ],
      },
      {
        candidateSlot: 'f2',
        fitJudgment: 'rejected',
        claims: [],
        assessmentUnknowns: [],
        consideredLimitations: [],
        consideredCandidateUnknowns: [],
      },
    ],
    orderedPositiveCandidateIds: ['f1', 'f1'],
    assessmentProcessing: {
      state: 'complete',
      incompleteReasonCodes: [],
    },
    validationIssues: [
      {
        code: 'domain.model-decomposition.positive-order',
        path: '/orderedPositiveCandidateIds',
      },
      {
        code: 'domain.claim.unresolved-unknown',
        path: '/targetFitAssessment/fitAssessment/materialClaims/0',
      },
    ],
  });
  assert.doesNotMatch(JSON.stringify(captured), /Reason prose|omitted reason/);
  assert.equal(
    captureRejectedModelSubstance({
      request: { candidates: [] },
      response,
      validation: { ok: true, issues: [] },
    }),
    null,
  );
});
