# Local AI Setup

This extension supports optional AI-generated turn labels using a local model.

Supported providers:

- LM Studio
- Ollama

## How provider selection works

Provider modes:

- `Auto`
- `LM Studio`
- `Ollama`

`Auto` tries LM Studio first, then falls back to Ollama.

## LM Studio setup

1. Open LM Studio.
2. Load a model suitable for concise instruction following.
3. Start the local server.
4. Confirm the OpenAI-compatible endpoint is available on localhost.

Typical local endpoint:

- `http://localhost:1234/v1`

Recommended model characteristics:

- instruction-tuned
- fast enough for short summaries
- good at concise labeling

Good candidates are typically small-to-mid instruct models.

## Ollama setup

1. Install Ollama.
2. Pull a suitable model.
3. Start Ollama if it is not already running.
4. Confirm the local API is available.

Typical local endpoint:

- `http://localhost:11434/api`

Recommended model characteristics:

- good instruction following
- short-form summarization
- reasonable latency

## Troubleshooting

### No AI labels appear
Check:
- local server is running
- extension has been reloaded after permission changes
- provider is set correctly
- AI Labels is turned on

### LM Studio not responding
Try:
- switching provider to `Ollama`
- confirming the local server is actually started
- checking localhost port availability

### Ollama not responding
Try:
- verifying Ollama is running
- verifying the model exists locally
- switching provider to `Auto` or `LM Studio`

### Labels are too generic
Possible causes:
- model too weak
- model too small
- local server latency causing fallback use
- heuristic fallback still being used

Try:
- a stronger instruct model
- manual Refresh after the drawer opens
- checking whether AI mode is actually on

## Privacy note

If AI labels are enabled, turn text is sent to your local model endpoint on your own machine. This project does not require a remote summarization backend.