"""Iteration 8 - social suite (users search, friend requests, leaderboard, feed, notifications, friend run access).

Prereqs (already seeded per iteration 8 brief):
- thomas@pace.app / secret123
- lea@pace.app / secret123  (already accepted friend of thomas, has 3 runs this week)
"""
import os
import time
import uuid

import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or "https://running-coach-app-2.preview.emergentagent.com"
).rstrip("/")


def _login(email: str, password: str) -> str:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=20,
    )
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text}"
    return r.json()["session_token"]


@pytest.fixture(scope="module")
def thomas_token():
    return _login("thomas@pace.app", "secret123")


@pytest.fixture(scope="module")
def lea_token():
    return _login("lea@pace.app", "secret123")


@pytest.fixture(scope="module")
def thomas_headers(thomas_token):
    return {"Authorization": f"Bearer {thomas_token}"}


@pytest.fixture(scope="module")
def lea_headers(lea_token):
    return {"Authorization": f"Bearer {lea_token}"}


@pytest.fixture(scope="module")
def thomas_id(thomas_headers):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=thomas_headers, timeout=15)
    assert r.status_code == 200
    return r.json()["user_id"]


@pytest.fixture(scope="module")
def lea_id(lea_headers):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=lea_headers, timeout=15)
    assert r.status_code == 200
    return r.json()["user_id"]


@pytest.fixture(scope="module")
def temp_user():
    """Register a fresh temp user for pending-request testing. No onboarding needed."""
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_temp_{suffix}@pace.app"
    payload = {"name": f"TEST Temp {suffix}", "email": email, "password": "secret123"}
    r = requests.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=20)
    assert r.status_code == 200, f"register -> {r.status_code} {r.text}"
    data = r.json()
    return {
        "token": data["session_token"],
        "user_id": data["user"]["user_id"],
        "email": email,
        "name": payload["name"],
        "headers": {"Authorization": f"Bearer {data['session_token']}"},
    }


# ------------------------- users search & existing friendship -------------------------

def test_search_lea_returns_accepted(thomas_headers, lea_id):
    r = requests.get(f"{BASE_URL}/api/users/search?q=lea", headers=thomas_headers, timeout=15)
    assert r.status_code == 200
    results = r.json()["results"]
    hit = next((u for u in results if u["user_id"] == lea_id), None)
    assert hit is not None, f"lea not found in {results}"
    assert hit["status"] == "accepted"
    assert hit["name"].lower().startswith("l")


def test_search_short_query_returns_empty(thomas_headers):
    r = requests.get(f"{BASE_URL}/api/users/search?q=l", headers=thomas_headers, timeout=15)
    assert r.status_code == 200
    assert r.json()["results"] == []


# ------------------------- friend request flow (temp user) -------------------------

def test_friend_request_accept_flow(thomas_headers, temp_user):
    # 1. thomas can find temp user via search
    r = requests.get(
        f"{BASE_URL}/api/users/search?q=TEST_temp", headers=thomas_headers, timeout=15
    )
    assert r.status_code == 200
    hits = [u for u in r.json()["results"] if u["user_id"] == temp_user["user_id"]]
    assert hits, "temp user not searchable"
    assert hits[0]["status"] == "none"

    # 2. thomas sends friend request
    r = requests.post(
        f"{BASE_URL}/api/friends/request",
        json={"user_id": temp_user["user_id"]},
        headers=thomas_headers,
        timeout=15,
    )
    assert r.status_code == 200, r.text
    friendship_id = r.json()["friendship_id"]
    assert friendship_id

    # 3. duplicate request -> 400
    r2 = requests.post(
        f"{BASE_URL}/api/friends/request",
        json={"user_id": temp_user["user_id"]},
        headers=thomas_headers,
        timeout=15,
    )
    assert r2.status_code == 400

    # 4. temp user sees pending_received
    r3 = requests.get(f"{BASE_URL}/api/friends", headers=temp_user["headers"], timeout=15)
    assert r3.status_code == 200
    pr = r3.json()["pending_received"]
    assert any(x["friendship_id"] == friendship_id for x in pr), pr

    # 5. notifications badge for temp = 1
    r4 = requests.get(f"{BASE_URL}/api/notifications", headers=temp_user["headers"], timeout=15)
    assert r4.status_code == 200
    assert r4.json()["badge"] == 1

    # 6. temp user accepts
    r5 = requests.post(
        f"{BASE_URL}/api/friends/respond",
        json={"friendship_id": friendship_id, "accept": True},
        headers=temp_user["headers"],
        timeout=15,
    )
    assert r5.status_code == 200
    assert r5.json()["status"] == "accepted"

    # 7. both see each other in friends
    r6 = requests.get(f"{BASE_URL}/api/friends", headers=thomas_headers, timeout=15)
    r7 = requests.get(f"{BASE_URL}/api/friends", headers=temp_user["headers"], timeout=15)
    assert any(f["user_id"] == temp_user["user_id"] for f in r6.json()["friends"])
    assert r7.json()["friends"], "temp user has no friends after accept"


def test_self_request_rejected(thomas_headers, thomas_id):
    r = requests.post(
        f"{BASE_URL}/api/friends/request",
        json={"user_id": thomas_id},
        headers=thomas_headers,
        timeout=15,
    )
    assert r.status_code == 400


