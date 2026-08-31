import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useAuth } from "@/src/context/AuthContext";
import { AppText, Logo, PaceButton } from "@/src/components/ui";
import { colors, fonts, radius, spacing } from "@/src/theme";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login, register, loginWithGoogle } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password.trim() || (mode === "register" && !name.trim())) {
      setError("Merci de remplir tous les champs.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(email.trim(), password, name.trim());
      router.replace("/");
    } catch (e: any) {
      setError(e.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      router.replace("/");
    } catch (e: any) {
      setError(e.message || "Connexion Google impossible.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient
        colors={["rgba(95,216,110,0.16)", "transparent"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 360 }}
      />
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={{
          paddingTop: insets.top + 60,
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + 40,
        }}
      >
        <View style={{ alignItems: "center", marginBottom: spacing.xxxl }}>
          <Logo size={30} subtitle="TON COACH RUNNING" />
        </View>

        <AppText variant="h2" style={{ marginBottom: 4 }}>
          {mode === "login" ? "Bon retour 👟" : "Crée ton compte"}
        </AppText>
        <AppText variant="body" style={{ marginBottom: spacing.xl }}>
          {mode === "login"
            ? "Reprends ton entraînement là où tu l'as laissé."
            : "Ton plan personnalisé t'attend."}
        </AppText>

        {/* Segmented toggle */}
        <View style={styles.segment}>
          {(["login", "register"] as const).map((m) => (
            <Pressable
              key={m}
              testID={`auth-tab-${m}`}
              onPress={() => setMode(m)}
              style={[styles.segmentItem, mode === m && styles.segmentActive]}
            >
              <AppText
                variant="bodyStrong"
                style={{ color: mode === m ? "#07240D" : colors.textSecondary }}
              >
                {m === "login" ? "Connexion" : "Inscription"}
              </AppText>
            </Pressable>
          ))}
        </View>

        {mode === "register" && (
          <Field
            icon="person-outline"
            placeholder="Prénom"
            value={name}
            onChangeText={setName}
            testID="auth-name-input"
          />
        )}
        <Field
          icon="mail-outline"
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          testID="auth-email-input"
        />
        <Field
          icon="lock-closed-outline"
          placeholder="Mot de passe"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPw}
          autoCapitalize="none"
          testID="auth-password-input"
          right={
            <Pressable onPress={() => setShowPw((s) => !s)} hitSlop={10}>
              <Ionicons
                name={showPw ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          }
        />

        {error && (
          <AppText testID="auth-error" style={{ color: colors.danger, marginBottom: spacing.md }}>
            {error}
          </AppText>
        )}

        <PaceButton
          testID="auth-submit-button"
          label={mode === "login" ? "Se connecter" : "Créer mon compte"}
          onPress={submit}
          loading={loading}
          style={{ marginTop: spacing.sm }}
        />

        <View style={styles.divider}>
          <View style={styles.line} />
          <AppText variant="caption" style={{ marginHorizontal: spacing.md }}>
            ou
          </AppText>
          <View style={styles.line} />
        </View>

        <PaceButton
          testID="auth-google-button"
          label="Continuer avec Google"
          variant="secondary"
          icon="logo-google"
          onPress={google}
          loading={googleLoading}
        />
      </KeyboardAwareScrollView>
    </View>
  );
}

function Field({
  icon,
  right,
  testID,
  ...props
}: any) {
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={20} color={colors.textMuted} />
      <TextInput
        {...props}
        testID={testID}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  segmentItem: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: { backgroundColor: colors.primary },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 56,
    marginBottom: spacing.md,
  },
  input: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 15, height: "100%" },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: spacing.xl },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
});
