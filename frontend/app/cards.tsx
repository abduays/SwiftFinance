import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { COLORS, RADIUS, SPACING } from "../src/theme";
import { api, formatINR } from "../src/api";
import PaywallModal from "../src/components/PaywallModal";

type Category = "grocery" | "travel" | "fuel" | "dining";
const CATEGORIES: { id: Category; label: string; icon: any }[] = [
  { id: "grocery", label: "Grocery", icon: "cart" },
  { id: "travel", label: "Travel", icon: "airplane" },
  { id: "fuel", label: "Fuel", icon: "car" },
  { id: "dining", label: "Dining", icon: "restaurant" },
];

export default function CardsScreen() {
  const router = useRouter();
  const [category, setCategory] = useState<Category>("grocery");
  const [spend, setSpend] = useState(15000);
  const [ranked, setRanked] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [paywall, setPaywall] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .rankCards(category, spend)
      .then((data) => !cancelled && setRanked(data))
      .catch(() => !cancelled && setRanked([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [category, spend]);

  const top = ranked[0];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => router.back()} testID="header-back-cards">
          <Ionicons name="chevron-back" size={26} color={COLORS.text_primary} />
        </TouchableOpacity>
        <Text style={styles.barTitle}>Credit Card Optimizer</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} testID="cards-screen">
        <Text style={styles.eyebrow}>MODULE B</Text>
        <Text style={styles.title}>
          Earn more on{"\n"}
          <Text style={{ color: COLORS.primary }}>every swipe.</Text>
        </Text>
        <Text style={styles.sub}>
          Pick a category & monthly spend — we rank India&apos;s best cards by net annual value.
        </Text>

        <Text style={styles.sectionLabel}>SPEND CATEGORY</Text>
        <View style={styles.catRow}>
          {CATEGORIES.map((c) => {
            const active = c.id === category;
            return (
              <Pressable
                key={c.id}
                onPress={() => setCategory(c.id)}
                style={[styles.cat, active && styles.catActive]}
                testID={`cat-${c.id}`}
              >
                <Ionicons
                  name={c.icon}
                  size={20}
                  color={active ? COLORS.primary : COLORS.text_secondary}
                />
                <Text style={[styles.catText, active && { color: COLORS.text_primary }]}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.spendBox}>
          <View style={styles.spendRow}>
            <Text style={styles.sectionLabel}>MONTHLY SPEND</Text>
            <Text style={styles.spendValue} testID="spend-value">
              {formatINR(spend)}
            </Text>
          </View>
          <Slider
            testID="spend-slider"
            minimumValue={2000}
            maximumValue={100000}
            step={1000}
            value={spend}
            onValueChange={(v) => setSpend(Math.round(v))}
            minimumTrackTintColor={COLORS.primary}
            maximumTrackTintColor={COLORS.border}
            thumbTintColor={COLORS.text_primary}
          />
        </View>

        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.lg }} />}

        {top && (
          <View style={styles.winner} testID="top-card">
            <Text style={styles.winnerEyebrow}>BEST FOR YOU</Text>
            <CreditCardVisual card={top} />
            <View style={styles.winnerRow}>
              <View>
                <Text style={styles.winnerLabel}>NET ANNUAL VALUE</Text>
                <Text style={styles.winnerValue}>
                  + {formatINR(top.annual_net_value)}
                </Text>
                <Text style={styles.winnerSub}>
                  {top.reward_pct}% effective on {category}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.winnerLabel}>ANNUAL FEE</Text>
                <Text style={styles.winnerFee}>{formatINR(top.annual_fee)}</Text>
              </View>
            </View>
            <Text style={styles.winnerHighlight}>{top.highlight}</Text>
          </View>
        )}

        <Text style={styles.rankTitle}>Full ranking</Text>
        {ranked.slice(1).map((c, idx) => (
          <View key={c.id} style={styles.rankCard} testID={`ranked-${c.id}`}>
            <Text style={styles.rankNum}>#{idx + 2}</Text>
            <View style={[styles.rankSwatch, { backgroundColor: c.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rankName}>{c.name}</Text>
              <Text style={styles.rankSub}>
                {c.reward_pct}% · {formatINR(c.monthly_back)}/mo
              </Text>
            </View>
            <Text
              style={[
                styles.rankNet,
                { color: c.annual_net_value < 0 ? COLORS.danger : COLORS.primary },
              ]}
            >
              {c.annual_net_value < 0 ? "" : "+"}
              {formatINR(c.annual_net_value)}
            </Text>
          </View>
        ))}

        <TouchableOpacity
          testID="apply-card-btn"
          style={styles.cta}
          onPress={() => setPaywall(true)}
        >
          <Text style={styles.ctaText}>Apply for {top?.name ?? "card"}</Text>
          <Ionicons name="arrow-forward" size={18} color="#060B19" />
        </TouchableOpacity>
      </ScrollView>

      <PaywallModal visible={paywall} onClose={() => setPaywall(false)} />
    </SafeAreaView>
  );
}

