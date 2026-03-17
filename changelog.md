# Changelog

All notable changes to this project will be documented in this file.

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
- Improved compactness of turn rows

### Fixed
- Reduced performance impact from frequent rerenders
- Improved stability of turn navigation UI
- Improved visibility and positioning of mini-map when enabled

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
- Reduced typing lag from observer churn

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