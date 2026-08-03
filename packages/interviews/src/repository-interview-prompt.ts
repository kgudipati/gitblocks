import {
  parseRepositoryArtifactSetV1,
  parseRepositoryArtifactV1,
  splitRepositoryArtifactLogicalLines,
  type RepositoryArtifactSetEntryV1,
  type RepositoryArtifactSetV1,
  type RepositoryArtifactV1,
} from '@gitblocks/contracts';

import { canonicalizeJson, sha256Digest } from './canonical-json.ts';
import {
  finalizeRepositoryInterviewMappingIssues,
  repositoryInterviewMappingIssue,
  type RepositoryInterviewMappingIssue,
} from './repository-interview-mapping-issues.ts';
import { copyBoundedPlainArray } from './owned-array.ts';
import {
  validateLoadedRepositoryInterviewSpecification,
  type LoadedRepositoryInterviewSpecification,
} from './specification.ts';

export const REPOSITORY_INTERVIEW_PROMPT_BOUNDS = Object.freeze({
  maximumArtifacts: 4,
  maximumArtifactUtf8Bytes: 524_288,
  maximumLogicalLines: 40_000,
  maximumInstructionUtf8Bytes: 65_536,
  maximumEvidenceUtf8Bytes: 4_194_304,
  maximumCombinedUtf8Bytes: 4_259_840,
} as const);

export type RepositoryInterviewArtifactAlias = 'A1' | 'A2' | 'A3' | 'A4';

export interface RepositoryInterviewArtifactAliasBinding {
  readonly alias: RepositoryInterviewArtifactAlias;
  readonly artifactId: string;
  readonly artifactKind: RepositoryArtifactSetEntryV1['artifactKind'];
  readonly artifactSetEntryOrdinal: number;
  readonly lineCount: number;
}

export interface RenderedRepositoryInterviewPromptV1 {
  readonly candidateId: string;
  readonly artifactSetId: string;
  readonly artifactSetIdentityDigest: string;
  readonly rendererVersion: string;
  readonly specificationVersion: string;
  readonly specificationDigest: string;
  readonly instructionText: string;
  readonly evidenceText: string;
  readonly promptDigest: string;
  readonly aliasBindings: readonly RepositoryInterviewArtifactAliasBinding[];
  readonly instructionUtf8Bytes: number;
  readonly evidenceUtf8Bytes: number;
  readonly artifactUtf8Bytes: number;
  readonly totalLogicalLines: number;
}

export interface RenderRepositoryInterviewPromptInputV1 {
  readonly artifactSet: unknown;
  readonly artifacts: unknown;
  readonly specification: LoadedRepositoryInterviewSpecification;
}

export type RenderRepositoryInterviewPromptResultV1 =
  | {
      readonly ok: true;
      readonly value: RenderedRepositoryInterviewPromptV1;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly issues: readonly RepositoryInterviewMappingIssue[];
    };

const validatedRenderedPrompts = new WeakSet<object>();

interface ValidatedArtifactContext {
  readonly artifactSet: RepositoryArtifactSetV1;
  readonly present: readonly {
    readonly entry: Extract<
      RepositoryArtifactSetEntryV1,
      { readonly outcome: 'present' }
    >;
    readonly artifact: RepositoryArtifactV1;
  }[];
  readonly unavailable: readonly Extract<
    RepositoryArtifactSetEntryV1,
    { readonly outcome: 'not-found' }
  >[];
  readonly artifactUtf8Bytes: number;
  readonly totalLogicalLines: number;
}

