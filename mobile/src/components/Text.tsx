import React from 'react';
import { Text as RNText, StyleSheet, type TextProps, type TextStyle } from 'react-native';
import { fonts, fontFor } from '../theme';

/**
 * Drop-in replacement for react-native's Text that renders in Inter.
 *
 * Every screen keeps writing `fontWeight: '700'` etc.; this component maps the
 * weight to the matching static Inter face (Inter_700Bold) and removes the
 * `fontWeight` so Android doesn't synthesise a second bold on top of it.
 * An explicit `fontFamily` in the style always wins.
 */
export function Text({ style, maxFontSizeMultiplier = 1.2, ...rest }: TextProps) {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const { fontWeight, fontFamily, ...others } = flat;
  const family = fontFamily ?? fontFor(fontWeight) ?? fonts.regular;
  // Cap OS font scaling so "Large text" accessibility settings don't blow up
  // fixed layouts (chat bubbles, stat rows); 1.2 keeps them readable but intact.
  return <RNText {...rest} maxFontSizeMultiplier={maxFontSizeMultiplier} style={[others, { fontFamily: family }]} />;
}

export type { TextProps };
