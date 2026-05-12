import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';

// Login always uses the dark brand baseline.
const BG = '#0A0A0F';
const SURFACE = '#121218';
const CARD = '#17171F';
const BORDER = '#2A2A38';
const TEXT = '#F0F0F8';
const TEXT_SUB = '#7E839E';
const TEXT_MUTED = '#4A4F6A';
const ORANGE = '#FF6535';
const ORANGE_DIM = '#FF653518';
const ORANGE_BORDER = '#FF653540';

export default function LoginScreen() {
  const { session, signIn, ensureProfile } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  if (session) return <Redirect href="/(tabs)" />;

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);
    if (error) {
      Alert.alert(
        'Sign in failed',
        error.message.includes('Email not confirmed')
          ? 'Please confirm your email first. Check your inbox for a verification link.'
          : error.message
      );
    } else {
      ensureProfile().catch(console.warn);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Brand mark ── */}
          <View style={styles.brandSection}>
            <View style={styles.logoWrap}>
              <Ionicons name="flag" size={28} color={ORANGE} />
            </View>
            <Text style={styles.appName}>ClimbSmart</Text>
            <Text style={styles.appTagline}>Train with intention</Text>
          </View>

          {/* ── Form card ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSub}>Sign in to continue your training</Text>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={15} color={TEXT_MUTED} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={TEXT_MUTED}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Password */}
            <View style={[styles.fieldGroup, { marginBottom: 0 }]}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={15} color={TEXT_MUTED} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Your password"
                  placeholderTextColor={TEXT_MUTED}
                  secureTextEntry={!showPass}
                  autoComplete="password"
                  returnKeyType="done"
                  onSubmitEditing={handleSignIn}
                />
                <TouchableOpacity
                  onPress={() => setShowPass((v) => !v)}
                  style={styles.eyeBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showPass ? 'eye-off-outline' : 'eye-outline'}
                    size={15}
                    color={TEXT_MUTED}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign in button */}
            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
              onPress={handleSignIn}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Footer ── */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity
              onPress={() => router.push('/(auth)/signup')}
              hitSlop={{ top: 8, bottom: 8 }}
            >
              <Text style={styles.footerLink}>Create one</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingVertical: 40,
  },

  // Brand
  brandSection: { alignItems: 'center', marginBottom: 40 },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: ORANGE_DIM,
    borderWidth: 1.5,
    borderColor: ORANGE_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  appName: { fontSize: 28, fontWeight: '800', color: TEXT, letterSpacing: 0.3, marginBottom: 6 },
  appTagline: { fontSize: 13, color: TEXT_MUTED, letterSpacing: 0.4 },

  // Card
  card: {
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 20,
    gap: 16,
  },
  cardTitle: { fontSize: 20, fontWeight: '800', color: TEXT, marginBottom: -4 },
  cardSub: { fontSize: 13, color: TEXT_SUB, marginBottom: 4 },

  // Fields — no shadow, no dynamic styles that trigger re-render on focus
  fieldGroup: { gap: 7, marginBottom: 4 },
  label: {
    fontSize: 11,
    color: TEXT_MUTED,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: TEXT, fontSize: 15, letterSpacing: 0.2 },
  eyeBtn: { paddingLeft: 8 },

  // Button
  primaryBtn: {
    backgroundColor: ORANGE,
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.55 },
  primaryBtnText: { color: '#000', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },

  // Footer
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { fontSize: 13, color: TEXT_MUTED },
  footerLink: { fontSize: 13, color: ORANGE, fontWeight: '700' },
});
