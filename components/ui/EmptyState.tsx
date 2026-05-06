import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F, R } from '@/constants/Theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  icon: IoniconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, title, message, actionLabel, onAction }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={36} color={C.textMuted} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.btn} onPress={onAction} activeOpacity={0.7}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: F.md,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    fontSize: F.sm,
    color: C.textSub,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  btn: {
    backgroundColor: C.primaryBg,
    borderWidth: 1,
    borderColor: C.primaryBorder,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: R.full,
  },
  btnText: {
    fontSize: F.sm,
    color: C.primary,
    fontWeight: '700',
  },
});
