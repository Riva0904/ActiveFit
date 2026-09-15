import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Constants from 'expo-constants';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { colors } from '../../theme';
import type { LatLng, RoutePoint } from '../../lib/run';
import { RouteSketch } from './RouteSketch';

interface RunMapProps {
  route: ReadonlyArray<Pick<RoutePoint, 'lat' | 'lng'>>;
  /** Live mode: follow the user and show the blue dot. */
  live?: boolean;
  /** Static thumbnail: no gestures, fitted to the route once. */
  thumbnail?: boolean;
  /** Where to centre before the route has any points (last known position). */
  center?: LatLng | null;
  style?: ViewStyle;
}

/** Android's Google MapView renders a blank grey canvas without an API key — use the SVG sketch instead. */
const HAS_TILES = Platform.OS !== 'android' || !!(Constants.expoConfig?.extra as any)?.hasGoogleMapsKey;

// Muted dark basemap so the azure route pops (Google Maps style JSON; ignored on Apple Maps).
const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: colors.surface }] },
  { elementType: 'labels.text.fill', stylers: [{ color: colors.textMuted }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: colors.bg }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: colors.border }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: colors.surfaceRaised }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: colors.bgDeep }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

export function RunMap({ route, live, thumbnail, center, style }: RunMapProps) {
  if (!HAS_TILES) return <RouteSketch route={route} live={live} thumbnail={thumbnail} style={style} />;
  return <TileMap route={route} live={live} thumbnail={thumbnail} center={center} style={style} />;
}

function TileMap({ route, live, thumbnail, center, style }: RunMapProps) {
  const ref = useRef<MapView>(null);
  const coords = route.map((p) => ({ latitude: p.lat, longitude: p.lng }));
  const last = coords[coords.length - 1];

  // Fit to the route whenever it changes in thumbnail/detail mode; follow the runner when live.
  useEffect(() => {
    if (!ref.current) return;
    if (live) {
      const target = last ?? (center ? { latitude: center.lat, longitude: center.lng } : null);
      if (target) ref.current.animateCamera({ center: target, zoom: 16 }, { duration: 500 });
    } else if (coords.length >= 2) {
      ref.current.fitToCoordinates(coords, { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: !thumbnail });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords.length, live, thumbnail, center?.lat, center?.lng]);

  const initial = last ?? (center ? { latitude: center.lat, longitude: center.lng } : null);

  return (
    <View style={[styles.wrap, style]}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        customMapStyle={DARK_STYLE}
        userInterfaceStyle="dark"
        showsUserLocation={!!live}
        followsUserLocation={false}
        showsMyLocationButton={false}
        scrollEnabled={!thumbnail}
        zoomEnabled={!thumbnail}
        rotateEnabled={false}
        pitchEnabled={false}
        liteMode={!!thumbnail && Platform.OS === 'android'}
        initialRegion={initial ? { ...initial, latitudeDelta: 0.01, longitudeDelta: 0.01 } : { latitude: 12.9716, longitude: 77.5946, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      >
        {coords.length >= 2 ? <Polyline coordinates={coords} strokeColor={colors.primary} strokeWidth={4} lineCap="round" lineJoin="round" /> : null}
        {coords[0] ? <Marker coordinate={coords[0]} pinColor={colors.success} anchor={{ x: 0.5, y: 0.5 }} /> : null}
        {!live && last && coords.length >= 2 ? <Marker coordinate={last} pinColor={colors.primary} /> : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', borderRadius: 16, backgroundColor: colors.surface },
});
