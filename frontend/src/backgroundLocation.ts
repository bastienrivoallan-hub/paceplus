import { Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

export const RUN_TASK = "pace-run-tracking";

type Point = { latitude: number; longitude: number; timestamp: number };
type Listener = (pts: Point[]) => void;

let listener: Listener | null = null;

if (Platform.OS !== "web") {
  TaskManager.defineTask(RUN_TASK, ({ data, error }: any) => {
    if (error || !data) return;
    const pts: Point[] = (data.locations || []).map((l: any) => ({
      latitude: l.coords.latitude,
      longitude: l.coords.longitude,
      timestamp: l.timestamp,
    }));
    if (pts.length && listener) listener(pts);
  });
}

export function setRunPointListener(cb: Listener | null) {
  listener = cb;
}

export async function getBackgroundPermission() {
  if (Platform.OS === "web") return { granted: false, canAskAgain: false };
  try {
    const p = await Location.getBackgroundPermissionsAsync();
    return { granted: p.granted, canAskAgain: p.canAskAgain };
  } catch {
    return { granted: false, canAskAgain: false };
  }
}

export async function requestBackgroundPermission() {
  if (Platform.OS === "web") return { granted: false, canAskAgain: false };
  try {
    const p = await Location.requestBackgroundPermissionsAsync();
    return { granted: p.granted, canAskAgain: p.canAskAgain };
  } catch {
    return { granted: false, canAskAgain: false };
  }
}

/** Start continuous GPS updates that keep running when the screen is locked. */
export async function startBackgroundRunTracking(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const perm = await Location.getBackgroundPermissionsAsync();
    if (!perm.granted) return false;
    await Location.startLocationUpdatesAsync(RUN_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 2000,
      distanceInterval: 5,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Fitness,
      foregroundService: {
        notificationTitle: "PACE — course en cours",
        notificationBody: "Suivi GPS actif, même écran verrouillé.",
        notificationColor: "#5FD86E",
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function stopBackgroundRunTracking() {
  listener = null;
  if (Platform.OS === "web") return;
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(RUN_TASK);
    if (started) await Location.stopLocationUpdatesAsync(RUN_TASK);
  } catch {
    /* ignore */
  }
}
