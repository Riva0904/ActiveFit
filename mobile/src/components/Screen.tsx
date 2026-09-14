import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type RefreshControlProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

interface ScreenProps {
  children: React.ReactNode;
  /** Wrap in a ScrollView. Never use with a FlatList child — put the list inside a plain Screen. */
  scroll?: boolean;
  /** Horizontal screen padding (default true). Turn off for edge-to-edge lists that pad their own content. */
  padded?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentContainerStyle?: ViewStyle;
  /** Wrap in KeyboardAvoidingView (chat / forms). */
  keyboard?: boolean;
  style?: ViewStyle;
}

/**
 * Root of every screen: dark ground + real safe-area top inset (replaces the
 * hardcoded `paddingTop: 56` every screen used to carry). All stacks run with
 * `headerShown: false`, so the inset is always ours to apply.
 */
export function Screen({ children, scroll, padded = true, refreshControl, contentContainerStyle, keyboard, style }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const top = insets.top + spacing.md;

  let body: React.ReactNode;
  if (scroll) {
    body = (
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[{ paddingTop: top, paddingBottom: spacing.xxl + insets.bottom }, padded && styles.padded, contentContainerStyle]}
        refreshControl={refreshControl}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  } else {
    body = <View style={[styles.fill, { paddingTop: top }, padded && styles.padded, contentContainerStyle]}>{children}</View>;
  }

  if (keyboard) {
    return (
      <KeyboardAvoidingView style={[styles.fill, style]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
      </KeyboardAvoidingView>
    );
  }
  return <View style={[styles.fill, style]}>{body}</View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  padded: { paddingHorizontal: spacing.screen },
});
