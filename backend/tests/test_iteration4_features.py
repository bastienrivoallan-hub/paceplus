"""
Iteration 4 backend tests: geo search, race location, race weather alert (Claude),
weather-based route pick (Claude), and quick /api/weather regression (wind_dir_deg).
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") \
    or os.environ.get("EXPO_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set"
API = f"{BASE_URL}/api"

EMAIL = "thomas@pace.app"
PASSWORD = "secret123"

VALID_ROUTE_IDS = {"r1", "r2", "r3", "r4", "r5", "r6"}


@pytest.fixture(scope="module")
def auth():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json()["session_token"]
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return s


# ---- Geo search (Open-Meteo geocoding) ----

class TestGeoSearch:
    def test_search_paris(self, auth):
        r = auth.get(f"{API}/geo/search", params={"q": "Paris"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data.get("results"), list) and len(data["results"]) > 0
        first = data["results"][0]
        for k in ("name", "region", "country", "lat", "lon"):
            assert k in first, f"missing {k} in geo result"
        assert isinstance(first["lat"], (int, float))
        assert isinstance(first["lon"], (int, float))

    def test_search_too_short_returns_empty(self, auth):
        r = auth.get(f"{API}/geo/search", params={"q": "P"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json() == {"results": []}

    def test_search_empty_q_returns_empty(self, auth):
        r = auth.get(f"{API}/geo/search", params={"q": ""}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json() == {"results": []}

    def test_search_requires_auth(self):
        r = requests.get(f"{API}/geo/search", params={"q": "Paris"}, timeout=15)
        assert r.status_code == 401


# ---- Race location save ----

class TestRaceLocation:
    def test_save_valid(self, auth):
        # Annecy — matches seeded state
        body = {"city": "Annecy", "lat": 45.8992, "lon": 6.1294}
        r = auth.put(f"{API}/profile/race-location", json=body, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        loc = data.get("race_location") or {}
        assert loc.get("city") == "Annecy"
        assert abs(loc.get("lat") - 45.8992) < 1e-6
        assert abs(loc.get("lon") - 6.1294) < 1e-6

    def test_save_invalid_lat_422(self, auth):
        r = auth.put(f"{API}/profile/race-location",
                     json={"city": "Bad", "lat": 200.0, "lon": 6.0}, timeout=15)
        assert r.status_code == 422

    def test_save_invalid_lon_422(self, auth):
        r = auth.put(f"{API}/profile/race-location",
                     json={"city": "Bad", "lat": 45.0, "lon": -500.0}, timeout=15)
        assert r.status_code == 422


# ---- Race weather alert (Claude, cached) ----

class TestRaceWeather:
    def test_race_weather_returns_state(self, auth):
        r = auth.get(f"{API}/race/weather", timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("status") in ("difficult", "ok"), f"unexpected status: {data}"
        # base fields
        for k in ("race_date", "days_left", "goal_label", "race_location", "forecast", "flags"):
            assert k in data, f"missing {k}"
        assert isinstance(data["days_left"], int)
        assert isinstance(data["flags"], list)
        rl = data["race_location"]
        assert rl and "city" in rl and "lat" in rl and "lon" in rl
        f = data["forecast"]
        for k in ("temp_max_c", "wind_max_kmh", "rain_prob", "condition", "icon"):
            assert k in f, f"missing forecast.{k}"
        if data["status"] == "difficult":
            assert isinstance(data.get("strategy"), str) and len(data["strategy"]) > 30, \
                "strategy text should be a non-empty string when difficult"

    def test_race_weather_cached_fast(self, auth):
        # Second call same day: strategy comes from db.race_alerts, should be fast.
        t0 = time.time()
        r = auth.get(f"{API}/race/weather", timeout=30)
        elapsed = time.time() - t0
        assert r.status_code == 200
        assert elapsed < 8, f"cached race weather took {elapsed}s"
        data = r.json()
        assert data.get("status") in ("difficult", "ok")

    def test_race_weather_requires_auth(self):
        r = requests.get(f"{API}/race/weather", timeout=15)
        assert r.status_code == 401


# ---- Coach route weather (Claude, cached ~1h) ----

class TestRouteWeather:
    def test_route_weather_ok(self, auth):
        r = auth.get(f"{API}/coach/route-weather",
                     params={"lat": 45.9, "lon": 6.13}, timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "route" in data and "reason" in data and "wind_tip" in data and "weather" in data
        route = data["route"]
        assert route.get("id") in VALID_ROUTE_IDS
        assert "terrain" in route and isinstance(route["terrain"], str) and len(route["terrain"]) > 0
        # French reason (loose check: contains lowercase letters and > 20 chars)
        assert isinstance(data["reason"], str) and len(data["reason"]) > 15
        assert isinstance(data["wind_tip"], str) and len(data["wind_tip"]) > 5
        w = data["weather"]
        for k in ("condition", "temperature_c", "wind_kmh", "wind_dir", "icon"):
            assert k in w, f"missing weather.{k}"
        assert isinstance(w["wind_dir"], str)

    def test_route_weather_cached_fast(self, auth):
        t0 = time.time()
        r = auth.get(f"{API}/coach/route-weather",
                     params={"lat": 45.9, "lon": 6.13}, timeout=30)
        elapsed = time.time() - t0
        assert r.status_code == 200
        assert elapsed < 5, f"cached route-weather took {elapsed}s"
        assert r.json()["route"]["id"] in VALID_ROUTE_IDS

    def test_route_weather_invalid_lat_422(self, auth):
        r = auth.get(f"{API}/coach/route-weather",
                     params={"lat": 200, "lon": 6.13}, timeout=15)
        assert r.status_code == 422

    def test_route_weather_invalid_lon_422(self, auth):
        r = auth.get(f"{API}/coach/route-weather",
                     params={"lat": 45.9, "lon": -500}, timeout=15)
        assert r.status_code == 422

    def test_route_weather_requires_auth(self):
        r = requests.get(f"{API}/coach/route-weather",
                         params={"lat": 45.9, "lon": 6.13}, timeout=15)
        assert r.status_code == 401


# ---- /api/weather regression (wind_dir_deg exposed) ----

class TestWeatherRegression:
    def test_weather_current_has_wind_dir_deg(self, auth):
        r = auth.get(f"{API}/weather", params={"lat": 45.9, "lon": 6.13}, timeout=20)
        assert r.status_code == 200, r.text
        cur = r.json()["current"]
        assert "wind_dir_deg" in cur, "wind_dir_deg missing from current"
        v = cur["wind_dir_deg"]
        # can be null occasionally but usually a number 0-360
        if v is not None:
            assert 0 <= float(v) <= 360
