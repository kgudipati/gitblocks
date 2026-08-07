import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import { parseDocument } from 'yaml';

import { validateWorkflowFile } from '../src/workflow-policy.ts';

const CHECKOUT_SHA = '3d3c42e5aac5ba805825da76410c181273ba90b1';
const SETUP_NODE_SHA = '820762786026740c76f36085b0efc47a31fe5020';
const POSTGRES_IMAGE =
  'postgres:18.4-bookworm@sha256:1961f96e6029a02c3812d7cb329a3b03a3ac2bb067058dec17b0f5596aca9296';
const TRACKED_CI_URL = new URL(
  '../../../.github/workflows/ci.yml',
  import.meta.url,
);
const WORKER_JOB_IDS = [
  'typecheck',
  'verification-static',
  'verification-tests-core',
  'verification-tests-interviews',
  'verification-tests-tools',
  'database-and-audit',
] as const;
const AGGREGATE_DEPENDENCIES = [
  'verification-static',
  'verification-tests-core',
  'verification-tests-interviews',
  'verification-tests-tools',
] as const;
const STATIC_VERIFICATION_COMMANDS = [
  'pnpm runtime:check',
  'pnpm format:check',
  'pnpm build:product',
  'pnpm lint:internal',
  'pnpm build:tools',
  'pnpm typecheck:internal',
  'pnpm architecture:check',
  'node tools/repository-checks/src/cli.ts repository',
  'node tools/evaluation-harness/src/cli.ts validate',
  'node tools/evaluation-harness/src/cli.ts fixtures',
  'node tools/evaluation-harness/src/retrieval/cli.ts validate',
  'node tools/evaluation-harness/src/retrieval/cli.ts fixtures',
  'node tools/evaluation-harness/src/retrieval/cli.ts verify',
  'node tools/evaluation-harness/src/repository-interview-evaluation-cli.ts validate',
  'node tools/evaluation-harness/src/repository-interview-evaluation-cli.ts fixtures',
  'node tools/evaluation-harness/src/contract-conformance-cli.ts',
  'node packages/contracts/scripts/taxonomy-cli.ts',
  'node packages/ingestion/scripts/candidate-profile-cli.ts',
  'node packages/ingestion/scripts/catalog-cli.ts',
  'node packages/interviews/scripts/specification-cli.ts validate',
  'node apps/repository-interview-operator/scripts/schema-cli.ts validate',
  'node tools/repository-interview-prelive/src/prelive-cli.ts validate',
  'pnpm security:secrets',
  'git diff --exit-code',
] as const;
const TEST_SHARDS = {
  'verification-tests-core': {
    name: 'Verification — Core Product Tests',
    roots: [
      'packages/contracts/test',
      'packages/domain/test',
      'packages/persistence/test',
      'packages/ingestion/test',
    ],
  },
  'verification-tests-interviews': {
    name: 'Verification — Interview and Operator Tests',
    roots: [
      'packages/interviews/test',
      'apps/repository-interview-operator/test',
    ],
  },
  'verification-tests-tools': {
    name: 'Verification — Tooling Tests',
    roots: [
      'tools/evaluation-harness/test',
      'tools/repository-interview-prelive/test',
      'tools/repository-checks/test',
    ],
  },
} as const;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown, label: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be a mapping`);
  }

  return value as UnknownRecord;
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array`);
  }

  return value;
}

function trackedCi(): UnknownRecord {
  const document = parseDocument(readFileSync(TRACKED_CI_URL, 'utf8'), {
    schema: 'core',
    uniqueKeys: true,
    version: '1.2',
  });

  if (document.errors.length > 0 || document.warnings.length > 0) {
    throw new Error('tracked CI workflow must parse without YAML diagnostics');
  }

  return asRecord(document.toJS({ maxAliasCount: 0 }), 'workflow');
}

function trackedJobs(): UnknownRecord {
  return asRecord(trackedCi()['jobs'], 'jobs');
}

function trackedJob(jobs: UnknownRecord, jobId: string): UnknownRecord {
  return asRecord(jobs[jobId], `job ${jobId}`);
}

function jobSteps(job: UnknownRecord): UnknownRecord[] {
  return asArray(job['steps'], 'job steps').map((step, index) =>
    asRecord(step, `step ${String(index)}`),
  );
}

