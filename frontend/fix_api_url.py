with open("src/api.ts", "r") as f:
    content = f.read()

old = """const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost;
const IP = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';

export const API_URL = `http://${IP}:8000`;"""

new = """export const API_URL = 'https://paceplus.onrender.com';"""

if old not in content:
    print("ATTENTION: bloc non trouvé.")
else:
    content = content.replace(old, new)
    with open("src/api.ts", "w") as f:
        f.write(content)
    print("Terminé !")
