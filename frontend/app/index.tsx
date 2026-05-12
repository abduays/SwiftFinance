import { useEffect } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { COLORS, SPACING } from "../src/theme";
import { useAppStore } from "../src/store";

export default function Index() {
  const router = useRouter();
  const onboarded = useAppStore((s) => s.onboarded);

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace(onboarded ? "/dashboard" : "/onboarding");
    }, 700);
    return () => clearTimeout(t);
  }, [onboarded, router]);

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
