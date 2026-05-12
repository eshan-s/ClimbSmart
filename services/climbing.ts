import { supabase } from '@/lib/supabase';
import { throwIfError } from '@/utils/errors';
import type { ClimbingAttempt, ClimbingSession } from '@/types';

export async function getClimbingSessions(
  userId: string,
  limit = 10
): Promise<ClimbingSession[]> {
  const { data, error } = await supabase
    .from('climbing_sessions')
    .select('*, climbing_attempts(*)')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit);

  throwIfError(error, 'getClimbingSessions');
  return (data ?? []) as ClimbingSession[];
}

export async function createClimbingSession(
  session: Omit<ClimbingSession, 'id' | 'created_at' | 'climbing_attempts'>
): Promise<ClimbingSession> {
  if (!session.user_id) throw new Error('createClimbingSession: user_id is required');

  const { data, error } = await supabase
    .from('climbing_sessions')
    .insert(session)
    .select()
    .single();

  throwIfError(error, 'createClimbingSession');
  return data;
}

export async function addClimbingAttempts(
  attempts: Omit<ClimbingAttempt, 'id' | 'created_at'>[]
): Promise<void> {
  if (!attempts.length) return;

  for (const a of attempts) {
    if (!a.user_id) throw new Error('addClimbingAttempts: each attempt must have user_id');
    if (!a.session_id) throw new Error('addClimbingAttempts: each attempt must have session_id');
  }

  // Always insert the full payload. route_type and climb_type are confirmed live
  // schema columns. Never strip fields: that would corrupt top-rope climbs by
  // defaulting route_type to 'bouldering' (the DB column default).
  const { error } = await supabase.from('climbing_attempts').insert(attempts);

  if (error) {
    // PostgREST schema cache can lag after an ALTER TABLE.  Surface a clear,
    // actionable message instead of a generic DB error so the user knows exactly
    // what to run to resolve it.
    const isSchemaCache =
      error.message.includes('schema cache') ||
      error.message.includes('climb_type') ||
      error.message.includes('route_type') ||
      error.message.includes('Could not find the');

    if (isSchemaCache) {
      throw new Error(
        'The database schema cache is stale — PostgREST has not yet loaded the ' +
        'climb_type / route_type columns.\n\n' +
        'Fix: open the Supabase SQL Editor and run:\n' +
        '  NOTIFY pgrst, \'reload schema\';\n\n' +
        'Then try saving again. No data was lost.\n\n' +
        `(original: ${error.message})`
      );
    }

    throwIfError(error, 'addClimbingAttempts');
  }
}

export async function getProjects(userId: string): Promise<ClimbingAttempt[]> {
  const { data, error } = await supabase
    .from('climbing_attempts')
    .select('*')
    .eq('user_id', userId)
    .eq('result', 'project')
    .order('created_at', { ascending: false });

  throwIfError(error, 'getProjects');
  return data ?? [];
}

export async function getAllAttempts(userId: string): Promise<ClimbingAttempt[]> {
  const { data, error } = await supabase
    .from('climbing_attempts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  throwIfError(error, 'getAllAttempts');
  return data ?? [];
}

export function calcSessionsThisWeek(sessions: ClimbingSession[]): number {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return sessions.filter((s) => new Date(s.date) >= weekAgo).length;
}

export function calcStreak(sessions: ClimbingSession[]): number {
  if (!sessions.length) return 0;
  const dayMs = 86_400_000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const uniqueDays = [
    ...new Set(
      sessions.map((s) => {
        const d = new Date(s.date);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })
    ),
  ].sort((a, b) => b - a);

  let streak = 0;
  let cursor = today.getTime();

  for (const day of uniqueDays) {
    if (day === cursor || day === cursor - dayMs) {
      streak++;
      cursor = day - dayMs;
    } else if (day < cursor - dayMs) {
      break;
    }
  }
  return streak;
}
