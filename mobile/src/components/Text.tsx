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
export function Text({ style, ...rest }: TextProps) {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const { fontWeight, fontFamily, ...others } = flat;
  const family = fontFamily ?? fontFor(fontWeight) ?? fonts.regular;
  return <RNText {...rest} style={[others, { fontFamily: family }]} />;
}

export type { TextProps };
