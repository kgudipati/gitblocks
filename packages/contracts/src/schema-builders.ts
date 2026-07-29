import { Type, type TSchema } from 'typebox';

export const CONTRACT_VERSION = '1.0.0' as const;
export const MAX_DIAGNOSTIC_ISSUES = 20;
export const MAX_DIAGNOSTIC_PATH_LENGTH = 256;
export const MAX_DIAGNOSTIC_MESSAGE_LENGTH = 160;
export const MAX_INPUT_DEPTH = 32;
export const MAX_INPUT_NODES = 200_000;
export const MAX_INPUT_STRING_CODE_UNITS = 4_096;
export const MAX_INPUT_TOTAL_STRING_CODE_UNITS = 64_000_000;
export const MAX_OBJECT_PROPERTIES = 64;

const CONTROL_FREE_PATTERN =
  '^[^\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029\\u202a-\\u202e\\u2066-\\u2069]*$';
const STABLE_ID_PATTERN = '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$';
const REPOSITORY_NAME_PATTERN = '^[A-Za-z0-9_.-]{1,100}$';
const PACKAGE_NAME_PATTERN =
  '^(?:@[a-z0-9][a-z0-9._-]{0,99}/)?[a-z0-9][a-z0-9._-]{0,99}$';
const COMPONENT_VERSION_PATTERN = '^[A-Za-z0-9][A-Za-z0-9._+ -]{0,99}$';
const EXACT_REVISION_PATTERN = '^[A-Za-z0-9][A-Za-z0-9._+/@-]{0,99}$';
const EXACT_PACKAGE_VERSION_PATTERN =
  '^(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$';
const GIT_COMMIT_SHA_PATTERN = '^[0-9a-f]{40}$';
const SEMANTIC_VERSION_PATTERN =
  '^(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)$';
const REGION_PATTERN = '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$';
const ISO_TIMESTAMP_PATTERN =
  '^\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d{1,3})?Z$';
const HTTPS_URL_PATTERN =
  '^https://(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?\\.)+[A-Za-z]{2,63}(?::[0-9]{1,5})?(?:/[A-Za-z0-9._~!$&()*+,;=:@%/-]*)?(?:#[A-Za-z0-9._~!$()*+,;:@%/-]*)?$';

export function closedObject<T extends Readonly<Record<string, TSchema>>>(
  properties: T,
): ReturnType<typeof Type.Object<T>> {
  return Type.Object(properties, { additionalProperties: false });
}

export const contractVersionSchema = Type.Literal(CONTRACT_VERSION);

export const stableIdSchema = Type.String({
  minLength: 1,
  maxLength: 64,
  pattern: STABLE_ID_PATTERN,
});

export const reasonCodeSchema = Type.String({
  minLength: 1,
  maxLength: 64,
  pattern: STABLE_ID_PATTERN,
});

export const shortNameSchema = Type.String({
  minLength: 1,
  maxLength: 160,
  pattern: CONTROL_FREE_PATTERN,
});

export const shortTextSchema = Type.String({
  minLength: 1,
  maxLength: 500,
  pattern: CONTROL_FREE_PATTERN,
});

export const statementSchema = Type.String({
  minLength: 1,
  maxLength: 2_000,
  pattern: CONTROL_FREE_PATTERN,
});

export const versionTextSchema = Type.String({
  minLength: 1,
  maxLength: 100,
  pattern: CONTROL_FREE_PATTERN,
});

export const repositoryNameSchema = Type.String({
  minLength: 1,
  maxLength: 100,
  pattern: REPOSITORY_NAME_PATTERN,
});

export const packageNameSchema = Type.String({
  minLength: 1,
  maxLength: 201,
  pattern: PACKAGE_NAME_PATTERN,
});

export const componentNameSchema = Type.String({
  minLength: 1,
  maxLength: 201,
  pattern: PACKAGE_NAME_PATTERN,
});

export const componentVersionSchema = Type.String({
  minLength: 1,
  maxLength: 100,
  pattern: COMPONENT_VERSION_PATTERN,
});

export const exactRevisionSchema = Type.String({
  minLength: 1,
  maxLength: 100,
  pattern: EXACT_REVISION_PATTERN,
});

export const exactPackageVersionSchema = Type.String({
  minLength: 5,
  maxLength: 100,
  pattern: EXACT_PACKAGE_VERSION_PATTERN,
});

export const gitCommitShaSchema = Type.String({
  minLength: 40,
  maxLength: 40,
  pattern: GIT_COMMIT_SHA_PATTERN,
});

export const semanticVersionSchema = Type.String({
  minLength: 5,
  maxLength: 32,
  pattern: SEMANTIC_VERSION_PATTERN,
});

export const regionSchema = Type.String({
  minLength: 1,
  maxLength: 64,
  pattern: REGION_PATTERN,
});

export const timestampSchema = Type.String({
  minLength: 20,
  maxLength: 24,
  pattern: ISO_TIMESTAMP_PATTERN,
});

export const httpsUrlSchema = Type.String({
  minLength: 9,
  maxLength: 2_048,
  pattern: HTTPS_URL_PATTERN,
});

export const capabilityFamilySchema = Type.Union([
  Type.Literal('authorization'),
  Type.Literal('audit-logging'),
  Type.Literal('background-jobs'),
  Type.Literal('rate-limiting'),
  Type.Literal('webhooks'),
]);

export const dispositionSchema = Type.Union([
  Type.Literal('recommended'),
  Type.Literal('viable'),
  Type.Literal('rejected'),
  Type.Literal('insufficient-evidence'),
]);

export const responsibleOutcomeSchema = Type.Union([
  Type.Literal('recommend'),
  Type.Literal('no-viable-candidate'),
  Type.Literal('insufficient-evidence'),
]);
