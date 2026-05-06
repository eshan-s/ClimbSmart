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
import { useEffect } from 'react';
import { C, F, R, S } from '@/constants/Theme';

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
          ? 'Please confirm your email first.\n\n💡 To skip confirmation in dev: Supabase Dashboard → Auth → Providers → Email → disable "Confirm email".'
          : error.message
      );
    } else {
      // Ensure profile rows exist after login (handles users who signed up
      // before profile creation was added, or confirmed email externally)
      ensureProfile().catch(console.warn);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoSection}>
            <View style={styles.logoIcon}>
              <Ionicons name="flag" size={36} color={C.primary} />
            </View>
            <Text style={styles.appName}>ClimbSmart</Text>
            <Text style={styles.appTagline}>Train with intention</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSub}>Sign in to continue your training</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={16} color={C.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={C.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={16} color={C.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Your password"
                  placeholderTextColor={C.textMuted}
                  secureTextEntry={!showPass}
                  autoComplete="password"
                  returnKeyType="done"
                  onSubmitEditing={handleSignIn}
                />
                <TouchableOpacity onPress={() => setShowPass((v) => !v)} style={styles.eyeBtn}>
                  <Ionicons
                    name={showPass ? 'eye-off-outline' : 'eye-outline'}
                    size={16}
                    color={C.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
              onPress={handleSignIn}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={C.white} size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
              <Text style={styles.footerLink}>Create one</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: {
    flexGrow: 1,
    paddingHorizontal: S.md,
    justifyContent: 'center',
    paddingVertical: S.xl,
  },

  // Logo
  logoSection: { alignItems: 'center', marginBottom: 40 },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: C.primaryBg,
    borderWidth: 2,
    borderColor: C.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  appName: { fontSize: F.xxl, fontWeight: '800', color: C.text, letterSpacing: 0.5 },
  appTagline: { fontSize: F.sm, color: C.textSub, marginTop: 4 },

  // Card
  card: {
    backgroundColor: C.card,
    borderRadius: R.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 20,
  },
  cardTitle: { fontSize: F.xl, fontWeight: '800', color: C.text, marginBottom: 6 },
  cardSub: { fontSize: F.sm, color: C.textSub, marginBottom: 24 },

  // Fields
  field: { marginBottom: 16 },
  label: { fontSize: F.xs, color: C.textSub, fontWeight: '600', marginBottom: 6, letterSpacing: 0.3 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: 14,
    height: 50,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    color: C.text,
    fontSize: F.base,
  },
  eyeBtn: { padding: 4 },

  // Buttons
  primaryBtn: {
    backgroundColor: C.primary,
    borderRadius: R.md,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: C.white, fontSize: F.base, fontWeight: '700' },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: { fontSize: F.sm, color: C.textSub },
  footerLink: { fontSize: F.sm, color: C.primary, fontWeight: '700' },
});
