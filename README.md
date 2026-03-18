# Dogear

A Chrome extension that adds turn-by-turn navigation to long conversations on ChatGPT and Claude.

One install. Works on both sites. Bookmark turns, jump between them, search, take notes, and navigate across conversations — even across platforms.

## Why this exists

Long AI conversations are powerful, but navigating them is painful. Scrolling works for short chats. It breaks down in working sessions with dozens or hundreds of turns.

Dogear adds structure to the conversation without changing how you work:

- jump to exact turns instantly
- bookmark the moments that matter
- search across every turn in the thread
- keep notes alongside specific turns
- rename turns with meaningful labels
- view all your bookmarks across every conversation, on both platforms
- click a bookmark to navigate to the original conversation and turn

## Supported platforms

- [ChatGPT](https://chatgpt.com) (`chatgpt.com`, `chat.openai.com`)
- [Claude](https://claude.ai) (`claude.ai`)

## Features

### Navigation
- In-page **Turns** button injects a drawer into the conversation
- Right-side drawer or bottom drawer layout
- Jump forward/backward by user turns, assistant turns, or bookmarks
- Keyboard shortcuts (Alt+T toggle, Alt+U user, Alt+A assistant, Alt+B bookmark, Alt+R refresh)
- Optional mini-map showing all turns at a glance
- Optional current-turn tracking via IntersectionObserver

### Bookmarks and notes
- Bookmark any turn with one click
- Add notes to any turn
- Rename turns with custom labels
- Export bookmarked turns to clipboard

### Global bookmarks
- **All ★** filter shows every bookmark across all conversations on both platforms
- Each bookmark stores the conversation title, turn label, text snippet, timestamp, and platform
- Click a bookmark from any conversation to navigate there — cross-conversation, cross-platform
- Bookmarks from ChatGPT and Claude are grouped separately with platform badges
- Remove individual bookmarks from the global view

### Search and filtering
- Full-text search across all turns in the current conversation
- Filter by: All, User, Assistant, Bookmarked, or All ★ (global)

### AI-generated labels
- Optionally generate better turn labels using a local model
- Supports LM Studio and Ollama
- Labels are cached and persist across sessions
- No cloud dependency — runs entirely on your machine

## Design goals

- Fast enough to use during real work
- No required cloud dependency
- Local-first in every respect
- Usable on long threads (100+ turns)
- Easy to inspect and modify
- Single codebase for both platforms

## Privacy

This extension is local-first.

- It reads the current page DOM to build navigation. It does not access conversation data through any API.
- All state is stored locally in `chrome.storage.local`.
- If AI labels are enabled, turn text is sent to a local model endpoint on your machine (LM Studio or Ollama). Nothing leaves your machine.
- It does **not** send data to any remote server controlled by this project.
- It does **not** include telemetry, analytics, or tracking of any kind.

You are responsible for reviewing the code and configuring your local model environment appropriately.

## Requirements

- Google Chrome or another Chromium-based browser that supports Manifest V3
- At least one of:
  - ChatGPT at `https://chatgpt.com` or `https://chat.openai.com`
  - Claude at `https://claude.ai`
- Optional:
  - [LM Studio](https://lmstudio.ai) running locally
  - or [Ollama](https://ollama.ai) running locally

## Installation

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked**.
5. Select the project folder.
6. Open ChatGPT or Claude in a browser tab.
7. Click the Dogear extension icon to toggle the navigator.

## Local AI setup

See [`docs/local-ai-setup.md`](docs/local-ai-setup.md)

## How it works

- `content.js` detects which platform you're on, injects the navigator UI, and extracts turns from the DOM using site-specific selectors.
- `background.js` handles local AI descriptor requests via LM Studio or Ollama.
- `chrome.storage.local` stores all settings, bookmarks, notes, custom labels, global bookmark index, conversation titles, and AI cache.
- URL polling detects SPA navigation (conversation switches) and auto-refreshes the turn list.
- A pending-jump mechanism enables cross-conversation bookmark navigation, even across platforms.

### Site-specific selectors

| | ChatGPT | Claude |
|---|---|---|
| Turn containers | `article`, `[data-message-author-role]` | `[data-test-render-count]` |
| User messages | `[data-message-author-role="user"]` | `[data-testid="user-message"]` |
| Assistant messages | `[data-message-author-role="assistant"]` | `[data-is-streaming]`, `.font-claude-response` |
| Conversation title | `document.title` | `[data-testid="chat-title-button"]` |
| Conversation ID | URL path `/c/{id}` | Last UUID in URL path |

More detail: [`docs/architecture.md`](docs/architecture.md)

## Current status

Functional and actively developed. The main ongoing risk is that both ChatGPT and Claude may change their internal DOM at any time. Since this extension reads page structure directly rather than using an official API, selector maintenance is part of the tradeoff.

## Known limitations

- DOM structure changes on either platform may break turn detection. The extension uses fallback selectors to reduce fragility, but major redesigns will require updates.
- AI descriptor quality depends entirely on your local model.
- Large conversations can feel heavy if too many optional features (mini-map, current-turn tracking, AI labels) are all enabled at once.
- Cross-platform bookmark navigation (e.g., clicking a ChatGPT bookmark while on Claude) triggers a full page navigation to the other site.
- Claude's thinking/tool-use sections are filtered from turn text extraction, but edge cases may exist.

## Recommended settings

For the best balance of utility and responsiveness:

- Mini-map: off
- Track current turn: off
- AI labels: on if a local model is available
- Provider: Auto
- Layout: right drawer

## Roadmap

See [`docs/roadmap.md`](docs/roadmap.md)

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md)

## Security

See [`SECURITY.md`](SECURITY.md)

## License

MIT
