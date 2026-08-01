import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { serializeCanonicalJson } from '@gitblocks/interviews';

import { REPOSITORY_INTERVIEW_OPERATOR_SCHEMA_SNAPSHOTS } from '../src/schema-snapshots.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const command = process.argv[2];
if (command !== 'generate' && command !== 'validate') {
  throw new Error('Operator schema command is invalid.');
}

for (const [name, schema] of Object.entries(
  REPOSITORY_INTERVIEW_OPERATOR_SCHEMA_SNAPSHOTS,
)) {
  const path = join(root, 'schemas', name);
  const expected = serializeCanonicalJson(schema);
  if (command === 'generate') {
    await writeFile(path, expected, { encoding: 'utf8' });
  } else {
    const actual = await readFile(path, 'utf8');
    if (actual !== expected) throw new Error('Operator schema snapshot drift.');
  }
}

process.stdout.write(`Operator schema ${command} passed (6 schemas).\n`);
