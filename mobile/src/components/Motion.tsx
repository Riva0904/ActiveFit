import React, { useEffect, useId, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { colors } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPRING = { damping: 16, stiffness: 320, mass: 0.6 };

// ─── Enter: staggered fade + slide-up on mount ──────────────────────────────

/** Wrap a card/section; `index` staggers siblings (≈60 ms apart, capped). */
export function Enter({ index = 0, children, style }: { index?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 60).duration(420)} style={style}>
      {children}
    </Animated.View>
  );
}

// ─── PressScale: springy press feedback ─────────────────────────────────────

interface PressScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  children: React.ReactNode;
}

export function PressScale({ style, scaleTo = 0.96, children, onPressIn, onPressOut, disabled, ...rest }: PressScaleProps) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => { s.value = withSpring(scaleTo, SPRING); onPressIn?.(e); }}
      onPressOut={(e) => { s.value = withSpring(1, SPRING); onPressOut?.(e); }}
      style={[style, anim]}
    >
      {children}
    </AnimatedPressable>
  );
}

// ─── GlowOrb: soft radial light, optionally breathing ───────────────────────

interface GlowOrbProps {
  size?: number;
  color?: string;
  /** Peak opacity at the centre (0–1). */
  intensity?: number;
  /** Slow scale/opacity loop. */
  breathe?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function GlowOrb({ size = 260, color = colors.primary, intensity = 0.55, breathe = false, style }: GlowOrbProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const t = useSharedValue(0);
  useEffect(() => {
    if (!breathe) return;
    t.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [breathe, t]);
  const anim = useAnimatedStyle(() => ({
    opacity: breathe ? 0.75 + t.value * 0.25 : 1,
    transform: [{ scale: breathe ? 1 + t.value * 0.12 : 1 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.orb, { width: size, height: size }, style, anim]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`glow${id}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={intensity} />
            <Stop offset="45%" stopColor={color} stopOpacity={intensity * 0.35} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#glow${id})`} />
      </Svg>
    </Animated.View>
  );
}

// ─── PulseRing: expanding ring behind a primary CTA ─────────────────────────

export function PulseRing({ color = colors.primary, borderRadius = 20, style }: { color?: string; borderRadius?: number; style?: StyleProp<ViewStyle> }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false);
  }, [t]);
  const anim = useAnimatedStyle(() => ({
    opacity: (1 - t.value) * 0.55,
    transform: [{ scale: 1 + t.value * 0.08 }],
  }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius, borderWidth: 2, borderColor: color }, style, anim]} />;
}

// ─── AnimatedBar: progress bar that eases to its value ──────────────────────

export function AnimatedBar({ progress, color = colors.primary, height = 4, track = colors.border, style }:
  { progress: number; color?: string; height?: number; track?: string; style?: StyleProp<ViewStyle> }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(Math.min(1, Math.max(0, progress)), { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [progress, p]);
  const anim = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return (
    <View style={[{ height, backgroundColor: track, borderRadius: height / 2, overflow: 'hidden' }, style]}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color }, anim]} />
    </View>
  );
}

// ─── useCountUp: eases a number from its previous value to the target ───────

export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const first = useRef(true);
  useEffect(() => {
    if (!Number.isFinite(target)) { setValue(target); return; }
    const a = first.current ? 0 : from.current;
    first.current = false;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setValue(a + (target - a) * eased);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/** Format an animated number with the same number of decimals as its target. */
export function formatCount(animated: number, target: number | string): string {
  if (typeof target !== 'number' || !Number.isFinite(target)) return String(target);
  const decimals = (String(target).split('.')[1] ?? '').length;
  return animated.toFixed(decimals);
}

const styles = StyleSheet.create({
  orb: { position: 'absolute' },
});
