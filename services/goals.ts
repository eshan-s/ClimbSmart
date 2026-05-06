import { supabase } from '@/lib/supabase';
import { throwIfError } from '@/utils/errors';
import type { Goal } from '@/types';

export async function getActiveGoal(userId: string): Promise<Goal | null> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  throwIfError(error, 'getActiveGoal');
  return data;
}

export async function upsertGoal(
  userId: string,
  goal: Pick<Goal, 'target_grade' | 'target_date' | 'discipline' | 'notes'>
): Promise<Goal> {
  if (!userId) throw new Error('upsertGoal: userId is required');

  // Abandon any existing active goal
  const { error: abandonError } = await supabase
    .from('goals')
    .update({ status: 'abandoned' })
    .eq('user_id', userId)
    .eq('status', 'active');

  throwIfError(abandonError, 'upsertGoal: abandoning old goal');

  const { data, error } = await supabase
    .from('goals')
    .insert({ user_id: userId, ...goal, status: 'active' })
    .select()
    .single();

  throwIfError(error, 'upsertGoal: inserting new goal');
  return data;
}

export async function markGoalAchieved(goalId: string): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .update({ status: 'achieved' })
    .eq('id', goalId);

  throwIfError(error, 'markGoalAchieved');
}
