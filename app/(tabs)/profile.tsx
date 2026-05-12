import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  SafeAreaView as RNSafeAreaView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { F, R, S } from '@/constants/Theme';
import { upsertProfile, getProfile, getPreferences, updatePreferences } from '@/services/profile';
import { getActiveGoals, createGoal, deleteGoal, type CreateGoalInput } from '@/services/goals';
import { getClimbingSessions } from '@/services/climbing';
import { computePRs, getStrengthSessions } from '@/services/strength';
import type { Goal, GoalType, UserPreferences, Profile } from '@/types';
import { maxGradeFromAttempts, DISPLAY_GRADES, YDS_GRADES } from '@/utils/grades';
import { formatDate } from '@/services/strength';
import {
  displayWeight,
  displayHeight,
  parseWeightInput,
  parseHeightInput,
  weightPlaceholder,
  heightPlaceholder,
} from '@/utils/units';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Settings row ─────────────────────────────────────────────────────────────

function SettingsRow({
  icon, label, value, destructive = false, onPress, right,
}: {
  icon: IoniconName; label: string; value?: string; destructive?: boolean; onPress?: () => void; right?: React.ReactNode;
}) {
  const { colors: C } = useTheme();
  return (
    <TouchableOpacity
      style={[sRowStyles.row, { borderBottomColor: C.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Ionicons name={icon} size={18} color={destructive ? '#EF4444' : C.textSub} style={sRowStyles.icon} />
      <Text style={[sRowStyles.label, { color: destructive ? '#EF4444' : C.text }]}>{label}</Text>
      {right ?? (value ? <Text style={[sRowStyles.value, { color: C.textSub }]}>{value}</Text> : null)}
      {!right && <Ionicons name="chevron-forward" size={14} color={C.textMuted} />}
    </TouchableOpacity>
  );
}
const sRowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1 },
  icon: { marginRight: 12 },
  label: { flex: 1, fontSize: F.base, fontWeight: '500' },
  value: { fontSize: F.sm, marginRight: 8 },
});

function MetricRow({
  label, value, editing, inputValue, onChangeText, placeholder, keyboardType = 'default',
}: {
  label: string; value: string; editing: boolean; inputValue: string; onChangeText: (v: string) => void; placeholder: string; keyboardType?: 'default' | 'numeric';
}) {
  const { colors: C } = useTheme();
  return (
    <View style={[mrStyles.row, { borderBottomColor: C.border }]}>
      <Text style={[mrStyles.label, { color: C.textSub }]}>{label}</Text>
      {editing ? (
        <TextInput
          style={[mrStyles.input, { color: C.text, borderBottomColor: C.primary }]}
          value={inputValue}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.textMuted}
          keyboardType={keyboardType}
        />
      ) : (
        <Text style={[mrStyles.value, { color: C.text }]}>{value || '—'}</Text>
      )}
    </View>
  );
}
const mrStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  label: { width: 110, fontSize: F.sm },
  value: { flex: 1, fontSize: F.base, textAlign: 'right', fontWeight: '500' },
  input: { flex: 1, fontSize: F.base, textAlign: 'right', borderBottomWidth: 1, paddingBottom: 2 },
});

// ─── Goal type constants ──────────────────────────────────────────────────────

const GOAL_TYPES: { value: GoalType; label: string; icon: IoniconName; color: string }[] = [
  { value: 'bouldering', label: 'Bouldering', icon: 'flag-outline', color: '#FF6535' },
  { value: 'top_rope', label: 'Top Rope', icon: 'flag-outline', color: '#4B8EFF' },
  { value: 'strength', label: 'Strength', icon: 'barbell-outline', color: '#A78BFA' },
];

const STRENGTH_EXERCISES = [
  { value: 'pullups', label: 'Pull-Ups' },
  { value: 'deadhang', label: 'Dead Hang' },
  { value: 'fingerboard', label: 'Fingerboard' },
  { value: 'dips', label: 'Dips' },
  { value: 'pushups', label: 'Push-Ups' },
  { value: 'squats', label: 'Squats' },
  { value: 'plank', label: 'Plank' },
  { value: 'lockoffs', label: 'Lock-Offs' },
];

// ─── Goal Card ────────────────────────────────────────────────────────────────

