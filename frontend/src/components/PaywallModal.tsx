import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, RADIUS, SPACING } from "../theme";

const FEATURES = [
  "Detailed Loan Switch Plan PDF",
  "Personalised Credit-Card portfolio",
  "Tax filing helper (FY 2026-27)",
  "Quarterly leakage audits",
  "Priority WhatsApp advisor",
];

export default function PaywallModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [plan, setPlan] = React.useState<"monthly" | "yearly">("yearly");

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="paywall-modal">
          <LinearGradient
            colors={[COLORS.surface, COLORS.background]}
            style={StyleSheet.absoluteFillObject}
          />
          <TouchableOpacity
            onPress={onClose}
            style={styles.close}
            testID="paywall-close"
          >
            <Ionicons name="close" size={22} color={COLORS.text_secondary} />
          </TouchableOpacity>

          <View style={styles.badge}>
            <Ionicons name="diamond" size={14} color={COLORS.gold} />
            <Text style={styles.badgeText}>PREMIUM</Text>
          </View>

          <Text style={styles.title}>Stop the leak.</Text>
          <Text style={styles.subtitle}>Pays for itself in 1 day.</Text>

          <View style={styles.features}>
            {FEATURES.map((f) => (
              <View key={f} style={styles.featureRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={COLORS.primary}
                />
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>

          <View style={styles.plans}>
            <Pressable
              testID="plan-monthly"
              onPress={() => setPlan("monthly")}
              style={[styles.plan, plan === "monthly" && styles.planActive]}
            >
              <Text style={styles.planTier}>Monthly</Text>
              <Text style={styles.planPrice}>₹99</Text>
              <Text style={styles.planUnit}>/ month</Text>
            </Pressable>
            <Pressable
              testID="plan-yearly"
              onPress={() => setPlan("yearly")}
              style={[styles.plan, plan === "yearly" && styles.planActive]}
            >
              <View style={styles.bestBadge}>
                <Text style={styles.bestBadgeText}>BEST VALUE</Text>
              </View>
              <Text style={styles.planTier}>Yearly</Text>
              <Text style={styles.planPrice}>₹899</Text>
              <Text style={styles.planUnit}>/ year · ₹75/mo</Text>
            </Pressable>
          </View>

          <TouchableOpacity
            style={styles.cta}
            onPress={onClose}
            testID="paywall-unlock"
          >
            <Text style={styles.ctaText}>Unlock Dashboard</Text>
            <Ionicons name="arrow-forward" size={18} color="#060B19" />
          </TouchableOpacity>

          <Text style={styles.footer}>
            Cancel anytime · Secured by 256-bit encryption
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  close: { position: "absolute", top: 14, right: 14, padding: 6, zIndex: 4 },
  badge: {
    flexDirection: "row",
    alignSelf: "flex-start",
    backgroundColor: "rgba(251,191,36,0.12)",
    borderColor: "rgba(251,191,36,0.4)",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 6,
    marginBottom: SPACING.md,
  },
  badgeText: { color: COLORS.gold, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  title: { color: COLORS.text_primary, fontSize: 32, fontWeight: "800", letterSpacing: -1 },
  subtitle: { color: COLORS.text_secondary, fontSize: 16, marginTop: 4 },
  features: { marginTop: SPACING.lg, gap: SPACING.sm },
  featureRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  featureText: { color: COLORS.text_primary, fontSize: 15 },
  plans: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  plan: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: SPACING.md,
    position: "relative",
  },
  planActive: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(16,185,129,0.08)",
  },
  bestBadge: {
    position: "absolute",
    top: -10,
    right: 10,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bestBadgeText: { color: "#06291F", fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
  planTier: { color: COLORS.text_secondary, fontSize: 12, letterSpacing: 1, fontWeight: "700" },
  planPrice: { color: COLORS.text_primary, fontSize: 26, fontWeight: "800", marginTop: 2 },
  planUnit: { color: COLORS.text_muted, fontSize: 11 },
  cta: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  ctaText: { color: "#060B19", fontWeight: "800", fontSize: 16 },
  footer: { textAlign: "center", color: COLORS.text_muted, marginTop: SPACING.md, fontSize: 11 },
});
