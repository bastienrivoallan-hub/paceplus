import { storage } from "@/src/utils/storage";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

const TOKEN_KEY = "pace_session_token";

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T = any>(
  path: string,
  opts: { method?: string; body?: any } = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!authToken) {
    const stored = await storage.secureGet<string>(TOKEN_KEY, "");
    if (stored) authToken = stored;
  }
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  let data: any = null;
  const txt = await res.text();
  try {
    data = txt ? JSON.parse(txt) : null;
  } catch {
    data = txt;
  }

  if (!res.ok) {
    const detail = (data && data.detail) || `Erreur ${res.status}`;
    throw new ApiError(typeof detail === "string" ? detail : "Erreur", res.status);
  }
  return data as T;
}

export const api = {
  // auth
  register: (email: string, password: string, name: string) =>
    request("/auth/register", { method: "POST", body: { email, password, name } }),
  login: (email: string, password: string) =>
    request("/auth/login", { method: "POST", body: { email, password } }),
  googleSession: (session_id: string) =>
    request("/auth/session", { method: "POST", body: { session_id } }),
  me: () => request("/auth/me"),
  logout: () => request("/auth/logout", { method: "POST" }),

  // onboarding + plan
  saveOnboarding: (body: any) => request("/profile/onboarding", { method: "PUT", body }),
  generatePlan: () => request("/plan/generate", { method: "POST" }),
  activePlan: () => request("/plan/active"),
  adaptPlan: (week?: number) => request("/plan/adapt", { method: "POST", body: { week: week ?? null } }),
  upcomingSessions: () => request("/plan/upcoming"),
  week: (week: number) => request(`/plan/week/${week}`),
  session: (id: string) => request(`/sessions/${id}`),
  completeSession: (id: string) => request(`/sessions/${id}/complete`, { method: "POST" }),
  uncompleteSession: (id: string) => request(`/sessions/${id}/uncomplete`, { method: "POST" }),

  // home / stats / runs
  homeToday: () => request("/home/today"),
  stats: () => request("/stats"),
  runs: () => request("/runs"),
  run: (id: string) => request(`/runs/${id}`),
  saveRun: (body: any) => request("/runs", { method: "POST", body }),

  // coach + explore
  coachHistory: () => request("/coach/history"),
  coachChat: (message: string) => request("/coach/chat", { method: "POST", body: { message } }),
  runAnalysis: (run_id: string) => request("/coach/run-analysis", { method: "POST", body: { run_id } }),
  weeklyDebrief: () => request("/coach/weekly-debrief"),
  nutrition: (params: { session_id?: string; lat?: number; lon?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.session_id) q.set("session_id", params.session_id);
    if (params.lat != null) q.set("lat", String(params.lat));
    if (params.lon != null) q.set("lon", String(params.lon));
    const qs = q.toString();
    return request(`/coach/nutrition${qs ? `?${qs}` : ""}`);
  },
  weather: (lat: number, lon: number) => request(`/weather?lat=${lat}&lon=${lon}`),
  routes: () => request("/routes"),
  routeWeather: (lat: number, lon: number) => request(`/coach/route-weather?lat=${lat}&lon=${lon}`),

  // race weather
  geoSearch: (q: string) => request(`/geo/search?q=${encodeURIComponent(q)}`),
  saveRaceLocation: (city: string, lat: number, lon: number) =>
    request("/profile/race-location", { method: "PUT", body: { city, lat, lon } }),
  raceWeather: () => request("/race/weather"),
};
