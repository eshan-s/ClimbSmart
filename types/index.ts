// ─── Database row types ───────────────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  height: number | null;
  weight: number | null;
  wingspan: number | null;
  experience_level: string;
  home_gym: string | null;
  climbing_since: number | null;
  created_at: string;
}

// ─── Multi-goal system ────────────────────────────────────────────────────────

export type GoalType = 'bouldering' | 'top_rope' | 'strength';

export interface Goal {
  id: string;
  user_id: string;
  /** New discriminator field; falls back to 'bouldering' for legacy rows */
  goal_type: GoalType;
  /** Grade string for bouldering/top_rope goals (V-scale or YDS) */
  target_grade: string | null;
  /** For strength goals — which exercise */
  exercise_type: string | null;
  /** For strength goals — numeric target (reps or seconds) */
  target_value: number | null;
  /** For strength goals — metric unit */
  unit: 'reps' | 'seconds' | null;
  target_date: string | null;
  status: 'active' | 'achieved' | 'abandoned';
  /** Legacy field kept for backward compat */
  discipline: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ClimbingSession {
  id: string;
  user_id: string;
  date: string;
  duration: number | null;
  gym_name: string | null;
  session_type: 'indoor' | 'outdoor';
  notes: string | null;
  created_at: string;
  climbing_attempts?: ClimbingAttempt[];
}

export type ClimbType = 'slab' | 'overhang' | 'vertical' | 'compression' | 'crimpy' | 'other';
export type RouteType = 'bouldering' | 'top_rope';

export interface ClimbingAttempt {
  id: string;
  session_id: string;
  user_id: string;
  grade: string;
  attempts: number;
  result: 'send' | 'flash' | 'project' | 'fail';
  route_name: string | null;
  /** Style tag — slab, overhang, vertical, compression, crimpy, other */
  style_tag: string | null;
  /** Climb type — bouldering or top_rope */
  route_type: RouteType | null;
  /** Detailed style of movement */
  climb_type: ClimbType | null;
  notes: string | null;
  created_at: string;
}

export interface StrengthSession {
  id: string;
  user_id: string;
  date: string;
  duration: number | null;
  notes: string | null;
  created_at: string;
  strength_entries?: StrengthEntry[];
}

export interface StrengthEntry {
  id: string;
  strength_session_id: string;
  user_id: string;
  exercise_type: string;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  duration: number | null;
  notes: string | null;
  created_at: string;
}

export interface Insight {
  id: string;
  user_id: string;
  summary: string;
  recommendation: string | null;
  type: 'bottleneck' | 'focus' | 'volume' | 'recovery';
  data: Record<string, unknown> | null;
  created_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  theme: 'dark' | 'light';
  notifications_enabled: boolean;
  units: 'imperial' | 'metric';
  created_at: string;
}

// ─── UI / computed types ──────────────────────────────────────────────────────

export interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  dotColor: string;
  date: string;
}

export interface PRMap {
  [exercise: string]: number;
}

// ─── Exercise category definition ────────────────────────────────────────────

export interface ExerciseDef {
  value: string;
  label: string;
  usesDuration: boolean;
}

export interface ExerciseCategory {
  key: string;
  label: string;
  exercises: ExerciseDef[];
}