function GoalCard({
  goal, onDelete,
}: {
  goal: Goal; onDelete: () => void;
}) {
  const { colors: C } = useTheme();
  const typeInfo = GOAL_TYPES.find((t) => t.value === goal.goal_type) ?? GOAL_TYPES[0];

  const targetLabel =
    goal.goal_type === 'strength'
      ? `${goal.exercise_type?.replace(/_/g, ' ') ?? '?'}: ${goal.target_value ?? '?'} ${goal.unit ?? ''}`
      : `Send ${goal.target_grade ?? '?'}`;

  return (
    <View style={[goalCardStyles.card, { backgroundColor: C.card, borderColor: typeInfo.color + '40' }]}>
      <View style={goalCardStyles.left}>
        <View style={[goalCardStyles.iconBox, { backgroundColor: typeInfo.color + '20' }]}>
          <Ionicons name={typeInfo.icon} size={14} color={typeInfo.color} />
        </View>
        <View>
          <Text style={[goalCardStyles.typeLabel, { color: typeInfo.color }]}>{typeInfo.label.toUpperCase()}</Text>
          <Text style={[goalCardStyles.target, { color: C.text }]}>{targetLabel}</Text>
          {goal.target_date && (
            <Text style={[goalCardStyles.date, { color: C.textSub }]}>
              Due {new Date(goal.target_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </Text>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={[goalCardStyles.deleteBtn, { backgroundColor: '#EF444420', borderColor: '#EF444440' }]}
        onPress={onDelete}
      >
        <Ionicons name="trash-outline" size={14} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );
}
const goalCardStyles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: R.md, borderWidth: 1, marginBottom: 10 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconBox: { width: 32, height: 32, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' },
  typeLabel: { fontSize: F.xs, fontWeight: '800', letterSpacing: 0.6, marginBottom: 2 },
  target: { fontSize: F.sm, fontWeight: '700' },
  date: { fontSize: F.xs, marginTop: 2 },
  deleteBtn: { width: 34, height: 34, borderRadius: R.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});

// ─── Add Goal Modal ───────────────────────────────────────────────────────────

function AddGoalModal({
  visible, onClose, onSave,
}: {
  visible: boolean; onClose: () => void; onSave: (input: CreateGoalInput) => Promise<void>;
}) {
  const { colors: C } = useTheme();
  const [goalType, setGoalType] = useState<GoalType>('bouldering');
  const [grade, setGrade] = useState('V6');
  const [targetDate, setTargetDate] = useState('');
  const [exType, setExType] = useState('pullups');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState<'reps' | 'seconds'>('reps');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const input: CreateGoalInput = {
        goal_type: goalType,
        target_date: targetDate || null,
      };
      if (goalType === 'bouldering' || goalType === 'top_rope') {
        input.target_grade = grade;
      } else {
        const tv = parseFloat(targetValue);
        if (isNaN(tv) || tv <= 0) { Alert.alert('Validation', 'Enter a valid target value.'); return; }
        input.exercise_type = exType;
        input.target_value = tv;
        input.unit = unit;
      }
      await onSave(input);
      // Reset
      setGrade('V6');
      setTargetDate('');
      setTargetValue('');
      onClose();
    } catch (e: unknown) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const gradeList = goalType === 'top_rope' ? YDS_GRADES : DISPLAY_GRADES;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <RNSafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={[agmStyles.header, { borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={onClose} style={[agmStyles.closeBtn, { backgroundColor: C.surface }]}>
            <Ionicons name="close" size={20} color={C.text} />
          </TouchableOpacity>
          <Text style={[agmStyles.title, { color: C.text }]}>Add Goal</Text>
          <TouchableOpacity
            style={[agmStyles.saveBtn, { backgroundColor: C.primary }, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={agmStyles.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={agmStyles.content} keyboardShouldPersistTaps="handled">
          {/* Goal type */}
          <Text style={[agmStyles.label, { color: C.textSub }]}>Goal Type</Text>
          <View style={agmStyles.typeRow}>
            {GOAL_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[agmStyles.typeBtn, { borderColor: goalType === t.value ? t.color : C.border, backgroundColor: goalType === t.value ? t.color + '15' : C.surface }]}
                onPress={() => {
                  setGoalType(t.value);
                  setGrade(t.value === 'top_rope' ? '5.10a' : 'V6');
                }}
              >
                <Ionicons name={t.icon} size={16} color={goalType === t.value ? t.color : C.textSub} />
                <Text style={[agmStyles.typeBtnText, { color: goalType === t.value ? t.color : C.textSub }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Grade picker */}
          {(goalType === 'bouldering' || goalType === 'top_rope') && (
            <>
              <Text style={[agmStyles.label, { color: C.textSub }]}>Target Grade</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={agmStyles.gradeRow}>
                {gradeList.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[agmStyles.gradePill, {
                      backgroundColor: grade === g ? C.primary : C.surface,
                      borderColor: grade === g ? C.primary : C.border,
                    }]}
                    onPress={() => setGrade(g)}
                  >
                    <Text style={[agmStyles.gradeText, { color: grade === g ? '#fff' : C.textSub }]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Strength picker */}
          {goalType === 'strength' && (
            <>
              <Text style={[agmStyles.label, { color: C.textSub }]}>Exercise</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={agmStyles.gradeRow}>
                {STRENGTH_EXERCISES.map((ex) => (
                  <TouchableOpacity
                    key={ex.value}
                    style={[agmStyles.gradePill, {
                      backgroundColor: exType === ex.value ? '#A78BFA' : C.surface,
                      borderColor: exType === ex.value ? '#A78BFA' : C.border,
                    }]}
                    onPress={() => setExType(ex.value)}
                  >
                    <Text style={[agmStyles.gradeText, { color: exType === ex.value ? '#fff' : C.textSub }]}>{ex.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={[agmStyles.label, { color: C.textSub, marginTop: 12 }]}>Unit</Text>
              <View style={agmStyles.typeRow}>
                {(['reps', 'seconds'] as const).map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[agmStyles.typeBtn, { flex: 1, borderColor: unit === u ? '#A78BFA' : C.border, backgroundColor: unit === u ? '#A78BFA15' : C.surface }]}
                    onPress={() => setUnit(u)}
                  >
                    <Text style={[agmStyles.typeBtnText, { color: unit === u ? '#A78BFA' : C.textSub }]}>{u.charAt(0).toUpperCase() + u.slice(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[agmStyles.label, { color: C.textSub, marginTop: 12 }]}>Target Value</Text>
              <TextInput
                style={[agmStyles.input, { color: C.text, backgroundColor: C.surface, borderColor: C.border }]}
                value={targetValue}
                onChangeText={setTargetValue}
                placeholder={unit === 'reps' ? 'e.g. 15' : 'e.g. 30'}
                placeholderTextColor={C.textMuted}
                keyboardType="numeric"
              />
            </>
          )}

          {/* Target date */}
          <Text style={[agmStyles.label, { color: C.textSub, marginTop: 12 }]}>Target Date (optional)</Text>
          <TextInput
            style={[agmStyles.input, { color: C.text, backgroundColor: C.surface, borderColor: C.border }]}
            value={targetDate}
            onChangeText={setTargetDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={C.textMuted}
          />
        </ScrollView>
      </RNSafeAreaView>
    </Modal>
  );
}
const agmStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.md, paddingVertical: 14, borderBottomWidth: 1 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: F.md, fontWeight: '700' },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: R.full },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: F.sm },
  content: { paddingHorizontal: S.md, paddingBottom: 60 },
  label: { fontSize: F.xs, fontWeight: '600', marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: R.md, borderWidth: 1.5 },
  typeBtnText: { fontSize: F.sm, fontWeight: '700' },
  gradeRow: { gap: 8, paddingVertical: 4 },
  gradePill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.full, borderWidth: 1.5 },
  gradeText: { fontSize: F.sm, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: R.md, padding: 12, fontSize: F.base },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { colors: C, isDark, setDark } = useTheme();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [currentGrade, setCurrentGrade] = useState<string | null>(null);
  const [prs, setPRs] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Profile edit
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editHeight, setEditHeight] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editWingspan, setEditWingspan] = useState('');
  const [editHomeGym, setEditHomeGym] = useState('');
  const [saving, setSaving] = useState(false);

  // Add-goal modal
  const [showAddGoal, setShowAddGoal] = useState(false);

  const units = prefs?.units ?? 'imperial';

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [prof, gs, p, sessions, ss] = await Promise.all([
        getProfile(user.id),
        getActiveGoals(user.id),
        getPreferences(user.id),
        getClimbingSessions(user.id, 50),
        getStrengthSessions(user.id, 20),
      ]);
      setProfile(prof);
      setGoals(gs);
      setPrefs(p);
      setSessionCount(sessions.length);
      setCurrentGrade(maxGradeFromAttempts(sessions.flatMap((s) => s.climbing_attempts ?? [])));
      setPRs(computePRs(ss));
      // Apply stored theme
      if (p?.theme) setDark(p.theme === 'dark');
    } catch (e) {
      console.error('Profile load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, setDark]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startEditing = () => {
    if (!profile) return;
    setEditName(profile.full_name ?? '');
    const u = prefs?.units ?? 'imperial';
    if (u === 'imperial') {
      const { cmToFtIn, kgToLbs } = require('@/utils/units');
      setEditHeight(profile.height ? `${cmToFtIn(profile.height).ft}'${cmToFtIn(profile.height).inches}"` : '');
      setEditWeight(profile.weight ? String(kgToLbs(profile.weight)) : '');
      setEditWingspan(profile.wingspan ? `${cmToFtIn(profile.wingspan).ft}'${cmToFtIn(profile.wingspan).inches}"` : '');
    } else {
      setEditHeight(profile.height ? String(profile.height) : '');
      setEditWeight(profile.weight ? String(profile.weight) : '');
      setEditWingspan(profile.wingspan ? String(profile.wingspan) : '');
    }
    setEditHomeGym(profile.home_gym ?? '');
    setEditing(true);
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await upsertProfile(user.id, {
        full_name: editName.trim() || null,
        height: parseHeightInput(editHeight, units),
        weight: parseWeightInput(editWeight, units),
        wingspan: parseHeightInput(editWingspan, units),
        home_gym: editHomeGym.trim() || null,
      });
      setProfile(updated);
      setEditing(false);
    } catch (e: unknown) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddGoal = async (input: CreateGoalInput) => {
    if (!user) throw new Error('Not signed in');
    const created = await createGoal(user.id, input);
    setGoals((prev) => {
      const filtered = prev.filter((g) => g.goal_type !== created.goal_type);
      return [created, ...filtered];
    });
  };

  const handleDeleteGoal = (goalId: string) => {
    Alert.alert('Remove Goal', 'Are you sure you want to remove this goal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await deleteGoal(goalId);
            setGoals((prev) => prev.filter((g) => g.id !== goalId));
          } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Unknown error');
          }
        },
      },
    ]);
  };

  const toggleNotifications = async () => {
    if (!user) return;
    try {
      const updated = await updatePreferences(user.id, { notifications_enabled: !(prefs?.notifications_enabled ?? true) });
      setPrefs(updated);
    } catch (e: unknown) {
      Alert.alert('Could not update preference', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const toggleUnits = async () => {
    if (!user) return;
    try {
      const newUnits = units === 'metric' ? 'imperial' : 'metric';
      const updated = await updatePreferences(user.id, { units: newUnits });
      setPrefs(updated);
    } catch (e: unknown) {
      Alert.alert('Could not update preference', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const toggleTheme = async () => {
    if (!user) return;
    try {
      const newTheme = isDark ? 'light' : 'dark';
      setDark(!isDark);
      const updated = await updatePreferences(user.id, { theme: newTheme });
      setPrefs(updated);
    } catch (e: unknown) {
      Alert.alert('Could not update theme', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const onRefresh = () => { setRefreshing(true); load(); };

  const displayName = profile?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'Climber';
  const initials = (profile?.full_name ?? displayName).split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const apeIndex = profile?.wingspan && profile?.height ? Math.round((profile.wingspan - profile.height) * 10) / 10 : null;

  const styles = useMemo(() => makeStyles(C), [C]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar style="auto" />
        <View style={styles.loadingCenter}><ActivityIndicator size="large" color={C.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="auto" />

      <AddGoalModal visible={showAddGoal} onClose={() => setShowAddGoal(false)} onSave={handleAddGoal} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {/* ── User Header ──────────────────────────────────────────────────── */}
        <View style={[styles.userCard, { backgroundColor: C.primaryBg, borderColor: C.primaryBorder }]}>
          <View style={styles.userTop}>
            <View style={[styles.avatarLarge, { backgroundColor: C.primaryBg, borderColor: C.primary }]}>
              <Text style={[styles.avatarText, { color: C.primary }]}>{initials || '?'}</Text>
            </View>
            {editing ? (
              <View style={styles.editActions}>
                <TouchableOpacity style={[styles.cancelBtn, { borderColor: C.border }]} onPress={() => setEditing(false)}>
                  <Text style={[styles.cancelBtnText, { color: C.textSub }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveProfileBtn, { backgroundColor: C.primary }, saving && { opacity: 0.6 }]} onPress={saveProfile} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveProfileBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={[styles.editBtn, { backgroundColor: C.primaryBg, borderColor: C.primaryBorder }]} onPress={startEditing} activeOpacity={0.7}>
                <Ionicons name="pencil-outline" size={15} color={C.primary} />
                <Text style={[styles.editText, { color: C.primary }]}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
          {editing ? (
            <TextInput style={[styles.nameInput, { color: C.text, borderBottomColor: C.primary }]} value={editName} onChangeText={setEditName} placeholder="Your name" placeholderTextColor={C.textMuted} />
          ) : (
            <Text style={[styles.userName, { color: C.text }]}>{profile?.full_name ?? displayName}</Text>
          )}
          <Text style={[styles.userEmail, { color: C.textSub }]}>{user?.email}</Text>
          <View style={[styles.userStats, { borderTopColor: C.primaryBorder }]}>
            {[
              { value: currentGrade ?? '—', label: 'Best Grade' },
              { value: String(sessionCount), label: 'Sessions' },
              {
                value: profile?.climbing_since
                  ? `${profile.climbing_since}`
                  : user?.created_at
                  ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                  : '—',
                label: 'Since',
              },
            ].map((stat, i) => (
              <React.Fragment key={stat.label}>
                {i > 0 && <View style={[styles.userStatDivider, { backgroundColor: C.primaryBorder }]} />}
                <View style={styles.userStat}>
                  <Text style={[styles.userStatValue, { color: C.text }]}>{stat.value}</Text>
                  <Text style={[styles.userStatLabel, { color: C.textSub }]}>{stat.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* ── Goals Manager ────────────────────────────────────────────────── */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionLabel, { color: C.text }]}>Goals</Text>
          <TouchableOpacity
            style={[styles.addGoalBtn, { backgroundColor: C.primaryBg, borderColor: C.primaryBorder }]}
            onPress={() => setShowAddGoal(true)}
          >
            <Ionicons name="add" size={14} color={C.primary} />
            <Text style={[styles.addGoalText, { color: C.primary }]}>Add Goal</Text>
          </TouchableOpacity>
        </View>
        {goals.length > 0 ? (
          goals.map((g) => (
            <GoalCard key={g.id} goal={g} onDelete={() => handleDeleteGoal(g.id)} />
          ))
        ) : (
          <View style={[styles.emptyGoals, { backgroundColor: C.card, borderColor: C.border }]}>
            <Ionicons name="flag-outline" size={26} color={C.textMuted} />
            <Text style={[styles.emptyGoalsTitle, { color: C.text }]}>No goals set</Text>
            <Text style={[styles.emptyGoalsSub, { color: C.textSub }]}>
              Tap "Add Goal" to set a bouldering, top rope, or strength target.
            </Text>
          </View>
        )}

        <View style={styles.mb20} />

        {/* ── Body Metrics ─────────────────────────────────────────────────── */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionLabel, { color: C.text }]}>Body Metrics ({units === 'imperial' ? 'Imperial' : 'Metric'})</Text>
          {!editing && (
            <TouchableOpacity onPress={startEditing}>
              <Text style={[styles.sectionAction, { color: C.primary }]}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={[styles.metricsCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <MetricRow label={units === 'imperial' ? 'Height (ft)' : 'Height (cm)'} value={(() => { const d = displayHeight(profile?.height, units); return d.value + (d.unit ? ' ' + d.unit : ''); })()} editing={editing} inputValue={editHeight} onChangeText={setEditHeight} placeholder={heightPlaceholder(units)} />
          <MetricRow label={units === 'imperial' ? 'Weight (lbs)' : 'Weight (kg)'} value={(() => { const d = displayWeight(profile?.weight, units); return d.value + (d.value !== '—' ? ' ' + d.unit : ''); })()} editing={editing} inputValue={editWeight} onChangeText={setEditWeight} placeholder={weightPlaceholder(units)} keyboardType="numeric" />
          <MetricRow label={units === 'imperial' ? 'Wingspan (ft)' : 'Wingspan (cm)'} value={(() => { const d = displayHeight(profile?.wingspan, units); return d.value + (d.unit ? ' ' + d.unit : ''); })()} editing={editing} inputValue={editWingspan} onChangeText={setEditWingspan} placeholder={heightPlaceholder(units)} />
          <MetricRow label="Home Gym" value={profile?.home_gym ?? ''} editing={editing} inputValue={editHomeGym} onChangeText={setEditHomeGym} placeholder="Gym name" />
          {apeIndex !== null && (
            <View style={styles.apeNote}>
              <Ionicons name="information-circle-outline" size={13} color={C.textMuted} />
              <Text style={[styles.apeNoteText, { color: C.textMuted }]}>
                Ape index: {apeIndex > 0 ? '+' : ''}{apeIndex} cm
                {apeIndex > 0 ? ' (positive — favorable)' : ''}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.mb20} />

        {/* ── Preferences ──────────────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: C.text, marginBottom: 10 }]}>Preferences</Text>
        <View style={[styles.settingsCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <SettingsRow icon="notifications-outline" label="Notifications" value={prefs?.notifications_enabled ? 'On' : 'Off'} onPress={toggleNotifications} />
          <SettingsRow icon="swap-horizontal-outline" label="Units" value={units === 'metric' ? 'Metric' : 'Imperial'} onPress={toggleUnits} />
          <SettingsRow
            icon={isDark ? 'moon-outline' : 'sunny-outline'}
            label="Appearance"
            onPress={toggleTheme}
            right={
              <View style={[styles.themeToggle, { backgroundColor: isDark ? C.surface : C.border }]}>
                <View style={[styles.themeThumb, { transform: [{ translateX: isDark ? 0 : 22 }], backgroundColor: isDark ? C.textSub : C.primary }]} />
              </View>
            }
          />
        </View>

        <View style={styles.mb20} />

        {/* ── Account ──────────────────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: C.text, marginBottom: 10 }]}>Account</Text>
        <View style={[styles.settingsCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <SettingsRow icon="shield-checkmark-outline" label="Privacy Settings" />
          <SettingsRow icon="download-outline" label="Export My Data" />
          <SettingsRow icon="information-circle-outline" label="About ClimbSmart" value="v3.0" />
          <SettingsRow icon="log-out-outline" label="Sign Out" destructive onPress={handleSignOut} />
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: C.textMuted }]}>ClimbSmart · Stage 3</Text>
          <Text style={[styles.footerSub, { color: C.textMuted }]}>Built for climbers who train with intention</Text>
        </View>
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
    mb20: { marginBottom: 20 },

    userCard: { borderRadius: R.xl, padding: 20, marginBottom: 24, borderWidth: 1 },
    userTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    avatarLarge: { width: 64, height: 64, borderRadius: 32, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: F.lg, fontWeight: '800' },
    editActions: { flexDirection: 'row', gap: 8 },
    cancelBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.full, borderWidth: 1 },
    cancelBtnText: { fontSize: F.xs, fontWeight: '600' },
    saveProfileBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.full, minWidth: 60, alignItems: 'center' },
    saveProfileBtnText: { fontSize: F.xs, color: '#fff', fontWeight: '700' },
    editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.full, borderWidth: 1 },
    editText: { fontSize: F.xs, fontWeight: '700' },
    nameInput: { fontSize: F.xl, fontWeight: '800', borderBottomWidth: 2, paddingBottom: 4, marginBottom: 6 },
    userName: { fontSize: F.xl, fontWeight: '800' },
    userEmail: { fontSize: F.sm, marginTop: 2, marginBottom: 16 },
    userStats: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 14 },
    userStat: { flex: 1, alignItems: 'center' },
    userStatValue: { fontSize: F.md, fontWeight: '800' },
    userStatLabel: { fontSize: F.xs, marginTop: 2 },
    userStatDivider: { width: 1 },

    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    sectionLabel: { fontSize: F.base, fontWeight: '700' },
    sectionAction: { fontSize: F.sm, fontWeight: '600' },

    addGoalBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.full, borderWidth: 1 },
    addGoalText: { fontSize: F.xs, fontWeight: '700' },

    emptyGoals: { borderRadius: R.lg, padding: 24, borderWidth: 1, alignItems: 'center', gap: 8, marginBottom: 4 },
    emptyGoalsTitle: { fontSize: F.base, fontWeight: '700' },
    emptyGoalsSub: { fontSize: F.sm, textAlign: 'center' },

    metricsCard: { borderRadius: R.lg, paddingHorizontal: 16, borderWidth: 1 },
    apeNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, paddingTop: 10, paddingBottom: 4 },
    apeNoteText: { fontSize: F.xs, flex: 1, lineHeight: 16 },

    settingsCard: { borderRadius: R.lg, borderWidth: 1, overflow: 'hidden' },

    themeToggle: { width: 44, height: 24, borderRadius: 12, padding: 2, justifyContent: 'center', marginRight: 8 },
    themeThumb: { width: 20, height: 20, borderRadius: 10 },

    footer: { alignItems: 'center', paddingBottom: 8, gap: 4, marginTop: 16 },
    footerText: { fontSize: F.xs, fontWeight: '600' },
    footerSub: { fontSize: F.xs },
  });
}
