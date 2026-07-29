import type { StableId, StableIdKind } from './model.ts';

export const MAXIMUM_DOMAIN_ISSUES = 100;
export const MAXIMUM_DOMAIN_ISSUE_PATH_LENGTH = 256;
export const MAXIMUM_DOMAIN_ISSUE_MESSAGE_LENGTH = 160;

export type DomainIssueCode =
  | 'capability.family'
  | 'claim.traceability'
  | 'claim.unresolved-unknown'
  | 'constraint.disposition'
  | 'constraint.preservation'
  | 'constraint.ranking'
  | 'disposition.support'
  | 'evidence.inference-empty'
  | 'evidence.kind-conflict'
  | 'evidence.temporal-order'
  | 'exchange.candidate-set'
  | 'exchange.constraint-reference'
  | 'exchange.evidence-cutoff'
  | 'exchange.evidence-ownership'
  | 'exchange.evidence-preservation'
  | 'exchange.evidence-reference'
  | 'exchange.maximum-results'
  | 'exchange.request-link'
  | 'exchange.unknown-preservation'
  | 'fact.contradictory'
  | 'fact.duplicate'
  | 'id.format'
  | 'id.length'
  | 'id.normalization'
  | 'outcome.disposition'
  | 'ranking.candidate'
  | 'ranking.contradiction'
  | 'ranking.cycle'
  | 'ranking.duplicate-membership'
  | 'ranking.duplicate-relation'
  | 'ranking.empty-group'
  | 'reference.candidate-ownership'
  | 'reference.candidate-set'
  | 'reference.catalog-coverage'
  | 'reference.duplicate-id'
  | 'reference.duplicate-reference'
  | 'reference.unknown-candidate'
  | 'reference.unknown-claim'
  | 'reference.unknown-conflict'
  | 'reference.unknown-evidence'
  | 'reference.unknown-inference'
  | 'reference.unknown-unknown'
  | 'request.candidate-count'
  | 'request.candidate-family'
  | 'request.evidence-cutoff'
  | 'request.maximum-results'
  | 'request.transmission-approval'
  | 'result.completeness'
  | 'result.temporal-order'
  | 'timestamp.invalid';

export interface DomainIssue {
  readonly code: DomainIssueCode;
  readonly path: string;
  readonly message: string;
}

export type DomainResult<Value> =
  | {
      readonly ok: true;
      readonly value: Value;
    }
  | {
      readonly ok: false;
      readonly issues: readonly DomainIssue[];
    };

export const STABLE_ID_MAX_LENGTH = 64;

const STABLE_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u;

const ISSUE_MESSAGES: Readonly<Record<DomainIssueCode, string>> = {
  'capability.family': 'Capability family is not supported.',
  'claim.traceability':
    'A material claim must reference evidence, inference, or both.',
  'claim.unresolved-unknown':
    'A favorable claim cannot replace an unresolved material unknown.',
  'constraint.disposition':
    'A candidate with a known hard conflict must be rejected.',
  'constraint.preservation':
    'A hard conflict reason and evidence must remain on its candidate.',
  'constraint.ranking': 'A hard-conflicting candidate cannot be ranked.',
  'disposition.support':
    'A recommended or viable candidate requires a favorable attributable claim.',
  'evidence.inference-empty':
    'An inference must reference at least one evidence observation.',
  'evidence.kind-conflict':
    'Evidence and inference identifiers must remain distinct.',
  'evidence.temporal-order':
    'Evidence publication, collection, and freshness times are inconsistent.',
  'exchange.candidate-set':
    'The result candidate set must equal the request candidate set.',
  'exchange.constraint-reference':
    'A hard conflict must resolve to a request constraint and reason.',
  'exchange.evidence-cutoff': 'Request and result evidence cutoffs must agree.',
  'exchange.evidence-ownership':
    'Result evidence must retain its supplied candidate owner.',
  'exchange.evidence-preservation':
    'Result evidence must preserve the complete supplied observation.',
  'exchange.evidence-reference':
    'Result evidence must have been supplied in a candidate dossier.',
  'exchange.maximum-results':
    'The result ranking exceeds the requested maximum result count.',
  'exchange.request-link':
    'The result request and correlation identifiers must match the request.',
  'exchange.unknown-preservation':
    'A supplied material unknown must remain explicit for its candidate.',
  'fact.contradictory':
    'Facts with one semantic key must not assert contradictory values.',
  'fact.duplicate': 'A semantic repository fact must appear only once.',
  'id.format': 'Stable identifier has an invalid format.',
  'id.length': 'Stable identifier is outside the allowed length.',
  'id.normalization': 'Stable identifier is not in normalized form.',
  'outcome.disposition':
    'Responsible outcome contradicts the candidate dispositions.',
  'ranking.candidate':
    'Only supplied recommended or viable candidates may be ranked.',
  'ranking.contradiction':
    'A candidate pair cannot have contradictory rank relationships.',
  'ranking.cycle': 'Ranking relations must not contain a directed cycle.',
  'ranking.duplicate-membership':
    'A candidate may belong to only one rank group.',
  'ranking.duplicate-relation':
    'A ranking relationship must be declared only once.',
  'ranking.empty-group': 'A rank group must contain at least one candidate.',
  'reference.candidate-ownership':
    'A candidate-specific value must retain its candidate owner.',
  'reference.candidate-set':
    'Every supplied candidate must be assessed exactly once.',
  'reference.catalog-coverage':
    'A candidate-owned catalog item must be exposed by its assessment.',
  'reference.duplicate-id':
    'Stable identifiers must be unique within their local catalog.',
  'reference.duplicate-reference':
    'A catalog reference must be declared only once.',
  'reference.unknown-candidate':
    'Candidate reference does not resolve to a supplied candidate.',
  'reference.unknown-claim':
    'Claim reference does not resolve in the candidate catalog.',
  'reference.unknown-conflict':
    'Hard-conflict reference does not resolve in the candidate catalog.',
  'reference.unknown-evidence':
    'Evidence reference does not resolve in the evidence catalog.',
  'reference.unknown-inference':
    'Inference reference does not resolve in the inference catalog.',
  'reference.unknown-unknown':
    'Unknown reference does not resolve in the unknown catalog.',
  'request.candidate-count':
    'A fit-assessment request requires between one and twenty candidates.',
  'request.candidate-family':
    'Every candidate must belong to the requested capability family.',
  'request.evidence-cutoff':
    'Supplied evidence must not occur after the request evidence cutoff.',
  'request.maximum-results':
    'Requested result count must fit within the supplied candidate set.',
  'request.transmission-approval':
    'Transmission approval must cover every included product fact category.',
  'result.completeness':
    'A complete result cannot retain material evidence uncertainty.',
  'result.temporal-order':
    'Assessment production must not precede its evidence cutoff.',
  'timestamp.invalid': 'Timestamp is not a real canonical UTC date and time.',
};

