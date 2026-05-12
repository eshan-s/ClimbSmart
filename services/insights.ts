import { supabase } from '@/lib/supabase';
import { throwIfError } from '@/utils/errors';
import type { Insight } from '@/types';
import { gradeToNum, numToGrade, ydsToNum, numToYds } from '@/utils/grades';

// ─── Full metrics snapshot ─────────────────────────────────────────────────────

export interface ClimbTypeMetrics {
  totalAttempts: number;
  totalSends: number;
  sendRate: number;
  maxGradeNum: number;
  maxGradeLabel: string;
  gradeProgression: { date: string; grade: number }[];
}

export interface InsightsData {
  // climbing (combined)
  totalClimbSessions: number;
  climbSessionsThisWeek: number;
  totalAttempts: number;
  totalSends: number;
  sendRate: number;
  avgAttemptsPerSession: number;
  maxGradeNum: number;
  maxGradeLabel: string;
  gradeProgression: { date: string; grade: number }[];
  // per-discipline
  bouldering: ClimbTypeMetrics;
  topRope: ClimbTypeMetrics;
  // strength
  totalStrengthSessions: number;
  strengthSessionsThisWeek: number;
  prs: Record<string, number>;
  // balance & load
  climbToStrengthRatio: number;
  overloadRisk: boolean;
  recentSessionsLast14: number;
  // goal
  goalGradeLabel: string | null;
  goalGradeNum: number;
  goalTargetDate: string | null;
  goalProgressPct: number;
  // bottleneck
  bottleneck: 'finger_strength' | 'pulling_strength' | 'technique' | 'volume' | 'recovery' | null;
  weeklyVolume: { week: string; label: string; climb: number; strength: number }[];
}

// ─── Compute per-discipline metrics ───────────────────────────────────────────

