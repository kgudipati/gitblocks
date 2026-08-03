import type {
  RepositoryInterviewCitationInputV1,
  RepositoryInterviewClaimInputV1,
  RepositoryInterviewContradictionInputV1,
  RepositoryInterviewLimitationInputV1,
  RepositoryInterviewUnknownInputV1,
} from '@gitblocks/contracts';

import { canonicalizeJson, sha256Digest } from './canonical-json.ts';
import {
  finalizeRepositoryInterviewMappingIssues,
  repositoryInterviewMappingIssue,
  type RepositoryInterviewMappingIssue,
} from './repository-interview-mapping-issues.ts';
import {
  REPOSITORY_INTERVIEW_PROMPT_BOUNDS,
  repositoryInterviewInstructionText,
  repositoryInterviewPromptDigest,
  type RenderedRepositoryInterviewPromptV1,
  type RepositoryInterviewArtifactAliasBinding,
} from './repository-interview-prompt.ts';
import { parseRepositoryInterviewProviderOutputV1 } from './provider-output-parser.ts';
import {
  primaryProviderOutputDiagnosticCode,
  primaryRepositoryInterviewMappingDiagnosticCode,
  type RepositoryInterviewProviderOutputDiagnosticCode,
} from './provider-output-diagnostics.ts';
import {
  REPOSITORY_INTERVIEW_PROVIDER_OUTPUT_SCHEMA_VERSION,
  type ProviderCitationV1,
  type RepositoryInterviewProviderOutputV1,
} from './provider-output-schema.ts';
import {
  validateLoadedRepositoryInterviewSpecification,
  type LoadedRepositoryInterviewSpecification,
} from './specification.ts';

export type RepositoryInterviewProviderOutputDigestResultV1 =
  | {
      readonly ok: true;
      readonly digest: string;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnosticCode: RepositoryInterviewProviderOutputDiagnosticCode;
      readonly issues: readonly RepositoryInterviewMappingIssue[];
    };

export interface ResolveRepositoryInterviewProviderOutputInputV1 {
  readonly providerOutput: unknown;
  readonly prompt: RenderedRepositoryInterviewPromptV1;
  readonly specification: LoadedRepositoryInterviewSpecification;
}

export interface ResolvedRepositoryInterviewProviderOutputV1 {
  readonly candidateId: string;
  readonly artifactSetId: string;
  readonly artifactSetIdentityDigest: string;
  readonly promptDigest: string;
  readonly providerOutputDigest: string;
  readonly citations: readonly RepositoryInterviewCitationInputV1[];
  readonly claims: readonly RepositoryInterviewClaimInputV1[];
  readonly limitations: readonly RepositoryInterviewLimitationInputV1[];
  readonly contradictions: readonly RepositoryInterviewContradictionInputV1[];
  readonly unknowns: readonly RepositoryInterviewUnknownInputV1[];
}

export type ResolveRepositoryInterviewProviderOutputResultV1 =
  | {
      readonly ok: true;
      readonly value: ResolvedRepositoryInterviewProviderOutputV1;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnosticCode: RepositoryInterviewProviderOutputDiagnosticCode;
      readonly issues: readonly RepositoryInterviewMappingIssue[];
    };

interface ProviderCitationEntry {
  readonly citation: ProviderCitationV1;
  readonly path: string;
}

interface ResolvedCitationEntry {
  readonly coordinate: RepositoryInterviewCitationInputV1;
  readonly binding: RepositoryInterviewArtifactAliasBinding;
}

export function repositoryInterviewProviderOutputDigestV1(
  providerOutput: unknown,
  specification: LoadedRepositoryInterviewSpecification,
): RepositoryInterviewProviderOutputDigestResultV1 {
  const parsed = parseAndDigestProviderOutput(providerOutput, specification);
  return parsed.ok ? { ok: true, digest: parsed.digest, issues: [] } : parsed;
}

