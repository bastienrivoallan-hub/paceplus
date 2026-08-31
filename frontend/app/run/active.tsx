import { useEffect, useRef, useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api";
import { AppText, PaceButton } from "@/src/components/ui";
import { colors, fmtDuration, fonts, radius, spacing } from "@/src/theme";

function haversine(a: any, b: any) {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default function ActiveRun() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();

  const [perm, setPerm] = useState<"undetermined" | "granted" | "denied">("undetermined");
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [saving, setSaving] = useState(false);

  const watchSub = useRef<Location.LocationSubscription | null>(null);
  const timer = useRef<any>(null);
  const lastCoord = useRef<any>(null);
  const route = useRef<any[]>([]);
  const pausedRef = useRef(false);

  useEffect(() => {
    (async () => {
      const p = await Location.getForegroundPermissionsAsync();
      setPerm(p.granted ? "granted" : "denied");
      setCanAskAgain(p.canAskAgain);
      if (!p.granted && p.status === "undetermined") setPerm("undetermined");
    })();
    return () => {
      if (watchSub.current) watchSub.current.remove();
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const askPermission = async () => {
    const p = await Location.requestForegroundPermissionsAsync();
    setCanAskAgain(p.canAskAgain);
    setPerm(p.granted ? "granted" : "denied");
  };

  const start = async () => {
    setRunning(true);
    setPaused(false);
    pausedRef.current = false;
    timer.current = setInterval(() => {
      if (!pausedRef.current) setElapsed((e) => e + 1);
    }, 1000);
    try {
      watchSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 5 },
        (loc) => {
          if (pausedRef.current) return;
          const c = loc.coords;
          route.current.push({ latitude: c.latitude, longitude: c.longitude });
          if (lastCoord.current) {
            const d = haversine(lastCoord.current, c);
            if (d < 60) setDistance((prev) => prev + d);
          }
          lastCoord.current = c;
        },
      );
    } catch {
      /* ignore watch errors */
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const togglePause = () => {
    setPaused((p) => {
      pausedRef.current = !p;
      return !p;
    });
    Haptics.selectionAsync();
  };

  const finish = async () => {
    if (timer.current) clearInterval(timer.current);
    if (watchSub.current) watchSub.current.remove();
    setSaving(true);
    const paceStr =
      distance > 0 ? formatPace(elapsed / (distance / 1000)) : null;
    try {
      await api.saveRun({
        distance_m: Math.round(distance),
        duration_s: elapsed,
        avg_pace: paceStr,
        route: route.current.slice(0, 500),
        session_id: sessionId || null,
      });
    } catch {
      /* ignore */
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/(tabs)/progression");
  };

  const pace = distance > 30 ? formatPace(elapsed / (distance / 1000)) : "--:--";
  const speed = elapsed > 0 ? ((distance / 1000) / (elapsed / 3600)).toFixed(1) : "0.0";

  // Permission gate
  if (perm !== "granted") {
    return (
      <View style={[styles.center, { padding: spacing.xxl, paddingTop: insets.top + 40 }]}>
        <Pressable testID="run-close" onPress={() => router.back()} style={[styles.closeAbs, { top: insets.top + 8 }]}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.permIcon}>
          <Ionicons name="navigate" size={40} color={colors.primary} />
        </View>
        <AppText variant="h2" style={{ textAlign: "center", marginTop: spacing.xl }}>
          Active ta localisation
        </AppText>
        <AppText variant="body" style={{ textAlign: "center", marginTop: spacing.md }}>
          PACE utilise le GPS pour mesurer ta distance, ton allure et tracer ton parcours pendant la course.
        </AppText>
        {perm === "denied" && !canAskAgain ? (
          <PaceButton
            testID="run-open-settings"
            label="Ouvrir les réglages"
            icon="settings-outline"
            onPress={() => Linking.openSettings()}
            style={{ marginTop: spacing.xxl, alignSelf: "stretch" }}
          />
        ) : (
          <PaceButton
            testID="run-allow-location"
            label="Autoriser la localisation"
            onPress={askPermission}
            style={{ marginTop: spacing.xxl, alignSelf: "stretch" }}
          />
        )}
        {Platform.OS === "web" && (
          <AppText variant="caption" style={{ textAlign: "center", marginTop: spacing.lg }}>
            Le suivi GPS fonctionne au mieux sur un vrai téléphone.
          </AppText>
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 8 }}>
      <View style={styles.topBar}>
        <Pressable testID="run-close" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-down" size={26} color={colors.text} />
        </Pressable>
        <View style={styles.liveBadge}>
          <View style={[styles.liveDot, paused && { backgroundColor: colors.orange }]} />
          <AppText variant="caption" style={{ color: colors.text, fontFamily: fonts.semibold }}>
            {running ? (paused ? "En pause" : "En cours") : "Prêt"}
          </AppText>
        </View>
        <View style={{ width: 26 }} />
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl }}>
        <AppText variant="label" style={{ letterSpacing: 2 }}>DISTANCE</AppText>
        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
          <AppText style={{ fontFamily: fonts.displayBold, fontSize: 84, color: colors.text }}>
            {(distance / 1000).toFixed(2)}
          </AppText>
          <AppText style={{ fontFamily: fonts.displaySemibold, fontSize: 26, color: colors.textSecondary, marginBottom: 18, marginLeft: 6 }}>
            km
          </AppText>
        </View>

        <View style={styles.statsRow}>
          <BigStat label="TEMPS" value={fmtDuration(elapsed)} />
          <View style={styles.vline} />
          <BigStat label="ALLURE /KM" value={pace} />
          <View style={styles.vline} />
          <BigStat label="KM/H" value={speed} />
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        {!running ? (
          <PaceButton testID="run-start" label="Démarrer" icon="play" onPress={start} />
        ) : (
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <PaceButton
              testID="run-pause"
              label={paused ? "Reprendre" : "Pause"}
              icon={paused ? "play" : "pause"}
              variant="secondary"
              onPress={togglePause}
              style={{ flex: 1 }}
            />
            <PaceButton
              testID="run-finish"
              label="Terminer"
              icon="stop"
              onPress={finish}
              loading={saving}
              style={{ flex: 1 }}
            />
          </View>
        )}
      </View>
    </View>
  );
}

function BigStat({ label, value }: any) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <AppText style={{ fontFamily: fonts.displayBold, fontSize: 22, color: colors.text }}>{value}</AppText>
      <AppText variant="caption" style={{ fontSize: 10, marginTop: 4, letterSpacing: 1 }}>
        {label}
      </AppText>
    </View>
  );
}

function formatPace(secPerKm: number) {
  if (!isFinite(secPerKm) || secPerKm <= 0) return "--:--";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  closeAbs: { position: "absolute", right: spacing.xl, zIndex: 10 },
  permIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xxxl,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    alignSelf: "stretch",
  },
  vline: { width: 1, height: 36, backgroundColor: colors.border },
});
