from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
import os

app = FastAPI()

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
def create_chatkit_session():
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    session = client.beta.chatkit.sessions.create(
        user="test-user-1",
        workflow={"id": WORKFLOW_ID},
    )

    return {"client_secret": session.client_secret}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)