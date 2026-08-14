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
