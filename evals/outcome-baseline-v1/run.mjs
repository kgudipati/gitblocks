/* global Buffer, console, process */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import {
  createOpenAiFitAssessmentModel,
  HOSTED_FIT_FINALIST_LIMIT,
  HOSTED_FIT_MODEL,
  startHostedRecommendationComposition,
} from '../../apps/gitblocks-hosted/dist/src/index.js';
import {
  parseOssRecommendationRequestV1,
  parseRecommendationAssessmentModelResponseV1,
  parseRepositoryFingerprintV1,
  repositoryFingerprintDigestV1,
  validateRecommendationModelAssessmentExchangeV1,
} from '../../packages/contracts/dist/src/index.js';

const BASELINE_DIRECTORY = import.meta.dirname;
const REPOSITORY_ROOT = resolve(BASELINE_DIRECTORY, '../..');
const REQUEST_DIRECTORY = join(BASELINE_DIRECTORY, 'requests');
const REPORT_PATH = join(
  REPOSITORY_ROOT,
  'verification/outcome-baseline-v1/report.md',
);
const LOCAL_DIAGNOSTICS_PATH = join(
  REPOSITORY_ROOT,
  'logs/outcome-baseline-v1/diagnostics.json',
);
const SCANNER_PATH = join(
  REPOSITORY_ROOT,
  '.agents/skills/gitblocks-oss-adoption/scripts/fingerprint-codebase.mjs',
);
const SCANNER_OBSERVED_AT = '2026-08-17T00:56:20.000Z';
const APPROVED_AT = '2026-08-17T00:56:21.000Z';
const CONTRACT_VERSION = '1.0.0';

const DATABASE_ENVIRONMENT_NAMES = Object.freeze({
  host: 'GITBLOCKS_SERVING_BOOTSTRAP_DB_HOST',
  port: 'GITBLOCKS_SERVING_BOOTSTRAP_DB_PORT',
  database: 'GITBLOCKS_SERVING_BOOTSTRAP_DB_DATABASE',
  username: 'GITBLOCKS_SERVING_BOOTSTRAP_DB_USERNAME',
  password: 'GITBLOCKS_SERVING_BOOTSTRAP_DB_PASSWORD',
  ssl: 'GITBLOCKS_SERVING_BOOTSTRAP_DB_SSL',
});

const OUTCOME_ORDER = Object.freeze([
  'clarification-required',
  'unsupported',
  'insufficient-evidence',
  'no-viable-candidate',
  'recommend',
  'failed',
]);
const DISPOSITION_ORDER = Object.freeze([
  'recommended',
  'viable',
  'rejected',
  'insufficient-evidence',
]);
const RESOLUTION_STATE_ORDER = Object.freeze([
  'satisfied',
  'conflict',
  'unresolved',
]);
const CATALOG_ORDER = Object.freeze([
  'inferences',
  'claims',
  'unknowns',
  'limitations',
  'conflicts',
]);

const FAMILY_DEFINITIONS = Object.freeze([
  Object.freeze({
    family: 'authorization',
    summary:
      'Select an OSS authorization capability for application-owned access decisions.',
    success:
      'Enforce role-based access decisions at application request boundaries.',
    constraints: Object.freeze([
      required('role-based-access-control', 'feature'),
      preferred('framework-authorization-middleware', 'architecture'),
    ]),
  }),
  Object.freeze({
    family: 'audit-logging',
    summary:
      'Select an OSS audit logging capability for attributable application events.',
    success:
      'Emit structured audit events with actor context and controlled sensitive fields.',
    constraints: Object.freeze([
      required('structured-audit-events', 'feature'),
      required('sensitive-field-handling', 'feature'),
      preferred('actor-request-context', 'feature'),
    ]),
  }),
  Object.freeze({
    family: 'background-jobs',
    summary:
      'Select an OSS background jobs capability for durable asynchronous work.',
    success:
      'Retry failed work and prevent duplicate processing across application restarts.',
    constraints: Object.freeze([
      required('retries', 'feature'),
      required('job-uniqueness-deduplication', 'feature'),
      preferred('delayed-jobs', 'feature'),
    ]),
  }),
  Object.freeze({
    family: 'rate-limiting',
    summary:
      'Select an OSS rate limiting capability for public application endpoints.',
    success:
      'Enforce bounded request rates with an explicit behavior when limiter state is unavailable.',
    constraints: Object.freeze([
      required('rate-limit-failure-mode', 'feature'),
      preferred('sliding-window', 'feature'),
    ]),
  }),
  Object.freeze({
    family: 'webhooks',
    summary:
      'Select an OSS webhook capability for receiving untrusted external events.',
    success:
      'Verify webhook signatures, reject replays, and support idempotent event handling.',
    constraints: Object.freeze([
      required('signature-verification', 'feature'),
      required('replay-protection', 'feature'),
      preferred('webhook-idempotency', 'feature'),
    ]),
  }),
]);

const TARGET_DEFINITIONS = Object.freeze([
  Object.freeze({
    targetId: 'next-vercel-drizzle',
    directory: 'targets/next-vercel-drizzle',
    success:
      'Fit a Next.js deployment on Vercel using PostgreSQL through Drizzle without Redis.',
    constraints: Object.freeze([
      prohibited('redis', 'infrastructure'),
      preferred('postgresql', 'infrastructure'),
    ]),
  }),
  Object.freeze({
    targetId: 'express-container-prisma-redis',
    directory: 'targets/express-container-prisma-redis',
    success:
      'Fit a containerized Node and Express service using PostgreSQL through Prisma with Redis available.',
    constraints: Object.freeze([
      preferred('self-hosted-service', 'deployment'),
      preferred('postgresql', 'infrastructure'),
      preferred('redis', 'infrastructure'),
    ]),
  }),
  Object.freeze({
    targetId: 'next-selfhosted-drizzle',
    directory: 'targets/next-selfhosted-drizzle',
    success:
      'Fit a self-hosted Next.js deployment using PostgreSQL through Drizzle without adding external services.',
    constraints: Object.freeze([
      prohibited('external-hosted-service', 'infrastructure'),
      prohibited('separate-control-plane', 'infrastructure'),
      prohibited('redis', 'infrastructure'),
      preferred('in-process-embedded', 'deployment'),
      preferred('postgresql', 'infrastructure'),
    ]),
  }),
]);

