/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Trust-boundary validation intentionally rechecks fixed authority counts at runtime. */

import { canonicalizeJson } from './canonical-json.ts';
import { ingestionError } from './errors.ts';
import {
  PROFILE_MATERIALIZATION_SOURCE_TYPES,
  compareText,
  createProfileMaterializationReceipt,
  parseProfileMaterializationReceipt,
  type ProfileMaterializationCountBySourceType,
  type ProfileMaterializationDriftCount,
  type ProfileMaterializationOutcomeCountBySourceType,
  type ProfileMaterializationReceipt,
  type ProfileMaterializationReceiptInput,
  type ProfileMaterializationSourceAuthority,
  type ProfileMaterializationSourceRecord,
} from './profile-materialization-contracts.ts';

export interface ProfileMaterializationSourceDrift {
  readonly firstSourceAuthorityDigest: string;
  readonly secondSourceAuthorityDigest: string;
  readonly counts: readonly ProfileMaterializationDriftCount[];
  readonly comparisonDigest: string;
}

export function compareProfileMaterializationSources(
  first: ProfileMaterializationSourceAuthority,
  second: ProfileMaterializationSourceAuthority,
): ProfileMaterializationSourceDrift {
  if (
    first.catalogDigest !== second.catalogDigest ||
    first.providerPolicyDigest !== second.providerPolicyDigest ||
    first.candidateCount !== second.candidateCount
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  const firstByIdentity = new Map(
    first.sourceRecords.map((record) => [
      record.logicalSourceIdentityDigest,
      record,
    ]),
  );
  const secondByIdentity = new Map(
    second.sourceRecords.map((record) => [
      record.logicalSourceIdentityDigest,
      record,
    ]),
  );
  for (const [identity, prior] of firstByIdentity) {
    const current = secondByIdentity.get(identity);
    if (
      current !== undefined &&
      prior.sourceMutability === 'immutable' &&
      prior.outcome !== 'unavailable' &&
      current.outcome !== 'unavailable' &&
      sourceContentDigest(prior) !== sourceContentDigest(current)
    ) {
      throw ingestionError('ingestion.invalid-receipt');
    }
  }
  const counts = PROFILE_MATERIALIZATION_SOURCE_TYPES.map((sourceType) => {
    const firstRecords = new Map(
      first.sourceRecords
        .filter((record) => record.sourceType === sourceType)
        .map((record) => [record.logicalSourceIdentityDigest, record]),
    );
    const secondRecords = new Map(
      second.sourceRecords
        .filter((record) => record.sourceType === sourceType)
        .map((record) => [record.logicalSourceIdentityDigest, record]),
    );
    let unchanged = 0;
    let changed = 0;
    let withdrawn = 0;
    let added = 0;
    for (const [identity, record] of firstRecords) {
      const next = secondRecords.get(identity);
      if (next === undefined) withdrawn += 1;
      else if (sourceContentDigest(next) === sourceContentDigest(record))
        unchanged += 1;
      else changed += 1;
    }
    for (const identity of secondRecords.keys()) {
      if (!firstRecords.has(identity)) added += 1;
    }
    return { sourceType, unchanged, new: added, changed, withdrawn };
  });
  const withoutDigest = {
    firstSourceAuthorityDigest: first.authoritySemanticDigest,
    secondSourceAuthorityDigest: second.authoritySemanticDigest,
    counts,
  };
  return Object.freeze({
    ...withoutDigest,
    comparisonDigest: canonicalizeJson(withoutDigest).digest,
  });
}

function sourceContentDigest(
  record: ProfileMaterializationSourceRecord,
): string {
  const content = { ...record } as Record<string, unknown>;
  delete content['collectedAt'];
  delete content['evidenceIds'];
  delete content['sourceRecordDigest'];
  return canonicalizeJson(content).digest;
}

export function sourceRecordCounts(
  authority: ProfileMaterializationSourceAuthority,
): readonly ProfileMaterializationCountBySourceType[] {
  return PROFILE_MATERIALIZATION_SOURCE_TYPES.map((sourceType) => ({
    sourceType,
    count: authority.sourceRecords.filter(
      (record) => record.sourceType === sourceType,
    ).length,
  }));
}

export function sourceOutcomeCounts(
  authority: ProfileMaterializationSourceAuthority,
): readonly ProfileMaterializationOutcomeCountBySourceType[] {
  return PROFILE_MATERIALIZATION_SOURCE_TYPES.map((sourceType) => {
    const records = authority.sourceRecords.filter(
      (record) => record.sourceType === sourceType,
    );
    return {
      sourceType,
      establishedValue: countOutcome(records, 'established-value'),
      establishedAbsence: countOutcome(records, 'established-absence'),
      unavailable: countOutcome(records, 'unavailable'),
      fatal: countOutcome(records, 'fatal'),
    };
  });
}

export function buildProfileMaterializationReceipt(
  input: ProfileMaterializationReceiptInput,
): ProfileMaterializationReceipt {
  return createProfileMaterializationReceipt(input);
}

export function validateProfileMaterializationReceipt(
  value: unknown,
): ProfileMaterializationReceipt {
  return parseProfileMaterializationReceipt(value);
}

export function renderProfileMaterializationCompletion(
  receipt: ProfileMaterializationReceipt,
  coverageDigest: string,
): string {
  const validated = parseProfileMaterializationReceipt(receipt);
  if (!/^[a-f0-9]{64}$/u.test(coverageDigest)) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  const status =
    validated.qualification === 'complete'
      ? 'complete'
      : 'qualified: optional sources unavailable; affected fields remain unknown';
  const states = validated.aggregateFieldStates;
  return [
    '# Deterministic profile materialization completion',
    '',
    `- Completion status: ${status}`,
    `- Operator: \`${validated.operatorVersion}\``,
    `- Provider policy: \`${validated.providerPolicyVersion}\` / \`${validated.providerPolicyDigest}\``,
    `- Source authority: \`${validated.sourceAuthorityVersion}\``,
    `- First source digest: \`${validated.firstSourceAuthoritySemanticDigest}\``,
    `- Second source digest: \`${validated.secondSourceAuthoritySemanticDigest}\``,
    `- Final source digest: \`${validated.finalSourceAuthoritySemanticDigest}\``,
    `- Receipt semantic digest: \`${validated.receiptSemanticDigest}\``,
    `- Receipt record digest: \`${validated.receiptRecordDigest}\``,
    `- Coverage digest: \`${coverageDigest}\``,
    `- Candidate count: ${String(validated.candidateCount)}`,
    `- Field states: known=${String(states.known)}, unknown=${String(states.unknown)}, not-applicable=${String(states.notApplicable)}, conflict=${String(states.conflict)}`,
    `- Same-evidence reproduction: ${validated.sameEvidenceReproduction}`,
    `- Live idempotency: ${validated.liveIdempotency}`,
    '',
    '> Remaining unknowns are preserved. This evidence is not a production-retrieval, ranking, readiness, or candidate-quality claim.',
    '',
  ].join('\n');
}

export function validateProfileMaterializationCompletion(
  text: string,
  receipt: ProfileMaterializationReceipt,
  coverageDigest: string,
): void {
  if (
    text !== renderProfileMaterializationCompletion(receipt, coverageDigest) ||
    Buffer.byteLength(text, 'utf8') > 16_384 ||
    /(?:https?:\/\/|postgres(?:ql)?:\/\/|@github|credential|token)/iu.test(text)
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
}

function countOutcome(
  records: readonly ProfileMaterializationSourceRecord[],
  outcome: ProfileMaterializationSourceRecord['outcome'],
): number {
  return records.filter((record) => record.outcome === outcome).length;
}

export function controlledFailureCounts(
  authorities: readonly ProfileMaterializationSourceAuthority[],
): readonly { readonly code: string; readonly count: number }[] {
  const counts = new Map<string, number>();
  for (const record of authorities.flatMap(
    (authority) => authority.sourceRecords,
  )) {
    if (record.controlledCode !== null && record.outcome === 'unavailable') {
      counts.set(
        record.controlledCode,
        (counts.get(record.controlledCode) ?? 0) + 1,
      );
    }
  }
  return [...counts]
    .map(([code, count]) => ({ code, count }))
    .sort((left, right) => compareText(left.code, right.code));
}
