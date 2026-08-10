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
        dependencyTypesNot: ['npm', 'npm-dev', 'npm-optional', 'npm-peer'],
        path: '^(?!$1/)(?:apps|packages|tools)/[^/]+/src/',
      },
    },
    {
      name: 'no-domain-outward-dependency',
      severity: 'error',
      comment:
        'The pure product domain may depend only on modules inside its own source tree.',
      from: {
        path: '^packages/domain/src/',
      },
      to: {
        pathNot: '^packages/domain/src/',
      },
    },
    {
      name: 'no-contracts-outward-dependency',
      severity: 'error',
      comment:
        'Product contracts may depend only on their own source, the domain package, TypeBox, and Ajv.',
      from: {
        path: '^packages/contracts/src/',
      },
      to: {
        pathNot:
          '^(?:packages/contracts/src/|packages/domain/)|node_modules/(?:@gitblocks/domain|ajv|typebox)(?:/|$)',
      },
    },
    {
      name: 'no-retrieval-outward-dependency',
      severity: 'error',
      comment:
        'Retrieval may depend only on its own source plus product contracts and domain authority.',
      from: {
        path: '^packages/retrieval/src/',
      },
      to: {
        pathNot:
          '^(?:packages/retrieval/src/|packages/(?:contracts|domain)/)|node_modules/@gitblocks/(?:contracts|domain)(?:/|$)',
      },
    },
    {
      name: 'no-persistence-outward-dependency',
      severity: 'error',
      comment:
        'Persistence may depend only on its own source, contracts/domain, Postgres.js, and approved Node APIs.',
      from: {
        path: '^packages/persistence/src/',
      },
      to: {
        pathNot:
          '^(?:packages/persistence/src/|packages/(?:contracts|domain)/|node:|crypto$|fs/promises$)|node_modules/(?:@gitblocks/(?:contracts|domain)|postgres)(?:/|$)',
      },
    },
    {
      name: 'no-ingestion-outward-dependency',
      severity: 'error',
      comment:
        'Ingestion may depend only on its own source, persistence/contracts/domain, and approved Node APIs.',
      from: {
        path: '^packages/ingestion/src/',
      },
      to: {
        pathNot:
          '^(?:packages/ingestion/src/|packages/(?:persistence|contracts|domain)/|node:|crypto$|stream/web$|util$)|node_modules/@gitblocks/(?:persistence|contracts|domain)(?:/|$)',
      },
    },
    {
      name: 'no-interviews-outward-dependency',
      severity: 'error',
      comment:
        'Repository interviews may depend only on its own source, contracts, TypeBox, Ajv, and approved Node APIs.',
      from: {
        path: '^packages/interviews/src/',
      },
      to: {
        pathNot:
          '^(?:packages/interviews/src/|packages/contracts/|node:|crypto$|fs/promises$|path$)|node_modules/(?:@gitblocks/contracts|ajv|typebox)(?:/|$)',
      },
    },
    {
      name: 'operator-composition-root-dependencies',
      severity: 'error',
      comment:
        'The repository interview operator composes only the accepted contracts, interviews, persistence, its own source, and Node APIs.',
      from: {
        path: '^apps/repository-interview-operator/(?:src|scripts)/',
      },
      to: {
        pathNot:
          '^(?:apps/repository-interview-operator/|packages/(?:contracts|interviews|persistence)/|node:|crypto$|fs/promises$|path$|url$)|node_modules/@gitblocks/(?:contracts|interviews|persistence)(?:/|$)',
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
        path: '^(?:packages/(?:contracts|domain|retrieval|persistence|ingestion|interviews)|apps/repository-interview-operator)/',
      },
      to: {
        path: '^tools/',
      },
    },
    {
      name: 'no-product-to-evaluation',
      severity: 'error',
      comment:
        'Product packages must not depend on evaluation corpus files, schemas, or implementation.',
      from: {
        path: '^(?:packages/(?:contracts|domain|retrieval|persistence|ingestion|interviews)|apps/repository-interview-operator)/',
      },
      to: {
        path: '^(?:evals|schemas/evaluation)(?:/|$)',
      },
    },
    {
      name: 'no-product-to-outward-layer',
      severity: 'error',
      comment:
        'Product packages must not depend on adapter, framework, provider, or storage layers.',
      from: {
        path: '^packages/(?:contracts|domain|retrieval)/',
      },
      to: {
        path: '(^|/)(?:adapters?|database|delivery|frameworks?|http|infrastructure|interfaces?|mcp|orm|providers?|queues?|storage)(/|$)',
      },
    },
    {
      name: 'no-persistence-to-prohibited-layer',
      severity: 'error',
      comment:
        'Persistence cannot depend on application, transport, provider, framework, queue, worker, model, or deployment layers.',
      from: {
        path: '^packages/persistence/',
      },
      to: {
        path: '(^|/)(?:application|delivery|deployments?|frameworks?|github|http|interfaces?|mcp|models?|providers?|queues?|workers?)(/|$)',
      },
    },
    {
      name: 'no-production-to-evaluation-gold',
      severity: 'error',
      comment:
        'Production modules must not import proposed evaluation gold answers.',
      from: {
        path: '(^|/)src/',
      },
      to: {
        path: '(^|/)evals/[^/]+/gold/',
      },
    },
  ],
  options: {
    enhancedResolveOptions: {
      conditionNames: ['import', 'node', 'default', 'types'],
      exportsFields: ['exports'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    exclude: {
      path: [
        '^(?:coverage|dist)(/|$)',
        '^(?:apps|packages|tools)/[^/]+/(?:coverage|dist|node_modules)(/|$)',
      ],
    },
    moduleSystems: ['es6'],
    preserveSymlinks: false,
  },
};

export default configuration;
