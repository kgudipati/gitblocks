import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

const executeFile = promisify(execFile);

describe('profile-materialization CLI denial boundary', () => {
  it('loads from source without compiling and rejects non-command input safely', async () => {
    await expect(
      executeFile(
        process.execPath,
        [
          '--conditions=gitblocks-source',
          'packages/ingestion/scripts/profile-materialization-cli.ts',
          'unexpected',
        ],
        {
          cwd: new URL('../../../', import.meta.url),
          env: { PATH: process.env['PATH'] },
        },
      ),
    ).rejects.toMatchObject({
      code: 2,
      stderr:
        'Profile materialization command rejected unexpected arguments.\n',
      stdout: '',
    });
  }, 20_000);
});
