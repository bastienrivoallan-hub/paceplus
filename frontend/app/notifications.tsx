import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import { AppText, Card } from "@/src/components/ui";
import { Avatar } from "@/app/friends";
import { colors, spacing } from "@/src/theme";

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<any>({ requests: [], recent_runs: [] });
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    api.notifications()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const respond = async (fid: string, accept: boolean) => {
    try {
      await api.friendRespond(fid, accept);
      load();
    } catch {
      /* ignore */
    }
  };

  const empty = loaded && data.requests.length === 0 && data.recent_runs.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="notif-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <AppText variant="title">Notifications</AppText>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 28 }}>
        {data.requests.length > 0 && (
          <>
            <AppText variant="label" style={{ marginBottom: spacing.md }}>
              DEMANDES D&apos;AMIS
            </AppText>
            <Card testID="notif-requests">
              {data.requests.map((p: any) => (
                <View key={p.friendship_id} style={styles.row}>
                  <Avatar name={p.name} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong">{p.name || p.email}</AppText>
                    <AppText variant="caption">veut devenir ton ami</AppText>
                  </View>
                  <Pressable testID={`notif-accept-${p.friendship_id}`} onPress={() => respond(p.friendship_id, true)} style={styles.iconBtn}>
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  </Pressable>
                  <Pressable testID={`notif-refuse-${p.friendship_id}`} onPress={() => respond(p.friendship_id, false)} style={styles.iconBtn}>
                    <Ionicons name="close" size={20} color={colors.danger} />
                  </Pressable>
                </View>
              ))}
            </Card>
          </>
        )}

        {data.recent_runs.length > 0 && (
          <>
            <AppText variant="label" style={{ marginTop: data.requests.length ? spacing.xl : 0, marginBottom: spacing.md }}>
              CETTE SEMAINE CHEZ TES AMIS
            </AppText>
            <Card>
              {data.recent_runs.map((r: any) => (
                <Pressable
                  key={r.run_id}
                  testID={`notif-run-${r.run_id}`}
                  onPress={() => router.push(`/run/summary/${r.run_id}?friend=1`)}
                  style={styles.row}
                >
                  <Avatar name={r.user?.name} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong">
                      {r.user?.name} a couru {(r.distance_m / 1000).toFixed(1)} km
                    </AppText>
                    <AppText variant="caption">
                      {new Date(r.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              ))}
            </Card>
          </>
        )}

        {empty && (
          <Card style={{ alignItems: "center", paddingVertical: spacing.xxl }}>
            <Ionicons name="notifications-off-outline" size={32} color={colors.textMuted} />
            <AppText variant="caption" style={{ marginTop: spacing.md, textAlign: "center" }}>
              Rien de nouveau pour l&apos;instant.
            </AppText>
          </Card>
        )}
      </ScrollView>
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
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, minHeight: 52 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
