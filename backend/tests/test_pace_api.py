"""PACE Running Coach - Backend API tests.

Tests the full auth + plan + sessions + home + stats + coach + routes flows
against the deployed backend behind the Kubernetes ingress.
"""

import os
import time
import uuid

import pytest
import requests
from dotenv import load_dotenv

# Load frontend env because that holds the public URL used by mobile clients
load_dotenv("/app/frontend/.env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

EXISTING_EMAIL = "thomas@pace.app"
EXISTING_PW = "secret123"

TIMEOUT_STD = 30
TIMEOUT_LLM = 90  # Claude Sonnet 5 plan generation


@pytest.fixture(scope="session")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def existing_token(http):
    r = http.post(f"{API}/auth/login", json={"email": EXISTING_EMAIL, "password": EXISTING_PW}, timeout=TIMEOUT_STD)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "session_token" in data and "user" in data
    return data["session_token"], data["user"]


def h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# -------- health --------
class TestHealth:
    def test_root(self, http):
        r = http.get(f"{API}/", timeout=TIMEOUT_STD)
        assert r.status_code == 200
        assert r.json().get("message") == "PACE API"


# -------- auth --------
class TestAuth:
    def test_login_success(self, existing_token):
        token, user = existing_token
        assert token.startswith("st_")
        assert user["email"] == EXISTING_EMAIL
        assert user["onboarding_completed"] is True

    def test_login_wrong_password(self, http):
        r = http.post(f"{API}/auth/login", json={"email": EXISTING_EMAIL, "password": "wrong"}, timeout=TIMEOUT_STD)
        assert r.status_code == 401

    def test_me_without_token(self, http):
        r = http.get(f"{API}/auth/me", timeout=TIMEOUT_STD)
        assert r.status_code == 401

    def test_me_with_token(self, http, existing_token):
        token, _ = existing_token
        r = http.get(f"{API}/auth/me", headers=h(token), timeout=TIMEOUT_STD)
        assert r.status_code == 200
        assert r.json()["email"] == EXISTING_EMAIL

    def test_register_duplicate(self, http):
        r = http.post(
            f"{API}/auth/register",
            json={"email": EXISTING_EMAIL, "password": "secret123", "name": "dup"},
            timeout=TIMEOUT_STD,
        )
        assert r.status_code == 400


# -------- plan / sessions for existing user --------
class TestPlanExisting:
    def test_active_plan(self, http, existing_token):
        token, _ = existing_token
        r = http.get(f"{API}/plan/active", headers=h(token), timeout=TIMEOUT_STD)
        assert r.status_code == 200
        data = r.json()
        assert data["plan"] is not None, "existing user should have an active plan"
        assert data["plan"]["active"] is True
        assert "total_weeks" in data["plan"]
        assert isinstance(data["current_week"], int)

    def test_week_returns_seven(self, http, existing_token):
        token, _ = existing_token
        r = http.get(f"{API}/plan/week/1", headers=h(token), timeout=TIMEOUT_STD)
        assert r.status_code == 200
        data = r.json()
        assert data["week"] == 1
        sessions = data["sessions"]
        assert 7 == len(sessions), f"expected 7 sessions for week 1, got {len(sessions)}"
        # ordered by day_index
        idxs = [s["day_index"] for s in sessions]
        assert idxs == sorted(idxs)
        assert idxs == list(range(7))

    def test_session_get_complete_uncomplete(self, http, existing_token):
        token, _ = existing_token
        r = http.get(f"{API}/plan/week/1", headers=h(token), timeout=TIMEOUT_STD)
        session = next((s for s in r.json()["sessions"] if s["type"] != "rest"), None)
        assert session, "expected at least one non-rest session"
        sid = session["session_id"]
        r = http.get(f"{API}/sessions/{sid}", headers=h(token), timeout=TIMEOUT_STD)
        assert r.status_code == 200
        assert r.json()["session_id"] == sid
        # complete
        r = http.post(f"{API}/sessions/{sid}/complete", headers=h(token), timeout=TIMEOUT_STD)
        assert r.status_code == 200
        r = http.get(f"{API}/sessions/{sid}", headers=h(token), timeout=TIMEOUT_STD)
        assert r.json()["completed"] is True
        # uncomplete
        r = http.post(f"{API}/sessions/{sid}/uncomplete", headers=h(token), timeout=TIMEOUT_STD)
        assert r.status_code == 200
        r = http.get(f"{API}/sessions/{sid}", headers=h(token), timeout=TIMEOUT_STD)
        assert r.json()["completed"] is False

    def test_session_not_found(self, http, existing_token):
        token, _ = existing_token
        r = http.get(f"{API}/sessions/sess_doesnotexist", headers=h(token), timeout=TIMEOUT_STD)
        assert r.status_code == 404


# -------- home / stats / runs --------
class TestHomeStatsRuns:
    def test_home_today(self, http, existing_token):
        token, _ = existing_token
        r = http.get(f"{API}/home/today", headers=h(token), timeout=TIMEOUT_STD)
        assert r.status_code == 200
        data = r.json()
        assert "name" in data
        assert "form" in data and "score" in data["form"]
        assert 0 < data["form"]["score"] <= 100
        assert "streak" in data

    def test_stats(self, http, existing_token):
        token, _ = existing_token
        r = http.get(f"{API}/stats", headers=h(token), timeout=TIMEOUT_STD)
        assert r.status_code == 200
        data = r.json()
        for k in ["total_distance_km", "total_duration_s", "total_runs", "weekly_series", "adherence"]:
            assert k in data

    def test_runs_list(self, http, existing_token):
        token, _ = existing_token
        r = http.get(f"{API}/runs", headers=h(token), timeout=TIMEOUT_STD)
        assert r.status_code == 200
        assert isinstance(r.json()["runs"], list)

    def test_post_run_marks_session_complete(self, http, existing_token):
        token, _ = existing_token
        # find an incomplete session
        r = http.get(f"{API}/plan/week/1", headers=h(token), timeout=TIMEOUT_STD)
        target = next((s for s in r.json()["sessions"] if s["type"] != "rest"), None)
        assert target
        sid = target["session_id"]
        # ensure it's uncompleted
        http.post(f"{API}/sessions/{sid}/uncomplete", headers=h(token), timeout=TIMEOUT_STD)
        payload = {"distance_m": 5000, "duration_s": 1500, "route": [], "session_id": sid, "avg_pace": "5:00/km"}
        r = http.post(f"{API}/runs", headers=h(token), json=payload, timeout=TIMEOUT_STD)
        assert r.status_code == 200
        run = r.json()
        assert run["distance_m"] == 5000
        # verify session completed
        r = http.get(f"{API}/sessions/{sid}", headers=h(token), timeout=TIMEOUT_STD)
        assert r.json()["completed"] is True
        # cleanup
        http.post(f"{API}/sessions/{sid}/uncomplete", headers=h(token), timeout=TIMEOUT_STD)


# -------- routes --------
class TestRoutes:
    def test_routes_requires_auth(self, http):
        r = http.get(f"{API}/routes", timeout=TIMEOUT_STD)
        assert r.status_code == 401

    def test_routes_returns_list(self, http, existing_token):
        token, _ = existing_token
        r = http.get(f"{API}/routes", headers=h(token), timeout=TIMEOUT_STD)
        assert r.status_code == 200
        routes = r.json()["routes"]
        assert isinstance(routes, list) and len(routes) >= 3
        assert "name" in routes[0]


# -------- coach (LLM) --------
class TestCoach:
    def test_coach_history(self, http, existing_token):
        token, _ = existing_token
        r = http.get(f"{API}/coach/history", headers=h(token), timeout=TIMEOUT_STD)
        assert r.status_code == 200
        assert "messages" in r.json()

    def test_coach_chat(self, http, existing_token):
        token, _ = existing_token
        r = http.post(
            f"{API}/coach/chat",
            headers=h(token),
            json={"message": "Bonjour coach, comment vas-tu ? Donne-moi un conseil court."},
            timeout=TIMEOUT_LLM,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:400]}"
        data = r.json()
        assert "reply" in data
        assert isinstance(data["reply"], str) and len(data["reply"]) > 10


