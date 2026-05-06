import React, { useCallback, useEffect, useRef, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { C, F, R, S } from '@/constants/Theme';
import Card from '@/components/ui/Card';
import SectionHeader from '@/components/ui/SectionHeader';
import { upsertProfile, getProfile, getPreferences, updatePreferences } from '@/services/profile';
import { getActiveGoal, upsertGoal } from '@/services/goals';
import { getClimbingSessions } from '@/services/climbing';
import type { Profile, Goal, UserPreferences } from '@/types';
import { maxGradeFromAttempts } from '@/utils/grades';
import { formatDate } from '@/services/strength';
import { DISPLAY_GRADES } from '@/utils/grades';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricRow({
  label,
  value,
  editing,
  inputValue,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  sub,
}: {
  label: string;
  value: string;
  editing: boolean;
  inputValue: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  sub?: string;
}) {
  return (
    <View style={mrStyles.row}>
      <Text style={mrStyles.label}>{label}</Text>
      <View style={mrStyles.right}>
        {editing ? (
          <TextInput
            style={mrStyles.input}
            value={inputValue}
            onChangeText={onChangeText}
            placeholder={placeholder ?? label}
            placeholderTextColor={C.textMuted}
            keyboardType={keyboardType}
          />
        ) : (
          <>
            <Text style={mrStyles.value}>{value || '—'}</Text>
            {sub ? <Text style={mrStyles.sub}>{sub}</Text> : null}
          </>
        )}
      </View>
    </View>
  );
}
const mrStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  label: { fontSize: F.sm, color: C.textSub },
  right: { alignItems: 'flex-end', flex: 1 },
  value: { fontSize: F.sm, fontWeight: '700', color: C.text, textAlign: 'right' },
  sub: { fontSize: F.xs, color: C.textMuted, marginTop: 1 },
  input: {
    color: C.text,
    fontSize: F.sm,
    fontWeight: '600',
    borderBottomWidth: 1,
    borderBottomColor: C.primary,
    minWidth: 100,
    textAlign: 'right',
    paddingVertical: 2,
  },
});

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  destructive,
}: {
  icon: IoniconName;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
}) {
  return (
    <TouchableOpacity style={srStyles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[srStyles.iconWrap, { backgroundColor: destructive ? C.warningBg : C.surface }]}>
        <Ionicons name={icon} size={16} color={destructive ? C.warning : C.textSub} />
      </View>
      <Text style={[srStyles.label, destructive && { color: C.warning }]}>{label}</Text>
      <View style={srStyles.right}>
        {value ? <Text style={srStyles.value}>{value}</Text> : null}
        <Ionicons name="chevron-forward" size={14} color={C.textMuted} />
      </View>
    </TouchableOpacity>
  );
}
const srStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: R.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, fontSize: F.sm, color: C.text, fontWeight: '500' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value: { fontSize: F.sm, color: C.textSub },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [currentGrade, setCurrentGrade] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editHeight, setEditHeight] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editWingspan, setEditWingspan] = useState('');
  const [editHomeGym, setEditHomeGym] = useState('');
  const [saving, setSaving] = useState(false);

  // Goal edit
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalGrade, setGoalGrade] = useState('V6');
  const [goalDate, setGoalDate] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [prof, g, p, sessions] = await Promise.all([
        getProfile(user.id),
        getActiveGoal(user.id),
        getPreferences(user.id),
        getClimbingSessions(user.id, 50),
      ]);
      setProfile(prof);
      setGoal(g);
      setPrefs(p);
      setSessionCount(sessions.length);
      const allAttempts = sessions.flatMap((s) => s.climbing_attempts ?? []);
      setCurrentGrade(maxGradeFromAttempts(allAttempts));
    } catch (e) {
      console.error('Profile load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startEditing = () => {
    if (!profile) return;
    setEditName(profile.full_name ?? '');
    setEditHeight(profile.height ? String(profile.height) : '');
    setEditWeight(profile.weight ? String(profile.weight) : '');
    setEditWingspan(profile.wingspan ? String(profile.wingspan) : '');
    setEditHomeGym(profile.home_gym ?? '');
    setEditing(true);
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await upsertProfile(user.id, {
        full_name: editName.trim() || null,
        height: editHeight ? parseFloat(editHeight) : null,
        weight: editWeight ? parseFloat(editWeight) : null,
        wingspan: editWingspan ? parseFloat(editWingspan) : null,
        home_gym: editHomeGym.trim() || null,
      });
      setProfile(updated);
      setEditing(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      Alert.alert('Save failed', msg);
    } finally {
      setSaving(false);
    }
  };

  const saveGoal = async () => {
    if (!user) return;
    setSavingGoal(true);
    try {
      const g = await upsertGoal(user.id, {
        target_grade: goalGrade,
        target_date: goalDate || null,
        discipline: 'bouldering',
        notes: null,
      });
      setGoal(g);
      setEditingGoal(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      Alert.alert('Save failed', msg);
    } finally {
      setSavingGoal(false);
    }
  };

  const toggleNotifications = async () => {
    if (!user) return;
    try {
      const updated = await updatePreferences(user.id, {
        notifications_enabled: !(prefs?.notifications_enabled ?? true),
      });
      setPrefs(updated);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      Alert.alert('Could not update preference', msg);
    }
  };

  const toggleUnits = async () => {
    if (!user) return;
    try {
      const newUnits = prefs?.units === 'metric' ? 'imperial' : 'metric';
      const updated = await updatePreferences(user.id, { units: newUnits });
      setPrefs(updated);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      Alert.alert('Could not update preference', msg);
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
  const initials = (profile?.full_name ?? displayName)
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const apeIndex =
    profile?.wingspan && profile?.height
      ? Math.round((profile.wingspan - profile.height) * 10) / 10
      : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={C.primary} />
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
      >
        {/* ── User Header ─────────────────────────────────────────────────── */}
        <Card variant="primary" style={styles.userCard}>
          <View style={styles.userTop}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarText}>{initials || '?'}</Text>
            </View>
            {editing ? (
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setEditing(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveProfileBtn, saving && { opacity: 0.6 }]}
                  onPress={saveProfile}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={C.white} />
                  ) : (
                    <Text style={styles.saveProfileBtnText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.editBtn} onPress={startEditing} activeOpacity={0.7}>
                <Ionicons name="pencil-outline" size={15} color={C.primary} />
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
          {editing ? (
            <TextInput
              style={styles.nameInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={C.textMuted}
            />
          ) : (
            <Text style={styles.userName}>{profile?.full_name ?? displayName}</Text>
          )}
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={styles.userStats}>
            <View style={styles.userStat}>
              <Text style={styles.userStatValue}>{currentGrade ?? '—'}</Text>
              <Text style={styles.userStatLabel}>Best Grade</Text>
            </View>
            <View style={styles.userStatDivider} />
            <View style={styles.userStat}>
              <Text style={styles.userStatValue}>{sessionCount}</Text>
              <Text style={styles.userStatLabel}>Sessions</Text>
            </View>
            <View style={styles.userStatDivider} />
            <View style={styles.userStat}>
              <Text style={styles.userStatValue}>
                {profile?.climbing_since ?? '—'}
              </Text>
              <Text style={styles.userStatLabel}>Since</Text>
            </View>
          </View>
        </Card>

        {/* ── Body Metrics ─────────────────────────────────────────────────── */}
        <SectionHeader title="Body Metrics" action={editing ? undefined : 'Edit'} onAction={startEditing} />
        <Card style={styles.mb20}>
          <MetricRow
            label="Height (cm)"
            value={profile?.height ? `${profile.height} cm` : '—'}
            editing={editing}
            inputValue={editHeight}
            onChangeText={setEditHeight}
            placeholder="180"
            keyboardType="numeric"
          />
          <MetricRow
            label="Weight (kg)"
            value={profile?.weight ? `${profile.weight} kg` : '—'}
            editing={editing}
            inputValue={editWeight}
            onChangeText={setEditWeight}
            placeholder="75"
            keyboardType="numeric"
          />
          <MetricRow
            label="Wingspan (cm)"
            value={profile?.wingspan ? `${profile.wingspan} cm` : '—'}
            editing={editing}
            inputValue={editWingspan}
            onChangeText={setEditWingspan}
            placeholder="185"
            keyboardType="numeric"
          />
          <MetricRow
            label="Home Gym"
            value={profile?.home_gym ?? ''}
            editing={editing}
            inputValue={editHomeGym}
            onChangeText={setEditHomeGym}
            placeholder="Gym name"
          />
          {apeIndex !== null && (
            <View style={styles.apeNote}>
              <Ionicons name="information-circle-outline" size={13} color={C.textMuted} />
              <Text style={styles.apeNoteText}>
                Ape index: {apeIndex > 0 ? '+' : ''}{apeIndex} cm
                {apeIndex > 0 ? ' (positive — favorable)' : ' (neutral)'}
              </Text>
            </View>
          )}
        </Card>

        {/* ── Climbing Goal ────────────────────────────────────────────────── */}
        <SectionHeader
          title="Climbing Goal"
          action={editingGoal ? undefined : goal ? 'Edit' : 'Set Goal'}
          onAction={() => {
            setGoalGrade(goal?.target_grade ?? 'V6');
            setGoalDate(goal?.target_date ?? '');
            setEditingGoal(true);
          }}
        />
        {editingGoal ? (
          <Card style={styles.mb20}>
            <Text style={styles.goalEditLabel}>Target Grade</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.gradeScroll}
            >
              {DISPLAY_GRADES.map((g) => {
                const active = g === goalGrade;
                const color = active ? C.primary : C.textMuted;
                return (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.gradePill,
                      {
                        backgroundColor: active ? C.primaryBg : C.surface,
                        borderColor: active ? C.primary : C.border,
                      },
                    ]}
                    onPress={() => setGoalGrade(g)}
                  >
                    <Text style={[styles.gradePillText, { color }]}>{g}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Text style={[styles.goalEditLabel, { marginTop: 12 }]}>Target Date (optional)</Text>
            <TextInput
              style={styles.goalDateInput}
              value={goalDate}
              onChangeText={setGoalDate}
              placeholder="YYYY-MM-DD  e.g. 2026-06-01"
              placeholderTextColor={C.textMuted}
            />
            <View style={styles.goalBtns}>
              <TouchableOpacity
                style={styles.goalCancelBtn}
                onPress={() => setEditingGoal(false)}
              >
                <Text style={styles.goalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.goalSaveBtn, savingGoal && { opacity: 0.6 }]}
                onPress={saveGoal}
                disabled={savingGoal}
              >
                {savingGoal ? (
                  <ActivityIndicator size="small" color={C.white} />
                ) : (
                  <Text style={styles.goalSaveText}>Save Goal</Text>
                )}
              </TouchableOpacity>
            </View>
          </Card>
        ) : goal ? (
          <Card style={styles.mb20}>
            <View style={styles.goalDisplayRow}>
              <View style={[styles.goalGradeBox, { backgroundColor: C.primaryBg }]}>
                <Text style={styles.goalGradeText}>{goal.target_grade}</Text>
              </View>
              <View style={styles.goalDetails}>
                <Text style={styles.goalDetailTitle}>Send {goal.target_grade}</Text>
                <Text style={styles.goalDetailSub}>
                  {goal.target_date
                    ? `Due ${new Date(goal.target_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
                    : 'No deadline set'}
                </Text>
                <Text style={styles.goalDetailSub}>
                  {goal.discipline.charAt(0).toUpperCase() + goal.discipline.slice(1)}
                </Text>
              </View>
            </View>
          </Card>
        ) : (
          <Card style={styles.mb20}>
            <TouchableOpacity
              style={styles.setGoalBtn}
              onPress={() => {
                setGoalGrade('V6');
                setGoalDate('');
                setEditingGoal(true);
              }}
            >
              <Ionicons name="add-circle-outline" size={20} color={C.primary} />
              <Text style={styles.setGoalText}>Set your target grade</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* ── Preferences ──────────────────────────────────────────────────── */}
        <SectionHeader title="Preferences" />
        <Card noPadding style={[styles.settingsCard, styles.mb20]}>
          <SettingsRow
            icon="notifications-outline"
            label="Notifications"
            value={prefs?.notifications_enabled ? 'On' : 'Off'}
            onPress={toggleNotifications}
          />
          <SettingsRow
            icon="swap-horizontal-outline"
            label="Units"
            value={prefs?.units === 'metric' ? 'Metric' : 'Imperial'}
            onPress={toggleUnits}
          />
          <SettingsRow icon="color-palette-outline" label="Appearance" value="Dark" />
        </Card>

        {/* ── Account ──────────────────────────────────────────────────────── */}
        <SectionHeader title="Account" />
        <Card noPadding style={[styles.settingsCard, styles.mb20]}>
          <SettingsRow icon="shield-checkmark-outline" label="Privacy Settings" />
          <SettingsRow icon="download-outline" label="Export My Data" />
          <SettingsRow icon="information-circle-outline" label="About ClimbSmart" value="v2.0" />
          <SettingsRow icon="log-out-outline" label="Sign Out" destructive onPress={handleSignOut} />
        </Card>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>ClimbSmart · Stage 2</Text>
          <Text style={styles.footerSub}>Built for climbers who train with intention</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: 100 },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mb20: { marginBottom: 20 },

  userCard: { marginBottom: 24 },
  userTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.primaryBg,
    borderWidth: 2.5,
    borderColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: F.lg, fontWeight: '800', color: C.primary },
  editActions: { flexDirection: 'row', gap: 8 },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: R.full,
    borderWidth: 1,
    borderColor: C.border,
  },
  cancelBtnText: { fontSize: F.xs, color: C.textSub, fontWeight: '600' },
  saveProfileBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: R.full,
    backgroundColor: C.primary,
    minWidth: 60,
    alignItems: 'center',
  },
  saveProfileBtnText: { fontSize: F.xs, color: C.white, fontWeight: '700' },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: R.full,
    backgroundColor: C.primaryBg,
    borderWidth: 1,
    borderColor: C.primaryBorder,
  },
  editText: { fontSize: F.xs, color: C.primary, fontWeight: '700' },
  nameInput: {
    fontSize: F.xl,
    fontWeight: '800',
    color: C.text,
    borderBottomWidth: 2,
    borderBottomColor: C.primary,
    paddingBottom: 4,
    marginBottom: 6,
  },
  userName: { fontSize: F.xl, fontWeight: '800', color: C.text },
  userEmail: { fontSize: F.sm, color: C.textSub, marginTop: 2, marginBottom: 16 },
  userStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: C.primaryBorder,
    paddingTop: 14,
  },
  userStat: { flex: 1, alignItems: 'center' },
  userStatValue: { fontSize: F.md, fontWeight: '800', color: C.text },
  userStatLabel: { fontSize: F.xs, color: C.textSub, marginTop: 2 },
  userStatDivider: { width: 1, backgroundColor: C.primaryBorder },

  apeNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    paddingTop: 10,
  },
  apeNoteText: { fontSize: F.xs, color: C.textMuted, flex: 1, lineHeight: 16 },

  // Goal display
  goalDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  goalGradeBox: {
    width: 56,
    height: 56,
    borderRadius: R.md,
    borderWidth: 1.5,
    borderColor: C.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalGradeText: { fontSize: F.xl, fontWeight: '800', color: C.primary },
  goalDetails: { flex: 1 },
  goalDetailTitle: { fontSize: F.base, fontWeight: '700', color: C.text },
  goalDetailSub: { fontSize: F.xs, color: C.textSub, marginTop: 3 },

  // Goal editing
  goalEditLabel: { fontSize: F.xs, color: C.textSub, fontWeight: '600', marginBottom: 10 },
  gradeScroll: { gap: 8, paddingBottom: 4 },
  gradePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: R.full,
    borderWidth: 1.5,
  },
  gradePillText: { fontSize: F.sm, fontWeight: '800' },
  goalDateInput: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    padding: 12,
    color: C.text,
    fontSize: F.base,
  },
  goalBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },
  goalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  goalCancelText: { fontSize: F.sm, color: C.textSub, fontWeight: '600' },
  goalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: R.md,
    backgroundColor: C.primary,
    alignItems: 'center',
  },
  goalSaveText: { fontSize: F.sm, color: C.white, fontWeight: '700' },

  setGoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  setGoalText: { fontSize: F.base, color: C.primary, fontWeight: '600' },

  settingsCard: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 0 },

  footer: { alignItems: 'center', paddingBottom: 8, gap: 4, marginTop: 8 },
  footerText: { fontSize: F.xs, color: C.textMuted, fontWeight: '600' },
  footerSub: { fontSize: F.xs, color: C.textMuted },
});
