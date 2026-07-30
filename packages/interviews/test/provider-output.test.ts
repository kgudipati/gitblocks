import { describe, expect, it } from 'vitest';

import {
  parseRepositoryInterviewProviderOutputV1,
  repositoryInterviewProviderOutputV1Schema,
} from '../src/index.ts';
import {
  EXPECTED_TOPICS,
  cloneProviderOutput,
  createValidProviderOutput,
  readArray,
} from './fixtures.ts';

function expectValid(value: unknown): void {
  expect(parseRepositoryInterviewProviderOutputV1(value)).toMatchObject({
    ok: true,
    issues: [],
  });
}

function expectInvalid(value: unknown, code?: string): void {
  const result = parseRepositoryInterviewProviderOutputV1(value);
  expect(result.ok).toBe(false);
  if (!result.ok && code !== undefined) {
    expect(result.issues.map((issue) => issue.code)).toContain(code);
  }
}

function citation(startLine: number, endLine = startLine) {
  return { artifactAlias: 'A1', startLine, endLine };
}

describe('repository interview provider-output schema', () => {
  it('accepts one closed root with exactly five required arrays', () => {
    expectValid(createValidProviderOutput());

    const schema =
      repositoryInterviewProviderOutputV1Schema as unknown as Readonly<
        Record<string, unknown>
      >;
    expect(schema['type']).toBe('object');
    expect(schema['additionalProperties']).toBe(false);
    expect(schema['required']).toEqual([
      'documentedPositions',
      'inferences',
      'limitations',
      'contradictions',
      'unknowns',
    ]);
    expect(Object.keys(schema['properties'] as object)).toEqual([
      'documentedPositions',
      'inferences',
      'limitations',
      'contradictions',
      'unknowns',
    ]);
  });

  it('closes every nested object and requires every declared property', () => {
    walkSchema(repositoryInterviewProviderOutputV1Schema, (schema) => {
      if (schema['type'] !== 'object') {
        return;
      }
      expect(schema['additionalProperties']).toBe(false);
      const properties = Object.keys(schema['properties'] as object);
      expect(schema['required']).toEqual(properties);
    });
  });

  it.each([
    'candidateId',
    'artifactSetId',
    'artifactId',
    'chunkId',
    'requestId',
    'executionId',
    'interviewId',
    'claimId',
    'citationId',
    'contradictionId',
    'limitationId',
    'unknownId',
    'repositoryIdentity',
    'provider',
    'model',
    'specificationDigest',
    'promptDigest',
    'timestamp',
    'identityDigest',
    'recordDigest',
    'reviewState',
    'ranking',
    'recommendation',
    'metadata',
  ])('rejects trusted or prohibited root field %s', (field) => {
    expectInvalid({ ...createValidProviderOutput(), [field]: 'forbidden' });
  });

  it('rejects trusted fields nested inside semantic items and citations', () => {
    const value = cloneProviderOutput();
    const documented = readArray(value, 'documentedPositions');
    documented[0] = { ...documented[0], claimId: 'forbidden' };
    expectInvalid(value);

    const citationValue = cloneProviderOutput();
    const first = readArray(citationValue, 'documentedPositions')[0]!;
    first['citations'] = [
      { ...citation(1), artifactId: 'forbidden', citationId: 'forbidden' },
    ];
    expectInvalid(citationValue);
  });

  it('rejects missing root and nested properties', () => {
    const root = cloneProviderOutput();
    Reflect.deleteProperty(root, 'unknowns');
    expectInvalid(root);

    const nested = cloneProviderOutput();
    Reflect.deleteProperty(
      readArray(nested, 'documentedPositions')[0]!,
      'confidence',
    );
    expectInvalid(nested);
  });
});

