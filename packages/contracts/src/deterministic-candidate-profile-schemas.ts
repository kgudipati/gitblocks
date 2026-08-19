import {
  DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION,
  DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION_V2,
  DETERMINISTIC_CANDIDATE_PROFILE_VERSION,
  DETERMINISTIC_CANDIDATE_PROFILE_VERSION_V2,
  DETERMINISTIC_PROFILE_DENOMINATOR_VERSION,
  DETERMINISTIC_PROFILE_FIELD_IDS,
  DETERMINISTIC_PROFILE_RULES_VERSION,
  DETERMINISTIC_PROFILE_RULES_VERSION_V2,
  getDeterministicProfileFieldRegistry,
} from '@gitblocks/domain';
import { Type, type Static, type TSchema } from 'typebox';

import {
  capabilityFamilySchema,
  closedObject,
  contractVersionSchema,
  packageNameSchema,
  repositoryNameSchema,
  stableIdSchema,
  timestampSchema,
} from './schema-builders.ts';

const digestSchema = Type.String({
  minLength: 64,
  maxLength: 64,
  pattern: '^[a-f0-9]{64}$',
});
const normalizedTokenSchema = Type.String({
  minLength: 1,
  maxLength: 100,
  pattern:
    '^[^\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029\\u202a-\\u202e\\u2066-\\u2069]+$',
});
const semanticVersionSchema = Type.String({
  minLength: 5,
  maxLength: 100,
  pattern:
    '^(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$',
});
const boundedCountSchema = Type.Integer({ minimum: 0, maximum: 1_000_000 });
const completeConceptSetSchema = closedObject({
  completeness: Type.Literal('complete'),
  conceptIds: Type.Array(stableIdSchema, { maxItems: 85, uniqueItems: true }),
});

const languageSchema = literals([
  'dotnet',
  'go',
  'java',
  'javascript',
  'php',
  'python',
  'ruby',
  'rust',
  'typescript',
]);
const frameworkSchema = literals([
  'django',
  'express',
  'fastify',
  'laravel',
  'nestjs',
  'nextjs',
  'rails',
  'spring',
]);
const datastoreSchema = literals([
  'dynamodb',
  'mongodb',
  'mysql',
  'postgresql',
  'redis',
  'sqlite',
]);
const processRoleSchema = literals([
  'api-server',
  'background-worker',
  'database-extension',
  'scheduled-task',
  'sidecar',
]);

const valueSchemas: Readonly<
  Record<(typeof DETERMINISTIC_PROFILE_FIELD_IDS)[number], TSchema>
