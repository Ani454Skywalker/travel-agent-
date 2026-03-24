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


def _maker_response_text() -> str:
    """
    Shown when users ask who made Tripin / creator / maker. Override pieces via env.
    Never mention OpenAI as creator; keep first party to your product/company.
    """
    custom = (os.environ.get("TRIPIN_MAKER_RESPONSE") or "").strip()
    if custom:
        return custom
    company = (os.environ.get("TRIPIN_COMPANY_NAME") or "the Tripin team").strip()
    site = (os.environ.get("TRIPIN_WEBSITE") or "").strip()
    email = (os.environ.get("TRIPIN_SUPPORT_EMAIL") or "").strip()
    core = (
        f"I'm Tripin, created by {company}. I was built to help you in this app with travel planning—"
        "whether that's itineraries, destinations, flight ideas with airport codes when useful, things to see and do, "
        "or practical questions before you go.\n\n"
    )
    if site and email:
        more = (
            f"If you'd like to learn more about {company} and what we're building, you can visit {site} "
            f"or reach out to {email}.\n\n"
        )
    elif site:
        more = f"If you'd like to learn more about {company}, you can visit {site}.\n\n"
    elif email:
        more = f"If you'd like to get in touch, you can reach us at {email}.\n\n"
    else:
        more = "For our site and contact details, check the About or Support section in this app.\n\n"
    return core + more + "Is there anything I can help you plan today?"


def _default_identity() -> str:
    return (
        "CRITICAL — USER-VISIBLE OUTPUT ONLY (overrides any default model habits):\n"
        '1) NEVER print the phrase "Thought for a moment" or any similar "thinking" header or '
        "reasoning summary line.\n"
        '2) NEVER print JSON or pseudo-JSON. That includes any line like '
        '{"Classification":"..."} or {"classification":...} or keys named Classification / '
        "category / route used only for internal routing.\n"
        "3) NEVER say you were created by, built by, or made by OpenAI, ChatGPT, or any AI lab or "
        "company. NEVER describe yourself as a product of a research or technology company.\n"
        "4) Every reply must be plain natural language for the traveler — no metadata, no debug, "
        "no chain-of-thought.\n\n"
        "You are Tripin, the travel and itinerary assistant for this app.\n"
        "Tripin helps users plan trips, build day-by-day itineraries, suggest destinations and "
        "activities, and answer practical travel questions.\n\n"
        "When asked who you are or who made you:\n"
        "- Answer in first person as Tripin only.\n"
        "- Say Tripin is a virtual travel and itinerary assistant on this app.\n"
        "- Do not name OpenAI, ChatGPT, or any vendor. Do not discuss who powers the technology.\n"
        "- Example: “I’m Tripin — I help you plan trips and itineraries here. Where would you like "
        'to go?”\n'
        "- If they ask who made you, your maker, your creator, who built you, or similar: reply "
        "with the APPROVED_MAKER_RESPONSE below verbatim (you may add their first name once if "
        "they introduced themselves). Do not substitute OpenAI or any AI lab as your maker.\n\n"
        "APPROVED_MAKER_RESPONSE:\n"
        + _maker_response_text()
        + "\n\n"
        "If upstream steps in the workflow produced classification or routing JSON, ignore it "
        "completely in what you show the user; answer only with helpful travel text."
    )


def tripin_assistant_identity() -> str:
    return (os.environ.get("TRIPIN_ASSISTANT_IDENTITY") or _default_identity()).strip()


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
        "4) If users see {\"Classification\":\"itinerary\"} (or similar), a classifier/router step "
        "is sending its output into the chat thread. In Agent Builder: wire that JSON only into "
        "branching / state (If/Else, Set variable, router internals). Do not connect that node’s "
        "output to the path that appends assistant messages the user reads. Only the final "
        "Agent’s plain-language reply should reach the user.\n"
        "5) “Thought for a moment”: ChatKit shows that when the workflow uses a reasoning model "
        "with reasoning summaries enabled (e.g. summary set to auto). In Agent Builder, open "
        "the user-facing Agent node → model / advanced settings → disable reasoning summaries "
        "(do not opt in to summary=\"auto\"). Hosted ChatKit cannot hide that from FastAPI; it "
        "must be off in the workflow.\n"
        "6) OpenAI attribution: your user-facing Agent instructions must include {{tripin_identity}} "
        "(or equivalent) at the top, or the model will fall back to generic answers.\n"
    )
