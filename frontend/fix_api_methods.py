with open("src/api.ts", "r") as f:
    content = f.read()

old = "  circuits(lat: number, lon: number, distance: number) {"
new = """  stats() {
    return this.request('/stats');
  },

  runs() {
    return this.request('/runs');
  },

  weeklyDebrief() {
    return this.request('/coach/weekly-debrief');
  },

  leaderboard(period: "week" | "month") {
    return this.request(`/friends/leaderboard?period=${period}`);
  },

  circuits(lat: number, lon: number, distance: number) {"""

if old not in content:
    print("ATTENTION: point d'ancrage non trouvé.")
else:
    content = content.replace(old, new, 1)
    with open("src/api.ts", "w") as f:
        f.write(content)
    print("Terminé !")
