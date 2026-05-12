import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import { COLORS, RADIUS, SPACING } from "../src/theme";
import { useAppStore, store } from "../src/store";
import { api, formatINR, formatLakhs } from "../src/api";
import PaywallModal from "../src/components/PaywallModal";

export default function TaxScreen() {
  const router = useRouter();
  const incomeStore = useAppStore((s) => s.annual_income);
  const c80Store = useAppStore((s) => s.investments_80c);
  const d80Store = useAppStore((s) => s.investments_80d);
  const npsStore = useAppStore((s) => s.investments_nps);

  const [income, setIncome] = useState(incomeStore);
  const [c80, setC80] = useState(c80Store);
  const [d80, setD80] = useState(d80Store);
  const [nps, setNps] = useState(npsStore);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [paywall, setPaywall] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .tax({
        annual_income: income,
        investments_80c: c80,
        investments_80d: d80,
        investments_nps: nps,
      })
      .then((res) => {
        if (cancelled) return;
        setData(res);
        store.set({
          annual_income: income,
          investments_80c: c80,
          investments_80d: d80,
          investments_nps: nps,
        });
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [income, c80, d80, nps]);

  const newTax = data?.new_regime_tax ?? 0;
  const oldTax = data?.old_regime_tax ?? 0;
  const optimal = data?.optimal_regime ?? "new";
  const maxTax = Math.max(newTax, oldTax, 1);
  const leakage = Math.abs(newTax - oldTax);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => router.back()} testID="header-back-tax">
          <Ionicons name="chevron-back" size={26} color={COLORS.text_primary} />
        </TouchableOpacity>
        <Text style={styles.barTitle}>Tax Predictor</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} testID="tax-screen">
        <View style={styles.fyBadge}>
          <Text style={styles.fyText}>FY 2026-27 · UNION BUDGET 2025 RULES</Text>
        </View>
        <Text style={styles.title}>
          Pay the{"\n"}
          <Text style={{ color: COLORS.primary }}>right tax.</Text>
        </Text>
        <Text style={styles.sub}>
          Compare New vs Old regime instantly — see your real liability and how to plug
          the leak.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>GROSS ANNUAL INCOME</Text>
          <View style={styles.row}>
            <Text style={styles.rupee}>₹</Text>
            <TextInput
              testID="tax-income-input"
              style={styles.input}
              keyboardType="numeric"
              value={String(income)}
              onChangeText={(t) => setIncome(Number(t) || 0)}
            />
          </View>
          <Text style={styles.hint}>{formatLakhs(income)}</Text>
          <Slider
            testID="tax-income-slider"
            minimumValue={500000}
            maximumValue={5000000}
            step={50000}
            value={income}
            onValueChange={(v) => setIncome(Math.round(v))}
            minimumTrackTintColor={COLORS.primary}
            maximumTrackTintColor={COLORS.border}
            thumbTintColor={COLORS.text_primary}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Current investments</Text>

          <InvestmentRow
            label="80C (ELSS, PPF, EPF)"
            cap="Cap ₹1.5L"
            value={c80}
            setValue={setC80}
            max={150000}
            step={5000}
            testID="80c"
          />
          <InvestmentRow
            label="80D (Health insurance)"
            cap="Cap ₹25k"
            value={d80}
            setValue={setD80}
            max={25000}
            step={1000}
            testID="80d"
          />
          <InvestmentRow
            label="NPS 80CCD(1B)"
            cap="Cap ₹50k"
            value={nps}
            setValue={setNps}
            max={50000}
            step={1000}
            testID="nps"
          />
        </View>

        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 12 }} />}

        <View style={styles.compareCard}>
          <Text style={styles.cardTitle}>Tax liability</Text>

          <View style={[styles.regimeRow, optimal === "new" && styles.regimeOptimal]}>
            <View style={{ flex: 1 }}>
              <View style={styles.regimeHead}>
                <Text style={styles.regimeName}>New Regime</Text>
                {optimal === "new" && (
                  <View style={styles.bestPill}>
                    <Text style={styles.bestText}>OPTIMAL</Text>
                  </View>
                )}
              </View>
              <Text style={styles.regimeAmt} testID="new-tax">
                {formatINR(newTax)}
              </Text>
              <View style={styles.bar2}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${(newTax / maxTax) * 100}%`,
                      backgroundColor: optimal === "new" ? COLORS.primary : COLORS.danger,
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          <View
            style={[
              styles.regimeRow,
              optimal === "old" && styles.regimeOptimal,
              { marginTop: SPACING.md },
            ]}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.regimeHead}>
                <Text style={styles.regimeName}>Old Regime</Text>
                {optimal === "old" && (
                  <View style={styles.bestPill}>
                    <Text style={styles.bestText}>OPTIMAL</Text>
                  </View>
                )}
              </View>
              <Text style={styles.regimeAmt} testID="old-tax">
                {formatINR(oldTax)}
              </Text>
              <View style={styles.bar2}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${(oldTax / maxTax) * 100}%`,
                      backgroundColor: optimal === "old" ? COLORS.primary : COLORS.danger,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        </View>

        {leakage > 0 && (
          <View style={styles.leakCard} testID="tax-leakage">
            <View style={styles.leakHead}>
              <Ionicons name="alert-circle" size={20} color={COLORS.danger} />
              <Text style={styles.leakTitle}>Tax leakage detected</Text>
            </View>
            <Text style={styles.leakBody}>
              You&apos;ll overpay{" "}
              <Text style={{ color: COLORS.danger, fontWeight: "800" }}>
                {formatINR(leakage)}
              </Text>{" "}
              if you pick the wrong regime.{" "}
              {data?.elss_gap > 0 && optimal === "old" && (
                <Text>
                  Invest{" "}
                  <Text style={{ color: COLORS.primary, fontWeight: "800" }}>
                    {formatINR(data.elss_gap)}
                  </Text>{" "}
                  more in ELSS to save{" "}
                  <Text style={{ color: COLORS.primary, fontWeight: "800" }}>
                    {formatINR(data.elss_save)}
                  </Text>{" "}
                  immediately.
                </Text>
              )}
            </Text>
          </View>
        )}

        <TouchableOpacity
          testID="tax-cta"
          style={styles.cta}
          onPress={() => setPaywall(true)}
        >
          <Ionicons name="trending-up" size={18} color="#060B19" />
          <Text style={styles.ctaText}>Plan my ELSS investments</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryCta}
          onPress={() => setPaywall(true)}
          testID="download-tax-plan"
        >
          <Ionicons name="lock-closed" size={16} color={COLORS.gold} />
          <Text style={styles.secondaryText}>
            Download Premium Tax Filing Helper
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <PaywallModal visible={paywall} onClose={() => setPaywall(false)} />
    </SafeAreaView>
  );
}

