import { join } from 'node:path';

import { parseCapabilityQueryInputV1 } from '@gitblocks/contracts';

import {
  RETRIEVAL_CORPUS_ID,
  RETRIEVAL_FAMILIES,
  RETRIEVAL_V2_VERSIONS,
  RETRIEVAL_VERSIONS,
  type RetrievalAuthorityVersion,
  type RetrievalBlindQuerySetLoadResult,
  type RetrievalCorpusManifest,
  type RetrievalDiagnostic,
  type RetrievalQueryDocument,
} from './contracts.ts';
import {
  hashRetrievalJsonFile,
  loadRetrievalJsonFile,
} from './json-boundary.ts';
import { createRetrievalSchemaRegistry } from './schema-registry.ts';
import { retrievalCorpusSemanticDigest } from './stable-json.ts';

const EXPECTED_QUERY_COUNT = 50;
const EXPECTED_TAXONOMY_DIGEST =
  '8b2806ec8862390d0368e1c06ed657983916530f1207be9072d9e4787a61d80e';
const EXPECTED_QUERY_SCHEMA_DIGEST =
  'd48e018b71f8e6947f60f4d3559c48047daba8a335168b51f37bfb5199c81b9b';
const EXPECTED_NORMALIZATION_SCHEMA_DIGEST =
  'bdd7db9510937c0728f87b0d83f75dbd374555fa17c2b1e4a56399d9f9f2d06b';
const EXPECTED_PROFILE_SCHEMA_DIGEST =
  '3bbfdf2050c13a3d70e9dc289db7c8768a6fdcba8605cf12191e08560387af61';
const EXPECTED_PROFILE_AUTHORITY_SCHEMA_DIGEST =
  '7a79a1671bf461127099e3ae2f75d29e949387987041bd3402f2614b747ed8cf';
const EXPECTED_PROFILE_AUTHORITY_DIGEST =
  '9845ff004c83879de423a566ba906f033a83f7338fca9fc38b6324feffd07bdd';
const EXPECTED_CATALOG_DIGEST =
  '4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634';

/**
 * Loads the complete blind input set without reading or returning any gold,
 * equivalence, or audit-classification document.
 */
export function loadRetrievalBlindQuerySetV1(
  repositoryRoot: string,
): RetrievalBlindQuerySetLoadResult {
  return loadRetrievalBlindQuerySet(repositoryRoot, 'v1');
}

export function loadRetrievalBlindQuerySetV2(
  repositoryRoot: string,
): RetrievalBlindQuerySetLoadResult {
  return loadRetrievalBlindQuerySet(repositoryRoot, 'v2');
}

