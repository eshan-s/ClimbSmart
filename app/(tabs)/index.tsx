import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { F, R, S } from '@/constants/Theme';
import { getActiveGoals } from '@/services/goals';
import {
  getClimbingSessions,
  calcSessionsThisWeek,
  calcStreak,
} from '@/services/climbing';
import { getStrengthSessions, computePRs } from '@/services/strength';
import { getInsights } from '@/services/insights';
import { getProfile } from '@/services/profile';
import type { Goal, ClimbingSession, StrengthSession, Insight, Profile } from '@/types';
import { maxGradeFromAttempts, progressPct, gradeToNum, ydsToNum } from '@/utils/grades';
import { formatDate } from '@/services/strength';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Small components ─────────────────────────────────────────────────────────

function StatCard({
  label, value, color, icon, onPress,
}: {
  label: string; value: string; color: string; icon: IoniconName; onPress?: () => void;
}) {
  const { colors: C } = useTheme();
  const s = useMemo(() => StyleSheet.create({
    card: { flex: 1, backgroundColor: C.card, borderRadius: R.md, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border },
    value: { fontSize: F.xl, fontWeight: '800', marginTop: 6 },
    label: { fontSize: F.xs, color: C.textSub, textAlign: 'center', marginTop: 3 },
  }), [C]);

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[s.value, { color }]}>{value}</Text>
      <Text style={s.label}>{label}</Text>
      {onPress && <Ionicons name="chevron-forward" size={11} color={C.textMuted} style={{ marginTop: 2 }} />}
    </TouchableOpacity>
  );
}

