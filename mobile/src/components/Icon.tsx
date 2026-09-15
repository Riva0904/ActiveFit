import React from 'react';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';

/**
 * Line-style icons. Feather covers most of the UI; MaterialCommunityIcons fills the
 * fitness-specific gaps Feather lacks (dumbbell, run, fire, food…). Names are a closed
 * union so a typo fails `tsc` instead of rendering a blank glyph.
 */
const FEATHER = [
  'home', 'calendar', 'user', 'users', 'shopping-cart', 'bell', 'lock', 'edit-2', 'credit-card',
  'gift', 'refresh-cw', 'award', 'dollar-sign', 'zap', 'chevron-left', 'chevron-right', 'check',
  'x', 'plus', 'search', 'smartphone', 'bar-chart-2', 'clock', 'log-out', 'message-circle',
  'headphones', 'trending-up', 'activity', 'map-pin', 'play', 'pause', 'square', 'send',
  'image', 'trash-2', 'info', 'alert-circle', 'copy', 'share-2', 'star', 'heart', 'settings',
  'file-text', 'package', 'minus', 'more-horizontal', 'camera', 'inbox', 'sun', 'moon', 'mail',
  'user-plus', 'user-x', 'user-check', 'filter', 'pie-chart', 'percent', 'phone', 'slash', 'list', 'grid',
] as const;

const MCI = [
  'dumbbell', 'run', 'fire', 'food-apple-outline', 'trophy-outline', 'medal-outline',
  'scale-bathroom', 'qrcode', 'map-marker-path', 'chart-timeline-variant', 'calendar-check',
  'account-heart-outline', 'pill', 'whistle-outline', 'ticket-percent-outline',
  'crown-outline', 'cash-multiple', 'receipt', 'account-group-outline', 'clipboard-text-outline', 'bank-outline',
] as const;

export type FeatherName = (typeof FEATHER)[number];
export type MciName = (typeof MCI)[number];
export type IconName = FeatherName | MciName;

const MCI_SET = new Set<string>(MCI);

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: any;
}

export function Icon({ name, size = 22, color = colors.textSecondary, style }: IconProps) {
  if (MCI_SET.has(name)) {
    return <MaterialCommunityIcons name={name as MciName} size={size} color={color} style={style} />;
  }
  return <Feather name={name as FeatherName} size={size} color={color} style={style} />;
}
