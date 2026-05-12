import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { F, R, S } from '@/constants/Theme';
import MiniBarChart from '@/components/ui/MiniBarChart';
import {
  getInsights,
  generateAndSaveInsights,
  fetchInsightsData,
  type InsightsData,
} from '@/services/insights';
import { supabase } from '@/lib/supabase';
import type { Insight } from '@/types';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Insight card ─────────────────────────────────────────────────────────────

type InsightConfig = { icon: IoniconName; colorKey: 'primary' | 'warning' | 'success' | 'accent' };

const INSIGHT_ICON_MAP: Record<Insight['type'], InsightConfig> = {
  bottleneck: { icon: 'warning-outline', colorKey: 'warning' },
  focus: { icon: 'bulb-outline', colorKey: 'primary' },
  volume: { icon: 'bar-chart-outline', colorKey: 'accent' },
  recovery: { icon: 'heart-outline', colorKey: 'warning' },
};

function InsightCard({ insight, C }: { insight: Insight; C: ReturnType<typeof useTheme>['colors'] }) {
  const config = INSIGHT_ICON_MAP[insight.type] ?? INSIGHT_ICON_MAP.focus;
  const color = C[config.colorKey];
  return (
    <View style={[icStyles.card, { backgroundColor: C.card, borderColor: C.border }]}>
      <View style={icStyles.top}>
        <View style={[icStyles.iconWrap, { backgroundColor: color + '20' }]}>
          <Ionicons name={config.icon} size={20} color={color} />
        </View>
        <View style={[icStyles.chip, { backgroundColor: color + '15', borderColor: color + '40' }]}>
          <Text style={[icStyles.chipText, { color }]}>
            {insight.type.charAt(0).toUpperCase() + insight.type.slice(1)}
          </Text>
        </View>
      </View>
      <Text style={[icStyles.summary, { color: C.text }]}>{insight.summary}</Text>
      {insight.recommendation && (
        <View style={icStyles.recRow}>
          <Ionicons name="arrow-forward-circle-outline" size={14} color={color} />
          <Text style={[icStyles.recText, { color: C.textSub }]}>{insight.recommendation}</Text>
        </View>
      )}
    </View>
  );
}
const icStyles = StyleSheet.create({
  card: { borderRadius: R.lg, padding: 16, marginBottom: 10, borderWidth: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  chip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: R.full, borderWidth: 1 },
  chipText: { fontSize: F.xs, fontWeight: '700' },
  summary: { fontSize: F.base, fontWeight: '600', marginBottom: 8 },
  recRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  recText: { fontSize: F.sm, flex: 1, lineHeight: 18 },
});

// ─── Metric row ───────────────────────────────────────────────────────────────

function MetricRow({
  label, value, sub, color, C,
}: { label: string; value: string; sub?: string; color?: string; C: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View style={[mrStyles.row, { borderBottomColor: C.border }]}>
      <Text style={[mrStyles.label, { color: C.textSub }]}>{label}</Text>
      <View style={mrStyles.right}>
        <Text style={[mrStyles.value, { color: color ?? C.text }]}>{value}</Text>
        {sub ? <Text style={[mrStyles.sub, { color: C.textMuted }]}>{sub}</Text> : null}
      </View>
    </View>
  );
}
const mrStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1 },
  label: { fontSize: F.sm, flex: 1 },
  right: { alignItems: 'flex-end' },
  value: { fontSize: F.sm, fontWeight: '700' },
  sub: { fontSize: F.xs, marginTop: 1 },
});

// ─── How we calculate card ────────────────────────────────────────────────────

