with open("server.py", "r") as f:
    content = f.read()

content = content.replace(
    'ORS_API_KEY = os.environ.get("ORS_API_KEY", "")',
    'ORS_API_KEY = os.environ.get("ORS_API_KEY", "")\nGRAPHHOPPER_API_KEY = os.environ.get("GRAPHHOPPER_API_KEY", "")'
)

old_func = '''async def ors_round_trip(hc: httpx.AsyncClient, lat: float, lon: float, target_m: int, seed: int):
    body = {
        "coordinates": [[lon, lat]],  # ORS = [lon, lat]
        "instructions": False,
        "options": {"round_trip": {"length": target_m, "points": 4, "seed": seed}},
    }
    r = await hc.post(
        "https://api.openrouteservice.org/v2/directions/foot-walking/geojson",
        headers={"Authorization": ORS_API_KEY, "Content-Type": "application/json"},
        json=body,
    )
    r.raise_for_status()
    feat = r.json()["features"][0]
    geom = feat["geometry"]
    if geom.get("type") != "LineString" or len(geom.get("coordinates", [])) < 2:
        raise ValueError("invalid geometry")
    coords = geom["coordinates"]
    # Cap payload size while keeping the route shape
    stride = max(1, len(coords) // 300)
    pts = [{"latitude": c[1], "longitude": c[0]} for c in coords[::stride]]
    if pts[-1] != {"latitude": coords[-1][1], "longitude": coords[-1][0]}:
        pts.append({"latitude": coords[-1][1], "longitude": coords[-1][0]})
    summary = feat["properties"]["summary"]
    return {
        "seed": seed,
        "distance_m": float(summary["distance"]),
        "duration_s": float(summary["duration"]),
        "coords": pts,
    }'''

new_func = '''async def ors_round_trip(hc: httpx.AsyncClient, lat: float, lon: float, target_m: int, seed: int):
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
    }'''

if old_func not in content:
    print("ATTENTION: fonction d'origine non trouvée, rien n'a été modifié.")
else:
    content = content.replace(old_func, new_func)
    content = content.replace(
        'if not ORS_API_KEY:',
        'if not GRAPHHOPPER_API_KEY:'
    )
    with open("server.py", "w") as f:
        f.write(content)
    print("Terminé !")
