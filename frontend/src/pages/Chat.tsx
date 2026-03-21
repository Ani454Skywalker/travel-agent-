import { useCallback, useMemo, useState } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import { useAuth } from "../auth";

/** Matches chat shell in `index.css` (dark gray, not pure black). */
const CHAT_SURFACE = "#17171a";
const CHAT_COMPOSER_PLACEHOLDER =
  "Chat, plan your next trip — ideas, dates, destinations…";

function displayFirstName(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default function Chat() {
  const { token, firstName, logout } = useAuth();

  /** ChatKit start screen (replaces default “What can I help with today?”). */
  const startGreeting = useMemo(() => {
    const name = displayFirstName(firstName);
    if (name) {
      return `What can I help you with today, ${name}?`;
    }
    return "What can I help you with today?";
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
    theme: {
      colorScheme: "dark",
      radius: "round",
      density: "normal",
      color: {
        surface: {
          background: CHAT_SURFACE,
          foreground: "#f4f4f5",
        },
        accent: {
          primary: "#c4c4cc",
          level: 2,
        },
        grayscale: {
          hue: 235,
          tint: 3,
          shade: 1,
        },
      },
    },
    startScreen: {
      greeting: startGreeting,
    },
    composer: {
      attachments: { enabled: false },
      placeholder: CHAT_COMPOSER_PLACEHOLDER,
    },
    onError: ({ error }) => {
      const msg = error?.message ?? String(error);
      setKitError(msg);
      console.error("ChatKit error:", error);
    },
  });

  return (
    <div className="app-shell app-shell--chat">
      <div className="chat-shell">
        <header className="tripin-header tripin-header--in-chat">
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

        {kitError ? <div className="kit-error kit-error--in-chat">{kitError}</div> : null}
        <div className="chat-frame">
          <ChatKit control={control} style={{ width: "100%", height: "100%" }} />
        </div>
      </div>
    </div>
  );
}