export function resolveRepositoryInterviewProviderOutputV1(
  input: ResolveRepositoryInterviewProviderOutputInputV1,
): ResolveRepositoryInterviewProviderOutputResultV1 {
  if (!isPromptContextValid(input.prompt, input.specification)) {
    return failure([
      repositoryInterviewMappingIssue('mapping-closure', '/prompt'),
    ]);
  }
  const parsed = parseAndDigestProviderOutput(
    input.providerOutput,
    input.specification,
  );
  if (!parsed.ok) {
    return parsed;
  }

  const bindings = new Map(
    input.prompt.aliasBindings.map((binding) => [binding.alias, binding]),
  );
  const issues: RepositoryInterviewMappingIssue[] = [];
  for (const { citation, path } of collectProviderCitations(parsed.value)) {
    const binding = bindings.get(citation.artifactAlias);
    if (binding === undefined) {
      issues.push(
        repositoryInterviewMappingIssue('unknown-artifact-alias', path),
      );
    } else if (
      citation.startLine < 1 ||
      citation.endLine < citation.startLine ||
      citation.endLine - citation.startLine + 1 > 80 ||
      citation.endLine > binding.lineCount
    ) {
      issues.push(
        repositoryInterviewMappingIssue('citation-out-of-range', path),
      );
    }
  }
  if (issues.length > 0) {
    return failure(issues);
  }

  try {
    const resolveCitations = (
      citations: readonly ProviderCitationV1[],
    ): readonly RepositoryInterviewCitationInputV1[] =>
      citations.map((citation) => {
        const binding = bindings.get(citation.artifactAlias);
        if (binding === undefined) {
          throw new Error('Repository interview alias closure failed.');
        }
        return {
          artifactId: binding.artifactId,
          startLine: citation.startLine,
          endLine: citation.endLine,
        };
      });

    const documentedClaims: RepositoryInterviewClaimInputV1[] =
      parsed.value.documentedPositions.map((item) => ({
        kind: 'documented-position',
        topic: item.topic,
        statement: item.statement,
        rationale: null,
        confidence: item.confidence,
        citations: resolveCitations(item.citations),
      }));
    const inferenceClaims: RepositoryInterviewClaimInputV1[] =
      parsed.value.inferences.map((item) => ({
        kind: 'inference',
        topic: item.topic,
        statement: item.statement,
        rationale: item.rationale,
        confidence: item.confidence,
        citations: resolveCitations(item.citations),
      }));
    const limitations: RepositoryInterviewLimitationInputV1[] =
      parsed.value.limitations.map((item) =>
        item.basis === 'documented-position'
          ? {
              topic: item.topic,
              basis: item.basis,
              statement: item.statement,
              rationale: null,
              confidence: item.confidence,
              citations: resolveCitations(item.citations),
            }
          : {
              topic: item.topic,
              basis: item.basis,
              statement: item.statement,
              rationale: item.rationale,
              confidence: item.confidence,
              citations: resolveCitations(item.citations),
            },
      );
    const contradictions: RepositoryInterviewContradictionInputV1[] =
      parsed.value.contradictions.map((item) => ({
        topic: item.topic,
        kind: item.kind,
        explanation: item.explanation,
        positions: [
          {
            statement: item.positionA.statement,
            citations: resolveCitations(item.positionA.citations),
          },
          {
            statement: item.positionB.statement,
            citations: resolveCitations(item.positionB.citations),
          },
        ],
      }));
    const unknowns: RepositoryInterviewUnknownInputV1[] =
      parsed.value.unknowns.map((item) => ({
        topic: item.topic,
        reason: item.reason,
        statement: item.statement,
        partialCitations: resolveCitations(item.partialCitations),
      }));

    const coordinateCatalog = new Map<string, ResolvedCitationEntry>();
    for (const { citation } of collectProviderCitations(parsed.value)) {
      const binding = bindings.get(citation.artifactAlias);
      if (binding === undefined) {
        throw new Error('Repository interview alias closure failed.');
      }
      const coordinate = {
        artifactId: binding.artifactId,
        startLine: citation.startLine,
        endLine: citation.endLine,
      };
      const key = coordinateKey(coordinate);
      if (!coordinateCatalog.has(key)) {
        coordinateCatalog.set(key, { coordinate, binding });
      }
    }
    const citations = [...coordinateCatalog.values()]
      .sort(compareResolvedCitations)
      .map(({ coordinate }) => coordinate);

    return {
      ok: true,
      value: Object.freeze({
        candidateId: input.prompt.candidateId,
        artifactSetId: input.prompt.artifactSetId,
        artifactSetIdentityDigest: input.prompt.artifactSetIdentityDigest,
        promptDigest: input.prompt.promptDigest,
        providerOutputDigest: parsed.digest,
        citations: Object.freeze(citations),
        claims: Object.freeze(documentedClaims.concat(inferenceClaims)),
        limitations: Object.freeze(limitations),
        contradictions: Object.freeze(contradictions),
        unknowns: Object.freeze(unknowns),
      }),
      issues: [],
    };
  } catch {
    return failure([
      repositoryInterviewMappingIssue('mapping-closure', '/providerOutput'),
    ]);
  }
}

