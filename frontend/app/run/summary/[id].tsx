import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import { AppText, Card, PaceButton } from "@/src/components/ui";
import RunMap from "@/src/components/RunMap";
import { colors, fmtDuration, fonts, radius, spacing } from "@/src/theme";

export default function RunSummary() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, friend } = useLocalSearchParams<{ id: string; friend?: string }>();
  const isFriendView = friend === "1";
  const [run, setRun] = useState<any>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [ghost, setGhost] = useState<any>(null);

  const analyze = async () => {
    setAnalyzing(true);
    try {
      const res = await api.runAnalysis(String(id));
      setAnalysis(res.analysis);
    } catch {
      setAnalysis("Analyse indisponible pour le moment.");
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        setRun(await api.run(String(id)));
      } catch {
        /* ignore */
      }
      try {
        const g = await api.runGhost(String(id));
        if (g?.found) setGhost(g);
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
          {isFriendView ? `Course de ${run.owner_name || "ton ami"}` : "Course terminée !"}
        </AppText>
        <AppText variant="caption" style={{ marginTop: 4 }}>
          {new Date(run.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
        </AppText>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.md }}>
        <Card>
          <View style={{ flexDirection: "row" }}>
            <Big label="DISTANCE" value={`${(run.distance_m / 1000).toFixed(2)}`} unit="km" />
            <View style={styles.vline} />
            <Big label="TEMPS" value={fmtDuration(run.duration_s)} unit="" />
            <View style={styles.vline} />
            <Big label="ALLURE" value={run.avg_pace || "--:--"} unit="/km" />
          </View>
        </Card>

        {ghost && !isFriendView ? (
          <Card style={{ marginTop: spacing.xl, borderColor: ghost.faster ? colors.primary : colors.danger }} testID="ghost-card">
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
              <Ionicons name="body-outline" size={16} color={ghost.faster ? colors.primary : colors.danger} />
              <AppText variant="label" style={{ color: ghost.faster ? colors.primary : colors.danger }}>
                MODE FANTOME
              </AppText>
            </View>
            <AppText variant="bodyStrong">
              {ghost.faster ? "Plus rapide" : "Plus lent"} de {fmtDuration(Math.abs(ghost.delta_seconds))} par rapport a ta derniere fois
            </AppText>
            <AppText variant="caption" style={{ marginTop: 4 }}>
              Le {new Date(ghost.previous_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} : {fmtDuration(ghost.previous_duration_s)} ({ghost.previous_avg_pace || "--:--"}/km)
            </AppText>
          </Card>
        ) : null}

        <AppText variant="label" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          PARCOURS
        </AppText>
        <RunMap route={run.route} height={190} />

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

        {!isFriendView && (
          <>
            <AppText variant="label" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
              ANALYSE DU COACH IA
            </AppText>
            {analysis ? (
              <Card testID="run-analysis-card">
                <AppText variant="body" style={{ color: colors.text, lineHeight: 22 }}>
                  {analysis}
                </AppText>
              </Card>
            ) : (
              <PaceButton
                testID="analyze-run-button"
                label="Analyser ma course"
                variant="secondary"
                icon="sparkles"
                loading={analyzing}
                onPress={analyze}
              />
            )}
          </>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.lg, paddingTop: spacing.sm }}>
        <PaceButton
          testID="summary-done"
          label={isFriendView ? "Retour" : "Terminé"}
          onPress={() => (isFriendView ? router.back() : router.replace("/(tabs)"))}
        />
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