function CreditCardVisual({ card }: { card: any }) {
  return (
    <View style={cardStyles.wrap}>
      <LinearGradient
        colors={[card.color, "#060B19"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={cardStyles.card}
      >
        <View style={cardStyles.top}>
          <Text style={cardStyles.issuer}>{card.issuer}</Text>
          <Ionicons name="wifi" size={18} color="rgba(255,255,255,0.7)" />
        </View>
        <Text style={cardStyles.number}>•••• •••• •••• 8821</Text>
        <View style={cardStyles.bottom}>
          <View>
            <Text style={cardStyles.muted}>CARDHOLDER</Text>
            <Text style={cardStyles.name}>YOU</Text>
          </View>
          <Text style={cardStyles.brand}>{card.name.toUpperCase()}</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  wrap: { marginTop: SPACING.md },
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    height: 180,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  top: { flexDirection: "row", justifyContent: "space-between" },
  issuer: { color: "#fff", fontWeight: "800", fontSize: 18, letterSpacing: 1 },
  number: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 18,
    letterSpacing: 3,
    fontWeight: "600",
  },
  bottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  muted: { color: "rgba(255,255,255,0.55)", fontSize: 9, letterSpacing: 1.2, fontWeight: "700" },
  name: { color: "#fff", fontWeight: "700", marginTop: 2 },
  brand: { color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
});

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
  eyebrow: { color: COLORS.primary, fontSize: 11, letterSpacing: 1.6, fontWeight: "700" },
  title: {
    color: COLORS.text_primary,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -1,
    lineHeight: 36,
    marginTop: 4,
  },
  sub: { color: COLORS.text_secondary, marginTop: SPACING.sm, marginBottom: SPACING.lg, fontSize: 14 },
  sectionLabel: { color: COLORS.text_muted, fontSize: 10, letterSpacing: 1.4, fontWeight: "700" },
  catRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
  cat: {
    flex: 1,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    gap: 4,
  },
  catActive: { borderColor: COLORS.primary, backgroundColor: "rgba(16,185,129,0.08)" },
  catText: { fontSize: 11, color: COLORS.text_secondary, fontWeight: "600" },
  spendBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginTop: SPACING.md,
  },
  spendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  spendValue: { color: COLORS.primary, fontSize: 18, fontWeight: "800" },
  winner: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.4)",
    padding: SPACING.lg,
  },
  winnerEyebrow: {
    color: COLORS.primary,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "700",
  },
  winnerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SPACING.md,
  },
  winnerLabel: {
    color: COLORS.text_muted,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  winnerValue: { color: COLORS.primary, fontSize: 26, fontWeight: "800", marginTop: 2 },
  winnerSub: { color: COLORS.text_secondary, fontSize: 12, marginTop: 2 },
  winnerFee: { color: COLORS.text_primary, fontSize: 16, fontWeight: "700", marginTop: 2 },
  winnerHighlight: {
    color: COLORS.text_secondary,
    fontStyle: "italic",
    fontSize: 12,
    marginTop: SPACING.md,
  },
  rankTitle: {
    color: COLORS.text_primary,
    fontWeight: "800",
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    fontSize: 16,
  },
  rankCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  rankNum: { color: COLORS.text_muted, fontWeight: "800", width: 26 },
  rankSwatch: { width: 8, height: 36, borderRadius: 4 },
  rankName: { color: COLORS.text_primary, fontWeight: "700", fontSize: 14 },
  rankSub: { color: COLORS.text_secondary, fontSize: 11, marginTop: 2 },
  rankNet: { fontWeight: "800", fontSize: 13 },
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
  ctaText: { color: "#060B19", fontWeight: "800", fontSize: 15 },
});