export function renderRepositoryInterviewPromptV1(
  input: RenderRepositoryInterviewPromptInputV1,
): RenderRepositoryInterviewPromptResultV1 {
  try {
    validateLoadedRepositoryInterviewSpecification(input.specification);
  } catch {
    return failure([
      repositoryInterviewMappingIssue('mapping-closure', '/specification'),
    ]);
  }

  const context = validateArtifactContext(input.artifactSet, input.artifacts);
  if (!context.ok) {
    return context;
  }

  const instructionText = repositoryInterviewInstructionText(
    input.specification,
  );
  const instructionUtf8Bytes = utf8ByteLength(instructionText);
  if (
    instructionUtf8Bytes >
    REPOSITORY_INTERVIEW_PROMPT_BOUNDS.maximumInstructionUtf8Bytes
  ) {
    return failure([
      repositoryInterviewMappingIssue('prompt-too-large', '/instructionText'),
    ]);
  }

  const aliasBindings: RepositoryInterviewArtifactAliasBinding[] = [];
  const artifacts = context.value.present.map(
    ({ artifact, entry }, aliasIndex) => {
      const alias = aliasForIndex(aliasIndex);
      const binding = Object.freeze({
        alias,
        artifactId: artifact.artifactId,
        artifactKind: entry.artifactKind,
        artifactSetEntryOrdinal: entry.ordinal,
        lineCount: artifact.lineCount,
      });
      aliasBindings.push(binding);
      return {
        alias,
        artifactKind: entry.artifactKind,
        lineCount: artifact.lineCount,
        lines: splitRepositoryArtifactLogicalLines(artifact.content).map(
          (text, lineIndex) => ({
            number: lineIndex + 1,
            text,
          }),
        ),
      };
    },
  );
  const unavailableSelections = context.value.unavailable.map((entry) => ({
    selectionOrdinal: entry.ordinal,
    selector: entry.selector,
    artifactKind: entry.artifactKind,
    requirement: entry.requirement,
    outcome: entry.outcome,
  }));
  const evidenceText = canonicalizeJson({
    kind: 'repository-interview-evidence-v1',
    artifacts,
    unavailableSelections,
  });
  const evidenceUtf8Bytes = utf8ByteLength(evidenceText);
  if (
    evidenceUtf8Bytes >
      REPOSITORY_INTERVIEW_PROMPT_BOUNDS.maximumEvidenceUtf8Bytes ||
    instructionUtf8Bytes + evidenceUtf8Bytes >
      REPOSITORY_INTERVIEW_PROMPT_BOUNDS.maximumCombinedUtf8Bytes
  ) {
    return failure([
      repositoryInterviewMappingIssue('prompt-too-large', '/evidenceText'),
    ]);
  }

  const promptDigest = repositoryInterviewPromptDigest({
    rendererVersion: input.specification.manifest.rendererVersion,
    specificationVersion: input.specification.manifest.specificationVersion,
    specificationDigest: input.specification.manifest.specificationDigest,
    instructionText,
    evidenceText,
  });
  const prompt = Object.freeze({
    candidateId: context.value.artifactSet.candidateId,
    artifactSetId: context.value.artifactSet.artifactSetId,
    artifactSetIdentityDigest: context.value.artifactSet.identityDigest,
    rendererVersion: input.specification.manifest.rendererVersion,
    specificationVersion: input.specification.manifest.specificationVersion,
    specificationDigest: input.specification.manifest.specificationDigest,
    instructionText,
    evidenceText,
    promptDigest,
    aliasBindings: Object.freeze(aliasBindings),
    instructionUtf8Bytes,
    evidenceUtf8Bytes,
    artifactUtf8Bytes: context.value.artifactUtf8Bytes,
    totalLogicalLines: context.value.totalLogicalLines,
  });
  validatedRenderedPrompts.add(prompt);
  return {
    ok: true,
    value: prompt,
    issues: [],
  };
}

export function isValidatedRenderedRepositoryInterviewPromptV1(
  value: unknown,
): value is RenderedRepositoryInterviewPromptV1 {
  return (
    typeof value === 'object' &&
    value !== null &&
    validatedRenderedPrompts.has(value)
  );
}

export function repositoryInterviewPromptDigest(value: {
  readonly rendererVersion: string;
  readonly specificationVersion: string;
  readonly specificationDigest: string;
  readonly instructionText: string;
  readonly evidenceText: string;
}): string {
  return sha256Digest(
    canonicalizeJson({
      kind: 'repository-interview-prompt',
      digestVersion: 1,
      rendererVersion: value.rendererVersion,
      specificationVersion: value.specificationVersion,
      specificationDigest: value.specificationDigest,
      instructionText: value.instructionText,
      evidenceText: value.evidenceText,
    }),
  );
}

