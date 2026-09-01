import { useEffect, useRef } from "react";
import { StyleProp, ViewStyle } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";

import type { Circuit, Coord } from "@/src/circuits";

const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#17171b" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a93" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0a0c" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#26262d" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f1720" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];

export default function CircuitsMap({
  start,
  circuits,
  selectedId,
  style,
}: {
  start: Coord;
  circuits: Circuit[];
  selectedId?: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    const target = circuits.find((c) => c.id === selectedId) || circuits[0];
    if (!target) return;
    const lats = target.coords.map((c) => c.latitude);
    const lons = target.coords.map((c) => c.longitude);
    const center = {
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      longitude: (Math.min(...lons) + Math.max(...lons)) / 2,
    };
    const spanKm = Math.max(0.5, (Math.max(...lats) - Math.min(...lats)) * 111.32);
    // Tilted camera for a 3D perspective (buildings render in 3D on device)
    mapRef.current.animateCamera(
      { center, pitch: 55, heading: 20, altitude: spanKm * 2600, zoom: 15.5 - Math.log2(spanKm) },
      { duration: 800 },
    );
  }, [selectedId, circuits]);

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_DEFAULT}
      style={[{ flex: 1 }, style]}
      customMapStyle={DARK_STYLE}
      userInterfaceStyle="dark"
      showsUserLocation
      showsMyLocationButton={false}
      showsBuildings
      pitchEnabled
      rotateEnabled
      initialCamera={{ center: start, pitch: 55, heading: 0, altitude: 3000, zoom: 15 }}
    >
      {circuits.map((c) => (
        <Polyline
          key={c.id}
          coordinates={c.coords}
          strokeColor={c.id === selectedId ? c.color : `${c.color}66`}
          strokeWidth={c.id === selectedId ? 6 : 3}
          lineJoin="round"
          lineCap="round"
        />
      ))}
      <Marker coordinate={start} anchor={{ x: 0.5, y: 0.5 }} title="Départ" />
    </MapView>
  );
}
