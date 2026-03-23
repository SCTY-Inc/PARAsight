# Linkdrop

A link inbox for humans and agents. Save URLs from your phone's share sheet, browse them in a minimal web UI, and let AI agents consume them via JSON API or markdown.

No database — just a markdown file.

## How it works

1. **Drop** — tap Share in Safari, run the iOS Shortcut (setup at `/shortcut`)
2. **Browse** — minimal dark web UI shows saved links grouped by date
3. **Feed agents** — `GET /api/links` returns JSON; the raw `links.md` file is readable by any agent or script

Twitter/X links are automatically unpacked — Linkdrop resolves t.co redirects and saves the actual URLs instead of the tweet.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | No | Web UI — saved links by date |
| GET | `/health` | No | Health check |
| GET | `/shortcut` | No | iOS Shortcut setup instructions |
| GET | `/api/links` | No | All links as JSON |
| POST | `/links` | Bearer token | Save a new link |

## API

```bash
curl -X POST https://your-domain.com/links \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "title": "Example"}'
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LINKDROP_API_KEY` | Yes | Bearer token for POST auth |
| `PORT` | No | Server port (default: 18790) |
| `LINKS_FILE` | No | Path to markdown file (default: ./links.md) |

## Run

```bash
# Direct
LINKDROP_API_KEY=your-key node server.js

# Docker
docker compose up -d
```

## Storage

Links are stored in `links.md` as markdown:

```markdown
## 2025-01-25

- [14:32] [Example Site](https://example.com)
- [14:35] <https://bare-url.com>
- [14:40] [Extracted Link](https://extracted.com) *(via [@user](https://x.com/user/status/123))*
```
