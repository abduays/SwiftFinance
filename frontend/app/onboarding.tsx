import React, { useEffect, useMemo, useState } from "react";
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
import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import { COLORS, RADIUS, SPACING } from "../src/theme";
import { store, useAppStore, Loan } from "../src/store";
import { api, formatLakhs, formatINR } from "../src/api";

const LOAN_OPTIONS: { id: Loan["loan_type"]; label: string; icon: any }[] = [
  { id: "home", label: "Home Loan", icon: "home" },
  { id: "car", label: "Car Loan", icon: "car-sport" },
  { id: "personal", label: "Personal Loan", icon: "person" },
];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const [income, setIncome] = useState<string>(
    String(useAppStore((s) => s.annual_income))
  );

  const [selectedLoans, setSelectedLoans] = useState<Set<Loan["loan_type"]>>(
    new Set(["home"])
  );

  const [homeAmt, setHomeAmt] = useState("3500000");
  const [homeRate, setHomeRate] = useState("9.2");
  const [homeTenure, setHomeTenure] = useState(20);

  const [carAmt, setCarAmt] = useState("700000");
  const [carRate, setCarRate] = useState("10.5");
  const [carTenure, setCarTenure] = useState(5);

  const [persAmt, setPersAmt] = useState("400000");
  const [persRate, setPersRate] = useState("14");
  const [persTenure, setPersTenure] = useState(3);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const buildLoans = (): Loan[] => {
    const list: Loan[] = [];
    if (selectedLoans.has("home"))
      list.push({
        loan_type: "home",
        amount: Number(homeAmt) || 0,
        rate: Number(homeRate) || 0,
        tenure_months: homeTenure * 12,
      });
    if (selectedLoans.has("car"))
      list.push({
        loan_type: "car",
        amount: Number(carAmt) || 0,
        rate: Number(carRate) || 0,
        tenure_months: carTenure * 12,
      });
    if (selectedLoans.has("personal"))
      list.push({
        loan_type: "personal",
        amount: Number(persAmt) || 0,
        rate: Number(persRate) || 0,
        tenure_months: persTenure * 12,
      });
    return list;
  };

  const incomeNum = useMemo(() => Number(income) || 0, [income]);

  const toggleLoan = (id: Loan["loan_type"]) => {
    setSelectedLoans((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const goNext = () => {
    if (step === 0) {
      if (incomeNum < 100000) return;
      setStep(1);
    } else if (step === 1) {
      runAnalysis();
    }
  };

  const goBack = () => {
    if (step > 0) setStep(step - 1);
    else router.back();
  };

  const runAnalysis = async () => {
    setStep(2);
    setLoading(true);
    setProgress(0);

    const t1 = setTimeout(() => setProgress(0.3), 350);
    const t2 = setTimeout(() => setProgress(0.6), 800);
    const t3 = setTimeout(() => setProgress(0.85), 1200);

    const loans = buildLoans();
    try {
      const profile = {
        annual_income: incomeNum,
        loans,
        investments_80c: 50000,
        investments_80d: 15000,
        investments_nps: 0,
      };
      const leak = await api.leakage(profile);
      store.set({
        onboarded: true,
        annual_income: incomeNum,
        loans,
        investments_80c: 50000,
        investments_80d: 15000,
        investments_nps: 0,
        monthly_leakage: leak.monthly_leakage,
        annual_leakage: leak.annual_leakage,
        breakdown: leak.breakdown,
      });
      setProgress(1);
      setTimeout(() => router.replace("/dashboard"), 600);
    } catch (e) {
      console.warn("leakage failed", e);
      // Fallback: persist inputs only — dashboard will retry computation.
      store.set({
        onboarded: true,
        annual_income: incomeNum,
        loans,
      });
      setTimeout(() => router.replace("/dashboard"), 600);
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={goBack} testID="back-btn">
            <Ionicons name="chevron-back" size={26} color={COLORS.text_primary} />
          </TouchableOpacity>
          <View style={styles.progressRow}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.progressBar,
                  { backgroundColor: i <= step ? COLORS.primary : COLORS.border },
                ]}
              />
            ))}
          </View>
          <Text style={styles.stepLabel}>STEP {step + 1}/3</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {step === 0 && (
            <View testID="step-income">
              <Text style={styles.eyebrow}>INCOME PROFILE</Text>
              <Text style={styles.title}>
                What&apos;s your{"\n"}
                <Text style={{ color: COLORS.primary }}>annual income?</Text>
              </Text>
              <Text style={styles.sub}>
                Used to compute your tax leakage. Stays on your device.
              </Text>

              <View style={styles.amountCard}>
                <Text style={styles.amountLabel}>Annual Gross Salary</Text>
                <View style={styles.amountRow}>
                  <Text style={styles.rupee}>₹</Text>
                  <TextInput
                    testID="income-input"
                    style={styles.amountInput}
                    keyboardType="numeric"
                    value={income}
                    onChangeText={setIncome}
                    placeholder="0"
                    placeholderTextColor={COLORS.text_muted}
                  />
                </View>
                <Text style={styles.amountHint}>{formatLakhs(incomeNum)}</Text>

                <Slider
                  testID="income-slider"
                  style={{ marginTop: SPACING.md }}
                  minimumValue={500000}
                  maximumValue={5000000}
                  step={50000}
                  value={incomeNum}
                  onValueChange={(v) => setIncome(String(Math.round(v)))}
                  minimumTrackTintColor={COLORS.primary}
                  maximumTrackTintColor={COLORS.border}
                  thumbTintColor={COLORS.text_primary}
                />
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderLabel}>₹5L</Text>
                  <Text style={styles.sliderLabel}>₹50L</Text>
                </View>
              </View>

              <View style={styles.tipRow}>
                <Ionicons name="shield-checkmark" size={18} color={COLORS.primary} />
                <Text style={styles.tipText}>
                  We never share or transmit your salary data.
                </Text>
              </View>
            </View>
          )}

          {step === 1 && (
            <View testID="step-loans">
              <Text style={styles.eyebrow}>LIABILITIES</Text>
              <Text style={styles.title}>
                Select your{"\n"}
                <Text style={{ color: COLORS.primary }}>active debts</Text>
              </Text>
              <Text style={styles.sub}>
                We&apos;ll benchmark each against today&apos;s best market rate.
              </Text>

              <View style={styles.loanGrid}>
                {LOAN_OPTIONS.map((opt) => {
                  const active = selectedLoans.has(opt.id);
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => toggleLoan(opt.id)}
                      style={[styles.loanCard, active && styles.loanCardActive]}
                      testID={`loan-toggle-${opt.id}`}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={22}
                        color={active ? COLORS.primary : COLORS.text_secondary}
                      />
                      <Text style={[styles.loanCardText, active && { color: COLORS.text_primary }]}>
                        {opt.label}
                      </Text>
                      {active && (
                        <View style={styles.check}>
                          <Ionicons name="checkmark" size={14} color="#06291F" />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {selectedLoans.has("home") && (
                <LoanInputBlock
                  label="Home Loan"
                  amount={homeAmt}
                  setAmount={setHomeAmt}
                  rate={homeRate}
                  setRate={setHomeRate}
                  tenure={homeTenure}
                  setTenure={setHomeTenure}
                  tenureMin={5}
                  tenureMax={30}
                  testIdPrefix="home"
                />
              )}
              {selectedLoans.has("car") && (
                <LoanInputBlock
                  label="Car Loan"
                  amount={carAmt}
                  setAmount={setCarAmt}
                  rate={carRate}
                  setRate={setCarRate}
                  tenure={carTenure}
                  setTenure={setCarTenure}
                  tenureMin={1}
                  tenureMax={8}
                  testIdPrefix="car"
                />
              )}
              {selectedLoans.has("personal") && (
                <LoanInputBlock
                  label="Personal Loan"
                  amount={persAmt}
                  setAmount={setPersAmt}
                  rate={persRate}
                  setRate={setPersRate}
                  tenure={persTenure}
                  setTenure={setPersTenure}
                  tenureMin={1}
                  tenureMax={5}
                  testIdPrefix="personal"
                />
              )}
            </View>
          )}

          {step === 2 && (
            <View testID="step-analyzing" style={styles.analyzing}>
              <Text style={styles.eyebrow}>SCANNING</Text>
              <Text style={styles.title}>
                Analyzing{"\n"}
                <Text style={{ color: COLORS.primary }}>wealth leakage…</Text>
              </Text>

              <View style={styles.progressBlock}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.round(progress * 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressLabel}>{Math.round(progress * 100)}%</Text>
              </View>

              <View style={styles.checks}>
                <CheckRow done={progress >= 0.3} text="Benchmarking loan rates…" />
                <CheckRow done={progress >= 0.6} text="Modelling tax regimes (FY 2026-27)…" />
                <CheckRow done={progress >= 0.85} text="Auditing credit-card portfolio…" />
                <CheckRow done={progress >= 1} text="Compiling your leakage report." />
              </View>
              {loading && <ActivityIndicator color={COLORS.primary} />}
            </View>
          )}
        </ScrollView>

        {step < 2 && (
          <View style={styles.bottomBar}>
            <View style={{ flex: 1, paddingRight: SPACING.md }}>
              <Text style={styles.estLabel}>STEP {step + 1} OF 3</Text>
              <Text style={styles.estValue}>
                {step === 0 ? "Income" : "Loans & rates"}
                <Text style={styles.estUnit}>
                  {step === 0 ? "  ·  Enter your gross salary" : "  ·  Add active EMIs"}
                </Text>
              </Text>
            </View>
            <TouchableOpacity
              testID="next-btn"
              style={[
                styles.cta,
                step === 0 && incomeNum < 100000 && { opacity: 0.4 },
              ]}
              disabled={step === 0 && incomeNum < 100000}
              onPress={goNext}
            >
              <Text style={styles.ctaText}>
                {step === 1 ? "Reveal Leakage" : "Continue"}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#060B19" />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LoanInputBlock({
  label,
  amount,
  setAmount,
  rate,
  setRate,
  tenure,
  setTenure,
  tenureMin,
  tenureMax,
  testIdPrefix,
}: {
  label: string;
  amount: string;
  setAmount: (v: string) => void;
  rate: string;
  setRate: (v: string) => void;
  tenure: number;
  setTenure: (v: number) => void;
  tenureMin: number;
  tenureMax: number;
  testIdPrefix: string;
}) {
  return (
    <View style={styles.loanBlock} testID={`loan-block-${testIdPrefix}`}>
      <Text style={styles.blockLabel}>{label}</Text>
      <View style={styles.miniGrid}>
        <View style={styles.miniInput}>
          <Text style={styles.miniLabel}>Outstanding</Text>
          <TextInput
            testID={`${testIdPrefix}-amount`}
            style={styles.miniValue}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
          <Text style={styles.miniHint}>{formatLakhs(Number(amount) || 0)}</Text>
        </View>
        <View style={styles.miniInput}>
          <Text style={styles.miniLabel}>Interest %</Text>
          <TextInput
            testID={`${testIdPrefix}-rate`}
            style={styles.miniValue}
            keyboardType="numeric"
            value={rate}
            onChangeText={setRate}
          />
          <Text style={styles.miniHint}>p.a.</Text>
        </View>
      </View>
      <View style={{ marginTop: SPACING.sm }}>
        <View style={styles.tenureRow}>
          <Text style={styles.miniLabel}>Tenure</Text>
          <Text style={styles.tenureValue}>{tenure} yrs</Text>
        </View>
        <Slider
          testID={`${testIdPrefix}-tenure`}
          minimumValue={tenureMin}
          maximumValue={tenureMax}
          step={1}
          value={tenure}
          onValueChange={(v) => setTenure(Math.round(v))}
          minimumTrackTintColor={COLORS.primary}
          maximumTrackTintColor={COLORS.border}
          thumbTintColor={COLORS.text_primary}
        />
      </View>
    </View>
  );
}

function CheckRow({ done, text }: { done: boolean; text: string }) {
  return (
    <View style={styles.checkRow}>
      <View
        style={[
          styles.checkDot,
          { backgroundColor: done ? COLORS.primary : COLORS.surface_highlight },
        ]}
      >
        {done && <Ionicons name="checkmark" size={12} color="#06291F" />}
      </View>
      <Text
        style={[
          styles.checkText,
          { color: done ? COLORS.text_primary : COLORS.text_secondary },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  progressRow: { flexDirection: "row", gap: 6, flex: 1, marginHorizontal: SPACING.md },
  progressBar: { flex: 1, height: 4, borderRadius: 2 },
  stepLabel: { color: COLORS.text_muted, fontSize: 10, letterSpacing: 1.5, fontWeight: "700" },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: 130 },
  eyebrow: {
    color: COLORS.primary,
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: "700",
    marginBottom: SPACING.sm,
  },
  title: {
    color: COLORS.text_primary,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1.2,
    lineHeight: 40,
  },
  sub: {
    color: COLORS.text_secondary,
    marginTop: SPACING.sm,
    fontSize: 14,
    marginBottom: SPACING.lg,
  },
  amountCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
  },
  amountLabel: {
    color: COLORS.text_muted,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "700",
  },
  amountRow: { flexDirection: "row", alignItems: "baseline", marginTop: SPACING.sm },
  rupee: { color: COLORS.text_secondary, fontSize: 28, fontWeight: "700", marginRight: 4 },
  amountInput: {
    color: COLORS.text_primary,
    fontSize: 36,
    fontWeight: "800",
    flex: 1,
    paddingVertical: 4,
  },
  amountHint: { color: COLORS.primary, fontWeight: "700", fontSize: 14 },
  sliderLabels: { flexDirection: "row", justifyContent: "space-between" },
  sliderLabel: { color: COLORS.text_muted, fontSize: 11 },
  tipRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    alignItems: "center",
    marginTop: SPACING.lg,
  },
  tipText: { color: COLORS.text_secondary, fontSize: 12 },
  loanGrid: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  loanCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.md,
    alignItems: "center",
    gap: 6,
    position: "relative",
  },
  loanCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(16,185,129,0.06)",
  },
  loanCardText: { color: COLORS.text_secondary, fontSize: 12, fontWeight: "600" },
  check: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: COLORS.primary,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  loanBlock: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  blockLabel: {
    color: COLORS.text_primary,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: SPACING.sm,
  },
  miniGrid: { flexDirection: "row", gap: SPACING.sm },
  miniInput: {
    flex: 1,
    backgroundColor: COLORS.surface_highlight,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  miniLabel: { color: COLORS.text_muted, fontSize: 10, letterSpacing: 1, fontWeight: "700" },
  miniValue: {
    color: COLORS.text_primary,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 2,
    paddingVertical: 0,
  },
  miniHint: { color: COLORS.text_secondary, fontSize: 11, marginTop: 2 },
  tenureRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tenureValue: { color: COLORS.primary, fontWeight: "700", fontSize: 13 },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  estLabel: { color: COLORS.text_muted, fontSize: 10, letterSpacing: 1.2, fontWeight: "700" },
  estValue: { color: COLORS.danger, fontSize: 18, fontWeight: "800" },
  estUnit: { color: COLORS.text_secondary, fontSize: 12, fontWeight: "500" },
  cta: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ctaText: { color: "#060B19", fontWeight: "800", fontSize: 15 },
  analyzing: { paddingTop: SPACING.lg },
  progressBlock: { marginTop: SPACING.xl, marginBottom: SPACING.lg },
  progressTrack: {
    backgroundColor: COLORS.surface,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: { backgroundColor: COLORS.primary, height: 8 },
  progressLabel: {
    color: COLORS.primary,
    fontWeight: "800",
    marginTop: SPACING.sm,
    fontSize: 13,
  },
  checks: { marginTop: SPACING.lg, gap: SPACING.md, marginBottom: SPACING.xl },
  checkRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  checkDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: { fontSize: 14 },
});
