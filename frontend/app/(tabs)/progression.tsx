import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import { AppText, Card, Logo, PaceButton } from "@/src/components/ui";
import { colors, fmtDuration, fonts, radius, spacing, workoutMeta } from "@/src/theme";

export default function ProgressionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [debrief, setDebrief] = useState<string | null>(null);
  const [debriefLoading, setDebriefLoading] = useState(false);

  const loadDebrief = async () => {
    setDebriefLoading(true);
    try {
      const res = await api.weeklyDebrief();
      setDebrief(res.debrief);
    } catch {
      setDebrief("Débrief indisponible pour le moment.");
    } finally {
      setDebriefLoading(false);
    }
  };

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([api.stats(), api.runs()]);
      setStats(s);
      setRuns(r.runs || []);
    } catch {
      /* ignore */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const maxKm = Math.max(1, ...(stats?.weekly_series || []).map((w: any) => w.km));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={{ width: 26 }} />
        <Logo size={20} />
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 28 }}>
        <AppText variant="h1">Progression</AppText>
        <AppText variant="body" style={{ marginTop: 4, marginBottom: spacing.xl }}>
          Ton évolution semaine après semaine.
        </AppText>

        <Card style={{ marginBottom: spacing.xl }} testID="debrief-card">
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
            <Ionicons name="sparkles" size={16} color={colors.primary} />
            <AppText variant="label" style={{ color: colors.primary }}>
              DÉBRIEF DE LA SEMAINE
            </AppText>
          </View>
          {debrief ? (
            <AppText variant="body" style={{ color: colors.text, lineHeight: 22 }}>
              {debrief}
            </AppText>
          ) : (
            <PaceButton
              testID="debrief-button"
              label="Générer mon débrief IA"
              variant="secondary"
              icon="chatbubble-ellipses"
              loading={debriefLoading}
              onPress={loadDebrief}
              style={{ height: 48 }}
            />
          )}
        </Card>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
          <StatBox icon="map-outline" color={colors.primary} value={`${stats?.total_distance_km ?? 0}`} unit="km" label="Distance totale" />
          <StatBox icon="footsteps-outline" color={colors.blue} value={`${stats?.total_runs ?? 0}`} unit="sorties" label="Courses" />
          <StatBox icon="time-outline" color={colors.orange} value={fmtDuration(stats?.total_duration_s ?? 0)} unit="" label="Temps cumulé" />
          <StatBox icon="checkmark-done-outline" color={colors.purple} value={`${stats?.adherence ?? 0}`} unit="%" label="Assiduité au plan" />
        </View>

        <Card style={{ marginTop: spacing.xl }} testID="weekly-volume-card">
          <AppText variant="label" style={{ marginBottom: spacing.lg }}>
            VOLUME HEBDO (KM)
          </AppText>
          {stats?.weekly_series?.length ? (
            <View style={styles.chart}>
              {stats.weekly_series.map((w: any, i: number) => (
                <View key={i} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                  <AppText variant="caption" style={{ fontSize: 11 }}>
                    {w.km}
                  </AppText>
                  <View style={styles.barTrack}>
                    <View style={{ height: `${(w.km / maxKm) * 100}%`, width: "100%", backgroundColor: colors.primary, borderRadius: 6 }} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <AppText variant="caption">Enregistre des courses pour voir ton volume.</AppText>
          )}
        </Card>

        <AppText variant="title" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          Dernières courses
        </AppText>
        {runs.length === 0 ? (
          <Card style={{ alignItems: "center", paddingVertical: spacing.xxl }}>
            <Ionicons name="walk-outline" size={32} color={colors.textMuted} />
            <AppText variant="caption" style={{ marginTop: spacing.md }}>
              Aucune course enregistrée pour le moment.
            </AppText>
          </Card>
        ) : (
          <View style={{ gap: spacing.md }}>
            {runs.map((r) => {
              const meta = workoutMeta("easy");
              return (
                <Pressable key={r.run_id} onPress={() => router.push(`/run/summary/${r.run_id}`)} testID={`run-${r.run_id}`}>
                  <Card style={styles.runRow}>
                    <View style={[styles.runIcon, { backgroundColor: `${meta.color}22` }]}>
                      <Ionicons name="walk" size={20} color={meta.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyStrong">{(r.distance_m / 1000).toFixed(2)} km</AppText>
                      <AppText variant="caption" style={{ marginTop: 2 }}>
                        {new Date(r.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </AppText>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <AppText variant="bodyStrong">{fmtDuration(r.duration_s)}</AppText>
                      <AppText variant="caption" style={{ marginTop: 2 }}>
                        {r.avg_pace || "—"} /km
                      </AppText>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatBox({ icon, color, value, unit, label }: any) {
  return (
    <Card style={styles.statBox}>
      <Ionicons name={icon} size={18} color={color} />
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: spacing.sm }}>
        <AppText style={{ fontFamily: fonts.displayBold, fontSize: 24, color: colors.text }}>{value}</AppText>
        {unit ? <AppText variant="caption">{unit}</AppText> : null}
      </View>
      <AppText variant="caption" style={{ marginTop: 2 }}>
        {label}
      </AppText>
    </Card>
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
  statBox: { width: "47%", padding: spacing.lg },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 150 },
  barTrack: {
    width: "70%",
    height: 110,
    backgroundColor: colors.track,
    borderRadius: 6,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  runRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  runIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
});
