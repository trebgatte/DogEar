# Architecture

## Overview

The extension has two main parts:

- `content.js`
- `background.js`

### `content.js`
Runs in the ChatGPT page context and is responsible for:

- finding conversation turns in the DOM
- injecting the navigator UI
- handling bookmarks, notes, rename, filters, and search
- storing local state in `chrome.storage.local`
- requesting optional AI labels from the background worker

### `background.js`
Runs as the extension service worker and is responsible for:

- toggling the extension on toolbar click
- calling local AI endpoints
- trying LM Studio first when provider is `auto`
- falling back to Ollama when LM Studio is unavailable

## State model

The extension stores local state in `chrome.storage.local`.

Examples:

- bookmarks
- notes
- manual titles
- section visibility
- mini-map enabled/disabled
- layout mode
- AI provider mode
- AI descriptor cache
- current-turn tracking preference

## Turn extraction

The extension attempts to find ChatGPT turns using a small set of fallback selectors. This is necessarily heuristic because ChatGPT does not expose a stable turn-navigation DOM API for this project.

The current approach favors:

- low complexity
- easy maintenance
- fallback selectors over overengineering

## Descriptor generation

There are two descriptor paths:

### 1. Heuristic labels
Fast fallback labels generated directly from turn text.

Used when:
- AI labels are off
- local model is unavailable
- cache is missing and no AI result is returned

### 2. Local AI labels
Optional labels generated from a local model with a small context window:

- previous turn
- current turn
- next turn

This gives better results for short or context-dependent turns.

## Performance strategy

Performance matters because ChatGPT’s web app is already heavy.

This project intentionally avoids always-on page polling.

Current strategy:

- refresh on drawer open
- refresh on explicit manual action
- no continuous DOM observation
- mini-map off by default
- current-turn tracking off by default
- batch AI label updates instead of rerendering after every result

## Main tradeoffs

### Strengths
- local-first
- no required remote backend
- practical utility on long conversations
- extensible without much ceremony

### Weaknesses
- DOM coupling to ChatGPT
- selector maintenance over time
- AI label quality depends on the user’s local model
- optional features can still add overhead on very large threads
