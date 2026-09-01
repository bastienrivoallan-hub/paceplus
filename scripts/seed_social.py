import asyncio, os, uuid
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
from datetime import datetime, timezone, timedelta

async def m():
    db = AsyncIOMotorClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
    thomas = await db.users.find_one({'email': 'thomas@pace.app'})
    lea = await db.users.find_one({'email': 'lea@pace.app'})
    if not lea:
        lea = {
            'user_id': f'user_{uuid.uuid4().hex[:12]}', 'email': 'lea@pace.app', 'name': 'Léa Dupont',
            'picture': None, 'password_hash': bcrypt.hashpw(b'secret123', bcrypt.gensalt()).decode(),
            'onboarding_completed': True,
            'profile': {'goal': '10km', 'level': 'intermediaire', 'current_time': None, 'target_time': '50min', 'race_date': None, 'frequency': 3},
            'created_at': datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(lea)
        print('created lea', lea['user_id'])
    ex = await db.friendships.find_one({'$or': [
        {'requester_id': thomas['user_id'], 'addressee_id': lea['user_id']},
        {'requester_id': lea['user_id'], 'addressee_id': thomas['user_id']}]})
    if not ex:
        await db.friendships.insert_one({
            'friendship_id': f'fr_{uuid.uuid4().hex[:12]}', 'requester_id': lea['user_id'],
            'addressee_id': thomas['user_id'], 'status': 'accepted',
            'created_at': datetime.now(timezone.utc).isoformat()})
        print('friendship created (accepted)')
    n = await db.runs.count_documents({'user_id': lea['user_id']})
    if n == 0:
        now = datetime.now(timezone.utc)
        for days, dist, dur in ((0, 6200, 2100), (2, 4500, 1500), (4, 10100, 3300)):
            d = now - timedelta(days=days)
            await db.runs.insert_one({
                'run_id': f'run_{uuid.uuid4().hex[:12]}', 'user_id': lea['user_id'],
                'date': d.isoformat(), 'distance_m': dist, 'duration_s': dur,
                'avg_pace': f"{int(dur/(dist/1000)//60)}:{int(dur/(dist/1000)%60):02d}",
                'route': [], 'splits': [], 'session_id': None})
        print('3 runs seeded for lea')
    print('seed done')

asyncio.run(m())
