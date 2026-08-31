import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { OnboardingHeader } from "@/src/components/OnboardingHeader";
import { AppText, PaceButton } from "@/src/components/ui";
import { useOnboarding } from "@/src/context/OnboardingContext";
import { colors, fonts, radius, spacing } from "@/src/theme";

const GOALS = [
  { key: "5km", label: "5 km", desc: "Rapide et explosif", icon: "flash", color: colors.primary },
  { key: "10km", label: "10 km", desc: "Vitesse & endurance", icon: "speedometer", color: colors.blue },
  { key: "semi", label: "Semi-marathon", desc: "21,1 km — le défi", icon: "trending-up", color: colors.orange },
  { key: "marathon", label: "Marathon", desc: "42,2 km — la légende", icon: "trophy", color: colors.purple },
];

export default function GoalStep() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, update } = useOnboarding();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <OnboardingHeader step={1} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 24 }}>
        <AppText variant="h2" style={{ marginTop: spacing.lg }}>
          Quel est ton objectif ?
        </AppText>
        <AppText variant="body" style={{ marginTop: 6, marginBottom: spacing.xl }}>
          On construit ton plan autour de cette course.
        </AppText>

        {GOALS.map((g) => {
          const active = data.goal === g.key;
          return (
            <Pressable
              key={g.key}
              testID={`goal-${g.key}`}
              onPress={() => update({ goal: g.key })}
              style={[styles.card, active && { borderColor: colors.primary, backgroundColor: colors.cardAlt }]}
            >
              <View
                style={[
                  styles.icon,
                  { backgroundColor: `${g.color}22`, borderColor: `${g.color}55` },
                ]}
              >
                <Ionicons name={g.icon as any} size={22} color={g.color} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="title">{g.label}</AppText>
                <AppText variant="caption" style={{ marginTop: 2 }}>
                  {g.desc}
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
          testID="goal-continue"
          label="Continuer"
          onPress={() => router.push("/onboarding/level")}
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
