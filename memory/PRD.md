# PACE — Running Coach App (PRD)

## Original problem statement
Build a mobile Running Coach app from a Figma mockup ("PACE"). Dark/minimal design, green accent, bold display type. Features: GPS run tracking, AI-generated training plans, AI coach, run history & stats, goals & progression. AI = Claude Sonnet 5. Auth = Google (Emergent) + email/password.

## Architecture
- **Frontend**: Expo (SDK 54) + expo-router file-based routing. Custom fonts (Fredoka display + Manrope body) via expo-font. react-native-svg (readiness ring/charts), expo-location (GPS), react-native-keyboard-controller (inputs/chat), expo-linear-gradient.
- **Backend**: FastAPI + MongoDB (motor). All routes under `/api`. Session-token auth (7-day) stored in `user_sessions`, unifies email/password (bcrypt) and Emergent Google OAuth. AI via emergentintegrations LlmChat → `claude-sonnet-5` with EMERGENT_LLM_KEY.
- **Collections**: users, user_sessions, plans, sessions, runs, coach_messages.

## User personas
- Amateur/experienced runner training for a goal race (5k → marathon) who wants a structured, adaptive plan and daily guidance.

## Core requirements (static)
- Onboarding: goal → level → chrono/target/race-date → weekly frequency → AI plan generation.
- Home: daily readiness "form" score + metrics, streak, session of the day.
- Calendar: week-by-week plan with per-day session cards + completion tracking.
- Progression: cumulative stats, weekly volume, run history.
- Explorer: recommended routes with type filters.
- Profil: profile/plan info, regenerate plan, logout.
- GPS run tracker + AI coach chat.

## Implemented (2026-08-31)
- ✅ Auth: email/password register+login, Emergent Google OAuth, /auth/me, logout. AuthContext + secure token storage.
- ✅ Onboarding 4-step flow with shared context; saves profile and generates plan.
- ✅ AI plan generation (Claude Sonnet 5) → weeks × 7 days of typed sessions stored in DB.
- ✅ Home (Accueil) with readiness ring, metrics grid, streak, session-of-day + coach CTA.
- ✅ Calendrier: day dots by type, session cards, completion toggle, week navigation.
- ✅ Progression: stat boxes, weekly-volume bars, run list.
- ✅ Explorer: horizontal filter chips + route cards.
- ✅ Profil: plan summary, regenerate, edit goals, notifications toggle, logout.
- ✅ Session detail (structure chart + coach tip + start/complete).
- ✅ GPS run tracker (permission contract, live distance/pace/time, save run).
- ✅ AI Coach chat (Claude Sonnet 5) with history + suggestions.
- ✅ Tested: 19/19 backend pytest passed; frontend E2E verified.

## Implemented (2026-08-31 — iteration 3)
- ✅ Météo temps réel (Open-Meteo, sans clé): endpoint `GET /api/weather` (conditions + prochaines heures + conseil FR); widget météo sur l'Accueil; intégrée aux conseils nutrition.
- ✅ Analyse de course IA (`POST /api/coach/run-analysis`, cache) affichée sur le bilan de course.
- ✅ Débrief hebdomadaire IA (`GET /api/coach/weekly-debrief`, cache) sur Progression.
- ✅ Conseils nutrition & hydratation IA (`GET /api/coach/nutrition`, avant/pendant/après, adaptés météo) sur le détail de séance.
- ✅ Carte de suivi en direct pendant la course (react-native-maps natif + fallback SVG web) sur l'écran run + tracé sur le bilan.
- ✅ Bouton SOS sur l'écran de course → ouvre le numéro d'urgence 112 + affiche les coordonnées GPS.
- ✅ Robustesse: le client API relit le token stocké (deep-link/hard reload).
- ✅ Testé: iteration 3 backend 10/10 pytest + flux frontend validés.

## Backlog / remaining
- P1: Real map tiles on run tracker (react-native-maps, needs device build) — route trace on summary already done via SVG.
- P1: Wearable/health data integration for real readiness metrics (currently deterministic pseudo-data).
- P2: Streaming coach responses (SSE) instead of request/response.
- P2: Migrate FastAPI startup/shutdown handlers to lifespan.
- P2: Auto-trigger week adaptation when a new week starts (currently on-demand button + endpoint ready).

