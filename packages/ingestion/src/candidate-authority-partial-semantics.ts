/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Registry data is validated at a trust boundary. */

import type { CandidateDossierV1 } from '@gitblocks/contracts';

import { canonicalizeJson } from './canonical-json.ts';
import type { CandidateAuthorityDecisionFieldId } from './candidate-authority-contracts.ts';
import { ingestionError } from './errors.ts';
import {
  requireExactKeys,
  requireRecord,
} from './profile-materialization-contracts.ts';

export const CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_VERSION =
  'candidate-authority-partial-field-semantics/2.0.0' as const;
export const CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_PATH =
  'catalog/public-v1/candidate-authority-partial-field-semantics-v2.json' as const;
export const CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_DIGEST =
  'baf99884171e6407dcfe173ff6ab80b5d30719d5cd1babd5aa310ef44ef9243e' as const;
export const CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_V3_VERSION =
  'candidate-authority-partial-field-semantics/3.0.0' as const;
export const CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_V3_PATH =
  'catalog/public-v1/candidate-authority-partial-field-semantics-v3.json' as const;
export const CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_V3_DIGEST =
  '8aa2e5a9ede84f871eb057ad10850b01daae9302b3b20450d97fecc115857b7b' as const;

const CANDIDATE_AUTHORITY_PARTIAL_FACT_CODES_V2 = Object.freeze([
  'applicable-security-advisory',
  'declared-framework-peer-relation',
  'importable-runtime-package-surface',
  'published-release',
  'recognized-license-spdx',
  'repository-container-build-declaration',
  'repository-primary-language',
  'repository-self-build-compose-service',
] as const);

export const CANDIDATE_AUTHORITY_PARTIAL_FACT_CODES = Object.freeze([
  'applicable-security-advisory',
  'declared-framework-peer-relation',
  'importable-runtime-package-surface',
  'published-release',
  'recognized-license-spdx',
  'registry-resolved-package-version',
  'repository-container-build-declaration',
  'repository-primary-language',
  'repository-self-build-compose-service',
] as const);

export type CandidateAuthorityPartialFactCode =
  (typeof CANDIDATE_AUTHORITY_PARTIAL_FACT_CODES)[number];
type EvidenceSource = CandidateDossierV1['observations'][number]['source'];

export type CandidateAuthorityAllowedPartialProvenance =
  | {
      readonly kind: 'git-commit';
      readonly sourceType: 'license' | 'official-repository';
    }
  | {
      readonly kind: 'package-version';
      readonly sourceType: 'package-registry';
    }
  | {
      readonly kind: 'structured-provider-snapshot';
      readonly sourceType: 'public-structured-provider';
      readonly provider: 'github' | 'npm';
      readonly sourceClass:
        | 'repository-metadata'
        | 'repository-release-state'
        | 'security-advisory-index'
        | 'package-metadata';
    };

export type CandidateAuthorityPartialValueSyntax =
  | {
      readonly kind: 'canonical-registry-resolved-package-version-v1';
      readonly packageNamePattern: string;
      readonly packageVersionPattern: string;
      readonly selector: 'latest';
    }
  | {
      readonly kind: 'canonical-importable-runtime-package-surface-v1';
      readonly entryPointKinds: readonly ['exports', 'main', 'module'];
      readonly packageNamePattern: string;
      readonly packageVersionPattern: string;
    }
  | {
      readonly kind: 'canonical-container-build-declaration-v1';
      readonly path: 'Dockerfile';
      readonly contentDigestPattern: '^[a-f0-9]{64}$';
    }
  | {
      readonly kind: 'canonical-framework-peer-relation-v1';
      readonly frameworkPackageBindings: readonly {
        readonly framework: string;
        readonly packageName: string;
      }[];
      readonly rangePattern: string;
    }
  | {
      readonly kind: 'canonical-published-release-v1';
      readonly tagPattern: string;
      readonly timestampPattern: string;
    }
  | {
      readonly kind: 'canonical-security-advisory-v1';
      readonly advisoryIdPattern: string;
      readonly severityValues: readonly ['critical', 'high', 'low', 'moderate'];
    }
  | {
      readonly kind: 'controlled-language-ecosystem-v1';
      readonly controlledValues: readonly [
        'dotnet',
        'go',
        'java',
        'javascript',
        'php',
        'python',
        'ruby',
        'rust',
        'typescript',
      ];
    }
  | {
      readonly kind: 'pattern-v1';
      readonly pattern: string;
    }
  | {
      readonly kind: 'recognized-spdx-v1';
      readonly pattern: string;
      readonly prohibitedValues: readonly ['NOASSERTION'];
    };

