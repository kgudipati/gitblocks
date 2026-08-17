import { createHash } from 'node:crypto';

import {
  repositoryArtifactDisplayUrl,
  splitRepositoryArtifactLogicalLines,
  type CandidateDossierV1,
  type CapabilityQueryInputV1,
  type CapabilityQueryNormalizationResultV1,
  type CapabilityRetrievalExpansionV1,
  type EvidenceObservationV1,
  type RecommendationRetrievalFinalistV1,
  type RepositoryArtifactChunkV1,
  type RepositoryArtifactSetV1,
  type RepositoryArtifactV1,
} from '@gitblocks/contracts';
import { expandRetrievalTermsV1 } from '@gitblocks/retrieval';

export const MAX_ARTIFACT_EVIDENCE_PER_EVALUATION = 2;
export const MAX_ARTIFACT_EVIDENCE_PER_CANDIDATE = 8;
export const MAX_ARTIFACT_EVIDENCE_PER_RECOMMENDATION = 32;

const MAX_DOSSIER_OBSERVATIONS = 100;
const MAX_RENDERED_EXCERPT_CODE_UNITS = 1_800;
const MAX_APPROVED_TERMS_PER_EVALUATION = 40;
const ARTIFACT_EXCERPT_LIMITATION =
  'Whitespace is normalized from exact immutable repository lines; the linked commit and line range remain authoritative.';
const MARKDOWN_REFERENCE_DEFINITION =
  /^\[[^[\]\r\n]{1,200}\]: (?:<[^<>\s]+>|\S+)(?: (?:"[^"\r\n]*"|'[^'\r\n]*'|\([^()\r\n]*\)))?$/u;
const PURE_MARKDOWN_LINK_OR_IMAGE_LINE =
  /^(?:(?:[-*+]|\d{1,3}[.)]) )?(?:(?:\[!\[[^\]\r\n]*\]\([^\r\n)]*\)\]\([^\r\n)]*\)|!?\[[^\]\r\n]+\](?:\([^\r\n)]*\)|\[[^\]\r\n]*\])?)(?: )?)+$/u;
const LICENSE_OR_BOILERPLATE =
  /\b(?:all rights reserved|copyright|governing permissions and limitations|licensed? under|permission is hereby granted|spdx-license-identifier|terms and conditions|without warrant(?:y|ies))\b/iu;
const DEFINING_STATEMENT_FORM =
  /\b(?:allows?|blocks?|built-in|comes? with|defaults? to|ensures?|includes?|is|offers?|prevents?|provides?|requires?|strategy|supports?|uses?|works? with)\b|\bapi\b/iu;

const PROHIBITION_ALTERNATIVE_EVIDENCE_TERMS: Readonly<
  Record<string, readonly string[]>
> = Object.freeze({
  redis: Object.freeze([
    'built-in memory store',
    'file-based policy',
    'in-memory store',
    'memory limiter',
    'policy file',
    'postgresql',
    'prisma',
    'sqlite',
  ]),
  'external-hosted-service': Object.freeze([
    'on-prem',
    'on premises',
    'run locally',
    'self hosted',
    'self-hosted',
  ]),
  'separate-control-plane': Object.freeze([
    'application process',
    'built-in',
    'embedded',
    'in-process',
    'local library',
  ]),
});

export interface LoadedCandidateRepositoryArtifactV1 {
  readonly artifact: RepositoryArtifactV1;
  readonly chunks: readonly RepositoryArtifactChunkV1[];
}

export interface CandidateRepositoryArtifactMaterialV1 {
  readonly artifactSet: RepositoryArtifactSetV1;
  readonly artifacts: readonly LoadedCandidateRepositoryArtifactV1[];
}

export interface CandidateArtifactMaterialLoaderPort {
  readonly loadCandidateRepositoryArtifactMaterial: (input: {
    readonly candidateId: string;
    readonly expectedCatalogVersion: 'public-v1';
    readonly expectedCatalogDigest: string;
    readonly commitSha: string;
    readonly evidenceCutoff: string;
  }) => Promise<CandidateRepositoryArtifactMaterialV1 | null>;
}

interface ApprovedTerm {
  readonly value: string;
  readonly precedence: 0 | 1;
  readonly specificity: 0 | 1 | 2 | 3;
  readonly searchKind: 'evaluation' | 'prohibition-alternative';
}

