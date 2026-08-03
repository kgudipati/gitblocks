import {
  finalizeProviderOutputIssues,
  type ProviderOutputIssue,
  type ProviderOutputIssueCode,
} from './provider-output-issues.ts';
import {
  finalizeRepositoryInterviewMappingIssues,
  type RepositoryInterviewMappingIssue,
  type RepositoryInterviewMappingIssueCode,
} from './repository-interview-mapping-issues.ts';

export const REPOSITORY_INTERVIEW_PROVIDER_OUTPUT_DIAGNOSTIC_CODES =
  Object.freeze([
    'provider-output-json-decoding',
    'provider-output-json-boundary',
    'provider-output-input-shape',
    'provider-output-structure',
    'provider-output-bounds',
    'provider-output-string-policy',
    'provider-output-limitation-basis',
    'provider-output-citation-count',
    'provider-output-citation-range',
    'provider-output-duplicate-citation',
    'provider-output-duplicate-item',
    'provider-output-inference-rationale',
    'provider-output-topic-coverage',
    'provider-output-contradiction-sides',
    'provider-output-unknown-scope',
    'provider-output-unknown-artifact-alias',
    'provider-output-citation-out-of-range',
    'provider-output-mapping-closure',
  ] as const);

export type RepositoryInterviewProviderOutputDiagnosticCode =
  (typeof REPOSITORY_INTERVIEW_PROVIDER_OUTPUT_DIAGNOSTIC_CODES)[number];

const DIAGNOSTIC_CODES =
  new Set<RepositoryInterviewProviderOutputDiagnosticCode>(
    REPOSITORY_INTERVIEW_PROVIDER_OUTPUT_DIAGNOSTIC_CODES,
  );

const PROVIDER_ISSUE_DIAGNOSTICS: Readonly<
  Record<
    ProviderOutputIssueCode,
    RepositoryInterviewProviderOutputDiagnosticCode
  >
> = Object.freeze({
  'provider-output.input-shape': 'provider-output-input-shape',
  'provider-output.structure': 'provider-output-structure',
  'provider-output.bounds': 'provider-output-bounds',
  'provider-output.string-policy': 'provider-output-string-policy',
  'provider-output.limitation-basis': 'provider-output-limitation-basis',
  'provider-output.citation-count': 'provider-output-citation-count',
  'provider-output.citation-range': 'provider-output-citation-range',
  'provider-output.duplicate-citation': 'provider-output-duplicate-citation',
  'provider-output.duplicate-item': 'provider-output-duplicate-item',
  'provider-output.inference-rationale': 'provider-output-inference-rationale',
  'provider-output.topic-coverage': 'provider-output-topic-coverage',
  'provider-output.contradiction-sides': 'provider-output-contradiction-sides',
  'provider-output.unknown-scope': 'provider-output-unknown-scope',
});

const MAPPING_ISSUE_DIAGNOSTICS: Readonly<
  Record<
    RepositoryInterviewMappingIssueCode,
    RepositoryInterviewProviderOutputDiagnosticCode
  >
> = Object.freeze({
  'artifact-context-invalid': 'provider-output-mapping-closure',
  'artifact-set-closure': 'provider-output-mapping-closure',
  'prompt-too-large': 'provider-output-mapping-closure',
  'provider-output-invalid': 'provider-output-mapping-closure',
  'unknown-artifact-alias': 'provider-output-unknown-artifact-alias',
  'citation-out-of-range': 'provider-output-citation-out-of-range',
  'mapping-closure': 'provider-output-mapping-closure',
});

export function isRepositoryInterviewProviderOutputDiagnosticCode(
  value: unknown,
): value is RepositoryInterviewProviderOutputDiagnosticCode {
  return (
    typeof value === 'string' &&
    DIAGNOSTIC_CODES.has(
      value as RepositoryInterviewProviderOutputDiagnosticCode,
    )
  );
}

export function primaryProviderOutputDiagnosticCode(
  issues: readonly ProviderOutputIssue[],
): RepositoryInterviewProviderOutputDiagnosticCode {
  const primary = finalizeProviderOutputIssues(issues)[0];
  return primary === undefined
    ? 'provider-output-mapping-closure'
    : PROVIDER_ISSUE_DIAGNOSTICS[primary.code];
}

export function primaryRepositoryInterviewMappingDiagnosticCode(
  issues: readonly RepositoryInterviewMappingIssue[],
): RepositoryInterviewProviderOutputDiagnosticCode {
  const primary = finalizeRepositoryInterviewMappingIssues(issues)[0];
  return primary === undefined
    ? 'provider-output-mapping-closure'
    : MAPPING_ISSUE_DIAGNOSTICS[primary.code];
}
