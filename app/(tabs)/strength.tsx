import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  SafeAreaView as RNSafeAreaView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { F, R, S } from '@/constants/Theme';
import {
  getStrengthSessions,
  computePRs,
  lastSessionDate,
  formatDate,
} from '@/services/strength';
import { getGoalByType } from '@/services/goals';
import { supabase } from '@/lib/supabase';
import type { Goal, PRMap, StrengthSession } from '@/types';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Exercise category definitions ───────────────────────────────────────────

interface ExerciseDef {
  value: string;
  label: string;
  usesDuration: boolean;
  description: string;
}

const CATEGORIES: { key: string; label: string; icon: IoniconName; color: string; exercises: ExerciseDef[] }[] = [
  {
    key: 'fingers', label: 'Fingers', icon: 'finger-print-outline', color: '#FF6535',
    exercises: [
      { value: 'deadhang', label: 'Dead Hang', usesDuration: true, description: 'Hang from an edge at max effort — trains finger strength and tendon conditioning.' },
      { value: 'fingerboard', label: 'Fingerboard Repeaters', usesDuration: true, description: 'Timed hang/rest cycles at sub-max intensity — the gold standard for finger strength.' },
      { value: 'pinch', label: 'Pinch Blocks', usesDuration: false, description: 'Weighted pinch holds — improves grip breadth and thumb opposition.' },
    ],
  },
  {
    key: 'pull', label: 'Pull', icon: 'trending-up-outline', color: '#4B8EFF',
    exercises: [
      { value: 'pullups', label: 'Pull-Ups', usesDuration: false, description: 'Foundational vertical pulling strength.' },
      { value: 'weighted_pullups', label: 'Weighted Pull-Ups', usesDuration: false, description: 'Add weight for hypertrophy and max strength gains.' },
      { value: 'rows', label: 'Rows', usesDuration: false, description: 'Horizontal pulling — balances vertical pull.' },
      { value: 'lockoffs', label: 'Lock-Offs', usesDuration: true, description: 'Hold mid-pull — trains lock-off strength for high steps.' },
    ],
  },
  {
    key: 'push', label: 'Push', icon: 'arrow-up-outline', color: '#3DC87A',
    exercises: [
      { value: 'pushups', label: 'Push-Ups', usesDuration: false, description: 'Horizontal push — antagonist work for shoulder health.' },
      { value: 'dips', label: 'Dips', usesDuration: false, description: 'Tricep dips — antagonist pressing and elbow stability.' },
      { value: 'overhead_press', label: 'Overhead Press', usesDuration: false, description: 'Shoulder pressing — overhead mobility and rotator cuff health.' },
    ],
  },
  {
    key: 'core', label: 'Core', icon: 'body-outline', color: '#F5BC3C',
    exercises: [
      { value: 'plank', label: 'Plank', usesDuration: true, description: 'Static core hold — foundational midline stability.' },
      { value: 'core', label: 'Core Circuit', usesDuration: false, description: 'General abs, obliques, and lower back work.' },
      { value: 'l_sit', label: 'L-Sit', usesDuration: true, description: 'Compression strength — hip flexors and straight-arm stability.' },
      { value: 'ab_wheel', label: 'Ab Wheel', usesDuration: false, description: 'Anti-extension core work.' },
    ],
  },
  {
    key: 'legs', label: 'Legs', icon: 'walk-outline', color: '#A78BFA',
    exercises: [
      { value: 'squats', label: 'Squats', usesDuration: false, description: 'Bilateral quad and glute drive — helps with high foot placements.' },
      { value: 'lunges', label: 'Lunges', usesDuration: false, description: 'Single-leg strength and hip mobility.' },
      { value: 'step_ups', label: 'Step-Ups', usesDuration: false, description: 'Controlled single-leg elevation — mirrors high-step moves.' },
      { value: 'calf_raises', label: 'Calf Raises', usesDuration: false, description: 'Calf and foot strength — critical for smearing and edging.' },
    ],
  },
  {
    key: 'cardio', label: 'Cardio', icon: 'pulse-outline', color: '#F472B6',
    exercises: [
      { value: 'running', label: 'Running', usesDuration: true, description: 'Sustained aerobic effort — builds base fitness and recovery capacity.' },
      { value: 'cycling', label: 'Cycling', usesDuration: true, description: 'Low-impact cardio — great for active recovery and aerobic base.' },
      { value: 'rowing', label: 'Rowing', usesDuration: true, description: 'Full-body cardio — engages the posterior chain alongside the cardiovascular system.' },
      { value: 'jump_rope', label: 'Jump Rope', usesDuration: true, description: 'High-intensity footwork and coordination — great for climbing-specific agility.' },
      { value: 'stair_climber', label: 'Stair Climber', usesDuration: true, description: 'Step-by-step endurance — directly transfers to multi-pitch and wall endurance.' },
    ],
  },
];

