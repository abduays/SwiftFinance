import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useAuth, authedFetch } from "../auth";
import RazorpayCheckout, { CheckoutOrder } from "./RazorpayCheckout";

const FEATURES = [
  "Detailed Loan Switch Plan PDF",
  "Personalised Credit-Card portfolio",
  "Tax filing helper (FY 2026-27)",
  "Unlimited AI advisor chats",
  "Quarterly leakage audits & alerts",
];

export default function PaywallModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { user, token, refresh } = useAuth();
  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [success, setSuccess] = useState(false);

  const startCheckout = async () => {
    if (!user || !token) {
      Alert.alert("Please sign in", "Sign in first to subscribe.");
      onClose();
      return;
    }
    setBusy(true);
    try {
      const o = (await authedFetch("/payments/order", {
        method: "POST",
        body: JSON.stringify({ plan }),
      }, token)) as CheckoutOrder;
      setOrder(o);
    } catch (e: any) {
      Alert.alert("Order failed", e?.message ?? "Could not create order.");
    } finally {
      setBusy(false);
    }
  };

  const handleResult = async (r: { type: string; payload?: any }) => {
    if (r.type === "dismiss") {
      setOrder(null);
      return;
    }
    if (r.type === "failed") {
      Alert.alert("Payment failed", r.payload?.description ?? "Please try again.");
      setOrder(null);
      return;
    }
    if (r.type === "success" && r.payload) {
      try {
        await authedFetch("/payments/verify", {
          method: "POST",
          body: JSON.stringify({
            razorpay_order_id: r.payload.razorpay_order_id,
            razorpay_payment_id: r.payload.razorpay_payment_id,
            razorpay_signature: r.payload.razorpay_signature,
          }),
        }, token);
        await refresh();
        setOrder(null);
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 1800);
      } catch (e: any) {
        Alert.alert("Verification failed", e?.message ?? "Try again.");
        setOrder(null);
      }
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {order ? (
          <View style={styles.fullSheet} testID="paywall-checkout">
            <View style={styles.checkoutBar}>
              <TouchableOpacity onPress={() => setOrder(null)} testID="checkout-back">
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.checkoutBarText}>Razorpay Checkout</Text>
              <View style={{ width: 22 }} />
            </View>
            <RazorpayCheckout
              order={order}
              user={{ name: user?.name, email: user?.email }}
              onResult={handleResult}
            />
          </View>
        ) : success ? (
          <View style={styles.sheet} testID="paywall-success">
            <LinearGradient
              colors={[COLORS.surface, COLORS.background]}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.successBadge}>
              <Ionicons name="checkmark-circle" size={56} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>You&apos;re premium.</Text>
            <Text style={styles.subtitle}>Subscription active. Closing…</Text>
          </View>
        ) : (
          <View style={styles.sheet} testID="paywall-modal">
            <LinearGradient
              colors={[COLORS.surface, COLORS.background]}
              style={StyleSheet.absoluteFillObject}
            />
            <TouchableOpacity onPress={onClose} style={styles.close} testID="paywall-close">
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
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
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
              style={[styles.cta, busy && { opacity: 0.6 }]}
              onPress={startCheckout}
              disabled={busy}
              testID="paywall-unlock"
            >
              {busy ? (
                <ActivityIndicator color="#060B19" />
              ) : (
                <>
                  <Text style={styles.ctaText}>
                    Pay ₹{plan === "yearly" ? "899" : "99"} via Razorpay
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#060B19" />
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.footer}>
              UPI / Cards / Net-banking · Cancel anytime · 256-bit secure
            </Text>
          </View>
        )}
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
  fullSheet: {
    flex: 1,
    backgroundColor: COLORS.background,
    marginTop: 40,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    overflow: "hidden",
  },
  checkoutBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  checkoutBarText: { color: COLORS.text_primary, fontWeight: "700" },
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
  successBadge: { alignItems: "center", marginVertical: SPACING.lg },
  features: { marginTop: SPACING.lg, gap: SPACING.sm },
  featureRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  featureText: { color: COLORS.text_primary, fontSize: 15 },
  plans: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.lg },
  plan: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: SPACING.md,
    position: "relative",
  },
  planActive: { borderColor: COLORS.primary, backgroundColor: "rgba(16,185,129,0.08)" },
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
