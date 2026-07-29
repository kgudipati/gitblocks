import { createHash } from 'node:crypto';

import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

import * as publicApi from '../src/index.ts';
import {
  CONTRACT_SCHEMA_NAMES,
  getContractSchemaV1,
  parseFitAssessmentResponseV1,
  serializeContractSchemaV1,
  type JsonSchemaValue,
} from '../src/index.ts';
import { createFitAssessmentResponse } from './fixtures.ts';

const EXPECTED_SCHEMA_DIGESTS = {
  'candidate-dossier':
    'd16d0424ed45edcf61d8084cbd21ebbb396366522d1b1a425b6cf8405e0680af',
  'capability-request':
    '3d1f213efdacd6ff550a66a74703b94abc56aead59cdcb08b7a2769b5a5a1ab9',
  'error-envelope':
    '7a708cc440a7992cb164715dce6029befbe78970c3283d8a1bff9298c87603d0',
  'fit-assessment-request':
    'c130a56044cbb043fac97e66db4c372d48990d672784b4abfde9ab9e78c9e504',
  'fit-assessment-response':
    '330b5b3940858428b1881701774bac785a7c93cf2d50e6dcb4ec37091a696a4d',
  'repository-fingerprint':
    '73f42c7a7cd20de24372ecddb7afa33925ca1f4d67cb1f9598cd9d56ea87477c',
} as const;

describe('deterministic JSON Schema 2020-12 exports', () => {
  it('exports exactly six stable V1 roots', () => {
    expect(CONTRACT_SCHEMA_NAMES).toEqual([
      'candidate-dossier',
      'capability-request',
      'error-envelope',
      'fit-assessment-request',
      'fit-assessment-response',
      'repository-fingerprint',
    ]);

    for (const name of CONTRACT_SCHEMA_NAMES) {
      const schema = getContractSchemaV1(name);
      expect(readProperty(schema, '$schema')).toBe(
        'https://json-schema.org/draft/2020-12/schema',
      );
      expect(readProperty(schema, '$id')).toBe(
        `https://gitblocks.dev/schemas/contracts/${name}/1.0.0`,
      );
    }
  });

  it('compiles every exported root in one strict Ajv2020 registry', () => {
    const ajv = new Ajv2020({
      allErrors: false,
      coerceTypes: false,
      messages: false,
      removeAdditional: false,
      strict: true,
      useDefaults: false,
      validateFormats: false,
      verbose: false,
    });

    for (const name of CONTRACT_SCHEMA_NAMES) {
      const schema = getContractSchemaV1(name);
      if (!isRecord(schema)) {
        throw new Error('Owned root schema must be an object.');
      }
      expect(() => ajv.compile({ ...schema })).not.toThrow();
    }
  });

  it('closes every object and contains no default insertion', () => {
    for (const name of CONTRACT_SCHEMA_NAMES) {
      walkSchema(getContractSchemaV1(name), (value) => {
        if (readProperty(value, 'type') === 'object') {
          expect(readProperty(value, 'additionalProperties')).toBe(false);
        }
        expect(hasProperty(value, 'default')).toBe(false);
      });
    }
  });

  it('returns fresh artifacts that callers cannot use to mutate authority', () => {
    const first = getContractSchemaV1('capability-request');
    if (!isRecord(first)) {
      throw new Error('Capability-request schema must be an object.');
    }
    Reflect.set(first, 'title', 'caller mutation');

    expect(
      readProperty(getContractSchemaV1('capability-request'), 'title'),
    ).toBeUndefined();
  });

  it('detects exact artifact drift through committed serialization digests', () => {
    const actual = Object.fromEntries(
      CONTRACT_SCHEMA_NAMES.map((name) => [
        name,
        createHash('sha256')
          .update(serializeContractSchemaV1(name))
          .digest('hex'),
      ]),
    );

    expect(actual).toEqual(EXPECTED_SCHEMA_DIGESTS);
  });

  it('serializes canonically and newline-terminates each artifact', () => {
    for (const name of CONTRACT_SCHEMA_NAMES) {
      const first = serializeContractSchemaV1(name);
      const second = serializeContractSchemaV1(name);
      expect(first).toBe(second);
      expect(first.endsWith('\n')).toBe(true);
      expect(first).toBe(
        `${JSON.stringify(getContractSchemaV1(name), null, 2)}\n`,
      );
    }
  });

  it('does not expose evaluation-only result fields', () => {
    const productResult = createFitAssessmentResponse();
    const result = parseFitAssessmentResponseV1({
      ...productResult,
      schemaVersion: '1.0.0',
      caseId: 'evaluation-case',
      allowedAlternativeOutcomes: [],
      rationaleNotes: [],
      provenance: {
        status: 'proposed',
        independentReviewStatus: 'not-reviewed',
      },
    });

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.additional-property' }],
    });
  });

  it('keeps the runtime package surface narrow', () => {
    expect(Object.keys(publicApi).sort()).toEqual([
      'CONTRACT_SCHEMA_NAMES',
      'CONTRACT_VERSION',
      'MAX_DIAGNOSTIC_ISSUES',
      'MAX_DIAGNOSTIC_MESSAGE_LENGTH',
      'MAX_DIAGNOSTIC_PATH_LENGTH',
      'MAX_INPUT_DEPTH',
      'MAX_INPUT_NODES',
      'MAX_INPUT_STRING_CODE_UNITS',
      'MAX_INPUT_TOTAL_STRING_CODE_UNITS',
      'MAX_OBJECT_PROPERTIES',
      'getContractSchemaV1',
      'parseCandidateDossierV1',
      'parseCapabilityRequestV1',
      'parseErrorEnvelopeV1',
      'parseFitAssessmentRequestV1',
      'parseFitAssessmentResponseV1',
      'parseRepositoryFingerprintV1',
      'serializeContractSchemaV1',
      'validateFitAssessmentExchangeV1',
    ]);
  });
});

function walkSchema(
  value: JsonSchemaValue,
  visit: (value: JsonSchemaValue) => void,
): void {
  visit(value);
  if (isSchemaArray(value)) {
    for (const child of value) {
      walkSchema(child, visit);
    }
    return;
  }
  if (isRecord(value)) {
    for (const child of Object.values(value)) {
      walkSchema(child, visit);
    }
  }
}

function isSchemaArray(
  value: JsonSchemaValue,
): value is readonly JsonSchemaValue[] {
  return Array.isArray(value);
}

function readProperty(
  value: JsonSchemaValue,
  key: string,
): JsonSchemaValue | undefined {
  return isRecord(value) ? value[key] : undefined;
}

function hasProperty(value: JsonSchemaValue, key: string): boolean {
  return isRecord(value) && Object.hasOwn(value, key);
}

function isRecord(
  value: JsonSchemaValue,
): value is Record<string, JsonSchemaValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
