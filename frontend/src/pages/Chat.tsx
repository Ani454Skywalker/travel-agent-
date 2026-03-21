import { useCallback, useState } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import { useAuth } from "../auth";

export default function Chat() {
  const { token, email, logout } = useAuth();
  const [kitError, setKitError] = useState<string | null>(null);

  const getClientSecret = useCallback(
    (_existing: string | null) => {
      setKitError(null);
      if (!token) {
        return Promise.reject(new Error("Not signed in"));
      }
      return fetch("/api/chatkit/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }).then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Session failed: ${res.status}`);
        }
        const data = (await res.json()) as { client_secret: string };
        return data.client_secret;
      });
    },
    [token],
  );

  const { control } = useChatKit({
    api: {
      getClientSecret,
    },
    theme: "dark",
    composer: {
      attachments: { enabled: false },
    },
    onError: ({ error }) => {
      const msg = error?.message ?? String(error);
      setKitError(msg);
      console.error("ChatKit error:", error);
    },
  });

  return (
    <div className="app-shell">
      <header className="app-top">
        <div className="app-top-inner">
          <div>
            <p className="auth-brand app-top-brand">tRipin</p>
            <h1>Your travel &amp; itinerary agent</h1>
            <p className="app-top-tagline">
              Plan routes, days, and ideas — <strong>tRipin</strong> works as both an{" "}
              <strong>itinerary agent</strong> and a <strong>travel agent</strong> for you.
            </p>
          </div>
          <div className="app-top-actions">
            {email ? (
              <span className="user-email" title={email}>
                {email}
              </span>
            ) : null}
            <button type="button" className="btn-ghost" onClick={() => logout()}>
              Log out
            </button>
            <a href="/docs" className="btn-ghost" target="_blank" rel="noreferrer">
              API docs
            </a>
          </div>
        </div>
      </header>
      <p className="app-intro">
        Ask about trips, flights, packing, day-by-day plans, and destinations. Your
        conversations are tied to your account.
      </p>
      {kitError ? <div className="kit-error">{kitError}</div> : null}
      <div className="chat-frame">
        <ChatKit control={control} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}
