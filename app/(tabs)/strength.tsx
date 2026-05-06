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
import {
  getStrengthSessions,
  computePRs,
  lastSessionDate,
  formatDate,
} from '@/services/strength';
import { supabase } from '@/lib/supabase';
import type { PRMap, StrengthSession } from '@/types';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function PRCard({
  label,
  value,
  unit,
  color,
  icon,
}: {
  label: string;
  value: string | null;
  unit: string;
  color: string;
  icon: IoniconName;
}) {
  return (
    <Card style={prStyles.card}>
      <View style={prStyles.iconRow}>
        <View style={[prStyles.iconWrap, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
      </View>
      <Text style={[prStyles.value, { color: value ? color : C.textMuted }]}>
        {value ?? '—'}
      </Text>
      <Text style={prStyles.unit}>{unit}</Text>
      <Text style={prStyles.label}>{label}</Text>
    </Card>
  );
}
const prStyles = StyleSheet.create({
  card: { flex: 1 },
  iconRow: { marginBottom: 8 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: R.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { fontSize: F.xl, fontWeight: '800' },
  unit: { fontSize: F.xs, color: C.textSub, marginTop: -2 },
  label: { fontSize: F.xs, color: C.textMuted, marginTop: 4 },
});

function CategoryCard({
  label,
  icon,
  lastSession,
  color,
}: {
  label: string;
  icon: IoniconName;
  lastSession: string | null;
  color: string;
}) {
  return (
    <TouchableOpacity style={catStyles.card} activeOpacity={0.7}>
      <View style={[catStyles.iconBox, { backgroundColor: color + '20', borderColor: color + '40' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={catStyles.label}>{label}</Text>
      <Text style={catStyles.last}>{lastSession ? formatDate(lastSession) : 'Not logged'}</Text>
    </TouchableOpacity>
  );
}
const catStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    gap: 4,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: R.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  label: { fontSize: F.sm, fontWeight: '700', color: C.text, textAlign: 'center' },
  last: { fontSize: 10, color: C.textMuted },
});

function WorkoutCard({ session }: { session: StrengthSession }) {
  const entries = session.strength_entries ?? [];
  const exerciseTypes = [...new Set(entries.map((e) => e.exercise_type))];

  return (
    <Card style={wStyles.card}>
      <View style={wStyles.top}>
        <View>
          <Text style={wStyles.name}>
            {exerciseTypes.length > 0
              ? exerciseTypes.slice(0, 2).map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' + ')
              : 'Strength Session'}
          </Text>
          <Text style={wStyles.meta}>
            {formatDate(session.date)}
            {session.duration ? ` · ${session.duration}m` : ''}
          </Text>
        </View>
        <Text style={wStyles.count}>{entries.length} exercises</Text>
      </View>
      <View style={wStyles.tags}>
        {exerciseTypes.slice(0, 4).map((t) => (
          <View key={t} style={wStyles.tag}>
            <Text style={wStyles.tagText}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
const wStyles = StyleSheet.create({
  card: { marginBottom: 10 },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  name: { fontSize: F.base, fontWeight: '700', color: C.text },
  meta: { fontSize: F.xs, color: C.textSub, marginTop: 2 },
  count: { fontSize: F.sm, fontWeight: '700', color: C.textSub },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: C.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: R.full,
    borderWidth: 1,
    borderColor: C.border,
  },
  tagText: { fontSize: F.xs, color: C.textSub },
});

function ProgressBar({
  label,
  pct,
  color,
  value,
}: {
  label: string;
  pct: number;
  color: string;
  value: string;
}) {
  return (
    <View style={pbStyles.row}>
      <Text style={pbStyles.label}>{label}</Text>
      <View style={pbStyles.track}>
        <View style={[pbStyles.fill, { width: `${Math.min(100, pct)}%`, backgroundColor: color }]} />
      </View>
      <Text style={[pbStyles.value, { color }]}>{value}</Text>
    </View>
  );
}
const pbStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  label: { width: 90, fontSize: F.xs, color: C.textSub },
  track: { flex: 1, height: 8, backgroundColor: C.border, borderRadius: R.full, overflow: 'hidden' },
  fill: { height: 8, borderRadius: R.full },
  value: { width: 52, fontSize: F.xs, fontWeight: '700', textAlign: 'right' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function StrengthScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [sessions, setSessions] = useState<StrengthSession[]>([]);
  const [prs, setPRs] = useState<PRMap>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const ss = await getStrengthSessions(user.id, 20);
      setSessions(ss);
      setPRs(computePRs(ss));
    } catch (e) {
      console.error('Strength load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('strength-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'strength_sessions', filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const pullUpPR = prs['pullups_reps'];
  const deadHangPR = prs['deadhang_duration'];
  const fingerboardPR = prs['fingerboard_duration'];
  const dipsPR = prs['dips_reps'];

  const allEntries = sessions.flatMap((s) => s.strength_entries ?? []);
  const maxPullup = pullUpPR ?? 0;
  const maxDeadHang = deadHangPR ?? 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={C.accent} />
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />
        }
      >
        {/* Page Header */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Strength</Text>
            <Text style={styles.pageSubtitle}>PRs · Workouts · Trends</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            activeOpacity={0.7}
            onPress={() => router.push('/log-workout')}
          >
            <Ionicons name="add" size={22} color={C.accent} />
          </TouchableOpacity>
        </View>

        {/* PR Summary */}
        <SectionHeader title="Personal Records" subtitle="All-time bests" />
        {sessions.length > 0 ? (
          <>
            <View style={[styles.prRow, styles.mb10]}>
              <PRCard
                label="Max Pull-Ups"
                value={pullUpPR ? String(pullUpPR) : null}
                unit="reps"
                color={C.primary}
                icon="body-outline"
              />
              <View style={{ width: 10 }} />
              <PRCard
                label="Dead Hang"
                value={deadHangPR ? `${deadHangPR}` : null}
                unit="seconds"
                color={C.accent}
                icon="hand-left-outline"
              />
            </View>
            <View style={[styles.prRow, styles.mb20]}>
              <PRCard
                label="Fingerboard"
                value={fingerboardPR ? `${fingerboardPR}` : null}
                unit="seconds"
                color={C.warning}
                icon="finger-print-outline"
              />
              <View style={{ width: 10 }} />
              <PRCard
                label="Max Dips"
                value={dipsPR ? String(dipsPR) : null}
                unit="reps"
                color={C.success}
                icon="trending-up-outline"
              />
            </View>
          </>
        ) : (
          <Card style={styles.mb20}>
            <EmptyState
              icon="barbell-outline"
              title="No workouts logged"
              message="Tap + to log your first strength session and start tracking PRs."
              actionLabel="Log a Workout"
              onAction={() => router.push('/log-workout')}
            />
          </Card>
        )}

        {/* Exercise Categories */}
        <SectionHeader title="Exercise Categories" />
        <View style={[styles.catGrid, styles.mb20]}>
          <View style={styles.catRow}>
            <CategoryCard
              label="Fingers"
              icon="finger-print-outline"
              lastSession={lastSessionDate(sessions, 'deadhang') ?? lastSessionDate(sessions, 'fingerboard')}
              color={C.primary}
            />
            <View style={{ width: 10 }} />
            <CategoryCard
              label="Pull"
              icon="trending-up-outline"
              lastSession={lastSessionDate(sessions, 'pullups')}
              color={C.accent}
            />
          </View>
          <View style={{ height: 10 }} />
          <View style={styles.catRow}>
            <CategoryCard
              label="Push"
              icon="arrow-up-outline"
              lastSession={lastSessionDate(sessions, 'pushups') ?? lastSessionDate(sessions, 'dips')}
              color={C.success}
            />
            <View style={{ width: 10 }} />
            <CategoryCard
              label="Core"
              icon="body-outline"
              lastSession={lastSessionDate(sessions, 'core') ?? lastSessionDate(sessions, 'plank')}
              color={C.warning}
            />
          </View>
        </View>

        {/* Recent Workouts */}
        <SectionHeader title="Recent Workouts" action="Refresh" onAction={onRefresh} />
        {sessions.length > 0 ? (
          sessions.slice(0, 5).map((s) => <WorkoutCard key={s.id} session={s} />)
        ) : (
          <Card style={styles.mb20}>
            <EmptyState
              icon="time-outline"
              title="No workout history"
              message="Your logged workouts will appear here."
            />
          </Card>
        )}
        <View style={styles.mb20} />

        {/* Progress Trends */}
        {sessions.length > 0 && (
          <>
            <SectionHeader title="Progress Trends" subtitle="All-time PRs as % of target" />
            <Card style={styles.mb32}>
              <ProgressBar
                label="Max Pull-Ups"
                pct={(maxPullup / 20) * 100}
                color={C.primary}
                value={maxPullup ? `${maxPullup} reps` : '—'}
              />
              <ProgressBar
                label="Dead Hang"
                pct={(maxDeadHang / 60) * 100}
                color={C.accent}
                value={maxDeadHang ? `${maxDeadHang}s` : '—'}
              />
              <ProgressBar
                label="Fingerboard"
                pct={fingerboardPR ? (fingerboardPR / 60) * 100 : 0}
                color={C.warning}
                value={fingerboardPR ? `${fingerboardPR}s` : '—'}
              />
              <ProgressBar
                label="Dips"
                pct={dipsPR ? (dipsPR / 20) * 100 : 0}
                color={C.success}
                value={dipsPR ? `${dipsPR} reps` : '—'}
              />
              <View style={styles.trendNote}>
                <Ionicons name="information-circle-outline" size={13} color={C.textMuted} />
                <Text style={styles.trendNoteText}>
                  Based on {sessions.length} logged workout{sessions.length !== 1 ? 's' : ''}
                </Text>
              </View>
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
  mb10: { marginBottom: 10 },
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
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  prRow: { flexDirection: 'row' },
  catGrid: {},
  catRow: { flexDirection: 'row' },
  trendNote: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 4 },
  trendNoteText: { fontSize: F.xs, color: C.textMuted, flex: 1 },
});
