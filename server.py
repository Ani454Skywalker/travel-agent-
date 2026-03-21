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
from models import Base, User
import routes_auth

STATIC_DIR = Path(__file__).resolve().parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
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


@app.post("/api/chatkit/session")
def create_chatkit_session(user: User = Depends(get_current_user)):
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    session = client.beta.chatkit.sessions.create(
        user=f"tripin_user_{user.id}",
        workflow={"id": WORKFLOW_ID},
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
