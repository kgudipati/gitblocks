export const EXPECTED_TOPICS = [
  'purpose-and-scope',
  'runtime-and-framework',
  'integration-surface',
  'data-and-state',
  'deployment-and-operations',
  'security-and-trust',
  'maintenance-and-support',
  'adoption-and-limitations',
] as const;

export const EXPECTED_QUESTIONS = [
  {
    topic: 'purpose-and-scope',
    question:
      'What capability, intended use, smallest useful adoptable unit, ideal use cases, and explicit out-of-scope or poor-fit boundaries does the repository describe?',
  },
  {
    topic: 'runtime-and-framework',
    question:
      'What runtime, framework, platform, language, or version requirements and compatibility positions are documented or responsibly inferable?',
  },
  {
    topic: 'integration-surface',
    question:
      'What setup path, APIs, configuration surface, extension points, dependencies, or integration boundaries are described?',
  },
  {
    topic: 'data-and-state',
    question:
      'What data model, storage, durability, consistency, migration, or state-management positions are described?',
  },
  {
    topic: 'deployment-and-operations',
    question:
      'What required or optional infrastructure, deployment models, scaling, failure, retry, observability, and operational responsibilities are described?',
  },
  {
    topic: 'security-and-trust',
    question:
      'What authentication, authorization, secret handling, validation, isolation, abuse, or trust-boundary positions are described?',
  },
  {
    topic: 'maintenance-and-support',
    question:
      'What license position, maintenance status, compatibility, upgrade, release, support, or deprecation constraints are documented?',
  },
  {
    topic: 'adoption-and-limitations',
    question:
      'What adoption effort, explicit limitation, tradeoff, contradiction, or material unknown remains after reviewing all supplied artifacts?',
  },
] as const;

export function createValidProviderOutput(): Record<string, unknown> {
  return {
    documentedPositions: EXPECTED_TOPICS.map((topic, index) => ({
      topic,
      statement: `The supplied artifacts state synthetic position ${String(index + 1)}.`,
      confidence: 'high',
      citations: [
        {
          artifactAlias: 'A1',
          startLine: index + 1,
          endLine: index + 1,
        },
      ],
    })),
    inferences: [],
    limitations: [],
    contradictions: [],
    unknowns: [],
  };
}

export function cloneProviderOutput(): Record<string, unknown> {
  return structuredClone(createValidProviderOutput());
}

export function readArray(
  value: Record<string, unknown>,
  key: string,
): Record<string, unknown>[] {
  const candidate = value[key];
  if (!Array.isArray(candidate)) {
    throw new Error('Synthetic fixture is malformed.');
  }
  return candidate as Record<string, unknown>[];
}
