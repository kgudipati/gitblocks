/* global Buffer, TextDecoder, process */

import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const CONTRACT_VERSION = '1.0.0';
const SUPPORTED_REPOSITORY_FACT_VOCABULARY_VERSION = '1.0.0';
const PACKAGE_JSON_MAXIMUM_BYTES = 1024 * 1024;
const REFERENCE_STDIN_MAXIMUM_BYTES = 256 * 1024;

const CONTENT_READ_PATHS = Object.freeze(['package.json']);
const EXISTENCE_ONLY_PATHS = Object.freeze([
  'tsconfig.json',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'pnpm-workspace.yaml',
]);

const LOCKFILE_MANAGER_BY_PATH = Object.freeze({
  'pnpm-lock.yaml': 'pnpm',
  'package-lock.json': 'npm',
  'yarn.lock': 'yarn',
  'bun.lock': 'bun',
  'bun.lockb': 'bun',
});

const FRAMEWORK_BY_DEPENDENCY = Object.freeze({
  next: 'next',
  express: 'express',
  fastify: 'fastify',
  '@nestjs/core': 'nestjs',
  hono: 'hono',
});

const ORM_BY_DEPENDENCY = Object.freeze({
  '@prisma/client': 'prisma',
  'drizzle-orm': 'drizzle',
});

const POSTGRESQL_DEPENDENCIES = Object.freeze([
  'pg',
  'postgres',
  '@neondatabase/serverless',
  '@vercel/postgres',
]);
const REDIS_DEPENDENCIES = Object.freeze([
  'redis',
  'ioredis',
  '@upstash/redis',
]);
const QUEUE_DEPENDENCIES = Object.freeze(['bullmq', 'bull', 'pg-boss']);
const SCHEDULER_DEPENDENCIES = Object.freeze(['node-cron', 'cron']);
const RECOGNIZED_DEPENDENCIES = Object.freeze([
  ...Object.keys(FRAMEWORK_BY_DEPENDENCY),
  ...Object.keys(ORM_BY_DEPENDENCY),
  ...POSTGRESQL_DEPENDENCIES,
  ...REDIS_DEPENDENCIES,
  ...QUEUE_DEPENDENCIES,
  ...SCHEDULER_DEPENDENCIES,
]);

const WITHHELD_CATEGORIES = Object.freeze([
  'raw-source',
  'configuration-values',
  'environment',
  'credentials',
  'logs',
  'database-content',
  'untracked-files',
  'command-output',
  'identity-facts',
  'data-facts',
  'operational-facts',
]);

const ALLOWED_WITHHELD_CATEGORIES = new Set([
  ...WITHHELD_CATEGORIES,
  'dependency-facts',
]);
const PACKAGE_MANAGERS = new Set(['npm', 'pnpm', 'yarn', 'bun']);
const NODE_ENGINE_DECLARATION_PATTERN =
  /^(?:[<>=~^]\s*)*(?:v?\d+|[xX*])(?:[0-9A-Za-z.*+<>=~^|,\-\s]*)$/u;

class ScannerFailure extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

async function main() {
  const command = parseArguments(process.argv.slice(2));
  if (command.mode === 'reference') {
    await writeFingerprintReference();
    return;
  }
  const fingerprint = await scanRepository(
    command.repositoryRoot,
    command.observedAt,
  );
  process.stdout.write(`${JSON.stringify(fingerprint, null, 2)}\n`);
}

function parseArguments(arguments_) {
  if (arguments_.length === 1 && arguments_[0] === '--reference') {
    return { mode: 'reference' };
  }

  let repositoryRoot = null;
  let observedAt = null;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--observed-at') {
      if (observedAt !== null || index + 1 >= arguments_.length) {
        throw new ScannerFailure('invalid-arguments');
      }
      observedAt = normalizeUtcTimestamp(arguments_[index + 1]);
      index += 1;
      continue;
    }
    if (argument?.startsWith('--') === true || repositoryRoot !== null) {
      throw new ScannerFailure('invalid-arguments');
    }
    repositoryRoot = argument ?? null;
  }
  if (repositoryRoot === null) {
    throw new ScannerFailure('invalid-arguments');
  }
  return {
    mode: 'scan',
    repositoryRoot,
    observedAt: observedAt ?? new Date().toISOString(),
  };
}

