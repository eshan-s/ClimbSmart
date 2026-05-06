import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { createClimbingSession, addClimbingAttempts } from '@/services/climbing';
import { C, F, R, S } from '@/constants/Theme';
import { DISPLAY_GRADES, gradeColor } from '@/utils/grades';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type ResultType = 'flash' | 'send' | 'project' | 'fail';

interface ClimbEntry {
  grade: string;
  result: ResultType;
  attempts: number;
  route_name: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RESULTS: { value: ResultType; label: string; color: string }[] = [
  { value: 'flash', label: 'Flash', color: '#EAB308' },
  { value: 'send', label: 'Send', color: '#3DC87A' },
  { value: 'project', label: 'Project', color: '#4B8EFF' },
  { value: 'fail', label: 'Fail', color: '#7E839E' },
];

const today = () => new Date().toISOString().split('T')[0];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LogClimbScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Session fields
  const [date, setDate] = useState(today());
  const [gym, setGym] = useState('');
  const [sessionType, setSessionType] = useState<'indoor' | 'outdoor'>('indoor');
  const [duration, setDuration] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');

  // Climbs list
  const [climbs, setClimbs] = useState<ClimbEntry[]>([]);

  // Add-climb form
  const [showAddForm, setShowAddForm] = useState(false);
  const [selGrade, setSelGrade] = useState('V4');
  const [selResult, setSelResult] = useState<ResultType>('send');
  const [selAttempts, setSelAttempts] = useState(1);
  const [routeName, setRouteName] = useState('');

  const [saving, setSaving] = useState(false);

  const addClimb = () => {
    setClimbs((prev) => [
      ...prev,
      { grade: selGrade, result: selResult, attempts: selAttempts, route_name: routeName },
    ]);
    setRouteName('');
    setSelAttempts(1);
    setShowAddForm(false);
  };