function computeClimbMetrics(
  attempts: { grade: string; result: string; route_type?: string | null; created_at?: string }[],
  routeType: 'bouldering' | 'top_rope'
): ClimbTypeMetrics {
  const filtered = attempts.filter((a) =>
    routeType === 'bouldering'
      ? (a.route_type == null || a.route_type === 'bouldering')
      : a.route_type === 'top_rope'
  );
  const sends = filtered.filter((a) => a.result === 'send' || a.result === 'flash');
  const sendRate = filtered.length > 0 ? Math.round((sends.length / filtered.length) * 100) : 0;

  let maxGradeNum = -1;
  if (sends.length) {
    const nums = sends.map((a) =>
      routeType === 'bouldering' ? gradeToNum(a.grade) : ydsToNum(a.grade)
    ).filter((n) => n >= 0);
    if (nums.length) maxGradeNum = Math.max(...nums);
  }
  const maxGradeLabel =
    maxGradeNum >= 0
      ? routeType === 'bouldering' ? numToGrade(maxGradeNum) : numToYds(maxGradeNum)
      : 'None';

  // Grade progression
  const progression: { date: string; grade: number }[] = [];
  const gradesSeen = new Set<number>();
  for (const a of sends) {
    const g = routeType === 'bouldering' ? gradeToNum(a.grade) : ydsToNum(a.grade);
    if (g >= 0 && !gradesSeen.has(g)) {
      gradesSeen.add(g);
      progression.push({ date: a.created_at ?? '', grade: g });
    }
  }
  progression.sort((a, b) => a.date.localeCompare(b.date));

  return { totalAttempts: filtered.length, totalSends: sends.length, sendRate, maxGradeNum, maxGradeLabel, gradeProgression: progression };
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

  // ── Combined climbing metrics ──────────────────────────────────────────────
  const sends = ca.filter((a) => a.result === 'send' || a.result === 'flash');
  const sendRate = ca.length > 0 ? Math.round((sends.length / ca.length) * 100) : 0;
  const avgAttemptsPerSession = cs.length > 0 ? Math.round((ca.length / cs.length) * 10) / 10 : 0;

  const maxGradeNum = sends.length
    ? Math.max(...sends.map((a) => gradeToNum(a.grade)).filter((n) => n >= 0), -1)
    : -1;
  const maxGradeLabel = maxGradeNum >= 0 ? numToGrade(maxGradeNum) : 'None';

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

  // ── Per-discipline metrics ─────────────────────────────────────────────────
  const bouldering = computeClimbMetrics(ca, 'bouldering');
  const topRope = computeClimbMetrics(ca, 'top_rope');

  // ── Strength metrics ───────────────────────────────────────────────────────
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

  // ── Goal metrics ───────────────────────────────────────────────────────────
  const goalGradeNum = goal ? gradeToNum(goal.target_grade) : -1;
  const goalProgressPct =
    goalGradeNum >= 0 && maxGradeNum >= 0
      ? Math.min(100, Math.round((maxGradeNum / goalGradeNum) * 100))
      : 0;

  // ── Bottleneck ─────────────────────────────────────────────────────────────
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

  // ── Weekly volume ──────────────────────────────────────────────────────────
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
    bouldering,
    topRope,
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

// ─── Rule catalog — the complete list of all insight rules ────────────────────
//
// Each rule has an id, trigger description, data used, calculation, and action.
//
// RULE 001 — Overload Risk
//   Trigger:  recentSessionsLast14 >= 7
//   Data:     climbing_sessions + strength_sessions in last 14 days
//   Action:   Recommend deload week
//
// RULE 002 — Finger Strength Gap
//   Trigger:  maxGradeNum >= 6 AND deadHangPR > 0 AND deadHangPR < 30 seconds
//   Data:     climbing_attempts (sends only, V-grade), strength_entries (deadhang duration)
//   Action:   Recommend hangboard repeater protocol
//
// RULE 003 — Pull Strength Gap
//   Trigger:  maxGradeNum >= 6 AND pullUpPR > 0 AND pullUpPR < 8 reps
//   Data:     climbing_attempts (sends only), strength_entries (pullups_reps PR)
//   Action:   Recommend weighted pull-up training
//
// RULE 004 — Technique Gap
//   Trigger:  pullUpPR >= 12 AND maxGradeNum >= 0 AND maxGradeNum < 5
//   Data:     strength_entries (pullups_reps PR), climbing_attempts (V-grade sends)
//   Rationale: Strong pull but low grade → movement inefficiency is the limiter
//   Action:   Recommend footwork drills and slab climbing
//
// RULE 005 — Goal Proximity
//   Trigger:  goalGradeNum >= 0 AND maxGradeNum === goalGradeNum - 1
//   Data:     active goal target_grade, climbing_attempts (max send grade)
//   Action:   Recommend project sessions + 3-week strength peak
//
// RULE 006 — Missing Strength Work
//   Trigger:  totalClimbSessions >= 4 AND totalStrengthSessions === 0
//   Data:     climbing_sessions count, strength_sessions count
//   Action:   Recommend 2 supplemental sessions per week
//
// RULE 007 — Low Send Rate (Bouldering)
//   Trigger:  bouldering.sendRate < 30 AND bouldering.totalAttempts >= 20
//   Data:     climbing_attempts filtered to bouldering route_type
//   Rationale: Very low send rate suggests difficulty is too high or training skewed
//   Action:   Recommend mixing sub-max sends
//
// RULE 008 — Top Rope Endurance
//   Trigger:  topRope.totalAttempts >= 10 AND topRope.sendRate < 50
//   Data:     climbing_attempts filtered to top_rope route_type
//   Rationale: Low TR send rate suggests endurance is the limiter (not power)
//   Action:   Recommend ARC training and long easy laps
//
// RULE 009 — Consistency (default positive rule)
//   Trigger:  none of the above fired AND totalClimbSessions > 0
//   Data:     any
//   Action:   Encourage keeping volume and project attempts steady

export interface InsightRule {
  id: string;
  name: string;
  trigger: string;
  dataUsed: string[];
  calculation: string;
  type: Insight['type'];
}

export const INSIGHT_RULES: InsightRule[] = [
  {
    id: 'R001',
    name: 'Overload Risk',
    trigger: 'recentSessionsLast14 ≥ 7',
    dataUsed: ['climbing_sessions (last 14 days)', 'strength_sessions (last 14 days)'],
    calculation: 'Count all climbing + strength sessions in the past 14 days. If ≥ 7, risk is flagged.',
    type: 'recovery',
  },
  {
    id: 'R002',
    name: 'Finger Strength Gap',
    trigger: 'maxGradeNum ≥ 6 AND deadHangPR > 0 AND deadHangPR < 30s',
    dataUsed: ['climbing_attempts (V-grade sends)', 'strength_entries (deadhang_duration PR)'],
    calculation: 'Max bouldering grade (V-scale numeric ≥ 6) but dead hang PR under 30 seconds signals finger strength as limiter.',
    type: 'bottleneck',
  },
  {
    id: 'R003',
    name: 'Pull Strength Gap',
    trigger: 'maxGradeNum ≥ 6 AND pullUpPR > 0 AND pullUpPR < 8 reps',
    dataUsed: ['climbing_attempts (V-grade sends)', 'strength_entries (pullups_reps PR)'],
    calculation: 'V6+ climber but pull-up max under 8 reps — pulling strength is under-developed relative to grade.',
    type: 'bottleneck',
  },
  {
    id: 'R004',
    name: 'Technique Gap',
    trigger: 'pullUpPR ≥ 12 reps AND maxGradeNum < 5',
    dataUsed: ['strength_entries (pullups_reps PR)', 'climbing_attempts (max send grade)'],
    calculation: 'Strong pull (≥ 12 reps) but below V5 — strength exceeds grade, technique is the bottleneck.',
    type: 'focus',
  },
  {
    id: 'R005',
    name: 'Goal Proximity',
    trigger: 'goalGradeNum ≥ 0 AND maxGradeNum === goalGradeNum − 1',
    dataUsed: ['goals (active target_grade)', 'climbing_attempts (max send)'],
    calculation: 'Current max grade is exactly one below the goal grade — peak phase appropriate.',
    type: 'focus',
  },
  {
    id: 'R006',
    name: 'No Strength Work',
    trigger: 'totalClimbSessions ≥ 4 AND totalStrengthSessions === 0',
    dataUsed: ['climbing_sessions count', 'strength_sessions count'],
    calculation: 'User has been climbing regularly but logged zero strength sessions — imbalanced training.',
    type: 'focus',
  },
  {
    id: 'R007',
    name: 'Low Bouldering Send Rate',
    trigger: 'bouldering.sendRate < 30% AND bouldering.totalAttempts ≥ 20',
    dataUsed: ['climbing_attempts (bouldering only)'],
    calculation: 'sendRate = sends / total_attempts × 100. Under 30% with enough sample suggests overly hard projecting.',
    type: 'focus',
  },
  {
    id: 'R008',
    name: 'Top Rope Endurance',
    trigger: 'topRope.totalAttempts ≥ 10 AND topRope.sendRate < 50%',
    dataUsed: ['climbing_attempts (top_rope only)'],
    calculation: 'TR send rate under 50% with adequate attempts — pump/endurance is the limiter, not power.',
    type: 'focus',
  },
  {
    id: 'R009',
    name: 'Consistency (Default)',
    trigger: 'No other rules fired AND totalClimbSessions > 0',
    dataUsed: ['any climbing data present'],
    calculation: 'Fallback positive message when no specific issue is detected.',
    type: 'focus',
  },
  {
    id: 'R010',
    name: 'Close to Bouldering Goal',
    trigger: 'goalGradeNum ≥ 0 AND bouldering.maxGradeNum === goalGradeNum − 1',
    dataUsed: ['goals (bouldering target_grade)', 'climbing_attempts (bouldering sends)'],
    calculation: 'Gap between current max grade and goal grade = 1 grade.',
    type: 'focus',
  },
  {
    id: 'R011',
    name: 'Volume Needed for Goal',
    trigger: 'goalGradeNum ≥ 0 AND gap = goalGradeNum − bouldering.maxGradeNum > 3',
    dataUsed: ['goals (bouldering target_grade)', 'climbing_attempts (bouldering sends)'],
    calculation: 'More than 3 grades separate current max from goal — volume is the path forward.',
    type: 'volume',
  },
  {
    id: 'R012',
    name: 'Strength Goal Misaligned',
    trigger: 'pullUpPR != null AND goalGradeNum ≥ 5 AND pullUpPR < 10',
    dataUsed: ['goals (bouldering target_grade)', 'strength_entries (pullups_reps PR)'],
    calculation: 'Climbing goal requires grade ≥ V5 but pull-up PR is under 10 reps — strength and climbing goals are out of sync.',
    type: 'bottleneck',
  },
];

// ─── Rule-based insights engine ───────────────────────────────────────────────

interface InsightCandidate {
  summary: string;
  recommendation: string;
  type: Insight['type'];
  ruleId: string;
}

function buildCandidates(d: InsightsData): InsightCandidate[] {
  const candidates: InsightCandidate[] = [];
  const pullUpPR = d.prs['pullups_reps'] ?? 0;
  const deadHangPR = d.prs['deadhang_duration'] ?? 0;

  // R001
  if (d.overloadRisk) {
    candidates.push({
      type: 'recovery',
      ruleId: 'R001',
      summary: `High volume — ${d.recentSessionsLast14} sessions in the last 2 weeks`,
      recommendation: 'Insert a deload week with no hard climbing to let tendons recover.',
    });
  }

  // R002
  if (d.maxGradeNum >= 6 && deadHangPR > 0 && deadHangPR < 30) {
    candidates.push({
      type: 'bottleneck',
      ruleId: 'R002',
      summary: 'Finger strength is a primary limiter at your grade',
      recommendation: 'Run a 4-week hangboard repeater protocol on 20mm edge, 3× per week.',
    });
  }

  // R003
  if (d.maxGradeNum >= 6 && pullUpPR > 0 && pullUpPR < 8) {
    candidates.push({
      type: 'bottleneck',
      ruleId: 'R003',
      summary: 'Pull strength lagging behind your climbing grade',
      recommendation: 'Add weighted pull-ups and lock-off training 2–3× per week.',
    });
  }

  // R004
  if (pullUpPR >= 12 && d.maxGradeNum >= 0 && d.maxGradeNum < 5) {
    candidates.push({
      type: 'focus',
      ruleId: 'R004',
      summary: 'Upper body strength exceeds your current grade — technique gap detected',
      recommendation: 'Focus on footwork drills, slab climbing, and reading sequences.',
    });
  }

  // R005
  if (d.goalGradeNum >= 0 && d.maxGradeNum >= 0 && d.maxGradeNum === d.goalGradeNum - 1) {
    candidates.push({
      type: 'focus',
      ruleId: 'R005',
      summary: `One grade away from your goal (${d.goalGradeLabel})`,
      recommendation: 'Increase project attempts on your goal grade and run a 3-week strength peaking block.',
    });
  }

  // R006
  if (d.totalClimbSessions >= 4 && d.totalStrengthSessions === 0) {
    candidates.push({
      type: 'focus',
      ruleId: 'R006',
      summary: 'No strength training logged alongside your climbing',
      recommendation: 'Add 2 supplemental sessions per week (hangboard + antagonist) to accelerate progress.',
    });
  }

  // R007
  if (d.bouldering.sendRate < 30 && d.bouldering.totalAttempts >= 20) {
    candidates.push({
      type: 'focus',
      ruleId: 'R007',
      summary: `Low bouldering send rate (${d.bouldering.sendRate}%) — mix in easier sends`,
      recommendation: 'Spend 20% of each session on sub-max sends to build confidence and volume.',
    });
  }

  // R008
  if (d.topRope.totalAttempts >= 10 && d.topRope.sendRate < 50) {
    candidates.push({
      type: 'focus',
      ruleId: 'R008',
      summary: `Top rope endurance gap detected (${d.topRope.sendRate}% send rate)`,
      recommendation: 'Add ARC training (30-min easy laps, 2× per week) to build aerobic endurance on the wall.',
    });
  }

  // R010 — Close to bouldering goal
  if (d.goalGradeNum >= 0 && d.bouldering.maxGradeNum >= 0) {
    const gap = d.goalGradeNum - d.bouldering.maxGradeNum;
    if (gap === 1) {
      candidates.push({
        type: 'focus',
        ruleId: 'R010',
        summary: `You're just one grade away from your bouldering goal!`,
        recommendation: `Increase project sessions on ${d.goalGradeLabel} — a short 3-week peak block can get you there.`,
      });
    } else if (gap > 3) {
      candidates.push({
        type: 'volume',
        ruleId: 'R011',
        summary: `${gap} grades to reach your goal — increase climbing volume`,
        recommendation: `Aim for 3+ sessions per week and focus on grades just below your goal to build sends.`,
      });
    }
  }

  // R012 — Strength goal lag
  if (d.prs['pullups_reps'] != null && d.goalGradeNum >= 5 && (d.prs['pullups_reps'] ?? 0) < 10) {
    candidates.push({
      type: 'bottleneck',
      ruleId: 'R012',
      summary: `Strength goal and climbing goal are misaligned — pull strength is lagging`,
      recommendation: `Target 12+ pull-ups to support ${d.goalGradeLabel ?? 'your climbing goal'}.`,
    });
  }

  // R009 — Default
  if (candidates.length === 0 && d.totalClimbSessions > 0) {
    candidates.push({
      type: 'focus',
      ruleId: 'R009',
      summary: 'Training is consistent — keep building volume and project attempts',
      recommendation: 'Aim for 3–4 quality sessions per week and track projects carefully.',
    });
  }

  return candidates;
}

export async function generateAndSaveInsights(userId: string): Promise<Insight[]> {
  const metricsData = await fetchInsightsData(userId);
  const candidates = buildCandidates(metricsData);

  const { error: delError } = await supabase.from('insights').delete().eq('user_id', userId);
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
          ruleId: c.ruleId,
          maxGradeNum: metricsData.maxGradeNum,
          pullUpPR: metricsData.prs['pullups_reps'] ?? 0,
          deadHangPR: metricsData.prs['deadhang_duration'] ?? 0,
          recentCount: metricsData.recentSessionsLast14,
          sendRate: metricsData.sendRate,
          boulderingSendRate: metricsData.bouldering.sendRate,
          topRopeSendRate: metricsData.topRope.sendRate,
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

// ─── Weekly volume builder ─────────────────────────────────────────────────────

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
    const climb = climbSessions.filter((s) => { const t = new Date(s.date).getTime(); return t >= startT && t < endT; }).length;
    const strength = strengthSessions.filter((s) => { const t = new Date(s.date).getTime(); return t >= startT && t < endT; }).length;
    const weekLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    result.push({ week: `W${weeks - i}`, label: weekLabel, climb, strength });
  }
  return result;
}

/** @deprecated Use fetchInsightsData */
export async function getWeeklyVolume(userId: string, weeks = 6): Promise<{ week: string; climb: number; strength: number }[]> {
  const [{ data: cs }, { data: ss }] = await Promise.all([
    supabase.from('climbing_sessions').select('date').eq('user_id', userId),
    supabase.from('strength_sessions').select('date').eq('user_id', userId),
  ]);
  return buildWeeklyVolume(cs ?? [], ss ?? [], weeks);
}
