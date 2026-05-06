import { supabase } from '@/lib/supabase';
import { throwIfError } from '@/utils/errors';
import type { Insight } from '@/types';
import { gradeToNum, numToGrade } from '@/utils/grades';

// ─── Full metrics snapshot ─────────────────────────────────────────────────────

export interface InsightsData {
  // climbing
  totalClimbSessions: number;
  climbSessionsThisWeek: number;
  totalAttempts: number;
  totalSends: number;
  sendRate: number;                       // 0-100 %
  avgAttemptsPerSession: number;
  maxGradeNum: number;                    // -1 if none
  maxGradeLabel: string;
  gradeProgression: { date: string; grade: number }[];  // chronological sends
  // strength
  totalStrengthSessions: number;
  strengthSessionsThisWeek: number;
  prs: Record<string, number>;
  // balance & load
  climbToStrengthRatio: number;           // climb / (climb + strength)
  overloadRisk: boolean;                  // ≥7 sessions in last 14 days
  recentSessionsLast14: number;
  // goal
  goalGradeLabel: string | null;
  goalGradeNum: number;
  goalTargetDate: string | null;
  goalProgressPct: number;               // 0-100 based on grade gap from V0 → target
  // bottleneck
  bottleneck: 'finger_strength' | 'pulling_strength' | 'technique' | 'volume' | 'recovery' | null;
  weeklyVolume: { week: string; label: string; climb: number; strength: number }[];
}

// ─── Fetch all user data and compute metrics ───────────────────────────────────

