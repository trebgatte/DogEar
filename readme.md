# ChatGPT Turn Navigator

A Chrome extension that adds turn-by-turn navigation to long ChatGPT conversations.

It injects a lightweight in-page navigator into ChatGPT so you can jump directly to specific turns, bookmark important moments, rename turns, add notes, search across the thread, and optionally generate better labels using a local model via LM Studio or Ollama.

## Why this exists

Long ChatGPT conversations are powerful, but navigation quickly becomes painful. Scrolling works for short chats. It fails for working sessions.

This project adds structure to the conversation:

- jump to exact turns
- filter by user, assistant, or bookmarks
- keep notes on important turns
- rename turns with meaningful labels
- optionally generate better turn descriptors locally

## Features

- In-page **Turns** button
- Right-side drawer or bottom drawer layout
- Turn-by-turn navigation
- Search across turns
- Filters for:
  - All
  - User
  - Assistant
  - Bookmarked
- Bookmarks
- Notes
- Manual turn renaming
- Export bookmarked turns
- Optional mini-map
- Optional current-turn tracking
- Optional AI-generated labels using:
  - LM Studio
  - Ollama

## Design goals

- Fast enough to use during real work
- No required cloud dependency
- Local-first descriptor generation
- Usable on long threads
- Easy to inspect and modify

## Privacy

This extension is designed to be local-first.

- It reads the current ChatGPT page in your browser in order to build navigation.
- It stores extension state locally using `chrome.storage.local`.
- If AI labels are enabled, it sends turn text to a **local** model endpoint on your machine:
  - LM Studio
  - Ollama
- It does **not** send data to a remote server controlled by this project.

You are responsible for reviewing the code and configuring your local model environment appropriately.

## Requirements

- Google Chrome or another Chromium-based browser that supports Manifest V3
- ChatGPT in the browser at:
  - `https://chatgpt.com`
  - or `https://chat.openai.com`
- Optional:
  - LM Studio running locally
  - or Ollama running locally

## Installation

### Load unpacked extension

1. Clone or download this repository.
2. Open Chrome.
3. Go to `chrome://extensions`.
4. Turn on **Developer mode**.
5. Click **Load unpacked**.
6. Select the project folder.
7. Open ChatGPT in a browser tab.
8. Click the extension icon to toggle the navigator.

## Local AI setup

See:

- [`docs/local-ai-setup.md`](docs/local-ai-setup.md)

## How it works

- `content.js` injects the UI into the ChatGPT page and extracts turns from the DOM.
- `background.js` handles local AI descriptor requests.
- `chrome.storage.local` stores settings, notes, bookmarks, custom labels, and AI cache.

More detail:

- [`docs/architecture.md`](docs/architecture.md)

## Current status

This is an early but functional version. The main risk is that ChatGPT’s internal DOM may change over time. Since this extension does not use an official ChatGPT UI API, selector maintenance is part of the tradeoff.

## Known limitations

- DOM structure changes on ChatGPT may break turn detection.
- AI descriptor quality depends on your local model.
- Large conversations can still feel heavy if too many optional features are enabled at once.
- Mini-map and current-turn tracking are useful, but they can add overhead on slower machines or unstable connections.

## Recommended settings

For the best balance of utility and responsiveness:

- Mini-map: off by default
- Track current turn: off by default
- Refresh on open/manual
- AI labels: on if local model is available
- Provider: Auto

## Roadmap

See:

- [`docs/roadmap.md`](docs/roadmap.md)

## Contributing

See:

- [`CONTRIBUTING.md`](CONTRIBUTING.md)

## Security

See:

- [`SECURITY.md`](SECURITY.md)

## License

MIT