interface MatchingLine {
  readonly artifact: RepositoryArtifactV1;
  readonly chunk: RepositoryArtifactChunkV1;
  readonly entryOrdinal: number;
  readonly lineNumber: number;
  readonly normalizedExcerpt: string;
  readonly boilerplatePenalty: 0 | 1;
  readonly specificityPenalty: 0 | 1 | 2 | 3;
  readonly definingStatementPenalty: 0 | 1;
  readonly markdownContextPenalty: 0 | 1 | 2 | 3;
  readonly termPrecedence: 0 | 1;
  readonly matchOffset: number;
  readonly matchedTerm: string;
  readonly matchesEvaluationTerm: boolean;
  readonly matchesProhibitionAlternative: boolean;
}

export function selectCandidateArtifactEvidenceV1(input: {
  readonly finalist: RecommendationRetrievalFinalistV1;
  readonly dossier: CandidateDossierV1;
  readonly capabilityQuery: CapabilityQueryInputV1;
  readonly normalization: CapabilityQueryNormalizationResultV1;
  readonly retrievalExpansionAuthority: CapabilityRetrievalExpansionV1;
  readonly material: CandidateRepositoryArtifactMaterialV1;
  readonly maximumObservations: number;
}): readonly EvidenceObservationV1[] {
  if (
    input.finalist.lane !== 'evidence-needed' ||
    input.finalist.candidateId !== input.dossier.identity.candidateId ||
    input.normalization.outcome !== 'normalized'
  ) {
    return Object.freeze([]);
  }
  const head = usableRepositoryHead(input.dossier);
  if (
    head === null ||
    !materialMatchesHead(input.material, input.finalist.candidateId, head)
  ) {
    return Object.freeze([]);
  }
  const requestedCapacity = Number.isInteger(input.maximumObservations)
    ? input.maximumObservations
    : 0;
  const capacity = Math.max(
    0,
    Math.min(
      MAX_ARTIFACT_EVIDENCE_PER_CANDIDATE,
      requestedCapacity,
      MAX_DOSSIER_OBSERVATIONS - input.dossier.observations.length,
    ),
  );
  if (capacity === 0) return Object.freeze([]);

  const observations: EvidenceObservationV1[] = [];
  const suppliedEvidenceIds = new Set(
    input.dossier.observations.map(({ evidenceId }) => evidenceId),
  );
  for (const evaluation of input.finalist.unresolvedHardEvaluations) {
    if (observations.length >= capacity) break;
    const terms = approvedTermsForEvaluation({
      evaluation,
      capabilityQuery: input.capabilityQuery,
      normalization: input.normalization,
      retrievalExpansionAuthority: input.retrievalExpansionAuthority,
    });
    if (terms.length === 0) continue;
    let selectedForEvaluation = 0;
    const matches = matchingLines(input.material, terms);
    const orderedMatches =
      evaluation.modality === 'prohibited'
        ? balanceProhibitionEvidence(matches)
        : matches;
    for (const match of orderedMatches) {
      if (
        observations.length >= capacity ||
        selectedForEvaluation >= MAX_ARTIFACT_EVIDENCE_PER_EVALUATION
      ) {
        break;
      }
      const evidence = evidenceFromMatch(
        input.finalist.candidateId,
        evaluation.facet,
        head,
        input.material.artifactSet.commitObjectId,
        match,
      );
      selectedForEvaluation += 1;
      if (suppliedEvidenceIds.has(evidence.evidenceId)) continue;
      suppliedEvidenceIds.add(evidence.evidenceId);
      observations.push(evidence);
    }
  }
  return Object.freeze(observations);
}

function usableRepositoryHead(
  dossier: CandidateDossierV1,
): Extract<
  CandidateDossierV1['observations'][number]['source'],
  { kind: 'git-commit' }
> | null {
  const heads = dossier.observations.filter(
    ({ topic }) => topic === 'repository-head',
  );
  if (heads.length !== 1) return null;
  const source = heads[0]?.source;
  return source?.kind === 'git-commit' &&
    source.sourceType === 'official-repository'
    ? source
    : null;
}

