import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import { AppText, Card } from "@/src/components/ui";
import { Avatar } from "@/app/friends";
import { colors, fmtDuration, radius, spacing } from "@/src/theme";

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [feed, setFeed] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      api.friendsFeed()
        .then((r: any) => setFeed(r.feed || []))
        .catch(() => {})
        .finally(() => setLoaded(true));
    }, []),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="activity-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <AppText variant="title">Activité</AppText>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 28, gap: spacing.md }}>
        {loaded && feed.length === 0 ? (
          <Card style={{ alignItems: "center", paddingVertical: spacing.xxl }}>
            <Ionicons name="pulse-outline" size={32} color={colors.textMuted} />
            <AppText variant="caption" style={{ marginTop: spacing.md, textAlign: "center" }}>
              Aucune activité pour le moment.{"\n"}Ajoute des amis pour voir leurs courses ici !
            </AppText>
            <Pressable testID="activity-add-friends" onPress={() => router.push("/friends")} style={styles.cta}>
              <AppText style={{ color: "#07240D", fontSize: 14 }}>Trouver des amis</AppText>
            </Pressable>
          </Card>
        ) : (
          feed.map((r) => (
            <Pressable key={r.run_id} testID={`feed-${r.run_id}`} onPress={() => router.push(`/run/summary/${r.run_id}?friend=1`)}>
              <Card style={styles.row}>
                <Avatar name={r.user?.name} size={44} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{r.user?.name || "Coureur"}</AppText>
                  <AppText variant="caption" style={{ marginTop: 2 }}>
                    {new Date(r.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} · a couru{" "}
                    {(r.distance_m / 1000).toFixed(2)} km
                  </AppText>
                  <View style={{ flexDirection: "row", gap: spacing.lg, marginTop: 6 }}>
                    <Metric icon="time-outline" value={fmtDuration(r.duration_s)} />
                    <Metric icon="speedometer-outline" value={`${r.avg_pace || "—"} /km`} />
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Metric({ icon, value }: any) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Ionicons name={icon} size={14} color={colors.textMuted} />
      <AppText variant="caption" style={{ fontSize: 13 }}>{value}</AppText>
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
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  cta: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: 10,
  },
});
