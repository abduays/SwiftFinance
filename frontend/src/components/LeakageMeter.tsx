import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { COLORS, RADIUS, SPACING } from "../theme";
import { formatINR } from "../api";

export default function LeakageMeter({
  monthly,
  annual,
}: {
  monthly: number;
  annual: number;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: false }),
      ])
    ).start();
  }, [pulse]);

  const bg = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,59,48,0.06)", "rgba(255,59,48,0.18)"],
  });

  return (
    <Animated.View style={[styles.wrap, { backgroundColor: bg }]} testID="leakage-meter">
      <View style={styles.row}>
        <View style={styles.dot} />
        <Text style={styles.label}>WEALTH LEAKAGE DETECTED</Text>
      </View>
      <Text style={styles.amount} testID="leakage-amount">
        - {formatINR(monthly)} <Text style={styles.per}>/ month</Text>
      </Text>
      <Text style={styles.sub}>
        That&apos;s {formatINR(annual)} draining out every year.
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: "rgba(255,59,48,0.35)",
    marginBottom: SPACING.lg,
  },
  row: { flexDirection: "row", alignItems: "center", marginBottom: SPACING.sm },
  dot: {
    width: 8,
    height: 8,
    backgroundColor: COLORS.danger,
    borderRadius: 4,
    marginRight: SPACING.sm,
  },
  label: {
    color: COLORS.danger,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "700",
  },
  amount: {
    color: COLORS.danger,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  per: { fontSize: 16, color: COLORS.text_secondary, fontWeight: "500" },
  sub: { color: COLORS.text_secondary, marginTop: SPACING.xs, fontSize: 13 },
});
