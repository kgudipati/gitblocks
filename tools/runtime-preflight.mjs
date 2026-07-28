import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const PREFLIGHT_EXIT_CODES = Object.freeze({
  failure: 1,
  success: 0,
  usage: 2,
});
export const RUNTIME_CAPABILITY_SOURCE =
  "interface RuntimeCapability {\n  readonly marker: 'gitblocks-native-typescript';\n}\n\nconst runtimeCapability: RuntimeCapability = {\n  marker: 'gitblocks-native-typescript',\n};\n\nvoid runtimeCapability;\n";
export const SUPPORTED_NODE_RANGE = '>=24.12.0 <25';

const CAPABILITY_FIXTURE_PATH =
  'tools/repository-checks/test/fixtures/runtime-capability.ts';
const MAX_CAPABILITY_BYTES = 512;
const MAX_DIAGNOSTIC_CHARACTERS = 512;
const MAX_VERSION_CHARACTERS = 64;
const MAX_VERSION_FILE_BYTES = 64;
const MINIMUM_NODE_VERSION = Object.freeze({
  major: 24,
  minor: 12,
  patch: 0,
});
const REPOSITORY_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export function evaluateNodeVersion(version) {
  const parsedVersion = parseVersion(version);
  return (
    parsedVersion !== undefined &&
    parsedVersion.major === MINIMUM_NODE_VERSION.major &&
    compareVersions(parsedVersion, MINIMUM_NODE_VERSION) >= 0
  );
}

export function evaluateRuntime({
  actualNodeVersion = process.versions.node,
  executeCapability = executeRuntimeCapability,
  repositoryRoot = REPOSITORY_ROOT,
} = {}) {
  const nodePin = readVersionPin(repositoryRoot, '.node-version');
  if (!nodePin.ok) {
    return runtimeFailure(nodePin.reason, actualNodeVersion, 'unavailable');
  }

  const nvmPin = readVersionPin(repositoryRoot, '.nvmrc');
  if (!nvmPin.ok) {
    return runtimeFailure(nvmPin.reason, actualNodeVersion, nodePin.version);
  }
  if (nodePin.version !== nvmPin.version) {
    return runtimeFailure(
      `.node-version (${nodePin.version}) and .nvmrc (${nvmPin.version}) disagree.`,
      actualNodeVersion,
      nodePin.version,
    );
  }
  if (!evaluateNodeVersion(nodePin.version)) {
    return runtimeFailure(
      `Repository pin ${nodePin.version} is outside the supported range.`,
      actualNodeVersion,
      nodePin.version,
    );
  }

  if (!evaluateNodeVersion(actualNodeVersion)) {
    return runtimeFailure(
      `Node ${boundedInline(actualNodeVersion)} is unsupported or malformed.`,
      actualNodeVersion,
      nodePin.version,
    );
  }

  const fixtureResult = validateCapabilityFixture(repositoryRoot);
  if (!fixtureResult.ok) {
    return runtimeFailure(
      fixtureResult.reason,
      actualNodeVersion,
      nodePin.version,
    );
  }
  if (!executeCapability(fixtureResult.path, repositoryRoot)) {
    return runtimeFailure(
      'The active runtime cannot execute the repository-owned direct TypeScript capability fixture.',
      actualNodeVersion,
      nodePin.version,
    );
  }

  return { ok: true, repositoryPin: nodePin.version };
}

export function runRuntimePreflight({
  actualNodeVersion = process.versions.node,
  executeCapability = executeRuntimeCapability,
  repositoryRoot = REPOSITORY_ROOT,
  showSuccess = false,
  writeError = (message) => process.stderr.write(`${message}\n`),
  writeOutput = (message) => process.stdout.write(`${message}\n`),
} = {}) {
  const result = evaluateRuntime({
    actualNodeVersion,
    executeCapability,
    repositoryRoot,
  });
  if (!result.ok) {
    writeError(result.message);
    return PREFLIGHT_EXIT_CODES.failure;
  }
  if (showSuccess) {
    writeOutput(
      `GitBlocks runtime preflight passed with Node ${actualNodeVersion}.`,
    );
  }
  return PREFLIGHT_EXIT_CODES.success;
}

