# Contributing

Thanks for contributing.

## Principles

This project is not trying to be a giant framework. It is trying to be:

- useful
- inspectable
- local-first
- performance-conscious
- easy to modify

## Before contributing

Please open an issue if your proposed change is significant, especially for:

- architecture changes
- new permissions
- new external dependencies
- remote/cloud integrations
- telemetry
- UI behavior that affects performance

## Contribution priorities

High-value contributions include:

- more resilient turn extraction
- better performance on long conversations
- improved local AI descriptor quality
- clearer fallback behavior when local AI is unavailable
- UI compactness and usability improvements
- better documentation
- tests or repeatable QA procedures

## Things to avoid

Please avoid introducing:

- unnecessary remote services
- hidden telemetry
- excessive permissions
- heavy frameworks for simple problems
- features that significantly degrade typing or scroll responsiveness

## Development workflow

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Test on real ChatGPT conversations.
5. Update docs where relevant.
6. Submit a pull request with a clear explanation.

## Pull request guidance

A good PR should explain:

- what changed
- why it changed
- performance implications
- tradeoffs
- how it was tested

## Code style

Keep it simple.

- Prefer readable JavaScript over clever JavaScript.
- Avoid large abstractions unless they clearly pay for themselves.
- Name things clearly.
- Comment only where intent is not obvious.

## Testing checklist

When submitting UI or behavior changes, test:

- short conversation
- long conversation
- code-heavy conversation
- AI labels on/off
- LM Studio unavailable
- Ollama unavailable
- mini-map on/off
- current-turn tracking on/off

## Security-sensitive areas

Be especially careful with:

- localhost requests
- clipboard behavior
- storage usage
- new permissions
- any future export/import features