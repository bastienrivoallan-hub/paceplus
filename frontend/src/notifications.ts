import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import { api } from "@/src/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Rappels d'entraînement",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    });
  }
}

export async function getReminderPermission() {
  const settings = await Notifications.getPermissionsAsync();
  return { granted: settings.granted, canAskAgain: settings.canAskAgain };
}

export async function requestReminderPermission() {
  const settings = await Notifications.requestPermissionsAsync();
  return { granted: settings.granted, canAskAgain: settings.canAskAgain };
}

export async function cancelReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Schedule a reminder the evening before each upcoming (non-rest) session. */
export async function scheduleSessionReminders(): Promise<number> {
  await ensureAndroidChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();

  let sessions: any[] = [];
  try {
    const res = await api.upcomingSessions();
    sessions = res.sessions || [];
  } catch {
    return 0;
  }

  const now = new Date();
  let count = 0;
  for (const s of sessions) {
    const [y, m, d] = String(s.date).split("-").map((n: string) => parseInt(n, 10));
    if (!y || !m || !d) continue;
    // The day before at 19:00 local time
    const trigger = new Date(y, m - 1, d - 1, 19, 0, 0);
    if (trigger.getTime() <= now.getTime()) continue;

    const bits = [s.subtitle && s.subtitle !== "-" ? s.subtitle : null, s.objective && s.objective !== "-" ? `Objectif ${s.objective}` : null]
      .filter(Boolean)
      .join(" • ");

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Demain : ${s.title}`,
        body: bits || "Prépare-toi pour ta séance de demain 🏃",
        ...(Platform.OS === "android" ? { channelId: "reminders" } : {}),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
    });
    count += 1;
    if (count >= 20) break;
  }
  return count;
}

/** Schedule an alert the evening before race day when weather looks difficult. */
export async function scheduleRaceWeatherAlert(raceDate: string, flags: string[]): Promise<boolean> {
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return false;
    await ensureAndroidChannel();
    const [y, m, d] = String(raceDate).split("-").map((n: string) => parseInt(n, 10));
    if (!y || !m || !d) return false;
    // The day before the race at 18:00 local time
    const trigger = new Date(y, m - 1, d - 1, 18, 0, 0);
    if (trigger.getTime() <= Date.now()) return false;
    await Notifications.cancelScheduledNotificationAsync("race-weather-alert").catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: "race-weather-alert",
      content: {
        title: "Météo difficile demain pour ta course ⚠️",
        body: `Prévu : ${flags.join(", ")}. Consulte ta stratégie d'allure ajustée dans PACE.`,
        ...(Platform.OS === "android" ? { channelId: "reminders" } : {}),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
    });
    return true;
  } catch {
    return false;
  }
}
