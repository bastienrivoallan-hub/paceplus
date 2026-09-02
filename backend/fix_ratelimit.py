with open("server.py", "r") as f:
    content = f.read()

old_block = '''    async with httpx.AsyncClient(timeout=25) as hc:
        results = await asyncio.gather(
            *(ors_round_trip(hc, lat, lon, target_m, s) for s in seeds),
            return_exceptions=True,
        )'''

new_block = '''    results = []
    async with httpx.AsyncClient(timeout=25) as hc:
        for s in seeds:
            try:
                res = await ors_round_trip(hc, lat, lon, target_m, s)
                results.append(res)
            except Exception as e:
                results.append(e)
            await asyncio.sleep(1.1)'''

if old_block not in content:
    print("ATTENTION: bloc d'origine non trouvé.")
else:
    content = content.replace(old_block, new_block)
    with open("server.py", "w") as f:
        f.write(content)
    print("Terminé !")
