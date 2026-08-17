/* global Buffer, console, process */

import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import {
  createOpenAiFitAssessmentModel,
  HOSTED_FIT_FINALIST_LIMIT,
  HOSTED_FIT_MODEL,
  startHostedRecommendationComposition,
} from '../../apps/gitblocks-hosted/dist/src/index.js';
import {
  parseOssRecommendationRequestV1,
  parseRepositoryFingerprintV1,
  repositoryFingerprintDigestV1,
} from '../../packages/contracts/dist/src/index.js';

const BASELINE_DIRECTORY = import.meta.dirname;
const REPOSITORY_ROOT = resolve(BASELINE_DIRECTORY, '../..');
const REQUEST_DIRECTORY = join(BASELINE_DIRECTORY, 'requests');
const REPORT_PATH = join(
  REPOSITORY_ROOT,
  'verification/outcome-baseline-v1/report.md',
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
  let modelCalls = 0;
  let delegateModel = null;
  let modelEnvironmentMissing = false;
  const fitModel = Object.freeze({
    assess: async (input) => {
      modelCalls += 1;
      modelCaptures.set(
        input.fitAssessmentRequest.assessmentRequestId,
        captureModelInput(input),
      );
      const apiKey = process.env.OPENAI_API_KEY;
      if (apiKey === undefined || apiKey.length === 0) {
        modelEnvironmentMissing = true;
        throw new BaselineError('outcome-baseline.environment-missing');
      }
      delegateModel ??= createOpenAiFitAssessmentModel({
        configuration: Object.freeze({ apiKey, model: HOSTED_FIT_MODEL }),
      });
      return delegateModel.assess(input);
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
          events: eventsByRequestId.get(fixture.fixtureId) ?? [],
        }),
      );
    }
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

  const report = renderReport(measurements, modelCalls);
  await mkdir(resolve(REPORT_PATH, '..'), { recursive: true });
  await writeFile(REPORT_PATH, report, 'utf8');
  console.log(
    JSON.stringify({
      status: 'complete',
      operation: 'outcome-baseline-v1.measure',
      fixtureCount: measurements.length,
      outcomes: countsByOutcome(measurements),
      modelCalls,
      report: relative(REPOSITORY_ROOT, REPORT_PATH),
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

function measureOperation(input) {
  if (!input.operation.ok) {
    return Object.freeze({
      fixtureId: input.fixture.fixtureId,
      capabilityFamily: input.fixture.capabilityFamily,
      outcome: 'failed',
      stage: failureStage(input.operation.failure, input.events),
      reason: failureReason(input.operation.failure),
      insufficientEvidence: null,
      recommendation: null,
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
  let eligibleLaneOptions = 0;
  let evidenceNeededLaneOptions = 0;
  for (const option of result.responsibleOptions) {
    const lane = laneByCandidateId.get(option.candidateId);
    if (lane === 'eligible') eligibleLaneOptions += 1;
    else if (lane === 'evidence-needed') evidenceNeededLaneOptions += 1;
    else throw new BaselineError('outcome-baseline.option-lane-missing');
  }
  return Object.freeze({
    optionCount: result.responsibleOptions.length,
    eligibleLaneOptions,
    evidenceNeededLaneOptions,
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

function renderReport(measurements, modelCalls) {
  const aggregate = countsByOutcome(measurements);
  const lines = [
    '# Outcome baseline v1',
    '',
    'Reproduce from the repository root with `pnpm outcome:baseline:v1`.',
    '',
    'This report contains no request prose, candidate names, or model output text.',
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
  }
  lines.push(
    '## Model calls',
    '',
    `Total model calls made: ${String(modelCalls)}.`,
  );
  return `${lines.join('\n')}\n`;
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