function normalizeUtcTimestamp(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/u.test(
      value,
    )
  ) {
    throw new ScannerFailure('invalid-observed-at');
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new ScannerFailure('invalid-observed-at');
  }
  const normalized = new Date(milliseconds).toISOString();
  const normalizedInput = value.includes('.')
    ? value.replace(
        /\.(\d{1,3})Z$/u,
        (_, fraction) => `.${fraction.padEnd(3, '0')}Z`,
      )
    : value.replace(/Z$/u, '.000Z');
  if (normalized !== normalizedInput) {
    throw new ScannerFailure('invalid-observed-at');
  }
  return normalized;
}

async function scanRepository(repositoryRoot, observedAt) {
  const canonicalRoot = await resolveRepositoryRoot(repositoryRoot);
  const manifestPath = await contentInputPath(canonicalRoot, 'package.json');
  const manifest =
    manifestPath === null
      ? Object.create(null)
      : parsePackageManifest(
          await readBoundedRegularFile(
            manifestPath,
            PACKAGE_JSON_MAXIMUM_BYTES,
          ),
        );

  const exists = new Map();
  for (const path of EXISTENCE_ONLY_PATHS) {
    exists.set(path, await ordinaryContainedFileExists(canonicalRoot, path));
  }

  const facts = createFacts({ manifest, exists, observedAt });
  facts.sort((left, right) => compareText(left.factId, right.factId));
  const base = {
    contractVersion: CONTRACT_VERSION,
    factVocabularyVersion: SUPPORTED_REPOSITORY_FACT_VOCABULARY_VERSION,
    facts,
    withheldCategories: [...WITHHELD_CATEGORIES],
  };
  const fingerprintMaterial = { ...base, observedAt };
  return {
    contractVersion: base.contractVersion,
    factVocabularyVersion: base.factVocabularyVersion,
    fingerprintId: `fingerprint-${sha256Hex(canonicalJson(fingerprintMaterial)).slice(0, 48)}`,
    facts: base.facts,
    withheldCategories: base.withheldCategories,
  };
}

async function resolveRepositoryRoot(repositoryRoot) {
  try {
    const resolvedRoot = resolve(repositoryRoot);
    const canonicalRoot = await realpath(resolvedRoot);
    const status = await lstat(canonicalRoot);
    if (!status.isDirectory()) {
      throw new ScannerFailure('repository-root-not-directory');
    }
    return canonicalRoot;
  } catch (error) {
    if (error instanceof ScannerFailure) throw error;
    throw new ScannerFailure('repository-root-unavailable');
  }
}

async function contentInputPath(canonicalRoot, relativePath) {
  if (!CONTENT_READ_PATHS.includes(relativePath)) {
    throw new ScannerFailure('content-path-not-authorized');
  }
  const candidate = resolve(canonicalRoot, relativePath);
  let status;
  try {
    status = await lstat(candidate);
  } catch (error) {
    if (isMissing(error)) return null;
    throw new ScannerFailure('input-inspection-failed');
  }
  if (status.isSymbolicLink()) {
    throw new ScannerFailure('content-input-symlink');
  }
  if (!status.isFile()) {
    throw new ScannerFailure('content-input-not-regular');
  }
  let canonicalCandidate;
  try {
    canonicalCandidate = await realpath(candidate);
  } catch {
    throw new ScannerFailure('input-inspection-failed');
  }
  if (!isContained(canonicalRoot, canonicalCandidate)) {
    throw new ScannerFailure('content-input-outside-root');
  }
  return canonicalCandidate;
}

async function ordinaryContainedFileExists(canonicalRoot, relativePath) {
  if (!EXISTENCE_ONLY_PATHS.includes(relativePath)) {
    throw new ScannerFailure('existence-path-not-authorized');
  }
  const candidate = resolve(canonicalRoot, relativePath);
  let status;
  try {
    status = await lstat(candidate);
  } catch (error) {
    if (isMissing(error)) return false;
    throw new ScannerFailure('input-inspection-failed');
  }
  if (status.isSymbolicLink()) {
    diagnostic('existence-input-symlink-ignored');
    return false;
  }
  if (!status.isFile()) {
    diagnostic('existence-input-not-regular-ignored');
    return false;
  }
  let canonicalCandidate;
  try {
    canonicalCandidate = await realpath(candidate);
  } catch {
    throw new ScannerFailure('input-inspection-failed');
  }
  if (!isContained(canonicalRoot, canonicalCandidate)) {
    diagnostic('existence-input-outside-root-ignored');
    return false;
  }
  return true;
}

