# Changelog

All notable changes to this project will be documented in this file.

## [1.3.0] - 2026-03-18

### Added
- **Claude support** — single extension now works on both ChatGPT and Claude
- Site detection (`getSite()`) routes to the correct DOM selectors, URL patterns, and title extraction per platform
- Claude DOM selectors: `[data-test-render-count]` for turns, `[data-testid="user-message"]` for user messages, `.font-claude-response` / `.standard-markdown` for assistant messages
- Claude conversation ID extraction from `/chat/{uuid}` and `/project/{uuid}/...` URL patterns
- Claude title extraction from `[data-testid="chat-title-button"]`
- Site badge ("ChatGPT" / "Claude") on global bookmark conversation headers
- `site` field on global bookmark entries for cross-platform navigation
- `convUrl()` helper generates the correct URL per platform

### Changed
- Extension name simplified to "Dogear" (covers both platforms)
- Host permissions include `chatgpt.com`, `chat.openai.com`, and `claude.ai`
- Content script matches all three domains
- `summarizeTurn()` generalized — no longer tied to extension-development-specific patterns
- Text extraction on Claude filters out tool-use labels, thinking summaries, and action buttons
- Storage keys remain at v122 — existing ChatGPT bookmarks carry over seamlessly into the unified extension

### Fixed
- Global bookmark cross-conversation navigation now works across platforms (ChatGPT bookmark clicked from Claude navigates correctly and vice versa)

## [1.2.2] - 2026-03-18

### Added
- URL change detection: navigator auto-refreshes when switching conversations
- Retry on navigation: if DOM isn't ready after a conversation switch, retries after 1.5s
- Conversation-scoped bookmarks, notes, and titles
- Global bookmarks view ("All ★" filter chip)
- Cross-conversation bookmark navigation with pending jump mechanism
- Conversation title cache
- Rich bookmark metadata (role, label, snippet, note, timestamp)
- Relative timestamps in global bookmark view
- Global bookmark export with conversation links
- Remove button on global bookmark entries

### Changed
- Storage keys bumped to v122
- Bookmark, rename, and note edits sync into global bookmark index
- Export adapts to current view

### Fixed
- Refresh button clears stale turns on empty DOM
- Switching conversations no longer leaves previous chat's turns
- Bookmarks no longer ghost across conversations
- currentId resets properly after navigation

## [1.2.1] - 2026-03-16

### Added
- Optional AI-generated turn labels via local model backends
- LM Studio / Ollama provider selection
- Current-turn tracking toggle
- Mini-map toggle
- Compact row layout for desktop
- Cached AI descriptors

### Changed
- Disabled mini-map by default
- Disabled current-turn tracking by default
- Reduced rerender churn
- Batched AI label updates

### Fixed
- Reduced performance impact from frequent rerenders
- Improved stability of turn navigation UI

## [1.2.0] - 2026-03-16

### Added
- Local AI descriptor support
- AI mode toggle
- Provider toggle for LM Studio / Ollama
- Context-window descriptor prompts

## [1.1.1] - 2026-03-16

### Changed
- Removed continuous DOM observation
- Refresh on open/manual instead of constant watching
- Improved heuristic summaries

## [1.1.0] - 2026-03-16

### Added
- Better heuristic descriptors
- Manual refresh
- Right-side layout option
- Keyboard shortcuts

## [1.0.0] - 2026-03-16

### Added
- Basic in-page turn navigator
- Search
- Filters
- Bookmarks
- Notes
- Rename
- Export bookmarked turns
