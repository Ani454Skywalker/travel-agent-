"""
Tripin assistant identity + session state for ChatKit / Agent Builder.

Hosted workflows only see this text if the Agent Builder canvas references the matching
state variable(s) in an Agent node's instructions (or Start node state).
"""

from __future__ import annotations

import os

# Comma-separated keys — same identity text is sent for each (covers different Start-node names).
# If session creation fails, set TRIPIN_IDENTITY_STATE_KEYS=tripin_identity only.
DEFAULT_STATE_KEYS = "tripin_identity,system_instructions,additional_instructions"

_DEFAULT_IDENTITY = (
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
    "natural language only.\n\n"
    "If a prior workflow step produced JSON for routing (e.g. itinerary vs flights), that value "
    "must never appear in your reply to the user. Only send the final helpful travel message."
)


def tripin_assistant_identity() -> str:
    return (os.environ.get("TRIPIN_ASSISTANT_IDENTITY") or _DEFAULT_IDENTITY).strip()


def tripin_identity_state_keys() -> tuple[str, ...]:
    raw = os.environ.get("TRIPIN_IDENTITY_STATE_KEYS", DEFAULT_STATE_KEYS)
    return tuple(k.strip() for k in raw.split(",") if k.strip())


def tripin_chatkit_state_variables() -> dict[str, str]:
    text = tripin_assistant_identity()
    return {k: text for k in tripin_identity_state_keys()}


def agent_builder_setup_text() -> str:
    keys = ", ".join(f"`{k}`" for k in tripin_identity_state_keys())
    return (
        "Hosted ChatKit cannot inject a hidden system prompt from FastAPI alone. Your workflow "
        "must read session state in Agent Builder.\n\n"
        "1) Open your workflow in Agent Builder.\n"
        "2) Select the Start node → add state variable(s) with these exact names (string): "
        f"{keys}\n"
        "   (They receive the same text your server sends on each session.)\n"
        "3) In your main Agent node, at the TOP of Instructions, insert the variable from the "
        "UI picker (e.g. tripin_identity), or paste a line like:\n"
        "   Always follow this policy exactly:\n"
        "   {{tripin_identity}}\n"
        "   (Syntax may differ slightly in the canvas — use the variable picker when unsure.)\n"
        "4) If you still see JSON like {\"Classification\": ...} or “Thought for a moment”, "
        "that comes from a routing / classification step: do not surface that text to the user; "
        "route silently and let only the final agent reply in plain language.\n"
        "5) “Thought for a moment” / reasoning UI: that is rendered by hosted ChatKit from the "
        "workflow’s model (reasoning summaries). In Agent Builder, open the Agent node that calls "
        "the model and disable reasoning / chain-of-thought display if the UI offers it. The Tripin "
        "web app cannot strip that text from inside the hosted iframe.\n"
    )
