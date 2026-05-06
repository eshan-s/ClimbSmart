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
  getProjects,
  calcSessionsThisWeek,
} from '@/services/climbing';
import { supabase } from '@/lib/supabase';
import type { Goal, ClimbingSession, ClimbingAttempt } from '@/types';
import {
  gradeColor,
  maxGradeFromAttempts,
  gradeToNum,
  DISPLAY_GRADES,
} from '@/utils/grades';
import { formatDate } from '@/services/strength';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function GradePill({ grade, active = false }: { grade: string; active?: boolean }) {
  const color = gradeColor(grade);
  return (
    <View
      style={[
        gpStyles.pill,
        { backgroundColor: active ? color : color + '22', borderColor: active ? color : color + '55' },
      ]}
    >
      <Text style={[gpStyles.text, { color: active ? C.white : color }]}>{grade}</Text>
    </View>
  );
}
const gpStyles = StyleSheet.create({
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: R.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontSize: F.sm, fontWeight: '800' },
});

function SessionCard({ session }: { session: ClimbingSession }) {
  const attempts = session.climbing_attempts ?? [];
  const sends = attempts.filter((a) => a.result === 'send' || a.result === 'flash').length;
  const maxG = maxGradeFromAttempts(attempts);
  const isOutdoor = session.session_type === 'outdoor';
  const color = isOutdoor ? C.success : C.primary;

  return (
    <Card style={sessStyles.card}>
      <View style={sessStyles.top}>
        <View style={sessStyles.venueRow}>
          <View style={[sessStyles.dot, { backgroundColor: color }]} />
          <View>
            <Text style={sessStyles.venue}>
              {session.gym_name ?? (isOutdoor ? 'Outdoor' : 'Gym Session')}
            </Text>
            <Text style={sessStyles.date}>
              {formatDate(session.date)}
              {session.duration ? ` · ${session.duration}m` : ''}
            </Text>
          </View>
        </View>
        {maxG ? <GradePill grade={maxG} /> : null}
      </View>
      <View style={sessStyles.stats}>
        <View style={sessStyles.stat}>
          <Ionicons name="checkmark-circle-outline" size={13} color={C.success} />
          <Text style={sessStyles.statText}>{sends} sends</Text>
        </View>
        <View style={sessStyles.stat}>
          <Ionicons name="flag-outline" size={13} color={C.textSub} />
          <Text style={sessStyles.statText}>{attempts.length} attempts</Text>
        </View>
        <View style={sessStyles.stat}>
          <Ionicons
            name={isOutdoor ? 'leaf-outline' : 'business-outline'}
            size={13}
            color={C.textSub}
          />
          <Text style={sessStyles.statText}>{isOutdoor ? 'Outdoor' : 'Indoor'}</Text>
        </View>
      </View>
    </Card>
  );
}
const sessStyles = StyleSheet.create({
  card: { marginBottom: 10 },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  venue: { fontSize: F.base, fontWeight: '700', color: C.text },
  date: { fontSize: F.xs, color: C.textSub, marginTop: 2 },
  stats: { flexDirection: 'row', gap: 16 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: F.xs, color: C.textSub },
});