# -------- fresh user: register -> onboarding -> plan generate --------
class TestFreshUserFlow:
    """Registers a brand new user and takes them through onboarding + plan gen."""

    def test_full_new_user_flow(self, http):
        email = f"TEST_{uuid.uuid4().hex[:8]}@pace.app"
        pw = "testpass123"
        # register
        r = http.post(
            f"{API}/auth/register",
            json={"email": email, "password": pw, "name": "TEST User"},
            timeout=TIMEOUT_STD,
        )
        assert r.status_code == 200, r.text
        token = r.json()["session_token"]
        user = r.json()["user"]
        assert user["onboarding_completed"] is False

        # active plan should be None
        r = http.get(f"{API}/plan/active", headers=h(token), timeout=TIMEOUT_STD)
        assert r.status_code == 200
        assert r.json()["plan"] is None

        # onboarding
        r = http.put(
            f"{API}/profile/onboarding",
            headers=h(token),
            json={
                "goal": "5km",
                "level": "debutant",
                "current_time": "30:00",
                "target_time": "25:00",
                "race_date": None,
                "frequency": 3,
            },
            timeout=TIMEOUT_STD,
        )
        assert r.status_code == 200
        assert r.json()["ok"] is True

        # /auth/me should reflect onboarding_completed
        r = http.get(f"{API}/auth/me", headers=h(token), timeout=TIMEOUT_STD)
        assert r.json()["onboarding_completed"] is True

        # generate plan (LLM)
        t0 = time.time()
        r = http.post(f"{API}/plan/generate", headers=h(token), timeout=TIMEOUT_LLM + 60)
        elapsed = time.time() - t0
        print(f"Plan generation took {elapsed:.1f}s")
        assert r.status_code == 200, f"{r.status_code} {r.text[:400]}"
        payload = r.json()
        assert payload["plan"]["active"] is True
        assert payload["sessions_count"] >= 7

        # week 1 should have 7 sessions
        r = http.get(f"{API}/plan/week/1", headers=h(token), timeout=TIMEOUT_STD)
        assert r.status_code == 200
        sessions = r.json()["sessions"]
        assert len(sessions) == 7