function jobCommands(job: UnknownRecord): string[] {
  return jobSteps(job).flatMap((step) =>
    typeof step['run'] === 'string' ? [step['run']] : [],
  );
}

function jobActionSteps(job: UnknownRecord): UnknownRecord[] {
  return jobSteps(job).filter((step) => typeof step['uses'] === 'string');
}

function normalizedCommand(command: string): string {
  return command.replace(/\s+/gu, ' ').trim();
}

function shardRoots(command: string): string[] {
  const tokens = normalizedCommand(command).split(' ');
  const vitestIndex = tokens.indexOf('vitest');
  const configIndex = tokens.indexOf('--config');
  if (
    vitestIndex < 0 ||
    tokens[vitestIndex + 1] !== 'run' ||
    configIndex <= vitestIndex + 2 ||
    tokens[configIndex + 1] !== 'vitest.config.ts'
  ) {
    throw new Error(
      'test shard must use vitest run with tracked configuration',
    );
  }

  return tokens.slice(vitestIndex + 2, configIndex);
}

function workflow(body: string): string {
  return `name: CI
on:
  pull_request:
  push:
    branches:
      - main
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
${body}
`;
}

function diagnosticCodes(content: string): string[] {
  return validateWorkflowFile({
    content,
    path: '.github/workflows/test.yml',
  }).map((diagnostic) => diagnostic.code);
}

