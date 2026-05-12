import React from "react";
import { View } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Path,
  Stop,
  Line,
  G,
  Text as SvgText,
} from "react-native-svg";
import { COLORS } from "../theme";

type Series = { x: number; y: number }[];

export default function AreaChart({
  width = 320,
  height = 180,
  current,
  switched,
}: {
  width?: number;
  height?: number;
  current: Series;
  switched: Series;
}) {
  if (!current?.length || !switched?.length) return <View style={{ height }} />;

  const all = [...current, ...switched];
  const maxY = Math.max(...all.map((p) => p.y)) * 1.08;
  const maxX = Math.max(...all.map((p) => p.x));
  const pad = { top: 12, right: 12, bottom: 22, left: 12 };

  const sx = (x: number) => pad.left + ((width - pad.left - pad.right) * x) / maxX;
  const sy = (y: number) =>
    height - pad.bottom - ((height - pad.top - pad.bottom) * y) / maxY;

  const toPath = (data: Series, close = false) => {
    if (!data.length) return "";
    let d = `M ${sx(data[0].x)} ${sy(data[0].y)}`;
    for (let i = 1; i < data.length; i++) {
      d += ` L ${sx(data[i].x)} ${sy(data[i].y)}`;
    }
    if (close) {
      d += ` L ${sx(data[data.length - 1].x)} ${height - pad.bottom}`;
      d += ` L ${sx(data[0].x)} ${height - pad.bottom} Z`;
    }
    return d;
  };

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="gCur" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={COLORS.danger} stopOpacity="0.5" />
          <Stop offset="1" stopColor={COLORS.danger} stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="gSwi" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={COLORS.primary} stopOpacity="0.45" />
          <Stop offset="1" stopColor={COLORS.primary} stopOpacity="0" />
        </LinearGradient>
      </Defs>

      <G>
        {[0.25, 0.5, 0.75].map((f, i) => (
          <Line
            key={i}
            x1={pad.left}
            x2={width - pad.right}
            y1={pad.top + (height - pad.top - pad.bottom) * f}
            y2={pad.top + (height - pad.top - pad.bottom) * f}
            stroke={COLORS.border}
            strokeDasharray="2,4"
            strokeWidth={1}
          />
        ))}
      </G>

      <Path d={toPath(current, true)} fill="url(#gCur)" />
      <Path d={toPath(current)} stroke={COLORS.danger} strokeWidth={2} fill="none" />

      <Path d={toPath(switched, true)} fill="url(#gSwi)" />
      <Path d={toPath(switched)} stroke={COLORS.primary} strokeWidth={2} fill="none" />

      <SvgText
        x={pad.left}
        y={height - 6}
        fill={COLORS.text_muted}
        fontSize="10"
        fontWeight="600"
      >
        YR 1
      </SvgText>
      <SvgText
        x={width - pad.right - 26}
        y={height - 6}
        fill={COLORS.text_muted}
        fontSize="10"
        fontWeight="600"
      >
        END
      </SvgText>
    </Svg>
  );
}