const HOW_WE_CALCULATE = [
  { icon: 'calendar-outline' as IoniconName, title: 'Climbing Sessions', body: 'We look at your recent sessions, how often you climb, and whether you\'re training consistently over time.' },
  { icon: 'checkmark-done-outline' as IoniconName, title: 'Success Rate', body: 'We compare the number of climbs you send to your total attempts. A lower rate can signal that you\'re challenging yourself — but too low may mean overreaching.' },
  { icon: 'barbell-outline' as IoniconName, title: 'Strength Progress', body: 'We track your personal records for pull-ups, dead hangs, fingerboard, and other exercises to spot gains and flag gaps in training.' },
  { icon: 'trending-up-outline' as IoniconName, title: 'Grade Progression', body: 'We watch for new grade milestones in bouldering and top rope. When your highest grade stops improving, we surface a recommendation.' },
  { icon: 'heart-outline' as IoniconName, title: 'Consistency & Recovery', body: 'Too many sessions in a short window can signal overload. We flag this so you can rest before your next hard push.' },
];

function HowWeCalculate({ C }: { C: ReturnType<typeof useTheme>['colors'] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={[hwcStyles.wrapper, { backgroundColor: C.card, borderColor: C.border }]}>
      <TouchableOpacity style={hwcStyles.toggle} onPress={() => setExpanded((v) => !v)} activeOpacity={0.8}>
        <Ionicons name="information-circle-outline" size={18} color={C.primary} />
        <Text style={[hwcStyles.toggleText, { color: C.text }]}>How we calculate your insights</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={C.textMuted} />
      </TouchableOpacity>
      {expanded && (
        <View style={[hwcStyles.body, { borderTopColor: C.border }]}>
          {HOW_WE_CALCULATE.map((item) => (
            <View key={item.title} style={hwcStyles.item}>
              <View style={[hwcStyles.itemIcon, { backgroundColor: C.primaryBg }]}>
                <Ionicons name={item.icon} size={15} color={C.primary} />
              </View>
              <View style={hwcStyles.itemText}>
                <Text style={[hwcStyles.itemTitle, { color: C.text }]}>{item.title}</Text>
                <Text style={[hwcStyles.itemBody, { color: C.textSub }]}>{item.body}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
const hwcStyles = StyleSheet.create({
  wrapper: { borderRadius: R.lg, borderWidth: 1, marginBottom: 20, overflow: 'hidden' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  toggleText: { fontSize: F.sm, fontWeight: '700', flex: 1 },
  body: { borderTopWidth: 1, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 10, gap: 14 },
  item: { flexDirection: 'row', gap: 12 },
  itemIcon: { width: 28, height: 28, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  itemText: { flex: 1 },
  itemTitle: { fontSize: F.sm, fontWeight: '700', marginBottom: 3 },
  itemBody: { fontSize: F.sm, lineHeight: 18 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InsightsScreen() {
  const { user } = useAuth();
  const { colors: C } = useTheme();

  const [insights, setInsights] = useState<Insight[]>([]);
  const [metrics, setMetrics] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (generate = false) => {
    if (!user) return;
    try {
      setError(null);
      const [insightRows, metricsData] = await Promise.all([
        generate ? generateAndSaveInsights(user.id) : getInsights(user.id),
        fetchInsightsData(user.id),
      ]);
      setInsights(insightRows);
      setMetrics(metricsData);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load insights';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Keep a stable ref to `load` so the realtime channel never needs to be
  // recreated just because the `load` callback identity changed.
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);

  // Create the realtime channel once per user — callbacks reference loadRef so
  // they always call the latest version of load without the channel resubscribing.
  useEffect(() => {
    if (!user) return;
    const channelName = `insights-rt-${user.id}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'climbing_sessions', filter: `user_id=eq.${user.id}` }, () => loadRef.current(true))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'strength_sessions', filter: `user_id=eq.${user.id}` }, () => loadRef.current(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const weeklyChartData = (metrics?.weeklyVolume ?? []).map((w) => ({
    label: w.label,
    sublabel: w.week,
    bars: [
      { value: w.climb, color: C.primary },
      { value: w.strength, color: C.accent },
    ],
  }));

  const gradeChartData = (metrics?.bouldering.gradeProgression ?? []).slice(-8).map((g) => ({
    label: `V${g.grade}`,
    bars: [{ value: 1, color: C.primary }],
  }));

  const styles = useMemo(() => makeStyles(C), [C]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar style="auto" />
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={styles.loadingText}>Analysing your training…</Text>
        </View>
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
        {/* Page header */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Insights</Text>
            <Text style={styles.pageSubtitle}>Smart analysis of your training</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={() => load(true)} activeOpacity={0.7}>
            <Ionicons name="refresh-outline" size={18} color={C.primary} />
          </TouchableOpacity>
        </View>

        {/* Error */}
        {error && (
          <View style={[styles.errorCard, { backgroundColor: '#EF444420', borderColor: '#EF4444' }]}>
            <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
            <Text style={[styles.errorText, { color: C.text }]}>{error}</Text>
          </View>
        )}

        {/* ── Training Overview ──────────────────────────────────────────── */}
        {metrics && (
          <>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionLabel, { color: C.text }]}>Training Overview</Text>
              <Text style={[styles.sectionSub, { color: C.textMuted }]}>Combined activity</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <MetricRow label="Climbing sessions" value={String(metrics.totalClimbSessions)} sub={`${metrics.climbSessionsThisWeek} this week`} color={metrics.climbSessionsThisWeek > 0 ? C.primary : undefined} C={C} />
              <MetricRow label="Strength sessions" value={String(metrics.totalStrengthSessions)} sub={`${metrics.strengthSessionsThisWeek} this week`} color={metrics.strengthSessionsThisWeek > 0 ? C.accent : undefined} C={C} />
              <MetricRow label="Total attempts" value={String(metrics.totalAttempts)} C={C} />
              <MetricRow label="Overall send rate" value={`${metrics.sendRate}%`} color={metrics.sendRate >= 50 ? C.success : C.warning} C={C} />
              {metrics.goalGradeLabel && (
                <MetricRow
                  label="Goal progress"
                  value={`${metrics.goalProgressPct}%`}
                  sub={`Targeting ${metrics.goalGradeLabel}`}
                  color={C.primary}
                  C={C}
                />
              )}
              <MetricRow
                label="Load status"
                value={metrics.overloadRisk ? 'High — consider rest' : 'Looks good'}
                color={metrics.overloadRisk ? C.warning : C.success}
                C={C}
              />
            </View>
          </>
        )}

        {/* ── Bouldering ─────────────────────────────────────────────────── */}
        {metrics && (
          <>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionLabel, { color: C.text }]}>Bouldering</Text>
              <Text style={[styles.sectionSub, { color: C.textMuted }]}>V-scale</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <MetricRow label="Best grade" value={metrics.bouldering.maxGradeLabel} color={metrics.bouldering.maxGradeNum >= 0 ? C.primary : undefined} C={C} />
              <MetricRow label="Total attempts" value={String(metrics.bouldering.totalAttempts)} C={C} />
              <MetricRow label="Sends" value={String(metrics.bouldering.totalSends)} C={C} />
              <MetricRow label="Send rate" value={`${metrics.bouldering.sendRate}%`} color={metrics.bouldering.sendRate >= 50 ? C.success : C.warning} C={C} />
            </View>

            {gradeChartData.length > 1 && (
              <View style={[styles.metricCard, { backgroundColor: C.card, borderColor: C.border }]}>
                <Text style={[styles.chartTitle, { color: C.text }]}>Grade Progression</Text>
                <Text style={[styles.chartSub, { color: C.textSub }]}>First time sending each new grade</Text>
                <MiniBarChart data={gradeChartData} chartHeight={56} />
              </View>
            )}
          </>
        )}

        {/* ── Top Rope ───────────────────────────────────────────────────── */}
        {metrics && (
          <>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionLabel, { color: C.text }]}>Top Rope</Text>
              <Text style={[styles.sectionSub, { color: C.textMuted }]}>YDS</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: C.card, borderColor: C.border }]}>
              {metrics.topRope.totalAttempts === 0 ? (
                <View style={styles.emptyInCard}>
                  <Ionicons name="flag-outline" size={22} color={C.textMuted} />
                  <Text style={[styles.emptyTitle, { color: C.text }]}>No top rope data yet</Text>
                  <Text style={[styles.emptySub, { color: C.textSub }]}>Select "Top Rope" when logging a climb.</Text>
                </View>
              ) : (
                <>
                  <MetricRow label="Best grade" value={metrics.topRope.maxGradeLabel} color={metrics.topRope.maxGradeNum >= 0 ? C.accent : undefined} C={C} />
                  <MetricRow label="Total attempts" value={String(metrics.topRope.totalAttempts)} C={C} />
                  <MetricRow label="Sends" value={String(metrics.topRope.totalSends)} C={C} />
                  <MetricRow label="Send rate" value={`${metrics.topRope.sendRate}%`} color={metrics.topRope.sendRate >= 50 ? C.success : C.warning} C={C} />
                </>
              )}
            </View>
          </>
        )}

        {/* ── Recommendations ────────────────────────────────────────────── */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionLabel, { color: C.text }]}>Recommendations</Text>
          {insights.length > 0 && <Text style={[styles.sectionSub, { color: C.textMuted }]}>{insights.length} insight{insights.length !== 1 ? 's' : ''}</Text>}
        </View>
        {insights.length > 0 ? (
          insights.map((i) => <InsightCard key={i.id} insight={i} C={C} />)
        ) : (
          <View style={[styles.metricCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={styles.emptyInCard}>
              <Ionicons name="bulb-outline" size={26} color={C.textMuted} />
              <Text style={[styles.emptyTitle, { color: C.text }]}>No insights yet</Text>
              <Text style={[styles.emptySub, { color: C.textSub }]}>Log at least one climbing or strength session to generate your first insight.</Text>
              <TouchableOpacity
                style={[styles.generateBtn, { backgroundColor: C.primaryBg, borderColor: C.primaryBorder }]}
                onPress={() => load(true)}
              >
                <Text style={[styles.generateBtnText, { color: C.primary }]}>Generate Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Training Load Chart ─────────────────────────────────────────── */}
        {weeklyChartData.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionLabel, { color: C.text }]}>Weekly Training Load</Text>
              <Text style={[styles.sectionSub, { color: C.textMuted }]}>Last 6 weeks</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <MiniBarChart
                data={weeklyChartData}
                legend={[
                  { color: C.primary, label: 'Climbing' },
                  { color: C.accent, label: 'Strength' },
                ]}
              />
            </View>
          </>
        )}

        {/* ── How we calculate ────────────────────────────────────────────── */}
        <HowWeCalculate C={C} />

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
    loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
    loadingText: { fontSize: F.sm, color: C.textSub },

    pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.lg },
    pageTitle: { fontSize: F.xxl, fontWeight: '800', color: C.text, letterSpacing: 0.3 },
    pageSubtitle: { fontSize: F.xs, color: C.textSub, marginTop: 3 },
    refreshBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.primaryBg, borderWidth: 1, borderColor: C.primaryBorder, alignItems: 'center', justifyContent: 'center' },

    errorCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: R.md, borderWidth: 1, marginBottom: 14 },
    errorText: { fontSize: F.sm, flex: 1 },

    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    sectionLabel: { fontSize: F.base, fontWeight: '700' },
    sectionSub: { fontSize: F.xs },

    metricCard: { borderRadius: R.lg, borderWidth: 1, padding: 16, marginBottom: 20, overflow: 'hidden' },

    emptyInCard: { alignItems: 'center', paddingVertical: 16, gap: 6 },
    emptyTitle: { fontSize: F.base, fontWeight: '700' },
    emptySub: { fontSize: F.sm, textAlign: 'center', lineHeight: 18 },
    generateBtn: { marginTop: 6, paddingHorizontal: 18, paddingVertical: 8, borderRadius: R.full, borderWidth: 1 },
    generateBtnText: { fontSize: F.sm, fontWeight: '700' },

    chartTitle: { fontSize: F.base, fontWeight: '700', marginBottom: 4 },
    chartSub: { fontSize: F.xs, marginBottom: 12 },
  });
}
