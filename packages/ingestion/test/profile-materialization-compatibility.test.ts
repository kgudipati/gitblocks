import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  collectCandidateSources,
  collectProfileMaterializationSources,
  ingestPublicCatalog,
  profileCandidate,
} from '../src/index.ts';

const ACCEPTED_LEGACY_SOURCE_DIGESTS = {
  'src/batch.ts':
    'e0352de946c1dc232cbbf417f701ff3a698c36d8ea0d5772095ed00b1a57d0b7',
  'src/profile.ts':
    '735ae75a1509c9fa909bd1a97ff3d3be06bb628d4197561984924132290e92d9',
  'src/providers.ts':
    '1e4495e077b6e1d81a27df664c298dd526d61efbf222271ade435196e9f817fe',
  'src/receipt.ts':
    '23d292a912b3e383ac87c4032e24f0ec959ab0d330236036e4114d116e62cc8c',
  'src/types.ts':
    'fcd55ea3dda2cc3d95103b15ad5188e2a79951bcb5578edfdbd442783d8d7b54',
} as const;

describe('profile-materialization legacy compatibility', () => {
  it('preserves accepted collector, profile, batch, receipt, and DTO bytes', async () => {
    for (const [path, expected] of Object.entries(
      ACCEPTED_LEGACY_SOURCE_DIGESTS,
    )) {
      const bytes = await readFile(new URL(`../${path}`, import.meta.url));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(expected);
    }
  });

  it('adds a distinct collector without replacing legacy exports', () => {
    expect(collectCandidateSources).toBeTypeOf('function');
    expect(profileCandidate).toBeTypeOf('function');
    expect(ingestPublicCatalog).toBeTypeOf('function');
    expect(collectProfileMaterializationSources).toBeTypeOf('function');
    expect(collectProfileMaterializationSources).not.toBe(
      collectCandidateSources,
    );
  });
});
