import { canonicalizeJson } from './canonical-json.ts';
import {
  finalizeProviderOutputIssues,
  providerOutputIssue,
  type ProviderOutputIssue,
} from './provider-output-issues.ts';
import {
  PROVIDER_OUTPUT_BOUNDS,
  REPOSITORY_INTERVIEW_TOPICS,
  type ProviderCitationV1,
  type RepositoryInterviewProviderOutputV1,
} from './provider-output-schema.ts';

const UNKNOWN_SCOPE_PATTERN =
  /\b(?:supplied|provided|reviewed|this)\s+(?:artifact\s+set|artifacts?)\b|\bthese\s+artifacts\b/iu;
const UNIVERSAL_ABSENCE_PATTERN =
  /\b(?:universally|anywhere|in\s+all\s+versions|never\s+exists?|does\s+not\s+exist)\b/iu;
const MARKDOWN_LINK_PATTERN = /!?\[[^\]\r\n]*\]\([^)\r\n]*\)/u;
const URL_PATTERN = /https?:\/\//iu;
const HTML_PATTERN = /<\/?[A-Za-z][^>]*>/u;
const CONTROL_OR_FORMAT_PATTERN = /[\p{Cc}\p{Cf}]/u;

interface SemanticString {
  readonly path: string;
  readonly value: string;
  readonly maximumScalars: number;
  readonly maximumBytes: number;
}

export function validateProviderOutputSemantics(
  value: RepositoryInterviewProviderOutputV1,
): readonly ProviderOutputIssue[] {
  const issues: ProviderOutputIssue[] = [];
  validateClaimCount(value, issues);
  validateTopicCoverage(value, issues);
  validateStrings(value, issues);
  validateInferenceRationales(value, issues);
  validateUnknownScope(value, issues);
  validateCitations(value, issues);
  validateContradictions(value, issues);
  validateDuplicateItems(value, issues);
  return finalizeProviderOutputIssues(issues);
}

function validateClaimCount(
  value: RepositoryInterviewProviderOutputV1,
  issues: ProviderOutputIssue[],
): void {
  if (
    value.documentedPositions.length + value.inferences.length >
    PROVIDER_OUTPUT_BOUNDS.maximumClaims
  ) {
    issues.push(
      providerOutputIssue(
        'provider-output.bounds',
        '',
        'Provider output value is outside the allowed bounds.',
      ),
    );
  }
}

function validateTopicCoverage(
  value: RepositoryInterviewProviderOutputV1,
  issues: ProviderOutputIssue[],
): void {
  const topics = new Set<string>();
  for (const item of [
    ...value.documentedPositions,
    ...value.inferences,
    ...value.limitations,
    ...value.contradictions,
    ...value.unknowns,
  ]) {
    topics.add(item.topic);
  }
  if (REPOSITORY_INTERVIEW_TOPICS.some((topic) => !topics.has(topic))) {
    issues.push(
      providerOutputIssue(
        'provider-output.topic-coverage',
        '',
        'Provider output topic coverage is incomplete.',
      ),
    );
  }
}

function validateStrings(
  value: RepositoryInterviewProviderOutputV1,
  issues: ProviderOutputIssue[],
): void {
  for (const semanticString of collectSemanticStrings(value)) {
    if (!isValidSemanticString(semanticString)) {
      issues.push(
        providerOutputIssue(
          'provider-output.string-policy',
          semanticString.path,
          'Provider output semantic text violates the safe text policy.',
        ),
      );
    }
  }
}

