import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { F, R, S } from '@/constants/Theme';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/services/strength';

const SCREEN_W = Dimensions.get('window').width;
const DAY_SIZE = Math.floor((SCREEN_W - S.md * 2 - 16) / 7) - 2;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface DayData {
  climbCount: number;
  strengthCount: number;
}

interface SessionSummary {
  type: 'climb' | 'strength';
  date: string;
  title: string;
  sub: string;
  color: string;
}

export default function CalendarScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors: C } = useTheme();

  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month
  const [dayMap, setDayMap] = useState<Record<string, DayData>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSessions, setSelectedSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Derived month
  const today = new Date();
  const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0-indexed
  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ data: cs }, { data: ss }] = await Promise.all([
        supabase
          .from('climbing_sessions')
          .select('date, gym_name, session_type, duration')
          .eq('user_id', user.id)
          .gte('date', monthStart)
          .lte('date', monthEnd),
        supabase
          .from('strength_sessions')
          .select('date, duration')
          .eq('user_id', user.id)
          .gte('date', monthStart)
          .lte('date', monthEnd),
      ]);

      const map: Record<string, DayData> = {};
      for (const s of cs ?? []) {
        if (!map[s.date]) map[s.date] = { climbCount: 0, strengthCount: 0 };
        map[s.date].climbCount++;
      }
      for (const s of ss ?? []) {
        if (!map[s.date]) map[s.date] = { climbCount: 0, strengthCount: 0 };
        map[s.date].strengthCount++;
      }
      setDayMap(map);
    } finally {
      setLoading(false);
    }
  }, [user, monthStart, monthEnd]);

  useEffect(() => { load(); }, [load]);

  const handleDayPress = async (dateStr: string) => {
    setSelectedDate(dateStr);
    if (!user) return;
    const [{ data: cs }, { data: ss }] = await Promise.all([
      supabase
        .from('climbing_sessions')
        .select('id, date, gym_name, session_type, duration, climbing_attempts(grade, result)')
        .eq('user_id', user.id)
        .eq('date', dateStr),
      supabase
        .from('strength_sessions')
        .select('id, date, duration, strength_entries(exercise_type)')
        .eq('user_id', user.id)
        .eq('date', dateStr),
    ]);

    const sessions: SessionSummary[] = [];
    for (const s of cs ?? []) {
      const sends = (s.climbing_attempts ?? []).filter(
        (a: { result: string }) => a.result === 'send' || a.result === 'flash'
      ).length;
      sessions.push({
        type: 'climb',
        date: s.date,
        title: s.gym_name ?? (s.session_type === 'outdoor' ? 'Outdoor Session' : 'Bouldering Session'),
        sub: `${(s.climbing_attempts ?? []).length} attempts · ${sends} sends${s.duration ? ` · ${s.duration}m` : ''}`,
        color: C.primary,
      });
    }
    for (const s of ss ?? []) {
      const exercises = [...new Set((s.strength_entries ?? []).map((e: { exercise_type: string }) => e.exercise_type))];
      sessions.push({
        type: 'strength',
        date: s.date,
        title: 'Strength Workout',
        sub: exercises.slice(0, 3).join(', ') + (s.duration ? ` · ${s.duration}m` : ''),
        color: C.accent,
      });
    }
    setSelectedSessions(sessions);
  };

  // Build grid cells
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = today.toISOString().split('T')[0];

  // Styles depend on the current theme colors — computed before render
  const styles = makeStyles(C);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="close" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity Calendar</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Month navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => { setSelectedDate(null); setMonthOffset((o) => o - 1); }}
          >
            <Ionicons name="chevron-back" size={20} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => { setSelectedDate(null); setMonthOffset((o) => Math.min(0, o + 1)); }}
            disabled={monthOffset >= 0}
          >
            <Ionicons name="chevron-forward" size={20} color={monthOffset >= 0 ? C.border : C.text} />
          </TouchableOpacity>
        </View>

        {/* Day-of-week headers */}
        <View style={styles.dayHeader}>
          {DAY_NAMES.map((d) => (
            <Text key={d} style={styles.dayHeaderText}>{d}</Text>
          ))}
        </View>

        {/* Calendar grid */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={C.primary} />
          </View>
        ) : (
          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (day === null) return <View key={`e-${i}`} style={styles.dayCell} />;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const data = dayMap[dateStr];
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const hasActivity = !!data;

              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    isToday && !isSelected && styles.dayCellToday,
                  ]}
                  onPress={() => handleDayPress(dateStr)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dayNum,
                      isToday && styles.dayNumToday,
                      isSelected && styles.dayNumSelected,
                    ]}
                  >
                    {day}
                  </Text>
                  {hasActivity && (
                    <View style={styles.dotRow}>
                      {data.climbCount > 0 && (
                        <View style={[styles.dot, { backgroundColor: C.primary }]} />
                      )}
                      {data.strengthCount > 0 && (
                        <View style={[styles.dot, { backgroundColor: C.accent }]} />
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: C.primary }]} />
            <Text style={styles.legendText}>Climbing</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: C.accent }]} />
            <Text style={styles.legendText}>Strength</Text>
          </View>
        </View>

        {/* Month summary */}
        {!loading && (
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryValue, { color: C.primary }]}>
                {Object.values(dayMap).reduce((s, d) => s + d.climbCount, 0)}
              </Text>
              <Text style={styles.summaryLabel}>Climb sessions</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryValue, { color: C.accent }]}>
                {Object.values(dayMap).reduce((s, d) => s + d.strengthCount, 0)}
              </Text>
              <Text style={styles.summaryLabel}>Strength sessions</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryValue, { color: C.success }]}>
                {Object.keys(dayMap).length}
              </Text>
              <Text style={styles.summaryLabel}>Active days</Text>
            </View>
          </View>
        )}

        {/* Selected day sessions */}
        {selectedDate && (
          <View style={styles.dayDetail}>
            <Text style={styles.dayDetailTitle}>
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
            {selectedSessions.length === 0 ? (
              <Text style={styles.dayDetailEmpty}>No sessions logged on this day</Text>
            ) : (
              selectedSessions.map((s, i) => (
                <View key={i} style={styles.sessionRow}>
                  <View style={[styles.sessionDot, { backgroundColor: s.color }]} />
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionTitle}>{s.title}</Text>
                    <Text style={styles.sessionSub}>{s.sub}</Text>
                  </View>
                  <View style={[styles.sessionBadge, { backgroundColor: s.color + '20' }]}>
                    <Ionicons
                      name={s.type === 'climb' ? 'flag-outline' : 'barbell-outline'}
                      size={13}
                      color={s.color}
                    />
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C: ReturnType<typeof useTheme>['colors']) { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: S.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: F.md, fontWeight: '700', color: C.text },

  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: S.md,
    paddingVertical: 16,
  },
  navBtn: { padding: 8 },
  monthLabel: { fontSize: F.lg, fontWeight: '800', color: C.text },

  dayHeader: {
    flexDirection: 'row',
    paddingHorizontal: S.md,
    marginBottom: 8,
  },
  dayHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: F.xs,
    color: C.textMuted,
    fontWeight: '600',
  },

  loadingBox: { height: 200, alignItems: 'center', justifyContent: 'center' },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: S.md,
    gap: 2,
  },
  dayCell: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: R.sm,
    gap: 2,
  },
  dayCellSelected: { backgroundColor: C.primaryBg, borderWidth: 1.5, borderColor: C.primary },
  dayCellToday: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  dayNum: { fontSize: F.sm, color: C.textSub, fontWeight: '500' },
  dayNumToday: { color: C.text, fontWeight: '700' },
  dayNumSelected: { color: C.primary, fontWeight: '800' },
  dotRow: { flexDirection: 'row', gap: 3, height: 6, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3 },

  legend: {
    flexDirection: 'row',
    gap: 20,
    paddingHorizontal: S.md,
    marginTop: 12,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: F.xs, color: C.textSub },

  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: S.md,
    gap: 10,
    marginTop: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: R.md,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  summaryValue: { fontSize: F.xl, fontWeight: '800' },
  summaryLabel: { fontSize: F.xs, color: C.textSub, marginTop: 2, textAlign: 'center' },

  dayDetail: {
    marginHorizontal: S.md,
    marginTop: 20,
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  dayDetailTitle: { fontSize: F.base, fontWeight: '700', color: C.text, marginBottom: 12 },
  dayDetailEmpty: { fontSize: F.sm, color: C.textMuted, textAlign: 'center', paddingVertical: 8 },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  sessionDot: { width: 8, height: 8, borderRadius: 4 },
  sessionInfo: { flex: 1 },
  sessionTitle: { fontSize: F.sm, fontWeight: '700', color: C.text },
  sessionSub: { fontSize: F.xs, color: C.textSub, marginTop: 2 },
  sessionBadge: { width: 30, height: 30, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' },
}); }
