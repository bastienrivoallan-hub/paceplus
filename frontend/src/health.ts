import { Platform } from "react-native";
import Constants from "expo-constants";

// ----------------------------------------------------------------------------
// Unified watch-workout model (Apple Watch today, Garmin later) + HealthKit
// reader. iOS ONLY — requires a real development/production build (not Expo Go
// or web). All entry points are platform-guarded so web/Android never touch
// the native module.
// ----------------------------------------------------------------------------

export type WatchWorkout = {
  external_id: string;
  source: "apple_health" | "garmin";
  started_at: string;
  ended_at: string | null;
  duration_s: number;
  distance_m: number | null;
  calories_kcal: number | null;
  avg_hr_bpm: number | null;
  max_hr_bpm: number | null;
};

export const appleHealthSupported = Platform.OS === "ios";

/** True when running inside the Expo Go sandbox (native HealthKit module unavailable). */
export const isExpoGo =
  Constants.appOwnership === "expo" || Constants.executionEnvironment === "storeClient";

export type HealthConnectResult = {
  supported: boolean;
  authorized: boolean;
  reason: "ok" | "expo_go" | "not_ios" | "module_missing" | "unavailable" | "denied_or_error";
};

async function hk(): Promise<any | null> {
  if (Platform.OS !== "ios") return null;
  try {
    return await import("@kingstinct/react-native-healthkit");
  } catch {
    return null; // Expo Go / module not in this build
  }
}

const READ_TYPES = [
  "HKWorkoutTypeIdentifier",
  "HKQuantityTypeIdentifierDistanceWalkingRunning",
  "HKQuantityTypeIdentifierHeartRate",
  "HKQuantityTypeIdentifierActiveEnergyBurned",
];

export async function connectAppleHealth(): Promise<HealthConnectResult> {
  if (Platform.OS !== "ios") return { supported: false, authorized: false, reason: "not_ios" };
  if (isExpoGo) return { supported: false, authorized: false, reason: "expo_go" };
  const mod = await hk();
  if (!mod || typeof mod.isHealthDataAvailable !== "function") {
    return { supported: false, authorized: false, reason: "module_missing" };
  }
  try {
    const available = await mod.isHealthDataAvailable();
    if (!available) return { supported: false, authorized: false, reason: "unavailable" };
    await mod.requestAuthorization({ toRead: READ_TYPES });
    return { supported: true, authorized: true, reason: "ok" };
  } catch {
    return { supported: true, authorized: false, reason: "denied_or_error" };
  }
}

function num(v: any): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (v && typeof v === "object") {
    const x = v.value ?? v.quantity;
    if (typeof x === "number" && isFinite(x)) return x;
  }
  return null;
}

/** Read running workouts recorded by Apple Watch / iPhone over the last N days. */
export async function fetchAppleWatchRuns(days = 30, limit = 20): Promise<WatchWorkout[]> {
  const mod = await hk();
  if (!mod || typeof mod.queryWorkoutSamples !== "function") return [];
  try {
    const endDate = new Date();
    const startDate = new Date(Date.now() - days * 24 * 3600 * 1000);
    const runningType = mod.WorkoutActivityType?.running ?? 37; // HKWorkoutActivityTypeRunning
    const workouts: any[] = await mod.queryWorkoutSamples({
      limit,
      ascending: false,
      filter: { workoutActivityType: runningType, date: { startDate, endDate } },
    });

    const out: WatchWorkout[] = [];
    for (const w of workouts || []) {
      let avg: number | null = null;
      let max: number | null = null;
      // Preferred: HealthKit-computed statistics
      try {
        const stat = await w.getStatistic?.("HKQuantityTypeIdentifierHeartRate", "count/min");
        avg = num(stat?.averageQuantity) ?? num(stat?.average);
        max = num(stat?.maximumQuantity) ?? num(stat?.maximum);
      } catch {
        /* fall back to raw samples */
      }
      if (avg == null) {
        try {
          const samples: any[] = await mod.queryQuantitySamples("HKQuantityTypeIdentifierHeartRate", {
            limit: 500,
            ascending: true,
            unit: "count/min",
            filter: { workout: w },
          });
          const vals = (samples || []).map((s) => num(s.quantity)).filter((v): v is number => v != null);
          if (vals.length) {
            avg = vals.reduce((a, b) => a + b, 0) / vals.length;
            max = Math.max(...vals);
          }
        } catch {
          /* ignore */
        }
      }
      out.push({
        external_id: String(w.uuid),
        source: "apple_health",
        started_at: new Date(w.startDate).toISOString(),
        ended_at: w.endDate ? new Date(w.endDate).toISOString() : null,
        duration_s: Math.round(Number(w.duration ?? 0)),
        distance_m: num(w.totalDistance),
        calories_kcal: num(w.totalEnergyBurned),
        avg_hr_bpm: avg != null ? Math.round(avg) : null,
        max_hr_bpm: max != null ? Math.round(max) : null,
      });
    }
    return out;
  } catch {
    return [];
  }
}