// ─── Category detail modal ─────────────────────────────────────────────────────

function CategoryModal({
  categoryKey, sessions, prs, onClose,
}: { categoryKey: string | null; sessions: StrengthSession[]; prs: PRMap; onClose: () => void }) {
  const { colors: C } = useTheme();
  const cat = CATEGORIES.find((c) => c.key === categoryKey);
  if (!cat) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <RNSafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={[cmStyles.header, { borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={onClose} style={[cmStyles.closeBtn, { backgroundColor: C.surface }]}>
            <Ionicons name="close" size={22} color={C.text} />
          </TouchableOpacity>
          <View style={[cmStyles.catIcon, { backgroundColor: cat.color + '20' }]}>
            <Ionicons name={cat.icon} size={20} color={cat.color} />
          </View>
          <Text style={[cmStyles.title, { color: C.text }]}>{cat.label} Training</Text>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: S.md, paddingBottom: 60, paddingTop: 8 }}>
          {cat.exercises.map((ex) => {
            const prReps = prs[`${ex.value}_reps`];
            const prDuration = prs[`${ex.value}_duration`];
            const prWeight = prs[`${ex.value}_weight`];
            const lastDate = lastSessionDate(sessions, ex.value);
            const hasPR = prReps != null || prDuration != null || prWeight != null;
            return (
              <View key={ex.value} style={[cmStyles.exCard, { backgroundColor: C.card, borderColor: C.border }]}>
                <View style={cmStyles.exTop}>
                  <Text style={[cmStyles.exName, { color: C.text }]}>{ex.label}</Text>
                  {lastDate && <Text style={[cmStyles.exLast, { color: C.textSub }]}>{formatDate(lastDate)}</Text>}
                </View>
                <Text style={[cmStyles.exDesc, { color: C.textSub }]}>{ex.description}</Text>
                {hasPR && (
                  <View style={cmStyles.prRow}>
                    {prReps != null && (
                      <View style={[cmStyles.prBadge, { backgroundColor: cat.color + '20', borderColor: cat.color + '40' }]}>
                        <Text style={[cmStyles.prValue, { color: cat.color }]}>{prReps}</Text>
                        <Text style={[cmStyles.prUnit, { color: C.textSub }]}>reps PR</Text>
                      </View>
                    )}
                    {prDuration != null && (
                      <View style={[cmStyles.prBadge, { backgroundColor: cat.color + '20', borderColor: cat.color + '40' }]}>
                        <Text style={[cmStyles.prValue, { color: cat.color }]}>{prDuration}s</Text>
                        <Text style={[cmStyles.prUnit, { color: C.textSub }]}>duration PR</Text>
                      </View>
                    )}
                    {prWeight != null && (
                      <View style={[cmStyles.prBadge, { backgroundColor: cat.color + '20', borderColor: cat.color + '40' }]}>
                        <Text style={[cmStyles.prValue, { color: cat.color }]}>{prWeight}kg</Text>
                        <Text style={[cmStyles.prUnit, { color: C.textSub }]}>weight PR</Text>
                      </View>
                    )}
                  </View>
                )}
                {!hasPR && <Text style={[cmStyles.noData, { color: C.textMuted }]}>No data logged yet</Text>}
              </View>
            );
          })}
        </ScrollView>
      </RNSafeAreaView>
    </Modal>
  );
}
const cmStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: S.md, paddingVertical: 16, borderBottomWidth: 1 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  catIcon: { width: 36, height: 36, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: F.lg, fontWeight: '800', flex: 1 },
  exCard: { borderRadius: R.md, padding: 14, marginBottom: 10, borderWidth: 1 },
  exTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  exName: { fontSize: F.base, fontWeight: '700' },
  exLast: { fontSize: F.xs },
  exDesc: { fontSize: F.sm, lineHeight: 18, marginBottom: 8 },
  prRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  prBadge: { flexDirection: 'column', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.md, borderWidth: 1 },
  prValue: { fontSize: F.base, fontWeight: '800' },
  prUnit: { fontSize: F.xs },
  noData: { fontSize: F.xs, fontStyle: 'italic' },
});

