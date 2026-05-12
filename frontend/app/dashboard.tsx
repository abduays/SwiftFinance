import React, { useEffect, useState } from "react";
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
import { api, formatINR, formatLakhs, formatRelTime } from "../src/api";
import LeakageMeter from "../src/components/LeakageMeter";
import ModuleCard from "../src/components/ModuleCard";
import PaywallModal from "../src/components/PaywallModal";
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
  const breakdown = useAppStore((s) => s.breakdown);
  const [paywall, setPaywall] = useState(false);
  const [ratesMeta, setRatesMeta] = useState<{ source: string; last_updated_at: string | null; repo_rate: number } | null>(null);

  useEffect(() => {
    api.marketRates().then((m) => {
      setRatesMeta({ source: m.source, last_updated_at: m.last_updated_at, repo_rate: m.repo_rate });
    }).catch(() => {});
  }, []);

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
        store.set({
          monthly_leakage: res.monthly_leakage,
          annual_leakage: res.annual_leakage,
          breakdown: res.breakdown,
        });
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

  // Real metrics from backend leakage breakdown (no hardcoded numbers)
  const loanAnnualSavings = breakdown.loans_monthly * 12;
  const cardsAnnualUpside = breakdown.cards_monthly * 12;
  const taxAnnualLeak = breakdown.tax_monthly * 12;

  const loanMetric =
    loans.length === 0
      ? t("add_loan")
      : loanAnnualSavings > 0
      ? formatLakhs(loanAnnualSavings)
      : t("on_best_rate");
  const cardsMetric =
    cardsAnnualUpside > 0 ? `+ ${formatINR(cardsAnnualUpside)}` : "—";
  const taxMetric = taxAnnualLeak > 0 ? formatINR(taxAnnualLeak) : "—";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>
            Paisa<Text style={{ color: COLORS.primary }}>Bachao</Text>
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

        {ratesMeta && (
          <View style={styles.ratesBadge} testID="rates-badge">
            <Ionicons name="cellular" size={12} color={COLORS.primary} />
            <Text style={styles.ratesBadgeText}>
              RBI repo {ratesMeta.repo_rate}% · {ratesMeta.source === "rbi_press_release" ? "Live from RBI" : ratesMeta.source === "admin_manual" ? "Admin-set" : "Default snapshot"} · {formatRelTime(ratesMeta.last_updated_at)}
            </Text>
          </View>
        )}

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
          metric={loanMetric}
          metricLabel="ANNUAL SAVINGS"
          to="/loan"
        />

        <ModuleCard
          testID="module-cards"
          icon="card"
          badge="MODULE B · REWARD STACK"
          title={t("module_cards")}
          description={t("module_cards_desc")}
          metric={cardsMetric}
          metricLabel="POTENTIAL CASHBACK"
          to="/cards"
        />

        <ModuleCard
          testID="module-tax"
          icon="document-text"
          badge="MODULE C · FY 2026-27"
          title={t("module_tax")}
          description={t("module_tax_desc")}
          metric={taxMetric}
          metricLabel="REGIME GAP"
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
              onPress={() => setPaywall(true)}
              testID="footer-cta"
            >
              <Text style={styles.footerCtaText}>{t("unlock")}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <PaywallModal visible={paywall} onClose={() => setPaywall(false)} />
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
  ratesBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(46,213,115,0.08)",
    borderColor: "rgba(46,213,115,0.25)",
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    alignSelf: "flex-start",
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  ratesBadgeText: { color: COLORS.text_secondary, fontSize: 11, fontWeight: "600" },
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
