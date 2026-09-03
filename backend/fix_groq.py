with open("server.py", "r") as f:
    content = f.read()

content = content.replace(
    'GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]',
    'GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]\nGROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")'
)

content = content.replace(
    'self.model = "gemini/gemini-3.6-flash"',
    'self.model = "groq/llama-3.3-70b-versatile"'
)

content = content.replace(
    'response = await litellm.acompletion(\n            model=self.model,\n            api_key=GEMINI_API_KEY,',
    'response = await litellm.acompletion(\n            model=self.model,\n            api_key=GROQ_API_KEY,'
)

with open("server.py", "w") as f:
    f.write(content)
print("Terminé !")