function QuickAction({ icon, label, color = '#FF6535', onPress }: { icon: IoniconName; label: string; color?: string; onPress?: () => void }) {
  const { colors: C } = useTheme();
  const s = useMemo(() => StyleSheet.create({
    btn: { flex: 1, alignItems: 'center', backgroundColor: C.card, borderRadius: R.md, paddingVertical: 16, paddingHorizontal: 8, borderWidth: 1, borderColor: color + '40', gap: 8 },
    iconWrap: { width: 42, height: 42, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', backgroundColor: color + '20' },
    label: { fontSize: F.xs, color: C.textSub, fontWeight: '600', textAlign: 'center' },
  }), [C, color]);

  return (
    <TouchableOpacity style={s.btn} onPress={onPress} activeOpacity={0.7}>
      <View style={s.iconWrap}><Ionicons name={icon} size={20} color={color} /></View>
      <Text style={s.label}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Goal card ─────────────────────────────────────────────────────────────────

function GoalCard({ goal, currentGrade, prs }: { goal: Goal; currentGrade: string | null; prs: Record<string, number> }) {
  const { colors: C } = useTheme();

  let pct = 0;
  let targetLabel = '';
  let currentLabel = '';
  let progressColor = C.primary;

  if (goal.goal_type === 'bouldering') {
    const curNum = currentGrade ? gradeToNum(currentGrade) : -1;
    const goalNum = goal.target_grade ? gradeToNum(goal.target_grade) : -1;
    pct = curNum >= 0 && goalNum > 0 ? Math.min(100, Math.round((curNum / goalNum) * 100)) : 0;
    targetLabel = goal.target_grade ?? '—';
    currentLabel = currentGrade ?? '—';
    progressColor = C.primary;
  } else if (goal.goal_type === 'top_rope') {
    const curNum = currentGrade ? ydsToNum(currentGrade) : -1;
    const goalNum = goal.target_grade ? ydsToNum(goal.target_grade) : -1;
    pct = curNum >= 0 && goalNum >= 0 ? Math.min(100, Math.round(((curNum + 1) / (goalNum + 1)) * 100)) : 0;
    targetLabel = goal.target_grade ?? '—';
    currentLabel = currentGrade ?? '—';
    progressColor = C.accent;
  } else if (goal.goal_type === 'strength') {
    const ex = goal.exercise_type ?? '';
    const metric = goal.unit === 'seconds' ? 'duration' : 'reps';
    const pr = prs[`${ex}_${metric}`] ?? 0;
    const target = goal.target_value ?? 0;
    pct = target > 0 ? Math.min(100, Math.round((pr / target) * 100)) : 0;
    targetLabel = `${target} ${goal.unit ?? 'reps'}`;
    currentLabel = pr > 0 ? `${pr} ${goal.unit ?? 'reps'}` : 'Not logged';
    progressColor = '#A78BFA';
  }

  const typeLabel = goal.goal_type === 'bouldering' ? 'Bouldering' : goal.goal_type === 'top_rope' ? 'Top Rope' : (goal.exercise_type?.replace('_', ' ') ?? 'Strength');
  const typeIcon: IoniconName = goal.goal_type === 'strength' ? 'barbell-outline' : 'flag-outline';

  return (
    <View style={[gcStyles.card, { backgroundColor: progressColor + '12', borderColor: progressColor + '40' }]}>
      <View style={gcStyles.top}>
        <View style={gcStyles.typeRow}>
          <View style={[gcStyles.typeIcon, { backgroundColor: progressColor + '20' }]}>
            <Ionicons name={typeIcon} size={12} color={progressColor} />
          </View>
          <Text style={[gcStyles.typeLabel, { color: progressColor }]}>{typeLabel.toUpperCase()}</Text>
        </View>
        {goal.target_date && (
          <Text style={[gcStyles.eta, { color: C.textSub }]}>
            Due {new Date(goal.target_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </Text>
        )}
      </View>
      <Text style={[gcStyles.target, { color: C.text }]}>
        {goal.goal_type === 'strength' ? `${typeLabel}: ${targetLabel}` : `Send ${targetLabel}`}
      </Text>
      <Text style={[gcStyles.current, { color: C.textSub }]}>
        Current: {currentLabel}
        {pct > 0 ? ` — ${pct}% there` : ''}
      </Text>
      <View style={gcStyles.progressRow}>
        <View style={[gcStyles.track, { backgroundColor: C.border }]}>
          <View style={[gcStyles.fill, { width: `${pct}%`, backgroundColor: progressColor }]} />
        </View>
        <Text style={[gcStyles.pctLabel, { color: progressColor }]}>{pct}%</Text>
      </View>
    </View>
  );
}
const gcStyles = StyleSheet.create({
  card: { borderRadius: R.lg, padding: 16, borderWidth: 1, marginBottom: 10 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeIcon: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  typeLabel: { fontSize: F.xs, fontWeight: '800', letterSpacing: 0.8 },
  eta: { fontSize: F.xs },
  target: { fontSize: F.md, fontWeight: '800', marginBottom: 4 },
  current: { fontSize: F.sm, marginBottom: 10 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 6, borderRadius: R.full, overflow: 'hidden' },
  fill: { height: 6, borderRadius: R.full },
  pctLabel: { fontSize: F.xs, fontWeight: '700', width: 32, textAlign: 'right' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors: C } = useTheme();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [climbSessions, setClimbSessions] = useState<ClimbingSession[]>([]);
  const [strengthSessions, setStrengthSessions] = useState<StrengthSession[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [prof, gs, cs, ss, ins] = await Promise.all([
        getProfile(user.id),
        getActiveGoals(user.id),
        getClimbingSessions(user.id, 10),
        getStrengthSessions(user.id, 5),
        getInsights(user.id),
      ]);
      setProfile(prof);
      setGoals(gs);
      setClimbSessions(cs);
      setStrengthSessions(ss);
      setInsights(ins);
    } catch (e) {
      console.error('Home load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  // Derived data
  const allAttempts = climbSessions.flatMap((s) => s.climbing_attempts ?? []);
  const boulderAttempts = allAttempts.filter((a) => a.route_type == null || a.route_type === 'bouldering');
  const trAttempts = allAttempts.filter((a) => a.route_type === 'top_rope');
  const bestBoulderGrade = maxGradeFromAttempts(boulderAttempts);
  const bestTrGrade = maxGradeFromAttempts(trAttempts);
  const bestGrade = maxGradeFromAttempts(allAttempts) ?? '—';
  const sessionsThisWeek = calcSessionsThisWeek(climbSessions);
  const streak = calcStreak(climbSessions);
  const prs = computePRs(strengthSessions);

  // Combined recent activity
  type ActivityItem = { id: string; title: string; subtitle: string; badge: string; badgeColor: string; dotColor: string };
  const recentActivity: ActivityItem[] = [
    ...climbSessions.slice(0, 3).map((s) => {
      const sends = (s.climbing_attempts ?? []).filter((a) => a.result === 'send' || a.result === 'flash').length;
      const maxG = maxGradeFromAttempts(s.climbing_attempts ?? []);
      return {
        id: s.id,
        title: s.gym_name ?? (s.session_type === 'outdoor' ? 'Outdoor Session' : 'Climbing Session'),
        subtitle: `${formatDate(s.date)} · ${s.duration ? s.duration + 'm' : '—'}`,
        badge: maxG ?? `${sends} sends`,
        badgeColor: s.session_type === 'outdoor' ? C.success : C.primary,
        dotColor: s.session_type === 'outdoor' ? C.success : C.primary,
      };
    }),
    ...strengthSessions.slice(0, 2).map((s) => ({
      id: s.id,
      title: 'Strength Workout',
      subtitle: `${formatDate(s.date)} · ${s.duration ? s.duration + 'm' : '—'}`,
      badge: `${(s.strength_entries ?? []).length} exercises`,
      badgeColor: C.accent,
      dotColor: C.accent,
    })),
  ].slice(0, 4);

  const topInsight = insights[0] ?? null;
  const displayName = profile?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'Climber';

  const styles = useMemo(() => makeStyles(C), [C]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar style="auto" />
        <View style={styles.loadingCenter}><ActivityIndicator size="large" color={C.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="auto" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {displayName}</Text>
            <Text style={styles.subGreeting}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(displayName[0] ?? '?').toUpperCase()}</Text>
          </View>
        </View>

        {/* ── Goals (only show if any exist) ─────────────────────────────── */}
        {goals.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>My Goals</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
                <Text style={[styles.sectionAction, { color: C.primary }]}>Manage</Text>
              </TouchableOpacity>
            </View>
            {goals.slice(0, 3).map((g) => {
              const curGrade =
                g.goal_type === 'bouldering' ? bestBoulderGrade :
                g.goal_type === 'top_rope' ? bestTrGrade :
                null;
              return <GoalCard key={g.id} goal={g} currentGrade={curGrade} prs={prs} />;
            })}
          </>
        )}

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <View style={[styles.row, styles.mb16]}>
          <StatCard
            label="Sessions / wk"
            value={String(sessionsThisWeek)}
            color={C.accent}
            icon="calendar-outline"
            onPress={() => router.push('/calendar')}
          />
          <View style={{ width: 10 }} />
          <StatCard
            label="Best Grade"
            value={bestGrade}
            color={C.primary}
            icon="trending-up-outline"
            onPress={() => router.push('/stat-detail?type=grade' as never)}
          />
          <View style={{ width: 10 }} />
          <StatCard
            label="Day Streak"
            value={String(streak)}
            color={C.warning}
            icon="flame-outline"
            onPress={() => router.push('/stat-detail?type=streak' as never)}
          />
        </View>

        {/* ── Recent Activity ─────────────────────────────────────────────── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
        </View>
        {recentActivity.length > 0 ? (
          <View style={styles.activityCard}>
            {recentActivity.map((item, i) => (
              <React.Fragment key={item.id}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.activityItem}>
                  <View style={[styles.activityDot, { backgroundColor: item.dotColor }]} />
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityTitle}>{item.title}</Text>
                    <Text style={styles.activitySub}>{item.subtitle}</Text>
                  </View>
                  <View style={[styles.activityBadge, { backgroundColor: item.badgeColor + '20' }]}>
                    <Text style={[styles.activityBadgeText, { color: item.badgeColor }]}>{item.badge}</Text>
                  </View>
                </View>
              </React.Fragment>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="time-outline" size={28} color={C.textMuted} />
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptySub}>Log your first session to see it here.</Text>
          </View>
        )}

        <View style={styles.mb16} />

        {/* ── Quick Actions ───────────────────────────────────────────────── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        <View style={[styles.row, styles.mb20]}>
          <QuickAction icon="flag-outline" label={'Log\nClimb'} color={C.primary} onPress={() => router.push('/log-climb')} />
          <View style={{ width: 10 }} />
          <QuickAction icon="barbell-outline" label={'Log\nWorkout'} color={C.accent} onPress={() => router.push('/log-workout')} />
          <View style={{ width: 10 }} />
          <QuickAction icon="analytics-outline" label={'View\nInsights'} color={C.warning} onPress={() => router.push('/(tabs)/insights')} />
        </View>

        {/* ── Insight Preview ─────────────────────────────────────────────── */}
        {topInsight ? (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Latest Insight</Text>
            </View>
            <View style={[styles.insightCard, { backgroundColor: C.accent + '14', borderColor: C.accent + '35' }]}>
              <View style={styles.insightChip}>
                <Ionicons name="bulb" size={14} color={C.accent} />
                <Text style={[styles.insightChipLabel, { color: C.accent }]}>{topInsight.type.toUpperCase()}</Text>
              </View>
              <Text style={styles.insightTitle}>{topInsight.summary}</Text>
              {topInsight.recommendation && (
                <Text style={styles.insightBody}>{topInsight.recommendation}</Text>
              )}
              <TouchableOpacity style={styles.insightLink} onPress={() => router.push('/(tabs)/insights')} activeOpacity={0.7}>
                <Text style={[styles.insightLinkText, { color: C.accent }]}>View all insights</Text>
                <Ionicons name="arrow-forward" size={13} color={C.accent} />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.sectionRow}><Text style={styles.sectionTitle}>Insights</Text></View>
            <View style={styles.emptyCard}>
              <Ionicons name="analytics-outline" size={28} color={C.textMuted} />
              <Text style={styles.emptyTitle}>No insights yet</Text>
              <Text style={styles.emptySub}>Log a few sessions to generate insights.</Text>
              <TouchableOpacity
                style={[styles.emptyAction, { borderColor: C.primary + '50', backgroundColor: C.primaryBg }]}
                onPress={() => router.push('/(tabs)/insights')}
              >
                <Text style={[styles.emptyActionText, { color: C.primary }]}>Go to Insights</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    scroll: { flex: 1 },
    content: { paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: 100 },
    loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    mb16: { marginBottom: 16 },
    mb20: { marginBottom: 20 },
    row: { flexDirection: 'row' },
    divider: { height: 1, backgroundColor: C.border, marginVertical: 12 },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.lg },
    greeting: { fontSize: F.xl, fontWeight: '800', color: C.text, letterSpacing: 0.3 },
    subGreeting: { fontSize: F.sm, color: C.textSub, marginTop: 3 },
    avatar: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: C.primaryBg, borderWidth: 2, borderColor: C.primaryBorder,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { fontSize: F.sm, fontWeight: '800', color: C.primary },

    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    sectionTitle: { fontSize: F.base, fontWeight: '700', color: C.text },
    sectionAction: { fontSize: F.sm, fontWeight: '600' },

    activityCard: {
      backgroundColor: C.card, borderRadius: R.lg, padding: 16,
      borderWidth: 1, borderColor: C.border, marginBottom: 16,
    },
    activityItem: { flexDirection: 'row', alignItems: 'center' },
    activityDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
    activityInfo: { flex: 1 },
    activityTitle: { fontSize: F.base, fontWeight: '600', color: C.text },
    activitySub: { fontSize: F.xs, color: C.textSub, marginTop: 2 },
    activityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.full },
    activityBadgeText: { fontSize: F.xs, fontWeight: '700' },

    emptyCard: {
      backgroundColor: C.card, borderRadius: R.lg, padding: 24,
      borderWidth: 1, borderColor: C.border, alignItems: 'center', gap: 8, marginBottom: 16,
    },
    emptyTitle: { fontSize: F.base, fontWeight: '700', color: C.text },
    emptySub: { fontSize: F.sm, color: C.textSub, textAlign: 'center' },
    emptyAction: { marginTop: 4, paddingHorizontal: 18, paddingVertical: 8, borderRadius: R.full, borderWidth: 1 },
    emptyActionText: { fontSize: F.sm, fontWeight: '700' },

    insightCard: { borderRadius: R.lg, padding: 16, borderWidth: 1, marginBottom: 16 },
    insightChip: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
    insightChipLabel: { fontSize: F.xs, fontWeight: '700', letterSpacing: 0.8 },
    insightTitle: { fontSize: F.md, fontWeight: '700', color: C.text, marginBottom: 8 },
    insightBody: { fontSize: F.sm, color: C.textSub, lineHeight: 20, marginBottom: 14 },
    insightLink: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    insightLinkText: { fontSize: F.sm, fontWeight: '600' },
  });
}
