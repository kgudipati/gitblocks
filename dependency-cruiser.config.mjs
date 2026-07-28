/** @type {import('dependency-cruiser').IConfiguration} */
const configuration = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Cycles make ownership and initialization order ambiguous.',
      from: {
        pathNot: '(^|/)node_modules/',
      },
      to: { circular: true },
    },
    {
      name: 'no-unresolved',
      severity: 'error',
      comment:
        'Every static dependency must resolve from the pinned workspace.',
      from: {
        pathNot: '(^|/)node_modules/',
      },
      to: { couldNotResolve: true },
    },
    {
      name: 'no-production-to-test',
      severity: 'error',
      comment: 'Production modules must not depend on test-only modules.',
      from: {
        path: '(^|/)src/',
      },
      to: {
        path: [
          '(^|/)(?:test|tests|__tests__|architecture-fixtures)(/|$)',
          '[.](?:spec|test)[.](?:js|mjs|cjs|ts|mts|cts|tsx)$',
        ],
      },
    },
    {
      name: 'no-production-to-dev-dependency',
      severity: 'error',
      comment:
        'Runtime source must declare runtime packages as dependencies, not devDependencies.',
      from: {
        path: '(^|/)src/',
      },
      to: {
        dependencyTypes: ['npm-dev'],
        dependencyTypesNot: ['type-only'],
        pathNot: 'node_modules/@types/',
      },
    },
    {
      name: 'no-deep-workspace-import',
      severity: 'error',
      comment:
        'Workspace consumers must use package exports rather than another package’s private src tree.',
      from: {
        path: '^((?:apps|packages|tools)/[^/]+)/',
      },
      to: {
        path: '^(?!$1/)(?:apps|packages|tools)/[^/]+/src/',
      },
    },
    {
      name: 'no-domain-outward-dependency',
      severity: 'error',
      comment: 'Domain code must remain independent of outward-facing layers.',
      from: {
        path: '(^|/)domain(/|$)',
      },
      to: {
        path: '(^|/)(?:adapters|delivery|frameworks|infrastructure|interfaces)(/|$)',
      },
    },
    {
      name: 'no-application-outward-dependency',
      severity: 'error',
      comment:
        'Application code may depend inward on domain code, not outward on adapters.',
      from: {
        path: '(^|/)application(/|$)',
      },
      to: {
        path: '(^|/)(?:adapters|delivery|frameworks|infrastructure|interfaces)(/|$)',
      },
    },
    {
      name: 'no-product-to-tools',
      severity: 'error',
      comment: 'Product workspaces must not depend on repository tooling.',
      from: {
        path: '(^|/)(?:apps|packages)/',
      },
      to: {
        path: '(^|/)tools/',
      },
    },
  ],
  options: {
    exclude: {
      path: [
        '^(?:coverage|dist)(/|$)',
        '^(?:apps|packages|tools)/[^/]+/(?:coverage|dist)(/|$)',
      ],
    },
    moduleSystems: ['es6'],
    preserveSymlinks: false,
  },
};

export default configuration;