function parseAndDigestProviderOutput(
  providerOutput: unknown,
  specification: LoadedRepositoryInterviewSpecification,
):
  | {
      readonly ok: true;
      readonly value: RepositoryInterviewProviderOutputV1;
      readonly digest: string;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnosticCode: RepositoryInterviewProviderOutputDiagnosticCode;
      readonly issues: readonly RepositoryInterviewMappingIssue[];
    } {
  try {
    validateLoadedRepositoryInterviewSpecification(specification);
  } catch {
    return failure([
      repositoryInterviewMappingIssue('mapping-closure', '/specification'),
    ]);
  }
  const parsed = parseRepositoryInterviewProviderOutputV1(providerOutput);
  if (!parsed.ok) {
    return failure(
      parsed.issues.map((issue) =>
        repositoryInterviewMappingIssue('provider-output-invalid', issue.path),
      ),
      primaryProviderOutputDiagnosticCode(parsed.issues),
    );
  }
  return {
    ok: true,
    value: parsed.value,
    digest: sha256Digest(
      canonicalizeJson({
        kind: 'repository-interview-provider-output',
        digestVersion: 1,
        providerOutputSchemaVersion:
          REPOSITORY_INTERVIEW_PROVIDER_OUTPUT_SCHEMA_VERSION,
        providerOutputSchemaDigest:
          specification.manifest.providerOutputSchema.digest,
        providerOutput: parsed.value,
      }),
    ),
    issues: [],
  };
}

