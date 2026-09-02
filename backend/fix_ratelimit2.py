with open("server.py", "r") as f:
    content = f.read()

old = "seeds = random.sample(range(1, 100000), 5)"
new = "seeds = random.sample(range(1, 100000), 3)"
if old in content:
    content = content.replace(old, new)
    print("Nombre de tentatives réduit à 3.")
else:
    print("ATTENTION: ligne 'seeds' non trouvée.")

old2 = "await asyncio.sleep(1.1)"
new2 = "await asyncio.sleep(2.5)"
if old2 in content:
    content = content.replace(old2, new2)
    print("Délai augmenté à 2.5s.")
else:
    print("ATTENTION: ligne 'sleep' non trouvée.")

with open("server.py", "w") as f:
    f.write(content)
