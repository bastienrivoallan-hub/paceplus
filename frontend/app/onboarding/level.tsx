import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { OnboardingHeader } from "@/src/components/OnboardingHeader";
import { AppText, PaceButton } from "@/src/components/ui";
import { useOnboarding } from "@/src/contexts/OnboardingContext";
import { colors, radius, spacing } from "@/src/theme";

const LEVELS = [
  { key: "debutant", label: "Débutant", desc: "Je cours depuis moins de 6 mois", color: colors.blue },
  { key: "intermediaire", label: "Intermédiaire", desc: "6 mois à 2 ans de pratique régulière", color: colors.blue },
  { key: "avance", label: "Avancé", desc: "2 à 5 ans, compétitions occasionnelles", color: colors.orange },
  { key: "expert", label: "Expert", desc: "Plus de 5 ans, objectifs ambitieux", color: colors.purple },
];

export default function LevelStep() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, update } = useOnboarding();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <OnboardingHeader step={2} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 24 }}>
        <AppText variant="h2" style={{ marginTop: spacing.lg }}>
          Ton niveau actuel ?
        </AppText>
        <AppText variant="body" style={{ marginTop: 6, marginBottom: spacing.xl }}>
          Pour calibrer l&apos;intensité de ton programme.
        </AppText>

        {LEVELS.map((l) => {
          const active = data.level === l.key;
          return (
            <Pressable
              key={l.key}
              testID={`level-${l.key}`}
              onPress={() => update({ level: l.key })}
              style={[styles.card, active && { borderColor: colors.primary, backgroundColor: colors.cardAlt }]}
            >
              <View style={[styles.icon, { backgroundColor: `${l.color}22`, borderColor: `${l.color}55` }]}>
                <Ionicons name="walk" size={22} color={l.color} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="title">{l.label}</AppText>
                <AppText variant="caption" style={{ marginTop: 2 }}>
                  {l.desc}
                </AppText>
              </View>
              <View style={[styles.radio, active && { borderColor: colors.primary }]}>
                {active ? <View style={styles.radioDot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.lg }}>
        <PaceButton
          testID="level-continue"
          label="Continuer"
          onPress={() => router.push("/onboarding/chrono")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
});
