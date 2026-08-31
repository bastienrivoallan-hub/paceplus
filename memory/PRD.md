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

## Backlog / remaining
- P1: Real map on run tracker + route replay (react-native-maps, needs device build).
- P1: Wearable/health data integration for real readiness metrics (currently deterministic pseudo-data).
- P2: Streaming coach responses (SSE) instead of request/response.
- P2: Migrate FastAPI startup/shutdown handlers to lifespan.
- P2: Post-run summary screen with splits.

## Notes
- GPS tracking requires a real device build to fully validate (limited in Expo Go / web preview).
- 5-tab navigation is intentional per the provided mockup.
