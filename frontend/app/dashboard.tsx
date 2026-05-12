import React, { useEffect } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS, RADIUS, SPACING } from "../src/theme";
import { useAppStore, store } from "../src/store";
import { api, formatINR, formatLakhs } from "../src/api";
import LeakageMeter from "../src/components/LeakageMeter";
import ModuleCard from "../src/components/ModuleCard";

export default function Dashboard() {
  const router = useRouter();
  const monthly = useAppStore((s) => s.monthly_leakage);
  const annual = useAppStore((s) => s.annual_leakage);
  const income = useAppStore((s) => s.annual_income);
  const loans = useAppStore((s) => s.loans);

  useEffect(() => {
    let cancelled = false;
    api
      .leakage({
        annual_income: income,
        loans,
        investments_80c: store.get().investments_80c,
        investments_80d: store.get().investments_80d,
        investments_nps: store.get().investments_nps,
      })
      .then((res) => {
        if (cancelled) return;
        store.set({
          monthly_leakage: res.monthly_leakage,
          annual_leakage: res.annual_leakage,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [income, loans]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>
            Leak<Text style={{ color: COLORS.primary }}>Stop</Text>
          </Text>
          <Text style={styles.muted}>Your wealth audit · LIVE</Text>
        </View>
        <TouchableOpacity
          style={styles.profileBtn}
          onPress={() => {
            store.reset();
            router.replace("/onboarding");
          }}
          testID="reset-btn"
        >
          <Ionicons name="person-circle" size={28} color={COLORS.text_primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} testID="dashboard-scroll">
        <LeakageMeter monthly={monthly} annual={annual} />

        <View style={styles.statRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>INCOME</Text>
            <Text style={styles.statValue}>{formatLakhs(income)}</Text>
            <Text style={styles.statSub}>/ year gross</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>DEBTS TRACKED</Text>
            <Text style={styles.statValue}>{loans.length}</Text>
            <Text style={styles.statSub}>
              {loans.map((l) => l.loan_type).join(", ") || "none"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Money-Making Modules</Text>
        <Text style={styles.sectionSub}>Tap a card to fix the leak.</Text>

        <ModuleCard
          testID="module-loan"
          icon="cash"
          badge="MODULE A · DEBT HACK"
          title="Loan Arbitrage Engine"
          description="See how much you save by refinancing at today's best market rate."
          metric={loans.length > 0 ? "Save up to 8.5L" : "Add loan"}
          metricLabel="LIFETIME SAVINGS"
          to="/loan"
        />

        <ModuleCard
          testID="module-cards"
          icon="card"
          badge="MODULE B · REWARD STACK"
          title="Credit Card Optimizer"
          description="Rank Indian cards by reward % for your spend category."
          metric="+ ₹14,400/yr"
          metricLabel="MAX CASHBACK"
          to="/cards"
        />

        <ModuleCard
          testID="module-tax"
          icon="document-text"
          badge="MODULE C · FY 2026-27"
          title="Tax-Saving Predictor"
          description="Pick the right regime. Plug ELSS gaps before March 31."
          metric={formatINR(Math.max(annual * 0.4, 31200))}
          metricLabel="UNLOCK INSTANTLY"
          metricColor={COLORS.gold}
          to="/tax"
        />

        <View style={styles.footerCard} testID="footer-promo">
          <Ionicons name="rocket" size={22} color={COLORS.gold} />
          <View style={{ flex: 1 }}>
            <Text style={styles.footerTitle}>Upgrade to Premium</Text>
            <Text style={styles.footerSub}>
              Detailed loan-switch plan + quarterly audits at ₹75/mo.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.footerCta}
            onPress={() => router.push("/loan")}
            testID="footer-cta"
          >
            <Text style={styles.footerCtaText}>Unlock</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: { color: COLORS.text_primary, fontSize: 26, fontWeight: "800", letterSpacing: -1 },
  muted: { color: COLORS.text_muted, fontSize: 11, letterSpacing: 1.2, fontWeight: "700" },
  profileBtn: { padding: 4 },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  statRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.lg },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  statLabel: { color: COLORS.text_muted, fontSize: 10, letterSpacing: 1.2, fontWeight: "700" },
  statValue: { color: COLORS.text_primary, fontSize: 22, fontWeight: "800", marginTop: 4 },
  statSub: { color: COLORS.text_secondary, fontSize: 11, marginTop: 2 },
  sectionTitle: {
    color: COLORS.text_primary,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  sectionSub: { color: COLORS.text_secondary, fontSize: 13, marginBottom: SPACING.md },
  footerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.4)",
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  footerTitle: { color: COLORS.text_primary, fontWeight: "700" },
  footerSub: { color: COLORS.text_secondary, fontSize: 12, marginTop: 2 },
  footerCta: {
    backgroundColor: COLORS.gold,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADIUS.full,
  },
  footerCtaText: { color: "#060B19", fontWeight: "800", fontSize: 12 },
});
