import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C, F, R } from '@/constants/Theme';

interface Segment<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  selected: T;
  onSelect: (value: T) => void;
  activeColor?: string;
}

export default function SegmentedControl<T extends string>({
  segments,
  selected,
  onSelect,
  activeColor = C.primary,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.container}>
      {segments.map((seg) => {
        const active = seg.value === selected;
        return (
          <TouchableOpacity
            key={seg.value}
            style={[
              styles.segment,
              active && { backgroundColor: activeColor + '20', borderColor: activeColor },
            ]}
            onPress={() => onSelect(seg.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.label,
                active ? { color: activeColor, fontWeight: '700' } : {},
              ]}
            >
              {seg.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  label: {
    fontSize: F.sm,
    color: C.textSub,
    fontWeight: '600',
  },
});
