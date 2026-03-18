const LM_STUDIO_URL = "http://localhost:1234/v1/chat/completions";
const OLLAMA_URL = "http://localhost:11434/api/chat";

async function tryLmStudio(args) {
  const body = {
    model: args.model || "local-model",
    temperature: 0.2,
    max_tokens: 80,
    messages: [
      {
        role: "system",
        content:
          "You create very short conversation turn labels for navigation. " +
          "Return strict JSON only with keys: label, type, tags. " +
          "label must be 5-10 words, specific, concrete, and easy to scan. " +
          "type must be one of: question, request, explanation, recommendation, code, config, ui, bug, performance, decision, followup. " +
          "tags must be a short array."
      },
      {
        role: "user",
        content: args.prompt
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "turn_descriptor",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            label: { type: "string" },
            type: { type: "string" },
            tags: {
              type: "array",
              items: { type: "string" }
            }
          },
          required: ["label", "type", "tags"]
        }
      }
    }
  };

  const res = await fetch(LM_STUDIO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`LM Studio failed: ${res.status}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("LM Studio returned no content");
  return JSON.parse(text);
}

async function tryOllama(args) {
  const body = {
    model: args.model || "qwen2.5:7b-instruct",
    stream: false,
    format: {
      type: "object",
      properties: {
        label: { type: "string" },
        type: { type: "string" },
        tags: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["label", "type", "tags"]
    },
    messages: [
      {
        role: "system",
        content:
          "You create very short conversation turn labels for navigation. " +
          "Return JSON with keys label, type, tags. " +
          "label must be 5-10 words, concrete and specific."
      },
      {
        role: "user",
        content: args.prompt
      }
    ]
  };

  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`Ollama failed: ${res.status}`);
  }

  const data = await res.json();
  const text = data?.message?.content;
  if (!text) throw new Error("Ollama returned no content");
  return JSON.parse(text);
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  const url = tab.url || "";
  const allowed =
    url.startsWith("https://chatgpt.com/") ||
    url.startsWith("https://chat.openai.com/") ||
    url.startsWith("https://claude.ai/");
  if (!allowed) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "TGPT_TOGGLE_NAV" });
  } catch (err) {
    console.error("Failed to toggle Turn Navigator:", err);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "TGPT_SUMMARIZE_TURN") return;

  (async () => {
    try {
      let result = null;

      if (msg.provider !== "ollama") {
        try {
          result = await tryLmStudio(msg);
        } catch (e) {
          console.warn("LM Studio unavailable, falling back to Ollama:", e.message);
        }
      }

      if (!result) {
        result = await tryOllama(msg);
      }

      sendResponse({ ok: true, result });
    } catch (err) {
      sendResponse({
        ok: false,
        error: String(err?.message || err)
      });
    }
  })();

  return true;
});