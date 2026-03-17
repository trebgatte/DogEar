# Security Policy

## Overview

This project operates inside the browser and reads the current ChatGPT page in order to build navigation over the visible conversation.

It also supports optional local AI descriptor generation through localhost endpoints such as LM Studio and Ollama.

Because of that, security and privacy matter.

## Supported versions

Security fixes will generally target the latest version on the main branch.

## Reporting a vulnerability

Please report security issues privately to the maintainer rather than opening a public issue first.

Include:

- affected version
- reproduction steps
- impact
- suggested mitigation if known

## Security model

This extension is designed to be local-first.

### Data access
- The extension reads conversation content from the active ChatGPT page DOM.
- State is stored locally in `chrome.storage.local`.

### Local AI mode
If enabled, turn text may be sent to a local AI server running on the same machine, such as:
- LM Studio
- Ollama

This project does not require a remote backend.

### No built-in telemetry
This project does not intentionally send telemetry or analytics to a remote service.

## Risk areas

### 1. DOM extraction
Because the extension reads page content from ChatGPT’s DOM, browser context and page structure matter. If ChatGPT changes its UI, behavior may break.

### 2. Localhost model endpoints
If your local AI server is exposed beyond localhost or misconfigured, that creates risk outside the extension itself.

### 3. Clipboard export
The export feature copies bookmarked turn content to the clipboard. Treat exported content accordingly.

### 4. Future contributions
Any contribution that introduces:
- new host permissions
- remote endpoints
- background syncing
- telemetry
should be treated as security-sensitive and reviewed carefully.

## Recommended user precautions

- Keep local AI endpoints bound to localhost unless you intentionally need broader access.
- Review extension permissions before loading.
- Avoid enabling optional features you do not need.
- Do not assume conversation data is safe to export just because it is local.

## Non-goals

This project is not currently intended to be:
- a secure vault
- a compliance product
- a full conversation archival system

It is a navigation layer for working conversations.