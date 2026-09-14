import React from 'react';
import { Card } from '../Card';
import { Checkbox, ListRow } from '../Primitives';
import type { IconName } from '../Icon';
import { colors } from '../../theme';

export interface ChecklistItem {
  key: string;
  icon: IconName;
  label: string;
  subtitle?: string;
  done: boolean;
  /** Tapping the row or checkbox. Omit for read-only items. */
  onPress?: () => void;
  color?: string;
  busy?: boolean;
}

/** Today's activity checklist — icon + label + checkbox rows, like the reference's "Dolor sit amet ✓" cards. */
export function ActivityChecklist({ items }: { items: ChecklistItem[] }) {
  if (items.length === 0) return null;
  return (
    <Card padding="none">
      {items.map((it, i) => (
        <ListRow
          key={it.key}
          icon={it.icon}
          iconColor={it.done ? colors.success : it.color ?? colors.primary}
          label={it.label}
          subtitle={it.subtitle}
          onPress={it.onPress}
          last={i === items.length - 1}
          right={<Checkbox checked={it.done} onToggle={it.onPress} disabled={it.busy || !it.onPress} />}
        />
      ))}
    </Card>
  );
}
