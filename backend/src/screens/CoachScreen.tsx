import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView } from "react-native";
import { apiClient } from "../api/client";

export function CoachScreen() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      setLoading(true);
      const response = await apiClient.coachChat(input);
      setMessages((prev) => [...prev, { role: "coach", text: response.response }]);
    } catch (err) {
      console.error("Error:", err);
      setMessages((prev) => [...prev, { role: "coach", text: "Erreur de communication" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <ScrollView style={styles.messagesContainer}>
        {messages.length === 0 && (
          <View style={styles.welcome}>
            <Text style={styles.welcomeText}>👋 Bienvenue au Coach IA PACE</Text>
            <Text style={styles.welcomeSubtext}>Pose-moi tes questions sur ton entraînement</Text>
          </View>
        )}
        {messages.map((msg, idx) => (
          <View
            key={idx}
            style={[styles.messageBox, msg.role === "user" ? styles.userMessage : styles.coachMessage]}
          >
            <Text style={styles.messageText}>{msg.text}</Text>
          </View>
        ))}
        {loading && <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Pose une question..."
          value={input}
          onChangeText={setInput}
          editable={!loading}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage} disabled={loading}>
          <Text style={styles.sendText}>▶</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  messagesContainer: { flex: 1, padding: 15 },
  welcome: { justifyContent: "center", alignItems: "center", marginTop: 50 },
  welcomeText: { fontSize: 18, fontWeight: "bold" },
  welcomeSubtext: { color: "#999", marginTop: 10 },
  messageBox: { marginVertical: 8, padding: 12, borderRadius: 8, maxWidth: "85%" },
  userMessage: { alignSelf: "flex-end", backgroundColor: "#007AFF" },
  coachMessage: { alignSelf: "flex-start", backgroundColor: "#e9ecef" },
  messageText: { fontSize: 14, color: "#333" },
  loader: { marginVertical: 20 },
  inputContainer: { flexDirection: "row", padding: 15, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#eee" },
  input: { flex: 1, borderWidth: 1, borderColor: "#ddd", padding: 10, borderRadius: 20, marginRight: 10 },
  sendBtn: { backgroundColor: "#007AFF", width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  sendText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
});