const FIXTURE_DEFINITIONS = Object.freeze(
  FAMILY_DEFINITIONS.flatMap((family) =>
    TARGET_DEFINITIONS.map((target) =>
      Object.freeze({
        fixtureId: `${family.family}-${target.targetId}`,
        family,
        target,
      }),
    ),
  ),
);

class BaselineError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function required(originalTerm, facetHint) {
  return Object.freeze({
    modality: 'required',
    originalTerm,
    facetHint,
    reasonCode: 'user-required',
  });
}

function preferred(originalTerm, facetHint) {
  return Object.freeze({
    modality: 'preferred',
    originalTerm,
    facetHint,
    reasonCode: null,
  });
}

function prohibited(originalTerm, facetHint) {
  return Object.freeze({
    modality: 'prohibited',
    originalTerm,
    facetHint,
    reasonCode: 'user-prohibited',
  });
}

async function main() {
  if (process.argv.length === 3 && process.argv[2] === '--write-fixtures') {
    await writeFixtures();
    console.log(
      JSON.stringify({
        status: 'complete',
        operation: 'outcome-baseline-v1.write-fixtures',
        fixtureCount: FIXTURE_DEFINITIONS.length,
      }),
    );
    return;
  }
  if (process.argv.length !== 2) {
    throw new BaselineError('outcome-baseline.invalid-arguments');
  }
  const fixtures = await loadFixtures();
  const database = readDatabaseConfiguration(process.env);
  const modelCaptures = new Map();
  const assessmentDiagnostics = new Map();
  const modelMeasurements = new Map();
  const providerMeasurements = new Map();
  const providerMeasurementPromises = [];
  let modelCalls = 0;
  let delegateModel = null;
  let modelEnvironmentMissing = false;
  let activeModelRequestId = null;
  const measuredFetch = async (resource, init) => {
    const requestId = activeModelRequestId;
    const response = await globalThis.fetch(resource, init);
    if (requestId !== null) {
      providerMeasurementPromises.push(
        captureProviderMeasurement(
          requestId,
          response.clone(),
          providerMeasurements,
        ),
      );
    }
    return response;
  };
  const fitModel = Object.freeze({
    assess: async (input) => {
      modelCalls += 1;
      const requestId = input.fitAssessmentRequest.assessmentRequestId;
      modelCaptures.set(requestId, captureModelInput(input));
      const apiKey = process.env.OPENAI_API_KEY;
      if (apiKey === undefined || apiKey.length === 0) {
        modelEnvironmentMissing = true;
        throw new BaselineError('outcome-baseline.environment-missing');
      }
      delegateModel ??= createOpenAiFitAssessmentModel({
        configuration: Object.freeze({ apiKey, model: HOSTED_FIT_MODEL }),
        fetch: measuredFetch,
      });
      const startedAt = performance.now();
      activeModelRequestId = requestId;
      try {
        const response = await delegateModel.assess(input);
        assessmentDiagnostics.set(
          requestId,
          validateAndCaptureAssessmentDiagnostics(
            input,
            response,
            modelCaptures.get(requestId) ?? null,
          ),
        );
        modelMeasurements.set(
          requestId,
          Object.freeze({
            completed: true,
            latencyMs: performance.now() - startedAt,
          }),
        );
        return response;
      } catch (error) {
        modelMeasurements.set(
          requestId,
          Object.freeze({
            completed: false,
            latencyMs: performance.now() - startedAt,
          }),
        );
        throw error;
      } finally {
        activeModelRequestId = null;
      }
    },
  });
  const eventsByRequestId = new Map();
  const observer = Object.freeze({
    emit: (event) => {
      const events = eventsByRequestId.get(event.recommendationRequestId) ?? [];
      events.push(event);
      eventsByRequestId.set(event.recommendationRequestId, events);
    },
  });

  let composition;
  let measurements = null;
  let executionFailure = null;
  try {
    composition = await startHostedRecommendationComposition({
      database,
      fitModel,
      observer,
    });
    if (!composition.readiness().ready) {
      throw new BaselineError('outcome-baseline.composition-not-ready');
    }
    measurements = [];
    for (const fixture of fixtures) {
      const operation = await composition.recommendOss(fixture.request);
      measurements.push(
        measureOperation({
          fixture,
          operation,
          modelCapture: modelCaptures.get(fixture.fixtureId) ?? null,
          diagnostics: assessmentDiagnostics.get(fixture.fixtureId) ?? null,
          events: eventsByRequestId.get(fixture.fixtureId) ?? [],
          modelMeasurement: modelMeasurements.get(fixture.fixtureId) ?? null,
        }),
      );
    }
    await Promise.all(providerMeasurementPromises);
    if (modelEnvironmentMissing) {
      throw new BaselineError('outcome-baseline.environment-missing');
    }
  } catch (error) {
    executionFailure =
      error instanceof BaselineError
        ? error
        : new BaselineError('outcome-baseline.execution-failed');
  } finally {
    if (composition !== undefined) {
      try {
        await composition.close();
      } catch {
        executionFailure ??= new BaselineError(
          'outcome-baseline.shutdown-failed',
        );
      }
    }
  }
  if (executionFailure !== null) throw executionFailure;
  if (measurements === null) {
    throw new BaselineError('outcome-baseline.measurements-missing');
  }

  const report = renderReport(measurements, modelCalls, providerMeasurements);
  await mkdir(resolve(REPORT_PATH, '..'), { recursive: true });
  await writeFile(REPORT_PATH, report, 'utf8');
  await writeLocalDiagnostics(measurements);
  console.log(
    JSON.stringify({
      status: 'complete',
      operation: 'outcome-baseline-v1.measure',
      fixtureCount: measurements.length,
      outcomes: countsByOutcome(measurements),
      modelCalls,
      report: relative(REPOSITORY_ROOT, REPORT_PATH),
      localDiagnostics: relative(REPOSITORY_ROOT, LOCAL_DIAGNOSTICS_PATH),
    }),
  );
}