describe('documented positions and inferences', () => {
  it('rejects low documented confidence and missing citations', () => {
    const low = cloneProviderOutput();
    readArray(low, 'documentedPositions')[0]!['confidence'] = 'low';
    expectInvalid(low);

    const uncited = cloneProviderOutput();
    readArray(uncited, 'documentedPositions')[0]!['citations'] = [];
    expectInvalid(uncited);
  });

  it('accepts medium and low inferences but rejects high confidence', () => {
    const value = cloneProviderOutput();
    readArray(value, 'inferences').push({
      topic: 'purpose-and-scope',
      statement: 'A synthetic integration boundary is likely.',
      rationale:
        'The cited setup and extension descriptions create a bounded inferential bridge.',
      confidence: 'medium',
      citations: [citation(20)],
    });
    expectValid(value);

    const low = structuredClone(value);
    readArray(low, 'inferences')[0]!['confidence'] = 'low';
    expectValid(low);

    const high = structuredClone(value);
    readArray(high, 'inferences')[0]!['confidence'] = 'high';
    expectInvalid(high);
  });

  it('rejects missing, empty, or repeated inference rationales and citations', () => {
    const createInference = () => {
      const value = cloneProviderOutput();
      readArray(value, 'inferences').push({
        topic: 'purpose-and-scope',
        statement: 'A synthetic integration boundary is likely.',
        rationale:
          'The cited setup and extension descriptions create a bounded inferential bridge.',
        confidence: 'medium',
        citations: [citation(20)],
      });
      return value;
    };

    const missing = createInference();
    Reflect.deleteProperty(readArray(missing, 'inferences')[0]!, 'rationale');
    expectInvalid(missing);

    const empty = createInference();
    readArray(empty, 'inferences')[0]!['rationale'] = '';
    expectInvalid(empty);

    const repeated = createInference();
    const item = readArray(repeated, 'inferences')[0]!;
    item['rationale'] = item['statement'];
    expectInvalid(repeated, 'provider-output.inference-rationale');

    const uncited = createInference();
    readArray(uncited, 'inferences')[0]!['citations'] = [];
    expectInvalid(uncited);
  });
});

describe('limitations, contradictions, and unknowns', () => {
  it('enforces documented-position limitation cross-fields', () => {
    const valid = cloneProviderOutput();
    readArray(valid, 'limitations').push({
      topic: 'adoption-and-limitations',
      basis: 'documented-position',
      statement: 'The supplied artifacts state a synthetic limitation.',
      rationale: null,
      confidence: 'high',
      citations: [citation(30)],
    });
    expectValid(valid);

    const rationale = structuredClone(valid);
    readArray(rationale, 'limitations')[0]!['rationale'] =
      'A rationale is prohibited for a documented position.';
    expectInvalid(rationale, 'provider-output.limitation-basis');

    const low = structuredClone(valid);
    readArray(low, 'limitations')[0]!['confidence'] = 'low';
    expectInvalid(low);
  });

  it('enforces inference limitation cross-fields and citation presence', () => {
    const valid = cloneProviderOutput();
    readArray(valid, 'limitations').push({
      topic: 'adoption-and-limitations',
      basis: 'inference',
      statement: 'A synthetic operational limitation is likely.',
      rationale:
        'The cited deployment requirement supports a bounded limitation inference.',
      confidence: 'low',
      citations: [citation(31)],
    });
    expectValid(valid);

    const nullRationale = structuredClone(valid);
    readArray(nullRationale, 'limitations')[0]!['rationale'] = null;
    expectInvalid(nullRationale, 'provider-output.limitation-basis');

    const high = structuredClone(valid);
    readArray(high, 'limitations')[0]!['confidence'] = 'high';
    expectInvalid(high);

    const uncited = structuredClone(valid);
    readArray(uncited, 'limitations')[0]!['citations'] = [];
    expectInvalid(uncited);
  });

  it('accepts controlled contradictions without confidence', () => {
    const value = cloneProviderOutput();
    readArray(value, 'contradictions').push({
      topic: 'maintenance-and-support',
      kind: 'version-dependent',
      explanation: 'Two synthetic version-scoped positions differ materially.',
      positionA: {
        statement: 'Synthetic version one supports the feature.',
        citations: [citation(40)],
      },
      positionB: {
        statement: 'Synthetic version two removes the feature.',
        citations: [citation(41)],
      },
    });
    expectValid(value);
  });

  it('rejects contradiction confidence, missing sides, identical sides, and excessive citations', () => {
    const createContradiction = () => {
      const value = cloneProviderOutput();
      readArray(value, 'contradictions').push({
        topic: 'maintenance-and-support',
        kind: 'direct',
        explanation: 'Two synthetic positions differ materially.',
        positionA: {
          statement: 'Synthetic position A applies.',
          citations: [citation(40)],
        },
        positionB: {
          statement: 'Synthetic position B applies.',
          citations: [citation(41)],
        },
      });
      return value;
    };

    const confidence = createContradiction();
    readArray(confidence, 'contradictions')[0]!['confidence'] = 'high';
    expectInvalid(confidence);

    const missing = createContradiction();
    Reflect.deleteProperty(
      readArray(missing, 'contradictions')[0]!,
      'positionB',
    );
    expectInvalid(missing);

    const identical = createContradiction();
    const contradiction = readArray(identical, 'contradictions')[0]!;
    contradiction['positionB'] = structuredClone(contradiction['positionA']);
    expectInvalid(identical, 'provider-output.contradiction-sides');

    const excessive = createContradiction();
    const excessiveItem = readArray(excessive, 'contradictions')[0]!;
    excessiveItem['positionA'] = {
      statement: 'Synthetic position A applies.',
      citations: [citation(40), citation(41), citation(42)],
    };
    expectInvalid(excessive);
  });

  it('accepts scoped unknowns without confidence and rejects universal absence', () => {
    const value = cloneProviderOutput();
    readArray(value, 'unknowns').push({
      topic: 'security-and-trust',
      reason: 'not-documented',
      statement:
        'The supplied artifacts do not establish a synthetic authentication policy.',
      partialCitations: [],
    });
    expectValid(value);

    const confidence = structuredClone(value);
    readArray(confidence, 'unknowns')[0]!['confidence'] = 'low';
    expectInvalid(confidence);

    const universal = structuredClone(value);
    readArray(universal, 'unknowns')[0]!['statement'] =
      'Authentication does not exist anywhere.';
    expectInvalid(universal, 'provider-output.unknown-scope');
  });
});

