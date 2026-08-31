import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";

import { colors, fonts, radius, spacing, workoutMeta } from "@/src/theme";

/* ---------------- Logo ---------------- */
export function Logo({ size = 22, subtitle }: { size?: number; subtitle?: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text
        style={{
          fontFamily: fonts.displayBold,
          fontSize: size,
          color: colors.text,
          letterSpacing: size * 0.32,
          paddingLeft: size * 0.32,
        }}
      >
        PACE
      </Text>
      {subtitle ? (
        <Text
          style={{
            fontFamily: fonts.bold,
            fontSize: 10,
            color: colors.primary,
            letterSpacing: 2,
            marginTop: 2,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/* ---------------- Button ---------------- */
export function PaceButton({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  style,
  testID,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const isPrimary = variant === "primary";
  const isSecondary = variant === "secondary";
  const bg = isPrimary ? colors.primary : isSecondary ? colors.cardAlt : "transparent";
  const fg = isPrimary ? "#07240D" : colors.text;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        isSecondary && { borderWidth: 1, borderColor: colors.borderStrong },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {icon ? <Ionicons name={icon as any} size={18} color={fg} /> : null}
          <Text style={[styles.btnLabel, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

/* ---------------- Card ---------------- */
export function Card({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}

/* ---------------- Text ---------------- */
export function AppText(props: TextProps & { variant?: keyof typeof textVariants }) {
  const { variant = "body", style, ...rest } = props;
  return <Text {...rest} style={[textVariants[variant], style]} />;
}

const textVariants = StyleSheet.create({
  h1: { fontFamily: fonts.displayBold, fontSize: 34, color: colors.text },
  h2: { fontFamily: fonts.displayBold, fontSize: 26, color: colors.text },
  h3: { fontFamily: fonts.displaySemibold, fontSize: 20, color: colors.text },
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  label: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 1.2,
  },
  caption: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
});

/* ---------------- Progress ring ---------------- */
export function ProgressRing({
  size = 130,
  stroke = 10,
  progress,
  color = colors.primary,
  children,
}: {
  size?: number;
  stroke?: number;
  progress: number; // 0..1
  color?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - clamped)}
        />
      </Svg>
      {children}
    </View>
  );
}

/* ---------------- Workout badge ---------------- */
export function WorkoutBadge({ type, size = 48 }: { type?: string; size?: number }) {
  const meta = workoutMeta(type);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: type === "rest" ? colors.cardHi : `${meta.color}22`,
        borderWidth: 1,
        borderColor: type === "rest" ? colors.border : `${meta.color}55`,
      }}
    >
      <Ionicons name={meta.icon as any} size={size * 0.46} color={meta.color} />
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  btnLabel: { fontFamily: fonts.displaySemibold, fontSize: 17 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
});
