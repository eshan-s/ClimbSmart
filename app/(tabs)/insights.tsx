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
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { C, F, R, S } from '@/constants/Theme';
import Card from '@/components/ui/Card';
import SectionHeader from '@/components/ui/SectionHeader';
import EmptyState from '@/components/ui/EmptyState';
import MiniBarChart from '@/components/ui/MiniBarChart';
import {
  getInsights,
  generateAndSaveInsights,
  fetchInsightsData,
  InsightsData,
} from '@/services/insights';
import { supabase } from '@/lib/supabase';
import type { Insight } from '@/types';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Insight card ─────────────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: Insight }) {
  const config = INSIGHT_CONFIG[insight.type] ?? INSIGHT_CONFIG.focus;
  return (
    <Card variant={config.cardVariant} style={icStyles.card}>
      <View style={icStyles.top}>
        <View style={[icStyles.iconWrap, { backgroundColor: config.color + '20' }]}>
          <Ionicons name={config.icon} size={20} color={config.color} />
        </View>
        <View style={icStyles.labelWrap}>
          <View style={[icStyles.chip, { backgroundColor: config.color + '20', borderColor: config.color + '50' }]}>
            <Text style={[icStyles.chipText, { color: config.color }]}>
              {insight.type.charAt(0).toUpperCase() + insight.type.slice(1)}
            </Text>
          </View>
        </View>
      </View>
      <Text style={icStyles.summary}>{insight.summary}</Text>
      {insight.recommendation ? (
        <Text style={icStyles.recommendation}>{insight.recommendation}</Text>
      ) : null}
    </Card>
  );
}
const INSIGHT_CONFIG: Record<
  Insight['type'],
  { color: string; icon: IoniconName; cardVariant: 'warning' | 'primary' | 'accent' | 'success' }
> = {
  bottleneck: { color: C.warning, icon: 'warning-outline', cardVariant: 'warning' },
  focus: { color: C.accent, icon: 'bulb-outline', cardVariant: 'accent' },
  volume: { color: C.primary, icon: 'trending-up-outline', cardVariant: 'primary' },
  recovery: { color: C.success, icon: 'leaf-outline', cardVariant: 'success' },
};
const icStyles = StyleSheet.create({
  card: { marginBottom: 12 },
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  labelWrap: { flex: 1 },
  chip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.full, borderWidth: 1 },
  chipText: { fontSize: F.xs, fontWeight: '700' },
  summary: { fontSize: F.base, fontWeight: '700', color: C.text, marginBottom: 8, lineHeight: 22 },
  recommendation: { fontSize: F.sm, color: C.textSub, lineHeight: 20 },
});

// ─── Metric row ───────────────────────────────────────────────────────────────

function MetricRow({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View style={mStyles.row}>
      <Text style={mStyles.label}>{label}</Text>
      <View style={mStyles.right}>
        <Text style={[mStyles.value, color ? { color } : {}]}>{value}</Text>
        {sub ? <Text style={mStyles.sub}>{sub}</Text> : null}
      </View>
    </View>
  );
}
const mStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  label: { fontSize: F.sm, color: C.textSub, flex: 1 },
  right: { alignItems: 'flex-end' },
  value: { fontSize: F.sm, fontWeight: '700', color: C.text },
  sub: { fontSize: F.xs, color: C.textMuted, marginTop: 1 },
});

// ─── Weekly plan helper ───────────────────────────────────────────────────────

function DayPlan({
  day, activity, intensity, icon,
}: {
  day: string;
  activity: string;
  intensity: 'rest' | 'easy' | 'medium' | 'hard';
  icon: IoniconName;
}) {
  const color =
    intensity === 'rest' ? C.textMuted
    : intensity === 'easy' ? C.success
    : intensity === 'medium' ? C.accent
    : C.primary;
  const dots = intensity === 'rest' ? 0 : intensity === 'easy' ? 1 : intensity === 'medium' ? 2 : 3;
  return (
    <View style={dpStyles.row}>
      <Text style={dpStyles.day}>{day}</Text>
      <View style={[dpStyles.bar, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={13} color={color} />
        <Text style={dpStyles.activity}>{activity}</Text>
      </View>
      <View style={dpStyles.dots}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[dpStyles.dot, { backgroundColor: i < dots ? color : C.border }]} />
        ))}
      </View>
    </View>
  );
}
const dpStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  day: { width: 34, fontSize: F.xs, color: C.textSub, fontWeight: '600' },
  bar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: R.sm },
  activity: { fontSize: F.xs, fontWeight: '600', color: C.text, flex: 1 },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});

