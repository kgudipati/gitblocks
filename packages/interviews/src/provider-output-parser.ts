import {
  Ajv2020,
  type ErrorObject,
  type ValidateFunction,
} from 'ajv/dist/2020.js';

import {
  finalizeProviderOutputIssues,
  providerOutputIssue,
  type ProviderOutputIssue,
} from './provider-output-issues.ts';
import { preflightProviderOutput } from './provider-output-preflight.ts';
import {
  repositoryInterviewProviderOutputV1Schema,
  type RepositoryInterviewProviderOutputV1,
} from './provider-output-schema.ts';
import { validateProviderOutputSemantics } from './provider-output-validation.ts';

const ajv = new Ajv2020({
  allErrors: false,
  coerceTypes: false,
  messages: false,
  removeAdditional: false,
  strict: true,
  useDefaults: false,
  validateFormats: false,
  verbose: false,
});

const validator: ValidateFunction<RepositoryInterviewProviderOutputV1> =
  ajv.compile(repositoryInterviewProviderOutputV1Schema);

export type ProviderOutputParseResult =
  | {
      readonly ok: true;
      readonly value: RepositoryInterviewProviderOutputV1;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly issues: readonly ProviderOutputIssue[];
    };

export function parseRepositoryInterviewProviderOutputV1(
  value: unknown,
): ProviderOutputParseResult {
  const preflightIssues = preflightProviderOutput(value);
  if (preflightIssues.length > 0) {
    return { ok: false, issues: preflightIssues };
  }

  try {
    if (!validator(value)) {
      return {
        ok: false,
        issues: formatAjvErrors(validator.errors),
      };
    }
    const owned = structuredClone(value);
    const semanticIssues = validateProviderOutputSemantics(owned);
    return semanticIssues.length === 0
      ? { ok: true, value: owned, issues: [] }
      : { ok: false, issues: semanticIssues };
  } catch {
    return {
      ok: false,
      issues: [
        providerOutputIssue(
          'provider-output.input-shape',
          '',
          'Provider output input has an unsupported object shape.',
        ),
      ],
    };
  }
}

function formatAjvErrors(
  errors: readonly ErrorObject[] | null | undefined,
): readonly ProviderOutputIssue[] {
  const candidates = errors ?? [];
  const withoutUnionSummaries = candidates.some(
    (error) => error.keyword !== 'anyOf' && error.keyword !== 'oneOf',
  )
    ? candidates.filter(
        (error) => error.keyword !== 'anyOf' && error.keyword !== 'oneOf',
      )
    : candidates;
  const issues: ProviderOutputIssue[] = [];
  const handledLimitationIndexes = new Set<string>();

  for (const error of withoutUnionSummaries) {
    const limitationPath = limitationItemPath(error.instancePath);
    if (limitationPath === null) {
      issues.push(mapAjvError(error));
      continue;
    }
    if (handledLimitationIndexes.has(limitationPath)) {
      continue;
    }
    handledLimitationIndexes.add(limitationPath);
    const limitationErrors = withoutUnionSummaries.filter(
      (candidate) =>
        limitationItemPath(candidate.instancePath) === limitationPath,
    );
    const ordinaryErrors = limitationErrors.filter(
      (candidate) => !isLimitationVariantError(candidate, limitationPath),
    );
    if (ordinaryErrors.length > 0) {
      issues.push(...ordinaryErrors.map(mapAjvError));
      continue;
    }
    issues.push(
      providerOutputIssue(
        'provider-output.limitation-basis',
        limitationPath,
        'Provider output limitation basis is inconsistent.',
      ),
    );
  }
  return finalizeProviderOutputIssues(issues);
}

function mapAjvError(error: ErrorObject): ProviderOutputIssue {
  if (
    error.keyword === 'minLength' ||
    error.keyword === 'maxLength' ||
    error.keyword === 'pattern'
  ) {
    return providerOutputIssue(
      'provider-output.string-policy',
      error.instancePath,
      'Provider output semantic text violates the safe text policy.',
    );
  }
  if (
    error.keyword === 'maximum' ||
    error.keyword === 'minimum' ||
    error.keyword === 'maxItems' ||
    error.keyword === 'minItems'
  ) {
    return providerOutputIssue(
      'provider-output.bounds',
      error.instancePath,
      'Provider output value is outside the allowed bounds.',
    );
  }
  return providerOutputIssue(
    'provider-output.structure',
    error.instancePath,
    'Provider output value does not match the required closed structure.',
  );
}

function limitationItemPath(instancePath: string): string | null {
  const match = /^\/limitations\/[0-9]+(?:\/|$)/u.exec(instancePath);
  return match === null ? null : match[0].replace(/\/$/u, '');
}

function isLimitationVariantError(
  error: ErrorObject,
  limitationPath: string,
): boolean {
  if (error.keyword === 'required') {
    const missingProperty = (
      error.params as Readonly<{ missingProperty?: unknown }>
    ).missingProperty;
    return (
      error.instancePath === limitationPath &&
      (missingProperty === 'basis' ||
        missingProperty === 'rationale' ||
        missingProperty === 'confidence')
    );
  }
  if (error.keyword !== 'const' && error.keyword !== 'type') {
    return false;
  }
  const fieldPath = error.instancePath.slice(limitationPath.length + 1);
  return (
    fieldPath === 'basis' ||
    fieldPath === 'rationale' ||
    fieldPath === 'confidence'
  );
}