function loadRetrievalBlindQuerySet(
  repositoryRoot: string,
  authorityVersion: RetrievalAuthorityVersion,
): RetrievalBlindQuerySetLoadResult {
  try {
    const corpusRoot = join(
      repositoryRoot,
      `evals/retrieval-${authorityVersion}`,
    );
    const registry = createRetrievalSchemaRegistry(
      repositoryRoot,
      authorityVersion,
    );
    const manifestValue = loadRetrievalJsonFile(corpusRoot, 'manifest.json');
    assertSchema(registry, 'manifest', manifestValue, 'manifest.json');
    const manifest = manifestValue as RetrievalCorpusManifest;
    const corpusId: unknown = manifest.corpusId;
    const corpusVersion: unknown = manifest.corpusVersion;
    const retrievalCount: unknown = manifest.caseCounts.retrieval;
    const normalizationCount: unknown = manifest.caseCounts.normalization;
    const expectedCorpusId =
      authorityVersion === 'v1'
        ? RETRIEVAL_CORPUS_ID
        : RETRIEVAL_V2_VERSIONS.corpusId;
    const expectedCorpusVersion =
      authorityVersion === 'v1'
        ? RETRIEVAL_VERSIONS.corpus
        : RETRIEVAL_V2_VERSIONS.corpus;
    if (
      corpusId !== expectedCorpusId ||
      corpusVersion !== expectedCorpusVersion ||
      retrievalCount !== 30 ||
      normalizationCount !== 20 ||
      manifest.taxonomyVersion !== '1.0.0' ||
      manifest.taxonomyDigest !== EXPECTED_TAXONOMY_DIGEST ||
      manifest.queryInputSchemaDigest !== EXPECTED_QUERY_SCHEMA_DIGEST ||
      manifest.normalizationResultSchemaDigest !==
        EXPECTED_NORMALIZATION_SCHEMA_DIGEST ||
      manifest.profileSchemaDigest !== EXPECTED_PROFILE_SCHEMA_DIGEST ||
      manifest.profileAuthoritySchemaDigest !==
        EXPECTED_PROFILE_AUTHORITY_SCHEMA_DIGEST ||
      manifest.profileAuthorityDigest !== EXPECTED_PROFILE_AUTHORITY_DIGEST ||
      manifest.catalogDigest !== EXPECTED_CATALOG_DIGEST ||
      retrievalCorpusSemanticDigest(manifest) !== manifest.corpusSemanticDigest
    ) {
      fail('retrieval.blind.manifest-binding', 'manifest.json');
    }
    const entries = manifest.files.filter(
      ({ kind }) =>
        kind === 'retrieval-query' || kind === 'normalization-query',
    );
    if (entries.length !== EXPECTED_QUERY_COUNT) {
      fail('retrieval.blind.query-closure', 'manifest.files');
    }
    const queries = entries.map((entry) => {
      if (hashRetrievalJsonFile(corpusRoot, entry.path) !== entry.sha256) {
        fail('retrieval.blind.query-hash', entry.path);
      }
      const value = loadRetrievalJsonFile(corpusRoot, entry.path);
      assertSchema(registry, 'query', value, entry.path);
      const query = value as RetrievalQueryDocument;
      if (
        query.caseId !== entry.caseId ||
        !entry.path.endsWith(`/${query.caseId}.json`) ||
        (query.caseKind === 'retrieval') !==
          (entry.kind === 'retrieval-query') ||
        !parseCapabilityQueryInputV1(query.queryInput).ok
      ) {
        fail('retrieval.blind.query-binding', entry.path);
      }
      return query;
    });
    const caseIds = queries.map(({ caseId }) => caseId);
    if (!isSortedUnique(caseIds)) {
      fail('retrieval.blind.query-order', 'queries');
    }
    for (const family of RETRIEVAL_FAMILIES) {
      const retrieval = queries.filter(
        (query) =>
          query.capabilityFamily === family && query.caseKind === 'retrieval',
      ).length;
      const normalization = queries.filter(
        (query) =>
          query.capabilityFamily === family &&
          query.caseKind === 'normalization-adversarial',
      ).length;
      if (
        retrieval !== manifest.familyCounts[family].retrieval ||
        normalization !== manifest.familyCounts[family].normalization
      ) {
        fail('retrieval.blind.family-balance', family);
      }
    }
    return {
      ok: true,
      querySet: {
        corpusId: manifest.corpusId,
        corpusVersion: manifest.corpusVersion,
        corpusSemanticDigest: manifest.corpusSemanticDigest,
        caseCounts: manifest.caseCounts,
        familyCounts: manifest.familyCounts,
        queries,
      },
    };
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        isBlindBoundaryError(error)
          ? error.diagnostic
          : diagnostic(
              'retrieval.blind.invalid',
              '',
              'Blind query load failed.',
            ),
      ],
    };
  }
}

class BlindBoundaryError extends Error {
  readonly diagnostic: RetrievalDiagnostic;

  constructor(diagnostic: RetrievalDiagnostic) {
    super(diagnostic.message);
    this.diagnostic = diagnostic;
  }
}

function isBlindBoundaryError(error: unknown): error is BlindBoundaryError {
  return error instanceof BlindBoundaryError;
}

function fail(code: string, path: string): never {
  throw new BlindBoundaryError(
    diagnostic(code, path, 'Blind query authority is inconsistent.'),
  );
}

function assertSchema(
  registry: ReturnType<typeof createRetrievalSchemaRegistry>,
  schema: Parameters<typeof registry.validate>[0],
  value: unknown,
  path: string,
): void {
  const diagnostics = registry.validate(schema, value);
  if (diagnostics.length > 0) {
    fail(diagnostics[0]?.code ?? 'retrieval.blind.schema', path);
  }
}

function diagnostic(
  code: string,
  path: string,
  message: string,
): RetrievalDiagnostic {
  return { code, path: path.slice(0, 256), message };
}

function isSortedUnique(values: readonly string[]): boolean {
  return values.every(
    (value, index) => index === 0 || (values[index - 1] ?? '') < value,
  );
}
