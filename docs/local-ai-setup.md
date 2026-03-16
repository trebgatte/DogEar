# Local AI Setup

DogEar supports optional local AI labeling of conversation segments using a locally running language model.

## Requirements

- A locally running LLM server compatible with the OpenAI API format (e.g., [Ollama](https://ollama.ai), [LM Studio](https://lmstudio.ai))
- The server must be accessible from `localhost`

## Setup Steps

1. Install and start your local LLM server (e.g., Ollama with a suitable model)
2. Ensure the server is running and accessible (default: `http://localhost:11434`)
3. Open the DogEar extension options and configure the local AI endpoint
4. Enable local AI labeling in the extension settings

## Notes

- Local AI labeling is entirely optional; DogEar works without it
- No data is sent to external servers when using local AI
- Model quality and performance depend on your local hardware and chosen model

## Troubleshooting

- Verify your local AI server is running before enabling this feature
- Check browser console for any connection errors from `content.js`
- Ensure CORS is configured correctly on your local server to allow requests from browser extensions