function InvestmentRow({
  label,
  cap,
  value,
  setValue,
  max,
  step,
  testID,
}: {
  label: string;
  cap: string;
  value: number;
  setValue: (n: number) => void;
  max: number;
  step: number;
  testID: string;
}) {
  return (
    <View style={{ marginTop: SPACING.md }}>
      <View style={styles.invRow}>
        <Text style={styles.invLabel}>{label}</Text>
        <Text style={styles.invVal} testID={`${testID}-value`}>
          {formatINR(value)}
        </Text>
      </View>
      <Slider
        testID={`${testID}-slider`}
        minimumValue={0}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={(v) => setValue(Math.round(v))}
        minimumTrackTintColor={COLORS.primary}
        maximumTrackTintColor={COLORS.border}
        thumbTintColor={COLORS.text_primary}
      />
      <Text style={styles.invCap}>{cap}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  barTitle: { color: COLORS.text_primary, fontWeight: "700", fontSize: 16 },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  fyBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(16,185,129,0.12)",
    borderColor: "rgba(16,185,129,0.4)",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.md,
  },
  fyText: { color: COLORS.primary, fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  title: {
    color: COLORS.text_primary,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -1,
    lineHeight: 36,
  },
  sub: { color: COLORS.text_secondary, fontSize: 14, marginTop: SPACING.sm, marginBottom: SPACING.lg },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  cardLabel: { color: COLORS.text_muted, fontSize: 10, letterSpacing: 1.4, fontWeight: "700" },
  cardTitle: { color: COLORS.text_primary, fontWeight: "700", fontSize: 16 },
  row: { flexDirection: "row", alignItems: "baseline", marginTop: SPACING.sm },
  rupee: { color: COLORS.text_secondary, fontSize: 26, fontWeight: "700", marginRight: 4 },
  input: {
    flex: 1,
    color: COLORS.text_primary,
    fontSize: 32,
    fontWeight: "800",
    paddingVertical: 2,
  },
  hint: { color: COLORS.primary, fontWeight: "700", marginBottom: SPACING.sm },
  invRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  invLabel: { color: COLORS.text_primary, fontSize: 13, fontWeight: "600" },
  invVal: { color: COLORS.primary, fontSize: 14, fontWeight: "800" },
  invCap: { color: COLORS.text_muted, fontSize: 11 },
  compareCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  regimeRow: {
    backgroundColor: COLORS.surface_highlight,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  regimeOptimal: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(16,185,129,0.08)",
  },
  regimeHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  regimeName: { color: COLORS.text_primary, fontSize: 14, fontWeight: "700" },
  bestPill: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bestText: { color: "#06291F", fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
  regimeAmt: { color: COLORS.text_primary, fontSize: 24, fontWeight: "800", marginTop: 4 },
  bar2: {
    backgroundColor: COLORS.border,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: SPACING.sm,
  },
  barFill: { height: 6, borderRadius: 3 },
  leakCard: {
    backgroundColor: "rgba(255,59,48,0.08)",
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: "rgba(255,59,48,0.4)",
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  leakHead: { flexDirection: "row", gap: SPACING.sm, alignItems: "center" },
  leakTitle: { color: COLORS.danger, fontWeight: "800", fontSize: 14 },
  leakBody: {
    color: COLORS.text_primary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: SPACING.sm,
  },
  cta: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  ctaText: { color: "#060B19", fontWeight: "800", fontSize: 15 },
  secondaryCta: {
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
  secondaryText: { color: COLORS.gold, fontWeight: "700", fontSize: 13 },
});