## Implemented (2026-08-31 — iteration 2)
- ✅ Résumé de course: post-run summary screen `/run/summary/[id]` with per-km splits (bars + pace) and SVG GPS route trace; run tracker now records splits; run history items open the summary. Backend: `splits` on runs, `GET /api/runs/{id}`.
- ✅ Adaptation auto (IA): `POST /api/plan/adapt` (Claude Sonnet 5) rebuilds a week from completed/missed adherence; Calendar "Adapter avec l'IA" button + coach note card.
- ✅ Rappels de séance: day-before (19h) local notifications via expo-notifications with pace + objective; Profil toggle with permission handling + reschedule on plan change. Backend: `GET /api/plan/upcoming`.
- ✅ Tested: iteration 2 backend 6/6 pytest + frontend flows verified.

## Notes
- GPS tracking requires a real device build to fully validate (limited in Expo Go / web preview).
- 5-tab navigation is intentional per the provided mockup.

## Iteration 4 — Circuits météo IA + Alerte météo course (livré)
- **Circuit météo IA (Explorer)** : GET /api/coach/route-weather — Claude choisit le parcours du catalogue le plus adapté (abrité/ombragé/plat) selon météo live + direction du vent + séance du jour. Carte "Circuit conseillé par le coach" en haut d'Explorer, badge ★ Conseillé sur le parcours, conseil vent. Cache 1h par position (db.route_tips). Gestion permissions localisation (demande contextuelle + bouton réglages).
- **Alerte météo course (Accueil)** : ville de course saisie par l'utilisateur (GET /api/geo/search géocodage Open-Meteo + PUT /api/profile/race-location). GET /api/race/weather : prévision du jour J (Open-Meteo daily, J-15 max), détection conditions difficiles (chaleur ≥27°C ressenti, vent ≥30 km/h, pluie ≥60%, orage, froid ≤0°C) → stratégie d'allure ajustée par Claude (cache quotidien db.race_alerts). Carte Accueil : saisie ville / J-X favorable / alerte orange avec drapeaux + stratégie dépliable. Notification la veille 18h si conditions difficiles (scheduleRaceWeatherAlert, device uniquement).
- Composant : /app/frontend/src/components/RaceWeatherCard.tsx. Tests : 16/16 pytest (iteration_4.json), flows frontend validés.
- Note démo : compte thomas@pace.app a race_date à J+2 (Annecy) pour visualiser l'alerte.

## Iteration 5 — Suivi GPS arrière-plan + Circuits 3D (livré)
- **Suivi en veille** : expo-task-manager + expo-location background updates (tâche "pace-run-tracking", service premier plan Android avec notification). Modal contextuelle unique avant la 1ère course pour demander la permission arrière-plan ("Activer le suivi en veille" / "Continuer sans"). Chrono basé horloge murale (exact même écran verrouillé). app.json : UIBackgroundModes location + NSLocationAlwaysAndWhenInUse (iOS), ACCESS_BACKGROUND_LOCATION + FOREGROUND_SERVICE (Android). ⚠️ Testable uniquement sur vrai téléphone après build (pas Expo Go/web).
- **Circuits 3D (/routes-map)** : accès depuis Explorer ("Circuits sur carte 3D"). Génère 3 boucles organiques (Nord/Sud-Est/Ouest) démarrant à la position GPS, distance au choix (3/5/8/10/15 km) + shuffle, distance exacte par mise à l'échelle haversine (src/circuits.ts). Carte native react-native-maps caméra inclinée 55° + showsBuildings (effet 3D sur mobile) ; fallback SVG sur web. Sélection de circuit + bouton "Courir ce circuit" → course active.
- **Sécurité (audit)** : messages d'erreur 502 génériques (plus de str(e) exposé), correctif SEC-001. Hardening restant noté : rate limiting login, CORS allowlist, quotas IA (P3, non bloquants).
- Tests : iteration_5.json — tous les flows frontend validés ; bug web expo-location remove() corrigé (try/catch).

