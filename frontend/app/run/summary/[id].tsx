import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Polyline, Circle } from "react-native-svg";

import { api } from "@/src/api";
import { AppText, Card, PaceButton } from "@/src/components/ui";
import { colors, fmtDuration, fonts, radius, spacing } from "@/src/theme";

function RouteTrace({ route }: { route: any[] }) {
  const W = 320;
  const H = 170;
  const pad = 16;
  if (!route || route.length < 2) {
    return (
      <View style={[styles.mapBox, { height: H, alignItems: "center", justifyContent: "center" }]}>
        <Ionicons name="map-outline" size={30} color={colors.textMuted} />
        <AppText variant="caption" style={{ marginTop: 8 }}>
          Tracé GPS indisponible
        </AppText>
      </View>
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
  const pts = route
    .map((p) => {
      const x = offX + (p.longitude - minLon) * scale;
      const y = H - (offY + (p.latitude - minLat) * scale);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const first = pts.split(" ")[0].split(",");
  const last = pts.split(" ").slice(-1)[0].split(",");
  return (
    <View style={[styles.mapBox, { height: H }]}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Polyline points={pts} fill="none" stroke={colors.primary} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={Number(first[0])} cy={Number(first[1])} r={6} fill={colors.blue} />
        <Circle cx={Number(last[0])} cy={Number(last[1])} r={6} fill={colors.pink} />
      </Svg>
    </View>
  );
}

export default function RunSummary() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [run, setRun] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        setRun(await api.run(String(id)));
      } catch {
        /* ignore */
      }
    })();
  }, [id]);

  if (!run) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const splits: any[] = run.splits || [];
  const maxSplit = Math.max(1, ...splits.map((s) => s.seconds || 0));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + spacing.xl, paddingHorizontal: spacing.xl, alignItems: "center" }}>
        <View style={styles.trophy}>
          <Ionicons name="checkmark-done" size={30} color={colors.primary} />
        </View>
        <AppText variant="h2" style={{ marginTop: spacing.md }}>
          Course terminée !
        </AppText>
        <AppText variant="caption" style={{ marginTop: 4 }}>
          {new Date(run.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
        </AppText>
      </View>

      <View style={{ padding: spacing.xl }}>
        <Card>
          <View style={{ flexDirection: "row" }}>
            <Big label="DISTANCE" value={`${(run.distance_m / 1000).toFixed(2)}`} unit="km" />
            <View style={styles.vline} />
            <Big label="TEMPS" value={fmtDuration(run.duration_s)} unit="" />
            <View style={styles.vline} />
            <Big label="ALLURE" value={run.avg_pace || "--:--"} unit="/km" />
          </View>
        </Card>

        <AppText variant="label" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          PARCOURS
        </AppText>
        <RouteTrace route={run.route} />

        {splits.length > 0 && (
          <>
            <AppText variant="label" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
              TEMPS AU KILOMÈTRE
            </AppText>
            <Card>
              {splits.map((s) => (
                <View key={s.km} style={styles.splitRow}>
                  <AppText variant="bodyStrong" style={{ width: 34 }}>
                    {s.km}
                  </AppText>
                  <View style={styles.splitTrack}>
                    <View style={{ width: `${(s.seconds / maxSplit) * 100}%`, height: "100%", backgroundColor: colors.primary, borderRadius: 5 }} />
                  </View>
                  <AppText variant="bodyStrong" style={{ width: 60, textAlign: "right" }}>
                    {s.pace}
                  </AppText>
                </View>
              ))}
            </Card>
          </>
        )}
      </View>

      <View style={{ marginTop: "auto", paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.lg }}>
        <PaceButton testID="summary-done" label="Terminé" onPress={() => router.replace("/(tabs)")} />
      </View>
    </View>
  );
}

function Big({ label, value, unit }: any) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
        <AppText style={{ fontFamily: fonts.displayBold, fontSize: 22, color: colors.text }}>{value}</AppText>
        {unit ? <AppText variant="caption" style={{ fontSize: 11 }}>{unit}</AppText> : null}
      </View>
      <AppText variant="caption" style={{ fontSize: 10, marginTop: 4, letterSpacing: 1 }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  trophy: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  vline: { width: 1, backgroundColor: colors.border, marginHorizontal: 4 },
  mapBox: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  splitRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 7 },
  splitTrack: { flex: 1, height: 10, backgroundColor: colors.track, borderRadius: 5, overflow: "hidden" },
});
