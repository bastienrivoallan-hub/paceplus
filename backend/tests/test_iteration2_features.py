"""
Iteration 2 backend tests: run summary, plan/upcoming, plan/adapt.
"""
import os
import time
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL")
            or os.environ.get("EXPO_BACKEND_URL")
            or "https://running-coach-app-2.preview.emergentagent.com").rstrip("/")
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


# ---- runs with splits ----

class TestRuns:
    def test_get_seeded_run_has_route_and_splits(self, auth):
        r = auth.get(f"{API}/runs/{SEEDED_RUN_ID}", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["run_id"] == SEEDED_RUN_ID
        assert isinstance(data.get("route"), list) and len(data["route"]) >= 2
        assert isinstance(data.get("splits"), list) and len(data["splits"]) >= 1
        s0 = data["splits"][0]
        assert "km" in s0 and "seconds" in s0 and "pace" in s0

    def test_get_unknown_run_404(self, auth):
        r = auth.get(f"{API}/runs/run_does_not_exist_xxx", timeout=15)
        assert r.status_code == 404

    def test_post_run_stores_splits(self, auth):
        payload = {
            "distance_m": 3000,
            "duration_s": 900,
            "avg_pace": "5:00",
            "route": [
                {"latitude": 48.8566, "longitude": 2.3522, "t": 0},
                {"latitude": 48.8570, "longitude": 2.3530, "t": 60},
            ],
            "splits": [
                {"km": 1, "seconds": 300, "pace": "5:00"},
                {"km": 2, "seconds": 305, "pace": "5:05"},
                {"km": 3, "seconds": 295, "pace": "4:55"},
            ],
        }
        r = auth.post(f"{API}/runs", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        run_id = r.json()["run_id"]
        # Verify via GET
        g = auth.get(f"{API}/runs/{run_id}", timeout=15)
        assert g.status_code == 200
        gd = g.json()
        assert len(gd["splits"]) == 3
        assert gd["splits"][1]["pace"] == "5:05"
        assert len(gd["route"]) == 2


# ---- plan/upcoming ----

class TestUpcoming:
    def test_upcoming_returns_non_rest_sorted(self, auth):
        r = auth.get(f"{API}/plan/upcoming", timeout=15)
        assert r.status_code == 200, r.text
        sessions = r.json().get("sessions", [])
        # No rest sessions
        for s in sessions:
            assert s.get("type") != "rest"
        # Sorted by date ascending
        dates = [s["date"] for s in sessions]
        assert dates == sorted(dates)

    def test_upcoming_does_not_collide_with_sessions_id(self, auth):
        # /api/plan/upcoming must be distinct from /api/sessions/{id}
        r = auth.get(f"{API}/plan/upcoming", timeout=15)
        assert r.status_code == 200
        # Also, /api/sessions/upcoming would 404 (no such session)
        r2 = auth.get(f"{API}/sessions/upcoming", timeout=15)
        assert r2.status_code == 404


# ---- plan/adapt ----

class TestAdapt:
    def test_adapt_replaces_week(self, auth):
        # Get active plan to know current week
        p = auth.get(f"{API}/plan/active", timeout=15).json()
        week = p.get("current_week", 1)
        before = auth.get(f"{API}/plan/week/{week}", timeout=15).json()["sessions"]
        before_ids = {s["session_id"] for s in before}

        r = auth.post(f"{API}/plan/adapt", json={"week": week}, timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["week"] == week
        assert isinstance(data.get("coach_note"), str) and len(data["coach_note"]) > 0
        assert isinstance(data.get("sessions"), list) and len(data["sessions"]) == 7

        # Verify via GET
        after = auth.get(f"{API}/plan/week/{week}", timeout=15).json()["sessions"]
        assert len(after) == 7
        after_ids = {s["session_id"] for s in after}
        # Sessions should be replaced (different IDs)
        assert after_ids.isdisjoint(before_ids)