function materialMatchesHead(
  material: CandidateRepositoryArtifactMaterialV1,
  candidateId: string,
  head: Extract<
    CandidateDossierV1['observations'][number]['source'],
    { kind: 'git-commit' }
  >,
): boolean {
  const { artifactSet } = material;
  if (
    artifactSet.candidateId !== candidateId ||
    artifactSet.commitObjectId !== head.commitSha ||
    material.artifacts.length > 4
  ) {
    return false;
  }
  const artifactsById = new Map(
    material.artifacts.map((loaded) => [loaded.artifact.artifactId, loaded]),
  );
  const presentEntries = artifactSet.entries.filter(
    ({ outcome }) => outcome === 'present',
  );
  if (presentEntries.length !== material.artifacts.length) return false;
  return presentEntries.every((entry) => {
    if (entry.outcome !== 'present') return false;
    const loaded = artifactsById.get(entry.artifactId);
    if (loaded === undefined) return false;
    const expectedDisplayUrl = repositoryArtifactDisplayUrl({
      providerOwner: loaded.artifact.firstMaterialization.providerOwner,
      providerRepository:
        loaded.artifact.firstMaterialization.providerRepository,
      commitObjectId: loaded.artifact.commitObjectId,
      path: loaded.artifact.path,
    });
    return (
      loaded.artifact.candidateId === candidateId &&
      loaded.artifact.commitObjectId === head.commitSha &&
      loaded.artifact.path === entry.resolvedPath &&
      loaded.artifact.displayUrl === expectedDisplayUrl &&
      loaded.chunks.length >= 1 &&
      loaded.chunks.length <= 64 &&
      loaded.chunks.every(
        (chunk, ordinal) =>
          chunk.candidateId === candidateId &&
          chunk.artifactId === loaded.artifact.artifactId &&
          chunk.ordinal === ordinal,
      )
    );
  });
}

function approvedTermsForEvaluation(input: {
  readonly evaluation: RecommendationRetrievalFinalistV1['unresolvedHardEvaluations'][number];
  readonly capabilityQuery: CapabilityQueryInputV1;
  readonly normalization: CapabilityQueryNormalizationResultV1;
  readonly retrievalExpansionAuthority: CapabilityRetrievalExpansionV1;
}): readonly ApprovedTerm[] {
  const primary: string[] = [];
  const { evaluation } = input;
  if (evaluation.conceptId !== null) primary.push(evaluation.conceptId);

  if (evaluation.sourceKind === 'normalized-constraint') {
    const normalized = input.normalization.normalizedConstraints.find(
      ({ normalizedConstraintId }) =>
        normalizedConstraintId === evaluation.evaluationId,
    );
    if (
      normalized?.modality !== evaluation.modality ||
      normalized.facet !== evaluation.facet ||
      normalized.conceptId !== evaluation.conceptId
    ) {
      return Object.freeze([]);
    }
    if (normalized.canonicalTerm !== null) {
      primary.push(normalized.canonicalTerm);
    }
    const sourceIds = new Set(normalized.sourceConstraintIds);
    primary.push(
      ...input.capabilityQuery.draftConstraints
        .filter(({ constraintId }) => sourceIds.has(constraintId))
        .map(({ originalTerm }) => originalTerm),
    );
  } else if (evaluation.sourceKind === 'preserved-declaration') {
    const declaration = input.normalization.preservedDeclarations.find(
      ({ constraintId }) => constraintId === evaluation.evaluationId,
    );
    if (
      declaration?.modality !== evaluation.modality ||
      declaration.facet !== evaluation.facet ||
      evaluation.conceptId !== null
    ) {
      return Object.freeze([]);
    }
    primary.push(declaration.originalTerm);
  } else if (
    evaluation.evaluationId === 'primary-capability-family' &&
    evaluation.conceptId === input.normalization.primaryFamilyId
  ) {
    primary.push(
      ...input.capabilityQuery.capabilityTerms.map(
        ({ originalTerm }) => originalTerm,
      ),
    );
  } else {
    return Object.freeze([]);
  }

  const primaryTerms = uniqueTerms(primary).map((value) => ({
    value,
    precedence: 0 as const,
    specificity: 0 as const,
    searchKind: 'evaluation' as const,
  }));
  const expansion =
    evaluation.conceptId === null
      ? null
      : expandRetrievalTermsV1(
          [evaluation.conceptId],
          input.retrievalExpansionAuthority,
        );
  const primaryKeys = new Set(primaryTerms.map(({ value }) => lower(value)));
  const expansionTerms = (expansion?.edgesApplied ?? [])
    .filter(({ targetTerm }) => !primaryKeys.has(lower(targetTerm)))
    .map(({ relationshipKind, targetTerm }) => ({
      value: targetTerm,
      precedence: 1 as const,
      specificity:
        relationshipKind === 'taxonomy-alias' ? (1 as const) : (3 as const),
      searchKind: 'evaluation' as const,
    }));
  const usedKeys = new Set(
    [...primaryTerms, ...expansionTerms].map(({ value }) => lower(value)),
  );
  const alternativeTerms =
    evaluation.modality === 'prohibited' && evaluation.conceptId !== null
      ? uniqueTerms(
          PROHIBITION_ALTERNATIVE_EVIDENCE_TERMS[evaluation.conceptId] ?? [],
        )
          .filter((value) => !usedKeys.has(lower(value)))
          .map((value) => ({
            value,
            precedence: 1 as const,
            specificity: 2 as const,
            searchKind: 'prohibition-alternative' as const,
          }))
      : [];
  return Object.freeze(
    [...primaryTerms, ...expansionTerms, ...alternativeTerms].slice(
      0,
      MAX_APPROVED_TERMS_PER_EVALUATION,
    ),
  );
}

