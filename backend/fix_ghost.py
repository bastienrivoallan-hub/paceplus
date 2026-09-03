with open("server.py", "r") as f:
    content = f.read()

old = '@api.get("/plan/upcoming")'

new = '''def _haversine_m(a: dict, b: dict) -> float:
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


@api.get("/plan/upcoming")'''

if old not in content:
    print("ATTENTION: point d'ancrage non trouve.")
else:
    content = content.replace(old, new, 1)
    if "import math" not in content:
        content = content.replace("import os\n", "import os\nimport math\n", 1)
    with open("server.py", "w") as f:
        f.write(content)
    print("Termine !")
