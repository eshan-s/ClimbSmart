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
import SegmentedControl from '@/components/ui/SegmentedControl';
import { getGoalByType } from '@/services/goals';
import {
  getClimbingSessions,
  getProjects,
  calcSessionsThisWeek,
} from '@/services/climbing';
import { supabase } from '@/lib/supabase';
import type { Goal, ClimbingSession, ClimbingAttempt, RouteType } from '@/types';
import {
  gradeColor,
  maxGradeByType,
  gradeToNum,
  ydsToNum,
  displayGradesForType,
} from '@/utils/grades';
import { formatDate } from '@/services/strength';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function GradePill({ grade, active = false, C }: { grade: string; active?: boolean; C: ReturnType<typeof useTheme>['colors'] }) {
  const color = gradeColor(grade);
  return (
    <View style={[gpStyles.pill, { backgroundColor: active ? color : color + '22', borderColor: active ? color : color + '55' }]}>
      <Text style={[gpStyles.text, { color: active ? C.white : color }]}>{grade}</Text>
    </View>
  );
}
const gpStyles = StyleSheet.create({
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: F.sm, fontWeight: '800' },
});

function SessionCard({ session, activeType, C }: { session: ClimbingSession; activeType: RouteType; C: ReturnType<typeof useTheme>['colors'] }) {
  const allAttempts = session.climbing_attempts ?? [];
  const attempts = allAttempts.filter((a) =>
    activeType === 'bouldering' ? (a.route_type == null || a.route_type === 'bouldering') : a.route_type === 'top_rope'
  );
  const sends = attempts.filter((a) => a.result === 'send' || a.result === 'flash').length;
  const maxG = maxGradeByType(attempts, activeType);
  const isOutdoor = session.session_type === 'outdoor';
  const color = isOutdoor ? C.success : C.primary;

  return (
    <View style={[scStyles.card, { backgroundColor: C.card, borderColor: C.border }]}>
      <View style={scStyles.top}>
        <View style={scStyles.venueRow}>
          <View style={[scStyles.dot, { backgroundColor: color }]} />
          <View>
            <Text style={[scStyles.venue, { color: C.text }]}>
              {session.gym_name ?? (isOutdoor ? 'Outdoor' : 'Gym Session')}
            </Text>
            <Text style={[scStyles.date, { color: C.textSub }]}>
              {formatDate(session.date)}{session.duration ? ` · ${session.duration}m` : ''}
            </Text>
          </View>
        </View>
        {maxG ? <GradePill grade={maxG} C={C} /> : null}
      </View>
      <View style={scStyles.stats}>
        <View style={scStyles.stat}>
          <Ionicons name="checkmark-circle-outline" size={13} color={C.success} />
          <Text style={[scStyles.statText, { color: C.textSub }]}>{sends} sends</Text>
        </View>
        <View style={scStyles.stat}>
          <Ionicons name="flag-outline" size={13} color={C.textSub} />
          <Text style={[scStyles.statText, { color: C.textSub }]}>{attempts.length} attempts</Text>
        </View>
        <View style={scStyles.stat}>
          <Ionicons name={isOutdoor ? 'leaf-outline' : 'business-outline'} size={13} color={C.textSub} />
          <Text style={[scStyles.statText, { color: C.textSub }]}>{isOutdoor ? 'Outdoor' : 'Indoor'}</Text>
        </View>
      </View>
    </View>
  );
}
const scStyles = StyleSheet.create({
  card: { borderRadius: R.lg, padding: 16, marginBottom: 10, borderWidth: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  venue: { fontSize: F.base, fontWeight: '700' },
  date: { fontSize: F.xs, marginTop: 2 },
  stats: { flexDirection: 'row', gap: 16 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: F.xs },
});

function ProjectCard({ attempt, C }: { attempt: ClimbingAttempt; C: ReturnType<typeof useTheme>['colors'] }) {
  const color = gradeColor(attempt.grade);
  return (
    <View style={[projStyles.card, { backgroundColor: C.card, borderColor: C.border }]}>
      <View style={projStyles.row}>
        <View style={[projStyles.gradeBox, { backgroundColor: color + '20', borderColor: color + '55' }]}>
          <Text style={[projStyles.gradeText, { color }]}>{attempt.grade}</Text>
        </View>
        <View style={projStyles.info}>
          <Text style={[projStyles.name, { color: C.text }]}>{attempt.route_name ?? 'Unnamed project'}</Text>
          {(attempt.climb_type ?? attempt.style_tag) ? (
            <Text style={[projStyles.beta, { color: C.textSub }]}>
              {((attempt.climb_type ?? attempt.style_tag) ?? '').charAt(0).toUpperCase() +
                ((attempt.climb_type ?? attempt.style_tag) ?? '').slice(1)}
            </Text>
          ) : null}
        </View>
        <View style={projStyles.right}>
          <Ionicons name="play-circle" size={14} color={C.warning} />
          <Text style={[projStyles.statusText, { color: C.warning }]}>Working</Text>
          <Text style={[projStyles.attempts, { color: C.textMuted }]}>{attempt.attempts} tries</Text>
        </View>
      </View>
    </View>
  );
}
const projStyles = StyleSheet.create({
  card: { borderRadius: R.lg, padding: 16, marginBottom: 10, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  gradeBox: { width: 46, height: 46, borderRadius: R.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  gradeText: { fontSize: F.base, fontWeight: '800' },
  info: { flex: 1 },
  name: { fontSize: F.base, fontWeight: '700' },
  beta: { fontSize: F.xs, marginTop: 3 },
  right: { alignItems: 'flex-end', gap: 2 },
  statusText: { fontSize: F.xs, fontWeight: '700' },
  attempts: { fontSize: F.xs },
});

// ─── Section header ───────────────────────────────────────────────────────────

function SHeader({
  title, subtitle, action, onAction, C,
}: {
  title: string; subtitle?: string; action?: string; onAction?: () => void; C: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={[shStyles.row, { marginBottom: 10 }]}>
      <View>
        <Text style={[shStyles.title, { color: C.text }]}>{title}</Text>
        {subtitle ? <Text style={[shStyles.sub, { color: C.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {action && onAction && (
        <TouchableOpacity onPress={onAction}>
          <Text style={[shStyles.action, { color: C.primary }]}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
const shStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  title: { fontSize: F.base, fontWeight: '700' },
  sub: { fontSize: F.xs, marginTop: 1 },
  action: { fontSize: F.sm, fontWeight: '600' },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyCard({ icon, title, message, actionLabel, onAction, C }: {
  icon: IoniconName; title: string; message: string; actionLabel?: string; onAction?: () => void;
  C: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={[emptyStyles.card, { backgroundColor: C.card, borderColor: C.border }]}>
      <Ionicons name={icon} size={28} color={C.textMuted} />
      <Text style={[emptyStyles.title, { color: C.text }]}>{title}</Text>
      <Text style={[emptyStyles.msg, { color: C.textSub }]}>{message}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity
          style={[emptyStyles.btn, { backgroundColor: C.primaryBg, borderColor: C.primaryBorder }]}
          onPress={onAction}
        >
          <Text style={[emptyStyles.btnText, { color: C.primary }]}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
const emptyStyles = StyleSheet.create({
  card: { borderRadius: R.lg, padding: 24, borderWidth: 1, alignItems: 'center', gap: 8, marginBottom: 20 },
  title: { fontSize: F.base, fontWeight: '700' },
  msg: { fontSize: F.sm, textAlign: 'center' },
  btn: { marginTop: 4, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  btnText: { fontSize: F.sm, fontWeight: '700' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ClimbingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors: C } = useTheme();

  const [activeType, setActiveType] = useState<RouteType>('bouldering');
  const [goal, setGoal] = useState<Goal | null>(null);
  const [sessions, setSessions] = useState<ClimbingSession[]>([]);
  const [projects, setProjects] = useState<ClimbingAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // CRITICAL: activeType must be in the dependency array so goals
  // are re-fetched when the user switches disciplines.
  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [g, cs, proj] = await Promise.all([
        getGoalByType(user.id, activeType),
        getClimbingSessions(user.id, 20),
        getProjects(user.id),
      ]);
      setGoal(g);
      setSessions(cs);
      setProjects(proj);
    } catch (e) {
      console.error('Climbing load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, activeType]); // ← activeType included so switching tabs reloads goal

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('climbing-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'climbing_sessions', filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  // All attempts filtered to the active discipline
  const allAttempts = sessions.flatMap((s) => s.climbing_attempts ?? []);
  const typeAttempts = allAttempts.filter((a) =>
    activeType === 'bouldering' ? (a.route_type == null || a.route_type === 'bouldering') : a.route_type === 'top_rope'
  );
  const sends = typeAttempts.filter((a) => a.result === 'send' || a.result === 'flash');
  const currentGrade = maxGradeByType(typeAttempts, activeType);
  const goalGradeNum = goal?.target_grade
    ? (activeType === 'bouldering' ? gradeToNum(goal.target_grade) : ydsToNum(goal.target_grade))
    : -1;
  const sessThisWeek = calcSessionsThisWeek(sessions);
  const displayGrades = displayGradesForType(activeType);

  const typeProjects = projects.filter((p) =>
    activeType === 'bouldering' ? (p.route_type == null || p.route_type === 'bouldering') : p.route_type === 'top_rope'
  );
  const uniqueProjects = Object.values(
    typeProjects.reduce<Record<string, ClimbingAttempt>>((acc, p) => {
      const key = p.route_name ?? p.id;
      if (!acc[key] || new Date(p.created_at) > new Date(acc[key].created_at)) acc[key] = p;
      return acc;
    }, {})
  );

  const filteredSessions = sessions.filter((s) =>
    (s.climbing_attempts ?? []).some((a) =>
      activeType === 'bouldering' ? (a.route_type == null || a.route_type === 'bouldering') : a.route_type === 'top_rope'
    )
  );

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
        {/* Page Header */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Climbing</Text>
            <Text style={styles.pageSubtitle}>Sessions · Projects · Progress</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} activeOpacity={0.7} onPress={() => router.push('/log-climb')}>
            <Ionicons name="add" size={22} color={C.primary} />
          </TouchableOpacity>
        </View>

        {/* Segmented control */}
        <View style={styles.segContainer}>
          <SegmentedControl
            segments={[{ value: 'bouldering', label: 'Bouldering' }, { value: 'top_rope', label: 'Top Rope' }]}
            selected={activeType}
            onSelect={(v) => setActiveType(v)}
            activeColor={C.primary}
          />
        </View>

        {/* ── Discipline Goal ─────────────────────────────────────────────── */}
        <SHeader
          title={activeType === 'bouldering' ? 'Bouldering Goal' : 'Top Rope Goal'}
          action={goal ? undefined : 'Set Goal'}
          onAction={() => router.push('/(tabs)/profile')}
          C={C}
        />
        {goal ? (
          <View style={[styles.goalCard, { backgroundColor: C.primaryBg, borderColor: C.primaryBorder }]}>
            <View style={styles.goalStats}>
              {[
                { value: goal.target_grade ?? '—', label: 'Target' },
                { value: currentGrade ?? '—', label: 'Current' },
                { value: String(sessThisWeek), label: 'Sess / wk' },
                { value: String(sends.length), label: 'Sends', color: C.success },
              ].map((s, i) => (
                <React.Fragment key={s.label}>
                  {i > 0 && <View style={[styles.goalDivider, { backgroundColor: C.primaryBorder }]} />}
                  <View style={styles.goalStat}>
                    <Text style={[styles.goalStatValue, { color: s.color ?? C.text }]}>{s.value}</Text>
                    <Text style={[styles.goalStatLabel, { color: C.textSub }]}>{s.label}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
            {goal.target_date && (
              <View style={[styles.goalNote, { borderTopColor: C.primaryBorder }]}>
                <Ionicons name="calendar-outline" size={13} color={C.textSub} />
                <Text style={[styles.goalNoteText, { color: C.textSub }]}>
                  Target: {new Date(goal.target_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <EmptyCard
            icon="flag-outline"
            title={`No ${activeType === 'bouldering' ? 'bouldering' : 'top rope'} goal`}
            message="Go to Profile → Goals to set a target grade."
            actionLabel="Set Goal"
            onAction={() => router.push('/(tabs)/profile')}
            C={C}
          />
        )}

        {/* ── Grade Ladder ────────────────────────────────────────────────── */}
        {typeAttempts.length > 0 && (
          <>
            <SHeader
              title="Grade Ladder"
              subtitle={activeType === 'bouldering' ? 'V-scale confirmed sends' : 'YDS confirmed sends'}
              C={C}
            />
            <View style={[styles.gradeCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gradeScroll}>
                {displayGrades.map((grade) => {
                  const isCurrent = grade === currentGrade;
                  const isGoal = goal && grade === goal.target_grade;
                  const gNum = activeType === 'bouldering' ? gradeToNum(grade) : ydsToNum(grade);
                  const isDone = sends.some((a) => {
                    const n = activeType === 'bouldering' ? gradeToNum(a.grade) : ydsToNum(a.grade);
                    return n >= gNum;
                  }) && !isCurrent;
                  return (
                    <View key={grade} style={styles.gradeStep}>
                      {isGoal && (
                        <View style={styles.goalFlag}>
                          <Ionicons name="flag" size={9} color={C.primary} />
                          <Text style={[styles.goalFlagText, { color: C.primary }]}>Goal</Text>
                        </View>
                      )}
                      <GradePill grade={grade} active={isCurrent} C={C} />
                      <View style={styles.stepBottom}>
                        {isDone ? <Ionicons name="checkmark-circle" size={14} color={C.success} /> :
                          isCurrent ? <Text style={[styles.nowLabel, { color: C.textSub }]}>Now</Text> :
                          isGoal ? <Text style={[styles.nextLabel, { color: C.textMuted }]}>Next</Text> :
                          <View style={{ height: 14 }} />}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </>
        )}

        {/* ── Recent Sessions ─────────────────────────────────────────────── */}
        <SHeader title="Recent Sessions" action="Refresh" onAction={onRefresh} C={C} />
        {filteredSessions.length > 0 ? (
          filteredSessions.slice(0, 5).map((s) => <SessionCard key={s.id} session={s} activeType={activeType} C={C} />)
        ) : (
          <EmptyCard
            icon="flag-outline"
            title={`No ${activeType === 'bouldering' ? 'bouldering' : 'top rope'} sessions yet`}
            message="Select the discipline when logging a climb to see sessions here."
            actionLabel="Log a Session"
            onAction={() => router.push('/log-climb')}
            C={C}
          />
        )}

        {/* ── Active Projects ─────────────────────────────────────────────── */}
        <SHeader title="Active Projects" subtitle="Climbs marked as 'project'" action="Log" onAction={() => router.push('/log-climb')} C={C} />
        {uniqueProjects.length > 0 ? (
          uniqueProjects.slice(0, 5).map((p) => <ProjectCard key={p.id} attempt={p} C={C} />)
        ) : (
          <EmptyCard
            icon="bookmark-outline"
            title="No active projects"
            message="Mark a climb as 'Project' when logging to track it here."
            C={C}
          />
        )}

        {/* ── Stats ───────────────────────────────────────────────────────── */}
        {typeAttempts.length > 0 && (
          <>
            <SHeader title={activeType === 'bouldering' ? 'Bouldering Stats' : 'Top Rope Stats'} C={C} />
            <View style={styles.statRow}>
              {[
                { label: 'Sessions', value: String(filteredSessions.length), icon: 'calendar-outline' as IoniconName, color: C.accent },
                { label: 'Sends', value: String(sends.length), icon: 'checkmark-done-outline' as IoniconName, color: C.success },
                { label: 'Projects', value: String(uniqueProjects.length), icon: 'bookmark-outline' as IoniconName, color: C.primary },
              ].map((stat) => (
                <View key={stat.label} style={[styles.miniStat, { backgroundColor: C.card, borderColor: C.border }]}>
                  <Ionicons name={stat.icon} size={18} color={stat.color} />
                  <Text style={[styles.miniStatValue, { color: stat.color }]}>{stat.value}</Text>
                  <Text style={[styles.miniStatLabel, { color: C.textSub }]}>{stat.label}</Text>
                </View>
              ))}
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

    pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.lg },
    pageTitle: { fontSize: F.xxl, fontWeight: '800', color: C.text, letterSpacing: 0.3 },
    pageSubtitle: { fontSize: F.xs, color: C.textSub, marginTop: 3 },
    addBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.primaryBg, borderWidth: 1, borderColor: C.primaryBorder, alignItems: 'center', justifyContent: 'center' },

    segContainer: { marginBottom: S.lg },

    goalCard: { borderRadius: R.lg, padding: 16, marginBottom: 20, borderWidth: 1 },
    goalStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: 14 },
    goalStat: { alignItems: 'center', flex: 1 },
    goalStatValue: { fontSize: F.lg, fontWeight: '800' },
    goalStatLabel: { fontSize: F.xs, marginTop: 3 },
    goalDivider: { width: 1, height: 32 },
    goalNote: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 12, borderTopWidth: 1 },
    goalNoteText: { fontSize: F.xs, flex: 1 },

    gradeCard: { borderRadius: R.lg, borderWidth: 1, marginBottom: 20 },
    gradeScroll: { paddingHorizontal: 16, paddingVertical: 20, gap: 12 },
    gradeStep: { alignItems: 'center', gap: 6 },
    goalFlag: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
    goalFlagText: { fontSize: 9, fontWeight: '700' },
    stepBottom: { height: 18, alignItems: 'center', justifyContent: 'center' },
    nowLabel: { fontSize: 10, fontWeight: '600' },
    nextLabel: { fontSize: 10, fontWeight: '600' },

    statRow: { flexDirection: 'row', gap: 10, marginBottom: 32 },
    miniStat: { flex: 1, alignItems: 'center', paddingVertical: 16, gap: 4, borderRadius: R.md, borderWidth: 1 },
    miniStatValue: { fontSize: F.xl, fontWeight: '800' },
    miniStatLabel: { fontSize: F.xs, textAlign: 'center' },
  });
}
