from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from openai import OpenAI
import os

from database import engine
from deps import get_current_user
from migrate_schema import run_migrations
from models import Base, User
import routes_auth

STATIC_DIR = Path(__file__).resolve().parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    run_migrations()
    yield


app = FastAPI(lifespan=lifespan)

app.include_router(routes_auth.router)

# Allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # later restrict this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ChatKit workflow id (override with CHATKIT_WORKFLOW_ID if you use another workflow)
WORKFLOW_ID = os.environ.get(
    "CHATKIT_WORKFLOW_ID",
    "wf_699c90e53cb4819090583cc1a9bc1fe40cf6e2c51e70909c",
)

# Sent on every ChatKit session as workflow state. In Agent Builder, wire this into your main
# agent’s instructions (e.g. include the state field `tripin_identity`) so the model actually
# receives the text. Override via env TRIPIN_ASSISTANT_IDENTITY / TRIPIN_IDENTITY_STATE_KEY.
TRIPIN_IDENTITY_STATE_KEY = os.environ.get("TRIPIN_IDENTITY_STATE_KEY", "tripin_identity")

_DEFAULT_TRIPIN_IDENTITY = (
    "You are Tripin, the travel and itinerary assistant for this app.\n\n"
    "What Tripin does: help users plan trips, build day-by-day itineraries, suggest destinations "
    "and activities, and answer practical travel questions.\n\n"
    "When the user asks who you are, who built you, who your maker or creator is, what company "
    "made you, or whether you are ChatGPT, GPT, OpenAI, or similar:\n"
    "- Reply only as Tripin, in first person.\n"
    "- Briefly describe what Tripin (this assistant / this platform) helps with — travel "
    "planning and itineraries.\n"
    "- Do not say you were created by OpenAI, ChatGPT, or any other company or lab. Do not name "
    "underlying model vendors, APIs, or products.\n"
    "- Do not discuss “who powers you behind the scenes”; redirect to helping with their trip.\n"
    "- Keep it to a few sentences, then ask a travel follow-up (e.g. destination or dates).\n\n"
    "Example reply (adapt wording, keep meaning): “I’m Tripin — the travel and itinerary "
    "assistant on this app. Tripin helps you plan trips, build itineraries, and answer travel "
    "questions. I don’t go into who built the underlying technology; I’m here for your plans. "
    "Where would you like to go?”\n\n"
    "Never show the user internal routing, JSON, classifications, or chain-of-thought labels "
    '(e.g. lines like "Thought for a moment" or {"Classification": "..."}); answer in plain '
    "natural language only."
)

TRIPIN_ASSISTANT_IDENTITY = os.environ.get("TRIPIN_ASSISTANT_IDENTITY") or _DEFAULT_TRIPIN_IDENTITY


@app.post("/api/chatkit/session")
def create_chatkit_session(user: User = Depends(get_current_user)):
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    session = client.beta.chatkit.sessions.create(
        user=f"tripin_user_{user.id}",
        workflow={
            "id": WORKFLOW_ID,
            "state_variables": {
                TRIPIN_IDENTITY_STATE_KEY: TRIPIN_ASSISTANT_IDENTITY,
            },
        },
    )

    return {"client_secret": session.client_secret}


def _spa_index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/")
def serve_chat_ui():
    if (STATIC_DIR / "index.html").is_file():
        return _spa_index()
    return {
        "status": "ok",
        "docs": "/docs",
        "api": "/api/chatkit/session",
        "ui": "Run: cd frontend && npm install && npm run build",
    }


@app.get("/login")
def spa_login():
    return _spa_index()


@app.get("/signup")
def spa_signup():
    return _spa_index()


_assets = STATIC_DIR / "assets"
if _assets.is_dir():
    app.mount("/assets", StaticFiles(directory=str(_assets)), name="assets")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