async function writeFixtures() {
  await mkdir(REQUEST_DIRECTORY, { recursive: true });
  const scans = await scanTargets();
  for (const definition of FIXTURE_DEFINITIONS) {
    const scan = scans.get(definition.target.targetId);
    if (scan === undefined) {
      throw new BaselineError('outcome-baseline.scanner-result-missing');
    }
    const request = createRequest(definition, scan);
    const parsed = parseOssRecommendationRequestV1(request);
    if (!parsed.ok) {
      throw new BaselineError('outcome-baseline.generated-fixture-invalid');
    }
    await writeFile(
      requestPath(definition.fixtureId),
      `${JSON.stringify(parsed.value, null, 2)}\n`,
      'utf8',
    );
  }
}

async function loadFixtures() {
  const scans = await scanTargets();
  const fixtures = [];
  for (const definition of FIXTURE_DEFINITIONS) {
    let value;
    try {
      value = JSON.parse(
        await readFile(requestPath(definition.fixtureId), 'utf8'),
      );
    } catch {
      throw new BaselineError('outcome-baseline.fixture-unreadable');
    }
    const parsed = parseOssRecommendationRequestV1(value);
    if (!parsed.ok) {
      throw new BaselineError('outcome-baseline.fixture-contract-invalid');
    }
    const scan = scans.get(definition.target.targetId);
    if (
      scan === undefined ||
      parsed.value.recommendationRequestId !== definition.fixtureId ||
      parsed.value.capabilityQuery.queryInputId !== definition.fixtureId ||
      !isDeepStrictEqual(
        parsed.value.repositoryFingerprint,
        scan.fingerprint,
      ) ||
      !isDeepStrictEqual(
        parsed.value.capabilityQuery.repositoryFingerprintReference,
        scan.reference,
      )
    ) {
      throw new BaselineError(
        'outcome-baseline.fixture-scanner-binding-invalid',
      );
    }
    fixtures.push(
      Object.freeze({
        fixtureId: definition.fixtureId,
        capabilityFamily: definition.family.family,
        request: parsed.value,
      }),
    );
  }
  return Object.freeze(fixtures);
}

async function scanTargets() {
  const scans = new Map();
  for (const target of TARGET_DEFINITIONS) {
    const targetRoot = join(BASELINE_DIRECTORY, target.directory);
    const scanned = await executeScanner([
      '--observed-at',
      SCANNER_OBSERVED_AT,
      targetRoot,
    ]);
    if (
      scanned.status !== 0 ||
      scanned.stderr !== '' ||
      scanned.stdout.includes(targetRoot)
    ) {
      throw new BaselineError('outcome-baseline.scanner-failed');
    }
    let rawFingerprint;
    try {
      rawFingerprint = JSON.parse(scanned.stdout);
    } catch {
      throw new BaselineError('outcome-baseline.scanner-output-invalid');
    }
    const parsed = parseRepositoryFingerprintV1(rawFingerprint);
    if (!parsed.ok) {
      throw new BaselineError('outcome-baseline.scanner-output-invalid');
    }
    const referenced = await executeScanner(['--reference'], scanned.stdout);
    if (referenced.status !== 0 || referenced.stderr !== '') {
      throw new BaselineError('outcome-baseline.scanner-reference-failed');
    }
    let reference;
    try {
      reference = JSON.parse(referenced.stdout);
    } catch {
      throw new BaselineError('outcome-baseline.scanner-reference-invalid');
    }
    if (
      !isRecord(reference) ||
      reference.fingerprintId !== parsed.value.fingerprintId ||
      reference.fingerprintDigest !==
        repositoryFingerprintDigestV1(parsed.value)
    ) {
      throw new BaselineError('outcome-baseline.scanner-reference-invalid');
    }
    scans.set(
      target.targetId,
      Object.freeze({
        fingerprint: parsed.value,
        reference: Object.freeze({
          fingerprintId: reference.fingerprintId,
          fingerprintDigest: reference.fingerprintDigest,
        }),
      }),
    );
  }
  return scans;
}

function createRequest(definition, scan) {
  const constraints = [
    ...definition.family.constraints,
    ...definition.target.constraints,
  ].map((constraint, index) => ({
    constraintId: `${definition.fixtureId}-c${String(index + 1)}`,
    modality: constraint.modality,
    statement: constraintStatement(constraint),
    originalTerm: constraint.originalTerm,
    facetHint: constraint.facetHint,
    reasonCode: constraint.reasonCode,
  }));
  return {
    contractVersion: CONTRACT_VERSION,
    recommendationRequestId: definition.fixtureId,
    capabilityQuery: {
      contractVersion: CONTRACT_VERSION,
      queryInputId: definition.fixtureId,
      scope: 'local-pre-approval',
      summary: definition.family.summary,
      capabilityTerms: [
        {
          termId: `${definition.fixtureId}-term`,
          originalTerm: definition.family.family,
        },
      ],
      successConditions: [
        {
          conditionId: `${definition.fixtureId}-success-1`,
          statement: definition.family.success,
        },
        {
          conditionId: `${definition.fixtureId}-success-2`,
          statement: definition.target.success,
        },
      ],
      draftConstraints: constraints,
      candidateReferences: [],
      repositoryFingerprintReference: scan.reference,
    },
    repositoryFingerprint: scan.fingerprint,
    transmissionApproval: {
      approvalId: `${definition.fixtureId}-approval`,
      approvedAt: APPROVED_AT,
      approvedBy: 'request-originator',
      scope: 'minimized-repository-facts',
      approvedCategories: [
        'bounded-evidence',
        'candidate-dossiers',
        'capability-request',
        'repository-fingerprint',
      ],
    },
  };
}

function constraintStatement(constraint) {
  if (constraint.modality === 'required') {
    return `The solution must provide ${constraint.originalTerm}.`;
  }
  if (constraint.modality === 'prohibited') {
    return `The solution must not require ${constraint.originalTerm}.`;
  }
  return `Prefer a solution compatible with ${constraint.originalTerm}.`;
}

