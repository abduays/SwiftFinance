import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, ScrollView } from "react-native";
import Svg, { Line, Path, Circle } from "react-native-svg";
import { COLORS, RADIUS, SPACING } from "../theme";
import { getSnapshots, Snapshot } from "../storage";
import { formatINR } from "../api";

export default function LeakageTimeline() {
  const [snaps, setSnaps] = useState<Snapshot[]>([]);

  useEffect(() => {
    let active = true;
    getSnapshots().then((d) => active && setSnaps(d));
    return () => {
      active = false;
    };
  }, []);

  if (snaps.length < 2) {
    return (
      <View style={styles.empty} testID="timeline-empty">
        <Text style={styles.emptyTitle}>No timeline yet</Text>
        <Text style={styles.emptySub}>
          Edit your inputs in onboarding to start tracking your leakage over time.
        </Text>
      </View>
    );
  }

  // Reverse so oldest first for the chart
  const points = [...snaps].reverse().map((s, i) => ({ x: i, y: s.monthly_leakage, ts: s.ts }));
  const w = 320, h = 110;
  const pad = { l: 8, r: 8, t: 12, b: 18 };
  const xs = (i: number) => pad.l + ((w - pad.l - pad.r) * i) / Math.max(points.length - 1, 1);
  const maxY = Math.max(...points.map((p) => p.y)) * 1.1 || 1;
  const ys = (y: number) => h - pad.b - ((h - pad.t - pad.b) * y) / maxY;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xs(i).toFixed(1)} ${ys(p.y).toFixed(1)}`)
    .join(" ");

  const latest = snaps[0];
  const previous = snaps[1] ?? snaps[0];
  const delta = latest.monthly_leakage - previous.monthly_leakage;
  const trendDown = delta < 0;

  return (
    <View style={styles.wrap} testID="timeline">
      <View style={styles.head}>
        <View>
          <Text style={styles.label}>YOUR LEAKAGE TIMELINE</Text>
          <Text style={styles.now}>{formatINR(latest.monthly_leakage)} /mo</Text>
        </View>
        <View
          style={[
            styles.deltaPill,
            { borderColor: trendDown ? COLORS.primary : COLORS.danger },
          ]}
        >
          <Text
            style={[
              styles.deltaText,
              { color: trendDown ? COLORS.primary : COLORS.danger },
            ]}
          >
            {trendDown ? "▼" : "▲"} {formatINR(Math.abs(delta))}
          </Text>
        </View>
      </View>

      <Svg width={w} height={h}>
        {[0.25, 0.5, 0.75].map((f, i) => (
          <Line
            key={i}
            x1={pad.l}
            x2={w - pad.r}
            y1={pad.t + (h - pad.t - pad.b) * f}
            y2={pad.t + (h - pad.t - pad.b) * f}
            stroke={COLORS.border}
            strokeDasharray="2,4"
          />
        ))}
        <Path d={path} stroke={COLORS.primary} strokeWidth={2.5} fill="none" />
        {points.map((p, i) => (
          <Circle
            key={i}
            cx={xs(i)}
            cy={ys(p.y)}
            r={3}
            fill={COLORS.primary}
            stroke={COLORS.background}
            strokeWidth={1.5}
          />
        ))}
      </Svg>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.list}>
        {snaps.slice(0, 8).map((s, i) => (
          <View key={s.ts} style={styles.item}>
            <Text style={styles.itemTs}>
              {new Date(s.ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
            </Text>
            <Text style={styles.itemAmt}>{formatINR(s.monthly_leakage)}</Text>
            <Text style={styles.itemSub}>{i === 0 ? "latest" : `${i} step ago`}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  empty: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  emptyTitle: { color: COLORS.text_primary, fontWeight: "700" },
  emptySub: { color: COLORS.text_secondary, fontSize: 12, marginTop: 4 },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  label: { color: COLORS.text_muted, fontSize: 10, letterSpacing: 1.2, fontWeight: "700" },
  now: { color: COLORS.text_primary, fontWeight: "800", fontSize: 22, marginTop: 2 },
  deltaPill: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  deltaText: { fontSize: 12, fontWeight: "800" },
  list: { marginTop: SPACING.sm, gap: SPACING.sm },
  item: {
    backgroundColor: COLORS.surface_highlight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    minWidth: 100,
  },
  itemTs: { color: COLORS.text_muted, fontSize: 10, fontWeight: "700" },
  itemAmt: { color: COLORS.text_primary, fontWeight: "800", marginTop: 2 },
  itemSub: { color: COLORS.text_secondary, fontSize: 10, marginTop: 2 },
});