function collectSemanticStrings(
  value: RepositoryInterviewProviderOutputV1,
): readonly SemanticString[] {
  const strings: SemanticString[] = [];
  const addStatement = (path: string, statement: string): void => {
    strings.push({
      path,
      value: statement,
      maximumScalars: PROVIDER_OUTPUT_BOUNDS.maximumStatementScalars,
      maximumBytes: PROVIDER_OUTPUT_BOUNDS.maximumStatementUtf8Bytes,
    });
  };
  const addRationale = (path: string, rationale: string): void => {
    strings.push({
      path,
      value: rationale,
      maximumScalars: PROVIDER_OUTPUT_BOUNDS.maximumRationaleScalars,
      maximumBytes: PROVIDER_OUTPUT_BOUNDS.maximumRationaleUtf8Bytes,
    });
  };

  value.documentedPositions.forEach((item, index) => {
    addStatement(
      `/documentedPositions/${String(index)}/statement`,
      item.statement,
    );
  });
  value.inferences.forEach((item, index) => {
    addStatement(`/inferences/${String(index)}/statement`, item.statement);
    addRationale(`/inferences/${String(index)}/rationale`, item.rationale);
  });
  value.limitations.forEach((item, index) => {
    addStatement(`/limitations/${String(index)}/statement`, item.statement);
    if (item.rationale !== null) {
      addRationale(`/limitations/${String(index)}/rationale`, item.rationale);
    }
  });
  value.contradictions.forEach((item, index) => {
    addRationale(
      `/contradictions/${String(index)}/explanation`,
      item.explanation,
    );
    addStatement(
      `/contradictions/${String(index)}/positionA/statement`,
      item.positionA.statement,
    );
    addStatement(
      `/contradictions/${String(index)}/positionB/statement`,
      item.positionB.statement,
    );
  });
  value.unknowns.forEach((item, index) => {
    addStatement(`/unknowns/${String(index)}/statement`, item.statement);
  });
  return strings;
}

function isValidSemanticString(semanticString: SemanticString): boolean {
  const { value, maximumBytes, maximumScalars } = semanticString;
  if (
    value.length === 0 ||
    value.trim() !== value ||
    countUnicodeScalars(value) > maximumScalars ||
    Buffer.byteLength(value, 'utf8') > maximumBytes ||
    CONTROL_OR_FORMAT_PATTERN.test(value) ||
    URL_PATTERN.test(value) ||
    MARKDOWN_LINK_PATTERN.test(value) ||
    HTML_PATTERN.test(value)
  ) {
    return false;
  }
  const encoded = new TextEncoder().encode(value);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(encoded) === value;
  } catch {
    return false;
  }
}

function validateInferenceRationales(
  value: RepositoryInterviewProviderOutputV1,
  issues: ProviderOutputIssue[],
): void {
  value.inferences.forEach((item, index) => {
    if (canonicalText(item.statement) === canonicalText(item.rationale)) {
      issues.push(
        providerOutputIssue(
          'provider-output.inference-rationale',
          `/inferences/${String(index)}/rationale`,
          'Provider output inference rationale must add an inferential bridge.',
        ),
      );
    }
  });
}

function validateUnknownScope(
  value: RepositoryInterviewProviderOutputV1,
  issues: ProviderOutputIssue[],
): void {
  value.unknowns.forEach((item, index) => {
    if (
      !UNKNOWN_SCOPE_PATTERN.test(item.statement) ||
      UNIVERSAL_ABSENCE_PATTERN.test(item.statement)
    ) {
      issues.push(
        providerOutputIssue(
          'provider-output.unknown-scope',
          `/unknowns/${String(index)}/statement`,
          'Provider output unknown is not scoped to the supplied artifact set.',
        ),
      );
    }
  });
}

function validateCitations(
  value: RepositoryInterviewProviderOutputV1,
  issues: ProviderOutputIssue[],
): void {
  const uniqueGlobalCitations = new Set<string>();
  const collections: readonly {
    readonly path: string;
    readonly citations: readonly ProviderCitationV1[];
  }[] = [
    ...value.documentedPositions.map((item, index) => ({
      path: `/documentedPositions/${String(index)}`,
      citations: item.citations,
    })),
    ...value.inferences.map((item, index) => ({
      path: `/inferences/${String(index)}`,
      citations: item.citations,
    })),
    ...value.limitations.map((item, index) => ({
      path: `/limitations/${String(index)}`,
      citations: item.citations,
    })),
    ...value.contradictions.map((item, index) => ({
      path: `/contradictions/${String(index)}`,
      citations: [...item.positionA.citations, ...item.positionB.citations],
    })),
    ...value.unknowns.map((item, index) => ({
      path: `/unknowns/${String(index)}`,
      citations: item.partialCitations,
    })),
  ];

  for (const collection of collections) {
    const local = new Set<string>();
    collection.citations.forEach((item, index) => {
      const key = citationKey(item);
      uniqueGlobalCitations.add(key);
      if (local.has(key)) {
        issues.push(
          providerOutputIssue(
            'provider-output.duplicate-citation',
            `${collection.path}/citations/${String(index)}`,
            'Provider output contains a duplicate citation.',
          ),
        );
      }
      local.add(key);
      if (
        item.startLine > item.endLine ||
        item.endLine - item.startLine + 1 >
          PROVIDER_OUTPUT_BOUNDS.maximumCitationLines
      ) {
        issues.push(
          providerOutputIssue(
            'provider-output.citation-range',
            `${collection.path}/citations/${String(index)}`,
            'Provider output citation interval is invalid.',
          ),
        );
      }
    });
  }

  if (
    uniqueGlobalCitations.size > PROVIDER_OUTPUT_BOUNDS.maximumUniqueCitations
  ) {
    issues.push(
      providerOutputIssue(
        'provider-output.citation-count',
        '',
        'Provider output citation count is outside the allowed bound.',
      ),
    );
  }
}

