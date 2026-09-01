import { StyleProp, View, ViewStyle } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";

import { AppText } from "@/src/components/ui";
import { colors, radius, spacing } from "@/src/theme";
import type { Circuit, Coord } from "@/src/circuits";

// Web fallback: react-native-maps has no web support, draw the loops with SVG.
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
  const W = 360;
  const H = 420;
  const pad = 30;

  if (!circuits.length) {
    return (
      <View style={[styles.box, style]}>
        <Ionicons name="map-outline" size={32} color={colors.textMuted} />
        <AppText variant="caption" style={{ marginTop: 8 }}>
          Génère des circuits pour les voir ici
        </AppText>
      </View>
    );
  }

  const all = circuits.flatMap((c) => c.coords).concat([start]);
  const lats = all.map((p) => p.latitude);
  const lons = all.map((p) => p.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const spanLat = maxLat - minLat || 1e-6;
  const spanLon = maxLon - minLon || 1e-6;
  const scale = Math.min((W - pad * 2) / spanLon, (H - pad * 2) / spanLat);
  const offX = (W - spanLon * scale) / 2;
  const offY = (H - spanLat * scale) / 2;
  const toXY = (p: Coord) => ({
    x: offX + (p.longitude - minLon) * scale,
    y: H - (offY + (p.latitude - minLat) * scale),
  });
  const startXY = toXY(start);

  return (
    <View style={[styles.box, { alignItems: "stretch", justifyContent: "flex-start" }, style]}>
      <Svg width="100%" height="85%" viewBox={`0 0 ${W} ${H}`}>
        {circuits.map((c) => (
          <Polyline
            key={c.id}
            points={c.coords.map((p) => { const q = toXY(p); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(" ")}
            fill="none"
            stroke={c.id === selectedId ? c.color : `${c.color}55`}
            strokeWidth={c.id === selectedId ? 5 : 2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        <Circle cx={startXY.x} cy={startXY.y} r={7} fill={colors.primary} stroke="#07240D" strokeWidth={2} />
      </Svg>
      <AppText variant="caption" style={{ textAlign: "center", padding: spacing.md }}>
        Vue 3D disponible sur mobile 📱
      </AppText>
    </View>
  );
}

const styles = {
  box: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
};
