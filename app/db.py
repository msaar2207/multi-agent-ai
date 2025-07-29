from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

client = AsyncIOMotorClient(settings.MONGODB_URI)
db = client.quran_rag_ai

# ✅ Expose collections
users = db["users"]
chats = db["chats"]
documents = db["documents"]
assistants = db["assistants"]
verses = db["verses"]
surahs = db["surahs"]
usage = db["usage"]