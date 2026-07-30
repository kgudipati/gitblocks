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
  return finalizeProviderOutputIssues(
    (errors ?? []).map((error) => {
      if (error.instancePath.startsWith('/limitations/')) {
        return providerOutputIssue(
          'provider-output.limitation-basis',
          error.instancePath,
          'Provider output limitation basis is inconsistent.',
        );
      }
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
    }),
  );
}