> = {
  'catalog-role-status': closedObject({
    catalogStatus: literals([
      'active',
      'archived',
      'moved',
      'negative-control',
    ]),
  }),
  'capability-family': closedObject({
    primaryFamily: capabilityFamilySchema,
    additionalFamilies: Type.Array(capabilityFamilySchema, {
      maxItems: 4,
      uniqueItems: true,
    }),
  }),
  'repository-identity': closedObject({
    candidateId: stableIdSchema,
    displayName: Type.String({ minLength: 1, maxLength: 160 }),
    githubOwner: repositoryNameSchema,
    githubRepository: repositoryNameSchema,
  }),
  'adoption-unit-type': completeConceptSetSchema,
  'capability-variants-features': completeConceptSetSchema,
  'repository-discovery-metadata': closedObject({
    repositoryTopics: Type.Array(stableIdSchema, {
      maxItems: 32,
      uniqueItems: true,
    }),
    primaryLanguage: Type.Union([languageSchema, Type.Null()]),
  }),
  'language-ecosystem': closedObject({
    ecosystems: Type.Array(languageSchema, { maxItems: 9, uniqueItems: true }),
  }),
  'package-identity-mapping': Type.Union([
    closedObject({
      mapping: Type.Literal('mapped'),
      packageName: packageNameSchema,
    }),
    closedObject({ mapping: Type.Literal('unmapped') }),
  ]),
  'package-publication-version': closedObject({
    packageName: packageNameSchema,
    version: semanticVersionSchema,
    publishedAt: timestampSchema,
  }),
  'runtime-package-format': closedObject({
    nodeEngineRange: Type.Union([normalizedTokenSchema, Type.Null()]),
    moduleFormat: literals(['commonjs', 'dual', 'esm', 'unspecified']),
    packageFormat: Type.Literal('npm-package'),
    exportsDeclared: Type.Boolean(),
  }),
  'framework-compatibility': closedObject({
    frameworks: Type.Array(frameworkSchema, { maxItems: 8, uniqueItems: true }),
  }),
  'datastore-requirements': closedObject({
    datastores: Type.Array(datastoreSchema, { maxItems: 6, uniqueItems: true }),
  }),
  'required-infrastructure': completeConceptSetSchema,
  'optional-infrastructure': completeConceptSetSchema,
  'deployment-self-hosting': completeConceptSetSchema,
  'license-identity': closedObject({
    spdxId: Type.String({
      minLength: 1,
      maxLength: 64,
      pattern: '^[A-Za-z0-9][A-Za-z0-9.+-]{0,63}$',
    }),
  }),
  'archived-state': closedObject({ archived: Type.Boolean() }),
  'fork-upstream-state': closedObject({
    fork: Type.Boolean(),
    upstreamRepository: Type.Union([
      Type.String({
        minLength: 3,
        maxLength: 201,
        pattern: '^[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}$',
      }),
      Type.Null(),
    ]),
  }),
  'maintenance-activity': closedObject({
    snapshotAt: timestampSchema,
    lastCommitAt: Type.Union([timestampSchema, Type.Null()]),
    commitsInPrevious90Days: Type.Integer({ minimum: 0, maximum: 100_000 }),
  }),
  'release-state-recency': closedObject({
    snapshotAt: timestampSchema,
    latestReleaseVersion: Type.Union([normalizedTokenSchema, Type.Null()]),
    latestReleasePublishedAt: Type.Union([timestampSchema, Type.Null()]),
    prerelease: Type.Union([Type.Boolean(), Type.Null()]),
  }),
  'security-advisory-state': closedObject({
    snapshotAt: timestampSchema,
    applicableAdvisoryCount: Type.Integer({ minimum: 0, maximum: 10_000 }),
    highestSeverity: Type.Union([
      literals(['critical', 'high', 'low', 'moderate']),
      Type.Null(),
    ]),
  }),
  'security-policy-presence': closedObject({ present: Type.Boolean() }),
  'documentation-presence': closedObject({
    readmePresent: Type.Boolean(),
    documentationDirectoryPresent: Type.Boolean(),
  }),
  'test-ci-presence': closedObject({
    testsPresent: Type.Boolean(),
    ciConfigurationPresent: Type.Boolean(),
  }),
  'artifact-chunk-availability': closedObject({
    artifactSetId: stableIdSchema,
    materializedArtifactCount: Type.Integer({ minimum: 0, maximum: 10_000 }),
    chunkCount: boundedCountSchema,
  }),
  'package-repository-linkage': closedObject({
    linkage: literals(['matched', 'mismatched', 'undeclared']),
  }),
  'operational-complexity-primitives': closedObject({
    processRoles: Type.Array(processRoleSchema, {
      maxItems: 5,
      uniqueItems: true,
    }),
    requiresScheduledExecution: Type.Boolean(),
    requiresPersistentStorage: Type.Boolean(),
  }),
};

const catalogFieldCodeSchema = literals([
  'additional-capability-families',
  'candidate-id',
  'display-name',
  'github-owner',
  'github-repository',
  'npm-package',
  'primary-capability-family',
  'status',
]);

export const deterministicProfileSourceReferenceV1Schema = Type.Union([
  closedObject({
    kind: Type.Literal('catalog-field'),
    candidateId: stableIdSchema,
    catalogField: catalogFieldCodeSchema,
  }),
  closedObject({
    kind: Type.Literal('structured-collection'),
    sourceSnapshotId: stableIdSchema,
    evidenceIds: Type.Array(stableIdSchema, {
      maxItems: 64,
      uniqueItems: true,
    }),
    sourceTopicCodes: Type.Array(stableIdSchema, {
      maxItems: 32,
      uniqueItems: true,
    }),
  }),
  closedObject({
    kind: Type.Literal('artifact-set-entry'),
    artifactSetId: stableIdSchema,
    selectionId: stableIdSchema,
    entryOutcome: literals(['materialized', 'not-found', 'unavailable']),
    artifactId: Type.Union([stableIdSchema, Type.Null()]),
  }),
  closedObject({
    kind: Type.Literal('derived-profile-fields'),
    derivationRuleId: stableIdSchema,
    inputFieldIds: Type.Array(literals(DETERMINISTIC_PROFILE_FIELD_IDS), {
      minItems: 1,
      maxItems: 27,
      uniqueItems: true,
    }),
  }),
]);