function readVersionPin(repositoryRoot, fileName) {
  const filePath = join(repositoryRoot, fileName);
  let status;
  try {
    status = lstatSync(filePath);
  } catch {
    return {
      ok: false,
      reason: `${fileName} is missing or unreadable.`,
    };
  }
  if (
    status.isSymbolicLink() ||
    !status.isFile() ||
    status.size > MAX_VERSION_FILE_BYTES
  ) {
    return {
      ok: false,
      reason: `${fileName} must be a small regular version file.`,
    };
  }

  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return {
      ok: false,
      reason: `${fileName} is missing or unreadable.`,
    };
  }
  const version = normalizeVersionFile(content);
  if (version === undefined) {
    return {
      ok: false,
      reason: `${fileName} must contain one exact decimal Node version.`,
    };
  }
  return { ok: true, version };
}

function normalizeVersionFile(content) {
  const version = content.trim();
  if (
    content !== version &&
    content !== `${version}\n` &&
    content !== `${version}\r\n`
  ) {
    return undefined;
  }
  return parseVersion(version) === undefined ? undefined : version;
}

function parseVersion(version) {
  if (
    typeof version !== 'string' ||
    version.length === 0 ||
    version.length > MAX_VERSION_CHARACTERS
  ) {
    return undefined;
  }
  const match = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.exec(
    version,
  );
  if (match === null) {
    return undefined;
  }
  const components = match.slice(1).map(Number);
  if (
    components.length !== 3 ||
    components.some((component) => !Number.isSafeInteger(component))
  ) {
    return undefined;
  }
  return {
    major: components[0],
    minor: components[1],
    patch: components[2],
  };
}

function compareVersions(left, right) {
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) {
      return left[key] < right[key] ? -1 : 1;
    }
  }
  return 0;
}

function validateCapabilityFixture(repositoryRoot) {
  const fixturePath = join(repositoryRoot, CAPABILITY_FIXTURE_PATH);
  let status;
  try {
    status = lstatSync(fixturePath);
  } catch {
    return {
      ok: false,
      reason: 'The direct TypeScript capability fixture is missing.',
    };
  }
  if (
    status.isSymbolicLink() ||
    !status.isFile() ||
    status.size > MAX_CAPABILITY_BYTES
  ) {
    return {
      ok: false,
      reason:
        'The direct TypeScript capability fixture must be a small regular file.',
    };
  }

  let source;
  try {
    source = readFileSync(fixturePath, 'utf8');
  } catch {
    return {
      ok: false,
      reason: 'The direct TypeScript capability fixture is unreadable.',
    };
  }
  if (source !== RUNTIME_CAPABILITY_SOURCE) {
    return {
      ok: false,
      reason:
        'The direct TypeScript capability fixture changed; refusing to execute it.',
    };
  }
  return { ok: true, path: fixturePath };
}

function executeRuntimeCapability(fixturePath, repositoryRoot) {
  const result = spawnSync(process.execPath, [fixturePath], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 1_024,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 5_000,
  });
  return (
    result.error === undefined && result.signal === null && result.status === 0
  );
}

function runtimeFailure(reason, actualNodeVersion, repositoryPin) {
  const message = [
    `GitBlocks runtime preflight failed: ${reason}`,
    `Actual Node ${boundedInline(actualNodeVersion)}; supported ${SUPPORTED_NODE_RANGE}; repository pin ${boundedInline(repositoryPin)}.`,
    'Activate a supported runtime (for example: nvm install && nvm use).',
  ].join(' ');
  return {
    message: message.slice(0, MAX_DIAGNOSTIC_CHARACTERS),
    ok: false,
  };
}

function boundedInline(value) {
  const normalized = Array.from(String(value), (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127 ? '?' : character;
  }).join('');
  return normalized.length <= MAX_VERSION_CHARACTERS
    ? normalized
    : `${normalized.slice(0, MAX_VERSION_CHARACTERS - 1)}…`;
}

function runMain(arguments_) {
  if (
    arguments_.length > 1 ||
    (arguments_.length === 1 && arguments_[0] !== '--show-success')
  ) {
    process.stderr.write(
      'Usage: node tools/runtime-preflight.mjs [--show-success]\n',
    );
    return PREFLIGHT_EXIT_CODES.usage;
  }
  return runRuntimePreflight({
    showSuccess: arguments_[0] === '--show-success',
  });
}

const entryPoint = process.argv[1];
if (
  entryPoint !== undefined &&
  resolve(entryPoint) === resolve(fileURLToPath(import.meta.url))
) {
  process.exitCode = runMain(process.argv.slice(2));
}
