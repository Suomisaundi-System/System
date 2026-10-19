# Suomisaundi System — trusted bridge prototype

This is a **backend scaffold, not a deployed or operational Telegram database**.

Requires Node.js 20+, a trusted host, reverse proxy with TLS, and configured environment variables:
- `TELEGRAM_BOT_TOKEN` — secret bot credential, never committed.
- `TELEGRAM_CHAT_ID` — verified destination group identifier.
- `TELEGRAM_TOPIC_ID` — verified Telegram `message_thread_id` (not a topic message URL).
- `SYSTEM_INGEST_KEY` — trusted server-to-server API key. Never put it in public JavaScript.
- `ALLOWED_ORIGIN` — allowed website origin.
- `PORT` — optional, defaults to 8787.

Run: `node backend/server.mjs`

The server listens on loopback only. The ingest endpoint accepts authenticated **server-side** events, rate limits requests, retains only a bounded in-memory queue, and sends **redacted** event summaries to Telegram. It is not suitable as an authoritative persistent database. A public Telegram group is not an appropriate destination for raw IPs, personal data, session tokens, or secrets.

Future checkpoints: trusted authentication and bot verification; durable private storage; WebSocket/SSE browser sessions; queue persistence; worker registration; heartbeats and leases; task scheduling, retry, failover, and resource quotas. None of these are implemented by browser BroadcastChannel alone.
