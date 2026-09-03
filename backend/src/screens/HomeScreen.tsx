import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { apiClient } from "../api/client";
import { useAuth } from "../contexts/AuthContext";

export function HomeScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const [todayData, setTodayData] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const today = await apiClient.getTodayHome();
      const statsData = await apiClient.getStats();
      setTodayData(today);
      setStats(statsData);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigation.replace("Login");
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Bienvenue, {user?.name}!</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Aujourd'hui</Text>
        {todayData ? (
          <View>
            <Text style={styles.stat}>Sessions: {todayData.sessions_count || 0}</Text>
            <Text style={styles.stat}>Distance: {todayData.total_distance || 0} km</Text>
          </View>
        ) : (
          <Text>Pas de données</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Statistiques</Text>
        {stats ? (
          <View>
            <Text style={styles.stat}>Total runs: {stats.total_runs || 0}</Text>
            <Text style={styles.stat}>Distance totale: {stats.total_distance || 0} km</Text>
            <Text style={styles.stat}>Durée moyenne: {stats.avg_duration || 0} min</Text>
          </View>
        ) : (
          <Text>Pas de données</Text>
        )}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("Plan")}>
          <Text style={styles.actionText}>📅 Mon Plan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("Coach")}>
          <Text style={styles.actionText}>🤖 Coach IA</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { backgroundColor: "#007AFF", padding: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greeting: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  logoutBtn: { backgroundColor: "rgba(255,255,255,0.3)", paddingHorizontal: 15, paddingVertical: 8, borderRadius: 6 },
  logoutText: { color: "#fff", fontWeight: "bold" },
  card: { backgroundColor: "#fff", margin: 15, padding: 15, borderRadius: 8 },
  cardTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  stat: { fontSize: 14, color: "#333", marginVertical: 5 },
  buttonRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 20, paddingBottom: 30 },
  actionBtn: { backgroundColor: "#007AFF", paddingHorizontal: 30, paddingVertical: 12, borderRadius: 8 },
  actionText: { color: "#fff", fontWeight: "bold" },
});
