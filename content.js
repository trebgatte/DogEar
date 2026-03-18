(() => {
  const APP_ID = "__dogear_turn_nav_v130_chrome__";
  const DRAWER_ID = "dogear-turn-nav-drawer";
  const BTN_ID = "dogear-turn-nav-button";
  const MINI_ID = "dogear-turn-nav-mini";
  const STYLE_ID = "dogear-turn-nav-style";

  function getSite() {
    const host = location.hostname;
    if (host === "chatgpt.com" || host === "chat.openai.com") return "chatgpt";
    if (host === "claude.ai") return "claude";
    return null;
  }

  const SITE = getSite();
  if (!SITE) return; // Not on a supported site

  const STORAGE_BOOKMARKS_PREFIX = "tgpt_turn_nav_bookmarks_v122_";
  const STORAGE_NOTES_PREFIX = "tgpt_turn_nav_notes_v122_";
  const STORAGE_TITLES_PREFIX = "tgpt_turn_nav_titles_v122_";
  const STORAGE_GLOBAL_BOOKMARKS = "tgpt_turn_nav_global_bookmarks_v122";
  const STORAGE_CONV_TITLES = "tgpt_turn_nav_conv_titles_v122";
  const STORAGE_PENDING_JUMP = "tgpt_turn_nav_pending_jump_v122";
  const STORAGE_SECTIONS = "tgpt_turn_nav_sections_v121";
  const STORAGE_MINI = "tgpt_turn_nav_mini_v121";
  const STORAGE_LAYOUT = "tgpt_turn_nav_layout_v121";
  const STORAGE_AI_MODE = "tgpt_turn_nav_ai_mode_v121";
  const STORAGE_AI_PROVIDER = "tgpt_turn_nav_ai_provider_v121";
  const STORAGE_AI_CACHE = "tgpt_turn_nav_ai_cache_v121";
  const STORAGE_AI_MODEL = "tgpt_turn_nav_ai_model_v121";
  const STORAGE_TRACK_CURRENT = "tgpt_turn_nav_track_current_v121";

  function getConversationId() {
    if (SITE === "chatgpt") {
      const match = location.pathname.match(/\/(?:c|g)\/([a-f0-9-]+)/i);
      return match ? match[1] : "__no_conversation__";
    }
    if (SITE === "claude") {
      // Claude URLs: /chat/{uuid}, /project/{uuid}/chat/{uuid}, etc.
      const segments = location.pathname.split("/").filter(Boolean);
      for (let i = segments.length - 1; i >= 0; i--) {
        if (/^[a-f0-9-]{8,}$/i.test(segments[i])) return segments[i];
      }
    }
    return "__no_conversation__";
  }

  function getConversationTitle() {
    if (SITE === "claude") {
      // Claude: title button in header
      const titleBtn = document.querySelector('[data-testid="chat-title-button"]');
      if (titleBtn) {
        const text = (titleBtn.textContent || "").replace(/\s+/g, " ").trim();
        if (text && text.length > 1) return text.length > 60 ? text.slice(0, 59) + "…" : text;
      }
      const pageTitle = document.title || "";
      const cleaned = pageTitle.replace(/\s*[|–—-]\s*Claude\s*$/i, "").trim();
      if (cleaned && cleaned !== "Claude" && cleaned.length > 1) return cleaned;
    }

    if (SITE === "chatgpt") {
      const pageTitle = document.title || "";
      const cleaned = pageTitle.replace(/\s*[|–—-]\s*ChatGPT\s*$/i, "").trim();
      if (cleaned && cleaned !== "ChatGPT" && cleaned.length > 1) return cleaned;
    }

    // Fallback for both: first user message
    const userSel = SITE === "claude"
      ? "[data-testid='user-message']"
      : "[data-message-author-role='user']";
    const firstUser = document.querySelector(userSel);
    if (firstUser) {
      const text = (firstUser.innerText || "").replace(/\s+/g, " ").trim();
      if (text) return text.length > 60 ? text.slice(0, 59) + "…" : text;
    }
    return "Untitled conversation";
  }

  function storageGet(key, fallback) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([key], (result) => {
          if (chrome.runtime.lastError) {
            resolve(fallback);
            return;
          }
          resolve(result[key] ?? fallback);
        });
      } catch {
        resolve(fallback);
      }
    });
  }

  function storageSet(key, value) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [key]: value }, () => resolve());
      } catch {
        resolve();
      }
    });
  }

  function truncate(str, len) {
    if (!str) return "";
    str = String(str).replace(/\s+/g, " ").trim();
    return str.length > len ? str.slice(0, len - 1) + "…" : str;
  }

  function cleanText(str) {
    return String(str || "")
      .replace(/\s+/g, " ")
      .replace(/[ \t]+/g, " ")
      .trim();
  }

  function getText(el) {
    return cleanText(el?.innerText || el?.textContent || "");
  }

  function inferRole(el) {
    if (SITE === "claude") {
      if (el.querySelector("[data-testid='user-message']")) return "user";
      if (el.querySelector("[data-is-streaming]") || el.querySelector(".font-claude-response")) return "assistant";
      if (el.querySelector(".bg-bg-300.rounded-xl")) return "user";
      if (el.querySelector(".standard-markdown, .progressive-markdown")) return "assistant";
      return "assistant";
    }

    // ChatGPT
    if (
      el.getAttribute("data-message-author-role") === "user" ||
      el.querySelector("[data-message-author-role='user']")
    ) return "user";
    if (
      el.getAttribute("data-message-author-role") === "assistant" ||
      el.querySelector("[data-message-author-role='assistant']")
    ) return "assistant";

    const txt = getText(el).toLowerCase();
    if (txt.startsWith("you said:") || txt.startsWith("you")) return "user";
    if (txt.startsWith("chatgpt")) return "assistant";

    const rect = el.getBoundingClientRect();
    return rect.left > window.innerWidth * 0.35 ? "user" : "assistant";
  }

  function splitSentences(text) {
    return cleanText(text)
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function stripLeadIns(text) {
    return text
      .replace(/^(sure|yes|okay|ok|got it|absolutely|certainly|right)\b[:, -]*/i, "")
      .replace(/^(here'?s|this is|these are)\b[:, -]*/i, "")
      .trim();
  }

  function titleCase(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
  }

  function hashText(str) {
    let h = 2166136261;
    const s = String(str || "");
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return (h >>> 0).toString(36);
  }

  function idle(fn) {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(fn, { timeout: 1500 });
    } else {
      setTimeout(fn, 50);
    }
  }

  function buildDescriptorPrompt(prevText, text, nextText, role) {
    const clip = (v, n = 1800) => String(v || "").slice(0, n);

    return [
      `Role: ${role}`,
      "",
      "Previous turn:",
      clip(prevText || ""),
      "",
      "Current turn:",
      clip(text || ""),
      "",
      "Next turn:",
      clip(nextText || ""),
      "",
      "Create a short label for the CURRENT turn only.",
      "Focus on what was requested, explained, implemented, decided, or fixed.",
      "Be concrete. Avoid generic labels like 'Provides code' unless absolutely necessary."
    ].join("\n");
  }

  function summarizeTurn(text, role, prevTurnText = "") {
    const raw = cleanText(text);

    if (!raw) return role === "user" ? "User message" : "Assistant response";

    const firstSentence = splitSentences(raw)[0] || raw;
    const first = truncate(stripLeadIns(firstSentence), 72);

    const sample = raw.slice(0, 500);

    const codeFenceCount = (sample.match(/```/g) || []).length;
    const hasHeavyCode =
      codeFenceCount >= 2 ||
      /function\s+\w+\s*\(|const\s+\w+\s*=|let\s+\w+\s*=|class\s+\w+|=>\s*{|import\s+|export\s+|def\s+\w+|async\s+function/i.test(sample);

    const asksQuestion = sample.includes("?");
    const asksForBuild = /\b(build|create|make|implement|add|update|patch|fix|write|generate)\b/i.test(sample);
    const asksForWriting = /\b(rewrite|draft|respond|email|post|prompt|summarize|explain)\b/i.test(sample);
    const asksForExplanation = /\b(how|why|what would it take|is there another way|can you explain|what is|what are)\b/i.test(sample);

    if (role === "user") {
      if (asksQuestion && asksForExplanation) return truncate("Asks: " + first, 78);
      if (asksQuestion) return truncate("Asks: " + first.replace(/\?+$/, ""), 78);
      if (asksForBuild) return truncate("Requests: " + first, 78);
      if (asksForWriting) return truncate("Requests: " + first, 78);
      return truncate("User: " + first, 78);
    }

    if (role === "assistant") {
      if (hasHeavyCode) return truncate("Implements: " + first, 78);
      if (/\b(recommend|suggest|best approach|should|consider)\b/i.test(sample)) {
        return truncate("Recommends: " + first, 78);
      }
      if (/\b(explain|because|reason|tradeoff|the issue|the problem)\b/i.test(sample)) {
        return truncate("Explains: " + first, 78);
      }
      return truncate("Assistant: " + first, 78);
    }

    return first;
  }

  function getMessageNodes() {
    if (SITE === "claude") {
      const nodes = Array.from(document.querySelectorAll("[data-test-render-count]"));
      if (nodes.length) return nodes;
      // Fallback: find user/assistant markers and walk up
      const markers = Array.from(document.querySelectorAll(
        "[data-testid='user-message'], [data-is-streaming]"
      ));
      if (markers.length) {
        const containers = new Set();
        markers.forEach((node) => {
          let parent = node.parentElement;
          for (let i = 0; i < 5 && parent; i++) {
            if (parent.parentElement && parent.parentElement.children.length > 2) {
              containers.add(parent);
              break;
            }
            parent = parent.parentElement;
          }
        });
        return Array.from(containers);
      }
      return [];
    }

    // ChatGPT
    const selectors = [
      "article",
      "[data-message-author-role]",
      "main [data-testid*='conversation-turn']",
      "main article"
    ];
    for (const selector of selectors) {
      const nodes = Array.from(document.querySelectorAll(selector));
      if (nodes.length) return nodes;
    }
    return [];
  }

  function getConversationTurns() {
    const nodes = getMessageNodes();
    const turns = [];
    const seen = new Set();

    nodes.forEach((node, idx) => {
      if (!node || seen.has(node)) return;
      seen.add(node);

      const role = inferRole(node);
      let text = "";

      if (SITE === "claude") {
        // Extract from specific content areas to avoid tool-use labels, timestamps, etc.
        if (role === "user") {
          const msgEl = node.querySelector("[data-testid='user-message']");
          text = getText(msgEl || node);
        } else {
          const mdEl = node.querySelector(".standard-markdown, .progressive-markdown");
          text = getText(mdEl || node.querySelector(".font-claude-response") || node);
        }
      } else {
        text = getText(node);
      }

      if (!text || text.length < 2) return;

      const prevTurnText = turns.length ? turns[turns.length - 1].text : "";
      const turnId = "turn-" + (idx + 1);

      if (!node.id) node.id = turnId;

      turns.push({
        id: turnId,
        index: turns.length + 1,
        role,
        defaultLabel: summarizeTurn(text, role, prevTurnText),
        text,
        node
      });
    });

    return turns;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${BTN_ID} {
        position: fixed;
        left: 14px;
        bottom: 18px;
        z-index: 2147483647;
        border: none;
        border-radius: 999px;
        padding: 12px 16px;
        font: 700 14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        background: #111;
        color: #fff;
        box-shadow: 0 8px 24px rgba(0,0,0,.22);
        cursor: pointer;
      }

      #${DRAWER_ID} {
        position: fixed;
        z-index: 2147483646;
        background: #fff;
        color: #111;
        box-shadow: 0 -8px 30px rgba(0,0,0,.24);
        display: flex;
        flex-direction: column;
        font: 14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      #${DRAWER_ID}.layout-bottom {
        left: 0;
        right: 0;
        bottom: 0;
        height: 78vh;
        border-top-left-radius: 18px;
        border-top-right-radius: 18px;
        transform: translateY(100%);
        transition: transform .22s ease;
      }

      #${DRAWER_ID}.layout-bottom.open {
        transform: translateY(0);
      }

      #${DRAWER_ID}.layout-right {
        top: 0;
        right: 0;
        width: 420px;
        max-width: 42vw;
        height: 100vh;
        border-top-left-radius: 18px;
        border-bottom-left-radius: 18px;
        transform: translateX(100%);
        transition: transform .22s ease;
        box-shadow: -8px 0 30px rgba(0,0,0,.24);
      }

      #${DRAWER_ID}.layout-right.open {
        transform: translateX(0);
      }

      #${DRAWER_ID} .tgpt-header {
        padding: 10px 14px 8px;
        border-bottom: 1px solid #ececec;
        background: #fff;
      }

      #${DRAWER_ID} .tgpt-grabber {
        width: 42px;
        height: 5px;
        border-radius: 999px;
        background: #d0d0d0;
        margin: 0 auto 10px;
      }

      #${DRAWER_ID}.layout-right .tgpt-grabber {
        display: none;
      }

      #${DRAWER_ID} .tgpt-title-row,
      #${DRAWER_ID} .tgpt-nav-row,
      #${DRAWER_ID} .tgpt-utility-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
        flex-wrap: wrap;
      }

      #${DRAWER_ID} .tgpt-title-row {
        justify-content: space-between;
      }

      #${DRAWER_ID} .tgpt-title {
        font-weight: 700;
        font-size: 16px;
      }

      #${DRAWER_ID} button,
      #${DRAWER_ID} input {
        font: inherit;
      }

      #${DRAWER_ID} .tgpt-close,
      #${DRAWER_ID} .tgpt-nav-btn,
      #${DRAWER_ID} .tgpt-utility-btn {
        border: none;
        background: #f2f2f2;
        border-radius: 10px;
        padding: 8px 10px;
        font-weight: 600;
        cursor: pointer;
      }

      #${DRAWER_ID} .tgpt-search {
        width: 100%;
        box-sizing: border-box;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid #ddd;
        margin-bottom: 10px;
        font-size: 14px;
      }

      #${DRAWER_ID} .tgpt-filters {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding-bottom: 2px;
        margin-bottom: 10px;
      }

      #${DRAWER_ID} .tgpt-chip {
        border: 1px solid #ddd;
        background: #fafafa;
        color: #222;
        border-radius: 999px;
        padding: 7px 10px;
        white-space: nowrap;
        font-size: 13px;
        cursor: pointer;
      }

      #${DRAWER_ID} .tgpt-chip.active {
        background: #111;
        color: #fff;
        border-color: #111;
      }

      #${DRAWER_ID} .tgpt-list {
        overflow: auto;
        padding: 8px 12px 18px;
        flex: 1;
        background: #fff;
      }

      #${DRAWER_ID} .tgpt-section {
        margin-bottom: 14px;
      }

      #${DRAWER_ID} .tgpt-section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 2px 8px;
        position: sticky;
        top: 0;
        background: #fff;
        z-index: 2;
      }

      #${DRAWER_ID} .tgpt-section-title {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: .06em;
        color: #666;
        font-weight: 700;
      }

      #${DRAWER_ID} .tgpt-section-toggle {
        border: none;
        background: #f5f5f5;
        border-radius: 10px;
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }

      #${DRAWER_ID} .tgpt-item {
        border: 1px solid #ececec;
        border-radius: 10px;
        padding: 7px 8px 7px 10px;
        margin-bottom: 6px;
        background: #fff;
      }

      #${DRAWER_ID} .tgpt-item.current {
        border-color: #111;
        box-shadow: 0 0 0 2px rgba(17,17,17,.06);
      }

      #${DRAWER_ID} .tgpt-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 8px;
      }

      #${DRAWER_ID} .tgpt-main {
        min-width: 0;
        flex: 1;
        cursor: pointer;
      }

      #${DRAWER_ID} .tgpt-meta {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: .04em;
        color: #666;
        margin-bottom: 2px;
      }

      #${DRAWER_ID} .tgpt-label {
        font-size: 13px;
        line-height: 1.2;
        color: #111;
        word-break: break-word;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      #${DRAWER_ID} .tgpt-actions {
        display: flex;
        flex-direction: row;
        gap: 4px;
        flex-shrink: 0;
      }

      #${DRAWER_ID} .tgpt-icon-btn {
        border: none;
        background: #f5f5f5;
        border-radius: 8px;
        padding: 4px 6px;
        font-size: 12px;
        cursor: pointer;
        line-height: 1;
      }

      #${DRAWER_ID} .tgpt-note {
        margin-top: 5px;
        font-size: 11px;
        color: #555;
        background: #fafafa;
        border-radius: 8px;
        padding: 5px 7px;
      }

      #${DRAWER_ID} .tgpt-snippet {
        margin-top: 3px;
        font-size: 11px;
        line-height: 1.3;
        color: #777;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      #${DRAWER_ID} .tgpt-conv-header {
        font-size: 12px;
        font-weight: 700;
        color: #333;
        padding: 12px 2px 4px;
        border-bottom: 1px solid #eee;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      #${DRAWER_ID} .tgpt-conv-header .tgpt-conv-badge {
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: .04em;
        color: #999;
        font-weight: 600;
      }

      #${DRAWER_ID} .tgpt-item.cross-conv {
        border-style: dashed;
      }

      #${DRAWER_ID} .tgpt-global-time {
        font-size: 10px;
        color: #999;
        margin-left: auto;
        white-space: nowrap;
      }

      #${MINI_ID} {
        position: fixed;
        right: 8px;
        top: 88px;
        width: 10px;
        height: calc(100vh - 140px);
        z-index: 2147483645;
        background: rgba(0,0,0,.08);
        border-radius: 999px;
        overflow: hidden;
      }

      #${MINI_ID} .tgpt-mini-track {
        position: relative;
        width: 100%;
        height: 100%;
      }

      #${MINI_ID} .tgpt-mini-dot {
        position: absolute;
        left: 1px;
        width: 8px;
        border-radius: 999px;
        background: rgba(0,0,0,.22);
        cursor: pointer;
      }

      #${MINI_ID} .tgpt-mini-dot.user { background: rgba(0,0,0,.18); }
      #${MINI_ID} .tgpt-mini-dot.assistant { background: rgba(0,0,0,.35); }
      #${MINI_ID} .tgpt-mini-dot.bookmarked { background: #111; }
      #${MINI_ID} .tgpt-mini-dot.current {
        background: #111;
        box-shadow: 0 0 0 2px rgba(0,0,0,.12);
      }

      .tgpt-highlight-target {
        outline: 3px solid rgba(17,17,17,.18);
        border-radius: 12px;
        transition: outline .4s ease;
      }
    `;
    document.head.appendChild(style);
  }

  async function createApp() {
    if (window[APP_ID]) {
      try { window[APP_ID].destroy(); } catch {}
      delete window[APP_ID];
      return;
    }

    const convId = getConversationId();

    const state = {
      open: false,
      filter: "all",
      search: "",
      turns: [],
      currentId: null,
      io: null,
      keyHandler: null,
      convId,
      bookmarks: await storageGet(STORAGE_BOOKMARKS_PREFIX + convId, {}),
      notes: await storageGet(STORAGE_NOTES_PREFIX + convId, {}),
      titles: await storageGet(STORAGE_TITLES_PREFIX + convId, {}),
      sections: await storageGet(STORAGE_SECTIONS, {
        bookmarked: true,
        user: true,
        assistant: true
      }),
      miniEnabled: await storageGet(STORAGE_MINI, false),
      layout: await storageGet(STORAGE_LAYOUT, "right"),
      aiMode: await storageGet(STORAGE_AI_MODE, true),
      aiProvider: await storageGet(STORAGE_AI_PROVIDER, "auto"),
      aiModel: await storageGet(STORAGE_AI_MODEL, ""),
      aiCache: await storageGet(STORAGE_AI_CACHE, {}),
      aiInFlight: new Set(),
      trackCurrent: await storageGet(STORAGE_TRACK_CURRENT, false),
      globalBookmarks: await storageGet(STORAGE_GLOBAL_BOOKMARKS, {}),
      convTitles: await storageGet(STORAGE_CONV_TITLES, {}),
      pendingJump: await storageGet(STORAGE_PENDING_JUMP, null)
    };

    let drawer, listEl, searchEl, chips = {}, mini;
    let urlPollInterval = null;
    let lastKnownUrl = location.href;

    function effectiveLabel(turn) {
      return state.titles[turn.id] || turn.defaultLabel;
    }

    function turnCacheKey(turn, prevText = "", nextText = "") {
      return hashText([
        turn.role,
        prevText,
        turn.text,
        nextText
      ].join("\n---\n"));
    }

    async function persistAiCache() {
      await storageSet(STORAGE_AI_CACHE, state.aiCache);
    }

    async function summarizeTurnWithAI(turn, prevText = "", nextText = "") {
      if (!state.aiMode) return null;

      const cacheKey = turnCacheKey(turn, prevText, nextText);
      const cached = state.aiCache[cacheKey];
      if (cached?.label) return cached;

      if (state.aiInFlight.has(cacheKey)) return null;
      state.aiInFlight.add(cacheKey);

      try {
        const prompt = buildDescriptorPrompt(prevText, turn.text, nextText, turn.role);

        const response = await chrome.runtime.sendMessage({
          type: "TGPT_SUMMARIZE_TURN",
          provider: state.aiProvider,
          model: state.aiModel,
          prompt
        });

        if (!response?.ok || !response?.result?.label) {
          return null;
        }

        const result = {
          label: truncate(cleanText(response.result.label), 78),
          type: cleanText(response.result.type || ""),
          tags: Array.isArray(response.result.tags) ? response.result.tags.slice(0, 4) : []
        };

        state.aiCache[cacheKey] = result;
        await persistAiCache();
        return result;
      } catch {
        return null;
      } finally {
        state.aiInFlight.delete(cacheKey);
      }
    }

    async function runAiDescriptorsForVisibleTurns(limit = 24) {
      if (!state.aiMode || !state.turns.length) return;

      const batch = state.turns.slice(0, limit);
      let changed = false;

      for (let i = 0; i < batch.length; i++) {
        const turn = batch[i];
        const prevText = i > 0 ? batch[i - 1].text : "";
        const nextText = i < batch.length - 1 ? batch[i + 1].text : "";

        const cacheKey = turnCacheKey(turn, prevText, nextText);
        if (state.aiCache[cacheKey]?.label) {
          if (state.titles[turn.id] !== state.aiCache[cacheKey].label) {
            state.titles[turn.id] = state.aiCache[cacheKey].label;
            changed = true;
          }
          continue;
        }

        const result = await summarizeTurnWithAI(turn, prevText, nextText);
        if (result?.label && state.titles[turn.id] !== result.label) {
          state.titles[turn.id] = result.label;
          changed = true;
        }
      }

      if (changed) {
        await storageSet(STORAGE_TITLES_PREFIX + state.convId, state.titles);
        if (state.open) renderList();
      }
    }

    async function toggleAiMode() {
      state.aiMode = !state.aiMode;
      await storageSet(STORAGE_AI_MODE, state.aiMode);

      if (state.aiMode && state.open) {
        idle(() => runAiDescriptorsForVisibleTurns());
      } else {
        renderList();
      }
    }

    async function cycleAiProvider() {
      const next =
        state.aiProvider === "auto" ? "lmstudio" :
        state.aiProvider === "lmstudio" ? "ollama" :
        state.aiProvider === "ollama" ? "auto" : "auto";

      state.aiProvider = next;
      await storageSet(STORAGE_AI_PROVIDER, state.aiProvider);

      if (state.open && state.aiMode) {
        idle(() => runAiDescriptorsForVisibleTurns());
      }
    }

    async function toggleBookmark(turnId) {
      const globalKey = state.convId + ":" + turnId;

      if (state.bookmarks[turnId]) {
        delete state.bookmarks[turnId];
        delete state.globalBookmarks[globalKey];
      } else {
        state.bookmarks[turnId] = true;

        const turn = state.turns.find((t) => t.id === turnId);
        state.globalBookmarks[globalKey] = {
          convId: state.convId,
          site: SITE,
          convTitle: state.convTitles[state.convId] || getConversationTitle(),
          turnId,
          turnIndex: turn ? turn.index : 0,
          role: turn ? turn.role : "unknown",
          label: turn ? effectiveLabel(turn) : turnId,
          snippet: turn ? truncate(turn.text, 120) : "",
          note: state.notes[turnId] || "",
          ts: Date.now()
        };
      }

      await storageSet(STORAGE_BOOKMARKS_PREFIX + state.convId, state.bookmarks);
      await storageSet(STORAGE_GLOBAL_BOOKMARKS, state.globalBookmarks);
      renderAll();
    }

    async function editNote(turnId) {
      const current = state.notes[turnId] || "";
      const next = prompt("Add or edit note for this turn:", current);
      if (next === null) return;
      if (next.trim()) state.notes[turnId] = next.trim();
      else delete state.notes[turnId];
      await storageSet(STORAGE_NOTES_PREFIX + state.convId, state.notes);

      // Sync note into global bookmark if it exists
      const gk = state.convId + ":" + turnId;
      if (state.globalBookmarks[gk]) {
        state.globalBookmarks[gk].note = state.notes[turnId] || "";
        await storageSet(STORAGE_GLOBAL_BOOKMARKS, state.globalBookmarks);
      }
      renderAll();
    }

    async function renameTurn(turnId) {
      const turn = state.turns.find((t) => t.id === turnId);
      if (!turn) return;
      const current = state.titles[turnId] || effectiveLabel(turn);
      const next = prompt("Rename this turn:", current);
      if (next === null) return;
      if (next.trim()) state.titles[turnId] = next.trim();
      else delete state.titles[turnId];
      await storageSet(STORAGE_TITLES_PREFIX + state.convId, state.titles);

      // Sync label into global bookmark if it exists
      const gk = state.convId + ":" + turnId;
      if (state.globalBookmarks[gk]) {
        state.globalBookmarks[gk].label = effectiveLabel(turn);
        await storageSet(STORAGE_GLOBAL_BOOKMARKS, state.globalBookmarks);
      }
      renderAll();
    }

    async function updateConvTitle() {
      if (state.convId === "__no_conversation__") return;
      const title = getConversationTitle();
      if (title && title !== state.convTitles[state.convId]) {
        state.convTitles[state.convId] = title;
        await storageSet(STORAGE_CONV_TITLES, state.convTitles);
      }
    }

    function relativeTime(ts) {
      if (!ts) return "";
      const diff = Date.now() - ts;
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "just now";
      if (mins < 60) return mins + "m ago";
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return hrs + "h ago";
      const days = Math.floor(hrs / 24);
      if (days < 30) return days + "d ago";
      return Math.floor(days / 30) + "mo ago";
    }

    function convUrl(convId, site) {
      if (site === "claude") return "https://claude.ai/chat/" + convId;
      return "https://chatgpt.com/c/" + convId;
    }

    function navigateToBookmark(entry) {
      if (entry.convId === state.convId) {
        // Same conversation — just jump to the turn
        const turn = state.turns.find((t) => t.id === entry.turnId);
        if (turn) jumpToTurn(turn);
        return;
      }

      // Different conversation — persist pending jump and navigate
      const jump = { convId: entry.convId, turnId: entry.turnId };
      state.pendingJump = jump;
      storageSet(STORAGE_PENDING_JUMP, jump);
      location.href = convUrl(entry.convId, entry.site || SITE);
    }

    function filteredTurns() {
      return state.turns.filter((turn) => {
        if (state.filter === "user" && turn.role !== "user") return false;
        if (state.filter === "assistant" && turn.role !== "assistant") return false;
        if (state.filter === "bookmarked" && !state.bookmarks[turn.id]) return false;

        if (state.search) {
          const q = state.search.toLowerCase();
          const hay = (
            effectiveLabel(turn) + " " + turn.text + " " + (state.notes[turn.id] || "")
          ).toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
    }

    function applyLayoutClass() {
      if (!drawer) return;
      drawer.classList.remove("layout-bottom", "layout-right");
      drawer.classList.add(state.layout === "bottom" ? "layout-bottom" : "layout-right");
    }

    function scheduleOpenRefresh() {
      setTimeout(() => refreshTurns(), 50);
    }

    function openDrawer() {
      drawer.classList.add("open");
      state.open = true;
      scheduleOpenRefresh();
      if (state.aiMode) {
        idle(() => runAiDescriptorsForVisibleTurns());
      }
    }

    function closeDrawer() {
      drawer.classList.remove("open");
      state.open = false;
      try { state.io && state.io.disconnect(); } catch {}
    }

    function jumpToTurn(turn) {
      state.currentId = turn.id;
      turn.node.classList.add("tgpt-highlight-target");
      turn.node.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => turn.node.classList.remove("tgpt-highlight-target"), 1800);
      renderAll();
      if (state.layout === "bottom") closeDrawer();
    }

    function getCurrentIndex() {
      const idx = state.turns.findIndex((t) => t.id === state.currentId);
      return idx >= 0 ? idx : 0;
    }

    function jumpRelative(predicate, direction) {
      if (!state.turns.length) return;
      let idx = getCurrentIndex();
      const step = direction === "prev" ? -1 : 1;
      idx += step;

      while (idx >= 0 && idx < state.turns.length) {
        const t = state.turns[idx];
        if (predicate(t)) {
          jumpToTurn(t);
          return;
        }
        idx += step;
      }
    }

    async function exportBookmarks() {
      let content;

      if (state.filter === "all_bookmarks") {
        // Export all global bookmarks grouped by conversation
        const entries = Object.values(state.globalBookmarks)
          .sort((a, b) => (b.ts || 0) - (a.ts || 0));

        if (!entries.length) {
          alert("No bookmarks across any conversation yet.");
          return;
        }

        const groups = {};
        for (const e of entries) {
          const cid = e.convId || "__unknown__";
          if (!groups[cid]) groups[cid] = [];
          groups[cid].push(e);
        }

        content = Object.entries(groups).map(([cid, items]) => {
          const convTitle = state.convTitles[cid] || items[0]?.convTitle || cid;
          const lines = [`## ${convTitle}`, ""];
          for (const e of items.sort((a, b) => (a.turnIndex || 0) - (b.turnIndex || 0))) {
            lines.push(`# Turn ${e.turnIndex || "?"} (${e.role})`);
            lines.push(`Label: ${e.label || e.turnId}`);
            if (e.note) lines.push(`Note: ${e.note}`);
            if (e.snippet) lines.push(`Snippet: ${e.snippet}`);
            lines.push(`Link: ${convUrl(e.convId, e.site || SITE)}`);
            lines.push("");
            lines.push("----");
            lines.push("");
          }
          return lines.join("\n");
        }).join("\n");
      } else {
        // Export bookmarks from current conversation
        const marked = state.turns.filter((t) => state.bookmarks[t.id]);
        if (!marked.length) {
          alert("No bookmarked turns yet.");
          return;
        }

        content = marked.map((t) => {
          const parts = [];
          parts.push(`# Turn ${t.index} (${t.role})`);
          parts.push(`Title: ${effectiveLabel(t)}`);
          if (state.notes[t.id]) parts.push(`Note: ${state.notes[t.id]}`);
          parts.push("");
          parts.push(t.text);
          parts.push("");
          parts.push("----");
          parts.push("");
          return parts.join("\n");
        }).join("\n");
      }

      try {
        await navigator.clipboard.writeText(content);
        alert("Bookmarked turns copied to clipboard.");
      } catch {
        prompt("Copy your exported bookmarked turns:", content);
      }
    }

    async function toggleSection(key) {
      state.sections[key] = !state.sections[key];
      await storageSet(STORAGE_SECTIONS, state.sections);
      renderList();
    }

    async function toggleMini() {
      state.miniEnabled = !state.miniEnabled;
      await storageSet(STORAGE_MINI, state.miniEnabled);
      renderMini();
    }

    async function toggleLayout() {
      state.layout = state.layout === "right" ? "bottom" : "right";
      await storageSet(STORAGE_LAYOUT, state.layout);
      applyLayoutClass();
      if (state.layout === "right") openDrawer();
    }

    async function toggleTrackCurrent() {
      state.trackCurrent = !state.trackCurrent;
      await storageSet(STORAGE_TRACK_CURRENT, state.trackCurrent);

      if (state.trackCurrent && state.open) {
        observeCurrentTurn();
      } else {
        try { state.io && state.io.disconnect(); } catch {}
      }
    }

    function renderSection(title, key, turns, container) {
      if (!turns.length) return;

      const sec = document.createElement("div");
      sec.className = "tgpt-section";

      const header = document.createElement("div");
      header.className = "tgpt-section-header";

      const left = document.createElement("div");
      left.className = "tgpt-section-title";
      left.textContent = `${title} (${turns.length})`;

      const toggle = document.createElement("button");
      toggle.className = "tgpt-section-toggle";
      toggle.textContent = state.sections[key] ? "Hide" : "Show";
      toggle.onclick = () => toggleSection(key);

      header.appendChild(left);
      header.appendChild(toggle);
      sec.appendChild(header);

      if (state.sections[key]) {
        turns.forEach((turn) => {
          const item = document.createElement("div");
          item.className = "tgpt-item" + (turn.id === state.currentId ? " current" : "");

          const row = document.createElement("div");
          row.className = "tgpt-row";

          const main = document.createElement("div");
          main.className = "tgpt-main";
          main.onclick = () => jumpToTurn(turn);

          const meta = document.createElement("div");
          meta.className = "tgpt-meta";
          meta.textContent = (turn.role === "user" ? "User" : "Assistant") + " • Turn " + turn.index;

          const label = document.createElement("div");
          label.className = "tgpt-label";
          label.textContent = effectiveLabel(turn);

          main.appendChild(meta);
          main.appendChild(label);

          const actions = document.createElement("div");
          actions.className = "tgpt-actions";

          const star = document.createElement("button");
          star.className = "tgpt-icon-btn";
          star.textContent = state.bookmarks[turn.id] ? "★" : "☆";
          star.onclick = (e) => {
            e.stopPropagation();
            toggleBookmark(turn.id);
          };

          const note = document.createElement("button");
          note.className = "tgpt-icon-btn";
          note.textContent = "✎";
          note.onclick = (e) => {
            e.stopPropagation();
            editNote(turn.id);
          };

          const rename = document.createElement("button");
          rename.className = "tgpt-icon-btn";
          rename.textContent = "T";
          rename.onclick = (e) => {
            e.stopPropagation();
            renameTurn(turn.id);
          };

          actions.appendChild(star);
          actions.appendChild(note);
          actions.appendChild(rename);

          row.appendChild(main);
          row.appendChild(actions);
          item.appendChild(row);

          if (state.notes[turn.id]) {
            const noteBox = document.createElement("div");
            noteBox.className = "tgpt-note";
            noteBox.textContent = state.notes[turn.id];
            item.appendChild(noteBox);
          }

          sec.appendChild(item);
        });
      }

      container.appendChild(sec);
    }

    function renderGlobalBookmarks(container) {
      const entries = Object.values(state.globalBookmarks)
        .sort((a, b) => (b.ts || 0) - (a.ts || 0));

      if (!entries.length) {
        const empty = document.createElement("div");
        empty.style.padding = "18px 6px";
        empty.style.color = "#666";
        empty.textContent = "No bookmarks across any conversation yet.";
        container.appendChild(empty);
        return;
      }

      // Apply search filter
      const q = state.search ? state.search.toLowerCase() : "";
      const filtered = q
        ? entries.filter((e) =>
            (e.label || "").toLowerCase().includes(q) ||
            (e.snippet || "").toLowerCase().includes(q) ||
            (e.convTitle || "").toLowerCase().includes(q) ||
            (e.note || "").toLowerCase().includes(q)
          )
        : entries;

      if (!filtered.length) {
        const empty = document.createElement("div");
        empty.style.padding = "18px 6px";
        empty.style.color = "#666";
        empty.textContent = "No bookmarks match your search.";
        container.appendChild(empty);
        return;
      }

      // Group by conversation
      const groups = {};
      for (const entry of filtered) {
        const cid = entry.convId || "__unknown__";
        if (!groups[cid]) groups[cid] = [];
        groups[cid].push(entry);
      }

      // Sort groups by most recent bookmark in each
      const sortedGroups = Object.entries(groups).sort((a, b) => {
        const aMax = Math.max(...a[1].map((e) => e.ts || 0));
        const bMax = Math.max(...b[1].map((e) => e.ts || 0));
        return bMax - aMax;
      });

      for (const [cid, groupEntries] of sortedGroups) {
        const isCurrent = cid === state.convId;
        const convTitle = state.convTitles[cid] || groupEntries[0]?.convTitle || "Unknown conversation";

        const header = document.createElement("div");
        header.className = "tgpt-conv-header";
        header.textContent = truncate(convTitle, 50);

        const siteBadge = document.createElement("span");
        siteBadge.className = "tgpt-conv-badge";
        siteBadge.textContent = groupEntries[0]?.site === "claude" ? "Claude" : "ChatGPT";
        header.appendChild(siteBadge);

        if (isCurrent) {
          const badge = document.createElement("span");
          badge.className = "tgpt-conv-badge";
          badge.textContent = "current";
          header.appendChild(badge);
        }

        container.appendChild(header);

        // Sort entries within group by turn index
        groupEntries.sort((a, b) => (a.turnIndex || 0) - (b.turnIndex || 0));

        for (const entry of groupEntries) {
          const item = document.createElement("div");
          item.className = "tgpt-item" + (isCurrent ? "" : " cross-conv");

          const row = document.createElement("div");
          row.className = "tgpt-row";

          const main = document.createElement("div");
          main.className = "tgpt-main";
          main.onclick = () => navigateToBookmark(entry);

          const meta = document.createElement("div");
          meta.className = "tgpt-meta";

          const roleLabel = entry.role === "user" ? "User" : "Assistant";
          const timeLabel = relativeTime(entry.ts);
          meta.textContent = roleLabel + " • Turn " + (entry.turnIndex || "?");

          if (timeLabel) {
            const timeSpan = document.createElement("span");
            timeSpan.className = "tgpt-global-time";
            timeSpan.textContent = timeLabel;
            meta.appendChild(timeSpan);
          }

          const label = document.createElement("div");
          label.className = "tgpt-label";
          label.textContent = entry.label || entry.turnId;

          main.appendChild(meta);
          main.appendChild(label);

          if (entry.snippet) {
            const snippetEl = document.createElement("div");
            snippetEl.className = "tgpt-snippet";
            snippetEl.textContent = entry.snippet;
            main.appendChild(snippetEl);
          }

          const actions = document.createElement("div");
          actions.className = "tgpt-actions";

          const remove = document.createElement("button");
          remove.className = "tgpt-icon-btn";
          remove.textContent = "✕";
          remove.title = "Remove bookmark";
          remove.onclick = (e) => {
            e.stopPropagation();
            removeGlobalBookmark(entry.convId, entry.turnId);
          };

          actions.appendChild(remove);
          row.appendChild(main);
          row.appendChild(actions);
          item.appendChild(row);

          if (entry.note) {
            const noteBox = document.createElement("div");
            noteBox.className = "tgpt-note";
            noteBox.textContent = entry.note;
            item.appendChild(noteBox);
          }

          container.appendChild(item);
        }
      }
    }

    async function removeGlobalBookmark(convId, turnId) {
      const gk = convId + ":" + turnId;
      delete state.globalBookmarks[gk];
      await storageSet(STORAGE_GLOBAL_BOOKMARKS, state.globalBookmarks);

      // Also remove from per-conversation bookmarks if it's the current conversation
      if (convId === state.convId && state.bookmarks[turnId]) {
        delete state.bookmarks[turnId];
        await storageSet(STORAGE_BOOKMARKS_PREFIX + state.convId, state.bookmarks);
      }

      renderAll();
    }

    function renderList() {
      if (!listEl) return;
      listEl.innerHTML = "";

      Object.keys(chips).forEach((key) => {
        chips[key].classList.toggle("active", state.filter === key);
      });

      // Global bookmarks view — shows all bookmarks across conversations
      if (state.filter === "all_bookmarks") {
        renderGlobalBookmarks(listEl);
        return;
      }

      const items = filteredTurns();
      if (!items.length) {
        const empty = document.createElement("div");
        empty.style.padding = "18px 6px";
        empty.style.color = "#666";
        empty.textContent = "No matching turns.";
        listEl.appendChild(empty);
        return;
      }

      if (state.filter === "all") {
        const bookmarked = items.filter((t) => state.bookmarks[t.id]);
        const userTurns = items.filter((t) => t.role === "user" && !state.bookmarks[t.id]);
        const assistantTurns = items.filter((t) => t.role === "assistant" && !state.bookmarks[t.id]);

        renderSection("Bookmarked", "bookmarked", bookmarked, listEl);
        renderSection("User", "user", userTurns, listEl);
        renderSection("Assistant", "assistant", assistantTurns, listEl);
      } else {
        renderSection(titleCase(state.filter), state.filter, items, listEl);
      }
    }

    function renderMini() {
      document.getElementById(MINI_ID)?.remove();
      if (!state.miniEnabled) return;
      if (!state.turns.length) return;

      mini = document.createElement("div");
      mini.id = MINI_ID;
      mini.style.right = state.layout === "right" ? "430px" : "8px";

      const track = document.createElement("div");
      track.className = "tgpt-mini-track";
      mini.appendChild(track);

      const count = state.turns.length;
      const usableHeight = Math.max(200, window.innerHeight - 140);
      const dotHeight = Math.max(4, Math.min(12, Math.floor(usableHeight / Math.max(count, 20))));

      state.turns.forEach((turn, idx) => {
        const dot = document.createElement("div");
        const pct = count === 1 ? 0 : idx / (count - 1);

        dot.className =
          "tgpt-mini-dot " +
          turn.role +
          (state.bookmarks[turn.id] ? " bookmarked" : "") +
          (turn.id === state.currentId ? " current" : "");

        dot.style.top = `calc(${(pct * 100).toFixed(3)}% - 2px)`;
        dot.style.height = `${dotHeight}px`;
        dot.title = `Turn ${turn.index}: ${effectiveLabel(turn)}`;
        dot.onclick = () => jumpToTurn(turn);

        track.appendChild(dot);
      });

      document.body.appendChild(mini);
    }

    function renderAll() {
      renderList();
      renderMini();
    }

    function observeCurrentTurn() {
      try { state.io && state.io.disconnect(); } catch {}

      if (!state.open || !state.trackCurrent) return;

      state.io = new IntersectionObserver((entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (!visible.length) return;

        const match = state.turns.find((t) => t.node === visible[0].target);
        if (match && match.id !== state.currentId) {
          state.currentId = match.id;
          renderList();
        }
      }, { root: null, threshold: [0.5] });

      state.turns.forEach((t) => state.io.observe(t.node));
    }

    async function reloadConversationState() {
      const newConvId = getConversationId();
      if (newConvId === state.convId) return;

      state.convId = newConvId;
      state.bookmarks = await storageGet(STORAGE_BOOKMARKS_PREFIX + newConvId, {});
      state.notes = await storageGet(STORAGE_NOTES_PREFIX + newConvId, {});
      state.titles = await storageGet(STORAGE_TITLES_PREFIX + newConvId, {});
      state.globalBookmarks = await storageGet(STORAGE_GLOBAL_BOOKMARKS, {});
      state.convTitles = await storageGet(STORAGE_CONV_TITLES, {});
      state.currentId = null;
    }

    function refreshTurns() {
      const previousCurrent = state.currentId;
      state.turns = getConversationTurns();

      if (!state.turns.length) {
        // Conversation may still be loading after a navigation —
        // clear stale UI so old turns don't linger.
        state.currentId = null;
        renderAll();
        return;
      }

      if (!state.turns.find((t) => t.id === previousCurrent)) {
        state.currentId = state.turns[0].id;
      }

      // Cache the conversation title for global bookmarks
      updateConvTitle();

      // Handle pending jump from a cross-conversation bookmark click
      if (state.pendingJump && state.pendingJump.convId === state.convId) {
        const targetId = state.pendingJump.turnId;
        state.pendingJump = null;
        storageSet(STORAGE_PENDING_JUMP, null);
        const target = state.turns.find((t) => t.id === targetId);
        if (target) {
          state.currentId = target.id;
          // Delay scroll so the DOM is settled
          setTimeout(() => jumpToTurn(target), 200);
        }
      }

      renderAll();
      observeCurrentTurn();

      if (state.aiMode && state.open) {
        idle(() => runAiDescriptorsForVisibleTurns());
      }
    }

    function buildUI() {
      injectStyles();

      const btn = document.createElement("button");
      btn.id = BTN_ID;
      btn.textContent = "Turns";
      btn.onclick = () => state.open ? closeDrawer() : openDrawer();
      document.body.appendChild(btn);

      drawer = document.createElement("div");
      drawer.id = DRAWER_ID;
      applyLayoutClass();

      const header = document.createElement("div");
      header.className = "tgpt-header";

      const grabber = document.createElement("div");
      grabber.className = "tgpt-grabber";

      const titleRow = document.createElement("div");
      titleRow.className = "tgpt-title-row";

      const title = document.createElement("div");
      title.className = "tgpt-title";
      title.textContent = "Turn Navigator";

      const close = document.createElement("button");
      close.className = "tgpt-close";
      close.textContent = "Close";
      close.onclick = closeDrawer;

      titleRow.appendChild(title);
      titleRow.appendChild(close);

      const navRow = document.createElement("div");
      navRow.className = "tgpt-nav-row";

      [
        ["← U", () => jumpRelative((t) => t.role === "user", "prev")],
        ["U →", () => jumpRelative((t) => t.role === "user", "next")],
        ["← A", () => jumpRelative((t) => t.role === "assistant", "prev")],
        ["A →", () => jumpRelative((t) => t.role === "assistant", "next")],
        ["★ →", () => jumpRelative((t) => !!state.bookmarks[t.id], "next")]
      ].forEach(([label, fn]) => {
        const b = document.createElement("button");
        b.className = "tgpt-nav-btn";
        b.textContent = label;
        b.onclick = fn;
        navRow.appendChild(b);
      });

      searchEl = document.createElement("input");
      searchEl.className = "tgpt-search";
      searchEl.placeholder = "Search turns";
      searchEl.addEventListener("input", () => {
        state.search = searchEl.value.trim();
        renderList();
      });

      const filters = document.createElement("div");
      filters.className = "tgpt-filters";

      ["all", "user", "assistant", "bookmarked", "all_bookmarks"].forEach((key) => {
        const chip = document.createElement("button");
        chip.className = "tgpt-chip";
        chip.textContent =
          key === "all" ? "All" :
          key === "user" ? "User" :
          key === "assistant" ? "Assistant" :
          key === "bookmarked" ? "Bookmarked" : "All ★";
        chip.onclick = () => {
          state.filter = key;
          renderList();
        };
        chips[key] = chip;
        filters.appendChild(chip);
      });

      const utilityRow = document.createElement("div");
      utilityRow.className = "tgpt-utility-row";

      const refreshBtn = document.createElement("button");
      refreshBtn.className = "tgpt-utility-btn";
      refreshBtn.textContent = "Refresh";
      refreshBtn.onclick = refreshTurns;

      const exportBtn = document.createElement("button");
      exportBtn.className = "tgpt-utility-btn";
      exportBtn.textContent = "Export ★";
      exportBtn.onclick = exportBookmarks;

      const miniBtn = document.createElement("button");
      miniBtn.className = "tgpt-utility-btn";
      miniBtn.textContent = state.miniEnabled ? "Mini-map On" : "Mini-map Off";
      miniBtn.onclick = async () => {
        await toggleMini();
        miniBtn.textContent = state.miniEnabled ? "Mini-map On" : "Mini-map Off";
      };

      const layoutBtn = document.createElement("button");
      layoutBtn.className = "tgpt-utility-btn";
      layoutBtn.textContent = state.layout === "right" ? "Bottom Drawer" : "Right Drawer";
      layoutBtn.onclick = async () => {
        await toggleLayout();
        layoutBtn.textContent = state.layout === "right" ? "Bottom Drawer" : "Right Drawer";
      };

      const aiBtn = document.createElement("button");
      aiBtn.className = "tgpt-utility-btn";
      aiBtn.textContent = state.aiMode ? "AI Labels On" : "AI Labels Off";
      aiBtn.onclick = async () => {
        await toggleAiMode();
        aiBtn.textContent = state.aiMode ? "AI Labels On" : "AI Labels Off";
      };

      const providerBtn = document.createElement("button");
      providerBtn.className = "tgpt-utility-btn";
      providerBtn.textContent =
        state.aiProvider === "auto" ? "Provider: Auto" :
        state.aiProvider === "lmstudio" ? "Provider: LM Studio" :
        "Provider: Ollama";
      providerBtn.onclick = async () => {
        await cycleAiProvider();
        providerBtn.textContent =
          state.aiProvider === "auto" ? "Provider: Auto" :
          state.aiProvider === "lmstudio" ? "Provider: LM Studio" :
          "Provider: Ollama";
      };

      const trackBtn = document.createElement("button");
      trackBtn.className = "tgpt-utility-btn";
      trackBtn.textContent = state.trackCurrent ? "Track Current On" : "Track Current Off";
      trackBtn.onclick = async () => {
        await toggleTrackCurrent();
        trackBtn.textContent = state.trackCurrent ? "Track Current On" : "Track Current Off";
      };

      utilityRow.appendChild(refreshBtn);
      utilityRow.appendChild(exportBtn);
      utilityRow.appendChild(miniBtn);
      utilityRow.appendChild(layoutBtn);
      utilityRow.appendChild(aiBtn);
      utilityRow.appendChild(providerBtn);
      utilityRow.appendChild(trackBtn);

      header.appendChild(grabber);
      header.appendChild(titleRow);
      header.appendChild(navRow);
      header.appendChild(searchEl);
      header.appendChild(filters);
      header.appendChild(utilityRow);

      listEl = document.createElement("div");
      listEl.className = "tgpt-list";

      drawer.appendChild(header);
      drawer.appendChild(listEl);
      document.body.appendChild(drawer);

      refreshTurns();

      if (state.layout === "right") {
        openDrawer();
      }
    }

    function registerKeyboardShortcuts() {
      state.keyHandler = (e) => {
        const target = e.target;
        const isTyping =
          target &&
          (target.tagName === "INPUT" ||
           target.tagName === "TEXTAREA" ||
           target.isContentEditable);

        if (isTyping) return;

        if (e.altKey && e.key.toLowerCase() === "t") {
          e.preventDefault();
          state.open ? closeDrawer() : openDrawer();
          return;
        }

        if (e.altKey && e.key.toLowerCase() === "u") {
          e.preventDefault();
          jumpRelative((t) => t.role === "user", "next");
          return;
        }

        if (e.altKey && e.key.toLowerCase() === "a") {
          e.preventDefault();
          jumpRelative((t) => t.role === "assistant", "next");
          return;
        }

        if (e.altKey && e.key.toLowerCase() === "b") {
          e.preventDefault();
          jumpRelative((t) => !!state.bookmarks[t.id], "next");
          return;
        }

        if (e.altKey && e.key.toLowerCase() === "r") {
          e.preventDefault();
          refreshTurns();
        }
      };

      document.addEventListener("keydown", state.keyHandler, true);
    }

    function startUrlPolling() {
      // Both ChatGPT and Claude are SPAs — URL changes happen via the History API with no
      // page reload.  Poll for href changes and auto-refresh when detected.
      if (urlPollInterval) clearInterval(urlPollInterval);

      urlPollInterval = setInterval(() => {
        if (location.href !== lastKnownUrl) {
          lastKnownUrl = location.href;
          // Small delay so the new conversation DOM has time to mount
          setTimeout(async () => {
            await reloadConversationState();
            refreshTurns();
            // If the DOM wasn't ready yet, retry once more
            if (!state.turns.length) {
              setTimeout(() => refreshTurns(), 1500);
            }
          }, 600);
        }
      }, 800);
    }

    function destroy() {
      try { state.io && state.io.disconnect(); } catch {}
      if (state.keyHandler) {
        document.removeEventListener("keydown", state.keyHandler, true);
      }
      if (urlPollInterval) {
        clearInterval(urlPollInterval);
        urlPollInterval = null;
      }
      document.getElementById(DRAWER_ID)?.remove();
      document.getElementById(BTN_ID)?.remove();
      document.getElementById(MINI_ID)?.remove();
      document.getElementById(STYLE_ID)?.remove();
    }

    window[APP_ID] = { destroy };
    buildUI();
    registerKeyboardShortcuts();
    startUrlPolling();
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "TGPT_TOGGLE_NAV") {
      createApp();
    }
  });
})();