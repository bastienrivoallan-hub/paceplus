with open("app/onboarding/chrono.tsx", "r") as f:
    content = f.read()

old = '''        <AppText variant="label" style={{ marginBottom: spacing.md }}>
          TEMPS ACTUEL
        </AppText>
        <Chips
          values={ranges}
          selected={data.current_time}
          onSelect={(v) => update({ current_time: v })}
          prefix="current"
        />

        <AppText variant="label" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          OBJECTIF CIBLE
        </AppText>
        <Chips
          values={ranges}
          selected={data.target_time}
          onSelect={(v) => update({ target_time: v })}
          prefix="target"
        />'''

new = '''        <AppText variant="label" style={{ marginBottom: spacing.md }}>
          TEMPS ACTUEL
        </AppText>
        <View style={styles.dateField}>
          <TextInput
            testID="current-time-input"
            value={data.current_time || ""}
            onChangeText={(v) => update({ current_time: v })}
            placeholder="ex: 1h45"
            placeholderTextColor={colors.textMuted}
            style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 17 }}
          />
        </View>

        <AppText variant="label" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          OBJECTIF CIBLE
        </AppText>
        <View style={styles.dateField}>
          <TextInput
            testID="target-time-input"
            value={data.target_time || ""}
            onChangeText={(v) => update({ target_time: v })}
            placeholder="ex: 1h35"
            placeholderTextColor={colors.textMuted}
            style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 17 }}
          />
        </View>'''

if old not in content:
    print("ATTENTION: bloc non trouvé.")
else:
    content = content.replace(old, new)
    with open("app/onboarding/chrono.tsx", "w") as f:
        f.write(content)
    print("Terminé !")
