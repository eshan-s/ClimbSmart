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

// Signup always uses the dark brand baseline (matches login).
const BG = '#0A0A0F';
const SURFACE = '#121218';
const CARD = '#17171F';
const BORDER = '#2A2A38';
const BORDER_FOCUS = '#FF6535';
const TEXT = '#F0F0F8';
const TEXT_SUB = '#7E839E';
const TEXT_MUTED = '#4A4F6A';
const ORANGE = '#FF6535';
const ORANGE_DIM = '#FF653518';
const ORANGE_BORDER = '#FF653540';

export default function SignupScreen() {
  const { session, signUp } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  if (session) return <Redirect href="/(tabs)" />;

  const handleSignUp = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const { error, needsConfirmation } = await signUp(
      email.trim().toLowerCase(),
      password,
      fullName.trim()
    );
    setLoading(false);

    if (error) {
      Alert.alert('Sign up failed', error.message);
      return;
    }

    if (needsConfirmation) {
      // Email confirmation is enabled in Supabase — the user must click the link
      // before they can sign in.  In local dev, disable "Confirm email" in
      // Supabase Dashboard → Auth → Providers → Email to skip this.
      Alert.alert(
        'Check your email',
        'A confirmation link has been sent to ' +
          email.trim() +
          '.\n\nClick the link, then return here and sign in.\n\n' +
          '💡 Tip: In the Supabase dashboard → Auth → Providers → Email, you can ' +
          'disable "Confirm email" to skip this step during development.',
        [{ text: 'Go to Sign In', onPress: () => router.replace('/(auth)/login') }]
      );
    }
    // If needsConfirmation is false the session was set automatically and the
    // onAuthStateChange listener in AuthContext will redirect to (tabs).
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8 }}>
            <Ionicons name="arrow-back" size={20} color={TEXT} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoIcon}>
              <Ionicons name="flag" size={28} color={ORANGE} />
            </View>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.sub}>Start tracking your climbing progression</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={15} color={TEXT_MUTED} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Alex Johnson"
                  placeholderTextColor={TEXT_MUTED}
                  autoCapitalize="words"
                  autoComplete="name"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.field}>
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

            <View style={[styles.field, { marginBottom: 0 }]}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={15} color={TEXT_MUTED} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Min. 6 characters"
                  placeholderTextColor={TEXT_MUTED}
                  secureTextEntry={!showPass}
                  autoComplete="new-password"
                  returnKeyType="done"
                  onSubmitEditing={handleSignUp}
                />
                <TouchableOpacity onPress={() => setShowPass((v) => !v)} style={styles.eyeBtn} hitSlop={{ top: 8, bottom: 8 }}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={15} color={TEXT_MUTED} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
              onPress={handleSignUp}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.terms}>
              By creating an account you agree to our Terms of Service and Privacy Policy.
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')} hitSlop={{ top: 8, bottom: 8 }}>
              <Text style={styles.footerLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },

  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center', marginBottom: 28,
  },

  header: { alignItems: 'center', marginBottom: 32 },
  logoIcon: {
    width: 68, height: 68, borderRadius: 20,
    backgroundColor: ORANGE_DIM, borderWidth: 1.5, borderColor: ORANGE_BORDER,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: '800', color: TEXT },
  sub: { fontSize: 13, color: TEXT_MUTED, marginTop: 5, textAlign: 'center' },

  card: {
    backgroundColor: CARD, borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: BORDER, marginBottom: 20, gap: 16,
  },
  field: { gap: 7 },
  label: { fontSize: 11, color: TEXT_MUTED, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
    borderRadius: 12, paddingHorizontal: 14, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: TEXT, fontSize: 15, letterSpacing: 0.2 },
  eyeBtn: { paddingLeft: 8 },

  primaryBtn: {
    backgroundColor: ORANGE, borderRadius: 12, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12,
  },
  btnDisabled: { opacity: 0.55 },
  primaryBtnText: { color: '#000', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },

  terms: { fontSize: 11, color: TEXT_MUTED, textAlign: 'center', lineHeight: 16 },

  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { fontSize: 13, color: TEXT_MUTED },
  footerLink: { fontSize: 13, color: ORANGE, fontWeight: '700' },
});
