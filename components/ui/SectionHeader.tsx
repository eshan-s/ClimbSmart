import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C, F } from '@/constants/Theme';

interface Props {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}

export default function SectionHeader({ title, subtitle, action, onAction }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action ? (
        <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.action}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  left: {
    flex: 1,
  },
  title: {
    fontSize: F.md,
    fontWeight: '700',
    color: C.text,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: F.xs,
    color: C.textSub,
    marginTop: 2,
  },
  action: {
    fontSize: F.sm,
    color: C.primary,
    fontWeight: '600',
    paddingLeft: 12,
  },
});
