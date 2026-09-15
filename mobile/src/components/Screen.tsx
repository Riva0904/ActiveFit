import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type RefreshControlProps, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, gradients, spacing } from '../theme';

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
 * Root of every screen: navy ground with a faint top→bottom gradient (the
 * reference dashboard's page is never a flat colour) + real safe-area top
 * inset. All stacks run with `headerShown: false`, so the inset is always ours.
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

  const ground = <LinearGradient colors={[...gradients.screen]} style={StyleSheet.absoluteFill} pointerEvents="none" />;

  if (keyboard) {
    return (
      <KeyboardAvoidingView style={[styles.root, style]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {ground}
        {body}
      </KeyboardAvoidingView>
    );
  }
  return (
    <View style={[styles.root, style]}>
      {ground}
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  padded: { paddingHorizontal: spacing.screen },
});
