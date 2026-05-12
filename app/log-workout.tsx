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
import { useTheme } from '@/contexts/ThemeContext';
import { createStrengthSession, addStrengthEntries } from '@/services/strength';
import { F, R, S } from '@/constants/Theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface ExerciseEntry {
  exercise_type: string;
  sets: string;
  reps: string;
  weight: string;
  duration: string;
}

// ─── Category / exercise definitions ─────────────────────────────────────────

interface ExerciseDef {
  value: string;
  label: string;
  icon: IoniconName;
  usesDuration: boolean;
}

interface CategoryDef {
  key: string;
  label: string;
  icon: IoniconName;
  color: string;
  exercises: ExerciseDef[];
}

const WORKOUT_CATEGORIES: CategoryDef[] = [
  {
    key: 'fingers', label: 'Fingers', icon: 'finger-print-outline', color: '#FF6535',
    exercises: [
      { value: 'deadhang', label: 'Dead Hang', icon: 'hand-left-outline', usesDuration: true },
      { value: 'fingerboard', label: 'Fingerboard', icon: 'finger-print-outline', usesDuration: true },
      { value: 'pinch', label: 'Pinch Blocks', icon: 'hand-left-outline', usesDuration: false },
    ],
  },
  {
    key: 'pull', label: 'Pull', icon: 'trending-up-outline', color: '#4B8EFF',
    exercises: [
      { value: 'pullups', label: 'Pull-Ups', icon: 'trending-up-outline', usesDuration: false },
      { value: 'weighted_pullups', label: 'Weighted Pull-Ups', icon: 'trending-up-outline', usesDuration: false },
      { value: 'rows', label: 'Rows', icon: 'swap-horizontal-outline', usesDuration: false },
      { value: 'lockoffs', label: 'Lock-Offs', icon: 'lock-closed-outline', usesDuration: true },
    ],
  },
  {
    key: 'push', label: 'Push', icon: 'arrow-up-outline', color: '#3DC87A',
    exercises: [
      { value: 'pushups', label: 'Push-Ups', icon: 'body-outline', usesDuration: false },
      { value: 'dips', label: 'Dips', icon: 'arrow-down-outline', usesDuration: false },
      { value: 'overhead_press', label: 'Overhead Press', icon: 'arrow-up-outline', usesDuration: false },
    ],
  },
  {
    key: 'core', label: 'Core', icon: 'body-outline', color: '#F5BC3C',
    exercises: [
      { value: 'plank', label: 'Plank', icon: 'remove-outline', usesDuration: true },
      { value: 'core', label: 'Core Circuit', icon: 'fitness-outline', usesDuration: false },
      { value: 'l_sit', label: 'L-Sit', icon: 'body-outline', usesDuration: true },
      { value: 'ab_wheel', label: 'Ab Wheel', icon: 'sync-outline', usesDuration: false },
    ],
  },
  {
    key: 'legs', label: 'Legs', icon: 'walk-outline', color: '#A78BFA',
    exercises: [
      { value: 'squats', label: 'Squats', icon: 'walk-outline', usesDuration: false },
      { value: 'lunges', label: 'Lunges', icon: 'walk-outline', usesDuration: false },
      { value: 'step_ups', label: 'Step-Ups', icon: 'walk-outline', usesDuration: false },
      { value: 'calf_raises', label: 'Calf Raises', icon: 'walk-outline', usesDuration: false },
    ],
  },
  {
    key: 'cardio', label: 'Cardio', icon: 'pulse-outline', color: '#F472B6',
    exercises: [
      { value: 'running', label: 'Running', icon: 'pulse-outline', usesDuration: true },
      { value: 'cycling', label: 'Cycling', icon: 'bicycle-outline', usesDuration: true },
      { value: 'rowing', label: 'Rowing', icon: 'boat-outline', usesDuration: true },
      { value: 'jump_rope', label: 'Jump Rope', icon: 'sync-outline', usesDuration: true },
      { value: 'stair_climber', label: 'Stair Climber', icon: 'trending-up-outline', usesDuration: true },
    ],
  },
];

// Flat lookup for the exercise list display
const ALL_EXERCISES = WORKOUT_CATEGORIES.flatMap((c) => c.exercises);

