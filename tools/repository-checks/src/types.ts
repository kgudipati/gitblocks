export interface Diagnostic {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

export function diagnostic(
  code: string,
  message: string,
  path?: string,
): Diagnostic {
  return path === undefined ? { code, message } : { code, message, path };
}