function captureModelInput(input) {
  const artifactExcerptAvailability = new Map(
    input.fitAssessmentRequest.candidates.map((candidate) => [
      candidate.identity.candidateId,
      candidate.observations.some(
        (observation) => observation.topic === 'artifact-excerpt',
      ),
    ]),
  );
  return Object.freeze({
    catalogCounts: Object.freeze({
      limitations: input.fitAssessmentRequest.candidates.reduce(
        (total, candidate) => total + candidate.limitations.length,
        0,
      ),
      unknowns: input.fitAssessmentRequest.candidates.reduce(
        (total, candidate) => total + candidate.unknowns.length,
        0,
      ),
    }),
    finalists: Object.freeze(
      input.retrievalFinalists.map((finalist) =>
        Object.freeze({
          candidateId: finalist.candidateId,
          lane: finalist.lane,
          unresolvedHardEvaluationCount:
            finalist.unresolvedHardEvaluations.length,
          artifactExcerptAvailable:
            artifactExcerptAvailability.get(finalist.candidateId) ?? false,
        }),
      ),
    ),
  });
}

export function captureAssessmentDiagnostics(input) {
  const response = input.response;
  const fit = response?.targetFitAssessment?.fitAssessment;
  const assessments = array(fit?.candidateAssessments);
  const resolutions = array(response?.evidenceNeededHardConstraintResolutions);
  const declaredConflicts = array(fit?.hardConstraintConflicts);
  const candidateIds = new Set(
    array(input.request?.candidates)
      .map((candidate) => candidate?.identity?.candidateId)
      .filter((candidateId) => typeof candidateId === 'string'),
  );
  for (const record of [...assessments, ...resolutions, ...declaredConflicts]) {
    if (typeof record?.candidateId === 'string') {
      candidateIds.add(record.candidateId);
    }
  }

  const conflictCandidateIds = new Set(
    declaredConflicts
      .map((conflict) => conflict?.candidateId)
      .filter((candidateId) => typeof candidateId === 'string'),
  );
  const candidates = [...candidateIds].map((candidateId) => {
    const dispositions = assessments
      .filter((assessment) => assessment?.candidateId === candidateId)
      .map((assessment) => assessment?.disposition)
      .filter((disposition) => DISPOSITION_ORDER.includes(disposition));
    const candidateResolutions = resolutions.filter(
      (resolution) => resolution?.candidateId === candidateId,
    );
    const resolutionStates = countValues(
      candidateResolutions.map((resolution) => resolution?.state),
      RESOLUTION_STATE_ORDER,
    );
    return Object.freeze({
      candidateId,
      disposition: dispositions.length === 1 ? dispositions[0] : null,
      dispositions: Object.freeze(dispositions),
      resolutionStates: Object.freeze(resolutionStates),
      rejectedOnDeclaredConflict:
        dispositions.includes('rejected') &&
        conflictCandidateIds.has(candidateId),
    });
  });
  const validationIssues = input.validation.ok
    ? []
    : input.validation.issues.map(({ code, path }) =>
        Object.freeze({ code, path }),
      );
  const suppliedUnknownCount = array(input.request?.candidates).reduce(
    (total, candidate) => total + array(candidate?.unknowns).length,
    0,
  );
  const suppliedLimitationCount = array(input.request?.candidates).reduce(
    (total, candidate) => total + array(candidate?.limitations).length,
    0,
  );
  return Object.freeze({
    responseCaptured: input.responseCaptured ?? response !== null,
    diagnosticCaptureFailed: false,
    validationPassed: input.validation.ok,
    validationIssues: Object.freeze(validationIssues),
    domainIssueCounts: Object.freeze(
      issueCounts(
        validationIssues.filter(({ code }) => code.startsWith('domain.')),
      ),
    ),
    nonDomainIssueCounts: Object.freeze(
      issueCounts(
        validationIssues.filter(({ code }) => !code.startsWith('domain.')),
      ),
    ),
    dispositionCounts: Object.freeze(
      countValues(
        assessments.map((assessment) => assessment?.disposition),
        DISPOSITION_ORDER,
      ),
    ),
    resolutionStateCounts: Object.freeze(
      countValues(
        resolutions.map((resolution) => resolution?.state),
        RESOLUTION_STATE_ORDER,
      ),
    ),
    catalogCounts: Object.freeze({
      inferences: array(fit?.inferences).length,
      claims: array(fit?.materialClaims).length,
      unknowns: suppliedUnknownCount + array(fit?.assessmentUnknowns).length,
      limitations: suppliedLimitationCount,
      conflicts: declaredConflicts.length,
    }),
    candidates: Object.freeze(candidates),
    hasSatisfiedResolution: candidates.some(
      ({ resolutionStates }) => resolutionStates.satisfied > 0,
    ),
    hasRejectedDispositionOnDeclaredConflict: candidates.some(
      ({ rejectedOnDeclaredConflict }) => rejectedOnDeclaredConflict,
    ),
  });
}

function validateAndCaptureAssessmentDiagnostics(
  input,
  response,
  modelCapture,
) {
  try {
    const validation = validateRecommendationModelAssessmentExchangeV1({
      request: input.fitAssessmentRequest,
      normalization: input.normalization,
      retrievalFinalists: input.retrievalFinalists,
      response,
      assessmentId: mintRequestBoundAssessmentId(input.fitAssessmentRequest),
      producedAt: input.fitAssessmentRequest.evidenceCutoff,
    });
    const parsedResponse =
      parseRecommendationAssessmentModelResponseV1(response);
    return captureAssessmentDiagnostics({
      request: input.fitAssessmentRequest,
      response: parsedResponse.ok ? parsedResponse.value : null,
      responseCaptured: true,
      validation,
    });
  } catch {
    // Evaluation diagnostics must never change the application's model result.
    return unavailableAssessmentDiagnostics(modelCapture, true, true);
  }
}

