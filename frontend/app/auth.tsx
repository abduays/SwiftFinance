import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { COLORS, RADIUS, SPACING } from "../src/theme";
import { useAuth } from "../src/auth";

type Mode = "login" | "signup";

export default function AuthScreen() {
  const router = useRouter();
  const { login, register, googleSession } = useAuth();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email || !password || (mode === "signup" && !name)) {
      setError("Please fill all fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") await register(email, password, name);
      else await login(email, password);
      router.replace("/onboarding");
    } catch (e: any) {
      setError(e?.message ?? "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      const redirect =
        Platform.OS === "web"
          ? window.location.origin + "/"
          : Linking.createURL("/");

      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;

      if (Platform.OS === "web") {
        window.location.href = authUrl;
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirect);
      if (result.type === "success" && result.url) {
        const m = result.url.match(/[#?&]session_id=([^&]+)/);
        if (m && m[1]) {
          await googleSession(decodeURIComponent(m[1]));
          router.replace("/onboarding");
        } else {
          setError("Google sign-in returned no session.");
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <Text style={styles.brand}>
              Paisa<Text style={{ color: COLORS.primary }}>Bachao</Text>
            </Text>
          </View>
          <Text style={styles.eyebrow}>
            {mode === "signup" ? "CREATE ACCOUNT" : "SIGN IN"}
          </Text>
          <Text style={styles.title}>
            {mode === "signup" ? (
              <>
                Lock your <Text style={{ color: COLORS.primary }}>leakage report</Text> to your device.
              </>
            ) : (
              <>
                Welcome <Text style={{ color: COLORS.primary }}>back.</Text>
              </>
            )}
          </Text>
          <Text style={styles.sub}>
            {mode === "signup"
              ? "Your audits sync across devices. No spam ever."
              : "Sign in to see your saved leakage audits."}
          </Text>

          <TouchableOpacity
            testID="google-btn"
            style={styles.googleBtn}
            onPress={onGoogle}
            disabled={busy}
          >
            <Ionicons name="logo-google" size={18} color="#060B19" />
            <Text style={styles.googleText}>Continue with Google</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>OR EMAIL</Text>
            <View style={styles.line} />
          </View>

          {mode === "signup" && (
            <View style={styles.inputBox}>
              <Text style={styles.inputLabel}>NAME</Text>
              <TextInput
                testID="name-input"
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={COLORS.text_muted}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>EMAIL</Text>
            <TextInput
              testID="email-input"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.text_muted}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>PASSWORD</Text>
            <TextInput
              testID="password-input"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              placeholderTextColor={COLORS.text_muted}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          {error && (
            <Text style={styles.error} testID="auth-error">
              {error}
            </Text>
          )}

          <TouchableOpacity
            testID="auth-submit"
            style={styles.cta}
            onPress={submit}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#060B19" />
            ) : (
              <>
                <Text style={styles.ctaText}>
                  {mode === "signup" ? "Create account" : "Sign in"}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#060B19" />
              </>
            )}
          </TouchableOpacity>

          <Pressable
            onPress={() => {
              setError(null);
              setMode(mode === "signup" ? "login" : "signup");
            }}
            style={styles.swap}
            testID="swap-mode-btn"
          >
            <Text style={styles.swapText}>
              {mode === "signup"
                ? "Already have an account? Sign in"
                : "New here? Create an account"}
            </Text>
          </Pressable>

          <Text style={styles.footer}>
            By continuing you agree to PaisaBachao&apos;s Terms. Data stored encrypted.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: 60 },
  brandRow: { marginBottom: SPACING.xl },
  brand: { color: COLORS.text_primary, fontSize: 32, fontWeight: "800", letterSpacing: -1.5 },
  eyebrow: { color: COLORS.primary, fontSize: 11, letterSpacing: 1.6, fontWeight: "700" },
  title: {
    color: COLORS.text_primary,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -1,
    marginTop: 6,
    lineHeight: 34,
  },
  sub: { color: COLORS.text_secondary, marginTop: SPACING.sm, marginBottom: SPACING.lg, fontSize: 14 },
  googleBtn: {
    backgroundColor: "#FFF",
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  googleText: { color: "#060B19", fontWeight: "700", fontSize: 15 },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: SPACING.lg,
    gap: 10,
  },
  line: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.text_muted, fontSize: 10, letterSpacing: 1.6, fontWeight: "700" },
  inputBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  inputLabel: { color: COLORS.text_muted, fontSize: 10, letterSpacing: 1.2, fontWeight: "700" },
  input: {
    color: COLORS.text_primary,
    fontSize: 16,
    fontWeight: "600",
    paddingVertical: 6,
  },
  error: {
    color: COLORS.danger,
    fontSize: 13,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  cta: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 16,
    marginTop: SPACING.md,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  ctaText: { color: "#060B19", fontWeight: "800", fontSize: 16 },
  swap: { marginTop: SPACING.md, alignItems: "center" },
  swapText: { color: COLORS.primary, fontWeight: "700", fontSize: 13 },
  footer: { color: COLORS.text_muted, fontSize: 11, marginTop: SPACING.lg, textAlign: "center" },
});
