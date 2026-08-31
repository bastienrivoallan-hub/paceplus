import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import { AppText, Card, Logo, WorkoutBadge } from "@/src/components/ui";
import { colors, DAYS_FR, fonts, radius, spacing, workoutMeta } from "@/src/theme";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [plan, setPlan] = useState<any>(null);
  const [week, setWeek] = useState(1);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adapting, setAdapting] = useState(false);
  const [adaptNote, setAdaptNote] = useState<string | null>(null);

  const loadWeek = useCallback(async (w: number) => {
    const res = await api.week(w);
    setSessions(res.sessions || []);
  }, []);

  const boot = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.activePlan();
      setPlan(res.plan);
      const w = res.current_week || 1;
      setWeek(w);
      await loadWeek(w);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [loadWeek]);

  useFocusEffect(
    useCallback(() => {
      boot();
    }, [boot]),
  );

  const changeWeek = async (w: number) => {
    if (!plan || w < 1 || w > plan.total_weeks) return;
    setWeek(w);
    await loadWeek(w);
  };

  const adapt = async () => {
    setAdapting(true);
    setAdaptNote(null);
    try {
      const res = await api.adaptPlan(week);
      setAdaptNote(res.coach_note);
      await loadWeek(week);
    } catch {
      setAdaptNote("Adaptation impossible pour le moment, réessaie.");
    } finally {
      setAdapting(false);
    }
  };

  const toggle = async (s: any) => {
    setSessions((prev) =>
      prev.map((x) => (x.session_id === s.session_id ? { ...x, completed: !x.completed } : x)),
    );
    try {
      if (s.completed) await api.uncompleteSession(s.session_id);
      else await api.completeSession(s.session_id);
    } catch {
      loadWeek(week);
    }
  };

  const today = todayIso();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={{ width: 26 }} />
        <Logo size={20} />
        <Ionicons name="calendar-outline" size={24} color={colors.text} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : !plan ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
          <AppText variant="title">Pas encore de plan</AppText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 28 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <AppText variant="h1">Plan</AppText>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable testID="week-prev" onPress={() => changeWeek(week - 1)} style={styles.weekBtn}>
                <Ionicons name="chevron-back" size={18} color={week > 1 ? colors.text : colors.textMuted} />
              </Pressable>
              <Pressable testID="week-next" onPress={() => changeWeek(week + 1)} style={styles.weekBtn}>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={week < plan.total_weeks ? colors.text : colors.textMuted}
                />
              </Pressable>
            </View>
          </View>
          <AppText variant="body" style={{ marginTop: 4 }}>
            Semaine {week} sur {plan.total_weeks}  ·  {plan.goal_label}
            {plan.target_time ? `  —  Objectif : ${plan.target_time}` : ""}
          </AppText>

          <Pressable testID="adapt-week-button" onPress={adapt} disabled={adapting} style={styles.adaptBtn}>
            {adapting ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Ionicons name="sparkles" size={16} color={colors.primary} />
            )}
            <AppText variant="bodyStrong" style={{ color: colors.primary, fontSize: 14 }}>
              {adapting ? "Le coach adapte…" : "Adapter cette semaine avec l'IA"}
            </AppText>
          </Pressable>

          {adaptNote && (
            <View style={styles.noteCard} testID="adapt-note">
              <Ionicons name="chatbubble-ellipses" size={18} color={colors.primary} style={{ marginTop: 2 }} />
              <AppText variant="body" style={{ flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 }}>
                {adaptNote}
              </AppText>
            </View>
          )}

          {/* Day selector */}
          <View style={styles.dayRow}>
            {DAYS_FR.map((d, i) => {
              const s = sessions.find((x) => x.day_index === i);
              const meta = workoutMeta(s?.type);
              const isToday = s?.date === today;
              return (
                <View key={d} style={[styles.dayCol, isToday && styles.dayColActive]}>
                  <AppText variant="label" style={{ fontSize: 11, color: isToday ? colors.text : colors.textMuted }}>
                    {d}
                  </AppText>
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      marginTop: 8,
                      backgroundColor: s && s.type !== "rest" ? meta.color : colors.track,
                    }}
                  />
                </View>
              );
            })}
          </View>

          {/* Sessions list */}
          <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
            {sessions.map((s) => {
              const meta = workoutMeta(s.type);
              const isToday = s.date === today;
              return (
                <Pressable
                  key={s.session_id}
                  testID={`plan-session-${s.session_id}`}
                  onPress={() => router.push(`/session/${s.session_id}`)}
                >
                  <Card
                    style={[
                      styles.sessionCard,
                      isToday && { borderColor: colors.primary, borderLeftWidth: 4 },
                    ]}
                  >
                    <WorkoutBadge type={s.type} size={48} />
                    <View style={{ flex: 1 }}>
                      <AppText variant="title">{s.title}</AppText>
                      {s.subtitle && s.subtitle !== "-" ? (
                        <AppText variant="caption" style={{ marginTop: 2 }}>
                          {s.subtitle}
                        </AppText>
                      ) : null}
                      {isToday ? (
                        <AppText variant="bodyStrong" style={{ color: colors.primary, marginTop: 2, fontSize: 13 }}>
                          Aujourd'hui
                        </AppText>
                      ) : null}
                    </View>
                    {s.type === "rest" ? (
                      <View style={{ width: 32 }} />
                    ) : (
                      <Pressable testID={`toggle-${s.session_id}`} onPress={() => toggle(s)} hitSlop={10}>
                        {s.completed ? (
                          <View style={styles.checkOn}>
                            <Ionicons name="checkmark" size={20} color="#07240D" />
                          </View>
                        ) : (
                          <View style={styles.checkOff} />
                        )}
                      </Pressable>
                    )}
                  </Card>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  weekBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xl },
  adaptBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  noteCard: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayCol: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  dayColActive: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderStrong },
  sessionCard: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  checkOn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOff: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
});