export async function fetchInsightsData(userId: string): Promise<InsightsData> {
  const [
    { data: climbSessions, error: e1 },
    { data: attempts, error: e2 },
    { data: strengthSessions, error: e3 },
    { data: strengthEntries, error: e4 },
    { data: goalRows, error: e5 },
  ] = await Promise.all([
    supabase.from('climbing_sessions').select('*').eq('user_id', userId).order('date'),
    supabase.from('climbing_attempts').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('strength_sessions').select('*').eq('user_id', userId).order('date'),
    supabase.from('strength_entries').select('*').eq('user_id', userId),
    supabase.from('goals').select('*').eq('user_id', userId).eq('status', 'active').limit(1),
  ]);

  throwIfError(e1, 'fetchInsightsData: climbing_sessions');
  throwIfError(e2, 'fetchInsightsData: climbing_attempts');
  throwIfError(e3, 'fetchInsightsData: strength_sessions');
  throwIfError(e4, 'fetchInsightsData: strength_entries');
  throwIfError(e5, 'fetchInsightsData: goals');

  const cs = climbSessions ?? [];
  const ca = attempts ?? [];
  const ss = strengthSessions ?? [];
  const se = strengthEntries ?? [];
  const goal = (goalRows ?? [])[0] ?? null;

  // ── Climbing metrics ─────────────────────────────────────────────────────────
  const sends = ca.filter((a) => a.result === 'send' || a.result === 'flash');
  const sendRate = ca.length > 0 ? Math.round((sends.length / ca.length) * 100) : 0;
  const avgAttemptsPerSession =
    cs.length > 0 ? Math.round((ca.length / cs.length) * 10) / 10 : 0;

  const maxGradeNum = sends.length
    ? Math.max(...sends.map((a) => gradeToNum(a.grade)).filter((n) => n >= 0))
    : -1;
  const maxGradeLabel = maxGradeNum >= 0 ? numToGrade(maxGradeNum) : 'None';

  // Grade progression: first send of each grade over time
  const progression: { date: string; grade: number }[] = [];
  const gradesSeen = new Set<number>();
  for (const a of sends) {
    const g = gradeToNum(a.grade);
    if (g >= 0 && !gradesSeen.has(g)) {
      gradesSeen.add(g);
      progression.push({ date: a.created_at ?? '', grade: g });
    }
  }
  progression.sort((a, b) => a.date.localeCompare(b.date));

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const climbSessionsThisWeek = cs.filter((s) => new Date(s.date) >= weekAgo).length;

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const recentClimb = cs.filter((s) => new Date(s.date) >= twoWeeksAgo).length;
  const recentStrength = ss.filter((s) => new Date(s.date) >= twoWeeksAgo).length;
  const recentSessionsLast14 = recentClimb + recentStrength;

  // ── Strength metrics ─────────────────────────────────────────────────────────
  const prs: Record<string, number> = {};
  for (const e of se) {
    const key = e.exercise_type;
    if (e.reps != null && e.reps > 0) prs[`${key}_reps`] = Math.max(prs[`${key}_reps`] ?? 0, e.reps);
    if (e.duration != null && e.duration > 0) prs[`${key}_duration`] = Math.max(prs[`${key}_duration`] ?? 0, e.duration);
    if (e.weight != null && e.weight > 0) prs[`${key}_weight`] = Math.max(prs[`${key}_weight`] ?? 0, e.weight);
  }

  const strengthSessionsThisWeek = ss.filter((s) => new Date(s.date) >= weekAgo).length;
  const totalSessions = cs.length + ss.length;
  const climbToStrengthRatio = totalSessions > 0 ? cs.length / totalSessions : 0.5;

  // ── Goal metrics ─────────────────────────────────────────────────────────────
  const goalGradeNum = goal ? gradeToNum(goal.target_grade) : -1;
  const goalProgressPct =
    goalGradeNum >= 0 && maxGradeNum >= 0
      ? Math.min(100, Math.round((maxGradeNum / goalGradeNum) * 100))
      : 0;

  // ── Bottleneck ───────────────────────────────────────────────────────────────
  const pullUpPR = prs['pullups_reps'] ?? 0;
  const deadHangPR = prs['deadhang_duration'] ?? 0;
  let bottleneck: InsightsData['bottleneck'] = null;

  if (recentSessionsLast14 >= 7) {
    bottleneck = 'recovery';
  } else if (maxGradeNum >= 6 && deadHangPR > 0 && deadHangPR < 30) {
    bottleneck = 'finger_strength';
  } else if (maxGradeNum >= 6 && pullUpPR > 0 && pullUpPR < 8) {
    bottleneck = 'pulling_strength';
  } else if (pullUpPR >= 12 && maxGradeNum >= 0 && maxGradeNum < 5) {
    bottleneck = 'technique';
  } else if (cs.length >= 4 && ss.length === 0) {
    bottleneck = 'volume';
  }

  // ── Weekly volume (last 6 weeks) ─────────────────────────────────────────────
  const weeklyVolume = buildWeeklyVolume(cs, ss, 6);

  return {
    totalClimbSessions: cs.length,
    climbSessionsThisWeek,
    totalAttempts: ca.length,
    totalSends: sends.length,
    sendRate,
    avgAttemptsPerSession,
    maxGradeNum,
    maxGradeLabel,
    gradeProgression: progression,
    totalStrengthSessions: ss.length,
    strengthSessionsThisWeek,
    prs,
    climbToStrengthRatio,
    overloadRisk: recentSessionsLast14 >= 7,
    recentSessionsLast14,
    goalGradeLabel: goal?.target_grade ?? null,
    goalGradeNum,
    goalTargetDate: goal?.target_date ?? null,
    goalProgressPct,
    bottleneck,
    weeklyVolume,
  };
}

// ─── Rule-based insights engine ───────────────────────────────────────────────

interface InsightCandidate {
  summary: string;
  recommendation: string;
  type: Insight['type'];
}

