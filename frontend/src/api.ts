import Constants from 'expo-constants';

const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost;
const IP = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
console.log("IP détectée automatiquement:", IP);

export const API_URL = 'https://paceplus.onrender.com';

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

type OnboardingData = {
  goal: string;
  level: string;
  current_time?: string | null;
  target_time?: string | null;
  race_date?: string | null;
  frequency: number;
};

export const api = {
  async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || 'Une erreur est survenue');
    }

    return data;
  },

  // ---------- auth ----------
  login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  register(email: string, password: string, name: string) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  },

  googleSession(sessionId: string) {
    return this.request('/auth/session', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    });
  },

  me() {
    return this.request('/auth/me');
  },

  logout() {
    return this.request('/auth/logout', { method: 'POST' });
  },

  // ---------- profile / onboarding ----------
  saveOnboarding(profileData: OnboardingData) {
    return this.request('/profile/onboarding', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  },

  saveRaceLocation(city: string, lat: number, lon: number) {
    return this.request('/profile/race-location', {
      method: 'PUT',
      body: JSON.stringify({ city, lat, lon }),
    });
  },

  // ---------- plan ----------
  generatePlan() {
    return this.request('/plan/generate', { method: 'POST' });
  },

  adaptPlan(week: number) {
    return this.request('/plan/adapt', {
      method: 'POST',
      body: JSON.stringify({ week }),
    });
  },

  activePlan() {
    return this.request('/plan/active');
  },

  week(w: number) {
    return this.request(`/plan/week/${w}`);
  },

  upcomingSessions() {
    return this.request('/plan/upcoming');
  },

  // ---------- sessions ----------
  session(sessionId: string) {
    return this.request(`/sessions/${sessionId}`);
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

  // ---------- home ----------
  homeToday() {
    return this.request('/home/today');
  },

  // ---------- runs ----------
  saveRun(run: {
    distance_m: number;
    duration_s: number;
    route?: any[];
    splits?: any[];
    session_id?: string;
    avg_pace?: string;
  }) {
    return this.request('/runs', {
      method: 'POST',
      body: JSON.stringify(run),
    });
  },

  runs() {
    return this.request('/runs');
  },

  run(runId: string) {
    return this.request(`/runs/${runId}`);
  },

  // ---------- stats ----------
  stats() {
    return this.request('/stats');
  },

  // ---------- coach ----------
  coachHistory() {
    return this.request('/coach/history');
  },

  coachChat(message: string) {
    return this.request('/coach/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  runAnalysis(runId: string) {
    return this.request('/coach/run-analysis', {
      method: 'POST',
      body: JSON.stringify({ run_id: runId }),
    });
  },

  weeklyDebrief() {
    return this.request('/coach/weekly-debrief');
  },

  nutrition(params: { session_id?: string; lat?: number; lon?: number } = {}) {
    const query = new URLSearchParams();
    if (params.session_id) query.append('session_id', params.session_id);
    if (params.lat !== undefined) query.append('lat', String(params.lat));
    if (params.lon !== undefined) query.append('lon', String(params.lon));
    const qs = query.toString();
    return this.request(`/coach/nutrition${qs ? `?${qs}` : ''}`);
  },

  routeWeather(lat: number, lon: number) {
    return this.request(`/coach/route-weather?lat=${lat}&lon=${lon}`);
  },

  // ---------- weather ----------
  weather(lat: number, lon: number) {
    return this.request(`/weather?lat=${lat}&lon=${lon}`);
  },

  raceWeather() {
    return this.request('/race/weather');
  },

  // ---------- geo ----------
  geoSearch(query: string) {
    return this.request(`/geo/search?q=${encodeURIComponent(query)}`);
  },

  // ---------- health / watch ----------
  watchWorkouts() {
    return this.request('/health/workouts');
  },

  syncWatchWorkouts(workouts: any[]) {
    return this.request('/health/workouts', {
      method: 'POST',
      body: JSON.stringify({ workouts }),
    });
  },

  // ---------- friends ----------
  friends() {
    return this.request('/friends');
  },

  friendsFeed() {
    return this.request('/friends/feed');
  },

  searchUsers(query: string) {
    return this.request(`/users/search?q=${encodeURIComponent(query)}`);
  },

  friendRequest(userId: string) {
    return this.request('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  },

  friendRespond(friendshipId: string, accept: boolean) {
    return this.request('/friends/respond', {
      method: 'POST',
      body: JSON.stringify({ friendship_id: friendshipId, accept }),
    });
  },

  leaderboard(period: "week" | "month") {
    return this.request(`/friends/leaderboard?period=${period}`);
  },

  // ---------- notifications ----------
  notifications() {
    return this.request('/notifications');
  },

  // ---------- circuits ----------
  runGhost(runId: string) {
    return this.request(`/runs/${runId}/ghost`);
  },

  circuits(lat: number, lon: number, distance: number) {
    return this.request(`/circuits?lat=${lat}&lon=${lon}&distance_km=${distance}`);
  },
};
