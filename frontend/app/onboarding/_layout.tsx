import { Stack } from "expo-router";
import { OnboardingProvider } from "@/src/contexts/OnboardingContext";
import { colors } from "@/src/theme";

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: "slide_from_right",
        }}
      />
    </OnboardingProvider>
  );
}
