import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../lib/supabase';
import { Colors, FontSizes, Spacing } from '../constants/colors';

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const [mode, setMode] = useState<'landing' | 'email'>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(true);
  const [loading, setLoading] = useState(false);

  const redirectUri = makeRedirectUri({ scheme: 'youvolution' });

  const signInWithGoogle = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUri },
    });
    if (error) Alert.alert('Error', error.message);
    if (data?.url) await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
    setLoading(false);
  };

  const signInWithApple = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: redirectUri },
    });
    if (error) Alert.alert('Error', error.message);
    if (data?.url) await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
    setLoading(false);
  };

  const handleEmail = async () => {
    if (!email || !password) return Alert.alert('Please fill in all fields');
    setLoading(true);
    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('Error', error.message);
    else if (isSignUp) Alert.alert('Check your email', 'We sent you a confirmation link.');
    setLoading(false);
  };

  if (mode === 'email') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.inner}>
          <TouchableOpacity onPress={() => setMode('landing')} style={styles.back}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{isSignUp ? 'Create Account' : 'Welcome back'}</Text>
          <TextInput
            style={styles.input}
            placeholder="Email address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor={Colors.textMuted}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={Colors.textMuted}
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleEmail} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
            <Text style={styles.switchText}>
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.logo}>YOUvolution</Text>
        <Text style={styles.tagline}>Your health. Evolving daily.</Text>
        <Text style={styles.subtitle}>
          A wellness coach that remembers you, meets you where you are, and grows with you — without the guilt trips.
        </Text>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.socialBtn} onPress={signInWithApple} disabled={loading}>
          <Text style={styles.socialBtnText}> Continue with Apple</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.socialBtn, styles.googleBtn]} onPress={signInWithGoogle} disabled={loading}>
          <Text style={[styles.socialBtnText, { color: Colors.text }]}> Continue with Google</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.emailBtn} onPress={() => { setIsSignUp(true); setMode('email'); }}>
          <Text style={styles.emailBtnText}>Sign Up with Email</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setIsSignUp(false); setMode('email'); }}>
          <Text style={styles.signInText}>Already have an account? Sign in</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Not medical advice. Always consult your doctor for health concerns.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },
  inner: { flex: 1, padding: Spacing.lg, justifyContent: 'center' },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 80,
  },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -1,
    marginBottom: Spacing.sm,
  },
  tagline: {
    fontSize: FontSizes.lg,
    color: 'rgba(255,255,255,0.85)',
    fontStyle: 'italic',
    marginBottom: Spacing.lg,
  },
  subtitle: {
    fontSize: FontSizes.base,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 24,
  },
  buttons: {
    padding: Spacing.lg,
    paddingBottom: 40,
    gap: Spacing.sm,
  },
  socialBtn: {
    backgroundColor: Colors.black,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  googleBtn: {
    backgroundColor: Colors.white,
  },
  socialBtnText: {
    color: Colors.white,
    fontSize: FontSizes.base,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  dividerText: { color: 'rgba(255,255,255,0.7)', fontSize: FontSizes.sm },
  emailBtn: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  emailBtnText: { color: Colors.white, fontSize: FontSizes.base, fontWeight: '600' },
  signInText: {
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
  },
  disclaimer: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: FontSizes.xs,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  back: { marginBottom: Spacing.lg },
  backText: { color: Colors.primary, fontSize: FontSizes.base },
  title: { fontSize: FontSizes['2xl'], fontWeight: '700', color: Colors.text, marginBottom: Spacing.lg },
  input: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 12,
    padding: 16,
    fontSize: FontSizes.base,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  primaryBtnText: { color: Colors.white, fontSize: FontSizes.base, fontWeight: '600' },
  switchText: { color: Colors.primary, textAlign: 'center', marginTop: Spacing.md, fontSize: FontSizes.sm },
});
