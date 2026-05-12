import { supabase } from '@/lib/supabase';
import { throwIfError } from '@/utils/errors';
import type { Goal, GoalType } from '@/types';

// ─── Read ─────────────────────────────────────────────────────────────────────

/** Fetch all active goals for a user (up to 10) */
export async function getActiveGoals(userId: string): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(10);

  throwIfError(error, 'getActiveGoals');
  return (data ?? []) as Goal[];
}

/** Get the single active goal of a specific type, or null */
export async function getGoalByType(
  userId: string,
  goalType: GoalType
): Promise<Goal | null> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('goal_type', goalType)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  throwIfError(error, 'getGoalByType');
  return data as Goal | null;
}

/**
 * @deprecated Prefer getActiveGoals() or getGoalByType().
 * Kept for backward compatibility with older callers.
 */
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
  return data as Goal | null;
}

// ─── Write ────────────────────────────────────────────────────────────────────

export interface CreateGoalInput {
  goal_type: GoalType;
  target_grade?: string | null;
  exercise_type?: string | null;
  target_value?: number | null;
  unit?: 'reps' | 'seconds' | null;
  target_date?: string | null;
  notes?: string | null;
}

/**
 * Create a new goal.  Only one active goal per goal_type is allowed —
 * any existing active goal of the same type is abandoned first.
 */
export async function createGoal(userId: string, input: CreateGoalInput): Promise<Goal> {
  if (!userId) throw new Error('createGoal: userId is required');

  // Abandon existing active goal of the same type
  await supabase
    .from('goals')
    .update({ status: 'abandoned', is_active: false })
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('goal_type', input.goal_type);

  const { data, error } = await supabase
    .from('goals')
    .insert({
      user_id: userId,
      goal_type: input.goal_type,
      target_grade: input.target_grade ?? null,
      exercise_type: input.exercise_type ?? null,
      target_value: input.target_value ?? null,
      unit: input.unit ?? null,
      target_date: input.target_date ?? null,
      notes: input.notes ?? null,
      status: 'active',
      is_active: true,
      discipline: input.goal_type,
    })
    .select()
    .single();

  throwIfError(error, 'createGoal');
  return data as Goal;
}

/** Update an existing goal row */
export async function updateGoal(
  goalId: string,
  updates: Partial<CreateGoalInput>
): Promise<Goal> {
  const { data, error } = await supabase
    .from('goals')
    .update(updates)
    .eq('id', goalId)
    .select()
    .single();

  throwIfError(error, 'updateGoal');
  return data as Goal;
}

/** Delete a goal entirely */
export async function deleteGoal(goalId: string): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', goalId);
  throwIfError(error, 'deleteGoal');
}

export async function markGoalAchieved(goalId: string): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .update({ status: 'achieved', is_active: false })
    .eq('id', goalId);
  throwIfError(error, 'markGoalAchieved');
}

/**
 * @deprecated Use createGoal() instead.
 * Kept for backward compat.
 */
export async function upsertGoal(
  userId: string,
  goal: { target_grade: string; target_date: string | null; discipline: string; notes: string | null }
): Promise<Goal> {
  return createGoal(userId, {
    goal_type: (goal.discipline as GoalType) ?? 'bouldering',
    target_grade: goal.target_grade,
    target_date: goal.target_date,
    notes: goal.notes,
  });
}
