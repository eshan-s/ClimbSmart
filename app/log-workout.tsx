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
import { createStrengthSession, addStrengthEntries } from '@/services/strength';
import { C, F, R, S } from '@/constants/Theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface ExerciseEntry {
  exercise_type: string;
  sets: string;
  reps: string;
  weight: string;
  duration: string;
}

const EXERCISE_TYPES: { value: string; label: string; icon: IoniconName; usesDuration: boolean }[] = [
  { value: 'pullups', label: 'Pull-Ups', icon: 'trending-up-outline', usesDuration: false },
  { value: 'deadhang', label: 'Dead Hang', icon: 'hand-left-outline', usesDuration: true },
  { value: 'dips', label: 'Dips', icon: 'arrow-down-outline', usesDuration: false },
  { value: 'pushups', label: 'Push-Ups', icon: 'body-outline', usesDuration: false },
  { value: 'plank', label: 'Plank', icon: 'remove-outline', usesDuration: true },
  { value: 'fingerboard', label: 'Fingerboard', icon: 'finger-print-outline', usesDuration: true },
  { value: 'core', label: 'Core', icon: 'fitness-outline', usesDuration: false },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline', usesDuration: false },
];

const today = () => new Date().toISOString().split('T')[0];

export default function LogWorkoutScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [date, setDate] = useState(today());
  const [duration, setDuration] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');

  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selType, setSelType] = useState('pullups');
  const [newEntry, setNewEntry] = useState<ExerciseEntry>({
    exercise_type: 'pullups',
    sets: '',
    reps: '',
    weight: '',
    duration: '',
  });

  const [saving, setSaving] = useState(false);

  const selExType = EXERCISE_TYPES.find((e) => e.value === selType)!;

  const selectType = (val: string) => {
    setSelType(val);
    setNewEntry({ exercise_type: val, sets: '', reps: '', weight: '', duration: '' });
  };

  const addExercise = () => {
    if (!newEntry.sets && !newEntry.reps && !newEntry.duration) {
      Alert.alert('Missing data', 'Please enter sets/reps or a duration.');
      return;
    }
    setExercises((prev) => [...prev, { ...newEntry, exercise_type: selType }]);
    setNewEntry({ exercise_type: selType, sets: '', reps: '', weight: '', duration: '' });
    setShowAddForm(false);
  };

  const removeExercise = (idx: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in before saving a workout.');
      return;
    }
    setSaving(true);
    try {
      const session = await createStrengthSession({
        user_id: user.id,
        date,
        duration: duration ? parseInt(duration, 10) : null,
        notes: sessionNotes.trim() || null,
      });

      if (exercises.length > 0) {
        await addStrengthEntries(
          exercises.map((e) => ({
            strength_session_id: session.id,
            user_id: user.id,
            exercise_type: e.exercise_type,
            sets: e.sets ? parseInt(e.sets, 10) : null,
            reps: e.reps ? parseInt(e.reps, 10) : null,
            weight: e.weight ? parseFloat(e.weight) : null,
            duration: e.duration ? parseInt(e.duration, 10) : null,
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
          <Text style={styles.headerTitle}>Log Workout</Text>
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
              <InfoRow label="Date">
                <TextInput
                  style={styles.textInput}
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={C.textMuted}
                />
              </InfoRow>
              <View style={styles.divider} />
              <InfoRow label="Duration (min)">
                <TextInput
                  style={styles.textInput}
                  value={duration}
                  onChangeText={setDuration}
                  placeholder="e.g. 45"
                  placeholderTextColor={C.textMuted}
                  keyboardType="numeric"
                />
              </InfoRow>
            </View>
          </View>

          {/* ── Exercises ────────────────────────────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Exercises ({exercises.length})</Text>
              <TouchableOpacity
                style={styles.addChip}
                onPress={() => setShowAddForm((v) => !v)}
              >
                <Ionicons name={showAddForm ? 'remove' : 'add'} size={14} color={C.accent} />
                <Text style={[styles.addChipText, { color: C.accent }]}>
                  {showAddForm ? 'Cancel' : 'Add Exercise'}
                </Text>
              </TouchableOpacity>
            </View>

            {showAddForm && (
              <View style={[styles.addForm, { borderColor: C.accentBorder }]}>
                <Text style={styles.formLabel}>Exercise Type</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.typeScroll}
                >
                  {EXERCISE_TYPES.map((et) => (
                    <TouchableOpacity
                      key={et.value}
                      style={[
                        styles.typeChip,
                        selType === et.value && styles.typeChipActive,
                      ]}
                      onPress={() => selectType(et.value)}
                    >
                      <Ionicons
                        name={et.icon}
                        size={14}
                        color={selType === et.value ? C.accent : C.textSub}
                      />
                      <Text
                        style={[
                          styles.typeChipText,
                          selType === et.value && styles.typeChipTextActive,
                        ]}
                      >
                        {et.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {selExType.usesDuration ? (
                  <>
                    <Text style={styles.formLabel}>Duration (seconds)</Text>
                    <TextInput
                      style={styles.numInput}
                      value={newEntry.duration}
                      onChangeText={(v) => setNewEntry((p) => ({ ...p, duration: v }))}
                      placeholder="e.g. 30"
                      placeholderTextColor={C.textMuted}
                      keyboardType="numeric"
                    />
                  </>
                ) : (
                  <View style={styles.setsRepsRow}>
                    <View style={styles.setsRepsField}>
                      <Text style={styles.formLabel}>Sets</Text>
                      <TextInput
                        style={styles.numInput}
                        value={newEntry.sets}
                        onChangeText={(v) => setNewEntry((p) => ({ ...p, sets: v }))}
                        placeholder="3"
                        placeholderTextColor={C.textMuted}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.setsRepsField}>
                      <Text style={styles.formLabel}>Reps</Text>
                      <TextInput
                        style={styles.numInput}
                        value={newEntry.reps}
                        onChangeText={(v) => setNewEntry((p) => ({ ...p, reps: v }))}
                        placeholder="8"
                        placeholderTextColor={C.textMuted}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.setsRepsField}>
                      <Text style={styles.formLabel}>Weight (kg)</Text>
                      <TextInput
                        style={styles.numInput}
                        value={newEntry.weight}
                        onChangeText={(v) => setNewEntry((p) => ({ ...p, weight: v }))}
                        placeholder="BW"
                        placeholderTextColor={C.textMuted}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: C.accent }]}
                  onPress={addExercise}
                >
                  <Ionicons name="checkmark" size={16} color={C.white} />
                  <Text style={styles.confirmBtnText}>Add to workout</Text>
                </TouchableOpacity>
              </View>
            )}

            {exercises.length === 0 && !showAddForm && (
              <View style={styles.emptyExercises}>
                <Ionicons name="barbell-outline" size={24} color={C.textMuted} />
                <Text style={styles.emptyText}>No exercises added yet</Text>
              </View>
            )}

            {exercises.map((ex, i) => {
              const et = EXERCISE_TYPES.find((t) => t.value === ex.exercise_type);
              const detail = ex.duration
                ? `${ex.duration}s`
                : [ex.sets && `${ex.sets} sets`, ex.reps && `${ex.reps} reps`, ex.weight && `${ex.weight}kg`]
                    .filter(Boolean)
                    .join(' · ');
              return (
                <View key={i} style={styles.exRow}>
                  <View style={styles.exIconBox}>
                    <Ionicons name={et?.icon ?? 'barbell-outline'} size={18} color={C.accent} />
                  </View>
                  <View style={styles.exInfo}>
                    <Text style={styles.exName}>{et?.label ?? ex.exercise_type}</Text>
                    <Text style={styles.exDetail}>{detail || '—'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeExercise(i)} style={styles.removeBtn}>
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
              placeholder="How did the workout feel?"
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

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={irStyles.row}>
      <Text style={irStyles.label}>{label}</Text>
      <View style={irStyles.right}>{children}</View>
    </View>
  );
}
const irStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  label: { width: 110, fontSize: F.sm, color: C.textSub },
  right: { flex: 1 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: S.md, paddingBottom: 40 },

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
    backgroundColor: C.accent,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: R.full,
    minWidth: 70,
    alignItems: 'center',
  },
  saveBtnText: { color: C.white, fontWeight: '700', fontSize: F.sm },

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

  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: R.full,
  },
  addChipText: { fontSize: F.xs, fontWeight: '700' },

  addForm: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  formLabel: { fontSize: F.xs, color: C.textSub, fontWeight: '600', marginBottom: 8, marginTop: 8 },
  typeScroll: { gap: 8, paddingBottom: 4 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: R.full,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  typeChipActive: { backgroundColor: C.accentBg, borderColor: C.accentBorder },
  typeChipText: { fontSize: F.xs, color: C.textSub, fontWeight: '600' },
  typeChipTextActive: { color: C.accent },

  setsRepsRow: { flexDirection: 'row', gap: 10 },
  setsRepsField: { flex: 1 },
  numInput: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.sm,
    padding: 10,
    color: C.text,
    fontSize: F.base,
    textAlign: 'center',
  },
  confirmBtn: {
    borderRadius: R.md,
    paddingVertical: 12,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmBtnText: { color: C.white, fontWeight: '700', fontSize: F.sm },

  emptyExercises: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: C.card,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    gap: 8,
  },
  emptyText: { fontSize: F.sm, color: C.textMuted },

  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: R.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  exIconBox: {
    width: 36,
    height: 36,
    borderRadius: R.sm,
    backgroundColor: C.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exInfo: { flex: 1 },
  exName: { fontSize: F.sm, fontWeight: '600', color: C.text },
  exDetail: { fontSize: F.xs, color: C.textSub, marginTop: 2 },
  removeBtn: { padding: 4 },

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