function unavailableAssessmentDiagnostics(
  modelCapture,
  responseCaptured = false,
  diagnosticCaptureFailed = false,
) {
  const finalists = modelCapture?.finalists ?? [];
  return Object.freeze({
    responseCaptured,
    diagnosticCaptureFailed,
    validationPassed: false,
    validationIssues: Object.freeze([]),
    domainIssueCounts: Object.freeze({}),
    nonDomainIssueCounts: Object.freeze({}),
    dispositionCounts: Object.freeze(countValues([], DISPOSITION_ORDER)),
    resolutionStateCounts: Object.freeze(
      countValues([], RESOLUTION_STATE_ORDER),
    ),
    catalogCounts: Object.freeze({
      inferences: 0,
      claims: 0,
      unknowns: modelCapture?.catalogCounts.unknowns ?? 0,
      limitations: modelCapture?.catalogCounts.limitations ?? 0,
      conflicts: 0,
    }),
    candidates: Object.freeze(
      finalists.map(({ candidateId }) =>
        Object.freeze({
          candidateId,
          disposition: null,
          dispositions: Object.freeze([]),
          resolutionStates: Object.freeze(
            countValues([], RESOLUTION_STATE_ORDER),
          ),
          rejectedOnDeclaredConflict: false,
        }),
      ),
    ),
    hasSatisfiedResolution: false,
    hasRejectedDispositionOnDeclaredConflict: false,
  });
}

function issueCounts(issues) {
  const counts = new Map();
  for (const { code } of issues) {
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) => compareText(left, right)),
  );
}

function countValues(values, order) {
  const counts = Object.fromEntries(order.map((value) => [value, 0]));
  for (const value of values) {
    if (Object.hasOwn(counts, value)) counts[value] += 1;
  }
  return counts;
}

function mintRequestBoundAssessmentId(request) {
  const digest = createHash('sha256')
    .update('gitblocks-fit-assessment-v1\0', 'utf8')
    .update(request.assessmentRequestId, 'utf8')
    .update('\0', 'utf8')
    .update(request.correlationId, 'utf8')
    .update('\0', 'utf8')
    .update(request.evidenceCutoff, 'utf8')
    .digest('hex');
  return `assessment-${digest.slice(0, 53)}`;
}

async function captureProviderMeasurement(requestId, response, destination) {
  try {
    const decoded = await response.json();
    if (!isRecord(decoded)) return;
    const usage = decoded.usage;
    destination.set(
      requestId,
      Object.freeze({
        providerCompleted: decoded.status === 'completed',
        outputTokens:
          isRecord(usage) &&
          Number.isInteger(usage.output_tokens) &&
          usage.output_tokens >= 0
            ? usage.output_tokens
            : null,
      }),
    );
  } catch {
    // Metrics are best-effort and must not alter the measured operation.
  }
}

function measureOperation(input) {
  const modelCompleted = input.events.some(
    ({ stage }) => stage === 'model-completed',
  );
  const model = Object.freeze({
    completed: modelCompleted && input.modelMeasurement?.completed === true,
    latencyMs: input.modelMeasurement?.latencyMs ?? null,
  });
  const diagnostics =
    input.diagnostics ?? unavailableAssessmentDiagnostics(input.modelCapture);
  if (!input.operation.ok) {
    return Object.freeze({
      fixtureId: input.fixture.fixtureId,
      capabilityFamily: input.fixture.capabilityFamily,
      outcome: 'failed',
      stage: failureStage(input.operation.failure, input.events),
      reason: failureReason(input.operation.failure),
      insufficientEvidence: null,
      recommendation: null,
      model,
      diagnostics,
      deterministicallyValidResponse: false,
    });
  }
  const result = input.operation.result;
  const stage = successfulOutcomeStage(result);
  return Object.freeze({
    fixtureId: input.fixture.fixtureId,
    capabilityFamily: input.fixture.capabilityFamily,
    outcome: result.outcome,
    stage,
    reason: 'reasonCode' in result ? result.reasonCode : null,
    insufficientEvidence:
      result.outcome === 'insufficient-evidence'
        ? insufficientEvidenceMeasurement(result, input.modelCapture)
        : null,
    recommendation:
      result.outcome === 'recommend'
        ? recommendationMeasurement(result, input.modelCapture)
        : null,
    model,
    diagnostics,
    deterministicallyValidResponse: model.completed,
  });
}

function successfulOutcomeStage(result) {
  if (
    result.outcome === 'clarification-required' ||
    result.outcome === 'unsupported'
  ) {
    return 'normalization';
  }
  if (
    result.outcome === 'no-viable-candidate' &&
    result.targetFitAssessment === null
  ) {
    return 'finalist selection';
  }
  if (
    result.outcome === 'insufficient-evidence' &&
    result.reasonCode === 'no-positive-candidate-evidence'
  ) {
    return projectedFinalists(result.shortlist).some(
      (finalist) => finalist.lane === 'evidence-needed',
    )
      ? 'artifact evidence selection'
      : 'finalist evidence loading';
  }
  return result.outcome === 'recommend'
    ? null
    : 'deterministic assessment validation';
}

function failureStage(failure, events) {
  if (failure.kind === 'retrieval') return 'retrieval';
  if (failure.kind === 'contract') return 'normalization';
  switch (failure.code) {
    case 'retrieval-request-construction-failed':
      return 'retrieval';
    case 'finalist-evidence-load-failed':
      return 'finalist evidence loading';
    case 'fit-assessment-request-construction-failed':
    case 'fit-model-failed':
      return 'model invocation';
    case 'invalid-target-fit-response':
      return 'deterministic assessment validation';
    case 'hosted-recommendation-not-ready':
      return events.some((event) => event.stage === 'retrieved')
        ? 'finalist selection'
        : 'retrieval';
  }
  throw new BaselineError('outcome-baseline.failure-stage-unknown');
}

function failureReason(failure) {
  if (failure.kind === 'application') return failure.code;
  return `${failure.kind}-failure`;
}

function insufficientEvidenceMeasurement(result, modelCapture) {
  if (modelCapture === null) {
    const finalists = projectedFinalists(result.shortlist);
    return Object.freeze({
      unresolvedHardEvaluationsPerFinalist: Object.freeze(
        finalists.map((finalist) => finalist.unresolvedHardEvaluations.length),
      ),
      artifactExcerptAvailablePerFinalist: Object.freeze(
        finalists.map(() => false),
      ),
    });
  }
  const unresolvedByCandidateId = new Map();
  for (const resolution of result.evidenceNeededHardConstraintResolutions ??
    []) {
    if (resolution.state !== 'unresolved') continue;
    unresolvedByCandidateId.set(
      resolution.candidateId,
      (unresolvedByCandidateId.get(resolution.candidateId) ?? 0) + 1,
    );
  }
  return Object.freeze({
    unresolvedHardEvaluationsPerFinalist: Object.freeze(
      modelCapture.finalists.map((finalist) =>
        finalist.lane === 'eligible'
          ? 0
          : (unresolvedByCandidateId.get(finalist.candidateId) ?? 0),
      ),
    ),
    artifactExcerptAvailablePerFinalist: Object.freeze(
      modelCapture.finalists.map(
        (finalist) => finalist.artifactExcerptAvailable,
      ),
    ),
  });
}

