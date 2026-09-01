import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";

import { AppText, PaceButton } from "@/src/components/ui";
import CircuitsMap from "@/src/components/CircuitsMap";
import { Circuit, Coord, generateCircuits } from "@/src/circuits";
import { colors, fonts, radius, spacing } from "@/src/theme";

const DISTANCES = [3, 5, 8, 10, 15];

export default function RoutesMapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [perm, setPerm] = useState<"undetermined" | "granted" | "denied">("undetermined");
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [pos, setPos] = useState<Coord | null>(null);
  const [locating, setLocating] = useState(false);
  const [distance, setDistance] = useState(5);
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const locate = useCallback(async (dist: number) => {
    setLocating(true);
    try {
      let p = await Location.getLastKnownPositionAsync();
      if (!p) p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (p) {
        const c = { latitude: p.coords.latitude, longitude: p.coords.longitude };
        setPos(c);
        const cs = generateCircuits(c, dist);
        setCircuits(cs);
        setSelected(cs[0].id);
      }
    } catch {
      /* ignore */
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const p = await Location.getForegroundPermissionsAsync();
      setCanAskAgain(p.canAskAgain);
      if (p.granted) {
        setPerm("granted");
        locate(5);
      } else {
        setPerm(p.status === "undetermined" ? "undetermined" : "denied");
      }
    })();
  }, [locate]);

  const askPermission = async () => {
    const p = await Location.requestForegroundPermissionsAsync();
    setCanAskAgain(p.canAskAgain);
    if (p.granted) {
      setPerm("granted");
      locate(distance);
    } else {
      setPerm("denied");
    }
  };

  const regenerate = (d: number) => {
    setDistance(d);
    if (pos) {
      const cs = generateCircuits(pos, d);
      setCircuits(cs);
      setSelected(cs[0].id);
    }
  };

  const selectedCircuit = circuits.find((c) => c.id === selected);
  const estMin = selectedCircuit ? Math.round(selectedCircuit.distance_km * 6) : 0;

  // Permission gate
  if (perm !== "granted") {
    return (
      <View style={[styles.center, { padding: spacing.xxl, paddingTop: insets.top + 40 }]}>
        <Pressable testID="circuits-close" onPress={() => router.back()} style={[styles.closeAbs, { top: insets.top + 8 }]}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.permIcon}>
          <Ionicons name="map" size={40} color={colors.primary} />
        </View>
        <AppText variant="h2" style={{ textAlign: "center", marginTop: spacing.xl }}>
          Circuits autour de toi
        </AppText>
        <AppText variant="body" style={{ textAlign: "center", marginTop: spacing.md }}>
          Autorise la localisation pour générer des boucles de course autour de ta position et les voir sur la carte.
        </AppText>
        {perm === "denied" && !canAskAgain ? (
          <PaceButton
            testID="circuits-open-settings"
            label="Ouvrir les réglages"
            icon="settings-outline"
            onPress={() => Linking.openSettings()}
            style={{ marginTop: spacing.xxl, alignSelf: "stretch" }}
          />
        ) : (
          <PaceButton
            testID="circuits-allow-location"
            label="Autoriser la localisation"
            onPress={askPermission}
            style={{ marginTop: spacing.xxl, alignSelf: "stretch" }}
          />
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 8 }}>
      <View style={styles.topBar}>
        <Pressable testID="circuits-close" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-down" size={26} color={colors.text} />
        </Pressable>
        <AppText variant="title">Circuits 3D</AppText>
        <View style={{ width: 26 }} />
      </View>

      {/* Distance chips */}
      <View style={{ height: 52 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.xl, alignItems: "center" }}
        >
          {DISTANCES.map((d) => {
            const active = distance === d;
            return (
              <Pressable
                key={d}
                testID={`circuit-dist-${d}`}
                onPress={() => regenerate(d)}
                style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              >
                <AppText style={{ fontFamily: fonts.semibold, fontSize: 14, color: active ? "#07240D" : colors.textSecondary }}>
                  {d} km
                </AppText>
              </Pressable>
            );
          })}
          <Pressable testID="circuit-regenerate" onPress={() => regenerate(distance)} style={styles.chip}>
            <Ionicons name="shuffle" size={16} color={colors.textSecondary} />
          </Pressable>
        </ScrollView>
      </View>

      {/* Map */}
      <View style={{ flex: 1, marginHorizontal: spacing.xl, borderRadius: radius.lg, overflow: "hidden" }}>
        {pos ? (
          <CircuitsMap start={pos} circuits={circuits} selectedId={selected} />
        ) : (
          <View style={[styles.center, { backgroundColor: colors.card }]}>
            <ActivityIndicator color={colors.primary} />
            <AppText variant="caption" style={{ marginTop: spacing.md }}>
              {locating ? "Recherche de ta position…" : "Position indisponible"}
            </AppText>
            {!locating && (
              <PaceButton
                testID="circuits-retry"
                label="Réessayer"
                variant="secondary"
                onPress={() => locate(distance)}
                style={{ marginTop: spacing.lg }}
              />
            )}
          </View>
        )}
      </View>

      {/* Circuit cards */}
      <View style={{ paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.lg }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.xl }}
        >
          {circuits.map((c) => {
            const active = c.id === selected;
            return (
              <Pressable
                key={c.id}
                testID={`circuit-${c.id}`}
                onPress={() => setSelected(c.id)}
                style={[styles.circuitCard, active && { borderColor: c.color }]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <View style={[styles.colorDot, { backgroundColor: c.color }]} />
                  <AppText variant="bodyStrong">{c.name}</AppText>
                </View>
                <AppText variant="caption" style={{ marginTop: 4 }}>
                  {c.distance_km} km · ~{Math.round(c.distance_km * 6)} min
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
        {selectedCircuit ? (
          <PaceButton
            testID="run-circuit"
            label={`Courir ce circuit (${selectedCircuit.distance_km} km · ~${estMin} min)`}
            icon="play"
            onPress={() => router.push("/run/active")}
            style={{ marginHorizontal: spacing.xl, marginTop: spacing.md }}
          />
        ) : null}
        {Platform.OS === "web" && (
          <AppText variant="caption" style={{ textAlign: "center", marginTop: spacing.sm }}>
            La carte 3D et le GPS complet fonctionnent sur mobile.
          </AppText>
        )}
      </View>
    </View>
  );
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
  chip: {
    flexShrink: 0,
    height: 36,
    minWidth: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  circuitCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minWidth: 150,
  },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
});
