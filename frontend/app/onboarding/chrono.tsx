import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { OnboardingHeader } from "@/src/components/OnboardingHeader";
import { AppText, PaceButton } from "@/src/components/ui";
import { useOnboarding } from "@/src/contexts/OnboardingContext";
import { colors, fonts, radius, spacing } from "@/src/theme";

const TIME_RANGES: Record<string, string[]> = {
  "5km": ["< 20:00", "20:00-25:00", "25:00-30:00", "30:00-35:00", "> 35:00"],
  "10km": ["< 40:00", "40:00-50:00", "50:00-1h00", "1h00-1h10", "> 1h10"],
  semi: ["< 1h40", "1h40-1h55", "1h55-2h15", "2h15-2h45", "> 2h45"],
  marathon: ["< 3h30", "3h30-4h00", "4h00-4h30", "4h30-5h00", "> 5h00"],
};

function Chips({
  values,
  selected,
  onSelect,
  prefix,
}: {
  values: string[];
  selected: string | null;
  onSelect: (v: string) => void;
  prefix: string;
}) {
  return (
    <View style={styles.chipWrap}>
      {values.map((v) => {
        const active = selected === v;
        return (
          <Pressable
            key={v}
            testID={`${prefix}-${v}`}
            onPress={() => onSelect(v)}
            style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
          >
            <AppText
              variant="bodyStrong"
              style={{ color: active ? "#07240D" : colors.text, fontFamily: fonts.semibold }}
            >
              {v}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ChronoStep() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, update } = useOnboarding();
  const ranges = TIME_RANGES[data.goal] || TIME_RANGES.semi;

  const [dateStr, setDateStr] = useState(data.race_date ? isoToDisplay(data.race_date) : "");

  const onDateChange = (t: string) => {
    const digits = t.replace(/\D/g, "").slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)} / ${digits.slice(2, 4)} / ${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)} / ${digits.slice(2)}`;
    setDateStr(out);
    if (digits.length === 8) {
      const dd = digits.slice(0, 2), mm = digits.slice(2, 4), yyyy = digits.slice(4);
      update({ race_date: `${yyyy}-${mm}-${dd}` });
    } else {
      update({ race_date: null });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <OnboardingHeader step={3} />
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 24 }}
      >
        <AppText variant="h2" style={{ marginTop: spacing.lg }}>
          Ton chrono actuel ?
        </AppText>
        <AppText variant="body" style={{ marginTop: 6, marginBottom: spacing.xl }}>
          Pour estimer ta progression.
        </AppText>

        <AppText variant="label" style={{ marginBottom: spacing.md }}>
          TEMPS ACTUEL
        </AppText>
        <View style={styles.dateField}>
          <TextInput
            testID="current-time-input"
            value={data.current_time || ""}
            onChangeText={(v) => update({ current_time: v })}
            placeholder="ex: 1h45"
            placeholderTextColor={colors.textMuted}
            style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 17 }}
          />
        </View>

        <AppText variant="label" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          OBJECTIF CIBLE
        </AppText>
        <View style={styles.dateField}>
          <TextInput
            testID="target-time-input"
            value={data.target_time || ""}
            onChangeText={(v) => update({ target_time: v })}
            placeholder="ex: 1h35"
            placeholderTextColor={colors.textMuted}
            style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 17 }}
          />
        </View>

        <AppText variant="label" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          DATE DE LA COURSE
        </AppText>
        <View style={styles.dateField}>
          <TextInput
            testID="race-date-input"
            value={dateStr}
            onChangeText={onDateChange}
            placeholder="JJ / MM / AAAA"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 17 }}
          />
        </View>
      </KeyboardAwareScrollView>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.lg }}>
        <PaceButton
          testID="chrono-continue"
          label="Continuer"
          onPress={() => router.push("/onboarding/frequency")}
        />
      </View>
    </View>
  );
}

function isoToDisplay(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d} / ${m} / ${y}`;
}

const styles = StyleSheet.create({
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  chip: {
    paddingHorizontal: spacing.lg,
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateField: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 60,
    justifyContent: "center",
  },
});