describe('validateWorkflowFile', () => {
  it('accepts pinned external actions and local actions', () => {
    const content =
      workflow(`      - uses: actions/checkout@${CHECKOUT_SHA} # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/setup-node@${SETUP_NODE_SHA} # v7.0.0
        with:
          package-manager-cache: false
      - uses: ./.github/actions/verify
`);

    expect(validateWorkflowFile({ content, path: 'ci.yml' })).toEqual([]);
  });

  it.each([
    [
      'unpinned action',
      workflow(`      - uses: actions/checkout@v7 # v7.0.1
        with:
          persist-credentials: false
`),
      'workflow.action-pin',
    ],
    [
      'short action SHA',
      workflow(`      - uses: actions/checkout@3d3c42e # v7.0.1
        with:
          persist-credentials: false
`),
      'workflow.action-pin',
    ],
    [
      'missing version comment',
      workflow(`      - uses: actions/checkout@${CHECKOUT_SHA}
        with:
          persist-credentials: false
`),
      'workflow.action-comment',
    ],
    [
      'non-version comment',
      workflow(`      - uses: actions/checkout@${CHECKOUT_SHA} # immutable
        with:
          persist-credentials: false
`),
      'workflow.action-comment',
    ],
    [
      'checkout default credential persistence',
      workflow(`      - uses: actions/checkout@${CHECKOUT_SHA} # v7.0.1
`),
      'workflow.checkout-credentials',
    ],
    [
      'checkout credential persistence enabled',
      workflow(`      - uses: actions/checkout@${CHECKOUT_SHA} # v7.0.1
        with:
          persist-credentials: true
`),
      'workflow.checkout-credentials',
    ],
    [
      'setup-node automatic package-manager caching',
      workflow(`      - uses: actions/setup-node@${SETUP_NODE_SHA} # v7.0.0
`),
      'workflow.dependency-cache',
    ],
    [
      'setup-node explicit dependency caching',
      workflow(`      - uses: actions/setup-node@${SETUP_NODE_SHA} # v7.0.0
        with:
          package-manager-cache: false
          cache: pnpm
`),
      'workflow.dependency-cache',
    ],
    [
      'actions/cache',
      workflow(
        `      - uses: actions/cache@1111111111111111111111111111111111111111 # v5.0.3
`,
      ),
      'workflow.dependency-cache',
    ],
  ])('rejects %s', (_name, content, code) => {
    expect(diagnosticCodes(content)).toContain(code);
  });

  it('rejects pull_request_target', () => {
    const content = workflow(`      - uses: ./.github/actions/verify
`).replace('  pull_request:', '  pull_request_target:');

    expect(diagnosticCodes(content)).toContain('workflow.pull-request-target');
  });

  it('requires a release comment on every repeated action occurrence', () => {
    const content =
      workflow(`      # uses: actions/setup-node@${SETUP_NODE_SHA} # v7.0.0
      - uses: actions/setup-node@${SETUP_NODE_SHA} # v7.0.0
      - uses: actions/setup-node@${SETUP_NODE_SHA}
`);

    expect(diagnosticCodes(content)).toContain('workflow.action-comment');
  });

  it('requires explicit permissions', () => {
    const content = workflow(`      - uses: ./.github/actions/verify
`).replace('permissions:\n  contents: read\n', '');

    expect(diagnosticCodes(content)).toContain('workflow.permissions-missing');
  });

  it('rejects a writable job permission beneath safe workflow permissions', () => {
    const content = workflow(`      - uses: ./.github/actions/verify
`).replace(
      '    runs-on: ubuntu-latest',
      `    permissions:
      contents: write
    runs-on: ubuntu-latest`,
    );

    expect(diagnosticCodes(content)).toContain('workflow.permissions-writable');
  });

  it.each([
    ['an empty job mapping', '{}'],
    ['an explicit none access', '\n      issues: none'],
  ])('accepts %s beneath safe workflow permissions', (_name, permissions) => {
    const content = workflow(`      - uses: ./.github/actions/verify
`).replace(
      '    runs-on: ubuntu-latest',
      `    permissions: ${permissions}
    runs-on: ubuntu-latest`,
    );

    expect(validateWorkflowFile({ content, path: 'ci.yml' })).toEqual([]);
  });

  it('accepts a safe explicitly configured job without workflow permissions', () => {
    const content = workflow(`      - uses: ./.github/actions/verify
`)
      .replace('permissions:\n  contents: read\n', '')
      .replace(
        '    runs-on: ubuntu-latest',
        `    permissions:
      contents: read
    runs-on: ubuntu-latest`,
      );

    expect(validateWorkflowFile({ content, path: 'ci.yml' })).toEqual([]);
  });

  it('rejects a missing job permission when workflow permissions are absent', () => {
    const content = workflow(`      - uses: ./.github/actions/verify
`).replace('permissions:\n  contents: read\n', '');

    expect(diagnosticCodes(content)).toContain('workflow.permissions-missing');
  });

  it('rejects one writable job even when another job is safe', () => {
    const content = `name: CI
on:
  pull_request:
jobs:
  safe:
    permissions:
      contents: read
    runs-on: ubuntu-latest
    steps: []
  writable:
    permissions:
      issues: write
    runs-on: ubuntu-latest
    steps: []
`;

    expect(diagnosticCodes(content)).toContain('workflow.permissions-writable');
  });

  it('rejects unsupported permission access strings', () => {
    const content = workflow(`      - uses: ./.github/actions/verify
`).replace('contents: read', 'contents: inherit');

    expect(diagnosticCodes(content)).toContain('workflow.permissions-invalid');
  });

  it('rejects read-all under the explicit mapping policy', () => {
    const content = workflow(`      - uses: ./.github/actions/verify
`).replace('permissions:\n  contents: read', 'permissions: read-all');

    expect(diagnosticCodes(content)).toContain(
      'workflow.permissions-excessive',
    );
  });

  it('rejects a malformed permission declaration', () => {
    const content = workflow(`      - uses: ./.github/actions/verify
`).replace('permissions:\n  contents: read', 'permissions: []');

    expect(diagnosticCodes(content)).toContain('workflow.permissions-invalid');
  });

  it.each(['write', 'write-all'])(
    'rejects dangerous %s permissions',
    (permission) => {
      const content =
        permission === 'write-all'
          ? workflow(`      - uses: ./.github/actions/verify
`).replace('permissions:\n  contents: read', 'permissions: write-all')
          : workflow(`      - uses: ./.github/actions/verify
`).replace('contents: read', 'contents: write');

      expect(diagnosticCodes(content)).toContain(
        'workflow.permissions-writable',
      );
    },
  );

  it('rejects YAML aliases', () => {
    const content = `${workflow(`      - uses: ./.github/actions/verify
`)}
shared: &shared
  value: inert
copy: *shared
`;

    expect(diagnosticCodes(content)).toContain('workflow.yaml-alias');
  });

  it('enforces the workflow file-size bound before parsing', () => {
    const content = `#${'x'.repeat(262_145)}`;

    expect(diagnosticCodes(content)).toContain('workflow.file-size');
  });

  it('enforces the parsed structure-depth bound', () => {
    const nested = Array.from(
      { length: 70 },
      (_, index) => `${'  '.repeat(index)}level${String(index)}:`,
    ).join('\n');

    expect(
      diagnosticCodes(`${nested}\n${'  '.repeat(70)}value: true\n`),
    ).toContain('workflow.structure-limit');
  });

  it('enforces the parsed YAML node-count bound', () => {
    const jobs = Array.from(
      { length: 10_001 },
      (_, index) => `  job${String(index)}: {}`,
    ).join('\n');

    expect(diagnosticCodes(`name: CI\njobs:\n${jobs}\n`)).toContain(
      'workflow.structure-limit',
    );
  }, 30_000);

  it('bounds emitted workflow diagnostics', () => {
    const actions = Array.from(
      { length: 120 },
      () => '      - uses: example/action@main\n',
    ).join('');

    expect(
      validateWorkflowFile({
        content: workflow(actions),
        path: '.github/workflows/test.yml',
      }),
    ).toHaveLength(200);
  });

  it('defines the exact worker graph and aggregate Verification gate', () => {
    const jobs = trackedJobs();

    expect(Object.keys(jobs)).toEqual([
      'typecheck',
      'verification-static',
      'verification-tests-core',
      'verification-tests-interviews',
      'verification-tests-tools',
      'database-and-audit',
      'verification',
    ]);

    expect(trackedJob(jobs, 'typecheck')['name']).toBe('Standalone Typecheck');
    expect(trackedJob(jobs, 'verification-static')['name']).toBe(
      'Verification — Static and Authorities',
    );
    expect(trackedJob(jobs, 'database-and-audit')['name']).toBe(
      'Database and Audit',
    );

    for (const jobId of WORKER_JOB_IDS) {
      const job = trackedJob(jobs, jobId);

      expect(job['runs-on']).toBe('ubuntu-24.04');
      expect(job['timeout-minutes']).toBe(20);
      expect(job).not.toHaveProperty('needs');
      expect(job).not.toHaveProperty('continue-on-error');
    }

    const aggregate = trackedJob(jobs, 'verification');
    expect(aggregate['name']).toBe('Verification');
    expect(aggregate['runs-on']).toBe('ubuntu-24.04');
    expect(aggregate['timeout-minutes']).toBe(5);
    expect(aggregate['needs']).toEqual([...AGGREGATE_DEPENDENCIES]);
    expect(aggregate['if']).toBe('${{ always() }}');
    expect(aggregate).not.toHaveProperty('continue-on-error');
    expect(jobCommands(aggregate)).not.toContain('pnpm verify');

    for (const jobId of WORKER_JOB_IDS) {
      const job = trackedJob(jobs, jobId);
      const steps = jobSteps(job);
      const actionSteps = jobActionSteps(job);
      const commands = jobCommands(job);

      expect(actionSteps.map((step) => step['uses'])).toEqual([
        `actions/checkout@${CHECKOUT_SHA}`,
        `actions/setup-node@${SETUP_NODE_SHA}`,
      ]);
      expect(
        asRecord(actionSteps[0]?.['with'], 'checkout inputs'),
      ).toMatchObject({
        'persist-credentials': false,
      });
      expect(
        asRecord(actionSteps[1]?.['with'], 'setup-node inputs'),
      ).toMatchObject({
        'node-version-file': '.node-version',
        'package-manager-cache': false,
      });
      expect(commands).toContain('corepack enable pnpm');
      expect(commands).toContain('test "$(pnpm --version)" = "11.17.0"');
      expect(commands).toContain('pnpm install --frozen-lockfile');
      expect(commands).toContain('git diff --exit-code');
      expect(commands.at(-1)).toBe('git diff --exit-code');

      for (const step of steps) {
        expect(step).not.toHaveProperty('continue-on-error');
        if (typeof step['if'] === 'string') {
          expect(step['if']).not.toMatch(/always|cancelled|failure/i);
        }
      }
    }
  });

  it('moves every accepted non-test verify:core command into the static worker exactly once', () => {
    const jobs = trackedJobs();
    const staticJob = trackedJob(jobs, 'verification-static');
    const commands = jobCommands(staticJob);
    const staticStart = commands.indexOf('pnpm runtime:check');

    expect(commands.join('\n')).toContain('pnpm repo:pr-branch');
    expect(commands.join('\n')).toContain('pnpm repo:pr-title');
    expect(staticStart).toBeGreaterThanOrEqual(0);
    expect(commands.slice(staticStart)).toEqual([
      ...STATIC_VERIFICATION_COMMANDS,
    ]);
    for (const expected of STATIC_VERIFICATION_COMMANDS) {
      expect(commands.filter((command) => command === expected)).toHaveLength(
        1,
      );
    }
    expect(commands).not.toContain('pnpm verify');
    expect(commands).not.toContain('pnpm verify:core');
    expect(commands).not.toContain('pnpm verify:ci');
    expect(commands.join('\n')).not.toContain('vitest');
    expect(commands).not.toContain('pnpm db:verify');
    expect(commands).not.toContain('pnpm security:audit');
    const assignedRoots: string[] = [];

    for (const [jobId, expected] of Object.entries(TEST_SHARDS)) {
      const job = trackedJob(jobs, jobId);
      const commands = jobCommands(job);
      const runtimeIndex = commands.indexOf('pnpm runtime:check');
      const testCommand = commands[runtimeIndex + 2];

      expect(job['name']).toBe(expected.name);
      expect(runtimeIndex).toBeGreaterThanOrEqual(0);
      expect(commands[runtimeIndex + 1]).toBe('pnpm build');
      expect(typeof testCommand).toBe('string');
      expect(commands[runtimeIndex + 3]).toBe('git diff --exit-code');
      expect(commands.slice(runtimeIndex)).toHaveLength(4);

      const normalizedTestCommand = normalizedCommand(testCommand ?? '');
      expect(normalizedTestCommand).toMatch(/^pnpm exec vitest run /u);
      expect(normalizedTestCommand).toContain('--config vitest.config.ts');
      expect(normalizedTestCommand).not.toMatch(
        /--coverage|--retry|--passWithNoTests|--testNamePattern|(?:^| )-t(?: |$)|pnpm verify|db:verify|security:audit/iu,
      );
      expect(shardRoots(testCommand ?? '')).toEqual([...expected.roots]);
      assignedRoots.push(...expected.roots);
    }

    expect(assignedRoots).toEqual([
      'packages/contracts/test',
      'packages/domain/test',
      'packages/persistence/test',
      'packages/ingestion/test',
      'packages/interviews/test',
      'apps/repository-interview-operator/test',
      'tools/evaluation-harness/test',
      'tools/repository-interview-prelive/test',
      'tools/repository-checks/test',
    ]);
    expect(new Set(assignedRoots).size).toBe(assignedRoots.length);
  });

  it('keeps typecheck, database, aggregate, and failure-policy boundaries exact', () => {
    const jobs = trackedJobs();
    const typecheck = trackedJob(jobs, 'typecheck');
    const databaseAndAudit = trackedJob(jobs, 'database-and-audit');
    const aggregate = trackedJob(jobs, 'verification');
    const typecheckCommands = jobCommands(typecheck);
    const databaseCommands = jobCommands(databaseAndAudit);

    expect(typecheckCommands).toContain('pnpm typecheck');
    expect(typecheckCommands).not.toContain('pnpm verify');
    expect(typecheckCommands).not.toContain('pnpm verify:ci');
    expect(typecheckCommands).not.toContain('pnpm db:verify');
    expect(typecheckCommands).not.toContain('pnpm security:audit');
    expect(typecheckCommands.join('\n')).not.toMatch(
      /\bpnpm[ \t]+test(?::\w+)?\b/u,
    );

    expect(databaseCommands).toContain('pnpm db:verify');
    expect(databaseCommands).toContain('pnpm security:audit');
    expect(databaseCommands).not.toContain('pnpm typecheck');
    expect(databaseCommands).not.toContain('pnpm verify');
    expect(databaseCommands).not.toContain('pnpm verify:ci');
    expect(databaseCommands).not.toContain('pnpm build:product');

    expect(typecheck).not.toHaveProperty('services');
    expect(asRecord(typecheck['env'], 'typecheck environment')).toEqual({
      COREPACK_DEFAULT_TO_LATEST: '0',
    });
    expect(asRecord(databaseAndAudit['env'], 'database environment')).toEqual({
      COREPACK_DEFAULT_TO_LATEST: '0',
      GITBLOCKS_DB_TEST_ACK: 'ephemeral',
      GITBLOCKS_TEST_DB_DATABASE: 'gitblocks_test',
      GITBLOCKS_TEST_DB_HOST: '127.0.0.1',
      GITBLOCKS_TEST_DB_OWNER: 'postgres',
      GITBLOCKS_TEST_DB_PASSWORD: 'postgres-test-only',
      GITBLOCKS_TEST_DB_PORT: '5432',
    });
    const services = asRecord(databaseAndAudit['services'], 'services');
    const postgres = asRecord(services['postgres'], 'postgres service');
    expect(postgres['image']).toBe(POSTGRES_IMAGE);
    expect(asRecord(postgres['env'], 'postgres service environment')).toEqual({
      POSTGRES_DB: 'gitblocks_test',
      POSTGRES_PASSWORD: 'postgres-test-only',
    });
    expect(postgres['ports']).toEqual(['5432:5432']);
    expect(postgres['options']).toContain(
      'pg_isready -U postgres -d gitblocks_test',
    );

    expect(JSON.stringify(typecheck)).not.toContain('GITBLOCKS_DB_');
    expect(JSON.stringify(typecheck)).not.toContain('GITBLOCKS_TEST_DB_');
    for (const jobId of WORKER_JOB_IDS.filter(
      (jobId) => jobId !== 'database-and-audit',
    )) {
      const job = trackedJob(jobs, jobId);
      expect(job).not.toHaveProperty('services');
      expect(JSON.stringify(job)).not.toContain('GITBLOCKS_DB_');
      expect(JSON.stringify(job)).not.toContain('GITBLOCKS_TEST_DB_');
    }

    expect(jobActionSteps(aggregate)).toEqual([]);
    expect(jobSteps(aggregate)).toHaveLength(1);
    expect(asRecord(aggregate['env'], 'aggregate environment')).toEqual({
      STATIC_RESULT: '${{ needs.verification-static.result }}',
      CORE_TEST_RESULT: '${{ needs.verification-tests-core.result }}',
      INTERVIEW_TEST_RESULT:
        '${{ needs.verification-tests-interviews.result }}',
      TOOL_TEST_RESULT: '${{ needs.verification-tests-tools.result }}',
    });
    const aggregateCommand = jobCommands(aggregate)[0] ?? '';
    expect(aggregateCommand.trim().split('\n')).toEqual([
      'test "$STATIC_RESULT" = "success"',
      'test "$CORE_TEST_RESULT" = "success"',
      'test "$INTERVIEW_TEST_RESULT" = "success"',
      'test "$TOOL_TEST_RESULT" = "success"',
    ]);
    expect(aggregateCommand).not.toContain('git diff');
    expect(aggregateCommand).not.toContain('pnpm');
    expect(JSON.stringify(aggregate)).not.toContain('GITBLOCKS_DB_');
    expect(JSON.stringify(aggregate)).not.toContain('GITBLOCKS_TEST_DB_');

    for (const jobId of Object.keys(jobs)) {
      const job = trackedJob(jobs, jobId);
      expect(jobCommands(job).join('\n')).not.toMatch(
        /\|\|\s*true|\bset\s+\+e\b|\bretry\b|--rerun/i,
      );
      expect(job).not.toHaveProperty('continue-on-error');
      for (const step of jobSteps(job)) {
        expect(step).not.toHaveProperty('continue-on-error');
        if (jobId === 'verification') {
          continue;
        }
        if (typeof step['if'] === 'string') {
          expect(step['if']).not.toMatch(/always|cancelled|failure/i);
        }
      }
    }
  });

  it('accepts the tracked CI workflow', () => {
    const content = readFileSync(TRACKED_CI_URL, 'utf8');

    expect(
      validateWorkflowFile({
        content,
        path: '.github/workflows/ci.yml',
      }),
    ).toEqual([]);
  });
});