function matchingLines(
  material: CandidateRepositoryArtifactMaterialV1,
  terms: readonly ApprovedTerm[],
): readonly MatchingLine[] {
  const artifactsById = new Map(
    material.artifacts.map((loaded) => [loaded.artifact.artifactId, loaded]),
  );
  const matches: MatchingLine[] = [];
  for (const entry of material.artifactSet.entries) {
    if (
      entry.outcome !== 'present' ||
      (entry.artifactKind !== 'readme' &&
        entry.artifactKind !== 'documentation')
    ) {
      continue;
    }
    const loaded = artifactsById.get(entry.artifactId);
    if (loaded === undefined) continue;
    let markdownFence: MarkdownFence | null = null;
    for (const chunk of loaded.chunks) {
      const lines = splitRepositoryArtifactLogicalLines(chunk.content);
      for (const [index, exactLine] of lines.entries()) {
        const fenceDelimiter = markdownFenceDelimiter(exactLine);
        const insideMarkdownFence =
          markdownFence !== null || fenceDelimiter !== null;
        markdownFence = advanceMarkdownFence(markdownFence, fenceDelimiter);
        const normalizedExcerpt = normalizeExcerpt(exactLine);
        if (
          normalizedExcerpt === null ||
          !isArtifactEvidenceLineEligible(normalizedExcerpt)
        ) {
          continue;
        }
        const normalizedMatchLine = lower(normalizedExcerpt);
        let best:
          | {
              readonly term: ApprovedTerm;
              readonly matchOffset: number;
              readonly markdownContextPenalty: 0 | 1 | 2 | 3;
            }
          | undefined;
        let matchesEvaluationTerm = false;
        let matchesProhibitionAlternative = false;
        for (const term of terms) {
          const normalizedTerm = lower(term.value);
          let searchOffset = 0;
          for (;;) {
            const matchOffset = normalizedMatchLine.indexOf(
              normalizedTerm,
              searchOffset,
            );
            if (matchOffset < 0) break;
            if (term.searchKind === 'evaluation') matchesEvaluationTerm = true;
            else matchesProhibitionAlternative = true;
            const markdownContextPenalty = insideMarkdownFence
              ? 1
              : markdownMatchContextPenalty(
                  normalizedExcerpt,
                  matchOffset,
                  normalizedTerm.length,
                );
            if (
              best === undefined ||
              term.specificity < best.term.specificity ||
              (term.specificity === best.term.specificity &&
                (markdownContextPenalty < best.markdownContextPenalty ||
                  (markdownContextPenalty === best.markdownContextPenalty &&
                    (term.precedence < best.term.precedence ||
                      (term.precedence === best.term.precedence &&
                        (matchOffset < best.matchOffset ||
                          (matchOffset === best.matchOffset &&
                            compareAscii(term.value, best.term.value) < 0)))))))
            ) {
              best = { term, matchOffset, markdownContextPenalty };
            }
            searchOffset = matchOffset + Math.max(1, normalizedTerm.length);
          }
        }
        if (best === undefined) continue;
        const canonicalMatchLine = normalizedMatchLine.replace(/[-_]+/gu, ' ');
        const namesCanonicalConcept = terms.some(
          ({ precedence, searchKind, value }) =>
            precedence === 0 &&
            searchKind === 'evaluation' &&
            canonicalMatchLine.includes(lower(value).replace(/[-_]+/gu, ' ')),
        );
        matches.push({
          artifact: loaded.artifact,
          chunk,
          entryOrdinal: entry.ordinal,
          lineNumber: chunk.startLine + index,
          normalizedExcerpt,
          boilerplatePenalty: LICENSE_OR_BOILERPLATE.test(normalizedExcerpt)
            ? 1
            : 0,
          specificityPenalty: namesCanonicalConcept ? 0 : best.term.specificity,
          definingStatementPenalty: isDefiningStatement(normalizedExcerpt)
            ? 0
            : 1,
          markdownContextPenalty: best.markdownContextPenalty,
          termPrecedence: best.term.precedence,
          matchOffset: best.matchOffset,
          matchedTerm: best.term.value,
          matchesEvaluationTerm,
          matchesProhibitionAlternative,
        });
      }
    }
  }
  matches.sort(compareMatchingLines);
  return matches;
}

