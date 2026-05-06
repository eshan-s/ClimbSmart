import { supabase } from '@/lib/supabase';
import { throwIfError } from '@/utils/errors';
import type { Profile, UserPreferences } from '@/types';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  throwIfError(error, 'getProfile');
  return data;
}

export async function upsertProfile(
  userId: string,
  updates: Partial<Omit<Profile, 'id' | 'created_at'>>
): Promise<Profile> {
  // upsert so the row is created if missing (handles users who existed
  // before the profiles table had rows for them)
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...updates }, { onConflict: 'id' })
    .select()
    .single();

  throwIfError(error, 'upsertProfile');
  return data;
}

/** @deprecated Use upsertProfile instead */
export async function updateProfile(
  userId: string,
  updates: Partial<Omit<Profile, 'id' | 'created_at'>>
): Promise<Profile> {
  return upsertProfile(userId, updates);
}

export async function getPreferences(userId: string): Promise<UserPreferences | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  throwIfError(error, 'getPreferences');
  return data;
}

export async function updatePreferences(
  userId: string,
  updates: Partial<Omit<UserPreferences, 'id' | 'user_id' | 'created_at'>>
): Promise<UserPreferences> {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' })
    .select()
    .single();

  throwIfError(error, 'updatePreferences');
  return data;
}