function ProjectCard({ attempt }: { attempt: ClimbingAttempt }) {
  const color = gradeColor(attempt.grade);
  return (
    <Card style={projStyles.card}>
      <View style={projStyles.row}>
        <View style={[projStyles.gradeBox, { backgroundColor: color + '20', borderColor: color + '55' }]}>
          <Text style={[projStyles.gradeText, { color }]}>{attempt.grade}</Text>
        </View>
        <View style={projStyles.info}>
          <Text style={projStyles.name}>{attempt.route_name ?? 'Unnamed project'}</Text>
          {attempt.notes ? <Text style={projStyles.beta}>{attempt.notes}</Text> : null}
        </View>
        <View style={projStyles.right}>
          <Ionicons name="play-circle" size={14} color={C.warning} />
          <Text style={projStyles.statusText}>Working</Text>
          <Text style={projStyles.attempts}>{attempt.attempts} tries</Text>
        </View>
      </View>
    </Card>
  );
}
const projStyles = StyleSheet.create({
  card: { marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  gradeBox: {
    width: 46,
    height: 46,
    borderRadius: R.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeText: { fontSize: F.base, fontWeight: '800' },
  info: { flex: 1 },
  name: { fontSize: F.base, fontWeight: '700', color: C.text },
  beta: { fontSize: F.xs, color: C.textSub, marginTop: 3 },
  right: { alignItems: 'flex-end', gap: 2 },
  statusText: { fontSize: F.xs, fontWeight: '700', color: C.warning },
  attempts: { fontSize: F.xs, color: C.textMuted },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ClimbingScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [goal, setGoal] = useState<Goal | null>(null);
  const [sessions, setSessions] = useState<ClimbingSession[]>([]);
  const [projects, setProjects] = useState<ClimbingAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [g, cs, proj] = await Promise.all([
        getActiveGoal(user.id),
        getClimbingSessions(user.id, 10),
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
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Realtime: refresh when a new session is inserted
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('climbing-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'climbing_sessions',
          filter: `user_id=eq.${user.id}`,
        },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const allAttempts = sessions.flatMap((s) => s.climbing_attempts ?? []);
  const sends = allAttempts.filter((a) => a.result === 'send' || a.result === 'flash');
  const currentGrade = maxGradeFromAttempts(allAttempts);
  const currentGradeNum = currentGrade ? gradeToNum(currentGrade) : -1;
  const goalGradeNum = goal ? gradeToNum(goal.target_grade) : -1;
  const sessThisWeek = calcSessionsThisWeek(sessions);

  // Unique projects by route_name (or id if no name)
  const uniqueProjects = Object.values(
    projects.reduce<Record<string, ClimbingAttempt>>((acc, p) => {
      const key = p.route_name ?? p.id;
      if (!acc[key] || new Date(p.created_at) > new Date(acc[key].created_at)) {
        acc[key] = p;
      }
      return acc;
    }, {})
  );

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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
      >
        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Climbing</Text>
            <Text style={styles.pageSubtitle}>Sessions · Projects · Progress</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            activeOpacity={0.7}
            onPress={() => router.push('/log-climb')}
          >
            <Ionicons name="add" size={22} color={C.primary} />
          </TouchableOpacity>
        </View>

        {/* ── Current Goal ─────────────────────────────────────────────────── */}
        <SectionHeader title="Current Goal" />
        {goal ? (
          <Card variant="primary" style={styles.mb20}>
            <View style={styles.goalStats}>
              <View style={styles.goalStat}>
                <Text style={styles.goalStatValue}>{goal.target_grade}</Text>
                <Text style={styles.goalStatLabel}>Target</Text>
              </View>
              <View style={styles.goalDivider} />
              <View style={styles.goalStat}>
                <Text style={styles.goalStatValue}>{currentGrade ?? '—'}</Text>
                <Text style={styles.goalStatLabel}>Current</Text>
              </View>
              <View style={styles.goalDivider} />
              <View style={styles.goalStat}>
                <Text style={styles.goalStatValue}>{sessThisWeek}</Text>
                <Text style={styles.goalStatLabel}>Sess / wk</Text>
              </View>
              <View style={styles.goalDivider} />
              <View style={styles.goalStat}>
                <Text style={[styles.goalStatValue, { color: C.success }]}>{sends.length}</Text>
                <Text style={styles.goalStatLabel}>Total sends</Text>
              </View>
            </View>
            {goal.target_date && (
              <View style={styles.goalNote}>
                <Ionicons name="calendar-outline" size={13} color={C.textSub} />
                <Text style={styles.goalNoteText}>
                  Target date:{' '}
                  {new Date(goal.target_date).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            )}
          </Card>
        ) : (
          <Card style={styles.mb20}>
            <EmptyState
              icon="flag-outline"
              title="No active goal"
              message="Set a target grade in your Profile to track progression here."
            />
          </Card>
        )}

        {/* ── Grade Progression ─────────────────────────────────────────────── */}
        {allAttempts.length > 0 && (
          <>
            <SectionHeader title="Grade Ladder" subtitle="Highest confirmed sends" />
            <Card noPadding style={styles.mb20}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={gradeStyles.scroll}
              >
                {DISPLAY_GRADES.map((grade) => {
                  const gNum = gradeToNum(grade);
                  const isCurrent = grade === currentGrade;
                  const isGoal = goal && grade === goal.target_grade;
                  const isDone = sends.some((a) => gradeToNum(a.grade) >= gNum) && !isCurrent;

                  return (
                    <View key={grade} style={gradeStyles.step}>
                      {isGoal && (
                        <View style={gradeStyles.goalFlag}>
                          <Ionicons name="flag" size={9} color={C.primary} />
                          <Text style={gradeStyles.goalFlagText}>Goal</Text>
                        </View>
                      )}
                      <GradePill grade={grade} active={isCurrent} />
                      <View style={gradeStyles.stepBottom}>
                        {isDone ? (
                          <Ionicons name="checkmark-circle" size={14} color={C.success} />
                        ) : isCurrent ? (
                          <Text style={gradeStyles.nowLabel}>Now</Text>
                        ) : isGoal ? (
                          <Text style={gradeStyles.nextLabel}>Next</Text>
                        ) : (
                          <View style={gradeStyles.emptyStep} />
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </Card>
          </>
        )}

        {/* ── Recent Sessions ──────────────────────────────────────────────── */}
        <SectionHeader title="Recent Sessions" action="Refresh" onAction={onRefresh} />
        {sessions.length > 0 ? (
          sessions.slice(0, 5).map((s) => <SessionCard key={s.id} session={s} />)
        ) : (
          <Card style={styles.mb20}>
            <EmptyState
              icon="flag-outline"
              title="No sessions yet"
              message="Tap the + button to log your first climbing session."
              actionLabel="Log a Session"
              onAction={() => router.push('/log-climb')}
            />
          </Card>
        )}
        <View style={styles.mb20} />

        {/* ── Active Projects ──────────────────────────────────────────────── */}
        <SectionHeader title="Active Projects" subtitle="Climbs marked as 'project'" action="Log" onAction={() => router.push('/log-climb')} />
        {uniqueProjects.length > 0 ? (
          uniqueProjects.slice(0, 5).map((p) => <ProjectCard key={p.id} attempt={p} />)
        ) : (
          <Card style={styles.mb20}>
            <EmptyState
              icon="bookmark-outline"
              title="No active projects"
              message="When logging a session, mark a climb as 'Project' to track it here."
            />
          </Card>
        )}
        <View style={styles.mb32} />

        {/* ── Season Stats ────────────────────────────────────────────────── */}
        {sessions.length > 0 && (
          <>
            <SectionHeader title="Season Stats" />
            <View style={[styles.statRow, styles.mb32]}>
              {[
                {
                  label: 'Sessions',
                  value: String(sessions.length),
                  icon: 'calendar-outline' as IoniconName,
                  color: C.accent,
                },
                {
                  label: 'Total Sends',
                  value: String(sends.length),
                  icon: 'checkmark-done-outline' as IoniconName,
                  color: C.success,
                },
                {
                  label: 'Projects',
                  value: String(uniqueProjects.length),
                  icon: 'bookmark-outline' as IoniconName,
                  color: C.primary,
                },
              ].map((s) => (
                <Card key={s.label} style={styles.miniStat}>
                  <Ionicons name={s.icon} size={18} color={s.color} />
                  <Text style={[styles.miniStatValue, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.miniStatLabel}>{s.label}</Text>
                </Card>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const gradeStyles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingVertical: 20, gap: 12 },
  step: { alignItems: 'center', gap: 6 },
  goalFlag: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
  goalFlagText: { fontSize: 9, color: C.primary, fontWeight: '700' },
  stepBottom: { height: 18, alignItems: 'center', justifyContent: 'center' },
  nowLabel: { fontSize: 10, color: C.textSub, fontWeight: '600' },
  nextLabel: { fontSize: 10, color: C.textMuted, fontWeight: '600' },
  emptyStep: { height: 14 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: 100 },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mb20: { marginBottom: 20 },
  mb32: { marginBottom: 32 },

  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: S.lg,
  },
  pageTitle: { fontSize: F.xxl, fontWeight: '800', color: C.text, letterSpacing: 0.3 },
  pageSubtitle: { fontSize: F.xs, color: C.textSub, marginTop: 3 },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.primaryBg,
    borderWidth: 1,
    borderColor: C.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  goalStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 14,
  },
  goalStat: { alignItems: 'center', flex: 1 },
  goalStatValue: { fontSize: F.lg, fontWeight: '800', color: C.text },
  goalStatLabel: { fontSize: F.xs, color: C.textSub, marginTop: 3 },
  goalDivider: { width: 1, height: 32, backgroundColor: C.primaryBorder },
  goalNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.primaryBorder,
  },
  goalNoteText: { fontSize: F.xs, color: C.textSub, flex: 1 },

  statRow: { flexDirection: 'row', gap: 10 },
  miniStat: { flex: 1, alignItems: 'center', paddingVertical: 16, gap: 4 },
  miniStatValue: { fontSize: F.xl, fontWeight: '800' },
  miniStatLabel: { fontSize: F.xs, color: C.textSub, textAlign: 'center' },
});
