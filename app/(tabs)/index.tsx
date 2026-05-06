import React, { useCallback, useEffect, useState } from 'react';
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
import { C, F, R, S } from '@/constants/Theme';
import Card from '@/components/ui/Card';
import SectionHeader from '@/components/ui/SectionHeader';
import EmptyState from '@/components/ui/EmptyState';
import { getActiveGoal } from '@/services/goals';
import {
  getClimbingSessions,
  calcSessionsThisWeek,
  calcStreak,
} from '@/services/climbing';
import { getStrengthSessions } from '@/services/strength';
import { getInsights } from '@/services/insights';
import { getProfile } from '@/services/profile';
import type { Goal, ClimbingSession, StrengthSession, Insight, Profile } from '@/types';
import { maxGradeFromAttempts, progressPct, gradeToNum } from '@/utils/grades';
import { formatDate } from '@/services/strength';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Small components ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color: string;
  icon: IoniconName;
}) {
  return (
    <View style={[statStyles.card, { flex: 1 }]}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}
const statStyles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: R.md,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  value: { fontSize: F.xl, fontWeight: '800', marginTop: 6 },
  label: { fontSize: F.xs, color: C.textSub, textAlign: 'center', marginTop: 3 },
});

function QuickAction({
  icon,
  label,
  color = C.primary,
  onPress,
}: {
  icon: IoniconName;
  label: string;
  color?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[qaStyles.btn, { borderColor: color + '40' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[qaStyles.iconWrap, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={qaStyles.label}>{label}</Text>
    </TouchableOpacity>
  );
}
const qaStyles = StyleSheet.create({
  btn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: R.md,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderWidth: 1,
    gap: 8,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: R.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: F.xs, color: C.textSub, fontWeight: '600', textAlign: 'center' },
});

interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  dotColor: string;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [climbSessions, setClimbSessions] = useState<ClimbingSession[]>([]);
  const [strengthSessions, setStrengthSessions] = useState<StrengthSession[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [prof, g, cs, ss, ins] = await Promise.all([
        getProfile(user.id),
        getActiveGoal(user.id),
        getClimbingSessions(user.id, 10),
        getStrengthSessions(user.id, 5),
        getInsights(user.id),
      ]);
      setProfile(prof);
      setGoal(g);
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
  // Re-load whenever this screen comes back into focus (e.g. after logging a session)
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  // Derived data
  const allAttempts = climbSessions.flatMap((s) => s.climbing_attempts ?? []);
  const currentGrade = maxGradeFromAttempts(allAttempts) ?? '—';
  const sessionsThisWeek = calcSessionsThisWeek(climbSessions);
  const streak = calcStreak(climbSessions);
  const pct = goal ? Math.round(progressPct(currentGrade, goal.target_grade) * 100) : 0;

  // Combined recent activity (climb + strength)
  const recentActivity: ActivityItem[] = [
    ...climbSessions.slice(0, 3).map((s) => {
      const sends = (s.climbing_attempts ?? []).filter(
        (a) => a.result === 'send' || a.result === 'flash'
      ).length;
      const maxG = maxGradeFromAttempts(s.climbing_attempts ?? []);
      return {
        id: s.id,
        title: s.gym_name ?? (s.session_type === 'outdoor' ? 'Outdoor Session' : 'Bouldering Session'),
        subtitle: `${formatDate(s.date)} · ${s.duration ? s.duration + 'm' : '—'}`,
        badge: maxG ? maxG : `${sends} sends`,
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
  ]
    .sort((a, b) => new Date(b.subtitle).getTime() - new Date(a.subtitle).getTime())
    .slice(0, 3);

  const topInsight = insights[0] ?? null;
  const displayName = profile?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'Climber';

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.primary}
          />
        }
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {displayName}</Text>
            <Text style={styles.subGreeting}>
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(displayName[0] ?? '?').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* ── Current Goal ───────────────────────────────────────────────── */}
        {goal ? (
          <>
            <SectionHeader title="Current Goal" />
            <Card variant="primary" style={styles.mb16}>
              <View style={styles.goalTopRow}>
                <View style={styles.goalBadge}>
                  <Ionicons name="flag" size={11} color={C.primary} />
                  <Text style={styles.goalBadgeLabel}>TARGET GRADE</Text>
                </View>
                {goal.target_date && (
                  <Text style={styles.goalEta}>
                    Due {new Date(goal.target_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </Text>
                )}
              </View>
              <Text style={styles.goalTitle}>Send {goal.target_grade}</Text>
              <Text style={styles.goalSub}>
                {currentGrade !== '—'
                  ? `Currently climbing ${currentGrade} — ${pct}% of the way there`
                  : 'Log your first session to track progress'}
              </Text>
              <View style={styles.progressRow}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.progressLabel}>{pct}%</Text>
              </View>
            </Card>
          </>
        ) : (
          <Card style={styles.mb16}>
            <EmptyState
              icon="flag-outline"
              title="Set your climbing goal"
              message="Go to Profile → Goals to set your target grade and timeline."
            />
          </Card>
        )}

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <View style={[styles.row, styles.mb16]}>
          <StatCard
            label="Sessions / wk"
            value={String(sessionsThisWeek)}
            color={C.accent}
            icon="calendar-outline"
          />
          <View style={{ width: 10 }} />
          <StatCard
            label="Best Grade"
            value={currentGrade}
            color={C.primary}
            icon="trending-up-outline"
          />
          <View style={{ width: 10 }} />
          <StatCard
            label="Day Streak"
            value={String(streak)}
            color={C.warning}
            icon="flame-outline"
          />
        </View>

        {/* ── Recent Activity ─────────────────────────────────────────────── */}
        <SectionHeader title="Recent Activity" action="See all" />
        {recentActivity.length > 0 ? (
          <Card style={styles.mb16}>
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
                    <Text style={[styles.activityBadgeText, { color: item.badgeColor }]}>
                      {item.badge}
                    </Text>
                  </View>
                </View>
              </React.Fragment>
            ))}
          </Card>
        ) : (
          <Card style={styles.mb16}>
            <EmptyState
              icon="time-outline"
              title="No activity yet"
              message="Log your first session to see activity here."
              actionLabel="Log a Climb"
              onAction={() => router.push('/log-climb')}
            />
          </Card>
        )}

        {/* ── Quick Actions ───────────────────────────────────────────────── */}
        <SectionHeader title="Quick Actions" />
        <View style={[styles.row, styles.mb20]}>
          <QuickAction
            icon="flag-outline"
            label={'Log\nClimb'}
            color={C.primary}
            onPress={() => router.push('/log-climb')}
          />
          <View style={{ width: 10 }} />
          <QuickAction
            icon="barbell-outline"
            label={'Log\nWorkout'}
            color={C.accent}
            onPress={() => router.push('/log-workout')}
          />
          <View style={{ width: 10 }} />
          <QuickAction
            icon="analytics-outline"
            label={'View\nInsights'}
            color={C.warning}
            onPress={() => router.push('/(tabs)/insights')}
          />
        </View>

        {/* ── Insight Preview ─────────────────────────────────────────────── */}
        {topInsight ? (
          <>
            <SectionHeader title="Latest Insight" />
            <Card variant="accent" style={styles.mb32}>
              <View style={styles.insightChip}>
                <Ionicons name="bulb" size={14} color={C.accent} />
                <Text style={styles.insightChipLabel}>
                  {topInsight.type.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.insightTitle}>{topInsight.summary}</Text>
              {topInsight.recommendation ? (
                <Text style={styles.insightBody}>{topInsight.recommendation}</Text>
              ) : null}
              <TouchableOpacity
                style={styles.insightLink}
                onPress={() => router.push('/(tabs)/insights')}
                activeOpacity={0.7}
              >
                <Text style={styles.insightLinkText}>View all insights</Text>
                <Ionicons name="arrow-forward" size={13} color={C.accent} />
              </TouchableOpacity>
            </Card>
          </>
        ) : (
          <>
            <SectionHeader title="Insights" />
            <Card style={styles.mb32}>
              <EmptyState
                icon="analytics-outline"
                title="No insights yet"
                message="Log a few sessions to generate rule-based insights about your training."
                actionLabel="Go to Insights"
                onAction={() => router.push('/(tabs)/insights')}
              />
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: 100 },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mb16: { marginBottom: 16 },
  mb20: { marginBottom: 20 },
  mb32: { marginBottom: 32 },
  row: { flexDirection: 'row' },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 12 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: S.lg,
  },
  greeting: { fontSize: F.xl, fontWeight: '800', color: C.text, letterSpacing: 0.3 },
  subGreeting: { fontSize: F.sm, color: C.textSub, marginTop: 3 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.primaryBg,
    borderWidth: 2,
    borderColor: C.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: F.sm, fontWeight: '800', color: C.primary },

  goalTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  goalBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  goalBadgeLabel: { fontSize: F.xs, color: C.primary, fontWeight: '700', letterSpacing: 0.8 },
  goalEta: { fontSize: F.xs, color: C.textSub },
  goalTitle: { fontSize: F.lg, fontWeight: '800', color: C.text, marginBottom: 4 },
  goalSub: { fontSize: F.sm, color: C.textSub, marginBottom: 14 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: C.border,
    borderRadius: R.full,
    overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: C.primary, borderRadius: R.full },
  progressLabel: { fontSize: F.xs, color: C.primary, fontWeight: '700', width: 32, textAlign: 'right' },

  activityItem: { flexDirection: 'row', alignItems: 'center' },
  activityDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  activityInfo: { flex: 1 },
  activityTitle: { fontSize: F.base, fontWeight: '600', color: C.text },
  activitySub: { fontSize: F.xs, color: C.textSub, marginTop: 2 },
  activityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.full },
  activityBadgeText: { fontSize: F.xs, fontWeight: '700' },

  insightChip: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  insightChipLabel: { fontSize: F.xs, color: C.accent, fontWeight: '700', letterSpacing: 0.8 },
  insightTitle: { fontSize: F.md, fontWeight: '700', color: C.text, marginBottom: 8 },
  insightBody: { fontSize: F.sm, color: C.textSub, lineHeight: 20, marginBottom: 14 },
  insightLink: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  insightLinkText: { fontSize: F.sm, color: C.accent, fontWeight: '600' },
});
