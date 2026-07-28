import { describe, expect, it } from 'vitest';

import { validateWorkflowFile } from '../src/workflow-policy.ts';

const CHECKOUT_SHA = '3d3c42e5aac5ba805825da76410c181273ba90b1';
const SETUP_NODE_SHA = '820762786026740c76f36085b0efc47a31fe5020';

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
});
