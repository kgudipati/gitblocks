import { randomBytes } from 'node:crypto';
import {
  constants,
  link,
  lstat,
  open,
  unlink,
  type FileHandle,
} from 'node:fs/promises';
import { basename, dirname, isAbsolute, join } from 'node:path';

export async function readBoundedNoFollowTextFileV1(
  path: string,
  maximumBytes: number,
): Promise<string> {
  if (!isAbsolute(path) || maximumBytes < 1) throw invalid();
  let handle: FileHandle | undefined;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maximumBytes) throw invalid();
    const bytes = await handle.readFile();
    if (bytes.byteLength > maximumBytes) throw invalid();
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw invalid();
  } finally {
    if (handle !== undefined) await handle.close().catch(() => undefined);
  }
}

export async function writeExclusiveAtomicPreliveOutputsV1(
  outputs: readonly [
    { readonly path: string; readonly content: string },
    { readonly path: string; readonly content: string },
  ],
): Promise<void> {
  if (
    outputs[0].path === outputs[1].path ||
    outputs.some(
      ({ path, content }) =>
        !isAbsolute(path) ||
        !content.endsWith('\n') ||
        content.endsWith('\n\n') ||
        content.charCodeAt(0) === 0xfeff,
    )
  )
    throw invalid();
  const temporaries: string[] = [];
  const published: string[] = [];
  try {
    for (const output of outputs) {
      await assertAbsent(output.path);
      const temporary = join(
        dirname(output.path),
        `.${basename(output.path)}.${randomBytes(16).toString('hex')}.tmp`,
      );
      temporaries.push(temporary);
      const handle = await open(
        temporary,
        constants.O_CREAT |
          constants.O_EXCL |
          constants.O_NOFOLLOW |
          constants.O_WRONLY,
        0o600,
      );
      try {
        await handle.writeFile(output.content, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
    }
    for (let index = 0; index < outputs.length; index += 1) {
      const output = outputs[index];
      const temporary = temporaries[index];
      if (output === undefined || temporary === undefined) throw invalid();
      await link(temporary, output.path);
      published.push(output.path);
      await unlink(temporary);
    }
    for (const directory of new Set(outputs.map(({ path }) => dirname(path)))) {
      await flushDirectory(directory);
    }
  } catch {
    for (const path of published.reverse()) {
      await unlink(path).catch(() => undefined);
    }
    throw invalid();
  } finally {
    for (const temporary of temporaries) {
      await unlink(temporary).catch(() => undefined);
    }
  }
}

async function assertAbsent(path: string): Promise<void> {
  try {
    await lstat(path);
    throw invalid();
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    )
      return;
    throw invalid();
  }
}

async function flushDirectory(path: string): Promise<void> {
  let handle: FileHandle | undefined;
  try {
    handle = await open(path, constants.O_RDONLY);
    await handle.sync();
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error.code === 'EINVAL' || error.code === 'ENOTSUP')
    )
      return;
    throw error;
  } finally {
    if (handle !== undefined) await handle.close().catch(() => undefined);
  }
}

function invalid(): Error {
  const error = new Error(
    'Repository interview pre-live file operation failed.',
  );
  Object.defineProperty(error, 'stack', { value: undefined });
  return error;
}