function validateContradictions(
  value: RepositoryInterviewProviderOutputV1,
  issues: ProviderOutputIssue[],
): void {
  value.contradictions.forEach((item, index) => {
    if (
      canonicalizeJson(canonicalContradictionPosition(item.positionA)) ===
      canonicalizeJson(canonicalContradictionPosition(item.positionB))
    ) {
      issues.push(
        providerOutputIssue(
          'provider-output.contradiction-sides',
          `/contradictions/${String(index)}`,
          'Provider output contradiction sides must be distinct.',
        ),
      );
    }
  });
}

function validateDuplicateItems(
  value: RepositoryInterviewProviderOutputV1,
  issues: ProviderOutputIssue[],
): void {
  const collections = [
    {
      path: '/documentedPositions',
      items: value.documentedPositions.map(canonicalSemanticItem),
    },
    {
      path: '/inferences',
      items: value.inferences.map(canonicalSemanticItem),
    },
    {
      path: '/limitations',
      items: value.limitations.map(canonicalSemanticItem),
    },
    {
      path: '/contradictions',
      items: value.contradictions.map(canonicalContradiction),
    },
    {
      path: '/unknowns',
      items: value.unknowns.map(canonicalUnknown),
    },
  ] as const;

  for (const collection of collections) {
    const seen = new Set<string>();
    collection.items.forEach((item, index) => {
      const key = canonicalizeJson(item);
      if (seen.has(key)) {
        issues.push(
          providerOutputIssue(
            'provider-output.duplicate-item',
            `${collection.path}/${String(index)}`,
            'Provider output contains a duplicate semantic item.',
          ),
        );
      }
      seen.add(key);
    });
  }
}

type CitationSemanticItem =
  | RepositoryInterviewProviderOutputV1['documentedPositions'][number]
  | RepositoryInterviewProviderOutputV1['inferences'][number]
  | RepositoryInterviewProviderOutputV1['limitations'][number];

function canonicalSemanticItem(item: CitationSemanticItem): object {
  return {
    ...item,
    citations: [...item.citations].sort(compareCitations),
  };
}

function canonicalUnknown(
  item: RepositoryInterviewProviderOutputV1['unknowns'][number],
): object {
  return {
    ...item,
    partialCitations: [...item.partialCitations].sort(compareCitations),
  };
}

function canonicalContradiction(
  item: RepositoryInterviewProviderOutputV1['contradictions'][number],
): object {
  const sides = [
    canonicalContradictionPosition(item.positionA),
    canonicalContradictionPosition(item.positionB),
  ].sort((left, right) =>
    compareText(canonicalizeJson(left), canonicalizeJson(right)),
  );
  return {
    topic: item.topic,
    kind: item.kind,
    explanation: item.explanation,
    sides,
  };
}

function canonicalContradictionPosition(
  position: RepositoryInterviewProviderOutputV1['contradictions'][number]['positionA'],
): object {
  return {
    statement: position.statement,
    citations: [...position.citations].sort(compareCitations),
  };
}

function compareCitations(
  left: ProviderCitationV1,
  right: ProviderCitationV1,
): number {
  return compareText(citationKey(left), citationKey(right));
}

function citationKey(citation: ProviderCitationV1): string {
  return `${citation.artifactAlias}:${String(citation.startLine)}:${String(citation.endLine)}`;
}

function canonicalText(value: string): string {
  return value.replace(/\s+/gu, ' ').toLowerCase();
}

function countUnicodeScalars(value: string): number {
  let count = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index);
    if (codePoint !== undefined && codePoint > 0xffff) {
      index += 1;
    }
    count += 1;
  }
  return count;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
