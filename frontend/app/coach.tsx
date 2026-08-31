import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import { AppText, Logo } from "@/src/components/ui";
import { colors, fonts, radius, spacing } from "@/src/theme";

const SUGGESTIONS = [
  "Comment gérer mon allure en fractionné ?",
  "Que manger avant une sortie longue ?",
  "J'ai mal aux mollets, que faire ?",
  "Comment progresser plus vite ?",
];

type Msg = { role: "user" | "assistant"; content: string };

export default function CoachScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.coachHistory();
        setMessages(res.messages || []);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const scrollToEnd = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content }]);
    setSending(true);
    scrollToEnd();
    try {
      const res = await api.coachChat(content);
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: "Désolé, je n'ai pas pu répondre. Réessaie." }]);
    } finally {
      setSending(false);
      scrollToEnd();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="coach-back" onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Logo size={18} subtitle="COACH IA" />
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="translate-with-padding"
        keyboardVerticalOffset={insets.top + 56}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xl }}
          onContentSizeChange={scrollToEnd}
        >
          {messages.length === 0 && (
            <View style={{ alignItems: "center", marginTop: spacing.xxl }}>
              <View style={styles.avatar}>
                <Ionicons name="sparkles" size={28} color={colors.primary} />
              </View>
              <AppText variant="h3" style={{ marginTop: spacing.lg, textAlign: "center" }}>
                Ton coach personnel
              </AppText>
              <AppText variant="body" style={{ marginTop: spacing.sm, textAlign: "center" }}>
                Pose-moi une question sur ton entraînement, ta récup ou ta nutrition.
              </AppText>
              <View style={{ marginTop: spacing.xl, gap: spacing.sm, alignSelf: "stretch" }}>
                {SUGGESTIONS.map((s) => (
                  <Pressable key={s} testID={`suggestion-${s.slice(0, 8)}`} onPress={() => send(s)} style={styles.suggestion}>
                    <AppText variant="bodyStrong" style={{ fontSize: 14 }}>{s}</AppText>
                    <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {messages.map((m, i) => (
            <View
              key={i}
              style={[
                styles.bubble,
                m.role === "user"
                  ? { alignSelf: "flex-end", backgroundColor: colors.primary }
                  : { alignSelf: "flex-start", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
              ]}
            >
              <AppText
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 15,
                  lineHeight: 21,
                  color: m.role === "user" ? "#07240D" : colors.text,
                }}
              >
                {m.content}
              </AppText>
            </View>
          ))}

          {sending && (
            <View style={[styles.bubble, { alignSelf: "flex-start", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}
        </ScrollView>

        <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.sm }]}>
          <TextInput
            testID="coach-input"
            value={input}
            onChangeText={setInput}
            placeholder="Écris ton message…"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            onSubmitEditing={() => send()}
          />
          <Pressable
            testID="coach-send"
            onPress={() => send()}
            disabled={!input.trim() || sending}
            style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.4 }]}
          >
            <Ionicons name="arrow-up" size={22} color="#07240D" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  bubble: { maxWidth: "82%", borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 46,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 12,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 15,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
