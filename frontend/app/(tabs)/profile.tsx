import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import { storage } from "@/src/utils/storage";
import {
  cancelReminders,
  getReminderPermission,
  requestReminderPermission,
  scheduleSessionReminders,
} from "@/src/notifications";
import { useAuth } from "@/src/context/AuthContext";
import { appleHealthSupported, connectAppleHealth, fetchAppleWatchRuns, isExpoGo, WatchWorkout } from "@/src/health";
import { AppText, Card, Logo, PaceButton } from "@/src/components/ui";
import { colors, fonts, radius, spacing } from "@/src/theme";

const GOAL_LABELS: Record<string, string> = { "5km": "5 km", "10km": "10 km", semi: "Semi-marathon", marathon: "Marathon" };
const LEVEL_LABELS: Record<string, string> = { debutant: "Débutant", intermediaire: "Intermédiaire", avance: "Avancé", expert: "Expert" };

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [regen, setRegen] = useState(false);
  const [notif, setNotif] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [watchMsg, setWatchMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [watchWorkouts, setWatchWorkouts] = useState<WatchWorkout[]>([]);

  const REM_KEY = "pace_reminders";

  useEffect(() => {
    (async () => {
      const pref = await storage.getItem<boolean>(REM_KEY, false);
      const { granted } = await getReminderPermission();
      setNotif(!!pref && granted);
    })();
    api.watchWorkouts().then((r: any) => setWatchWorkouts(r.workouts || [])).catch(() => {});
  }, []);

  const HEALTH_MESSAGES: Record<string, string> = {
    expo_go: "Apple Santé ne fonctionne pas dans Expo Go. Génère le build iOS (bouton Publish en haut à droite), installe l'app, puis réessaie.",
    not_ios: "Apple Santé est disponible uniquement sur iPhone.",
    module_missing: "Ce build ne contient pas encore Apple Santé : régénère un build iOS depuis Publish.",
    unavailable: "Apple Santé n'est pas disponible sur cet appareil.",
    denied_or_error: "Accès refusé ou incomplet. Va dans Réglages → Santé → Accès aux données → PACE et active la lecture.",
  };

  const syncAppleHealth = async () => {
    setSyncing(true);
    setWatchMsg(null);
    try {
      const { authorized, reason } = await connectAppleHealth();
      if (!authorized) {
        setWatchMsg(HEALTH_MESSAGES[reason] || "Connexion à Apple Santé impossible.");
        return;
      }
      const runs = await fetchAppleWatchRuns(30);
      if (!runs.length) {
        setWatchMsg("Aucune course trouvée sur les 30 derniers jours. Vérifie aussi Réglages → Santé → Accès aux données.");
        return;
      }
      const res: any = await api.syncWatchWorkouts(runs);
      const r: any = await api.watchWorkouts();
      setWatchWorkouts(r.workouts || []);
      setWatchMsg(`✅ ${res.synced} entraînement${res.synced > 1 ? "s" : ""} importé${res.synced > 1 ? "s" : ""} depuis Apple Santé`);
    } catch (e: any) {
      setWatchMsg(e?.message || "Erreur de synchronisation");
    } finally {
      setSyncing(false);
    }
  };

  const toggleNotif = async (val: boolean) => {
    setMsg(null);
    if (!val) {
      await cancelReminders();
      await storage.setItem(REM_KEY, false);
      setNotif(false);
      setMsg("Rappels désactivés");
      return;
    }
    try {
      let { granted, canAskAgain } = await getReminderPermission();
      if (!granted) {
        const r = await requestReminderPermission();
        granted = r.granted;
        canAskAgain = r.canAskAgain;
      }
      if (!granted) {
        setNotif(false);
        if (!canAskAgain) {
          setMsg("Active les notifications dans les réglages pour recevoir tes rappels.");
        } else {
          setMsg("Autorise les notifications pour activer les rappels.");
        }
        return;
      }
      const n = await scheduleSessionReminders();
      await storage.setItem(REM_KEY, true);
      setNotif(true);
      setMsg(`Rappels activés ✅ ${n} séance${n > 1 ? "s" : ""} programmée${n > 1 ? "s" : ""}`);
    } catch {
      setNotif(false);
      setMsg("Les rappels fonctionnent sur l'app mobile (Expo Go / build).");
    }
  };

  const profile = user?.profile;
  const initials = (user?.name || user?.email || "?").slice(0, 1).toUpperCase();

  const regenerate = async () => {
    setRegen(true);
    setMsg(null);
    try {
      await api.generatePlan();
      if (notif) await scheduleSessionReminders();
      setMsg("Nouveau plan généré ✅");
    } catch (e: any) {
      setMsg(e.message || "Erreur");
    } finally {
      setRegen(false);
    }
  };

  const doLogout = async () => {
    await logout();
    router.replace("/auth");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={{ width: 26 }} />
        <Logo size={20} />
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 28 }}>
        <View style={{ alignItems: "center", marginTop: spacing.md }}>
          <View style={styles.avatar}>
            <AppText style={{ fontFamily: fonts.displayBold, fontSize: 34, color: "#07240D" }}>{initials}</AppText>
          </View>
          <AppText variant="h2" style={{ marginTop: spacing.md }}>
            {user?.name || "Coureur"}
          </AppText>
          <AppText variant="caption" style={{ marginTop: 2 }}>
            {user?.email}
          </AppText>
        </View>

        {profile && (
          <Card style={{ marginTop: spacing.xl }}>
            <Row label="Objectif" value={GOAL_LABELS[profile.goal] || profile.goal} icon="trophy-outline" />
            <Divider />
            <Row label="Niveau" value={LEVEL_LABELS[profile.level] || profile.level} icon="fitness-outline" />
            <Divider />
            <Row label="Objectif chrono" value={profile.target_time || "—"} icon="timer-outline" />
            <Divider />
            <Row label="Date de course" value={profile.race_date || "—"} icon="calendar-outline" />
          </Card>
        )}

        <AppText variant="label" style={{ marginTop: spacing.xl, marginBottom: spacing.md, marginLeft: 4 }}>
          MON PLAN
        </AppText>
        <PaceButton
          testID="regenerate-plan-button"
          label="Régénérer mon plan"
          variant="secondary"
          icon="refresh"
          loading={regen}
          onPress={regenerate}
        />
        <PaceButton
          testID="edit-goals-button"
          label="Modifier mes objectifs"
          variant="ghost"
          icon="create-outline"
          onPress={() => router.push("/onboarding/goal")}
          style={{ marginTop: spacing.sm }}
        />
        <PaceButton
          testID="my-friends-button"
          label="Mes amis"
          variant="ghost"
          icon="people-outline"
          onPress={() => router.push("/friends")}
          style={{ marginTop: spacing.sm }}
        />
        {msg && msg.includes("plan") && (
          <AppText testID="profile-msg" style={{ textAlign: "center", marginTop: spacing.sm, color: colors.primary }}>
            {msg}
          </AppText>
        )}

        <AppText variant="label" style={{ marginTop: spacing.xl, marginBottom: spacing.md, marginLeft: 4 }}>
          MONTRES CONNECTÉES
        </AppText>
        <Card>
          <View style={styles.settingRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 }}>
              <Ionicons name="watch-outline" size={20} color={colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">Apple Watch (Apple Santé)</AppText>
                <AppText variant="caption" style={{ marginTop: 2 }}>
                  {!appleHealthSupported
                    ? "Disponible sur iPhone (après build de l'app)"
                    : isExpoGo
                      ? "Nécessite le build iOS (Publish) — indisponible dans Expo Go"
                      : "Importe tes courses : FC, distance, calories"}
                </AppText>
              </View>
            </View>
            {appleHealthSupported ? (
              <Pressable testID="sync-apple-health" onPress={syncAppleHealth} disabled={syncing} style={styles.syncBtn}>
                {syncing ? (
                  <ActivityIndicator size="small" color="#07240D" />
                ) : (
                  <AppText style={{ fontFamily: fonts.semibold, fontSize: 13, color: "#07240D" }}>Synchroniser</AppText>
                )}
              </Pressable>
            ) : null}
          </View>
          <Divider />
          <View style={[styles.settingRow, { marginTop: spacing.md }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 }}>
              <Ionicons name="watch-outline" size={20} color={colors.textMuted} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong" style={{ color: colors.textSecondary }}>Garmin Connect</AppText>
                <AppText variant="caption" style={{ marginTop: 2 }}>
                  Bientôt — nécessite tes clés API Garmin
                </AppText>
              </View>
            </View>
          </View>
        </Card>
        {watchMsg ? (
          <AppText testID="watch-msg" variant="caption" style={{ marginTop: spacing.sm, marginLeft: 4, color: colors.textSecondary }}>
            {watchMsg}
          </AppText>
        ) : null}
        {watchWorkouts.length > 0 && (
          <Card style={{ marginTop: spacing.md }} testID="watch-workouts-card">
            <AppText variant="label" style={{ marginBottom: spacing.sm }}>
              DERNIERS IMPORTS MONTRE
            </AppText>
            {watchWorkouts.slice(0, 5).map((w) => (
              <View key={`${w.source}-${w.external_id}`} style={styles.watchRow}>
                <Ionicons name="heart" size={16} color={colors.pink} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong" style={{ fontSize: 14 }}>
                    {w.distance_m != null ? `${(w.distance_m / 1000).toFixed(1)} km` : "Course"} ·{" "}
                    {Math.round((w.duration_s || 0) / 60)} min
                  </AppText>
                  <AppText variant="caption" style={{ marginTop: 1 }}>
                    {new Date(w.started_at).toLocaleDateString("fr-FR")}
                    {w.avg_hr_bpm ? ` · FC moy ${w.avg_hr_bpm}` : ""}
                    {w.max_hr_bpm ? ` · max ${w.max_hr_bpm} bpm` : ""}
                    {w.calories_kcal ? ` · ${Math.round(w.calories_kcal)} kcal` : ""}
                  </AppText>
                </View>
              </View>
            ))}
          </Card>
        )}

        <AppText variant="label" style={{ marginTop: spacing.xl, marginBottom: spacing.md, marginLeft: 4 }}>
          PRÉFÉRENCES
        </AppText>
        <Card>
          <View style={styles.settingRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 }}>
              <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">Rappels d&apos;entraînement</AppText>
                <AppText variant="caption" style={{ marginTop: 2 }}>
                  La veille à 19h, avec l&apos;allure et l&apos;objectif
                </AppText>
              </View>
            </View>
            <Switch
              testID="notif-switch"
              value={notif}
              onValueChange={toggleNotif}
              trackColor={{ true: colors.primary, false: colors.track }}
              thumbColor="#fff"
            />
          </View>
          {msg && msg.includes("réglages") ? (
            <Pressable testID="open-settings" onPress={() => Linking.openSettings()} style={{ marginTop: spacing.md }}>
              <AppText variant="bodyStrong" style={{ color: colors.primary }}>
                Ouvrir les réglages
              </AppText>
            </Pressable>
          ) : null}
        </Card>
        {msg && !msg.includes("plan") ? (
          <AppText testID="notif-msg" variant="caption" style={{ marginTop: spacing.sm, marginLeft: 4, color: colors.textSecondary }}>
            {msg}
          </AppText>
        ) : null}

        <Pressable testID="logout-button" onPress={doLogout} style={styles.logout}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <AppText variant="bodyStrong" style={{ color: colors.danger }}>
            Se déconnecter
          </AppText>
        </Pressable>
      </ScrollView>

      {regen && (
        <View style={styles.overlay}>
          <ActivityIndicator color={colors.primary} size="large" />
          <AppText variant="body" style={{ marginTop: spacing.lg }}>
            Ton coach recalcule ton plan…
          </AppText>
        </View>
      )}
    </View>
  );
}

function Row({ label, value, icon }: any) {
  return (
    <View style={styles.infoRow}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Ionicons name={icon} size={18} color={colors.textMuted} />
        <AppText variant="body">{label}</AppText>
      </View>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
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
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.md },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  syncBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    minWidth: 108,
    alignItems: "center",
  },
  watchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.xxl,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(239,91,123,0.4)",
    backgroundColor: "rgba(239,91,123,0.08)",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,10,12,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
});
