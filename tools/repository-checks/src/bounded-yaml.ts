import { parseDocument, visit } from 'yaml';

export const YAML_LIMITS = {
  bytes: 256 * 1024,
  depth: 64,
  nodes: 10_000,
} as const;

export type BoundedYamlFailure = 'alias' | 'file-size' | 'structure' | 'syntax';

export type BoundedYamlResult =
  | {
      readonly ok: true;
      readonly value: unknown;
    }
  | {
      readonly failure: BoundedYamlFailure;
      readonly ok: false;
    };

export function parseBoundedYaml(content: string): BoundedYamlResult {
  if (Buffer.byteLength(content, 'utf8') > YAML_LIMITS.bytes) {
    return { failure: 'file-size', ok: false };
  }

  let document;
  try {
    document = parseDocument(content, {
      prettyErrors: false,
      schema: 'core',
      uniqueKeys: true,
      version: '1.2',
    });
  } catch {
    return { failure: 'syntax', ok: false };
  }
  if (document.errors.length > 0 || document.warnings.length > 0) {
    return { failure: 'syntax', ok: false };
  }

  const traversal = {
    aliasFound: false,
    nodeCount: 0,
    structureExceeded: false,
  };
  try {
    visit(document, {
      Alias() {
        traversal.aliasFound = true;
      },
      Node(_key, _node, path) {
        traversal.nodeCount += 1;
        if (
          traversal.nodeCount > YAML_LIMITS.nodes ||
          path.length > YAML_LIMITS.depth
        ) {
          traversal.structureExceeded = true;
          return visit.BREAK;
        }
        return undefined;
      },
    });
  } catch {
    return { failure: 'structure', ok: false };
  }

  if (traversal.aliasFound) {
    return { failure: 'alias', ok: false };
  }
  if (traversal.structureExceeded) {
    return { failure: 'structure', ok: false };
  }

  try {
    return { ok: true, value: document.toJS({ maxAliasCount: 0 }) as unknown };
  } catch {
    return { failure: 'alias', ok: false };
  }
}
