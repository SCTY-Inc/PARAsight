# Parasight

Link saver with Twitter/X URL extraction. Saves links to markdown, serves them at [links.scty.org](https://links.scty.org).

## Features

- **Save links** via POST webhook with API key auth
- **Twitter extraction** - automatically extracts URLs from tweets (resolves t.co redirects)
- **Web UI** - minimal dark interface showing saved links by date
- **iOS Shortcut** - setup page at `/shortcut` for Safari share sheet integration
- **JSON API** - `GET /api/links` returns all links as JSON

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | No | Web UI with saved links |
| GET | `/health` | No | Health check |
| GET | `/shortcut` | No | iOS Shortcut setup instructions |
| GET | `/api/links` | No | JSON list of all links |
| POST | `/links` | Bearer token | Save a new link |

## API Usage

```bash
curl -X POST https://links.scty.org/links \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "title": "Example"}'
```

When saving a Twitter/X URL, Parasight extracts linked URLs from the tweet and saves those instead.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PARASIGHT_API_KEY` | Yes | Bearer token for POST auth |
| `PORT` | No | Server port (default: 18790) |
| `LINKS_FILE` | No | Path to markdown file (default: ./links.md) |
| `PROMPTS_DIR` | No | Static files directory for /prompts |

## Run

```bash
# Direct
PARASIGHT_API_KEY=your-key node server.js

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
