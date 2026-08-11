import { ingestionError } from './errors.ts';

export const CANDIDATE_AUTHORITY_MAXIMUM_LICENSE_PATH_BYTES = 1_024 as const;

export function isSafeCandidateAuthorityRepositoryRelativePath(
  value: unknown,
): value is string {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    Buffer.byteLength(value, 'utf8') >
      CANDIDATE_AUTHORITY_MAXIMUM_LICENSE_PATH_BYTES ||
    /[\p{Cc}]/u.test(value) ||
    value.startsWith('/') ||
    value.includes('\\') ||
    value.includes('?') ||
    value.includes('#') ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value)
  )
    return false;
  const segments = value.split('/');
  return segments.every(
    (segment) => segment.length > 0 && segment !== '.' && segment !== '..',
  );
}

export function isCandidateAuthorityGitObjectSha(
  value: unknown,
): value is string {
  return typeof value === 'string' && /^[a-f0-9]{40}$/u.test(value);
}

export function encodeCandidateAuthorityRepositoryRelativePath(
  path: unknown,
): string {
  if (!isSafeCandidateAuthorityRepositoryRelativePath(path)) invalid();
  return path.split('/').map(encodeURIComponent).join('/');
}

export function candidateAuthorityImmutableGitHubFileLocation(input: {
  readonly owner: string;
  readonly repository: string;
  readonly commitSha: string;
  readonly path: string;
}): { readonly sourceUrl: string; readonly immutableUrl: string } {
  if (
    !isSafeRepositoryIdentityPart(input.owner) ||
    !isSafeRepositoryIdentityPart(input.repository) ||
    !isCandidateAuthorityGitObjectSha(input.commitSha)
  )
    invalid();
  const root = `https://github.com/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repository)}`;
  return Object.freeze({
    sourceUrl: root,
    immutableUrl: `${root}/blob/${input.commitSha}/${encodeCandidateAuthorityRepositoryRelativePath(input.path)}`,
  });
}

function isSafeRepositoryIdentityPart(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 100 &&
    !/[\p{Cc}/\\?#]/u.test(value)
  );
}

function invalid(): never {
  throw ingestionError('ingestion.invalid-input');
}
