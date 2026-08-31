import { useEffect, useRef } from "react";
import { StyleProp, ViewStyle } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";

import { colors, radius } from "@/src/theme";

type Coord = { latitude: number; longitude: number };

const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#17171b" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a93" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0a0c" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#26262d" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f1720" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];

export default function RunMap({
  route = [],
  current,
  height = 220,
  follow = false,
  style,
}: {
  route?: Coord[];
  current?: Coord | null;
  height?: number;
  follow?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const mapRef = useRef<MapView>(null);
  const anchor = current || route[route.length - 1] || { latitude: 48.8566, longitude: 2.3522 };

  useEffect(() => {
    if (follow && current && mapRef.current) {
      mapRef.current.animateCamera({ center: current }, { duration: 500 });
    }
  }, [current, follow]);

  useEffect(() => {
    if (!follow && route.length > 1 && mapRef.current) {
      mapRef.current.fitToCoordinates(route, {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: false,
      });
    }
  }, [route, follow]);

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_DEFAULT}
      style={[{ height, borderRadius: radius.lg, overflow: "hidden" }, style]}
      customMapStyle={DARK_STYLE}
      userInterfaceStyle="dark"
      showsUserLocation={follow}
      showsMyLocationButton={false}
      initialRegion={{ ...anchor, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
    >
      {route.length > 1 && (
        <Polyline coordinates={route} strokeColor={colors.primary} strokeWidth={5} lineJoin="round" lineCap="round" />
      )}
      {current && <Marker coordinate={current} anchor={{ x: 0.5, y: 0.5 }} />}
    </MapView>
  );
}
