const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

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
  routes: () => request("/routes"),
};
