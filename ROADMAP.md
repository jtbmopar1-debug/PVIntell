# PVIntell roadmap

## Wattson conversation memory

Later enhancement after the core system records and workflows are stable:

- Add a per-system conversation-history screen with named, searchable conversations.
- Allow users to start, rename, archive and delete Wattson conversations.
- Summarize older conversations into durable project memory so important decisions, unresolved questions and confirmed facts remain available without sending the complete chat history to Gemini on every request.
- Keep structured system records as the source of truth; summaries must not silently turn suggestions or assumptions into installed facts.
- Provide links from remembered decisions back to their source conversation and date.
- Add user controls for memory retention, deletion and export.
- Track token usage so long-term memory remains cost-effective.

Current behavior: conversations are stored per power system with owner-only Supabase row-level security. The visible chat loads the latest 50 messages, while Wattson receives the latest 12 messages plus current structured system and connected-site context.

## Gemini usage optimisation

Development baseline observed on 14 August 2026: 20 API requests, 100% success, no reported API errors, with routing active between Gemini Flash Lite and the technical Flash model. Technical requests peaked at roughly 40K input tokens, indicating that complete project, sibling-system and conversation context will need optimisation before launch.

- Measure tokens and estimated cost by user, system, request type and model.
- Summarize older chat messages instead of repeatedly sending the full recent discussion.
- Send only relevant component specifications and connected systems for each question.
- Cache stable system-context summaries and invalidate them when records change.
- Keep safety-critical details lossless even when compacting context.
- Add usage budgets, alerts and graceful limits before public release.
