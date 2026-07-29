import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

import * as domainPublicApi from '@gitblocks/domain';
import {
  getCapabilityFamilies,
  getRepositoryFactVocabularySnapshot,
  serializeRepositoryFactVocabulary,
  validateCapabilityRequest,
  validateRepositoryFactSemantics,
  type CapabilityRequest,
  type CodedRepositoryFact,
  type RepositoryFactVocabularySnapshot,
} from '@gitblocks/domain';
import { describe, expect, it } from 'vitest';

import {
  CONTRACT_SCHEMA_NAMES,
  parseCapabilityRequestV1,
  parseRepositoryFingerprintV1,
} from '../src/index.ts';
import {
  createCapabilityRequest,
  createRepositoryFingerprint,
} from './fixtures.ts';

const EXPECTED_VOCABULARY_1_0_0_DIGEST =
  '7f5823b8140bcc92f2e8b05ee811493effb0af3a644233f1eb3e070a6eaf56c8';

function runIsolatedMutation(scriptBody: string): string {
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', scriptBody],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  );

  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

function supportedSnapshot(): RepositoryFactVocabularySnapshot {
  const result = getRepositoryFactVocabularySnapshot('1.0.0');
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error('Expected repository fact vocabulary 1.0.0.');
  }
  return result.value;
}

function supportedSerialization(): string {
  const result = serializeRepositoryFactVocabulary('1.0.0');
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error('Expected repository fact vocabulary serialization.');
  }
  return result.value;
}

const fingerprintFactory = String.raw`
function fingerprint(code, value, category = 'repository-capability') {
  return {
    contractVersion: '1.0.0',
    factVocabularyVersion: '1.0.0',
    fingerprintId: 'authority-mutation-fingerprint',
    facts: [{
      kind: 'coded',
      factId: 'authority-mutation-fact',
      category,
      code,
      subjectCode: null,
      value,
      provenance: {
        origin: 'supplied-declaration',
        epistemicStatus: 'declared',
        confidence: 'high',
        observedAt: '2026-07-28T20:00:00Z',
      },
    }],
    withheldCategories: [],
  };
}
`;

