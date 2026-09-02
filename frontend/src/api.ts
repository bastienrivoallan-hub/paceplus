import Constants from 'expo-constants';

const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost;
const IP = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
console.log("IP détectée automatiquement:", IP);

export const API_URL = `http://${IP}:8000`;

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

// Objet centralisé pour toutes tes requêtes vers FastAPI
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

  me() {
    return this.request('/auth/me');
  },

  logout() {
    return this.request('/auth/logout', { method: 'POST' });
  },

  googleSession(sessionId: string) {
    return this.request(`/auth/google/session?session_id=${sessionId}`);
  },
googleSession(sessionId: string) {
    return this.request(`/auth/google/session?session_id=${sessionId}`);
  },

  stats() {
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

  activePlan() {
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

  circuits(lat: number, lon: number, distance: number) {
    return this.request(`/circuits?lat=${lat}&lon=${lon}&distance_km=${distance}`);
  },

  saveOnboarding(profileData: {
    goal: string;
    level: string;
    current_time?: string;
    target_time?: string;
    race_date?: string;
    frequency: number;
  }) {
    return this.request('/profile/onboarding', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  },
  generatePlan() {
    return this.request('/plan/generate', {
      method: 'POST',
    });
  },
  watchWorkouts() {
    return this.request('/health/workouts');
  },

  notifications() {
    return this.request('/notifications');
  },

  saveOnboarding(profileData: {
    goal: string;
    level: string;
    current_time?: string;
    target_time?: string;
    race_date?: string;
    frequency: number;
  }) {
    return this.request('/profile/onboarding', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  },
  generatePlan() {
    return this.request('/plan/generate', {
      method: 'POST',
    });
  },
  watchWorkouts() {
    return this.request('/health/workouts');
  },

  notifications() {
    return this.request('/notifications');
  },
};
// Ajout manuel : fonctions coach chat
Object.assign(api, {
  coachHistory() {
    return this.request('/coach/history');
  },
  coachChat(message) {
    return this.request('/coach/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },
});
