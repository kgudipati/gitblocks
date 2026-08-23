import type { RepositoryFingerprintV1 } from '@gitblocks/contracts';

import type {
  HostedRecommendationResultV1,
  HostedResponsibleOptionV1,
} from './application.ts';

type RecommendResultV1 = Extract<
  HostedRecommendationResultV1,
  { readonly outcome: 'recommend' }
>;
type FitAssessmentV1 =
  RecommendResultV1['targetFitAssessment']['fitAssessment'];
type CandidateAssessmentV1 = FitAssessmentV1['candidateAssessments'][number];

export function primaryRecommendationText(
  result: HostedRecommendationResultV1,
  repositoryFingerprint: RepositoryFingerprintV1,
): string {
  const outcomeText = `GitBlocks recommendation outcome: ${result.outcome}.`;
  if (
    result.outcome === 'insufficient-evidence' ||
    result.outcome === 'unsupported' ||
    result.outcome === 'no-viable-candidate'
  ) {
    return `${outcomeText} GitBlocks validated no candidate; claims obtained from any other source are not GitBlocks results.`;
  }
  if (result.outcome !== 'recommend') return outcomeText;
  return renderResponsibleOptions(outcomeText, result, repositoryFingerprint);
}

function renderResponsibleOptions(
  outcomeText: string,
  result: RecommendResultV1,
  repositoryFingerprint: RepositoryFingerprintV1,
): string {
  const optionCount = result.responsibleOptions.length;
  const lines = [
    outcomeText,
    '',
    `Responsible options (GitBlocks order; ${String(optionCount)} ${optionCount === 1 ? 'option' : 'options'}):`,
  ];
  const fit = result.targetFitAssessment.fitAssessment;
  for (const [index, option] of result.responsibleOptions.entries()) {
    const assessment = fit.candidateAssessments.find(
      ({ candidateId }) => candidateId === option.candidateId,
    );
    lines.push(
      '',
      ...renderOption(index, option, assessment, result, repositoryFingerprint),
    );
  }
  lines.push(
    '',
    'Choose one of these GitBlocks options before making repository changes.',
  );
  return lines.join('\n');
}

