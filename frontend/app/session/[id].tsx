import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import { AppText, Card, PaceButton, WorkoutBadge } from "@/src/components/ui";
import { colors, fonts, radius, spacing, workoutMeta } from "@/src/theme";

const DESCRIPTIONS: Record<string, string> = {
  intervals:
    "Après un échauffement progressif, enchaîne des répétitions rapides entrecoupées de récupérations. Vise une allure soutenue et régulière sur chaque intervalle pour développer ta VMA.",
  threshold:
    "Cours à une intensité proche de ton seuil, soutenue mais contrôlée. Tu dois pouvoir tenir l'effort sans exploser. Idéal pour repousser ton seuil et courir plus vite plus longtemps.",
  tempo:
    "Une allure tempo maintenue sur la durée, entre l'endurance et le seuil. Reste concentré sur ta respiration et ta foulée.",
  long:
    "La sortie clé de ta semaine : dure, en endurance fondamentale. Prends ton temps, hydrate-toi et construis ton capital d'endurance.",
  easy:
    "Footing tranquille en endurance fondamentale. Tu dois pouvoir parler en courant. C'est le socle de ta progression et de ta récupération active.",
  recovery:
    "Séance très légère pour favoriser la récupération. Reste dans le confort total, l'objectif est de bouger sans fatiguer.",
  race: "Jour de course ! Fais confiance à ta préparation, gère ton allure et savoure l'effort.",
  rest: "Journée de repos. La récupération fait partie intégrante de l'entraînement — laisse ton corps assimiler la charge.",
};

function structureBars(type?: string): number[] {
  switch (type) {
    case "intervals": return [0.35, 0.35, 0.9, 1, 0.95, 1, 0.4, 0.35];
    case "threshold":
    case "tempo": return [0.35, 0.6, 0.8, 0.8, 0.8, 0.75, 0.5, 0.35];
    case "long": return [0.5, 0.6, 0.65, 0.6, 0.65, 0.6, 0.6, 0.55];
    case "easy":
    case "recovery": return [0.4, 0.5, 0.5, 0.5, 0.5, 0.5, 0.45, 0.4];
    case "race": return [0.6, 0.8, 0.9, 1, 1, 0.95, 0.9, 0.7];
    default: return [];
  }
}

export default function SessionDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [s, setS] = useState<any>(null);

  const load = async () => {
    try {
      const res = await api.session(String(id));
      setS(res);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!s) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const meta = workoutMeta(s.type);
  const bars = structureBars(s.type);

  const toggleComplete = async () => {
    if (s.completed) {
      await api.uncompleteSession(s.session_id);
    } else {
      await api.completeSession(s.session_id);
    }
    load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="session-back" onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <AppText variant="title">Séance</AppText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 40 }}>
        <View style={{ alignItems: "center", marginTop: spacing.md }}>
          <WorkoutBadge type={s.type} size={72} />
          <AppText style={{ fontFamily: fonts.displayBold, fontSize: 34, color: colors.text, marginTop: spacing.md, textAlign: "center" }}>
            {s.title}
          </AppText>
          {s.subtitle && s.subtitle !== "-" ? (
            <View style={[styles.pill, { borderColor: `${meta.color}55`, backgroundColor: `${meta.color}18` }]}>
              <AppText variant="bodyStrong" style={{ color: meta.color }}>
                {s.subtitle}
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.xl }}>
          <MetaBox icon="time-outline" label="Durée" value={s.duration_min > 0 ? `${s.duration_min} min` : "—"} />
          <MetaBox icon="pulse-outline" label="Intensité" value={s.intensity} />
          <MetaBox icon="flag-outline" label="Objectif" value={s.objective} />
        </View>

        {bars.length > 0 && (
          <Card style={{ marginTop: spacing.xl }}>
            <AppText variant="label" style={{ marginBottom: spacing.lg }}>
              STRUCTURE
            </AppText>
            <View style={styles.chart}>
              {bars.map((h, i) => (
                <View key={i} style={{ flex: 1, height: 80 * h, borderRadius: 5, backgroundColor: h > 0.7 ? meta.color : colors.track }} />
              ))}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm }}>
              <AppText variant="caption" style={{ fontSize: 11 }}>Échauffement</AppText>
              <AppText variant="caption" style={{ fontSize: 11 }}>Corps de séance</AppText>
              <AppText variant="caption" style={{ fontSize: 11 }}>Retour au calme</AppText>
            </View>
          </Card>
        )}

        <Card style={{ marginTop: spacing.xl }}>
          <AppText variant="label" style={{ marginBottom: spacing.md }}>
            CONSEIL DU COACH
          </AppText>
          <AppText variant="body" style={{ lineHeight: 22 }}>
            {DESCRIPTIONS[s.type] || DESCRIPTIONS.easy}
          </AppText>
        </Card>

        {s.type !== "rest" && (
          <PaceButton
            testID="detail-start-button"
            label="Démarrer la séance"
            icon="play"
            onPress={() => router.push(`/run/active?sessionId=${s.session_id}`)}
            style={{ marginTop: spacing.xl }}
          />
        )}
        <PaceButton
          testID="detail-complete-button"
          label={s.completed ? "Marquer comme non faite" : "Marquer comme terminée"}
          variant="secondary"
          icon={s.completed ? "close" : "checkmark"}
          onPress={toggleComplete}
          style={{ marginTop: spacing.sm }}
        />
      </ScrollView>
    </View>
  );
}

function MetaBox({ icon, label, value }: any) {
  return (
    <View style={styles.metaBox}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <AppText variant="caption" style={{ fontSize: 11, marginTop: 6 }}>
        {label}
      </AppText>
      <AppText variant="bodyStrong" style={{ marginTop: 2, textAlign: "center" }}>
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
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pill: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
  },
  metaBox: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 6, height: 80 },
});