const versionScopeSchema = Type.Union([
  closedObject({
    kind: Type.Literal('package-version'),
    version: semanticVersionSchema,
  }),
  closedObject({
    kind: Type.Literal('repository-snapshot'),
    snapshotId: stableIdSchema,
  }),
  Type.Null(),
]);

const stateReasonSchema = literals([
  'approved-artifact-field-value',
  'approved-catalog-field-value',
  'approved-derived-field-value',
  'approved-structured-field-value',
  'artifact-materialization-authority-not-committed',
  'conflicting-approved-values',
  'conflicting-approved-structured-values',
  'package-mapping-unmapped',
  'repository-wide-analysis-not-performed',
  'requires-reviewed-curator-classification',
  'source-code-semantic-analysis-out-of-scope',
  'structured-provider-value-not-committed',
]);
const stateRuleSchema = literals([
  'assign-known-approved-artifact-value',
  'assign-known-approved-catalog-value',
  'assign-known-approved-structured-value',
  'assign-known-deterministic-derived-value',
  'assign-not-applicable-for-unmapped-package',
  'assign-unknown-artifact-authority-missing',
  'assign-unknown-repository-analysis-missing',
  'assign-unknown-reviewed-classification-missing',
  'assign-unknown-source-analysis-out-of-scope',
  'assign-unknown-structured-provider-value-missing',
  'retain-conflicting-approved-claims',
]);
function extractionRulesForField(
  fieldId: (typeof DETERMINISTIC_PROFILE_FIELD_IDS)[number],
): string[] {
  const catalogRule =
    fieldId === 'catalog-role-status'
      ? ['extract-catalog-role-status']
      : fieldId === 'capability-family'
        ? ['extract-capability-family']
        : fieldId === 'package-identity-mapping'
          ? ['extract-package-identity-mapping']
          : fieldId === 'repository-identity'
            ? ['extract-repository-identity']
            : [];
  return [
    ...catalogRule,
    ...(catalogRule.length === 0
      ? [`extract-${fieldId}-from-structured-authority`]
      : []),
    `extract-${fieldId}-from-artifact-set-authority`,
    `derive-${fieldId}-from-profile-fields`,
  ];
}

const registry = getDeterministicProfileFieldRegistry();
export const deterministicProfileFieldRecordV1Schema = Type.Union(
  registry.flatMap((definition) => {
    const extractionRuleSchema = literals(
      extractionRulesForField(definition.fieldId),
    );
    const common = {
      fieldId: Type.Literal(definition.fieldId),
      scope: Type.Literal(definition.scope),
      stateReasonCode: stateReasonSchema,
      stateRuleId: stateRuleSchema,
      versionScope: versionScopeSchema,
      sourceReferences: Type.Array(
        deterministicProfileSourceReferenceV1Schema,
        { maxItems: 16, uniqueItems: true },
      ),
    };
    const known = closedObject({
      ...common,
      state: Type.Literal('known'),
      valueExtractionRuleId: extractionRuleSchema,
      value: valueSchemas[definition.fieldId],
    });
    const unknown = closedObject({
      ...common,
      state: Type.Literal('unknown'),
      valueExtractionRuleId: Type.Null(),
    });
    const conflict = closedObject({
      ...common,
      state: Type.Literal('conflict'),
      valueExtractionRuleId: Type.Null(),
      claims: Type.Array(
        closedObject({
          value: valueSchemas[definition.fieldId],
          valueExtractionRuleId: extractionRuleSchema,
          sourceReferences: Type.Array(
            deterministicProfileSourceReferenceV1Schema,
            { minItems: 1, maxItems: 16, uniqueItems: true },
          ),
        }),
        { minItems: 2, maxItems: 8 },
      ),
    });
    const branches: TSchema[] = [known, unknown, conflict];
    if (definition.notApplicablePermitted) {
      branches.push(
        closedObject({
          ...common,
          state: Type.Literal('not-applicable'),
          valueExtractionRuleId: Type.Null(),
        }),
      );
    }
    return branches;
  }),
);

