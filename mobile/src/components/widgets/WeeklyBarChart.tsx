import React, { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { colors, spacing, typography } from '../../theme';
import { DAY_LETTERS, scaleBars } from '../../lib/weekly';

interface WeeklyBarChartProps {
  /** 7 values, Sunday → Saturday. */
  values: ReadonlyArray<number>;
  /** Bar drawn in the accent colour (usually today). */
  highlightIndex?: number;
  height?: number;
  /** Label shown above the highlighted bar, e.g. "45 min". */
  highlightLabel?: string;
  /** Mark bars as "present" (solid) vs empty when values carry no magnitude. */
  presence?: ReadonlyArray<boolean>;
}

const LABEL_H = 18;
const TOP_PAD = 16;

/** S–S bar chart drawn with react-native-svg; fully driven by the pure helpers in lib/weekly. */
export function WeeklyBarChart({ values, highlightIndex, height = 120, highlightLabel, presence }: WeeklyBarChartProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const chartH = height - LABEL_H - TOP_PAD;
  const heights = scaleBars(values, chartH, 4);
  const slot = width / 7;
  const barW = Math.min(18, Math.max(8, slot * 0.42));

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {heights.map((h, i) => {
            const active = i === highlightIndex;
            const filled = presence ? presence[i] : values[i] > 0;
            const x = slot * i + (slot - barW) / 2;
            const y = TOP_PAD + chartH - h;
            return (
              <React.Fragment key={i}>
                <Rect
                  x={x} y={y} width={barW} height={h} rx={barW / 2}
                  fill={active ? colors.primary : filled ? colors.textFaint : colors.border}
                  opacity={active || filled ? 1 : 0.6}
                />
                {active && highlightLabel ? (
                  <SvgText x={x + barW / 2} y={Math.max(11, y - 6)} fill={colors.primary} fontSize={11} fontWeight="700" textAnchor="middle">
                    {highlightLabel}
                  </SvgText>
                ) : null}
                <SvgText x={x + barW / 2} y={height - 3} fill={active ? colors.text : colors.textMuted} fontSize={11} fontWeight={active ? '700' : '600'} textAnchor="middle">
                  {DAY_LETTERS[i]}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

export function ChartLegend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <View style={styles.legend}>
      {items.map((it) => (
        <View key={it.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: it.color }]} />
          <Text style={styles.legendText}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.textMuted, ...typography.micro },
});
