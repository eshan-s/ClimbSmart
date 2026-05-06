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

export interface Goal {
  id: string;
  user_id: string;
  target_grade: string;
  target_date: string | null;
  status: 'active' | 'achieved' | 'abandoned';
  discipline: string;
  notes: string | null;
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

export interface ClimbingAttempt {
  id: string;
  session_id: string;
  user_id: string;
  grade: string;
  attempts: number;
  result: 'send' | 'flash' | 'project' | 'fail';
  route_name: string | null;
  style_tag: string | null;
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
  theme: string;
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