function isPromptContextValid(
  prompt: RenderedRepositoryInterviewPromptV1,
  specification: LoadedRepositoryInterviewSpecification,
): boolean {
  try {
    validateLoadedRepositoryInterviewSpecification(specification);
    if (
      prompt.rendererVersion !== specification.manifest.rendererVersion ||
      prompt.specificationVersion !==
        specification.manifest.specificationVersion ||
      prompt.specificationDigest !==
        specification.manifest.specificationDigest ||
      prompt.instructionText !==
        repositoryInterviewInstructionText(specification) ||
      prompt.promptDigest !==
        repositoryInterviewPromptDigest({
          rendererVersion: prompt.rendererVersion,
          specificationVersion: prompt.specificationVersion,
          specificationDigest: prompt.specificationDigest,
          instructionText: prompt.instructionText,
          evidenceText: prompt.evidenceText,
        }) ||
      prompt.instructionUtf8Bytes !==
        Buffer.byteLength(prompt.instructionText, 'utf8') ||
      prompt.evidenceUtf8Bytes !==
        Buffer.byteLength(prompt.evidenceText, 'utf8') ||
      prompt.instructionUtf8Bytes >
        REPOSITORY_INTERVIEW_PROMPT_BOUNDS.maximumInstructionUtf8Bytes ||
      prompt.evidenceUtf8Bytes >
        REPOSITORY_INTERVIEW_PROMPT_BOUNDS.maximumEvidenceUtf8Bytes ||
      prompt.instructionUtf8Bytes + prompt.evidenceUtf8Bytes >
        REPOSITORY_INTERVIEW_PROMPT_BOUNDS.maximumCombinedUtf8Bytes ||
      prompt.artifactUtf8Bytes >
        REPOSITORY_INTERVIEW_PROMPT_BOUNDS.maximumArtifactUtf8Bytes ||
      prompt.totalLogicalLines >
        REPOSITORY_INTERVIEW_PROMPT_BOUNDS.maximumLogicalLines ||
      prompt.aliasBindings.length >
        REPOSITORY_INTERVIEW_PROMPT_BOUNDS.maximumArtifacts
    ) {
      return false;
    }
    const evidence = JSON.parse(prompt.evidenceText) as unknown;
    if (
      !hasExactKeys(evidence, ['artifacts', 'kind', 'unavailableSelections']) ||
      evidence['kind'] !== 'repository-interview-evidence-v1' ||
      !Array.isArray(evidence['artifacts']) ||
      !Array.isArray(evidence['unavailableSelections'])
    ) {
      return false;
    }
    const evidenceArtifacts = evidence['artifacts'] as readonly unknown[];
    if (evidenceArtifacts.length !== prompt.aliasBindings.length) {
      return false;
    }
    let totalLogicalLines = 0;
    for (const [index, binding] of prompt.aliasBindings.entries()) {
      const expectedAlias = `A${String(index + 1)}`;
      const evidenceArtifact = evidenceArtifacts[index];
      if (
        binding.alias !== expectedAlias ||
        !/^artifact-[0-9a-f]{48}$/u.test(binding.artifactId) ||
        binding.artifactSetEntryOrdinal < 0 ||
        binding.artifactSetEntryOrdinal > 3 ||
        !isArtifactKind(binding.artifactKind) ||
        binding.lineCount < 1 ||
        binding.lineCount > 10_000 ||
        !hasExactKeys(evidenceArtifact, [
          'alias',
          'artifactKind',
          'lineCount',
          'lines',
        ]) ||
        evidenceArtifact['alias'] !== binding.alias ||
        evidenceArtifact['artifactKind'] !== binding.artifactKind ||
        evidenceArtifact['lineCount'] !== binding.lineCount ||
        !Array.isArray(evidenceArtifact['lines']) ||
        evidenceArtifact['lines'].length !== binding.lineCount
      ) {
        return false;
      }
      for (const [lineIndex, line] of evidenceArtifact['lines'].entries()) {
        if (
          !hasExactKeys(line, ['number', 'text']) ||
          line['number'] !== lineIndex + 1 ||
          typeof line['text'] !== 'string' ||
          !isExactLogicalLineText(line['text'])
        ) {
          return false;
        }
      }
      totalLogicalLines += binding.lineCount;
    }
    const selectionOrdinals = prompt.aliasBindings.map(
      ({ artifactSetEntryOrdinal }) => artifactSetEntryOrdinal,
    );
    let previousUnavailableOrdinal = -1;
    for (const unavailable of evidence['unavailableSelections']) {
      if (
        !hasExactKeys(unavailable, [
          'artifactKind',
          'outcome',
          'requirement',
          'selectionOrdinal',
          'selector',
        ]) ||
        unavailable['outcome'] !== 'not-found' ||
        typeof unavailable['selectionOrdinal'] !== 'number' ||
        !Number.isInteger(unavailable['selectionOrdinal']) ||
        unavailable['selectionOrdinal'] < 0 ||
        unavailable['selectionOrdinal'] > 3 ||
        unavailable['selectionOrdinal'] <= previousUnavailableOrdinal ||
        (unavailable['selector'] !== 'root-readme' &&
          unavailable['selector'] !== 'path') ||
        !isArtifactKind(unavailable['artifactKind']) ||
        unavailable['requirement'] !== 'optional'
      ) {
        return false;
      }
      previousUnavailableOrdinal = unavailable['selectionOrdinal'];
      selectionOrdinals.push(unavailable['selectionOrdinal']);
    }
    selectionOrdinals.sort((left, right) => left - right);
    if (
      totalLogicalLines !== prompt.totalLogicalLines ||
      selectionOrdinals.some((ordinal, index) => ordinal !== index)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function collectProviderCitations(
  value: RepositoryInterviewProviderOutputV1,
): readonly ProviderCitationEntry[] {
  return [
    ...value.documentedPositions.flatMap((item, itemIndex) =>
      citationEntries(
        item.citations,
        `/documentedPositions/${String(itemIndex)}/citations`,
      ),
    ),
    ...value.inferences.flatMap((item, itemIndex) =>
      citationEntries(
        item.citations,
        `/inferences/${String(itemIndex)}/citations`,
      ),
    ),
    ...value.limitations.flatMap((item, itemIndex) =>
      citationEntries(
        item.citations,
        `/limitations/${String(itemIndex)}/citations`,
      ),
    ),
    ...value.contradictions.flatMap((item, itemIndex) => [
      ...citationEntries(
        item.positionA.citations,
        `/contradictions/${String(itemIndex)}/positionA/citations`,
      ),
      ...citationEntries(
        item.positionB.citations,
        `/contradictions/${String(itemIndex)}/positionB/citations`,
      ),
    ]),
    ...value.unknowns.flatMap((item, itemIndex) =>
      citationEntries(
        item.partialCitations,
        `/unknowns/${String(itemIndex)}/partialCitations`,
      ),
    ),
  ];
}

function citationEntries(
  citations: readonly ProviderCitationV1[],
  path: string,
): readonly ProviderCitationEntry[] {
  return citations.map((citation, citationIndex) => ({
    citation,
    path: `${path}/${String(citationIndex)}`,
  }));
}

function compareResolvedCitations(
  left: ResolvedCitationEntry,
  right: ResolvedCitationEntry,
): number {
  return (
    left.binding.artifactSetEntryOrdinal -
      right.binding.artifactSetEntryOrdinal ||
    left.coordinate.startLine - right.coordinate.startLine ||
    left.coordinate.endLine - right.coordinate.endLine ||
    compareText(left.coordinate.artifactId, right.coordinate.artifactId)
  );
}

function coordinateKey(value: RepositoryInterviewCitationInputV1): string {
  return `${value.artifactId}:${String(value.startLine)}:${String(value.endLine)}`;
}

function failure(
  issues: readonly RepositoryInterviewMappingIssue[],
  diagnosticCode?: RepositoryInterviewProviderOutputDiagnosticCode,
): {
  readonly ok: false;
  readonly diagnosticCode: RepositoryInterviewProviderOutputDiagnosticCode;
  readonly issues: readonly RepositoryInterviewMappingIssue[];
} {
  const finalized = finalizeRepositoryInterviewMappingIssues(issues);
  return {
    ok: false,
    diagnosticCode:
      diagnosticCode ??
      primaryRepositoryInterviewMappingDiagnosticCode(finalized),
    issues: finalized,
  };
}

function isPlainRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(
  value: unknown,
  expected: readonly string[],
): value is Readonly<Record<string, unknown>> {
  if (!isPlainRecord(value)) {
    return false;
  }
  const actual = Object.keys(value).sort(compareText);
  const sortedExpected = [...expected].sort(compareText);
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function isExactLogicalLineText(value: string): boolean {
  if (value.includes('\r') || value.includes('\n')) {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const low = value.charCodeAt(index + 1);
      if (!Number.isInteger(low) || low < 0xdc00 || low > 0xdfff) {
        return false;
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function isArtifactKind(value: unknown): boolean {
  return (
    value === 'readme' ||
    value === 'contributing' ||
    value === 'security-policy' ||
    value === 'changelog' ||
    value === 'documentation' ||
    value === 'license'
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
