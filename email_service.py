"""Send transactional email via SMTP. Set SMTP_* env vars on Railway to enable."""

from __future__ import annotations

import logging
import os
import smtplib
import ssl
from email.message import EmailMessage

logger = logging.getLogger(__name__)


def send_signup_confirmation(to_email: str, first_name: str = "") -> None:
    """
    Sends a welcome / confirmation email after sign-up.
    If SMTP_HOST is not set, skips sending (sign-up still succeeds).
    """
    host = os.environ.get("SMTP_HOST", "").strip()
    if not host:
        logger.info("SMTP_HOST not set; skipping confirmation email for %s", to_email)
        return

    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ.get("SMTP_USER", "").strip()
    password = os.environ.get("SMTP_PASSWORD", "").strip()
    from_addr = os.environ.get("EMAIL_FROM", user or "noreply@example.com").strip()

    hi = f"Hi {first_name}," if first_name.strip() else "Hi,"
    subject = "Welcome to TRIPIN. You’re signed up"
    text = (
        f"{hi}\n\n"
        f"Thanks for creating a TRIPIN account ({to_email}).\n\n"
        f"Log in on the app with your email and password.\n\n"
        f"TRIPIN (your travel & itinerary agent)\n"
    )
    html = (
        f"<p>{hi}</p>"
        f"<p>Thanks for creating a <strong>TRIPIN</strong> account "
        f"(<strong>{to_email}</strong>).</p>"
        f"<p><strong>Log in</strong> on the app with your email and password.</p>"
        f"<p>TRIPIN (your travel &amp; itinerary agent)</p>"
    )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_email
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    try:
        if port == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, context=context) as server:
                if user and password:
                    server.login(user, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=30) as server:
                server.ehlo()
                context = ssl.create_default_context()
                server.starttls(context=context)
                server.ehlo()
                if user and password:
                    server.login(user, password)
                server.send_message(msg)
        logger.info("Sent signup confirmation to %s", to_email)
    except Exception:
        logger.exception("Failed to send email to %s", to_email)