describe('validation authority immutability', () => {
  it('returns fresh deterministic data-only vocabulary snapshots', () => {
    const first = supportedSnapshot();
    const second = supportedSnapshot();

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.definitions).not.toBe(second.definitions);
    expect(first.definitions[0]).not.toBe(second.definitions[0]);
    expect(() => structuredClone(first)).not.toThrow();
  });

  it('does not export live validation-authority collections', () => {
    expect(domainPublicApi).not.toHaveProperty('CAPABILITY_FAMILIES');
    expect(domainPublicApi).not.toHaveProperty('REPOSITORY_FACT_CATEGORIES');
    expect(domainPublicApi).not.toHaveProperty(
      'REPOSITORY_FACT_PRESENCE_STATES',
    );
    expect(domainPublicApi).not.toHaveProperty('REPOSITORY_FACT_VOCABULARY');
    expect(Object.isFrozen(CONTRACT_SCHEMA_NAMES)).toBe(true);
    expect(() =>
      (CONTRACT_SCHEMA_NAMES as unknown as string[]).push(
        'authority-mutation-schema',
      ),
    ).toThrow(TypeError);
  });

  it('does not allow top-level public snapshot mutation to register a fact', () => {
    const output = runIsolatedMutation(String.raw`
      import {
        getRepositoryFactVocabularySnapshot,
      } from './packages/domain/dist/src/index.js';
      import {
        parseRepositoryFingerprintV1,
      } from './packages/contracts/dist/src/index.js';

      ${fingerprintFactory}

      const input = fingerprint(
        'authority-mutation-code',
        { kind: 'presence', state: 'present' },
      );
      const before = parseRepositoryFingerprintV1(input).ok;
      const snapshot = getRepositoryFactVocabularySnapshot('1.0.0');
      if (!snapshot.ok) {
        throw new Error('Expected supported vocabulary snapshot.');
      }
      const publicDefinitions = snapshot.value.definitions;
      publicDefinitions.push({
        category: 'repository-capability',
        code: 'authority-mutation-code',
        subject: { kind: 'none' },
        value: {
          kind: 'presence',
          states: ['absent', 'present', 'unknown'],
        },
      });
      const after = parseRepositoryFingerprintV1(input).ok;
      const fresh = getRepositoryFactVocabularySnapshot('1.0.0');
      if (!fresh.ok) {
        throw new Error('Expected a fresh supported vocabulary snapshot.');
      }

      process.stdout.write(
        'before=' + String(before) +
        ';after=' + String(after) +
        ';publicLength=' + String(publicDefinitions.length) +
        ';freshLength=' + String(fresh.value.definitions.length),
      );
    `);

    expect(output).toBe(
      'before=false;after=false;publicLength=28;freshLength=27',
    );
  });

  it('does not allow nested public snapshot mutation to widen a fact value', () => {
    const output = runIsolatedMutation(String.raw`
      import {
        getRepositoryFactVocabularySnapshot,
      } from './packages/domain/dist/src/index.js';
      import {
        parseRepositoryFingerprintV1,
      } from './packages/contracts/dist/src/index.js';

      ${fingerprintFactory}

      const input = fingerprint(
        'route-execution-runtimes',
        { kind: 'code-set', codes: ['authority-mutation-runtime'] },
        'repository-structure',
      );
      const before = parseRepositoryFingerprintV1(input).ok;
      const snapshot = getRepositoryFactVocabularySnapshot('1.0.0');
      if (!snapshot.ok) {
        throw new Error('Expected supported vocabulary snapshot.');
      }
      const definition = snapshot.value.definitions.find(
        (candidate) => candidate.code === 'route-execution-runtimes',
      );
      if (definition?.value.kind !== 'code-set') {
        throw new Error('Expected route runtime code-set definition.');
      }
      definition.value.codes.push('authority-mutation-runtime');
      const after = parseRepositoryFingerprintV1(input).ok;
      const fresh = getRepositoryFactVocabularySnapshot('1.0.0');
      if (!fresh.ok) {
        throw new Error('Expected a fresh supported vocabulary snapshot.');
      }
      const freshDefinition = fresh.value.definitions.find(
        (candidate) => candidate.code === 'route-execution-runtimes',
      );
      if (freshDefinition?.value.kind !== 'code-set') {
        throw new Error('Expected fresh route runtime definition.');
      }

      process.stdout.write(
        'before=' + String(before) +
        ';after=' + String(after) +
        ';publicCodes=' + definition.value.codes.join(',') +
        ';freshCodes=' + freshDefinition.value.codes.join(','),
      );
    `);

    expect(output).toBe(
      'before=false;after=false;' +
        'publicCodes=edge,node,authority-mutation-runtime;' +
        'freshCodes=edge,node',
    );
  });

  it('keeps category and presence-state snapshot mutation isolated', () => {
    const snapshot = supportedSnapshot();
    const categories = snapshot.categories as string[];
    const presenceStates = snapshot.presenceStates as string[];
    categories.push('authority-mutation-category');
    presenceStates.push('authority-mutation-state');

    const fresh = supportedSnapshot();
    expect(fresh.categories).not.toContain('authority-mutation-category');
    expect(fresh.presenceStates).not.toContain('authority-mutation-state');
  });

  it('does not allow capability-family snapshot mutation to widen validation', () => {
    const parsed = parseCapabilityRequestV1(createCapabilityRequest());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error('Expected a valid capability request fixture.');
    }

    const publicFamilies = getCapabilityFamilies() as string[];
    publicFamilies.push('authority-mutation-family');
    const mutated = {
      ...parsed.domain,
      capabilityFamily: 'authority-mutation-family',
    } as unknown as CapabilityRequest;

    expect(validateCapabilityRequest(mutated).ok).toBe(false);
    expect(getCapabilityFamilies()).not.toContain('authority-mutation-family');
  });

  it('rejects unsupported vocabulary versions explicitly', () => {
    expect(getRepositoryFactVocabularySnapshot('1.1.0')).toEqual({
      ok: false,
      kind: 'unsupported-version',
    });
    expect(serializeRepositoryFactVocabulary('1.1.0')).toEqual({
      ok: false,
      kind: 'unsupported-version',
    });

    const parsed = parseRepositoryFingerprintV1(createRepositoryFingerprint());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error('Expected a valid repository fingerprint fixture.');
    }
    const codedFact = parsed.domain.facts.find(
      (fact): fact is CodedRepositoryFact => fact.kind === 'coded',
    );
    if (codedFact === undefined) {
      throw new Error('Expected a coded repository fact.');
    }
    expect(validateRepositoryFactSemantics('1.0.0', codedFact)).toEqual({
      ok: true,
    });
    expect(validateRepositoryFactSemantics('1.1.0', codedFact)).toEqual({
      ok: false,
      kind: 'unsupported-vocabulary-version',
    });
  });

  it('serializes vocabulary 1.0.0 deterministically and canonically', () => {
    const first = supportedSerialization();
    const second = supportedSerialization();

    expect(first).toBe(second);
    expect(first.endsWith('\n')).toBe(true);
    expect(first).toBe(`${JSON.stringify(supportedSnapshot(), null, 2)}\n`);
  });

  it('binds vocabulary 1.0.0 to its committed SHA-256 digest', () => {
    expect(
      createHash('sha256').update(supportedSerialization()).digest('hex'),
    ).toBe(EXPECTED_VOCABULARY_1_0_0_DIGEST);
  });
});
