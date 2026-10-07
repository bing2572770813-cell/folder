/** Convert arbitrary thrown values into stable diagnostics without throwing again. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  try {
    const value = String(error);
    return value === '[object Object]' || value === 'null' || value === 'undefined' ? 'Unknown error' : value;
  } catch {
    return 'Unknown error';
  }
}

export function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const code = (error as {code?: unknown}).code;
  return typeof code === 'string' ? code : undefined;
}
