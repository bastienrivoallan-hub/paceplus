"""Iteration 7 - real-road circuits (OpenRouteService).

Note: ORS free tier = 40 req/min. Each /api/circuits call fans out 5 ORS requests.
We keep circuit generations under 4 total and sleep between them.
"""
import math
import os
import time
import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or "https://running-coach-app-2.preview.emergentagent.com"
).rstrip("/")

TEST_EMAIL = "thomas@pace.app"
TEST_PASSWORD = "secret123"


@pytest.fixture(scope="module")
def token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["session_token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _haversine_m(a, b):
    R = 6371000
    lat1, lat2 = math.radians(a["latitude"]), math.radians(b["latitude"])
    dlat = lat2 - lat1
    dlon = math.radians(b["longitude"] - a["longitude"])
    x = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


# --- validation / auth (no ORS quota consumed) ---
class TestCircuitsValidation:
    def test_no_auth_returns_401(self):
        r = requests.get(
            f"{BASE_URL}/api/circuits",
            params={"lat": 45.9, "lon": 6.13, "distance_km": 5},
            timeout=15,
        )
        assert r.status_code == 401

    def test_invalid_lat_returns_422(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/circuits",
            params={"lat": 99, "lon": 6.13, "distance_km": 5},
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 422

    def test_distance_out_of_range_returns_422(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/circuits",
            params={"lat": 45.9, "lon": 6.13, "distance_km": 50},
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 422


# --- happy path (1 ORS-heavy call) ---
class TestCircuitsGeneration:
    def test_generate_returns_valid_circuits(self, auth_headers):
        lat, lon, dist_km = 45.9, 6.13, 5
        r = requests.get(
            f"{BASE_URL}/api/circuits",
            params={"lat": lat, "lon": lon, "distance_km": dist_km},
            headers=auth_headers,
            timeout=45,
        )
        # ORS transient failures are acceptable per test brief; retry once
        if r.status_code == 502:
            time.sleep(3)
            r = requests.get(
                f"{BASE_URL}/api/circuits",
                params={"lat": lat, "lon": lon, "distance_km": dist_km},
                headers=auth_headers,
                timeout=45,
            )
        assert r.status_code == 200, f"circuits failed: {r.status_code} {r.text}"
        data = r.json()
        circuits = data.get("circuits", [])
        assert 1 <= len(circuits) <= 3, f"unexpected count: {len(circuits)}"

        valid_ids = {"ors0", "ors1", "ors2"}
        target_m = dist_km * 1000
        start = {"latitude": lat, "longitude": lon}

        for c in circuits:
            assert c["id"] in valid_ids
            assert isinstance(c["name"], str) and c["name"]
            assert isinstance(c["color"], str) and c["color"].startswith("#")
            assert c["source"] == "openrouteservice"
            assert isinstance(c["seed"], int)
            assert c["duration_min"] > 0
            # distance within 0.4x .. 2.2x band (server-enforced)
            km = float(c["distance_km"])
            assert target_m * 0.0004 <= km <= target_m * 0.0022, f"{km} outside band for target {dist_km}km"
            coords = c["coords"]
            assert isinstance(coords, list) and len(coords) >= 2
            for pt in coords[:5]:
                assert "latitude" in pt and "longitude" in pt
            # loop check — first and last close to start (< 300 m)
            d_first = _haversine_m(coords[0], start)
            d_last = _haversine_m(coords[-1], start)
            assert d_first < 300, f"first point {d_first:.0f}m from start"
            assert d_last < 300, f"last point {d_last:.0f}m from start"