function renderOption(
  index: number,
  option: HostedResponsibleOptionV1,
  assessment: CandidateAssessmentV1 | undefined,
  result: RecommendResultV1,
  repositoryFingerprint: RepositoryFingerprintV1,
): string[] {
  const lines = [
    `Option ${String(index + 1)}: ${oneLine(option.identity.displayName)} (${option.candidateId})`,
    `Verification status: ${option.verificationStatus}`,
    `Repository: https://github.com/${option.identity.repository.owner}/${option.identity.repository.name}`,
    `Package: ${option.identity.package === null ? 'none' : `${option.identity.package.registry}:${option.identity.package.name}`}`,
  ];
  if (option.verificationStatus === 'unverified-prohibited-constraint') {
    lines.push(
      'WARNING: At least one prohibited constraint is unverified; this option is not fully verified.',
    );
  }

  lines.push('', 'Constraint verification:');
  appendItems(
    lines,
    option.constraintStatuses.map(renderConstraintStatus),
    'No required or prohibited constraints were supplied.',
  );

  const fit = result.targetFitAssessment.fitAssessment;
  const unknowns = selectCatalog(
    fit.materialUnknowns,
    assessment?.unknownIds ?? [],
    ({ unknownId }) => unknownId,
  );
  if (
    option.constraintStatuses.some(({ status }) => status === 'verified') &&
    unknowns.length > 0
  ) {
    lines.push(
      '',
      'Verification scope: VERIFIED constraints are exact evaluations with the stated bases. UNKNOWN items below are separate evidence gaps; they do not reverse a VERIFIED constraint, and a VERIFIED constraint does not establish the unresolved implementation detail.',
    );
  }

  lines.push('', 'Fit rationale:');
  appendItems(
    lines,
    (assessment?.reasons ?? []).map(
      (reason) =>
        `INFERENCE — ${oneLine(reason.statement)}${referenceSuffix({
          evidenceIds: reason.evidenceIds,
          inferenceIds: reason.inferenceIds,
          unknownIds: reason.unknownIds,
        })}`,
    ),
    'No candidate assessment was available.',
  );

  const evidence = selectCatalog(
    fit.evidence,
    assessment?.evidenceIds ?? [],
    ({ evidenceId }) => evidenceId,
  );
  lines.push('', 'Candidate evidence:');
  appendItems(
    lines,
    evidence.map(
      (observation) =>
        `FACT — [${observation.evidenceId}] ${oneLine(observation.observation)} Source: ${evidenceSource(observation.source)}; observed ${evidenceObservedAt(observation.source)}.${observation.limitation === null ? '' : ` Limitation: ${oneLine(observation.limitation)}`}`,
    ),
    'No candidate evidence was selected for this option.',
  );

  const inferences = selectCatalog(
    fit.inferences,
    assessment?.inferenceIds ?? [],
    ({ inferenceId }) => inferenceId,
  );
  const selectedInferenceIds = new Set(
    inferences.map(({ inferenceId }) => inferenceId),
  );
  const usedFactIds = new Set(
    result.targetFitAssessment.inferenceRepositoryFactBindings
      .filter(({ inferenceId }) => selectedInferenceIds.has(inferenceId))
      .flatMap(({ repositoryFactIds }) => repositoryFactIds),
  );
  lines.push('', 'Target repository facts used:');
  appendItems(
    lines,
    repositoryFingerprint.facts
      .filter(({ factId }) => usedFactIds.has(factId))
      .map(
        (fact) =>
          `${repositoryFactLabel(fact.provenance.epistemicStatus)} — [${fact.factId}] ${repositoryFactValue(fact)} Provenance: ${fact.provenance.origin}; confidence: ${fact.provenance.confidence}; observed ${fact.provenance.observedAt}.`,
      ),
    'No target repository fact was bound to this option.',
  );

  lines.push('', 'Important inferences:');
  appendItems(
    lines,
    inferences.map(
      (inference) =>
        `INFERENCE — [${inference.inferenceId}] ${oneLine(inference.statement)} Rationale: ${oneLine(inference.rationale)}${referenceSuffix({ evidenceIds: inference.evidenceIds })}`,
    ),
    'No inference was selected for this option.',
  );

  const claims = selectCatalog(
    fit.materialClaims,
    assessment?.claimIds ?? [],
    ({ claimId }) => claimId,
  );
  lines.push('', 'Material claims:');
  appendItems(
    lines,
    claims.map(
      (claim) =>
        `INFERENCE — [${claim.claimId}] ${claim.direction.toUpperCase()}: ${oneLine(claim.statement)}${referenceSuffix({ evidenceIds: claim.evidenceIds, inferenceIds: claim.inferenceIds })}`,
    ),
    'No material claim was selected for this option.',
  );

  const limitations = selectCatalog(
    fit.candidateLimitations,
    assessment?.limitationIds ?? [],
    ({ limitationId }) => limitationId,
  );
  lines.push('', 'Limitations:');
  appendItems(
    lines,
    limitations.map(
      (limitation) =>
        `LIMITATION — [${limitation.limitationId}] ${oneLine(limitation.statement)}${referenceSuffix({ evidenceIds: limitation.evidenceIds })}`,
    ),
    'No candidate limitation was selected for this option.',
  );

  lines.push('', 'Material unknowns:');
  appendItems(
    lines,
    unknowns.map(
      (unknown) =>
        `UNKNOWN — ${unknown.topic}: ${oneLine(unknown.statement)}${referenceSuffix({ evidenceIds: unknown.evidenceIds })}`,
    ),
    'No material unknown was selected for this option.',
  );

  const conflicts = selectCatalog(
    fit.hardConstraintConflicts,
    assessment?.hardConstraintConflictIds ?? [],
    ({ conflictId }) => conflictId,
  );
  lines.push('', 'Relevant hard conflicts:');
  appendItems(
    lines,
    conflicts.map(
      (conflict) =>
        `INFERENCE — [${conflict.conflictId}] Constraint ${conflict.constraintId} conflicts (${conflict.reasonCode}).${referenceSuffix({ evidenceIds: conflict.evidenceIds })}`,
    ),
    'None.',
  );
  lines.push(
    '',
    `Assessment processing: ${fit.assessmentProcessing.state}${fit.assessmentProcessing.incompleteReasonCodes.length === 0 ? '' : ` (${fit.assessmentProcessing.incompleteReasonCodes.join(', ')})`}.`,
  );
  return lines;
}