function recommendationMeasurement(result, modelCapture) {
  if (modelCapture === null) {
    throw new BaselineError('outcome-baseline.recommendation-capture-missing');
  }
  const laneByCandidateId = new Map(
    modelCapture.finalists.map((finalist) => [
      finalist.candidateId,
      finalist.lane,
    ]),
  );
  const assessmentByCandidateId = new Map(
    result.targetFitAssessment.fitAssessment.candidateAssessments.map(
      (assessment) => [assessment.candidateId, assessment],
    ),
  );
  const options = result.responsibleOptions.map((option) => {
    const lane = laneByCandidateId.get(option.candidateId);
    const assessment = assessmentByCandidateId.get(option.candidateId);
    if (
      (lane !== 'eligible' && lane !== 'evidence-needed') ||
      assessment === undefined
    ) {
      throw new BaselineError('outcome-baseline.option-lane-missing');
    }
    return Object.freeze({
      candidateId: option.candidateId,
      lane,
      evidenceReferences: Object.freeze([...assessment.evidenceIds]),
      materialUnknowns: Object.freeze([...assessment.unknownIds]),
      disposition: assessment.disposition,
    });
  });
  return Object.freeze({
    optionCount: result.responsibleOptions.length,
    eligibleLaneOptions: options.filter(({ lane }) => lane === 'eligible')
      .length,
    evidenceNeededLaneOptions: options.filter(
      ({ lane }) => lane === 'evidence-needed',
    ).length,
    options: Object.freeze(options),
  });
}

function projectedFinalists(shortlist) {
  const eligible = shortlist.eligibleCandidates.slice(
    0,
    HOSTED_FIT_FINALIST_LIMIT,
  );
  return [
    ...eligible,
    ...shortlist.evidenceNeededCandidates.slice(
      0,
      HOSTED_FIT_FINALIST_LIMIT - eligible.length,
    ),
  ];
}

