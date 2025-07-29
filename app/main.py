from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.utils.start_scheduler import start_scheduler
from app.routes import admin, admin_stats, auth, billing, chat, document, assistant, organization, organization_quota, quran, seed, usage, questionnaire
from app.utils.logger import logger  # ✅ import logger

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","http://localhost:3005", "http://gaztec.ddns.net:57003", "http://192.168.1.149:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(document.router)
app.include_router(assistant.router)
app.include_router(usage.router)
app.include_router(admin.router)
app.include_router(admin_stats.router)
app.include_router(quran.router)
app.include_router(billing.router)
app.include_router(organization.router)
app.include_router(organization_quota.router)
app.include_router(seed.router)
app.include_router(questionnaire.router)




logger.info("✅ GEMAI RAG API started")

@app.on_event("startup")
async def startup_event():
    start_scheduler()
    
@app.get("/")
async def root():
    return {"message": "GEMAI RAG backend running"}
