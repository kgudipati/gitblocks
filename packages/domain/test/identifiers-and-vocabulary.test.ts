import { describe, expect, it } from 'vitest';

import {
  CAPABILITY_FAMILIES,
  MAXIMUM_DOMAIN_ISSUES,
  STABLE_ID_MAX_LENGTH,
  createStableId,
} from '../src/index.ts';

describe('domain vocabulary and stable identifiers', () => {
  it('owns exactly the five private-alpha capability families', () => {
    expect(CAPABILITY_FAMILIES).toEqual([
      'authorization',
      'audit-logging',
      'background-jobs',
      'rate-limiting',
      'webhooks',
    ]);
  });

  it('creates a bounded normalized opaque identifier', () => {
    expect(createStableId('candidate', 'candidate-1')).toEqual({
      ok: true,
      value: 'candidate-1',
    });
    expect(
      createStableId('candidate', 'a'.repeat(STABLE_ID_MAX_LENGTH)),
    ).toEqual({
      ok: true,
      value: 'a'.repeat(STABLE_ID_MAX_LENGTH),
    });
  });

  it.each([
    [' Candidate-1 ', 'id.normalization'],
    ['é', 'id.normalization'],
    ['bad_id', 'id.format'],
    ['bad\u000aid', 'id.format'],
    ['', 'id.length'],
    ['a'.repeat(STABLE_ID_MAX_LENGTH + 1), 'id.length'],
  ])('rejects non-normalized or malformed identifier %j', (value, code) => {
    const result = createStableId('candidate', value);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toContain(code);
      if (value.length > 0) {
        expect(
          result.issues.every((issue) => !issue.message.includes(value)),
        ).toBe(true);
      }
    }
  });

  it('returns deterministic bounded value-safe issues', () => {
    const result = createStableId(
      'candidate',
      `${'A'.repeat(STABLE_ID_MAX_LENGTH)}_`,
      'x'.repeat(400),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeLessThanOrEqual(MAXIMUM_DOMAIN_ISSUES);
      expect(result.issues.map((issue) => issue.code)).toEqual([
        'id.format',
        'id.length',
        'id.normalization',
      ]);
      expect(result.issues.every((issue) => issue.path.length <= 256)).toBe(
        true,
      );
      expect(result.issues.every((issue) => issue.message.length <= 160)).toBe(
        true,
      );
    }
  });
});