export interface CandidateAuthorityPartialFactDefinition {
  readonly factCode: CandidateAuthorityPartialFactCode;
  readonly fieldId: CandidateAuthorityDecisionFieldId;
  readonly extractionRuleVersion: string;
  readonly allowedProvenance: readonly CandidateAuthorityAllowedPartialProvenance[];
  readonly allowedPolarities: readonly ['affirmative'];
  readonly valueSyntax: CandidateAuthorityPartialValueSyntax;
  readonly semanticMeaning: string;
  readonly claimsMaySupport: readonly string[];
  readonly claimsMayNotSupport: readonly string[];
  readonly qualifiesPlannedExtractionCapability: boolean;
  readonly definitionDigest: string;
}

export interface CandidateAuthorityPartialSemanticRegistry {
  readonly registryVersion:
    | typeof CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_VERSION
    | typeof CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_V3_VERSION;
  readonly status:
    | 'accepted-pre-live-source-rule-authority'
    | 'inactive-pending-independent-exact-head-acceptance';
  readonly definitions: readonly CandidateAuthorityPartialFactDefinition[];
  readonly registrySemanticDigest: string;
}

const REGISTRY_KEYS = [
  'definitions',
  'registrySemanticDigest',
  'registryVersion',
  'status',
] as const;
const DEFINITION_KEYS = [
  'allowedPolarities',
  'allowedProvenance',
  'claimsMayNotSupport',
  'claimsMaySupport',
  'definitionDigest',
  'extractionRuleVersion',
  'factCode',
  'fieldId',
  'qualifiesPlannedExtractionCapability',
  'semanticMeaning',
  'valueSyntax',
] as const;

export function parseCandidateAuthorityPartialSemanticRegistry(
  supplied: unknown,
): CandidateAuthorityPartialSemanticRegistry {
  return parseRegistry(
    supplied,
    CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_VERSION,
    CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_DIGEST,
    CANDIDATE_AUTHORITY_PARTIAL_FACT_CODES_V2,
    'accepted-pre-live-source-rule-authority',
  );
}

export function parseCandidateAuthorityPartialSemanticRegistryV3(
  supplied: unknown,
): CandidateAuthorityPartialSemanticRegistry {
  return parseRegistry(
    supplied,
    CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_V3_VERSION,
    CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_V3_DIGEST,
    CANDIDATE_AUTHORITY_PARTIAL_FACT_CODES,
    'inactive-pending-independent-exact-head-acceptance',
  );
}

function parseRegistry(
  supplied: unknown,
  expectedVersion: string,
  expectedDigest: string,
  factCodes: readonly string[],
  expectedStatus: CandidateAuthorityPartialSemanticRegistry['status'],
): CandidateAuthorityPartialSemanticRegistry {
  const record = requireRecord(supplied);
  requireExactKeys(record, REGISTRY_KEYS);
  if (!Array.isArray(record['definitions'])) invalid();
  const definitions = record['definitions'].map((value, index) => {
    const definition = requireRecord(value);
    requireExactKeys(definition, DEFINITION_KEYS);
    if (
      definition['factCode'] !== factCodes[index] ||
      !Array.isArray(definition['allowedProvenance']) ||
      !Array.isArray(definition['allowedPolarities']) ||
      !Array.isArray(definition['claimsMaySupport']) ||
      !Array.isArray(definition['claimsMayNotSupport'])
    )
      invalid();
    for (const provenance of definition['allowedProvenance']) {
      parseAllowedProvenance(provenance);
    }
    parseValueSyntax(definition['valueSyntax']);
    const candidate =
      definition as unknown as CandidateAuthorityPartialFactDefinition;
    const withoutDigest = { ...candidate } as Record<string, unknown>;
    delete withoutDigest['definitionDigest'];
    if (
      candidate.allowedPolarities.length !== 1 ||
      candidate.allowedPolarities[0] !== 'affirmative' ||
      candidate.definitionDigest !== canonicalizeJson(withoutDigest).digest
    )
      invalid();
    return candidate;
  });
  const candidate = {
    ...record,
    definitions,
  } as unknown as CandidateAuthorityPartialSemanticRegistry;
  const withoutDigest = { ...candidate } as Record<string, unknown>;
  delete withoutDigest['registrySemanticDigest'];
  if (
    candidate.registryVersion !== expectedVersion ||
    candidate.status !== expectedStatus ||
    candidate.registrySemanticDigest !== expectedDigest ||
    candidate.registrySemanticDigest !== canonicalizeJson(withoutDigest).digest
  )
    invalid();
  return deepFreeze(candidate);
}

