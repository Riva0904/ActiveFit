import React from 'react';
import { Image, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { Icon } from './Icon';
import { useGymIdentity } from '../hooks/useGymIdentity';
import { colors, radius, spacing, tint, typography } from '../theme';

/**
 * Which gym you are looking at. Shown to everyone who belongs to one, so a
 * member, trainer or staff member can see their gym's name in the app.
 * Renders nothing when there is no gym to name.
 */
export function GymBadge({ style }: { style?: ViewStyle }) {
  const { name, logo } = useGymIdentity();
  if (!name) return null;

  return (
    <View style={[styles.badge, style]}>
      {logo ? (
        <Image source={{ uri: logo }} style={styles.logo} />
      ) : (
        <View style={styles.logoFallback}>
          <Icon name="bank-outline" size={11} color={colors.primary} />
        </View>
      )}
      <Text style={styles.name} numberOfLines={1}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: tint(colors.primary, '14'),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: tint(colors.primary, '33'),
    paddingLeft: 4,
    paddingRight: spacing.md,
    paddingVertical: 3,
  },
  logo: { width: 18, height: 18, borderRadius: 9 },
  logoFallback: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: tint(colors.primary, '22'),
    alignItems: 'center', justifyContent: 'center',
  },
  name: { color: colors.primary, ...typography.micro, fontWeight: '700', flexShrink: 1 },
});
