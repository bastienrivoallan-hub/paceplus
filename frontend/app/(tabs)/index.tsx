import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import { AppText, Card, Logo, PaceButton, ProgressRing, WorkoutBadge } from "@/src/components/ui";
import { colors, fonts, radius, spacing, workoutMeta } from "@/src/theme";

function scoreColor(s: number) {
  if (s >= 80) return colors.primary;
  if (s >= 65) return "#B7E36B";
  if (s >= 50) return colors.orange;
  return colors.danger;
}

function structureBars(type?: string): number[] {
  switch (type) {
    case "intervals":
      return [0.35, 0.35, 0.9, 1, 0.95, 1, 0.4, 0.35];
    case "threshold":
    case "tempo":
      return [0.35, 0.6, 0.8, 0.8, 0.8, 0.75, 0.5, 0.35];
    case "long":
      return [0.5, 0.6, 0.65, 0.6, 0.65, 0.6, 0.6, 0.55];
    case "easy":
    case "recovery":
      return [0.4, 0.5, 0.5, 0.5, 0.5, 0.5, 0.45, 0.4];
    case "race":
      return [0.6, 0.8, 0.9, 1, 1, 0.95, 0.9, 0.7];
    default:
      return [];
  }
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.homeToday();
      setData(d);
    } catch {
      /* ignore */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const form = data?.form;
  const session = data?.today_session;
  const meta = workoutMeta(session?.type);
  const bars = structureBars(session?.type);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Ionicons name="menu" size={26} color={colors.text} />
        <Logo size={20} subtitle="TON COACH RUNNING" />
        <View>
          <Ionicons name="notifications-outline" size={24} color={colors.text} />
          <View style={styles.dot} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Greeting + streak */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <AppText variant="h2">Bonjour {data?.name || ""} 👋</AppText>
            <AppText variant="body" style={{ marginTop: 4 }}>
              Prêt à courir aujourd'hui ?
            </AppText>
          </View>
          <View style={styles.streak} testID="home-streak">
            <AppText style={{ fontSize: 22 }}>🔥</AppText>
            <View>
              <AppText style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.text }}>
                {data?.streak ?? 0}
              </AppText>
              <AppText variant="caption">Série en cours</AppText>
            </View>
          </View>
        </View>

        {/* Form of the day */}
        {form && (
          <Card style={{ marginTop: spacing.xl }} testID="home-form-card">
            <AppText variant="label" style={{ marginBottom: spacing.lg }}>
              TA FORME DU JOUR
            </AppText>
            <View style={{ flexDirection: "row", gap: spacing.lg }}>
              <ProgressRing size={118} stroke={10} progress={form.score / 100} color={scoreColor(form.score)}>
                <AppText style={{ fontFamily: fonts.displayBold, fontSize: 34, color: colors.text }}>
                  {form.score}
                </AppText>
                <AppText variant="caption" style={{ marginTop: -4 }}>
                  /100
                </AppText>
              </ProgressRing>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong" style={{ color: scoreColor(form.score) }}>
                  {form.label}
                </AppText>
                <AppText variant="body" style={{ marginTop: 6, fontSize: 14 }}>
                  {form.message}
                </AppText>
              </View>
            </View>

            <View style={styles.metricsGrid}>
              <Metric icon="moon" color={colors.blue} label="SOMMEIL" value={form.sleep} sub={form.sleep_status} />
              <Metric icon="heart" color={colors.pink} label="RÉCUPÉRATION" value={`${form.hrv} ms`} sub={form.hrv_status} />
              <Metric icon="flash" color={colors.orange} label="CHARGE" value={`${form.charge}`} sub={form.charge_status} />
              <Metric icon="pulse" color={colors.primary} label="FC REPOS" value={`${form.resting_hr} bpm`} sub={form.rhr_status} />
            </View>
          </Card>
        )}

        {/* Session of the day */}
        {session ? (
          <Card style={{ marginTop: spacing.xl }} testID="home-session-card">
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <WorkoutBadge type={session.type} size={32} />
                <AppText variant="label" style={{ color: meta.color }}>
                  SÉANCE DU JOUR
                </AppText>
              </View>
              <Pressable
                testID="session-details-link"
                onPress={() => router.push(`/session/${session.session_id}`)}
                style={{ flexDirection: "row", alignItems: "center" }}
              >
                <AppText variant="caption" style={{ color: colors.textSecondary }}>
                  Détails
                </AppText>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </Pressable>
            </View>

            <AppText style={{ fontFamily: fonts.displayBold, fontSize: 40, color: colors.text, marginTop: spacing.sm }}>
              {session.title}
            </AppText>
            {session.subtitle && session.subtitle !== "-" ? (
              <View style={styles.pacePill}>
                <AppText variant="bodyStrong" style={{ color: colors.blue }}>
                  {session.subtitle}
                </AppText>
              </View>
            ) : null}

            <View style={{ flexDirection: "row", marginTop: spacing.lg }}>
              <View style={{ flex: 1, gap: spacing.md }}>
                <InfoRow icon="time-outline" label="Durée" value={session.duration_min > 0 ? `${session.duration_min} min` : "—"} />
                <InfoRow icon="pulse-outline" label="Intensité" value={session.intensity} />
                <InfoRow icon="flag-outline" label="Objectif" value={session.objective} />
              </View>
              {bars.length > 0 && (
                <View style={styles.chart}>
                  {bars.map((h, i) => (
                    <View
                      key={i}
                      style={{
                        width: 14,
                        height: 60 * h,
                        borderRadius: 4,
                        backgroundColor: h > 0.7 ? meta.color : colors.track,
                      }}
                    />
                  ))}
                </View>
              )}
            </View>

            {session.type !== "rest" && (
              <PaceButton
                testID="start-session-button"
                label="Démarrer la séance"
                icon="play"
                onPress={() => router.push(`/run/active?sessionId=${session.session_id}`)}
                style={{ marginTop: spacing.lg, height: 50 }}
              />
            )}
          </Card>
        ) : (
          <Card style={{ marginTop: spacing.xl, alignItems: "center", paddingVertical: spacing.xxl }}>
            <AppText variant="title">Aucune séance aujourd'hui</AppText>
            <AppText variant="caption" style={{ marginTop: 6 }}>
              Consulte ton calendrier pour la suite.
            </AppText>
          </Card>
        )}

        {/* Coach CTA */}
        <Pressable testID="home-coach-cta" onPress={() => router.push("/coach")} style={styles.coachCta}>
          <View style={styles.coachIcon}>
            <Ionicons name="chatbubbles" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">Parle à ton coach IA</AppText>
            <AppText variant="caption" style={{ marginTop: 2 }}>
              Conseils personnalisés en temps réel
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Metric({ icon, color, label, value, sub }: any) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={16} color={color} />
      <AppText variant="label" style={{ fontSize: 10, marginTop: 6 }}>
        {label}
      </AppText>
      <AppText style={{ fontFamily: fonts.displayBold, fontSize: 18, color: colors.text, marginTop: 2 }}>
        {value}
      </AppText>
      <AppText variant="caption" style={{ fontSize: 12 }}>
        {sub}
      </AppText>
    </View>
  );
}

function InfoRow({ icon, label, value }: any) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <View>
        <AppText variant="caption" style={{ fontSize: 12 }}>
          {label}
        </AppText>
        <AppText variant="bodyStrong">{value}</AppText>
      </View>
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
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  streak: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  metric: {
    width: "47%",
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  pacePill: {
    alignSelf: "flex-start",
    marginTop: spacing.md,
    backgroundColor: "rgba(91,141,239,0.15)",
    borderColor: "rgba(91,141,239,0.4)",
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
  },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 5,
    height: 60,
    paddingLeft: spacing.md,
  },
  coachCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  coachIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
});
