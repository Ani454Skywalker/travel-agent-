import { useCallback, useState } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";

async function fetchClientSecret(): Promise<string> {
  const res = await fetch("/api/chatkit/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Session failed: ${res.status}`);
  }
  const data = (await res.json()) as { client_secret: string };
  return data.client_secret;
}

export default function App() {
  const [kitError, setKitError] = useState<string | null>(null);

  const getClientSecret = useCallback((_existing: string | null) => {
    setKitError(null);
    return fetchClientSecret();
  }, []);

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
      <h1>Travel assistant</h1>
      <p>
        Ask about trips, flights, and plans. This chat uses your ChatKit
        workflow on the server — your OpenAI key stays private.
      </p>
      {kitError ? <div className="kit-error">{kitError}</div> : null}
      <div className="chat-frame">
        <ChatKit control={control} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}
