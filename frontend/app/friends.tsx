import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api";
import { AppText, Card } from "@/src/components/ui";
import { colors, fonts, radius, spacing } from "@/src/theme";

export function Avatar({ name, size = 40 }: { name?: string | null; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <AppText style={{ fontFamily: fonts.displayBold, fontSize: size * 0.42, color: "#07240D" }}>
        {(name || "?").slice(0, 1).toUpperCase()}
      </AppText>
    </View>
  );
}

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [data, setData] = useState<any>({ friends: [], pending_received: [], pending_sent: [] });
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.friends());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await api.searchUsers(query.trim());
        setResults(r.results || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, [query]);

  const sendRequest = async (uid: string) => {
    try {
      await api.friendRequest(uid);
      setResults((rs) => rs.map((r) => (r.user_id === uid ? { ...r, status: "pending_sent" } : r)));
      load();
    } catch {
      /* ignore */
    }
  };

  const respond = async (fid: string, accept: boolean) => {
    try {
      await api.friendRespond(fid, accept);
      load();
    } catch {
      /* ignore */
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="friends-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <AppText variant="title">Mes amis</AppText>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            testID="friends-search-input"
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher par nom ou email…"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        </View>

        {results.length > 0 && (
          <Card style={{ marginTop: spacing.md }} testID="friends-search-results">
            {results.map((r) => (
              <View key={r.user_id} style={styles.row}>
                <Avatar name={r.name} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{r.name || r.email}</AppText>
                  <AppText variant="caption">{r.email}</AppText>
                </View>
                {r.status === "none" ? (
                  <Pressable testID={`add-friend-${r.user_id}`} onPress={() => sendRequest(r.user_id)} style={styles.addBtn}>
                    <AppText style={{ fontFamily: fonts.semibold, fontSize: 13, color: "#07240D" }}>Ajouter</AppText>
                  </Pressable>
                ) : (
                  <AppText variant="caption" style={{ color: r.status === "accepted" ? colors.primary : colors.orange }}>
                    {r.status === "accepted" ? "Ami ✓" : r.status === "pending_sent" ? "Envoyée" : "À répondre"}
                  </AppText>
                )}
              </View>
            ))}
          </Card>
        )}

        {data.pending_received.length > 0 && (
          <>
            <AppText variant="label" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
              DEMANDES REÇUES
            </AppText>
            <Card testID="pending-requests">
              {data.pending_received.map((p: any) => (
                <View key={p.friendship_id} style={styles.row}>
                  <Avatar name={p.name} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong">{p.name || p.email}</AppText>
                    <AppText variant="caption">{p.email}</AppText>
                  </View>
                  <Pressable testID={`accept-${p.friendship_id}`} onPress={() => respond(p.friendship_id, true)} style={styles.iconBtn}>
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  </Pressable>
                  <Pressable testID={`refuse-${p.friendship_id}`} onPress={() => respond(p.friendship_id, false)} style={styles.iconBtn}>
                    <Ionicons name="close" size={20} color={colors.danger} />
                  </Pressable>
                </View>
              ))}
            </Card>
          </>
        )}

        <AppText variant="label" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          AMIS ({data.friends.length})
        </AppText>
        {data.friends.length === 0 ? (
          <Card style={{ alignItems: "center", paddingVertical: spacing.xxl }}>
            <Ionicons name="people-outline" size={32} color={colors.textMuted} />
            <AppText variant="caption" style={{ marginTop: spacing.md, textAlign: "center" }}>
              Recherche tes amis par nom ou email pour courir ensemble.
            </AppText>
          </Card>
        ) : (
          <Card testID="friends-list">
            {data.friends.map((f: any) => (
              <View key={f.user_id} style={styles.row}>
                <Avatar name={f.name} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{f.name || f.email}</AppText>
                  <AppText variant="caption">{f.email}</AppText>
                </View>
                <Ionicons name="people" size={18} color={colors.primary} />
              </View>
            ))}
          </Card>
        )}

        {data.pending_sent.length > 0 && (
          <>
            <AppText variant="label" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
              DEMANDES ENVOYÉES
            </AppText>
            <Card>
              {data.pending_sent.map((p: any) => (
                <View key={p.friendship_id} style={styles.row}>
                  <Avatar name={p.name} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong">{p.name || p.email}</AppText>
                  </View>
                  <AppText variant="caption" style={{ color: colors.orange }}>En attente</AppText>
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
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
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  input: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, minHeight: 52 },
  avatar: { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
