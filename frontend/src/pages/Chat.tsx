import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatKit, useChatKit, type ChatKitControl } from "@openai/chatkit-react";
import type { ChatKitOptions, OpenAIChatKit } from "@openai/chatkit";
import { useAuth } from "../auth";

/** Studio export used both #000. `foreground: #fff` paints the composer strip light in dark mode — keep #000 for a black bar. */
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

/** Matches your ChatKit Studio `theme` export (fonts: Regular–Bold woff2 set). */
const TRIPIN_CHATKIT_THEME: NonNullable<ChatKitOptions["theme"]> = {
  colorScheme: "dark",
  radius: "pill",
  density: "normal",
  color: {
    grayscale: { hue: 0, tint: 0 },
    accent: { primary: "#000000", level: 3 },
    surface: { background: "#000000", foreground: "#000000" },
  },
  typography: {
    baseSize: 16,
    fontFamily: OPENAI_SANS_STACK,
    fontFamilyMono:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace',
    fontSources: OPENAI_SANS_SOURCES,
  },
};

/** Studio-style composer; no `models` so the model picker (e.g. Crisp) is hidden. */
const TRIPIN_CHATKIT_COMPOSER: NonNullable<ChatKitOptions["composer"]> = {
  placeholder: "Plan your next ideas ",
  attachments: {
    enabled: true,
    maxCount: 5,
    maxSize: 10 * 1024 * 1024,
  },
  tools: [
    {
      id: "search_docs",
      label: "Search docs",
      shortLabel: "Docs",
      placeholderOverride: "Search documentation",
      icon: "book-open",
      pinned: false,
    },
  ],
};

/** TRIPIN starter prompts on the new-thread screen. */
const TRIPIN_START_PROMPTS: NonNullable<NonNullable<ChatKitOptions["startScreen"]>["prompts"]> = [
  {
    icon: "suitcase",
    label: "Plan a weekend trip",
    prompt: "Help me plan a relaxing weekend trip.",
  },
  {
    icon: "maps",
    label: "Build an itinerary",
    prompt: "Create a day-by-day itinerary for my trip.",
  },
  {
    icon: "map-pin",
    label: "Things to do",
    prompt: "What should I see and do in my destination?",
  },
  {
    icon: "lightbulb",
    label: "Travel tips",
    prompt: "Give me practical travel tips for my trip.",
  },
];

function displayFirstName(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default function Chat() {
  const { token, firstName, logout } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

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

  const startScreen = useMemo(
    () => ({
      greeting: startGreeting,
      prompts: TRIPIN_START_PROMPTS,
    }),
    [startGreeting],
  );

  /** Latest greeting for `setOptions` re-pushes (hosted ChatKit can restore Studio prompts). */
  const startGreetingRef = useRef(startGreeting);
  startGreetingRef.current = startGreeting;

  const { control } = useChatKit({
    api: {
      getClientSecret,
    },
    theme: TRIPIN_CHATKIT_THEME,
    /** App header shows TRIPIN + buttons; hide ChatKit chrome so history is only our header control. */
    header: { enabled: false },
    /** Required for `showHistory()`; custom history button lives in `tripin-header`. */
    history: { enabled: true, showDelete: false, showRename: true },
    startScreen,
    composer: TRIPIN_CHATKIT_COMPOSER,
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
   * Hosted ChatKit can re-apply defaults after the session attaches (composer,
   * theme, model picker, starter prompts). Re-push on `chatkit.ready` so TRIPIN
   * options win.
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
          header: { enabled: false },
          history: { enabled: true, showDelete: false, showRename: true },
          composer: TRIPIN_CHATKIT_COMPOSER,
          startScreen: {
            greeting: startGreetingRef.current,
            prompts: TRIPIN_START_PROMPTS,
          },
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

  const userInitial = useMemo(() => {
    const name = displayFirstName(firstName);
    return (name?.charAt(0) ?? "U").toUpperCase();
  }, [firstName]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current) return;
      if (!profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [profileMenuOpen]);

  const onComingSoonClick = useCallback((label: string) => {
    setProfileMenuOpen(false);
    window.alert(`${label} is coming soon.`);
  }, []);

  const onHistoryClick = useCallback(() => {
    setProfileMenuOpen(false);
    void kitHost?.showHistory();
  }, [kitHost]);

  const onNewConversationClick = useCallback(() => {
    setProfileMenuOpen(false);
    const host = kitHost;
    if (!host) return;
    void host.hideHistory().catch(() => undefined);
    void host.setThreadId(null).catch(() => undefined);
  }, [kitHost]);

  return (
    <div className="app-shell app-shell--chat">
      <div className="chat-shell">
        <header className="tripin-header tripin-header--in-chat">
          <div className="tripin-header-main-row">
            <div className="tripin-header-left-actions">
              <div className="profile-menu-wrap" ref={profileMenuRef}>
                <button
                  type="button"
                  className="btn-profile-initial"
                  aria-haspopup="menu"
                  aria-expanded={profileMenuOpen}
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                >
                  {userInitial}
                </button>
                {profileMenuOpen ? (
                  <div className="profile-menu-dropdown profile-menu-dropdown--left" role="menu" aria-label="Profile menu">
                    <button
                      type="button"
                      className="profile-menu-item"
                      role="menuitem"
                      onClick={() => onComingSoonClick("Setup profile")}
                    >
                      Setup profile
                    </button>
                    <button
                      type="button"
                      className="profile-menu-item"
                      role="menuitem"
                      onClick={() => onComingSoonClick("Settings")}
                    >
                      Settings
                    </button>
                    <button
                      type="button"
                      className="profile-menu-item"
                      role="menuitem"
                      onClick={() => onComingSoonClick("About us")}
                    >
                      About us
                    </button>
                    <button
                      type="button"
                      className="profile-menu-item profile-menu-item--danger"
                      role="menuitem"
                      onClick={() => logout()}
                    >
                      Log out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="tripin-header-brand-center">
              <button
                type="button"
                className="tripin-wordmark tripin-wordmark--center tripin-wordmark--button"
                aria-label="Start a new conversation"
                onClick={onNewConversationClick}
              >
                TRIPIN
              </button>
            </div>
            <div className="tripin-header-actions">
              <button
                type="button"
                className="btn-history-icon"
                aria-label="Open chat history"
                onClick={onHistoryClick}
              >
                <svg className="btn-history-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.75" />
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    d="M12 7.25v5l3 2"
                  />
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    d="M6.5 5.5a9 9 0 0 1 11 0"
                  />
                </svg>
              </button>
            </div>
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
