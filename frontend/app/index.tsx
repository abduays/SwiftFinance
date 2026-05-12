import { useEffect } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View, Platform } from "react-native";
import * as Linking from "expo-linking";
import { COLORS, SPACING } from "../src/theme";
import { useAuth } from "../src/auth";
import { useAppStore } from "../src/store";

export default function Index() {
  const router = useRouter();
  const { user, loading, googleSession } = useAuth();
  const onboarded = useAppStore((s) => s.onboarded);

  // Handle Google session_id arriving via deep-link or web hash
  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url) return;
      // session_id may arrive as #session_id=... or ?session_id=...
      const m = url.match(/[#?&]session_id=([^&]+)/);
      if (m && m[1]) {
        try {
          await googleSession(decodeURIComponent(m[1]));
          // clean URL on web
          if (Platform.OS === "web" && typeof window !== "undefined") {
            window.history.replaceState({}, "", window.location.pathname);
          }
        } catch (e) {
          console.warn("google session failed", e);
        }
      }
    };

    if (Platform.OS === "web" && typeof window !== "undefined") {
      handleUrl(window.location.href);
    } else {
      Linking.getInitialURL().then(handleUrl);
    }
    const sub = Linking.addEventListener("url", (e) => handleUrl(e.url));
    return () => sub.remove();
  }, [googleSession]);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      if (!user) router.replace("/auth");
      else if (!onboarded) router.replace("/onboarding");
      else router.replace("/dashboard");
    }, 600);
    return () => clearTimeout(t);
  }, [user, loading, onboarded, router]);

  return (
    <View style={styles.container} testID="splash">
      <View style={styles.logo}>
        <Text style={styles.brand}>Leak</Text>
        <Text style={styles.brandAccent}>Stop</Text>
      </View>
      <Text style={styles.tagline}>Stop the leak. Start the wealth.</Text>
      <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.lg }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: { flexDirection: "row", alignItems: "baseline" },
  brand: { color: COLORS.text_primary, fontSize: 44, fontWeight: "800", letterSpacing: -2 },
  brandAccent: { color: COLORS.primary, fontSize: 44, fontWeight: "800", letterSpacing: -2 },
  tagline: { color: COLORS.text_secondary, marginTop: SPACING.sm, fontSize: 14 },
});