function renderReport(measurements, modelCalls, providerMeasurements) {
  const aggregate = countsByOutcome(measurements);
  const lines = [
    '# Outcome baseline v1',
    '',
    'Reproduce from the repository root with `pnpm outcome:baseline:v1`.',
    '',
    'This report contains no request prose, candidate display names, or model output text.',
    '',
    '## Aggregate outcome counts',
    '',
    ...markdownTable(
      ['Outcome', 'Count'],
      OUTCOME_ORDER.map((outcome) => [
        outcome,
        String(aggregate[outcome] ?? 0),
      ]),
      ['left', 'right'],
    ),
    '',
    '## Outcome counts by capability family',
    '',
    ...markdownTable(
      ['Capability family', ...OUTCOME_ORDER],
      FAMILY_DEFINITIONS.map(({ family }) => {
        const counts = countsByOutcome(
          measurements.filter(
            (measurement) => measurement.capabilityFamily === family,
          ),
        );
        return [
          family,
          ...OUTCOME_ORDER.map((outcome) => String(counts[outcome] ?? 0)),
        ];
      }),
      ['left', ...OUTCOME_ORDER.map(() => 'right')],
    ),
    '',
    '## Non-recommend outcomes',
    '',
    ...markdownTable(
      ['Fixture', 'Outcome', 'Producing stage', 'Reason'],
      measurements
        .filter((measurement) => measurement.outcome !== 'recommend')
        .map((measurement) => [
          measurement.fixtureId,
          measurement.outcome,
          measurement.stage,
          measurement.reason ?? '—',
        ]),
      ['left', 'left', 'left', 'left'],
    ),
    '',
    '## Insufficient-evidence detail',
    '',
  ];
  const insufficient = measurements.filter(
    (measurement) => measurement.insufficientEvidence !== null,
  );
  if (insufficient.length === 0) {
    lines.push('No insufficient-evidence outcomes.', '');
  } else {
    lines.push(
      ...markdownTable(
        [
          'Fixture',
          'Unresolved hard evaluations per finalist',
          'Artifact excerpt available per finalist',
        ],
        insufficient.map((measurement) => {
          const detail = measurement.insufficientEvidence;
          return [
            measurement.fixtureId,
            bracketed(detail.unresolvedHardEvaluationsPerFinalist),
            bracketed(
              detail.artifactExcerptAvailablePerFinalist.map((available) =>
                available ? 'yes' : 'no',
              ),
            ),
          ];
        }),
        ['left', 'left', 'left'],
      ),
      '',
    );
  }
  lines.push('## Recommend detail', '');
  const recommendations = measurements.filter(
    (measurement) => measurement.recommendation !== null,
  );
  if (recommendations.length === 0) {
    lines.push('No recommend outcomes.', '');
  } else {
    lines.push(
      ...markdownTable(
        [
          'Fixture',
          'Options returned',
          'Eligible-lane options',
          'Evidence-needed-lane options',
        ],
        recommendations.map((measurement) => {
          const detail = measurement.recommendation;
          return [
            measurement.fixtureId,
            String(detail.optionCount),
            String(detail.eligibleLaneOptions),
            String(detail.evidenceNeededLaneOptions),
          ];
        }),
        ['left', 'right', 'right', 'right'],
      ),
      '',
    );
    lines.push(
      '### Recommended option detail',
      '',
      ...markdownTable(
        [
          'Fixture',
          'Candidate ID',
          'Lane',
          'Evidence references',
          'Material unknowns',
          'Disposition',
        ],
        recommendations.flatMap((measurement) =>
          measurement.recommendation.options.map((option) => [
            measurement.fixtureId,
            option.candidateId,
            option.lane,
            bracketed(option.evidenceReferences),
            bracketed(option.materialUnknowns),
            option.disposition,
          ]),
        ),
        ['left', 'left', 'left', 'left', 'left', 'left'],
      ),
      '',
    );
  }
  const completed = measurements.filter(({ model }) => model.completed);
  const deterministicallyValid = measurements.filter(
    ({ deterministicallyValidResponse }) => deterministicallyValidResponse,
  );
  const latencies = completed
    .map(({ model }) => model.latencyMs)
    .filter((value) => typeof value === 'number');
  const outputTokens = completed
    .map(({ fixtureId }) => providerMeasurements.get(fixtureId)?.outputTokens)
    .filter((value) => Number.isInteger(value));
  lines.push(
    '## Model calls',
    '',
    `Total model calls made: ${String(modelCalls)}.`,
    '',
    `Completed model calls: ${String(completed.length)}.`,
    '',
    `Deterministically valid responses: ${String(deterministicallyValid.length)}.`,
    '',
    `Median completed-call latency: ${formatMetric(median(latencies), ' ms')}.`,
    '',
    `Maximum completed-call latency: ${formatMetric(maximum(latencies), ' ms')}.`,
    '',
    `Median output tokens: ${formatMetric(median(outputTokens), '')}.`,
    '',
    ...renderAssessmentDiagnosticLines(measurements),
    '',
    '## Failure categories',
    '',
  );
  const failures = failureCategoryRows(measurements);
  if (failures.length === 0) {
    lines.push('No failed calls.', '');
  } else {
    lines.push(
      ...markdownTable(['Category', 'Calls', 'Occurrences'], failures, [
        'left',
        'right',
        'right',
      ]),
      '',
    );
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

export function renderAssessmentDiagnosticLines(measurements) {
  const captured = measurements.filter(
    ({ diagnostics }) => diagnostics.responseCaptured,
  );
  const validationPassed = measurements.filter(
    ({ diagnostics }) => diagnostics.validationPassed,
  );
  const captureFailures = measurements.filter(
    ({ diagnostics }) => diagnostics.diagnosticCaptureFailed,
  );
  const domainCategories = diagnosticIssueCategoryRows(
    measurements,
    'domainIssueCounts',
  );
  const nonDomainCategories = diagnosticIssueCategoryRows(
    measurements,
    'nonDomainIssueCounts',
  );
  const dispositionTotals = totalDiagnosticCounts(
    measurements,
    'dispositionCounts',
    DISPOSITION_ORDER,
  );
  const resolutionTotals = totalDiagnosticCounts(
    measurements,
    'resolutionStateCounts',
    RESOLUTION_STATE_ORDER,
  );
  const catalogTotals = totalDiagnosticCounts(
    measurements,
    'catalogCounts',
    CATALOG_ORDER,
  );
  const candidatesWithSatisfiedResolution = measurements.reduce(
    (total, { diagnostics }) =>
      total +
      diagnostics.candidates.filter(
        ({ resolutionStates }) => resolutionStates.satisfied > 0,
      ).length,
    0,
  );
  const candidatesRejectedOnDeclaredConflict = measurements.reduce(
    (total, { diagnostics }) =>
      total +
      diagnostics.candidates.filter(
        ({ rejectedOnDeclaredConflict }) => rejectedOnDeclaredConflict,
      ).length,
    0,
  );
  const lines = [
    '## Assessment diagnostics',
    '',
    `Model responses captured for diagnostics: ${String(captured.length)} of ${String(measurements.length)} fixtures.`,
    '',
    `Harness canonical validations passed: ${String(validationPassed.length)}.`,
    '',
    `Diagnostic capture failures: ${String(captureFailures.length)}.`,
    '',
    'Unknown totals include supplied candidate unknowns plus model-declared assessment unknowns; limitation totals are the supplied candidate limitation catalog hydrated by validation.',
    '',
    '### Domain issue categories',
    '',
  ];
  if (domainCategories.length === 0) {
    lines.push('No domain validation issues.', '');
  } else {
    lines.push(
      ...markdownTable(['Category', 'Calls', 'Occurrences'], domainCategories, [
        'left',
        'right',
        'right',
      ]),
      '',
    );
  }
  if (nonDomainCategories.length > 0) {
    lines.push(
      '### Non-domain validation issue categories',
      '',
      ...markdownTable(
        ['Category', 'Calls', 'Occurrences'],
        nonDomainCategories,
        ['left', 'right', 'right'],
      ),
      '',
    );
  }
  lines.push(
    '### Disposition totals',
    '',
    ...markdownTable(
      ['Disposition', 'Count'],
      DISPOSITION_ORDER.map((disposition) => [
        disposition,
        String(dispositionTotals[disposition]),
      ]),
      ['left', 'right'],
    ),
    '',
    '### Hard-resolution state totals',
    '',
    ...markdownTable(
      ['State', 'Count'],
      RESOLUTION_STATE_ORDER.map((state) => [
        state,
        String(resolutionTotals[state]),
      ]),
      ['left', 'right'],
    ),
    '',
    '### Declared catalog totals',
    '',
    ...markdownTable(
      ['Catalog', 'Count'],
      CATALOG_ORDER.map((catalog) => [catalog, String(catalogTotals[catalog])]),
      ['left', 'right'],
    ),
    '',
    `Fixtures with any satisfied hard resolution: ${String(
      measurements.filter(
        ({ diagnostics }) => diagnostics.hasSatisfiedResolution,
      ).length,
    )}.`,
    '',
    `Candidates with any satisfied hard resolution: ${String(
      candidatesWithSatisfiedResolution,
    )}.`,
    '',
    `Fixtures with a rejected disposition on a declared conflict: ${String(
      measurements.filter(
        ({ diagnostics }) =>
          diagnostics.hasRejectedDispositionOnDeclaredConflict,
      ).length,
    )}.`,
    '',
    `Candidates with a rejected disposition on a declared conflict: ${String(
      candidatesRejectedOnDeclaredConflict,
    )}.`,
    '',
    '### Per-fixture diagnostic totals',
    '',
    ...markdownTable(
      [
        'Fixture',
        'Response',
        'Validation',
        'Domain issues',
        'Dispositions',
        'Resolutions',
        'Catalogs',
        'Any satisfied',
        'Rejected conflict',
      ],
      measurements.map(({ fixtureId, diagnostics }) => [
        fixtureId,
        diagnostics.responseCaptured ? 'captured' : 'not-produced',
        diagnostics.responseCaptured
          ? diagnostics.diagnosticCaptureFailed
            ? 'capture-failed'
            : diagnostics.validationPassed
              ? 'passed'
              : 'failed'
          : 'not-run',
        String(sumCounts(diagnostics.domainIssueCounts)),
        compactCounts(diagnostics.dispositionCounts, DISPOSITION_ORDER),
        compactCounts(
          diagnostics.resolutionStateCounts,
          RESOLUTION_STATE_ORDER,
        ),
        compactCounts(diagnostics.catalogCounts, CATALOG_ORDER),
        diagnostics.hasSatisfiedResolution ? 'yes' : 'no',
        diagnostics.hasRejectedDispositionOnDeclaredConflict ? 'yes' : 'no',
      ]),
      ['left', 'left', 'left', 'right', 'left', 'left', 'left', 'left', 'left'],
    ),
  );
  return lines;
}

function diagnosticIssueCategoryRows(measurements, field) {
  const categories = new Map();
  for (const { fixtureId, diagnostics } of measurements) {
    for (const [category, occurrences] of Object.entries(diagnostics[field])) {
      const existing = categories.get(category) ?? {
        calls: new Set(),
        occurrences: 0,
      };
      existing.calls.add(fixtureId);
      existing.occurrences += occurrences;
      categories.set(category, existing);
    }
  }
  return [...categories.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([category, detail]) => [
      category,
      String(detail.calls.size),
      String(detail.occurrences),
    ]);
}

function totalDiagnosticCounts(measurements, field, order) {
  const totals = countValues([], order);
  for (const { diagnostics } of measurements) {
    for (const value of order) {
      totals[value] += diagnostics[field][value];
    }
  }
  return totals;
}

function compactCounts(counts, order) {
  return order.map((key) => `${key}=${String(counts[key])}`).join(', ');
}

function sumCounts(counts) {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}

function failureCategoryRows(measurements) {
  const categories = new Map();
  for (const measurement of measurements) {
    if (measurement.outcome !== 'failed') continue;
    const category = measurement.reason ?? 'unknown-failure';
    const existing = categories.get(category) ?? {
      calls: new Set(),
      occurrences: 0,
    };
    existing.calls.add(measurement.fixtureId);
    existing.occurrences += 1;
    categories.set(category, existing);
  }
  return [...categories.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([category, detail]) => [
      category,
      String(detail.calls.size),
      String(detail.occurrences),
    ]);
}

async function writeLocalDiagnostics(measurements) {
  await mkdir(resolve(LOCAL_DIAGNOSTICS_PATH, '..'), {
    recursive: true,
    mode: 0o700,
  });
  const detail = {
    formatVersion: '1.0.0',
    fixtures: measurements.map(
      ({ fixtureId, capabilityFamily, outcome, reason, diagnostics }) => ({
        fixtureId,
        capabilityFamily,
        outcome,
        reason,
        diagnostics,
      }),
    ),
  };
  await writeFile(
    LOCAL_DIAGNOSTICS_PATH,
    `${JSON.stringify(detail, null, 2)}\n`,
    {
      encoding: 'utf8',
      mode: 0o600,
    },
  );
}

function median(values) {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

function maximum(values) {
  return values.length === 0 ? null : Math.max(...values);
}

function formatMetric(value, suffix) {
  return value === null ? 'not recorded' : `${value.toFixed(1)}${suffix}`;
}

function countsByOutcome(measurements) {
  const counts = Object.fromEntries(
    OUTCOME_ORDER.map((outcome) => [outcome, 0]),
  );
  for (const measurement of measurements) {
    counts[measurement.outcome] = (counts[measurement.outcome] ?? 0) + 1;
  }
  return counts;
}

function bracketed(values) {
  return `[${values.map((value) => String(value)).join(', ')}]`;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function markdownTable(headers, rows, alignments) {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index]?.length ?? 0)),
  );
  const formatRow = (row) =>
    `| ${row
      .map((cell, index) =>
        alignments[index] === 'right'
          ? cell.padStart(widths[index])
          : cell.padEnd(widths[index]),
      )
      .join(' | ')} |`;
  const separator = widths.map((width, index) =>
    alignments[index] === 'right'
      ? `${'-'.repeat(Math.max(2, width - 1))}:`
      : '-'.repeat(Math.max(3, width)),
  );
  return [formatRow(headers), formatRow(separator), ...rows.map(formatRow)];
}

