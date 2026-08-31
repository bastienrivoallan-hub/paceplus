import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

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
        {filtered.map((r) => {
          const meta = workoutMeta(r.type);
          return (
            <Card key={r.id} style={{ padding: 0, overflow: "hidden" }} testID={`route-${r.id}`}>
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
                  <View style={[styles.diffBadge, { borderColor: `${meta.color}55` }]}>
                    <AppText style={{ fontFamily: fonts.semibold, fontSize: 12, color: meta.color }}>
                      {r.difficulty}
                    </AppText>
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
});
