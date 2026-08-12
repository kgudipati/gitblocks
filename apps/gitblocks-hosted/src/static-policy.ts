import { open } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseCapabilityRetrievalExpansionV1,
  parseCapabilityTaxonomyV1,
  type CapabilityRetrievalExpansionV1,
  type CapabilityTaxonomyV1,
} from '@gitblocks/contracts';

import { HostedDiscoveryError } from './errors.ts';

const STATIC_POLICY_MAX_BYTES = 2 * 1024 * 1024;
const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_DIRECTORY =
  dirname(MODULE_DIRECTORY).endsWith('/dist') ||
  dirname(MODULE_DIRECTORY).endsWith('\\dist')
    ? dirname(dirname(MODULE_DIRECTORY))
    : dirname(MODULE_DIRECTORY);
const REPOSITORY_DIRECTORY = resolve(WORKSPACE_DIRECTORY, '../..');
const ACCEPTED_TAXONOMY_PATH = resolve(
  REPOSITORY_DIRECTORY,
  'catalog/capability-taxonomy/1.0.0/manifest.json',
);
const ACCEPTED_RETRIEVAL_EXPANSION_PATH = resolve(
  REPOSITORY_DIRECTORY,
  'catalog/capability-retrieval-expansion/1.0.0/manifest.json',
);

export interface HostedDiscoveryStaticPolicyV1 {
  readonly taxonomy: CapabilityTaxonomyV1;
  readonly retrievalExpansion: CapabilityRetrievalExpansionV1;
}

export function parseHostedDiscoveryStaticPolicyV1(input: {
  readonly taxonomy: unknown;
  readonly retrievalExpansion: unknown;
}): HostedDiscoveryStaticPolicyV1 {
  const taxonomy = parseCapabilityTaxonomyV1(input.taxonomy);
  const retrievalExpansion = parseCapabilityRetrievalExpansionV1(
    input.retrievalExpansion,
  );
  if (!taxonomy.ok || !retrievalExpansion.ok) {
    throw new HostedDiscoveryError('hosted.invalid-static-policy');
  }
  return Object.freeze({
    taxonomy: taxonomy.value,
    retrievalExpansion: retrievalExpansion.value,
  });
}

export async function loadAcceptedHostedDiscoveryStaticPolicyV1(): Promise<HostedDiscoveryStaticPolicyV1> {
  const [taxonomy, retrievalExpansion] = await Promise.all([
    readBoundedJson(ACCEPTED_TAXONOMY_PATH),
    readBoundedJson(ACCEPTED_RETRIEVAL_EXPANSION_PATH),
  ]);
  return parseHostedDiscoveryStaticPolicyV1({ taxonomy, retrievalExpansion });
}

async function readBoundedJson(path: string): Promise<unknown> {
  let handle;
  try {
    handle = await open(path, 'r');
    const stat = await handle.stat();
    if (
      !stat.isFile() ||
      stat.size < 1 ||
      stat.size > STATIC_POLICY_MAX_BYTES
    ) {
      throw new HostedDiscoveryError('hosted.invalid-static-policy');
    }
    const text = await handle.readFile({ encoding: 'utf8' });
    if (Buffer.byteLength(text, 'utf8') > STATIC_POLICY_MAX_BYTES) {
      throw new HostedDiscoveryError('hosted.invalid-static-policy');
    }
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof HostedDiscoveryError) throw error;
    throw new HostedDiscoveryError('hosted.invalid-static-policy');
  } finally {
    await handle?.close().catch(() => undefined);
  }
}