function readDatabaseConfiguration(environment) {
  const database = requiredEnvironment(
    environment,
    DATABASE_ENVIRONMENT_NAMES.database,
  );
  if (!database.endsWith('_test')) {
    throw new BaselineError('outcome-baseline.database-not-ephemeral');
  }
  const port = Number(
    requiredEnvironment(environment, DATABASE_ENVIRONMENT_NAMES.port),
  );
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new BaselineError('outcome-baseline.database-port-invalid');
  }
  if (
    requiredEnvironment(environment, DATABASE_ENVIRONMENT_NAMES.ssl) !== 'false'
  ) {
    throw new BaselineError('outcome-baseline.database-ssl-invalid');
  }
  return Object.freeze({
    host: requiredEnvironment(environment, DATABASE_ENVIRONMENT_NAMES.host),
    port,
    database,
    username: requiredEnvironment(
      environment,
      DATABASE_ENVIRONMENT_NAMES.username,
    ),
    password: requiredEnvironment(
      environment,
      DATABASE_ENVIRONMENT_NAMES.password,
    ),
    ssl: false,
  });
}

function requiredEnvironment(environment, name) {
  const value = environment[name];
  if (value === undefined || value.length === 0) {
    throw new BaselineError('outcome-baseline.environment-missing');
  }
  return value;
}

function requestPath(fixtureId) {
  return join(REQUEST_DIRECTORY, `${fixtureId}.json`);
}

function executeScanner(arguments_, stdin = '') {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [SCANNER_PATH, ...arguments_], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', rejectPromise);
    child.on('close', (status) => {
      resolvePromise({
        status,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
    child.stdin.end(stdin);
  });
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await main();
  } catch (error) {
    console.error(
      error instanceof BaselineError
        ? error.code
        : 'outcome-baseline.internal-error',
    );
    process.exitCode = 1;
  }
}
