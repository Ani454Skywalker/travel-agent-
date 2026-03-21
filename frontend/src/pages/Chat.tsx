import { useCallback, useMemo, useState } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import { useAuth } from "../auth";

function displayFirstName(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default function Chat() {
  const { token, firstName, logout } = useAuth();

  const greeting = useMemo(() => {
    const name = displayFirstName(firstName);
    if (name) {
      return `Hello ${name}, how can I help you today?`;
    }
    return "Hello, how can I help you today?";
  }, [firstName]);
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
      <header className="tripin-header">
        <div className="tripin-header-row">
          <div>
            <p className="tripin-wordmark">TRIPIN</p>
            <p className="tripin-tagline">Your travel and Itinerary agent</p>
          </div>
          <button type="button" className="btn-logout-minimal" onClick={() => logout()}>
            Log out
          </button>
        </div>
      </header>

      <p className="tripin-greeting">{greeting}</p>

      {kitError ? <div className="kit-error">{kitError}</div> : null}
      <div className="chat-frame">
        <ChatKit control={control} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}
