import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatKit, useChatKit, type ChatKitControl } from "@openai/chatkit-react";
import type { OpenAIChatKit } from "@openai/chatkit";
import { useAuth } from "../auth";

/** From ChatKit Studio export; `surface.foreground` must not match background (Studio had both #000). */
const OPENAI_SANS_STACK =
  '"OpenAI Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

const OPENAI_SANS_SOURCES = [
  {
    family: "OpenAI Sans",
    src: "https://cdn.openai.com/common/fonts/openai-sans/v2/OpenAISans-Regular.woff2",
    weight: 400,
    style: "normal" as const,
    display: "swap" as const,
  },
  {
    family: "OpenAI Sans",
    src: "https://cdn.openai.com/common/fonts/openai-sans/v2/OpenAISans-Medium.woff2",
    weight: 500,
    style: "normal" as const,
    display: "swap" as const,
  },
  {
    family: "OpenAI Sans",
    src: "https://cdn.openai.com/common/fonts/openai-sans/v2/OpenAISans-Semibold.woff2",
    weight: 600,
    style: "normal" as const,
    display: "swap" as const,
  },
  {
    family: "OpenAI Sans",
    src: "https://cdn.openai.com/common/fonts/openai-sans/v2/OpenAISans-Bold.woff2",
    weight: 700,
    style: "normal" as const,
    display: "swap" as const,
  },
];

const CHAT_COMPOSER_PLACEHOLDER = "Plan your next ideas";

/** Synced with your Studio theme; no `startScreen.prompts` / tools / models (TRIPIN backend). */
const TRIPIN_CHATKIT_THEME = {
  colorScheme: "dark" as const,
  radius: "pill" as const,
  density: "normal" as const,
  typography: {
    baseSize: 16 as const,
    fontFamily: OPENAI_SANS_STACK,
    fontFamilyMono:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace',
    fontSources: OPENAI_SANS_SOURCES,
  },
  color: {
    grayscale: {
      hue: 0,
      tint: 0 as const,
    },
    accent: {
      primary: "#000000",
      level: 3 as const,
    },
    surface: {
      background: "#000000",
      foreground: "#ffffff",
    },
  },
};

function displayFirstName(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default function Chat() {
  const { token, firstName, logout } = useAuth();

  /** ChatKit start screen greeting. */
  const startGreeting = useMemo(() => {
    const name = displayFirstName(firstName);
    if (name) {
      return `How can I help you today, ${name}?`;
    }
    return "How can I help you today?";
  }, [firstName]);

  const [kitError, setKitError] = useState<string | null>(null);

  /** Latest control for `onReady` (avoids stale closure). */
  const controlRef = useRef<ChatKitControl | null>(null);

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
    theme: TRIPIN_CHATKIT_THEME,
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

  controlRef.current = control;

  const [kitHost, setKitHost] = useState<OpenAIChatKit | null>(null);
  const bindKitHost = useCallback((node: OpenAIChatKit | null) => {
    setKitHost(node);
  }, []);

  /**
   * Hosted ChatKit can re-apply defaults after the session attaches (composer
   * snaps back to a light/white strip). Re-push options on `chatkit.ready` and
   * a few delayed ticks so `theme.color.surface` is honored.
   */
  useEffect(() => {
    if (!kitHost) return;
    const pushOptions = () => {
      const opts = controlRef.current?.options;
      if (!opts) return;
      try {
        kitHost.setOptions({
          ...opts,
          theme: TRIPIN_CHATKIT_THEME,
        });
      } catch {
        /* ignore */
      }
    };
    const onReady = () => {
      pushOptions();
      requestAnimationFrame(pushOptions);
      window.setTimeout(pushOptions, 100);
      window.setTimeout(pushOptions, 350);
      window.setTimeout(pushOptions, 800);
      window.setTimeout(pushOptions, 1600);
      window.setTimeout(pushOptions, 3200);
    };
    kitHost.addEventListener("chatkit.ready", onReady);
    onReady();
    return () => kitHost.removeEventListener("chatkit.ready", onReady);
  }, [kitHost]);

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
          <ChatKit
            ref={bindKitHost}
            control={control}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </div>
    </div>
  );
}
