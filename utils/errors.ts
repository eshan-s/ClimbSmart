import { PostgrestError } from '@supabase/supabase-js';

/**
 * Converts a Supabase PostgREST error into a human-readable string that
 * includes the hint when available (very useful for RLS / permission errors).
 */
export function formatSupabaseError(err: PostgrestError | Error | unknown): string {
  if (!err) return 'Unknown error';

  // PostgrestError shape
  if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err
  ) {
    const pg = err as PostgrestError;
    const parts: string[] = [pg.message];
    if (pg.details) parts.push(`Details: ${pg.details}`);
    if (pg.hint) parts.push(`Hint: ${pg.hint}`);
    if (pg.code) parts.push(`Code: ${pg.code}`);
    return parts.join('\n');
  }

  return String(err);
}

/**
 * Throw a formatted error from a Supabase result.
 * Usage: throwIfError(error, 'Could not save session')
 */
export function throwIfError(
  error: PostgrestError | null | undefined,
  context = 'Database operation failed'
): void {
  if (!error) return;
  const msg = formatSupabaseError(error);
  console.error(`[Supabase] ${context}:`, msg);
  throw new Error(`${context}: ${msg}`);
}