describe('provider-output semantic bounds and text policy', () => {
  it('enforces citation line order, inclusive span, and duplicates', () => {
    const reversed = cloneProviderOutput();
    readArray(reversed, 'documentedPositions')[0]!['citations'] = [
      citation(20, 19),
    ];
    expectInvalid(reversed, 'provider-output.citation-range');

    const overbroad = cloneProviderOutput();
    readArray(overbroad, 'documentedPositions')[0]!['citations'] = [
      citation(20, 100),
    ];
    expectInvalid(overbroad, 'provider-output.citation-range');

    const duplicate = cloneProviderOutput();
    readArray(duplicate, 'documentedPositions')[0]!['citations'] = [
      citation(20),
      citation(20),
    ];
    expectInvalid(duplicate, 'provider-output.duplicate-citation');

    const duplicateAcrossSides = cloneProviderOutput();
    readArray(duplicateAcrossSides, 'contradictions').push({
      topic: 'maintenance-and-support',
      kind: 'direct',
      explanation: 'Two synthetic positions differ materially.',
      positionA: {
        statement: 'Synthetic position A applies.',
        citations: [citation(40)],
      },
      positionB: {
        statement: 'Synthetic position B applies.',
        citations: [citation(40)],
      },
    });
    expectInvalid(duplicateAcrossSides, 'provider-output.duplicate-citation');
  });

  it('enforces alias and structural line-number bounds', () => {
    const alias = cloneProviderOutput();
    readArray(alias, 'documentedPositions')[0]!['citations'] = [
      { artifactAlias: 'A5', startLine: 1, endLine: 1 },
    ];
    expectInvalid(alias);

    const zero = cloneProviderOutput();
    readArray(zero, 'documentedPositions')[0]!['citations'] = [citation(0)];
    expectInvalid(zero);

    const excessive = cloneProviderOutput();
    readArray(excessive, 'documentedPositions')[0]!['citations'] = [
      citation(10_001),
    ];
    expectInvalid(excessive);
  });

  it('enforces item, claim, citation, and citations-per-item bounds', () => {
    const positions = cloneProviderOutput();
    positions['documentedPositions'] = Array.from(
      { length: 25 },
      (_, index) => ({
        topic: EXPECTED_TOPICS[index % EXPECTED_TOPICS.length],
        statement: `Synthetic bounded position ${String(index + 1)}.`,
        confidence: 'high',
        citations: [citation(index + 1)],
      }),
    );
    expectInvalid(positions);

    const inferences = cloneProviderOutput();
    inferences['inferences'] = Array.from({ length: 9 }, (_, index) => ({
      topic: EXPECTED_TOPICS[index % EXPECTED_TOPICS.length],
      statement: `Synthetic bounded inference ${String(index + 1)}.`,
      rationale: `Synthetic inferential bridge ${String(index + 1)} is bounded by the citation.`,
      confidence: 'medium',
      citations: [citation(index + 100)],
    }));
    expectInvalid(inferences);

    const thirtyTwoClaims = cloneProviderOutput();
    thirtyTwoClaims['documentedPositions'] = Array.from(
      { length: 24 },
      (_, index) => ({
        topic: EXPECTED_TOPICS[index % EXPECTED_TOPICS.length],
        statement: `Synthetic complete position ${String(index + 1)}.`,
        confidence: 'high',
        citations: [citation(index + 1)],
      }),
    );
    thirtyTwoClaims['inferences'] = Array.from({ length: 8 }, (_, index) => ({
      topic: EXPECTED_TOPICS[index],
      statement: `Synthetic complete inference ${String(index + 1)}.`,
      rationale: `Synthetic complete inferential bridge ${String(index + 1)} is bounded.`,
      confidence: 'medium',
      citations: [citation(index + 100)],
    }));
    expectValid(thirtyTwoClaims);

    const fiveCitations = cloneProviderOutput();
    readArray(fiveCitations, 'documentedPositions')[0]!['citations'] =
      Array.from({ length: 5 }, (_, index) => citation(index + 1));
    expectInvalid(fiveCitations);

    const ninetySevenUnique = cloneProviderOutput();
    ninetySevenUnique['documentedPositions'] = Array.from(
      { length: 24 },
      (_, itemIndex) => ({
        topic: EXPECTED_TOPICS[itemIndex % EXPECTED_TOPICS.length],
        statement: `Synthetic cited position ${String(itemIndex + 1)}.`,
        confidence: 'high',
        citations: Array.from({ length: 4 }, (_, citationIndex) =>
          citation(itemIndex * 4 + citationIndex + 1),
        ),
      }),
    );
    ninetySevenUnique['unknowns'] = [
      {
        topic: 'purpose-and-scope',
        reason: 'insufficient-detail',
        statement:
          'The supplied artifacts do not establish one additional synthetic detail.',
        partialCitations: [citation(500)],
      },
    ];
    expectInvalid(ninetySevenUnique, 'provider-output.citation-count');

    const limitations = cloneProviderOutput();
    limitations['limitations'] = Array.from({ length: 13 }, (_, index) => ({
      topic: EXPECTED_TOPICS[index % EXPECTED_TOPICS.length],
      basis: 'documented-position',
      statement: `Synthetic limitation ${String(index + 1)} applies.`,
      rationale: null,
      confidence: 'high',
      citations: [citation(index + 1)],
    }));
    expectInvalid(limitations);

    const contradictions = cloneProviderOutput();
    contradictions['contradictions'] = Array.from(
      { length: 7 },
      (_, index) => ({
        topic: EXPECTED_TOPICS[index % EXPECTED_TOPICS.length],
        kind: 'direct',
        explanation: `Synthetic contradiction ${String(index + 1)} differs.`,
        positionA: {
          statement: `Synthetic side A ${String(index + 1)} applies.`,
          citations: [citation(index * 2 + 1)],
        },
        positionB: {
          statement: `Synthetic side B ${String(index + 1)} applies.`,
          citations: [citation(index * 2 + 2)],
        },
      }),
    );
    expectInvalid(contradictions);

    const unknowns = cloneProviderOutput();
    unknowns['unknowns'] = Array.from({ length: 17 }, (_, index) => ({
      topic: EXPECTED_TOPICS[index % EXPECTED_TOPICS.length],
      reason: 'not-documented',
      statement: `The supplied artifacts do not establish synthetic detail ${String(index + 1)}.`,
      partialCitations: [],
    }));
    expectInvalid(unknowns);
  });

  it('rejects canonical duplicate semantic items without silently deduplicating', () => {
    const duplicate = cloneProviderOutput();
    const documented = readArray(duplicate, 'documentedPositions');
    documented.push(structuredClone(documented[0]!));
    expectInvalid(duplicate, 'provider-output.duplicate-item');

    const reorderedCitations = cloneProviderOutput();
    const first = readArray(reorderedCitations, 'documentedPositions')[0]!;
    first['citations'] = [citation(1), citation(2)];
    readArray(reorderedCitations, 'documentedPositions').push({
      ...structuredClone(first),
      citations: [citation(2), citation(1)],
    });
    expectInvalid(reorderedCitations, 'provider-output.duplicate-item');

    const swappedContradictionSides = cloneProviderOutput();
    const contradiction = {
      topic: 'maintenance-and-support',
      kind: 'direct',
      explanation: 'Two synthetic positions differ materially.',
      positionA: {
        statement: 'Synthetic position A applies.',
        citations: [citation(40)],
      },
      positionB: {
        statement: 'Synthetic position B applies.',
        citations: [citation(41)],
      },
    };
    readArray(swappedContradictionSides, 'contradictions').push(contradiction, {
      ...structuredClone(contradiction),
      positionA: structuredClone(contradiction.positionB),
      positionB: structuredClone(contradiction.positionA),
    });
    expectInvalid(swappedContradictionSides, 'provider-output.duplicate-item');
  });

  it('requires coverage for every controlled topic', () => {
    const missing = cloneProviderOutput();
    readArray(missing, 'documentedPositions').pop();
    expectInvalid(missing, 'provider-output.topic-coverage');
  });

  it.each([
    [' leading whitespace', 'provider-output.string-policy'],
    ['trailing whitespace ', 'provider-output.string-policy'],
    ['nul\u0000value', 'provider-output.string-policy'],
    ['control\u0001value', 'provider-output.string-policy'],
    ['format\u200dvalue', 'provider-output.string-policy'],
    ['https://example.invalid/value', 'provider-output.string-policy'],
    ['[synthetic](relative-target)', 'provider-output.string-policy'],
    ['<script>synthetic</script>', 'provider-output.string-policy'],
  ])('rejects prohibited semantic text %j', (statement, code) => {
    const value = cloneProviderOutput();
    readArray(value, 'documentedPositions')[0]!['statement'] = statement;
    expectInvalid(value, code);
  });

  it('enforces Unicode-scalar and exact UTF-8 round-trip limits without normalization', () => {
    const exact = cloneProviderOutput();
    readArray(exact, 'documentedPositions')[0]!['statement'] = '🧪'.repeat(500);
    expectValid(exact);

    const excessive = cloneProviderOutput();
    readArray(excessive, 'documentedPositions')[0]!['statement'] = '🧪'.repeat(
      501,
    );
    expectInvalid(excessive);

    const invalidRoundTrip = cloneProviderOutput();
    readArray(invalidRoundTrip, 'documentedPositions')[0]!['statement'] =
      'synthetic \ud800 value';
    expectInvalid(invalidRoundTrip, 'provider-output.string-policy');

    const decomposedNfc = cloneProviderOutput();
    readArray(decomposedNfc, 'documentedPositions')[0]!['statement'] =
      'Synthetic cafe\u0301 position.';
    expectValid(decomposedNfc);

    const rationaleExact = cloneProviderOutput();
    readArray(rationaleExact, 'inferences').push({
      topic: 'purpose-and-scope',
      statement: 'A synthetic inference is likely.',
      rationale: '🧪'.repeat(750),
      confidence: 'low',
      citations: [citation(20)],
    });
    expectValid(rationaleExact);

    const rationaleExcessive = structuredClone(rationaleExact);
    readArray(rationaleExcessive, 'inferences')[0]!['rationale'] = '🧪'.repeat(
      751,
    );
    expectInvalid(rationaleExcessive);
  });
});

function walkSchema(
  value: unknown,
  visitor: (schema: Readonly<Record<string, unknown>>) => void,
): void {
  if (Array.isArray(value)) {
    for (const child of value) {
      walkSchema(child, visitor);
    }
    return;
  }
  if (typeof value !== 'object' || value === null) {
    return;
  }
  const record = value as Readonly<Record<string, unknown>>;
  visitor(record);
  for (const child of Object.values(record)) {
    walkSchema(child, visitor);
  }
}
