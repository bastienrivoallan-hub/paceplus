"""
Iteration 3 backend tests: weather (Open-Meteo), Claude features
(run analysis, weekly debrief, nutrition advice).
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") \
    or os.environ.get("EXPO_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set"
API = f"{BASE_URL}/api"

EMAIL = "thomas@pace.app"
PASSWORD = "secret123"
SEEDED_RUN_ID = "run_4d2a1a46548b"


@pytest.fixture(scope="module")
def auth():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json()["session_token"]
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return s


# ---- Weather (Open-Meteo) ----

class TestWeather:
    def test_weather_valid_coords(self, auth):
        r = auth.get(f"{API}/weather", params={"lat": 48.8566, "lon": 2.3522}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "current" in data and "next_hours" in data and "advice" in data
        cur = data["current"]
        assert "temperature_c" in cur and "feels_like_c" in cur
        assert "condition" in cur and "icon" in cur
        assert isinstance(data["next_hours"], list)
        assert isinstance(data["advice"], str) and len(data["advice"]) > 0

    def test_weather_invalid_lat_422(self, auth):
        r = auth.get(f"{API}/weather", params={"lat": 200, "lon": 2.3522}, timeout=15)
        assert r.status_code == 422

    def test_weather_invalid_lon_422(self, auth):
        r = auth.get(f"{API}/weather", params={"lat": 48.8, "lon": -500}, timeout=15)
        assert r.status_code == 422

    def test_weather_requires_auth(self):
        r = requests.get(f"{API}/weather", params={"lat": 48.8566, "lon": 2.3522}, timeout=15)
        assert r.status_code == 401


# ---- Run analysis (Claude) ----

class TestRunAnalysis:
    def test_run_analysis_returns_text(self, auth):
        r = auth.post(f"{API}/coach/run-analysis", json={"run_id": SEEDED_RUN_ID}, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data.get("analysis"), str) and len(data["analysis"]) > 20

    def test_run_analysis_cached(self, auth):
        # Second call must return cached (fast, same text)
        import time
        t0 = time.time()
        r = auth.post(f"{API}/coach/run-analysis", json={"run_id": SEEDED_RUN_ID}, timeout=15)
        elapsed = time.time() - t0
        assert r.status_code == 200, r.text
        assert elapsed < 5, f"cached call took {elapsed}s, expected <5s"
        assert isinstance(r.json().get("analysis"), str)

    def test_run_analysis_unknown_run_404(self, auth):
        r = auth.post(f"{API}/coach/run-analysis", json={"run_id": "run_does_not_exist_xyz"}, timeout=15)
        assert r.status_code == 404


# ---- Weekly debrief (Claude) ----

class TestWeeklyDebrief:
    def test_debrief_returns_text(self, auth):
        r = auth.get(f"{API}/coach/weekly-debrief", timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "week" in data and isinstance(data["week"], int)
        assert isinstance(data.get("debrief"), str) and len(data["debrief"]) > 20

    def test_debrief_cached(self, auth):
        import time
        t0 = time.time()
        r = auth.get(f"{API}/coach/weekly-debrief", timeout=15)
        elapsed = time.time() - t0
        assert r.status_code == 200
        assert elapsed < 5, f"cached debrief took {elapsed}s"


# ---- Nutrition advice (Claude) ----

class TestNutrition:
    def test_nutrition_returns_advice(self, auth):
        # Grab a non-rest session from active plan week 1
        p = auth.get(f"{API}/plan/active", timeout=15).json()
        cw = p.get("current_week", 1)
        wk = auth.get(f"{API}/plan/week/{cw}", timeout=15).json()["sessions"]
        non_rest = [s for s in wk if s.get("type") != "rest"]
        assert non_rest, "no non-rest session in current week"
        sid = non_rest[0]["session_id"]

        r = auth.get(f"{API}/coach/nutrition", params={"session_id": sid, "lat": 48.8566, "lon": 2.3522}, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data.get("session_title"), str)
        assert isinstance(data.get("advice"), str) and len(data["advice"]) > 30