async function readBoundedRegularFile(path, maximumBytes) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const status = await handle.stat();
    if (!status.isFile()) {
      throw new ScannerFailure('content-input-not-regular');
    }
    if (status.size > maximumBytes) {
      throw new ScannerFailure('package-json-too-large');
    }
    const buffer = Buffer.alloc(maximumBytes + 1);
    let total = 0;
    while (total < buffer.length) {
      const result = await handle.read(
        buffer,
        total,
        buffer.length - total,
        total,
      );
      if (result.bytesRead === 0) break;
      total += result.bytesRead;
    }
    if (total > maximumBytes) {
      throw new ScannerFailure('package-json-too-large');
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(
        buffer.subarray(0, total),
      );
    } catch {
      throw new ScannerFailure('package-json-invalid-utf8');
    }
  } catch (error) {
    if (error instanceof ScannerFailure) throw error;
    throw new ScannerFailure('content-read-failed');
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function parsePackageManifest(text) {
  try {
    const value = JSON.parse(text);
    if (!isPlainRecord(value)) {
      throw new ScannerFailure('package-json-invalid');
    }
    return value;
  } catch (error) {
    if (error instanceof ScannerFailure) throw error;
    throw new ScannerFailure('package-json-invalid');
  }
}

function createFacts({ manifest, exists, observedAt }) {
  const facts = [];
  const dependencies = dependencyNames(manifest.dependencies);
  const developmentDependencies = dependencyNames(manifest.devDependencies);

  if (
    exists.get('tsconfig.json') === true ||
    dependencies.has('typescript') ||
    developmentDependencies.has('typescript')
  ) {
    facts.push(
      componentFact(
        'language',
        'typescript',
        exists.get('tsconfig.json') === true
          ? 'configuration-shape'
          : 'manifest',
        observedAt,
      ),
    );
  }

  if (validNodeEngine(manifest.engines)) {
    facts.push(componentFact('runtime', 'node', 'manifest', observedAt));
  }

  const packageManager = resolvePackageManager(manifest.packageManager, exists);
  if (packageManager !== null) {
    facts.push(
      componentFact(
        'package-manager',
        packageManager.name,
        packageManager.origin,
        observedAt,
      ),
    );
  }

  const frameworks = recognizedMappings(dependencies, FRAMEWORK_BY_DEPENDENCY);
  if (frameworks.length === 1) {
    facts.push(
      componentFact('framework', frameworks[0], 'manifest', observedAt),
    );
  } else if (frameworks.length > 1) {
    diagnostic('framework-signals-ambiguous');
  }

  const orms = recognizedMappings(dependencies, ORM_BY_DEPENDENCY);
  if (orms.length === 1) {
    facts.push(componentFact('orm', orms[0], 'manifest', observedAt));
  } else if (orms.length > 1) {
    diagnostic('orm-signals-ambiguous');
  }

  if (hasAny(dependencies, POSTGRESQL_DEPENDENCIES)) {
    facts.push(componentFact('database', 'postgresql', 'manifest', observedAt));
  }

  for (const dependency of RECOGNIZED_DEPENDENCIES) {
    if (dependencies.has(dependency)) {
      facts.push(
        componentFact('dependency', dependency, 'manifest', observedAt),
      );
    }
  }

  if (hasAny(dependencies, REDIS_DEPENDENCIES)) {
    facts.push(presenceFact('redis', observedAt));
  }
  if (hasAny(dependencies, QUEUE_DEPENDENCIES)) {
    facts.push(presenceFact('queue-capability', observedAt));
  }
  if (hasAny(dependencies, SCHEDULER_DEPENDENCIES)) {
    facts.push(presenceFact('scheduler-capability', observedAt));
  }

  const workspaceOrigin = workspaceDeclarationOrigin(manifest, exists);
  if (workspaceOrigin !== null) {
    facts.push(workspaceFact(workspaceOrigin, observedAt));
  }
  return facts;
}

function dependencyNames(value) {
  const result = new Set();
  if (!isPlainRecord(value)) return result;
  for (const [name, version] of Object.entries(value)) {
    if (typeof version === 'string') result.add(name);
  }
  return result;
}

function validNodeEngine(value) {
  return (
    isPlainRecord(value) &&
    typeof value.node === 'string' &&
    value.node.length > 0 &&
    value.node.length <= 100 &&
    value.node.trim() === value.node &&
    !containsControlCharacter(value.node) &&
    NODE_ENGINE_DECLARATION_PATTERN.test(value.node)
  );
}

function containsControlCharacter(value) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
}

