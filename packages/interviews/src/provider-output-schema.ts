import { Type, type Static, type TSchema } from 'typebox';

export const REPOSITORY_INTERVIEW_PROVIDER_OUTPUT_SCHEMA_VERSION =
  '1.0.0' as const;

export const REPOSITORY_INTERVIEW_TOPICS = Object.freeze([
  'purpose-and-scope',
  'runtime-and-framework',
  'integration-surface',
  'data-and-state',
  'deployment-and-operations',
  'security-and-trust',
  'maintenance-and-support',
  'adoption-and-limitations',
] as const);

export const PROVIDER_OUTPUT_BOUNDS = Object.freeze({
  artifactAliases: 4,
  maximumLine: 10_000,
  maximumCitationLines: 80,
  maximumCitationsPerItem: 4,
  maximumDocumentedPositions: 24,
  maximumInferences: 8,
  maximumClaims: 32,
  maximumLimitations: 12,
  maximumContradictions: 6,
  maximumUnknowns: 16,
  maximumUniqueCitations: 96,
  maximumStatementScalars: 500,
  maximumStatementUtf8Bytes: 2_048,
  maximumRationaleScalars: 750,
  maximumRationaleUtf8Bytes: 3_072,
} as const);

const CONTROL_CODE_FREE_PATTERN = '^[^\\u0000-\\u001f\\u007f-\\u009f]*$';

function closedObject<T extends Readonly<Record<string, TSchema>>>(
  properties: T,
  options: Readonly<Record<string, unknown>> = {},
): ReturnType<typeof Type.Object<T>> {
  return Type.Object(properties, {
    ...options,
    additionalProperties: false,
  });
}

const topicSchema = Type.Union([
  Type.Literal('purpose-and-scope'),
  Type.Literal('runtime-and-framework'),
  Type.Literal('integration-surface'),
  Type.Literal('data-and-state'),
  Type.Literal('deployment-and-operations'),
  Type.Literal('security-and-trust'),
  Type.Literal('maintenance-and-support'),
  Type.Literal('adoption-and-limitations'),
]);

const artifactAliasSchema = Type.Union([
  Type.Literal('A1'),
  Type.Literal('A2'),
  Type.Literal('A3'),
  Type.Literal('A4'),
]);

const statementSchema = Type.String({
  description:
    'A bounded semantic statement validated locally for UTF-8 and safe text.',
  minLength: 1,
  maxLength: PROVIDER_OUTPUT_BOUNDS.maximumStatementScalars,
  pattern: CONTROL_CODE_FREE_PATTERN,
});

const rationaleSchema = Type.String({
  description:
    'A bounded inferential rationale or contradiction explanation validated locally for UTF-8 and safe text.',
  minLength: 1,
  maxLength: PROVIDER_OUTPUT_BOUNDS.maximumRationaleScalars,
  pattern: CONTROL_CODE_FREE_PATTERN,
});

const citationSchema = closedObject(
  {
    artifactAlias: artifactAliasSchema,
    startLine: Type.Integer({
      minimum: 1,
      maximum: PROVIDER_OUTPUT_BOUNDS.maximumLine,
    }),
    endLine: Type.Integer({
      minimum: 1,
      maximum: PROVIDER_OUTPUT_BOUNDS.maximumLine,
    }),
  },
  {
    description:
      'A temporary artifact alias and one-based inclusive line interval.',
  },
);

const oneToFourCitationsSchema = Type.Array(citationSchema, {
  minItems: 1,
  maxItems: PROVIDER_OUTPUT_BOUNDS.maximumCitationsPerItem,
});

const zeroToFourCitationsSchema = Type.Array(citationSchema, {
  minItems: 0,
  maxItems: PROVIDER_OUTPUT_BOUNDS.maximumCitationsPerItem,
});

const documentedConfidenceSchema = Type.Union([
  Type.Literal('high'),
  Type.Literal('medium'),
]);

const inferenceConfidenceSchema = Type.Union([
  Type.Literal('medium'),
  Type.Literal('low'),
]);

const documentedPositionSchema = closedObject({
  topic: topicSchema,
  statement: statementSchema,
  confidence: documentedConfidenceSchema,
  citations: oneToFourCitationsSchema,
});

