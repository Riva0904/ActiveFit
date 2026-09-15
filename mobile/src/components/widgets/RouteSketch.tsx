import React, { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { Text } from '../Text';
import { PulseRing } from '../Motion';
import { colors, spacing, tint, typography } from '../../theme';
import { projectRoute, type LatLng } from '../../lib/run';

interface RouteSketchProps {
  route: ReadonlyArray<LatLng>;
  /** Show the pulsing "you are here" marker on the last point. */
  live?: boolean;
  /** Compact thumbnail: no hint text, thinner stroke. */
  thumbnail?: boolean;
  style?: ViewStyle;
}

/**
 * Map fallback used on Android builds without a Google Maps key: the route is
 * drawn to scale over a dark grid, so the run screen stays useful (and the
 * detail/summary cards still show the shape of the run).
 */
export function RouteSketch({ route, live, thumbnail, style }: RouteSketchProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const pad = thumbnail ? 10 : 24;
  const pts = size.w > 0 && size.h > 0 ? projectRoute(route, size.w, size.h, pad) : [];
  const first = pts[0];
  const last = pts[pts.length - 1];
  const gridStep = thumbnail ? 20 : 32;
  const gridColor = tint(colors.border, 'AA');

  return (
    <View style={[styles.wrap, style]} onLayout={onLayout}>
      {size.w > 0 && (
        <Svg width={size.w} height={size.h}>
          {Array.from({ length: Math.ceil(size.w / gridStep) }, (_, i) => (
            <Line key={`v${i}`} x1={i * gridStep} y1={0} x2={i * gridStep} y2={size.h} stroke={gridColor} strokeWidth={1} />
          ))}
          {Array.from({ length: Math.ceil(size.h / gridStep) }, (_, i) => (
            <Line key={`h${i}`} x1={0} y1={i * gridStep} x2={size.w} y2={i * gridStep} stroke={gridColor} strokeWidth={1} />
          ))}
          {pts.length >= 2 && (
            <>
              <Polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={tint(colors.primary, '55')} strokeWidth={thumbnail ? 6 : 10} strokeLinecap="round" strokeLinejoin="round" />
              <Polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={colors.primary} strokeWidth={thumbnail ? 2.5 : 4} strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}
          {first && <Circle cx={first.x} cy={first.y} r={thumbnail ? 4 : 6} fill={colors.success} stroke={colors.bg} strokeWidth={2} />}
          {last && pts.length >= 2 && !live && <Circle cx={last.x} cy={last.y} r={thumbnail ? 4 : 6} fill={colors.primary} stroke={colors.bg} strokeWidth={2} />}
          {last && live && <Circle cx={last.x} cy={last.y} r={7} fill={colors.primary} stroke={colors.white} strokeWidth={2} />}
        </Svg>
      )}
      {last && live && (
        <View pointerEvents="none" style={[styles.pulse, { left: last.x - 18, top: last.y - 18 }]}>
          <PulseRing borderRadius={18} />
        </View>
      )}
      {!thumbnail && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>{route.length === 0 ? 'Route preview — waiting for GPS' : 'Route preview · map tiles arrive with the Maps key'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', borderRadius: 16, backgroundColor: colors.surfaceSunken },
  pulse: { position: 'absolute', width: 36, height: 36 },
  hint: { position: 'absolute', left: 0, right: 0, bottom: spacing.sm, alignItems: 'center' },
  hintText: { color: colors.textMuted, ...typography.micro, backgroundColor: tint(colors.bg, 'CC'), paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
});
