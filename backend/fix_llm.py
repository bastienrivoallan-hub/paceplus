with open("server.py", "r") as f:
    content = f.read()

content = content.replace(
    'from emergentintegrations.llm.chat import LlmChat, UserMessage',
    '''import litellm

class UserMessage:
    def __init__(self, text: str):
        self.text = text

class LlmChat:
    def __init__(self, api_key: str = None, session_id: str = None, system_message: str = ""):
        self.system_message = system_message

    def with_model(self, provider: str, model: str):
        self.model = "gemini/gemini-2.0-flash"
        return self

    async def send_message(self, user_message):
        response = await litellm.acompletion(
            model=self.model,
            api_key=GEMINI_API_KEY,
            messages=[
                {"role": "system", "content": self.system_message},
                {"role": "user", "content": user_message.text},
            ],
        )
        return response.choices[0].message.content'''
)

content = content.replace(
    'EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]',
    'GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]\nEMERGENT_LLM_KEY = GEMINI_API_KEY'
)

with open("server.py", "w") as f:
    f.write(content)

print("Terminé !")
