import {
  parseRepositoryArtifactSetV1,
  parseRepositoryArtifactV1,
  type RepositoryArtifactSetV1,
  type RepositoryArtifactV1,
} from '@gitblocks/contracts';
import type {
  RepositoryInterviewPublicationCommandV1,
  RepositoryInterviewRecordPortV1,
  RepositoryInterviewReuseLookupV1,
} from '@gitblocks/interviews';
import {
  findReusableRepositoryInterview,
  loadRepositoryArtifact,
  loadRepositoryArtifactSet,
  PersistenceError,
  publishRepositoryInterviewExchange,
  verifyMigrations,
  type MigrationVerification,
  type OperationControl,
  type PersistenceClient,
} from '@gitblocks/persistence';

import type { RepositoryInterviewOperatorSelectionMemberV1 } from './operator-selection.ts';
import type { RepositoryInterviewOperatorSelectionV1 } from './operator-selection.ts';
import { ownAndFreezeOperatorData } from './plain-data.ts';

export class RepositoryInterviewOperatorPersistenceError extends Error {
  public constructor() {
    super('The repository interview persistence operation failed.');
    this.name = 'RepositoryInterviewOperatorPersistenceError';
    Object.defineProperty(this, 'stack', { value: undefined });
  }
}

export interface RepositoryInterviewOperatorArtifactContextV1 {
  readonly artifactSet: RepositoryArtifactSetV1;
  readonly artifacts: readonly RepositoryArtifactV1[];
}

export interface RepositoryInterviewOperatorPersistencePortV1 {
  verifyMigrations(): Promise<MigrationVerification>;
  loadArtifactContext(
    member: RepositoryInterviewOperatorSelectionMemberV1,
    selection: RepositoryInterviewOperatorSelectionV1,
  ): Promise<RepositoryInterviewOperatorArtifactContextV1>;
  readonly record: RepositoryInterviewRecordPortV1;
}

export function createRepositoryInterviewPersistenceAdapterV1(
  client: PersistenceClient,
  control: OperationControl,
): RepositoryInterviewOperatorPersistencePortV1 {
  const record: RepositoryInterviewRecordPortV1 = Object.freeze({
    async findReusable(lookup: RepositoryInterviewReuseLookupV1) {
      try {
        return await findReusableRepositoryInterview(client, lookup, control);
      } catch {
        throw new RepositoryInterviewOperatorPersistenceError();
      }
    },
    async publish(command: RepositoryInterviewPublicationCommandV1) {
      try {
        const result = await publishRepositoryInterviewExchange(
          client,
          command,
          control,
        );
        return result.status === 'created'
          ? Object.freeze({ status: 'created' as const })
          : Object.freeze({
              status: 'idempotent' as const,
              record: result.record,
            });
      } catch (error) {
        if (
          error instanceof PersistenceError &&
          error.code === 'persistence.conflict'
        ) {
          return Object.freeze({ status: 'conflict' as const });
        }
        throw new RepositoryInterviewOperatorPersistenceError();
      }
    },
  });
  return Object.freeze({
    async verifyMigrations() {
      try {
        return await verifyMigrations(client, control);
      } catch {
        throw new RepositoryInterviewOperatorPersistenceError();
      }
    },
    async loadArtifactContext(
      member: RepositoryInterviewOperatorSelectionMemberV1,
      selection: RepositoryInterviewOperatorSelectionV1,
    ) {
      try {
        const loadedSet = await loadRepositoryArtifactSet(
          client,
          { artifactSetId: member.artifactSetId },
          control,
        );
        const parsedSet = parseRepositoryArtifactSetV1(loadedSet);
        if (
          !parsedSet.ok ||
          parsedSet.value.artifactSetId !== member.artifactSetId ||
          parsedSet.value.candidateId !== member.candidateId ||
          parsedSet.value.identityDigest !== member.artifactSetIdentityDigest ||
          parsedSet.value.catalogVersion !== selection.catalogVersion ||
          parsedSet.value.catalogDigest !== selection.catalogDigest ||
          parsedSet.value.artifactManifestVersion !==
            selection.artifactManifestVersion ||
          parsedSet.value.artifactManifestDigest !==
            selection.artifactManifestDigest
        )
          throw new RepositoryInterviewOperatorPersistenceError();
        const artifacts: RepositoryArtifactV1[] = [];
        for (const entry of parsedSet.value.entries) {
          if (entry.outcome !== 'present') continue;
          const loaded = await loadRepositoryArtifact(
            client,
            { artifactId: entry.artifactId, chunkerVersion: 'exact-lines-v1' },
            control,
          );
          const parsedArtifact = parseRepositoryArtifactV1(loaded.artifact);
          if (
            !parsedArtifact.ok ||
            parsedArtifact.value.artifactId !== entry.artifactId ||
            parsedArtifact.value.candidateId !== member.candidateId ||
            parsedArtifact.value.path !== entry.resolvedPath ||
            parsedArtifact.value.providerRepositoryId !==
              parsedSet.value.providerRepositoryId ||
            parsedArtifact.value.commitObjectId !==
              parsedSet.value.commitObjectId
          )
            throw new RepositoryInterviewOperatorPersistenceError();
          artifacts.push(parsedArtifact.value);
        }
        return ownAndFreezeOperatorData({
          artifactSet: parsedSet.value,
          artifacts,
        });
      } catch (error) {
        if (error instanceof RepositoryInterviewOperatorPersistenceError) {
          throw error;
        }
        throw new RepositoryInterviewOperatorPersistenceError();
      }
    },
    record,
  });
}
