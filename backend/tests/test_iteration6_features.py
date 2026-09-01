"""Iteration 6: Apple Health / watch workouts sync endpoints."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://running-coach-app-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": "thomas@pace.app", "password": "secret123"}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["session_token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- auth guard ----------
def test_health_workouts_requires_auth():
    r = requests.get(f"{API}/health/workouts", timeout=15)
    assert r.status_code == 401

    r2 = requests.post(f"{API}/health/workouts", json={"workouts": []}, timeout=15)
    assert r2.status_code == 401


# ---------- happy path + idempotency ----------
def test_sync_apple_health_workout_then_idempotent_upsert(auth_headers):
    external_id = f"hk-test-{uuid.uuid4().hex[:8]}"
    workout = {
        "external_id": external_id,
        "source": "apple_health",
        "started_at": "2026-01-05T09:15:00Z",
        "ended_at": "2026-01-05T10:00:00Z",
        "duration_s": 2700,
        "distance_m": 7500.0,
        "calories_kcal": 520.0,
        "avg_hr_bpm": 152.0,
        "max_hr_bpm": 178.0,
    }
    r = requests.post(f"{API}/health/workouts", json={"workouts": [workout]}, headers=auth_headers, timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert body["synced"] == 1

    # Re-post the exact same workout: still synced=1 (upsert)
    r2 = requests.post(f"{API}/health/workouts", json={"workouts": [workout]}, headers=auth_headers, timeout=20)
    assert r2.status_code == 200
    assert r2.json()["synced"] == 1

    # GET list: exactly ONE entry with our external_id (no duplicate)
    lr = requests.get(f"{API}/health/workouts", headers=auth_headers, timeout=15)
    assert lr.status_code == 200
    workouts = lr.json()["workouts"]
    matching = [w for w in workouts if w["external_id"] == external_id]
    assert len(matching) == 1, f"expected 1 upserted workout, got {len(matching)}"
    m = matching[0]
    assert m["source"] == "apple_health"
    assert m["distance_m"] == 7500.0
    assert m["duration_s"] == 2700
    assert m["avg_hr_bpm"] == 152.0
    assert m["max_hr_bpm"] == 178.0


# ---------- unsupported source ignored ----------
def test_fitbit_source_ignored(auth_headers):
    workout = {
        "external_id": f"fitbit-test-{uuid.uuid4().hex[:8]}",
        "source": "fitbit",
        "started_at": "2026-01-05T09:15:00Z",
        "duration_s": 1800,
        "distance_m": 5000.0,
    }
    r = requests.post(f"{API}/health/workouts", json={"workouts": [workout]}, headers=auth_headers, timeout=15)
    assert r.status_code == 200
    assert r.json()["synced"] == 0

    # Also make sure it's not stored
    lr = requests.get(f"{API}/health/workouts", headers=auth_headers, timeout=15)
    assert lr.status_code == 200
    assert not any(w["external_id"] == workout["external_id"] for w in lr.json()["workouts"])


# ---------- sorted desc by started_at ----------
def test_list_sorted_by_started_at_desc(auth_headers):
    older = {
        "external_id": f"hk-old-{uuid.uuid4().hex[:6]}",
        "source": "apple_health",
        "started_at": "2025-12-01T07:00:00Z",
        "duration_s": 1800,
        "distance_m": 5000.0,
        "calories_kcal": 300.0,
    }
    newer = {
        "external_id": f"hk-new-{uuid.uuid4().hex[:6]}",
        "source": "apple_health",
        "started_at": "2026-01-08T07:00:00Z",
        "duration_s": 2400,
        "distance_m": 6000.0,
        "calories_kcal": 400.0,
    }
    r = requests.post(f"{API}/health/workouts", json={"workouts": [older, newer]}, headers=auth_headers, timeout=20)
    assert r.status_code == 200
    assert r.json()["synced"] == 2

    lr = requests.get(f"{API}/health/workouts", headers=auth_headers, timeout=15)
    assert lr.status_code == 200
    items = lr.json()["workouts"]
    starts = [w["started_at"] for w in items]
    assert starts == sorted(starts, reverse=True), "workouts must be sorted by started_at desc"

    # confirm newer appears before older among our test rows
    idx_new = next(i for i, w in enumerate(items) if w["external_id"] == newer["external_id"])
    idx_old = next(i for i, w in enumerate(items) if w["external_id"] == older["external_id"])
    assert idx_new < idx_old