function compareMatchingLines(left: MatchingLine, right: MatchingLine): number {
  return (
    left.boilerplatePenalty - right.boilerplatePenalty ||
    left.specificityPenalty - right.specificityPenalty ||
    left.definingStatementPenalty - right.definingStatementPenalty ||
    left.markdownContextPenalty - right.markdownContextPenalty ||
    left.termPrecedence - right.termPrecedence ||
    left.entryOrdinal - right.entryOrdinal ||
    left.chunk.ordinal - right.chunk.ordinal ||
    left.lineNumber - right.lineNumber ||
    left.matchOffset - right.matchOffset ||
    compareAscii(left.matchedTerm, right.matchedTerm) ||
    compareAscii(left.artifact.artifactId, right.artifact.artifactId) ||
    compareAscii(left.chunk.chunkId, right.chunk.chunkId)
  );
}

function balanceProhibitionEvidence(
  matches: readonly MatchingLine[],
): readonly MatchingLine[] {
  const firstEvaluation = matches.find(
    ({ matchesEvaluationTerm }) => matchesEvaluationTerm,
  );
  const firstAlternative = matches.find(
    ({ matchesProhibitionAlternative }) => matchesProhibitionAlternative,
  );
  if (
    firstEvaluation === undefined ||
    firstAlternative === undefined ||
    firstEvaluation === firstAlternative
  ) {
    return matches;
  }
  const priority = [firstEvaluation, firstAlternative].sort(
    (left, right) => matches.indexOf(left) - matches.indexOf(right),
  );
  const prioritySet = new Set(priority);
  return [...priority, ...matches.filter((match) => !prioritySet.has(match))];
}

function evidenceFromMatch(
  candidateId: string,
  facet: RecommendationRetrievalFinalistV1['unresolvedHardEvaluations'][number]['facet'],
  head: Extract<
    CandidateDossierV1['observations'][number]['source'],
    { kind: 'git-commit' }
  >,
  commitSha: string,
  match: MatchingLine,
): EvidenceObservationV1 {
  const derivedDisplayUrl = repositoryArtifactDisplayUrl({
    providerOwner: match.artifact.firstMaterialization.providerOwner,
    providerRepository: match.artifact.firstMaterialization.providerRepository,
    commitObjectId: commitSha,
    path: match.artifact.path,
  });
  const lineFragment = `#L${String(match.lineNumber)}`;
  const immutableUrl = `${derivedDisplayUrl}${lineFragment}`;
  const evidenceDigest = createHash('sha256')
    .update(
      JSON.stringify([
        candidateId,
        match.artifact.artifactId,
        match.chunk.chunkId,
        commitSha,
        match.artifact.path,
        match.lineNumber,
        match.lineNumber,
        match.normalizedExcerpt,
      ]),
      'utf8',
    )
    .digest('hex');
  return Object.freeze({
    kind: 'evidence',
    evidenceId: `artifact-evidence-${evidenceDigest.slice(0, 40)}`,
    candidateId,
    topic: 'artifact-excerpt',
    dimension: evidenceDimension(facet),
    observation: match.normalizedExcerpt,
    source: Object.freeze({
      kind: 'git-commit',
      sourceType: 'official-repository',
      sourceUrl: immutableUrl,
      commitSha,
      immutableUrl,
      publishedAt: head.publishedAt,
      collectedAt: match.artifact.firstMaterialization.collectedAt,
    }),
    freshness: Object.freeze({
      status: 'current',
      asOf: match.artifact.firstMaterialization.collectedAt,
      scope: 'Exact immutable repository lines at the active repository head.',
    }),
    directness: 'direct',
    limitation: ARTIFACT_EXCERPT_LIMITATION,
  });
}

