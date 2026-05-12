/**
 * Stat Detail Modal
 * Shown when the user taps "Best Grade" or "Day Streak" on the Home screen.
 * Reads ?type=grade|streak from the URL params.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { F, R, S } from '@/constants/Theme';
import { getClimbingSessions } from '@/services/climbing';
import type { ClimbingSession } from '@/types';
import { maxGradeFromAttempts, gradeColor } from '@/utils/grades';
import { formatDate } from '@/services/strength';

export default function StatDetailScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const { user } = useAuth();
  const { colors: C } = useTheme();

  const [sessions, setSessions] = useState<ClimbingSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const cs = await getClimbingSessions(user.id, 50);
      setSessions(cs);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const allAttempts = sessions.flatMap((s) => s.climbing_attempts ?? []);
  const bestGrade = maxGradeFromAttempts(allAttempts) ?? '—';

  // Best-grade sessions
  const bestSessions = sessions.filter((s) =>
    (s.climbing_attempts ?? []).some(
      (a) => (a.result === 'send' || a.result === 'flash') && a.grade === bestGrade
    )
  );

  // Streak calculation
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sessionDays = new Set(sessions.map((s) => s.date.split('T')[0]));
  let streak = 0;
  const check = new Date(today);
  while (true) {
    const key = check.toISOString().split('T')[0];
    if (sessionDays.has(key)) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }

  const streakMsg =
    streak === 0
      ? "Let's get started 💪"
      : streak < 7
      ? 'Keep it up 🔥'
      : 'Awesome work 🚀';

  const isGrade = type !== 'streak';

  const styles = makeStyles(C);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="auto" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isGrade ? 'Best Grade' : 'Day Streak'}</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.primary} />
        </View>
      ) : isGrade ? (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Hero */}
          <View style={styles.heroCard}>
            <Text style={[styles.heroValue, { color: gradeColor(bestGrade) }]}>{bestGrade}</Text>
            <Text style={styles.heroLabel}>Best Grade Sent</Text>
          </View>

          {/* Sessions where the best grade was sent */}
          {bestSessions.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Sessions where you sent {bestGrade}</Text>
              {bestSessions.map((s) => {
                const sends = (s.climbing_attempts ?? []).filter(
                  (a) => (a.result === 'send' || a.result === 'flash') && a.grade === bestGrade
                );
                const climbTypes = [...new Set(sends.map((a) => a.route_type ?? 'bouldering'))];
                const styles2 = makeStyles(C);
                return (
                  <View key={s.id} style={styles2.sessionRow}>
                    <View style={[styles2.sessionDot, { backgroundColor: s.session_type === 'outdoor' ? C.success : C.primary }]} />
                    <View style={styles2.sessionInfo}>
                      <Text style={styles2.sessionTitle}>
                        {s.gym_name ?? (s.session_type === 'outdoor' ? 'Outdoor' : 'Gym Session')}
                      </Text>
                      <Text style={styles2.sessionSub}>
                        {formatDate(s.date)}
                        {s.duration ? ` · ${s.duration}m` : ''}
                        {climbTypes.length ? ` · ${climbTypes.join(', ')}` : ''}
                      </Text>
                    </View>
                    <View style={[styles2.gradeBadge, { backgroundColor: gradeColor(bestGrade) + '20', borderColor: gradeColor(bestGrade) + '55' }]}>
                      <Text style={[styles2.gradeBadgeText, { color: gradeColor(bestGrade) }]}>{bestGrade}</Text>
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {bestGrade === '—' && (
            <View style={styles.emptyBox}>
              <Ionicons name="trending-up-outline" size={40} color={C.textMuted} />
              <Text style={styles.emptyTitle}>No sends yet</Text>
              <Text style={styles.emptySub}>Log your first climbing session to see your best grade.</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Streak hero */}
          <View style={styles.heroCard}>
            <Text style={[styles.heroValue, { color: streak > 0 ? C.warning : C.textMuted }]}>
              {streak}
            </Text>
            <Text style={styles.heroLabel}>
              {streak === 1 ? 'day' : 'days'} in a row
            </Text>
            <Text style={styles.streakMsg}>{streakMsg}</Text>
          </View>

          {/* Recent sessions timeline */}
          {sessions.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Recent sessions</Text>
              {sessions.slice(0, 10).map((s, i) => {
                const styles2 = makeStyles(C);
                const dotColor = s.session_type === 'outdoor' ? C.success : C.primary;
                const d = s.date.split('T')[0];
                const isToday = d === today.toISOString().split('T')[0];
                return (
                  <View key={s.id} style={styles2.sessionRow}>
                    <View style={[styles2.sessionDot, { backgroundColor: dotColor }]} />
                    <View style={styles2.sessionInfo}>
                      <Text style={styles2.sessionTitle}>
                        {s.gym_name ?? (s.session_type === 'outdoor' ? 'Outdoor' : 'Gym Session')}
                        {isToday ? '  🔥' : ''}
                      </Text>
                      <Text style={styles2.sessionSub}>
                        {formatDate(s.date)}
                        {s.duration ? ` · ${s.duration}m` : ''}
                      </Text>
                    </View>
                    {i === 0 && streak > 0 && (
                      <View style={[styles2.gradeBadge, { backgroundColor: C.warningBg, borderColor: C.warningBorder }]}>
                        <Text style={[styles2.gradeBadgeText, { color: C.warning }]}>🔥 {streak}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          )}

          {sessions.length === 0 && (
            <View style={styles.emptyBox}>
              <Ionicons name="flame-outline" size={40} color={C.textMuted} />
              <Text style={styles.emptyTitle}>No sessions yet</Text>
              <Text style={styles.emptySub}>Log your first climbing session to start your streak.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function makeStyles(C: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: S.md,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    closeBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: C.surface,
      alignItems: 'center', justifyContent: 'center',
    },
    title: { fontSize: F.md, fontWeight: '700', color: C.text },
    content: { paddingHorizontal: S.md, paddingBottom: 60, paddingTop: 8 },
    heroCard: {
      backgroundColor: C.card,
      borderRadius: R.lg,
      padding: 28,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.border,
      marginVertical: 20,
    },
    heroValue: { fontSize: F.xxxl, fontWeight: '900', letterSpacing: 1 },
    heroLabel: { fontSize: F.base, color: C.textSub, marginTop: 6, fontWeight: '600' },
    streakMsg: { fontSize: F.md, color: C.text, marginTop: 12, fontWeight: '700' },
    sectionTitle: { fontSize: F.sm, fontWeight: '700', color: C.textSub, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
    sessionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    sessionDot: { width: 8, height: 8, borderRadius: 4 },
    sessionInfo: { flex: 1 },
    sessionTitle: { fontSize: F.sm, fontWeight: '700', color: C.text },
    sessionSub: { fontSize: F.xs, color: C.textSub, marginTop: 2 },
    gradeBadge: {
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.full, borderWidth: 1,
    },
    gradeBadgeText: { fontSize: F.xs, fontWeight: '800' },
    emptyBox: { alignItems: 'center', paddingTop: 40, gap: 10 },
    emptyTitle: { fontSize: F.md, fontWeight: '700', color: C.text },
    emptySub: { fontSize: F.sm, color: C.textSub, textAlign: 'center', maxWidth: 260 },
  });
}
