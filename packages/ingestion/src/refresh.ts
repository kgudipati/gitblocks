import type { EvidenceObservationV1 } from '@gitblocks/contracts';

import { StableIdRegistry } from './canonical-json.ts';
import type { ProfileResult, RefreshPlan } from './types.ts';

export function planCandidateRefresh(
  priorObservations: readonly EvidenceObservationV1[],
  profile: ProfileResult,
): RefreshPlan {
  const ids = new StableIdRegistry();
  const priorById = new Map(
    priorObservations.map((observation) => [
      observation.evidenceId,
      observation,
    ]),
  );
  const currentByTopic = groupByTopic(profile.observations);
  const priorByTopic = groupByTopic(priorObservations);
  const observationsToAppend = profile.observations.filter(
    (observation) => !priorById.has(observation.evidenceId),
  );
  const unchangedEvidenceIds = profile.observations
    .filter((observation) => priorById.has(observation.evidenceId))
    .map((observation) => observation.evidenceId)
    .sort();
  const supersessions: RefreshPlan['supersessions'][number][] = [];
  const invalidations: RefreshPlan['invalidations'][number][] = [];

  for (const [topic, current] of currentByTopic) {
    const prior = priorByTopic.get(topic) ?? [];
    for (const oldObservation of prior) {
      if (
        current.every(
          (observation) => observation.evidenceId !== oldObservation.evidenceId,
        ) &&
        current.length > 0
      ) {
        const superseding = current[0];
        if (superseding !== undefined) {
          supersessions.push({
            supersessionId: ids.create('sup', {
              candidateId: profile.identity.candidateId,
              supersededEvidenceId: oldObservation.evidenceId,
              supersedingEvidenceId: superseding.evidenceId,
              effectiveAt: profile.evidenceCutoff,
              reasonCode: 'source-fact-changed',
            }),
            supersededEvidenceId: oldObservation.evidenceId,
            supersedingEvidenceId: superseding.evidenceId,
            reasonCode: 'source-fact-changed',
          });
        }
      }
    }
  }

  for (const [topic, prior] of priorByTopic) {
    if (
      !currentByTopic.has(topic) &&
      profile.authoritativeTopics.some((pattern) =>
        topicMatches(pattern, topic),
      )
    ) {
      for (const oldObservation of prior) {
        invalidations.push({
          invalidationId: ids.create('inv', {
            candidateId: profile.identity.candidateId,
            evidenceId: oldObservation.evidenceId,
            effectiveAt: profile.evidenceCutoff,
            reasonCode: 'source-fact-no-longer-established',
          }),
          evidenceId: oldObservation.evidenceId,
          reasonCode: 'source-fact-no-longer-established',
        });
      }
    }
  }

  return {
    observationsToAppend,
    supersessions: supersessions.sort((left, right) =>
      left.supersessionId.localeCompare(right.supersessionId),
    ),
    invalidations: invalidations.sort((left, right) =>
      left.invalidationId.localeCompare(right.invalidationId),
    ),
    unchangedEvidenceIds,
  };
}

function groupByTopic(
  observations: readonly EvidenceObservationV1[],
): Map<string, EvidenceObservationV1[]> {
  const result = new Map<string, EvidenceObservationV1[]>();
  for (const observation of observations) {
    const values = result.get(observation.topic) ?? [];
    values.push(observation);
    result.set(observation.topic, values);
  }
  return result;
}

function topicMatches(pattern: string, topic: string): boolean {
  return pattern.endsWith('*')
    ? topic.startsWith(pattern.slice(0, -1))
    : pattern === topic;
}
