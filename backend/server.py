import os
import math
import re
import json
import uuid
import random
import asyncio
import hashlib
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta, date

import httpx
import bcrypt
from fastapi import FastAPI, APIRouter, Header, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional

import litellm

class UserMessage:
    def __init__(self, text: str):
        self.text = text

class LlmChat:
    def __init__(self, api_key: str = None, session_id: str = None, system_message: str = ""):
        self.system_message = system_message

    def with_model(self, provider: str, model: str):
        self.model = "groq/openai/gpt-oss-120b"
        return self

    async def send_message(self, user_message):
        response = await litellm.acompletion(
            model=self.model,
            api_key=GROQ_API_KEY,
            messages=[
                {"role": "system", "content": self.system_message},
                {"role": "user", "content": user_message.text},
            ],
        )
        return response.choices[0].message.content

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
EMERGENT_LLM_KEY = GEMINI_API_KEY
ORS_API_KEY = os.environ.get("ORS_API_KEY", "")
GRAPHHOPPER_API_KEY = os.environ.get("GRAPHHOPPER_API_KEY", "")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pace")

app = FastAPI(title="PACE Running Coach")
api = APIRouter()


# ----------------------------- helpers ---------------------------------------

def now_utc():
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def check_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


async def mint_session(user_id: str) -> str:
    token = f"st_{uuid.uuid4().hex}{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "created_at": now_utc().isoformat(),
        "expires_at": (now_utc() + timedelta(days=7)).isoformat(),
    })
    return token