export const deterministicCandidateProfileV1Schema = Type.Object(
  {
    contractVersion: contractVersionSchema,
    profileVersion: Type.Literal(DETERMINISTIC_CANDIDATE_PROFILE_VERSION),
    deterministicProfileId: Type.String({
      minLength: 56,
      maxLength: 56,
      pattern: '^profile-[a-f0-9]{48}$',
    }),
    candidateId: stableIdSchema,
    catalogBinding: closedObject({
      catalogVersion: stableIdSchema,
      catalogDigest: digestSchema,
    }),
    taxonomyBinding: closedObject({
      taxonomyVersion: Type.String({ minLength: 5, maxLength: 32 }),
      taxonomySemanticDigest: digestSchema,
    }),
    profileRulesVersion: Type.Literal(DETERMINISTIC_PROFILE_RULES_VERSION),
    fields: Type.Array(deterministicProfileFieldRecordV1Schema, {
      minItems: 27,
      maxItems: 27,
    }),
    semanticProfileDigest: digestSchema,
  },
  {
    additionalProperties: false,
    $id: 'https://gitblocks.dev/schemas/contracts/deterministic-candidate-profile/1.0.0',
    $schema: 'https://json-schema.org/draft/2020-12/schema',
  },
);

export const deterministicCandidateProfileAuthorityV1Schema = Type.Object(
  {
    contractVersion: contractVersionSchema,
    authorityVersion: Type.Literal(
      DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION,
    ),
    denominatorVersion: Type.Literal(DETERMINISTIC_PROFILE_DENOMINATOR_VERSION),
    catalogVersion: stableIdSchema,
    catalogDigest: digestSchema,
    taxonomyVersion: Type.String({ minLength: 5, maxLength: 32 }),
    taxonomySemanticDigest: digestSchema,
    profileRulesVersion: Type.Literal(DETERMINISTIC_PROFILE_RULES_VERSION),
    profiles: Type.Array(deterministicCandidateProfileV1Schema, {
      minItems: 150,
      maxItems: 150,
    }),
    semanticAuthorityDigest: digestSchema,
  },
  {
    additionalProperties: false,
    $id: 'https://gitblocks.dev/schemas/contracts/deterministic-candidate-profile-authority/1.0.0',
    $schema: 'https://json-schema.org/draft/2020-12/schema',
  },
);

const assertionFieldIds = new Set([
  'capability-variants-features',
  'required-infrastructure',
  'optional-infrastructure',
]);

function conceptAssertionSchema(
  fieldId: (typeof DETERMINISTIC_PROFILE_FIELD_IDS)[number],
): TSchema {
  const extractionRuleSchema = literals(extractionRulesForField(fieldId));
  const sourceReferences = Type.Array(
    deterministicProfileSourceReferenceV1Schema,
    { minItems: 1, maxItems: 16, uniqueItems: true },
  );
  const claim = closedObject({
    state: literals(['absent', 'present']),
    valueExtractionRuleId: extractionRuleSchema,
    sourceReferences,
  });
  return Type.Union([
    closedObject({
      conceptId: stableIdSchema,
      state: literals(['absent', 'present']),
      valueExtractionRuleId: extractionRuleSchema,
      sourceReferences,
    }),
    closedObject({
      conceptId: stableIdSchema,
      state: Type.Literal('conflict'),
      claims: Type.Array(claim, { minItems: 2, maxItems: 8 }),
    }),
  ]);
}

const deterministicProfileConceptFieldRecordV2Schemas = registry
  .filter((definition) => assertionFieldIds.has(definition.fieldId))
  .flatMap((definition) => {
    const common = {
      fieldId: Type.Literal(definition.fieldId),
      scope: Type.Literal(definition.scope),
      stateReasonCode: stateReasonSchema,
      stateRuleId: stateRuleSchema,
      versionScope: versionScopeSchema,
      sourceReferences: Type.Array(
        deterministicProfileSourceReferenceV1Schema,
        { maxItems: 16, uniqueItems: true },
      ),
    };
    const assertion = conceptAssertionSchema(definition.fieldId);
    return [
      closedObject({
        ...common,
        coverage: Type.Literal('unknown'),
        assertions: Type.Array(assertion, { maxItems: 0 }),
      }),
      closedObject({
        ...common,
        coverage: Type.Literal('partial'),
        assertions: Type.Array(assertion, {
          minItems: 1,
          maxItems: 85,
          uniqueItems: true,
        }),
      }),
      closedObject({
        ...common,
        coverage: Type.Literal('complete'),
        assertions: Type.Array(assertion, {
          maxItems: 85,
          uniqueItems: true,
        }),
      }),
    ];
  });