const inferenceSchema = closedObject({
  topic: topicSchema,
  statement: statementSchema,
  rationale: rationaleSchema,
  confidence: inferenceConfidenceSchema,
  citations: oneToFourCitationsSchema,
});

const documentedLimitationSchema = closedObject({
  topic: topicSchema,
  basis: Type.Literal('documented-position'),
  statement: statementSchema,
  rationale: Type.Null(),
  confidence: documentedConfidenceSchema,
  citations: oneToFourCitationsSchema,
});

const inferenceLimitationSchema = closedObject({
  topic: topicSchema,
  basis: Type.Literal('inference'),
  statement: statementSchema,
  rationale: rationaleSchema,
  confidence: inferenceConfidenceSchema,
  citations: oneToFourCitationsSchema,
});

const limitationSchema = Type.Union([
  documentedLimitationSchema,
  inferenceLimitationSchema,
]);

const contradictionPositionSchema = closedObject({
  statement: statementSchema,
  citations: Type.Array(citationSchema, {
    minItems: 1,
    maxItems: 2,
  }),
});

const contradictionSchema = closedObject({
  topic: topicSchema,
  kind: Type.Union([
    Type.Literal('direct'),
    Type.Literal('scope-dependent'),
    Type.Literal('version-dependent'),
  ]),
  explanation: rationaleSchema,
  positionA: contradictionPositionSchema,
  positionB: contradictionPositionSchema,
});

const unknownSchema = closedObject({
  topic: topicSchema,
  reason: Type.Union([
    Type.Literal('not-documented'),
    Type.Literal('ambiguous'),
    Type.Literal('conflicting'),
    Type.Literal('insufficient-detail'),
    Type.Literal('artifact-unavailable'),
  ]),
  statement: statementSchema,
  partialCitations: zeroToFourCitationsSchema,
});

export const repositoryInterviewProviderOutputV1Schema = closedObject(
  {
    documentedPositions: Type.Array(documentedPositionSchema, {
      minItems: 0,
      maxItems: PROVIDER_OUTPUT_BOUNDS.maximumDocumentedPositions,
    }),
    inferences: Type.Array(inferenceSchema, {
      minItems: 0,
      maxItems: PROVIDER_OUTPUT_BOUNDS.maximumInferences,
    }),
    limitations: Type.Array(limitationSchema, {
      minItems: 0,
      maxItems: PROVIDER_OUTPUT_BOUNDS.maximumLimitations,
    }),
    contradictions: Type.Array(contradictionSchema, {
      minItems: 0,
      maxItems: PROVIDER_OUTPUT_BOUNDS.maximumContradictions,
    }),
    unknowns: Type.Array(unknownSchema, {
      minItems: 0,
      maxItems: PROVIDER_OUTPUT_BOUNDS.maximumUnknowns,
    }),
  },
  {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://gitblocks.dev/schemas/interviews/repository-provider-output/1.0.0',
    title: 'GitBlocks repository interview provider output 1.0.0',
    description:
      'Semantic-only untrusted provider output. Trusted identity and provenance are prohibited.',
  },
);

export type RepositoryInterviewProviderOutputV1 = Static<
  typeof repositoryInterviewProviderOutputV1Schema
>;

export type RepositoryInterviewTopic =
  (typeof REPOSITORY_INTERVIEW_TOPICS)[number];

export type ProviderCitationV1 =
  RepositoryInterviewProviderOutputV1['documentedPositions'][number]['citations'][number];

export const PROVIDER_OUTPUT_SEMANTIC_POLICY = Object.freeze({
  topics: REPOSITORY_INTERVIEW_TOPICS,
  confidence: {
    documentedPosition: {
      high: 'Every material clause is explicit and unambiguous in narrow citations.',
      medium:
        'The direct position is qualified, distributed across citations, or materially scope-sensitive.',
    },
    inference: {
      medium:
        'The cited artifacts support a bounded inferential bridge with limited uncertainty.',
      low: 'The inference remains materially uncertain but useful enough to preserve explicitly.',
    },
    contradiction: 'No confidence field is permitted.',
    unknown: 'No confidence field is permitted.',
  },
  bounds: PROVIDER_OUTPUT_BOUNDS,
  citations:
    'One-based inclusive line ranges; request the narrowest sufficient interval.',
  unknownScope:
    'Unknown means not established by the supplied artifact set, not universally absent.',
} as const);
