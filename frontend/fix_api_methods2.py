with open("src/api.ts", "r") as f:
    content = f.read()

old = "  circuits(lat: number, lon: number, distance: number) {"
new = """  activePlan() {
    return this.request('/plan/active');
  },

  week(w: number) {
    return this.request(`/plan/week/${w}`);
  },

  adaptPlan(week: number) {
    return this.request('/plan/adapt', {
      method: 'POST',
      body: JSON.stringify({ week }),
    });
  },

  completeSession(sessionId: string) {
    return this.request(`/sessions/${sessionId}/complete`, {
      method: 'POST',
    });
  },

  uncompleteSession(sessionId: string) {
    return this.request(`/sessions/${sessionId}/uncomplete`, {
      method: 'POST',
    });
  },

  circuits(lat: number, lon: number, distance: number) {"""

if old not in content:
    print("ATTENTION: point d'ancrage non trouvé.")
else:
    content = content.replace(old, new, 1)
    with open("src/api.ts", "w") as f:
        f.write(content)
    print("Terminé !")