function resolvePackageManager(value, exists) {
  const manifestManager = packageManagerName(value);
  const lockfileManagers = new Set();
  for (const [path, manager] of Object.entries(LOCKFILE_MANAGER_BY_PATH)) {
    if (exists.get(path) === true) lockfileManagers.add(manager);
  }
  if (lockfileManagers.size > 1) {
    diagnostic('package-manager-signals-ambiguous');
    return null;
  }
  const lockfileManager = [...lockfileManagers][0] ?? null;
  if (
    manifestManager !== null &&
    lockfileManager !== null &&
    manifestManager !== lockfileManager
  ) {
    diagnostic('package-manager-signals-conflict');
    return null;
  }
  if (manifestManager !== null) {
    return { name: manifestManager, origin: 'manifest' };
  }
  return lockfileManager === null
    ? null
    : { name: lockfileManager, origin: 'lockfile' };
}

function packageManagerName(value) {
  if (typeof value !== 'string') return null;
  const match = /^(npm|pnpm|yarn|bun)(?:@\S+)?$/u.exec(value);
  return match !== null && PACKAGE_MANAGERS.has(match[1]) ? match[1] : null;
}

function recognizedMappings(dependencies, mapping) {
  return Object.entries(mapping)
    .filter(([dependency]) => dependencies.has(dependency))
    .map(([, name]) => name);
}

function hasAny(dependencies, choices) {
  return choices.some((dependency) => dependencies.has(dependency));
}

function workspaceDeclarationOrigin(manifest, exists) {
  const workspaces = manifest.workspaces;
  const manifestDeclaresWorkspaces =
    nonemptyStringArray(workspaces) ||
    (isPlainRecord(workspaces) && nonemptyStringArray(workspaces.packages));
  if (manifestDeclaresWorkspaces) return 'manifest';
  return exists.get('pnpm-workspace.yaml') === true
    ? 'repository-structure'
    : null;
}

function nonemptyStringArray(value) {
  return (
    Array.isArray(value) &&
    value.some((entry) => typeof entry === 'string' && entry.trim().length > 0)
  );
}

function componentFact(component, name, origin, observedAt) {
  const semantic = { kind: 'component', component, name, version: null };
  return {
    kind: 'component',
    factId: factId(semantic),
    component,
    name,
    version: null,
    provenance: directProvenance(origin, observedAt),
  };
}

function presenceFact(code, observedAt) {
  const semantic = {
    kind: 'coded',
    category: 'repository-capability',
    code,
    subjectCode: null,
    value: { kind: 'presence', state: 'present' },
  };
  return {
    kind: 'coded',
    factId: factId(semantic),
    category: semantic.category,
    code,
    subjectCode: null,
    value: semantic.value,
    provenance: {
      origin: 'scanner-analysis',
      epistemicStatus: 'derived',
      confidence: 'high',
      observedAt,
    },
  };
}

function workspaceFact(origin, observedAt) {
  const semantic = {
    kind: 'coded',
    category: 'repository-structure',
    code: 'workspace-layout',
    subjectCode: null,
    value: { kind: 'classification', code: 'multi-package' },
  };
  return {
    kind: 'coded',
    factId: factId(semantic),
    category: semantic.category,
    code: semantic.code,
    subjectCode: null,
    value: semantic.value,
    provenance: directProvenance(origin, observedAt),
  };
}

function directProvenance(origin, observedAt) {
  return {
    origin,
    epistemicStatus: 'direct',
    confidence: 'high',
    observedAt,
  };
}

function factId(semantic) {
  return `fact-${sha256Hex(canonicalJson(semantic)).slice(0, 48)}`;
}

async function writeFingerprintReference() {
  const text = await readBoundedStdin(REFERENCE_STDIN_MAXIMUM_BYTES);
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ScannerFailure('reference-input-invalid');
  }
  assertFingerprintReferenceInput(value);
  const canonical = canonicalizeFingerprintForDigest(value);
  process.stdout.write(
    `${JSON.stringify(
      {
        fingerprintId: value.fingerprintId,
        fingerprintDigest: sha256Hex(canonicalJson(canonical)),
      },
      null,
      2,
    )}\n`,
  );
}

