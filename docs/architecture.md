# DogEar Architecture

## Overview

DogEar is a browser extension (Manifest V3) that adds a structural navigation layer to long-form ChatGPT work sessions. It optionally integrates with a local AI model to auto-label conversation segments.

## Components

### `manifest.json`
Declares extension metadata, permissions, and entry points.

### `background.js` (Service Worker)
Runs in the extension's background context. Responsible for:
- Extension lifecycle management (install, update)
- Message routing between content scripts and extension storage
- (Future) Local AI communication

### `content.js` (Content Script)
Injected into ChatGPT pages. Responsible for:
- Detecting conversation structure (turns, topics)
- Rendering the DogEar navigation UI
- Sending/receiving messages to/from the background service worker

## Data Flow

```
ChatGPT Page
  └── content.js (DOM observation, UI rendering)
        └── chrome.runtime.sendMessage()
              └── background.js (storage, AI, coordination)
```

## Local AI Integration

See [local-ai-setup.md](local-ai-setup.md) for details on the optional local AI labeling feature.
