import React, { useEffect } from "react";
import {
  Alert,
  Platform,
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
import { useAuth, authedFetch } from "../src/auth";
import { schedulePeriodicAudits, ensureNotificationsPermission } from "../src/notifications";
import { useLang } from "../src/translations";
import { appendSnapshot } from "../src/storage";

export default function Dashboard() {
  const router = useRouter();
  const { user, logout, token } = useAuth();
  const { t } = useLang();
  const monthly = useAppStore((s) => s.monthly_leakage);
  const annual = useAppStore((s) => s.annual_leakage);
  const income = useAppStore((s) => s.annual_income);
  const loans = useAppStore((s) => s.loans);

  useEffect(() => {
    api
      .leakage({
        annual_income: income,
        loans,
        investments_80c: store.get().investments_80c,
        investments_80d: store.get().investments_80d,
        investments_nps: store.get().investments_nps,
      })
      .then(async (res) => {
        store.set({ monthly_leakage: res.monthly_leakage, annual_leakage: res.annual_leakage });
        // Persist snapshot locally + backend (best-effort)
        const snap = {
          monthly_leakage: res.monthly_leakage,
          annual_leakage: res.annual_leakage,
          breakdown: res.breakdown,
          annual_income: income,
          loans_count: loans.length,
        };
        await appendSnapshot(snap);
        if (token) {
          authedFetch("/me/leakage-history", {
            method: "POST",
            body: JSON.stringify(snap),
          }, token).catch(() => {});
        }
      })
      .catch(() => {});
  }, [income, loans, token]);

  useEffect(() => {
    // Schedule quarterly audit notifications (mobile only)
    schedulePeriodicAudits();
  }, []);

  const isPremium = !!user?.subscription?.active;

  const onProfilePress = () => {
    router.push("/settings");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>
            Leak<Text style={{ color: COLORS.primary }}>Stop</Text>
          </Text>
          <Text style={styles.muted}>
            {user ? `${t("dashboard_hi")} ${user.name.split(" ")[0]}` : t("dashboard_subtitle")} · {t("dashboard_live")}
          </Text>
        </View>
        <TouchableOpacity style={styles.profileBtn} onPress={onProfilePress} testID="profile-btn">
          {isPremium && <View style={styles.premiumDot} />}
          <Ionicons name="person-circle" size={32} color={COLORS.text_primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} testID="dashboard-scroll">
        <LeakageMeter monthly={monthly} annual={annual} />

        <View style={styles.statRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{t("income")}</Text>
            <Text style={styles.statValue}>{formatLakhs(income)}</Text>
            <Text style={styles.statSub}>{t("per_year")}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{t("debts_tracked")}</Text>
            <Text style={styles.statValue}>{loans.length}</Text>
            <Text style={styles.statSub}>{loans.map((l) => l.loan_type).join(", ") || t("none")}</Text>
          </View>
        </View>

        {/* Advisor entry */}
        <TouchableOpacity
          testID="advisor-entry"
          style={styles.advisorCard}
          onPress={() => router.push("/advisor")}
          activeOpacity={0.85}
        >
          <View style={styles.advisorIcon}>
            <Ionicons name="sparkles" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.advisorTitle}>{t("advisor_title")}</Text>
            <Text style={styles.advisorSub}>{t("advisor_sub")}</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={COLORS.text_primary} />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>{t("money_modules")}</Text>
        <Text style={styles.sectionSub}>{t("money_modules_sub")}</Text>

        <ModuleCard
          testID="module-loan"
          icon="cash"
          badge="MODULE A · DEBT HACK"
          title={t("module_loan")}
          description={t("module_loan_desc")}
          metric={loans.length > 0 ? "Save up to 8.5L" : "Add loan"}
          metricLabel="LIFETIME SAVINGS"
          to="/loan"
        />

        <ModuleCard
          testID="module-cards"
          icon="card"
          badge="MODULE B · REWARD STACK"
          title={t("module_cards")}
          description={t("module_cards_desc")}
          metric="+ ₹14,400/yr"
          metricLabel="MAX CASHBACK"
          to="/cards"
        />

        <ModuleCard
          testID="module-tax"
          icon="document-text"
          badge="MODULE C · FY 2026-27"
          title={t("module_tax")}
          description={t("module_tax_desc")}
          metric={formatINR(Math.max(annual * 0.4, 31200))}
          metricLabel="UNLOCK INSTANTLY"
          metricColor={COLORS.gold}
          to="/tax"
        />

        {isPremium ? (
          <View style={styles.premiumCard} testID="premium-active">
            <Ionicons name="diamond" size={22} color={COLORS.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.premiumTitle}>{t("premium_active")}</Text>
              <Text style={styles.premiumSub}>
                Plan: {user?.subscription?.plan?.toUpperCase()}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.footerCard} testID="footer-promo">
            <Ionicons name="rocket" size={22} color={COLORS.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.footerTitle}>{t("upgrade_title")}</Text>
              <Text style={styles.footerSub}>{t("upgrade_sub")}</Text>
            </View>
            <TouchableOpacity
              style={styles.footerCta}
              onPress={() => router.push("/loan")}
              testID="footer-cta"
            >
              <Text style={styles.footerCtaText}>{t("unlock")}</Text>
            </TouchableOpacity>
          </View>
        )}
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
  profileBtn: { padding: 4, position: "relative" },
  premiumDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.gold,
    zIndex: 2,
  },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  statRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.md },
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
  advisorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.4)",
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  advisorIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "rgba(16,185,129,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  advisorTitle: { color: COLORS.text_primary, fontWeight: "800", fontSize: 16 },
  advisorSub: { color: COLORS.text_secondary, fontSize: 12, marginTop: 2 },
  sectionTitle: { color: COLORS.text_primary, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  sectionSub: { color: COLORS.text_secondary, fontSize: 13, marginBottom: SPACING.md },
  premiumCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.5)",
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  premiumTitle: { color: COLORS.gold, fontWeight: "800" },
  premiumSub: { color: COLORS.text_secondary, fontSize: 12, marginTop: 2 },
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
