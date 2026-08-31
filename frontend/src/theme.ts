// PACE design system — dark, minimal, sporty. Extracted from the app mockup.

export const colors = {
  bg: "#0A0A0C",
  bgElevated: "#101014",
  card: "#17171B",
  cardAlt: "#1E1E24",
  cardHi: "#24242B",
  border: "#26262D",
  borderStrong: "#34343C",

  primary: "#5FD86E",
  primaryDark: "#38B34F",
  primarySoft: "rgba(95,216,110,0.14)",
  primaryText: "#7BE38A",

  text: "#FFFFFF",
  textSecondary: "#A2A2AC",
  textMuted: "#6C6C76",

  blue: "#5B8DEF",
  orange: "#E8A13C",
  purple: "#A66BE8",
  pink: "#EF5B7B",
  gray: "#8A8A93",

  track: "#2A2A31",
  danger: "#EF5B7B",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 40 };

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const fonts = {
  regular: "Manrope-Regular",
  medium: "Manrope-Medium",
  semibold: "Manrope-SemiBold",
  bold: "Manrope-Bold",
  extrabold: "Manrope-ExtraBold",
  display: "Fredoka-Regular",
  displayMedium: "Fredoka-Medium",
  displaySemibold: "Fredoka-SemiBold",
  displayBold: "Fredoka-Bold",
};

export type WorkoutType =
  | "rest" | "easy" | "recovery" | "intervals" | "tempo" | "threshold" | "long" | "race";

export const WORKOUT: Record<string, { color: string; label: string; icon: string }> = {
  rest: { color: colors.gray, label: "Repos", icon: "time-outline" },
  easy: { color: colors.blue, label: "Footing facile", icon: "walk" },
  recovery: { color: colors.blue, label: "Récupération", icon: "walk" },
  intervals: { color: colors.primary, label: "Fractionné", icon: "flash" },
  tempo: { color: colors.orange, label: "Tempo", icon: "speedometer" },
  threshold: { color: colors.orange, label: "Seuil", icon: "speedometer" },
  long: { color: colors.purple, label: "Sortie longue", icon: "trending-up" },
  race: { color: colors.pink, label: "Course", icon: "flag" },
};

export function workoutMeta(type?: string) {
  return WORKOUT[type || "rest"] || WORKOUT.rest;
}

export const DAYS_FR = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];

export function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
