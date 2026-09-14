import { DarkTheme, type Theme } from '@react-navigation/native';
import { colors } from './index';

/** Keeps screen-transition backgrounds dark instead of the library's default light card. */
export const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.primary,
  },
};
