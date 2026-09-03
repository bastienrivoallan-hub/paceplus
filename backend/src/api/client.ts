import axios, { AxiosInstance, AxiosError } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
cat > src/api/client.ts << 'EOF'
import axios, { AxiosInstance, AxiosError } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
interface ApiError {
  status: number;
  detail: string;
cat > src/api/client.ts << 'EOF'
import axios, { AxiosInstance, AxiosError } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

interface ApiError {
  status: number;
  detail: string;
}

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
    });

    this.client.interceptors.request.use(async (config) => {
      const token = await this.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiError>) => {
        if (error.response?.status === 401) {
          this.logout();
        }
        return Promise.reject(error);
      }
    );
  }

  // ========== AUTHENTIFICATION ==========
  async register(email: string, password: string, name: string) {
    const res = await this.client.post("/auth/register", { email, password, name });
    await this.setToken(res.data.session_token);
    return res.data;
  }

  async login(email: string, password: string) {
    const res = await this.client.post("/auth/login", { email, password });
    await this.setToken(res.data.session_token);
    return res.data;
  }

  async getMe() {
    const res = await this.client.get("/auth/me");
    return res.data;
  }

  async logout() {
    try {
      await this.client.post("/auth/logout");
    } finally {
      await this.removeToken();
    }
  }

  // ========== PROFIL ==========
  async completeOnboarding(goal: string, level: string, currentTime?: string, targetTime?: string) {
    const res = await this.client.put("/profile/onboarding", { goal, level, current_time: currentTime, target_time: targetTime });
    return res.data;
  }

  async updateRaceLocation(location: string, lat: number, lon: number) {
    const res = await this.client.put("/profile/race-location", { location, lat, lon });
    return res.data;
  }

  // ========== PLANS ==========
  async generatePlan() {
    const res = await this.client.post("/plan/generate");
    return res.data;
  }

  async adaptPlan(feedback: string) {
    const res = await this.client.post("/plan/adapt", { feedback });
    return res.data;
  }

  async getActivePlan() {
    const res = await this.client.get("/plan/active");
    return res.data;
  }

  async getPlanWeek(week: number) {
    const res = await this.client.get(`/plan/week/${week}`);
    return res.data;
  }

  async getUpcomingPlan() {
    const res = await this.client.get("/plan/upcoming");
    return res.data;
  }

  // ========== SESSIONS ==========
  async getSession(sessionId: string) {
    const res = await this.client.get(`/sessions/${sessionId}`);
    return res.data;
  }

  async completeSession(sessionId: string, data: any) {
    const res = await this.client.post(`/sessions/${sessionId}/complete`, data);
    return res.data;
  }

  async uncompleteSession(sessionId: string) {
    const res = await this.client.post(`/sessions/${sessionId}/uncomplete`);
    return res.data;
  }

  // ========== RUNS ==========
  async createRun(data: any) {
    const res = await this.client.post("/runs", data);
    return res.data;
  }

  async getRuns() {
    const res = await this.client.get("/runs");
    return res.data;
  }

  async getRun(runId: string) {
    const res = await this.client.get(`/runs/${runId}`);
    return res.data;
  }

  async getGhostRun(runId: string) {
    const res = await this.client.get(`/runs/${runId}/ghost`);
    return res.data;
  }

  // ========== HOME & STATS ==========
  async getTodayHome() {
    const res = await this.client.get("/home/today");
    return res.data;
  }

  async getStats() {
    const res = await this.client.get("/stats");
    return res.data;
  }

  // ========== COACH ==========
  async coachChat(message: string, context?: any) {
    const res = await this.client.post("/coach/chat", { message, context });
    return res.data;
  }

  async coachRunAnalysis(runId: string) {
    const res = await this.client.post("/coach/run-analysis", { run_id: runId });
    return res.data;
  }

  async coachWeeklyDebrief() {
    const res = await this.client.get("/coach/weekly-debrief");
    return res.data;
  }

  async coachNutrition(sessionId?: string, lat?: number, lon?: number) {
    const res = await this.client.get("/coach/nutrition", { params: { session_id: sessionId, lat, lon } });
    return res.data;
  }

  async coachHistory() {
    const res = await this.client.get("/coach/history");
    return res.data;
  }

  // ========== MÉTÉO & GÉO ==========
  async getWeather(lat: number, lon: number) {
    const res = await this.client.get("/weather", { params: { lat, lon } });
    return res.data;
  }

  async getRaceWeather() {
    const res = await this.client.get("/race/weather");
    return res.data;
  }

  async geoSearch(query: string) {
    const res = await this.client.get("/geo/search", { params: { q: query } });
    return res.data;
  }

  // ========== TOKEN ==========
  private async getToken(): Promise<string | null> {
    if (this.token) return this.token;
    this.token = await AsyncStorage.getItem("auth_token");
    return this.token;
  }

  private async setToken(token: string) {
    this.token = token;
    await AsyncStorage.setItem("auth_token", token);
  }

  private async removeToken() {
    this.token = null;
    await AsyncStorage.removeItem("auth_token");
  }

  async isAuthenticated(): Promise<boolean> {
    return (await this.getToken()) !== null;
  }
}

export const apiClient = new ApiClient();