function renderConstraintStatus(
  constraint: HostedResponsibleOptionV1['constraintStatuses'][number],
): string {
  const modality = constraint.modality.toUpperCase();
  const statement = oneLine(constraint.statement);
  if (constraint.status === 'unverified') {
    return `UNKNOWN — ${modality} — UNVERIFIED: ${statement}`;
  }
  const grounding = constraint.grounding
    .map(({ evaluationId, basis, inferenceIds }) =>
      basis === 'deterministic'
        ? `${evaluationId} via curated deterministic profile`
        : `${evaluationId} via candidate-evidence-grounded model inference${inferenceIds.length === 0 ? '' : ` ${inferenceIds.join(', ')}`}`,
    )
    .join('; ');
  if (constraint.status === 'conflicting') {
    return `INFERENCE — ${modality} — CONFLICTING: ${statement}${grounding.length === 0 ? '' : ` Grounding: ${grounding}.`}`;
  }
  const bases = new Set(constraint.grounding.map(({ basis }) => basis));
  const basisLabel =
    bases.size === 1 && bases.has('deterministic')
      ? 'curated deterministic profile'
      : bases.size === 1 && bases.has('model')
        ? 'candidate-evidence-grounded model inference'
        : 'curated deterministic profile plus candidate-evidence-grounded model inference';
  return `INFERENCE — ${modality} — VERIFIED (${basisLabel}): ${statement}${grounding.length === 0 ? '' : ` Grounding: ${grounding}.`}`;
}

function selectCatalog<Value>(
  catalog: readonly Value[],
  selectedIds: readonly string[],
  id: (value: Value) => string,
): Value[] {
  const selected = new Set(selectedIds);
  return catalog.filter((value) => selected.has(id(value)));
}

function appendItems(lines: string[], items: readonly string[], empty: string) {
  if (items.length === 0) {
    lines.push(`- ${empty}`);
    return;
  }
  items.forEach((item) => lines.push(`- ${item}`));
}

function referenceSuffix(input: {
  readonly evidenceIds?: readonly string[];
  readonly inferenceIds?: readonly string[];
  readonly unknownIds?: readonly string[];
}): string {
  const groups = [
    referenceGroup('evidence', input.evidenceIds),
    referenceGroup('inferences', input.inferenceIds),
    referenceGroup('unknowns', input.unknownIds),
  ].filter((value) => value.length > 0);
  return groups.length === 0 ? '' : ` References: ${groups.join('; ')}.`;
}

function referenceGroup(
  label: string,
  values: readonly string[] | undefined,
): string {
  return values === undefined || values.length === 0
    ? ''
    : `${label} ${values.join(', ')}`;
}

function evidenceSource(
  source: FitAssessmentV1['evidence'][number]['source'],
): string {
  switch (source.kind) {
    case 'git-commit':
    case 'tag':
    case 'release':
    case 'package-version':
    case 'security-advisory':
      return source.immutableUrl;
    case 'mutable-documentation':
      return `${source.sourceUrl} (${source.limitationCode})`;
    case 'approved-validation':
      return `approved-validation:${source.validationReferenceId}`;
  }
}

function evidenceObservedAt(
  source: FitAssessmentV1['evidence'][number]['source'],
): string {
  return source.kind === 'approved-validation'
    ? source.validatedAt
    : source.collectedAt;
}

function repositoryFactLabel(
  status: RepositoryFingerprintV1['facts'][number]['provenance']['epistemicStatus'],
): 'DECLARATION' | 'FACT' | 'INFERENCE' {
  return status === 'direct'
    ? 'FACT'
    : status === 'declared'
      ? 'DECLARATION'
      : 'INFERENCE';
}

function repositoryFactValue(
  fact: RepositoryFingerprintV1['facts'][number],
): string {
  switch (fact.kind) {
    case 'component':
      return `${fact.component}: ${fact.name}${fact.version === null ? '.' : ` ${fact.version}.`}`;
    case 'deployment':
      return `deployment: ${fact.topology}; worker capability: ${fact.workerCapability}; replicas: ${fact.replicas === null ? 'unknown' : String(fact.replicas)}; region: ${fact.region ?? 'unknown'}.`;
    case 'coded':
      return `${fact.category}/${fact.code}${fact.subjectCode === null ? '' : `/${fact.subjectCode}`}: ${codedFactValue(fact.value)}.`;
  }
}

function codedFactValue(
  value: Extract<
    RepositoryFingerprintV1['facts'][number],
    { readonly kind: 'coded' }
  >['value'],
): string {
  switch (value.kind) {
    case 'presence':
      return value.state;
    case 'classification':
      return value.code;
    case 'code-set':
      return value.codes.join(', ');
    case 'integer':
      return String(value.value);
  }
}

function oneLine(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}
