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
}

interface MatchingLine {
  readonly artifact: RepositoryArtifactV1;
  readonly chunk: RepositoryArtifactChunkV1;
  readonly entryOrdinal: number;
  readonly lineNumber: number;
  readonly normalizedExcerpt: string;
  readonly termPrecedence: 0 | 1;
  readonly matchOffset: number;
  readonly matchedTerm: string;
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
    for (const match of matchingLines(input.material, terms)) {
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
  }));
  const expansions =
    evaluation.conceptId === null
      ? []
      : expandRetrievalTermsV1(
          [evaluation.conceptId],
          input.retrievalExpansionAuthority,
        ).expandedTerms;
  const primaryKeys = new Set(primaryTerms.map(({ value }) => lower(value)));
  const expansionTerms = uniqueTerms(expansions)
    .filter((value) => !primaryKeys.has(lower(value)))
    .map((value) => ({ value, precedence: 1 as const }));
  return Object.freeze(
    [...primaryTerms, ...expansionTerms].slice(
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
    for (const chunk of loaded.chunks) {
      const lines = splitRepositoryArtifactLogicalLines(chunk.content);
      for (const [index, exactLine] of lines.entries()) {
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
            }
          | undefined;
        for (const term of terms) {
          const matchOffset = normalizedMatchLine.indexOf(lower(term.value));
          if (
            matchOffset >= 0 &&
            (best === undefined ||
              term.precedence < best.term.precedence ||
              (term.precedence === best.term.precedence &&
                (matchOffset < best.matchOffset ||
                  (matchOffset === best.matchOffset &&
                    compareAscii(term.value, best.term.value) < 0))))
          ) {
            best = { term, matchOffset };
          }
        }
        if (best === undefined) continue;
        matches.push({
          artifact: loaded.artifact,
          chunk,
          entryOrdinal: entry.ordinal,
          lineNumber: chunk.startLine + index,
          normalizedExcerpt,
          termPrecedence: best.term.precedence,
          matchOffset: best.matchOffset,
          matchedTerm: best.term.value,
        });
      }
    }
  }
  matches.sort(
    (left, right) =>
      left.termPrecedence - right.termPrecedence ||
      left.entryOrdinal - right.entryOrdinal ||
      left.chunk.ordinal - right.chunk.ordinal ||
      left.lineNumber - right.lineNumber ||
      left.matchOffset - right.matchOffset ||
      compareAscii(left.matchedTerm, right.matchedTerm) ||
      compareAscii(left.artifact.artifactId, right.artifact.artifactId) ||
      compareAscii(left.chunk.chunkId, right.chunk.chunkId),
  );
  return matches;
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
