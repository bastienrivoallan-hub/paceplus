import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { apiClient } from "../api/client";

export function PlanScreen() {
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlan();
  }, []);

  const loadPlan = async () => {
    try {
      setLoading(true);
      const activePlan = await apiClient.getActivePlan();
      setPlan(activePlan);
    } catch (err) {
      console.error("Error loading plan:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePlan = async () => {
    try {
      setLoading(true);
      const newPlan = await apiClient.generatePlan();
      setPlan(newPlan);
    } catch (err) {
      console.error("Error generating plan:", err);
    } finally {
      setLoading(false);
    }
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
      <Text style={styles.title}>Mon Plan d'Entraînement</Text>

      {plan ? (
        <View style={styles.card}>
          <Text style={styles.planTitle}>{plan.goal || "Plan personnalisé"}</Text>
          <Text style={styles.detail}>Semaines: {plan.weeks || "?"}</Text>
          <Text style={styles.detail}>Sessions/semaine: {plan.sessions_per_week || "?"}</Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.noData}>Pas de plan actif</Text>
        </View>
      )}

      <TouchableOpacity style={styles.button} onPress={handleGeneratePlan}>
        <Text style={styles.buttonText}>Générer un nouveau plan</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5", padding: 15 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  card: { backgroundColor: "#fff", padding: 15, borderRadius: 8, marginBottom: 15 },
  planTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  detail: { fontSize: 14, color: "#333", marginVertical: 5 },
  noData: { color: "#999", textAlign: "center" },
  button: { backgroundColor: "#007AFF", padding: 15, borderRadius: 8, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
