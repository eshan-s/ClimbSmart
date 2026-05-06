import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, F } from '@/constants/Theme';

interface BarSeries {
  value: number;
  color: string;
}

interface MiniBarChartProps {
  /** Array of x-axis data points */
  data: {
    label: string;
    sublabel?: string;
    bars: BarSeries[];
  }[];
  /** Max value to normalise bars against (defaults to computed max) */
  maxValue?: number;
  /** Height of the bar area in px (default 72) */
  chartHeight?: number;
  /** Width of each individual bar (default 10) */
  barWidth?: number;
  legend?: { color: string; label: string }[];
}

export default function MiniBarChart({
  data,
  maxValue,
  chartHeight = 72,
  barWidth = 10,
  legend,
}: MiniBarChartProps) {
  const computed = maxValue ?? Math.max(1, ...data.flatMap((d) => d.bars.map((b) => b.value)));

  return (
    <View>
      <View style={[styles.chart, { height: chartHeight }]}>
        {data.map((d, i) => (
          <View key={i} style={styles.group}>
            <View style={[styles.barRow, { height: chartHeight - 4 }]}>
              {d.bars.map((b, j) => {
                const h = Math.max(3, Math.round((b.value / computed) * (chartHeight - 4)));
                return (
                  <View
                    key={j}
                    style={[
                      styles.bar,
                      {
                        width: barWidth,
                        height: h,
                        backgroundColor: b.value > 0 ? b.color : C.border,
                        borderRadius: barWidth / 2,
                      },
                    ]}
                  />
                );
              })}
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {d.label}
            </Text>
            {d.sublabel ? (
              <Text style={styles.sublabel} numberOfLines={1}>
                {d.sublabel}
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      {legend && legend.length > 0 && (
        <View style={styles.legend}>
          {legend.map((l, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: l.color }]} />
              <Text style={styles.legendText}>{l.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  group: {
    alignItems: 'center',
    flex: 1,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    marginBottom: 4,
  },
  bar: {},
  label: {
    fontSize: 9,
    color: C.textMuted,
    textAlign: 'center',
  },
  sublabel: {
    fontSize: 8,
    color: C.textMuted,
    textAlign: 'center',
    opacity: 0.7,
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: F.xs,
    color: C.textSub,
  },
});