def public_user(u: dict) -> dict:
    return {
        "user_id": u["user_id"],
        "email": u.get("email"),
        "name": u.get("name"),
        "picture": u.get("picture"),
        "onboarding_completed": u.get("onboarding_completed", False),
        "profile": u.get("profile"),
    }


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1].strip()
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=401, detail="Invalid session")
    exp = sess["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now_utc():
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ----------------------------- models -----------------------------------------

class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class SessionBody(BaseModel):
    session_id: str


class OnboardingBody(BaseModel):
    goal: str            # "5km" | "10km" | "semi" | "marathon"
    level: str           # "debutant" | "intermediaire" | "avance" | "expert"
    current_time: Optional[str] = None
    target_time: Optional[str] = None
    race_date: Optional[str] = None   # YYYY-MM-DD
    frequency: int = 4


class RunBody(BaseModel):
    distance_m: float
    duration_s: int
    route: List[dict] = []
    splits: List[dict] = []
    session_id: Optional[str] = None
    avg_pace: Optional[str] = None


class AdaptBody(BaseModel):
    week: Optional[int] = None


class RunAnalysisBody(BaseModel):
    run_id: str


class CoachBody(BaseModel):
    message: str


class RaceLocationBody(BaseModel):
    city: str
    lat: float
    lon: float


class WatchWorkoutBody(BaseModel):
    external_id: str
    source: str  # "apple_health" | "garmin"
    started_at: str
    ended_at: Optional[str] = None
    duration_s: int = 0
    distance_m: Optional[float] = None
    calories_kcal: Optional[float] = None
    avg_hr_bpm: Optional[float] = None
    max_hr_bpm: Optional[float] = None


class WatchSyncBody(BaseModel):
    workouts: List[WatchWorkoutBody] = []


class FriendRequestBody(BaseModel):
    user_id: str


class FriendRespondBody(BaseModel):
    friendship_id: str
    accept: bool


# ----------------------------- auth -------------------------------------------

@api.get("/")
async def root():
    return {"message": "PACE API"}


@api.post("/auth/register")
async def register(body: RegisterBody):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    user = {
        "user_id": new_id("user"),
        "email": body.email.lower(),
        "name": body.name,
        "picture": None,
        "password_hash": hash_pw(body.password),
        "onboarding_completed": False,
        "profile": None,
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(user)
    token = await mint_session(user["user_id"])
    return {"session_token": token, "user": public_user(user)}


@api.post("/auth/login")
async def login(body: LoginBody):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not user.get("password_hash") or not check_pw(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    token = await mint_session(user["user_id"])
    return {"session_token": token, "user": public_user(user)}


@api.post("/auth/session")
async def google_session(body: SessionBody):
    async with httpx.AsyncClient(timeout=20) as hc:
        r = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": body.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Session Google invalide")
    data = r.json()
    email = data.get("email", "").lower()
    user = await db.users.find_one({"email": email})
    if not user:
        user = {
            "user_id": new_id("user"),
            "email": email,
            "name": data.get("name"),
            "picture": data.get("picture"),
            "password_hash": None,
            "onboarding_completed": False,
            "profile": None,
            "created_at": now_utc().isoformat(),
        }
        await db.users.insert_one(user)
    token = await mint_session(user["user_id"])
    return {"session_token": token, "user": public_user(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@api.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ----------------------------- onboarding + plan ------------------------------

@api.put("/profile/onboarding")
async def save_onboarding(body: OnboardingBody, user: dict = Depends(get_current_user)):
    profile = body.model_dump()
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"profile": profile, "onboarding_completed": True}},
    )
    return {"ok": True, "profile": profile}


GOAL_LABELS = {"5km": "5 km", "10km": "10 km", "semi": "Semi-marathon", "marathon": "Marathon"}
LEVEL_LABELS = {"debutant": "Débutant", "intermediaire": "Intermédiaire", "avance": "Avancé", "expert": "Expert"}


def compute_weeks(race_date: Optional[str]) -> int:
    if not race_date:
        return 12
    try:
        rd = datetime.strptime(race_date, "%Y-%m-%d").date()
        weeks = max(4, min(16, round((rd - date.today()).days / 7)))
        return int(weeks)
    except Exception:
        return 12


def parse_json_block(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        text = text[start:end + 1]
    return json.loads(text)


@api.post("/plan/generate")
async def generate_plan(user: dict = Depends(get_current_user)):
    profile = user.get("profile")
    if not profile:
        raise HTTPException(status_code=400, detail="Profil d'entraînement manquant")

    total_weeks = compute_weeks(profile.get("race_date"))
    goal = GOAL_LABELS.get(profile["goal"], profile["goal"])
    level = LEVEL_LABELS.get(profile["level"], profile["level"])
    freq = int(profile.get("frequency", 4))

    system = (
        "Tu es un coach de course à pied expert et bienveillant. "
        "Tu construis des plans d'entraînement personnalisés, progressifs et sûrs. "
        "Tu réponds UNIQUEMENT avec du JSON valide, sans texte autour."
    )
    prompt = f"""Crée un plan d'entraînement course à pied.

Objectif: {goal}
Niveau: {level}
Chrono actuel: {profile.get('current_time') or 'non renseigné'}
Objectif chrono: {profile.get('target_time') or 'non renseigné'}
Date de course: {profile.get('race_date') or 'non renseignée'}
Séances par semaine: {freq}
Nombre de semaines: {total_weeks}

Règles:
- Chaque semaine a exactement 7 jours (index 0=Lundi ... 6=Dimanche).
- Environ {freq} séances de course par semaine, le reste en "rest".
- Varie les types: "easy" (footing facile), "intervals" (VMA), "threshold" (seuil), "tempo", "long" (sortie longue), "recovery", "rest".
- Progression logique, semaine d'affutage avant la course, derniere seance = "race" le jour de course si possible.
- "duration_min" en minutes (0 pour rest). "subtitle" court (ex: "6 x 1000 m", "45 min", "1h15").
- "intensity" parmi: "Faible", "Moderee", "Elevee". "objective" court (ex: "VMA", "Endurance", "Seuil", "Recuperation", "-").

Reponds STRICTEMENT avec ce JSON:
{{
  "summary": "phrase de motivation courte",
  "weeks": [
    {{
      "week": 1,
      "focus": "titre court de la semaine",
      "days": [
        {{"day_index":0,"type":"easy","title":"Footing facile","subtitle":"45 min","duration_min":45,"intensity":"Moderee","objective":"Endurance"}}
      ]
    }}
  ]
}}
Genere les {total_weeks} semaines completes."""

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"plan_{user['user_id']}_{uuid.uuid4().hex[:6]}",
        system_message=system,
    ).with_model("anthropic", "claude-sonnet-5")

    try:
        raw = await chat.send_message(UserMessage(text=prompt))
        data = parse_json_block(raw)
    except Exception as e:
        logger.exception("plan generation failed")
        raise HTTPException(status_code=502, detail="Génération du plan échouée. Réessaie dans un instant.")

    plan_id = new_id("plan")
    await db.plans.update_many({"user_id": user["user_id"]}, {"$set": {"active": False}})
    await db.sessions.delete_many({"user_id": user["user_id"]})

    plan_doc = {
        "plan_id": plan_id,
        "user_id": user["user_id"],
        "goal": profile["goal"],
        "goal_label": goal,
        "level": profile["level"],
        "target_time": profile.get("target_time"),
        "race_date": profile.get("race_date"),
        "frequency": freq,
        "total_weeks": total_weeks,
        "summary": data.get("summary", ""),
        "active": True,
        "start_date": date.today().isoformat(),
        "created_at": now_utc().isoformat(),
    }
    await db.plans.insert_one(plan_doc)

    start = date.today()
    monday = start - timedelta(days=start.weekday())
    session_docs = []
    for wk in data.get("weeks", []):
        wnum = int(wk.get("week", 1))
        for d in wk.get("days", []):
            di = int(d.get("day_index", 0))
            sdate = monday + timedelta(weeks=wnum - 1, days=di)
            stype = d.get("type", "rest")
            session_docs.append({
                "session_id": new_id("sess"),
                "user_id": user["user_id"],
                "plan_id": plan_id,
                "week": wnum,
                "day_index": di,
                "date": sdate.isoformat(),
                "week_focus": wk.get("focus", ""),
                "type": stype,
                "title": d.get("title", "Repos" if stype == "rest" else "Seance"),
                "subtitle": d.get("subtitle", ""),
                "duration_min": int(d.get("duration_min", 0) or 0),
                "intensity": d.get("intensity", "-"),
                "objective": d.get("objective", "-"),
                "completed": False,
                "completed_at": None,
            })
    if session_docs:
        await db.sessions.insert_many(session_docs)

    plan_doc.pop("_id", None)
    return {"plan": plan_doc, "sessions_count": len(session_docs)}


@api.post("/plan/adapt")
async def adapt_plan(body: AdaptBody, user: dict = Depends(get_current_user)):
    plan = await db.plans.find_one({"user_id": user["user_id"], "active": True}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=400, detail="Aucun plan actif")

    start = datetime.strptime(plan["start_date"], "%Y-%m-%d").date()
    monday = start - timedelta(days=start.weekday())
    current_week = max(1, min(plan["total_weeks"], (date.today() - monday).days // 7 + 1))
    week = body.week or current_week
    week = max(1, min(plan["total_weeks"], week))

    # Analyse past performance (all run sessions before the target week)
    past = await db.sessions.find(
        {"user_id": user["user_id"], "type": {"$ne": "rest"}, "week": {"$lt": week}},
        {"_id": 0},
    ).to_list(300)
    done = [s for s in past if s.get("completed")]
    missed = [s for s in past if not s.get("completed")]
    done_types = {}
    for s in done:
        done_types[s["type"]] = done_types.get(s["type"], 0) + 1
    perf = (
        f"Séances prévues avant la semaine {week}: {len(past)}. "
        f"Réalisées: {len(done)}. Manquées: {len(missed)}. "
        f"Types réalisés: {done_types or 'aucun'}."
    )

    existing = await db.sessions.find(
        {"user_id": user["user_id"], "week": week}, {"_id": 0}
    ).sort("day_index", 1).to_list(20)
    if not existing:
        raise HTTPException(status_code=400, detail="Semaine introuvable")
    date_by_day = {s["day_index"]: s["date"] for s in existing}

    goal = GOAL_LABELS.get(plan["goal"], plan["goal"])
    system = (
        "Tu es un coach running expert. Tu ADAPTES une semaine d'entraînement en fonction "
        "de l'assiduité récente du coureur. Réponds UNIQUEMENT en JSON valide."
    )
    prompt = f"""Objectif: {goal}. Niveau: {LEVEL_LABELS.get(plan['level'], plan['level'])}.
Semaine à adapter: {week} sur {plan['total_weeks']}.
Bilan récent: {perf}

Consignes d'adaptation:
- Si beaucoup de séances ont été manquées, allège la charge et ajoute de la récupération.
- Si l'assiduité est bonne, maintiens une progression normale.
- Garde exactement 7 jours (day_index 0=Lundi..6=Dimanche), ~{plan['frequency']} séances de course.
- Types: "easy","intervals","threshold","tempo","long","recovery","rest".

Réponds STRICTEMENT en JSON:
{{
  "coach_note": "1-2 phrases expliquant l'adaptation au coureur",
  "days": [
    {{"day_index":0,"type":"rest","title":"Repos","subtitle":"-","duration_min":0,"intensity":"Faible","objective":"-"}}
  ]
}}"""

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"adapt_{user['user_id']}_{uuid.uuid4().hex[:6]}",
        system_message=system,
    ).with_model("anthropic", "claude-sonnet-5")
    try:
        raw = await chat.send_message(UserMessage(text=prompt))
        data = parse_json_block(raw)
    except Exception as e:
        logger.exception("adapt failed")
        raise HTTPException(status_code=502, detail="Adaptation échouée. Réessaie dans un instant.")

    await db.sessions.delete_many({"user_id": user["user_id"], "week": week})
    new_sessions = []
    for d in data.get("days", []):
        di = int(d.get("day_index", 0))
        stype = d.get("type", "rest")
        new_sessions.append({
            "session_id": new_id("sess"),
            "user_id": user["user_id"],
            "plan_id": plan["plan_id"],
            "week": week,
            "day_index": di,
            "date": date_by_day.get(di, (monday + timedelta(weeks=week - 1, days=di)).isoformat()),
            "week_focus": plan.get("summary", ""),
            "type": stype,
            "title": d.get("title", "Repos" if stype == "rest" else "Séance"),
            "subtitle": d.get("subtitle", ""),
            "duration_min": int(d.get("duration_min", 0) or 0),
            "intensity": d.get("intensity", "-"),
            "objective": d.get("objective", "-"),
            "completed": False,
            "completed_at": None,
        })
    if new_sessions:
        await db.sessions.insert_many(new_sessions)

    note = data.get("coach_note", "Semaine ajustée.")
    await db.plans.update_one(
        {"plan_id": plan["plan_id"]},
        {"$set": {"last_adapt_note": note, "last_adapted_week": week}},
    )
    for s in new_sessions:
        s.pop("_id", None)
    return {"week": week, "coach_note": note, "sessions": new_sessions}


@api.get("/plan/active")
async def get_active_plan(user: dict = Depends(get_current_user)):
    plan = await db.plans.find_one({"user_id": user["user_id"], "active": True}, {"_id": 0})
    if not plan:
        return {"plan": None, "current_week": 1}
    start = datetime.strptime(plan["start_date"], "%Y-%m-%d").date()
    monday = start - timedelta(days=start.weekday())
    delta_weeks = (date.today() - monday).days // 7 + 1
    current_week = max(1, min(plan["total_weeks"], delta_weeks))
    return {"plan": plan, "current_week": current_week}


@api.get("/plan/week/{week}")
async def get_week(week: int, user: dict = Depends(get_current_user)):
    cur = db.sessions.find({"user_id": user["user_id"], "week": week}, {"_id": 0}).sort("day_index", 1)
    sessions = await cur.to_list(20)
    return {"week": week, "sessions": sessions}


@api.get("/sessions/{session_id}")
async def get_session(session_id: str, user: dict = Depends(get_current_user)):
    s = await db.sessions.find_one({"session_id": session_id, "user_id": user["user_id"]}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Seance introuvable")
    return s


@api.post("/sessions/{session_id}/complete")
async def complete_session(session_id: str, user: dict = Depends(get_current_user)):
    res = await db.sessions.update_one(
        {"session_id": session_id, "user_id": user["user_id"]},
        {"$set": {"completed": True, "completed_at": now_utc().isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Seance introuvable")
    return {"ok": True}


@api.post("/sessions/{session_id}/uncomplete")
async def uncomplete_session(session_id: str, user: dict = Depends(get_current_user)):
    await db.sessions.update_one(
        {"session_id": session_id, "user_id": user["user_id"]},
        {"$set": {"completed": False, "completed_at": None}},
    )
    return {"ok": True}


# ----------------------------- home / form ------------------------------------

def daily_form(user_id: str, day: str) -> dict:
    seed = int(hashlib.md5(f"{user_id}:{day}".encode()).hexdigest(), 16)
    sleep_h = 6.5 + (seed % 20) / 10.0
    hrv = 55 + (seed >> 4) % 45
    rhr = 44 + (seed >> 8) % 14
    charge = 250 + (seed >> 12) % 300
    score = int(max(35, min(98, 55 + (hrv - 55) * 0.6 + (sleep_h - 6.5) * 8 - (rhr - 44) * 0.8)))
    if score >= 80:
        label, msg = "Tres bonne forme", "Ton corps est bien recupere et pret a performer."
    elif score >= 65:
        label, msg = "Bonne forme", "Bon etat de forme, une seance de qualite est possible aujourd'hui."
    elif score >= 50:
        label, msg = "Forme correcte", "Reste a l'ecoute de ton corps, privilegie l'endurance."
    else:
        label, msg = "Fatigue", "Ton corps a besoin de recuperer, allege ta seance."
    return {
        "date": day,
        "score": score,
        "label": label,
        "message": msg,
        "sleep": f"{int(sleep_h)}h{int((sleep_h % 1) * 60):02d}",
        "sleep_status": "Bon" if sleep_h >= 7.5 else "Correct",
        "hrv": hrv,
        "hrv_status": "Bonne" if hrv >= 70 else "Normale",
        "charge": charge,
        "charge_status": "Normale" if charge < 450 else "Elevee",
        "resting_hr": rhr,
        "rhr_status": "Normale",
    }


async def compute_streak(user_id: str) -> int:
    runs = await db.runs.find({"user_id": user_id}, {"_id": 0, "date": 1}).to_list(400)
    days = set()
    for r in runs:
        try:
            days.add(datetime.fromisoformat(r["date"]).date())
        except Exception:
            pass
    sess = await db.sessions.find({"user_id": user_id, "completed": True}, {"_id": 0, "completed_at": 1}).to_list(400)
    for s in sess:
        if s.get("completed_at"):
            try:
                days.add(datetime.fromisoformat(s["completed_at"]).date())
            except Exception:
                pass
    streak = 0
    d = date.today()
    if d not in days:
        d = d - timedelta(days=1)
    while d in days:
        streak += 1
        d -= timedelta(days=1)
    return streak


@api.get("/home/today")
async def home_today(user: dict = Depends(get_current_user)):
    today = date.today().isoformat()
    form = daily_form(user["user_id"], today)
    today_session = await db.sessions.find_one(
        {"user_id": user["user_id"], "date": today}, {"_id": 0}
    )
    streak = await compute_streak(user["user_id"])
    return {
        "name": (user.get("name") or "Coureur").split(" ")[0],
        "form": form,
        "today_session": today_session,
        "streak": streak,
    }


# ----------------------------- runs / stats -----------------------------------

@api.post("/runs")
async def save_run(body: RunBody, user: dict = Depends(get_current_user)):
    run = {
        "run_id": new_id("run"),
        "user_id": user["user_id"],
        "date": now_utc().isoformat(),
        "distance_m": body.distance_m,
        "duration_s": body.duration_s,
        "avg_pace": body.avg_pace,
        "route": body.route,
        "splits": body.splits,
        "session_id": body.session_id,
        "created_at": now_utc().isoformat(),
    }
    await db.runs.insert_one(run)
    if body.session_id:
        await db.sessions.update_one(
            {"session_id": body.session_id, "user_id": user["user_id"]},
            {"$set": {"completed": True, "completed_at": now_utc().isoformat()}},
        )
    run.pop("_id", None)
    return run


@api.get("/runs")
async def list_runs(user: dict = Depends(get_current_user)):
    cur = db.runs.find({"user_id": user["user_id"]}, {"_id": 0}).sort("date", -1)
    return {"runs": await cur.to_list(100)}


@api.get("/runs/{run_id}")
async def get_run(run_id: str, user: dict = Depends(get_current_user)):
    r = await db.runs.find_one({"run_id": run_id}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Course introuvable")
    if r["user_id"] != user["user_id"]:
        friends = await accepted_friend_ids(user["user_id"])
        if r["user_id"] not in friends:
            raise HTTPException(status_code=404, detail="Course introuvable")
        owner = await db.users.find_one({"user_id": r["user_id"]}, {"_id": 0})
        r["owner_name"] = (owner or {}).get("name")
        r["is_friend_run"] = True
    return r


def _haversine_m(a: dict, b: dict) -> float:
    R = 6371000
    lat1, lon1 = math.radians(a["latitude"]), math.radians(a["longitude"])
    lat2, lon2 = math.radians(b["latitude"]), math.radians(b["longitude"])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    x = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(x))


@api.get("/runs/{run_id}/ghost")
async def run_ghost(run_id: str, user: dict = Depends(get_current_user)):
    current = await db.runs.find_one({"run_id": run_id, "user_id": user["user_id"]}, {"_id": 0})
    if not current or not current.get("route"):
        raise HTTPException(status_code=404, detail="Course introuvable")

    start = current["route"][0]
    dist_km = current["distance_m"] / 1000

    candidates = await db.runs.find(
        {"user_id": user["user_id"], "run_id": {"$ne": run_id}, "route.0": {"$exists": True}},
        {"_id": 0},
    ).sort("date", -1).to_list(200)

    best = None
    for c in candidates:
        c_start = c["route"][0]
        c_dist_km = c["distance_m"] / 1000
        if _haversine_m(start, c_start) > 120:
            continue
        if abs(c_dist_km - dist_km) / max(dist_km, 0.1) > 0.15:
            continue
        best = c
        break

    if not best:
        return {"found": False}

    delta_s = current["duration_s"] - best["duration_s"]
    return {
        "found": True,
        "previous_date": best["date"],
        "previous_duration_s": best["duration_s"],
        "previous_avg_pace": best.get("avg_pace"),
        "current_duration_s": current["duration_s"],
        "current_avg_pace": current.get("avg_pace"),
        "delta_seconds": delta_s,
        "faster": delta_s < 0,
    }


@api.get("/plan/upcoming")
async def upcoming_sessions(user: dict = Depends(get_current_user)):
    today = date.today().isoformat()
    cur = db.sessions.find(
        {"user_id": user["user_id"], "type": {"$ne": "rest"}, "date": {"$gte": today}},
        {"_id": 0},
    ).sort("date", 1)
    return {"sessions": (await cur.to_list(60))[:30]}


@api.get("/stats")
async def stats(user: dict = Depends(get_current_user)):
    runs = await db.runs.find({"user_id": user["user_id"]}, {"_id": 0}).sort("date", 1).to_list(500)
    total_distance = sum(r.get("distance_m", 0) for r in runs) / 1000.0
    total_duration = sum(r.get("duration_s", 0) for r in runs)
    total_runs = len(runs)

    weekly = {}
    for r in runs:
        try:
            d = datetime.fromisoformat(r["date"]).date()
        except Exception:
            continue
        monday = d - timedelta(days=d.weekday())
        key = monday.isoformat()
        weekly[key] = weekly.get(key, 0) + r.get("distance_m", 0) / 1000.0
    week_keys = sorted(weekly.keys())[-8:]
    weekly_series = [{"week": k, "km": round(weekly[k], 1)} for k in week_keys]

    completed = await db.sessions.count_documents({"user_id": user["user_id"], "completed": True})
    planned = await db.sessions.count_documents({"user_id": user["user_id"], "type": {"$ne": "rest"}})
    adherence = int(round(completed / planned * 100)) if planned else 0

    return {
        "total_distance_km": round(total_distance, 1),
        "total_duration_s": total_duration,
        "total_runs": total_runs,
        "weekly_series": weekly_series,
        "adherence": adherence,
        "sessions_completed": completed,
    }


# ----------------------------- coach chat -------------------------------------

@api.get("/coach/history")
async def coach_history(user: dict = Depends(get_current_user)):
    cur = db.coach_messages.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", 1)
    return {"messages": await cur.to_list(100)}


@api.post("/coach/chat")
async def coach_chat(body: CoachBody, user: dict = Depends(get_current_user)):
    profile = user.get("profile") or {}
    goal = GOAL_LABELS.get(profile.get("goal"), profile.get("goal", "course a pied"))
    level = LEVEL_LABELS.get(profile.get("level"), profile.get("level", ""))

    await db.coach_messages.insert_one({
        "user_id": user["user_id"], "role": "user",
        "content": body.message, "created_at": now_utc().isoformat(),
    })

    system = (
        f"Tu es PACE, le coach running personnel de {user.get('name','le coureur')}. "
        f"Objectif: {goal}. Niveau: {level}. "
        "Reponds en francais, de facon motivante, concise (max 6 phrases), avec des conseils concrets."
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"coach_{user['user_id']}",
        system_message=system,
    ).with_model("anthropic", "claude-sonnet-5")

    try:
        reply = await chat.send_message(UserMessage(text=body.message))
    except Exception as e:
        logger.exception("coach chat failed")
        raise HTTPException(status_code=502, detail="Le coach est momentanément indisponible. Réessaie dans un instant.")

    await db.coach_messages.insert_one({
        "user_id": user["user_id"], "role": "assistant",
        "content": reply, "created_at": now_utc().isoformat(),
    })
    return {"reply": reply}


# ----------------------------- explore ----------------------------------------

RECOMMENDED_ROUTES = [
    {"id": "r1", "name": "Boucle du Parc", "distance_km": 5.2, "elevation_m": 35, "surface": "Chemin", "difficulty": "Facile", "type": "easy", "terrain": "plat, ombragé, abrité du vent par les arbres"},
    {"id": "r2", "name": "Piste - Fractionne", "distance_km": 0.4, "elevation_m": 0, "surface": "Piste", "difficulty": "Intense", "type": "intervals", "terrain": "plat, dégagé, exposé au vent"},
    {"id": "r3", "name": "Berges du Fleuve", "distance_km": 10.0, "elevation_m": 20, "surface": "Bitume", "difficulty": "Modere", "type": "long", "terrain": "plat, très dégagé, exposé au vent"},
    {"id": "r4", "name": "Cotes du Coteau", "distance_km": 7.5, "elevation_m": 180, "surface": "Route", "difficulty": "Difficile", "type": "threshold", "terrain": "vallonné, exposé au soleil et au vent"},
    {"id": "r5", "name": "Foret - Trail doux", "distance_km": 8.3, "elevation_m": 120, "surface": "Sentier", "difficulty": "Modere", "type": "long", "terrain": "vallonné, très abrité et ombragé"},
    {"id": "r6", "name": "Tour de Ville", "distance_km": 6.0, "elevation_m": 45, "surface": "Bitume", "difficulty": "Facile", "type": "easy", "terrain": "plat, abrité entre les immeubles"},
]

# ----------------------------- weather (Open-Meteo) ---------------------------

WMO_FR = {
    0: "Ciel dégagé", 1: "Peu nuageux", 2: "Partiellement nuageux", 3: "Couvert",
    45: "Brouillard", 48: "Brouillard givrant",
    51: "Bruine légère", 53: "Bruine", 55: "Bruine dense",
    61: "Pluie faible", 63: "Pluie", 65: "Pluie forte",
    66: "Pluie verglaçante", 67: "Pluie verglaçante forte",
    71: "Neige faible", 73: "Neige", 75: "Neige forte", 77: "Grésil",
    80: "Averses", 81: "Averses", 82: "Averses violentes",
    85: "Averses de neige", 86: "Averses de neige",
    95: "Orage", 96: "Orage avec grêle", 99: "Orage violent",
}


def wmo_fr(code):
    return WMO_FR.get(int(code) if code is not None else -1, "Conditions variables")


def wmo_icon(code):
    c = int(code) if code is not None else -1
    if c == 0:
        return "sunny"
    if c in (1, 2):
        return "partly-sunny"
    if c == 3:
        return "cloudy"
    if c in (45, 48):
        return "cloud"
    if 51 <= c <= 67 or c in (80, 81, 82):
        return "rainy"
    if 71 <= c <= 77 or c in (85, 86):
        return "snow"
    if c in (95, 96, 99):
        return "thunderstorm"
    return "partly-sunny"


def weather_advice_fr(feels, wind, rain, code):
    c = int(code) if code is not None else -1
    if c in (95, 96, 99):
        return "Orage annoncé : mieux vaut reporter ou courir en salle."
    if (rain or 0) >= 70:
        return "Pluie probable : choisis un parcours abrité et des chaussures qui accrochent."
    if (wind or 0) >= 35:
        return "Vent fort : privilégie un parcours abrité et pars face au vent."
    if feels is not None and feels >= 30:
        return "Forte chaleur : raccourcis, ralentis et emporte de l'eau."
    if feels is not None and feels <= 0:
        return "Froid : échauffe-toi progressivement et couvre-toi bien."
    return "Conditions favorables pour courir. Bonne séance !"

def weather_score_from(feels, wind, rain, code):
    c = int(code) if code is not None else -1
    if c in (95, 96, 99):
        return 10

    score = 100
    if (rain or 0) >= 70:
        score -= 25
    if (wind or 0) >= 35:
        score -= 20
    if feels is not None and feels >= 30:
        score -= 20
    if feels is not None and feels <= 0:
        score -= 15
    return max(0, min(100, score))


async def fetch_weather(lat: float, lon: float, hours: int = 6):
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,precipitation,precipitation_probability,weather_code",
        "hourly": "temperature_2m,apparent_temperature,wind_speed_10m,precipitation_probability,weather_code",
        "forecast_days": 1,
        "timezone": "auto",
        "wind_speed_unit": "kmh",
    }
    async with httpx.AsyncClient(timeout=12) as hc:
        r = await hc.get("https://api.open-meteo.com/v1/forecast", params=params)
    r.raise_for_status()
    src = r.json()
    cur = src.get("current", {})
    current = {
        "temperature_c": cur.get("temperature_2m"),
        "feels_like_c": cur.get("apparent_temperature"),
        "wind_kmh": cur.get("wind_speed_10m"),
        "wind_dir_deg": cur.get("wind_direction_10m"),
        "precipitation_probability": cur.get("precipitation_probability"),
        "weather_code": cur.get("weather_code"),
        "condition": wmo_fr(cur.get("weather_code")),
        "icon": wmo_icon(cur.get("weather_code")),
    }
    h = src.get("hourly", {})
    times = h.get("time", [])
    now_iso = cur.get("time")
    start = 0
    if now_iso in times:
        start = times.index(now_iso)
    nxt = []
    for i in range(start, min(start + hours, len(times))):
        nxt.append({
            "time": times[i],
            "temperature_c": h.get("temperature_2m", [None])[i],
            "precipitation_probability": h.get("precipitation_probability", [None])[i],
            "weather_code": h.get("weather_code", [None])[i],
            "condition": wmo_fr(h.get("weather_code", [None])[i]),
            "icon": wmo_icon(h.get("weather_code", [None])[i]),
        })
    advice = weather_advice_fr(current["feels_like_c"], current["wind_kmh"],
                               current["precipitation_probability"], current["weather_code"])
    return {
        "current": current,
        "next_hours": nxt,
        "advice": advice,
        "running_score": weather_score_from(
            current["feels_like_c"], current["wind_kmh"],
            current["precipitation_probability"], current["weather_code"]
        ),
        "source": "Open-Meteo",
    }


@api.get("/weather")
async def weather(lat: float, lon: float, user: dict = Depends(get_current_user)):
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise HTTPException(status_code=422, detail="Coordonnées invalides")
    try:
        return await fetch_weather(lat, lon)
    except Exception as e:
        logger.exception("weather failed")
        raise HTTPException(status_code=502, detail="Service météo indisponible")


# ----------------------------- AI coaching (analysis / debrief / nutrition) ---

def _claude(user_id: str, tag: str, system: str) -> LlmChat:
    return LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"{tag}_{user_id}_{uuid.uuid4().hex[:6]}",
        system_message=system,
    ).with_model("anthropic", "claude-sonnet-5")


@api.post("/coach/run-analysis")
async def run_analysis(body: RunAnalysisBody, user: dict = Depends(get_current_user)):
    run = await db.runs.find_one({"run_id": body.run_id, "user_id": user["user_id"]}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="Course introuvable")
    if run.get("analysis"):
        return {"analysis": run["analysis"]}

    plan = await db.plans.find_one({"user_id": user["user_id"], "active": True}, {"_id": 0})
    splits = run.get("splits", [])
    splits_txt = ", ".join(f"km{s['km']}:{s['pace']}" for s in splits) or "non disponibles"
    prompt = f"""Analyse cette course d'un coureur (objectif: {GOAL_LABELS.get(plan.get('goal') if plan else '', 'course')}).
Distance: {round(run['distance_m']/1000,2)} km. Temps: {run['duration_s']//60} min. Allure moyenne: {run.get('avg_pace') or 'n/a'}/km.
Temps au km: {splits_txt}.
Donne un feedback en français (4-6 phrases): régularité de l'allure, points forts, un axe d'amélioration concret, et un mot d'encouragement."""

    system = "Tu es un coach running expert et bienveillant. Sois concret et motivant."
    try:
        analysis = await _claude(user["user_id"], "runan", system).send_message(UserMessage(text=prompt))
    except Exception as e:
        logger.exception("run analysis failed")
        raise HTTPException(status_code=502, detail="Le coach est momentanément indisponible. Réessaie dans un instant.")

    await db.runs.update_one({"run_id": body.run_id}, {"$set": {"analysis": analysis}})
    return {"analysis": analysis}


@api.get("/coach/weekly-debrief")
async def weekly_debrief(user: dict = Depends(get_current_user)):
    plan = await db.plans.find_one({"user_id": user["user_id"], "active": True}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=400, detail="Aucun plan actif")
    start = datetime.strptime(plan["start_date"], "%Y-%m-%d").date()
    monday = start - timedelta(days=start.weekday())
    current_week = max(1, min(plan["total_weeks"], (date.today() - monday).days // 7 + 1))
    week = max(1, current_week - 1) if current_week > 1 else 1

    cached = await db.debriefs.find_one({"user_id": user["user_id"], "plan_id": plan["plan_id"], "week": week}, {"_id": 0})
    if cached:
        return {"week": week, "debrief": cached["debrief"]}

    sessions = await db.sessions.find({"user_id": user["user_id"], "week": week, "type": {"$ne": "rest"}}, {"_id": 0}).to_list(20)
    done = [s for s in sessions if s.get("completed")]
    missed = [s for s in sessions if not s.get("completed")]
    wk_dates = [(monday + timedelta(weeks=week - 1, days=i)).isoformat() for i in range(7)]
    runs = await db.runs.find({"user_id": user["user_id"], "date": {"$regex": f"^({'|'.join(wk_dates)})"}}, {"_id": 0}).to_list(50)
    km = round(sum(r.get("distance_m", 0) for r in runs) / 1000.0, 1)

    prompt = f"""Débrief de la semaine {week} d'un plan {GOAL_LABELS.get(plan.get('goal'), 'course')}.
Séances prévues: {len(sessions)} — réalisées: {len(done)}, manquées: {len(missed)}.
Types réalisés: {[s['type'] for s in done] or 'aucun'}. Volume couru: {km} km.
Rédige un débrief en français (5-7 phrases): bilan de l'assiduité, ce qui a bien marché, ce qu'il faut ajuster, et l'objectif de la semaine suivante. Ton motivant."""
    system = "Tu es un coach running qui fait des bilans hebdomadaires clairs et encourageants."
    try:
        debrief = await _claude(user["user_id"], "debrief", system).send_message(UserMessage(text=prompt))
    except Exception as e:
        logger.exception("debrief failed")
        raise HTTPException(status_code=502, detail="Le coach est momentanément indisponible. Réessaie dans un instant.")

    await db.debriefs.insert_one({
        "user_id": user["user_id"], "plan_id": plan["plan_id"], "week": week,
        "debrief": debrief, "created_at": now_utc().isoformat(),
    })
    return {"week": week, "debrief": debrief}


@api.get("/coach/nutrition")
async def nutrition(
    session_id: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    user: dict = Depends(get_current_user),
):
    if session_id:
        session = await db.sessions.find_one({"session_id": session_id, "user_id": user["user_id"]}, {"_id": 0})
    else:
        session = await db.sessions.find_one({"user_id": user["user_id"], "date": date.today().isoformat()}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Séance introuvable")

    weather_txt = ""
    if lat is not None and lon is not None:
        try:
            w = await fetch_weather(lat, lon)
            c = w["current"]
            weather_txt = f" Météo: {c['condition']}, {c['temperature_c']}°C (ressenti {c['feels_like_c']}°C), pluie {c['precipitation_probability']}%."
        except Exception:
            weather_txt = ""

    prompt = f"""Séance du jour: {session['title']} ({session.get('subtitle') or ''}), intensité {session.get('intensity')}, durée {session.get('duration_min')} min.{weather_txt}
Donne des conseils de nutrition et d'hydratation en français, en 3 parties courtes: AVANT, PENDANT, APRÈS. Adapte à l'intensité et à la météo si fournie. Sois concret (aliments, timing, quantités approximatives)."""
    system = "Tu es un nutritionniste du sport spécialisé course à pied. Réponses concrètes et sûres."
    try:
        advice = await _claude(user["user_id"], "nutri", system).send_message(UserMessage(text=prompt))
    except Exception as e:
        logger.exception("nutrition failed")
        raise HTTPException(status_code=502, detail="Le coach est momentanément indisponible. Réessaie dans un instant.")
    return {"session_title": session["title"], "advice": advice}


# ----------------------------- geo + race weather -----------------------------

def deg_to_compass(deg) -> str:
    if deg is None:
        return "?"
    dirs = ["nord", "nord-est", "est", "sud-est", "sud", "sud-ouest", "ouest", "nord-ouest"]
    return dirs[int((float(deg) + 22.5) // 45) % 8]


@api.get("/geo/search")
async def geo_search(q: str, user: dict = Depends(get_current_user)):
    q = q.strip()
    if len(q) < 2:
        return {"results": []}
    try:
        async with httpx.AsyncClient(timeout=10) as hc:
            r = await hc.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params={"name": q, "count": 6, "language": "fr", "format": "json"},
            )
        r.raise_for_status()
        data = r.json()
    except Exception:
        logger.exception("geo search failed")
        raise HTTPException(status_code=502, detail="Recherche de ville indisponible")
    results = [
        {
            "name": it.get("name"),
            "region": it.get("admin1"),
            "country": it.get("country"),
            "lat": it.get("latitude"),
            "lon": it.get("longitude"),
        }
        for it in (data.get("results") or [])
    ]
    return {"results": results}


@api.put("/profile/race-location")
async def save_race_location(body: RaceLocationBody, user: dict = Depends(get_current_user)):
    if not (-90 <= body.lat <= 90 and -180 <= body.lon <= 180):
        raise HTTPException(status_code=422, detail="Coordonnées invalides")
    loc = {"city": body.city, "lat": body.lat, "lon": body.lon}
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"race_location": loc}})
    await db.race_alerts.delete_many({"user_id": user["user_id"]})
    return {"ok": True, "race_location": loc}


async def fetch_race_day_forecast(lat: float, lon: float, race_date: str):
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,"
                 "wind_speed_10m_max,wind_gusts_10m_max,precipitation_probability_max,weather_code",
        "forecast_days": 16,
        "timezone": "auto",
        "wind_speed_unit": "kmh",
    }
    async with httpx.AsyncClient(timeout=12) as hc:
        r = await hc.get("https://api.open-meteo.com/v1/forecast", params=params)
    r.raise_for_status()
    d = r.json().get("daily", {})
    times = d.get("time", [])
    if race_date not in times:
        return None
    i = times.index(race_date)

    def g(key):
        arr = d.get(key, [])
        return arr[i] if i < len(arr) else None

    return {
        "date": race_date,
        "temp_max_c": g("temperature_2m_max"),
        "temp_min_c": g("temperature_2m_min"),
        "feels_max_c": g("apparent_temperature_max"),
        "feels_min_c": g("apparent_temperature_min"),
        "wind_max_kmh": g("wind_speed_10m_max"),
        "gusts_kmh": g("wind_gusts_10m_max"),
        "rain_prob": g("precipitation_probability_max"),
        "weather_code": g("weather_code"),
        "condition": wmo_fr(g("weather_code")),
        "icon": wmo_icon(g("weather_code")),
    }


STORM_CODES = {95, 96, 99}
HEAVY_PRECIP_CODES = {65, 66, 67, 75, 82, 86}


def race_difficulty_flags(f: dict) -> List[str]:
    flags = []
    code = int(f.get("weather_code") if f.get("weather_code") is not None else -1)
    if code in STORM_CODES:
        flags.append("orage")
    elif code in HEAVY_PRECIP_CODES:
        flags.append("fortes précipitations")
    if (f.get("feels_max_c") or 0) >= 27:
        flags.append("chaleur")
    if f.get("feels_min_c") is not None and f["feels_min_c"] <= 0:
        flags.append("froid")
    if (f.get("wind_max_kmh") or 0) >= 30:
        flags.append("vent fort")
    if (f.get("rain_prob") or 0) >= 60 and "orage" not in flags and "fortes précipitations" not in flags:
        flags.append("pluie probable")
    return flags


@api.get("/race/weather")
async def race_weather(user: dict = Depends(get_current_user)):
    u = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    plan = await db.plans.find_one({"user_id": user["user_id"], "active": True}, {"_id": 0})
    profile = u.get("profile") or {}
    race_date = (plan or {}).get("race_date") or profile.get("race_date")
    if not race_date:
        return {"status": "no_race"}
    try:
        rd = datetime.strptime(race_date, "%Y-%m-%d").date()
    except Exception:
        return {"status": "no_race"}
    days_left = (rd - date.today()).days
    if days_left < 0:
        return {"status": "past", "race_date": race_date}

    loc = u.get("race_location")
    goal_label = GOAL_LABELS.get((plan or {}).get("goal") or profile.get("goal") or "", "ta course")
    base = {"race_date": race_date, "days_left": days_left, "goal_label": goal_label, "race_location": loc}
    if not loc:
        return {"status": "need_location", **base}
    if days_left > 15:
        return {"status": "too_far", **base}

    try:
        forecast = await fetch_race_day_forecast(loc["lat"], loc["lon"], race_date)
    except Exception:
        logger.exception("race forecast failed")
        raise HTTPException(status_code=502, detail="Service météo indisponible")
    if not forecast:
        return {"status": "too_far", **base}

    flags = race_difficulty_flags(forecast)
    status = "difficult" if flags else "ok"
    out = {"status": status, **base, "forecast": forecast, "flags": flags}

    if status == "difficult":
        today = date.today().isoformat()
        cached = await db.race_alerts.find_one(
            {"user_id": user["user_id"], "race_date": race_date, "day": today}, {"_id": 0}
        )
        if cached:
            out["strategy"] = cached["strategy"]
        else:
            target = (plan or {}).get("target_time") or profile.get("target_time")
            prompt = f"""Course {goal_label} dans {days_left} jour(s) ({race_date}) à {loc['city']}. Objectif chrono: {target or 'non renseigné'}.
Météo prévue le jour J: {forecast['condition']}, ressenti max {forecast['feels_max_c']}°C (min {forecast['feels_min_c']}°C), vent {forecast['wind_max_kmh']} km/h (rafales {forecast['gusts_kmh']} km/h), probabilité de pluie {forecast['rain_prob']}%.
Conditions difficiles détectées: {', '.join(flags)}.
Donne en français une stratégie d'allure ajustée pour le jour J (4-6 phrases): ajustement d'allure chiffré si pertinent, gestion du départ, hydratation/équipement, gestion du vent ou de la météo. Termine par un mot rassurant."""
            system = "Tu es un coach running expert en stratégie de course. Concret, précis, rassurant."
            try:
                strategy = await _claude(user["user_id"], "racewx", system).send_message(UserMessage(text=prompt))
                await db.race_alerts.insert_one({
                    "user_id": user["user_id"], "race_date": race_date, "day": today,
                    "strategy": strategy, "created_at": now_utc().isoformat(),
                })
                out["strategy"] = strategy
            except Exception:
                logger.exception("race strategy failed")
                out["strategy"] = None
    return out


# ----------------------------- AI weather route -------------------------------

@api.get("/coach/route-weather")
async def route_weather(lat: float, lon: float, user: dict = Depends(get_current_user)):
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise HTTPException(status_code=422, detail="Coordonnées invalides")

    cached = await db.route_tips.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if cached and cached.get("pos") == [round(lat, 1), round(lon, 1)]:
        try:
            age = (now_utc() - datetime.fromisoformat(cached["created_at"])).total_seconds()
        except Exception:
            age = 1e9
        if age < 3600:
            return {k: cached.get(k) for k in ("route", "reason", "wind_tip", "weather")}

    try:
        w = await fetch_weather(lat, lon)
    except Exception:
        logger.exception("route weather fetch failed")
        raise HTTPException(status_code=502, detail="Service météo indisponible")
    c = w["current"]
    wind_dir = deg_to_compass(c.get("wind_dir_deg"))

    session = await db.sessions.find_one(
        {"user_id": user["user_id"], "date": date.today().isoformat(), "type": {"$ne": "rest"}}, {"_id": 0}
    )
    session_txt = (
        f"Séance du jour: {session['title']} ({session.get('subtitle') or ''}), intensité {session.get('intensity')}."
        if session else "Pas de séance planifiée aujourd'hui (footing libre)."
    )
    catalog = "\n".join(
        f"- id={r['id']} | {r['name']} | {r['distance_km']} km | {r['elevation_m']} m D+ | {r['surface']} | {r['terrain']} | type {r['type']}"
        for r in RECOMMENDED_ROUTES
    )
    prompt = f"""Météo actuelle: {c['condition']}, {c['temperature_c']}°C (ressenti {c['feels_like_c']}°C), vent {c['wind_kmh']} km/h venant du {wind_dir}, probabilité de pluie {c['precipitation_probability']}%.
{session_txt}
Parcours disponibles:
{catalog}
Choisis LE parcours le plus adapté à cette météo et cette séance (abrité si vent/pluie, ombragé si chaleur, plat si conditions dures).
Réponds UNIQUEMENT en JSON: {{"route_id": "...", "reason": "2-3 phrases en français expliquant le choix selon la météo", "wind_tip": "1 phrase sur comment gérer le vent (le vent vient du {wind_dir})"}}"""
    system = "Tu es un coach running qui choisit des parcours selon la météo. Réponds uniquement en JSON valide."
    try:
        raw = await _claude(user["user_id"], "routewx", system).send_message(UserMessage(text=prompt))
        parsed = parse_json_block(raw)
    except Exception:
        logger.exception("route weather claude failed")
        raise HTTPException(status_code=502, detail="Le coach n'a pas pu analyser la météo")

    route = next((r for r in RECOMMENDED_ROUTES if r["id"] == parsed.get("route_id")), RECOMMENDED_ROUTES[0])
    out = {
        "route": route,
        "reason": parsed.get("reason"),
        "wind_tip": parsed.get("wind_tip"),
        "weather": {
            "condition": c["condition"],
            "temperature_c": c["temperature_c"],
            "wind_kmh": c["wind_kmh"],
            "wind_dir": wind_dir,
            "icon": c["icon"],
        },
    }
    await db.route_tips.delete_many({"user_id": user["user_id"]})
    await db.route_tips.insert_one({"user_id": user["user_id"], "pos": [round(lat, 1), round(lon, 1)], "created_at": now_utc().isoformat(), **out})
    return out


# ----------------------------- connected watches ------------------------------

@api.post("/health/workouts")
async def sync_watch_workouts(body: WatchSyncBody, user: dict = Depends(get_current_user)):
    count = 0
    for w in body.workouts[:100]:
        if w.source not in ("apple_health", "garmin"):
            continue
        doc = w.model_dump()
        doc["user_id"] = user["user_id"]
        doc["synced_at"] = now_utc().isoformat()
        await db.watch_workouts.update_one(
            {"user_id": user["user_id"], "source": w.source, "external_id": w.external_id},
            {"$set": doc},
            upsert=True,
        )
        count += 1
    return {"ok": True, "synced": count}


@api.get("/health/workouts")
async def list_watch_workouts(user: dict = Depends(get_current_user)):
    items = await db.watch_workouts.find({"user_id": user["user_id"]}, {"_id": 0}).sort("started_at", -1).to_list(30)
    return {"workouts": items}


# ----------------------------- social: friends / leaderboard / feed -----------

def user_card(u: dict) -> dict:
    return {"user_id": u["user_id"], "name": u.get("name"), "email": u.get("email"), "picture": u.get("picture")}


async def accepted_friend_ids(user_id: str) -> List[str]:
    docs = await db.friendships.find(
        {"status": "accepted", "$or": [{"requester_id": user_id}, {"addressee_id": user_id}]}, {"_id": 0}
    ).to_list(500)
    return [d["addressee_id"] if d["requester_id"] == user_id else d["requester_id"] for d in docs]


@api.get("/users/search")
async def search_users(q: str, user: dict = Depends(get_current_user)):
    q = q.strip()
    if len(q) < 2:
        return {"results": []}
    rx = {"$regex": re.escape(q), "$options": "i"}
    found = await db.users.find(
        {"user_id": {"$ne": user["user_id"]}, "$or": [{"name": rx}, {"email": rx}]}, {"_id": 0}
    ).to_list(10)
    rels = await db.friendships.find(
        {"$or": [{"requester_id": user["user_id"]}, {"addressee_id": user["user_id"]}]}, {"_id": 0}
    ).to_list(500)
    status_map = {}
    for f in rels:
        other = f["addressee_id"] if f["requester_id"] == user["user_id"] else f["requester_id"]
        if f["status"] == "accepted":
            st = "accepted"
        else:
            st = "pending_sent" if f["requester_id"] == user["user_id"] else "pending_received"
        status_map[other] = {"status": st, "friendship_id": f["friendship_id"]}
    return {"results": [
        {**user_card(u), **status_map.get(u["user_id"], {"status": "none", "friendship_id": None})}
        for u in found
    ]}


@api.post("/friends/request")
async def friend_request(body: FriendRequestBody, user: dict = Depends(get_current_user)):
    if body.user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="Impossible de s'ajouter soi-même")
    target = await db.users.find_one({"user_id": body.user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    existing = await db.friendships.find_one({"$or": [
        {"requester_id": user["user_id"], "addressee_id": body.user_id},
        {"requester_id": body.user_id, "addressee_id": user["user_id"]},
    ]})
    if existing:
        raise HTTPException(status_code=400, detail="Demande déjà existante ou déjà amis")
    doc = {
        "friendship_id": new_id("fr"),
        "requester_id": user["user_id"],
        "addressee_id": body.user_id,
        "status": "pending",
        "created_at": now_utc().isoformat(),
    }
    await db.friendships.insert_one(doc)
    return {"ok": True, "friendship_id": doc["friendship_id"]}


@api.post("/friends/respond")
async def friend_respond(body: FriendRespondBody, user: dict = Depends(get_current_user)):
    f = await db.friendships.find_one({"friendship_id": body.friendship_id}, {"_id": 0})
    if not f or f["addressee_id"] != user["user_id"] or f["status"] != "pending":
        raise HTTPException(status_code=404, detail="Demande introuvable")
    if body.accept:
        await db.friendships.update_one({"friendship_id": body.friendship_id}, {"$set": {"status": "accepted"}})
    else:
        await db.friendships.delete_one({"friendship_id": body.friendship_id})
    return {"ok": True, "status": "accepted" if body.accept else "refused"}


@api.get("/friends")
async def list_friends(user: dict = Depends(get_current_user)):
    me = user["user_id"]
    rels = await db.friendships.find({"$or": [{"requester_id": me}, {"addressee_id": me}]}, {"_id": 0}).to_list(500)
    ids = set()
    for f in rels:
        ids.add(f["requester_id"])
        ids.add(f["addressee_id"])
    users = await db.users.find({"user_id": {"$in": list(ids)}}, {"_id": 0}).to_list(500)
    umap = {u["user_id"]: user_card(u) for u in users}
    friends, pending_received, pending_sent = [], [], []
    for f in rels:
        other = f["addressee_id"] if f["requester_id"] == me else f["requester_id"]
        card = umap.get(other)
        if not card:
            continue
        entry = {**card, "friendship_id": f["friendship_id"]}
        if f["status"] == "accepted":
            friends.append(entry)
        elif f["addressee_id"] == me:
            pending_received.append(entry)
        else:
            pending_sent.append(entry)
    return {"friends": friends, "pending_received": pending_received, "pending_sent": pending_sent}


def period_start(period: str) -> str:
    today = date.today()
    if period == "month":
        return today.replace(day=1).isoformat()
    return (today - timedelta(days=today.weekday())).isoformat()


@api.get("/friends/leaderboard")
async def friends_leaderboard(period: str = "week", user: dict = Depends(get_current_user)):
    if period not in ("week", "month"):
        raise HTTPException(status_code=422, detail="period = week | month")
    me = user["user_id"]
    ids = await accepted_friend_ids(me)
    ids.append(me)
    start = period_start(period)
    runs = await db.runs.find({"user_id": {"$in": ids}, "date": {"$gte": start}}, {"_id": 0}).to_list(1000)
    agg: dict = {uid: {"km": 0.0, "runs": 0} for uid in ids}
    for r in runs:
        a = agg[r["user_id"]]
        a["km"] += r.get("distance_m", 0) / 1000.0
        a["runs"] += 1
    users = await db.users.find({"user_id": {"$in": ids}}, {"_id": 0}).to_list(500)
    umap = {u["user_id"]: user_card(u) for u in users}
    board = [
        {**umap[uid], "km": round(v["km"], 1), "runs": v["runs"], "is_me": uid == me}
        for uid, v in agg.items() if uid in umap
    ]
    board.sort(key=lambda x: (-x["km"], -x["runs"]))
    return {"period": period, "start": start, "leaderboard": board}


@api.get("/friends/feed")
async def friends_feed(user: dict = Depends(get_current_user)):
    ids = await accepted_friend_ids(user["user_id"])
    if not ids:
        return {"feed": []}
    runs = await db.runs.find({"user_id": {"$in": ids}}, {"_id": 0, "route": 0}).sort("date", -1).to_list(20)
    users = await db.users.find({"user_id": {"$in": ids}}, {"_id": 0}).to_list(500)
    umap = {u["user_id"]: user_card(u) for u in users}
    return {"feed": [{**r, "user": umap.get(r["user_id"])} for r in runs]}


@api.get("/notifications")
async def notifications(user: dict = Depends(get_current_user)):
    data = await list_friends(user)
    week_ago = (date.today() - timedelta(days=7)).isoformat()
    ids = await accepted_friend_ids(user["user_id"])
    recent = []
    if ids:
        runs = await db.runs.find(
            {"user_id": {"$in": ids}, "date": {"$gte": week_ago}}, {"_id": 0, "route": 0, "splits": 0}
        ).sort("date", -1).to_list(10)
        users = await db.users.find({"user_id": {"$in": ids}}, {"_id": 0}).to_list(500)
        umap = {u["user_id"]: user_card(u) for u in users}
        recent = [{**r, "user": umap.get(r["user_id"])} for r in runs]
    return {"requests": data["pending_received"], "recent_runs": recent, "badge": len(data["pending_received"])}


# ----------------------------- real-road circuits (OpenRouteService) ----------

CIRCUIT_STYLES = [
    {"name": "Boucle Nord", "color": "#5FD86E"},
    {"name": "Boucle Est", "color": "#5B8DEF"},
    {"name": "Boucle Ouest", "color": "#E8A13C"},
]


async def ors_round_trip(hc: httpx.AsyncClient, lat: float, lon: float, target_m: int, seed: int):
    body = {
        "points": [[lon, lat]],
        "profile": "foot",
        "algorithm": "round_trip",
        "round_trip.distance": target_m,
        "round_trip.seed": seed,
        "points_encoded": False,
        "instructions": False,
    }
    r = await hc.post(
        f"https://graphhopper.com/api/1/route?key={GRAPHHOPPER_API_KEY}",
        headers={"Content-Type": "application/json"},
        json=body,
    )
    r.raise_for_status()
    path = r.json()["paths"][0]
    coords = path["points"]["coordinates"]
    if len(coords) < 2:
        raise ValueError("invalid geometry")
    stride = max(1, len(coords) // 300)
    pts = [{"latitude": c[1], "longitude": c[0]} for c in coords[::stride]]
    if pts[-1] != {"latitude": coords[-1][1], "longitude": coords[-1][0]}:
        pts.append({"latitude": coords[-1][1], "longitude": coords[-1][0]})
    return {
        "seed": seed,
        "distance_m": float(path["distance"]),
        "duration_s": float(path["time"]) / 1000,
        "coords": pts,
    }


@api.get("/circuits")
async def real_circuits(
    lat: float,
    lon: float,
    distance_km: float = 5,
    user: dict = Depends(get_current_user),
):
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise HTTPException(status_code=422, detail="Coordonnées invalides")
    if not (1 <= distance_km <= 30):
        raise HTTPException(status_code=422, detail="Distance entre 1 et 30 km")
    if not GRAPHHOPPER_API_KEY:
        raise HTTPException(status_code=503, detail="Service de circuits non configuré")

    target_m = int(distance_km * 1000)
    random.seed(int(lat * 1000 + lon * 1000 + target_m))
    seeds = random.sample(range(1, 100000), 3)
    results = []
    async with httpx.AsyncClient(timeout=25) as hc:
        for s in seeds:
            try:
                res = await ors_round_trip(hc, lat, lon, target_m, s)
                results.append(res)
            except Exception as e:
                results.append(e)
            await asyncio.sleep(2.5)

    ok = [r for r in results if not isinstance(r, Exception)]
    for r in results:
        if isinstance(r, Exception):
            logger.warning("ORS circuit failed: %s", r)
    # Keep the routes closest to the requested distance, drop extreme outliers
    ok = [r for r in ok if target_m * 0.4 <= r["distance_m"] <= target_m * 2.2]
    ok.sort(key=lambda r: abs(r["distance_m"] - target_m))
    circuits = []
    for i, res in enumerate(ok[:3]):
        style = CIRCUIT_STYLES[i % len(CIRCUIT_STYLES)]
        km = res["distance_m"] / 1000
        circuits.append({
            "id": f"ors{i}",
            "name": style["name"],
            "color": style["color"],
            "distance_km": round(km, 1),
            "duration_min": round(km * 6),  # running estimate at 6:00/km
            "seed": res["seed"],
            "coords": res["coords"],
            "source": "openrouteservice",
        })
    if not circuits:
        raise HTTPException(status_code=502, detail="Impossible de générer des circuits ici. Réessaie.")
    return {"circuits": circuits}


# ----------------------------- startup ----------------------------------------

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.sessions.create_index([("user_id", 1), ("week", 1)])
    await db.runs.create_index([("user_id", 1), ("date", -1)])
    await db.watch_workouts.create_index([("user_id", 1), ("source", 1), ("external_id", 1)], unique=True)
    await db.friendships.create_index([("requester_id", 1), ("addressee_id", 1)], unique=True)
    logger.info("PACE API started")


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