## Iteration 6a — Mode Zombie Run (livré)
- Moteur audio gamifié /app/frontend/src/workoutAudio.ts (expo-audio) : plan fractionné auto (échauffement → N×[sprint 45s/récup 90s] → retour au calme) selon la durée de la séance ; 6 SFX procéduraux libres de droits générés (assets/audio/*.wav via scripts/gen_zombie_sounds.py) : alerte radio sprint, grognements zombies (loin/proche), zone sécurisée, respiration récup, victoire.
- Audio ducking : setAudioModeAsync duckOthers → la musique (Spotify/Deezer/toute app) baisse automatiquement pendant les alertes. shouldPlayInBackground + UIBackgroundModes audio (iOS) pour l'écran verrouillé (⚠️ build réel requis pour valider le son en veille).
- UI course active : toggle pré-course "🧟 Mode Zombie Run" (testID zombie-toggle), bannière de phase colorée avec compte à rebours (zombie-banner / zombie-countdown). Testé e2e web (screenshots).
- Décisions périmètre montres/audio (réponse utilisateur "tout, ordre a→b→c→d") : a) Zombie Run ✅ ; b) Spotify (Web API + OAuth, clés utilisateur requises, Premium requis) ; c) Apple Santé (import entraînements Apple Watch, build iOS requis) ; d) Garmin Connect API (clés programme dev Garmin requises). App watchOS native / Monkey C / SDK Deezer = hors périmètre plateforme (communiqué à l'utilisateur).
- En attente : clé OpenRouteService (gratuite) pour les circuits sur routes réelles (playbook ORS déjà obtenu, endpoint round_trip foot-walking prêt à implémenter).

## Iteration 6b — Apple Santé / montres connectées (livré)
- Modèle de données unifié montres (apple_health | garmin) : collection watch_workouts (external_id, started_at, duration_s, distance_m, calories_kcal, avg_hr_bpm, max_hr_bpm), index unique user+source+external_id, upsert idempotent.
- Backend : POST/GET /api/health/workouts. Frontend : src/health.ts (lecture HealthKit via @kingstinct/react-native-healthkit 14.1.0 + nitro-modules, import dynamique iOS uniquement) ; plugin config app.json avec descriptions NSHealthShare/Update ; Profil → section "MONTRES CONNECTÉES" (bouton Synchroniser sur iOS, fallback web/Android, liste des derniers imports avec FC moy/max, ligne Garmin "Bientôt").
- ⚠️ La lecture HealthKit réelle nécessite un build iOS (pas Expo Go) + une Apple Watch. Testé : backend 4/4, flows UI validés (iteration_6.json).
- Reste en attente utilisateur : clés Spotify (phase B), clé OpenRouteService (circuits routes réelles), clés programme dev Garmin (phase D).

## Iteration 7 — Fix message Apple Watch + circuits sur routes réelles (livré)
- Fix bug utilisateur : la connexion Apple Santé dans Expo Go affichait un message trompeur. src/health.ts détecte maintenant Expo Go (expo-constants) et retourne des codes raison typés ; le Profil affiche un message clair par cas (Expo Go → "génère le build iOS via Publish", refus → chemin Réglages Santé exact). Vraie synchro = uniquement build iOS installé + Apple Watch.
- Circuits routes réelles : GET /api/circuits (OpenRouteService round_trip foot-walking, clé ORS_API_KEY fournie par l'utilisateur dans backend/.env — attention .env sans \n final avait concaténé la clé, corrigé). 5 graines → 3 meilleures boucles (filtre 0.4x-2.2x, tri par proximité cible), estimation coureur 6 min/km, ~300 pts max/circuit. /routes-map consomme l'API (badge "Routes réelles", fallback géométrique "Tracé approximatif", overlay de génération). Tests : 4/4 backend + flows frontend (iteration_7.json).

## Iteration 8 — Refonte Zombie Run + fonctionnalités sociales + audit boutons (livré)
- Zombie Run v2 : ambiances CONTINUES en boucle par phase (chase_loop poursuite : cœur 150 bpm + horde de râles/growls ; calm_loop : vent + cœur lent) + stingers (alerte radio, râle proche, zone sûre, victoire) — corrige "son 1 seconde puis stop" + sons zombies réalistes (synthèse vocale harmonique glide/vibrato). Pause coupe l'ambiance. Régénérables via scripts/gen_zombie_sounds.py.
- Social : collection friendships (pending/accepted, index unique paire) ; recherche par nom/email (statut relationnel), demandes envoyer/accepter/refuser ; écran /friends (accessible du Profil + menu latéral) ; classement amis (semaine/mois, km + sorties, "Toi" surligné) sur Progression ; fil d'activité /activity (courses amies cliquables → bilan mode lecture "Course de X", analyse IA masquée) ; /notifications (demandes + courses amies 7j, badge sur cloche).
- Boutons : hamburger Accueil = menu latéral (Fil d'activité, Mes amis, Circuits 3D, Coach IA), cloche active avec badge. Audit complet par testing agent : aucun bouton mort.
- Seed : lea@pace.app / secret123 (amie acceptée de thomas, 3 courses) — test_credentials.md à jour. Tests : 11/11 backend + tous les flows frontend (iteration_8.json).
