import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

// ─── Chip: selectable pill (goal / level / day pickers) ──────────────────────

export function Chip({ label, selected, onPress, style }: { label: string; selected?: boolean; onPress: () => void; style?: ViewStyle }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.chip, selected && styles.chipOn, style]}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

// ─── FieldLabel + TextField ─────────────────────────────────────────────────

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

export function TextField({ style, multiline, ...rest }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.textFaint}
      selectionColor={colors.primary}
      multiline={multiline}
      style={[styles.input, multiline && styles.inputMultiline, style]}
      {...rest}
    />
  );
}

export function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.field, style]}>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, ...typography.label, fontWeight: '600' },
  chipTextOn: { color: colors.white },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  field: { marginBottom: spacing.xxl },
  fieldLabel: { color: colors.textSecondary, ...typography.caption, fontWeight: '600', marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    color: colors.text, fontSize: 14, paddingHorizontal: spacing.lg, paddingVertical: 12,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
});
