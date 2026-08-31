import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Logo } from "@/src/components/ui";
import { colors, spacing } from "@/src/theme";

export function OnboardingHeader({ step, total = 4 }: { step: number; total?: number }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={{ paddingTop: insets.top + 8, paddingHorizontal: spacing.xl }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
        {step > 1 ? (
          <Pressable
            testID="onboarding-back"
            onPress={() => router.back()}
            hitSlop={12}
            style={{
              position: "absolute",
              left: 0,
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        ) : null}
        <Logo size={20} />
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.lg, justifyContent: "center" }}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={{
              width: 34,
              height: 5,
              borderRadius: 3,
              backgroundColor: i < step ? colors.primary : colors.track,
            }}
          />
        ))}
      </View>
    </View>
  );
}
