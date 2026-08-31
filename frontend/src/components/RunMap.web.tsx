import { StyleProp, View, ViewStyle } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";

import { AppText } from "@/src/components/ui";
import { colors, radius } from "@/src/theme";

type Coord = { latitude: number; longitude: number };

// Web fallback: react-native-maps has no web support, so draw the GPS trace with SVG.
export default function RunMap({
  route = [],
  current,
  height = 220,
  style,
}: {
  route?: Coord[];
  current?: Coord | null;
  height?: number;
  follow?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const W = 340;
  const H = height;
  const pad = 20;

  const box = (
    children: React.ReactNode,
  ) => (
    <View
      style={[
        { height, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden", alignItems: "center", justifyContent: "center" },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!route || route.length < 2) {
    return box(
      <>
        <Ionicons name="map-outline" size={30} color={colors.textMuted} />
        <AppText variant="caption" style={{ marginTop: 8 }}>
          Carte disponible sur mobile
        </AppText>
      </>,
    );
  }

  const lats = route.map((p) => p.latitude);
  const lons = route.map((p) => p.longitude);
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
  const pts = route.map((p) => { const c = toXY(p); return `${c.x.toFixed(1)},${c.y.toFixed(1)}`; }).join(" ");
  const first = toXY(route[0]);
  const last = toXY(current || route[route.length - 1]);

  return (
    <View style={[{ height, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }, style]}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Polyline points={pts} fill="none" stroke={colors.primary} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={first.x} cy={first.y} r={6} fill={colors.blue} />
        <Circle cx={last.x} cy={last.y} r={6} fill={colors.pink} />
      </Svg>
    </View>
  );
}