function buildCandidates(d: InsightsData): InsightCandidate[] {
  const candidates: InsightCandidate[] = [];
  const pullUpPR = d.prs['pullups_reps'] ?? 0;
  const deadHangPR = d.prs['deadhang_duration'] ?? 0;

  if (d.overloadRisk) {
    candidates.push({
      type: 'recovery',
      summary: `High volume — ${d.recentSessionsLast14} sessions in the last 2 weeks`,
      recommendation: 'Insert a deload week with no hard climbing to let tendons recover.',
    });
  }

  if (d.maxGradeNum >= 6 && deadHangPR > 0 && deadHangPR < 30) {
    candidates.push({
      type: 'bottleneck',
      summary: 'Finger strength is a primary limiter at your grade',
      recommendation: 'Run a 4-week hangboard repeater protocol on 20mm edge, 3× per week.',
    });
  }

  if (d.maxGradeNum >= 6 && pullUpPR > 0 && pullUpPR < 8) {
    candidates.push({
      type: 'bottleneck',
      summary: 'Pull strength lagging behind your climbing grade',
      recommendation: 'Add weighted pull-ups and lock-off training 2–3× per week.',
    });
  }

  if (pullUpPR >= 12 && d.maxGradeNum >= 0 && d.maxGradeNum < 5) {
    candidates.push({
      type: 'focus',
      summary: 'Upper body strength exceeds your current grade — technique gap detected',
      recommendation: 'Focus on footwork drills, slab climbing, and reading sequences.',
    });
  }

  if (
    d.goalGradeNum >= 0 &&
    d.maxGradeNum >= 0 &&
    d.maxGradeNum === d.goalGradeNum - 1
  ) {
    candidates.push({
      type: 'focus',
      summary: `One grade away from your goal (${d.goalGradeLabel})`,
      recommendation:
        'Increase project attempts on your goal grade and run a 3-week strength peaking block.',
    });
  }

  if (d.totalClimbSessions >= 4 && d.totalStrengthSessions === 0) {
    candidates.push({
      type: 'focus',
      summary: 'No strength training logged alongside your climbing',
      recommendation:
        'Add 2 supplemental sessions per week (hangboard + antagonist) to accelerate progress.',
    });
  }

  if (d.sendRate < 30 && d.totalAttempts >= 20) {
    candidates.push({
      type: 'focus',
      summary: `Low send rate (${d.sendRate}%) — projecting is good but mix in easier sends`,
      recommendation: 'Spend 20% of each session on sub-max sends to build confidence and volume.',
    });
  }

  if (candidates.length === 0 && d.totalClimbSessions > 0) {
    candidates.push({
      type: 'focus',
      summary: 'Training is consistent — keep building volume and project attempts',
      recommendation: 'Aim for 3–4 quality sessions per week and track projects carefully.',
    });
  }

  return candidates;
}

export async function generateAndSaveInsights(userId: string): Promise<Insight[]> {
  const metricsData = await fetchInsightsData(userId);
  const candidates = buildCandidates(metricsData);

  const { error: delError } = await supabase
    .from('insights')
    .delete()
    .eq('user_id', userId);
  throwIfError(delError, 'generateAndSaveInsights: delete old');

  if (!candidates.length) return [];

  const { data, error } = await supabase
    .from('insights')
    .insert(
      candidates.map((c) => ({
        user_id: userId,
        summary: c.summary,
        recommendation: c.recommendation,
        type: c.type,
        data: {
          maxGradeNum: metricsData.maxGradeNum,
          pullUpPR: metricsData.prs['pullups_reps'] ?? 0,
          deadHangPR: metricsData.prs['deadhang_duration'] ?? 0,
          recentCount: metricsData.recentSessionsLast14,
          sendRate: metricsData.sendRate,
        },
      }))
    )
    .select();

  throwIfError(error, 'generateAndSaveInsights: insert');
  return data ?? [];
}

export async function getInsights(userId: string): Promise<Insight[]> {
  const { data, error } = await supabase
    .from('insights')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  throwIfError(error, 'getInsights');
  return data ?? [];
}

// ─── Weekly volume builder (pure, no DB call) ─────────────────────────────────

function buildWeeklyVolume(
  climbSessions: { date: string }[],
  strengthSessions: { date: string }[],
  weeks: number
): InsightsData['weeklyVolume'] {
  const result = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date();
    start.setDate(start.getDate() - (i + 1) * 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const startT = start.getTime();
    const endT = end.getTime();

    const climb = climbSessions.filter((s) => {
      const t = new Date(s.date).getTime();
      return t >= startT && t < endT;
    }).length;

    const strength = strengthSessions.filter((s) => {
      const t = new Date(s.date).getTime();
      return t >= startT && t < endT;
    }).length;

    const weekLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    result.push({ week: `W${weeks - i}`, label: weekLabel, climb, strength });
  }
  return result;
}

/** @deprecated — use fetchInsightsData instead for the full dataset */
export async function getWeeklyVolume(
  userId: string,
  weeks = 6
): Promise<{ week: string; climb: number; strength: number }[]> {
  const [{ data: cs }, { data: ss }] = await Promise.all([
    supabase.from('climbing_sessions').select('date').eq('user_id', userId),
    supabase.from('strength_sessions').select('date').eq('user_id', userId),
  ]);
  return buildWeeklyVolume(cs ?? [], ss ?? [], weeks);
}
