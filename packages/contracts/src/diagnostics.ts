import type { DomainIssue } from '@gitblocks/domain';

import {
  MAX_DIAGNOSTIC_ISSUES,
  MAX_DIAGNOSTIC_MESSAGE_LENGTH,
  MAX_DIAGNOSTIC_PATH_LENGTH,
} from './schema-builders.ts';

export interface ContractIssue {
  readonly code: ContractIssueCode;
  readonly path: string;
  readonly message: ContractIssueMessage;
}

export type ContractIssueCode =
  | 'contract.additional-property'
  | 'contract.bounds'
  | 'contract.duplicate'
  | 'contract.input-complexity'
  | 'contract.input-depth'
  | 'contract.input-shape'
  | 'contract.literal'
  | 'contract.pattern'
  | 'contract.required'
  | 'contract.type'
  | 'contract.variant'
  | 'contract.version'
  | `domain.${string}`;

export type ContractIssueMessage =
  | 'Contract input has an unsupported object shape.'
  | 'Contract input exceeds the maximum complexity.'
  | 'Contract input exceeds the maximum nesting depth.'
  | 'Contract validation failed.'
  | 'Contract value contains an additional field.'
  | 'Contract value contains a duplicate item.'
  | 'Contract value does not match an allowed variant.'
  | 'Contract value does not match the required literal.'
  | 'Contract value does not match the required pattern.'
  | 'Contract value has an invalid type.'
  | 'Contract value is outside the allowed bounds.'
  | 'Contract version is unsupported.'
  | 'Required contract field is missing.'
  | 'Domain validation failed.';

export type ContractParseResult<Dto, Domain> =
  | {
      readonly ok: true;
      readonly value: Dto;
      readonly domain: Domain;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly issues: readonly ContractIssue[];
    };

const SAFE_DOMAIN_MESSAGE: ContractIssueMessage = 'Domain validation failed.';

export function contractIssue(
  code: ContractIssueCode,
  path: string,
  message: ContractIssueMessage,
): ContractIssue {
  return {
    code,
    path: boundPath(path),
    message: boundMessage(message),
  };
}

export function mapDomainIssues(
  issues: readonly DomainIssue[],
): readonly ContractIssue[] {
  return finalizeContractIssues(
    issues.map((issue) =>
      contractIssue(`domain.${issue.code}`, issue.path, SAFE_DOMAIN_MESSAGE),
    ),
  );
}

export function finalizeContractIssues(
  issues: readonly ContractIssue[],
): readonly ContractIssue[] {
  const deduplicated = new Map<string, ContractIssue>();
  for (const issue of issues) {
    const normalized = contractIssue(issue.code, issue.path, issue.message);
    const key = `${normalized.path}\0${normalized.code}\0${normalized.message}`;
    if (!deduplicated.has(key)) {
      deduplicated.set(key, normalized);
    }
  }
  return [...deduplicated.values()]
    .sort((left, right) =>
      compareText(
        `${left.path}\0${left.code}\0${left.message}`,
        `${right.path}\0${right.code}\0${right.message}`,
      ),
    )
    .slice(0, MAX_DIAGNOSTIC_ISSUES);
}

function boundPath(path: string): string {
  if (path.length <= MAX_DIAGNOSTIC_PATH_LENGTH) {
    return path;
  }
  return path.slice(0, MAX_DIAGNOSTIC_PATH_LENGTH);
}

function boundMessage(message: ContractIssueMessage): ContractIssueMessage {
  if (message.length > MAX_DIAGNOSTIC_MESSAGE_LENGTH) {
    return 'Contract validation failed.';
  }
  return message;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