def test_friend_request_refuse_flow(thomas_headers):
    """Register another fresh user, thomas requests, temp refuses -> friendship deleted."""
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_refuse_{suffix}@pace.app"
    reg = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"name": f"TEST Refuse {suffix}", "email": email, "password": "secret123"},
        timeout=20,
    )
    assert reg.status_code == 200
    temp = reg.json()
    temp_headers = {"Authorization": f"Bearer {temp['session_token']}"}
    temp_uid = temp["user"]["user_id"]

    r = requests.post(
        f"{BASE_URL}/api/friends/request",
        json={"user_id": temp_uid},
        headers=thomas_headers,
        timeout=15,
    )
    assert r.status_code == 200
    fid = r.json()["friendship_id"]

    r2 = requests.post(
        f"{BASE_URL}/api/friends/respond",
        json={"friendship_id": fid, "accept": False},
        headers=temp_headers,
        timeout=15,
    )
    assert r2.status_code == 200
    assert r2.json()["status"] == "refused"

    # after refuse, thomas can re-request (friendship deleted)
    r3 = requests.post(
        f"{BASE_URL}/api/friends/request",
        json={"user_id": temp_uid},
        headers=thomas_headers,
        timeout=15,
    )
    assert r3.status_code == 200, r3.text


# ------------------------- leaderboard -------------------------

def test_leaderboard_week(thomas_headers, thomas_id, lea_id):
    r = requests.get(f"{BASE_URL}/api/friends/leaderboard?period=week", headers=thomas_headers, timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j["period"] == "week"
    board = j["leaderboard"]
    uids = [b["user_id"] for b in board]
    assert thomas_id in uids and lea_id in uids
    kms = [b["km"] for b in board]
    assert kms == sorted(kms, reverse=True)
    me_entries = [b for b in board if b["is_me"]]
    assert len(me_entries) == 1 and me_entries[0]["user_id"] == thomas_id
    lea_entry = next(b for b in board if b["user_id"] == lea_id)
    assert lea_entry["runs"] >= 1
    assert lea_entry["km"] > 0


def test_leaderboard_month(thomas_headers):
    r = requests.get(f"{BASE_URL}/api/friends/leaderboard?period=month", headers=thomas_headers, timeout=15)
    assert r.status_code == 200
    assert r.json()["period"] == "month"


def test_leaderboard_invalid_period(thomas_headers):
    r = requests.get(f"{BASE_URL}/api/friends/leaderboard?period=year", headers=thomas_headers, timeout=15)
    assert r.status_code == 422


# ------------------------- feed -------------------------

def test_friends_feed(thomas_headers, lea_id):
    r = requests.get(f"{BASE_URL}/api/friends/feed", headers=thomas_headers, timeout=15)
    assert r.status_code == 200
    feed = r.json()["feed"]
    lea_runs = [x for x in feed if x["user_id"] == lea_id]
    assert len(lea_runs) >= 3, f"expected >=3 lea runs, got {len(lea_runs)}"
    sample = lea_runs[0]
    assert "route" not in sample, "route field should be stripped from feed"
    assert sample.get("user") and sample["user"]["user_id"] == lea_id
    assert "distance_m" in sample and "duration_s" in sample


# ------------------------- notifications badge -------------------------

def test_notifications_badge_matches_pending(thomas_headers):
    friends_resp = requests.get(f"{BASE_URL}/api/friends", headers=thomas_headers, timeout=15).json()
    notif = requests.get(f"{BASE_URL}/api/notifications", headers=thomas_headers, timeout=15).json()
    assert notif["badge"] == len(friends_resp["pending_received"])


# ------------------------- friend run access control -------------------------

def test_friend_run_access(thomas_headers, lea_headers, lea_id):
    # find a lea run via feed
    r = requests.get(f"{BASE_URL}/api/friends/feed", headers=thomas_headers, timeout=15)
    lea_run = next(x for x in r.json()["feed"] if x["user_id"] == lea_id)
    run_id = lea_run["run_id"]

    # thomas (friend) can view with owner_name + is_friend_run
    r2 = requests.get(f"{BASE_URL}/api/runs/{run_id}", headers=thomas_headers, timeout=15)
    assert r2.status_code == 200
    body = r2.json()
    assert body.get("is_friend_run") is True
    assert body.get("owner_name")

    # lea (owner) gets same run without friend-flag
    r3 = requests.get(f"{BASE_URL}/api/runs/{run_id}", headers=lea_headers, timeout=15)
    assert r3.status_code == 200
    assert not r3.json().get("is_friend_run")

    # non-friend fresh user gets 404
    suffix = uuid.uuid4().hex[:8]
    reg = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"name": f"TEST Stranger {suffix}", "email": f"TEST_stranger_{suffix}@pace.app", "password": "secret123"},
        timeout=20,
    )
    assert reg.status_code == 200
    stranger_headers = {"Authorization": f"Bearer {reg.json()['session_token']}"}
    r4 = requests.get(f"{BASE_URL}/api/runs/{run_id}", headers=stranger_headers, timeout=15)
    assert r4.status_code == 404