function validateArtifactContext(
  artifactSetValue: unknown,
  artifactValues: unknown,
):
  | {
      readonly ok: true;
      readonly value: ValidatedArtifactContext;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly issues: readonly RepositoryInterviewMappingIssue[];
    } {
  const issues: RepositoryInterviewMappingIssue[] = [];
  const parsedSet = parseRepositoryArtifactSetV1(artifactSetValue);
  if (!parsedSet.ok) {
    issues.push(
      ...parsedSet.issues.map((issue) =>
        repositoryInterviewMappingIssue(
          'artifact-context-invalid',
          `/artifactSet${issue.path}`,
        ),
      ),
    );
  }
  const artifactsInput = copyBoundedPlainArray(
    artifactValues,
    REPOSITORY_INTERVIEW_PROMPT_BOUNDS.maximumArtifacts,
  );
  if (artifactsInput === null) {
    issues.push(
      repositoryInterviewMappingIssue('artifact-context-invalid', '/artifacts'),
    );
  }
  const parsedArtifacts: RepositoryArtifactV1[] = [];
  (artifactsInput ?? []).forEach((value, index) => {
    const parsed = parseRepositoryArtifactV1(value);
    if (!parsed.ok) {
      issues.push(
        ...parsed.issues.map((issue) =>
          repositoryInterviewMappingIssue(
            'artifact-context-invalid',
            `/artifacts/${String(index)}${issue.path}`,
          ),
        ),
      );
    } else {
      parsedArtifacts.push(parsed.value);
    }
  });
  if (issues.length > 0 || !parsedSet.ok) {
    return failure(issues);
  }

  const artifactSet = parsedSet.value;
  const artifactsById = new Map<string, RepositoryArtifactV1>();
  const artifactIndexesById = new Map<string, number>();
  for (const [index, artifact] of parsedArtifacts.entries()) {
    if (artifactsById.has(artifact.artifactId)) {
      issues.push(
        repositoryInterviewMappingIssue(
          'artifact-set-closure',
          `/artifacts/${String(index)}/artifactId`,
        ),
      );
    } else {
      artifactsById.set(artifact.artifactId, artifact);
      artifactIndexesById.set(artifact.artifactId, index);
    }
  }

  const referenceCounts = new Map<string, number>();
  const present: ValidatedArtifactContext['present'][number][] = [];
  const unavailable: ValidatedArtifactContext['unavailable'][number][] = [];
  for (const [entryIndex, entry] of artifactSet.entries.entries()) {
    if (entry.outcome === 'not-found') {
      unavailable.push(entry);
      continue;
    }
    const artifact = artifactsById.get(entry.artifactId);
    if (artifact === undefined) {
      issues.push(
        repositoryInterviewMappingIssue(
          'artifact-set-closure',
          `/artifactSet/entries/${String(entryIndex)}/artifactId`,
        ),
      );
      continue;
    }
    referenceCounts.set(
      artifact.artifactId,
      (referenceCounts.get(artifact.artifactId) ?? 0) + 1,
    );
    if (
      entry.resolvedPath !== artifact.path ||
      artifact.candidateId !== artifactSet.candidateId ||
      artifact.providerRepositoryId !== artifactSet.providerRepositoryId ||
      artifact.commitObjectId !== artifactSet.commitObjectId ||
      artifact.firstMaterialization.providerOwner !==
        artifactSet.providerCanonicalOwner ||
      artifact.firstMaterialization.providerRepository !==
        artifactSet.providerCanonicalRepository ||
      splitRepositoryArtifactLogicalLines(artifact.content).length !==
        artifact.lineCount
    ) {
      issues.push(
        repositoryInterviewMappingIssue(
          'artifact-set-closure',
          `/artifactSet/entries/${String(entryIndex)}`,
        ),
      );
    }
    present.push({ entry, artifact });
  }

  for (const artifact of artifactsById.values()) {
    if ((referenceCounts.get(artifact.artifactId) ?? 0) !== 1) {
      issues.push(
        repositoryInterviewMappingIssue(
          'artifact-set-closure',
          `/artifacts/${String(
            artifactIndexesById.get(artifact.artifactId) ?? 0,
          )}`,
        ),
      );
    }
  }
  if (
    artifactSet.entries.length >
      REPOSITORY_INTERVIEW_PROMPT_BOUNDS.maximumArtifacts ||
    present.length > REPOSITORY_INTERVIEW_PROMPT_BOUNDS.maximumArtifacts
  ) {
    issues.push(
      repositoryInterviewMappingIssue(
        'artifact-set-closure',
        '/artifactSet/entries',
      ),
    );
  }
  if (issues.length > 0) {
    return failure(issues);
  }

  const artifactUtf8Bytes = [...artifactsById.values()].reduce(
    (total, artifact) => total + artifact.byteCount,
    0,
  );
  const totalLogicalLines = [...artifactsById.values()].reduce(
    (total, artifact) => total + artifact.lineCount,
    0,
  );
  if (
    artifactUtf8Bytes >
      REPOSITORY_INTERVIEW_PROMPT_BOUNDS.maximumArtifactUtf8Bytes ||
    totalLogicalLines > REPOSITORY_INTERVIEW_PROMPT_BOUNDS.maximumLogicalLines
  ) {
    return failure([
      repositoryInterviewMappingIssue('prompt-too-large', '/artifacts'),
    ]);
  }

  return {
    ok: true,
    value: {
      artifactSet,
      present,
      unavailable,
      artifactUtf8Bytes,
      totalLogicalLines,
    },
    issues: [],
  };
}

export function repositoryInterviewInstructionText(
  specification: LoadedRepositoryInterviewSpecification,
): string {
  const questionText = specification.questions
    .map(
      ({ topic, question }, index) =>
        `${String(index + 1)}. [${topic}] ${question}`,
    )
    .join('\n');
  return `${specification.instructions}\nRepository interview questions:\n\n${questionText}\n`;
}

function aliasForIndex(index: number): RepositoryInterviewArtifactAlias {
  const aliases = ['A1', 'A2', 'A3', 'A4'] as const;
  const alias = aliases[index];
  if (alias === undefined) {
    throw new Error('Repository interview alias bound was exceeded.');
  }
  return alias;
}

function failure(issues: readonly RepositoryInterviewMappingIssue[]): {
  readonly ok: false;
  readonly issues: readonly RepositoryInterviewMappingIssue[];
} {
  return {
    ok: false,
    issues: finalizeRepositoryInterviewMappingIssues(issues),
  };
}

function utf8ByteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}