export function partialFactDefinition(
  registry: CandidateAuthorityPartialSemanticRegistry,
  factCode: CandidateAuthorityPartialFactCode,
): CandidateAuthorityPartialFactDefinition {
  const definition = registry.definitions.find(
    (candidate) => candidate.factCode === factCode,
  );
  if (definition === undefined) invalid();
  return definition;
}

export function validateCandidateAuthorityPartialFact(input: {
  readonly registry: CandidateAuthorityPartialSemanticRegistry;
  readonly factCode: CandidateAuthorityPartialFactCode;
  readonly fieldId: CandidateAuthorityDecisionFieldId;
  readonly extractionRuleVersion: string;
  readonly factValue: string;
  readonly polarity: 'affirmative' | 'negative';
  readonly source: EvidenceSource;
  readonly sourceCompleteness: 'complete' | 'partial';
}): CandidateAuthorityPartialFactDefinition {
  const definition = partialFactDefinition(input.registry, input.factCode);
  if (
    definition.fieldId !== input.fieldId ||
    definition.extractionRuleVersion !== input.extractionRuleVersion ||
    !definition.allowedPolarities.includes(input.polarity as 'affirmative') ||
    !definition.allowedProvenance.some((allowed) =>
      provenanceMatches(allowed, input.source),
    ) ||
    !valueMatches(definition.valueSyntax, input.factValue) ||
    (input.polarity === 'negative' && input.sourceCompleteness !== 'complete')
  )
    invalid();
  return definition;
}

function provenanceMatches(
  allowed: CandidateAuthorityAllowedPartialProvenance,
  source: EvidenceSource,
): boolean {
  if (allowed.kind !== source.kind || allowed.sourceType !== source.sourceType)
    return false;
  return allowed.kind !== 'structured-provider-snapshot'
    ? true
    : source.kind === 'structured-provider-snapshot' &&
        source.provider === allowed.provider &&
        source.sourceClass === allowed.sourceClass;
}

function valueMatches(
  syntax: CandidateAuthorityPartialValueSyntax,
  value: string,
): boolean {
  if (value.length < 1 || value.length > 500) return false;
  switch (syntax.kind) {
    case 'pattern-v1':
      return new RegExp(syntax.pattern, 'u').test(value);
    case 'recognized-spdx-v1':
      return (
        new RegExp(syntax.pattern, 'u').test(value) &&
        !syntax.prohibitedValues.includes(
          value as (typeof syntax.prohibitedValues)[number],
        )
      );
    case 'controlled-language-ecosystem-v1':
      return syntax.controlledValues.includes(
        value as (typeof syntax.controlledValues)[number],
      );
    case 'canonical-importable-runtime-package-surface-v1': {
      const parsed = canonicalObject(value, [
        'entryPointKind',
        'packageName',
        'packageVersion',
      ]);
      return (
        parsed !== null &&
        typeof parsed['entryPointKind'] === 'string' &&
        syntax.entryPointKinds.includes(
          parsed['entryPointKind'] as (typeof syntax.entryPointKinds)[number],
        ) &&
        typeof parsed['packageName'] === 'string' &&
        new RegExp(syntax.packageNamePattern, 'u').test(
          parsed['packageName'],
        ) &&
        typeof parsed['packageVersion'] === 'string' &&
        new RegExp(syntax.packageVersionPattern, 'u').test(
          parsed['packageVersion'],
        )
      );
    }
    case 'canonical-registry-resolved-package-version-v1': {
      const parsed = canonicalObject(value, [
        'packageName',
        'resolvedVersion',
        'selector',
      ]);
      return (
        parsed !== null &&
        typeof parsed['packageName'] === 'string' &&
        new RegExp(syntax.packageNamePattern, 'u').test(
          parsed['packageName'],
        ) &&
        typeof parsed['resolvedVersion'] === 'string' &&
        new RegExp(syntax.packageVersionPattern, 'u').test(
          parsed['resolvedVersion'],
        ) &&
        parsed['selector'] === syntax.selector
      );
    }
    case 'canonical-container-build-declaration-v1': {
      const parsed = canonicalObject(value, ['contentDigest', 'path']);
      return (
        parsed !== null &&
        parsed['path'] === syntax.path &&
        typeof parsed['contentDigest'] === 'string' &&
        new RegExp(syntax.contentDigestPattern, 'u').test(
          parsed['contentDigest'],
        )
      );
    }
    case 'canonical-framework-peer-relation-v1': {
      const parsed = canonicalObject(value, [
        'framework',
        'packageName',
        'range',
      ]);
      return (
        parsed !== null &&
        typeof parsed['framework'] === 'string' &&
        typeof parsed['packageName'] === 'string' &&
        syntax.frameworkPackageBindings.some(
          (binding) =>
            binding.framework === parsed['framework'] &&
            binding.packageName === parsed['packageName'],
        ) &&
        typeof parsed['range'] === 'string' &&
        new RegExp(syntax.rangePattern, 'u').test(parsed['range'])
      );
    }
    case 'canonical-published-release-v1': {
      const parsed = canonicalObject(value, [
        'prerelease',
        'publishedAt',
        'tag',
      ]);
      return (
        parsed !== null &&
        typeof parsed['prerelease'] === 'boolean' &&
        typeof parsed['publishedAt'] === 'string' &&
        new RegExp(syntax.timestampPattern, 'u').test(parsed['publishedAt']) &&
        Number.isFinite(Date.parse(parsed['publishedAt'])) &&
        typeof parsed['tag'] === 'string' &&
        new RegExp(syntax.tagPattern, 'u').test(parsed['tag'])
      );
    }
    case 'canonical-security-advisory-v1': {
      const parsed = canonicalObject(value, ['advisoryId', 'severity']);
      return (
        parsed !== null &&
        typeof parsed['advisoryId'] === 'string' &&
        new RegExp(syntax.advisoryIdPattern, 'u').test(parsed['advisoryId']) &&
        typeof parsed['severity'] === 'string' &&
        syntax.severityValues.includes(
          parsed['severity'] as (typeof syntax.severityValues)[number],
        )
      );
    }
  }
}

