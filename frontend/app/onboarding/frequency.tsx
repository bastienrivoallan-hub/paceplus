import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OnboardingHeader } from "@/src/components/OnboardingHeader";
import { AppText, Logo, PaceButton } from "@/src/components/ui";
import { useOnboarding } from "@/src/context/OnboardingContext";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api";
import { colors, fonts, radius, spacing } from "@/src/theme";

const GOAL_LABELS: Record<string, string> = {
  "5km": "5 km", "10km": "10 km", semi: "Semi-marathon", marathon: "Marathon",
};
const LEVEL_LABELS: Record<string, string> = {
  debutant: "Débutant", intermediaire: "Intermédiaire", avance: "Avancé", expert: "Expert",
};

export default function FrequencyStep() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, update } = useOnboarding();
  const { refreshUser } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setError(null);
    setGenerating(true);
    try {
      await api.saveOnboarding(data);
      await api.generatePlan();
      await refreshUser();
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Génération impossible, réessaie.");
      setGenerating(false);
    }
  };

  const rows = [
    { label: "Objectif", value: GOAL_LABELS[data.goal] },
    { label: "Niveau", value: LEVEL_LABELS[data.level] },
    { label: "Chrono actuel", value: data.current_time || "—" },
    { label: "Objectif chrono", value: data.target_time || "—" },
    { label: "Date de course", value: data.race_date || "—" },
    { label: "Fréquence", value: `${data.frequency} séances / semaine` },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <OnboardingHeader step={4} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 24 }}>
        <AppText variant="h2" style={{ marginTop: spacing.lg }}>
          Combien de séances ?
        </AppText>
        <AppText variant="body" style={{ marginTop: 6, marginBottom: spacing.xl }}>
          Par semaine, en dehors des jours de compétition.
        </AppText>

        <View style={styles.freqRow}>
          {[2, 3, 4, 5, 6].map((n) => {
            const active = data.frequency === n;
            return (
              <Pressable
                key={n}
                testID={`freq-${n}`}
                onPress={() => update({ frequency: n })}
                style={[styles.freqBox, active && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
              >
                <AppText style={{ fontFamily: fonts.displayBold, fontSize: 24, color: active ? colors.primary : colors.textMuted }}>
                  {n}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.recap}>
          <AppText variant="title" style={{ marginBottom: spacing.md }}>
            Récapitulatif
          </AppText>
          {rows.map((r) => (
            <View key={r.label} style={styles.recapRow}>
              <AppText variant="body">{r.label}</AppText>
              <AppText variant="bodyStrong">{r.value}</AppText>
            </View>
          ))}
        </View>

        {error && (
          <AppText testID="freq-error" style={{ color: colors.danger, marginTop: spacing.md }}>
            {error}
          </AppText>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.lg }}>
        <PaceButton
          testID="generate-plan-button"
          label="Générer mon plan d'entraînement"
          onPress={generate}
        />
      </View>

      {generating && (
        <View style={styles.overlay} testID="generating-overlay">
          <Logo size={26} subtitle="TON COACH RUNNING" />
          <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: spacing.xl }} />
          <AppText variant="h3" style={{ marginTop: spacing.xl, textAlign: "center" }}>
            Ton coach IA construit ton plan…
          </AppText>
          <AppText variant="body" style={{ marginTop: 8, textAlign: "center" }}>
            Personnalisation de chaque séance. Cela prend quelques secondes.
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  freqRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.xl },
  freqBox: {
    flex: 1,
    aspectRatio: 0.85,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  recap: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  recapRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,10,12,0.97)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
  },
});