function normalizeExcerpt(exactLine: string): string | null {
  const normalized = exactLine.replace(/\s+/gu, ' ').trim();
  return normalized.length > 0 &&
    normalized.length <= MAX_RENDERED_EXCERPT_CODE_UNITS &&
    !containsControlCodeUnit(normalized)
    ? normalized
    : null;
}

interface MarkdownFence {
  readonly marker: '`' | '~';
  readonly length: number;
}

function markdownFenceDelimiter(exactLine: string): MarkdownFence | null {
  const match = /^ {0,3}(?<fence>`{3,}|~{3,})/u.exec(exactLine);
  const fence = match?.groups?.['fence'];
  if (fence === undefined) return null;
  const marker = fence[0];
  return marker === '`' || marker === '~'
    ? { marker, length: fence.length }
    : null;
}

function advanceMarkdownFence(
  current: MarkdownFence | null,
  delimiter: MarkdownFence | null,
): MarkdownFence | null {
  if (delimiter === null) return current;
  if (current === null) return delimiter;
  return delimiter.marker === current.marker &&
    delimiter.length >= current.length
    ? null
    : current;
}

function markdownMatchContextPenalty(
  line: string,
  matchOffset: number,
  matchLength: number,
): 0 | 2 | 3 {
  const matchEnd = matchOffset + matchLength;
  for (const pattern of [
    /!?\[(?<label>[^\]\r\n]*)\]\((?<target>[^)\r\n]*)\)/gu,
    /!?\[(?<label>[^\]\r\n]*)\]\[(?<target>[^\]\r\n]*)\]/gu,
  ]) {
    for (const markdownMatch of line.matchAll(pattern)) {
      const full = markdownMatch[0];
      const fullOffset = markdownMatch.index;
      const label = markdownMatch.groups?.['label'];
      const target = markdownMatch.groups?.['target'];
      if (label === undefined || target === undefined) {
        continue;
      }
      const labelRelativeOffset = full.indexOf(label);
      const targetRelativeOffset = full.lastIndexOf(target);
      const labelStart = fullOffset + labelRelativeOffset;
      const labelEnd = labelStart + label.length;
      const targetStart = fullOffset + targetRelativeOffset;
      const targetEnd = targetStart + target.length;
      if (matchOffset >= targetStart && matchEnd <= targetEnd) return 3;
      if (matchOffset >= labelStart && matchEnd <= labelEnd) return 2;
    }
  }
  return 0;
}

function isDefiningStatement(value: string): boolean {
  return (
    DEFINING_STATEMENT_FORM.test(value) ||
    /(?:^|\s)[^\s]{1,80}(?::|=)(?:\s|$)/u.test(value)
  );
}

function isArtifactEvidenceLineEligible(value: string): boolean {
  return (
    !MARKDOWN_REFERENCE_DEFINITION.test(value) &&
    !PURE_MARKDOWN_LINK_OR_IMAGE_LINE.test(value)
  );
}

function containsControlCodeUnit(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x1f || (codeUnit >= 0x7f && codeUnit <= 0x9f)) {
      return true;
    }
  }
  return false;
}

function uniqueTerms(values: readonly string[]): readonly string[] {
  const byNormalized = new Map<string, string>();
  for (const value of values) {
    const normalized = value.trim();
    if (normalized.length === 0) continue;
    const key = lower(normalized);
    const existing = byNormalized.get(key);
    if (existing === undefined || compareAscii(normalized, existing) < 0) {
      byNormalized.set(key, normalized);
    }
  }
  return [...byNormalized.values()].sort(compareAscii);
}

function lower(value: string): string {
  return value.toLowerCase();
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function evidenceDimension(
  facet: RecommendationRetrievalFinalistV1['unresolvedHardEvaluations'][number]['facet'],
): EvidenceObservationV1['dimension'] {
  switch (facet) {
    case 'architecture':
    case 'deployment':
      return 'deployment';
    case 'infrastructure':
    case 'datastore':
      return 'data-store';
    case 'runtime':
    case 'framework':
      return 'runtime-framework';
    case 'license':
      return 'license';
    case 'repository-state':
    case 'maintenance':
      return 'maintenance';
    case 'release':
      return 'version-release';
    case 'security':
      return 'security';
    case 'capability':
    case 'feature':
    case 'ecosystem':
    case 'other':
      return 'integration';
  }
}
