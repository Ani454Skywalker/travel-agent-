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
  const { control } = useChatKit({
    api: {
      getClientSecret: (_existing) => fetchClientSecret(),
    },
    theme: "dark",
    composer: {
      attachments: { enabled: false },
    },
  });

  return (
    <div className="app-shell">
      <h1>Travel assistant</h1>
      <p>
        Ask about trips, flights, and plans. This chat uses your ChatKit
        workflow on the server — your OpenAI key stays private.
      </p>
      <div className="chat-frame">
        <ChatKit control={control} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}
