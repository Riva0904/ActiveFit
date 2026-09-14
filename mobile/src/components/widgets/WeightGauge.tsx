import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { useAnimatedReaction, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { HeroStat } from '../Stats';
import { colors, spacing, typography } from '../../theme';
import { PX_PER_STEP, STEP, TICK_COUNT, WEIGHT_MIN, offsetToWeight, snapWeight, tickKind, tickLabel, weightToOffset } from '../../lib/weight';

interface WeightGaugeProps {
  value: number;
  onChange: (kg: number) => void;
  /** Fires when the ruler settles (momentum end) — use for network writes. */
  onCommit?: (kg: number) => void;
  unit?: string;
  label?: string;
  height?: number;
}

const TICK_H = { major: 34, mid: 22, minor: 12 } as const;

/**
 * Horizontal ruler slider. A native ScrollView gives momentum + snapping for free;
 * reanimated mirrors the scroll offset on the UI thread and only hops to JS when the
 * snapped step actually changes, so the hero number tracks the needle without jank.
 */
export function WeightGauge({ value, onChange, onCommit, unit = 'kg', label, height = 96 }: WeightGaugeProps) {
  const scrollRef = useRef<Animated.ScrollView>(null);
  const [width, setWidth] = useState(0);
  const scrollX = useSharedValue(weightToOffset(value));
  const lastStep = useRef(Math.round(weightToOffset(value) / PX_PER_STEP));
  const initialised = useRef(false);

  const onStep = useCallback((steps: number) => {
    const kg = snapWeight(WEIGHT_MIN + steps * STEP);
    if (steps !== lastStep.current) {
      // Light tick on every whole kg; keeps the ruler feeling physical without buzzing on halves.
      if (Math.abs(kg % 1) < 1e-9) Haptics.selectionAsync().catch(() => {});
      lastStep.current = steps;
      onChange(kg);
    }
  }, [onChange]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollX.value = e.contentOffset.x; },
  });

  useAnimatedReaction(
    () => Math.round(scrollX.value / PX_PER_STEP),
    (steps, prev) => { if (prev !== null && steps !== prev) scheduleOnRN(onStep, steps); },
    [onStep],
  );

  // Position the strip on first layout, and whenever the parent pushes a new value
  // that differs from where the needle is (e.g. logs loaded after mount).
  useEffect(() => {
    if (!width) return;
    const target = weightToOffset(value);
    const current = lastStep.current * PX_PER_STEP;
    if (!initialised.current || Math.abs(target - current) >= PX_PER_STEP) {
      scrollRef.current?.scrollTo({ x: target, animated: initialised.current });
      lastStep.current = Math.round(target / PX_PER_STEP);
      initialised.current = true;
    }
  }, [value, width]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => onCommit?.(offsetToWeight(e.nativeEvent.contentOffset.x));

  const side = Math.max(0, width / 2);

  return (
    <View>
      <HeroStat value={value.toFixed(1)} unit={unit} label={label} />
      <View style={[styles.rulerWrap, { height }]} onLayout={onLayout}>
        {width > 0 && (
          <Animated.ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            snapToInterval={PX_PER_STEP}
            decelerationRate="fast"
            onMomentumScrollEnd={onMomentumEnd}
            onScrollEndDrag={onMomentumEnd}
            contentContainerStyle={{ paddingHorizontal: side, alignItems: 'flex-end', height }}
          >
            {Array.from({ length: TICK_COUNT }, (_, i) => {
              const kind = tickKind(i);
              return (
                <View key={i} style={[styles.tickSlot, { width: PX_PER_STEP, height }]}>
                  {kind === 'major' ? <Text style={styles.tickLabel}>{tickLabel(i)}</Text> : null}
                  <View style={[styles.tick, { height: TICK_H[kind] }, kind === 'major' && styles.tickMajor]} />
                </View>
              );
            })}
          </Animated.ScrollView>
        )}
        {/* Fixed centre needle */}
        <View pointerEvents="none" style={styles.needleWrap}>
          <View style={styles.needleHead} />
          <View style={styles.needle} />
        </View>
        {/* Edge fades */}
        <View pointerEvents="none" style={[styles.fade, styles.fadeLeft]} />
        <View pointerEvents="none" style={[styles.fade, styles.fadeRight]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rulerWrap: { marginTop: spacing.lg, overflow: 'hidden', justifyContent: 'flex-end' },
  tickSlot: { alignItems: 'center', justifyContent: 'flex-end' },
  tick: { width: 2, borderRadius: 1, backgroundColor: colors.textFaint },
  tickMajor: { backgroundColor: colors.textSecondary },
  tickLabel: { position: 'absolute', top: 0, color: colors.textMuted, ...typography.micro, ...typography.number, width: 40, textAlign: 'center' },
  needleWrap: { position: 'absolute', left: '50%', marginLeft: -6, bottom: 0, alignItems: 'center' },
  needleHead: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: colors.primary, marginBottom: 2 },
  needle: { width: 3, height: 40, borderRadius: 1.5, backgroundColor: colors.primary },
  fade: { position: 'absolute', top: 0, bottom: 0, width: 36, backgroundColor: colors.surface, opacity: 0.85 },
  fadeLeft: { left: 0 },
  fadeRight: { right: 0 },
});
