(() => {
  const APP_ID = "__chatgpt_turn_nav_v121_chrome__";
  const DRAWER_ID = "tgpt-turn-nav-drawer";
  const BTN_ID = "tgpt-turn-nav-button";
  const MINI_ID = "tgpt-turn-nav-mini";
  const STYLE_ID = "tgpt-turn-nav-style";

  const STORAGE_BOOKMARKS = "tgpt_turn_nav_bookmarks_v121";
  const STORAGE_NOTES = "tgpt_turn_nav_notes_v121";
  const STORAGE_TITLES = "tgpt_turn_nav_titles_v121";
  const STORAGE_SECTIONS = "tgpt_turn_nav_sections_v121";
  const STORAGE_MINI = "tgpt_turn_nav_mini_v121";
  const STORAGE_LAYOUT = "tgpt_turn_nav_layout_v121";
  const STORAGE_AI_MODE = "tgpt_turn_nav_ai_mode_v121";
  const STORAGE_AI_PROVIDER = "tgpt_turn_nav_ai_provider_v121";
  const STORAGE_AI_CACHE = "tgpt_turn_nav_ai_cache_v121";
  const STORAGE_AI_MODEL = "tgpt_turn_nav_ai_model_v121";
  const STORAGE_TRACK_CURRENT = "tgpt_turn_nav_track_current_v121";

  // [FIX 7] Max chars to hash for cache keys — avoids hashing huge turn bodies
  const HASH_PREFIX_LEN = 200;
  // [FIX 3] Max chars to run regex classification against
  const CLASSIFY_PREFIX_LEN = 500;
  // [FIX 1] Max concurrent AI requests
  const AI_CONCURRENCY = 3;

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
      .trim();
  }

  function getText(el) {
    return cleanText(el?.innerText || el?.textContent || "");
  }

  // [FIX 2] inferRole now accepts pre-computed text to avoid redundant innerText reads
  function inferRole(el, precomputedText) {
    if (
      el.getAttribute("data-message-author-role") === "user" ||
      el.querySelector("[data-message-author-role='user']")
    ) return "user";

    if (
      el.getAttribute("data-message-author-role") === "assistant" ||
      el.querySelector("[data-message-author-role='assistant']")
    ) return "assistant";

    // Reuse already-computed text instead of calling getText again
    const txt = (precomputedText || "").toLowerCase();
    if (txt.startsWith("you said:") || txt.startsWith("you")) return "user";
    if (txt.startsWith("chatgpt")) return "assistant";

    // [FIX 9] getBoundingClientRect is a last resort — still needed but now only
    // fires when data-attributes AND text heuristics both fail
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

  // [FIX 6] Debounce helper for search input
  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
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

  // [FIX 3] Run regex classification against a truncated prefix instead of full text
  function summarizeTurn(text, role, prevTurnText = "") {
    const raw = cleanText(text);
    const prev = cleanText(prevTurnText);

    if (!raw) return role === "user" ? "User message" : "Assistant response";

    const firstSentence = splitSentences(raw)[0] || raw;
    const first = truncate(stripLeadIns(firstSentence), 72);

    // Only scan the first CLASSIFY_PREFIX_LEN chars for pattern detection
    const sample = raw.slice(0, CLASSIFY_PREFIX_LEN);

    const codeFenceCount = (sample.match(/```/g) || []).length;
    const hasHeavyCode =
      codeFenceCount >= 2 ||
      /function\s+\w+\s*\(|const\s+\w+\s*=|let\s+\w+\s*=|class\s+\w+|=>|chrome\.|document\.|querySelector|addEventListener|manifest_version/i.test(sample);

    const hasConfigShape =
      /"manifest_version"\s*:|permissions"\s*:|host_permissions"\s*:|background"\s*:|action"\s*:|manifest_version/i.test(sample);

    const hasUiConstruction =
      /createElement|appendChild|className\s*=|style\.|innerHTML|textContent|DRAWER_ID|BTN_ID|MINI_ID/i.test(sample);

    const hasNavigationLogic =
      /scrollIntoView|IntersectionObserver|jumpToTurn|jumpRelative|currentId|observeCurrentTurn/i.test(sample);

    const hasStorageLogic =
      /chrome\.storage\.local|storageGet|storageSet|localStorage|getItem|setItem/i.test(sample);

    const hasRefreshLogic =
      /MutationObserver|refreshTurns|observeDOM|setTimeout\(refreshTurns/i.test(sample);

    const hasMessaging =
      /chrome\.runtime\.onMessage|chrome\.tabs\.sendMessage|sendMessage|onClicked/i.test(sample);

    const asksQuestion = sample.includes("?");
    const asksForBuild = /\b(build|create|make|implement|add|update|patch|fix)\b/i.test(sample);
    const asksForWriting = /\b(rewrite|draft|respond|email|post|prompt)\b/i.test(sample);
    const asksForExplanation = /\b(how|why|what would it take|is there another way|can you explain)\b/i.test(sample);

    if (role === "user") {
      if (asksQuestion && asksForExplanation) return truncate("Asks for approach: " + first, 78);
      if (asksQuestion) return truncate("Asks: " + first.replace(/\?+$/, ""), 78);
      if (asksForBuild) return truncate("Requests implementation: " + first, 78);
      if (asksForWriting) return truncate("Requests writing help: " + first, 78);
      return truncate("User: " + first, 78);
    }

    if (role === "assistant") {
      if (hasConfigShape) return "Defines extension manifest or config";
      if (hasMessaging) return "Implements extension messaging or toggle flow";
      if (hasStorageLogic) return "Adds storage-backed state handling";
      if (hasRefreshLogic) return "Implements refresh/update logic";
      if (hasNavigationLogic) return "Adds turn navigation behavior";
      if (hasUiConstruction) return "Builds injected navigator UI";
      if (hasHeavyCode && /content\.js|background\.js|manifest\.json/i.test((prev + " " + sample).slice(0, CLASSIFY_PREFIX_LEN * 2))) {
        return "Provides implementation for requested extension file";
      }
      if (hasHeavyCode) return "Provides implementation details";
      if (/\b(recommend|best approach|right move|should)\b/i.test(sample)) {
        return truncate("Recommends: " + first, 78);
      }
      if (/\b(explain|because|reason|tradeoff|limit)\b/i.test(sample)) {
        return truncate("Explains: " + first, 78);
      }
      return truncate("Assistant: " + first, 78);
    }

    return first;
  }

  function getMessageNodes() {
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

  // [FIX 2] getText is called once per node; the result is passed into inferRole
  function getConversationTurns() {
    const nodes = getMessageNodes();
    const turns = [];
    const seen = new Set();

    nodes.forEach((node, idx) => {
      if (!node || seen.has(node)) return;
      seen.add(node);

      const text = getText(node);
      if (!text || text.length < 2) return;

      const role = inferRole(node, text);
      const prevTurnText = turns.length ? turns[turns.length - 1].text : "";
      const turnId = "turn-" + (idx + 1);

      if (!node.id) node.id = turnId;

      turns.push({
        id: turnId,
        index: turns.length + 1,
        role,
        defaultLabel: summarizeTurn(text, role, prevTurnText),
        text,
        // [FIX 6] Pre-compute lowercase search text once at extraction time
        searchText: (text + " " + (turnId)).toLowerCase(),
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

    const state = {
      open: false,
      filter: "all",
      search: "",
      turns: [],
      currentId: null,
      io: null,
      keyHandler: null,
      bookmarks: await storageGet(STORAGE_BOOKMARKS, {}),
      notes: await storageGet(STORAGE_NOTES, {}),
      titles: await storageGet(STORAGE_TITLES, {}),
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
      // [FIX 8] Guard against duplicate AI batch runs
      aiBatchRunning: false
    };

    let drawer, listEl, searchEl, chips = {}, mini;

    function effectiveLabel(turn) {
      return state.titles[turn.id] || turn.defaultLabel;
    }

    // [FIX 7] Hash truncated prefixes instead of full turn text
    function turnCacheKey(turn, prevText = "", nextText = "") {
      return hashText([
        turn.role,
        prevText.slice(0, HASH_PREFIX_LEN),
        turn.text.slice(0, HASH_PREFIX_LEN),
        nextText.slice(0, HASH_PREFIX_LEN)
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
        // [FIX 1] Don't persist here — batch caller will persist once at the end
        return result;
      } catch {
        return null;
      } finally {
        state.aiInFlight.delete(cacheKey);
      }
    }

    // [FIX 1] Concurrent AI requests with a concurrency limiter, single cache persist
    async function runAiDescriptorsForVisibleTurns(limit = 24) {
      if (!state.aiMode || !state.turns.length) return;

      // [FIX 8] Prevent duplicate batch runs
      if (state.aiBatchRunning) return;
      state.aiBatchRunning = true;

      try {
        const batch = state.turns.slice(0, limit);
        let changed = false;

        // First pass: apply anything already cached (synchronous, fast)
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
          }
        }

        if (changed) {
          await storageSet(STORAGE_TITLES, state.titles);
          if (state.open) renderList();
          changed = false;
        }

        // Second pass: fetch uncached labels with bounded concurrency
        const uncached = [];
        for (let i = 0; i < batch.length; i++) {
          const turn = batch[i];
          const prevText = i > 0 ? batch[i - 1].text : "";
          const nextText = i < batch.length - 1 ? batch[i + 1].text : "";
          const cacheKey = turnCacheKey(turn, prevText, nextText);

          if (!state.aiCache[cacheKey]?.label) {
            uncached.push({ turn, prevText, nextText });
          }
        }

        if (uncached.length) {
          // Process in chunks of AI_CONCURRENCY
          for (let start = 0; start < uncached.length; start += AI_CONCURRENCY) {
            const chunk = uncached.slice(start, start + AI_CONCURRENCY);
            const results = await Promise.allSettled(
              chunk.map(({ turn, prevText, nextText }) =>
                summarizeTurnWithAI(turn, prevText, nextText)
                  .then((result) => ({ turn, result }))
              )
            );

            for (const settled of results) {
              if (settled.status !== "fulfilled") continue;
              const { turn, result } = settled.value;
              if (result?.label && state.titles[turn.id] !== result.label) {
                state.titles[turn.id] = result.label;
                changed = true;
              }
            }

            // Render incrementally after each chunk so labels appear progressively
            if (changed && state.open) {
              renderList();
            }
          }

          // [FIX 1] Single cache persist after all requests complete
          if (changed) {
            await storageSet(STORAGE_TITLES, state.titles);
            await persistAiCache();
          }
        }
      } finally {
        state.aiBatchRunning = false;
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

    // [FIX 4] Targeted DOM update helpers — avoid full re-render for single-item changes

    function updateBookmarkStar(turnId) {
      if (!listEl) return;
      // Find all items and update just the star button text
      const items = listEl.querySelectorAll(".tgpt-item");
      for (const item of items) {
        const main = item.querySelector(".tgpt-main");
        if (!main) continue;
        // Match by checking the meta text which includes turn index
        const star = item.querySelector(".tgpt-icon-btn");
        if (star) {
          // We need a reliable way to match turn IDs to DOM items.
          // Since we rebuild on bookmark toggle (sections change), fall through to renderAll.
        }
      }
    }

    async function toggleBookmark(turnId) {
      if (state.bookmarks[turnId]) delete state.bookmarks[turnId];
      else state.bookmarks[turnId] = true;
      await storageSet(STORAGE_BOOKMARKS, state.bookmarks);
      // Bookmarks change section membership, so a list re-render is needed,
      // but we can skip the mini-map rebuild if mini is disabled.
      renderList();
      if (state.miniEnabled) renderMini();
    }

    async function editNote(turnId) {
      const current = state.notes[turnId] || "";
      const next = prompt("Add or edit note for this turn:", current);
      if (next === null) return;
      if (next.trim()) state.notes[turnId] = next.trim();
      else delete state.notes[turnId];
      await storageSet(STORAGE_NOTES, state.notes);
      // Only the list needs updating — mini-map doesn't show notes
      renderList();
    }

    async function renameTurn(turnId) {
      const turn = state.turns.find((t) => t.id === turnId);
      if (!turn) return;
      const current = state.titles[turnId] || effectiveLabel(turn);
      const next = prompt("Rename this turn:", current);
      if (next === null) return;
      if (next.trim()) state.titles[turnId] = next.trim();
      else delete state.titles[turnId];
      await storageSet(STORAGE_TITLES, state.titles);
      // Only the list needs updating — mini-map tooltips use effectiveLabel
      // but rebuilding mini for a rename is overkill. Tooltip updates on next renderMini.
      renderList();
    }

    // [FIX 6] Use pre-computed searchText; notes and labels are appended at filter time
    //         but the heavy turn body is pre-lowercased.
    function filteredTurns() {
      return state.turns.filter((turn) => {
        if (state.filter === "user" && turn.role !== "user") return false;
        if (state.filter === "assistant" && turn.role !== "assistant") return false;
        if (state.filter === "bookmarked" && !state.bookmarks[turn.id]) return false;

        if (state.search) {
          const q = state.search.toLowerCase();
          // searchText is pre-lowercased turn body. Append label + notes on the fly
          // (these are short strings, so the cost is trivial).
          const label = effectiveLabel(turn).toLowerCase();
          const note = (state.notes[turn.id] || "").toLowerCase();
          if (
            !turn.searchText.includes(q) &&
            !label.includes(q) &&
            !note.includes(q)
          ) return false;
        }
        return true;
      });
    }

    function applyLayoutClass() {
      if (!drawer) return;
      drawer.classList.remove("layout-bottom", "layout-right");
      drawer.classList.add(state.layout === "bottom" ? "layout-bottom" : "layout-right");
    }

    function openDrawer() {
      drawer.classList.add("open");
      state.open = true;
      // [FIX 8] Single refresh path — refreshTurns already triggers AI descriptors
      setTimeout(() => refreshTurns(), 50);
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
      // [FIX 4] Only update current-highlight styling, not the whole mini-map
      updateCurrentHighlight(turn.id);
      if (state.layout === "bottom") closeDrawer();
    }

    // [FIX 4] Lightweight current-turn highlight update
    function updateCurrentHighlight(newCurrentId) {
      if (!listEl) return;

      // Update list items
      const items = listEl.querySelectorAll(".tgpt-item");
      items.forEach((item) => {
        // We store turn id on the element for efficient matching
        if (item.dataset.turnId === newCurrentId) {
          item.classList.add("current");
        } else {
          item.classList.remove("current");
        }
      });

      // Update mini-map dots
      if (state.miniEnabled && mini) {
        const dots = mini.querySelectorAll(".tgpt-mini-dot");
        dots.forEach((dot) => {
          if (dot.dataset.turnId === newCurrentId) {
            dot.classList.add("current");
          } else {
            dot.classList.remove("current");
          }
        });
      }
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
      const marked = state.turns.filter((t) => state.bookmarks[t.id]);
      if (!marked.length) {
        alert("No bookmarked turns yet.");
        return;
      }

      const content = marked.map((t) => {
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

    // [FIX 4] renderSection now stamps data-turn-id on items for targeted updates
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
          item.dataset.turnId = turn.id;

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

    function renderList() {
      if (!listEl) return;
      listEl.innerHTML = "";

      Object.keys(chips).forEach((key) => {
        chips[key].classList.toggle("active", state.filter === key);
      });

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

    // [FIX 5] renderMini stamps data-turn-id on dots for targeted updates
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

        dot.dataset.turnId = turn.id;
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
      // [FIX 5] Only rebuild mini-map if it's enabled
      if (state.miniEnabled) renderMini();
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
          // [FIX 4] Use targeted highlight update instead of full renderList
          updateCurrentHighlight(match.id);
        }
      }, { root: null, threshold: [0.5] });

      state.turns.forEach((t) => state.io.observe(t.node));
    }

    function refreshTurns() {
      const previousCurrent = state.currentId;
      state.turns = getConversationTurns();
      if (!state.turns.length) return;

      if (!state.turns.find((t) => t.id === previousCurrent)) {
        state.currentId = previousCurrent || state.turns[0].id;
      }

      renderAll();
      observeCurrentTurn();

      // [FIX 8] Single AI trigger point — openDrawer no longer duplicates this
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
      // [FIX 6] Debounced search input — 180ms delay prevents per-keystroke re-renders
      const debouncedSearch = debounce(() => {
        state.search = searchEl.value.trim();
        renderList();
      }, 180);
      searchEl.addEventListener("input", debouncedSearch);

      const filters = document.createElement("div");
      filters.className = "tgpt-filters";

      ["all", "user", "assistant", "bookmarked"].forEach((key) => {
        const chip = document.createElement("button");
        chip.className = "tgpt-chip";
        chip.textContent =
          key === "all" ? "All" :
          key === "user" ? "User" :
          key === "assistant" ? "Assistant" : "Bookmarked";
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

    function destroy() {
      try { state.io && state.io.disconnect(); } catch {}
      if (state.keyHandler) {
        document.removeEventListener("keydown", state.keyHandler, true);
      }
      document.getElementById(DRAWER_ID)?.remove();
      document.getElementById(BTN_ID)?.remove();
      document.getElementById(MINI_ID)?.remove();
      document.getElementById(STYLE_ID)?.remove();
    }

    window[APP_ID] = { destroy };
    buildUI();
    registerKeyboardShortcuts();
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "TGPT_TOGGLE_NAV") {
      createApp();
    }
  });
})();