const deterministicProfileLegacyFieldRecordV2Schemas = (
  deterministicProfileFieldRecordV1Schema as unknown as {
    readonly anyOf: readonly TSchema[];
  }
).anyOf.filter((branch) => {
  const fieldId = (
    branch as {
      readonly properties: { readonly fieldId: { readonly const: string } };
    }
  ).properties.fieldId.const;
  return !assertionFieldIds.has(fieldId);
});

export const deterministicProfileFieldRecordV2Schema = Type.Union([
  ...deterministicProfileLegacyFieldRecordV2Schemas,
  ...deterministicProfileConceptFieldRecordV2Schemas,
]);

export const deterministicCandidateProfileV2Schema = Type.Object(
  {
    contractVersion: Type.Literal('2.0.0'),
    profileVersion: Type.Literal(DETERMINISTIC_CANDIDATE_PROFILE_VERSION_V2),
    deterministicProfileId: Type.String({
      minLength: 56,
      maxLength: 56,
      pattern: '^profile-[a-f0-9]{48}$',
    }),
    candidateId: stableIdSchema,
    catalogBinding: closedObject({
      catalogVersion: stableIdSchema,
      catalogDigest: digestSchema,
    }),
    taxonomyBinding: closedObject({
      taxonomyVersion: Type.String({ minLength: 5, maxLength: 32 }),
      taxonomySemanticDigest: digestSchema,
    }),
    profileRulesVersion: Type.Literal(DETERMINISTIC_PROFILE_RULES_VERSION_V2),
    fields: Type.Array(deterministicProfileFieldRecordV2Schema, {
      minItems: 27,
      maxItems: 27,
    }),
    semanticProfileDigest: digestSchema,
  },
  {
    additionalProperties: false,
    $id: 'https://gitblocks.dev/schemas/contracts/deterministic-candidate-profile/2.0.0',
    $schema: 'https://json-schema.org/draft/2020-12/schema',
  },
);

export const deterministicCandidateProfileAuthorityV2Schema = Type.Object(
  {
    contractVersion: Type.Literal('2.0.0'),
    authorityVersion: Type.Literal(
      DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION_V2,
    ),
    denominatorVersion: Type.Literal(DETERMINISTIC_PROFILE_DENOMINATOR_VERSION),
    catalogVersion: stableIdSchema,
    catalogDigest: digestSchema,
    taxonomyVersion: Type.String({ minLength: 5, maxLength: 32 }),
    taxonomySemanticDigest: digestSchema,
    profileRulesVersion: Type.Literal(DETERMINISTIC_PROFILE_RULES_VERSION_V2),
    profiles: Type.Array(deterministicCandidateProfileV2Schema, {
      minItems: 150,
      maxItems: 150,
    }),
    semanticAuthorityDigest: digestSchema,
  },
  {
    additionalProperties: false,
    $id: 'https://gitblocks.dev/schemas/contracts/deterministic-candidate-profile-authority/2.0.0',
    $schema: 'https://json-schema.org/draft/2020-12/schema',
  },
);

export type DeterministicProfileSourceReferenceV1 = Static<
  typeof deterministicProfileSourceReferenceV1Schema
>;
export type DeterministicProfileFieldRecordV1 = Static<
  typeof deterministicProfileFieldRecordV1Schema
>;
export type DeterministicCandidateProfileV1 = Static<
  typeof deterministicCandidateProfileV1Schema
>;
export type DeterministicCandidateProfileAuthorityV1 = Static<
  typeof deterministicCandidateProfileAuthorityV1Schema
>;
export type DeterministicProfileFieldRecordV2 = Static<
  typeof deterministicProfileFieldRecordV2Schema
>;
export type DeterministicCandidateProfileV2 = Static<
  typeof deterministicCandidateProfileV2Schema
>;
export type DeterministicCandidateProfileAuthorityV2 = Static<
  typeof deterministicCandidateProfileAuthorityV2Schema
>;

function literals(values: readonly string[]): TSchema {
  return Type.Union(values.map((value) => Type.Literal(value)));
}
