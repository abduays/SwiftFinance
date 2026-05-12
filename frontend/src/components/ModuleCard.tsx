import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS, RADIUS, SPACING } from "../theme";

export default function ModuleCard({
  testID,
  icon,
  badge,
  title,
  description,
  metric,
  metricLabel,
  metricColor = COLORS.primary,
  to,
}: {
  testID: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge: string;
  title: string;
  description: string;
  metric: string;
  metricLabel: string;
  metricColor?: string;
  to: string;
}) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(to as any)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      testID={testID}
    >
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={20} color={COLORS.primary} />
        </View>
        <Text style={styles.badge}>{badge}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.desc}>{description}</Text>

      <View style={styles.row}>
        <View>
          <Text style={styles.metricLabel}>{metricLabel}</Text>
          <Text style={[styles.metric, { color: metricColor }]}>{metric}</Text>
        </View>
        <View style={styles.arrow}>
          <Ionicons name="arrow-forward" size={18} color={COLORS.text_primary} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(16,185,129,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    fontSize: 10,
    color: COLORS.text_muted,
    letterSpacing: 1.4,
    fontWeight: "700",
  },
  title: { color: COLORS.text_primary, fontSize: 20, fontWeight: "700", letterSpacing: -0.4 },
  desc: { color: COLORS.text_secondary, fontSize: 13, marginTop: SPACING.xs, lineHeight: 18 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: SPACING.md,
  },
  metricLabel: { color: COLORS.text_muted, fontSize: 10, letterSpacing: 1, fontWeight: "700" },
  metric: { fontSize: 22, fontWeight: "800", marginTop: 2, letterSpacing: -0.5 },
  arrow: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface_highlight,
    alignItems: "center",
    justifyContent: "center",
  },
});
