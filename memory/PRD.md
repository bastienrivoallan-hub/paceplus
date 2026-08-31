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
