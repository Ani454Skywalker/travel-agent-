import { useCallback, useMemo, useState } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import { useAuth } from "../auth";

/** Same stack as `body` / Google Fonts link in `index.html`. */
const FONT_STACK =
  "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/**
 * Darker “canvas” comes from `grayscale`; composer uses `surface` ~one step
 * lighter so the typing row is visible but not white.
 */
const CHAT_COMPOSER_SURFACE_BG = "#3f3f47";
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
      typography: {
        baseSize: 16,
        fontFamily: FONT_STACK,
      },
      color: {
        surface: {
          background: CHAT_COMPOSER_SURFACE_BG,
          foreground: "#f4f4f5",
        },
        accent: {
          primary: "#5c5c66",
          level: 0,
        },
        grayscale: {
          hue: 220,
          tint: 0,
          shade: -3,
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
