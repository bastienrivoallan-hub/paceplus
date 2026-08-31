import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import { AppText, Card } from "@/src/components/ui";
import { scheduleRaceWeatherAlert } from "@/src/notifications";
import { colors, fonts, radius, spacing } from "@/src/theme";

export default function RaceWeatherCard() {
  const [race, setRace] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.raceWeather();
      setRace(r);
      if (r.status === "difficult" && r.flags?.length && Platform.OS !== "web") {
        scheduleRaceWeatherAlert(r.race_date, r.flags);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await api.geoSearch(query.trim());
        setResults(r.results || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const selectCity = async (item: any) => {
    setSaving(true);
    try {
      const label = [item.name, item.region].filter(Boolean).join(", ");
      await api.saveRaceLocation(label, item.lat, item.lon);
      setModalOpen(false);
      setQuery("");
      setResults([]);
      await load();
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  if (!race || race.status === "no_race" || race.status === "past") return null;

  const f = race.forecast;
  const cityModal = (
    <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <AppText variant="title">Ville de la course</AppText>
            <Pressable testID="race-city-close" onPress={() => setModalOpen(false)} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              testID="race-city-input"
              value={query}
              onChangeText={setQuery}
              placeholder="Ex : Paris, Lyon, Annecy…"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoFocus
              autoCorrect={false}
            />
            {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          </View>
          <ScrollView style={{ maxHeight: 260 }} keyboardShouldPersistTaps="handled">
            {results.map((it, i) => (
              <Pressable
                key={`${it.name}-${i}`}
                testID={`race-city-result-${i}`}
                onPress={() => selectCity(it)}
                disabled={saving}
                style={styles.resultRow}
              >
                <Ionicons name="location-outline" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{it.name}</AppText>
                  <AppText variant="caption">{[it.region, it.country].filter(Boolean).join(" · ")}</AppText>
                </View>
              </Pressable>
            ))}
            {query.trim().length >= 2 && !searching && results.length === 0 ? (
              <AppText variant="caption" style={{ padding: spacing.md }}>
                Aucune ville trouvée.
              </AppText>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  if (race.status === "need_location") {
    return (
      <>
        <Pressable testID="race-set-city" onPress={() => setModalOpen(true)} style={styles.promptCard}>
          <View style={styles.icon}>
            <Ionicons name="flag" size={22} color={colors.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">
              {race.goal_label} dans {race.days_left} j — où a lieu ta course ?
            </AppText>
            <AppText variant="caption" style={{ marginTop: 2 }}>
              Indique la ville pour recevoir la météo du jour J et ta stratégie
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>
        {cityModal}
      </>
    );
  }

  if (race.status === "too_far") {
    return (
      <>
        <Card style={styles.slimCard} testID="race-too-far-card">
          <Ionicons name="flag-outline" size={18} color={colors.textSecondary} />
          <AppText variant="caption" style={{ flex: 1 }}>
            {race.goal_label} à {race.race_location?.city} dans {race.days_left} j · météo du jour J dès J-15
          </AppText>
          <Pressable testID="race-edit-city" onPress={() => setModalOpen(true)} hitSlop={10}>
            <Ionicons name="pencil" size={16} color={colors.textMuted} />
          </Pressable>
        </Card>
        {cityModal}
      </>
    );
  }

  const difficult = race.status === "difficult";
  const accent = difficult ? colors.orange : colors.primary;

  return (
    <>
      <Card style={[styles.raceCard, { borderColor: `${accent}66` }]} testID="race-weather-card">
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name={difficult ? "warning" : "flag"} size={16} color={accent} />
            <AppText variant="label" style={{ color: accent }}>
              {difficult ? "ALERTE MÉTÉO COURSE" : "MÉTÉO DE TA COURSE"}
            </AppText>
          </View>
          <Pressable testID="race-edit-city" onPress={() => setModalOpen(true)} hitSlop={10}>
            <Ionicons name="pencil" size={16} color={colors.textMuted} />
          </Pressable>
        </View>

        <AppText variant="bodyStrong" style={{ marginTop: spacing.md }}>
          J-{race.days_left} · {race.goal_label} à {race.race_location?.city}
        </AppText>

        {f ? (
          <View style={styles.forecastRow}>
            <Ionicons name={f.icon as any} size={26} color={accent} />
            <View style={{ flex: 1 }}>
              <AppText variant="body" style={{ fontSize: 14 }}>
                {f.condition} · {Math.round(f.temp_min_c)}–{Math.round(f.temp_max_c)}°C · vent{" "}
                {Math.round(f.wind_max_kmh)} km/h · pluie {f.rain_prob ?? 0}%
              </AppText>
            </View>
          </View>
        ) : null}

        {difficult ? (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }}>
              {(race.flags || []).map((fl: string) => (
                <View key={fl} style={[styles.flagPill, { borderColor: `${accent}66` }]}>
                  <AppText style={{ fontFamily: fonts.semibold, fontSize: 12, color: accent }}>{fl}</AppText>
                </View>
              ))}
            </View>
            {race.strategy ? (
              <Pressable
                testID="race-strategy-toggle"
                onPress={() => setStrategyOpen((v) => !v)}
                style={styles.strategyToggle}
              >
                <Ionicons name="speedometer-outline" size={16} color={accent} />
                <AppText variant="bodyStrong" style={{ flex: 1, color: accent }}>
                  Stratégie d&apos;allure ajustée
                </AppText>
                <Ionicons name={strategyOpen ? "chevron-up" : "chevron-down"} size={18} color={accent} />
              </Pressable>
            ) : null}
            {strategyOpen && race.strategy ? (
              <AppText variant="body" style={{ marginTop: spacing.sm, fontSize: 14 }} testID="race-strategy-text">
                {race.strategy}
              </AppText>
            ) : null}
          </>
        ) : (
          <AppText variant="caption" style={{ marginTop: spacing.sm, color: colors.primary }}>
            Conditions favorables annoncées. Garde ton plan d&apos;allure 💪
          </AppText>
        )}
      </Card>
      {cityModal}
    </>
  );
}

const styles = StyleSheet.create({
  promptCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: `${colors.orange}55`,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(232,161,60,0.14)",
  },
  slimCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  raceCard: {
    marginTop: spacing.md,
  },
  forecastRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  flagPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  strategyToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    backgroundColor: "rgba(232,161,60,0.10)",
    borderRadius: radius.md,
    padding: spacing.md,
  },
  modalWrap: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 48,
  },
});