export function addIssue(
  issues: DomainIssue[],
  code: DomainIssueCode,
  path: string,
): void {
  if (issues.length >= MAXIMUM_DOMAIN_ISSUES) {
    return;
  }
  issues.push({
    code,
    path: path.slice(0, MAXIMUM_DOMAIN_ISSUE_PATH_LENGTH),
    message: ISSUE_MESSAGES[code].slice(0, MAXIMUM_DOMAIN_ISSUE_MESSAGE_LENGTH),
  });
}

export function addStableIdIssues(
  issues: DomainIssue[],
  value: string,
  path: string,
): void {
  if (value.length < 1 || value.length > STABLE_ID_MAX_LENGTH) {
    addIssue(issues, 'id.length', path);
  }
  const normalized = value.normalize('NFKC');
  if (
    value !== normalized ||
    value !== value.trim() ||
    value !== value.toLowerCase() ||
    /[^\u0020-\u007e]/u.test(value)
  ) {
    addIssue(issues, 'id.normalization', path);
  }
  if (!STABLE_ID_PATTERN.test(value)) {
    addIssue(issues, 'id.format', path);
  }
}

export function createStableId<Kind extends StableIdKind>(
  _kind: Kind,
  value: string,
  path = 'id',
): DomainResult<StableId<Kind>> {
  const issues: DomainIssue[] = [];
  addStableIdIssues(issues, value, path);
  const finalized = finalizeIssues(issues);
  return finalized.length === 0
    ? { ok: true, value: value as StableId<Kind> }
    : { ok: false, issues: finalized };
}

export function finalizeIssues(
  issues: readonly DomainIssue[],
): readonly DomainIssue[] {
  const unique = new Map<string, DomainIssue>();
  for (const issue of issues) {
    unique.set(`${issue.path}\u0000${issue.code}`, issue);
  }
  return [...unique.values()]
    .sort((left, right) =>
      compareText(
        `${left.path}\u0000${left.code}`,
        `${right.path}\u0000${right.code}`,
      ),
    )
    .slice(0, MAXIMUM_DOMAIN_ISSUES);
}

export function resultFromIssues<Value>(
  value: Value,
  issues: readonly DomainIssue[],
): DomainResult<Value> {
  const finalized = finalizeIssues(issues);
  return finalized.length === 0
    ? { ok: true, value }
    : { ok: false, issues: finalized };
}

export function prefixIssues(
  target: DomainIssue[],
  prefix: string,
  issues: readonly DomainIssue[],
): void {
  for (const issue of issues) {
    addIssue(target, issue.code, `${prefix}.${issue.path}`);
  }
}

export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