function canonicalObject(
  value: string,
  keys: readonly string[],
): Record<string, unknown> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return null;
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    !arraysEqual(Object.keys(parsed).sort(compare), [...keys].sort(compare)) ||
    canonicalizeJson(parsed).text !== value
  )
    return null;
  return parsed as Record<string, unknown>;
}

function parseAllowedProvenance(
  supplied: unknown,
): CandidateAuthorityAllowedPartialProvenance {
  const value = requireRecord(supplied);
  if (value['kind'] === 'structured-provider-snapshot') {
    requireExactKeys(value, ['kind', 'provider', 'sourceClass', 'sourceType']);
  } else {
    requireExactKeys(value, ['kind', 'sourceType']);
  }
  return value as unknown as CandidateAuthorityAllowedPartialProvenance;
}

function parseValueSyntax(supplied: unknown): void {
  const value = requireRecord(supplied);
  switch (value['kind']) {
    case 'canonical-container-build-declaration-v1':
      requireExactKeys(value, ['contentDigestPattern', 'kind', 'path']);
      return;
    case 'canonical-importable-runtime-package-surface-v1':
      requireExactKeys(value, [
        'entryPointKinds',
        'kind',
        'packageNamePattern',
        'packageVersionPattern',
      ]);
      return;
    case 'canonical-registry-resolved-package-version-v1':
      requireExactKeys(value, [
        'kind',
        'packageNamePattern',
        'packageVersionPattern',
        'selector',
      ]);
      return;
    case 'canonical-framework-peer-relation-v1':
      requireExactKeys(value, [
        'frameworkPackageBindings',
        'kind',
        'rangePattern',
      ]);
      return;
    case 'canonical-published-release-v1':
      requireExactKeys(value, ['kind', 'tagPattern', 'timestampPattern']);
      return;
    case 'canonical-security-advisory-v1':
      requireExactKeys(value, ['advisoryIdPattern', 'kind', 'severityValues']);
      return;
    case 'controlled-language-ecosystem-v1':
      requireExactKeys(value, ['controlledValues', 'kind']);
      return;
    case 'pattern-v1':
      requireExactKeys(value, ['kind', 'pattern']);
      return;
    case 'recognized-spdx-v1':
      requireExactKeys(value, ['kind', 'pattern', 'prohibitedValues']);
      return;
    default:
      invalid();
  }
}

function arraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

function invalid(): never {
  throw ingestionError('ingestion.invalid-manifest');
}
