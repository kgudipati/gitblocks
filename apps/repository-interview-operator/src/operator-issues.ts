export type RepositoryInterviewOperatorIssueCode =
  | 'operator.input-invalid'
  | 'operator.selection-invalid'
  | 'operator.policy-invalid'
  | 'operator.budget-invalid'
  | 'operator.migration-invalid'
  | 'operator.artifact-closure'
  | 'operator.application-failed'
  | 'operator.persistence-failed'
  | 'operator.receipt-invalid'
  | 'operator.receipt-write'
  | 'operator.immediate-reuse-failed'
  | 'operator.deadline';

export interface RepositoryInterviewOperatorIssueV1 {
  readonly code: RepositoryInterviewOperatorIssueCode;
  readonly path: string;
  readonly message: string;
}

const MESSAGES: Readonly<Record<RepositoryInterviewOperatorIssueCode, string>> =
  Object.freeze({
    'operator.input-invalid': 'The operator input is invalid.',
    'operator.selection-invalid': 'The operator selection is invalid.',
    'operator.policy-invalid': 'The operator policy is invalid.',
    'operator.budget-invalid': 'The operator budget cannot authorize the run.',
    'operator.migration-invalid':
      'The database migration authority is invalid.',
    'operator.artifact-closure': 'The selected artifact context is invalid.',
    'operator.application-failed': 'The interview application failed.',
    'operator.persistence-failed': 'The persistence operation failed.',
    'operator.receipt-invalid': 'The operator receipt is invalid.',
    'operator.receipt-write': 'The operator receipt could not be written.',
    'operator.immediate-reuse-failed': 'Immediate reuse verification failed.',
    'operator.deadline': 'The operator deadline was reached.',
  });

export function operatorIssue(
  code: RepositoryInterviewOperatorIssueCode,
  path = '',
): RepositoryInterviewOperatorIssueV1 {
  return Object.freeze({
    code,
    path: path.slice(0, 256),
    message: MESSAGES[code],
  });
}

export type OperatorParseResult<T> =
  | { readonly ok: true; readonly value: T; readonly issues: readonly [] }
  | {
      readonly ok: false;
      readonly issues: readonly RepositoryInterviewOperatorIssueV1[];
    };
