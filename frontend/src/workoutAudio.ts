import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from "expo-audio";

import { colors } from "@/src/theme";

// ----------------------------------------------------------------------------
// WorkoutAudioEngine — "Zombie Run" immersive audio for interval (HIIT) runs.
// Sounds play ON TOP of the user's music (Spotify/Deezer/any app): the audio
// session uses `duckOthers`, so the music volume automatically dips while a
// narrative alert or zombie SFX plays, then comes back up (audio ducking).
// ----------------------------------------------------------------------------

export type ZombiePhaseKind = "warmup" | "sprint" | "recovery" | "cooldown" | "done";
export type ZombiePhase = { kind: ZombiePhaseKind; duration_s: number };
export type ZombieInfo = {
  kind: ZombiePhaseKind;
  title: string;
  subtitle: string;
  color: string;
  remaining_s: number;
};

export const PHASE_META: Record<ZombiePhaseKind, { title: string; subtitle: string; color: string }> = {
  warmup: { title: "Échauffement", subtitle: "Zone calme… pour l'instant 🧟", color: colors.blue },
  sprint: { title: "ILS ARRIVENT — SPRINT !", subtitle: "Sème la horde, accélère !", color: colors.danger },
  recovery: { title: "Zone sécurisée", subtitle: "Reprends ton souffle, ils sont loin", color: colors.primary },
  cooldown: { title: "Retour au camp", subtitle: "Mission presque terminée, relâche l'allure", color: colors.blue },
  done: { title: "Mission accomplie 🏆", subtitle: "Tu as survécu à la horde !", color: colors.primary },
};

/** Build an interval plan (warmup → N × [sprint/recovery] → cooldown) for a target duration. */
export function buildZombiePlan(totalMin: number): ZombiePhase[] {
  const total = Math.max(10, Math.round(totalMin)) * 60;
  const warm = total >= 25 * 60 ? 300 : 180;
  const cool = total >= 25 * 60 ? 240 : 120;
  const cycle = 45 + 90; // 45s sprint + 90s recovery
  const n = Math.max(3, Math.floor((total - warm - cool) / cycle));
  const phases: ZombiePhase[] = [{ kind: "warmup", duration_s: warm }];
  for (let i = 0; i < n; i++) {
    phases.push({ kind: "sprint", duration_s: 45 });
    phases.push({ kind: "recovery", duration_s: 90 });
  }
  phases.push({ kind: "cooldown", duration_s: Math.max(60, total - warm - n * cycle) });
  return phases;
}

const SOURCES = {
  sprint_alert: require("../assets/audio/sprint_alert.wav"),
  zombie_growl: require("../assets/audio/zombie_growl.wav"),
  zombie_close: require("../assets/audio/zombie_close.wav"),
  safe_zone: require("../assets/audio/safe_zone.wav"),
  recovery_breath: require("../assets/audio/recovery_breath.wav"),
  run_complete: require("../assets/audio/run_complete.wav"),
};
type SoundName = keyof typeof SOURCES;

class ZombieAudioEngine {
  private players: Partial<Record<SoundName, AudioPlayer>> = {};
  private plan: ZombiePhase[] = [];
  private starts: number[] = [];
  private total = 0;
  private lastIdx = -2;
  private nextAmbientAt = 0;
  private doneSoundPlayed = false;
  private pendingTimeout: ReturnType<typeof setTimeout> | null = null;

  async start(plan: ZombiePhase[]) {
    this.plan = plan;
    this.starts = [];
    let acc = 0;
    for (const p of plan) {
      this.starts.push(acc);
      acc += p.duration_s;
    }
    this.total = acc;
    this.lastIdx = -2;
    this.nextAmbientAt = 0;
    this.doneSoundPlayed = false;
    try {
      // Ducking: other apps' music dips while our SFX play, background audio stays alive.
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: "duckOthers",
        interruptionModeAndroid: "duckOthers",
      });
    } catch {
      /* web may not support every option */
    }
    for (const key of Object.keys(SOURCES) as SoundName[]) {
      try {
        this.players[key] = createAudioPlayer(SOURCES[key]);
      } catch {
        /* ignore */
      }
    }
  }

  private play(name: SoundName, volume = 1) {
    const p = this.players[name];
    if (!p) return;
    try {
      p.volume = volume;
      p.seekTo(0);
      p.play();
    } catch {
      /* ignore */
    }
  }

  phaseAt(elapsed: number): { idx: number; phase: ZombiePhase | null } {
    if (elapsed >= this.total) return { idx: this.plan.length, phase: null };
    for (let i = this.plan.length - 1; i >= 0; i--) {
      if (elapsed >= this.starts[i]) return { idx: i, phase: this.plan[i] };
    }
    return { idx: 0, phase: this.plan[0] || null };
  }

  /** Call every second with the run's elapsed time. Returns what to display. */
  tick(elapsed: number): ZombieInfo {
    const { idx, phase } = this.phaseAt(elapsed);
    const kind: ZombiePhaseKind = phase ? phase.kind : "done";

    if (idx !== this.lastIdx) {
      this.lastIdx = idx;
      this.nextAmbientAt = elapsed + 6;
      if (kind === "sprint") {
        this.play("sprint_alert");
        if (this.pendingTimeout) clearTimeout(this.pendingTimeout);
        this.pendingTimeout = setTimeout(() => this.play("zombie_close"), 1600);
      } else if (kind === "recovery" || kind === "cooldown") {
        this.play("safe_zone");
      } else if (kind === "warmup") {
        this.play("zombie_growl", 0.5);
      } else if (kind === "done" && !this.doneSoundPlayed) {
        this.doneSoundPlayed = true;
        this.play("run_complete");
      }
    } else if (elapsed >= this.nextAmbientAt) {
      // Ambient loop inside the phase
      if (kind === "sprint") {
        this.play(Math.random() > 0.4 ? "zombie_close" : "zombie_growl");
        this.nextAmbientAt = elapsed + 8 + Math.floor(Math.random() * 6);
      } else if (kind === "recovery") {
        this.play("recovery_breath", 0.8);
        this.nextAmbientAt = elapsed + 15 + Math.floor(Math.random() * 6);
      } else if (kind === "warmup") {
        this.play("zombie_growl", 0.4);
        this.nextAmbientAt = elapsed + 25 + Math.floor(Math.random() * 15);
      } else {
        this.nextAmbientAt = elapsed + 30;
      }
    }

    const meta = PHASE_META[kind];
    const remaining = phase ? Math.max(0, this.starts[idx] + phase.duration_s - elapsed) : 0;
    return { kind, title: meta.title, subtitle: meta.subtitle, color: meta.color, remaining_s: Math.round(remaining) };
  }

  stop() {
    if (this.pendingTimeout) clearTimeout(this.pendingTimeout);
    this.pendingTimeout = null;
    for (const key of Object.keys(this.players) as SoundName[]) {
      try {
        this.players[key]?.remove();
      } catch {
        /* ignore */
      }
    }
    this.players = {};
    this.plan = [];
  }
}

export const zombieEngine = new ZombieAudioEngine();
