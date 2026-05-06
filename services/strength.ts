import { supabase } from '@/lib/supabase';
import { throwIfError } from '@/utils/errors';
import type { PRMap, StrengthEntry, StrengthSession } from '@/types';

export async function getStrengthSessions(
  userId: string,
  limit = 10
): Promise<StrengthSession[]> {
  const { data, error } = await supabase
    .from('strength_sessions')
    .select('*, strength_entries(*)')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit);

  throwIfError(error, 'getStrengthSessions');
  return (data ?? []) as StrengthSession[];
}

export async function createStrengthSession(
  session: Omit<StrengthSession, 'id' | 'created_at' | 'strength_entries'>
): Promise<StrengthSession> {
  if (!session.user_id) throw new Error('createStrengthSession: user_id is required');

  const { data, error } = await supabase
    .from('strength_sessions')
    .insert(session)
    .select()
    .single();

  throwIfError(error, 'createStrengthSession');
  return data;
}

export async function addStrengthEntries(
  entries: Omit<StrengthEntry, 'id' | 'created_at'>[]
): Promise<void> {
  if (!entries.length) return;

  for (const e of entries) {
    if (!e.user_id) throw new Error('addStrengthEntries: each entry must have user_id');
    if (!e.strength_session_id) throw new Error('addStrengthEntries: each entry must have strength_session_id');
  }

  const { error } = await supabase.from('strength_entries').insert(entries);
  throwIfError(error, 'addStrengthEntries');
}

export function computePRs(sessions: StrengthSession[]): PRMap {
  const entries = sessions.flatMap((s) => s.strength_entries ?? []);
  const prs: PRMap = {};

  for (const e of entries) {
    const key = e.exercise_type;
    if (e.reps != null && e.reps > 0) {
      prs[`${key}_reps`] = Math.max(prs[`${key}_reps`] ?? 0, e.reps);
    }
    if (e.duration != null && e.duration > 0) {
      prs[`${key}_duration`] = Math.max(prs[`${key}_duration`] ?? 0, e.duration);
    }
    if (e.weight != null && e.weight > 0) {
      prs[`${key}_weight`] = Math.max(prs[`${key}_weight`] ?? 0, e.weight);
    }
  }

  return prs;
}

export function lastSessionDate(sessions: StrengthSession[], exerciseType: string): string | null {
  const match = sessions.find((s) =>
    (s.strength_entries ?? []).some((e) => e.exercise_type === exerciseType)
  );
  return match?.date ?? null;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
