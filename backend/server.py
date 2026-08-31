import os
import re
import json
import uuid
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

from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]
EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pace")

app = FastAPI(title="PACE Running Coach")
api = APIRouter(prefix="/api")


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
    session_id: Optional[str] = None
    avg_pace: Optional[str] = None


class CoachBody(BaseModel):
    message: str


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
        raise HTTPException(status_code=502, detail=f"Generation du plan echouee: {e}")

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
        raise HTTPException(status_code=502, detail=f"Adaptation échouée: {e}")

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
    r = await db.runs.find_one({"run_id": run_id, "user_id": user["user_id"]}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Course introuvable")
    return r


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
        raise HTTPException(status_code=502, detail=str(e))

    await db.coach_messages.insert_one({
        "user_id": user["user_id"], "role": "assistant",
        "content": reply, "created_at": now_utc().isoformat(),
    })
    return {"reply": reply}


# ----------------------------- explore ----------------------------------------

RECOMMENDED_ROUTES = [
    {"id": "r1", "name": "Boucle du Parc", "distance_km": 5.2, "elevation_m": 35, "surface": "Chemin", "difficulty": "Facile", "type": "easy"},
    {"id": "r2", "name": "Piste - Fractionne", "distance_km": 0.4, "elevation_m": 0, "surface": "Piste", "difficulty": "Intense", "type": "intervals"},
    {"id": "r3", "name": "Berges du Fleuve", "distance_km": 10.0, "elevation_m": 20, "surface": "Bitume", "difficulty": "Modere", "type": "long"},
    {"id": "r4", "name": "Cotes du Coteau", "distance_km": 7.5, "elevation_m": 180, "surface": "Route", "difficulty": "Difficile", "type": "threshold"},
    {"id": "r5", "name": "Foret - Trail doux", "distance_km": 8.3, "elevation_m": 120, "surface": "Sentier", "difficulty": "Modere", "type": "long"},
    {"id": "r6", "name": "Tour de Ville", "distance_km": 6.0, "elevation_m": 45, "surface": "Bitume", "difficulty": "Facile", "type": "easy"},
]


@api.get("/routes")
async def routes(user: dict = Depends(get_current_user)):
    return {"routes": RECOMMENDED_ROUTES}


# ----------------------------- startup ----------------------------------------

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.sessions.create_index([("user_id", 1), ("week", 1)])
    await db.runs.create_index([("user_id", 1), ("date", -1)])
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