// ─── Bottleneck label map ─────────────────────────────────────────────────────

const BOTTLENECK_LABEL: Record<NonNullable<InsightsData['bottleneck']>, string> = {
  finger_strength: 'Finger Strength',
  pulling_strength: 'Pulling Strength',
  technique: 'Technique',
  volume: 'Training Volume',
  recovery: 'Recovery',
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InsightsScreen() {
  const { user } = useAuth();

  const [insights, setInsights] = useState<Insight[]>([]);
  const [metrics, setMetrics] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const [ins, metricsData] = await Promise.all([
        getInsights(user.id),
        fetchInsightsData(user.id),
      ]);
      setInsights(ins);
      setMetrics(metricsData);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load insights';
      setError(msg);
      console.error('[Insights] load error:', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  const generate = useCallback(async () => {
    if (!user) return;
    setGenerating(true);
    setError(null);
    try {
      await generateAndSaveInsights(user.id);
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to generate insights';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  }, [user, load]);

  useEffect(() => { load(); }, [load]);

  // Refresh when screen regains focus (e.g. after logging a session)
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Realtime: refresh insights when new ones are written
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('insights-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'insights', filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const bottleneck = insights.find((i) => i.type === 'bottleneck');
  const otherInsights = insights.filter((i) => i.type !== 'bottleneck');

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={C.warning} />
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.warning} />
        }
      >
        {/* Page Header */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Insights</Text>
            <Text style={styles.pageSubtitle}>What your data says</Text>
          </View>
          <TouchableOpacity
            style={[styles.generateBtn, generating && { opacity: 0.6 }]}
            onPress={generate}
            disabled={generating}
            activeOpacity={0.7}
          >
            {generating ? (
              <ActivityIndicator size="small" color={C.warning} />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={14} color={C.warning} />
                <Text style={styles.generateText}>Refresh</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Error banner */}
        {error && (
          <Card style={styles.errorCard}>
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={16} color={C.warning} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </Card>
        )}

        {/* ── Key Metrics ───────────────────────────────────────────────────── */}
        {metrics && (
          <>
            <SectionHeader title="Training Overview" subtitle="Based on all logged sessions" />
            <Card style={styles.mb16}>
              <MetricRow
                label="Climbing sessions"
                value={String(metrics.totalClimbSessions)}
                sub={`${metrics.climbSessionsThisWeek} this week`}
                color={metrics.climbSessionsThisWeek > 0 ? C.primary : undefined}
              />
              <MetricRow
                label="Strength sessions"
                value={String(metrics.totalStrengthSessions)}
                sub={`${metrics.strengthSessionsThisWeek} this week`}
                color={metrics.strengthSessionsThisWeek > 0 ? C.accent : undefined}
              />
              <MetricRow
                label="Total attempts logged"
                value={String(metrics.totalAttempts)}
                sub={`${metrics.totalSends} sends`}
              />
              <MetricRow
                label="Send rate"
                value={`${metrics.sendRate}%`}
                color={metrics.sendRate >= 50 ? C.success : metrics.sendRate >= 25 ? C.warning : C.warning}
              />
              <MetricRow
                label="Avg attempts / session"
                value={String(metrics.avgAttemptsPerSession)}
              />
              <MetricRow
                label="Current best grade"
                value={metrics.maxGradeLabel}
                color={metrics.maxGradeNum >= 0 ? C.primary : undefined}
              />
              {metrics.goalGradeLabel && (
                <MetricRow
                  label="Goal progress"
                  value={`${metrics.goalProgressPct}%`}
                  sub={`Targeting ${metrics.goalGradeLabel}${metrics.goalTargetDate ? ' · Due ' + new Date(metrics.goalTargetDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}`}
                  color={C.primary}
                />
              )}
              <MetricRow
                label="Overload risk"
                value={metrics.overloadRisk ? 'High' : 'Normal'}
                sub={`${metrics.recentSessionsLast14} sessions in last 14 days`}
                color={metrics.overloadRisk ? C.warning : C.success}
              />
              {metrics.bottleneck && (
                <MetricRow
                  label="Likely bottleneck"
                  value={BOTTLENECK_LABEL[metrics.bottleneck]}
                  color={C.warning}
                />
              )}
            </Card>
          </>
        )}

        {/* ── Grade Progression chart ──────────────────────────────────────── */}
        {metrics && metrics.gradeProgression.length > 1 && (
          <>
            <SectionHeader title="Grade Progression" subtitle="First send of each new grade" />
            <Card style={styles.mb16}>
              <MiniBarChart
                chartHeight={80}
                barWidth={14}
                data={metrics.gradeProgression.slice(-8).map((p, i, arr) => ({
                  label: `V${p.grade}`,
                  bars: [{ value: p.grade + 1, color: C.primary }],
                }))}
                maxValue={metrics.maxGradeNum + 1}
                legend={[{ color: C.primary, label: 'Grade unlocked (V-scale)' }]}
              />
            </Card>
          </>
        )}

        {/* ── Bottleneck ───────────────────────────────────────────────────── */}
        {bottleneck ? (
          <>
            <SectionHeader title="Primary Bottleneck" subtitle="Most critical finding" />
            <InsightCard insight={bottleneck} />
            <View style={styles.mb8} />
          </>
        ) : null}

        {/* ── Other insights ───────────────────────────────────────────────── */}
        {otherInsights.length > 0 ? (
          <>
            <SectionHeader title="Suggestions" subtitle="Focus areas this week" />
            {otherInsights.map((ins) => (
              <InsightCard key={ins.id} insight={ins} />
            ))}
            <View style={styles.mb8} />
          </>
        ) : null}

        {/* Empty state */}
        {insights.length === 0 && (
          <Card style={styles.mb16}>
            <EmptyState
              icon="analytics-outline"
              title="No insights yet"
              message="Log climbing sessions and workouts, then tap Refresh to generate rule-based insights about your training."
              actionLabel="Generate Insights"
              onAction={generate}
            />
          </Card>
        )}

        {/* ── Weekly Load chart ─────────────────────────────────────────────── */}
        {metrics && (
          <>
            <SectionHeader title="Training Load" subtitle="Sessions per week, last 6 weeks" />
            <Card style={styles.mb16}>
              <MiniBarChart
                chartHeight={80}
                barWidth={10}
                data={metrics.weeklyVolume.map((d) => ({
                  label: d.week,
                  sublabel: d.label,
                  bars: [
                    { value: d.climb, color: C.primary },
                    { value: d.strength, color: C.accent },
                  ],
                }))}
                legend={[
                  { color: C.primary, label: 'Climbing' },
                  { color: C.accent, label: 'Strength' },
                ]}
              />
              {metrics.weeklyVolume.reduce((s, w) => s + w.climb + w.strength, 0) > 0 && (
                <Text style={styles.chartTotal}>
                  {metrics.weeklyVolume.reduce((s, w) => s + w.climb + w.strength, 0)} total sessions
                </Text>
              )}
            </Card>
          </>
        )}

        {/* ── Strength PRs ─────────────────────────────────────────────────── */}
        {metrics && Object.keys(metrics.prs).length > 0 && (
          <>
            <SectionHeader title="Strength PRs" subtitle="Personal records across all exercises" />
            <Card style={styles.mb16}>
              {Object.entries(metrics.prs).map(([key, value]) => {
                const [exercise, metric] = key.split('_');
                const unit = metric === 'reps' ? 'reps' : metric === 'duration' ? 'sec' : 'kg';
                return (
                  <MetricRow
                    key={key}
                    label={`${exercise.charAt(0).toUpperCase() + exercise.slice(1)} (${metric})`}
                    value={`${value} ${unit}`}
                    color={C.accent}
                  />
                );
              })}
            </Card>
          </>
        )}

        {/* ── Weekly Plan ──────────────────────────────────────────────────── */}
        <SectionHeader title="Recommended Weekly Plan" />
        <Card style={styles.mb16}>
          <DayPlan day="Mon" activity="Fingerboard Block" intensity="hard" icon="finger-print-outline" />
          <DayPlan day="Tue" activity="Rest / light walk" intensity="rest" icon="leaf-outline" />
          <DayPlan day="Wed" activity="Bouldering — volume" intensity="medium" icon="flag-outline" />
          <DayPlan day="Thu" activity="Pull + Core" intensity="medium" icon="barbell-outline" />
          <DayPlan day="Fri" activity="Fingerboard Block" intensity="hard" icon="finger-print-outline" />
          <DayPlan day="Sat" activity="Project Session" intensity="hard" icon="trophy-outline" />
          <DayPlan day="Sun" activity="Rest + stretch" intensity="rest" icon="leaf-outline" />
          <View style={styles.planNote}>
            <Ionicons name="information-circle-outline" size={13} color={C.textMuted} />
            <Text style={styles.planNoteText}>
              Adjust based on fatigue. Never climb hard with sore fingers.
            </Text>
          </View>
        </Card>

        {/* ── AI Hub ───────────────────────────────────────────────────────── */}
        <SectionHeader title="AI Insights Hub" />
        <Card style={[styles.aiCard, styles.mb32]}>
          <View style={styles.aiLockRow}>
            <View style={styles.aiLockIcon}>
              <Ionicons name="sparkles-outline" size={28} color={C.accent} />
            </View>
            <View style={styles.aiComingSoon}>
              <Ionicons name="lock-closed-outline" size={10} color={C.textMuted} />
              <Text style={styles.aiComingSoonText}>Coming in Stage 4</Text>
            </View>
          </View>
          <Text style={styles.aiTitle}>Personalized AI Coaching</Text>
          <Text style={styles.aiBody}>
            Connect your full training history to unlock AI-generated insights: injury risk
            flags, peaking recommendations, and weekly programs tailored to your goal grade.
          </Text>
          {[
            'Grade-specific training plans',
            'Injury risk early warnings',
            'Optimal rest day predictions',
          ].map((f) => (
            <View key={f} style={styles.aiFeatureRow}>
              <Ionicons name="checkmark-circle-outline" size={14} color={C.textMuted} />
              <Text style={styles.aiFeatureText}>{f}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: 100 },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mb8: { marginBottom: 8 },
  mb16: { marginBottom: 16 },
  mb32: { marginBottom: 32 },

  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: S.lg,
  },
  pageTitle: { fontSize: F.xxl, fontWeight: '800', color: C.text, letterSpacing: 0.3 },
  pageSubtitle: { fontSize: F.xs, color: C.textSub, marginTop: 3 },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.warningBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: R.full,
    borderWidth: 1,
    borderColor: C.warningBorder,
    minWidth: 90,
    justifyContent: 'center',
  },
  generateText: { fontSize: F.xs, color: C.warning, fontWeight: '700' },

  errorCard: { marginBottom: 12, borderColor: C.warningBorder, backgroundColor: C.warningBg },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  errorText: { fontSize: F.sm, color: C.warning, flex: 1, lineHeight: 18 },

  chartTotal: { fontSize: F.xs, color: C.textMuted, marginTop: 4, textAlign: 'right' },

  planNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  planNoteText: { fontSize: F.xs, color: C.textMuted, flex: 1 },

  aiCard: { alignItems: 'center', paddingVertical: 24 },
  aiLockRow: { alignItems: 'center', marginBottom: 12 },
  aiLockIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  aiComingSoon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: R.full,
    borderWidth: 1,
    borderColor: C.border,
  },
  aiComingSoonText: { fontSize: F.xs, color: C.textMuted, fontWeight: '600' },
  aiTitle: { fontSize: F.lg, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: 8 },
  aiBody: { fontSize: F.sm, color: C.textSub, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  aiFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  aiFeatureText: { fontSize: F.sm, color: C.textMuted },
});