const today = () => new Date().toISOString().split('T')[0];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LogWorkoutScreen() {
  const { colors: C } = useTheme();
  const router = useRouter();
  const { user } = useAuth();

  // Session fields
  const [date, setDate] = useState(today());
  const [duration, setDuration] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');

  // Exercises list
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);

  // Step state for add-exercise flow
  // null = hidden, 'category' = picking category, 'exercise' = picking exercise
  const [addStep, setAddStep] = useState<null | 'category' | 'exercise'>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryDef | null>(null);
  const [selectedExerciseDef, setSelectedExerciseDef] = useState<ExerciseDef | null>(null);
  const [newEntry, setNewEntry] = useState<ExerciseEntry>({
    exercise_type: '', sets: '', reps: '', weight: '', duration: '',
  });

  const [saving, setSaving] = useState(false);

  // ── Add-exercise step helpers ──────────────────────────────────────────────

  const openCategoryPicker = () => {
    setSelectedCategory(null);
    setSelectedExerciseDef(null);
    setNewEntry({ exercise_type: '', sets: '', reps: '', weight: '', duration: '' });
    setAddStep('category');
  };

  const selectCategory = (cat: CategoryDef) => {
    setSelectedCategory(cat);
    setAddStep('exercise');
  };

  const selectExerciseDef = (ex: ExerciseDef) => {
    setSelectedExerciseDef(ex);
    setNewEntry({ exercise_type: ex.value, sets: '', reps: '', weight: '', duration: '' });
  };

  const cancelAddFlow = () => {
    setAddStep(null);
    setSelectedCategory(null);
    setSelectedExerciseDef(null);
    setNewEntry({ exercise_type: '', sets: '', reps: '', weight: '', duration: '' });
  };

  const confirmAddExercise = () => {
    if (!selectedExerciseDef) {
      Alert.alert('No exercise selected', 'Please select an exercise first.');
      return;
    }
    if (!newEntry.sets && !newEntry.reps && !newEntry.duration) {
      Alert.alert('Missing data', 'Please enter sets/reps or a duration.');
      return;
    }
    setExercises((prev) => [...prev, { ...newEntry, exercise_type: selectedExerciseDef.value }]);
    cancelAddFlow();
  };

  const removeExercise = (idx: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Save ──────────────────────────────────────────────────────────────────

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
          exercises.map((ex) => ({
            strength_session_id: session.id,
            user_id: user.id,
            exercise_type: ex.exercise_type,
            sets: ex.sets ? parseInt(ex.sets, 10) : null,
            reps: ex.reps ? parseInt(ex.reps, 10) : null,
            weight: ex.weight ? parseFloat(ex.weight) : null,
            duration: ex.duration ? parseInt(ex.duration, 10) : null,
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

  const styles = makeStyles(C);
  const catColor = selectedCategory?.color ?? C.accent;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="auto" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
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
              <ActivityIndicator color="#000" size="small" />
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
              <Text style={styles.sectionTitle}>
                Exercises{exercises.length > 0 ? ` (${exercises.length})` : ''}
              </Text>
              {addStep === null ? (
                <TouchableOpacity style={[styles.addChip, { borderColor: C.accentBorder, backgroundColor: C.accentBg }]} onPress={openCategoryPicker}>
                  <Ionicons name="add" size={14} color={C.accent} />
                  <Text style={[styles.addChipText, { color: C.accent }]}>Add Exercise</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.cancelChip} onPress={cancelAddFlow}>
                  <Text style={[styles.addChipText, { color: C.textSub }]}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ── Step 1: Category picker ─────────────────────────────── */}
            {addStep === 'category' && (
              <View style={[styles.stepCard, { borderColor: C.border }]}>
                <Text style={styles.stepTitle}>Choose a category</Text>
                <View style={styles.catGrid}>
                  {WORKOUT_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.key}
                      style={[styles.catBtn, { backgroundColor: cat.color + '18', borderColor: cat.color + '40' }]}
                      onPress={() => selectCategory(cat)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.catBtnIcon, { backgroundColor: cat.color + '25' }]}>
                        <Ionicons name={cat.icon} size={20} color={cat.color} />
                      </View>
                      <Text style={[styles.catBtnLabel, { color: cat.color }]}>{cat.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* ── Step 2: Exercise picker + form ──────────────────────── */}
            {addStep === 'exercise' && selectedCategory && (
              <View style={[styles.stepCard, { borderColor: catColor + '50' }]}>
                {/* Category badge + back */}
                <View style={styles.stepHeader}>
                  <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => { setAddStep('category'); setSelectedExerciseDef(null); }}
                  >
                    <Ionicons name="chevron-back" size={16} color={C.textSub} />
                    <Text style={[styles.backBtnText, { color: C.textSub }]}>Categories</Text>
                  </TouchableOpacity>
                  <View style={[styles.catBadge, { backgroundColor: catColor + '20', borderColor: catColor + '50' }]}>
                    <Ionicons name={selectedCategory.icon} size={13} color={catColor} />
                    <Text style={[styles.catBadgeText, { color: catColor }]}>{selectedCategory.label}</Text>
                  </View>
                </View>

                {/* Exercise list */}
                <Text style={styles.stepTitle}>Select exercise</Text>
                <View style={styles.exList}>
                  {selectedCategory.exercises.map((ex) => {
                    const isSelected = selectedExerciseDef?.value === ex.value;
                    return (
                      <TouchableOpacity
                        key={ex.value}
                        style={[
                          styles.exBtn,
                          { backgroundColor: C.surface, borderColor: C.border },
                          isSelected && { backgroundColor: catColor + '18', borderColor: catColor },
                        ]}
                        onPress={() => selectExerciseDef(ex)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={ex.icon} size={16} color={isSelected ? catColor : C.textSub} />
                        <Text style={[styles.exBtnText, { color: isSelected ? catColor : C.text }]}>
                          {ex.label}
                        </Text>
                        {isSelected && <Ionicons name="checkmark-circle" size={16} color={catColor} style={{ marginLeft: 'auto' }} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Form (shown once an exercise is selected) */}
                {selectedExerciseDef && (
                  <View style={[styles.formBox, { borderTopColor: C.border }]}>
                    {selectedExerciseDef.usesDuration ? (
                      <View style={styles.setsRepsRow}>
                        <View style={styles.setsRepsField}>
                          <Text style={styles.formLabel}>Duration (sec)</Text>
                          <TextInput
                            style={[styles.numInput, { backgroundColor: C.surface, borderColor: C.border, color: C.text }]}
                            value={newEntry.duration}
                            onChangeText={(v) => setNewEntry((p) => ({ ...p, duration: v }))}
                            placeholder="e.g. 30"
                            placeholderTextColor={C.textMuted}
                            keyboardType="numeric"
                          />
                        </View>
                      </View>
                    ) : (
                      <View style={styles.setsRepsRow}>
                        <View style={styles.setsRepsField}>
                          <Text style={styles.formLabel}>Sets</Text>
                          <TextInput
                            style={[styles.numInput, { backgroundColor: C.surface, borderColor: C.border, color: C.text }]}
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
                            style={[styles.numInput, { backgroundColor: C.surface, borderColor: C.border, color: C.text }]}
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
                            style={[styles.numInput, { backgroundColor: C.surface, borderColor: C.border, color: C.text }]}
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
                      style={[styles.confirmBtn, { backgroundColor: catColor }]}
                      onPress={confirmAddExercise}
                    >
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={styles.confirmBtnText}>Add to workout</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Exercise list */}
            {exercises.length === 0 && addStep === null && (
              <View style={[styles.emptyExercises, { backgroundColor: C.card, borderColor: C.border }]}>
                <Ionicons name="barbell-outline" size={24} color={C.textMuted} />
                <Text style={[styles.emptyText, { color: C.textMuted }]}>
                  Tap "Add Exercise" to start building your workout
                </Text>
              </View>
            )}

            {exercises.map((ex, i) => {
              const cat = WORKOUT_CATEGORIES.find((c) => c.exercises.some((e) => e.value === ex.exercise_type));
              const exDef = ALL_EXERCISES.find((e) => e.value === ex.exercise_type);
              const detail = ex.duration
                ? `${ex.duration}s`
                : [ex.sets && `${ex.sets} sets`, ex.reps && `${ex.reps} reps`, ex.weight && `${ex.weight}kg`]
                    .filter(Boolean)
                    .join(' · ');
              const color = cat?.color ?? C.accent;
              return (
                <View key={i} style={[styles.exRow, { backgroundColor: C.card, borderColor: C.border }]}>
                  <View style={[styles.exIconBox, { backgroundColor: color + '20' }]}>
                    <Ionicons name={exDef?.icon ?? 'barbell-outline'} size={18} color={color} />
                  </View>
                  <View style={styles.exInfo}>
                    <Text style={[styles.exName, { color: C.text }]}>{exDef?.label ?? ex.exercise_type}</Text>
                    <Text style={[styles.exDetail, { color: C.textSub }]}>{detail || '—'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeExercise(i)} style={styles.removeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={20} color={C.textMuted} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {/* ── Notes ────────────────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes (optional)</Text>
            <TextInput
              style={[styles.notesInput, { backgroundColor: C.card, borderColor: C.border, color: C.text }]}
              value={sessionNotes}
              onChangeText={setSessionNotes}
              placeholder="How did the workout feel?"
              placeholderTextColor={C.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── InfoRow (label only — no theme color needed) ─────────────────────────────
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
  label: { width: 110, fontSize: F.sm, color: '#7E839E' },
  right: { flex: 1 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────
function makeStyles(C: ReturnType<typeof useTheme>['colors']) { return StyleSheet.create({
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
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: F.md, fontWeight: '700', color: C.text },
  saveBtn: {
    backgroundColor: C.accent,
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: R.full, minWidth: 70, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: F.sm },

  section: { marginTop: S.lg },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: F.base, fontWeight: '700', color: C.text },

  card: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.border },
  divider: { height: 1, backgroundColor: C.border, marginHorizontal: 16 },
  textInput: { flex: 1, color: C.text, fontSize: F.base, paddingVertical: 2 },

  addChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 6,
  },
  cancelChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: C.border, borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: C.surface,
  },
  addChipText: { fontSize: F.sm, fontWeight: '700' },

  // Step card (category + exercise pickers)
  stepCard: {
    backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1,
    padding: 16, marginTop: 8, gap: 12,
  },
  stepTitle: { fontSize: F.sm, fontWeight: '700', color: C.text, marginBottom: 4 },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backBtnText: { fontSize: F.sm, fontWeight: '600' },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.full, borderWidth: 1 },
  catBadgeText: { fontSize: F.xs, fontWeight: '700' },

  // Category grid (2×3)
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: {
    width: '30%', flexGrow: 1,
    alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: R.md, borderWidth: 1,
  },
  catBtnIcon: { width: 36, height: 36, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' },
  catBtnLabel: { fontSize: F.xs, fontWeight: '700', textAlign: 'center' },

  // Exercise list
  exList: { gap: 6 },
  exBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: R.md, borderWidth: 1 },
  exBtnText: { fontSize: F.sm, fontWeight: '600', flex: 1 },

  // Form inside exercise step
  formBox: { borderTopWidth: 1, paddingTop: 14, gap: 10 },
  formLabel: { fontSize: F.xs, color: C.textSub, fontWeight: '600', marginBottom: 4 },
  setsRepsRow: { flexDirection: 'row', gap: 10 },
  setsRepsField: { flex: 1 },
  numInput: {
    borderWidth: 1, borderRadius: R.md, paddingHorizontal: 12,
    height: 44, fontSize: F.base, textAlign: 'center',
  },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 46, borderRadius: R.md, marginTop: 4,
  },
  confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: F.base },

  // Exercise rows (added to workout)
  emptyExercises: {
    alignItems: 'center', paddingVertical: 28, borderRadius: R.lg,
    borderWidth: 1, gap: 8, marginTop: 8,
  },
  emptyText: { fontSize: F.sm, textAlign: 'center', paddingHorizontal: 16 },
  exRow: {
    flexDirection: 'row', alignItems: 'center', borderRadius: R.md,
    padding: 12, marginTop: 8, borderWidth: 1, gap: 12,
  },
  exIconBox: { width: 38, height: 38, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' },
  exInfo: { flex: 1 },
  exName: { fontSize: F.sm, fontWeight: '700' },
  exDetail: { fontSize: F.xs, marginTop: 2 },
  removeBtn: { padding: 2 },

  notesInput: {
    borderWidth: 1, borderRadius: R.lg, padding: 14,
    fontSize: F.base, minHeight: 90,
  },
}); }
