import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { C, R } from '@/constants/Theme';

type Variant = 'default' | 'surface' | 'primary' | 'accent' | 'success' | 'warning';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  variant?: Variant;
  noPadding?: boolean;
}

const variantMap: Record<Variant, ViewStyle> = {
  default: { backgroundColor: C.card, borderColor: C.border },
  surface: { backgroundColor: C.surface, borderColor: C.border },
  primary: { backgroundColor: C.primaryBg, borderColor: C.primaryBorder },
  accent: { backgroundColor: C.accentBg, borderColor: C.accentBorder },
  success: { backgroundColor: C.successBg, borderColor: C.successBorder },
  warning: { backgroundColor: C.warningBg, borderColor: C.warningBorder },
};

export default function Card({
  children,
  style,
  variant = 'default',
  noPadding = false,
}: CardProps) {
  return (
    <View style={[styles.base, variantMap[variant], noPadding && styles.noPadding, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: R.lg,
    padding: 16,
    borderWidth: 1,
  },
  noPadding: {
    padding: 0,
  },
});
