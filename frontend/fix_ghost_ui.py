with open("app/run/summary/[id].tsx", "r") as f:
    content = f.read()

# 1. state + effect
old1 = '  const [analyzing, setAnalyzing] = useState(false);'
new1 = '''  const [analyzing, setAnalyzing] = useState(false);
  const [ghost, setGhost] = useState<any>(null);'''
if old1 not in content:
    print("ATTENTION: ancrage 1 non trouve.")
else:
    content = content.replace(old1, new1, 1)

old2 = '''  useEffect(() => {
    (async () => {
      try {
        setRun(await api.run(String(id)));
      } catch {
        /* ignore */
      }
    })();
  }, [id]);'''
new2 = '''  useEffect(() => {
    (async () => {
      try {
        setRun(await api.run(String(id)));
      } catch {
        /* ignore */
      }
      try {
        const g = await api.runGhost(String(id));
        if (g?.found) setGhost(g);
      } catch {
        /* ignore */
      }
    })();
  }, [id]);'''
if old2 not in content:
    print("ATTENTION: ancrage 2 non trouve.")
else:
    content = content.replace(old2, new2, 1)

# 2. display block, inserted right after the distance/temps/allure Card
old3 = '''        <AppText variant="label" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          PARCOURS
        </AppText>'''
new3 = '''        {ghost && !isFriendView ? (
          <Card style={{ marginTop: spacing.xl, borderColor: ghost.faster ? colors.primary : colors.danger }} testID="ghost-card">
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
              <Ionicons name="body-outline" size={16} color={ghost.faster ? colors.primary : colors.danger} />
              <AppText variant="label" style={{ color: ghost.faster ? colors.primary : colors.danger }}>
                MODE FANTOME
              </AppText>
            </View>
            <AppText variant="bodyStrong">
              {ghost.faster ? "Plus rapide" : "Plus lent"} de {fmtDuration(Math.abs(ghost.delta_seconds))} par rapport a ta derniere fois
            </AppText>
            <AppText variant="caption" style={{ marginTop: 4 }}>
              Le {new Date(ghost.previous_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} : {fmtDuration(ghost.previous_duration_s)} ({ghost.previous_avg_pace || "--:--"}/km)
            </AppText>
          </Card>
        ) : null}

        <AppText variant="label" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          PARCOURS
        </AppText>'''
if old3 not in content:
    print("ATTENTION: ancrage 3 non trouve.")
else:
    content = content.replace(old3, new3, 1)

with open("app/run/summary/[id].tsx", "w") as f:
    f.write(content)
print("Termine !")
