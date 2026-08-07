import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import {
  ProfileMaterializationExecuteFailure,
  renderProfileMaterializationCliFailure,
  renderProfileMaterializationExecuteSuccess,
} from '../src/index.ts';

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

  it('renders only the bounded execute stage and safe ingestion code', () => {
    const output = renderProfileMaterializationCliFailure(
      'execute',
      new ProfileMaterializationExecuteFailure(
        'first-collection',
        'ingestion.provider-authentication',
      ),
    );
    expect(output).toBe(
      'Profile materialization command failed safely (stage=first-collection; code=ingestion.provider-authentication).\n',
    );
  });

  it('never renders a raw error, token, password, or database URL', () => {
    const secretText =
      'database refused private-host:6543 token=fake-token password=fake-password postgresql://owner@127.0.0.1/private';
    const output = renderProfileMaterializationCliFailure(
      'execute',
      new Error(secretText),
    );
    expect(output).toBe('Profile materialization command failed safely.\n');
    expect(output).not.toContain(secretText);
    expect(output).not.toContain('fake-token');
    expect(output).not.toContain('fake-password');
    expect(output).not.toContain('postgresql://');
    expect(output).not.toContain('private-host');
  });

  it('renders a zero-state persistence failure without raw database text', () => {
    const output = renderProfileMaterializationCliFailure(
      'execute',
      new ProfileMaterializationExecuteFailure(
        'zero-state-proof',
        'ingestion.persistence',
      ),
    );
    expect(output).toBe(
      'Profile materialization command failed safely (stage=zero-state-proof; code=ingestion.persistence).\n',
    );
    expect(output).not.toContain('ECONNREFUSED');
    expect(output).not.toContain('private-host');
  });

  it('never renders a hostile runtime password from role provisioning', () => {
    const runtimePassword = String.raw`role-'\\-password-;--private`;
    const output = renderProfileMaterializationCliFailure(
      'execute',
      new Error(`runtime role provisioning failed: ${runtimePassword}`),
    );

    expect(output).toBe('Profile materialization command failed safely.\n');
    expect(output).not.toContain(runtimePassword);
    expect(output).not.toContain('role provisioning failed');
  });

  it('keeps successful execute output unchanged', () => {
    expect(
      renderProfileMaterializationExecuteSuccess({
        receipt: {
          receiptSemanticDigest: 'a'.repeat(64),
          receiptRecordDigest: 'b'.repeat(64),
        },
      } as never),
    ).toBe(
      `Profile materialization completed (${'a'.repeat(64)}; ${'b'.repeat(64)}).\n`,
    );
  });
});