async function readBoundedStdin(maximumBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of process.stdin) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += bytes.length;
    if (total > maximumBytes) {
      throw new ScannerFailure('reference-input-too-large');
    }
    chunks.push(bytes);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(
      Buffer.concat(chunks, total),
    );
  } catch {
    throw new ScannerFailure('reference-input-invalid');
  }
}

function assertFingerprintReferenceInput(value) {
  if (
    !isPlainRecord(value) ||
    !hasExactKeys(value, [
      'contractVersion',
      'factVocabularyVersion',
      'fingerprintId',
      'facts',
      'withheldCategories',
    ]) ||
    value.contractVersion !== CONTRACT_VERSION ||
    value.factVocabularyVersion !==
      SUPPORTED_REPOSITORY_FACT_VOCABULARY_VERSION ||
    typeof value.fingerprintId !== 'string' ||
    !/^fingerprint-[0-9a-f]{48}$/u.test(value.fingerprintId) ||
    !Array.isArray(value.facts) ||
    value.facts.length > 200 ||
    !Array.isArray(value.withheldCategories) ||
    value.withheldCategories.length > 12
  ) {
    throw new ScannerFailure('reference-input-invalid');
  }
  const factIds = new Set();
  for (const fact of value.facts) {
    if (
      !isPlainRecord(fact) ||
      typeof fact.factId !== 'string' ||
      !/^fact-[0-9a-f]{48}$/u.test(fact.factId) ||
      factIds.has(fact.factId) ||
      !['component', 'deployment', 'coded'].includes(fact.kind)
    ) {
      throw new ScannerFailure('reference-input-invalid');
    }
    factIds.add(fact.factId);
    if (
      fact.kind === 'coded' &&
      isPlainRecord(fact.value) &&
      fact.value.kind === 'code-set' &&
      (!Array.isArray(fact.value.codes) ||
        fact.value.codes.some((code) => typeof code !== 'string'))
    ) {
      throw new ScannerFailure('reference-input-invalid');
    }
  }
  const withheld = new Set();
  for (const category of value.withheldCategories) {
    if (
      typeof category !== 'string' ||
      !ALLOWED_WITHHELD_CATEGORIES.has(category) ||
      withheld.has(category)
    ) {
      throw new ScannerFailure('reference-input-invalid');
    }
    withheld.add(category);
  }
}

function canonicalizeFingerprintForDigest(value) {
  return {
    contractVersion: value.contractVersion,
    factVocabularyVersion: value.factVocabularyVersion,
    fingerprintId: value.fingerprintId,
    facts: value.facts
      .map((fact) =>
        fact.kind === 'coded' &&
        isPlainRecord(fact.value) &&
        fact.value.kind === 'code-set'
          ? {
              ...fact,
              value: {
                ...fact.value,
                codes: [...fact.value.codes].sort(compareText),
              },
            }
          : { ...fact },
      )
      .sort((left, right) => compareText(left.factId, right.factId)),
    withheldCategories: [...value.withheldCategories].sort(compareText),
  };
}

function canonicalJson(value) {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  }
  if (!isPlainRecord(value)) {
    throw new ScannerFailure('canonical-json-invalid');
  }
  const entries = Object.keys(value)
    .sort(compareText)
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
  return `{${entries.join(',')}}`;
}

function sha256Hex(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function hasExactKeys(value, expected) {
  const keys = Object.keys(value).sort(compareText);
  return (
    keys.length === expected.length &&
    expected
      .slice()
      .sort(compareText)
      .every((key, index) => key === keys[index])
  );
}

function isPlainRecord(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isContained(root, candidate) {
  const pathFromRoot = relative(root, candidate);
  return (
    pathFromRoot === '' ||
    (pathFromRoot !== '..' &&
      !pathFromRoot.startsWith(`..${sep}`) &&
      !isAbsolute(pathFromRoot))
  );
}

function isMissing(error) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

function diagnostic(code) {
  process.stderr.write(`gitblocks-scanner: ${code}\n`);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

main().catch((error) => {
  diagnostic(error instanceof ScannerFailure ? error.code : 'internal-error');
  process.exitCode = 1;
});
