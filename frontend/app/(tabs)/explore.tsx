import { useCallback, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";

import { api } from "@/src/api";
import { AppText, Card, Logo } from "@/src/components/ui";
import { colors, fonts, radius, spacing, workoutMeta } from "@/src/theme";

const FILTERS = [
  { key: "all", label: "Tous" },
  { key: "easy", label: "Footing" },
  { key: "intervals", label: "Fractionné" },
  { key: "threshold", label: "Seuil" },
  { key: "long", label: "Long" },
];

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const [routes, setRoutes] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [sug, setSug] = useState<any>(null);
  const [sugLoading, setSugLoading] = useState(false);
  const [sugBlocked, setSugBlocked] = useState(false);
  const [sugError, setSugError] = useState<string | null>(null);

  const fetchSuggestion = useCallback(async () => {
    setSugLoading(true);
    setSugError(null);
    try {
      let pos = await Location.getLastKnownPositionAsync();
      if (!pos) pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      if (!pos) throw new Error("no position");
      const res = await api.routeWeather(pos.coords.latitude, pos.coords.longitude);
      setSug(res);
    } catch (e: any) {
      setSugError(e?.message === "no position" ? "Position introuvable" : e?.message || "Erreur");
    } finally {
      setSugLoading(false);
    }
  }, []);

  const askSuggestion = useCallback(async () => {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.granted) {
      fetchSuggestion();
      return;
    }
    if (perm.canAskAgain) {
      const r = await Location.requestForegroundPermissionsAsync();
      if (r.granted) fetchSuggestion();
      else if (!r.canAskAgain) setSugBlocked(true);
    } else {
      setSugBlocked(true);
    }
  }, [fetchSuggestion]);

  const load = useCallback(async () => {
    try {
      const res = await api.routes();
      setRoutes(res.routes || []);
    } catch {
      /* ignore */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      (async () => {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.granted && !sug && !sugLoading) fetchSuggestion();
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  const filtered = filter === "all" ? routes : routes.filter((r) => r.type === filter);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={{ width: 26 }} />
        <Logo size={20} />
        <View style={{ width: 26 }} />
      </View>

      {/* Sticky title + chips */}
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
        <AppText variant="h1">Explorer</AppText>
        <AppText variant="body" style={{ marginTop: 4 }}>
          Des parcours adaptés à chaque séance.
        </AppText>
      </View>
      <View style={{ height: 56, marginTop: spacing.md }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.xl, alignItems: "center" }}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                testID={`filter-${f.key}`}
                onPress={() => setFilter(f.key)}
                style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              >
                <AppText style={{ fontFamily: fonts.semibold, fontSize: 14, color: active ? "#07240D" : colors.textSecondary }}>
                  {f.label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.md, paddingBottom: 28, gap: spacing.md }}>
        {/* Coach weather route suggestion */}
        {sug ? (
          <Card style={styles.sugCard} testID="route-weather-card">
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Ionicons name="sparkles" size={16} color={colors.primary} />
              <AppText variant="label" style={{ color: colors.primary }}>
                CIRCUIT CONSEILLÉ PAR LE COACH
              </AppText>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md }}>
              <Ionicons name={sug.weather?.icon as any} size={18} color={colors.textSecondary} />
              <AppText variant="caption">
                {Math.round(sug.weather?.temperature_c)}°C · {sug.weather?.condition} · vent {Math.round(sug.weather?.wind_kmh)} km/h ({sug.weather?.wind_dir})
              </AppText>
            </View>
            <AppText variant="title" style={{ marginTop: spacing.sm }}>
              {sug.route?.name}
            </AppText>
            {sug.reason ? (
              <AppText variant="body" style={{ marginTop: spacing.sm, fontSize: 14 }}>
                {sug.reason}
              </AppText>
            ) : null}
            {sug.wind_tip ? (
              <View style={styles.windTip}>
                <Ionicons name="flag-outline" size={14} color={colors.blue} />
                <AppText variant="caption" style={{ flex: 1, color: colors.blue }}>
                  {sug.wind_tip}
                </AppText>
              </View>
            ) : null}
          </Card>
        ) : sugLoading ? (
          <Card style={[styles.sugCard, { flexDirection: "row", alignItems: "center", gap: spacing.md }]}>
            <ActivityIndicator color={colors.primary} />
            <AppText variant="body">Le coach analyse la météo…</AppText>
          </Card>
        ) : sugBlocked ? (
          <Card style={styles.sugCard}>
            <AppText variant="bodyStrong">Localisation désactivée</AppText>
            <AppText variant="caption" style={{ marginTop: 4 }}>
              Autorise la localisation pour que le coach choisisse ton circuit selon la météo.
            </AppText>
            <Pressable testID="route-weather-settings" onPress={() => Linking.openSettings()} style={styles.settingsBtn}>
              <AppText style={{ fontFamily: fonts.semibold, fontSize: 14, color: "#07240D" }}>Ouvrir les réglages</AppText>
            </Pressable>
          </Card>
        ) : (
          <Pressable testID="route-weather-cta" onPress={askSuggestion} style={styles.sugCta}>
            <View style={styles.sugIcon}>
              <Ionicons name="partly-sunny" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">Circuit selon la météo</AppText>
              <AppText variant="caption" style={{ marginTop: 2 }}>
                {sugError ? `Réessayer (${sugError})` : "Le coach choisit le parcours idéal (vent, pluie, chaleur)"}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        )}

        {filtered.map((r) => {
          const meta = workoutMeta(r.type);
          const recommended = sug?.route?.id === r.id;
          return (
            <Card
              key={r.id}
              style={[
                { padding: 0, overflow: "hidden" },
                recommended && { borderColor: colors.primary, borderWidth: 1.5 },
              ]}
              testID={`route-${r.id}`}
            >
              <LinearGradient
                colors={[`${meta.color}33`, "transparent"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: spacing.lg }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={[styles.routeIcon, { backgroundColor: `${meta.color}22`, borderColor: `${meta.color}55` }]}>
                    <Ionicons name={meta.icon as any} size={20} color={meta.color} />
                  </View>
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    {recommended && (
                      <View style={[styles.diffBadge, { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}>
                        <AppText style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.primary }}>
                          ★ Conseillé
                        </AppText>
                      </View>
                    )}
                    <View style={[styles.diffBadge, { borderColor: `${meta.color}55` }]}>
                      <AppText style={{ fontFamily: fonts.semibold, fontSize: 12, color: meta.color }}>
                        {r.difficulty}
                      </AppText>
                    </View>
                  </View>
                </View>
                <AppText variant="title" style={{ marginTop: spacing.md }}>
                  {r.name}
                </AppText>
                <View style={{ flexDirection: "row", gap: spacing.xl, marginTop: spacing.md }}>
                  <Stat icon="navigate-outline" value={`${r.distance_km} km`} />
                  <Stat icon="trending-up-outline" value={`${r.elevation_m} m D+`} />
                  <Stat icon="footsteps-outline" value={r.surface} />
                </View>
              </LinearGradient>
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Stat({ icon, value }: any) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <AppText variant="caption" style={{ fontSize: 13 }}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chip: {
    flexShrink: 0,
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  routeIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  diffBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  sugCard: {
    borderColor: `${colors.primary}55`,
  },
  sugCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  sugIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  windTip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    backgroundColor: "rgba(91,141,239,0.12)",
    borderRadius: radius.md,
    padding: spacing.md,
  },
  settingsBtn: {
    alignSelf: "flex-start",
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
});
