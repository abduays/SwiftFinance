import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import { COLORS, RADIUS, SPACING } from "../src/theme";
import { useAppStore } from "../src/store";
import { api, formatINR, formatLakhs, formatRelTime } from "../src/api";
import AreaChart from "../src/components/AreaChart";
import PaywallModal from "../src/components/PaywallModal";

const TYPE_LABEL: Record<string, string> = {
  home: "Home Loan",
  car: "Car Loan",
  personal: "Personal Loan",
};

export default function LoanScreen() {
  const router = useRouter();
  const loans = useAppStore((s) => s.loans);
  const [active, setActive] = useState(0);
  const loan = loans[active];

  const [tenureYears, setTenureYears] = useState<number>(
    loan ? Math.round(loan.tenure_months / 12) : 20
  );
  const [extraEmi, setExtraEmi] = useState<number>(0);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [ratesMeta, setRatesMeta] = useState<{ source: string; last_updated_at: string | null } | null>(null);

  useEffect(() => {
    api.marketRates().then((m) => setRatesMeta({ source: m.source, last_updated_at: m.last_updated_at })).catch(() => {});
  }, []);

  useEffect(() => {
    if (loan) setTenureYears(Math.round(loan.tenure_months / 12));
  }, [loan]);

  useEffect(() => {
    if (!loan) return;
    let cancelled = false;
    setLoading(true);
    api
      .refinance({
        loan_type: loan.loan_type,
        amount: loan.amount,
        rate: loan.rate,
        tenure_months: tenureYears * 12,
        extra_emi: extraEmi,
      })
      .then((res) => {
        if (!cancelled) setResult(res);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [loan, tenureYears, extraEmi]);

  const width = Dimensions.get("window").width - SPACING.lg * 2 - SPACING.md * 2;

  const seriesCurrent = useMemo(
    () =>
      (result?.series_current ?? []).map((p: any, i: number) => ({
        x: i,
        y: p.interest_paid,
      })),
    [result]
  );
  const seriesSwitched = useMemo(
    () =>
      (result?.series_switched ?? []).map((p: any, i: number) => ({
        x: i,
        y: p.interest_paid,
      })),
    [result]
  );

  if (!loan) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header onBack={() => router.back()} title="Loan Arbitrage" />
        <View style={styles.empty}>
          <Ionicons name="cash-outline" size={48} color={COLORS.text_muted} />
          <Text style={styles.emptyTitle}>No loans yet</Text>
          <Text style={styles.emptySub}>
            Add a loan in onboarding to see refinance savings.
          </Text>
          <TouchableOpacity
            style={styles.emptyCta}
            onPress={() => router.replace("/onboarding")}
          >
            <Text style={styles.emptyCtaText}>Add a loan</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Header onBack={() => router.back()} title="Loan Arbitrage" />
      <ScrollView contentContainerStyle={styles.scroll} testID="loan-screen">
        {ratesMeta && (
          <View style={styles.freshness} testID="loan-rates-freshness">
            <Ionicons name="cellular" size={11} color={COLORS.primary} />
            <Text style={styles.freshnessText}>
              Market rate {ratesMeta.source === "rbi_press_release" ? "from RBI" : ratesMeta.source === "admin_manual" ? "admin-set" : "default"} · updated {formatRelTime(ratesMeta.last_updated_at)}
            </Text>
          </View>
        )}
        {loans.length > 1 && (
          <View style={styles.tabs}>
            {loans.map((l, i) => (
              <TouchableOpacity
                key={l.loan_type}
                onPress={() => setActive(i)}
                style={[styles.tab, i === active && styles.tabActive]}
                testID={`loan-tab-${l.loan_type}`}
              >
                <Text
                  style={[
                    styles.tabText,
                    i === active && { color: COLORS.text_primary },
                  ]}
                >
                  {TYPE_LABEL[l.loan_type]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>YOU CAN SAVE</Text>
          <Text style={styles.heroAmount} testID="lifetime-savings">
            {result ? formatLakhs(result.savings.lifetime_interest) : "—"}
          </Text>
          <Text style={styles.heroSub}>
            in lifetime interest by switching to today&apos;s best rate.
          </Text>

          <View style={styles.compareRow}>
            <View style={styles.compareBox}>
              <Text style={styles.compareLabel}>CURRENT</Text>
              <Text style={styles.compareRate}>{loan.rate}%</Text>
              <Text style={styles.compareEmi}>
                EMI {result ? formatINR(result.current.emi) : "—"}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color={COLORS.primary} />
            <View style={[styles.compareBox, styles.compareBoxBest]}>
              <Text style={[styles.compareLabel, { color: COLORS.primary }]}>
                MARKET BEST
              </Text>
              <Text style={[styles.compareRate, { color: COLORS.primary }]}>
                {result ? `${result.switched.rate}%` : "—"}
              </Text>
              <Text style={styles.compareEmi}>
                EMI {result ? formatINR(result.switched.emi) : "—"}
              </Text>
            </View>
          </View>

          <View style={styles.savingsRow}>
            <View>
              <Text style={styles.savingsLabel}>MONTHLY EMI SAVED</Text>
              <Text style={styles.savingsValue} testID="monthly-savings">
                {result ? formatINR(result.savings.monthly_emi) : "—"}
              </Text>
            </View>
            <View>
              <Text style={styles.savingsLabel}>TENURE CUT (PREPAY)</Text>
              <Text style={styles.savingsValue}>
                {result ? `${Math.round(result.prepay.months_saved / 12)} yrs` : "—"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Interest paid over time</Text>
          <Text style={styles.cardSub}>
            <Text style={{ color: COLORS.danger }}>● Current</Text>   ·   
            <Text style={{ color: COLORS.primary }}>  ● After switch</Text>
          </Text>
          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 36 }} />
          ) : (
            <AreaChart
              width={width}
              height={180}
              current={seriesCurrent}
              switched={seriesSwitched}
            />
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Adjust your plan</Text>
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>Tenure</Text>
            <Text style={styles.sliderValue} testID="tenure-value">
              {tenureYears} yrs
            </Text>
          </View>
          <Slider
            testID="tenure-slider"
            minimumValue={loan.loan_type === "home" ? 5 : 1}
            maximumValue={loan.loan_type === "home" ? 30 : loan.loan_type === "car" ? 8 : 5}
            step={1}
            value={tenureYears}
            onValueChange={(v) => setTenureYears(Math.round(v))}
            minimumTrackTintColor={COLORS.primary}
            maximumTrackTintColor={COLORS.border}
            thumbTintColor={COLORS.text_primary}
          />

          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>Extra EMI / month (prepay)</Text>
            <Text style={styles.sliderValue} testID="extra-value">
              {formatINR(extraEmi)}
            </Text>
          </View>
          <Slider
            testID="extra-slider"
            minimumValue={0}
            maximumValue={25000}
            step={500}
            value={extraEmi}
            onValueChange={(v) => setExtraEmi(Math.round(v))}
            minimumTrackTintColor={COLORS.primary}
            maximumTrackTintColor={COLORS.border}
            thumbTintColor={COLORS.text_primary}
          />
        </View>

        <TouchableOpacity
          testID="check-eligibility-btn"
          style={styles.eligCta}
          onPress={() => setPaywall(true)}
        >
          <Ionicons name="checkmark-circle" size={20} color="#06291F" />
          <Text style={styles.eligText}>Check Refinance Eligibility</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.downloadBtn}
          onPress={() => setPaywall(true)}
          testID="download-plan-btn"
        >
          <Ionicons name="lock-closed" size={16} color={COLORS.gold} />
          <Text style={styles.downloadText}>
            Download Detailed Loan-Switch Plan
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <PaywallModal visible={paywall} onClose={() => setPaywall(false)} />
    </SafeAreaView>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={hStyles.bar}>
      <TouchableOpacity onPress={onBack} testID="header-back">
        <Ionicons name="chevron-back" size={26} color={COLORS.text_primary} />
      </TouchableOpacity>
      <Text style={hStyles.title}>{title}</Text>
      <View style={{ width: 26 }} />
    </View>
  );
}

const hStyles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  title: { color: COLORS.text_primary, fontWeight: "700", fontSize: 16 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  freshness: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(46,213,115,0.08)",
    borderColor: "rgba(46,213,115,0.25)",
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    borderRadius: RADIUS.md,
    alignSelf: "flex-start",
    marginBottom: SPACING.md,
  },
  freshnessText: { color: COLORS.text_secondary, fontSize: 11, fontWeight: "600" },
  tabs: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.md },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { color: COLORS.text_secondary, fontSize: 12, fontWeight: "600" },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.4)",
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  eyebrow: {
    color: COLORS.primary,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "700",
  },
  heroAmount: {
    color: COLORS.primary,
    fontSize: 44,
    fontWeight: "800",
    letterSpacing: -1.5,
    marginTop: 4,
  },
  heroSub: { color: COLORS.text_secondary, fontSize: 13, marginTop: 2 },
  compareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  compareBox: {
    flex: 1,
    backgroundColor: COLORS.surface_highlight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  compareBoxBest: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(16,185,129,0.08)",
  },
  compareLabel: {
    color: COLORS.text_muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  compareRate: {
    color: COLORS.text_primary,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 2,
  },
  compareEmi: { color: COLORS.text_secondary, fontSize: 11, marginTop: 2 },
  savingsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SPACING.lg,
  },
  savingsLabel: {
    color: COLORS.text_muted,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  savingsValue: { color: COLORS.primary, fontSize: 20, fontWeight: "800", marginTop: 2 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  cardTitle: { color: COLORS.text_primary, fontSize: 16, fontWeight: "700" },
  cardSub: { color: COLORS.text_muted, fontSize: 12, marginTop: 2, marginBottom: SPACING.md },
  sliderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: SPACING.md,
  },
  sliderLabel: { color: COLORS.text_secondary, fontSize: 12, fontWeight: "600" },
  sliderValue: { color: COLORS.primary, fontSize: 14, fontWeight: "800" },
  eligCta: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  eligText: { color: "#060B19", fontWeight: "800", fontSize: 15 },
  downloadBtn: {
    marginTop: SPACING.md,
    paddingVertical: 14,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.45)",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  downloadText: { color: COLORS.gold, fontWeight: "700", fontSize: 13 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.lg },
  emptyTitle: {
    color: COLORS.text_primary,
    fontSize: 20,
    fontWeight: "700",
    marginTop: SPACING.md,
  },
  emptySub: {
    color: COLORS.text_secondary,
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
  emptyCta: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: RADIUS.full,
    marginTop: SPACING.lg,
  },
  emptyCtaText: { color: "#060B19", fontWeight: "800" },
});
