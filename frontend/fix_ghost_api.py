with open("src/api.ts", "r") as f:
    content = f.read()

old = "  circuits(lat: number, lon: number, distance: number) {"

new = """  runGhost(runId: string) {
    return this.request(`/runs/${runId}/ghost`);
  },

  circuits(lat: number, lon: number, distance: number) {"""

if old not in content:
    print("ATTENTION: point d'ancrage non trouve.")
else:
    content = content.replace(old, new, 1)
    with open("src/api.ts", "w") as f:
        f.write(content)
    print("Termine !")
