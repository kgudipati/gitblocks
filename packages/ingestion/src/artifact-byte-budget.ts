import { ingestionError } from './errors.ts';

const MAXIMUM_RUN_DECODED_BYTES = 64 * 1_024 * 1_024;

export interface ArtifactDecodedByteBudgetScope {
  readonly operationalDecodedBytes: number;
  reserve(byteCount: number): void;
}

export interface ArtifactDecodedByteBudget {
  readonly maximumDecodedBytes: number;
  readonly operationalDecodedBytes: number;
  createCandidateScope(): ArtifactDecodedByteBudgetScope;
}

export function createArtifactDecodedByteBudget(
  maximumDecodedBytes: number,
): ArtifactDecodedByteBudget {
  if (
    !Number.isSafeInteger(maximumDecodedBytes) ||
    maximumDecodedBytes < 1 ||
    maximumDecodedBytes > MAXIMUM_RUN_DECODED_BYTES
  ) {
    throw ingestionError('ingestion.invalid-input');
  }

  let operationalDecodedBytes = 0;
  return {
    maximumDecodedBytes,
    get operationalDecodedBytes() {
      return operationalDecodedBytes;
    },
    createCandidateScope: () => {
      let candidateDecodedBytes = 0;
      return {
        get operationalDecodedBytes() {
          return candidateDecodedBytes;
        },
        reserve: (byteCount) => {
          if (
            !Number.isSafeInteger(byteCount) ||
            byteCount < 0 ||
            byteCount > maximumDecodedBytes ||
            operationalDecodedBytes > maximumDecodedBytes - byteCount
          ) {
            throw ingestionError('ingestion.body-too-large');
          }

          // JavaScript runs this synchronous check-and-charge without an await,
          // so concurrent candidate workers cannot interleave or oversubscribe.
          operationalDecodedBytes += byteCount;
          candidateDecodedBytes += byteCount;
        },
      };
    },
  };
}