  const removeClimb = (idx: number) => {
    setClimbs((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in before saving a session.');
      return;
    }
    if (!gym.trim() && sessionType === 'indoor') {
      Alert.alert('Add location', 'Please enter a gym or location name.');
      return;
    }

    setSaving(true);
    try {
      const session = await createClimbingSession({
        user_id: user.id,
        date,
        duration: duration ? parseInt(duration, 10) : null,
        gym_name: gym.trim() || null,
        session_type: sessionType,
        notes: sessionNotes.trim() || null,
      });

      if (climbs.length > 0) {
        await addClimbingAttempts(
          climbs.map((c) => ({
            session_id: session.id,
            user_id: user.id,
            grade: c.grade,
            result: c.result,
            attempts: c.attempts,
            route_name: c.route_name || null,
            style_tag: null,
            notes: null,
          }))
        );
      }

      router.back();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Save failed', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="close" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Log Session</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={C.white} size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Session Info ─────────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Session Info</Text>
            <View style={styles.card}>
              <Field label="Date">
                <TextInput
                  style={styles.textInput}
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={C.textMuted}
                />
              </Field>
              <View style={styles.divider} />
              <Field label="Location">
                <TextInput
                  style={styles.textInput}
                  value={gym}
                  onChangeText={setGym}
                  placeholder="Gym name or crag"
                  placeholderTextColor={C.textMuted}
                />
              </Field>
              <View style={styles.divider} />
              <Field label="Type">
                <View style={styles.toggleRow}>
                  {(['indoor', 'outdoor'] as const).map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.toggleBtn,
                        sessionType === t && styles.toggleActive,
                      ]}
                      onPress={() => setSessionType(t)}
                    >
                      <Text
                        style={[
                          styles.toggleText,
                          sessionType === t && styles.toggleTextActive,
                        ]}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Field>
              <View style={styles.divider} />
              <Field label="Duration (min)">
                <TextInput
                  style={styles.textInput}
                  value={duration}
                  onChangeText={setDuration}
                  placeholder="e.g. 90"
                  placeholderTextColor={C.textMuted}
                  keyboardType="numeric"
                />
              </Field>
            </View>
          </View>

          {/* ── Climbs ───────────────────────────────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Climbs ({climbs.length})</Text>
              <TouchableOpacity
                style={styles.addChip}
                onPress={() => setShowAddForm((v) => !v)}
              >
                <Ionicons
                  name={showAddForm ? 'remove' : 'add'}
                  size={14}
                  color={C.primary}
                />
                <Text style={styles.addChipText}>
                  {showAddForm ? 'Cancel' : 'Add Climb'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Add form */}
            {showAddForm && (
              <View style={styles.addForm}>
                <Text style={styles.formLabel}>Grade</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.gradeScroll}
                >
                  {DISPLAY_GRADES.map((g) => {
                    const color = gradeColor(g);
                    const active = selGrade === g;
                    return (
                      <TouchableOpacity
                        key={g}
                        style={[
                          styles.gradePill,
                          {
                            backgroundColor: active ? color : color + '22',
                            borderColor: active ? color : color + '55',
                          },
                        ]}
                        onPress={() => setSelGrade(g)}
                      >
                        <Text style={[styles.gradePillText, { color: active ? C.white : color }]}>
                          {g}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <Text style={styles.formLabel}>Result</Text>
                <View style={styles.resultRow}>
                  {RESULTS.map((r) => (
                    <TouchableOpacity
                      key={r.value}
                      style={[
                        styles.resultBtn,
                        {
                          backgroundColor:
                            selResult === r.value ? r.color + '30' : C.surface,
                          borderColor:
                            selResult === r.value ? r.color : C.border,
                        },
                      ]}
                      onPress={() => setSelResult(r.value)}
                    >
                      <Text
                        style={[
                          styles.resultText,
                          { color: selResult === r.value ? r.color : C.textSub },
                        ]}
                      >
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.attemptsRow}>
                  <View style={styles.attemptsLeft}>
                    <Text style={styles.formLabel}>Attempts</Text>
                    <View style={styles.stepper}>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => setSelAttempts((v) => Math.max(1, v - 1))}
                      >
                        <Ionicons name="remove" size={16} color={C.text} />
                      </TouchableOpacity>
                      <Text style={styles.stepValue}>{selAttempts}</Text>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => setSelAttempts((v) => v + 1)}
                      >
                        <Ionicons name="add" size={16} color={C.text} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.routeRight}>
                    <Text style={styles.formLabel}>Route name (optional)</Text>
                    <TextInput
                      style={styles.routeInput}
                      value={routeName}
                      onChangeText={setRouteName}
                      placeholder="e.g. The Crimper"
                      placeholderTextColor={C.textMuted}
                    />
                  </View>
                </View>

                <TouchableOpacity style={styles.confirmBtn} onPress={addClimb}>
                  <Ionicons name="checkmark" size={16} color={C.white} />
                  <Text style={styles.confirmBtnText}>Add to session</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Climb list */}
            {climbs.length === 0 && !showAddForm && (
              <View style={styles.emptyClimbs}>
                <Ionicons name="flag-outline" size={24} color={C.textMuted} />
                <Text style={styles.emptyClimbsText}>No climbs added yet</Text>
              </View>
            )}
            {climbs.map((climb, i) => {
              const rc = RESULTS.find((r) => r.value === climb.result);
              const gc = gradeColor(climb.grade);
              return (
                <View key={i} style={styles.climbRow}>
                  <View style={[styles.climbGradeBox, { backgroundColor: gc + '20', borderColor: gc + '55' }]}>
                    <Text style={[styles.climbGrade, { color: gc }]}>{climb.grade}</Text>
                  </View>
                  <View style={styles.climbInfo}>
                    <Text style={styles.climbName}>
                      {climb.route_name || 'Unnamed route'}
                    </Text>
                    <Text style={styles.climbSub}>
                      {climb.attempts} attempt{climb.attempts > 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.climbResultBadge,
                      { backgroundColor: (rc?.color ?? C.textSub) + '22' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.climbResultText,
                        { color: rc?.color ?? C.textSub },
                      ]}
                    >
                      {rc?.label}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => removeClimb(i)} style={styles.removeBtn}>
                    <Ionicons name="close-circle" size={18} color={C.textMuted} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {/* ── Notes ────────────────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={sessionNotes}
              onChangeText={setSessionNotes}
              placeholder="How did the session feel?"
              placeholderTextColor={C.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={fieldStyles.row}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View style={fieldStyles.right}>{children}</View>
    </View>
  );
}
const fieldStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  label: { width: 110, fontSize: F.sm, color: C.textSub },
  right: { flex: 1 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: S.md, paddingBottom: 40 },

  // Header
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
  saveBtn: {
    backgroundColor: C.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: R.full,
    minWidth: 70,
    alignItems: 'center',
  },
  saveBtnText: { color: C.white, fontWeight: '700', fontSize: F.sm },

  // Sections
  section: { marginTop: 20 },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: F.base, fontWeight: '700', color: C.text, marginBottom: 10 },
  card: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  divider: { height: 1, backgroundColor: C.border },
  textInput: { flex: 1, color: C.text, fontSize: F.base, textAlign: 'right' },

  // Type toggle
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: R.full,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  toggleActive: { backgroundColor: C.primaryBg, borderColor: C.primaryBorder },
  toggleText: { fontSize: F.sm, color: C.textSub, fontWeight: '600' },
  toggleTextActive: { color: C.primary },

  // Add chip
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.primaryBg,
    borderWidth: 1,
    borderColor: C.primaryBorder,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: R.full,
  },
  addChipText: { fontSize: F.xs, color: C.primary, fontWeight: '700' },

  // Add form
  addForm: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
  },
  formLabel: { fontSize: F.xs, color: C.textSub, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  gradeScroll: { gap: 8, paddingBottom: 4 },
  gradePill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: R.full,
    borderWidth: 1.5,
  },
  gradePillText: { fontSize: F.sm, fontWeight: '800' },
  resultRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  resultBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: R.md,
    borderWidth: 1,
  },
  resultText: { fontSize: F.sm, fontWeight: '700' },
  attemptsRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 4 },
  attemptsLeft: { flex: 0 },
  routeRight: { flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { fontSize: F.md, fontWeight: '700', color: C.text, minWidth: 24, textAlign: 'center' },
  routeInput: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.sm,
    padding: 10,
    color: C.text,
    fontSize: F.sm,
  },
  confirmBtn: {
    backgroundColor: C.primary,
    borderRadius: R.md,
    paddingVertical: 12,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmBtnText: { color: C.white, fontWeight: '700', fontSize: F.sm },

  // Climb rows
  emptyClimbs: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: C.card,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    gap: 8,
  },
  emptyClimbsText: { fontSize: F.sm, color: C.textMuted },
  climbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: R.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  climbGradeBox: {
    width: 40,
    height: 40,
    borderRadius: R.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  climbGrade: { fontSize: F.sm, fontWeight: '800' },
  climbInfo: { flex: 1 },
  climbName: { fontSize: F.sm, fontWeight: '600', color: C.text },
  climbSub: { fontSize: F.xs, color: C.textSub },
  climbResultBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: R.full,
  },
  climbResultText: { fontSize: F.xs, fontWeight: '700' },
  removeBtn: { padding: 4 },

  // Notes
  notesInput: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    padding: 14,
    color: C.text,
    fontSize: F.base,
    minHeight: 90,
  },
});