// ─── PR Detail Modal ──────────────────────────────────────────────────────────

function PRDetailModal({ visible, prs, onClose }: { visible: boolean; prs: PRMap; onClose: () => void }) {
  const { colors: C } = useTheme();
  const totalPRs = Object.keys(prs).length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <RNSafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        {/* Header */}
        <View style={[prmStyles.header, { borderBottomColor: C.border }]}>
          <View>
            <Text style={[prmStyles.title, { color: C.text }]}>Personal Records</Text>
            <Text style={[prmStyles.sub, { color: C.textSub }]}>
              {totalPRs > 0 ? `${totalPRs} exercise${totalPRs !== 1 ? 's' : ''} tracked` : 'No records yet'}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[prmStyles.closeBtn, { backgroundColor: C.surface }]}>
            <Ionicons name="close" size={22} color={C.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: S.md, paddingBottom: 60, paddingTop: 12 }}>
          {CATEGORIES.map((cat) => {
            const catPRs = cat.exercises.flatMap((ex) => {
              const items: { label: string; value: number; unit: string }[] = [];
              const reps = prs[`${ex.value}_reps`];
              const dur = prs[`${ex.value}_duration`];
              const wt = prs[`${ex.value}_weight`];
              if (reps != null) items.push({ label: ex.label, value: reps, unit: 'reps' });
              if (dur != null) items.push({ label: ex.label, value: dur, unit: 'sec' });
              if (wt != null) items.push({ label: ex.label, value: wt, unit: 'kg' });
              return items;
            });

            return (
              <View key={cat.key} style={prmStyles.catSection}>
                <View style={prmStyles.catHeader}>
                  <View style={[prmStyles.catDot, { backgroundColor: cat.color }]} />
                  <Text style={[prmStyles.catTitle, { color: C.text }]}>{cat.label}</Text>
                  <Text style={[prmStyles.catCount, { color: C.textMuted }]}>
                    {catPRs.length > 0 ? `${catPRs.length} record${catPRs.length !== 1 ? 's' : ''}` : 'No records yet'}
                  </Text>
                </View>

                {catPRs.length === 0 ? (
                  <View style={[prmStyles.emptyRow, { backgroundColor: C.card, borderColor: C.border }]}>
                    <Text style={[prmStyles.emptyText, { color: C.textMuted }]}>
                      Log a {cat.label.toLowerCase()} workout to set your first PR
                    </Text>
                  </View>
                ) : (
                  <View style={[prmStyles.prList, { backgroundColor: C.card, borderColor: C.border }]}>
                    {catPRs.map((pr, i) => (
                      <React.Fragment key={`${pr.label}-${pr.unit}`}>
                        {i > 0 && <View style={[prmStyles.divider, { backgroundColor: C.border }]} />}
                        <View style={prmStyles.prRow}>
                          <Text style={[prmStyles.prExLabel, { color: C.textSub }]}>{pr.label}</Text>
                          <View style={prmStyles.prRight}>
                            <Text style={[prmStyles.prVal, { color: cat.color }]}>{pr.value}</Text>
                            <Text style={[prmStyles.prUnit, { color: C.textMuted }]}>{pr.unit}</Text>
                          </View>
                        </View>
                      </React.Fragment>
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          {totalPRs === 0 && (
            <View style={[prmStyles.bigEmpty, { backgroundColor: C.card, borderColor: C.border }]}>
              <Ionicons name="trophy-outline" size={40} color={C.textMuted} />
              <Text style={[prmStyles.bigEmptyTitle, { color: C.text }]}>No records yet</Text>
              <Text style={[prmStyles.bigEmptySub, { color: C.textSub }]}>
                Log strength sessions to see your personal records here.
              </Text>
            </View>
          )}
        </ScrollView>
      </RNSafeAreaView>
    </Modal>
  );
}
const prmStyles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 16, borderBottomWidth: 1 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: F.xl, fontWeight: '800' },
  sub: { fontSize: F.xs, marginTop: 2 },

  catSection: { marginBottom: 20 },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catTitle: { fontSize: F.base, fontWeight: '700', flex: 1 },
  catCount: { fontSize: F.xs },

  emptyRow: { borderRadius: R.md, padding: 14, borderWidth: 1, alignItems: 'center' },
  emptyText: { fontSize: F.sm, textAlign: 'center' },

  prList: { borderRadius: R.md, borderWidth: 1, overflow: 'hidden' },
  divider: { height: 1 },
  prRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  prExLabel: { fontSize: F.sm, flex: 1 },
  prRight: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  prVal: { fontSize: F.lg, fontWeight: '800' },
  prUnit: { fontSize: F.xs, fontWeight: '600' },

  bigEmpty: { borderRadius: R.lg, padding: 40, borderWidth: 1, alignItems: 'center', gap: 10 },
  bigEmptyTitle: { fontSize: F.lg, fontWeight: '800' },
  bigEmptySub: { fontSize: F.sm, textAlign: 'center', lineHeight: 18 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function StrengthScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors: C } = useTheme();

  const [sessions, setSessions] = useState<StrengthSession[]>([]);
  const [prs, setPRs] = useState<PRMap>({});
  const [strengthGoal, setStrengthGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategoryKey, setActiveCategoryKey] = useState<string | null>(null);
  const [showPRModal, setShowPRModal] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [ss, sg] = await Promise.all([
        getStrengthSessions(user.id, 20),
        getGoalByType(user.id, 'strength'),
      ]);
      setSessions(ss);
      setPRs(computePRs(ss));
      setStrengthGoal(sg);
    } catch (e) {
      console.error('Strength load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('strength-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'strength_sessions', filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const lastForCategory = (catKey: string) => {
    const cat = CATEGORIES.find((c) => c.key === catKey);
    if (!cat) return null;
    for (const ex of cat.exercises) {
      const d = lastSessionDate(sessions, ex.value);
      if (d) return d;
    }
    return null;
  };

  const styles = useMemo(() => makeStyles(C), [C]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar style="auto" />
        <View style={styles.loadingCenter}><ActivityIndicator size="large" color={C.accent} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="auto" />

      <CategoryModal categoryKey={activeCategoryKey} sessions={sessions} prs={prs} onClose={() => setActiveCategoryKey(null)} />
      <PRDetailModal visible={showPRModal} prs={prs} onClose={() => setShowPRModal(false)} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
      >
        {/* Page Header */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Strength</Text>
            <Text style={styles.pageSubtitle}>Goal · Exercises · Progress</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} activeOpacity={0.7} onPress={() => router.push('/log-workout')}>
            <Ionicons name="add" size={22} color={C.accent} />
          </TouchableOpacity>
        </View>

        {/* ── 1. Strength Goal (TOP) ───────────────────────────────────────── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Strength Goal</Text>
          {!strengthGoal && (
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
              <Text style={[styles.sectionAction, { color: C.primary }]}>Set Goal</Text>
            </TouchableOpacity>
          )}
        </View>
        {strengthGoal ? (
          (() => {
            const ex = strengthGoal.exercise_type ?? '';
            const metric = strengthGoal.unit === 'seconds' ? 'duration' : 'reps';
            const pr = prs[`${ex}_${metric}`] ?? 0;
            const target = strengthGoal.target_value ?? 0;
            const pct = target > 0 ? Math.min(100, Math.round((pr / target) * 100)) : 0;
            const exLabel = ex.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            return (
              <View style={[styles.goalCard, { backgroundColor: '#A78BFA12', borderColor: '#A78BFA40' }]}>
                <View style={styles.goalTop}>
                  <Text style={styles.goalExercise}>{exLabel}</Text>
                  {strengthGoal.target_date && (
                    <Text style={styles.goalDate}>
                      Due {new Date(strengthGoal.target_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </Text>
                  )}
                </View>
                <View style={styles.goalMetrics}>
                  {[
                    { label: 'Target', value: `${target} ${strengthGoal.unit ?? ''}` },
                    { label: 'Current PR', value: pr > 0 ? `${pr} ${strengthGoal.unit ?? ''}` : '—' },
                    { label: 'Progress', value: `${pct}%` },
                  ].map((m, i) => (
                    <React.Fragment key={m.label}>
                      {i > 0 && <View style={[styles.goalMetricDivider, { backgroundColor: '#A78BFA30' }]} />}
                      <View style={styles.goalMetric}>
                        <Text style={[styles.goalMetricValue, { color: '#A78BFA' }]}>{m.value}</Text>
                        <Text style={styles.goalMetricLabel}>{m.label}</Text>
                      </View>
                    </React.Fragment>
                  ))}
                </View>
                <View style={[styles.progressTrack, { backgroundColor: C.border }]}>
                  <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: '#A78BFA' }]} />
                </View>
              </View>
            );
          })()
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Ionicons name="barbell-outline" size={26} color={C.textMuted} />
            <Text style={styles.emptyTitle}>No strength goal set</Text>
            <Text style={styles.emptySub}>Set a target in Profile → Goals to track progress here.</Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: C.primaryBg, borderColor: C.primaryBorder }]}
              onPress={() => router.push('/(tabs)/profile')}
            >
              <Text style={[styles.emptyBtnText, { color: C.primary }]}>Set Goal</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── 2. Exercise Categories ───────────────────────────────────────── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Exercise Categories</Text>
          <Text style={[styles.sectionHint, { color: C.textMuted }]}>Tap to view</Text>
        </View>
        <View style={styles.catGrid}>
          {[[CATEGORIES[0], CATEGORIES[1]], [CATEGORIES[2], CATEGORIES[3]], [CATEGORIES[4], CATEGORIES[5]]].map((row, ri) => (
            <View key={ri} style={[styles.catRow, ri > 0 && { marginTop: 10 }]}>
              {row.map((cat, ci) => (
                <React.Fragment key={cat.key}>
                  {ci > 0 && <View style={{ width: 10 }} />}
                  <TouchableOpacity
                    style={[styles.catCard, { backgroundColor: C.card, borderColor: C.border }]}
                    onPress={() => setActiveCategoryKey(cat.key)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.catIconBox, { backgroundColor: cat.color + '20', borderColor: cat.color + '40' }]}>
                      <Ionicons name={cat.icon} size={22} color={cat.color} />
                    </View>
                    <Text style={[styles.catLabel, { color: C.text }]}>{cat.label}</Text>
                    <Text style={[styles.catLast, { color: C.textMuted }]}>
                      {lastForCategory(cat.key) ? formatDate(lastForCategory(cat.key)!) : 'Not logged'}
                    </Text>
                    <Ionicons name="chevron-forward" size={11} color={C.textMuted} style={{ marginTop: 2 }} />
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>
          ))}
        </View>

        {/* ── 3. Recent Workouts ───────────────────────────────────────────── */}
        <View style={[styles.sectionRow, { marginTop: 10 }]}>
          <Text style={styles.sectionLabel}>Recent Workouts</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={[styles.sectionAction, { color: C.primary }]}>Refresh</Text>
          </TouchableOpacity>
        </View>
        {sessions.length > 0 ? (
          sessions.slice(0, 5).map((s) => {
            const entries = s.strength_entries ?? [];
            const exerciseTypes = [...new Set(entries.map((e) => e.exercise_type))];
            return (
              <View key={s.id} style={[styles.workoutCard, { backgroundColor: C.card, borderColor: C.border }]}>
                <View style={styles.workoutTop}>
                  <View>
                    <Text style={[styles.workoutName, { color: C.text }]}>
                      {exerciseTypes.length > 0
                        ? exerciseTypes.slice(0, 2).map((t) => t.charAt(0).toUpperCase() + t.slice(1).replace('_', ' ')).join(' + ')
                        : 'Strength Session'}
                    </Text>
                    <Text style={[styles.workoutMeta, { color: C.textSub }]}>
                      {formatDate(s.date)}{s.duration ? ` · ${s.duration}m` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.workoutCount, { color: C.textSub }]}>{entries.length} exercises</Text>
                </View>
                <View style={styles.workoutTags}>
                  {exerciseTypes.slice(0, 4).map((t) => (
                    <View key={t} style={[styles.tag, { backgroundColor: C.surface, borderColor: C.border }]}>
                      <Text style={[styles.tagText, { color: C.textSub }]}>{t.charAt(0).toUpperCase() + t.slice(1).replace('_', ' ')}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Ionicons name="time-outline" size={26} color={C.textMuted} />
            <Text style={styles.emptyTitle}>No workout history</Text>
            <Text style={styles.emptySub}>Tap + to log your first strength session.</Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: C.accentBg, borderColor: C.accentBorder }]}
              onPress={() => router.push('/log-workout')}
            >
              <Text style={[styles.emptyBtnText, { color: C.accent }]}>Log a Workout</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── 4. Personal Records (BOTTOM) ────────────────────────────────── */}
        {sessions.length > 0 && (
          <>
            <View style={[styles.sectionRow, { marginTop: 4 }]}>
              <Text style={styles.sectionLabel}>Personal Records</Text>
              <TouchableOpacity onPress={() => setShowPRModal(true)}>
                <Text style={[styles.sectionAction, { color: C.primary }]}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.prGrid}>
              {[
                { key: 'pullups_reps', label: 'Max Pull-Ups', unit: 'reps', color: C.primary, icon: 'body-outline' as IoniconName },
                { key: 'deadhang_duration', label: 'Dead Hang', unit: 'sec', color: C.accent, icon: 'hand-left-outline' as IoniconName },
                { key: 'fingerboard_duration', label: 'Fingerboard', unit: 'sec', color: C.warning, icon: 'finger-print-outline' as IoniconName },
                { key: 'dips_reps', label: 'Max Dips', unit: 'reps', color: C.success, icon: 'trending-up-outline' as IoniconName },
              ].map((pr) => (
                <TouchableOpacity
                  key={pr.key}
                  style={[styles.prCard, { backgroundColor: C.card, borderColor: C.border }]}
                  onPress={() => setShowPRModal(true)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.prIconWrap, { backgroundColor: pr.color + '20' }]}>
                    <Ionicons name={pr.icon} size={16} color={pr.color} />
                  </View>
                  <Text style={[styles.prValue, { color: prs[pr.key] ? pr.color : C.textMuted }]}>
                    {prs[pr.key] ?? '—'}
                  </Text>
                  <Text style={[styles.prUnit, { color: C.textSub }]}>{pr.unit}</Text>
                  <Text style={[styles.prLabel, { color: C.textMuted }]}>{pr.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Progress bars */}
            <View style={[styles.progressCard, { backgroundColor: C.card, borderColor: C.border }]}>
              {[
                { label: 'Max Pull-Ups', value: prs['pullups_reps'] ?? 0, max: 20, color: C.primary, display: prs['pullups_reps'] ? `${prs['pullups_reps']} reps` : '—' },
                { label: 'Dead Hang', value: prs['deadhang_duration'] ?? 0, max: 60, color: C.accent, display: prs['deadhang_duration'] ? `${prs['deadhang_duration']}s` : '—' },
                { label: 'Fingerboard', value: prs['fingerboard_duration'] ?? 0, max: 60, color: C.warning, display: prs['fingerboard_duration'] ? `${prs['fingerboard_duration']}s` : '—' },
                { label: 'Dips', value: prs['dips_reps'] ?? 0, max: 20, color: C.success, display: prs['dips_reps'] ? `${prs['dips_reps']} reps` : '—' },
              ].map((bar) => (
                <View key={bar.label} style={styles.barRow}>
                  <Text style={[styles.barLabel, { color: C.textSub }]}>{bar.label}</Text>
                  <View style={[styles.barTrack, { backgroundColor: C.border }]}>
                    <View style={[styles.barFill, { width: `${Math.min(100, (bar.value / bar.max) * 100)}%`, backgroundColor: bar.color }]} />
                  </View>
                  <Text style={[styles.barValue, { color: bar.color }]}>{bar.display}</Text>
                </View>
              ))}
              <View style={styles.trendNote}>
                <Ionicons name="information-circle-outline" size={13} color={C.textMuted} />
                <Text style={[styles.trendNoteText, { color: C.textMuted }]}>
                  Based on {sessions.length} workout{sessions.length !== 1 ? 's' : ''}
                </Text>
              </View>
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
    addBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.accentBg, borderWidth: 1, borderColor: C.accentBorder, alignItems: 'center', justifyContent: 'center' },

    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    sectionLabel: { fontSize: F.base, fontWeight: '700', color: C.text },
    sectionAction: { fontSize: F.sm, fontWeight: '600' },
    sectionHint: { fontSize: F.xs },

    // Goal
    goalCard: { borderRadius: R.lg, padding: 16, marginBottom: 20, borderWidth: 1 },
    goalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    goalExercise: { fontSize: F.md, fontWeight: '800', color: C.text },
    goalDate: { fontSize: F.xs, color: C.textSub },
    goalMetrics: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 14 },
    goalMetric: { alignItems: 'center' },
    goalMetricValue: { fontSize: F.lg, fontWeight: '800' },
    goalMetricLabel: { fontSize: F.xs, color: C.textSub, marginTop: 2 },
    goalMetricDivider: { width: 1, height: 40 },
    progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: 6, borderRadius: 3 },

    // Empty
    emptyCard: { borderRadius: R.lg, padding: 24, borderWidth: 1, alignItems: 'center', gap: 8, marginBottom: 20 },
    emptyTitle: { fontSize: F.base, fontWeight: '700', color: C.text },
    emptySub: { fontSize: F.sm, color: C.textSub, textAlign: 'center' },
    emptyBtn: { marginTop: 4, paddingHorizontal: 18, paddingVertical: 8, borderRadius: R.full, borderWidth: 1 },
    emptyBtnText: { fontSize: F.sm, fontWeight: '700' },

    // Category grid
    catGrid: { marginBottom: 20 },
    catRow: { flexDirection: 'row' },
    catCard: { flex: 1, borderRadius: R.lg, padding: 14, alignItems: 'center', borderWidth: 1, gap: 4 },
    catIconBox: { width: 48, height: 48, borderRadius: R.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    catLabel: { fontSize: F.sm, fontWeight: '700', textAlign: 'center' },
    catLast: { fontSize: 10 },

    // Workouts
    workoutCard: { borderRadius: R.lg, padding: 14, marginBottom: 10, borderWidth: 1 },
    workoutTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    workoutName: { fontSize: F.base, fontWeight: '700' },
    workoutMeta: { fontSize: F.xs, marginTop: 2 },
    workoutCount: { fontSize: F.sm, fontWeight: '700' },
    workoutTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.full, borderWidth: 1 },
    tagText: { fontSize: F.xs },

    // PRs
    prGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
    prCard: { width: '47%', borderRadius: R.md, padding: 14, borderWidth: 1 },
    prIconWrap: { width: 32, height: 32, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    prValue: { fontSize: F.xl, fontWeight: '800' },
    prUnit: { fontSize: F.xs, marginTop: -2 },
    prLabel: { fontSize: F.xs, marginTop: 4 },

    progressCard: { borderRadius: R.lg, padding: 16, borderWidth: 1, marginBottom: 32 },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    barLabel: { width: 90, fontSize: F.xs },
    barTrack: { flex: 1, height: 8, borderRadius: R.full, overflow: 'hidden' },
    barFill: { height: 8, borderRadius: R.full },
    barValue: { width: 52, fontSize: F.xs, fontWeight: '700', textAlign: 'right' },
    trendNote: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 4 },
    trendNoteText: { fontSize: F.xs, flex: 1 },
  });
}
