#!/usr/bin/env node
/**
 * Linkdrop
 * Save links from share sheet to markdown
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 18790;
const API_KEY = process.env.LINKDROP_API_KEY;
const LINKS_FILE = process.env.LINKS_FILE || path.join(__dirname, 'links.md');
const PROMPTS_DIR = process.env.PROMPTS_DIR || path.join(__dirname, 'prompts');

// ============ Twitter URL Extraction ============

function isTwitterUrl(url) {
  return /^https?:\/\/(x\.com|twitter\.com)\/\w+\/status\/\d+/.test(url);
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Linkdrop/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve({ redirect: res.headers.location });
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ data, statusCode: res.statusCode }));
    }).on('error', reject);
  });
}

async function followRedirect(url, maxHops = 5) {
  let current = url;
  for (let i = 0; i < maxHops; i++) {
    try {
      const result = await httpsGet(current);
      if (result.redirect) {
        current = result.redirect;
      } else {
        return current;
      }
    } catch {
      return current;
    }
  }
  return current;
}

async function extractUrlsFromTweet(tweetUrl) {
  try {
    // Normalize to twitter.com for oembed
    const normalizedUrl = tweetUrl.replace('x.com', 'twitter.com');
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(normalizedUrl)}`;

    const result = await httpsGet(oembedUrl);
    if (!result.data) return null;

    const oembed = JSON.parse(result.data);
    const html = oembed.html || '';

    // Extract t.co URLs from the tweet HTML (dedupe)
    const tcoMatches = [...new Set(html.match(/https:\/\/t\.co\/\w+/g) || [])];

    if (tcoMatches.length === 0) return null;

    // Follow redirects to get actual URLs
    const seenUrls = new Set();
    const resolvedUrls = [];

    // Get the tweet's status ID to filter self-references
    const statusMatch = tweetUrl.match(/status\/(\d+)/);
    const statusId = statusMatch ? statusMatch[1] : null;

    for (const tco of tcoMatches) {
      const resolved = await followRedirect(tco);

      // Skip exact self-references (link back to this tweet) and duplicates
      const isSelfRef = statusId && resolved.includes(`/status/${statusId}`);

      if (!isSelfRef && !seenUrls.has(resolved)) {
        seenUrls.add(resolved);
        resolvedUrls.push(resolved);
      }
    }

    return {
      urls: resolvedUrls,
      author: oembed.author_name,
      tweetUrl: tweetUrl
    };
  } catch (e) {
    console.error('Tweet extraction failed:', e.message);
    return null;
  }
}

// ============ End Twitter Extraction ============

if (!API_KEY) {
  console.error('ERROR: LINKDROP_API_KEY environment variable required');
  process.exit(1);
}

// Ensure links file exists
if (!fs.existsSync(LINKS_FILE)) {
  fs.writeFileSync(LINKS_FILE, '# Saved Links\n\n');
}

function parseLinks(content) {
  const links = [];
  const lines = content.split('\n');
  let currentDate = '';

  for (const line of lines) {
    const dateMatch = line.match(/^## (\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      currentDate = dateMatch[1];
      continue;
    }

    const linkMatch = line.match(/^- \[(\d{2}:\d{2})\] \[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      links.push({ date: currentDate, time: linkMatch[1], title: linkMatch[2], url: linkMatch[3] });
      continue;
    }

    const bareMatch = line.match(/^- \[(\d{2}:\d{2})\] <([^>]+)>/);
    if (bareMatch) {
      links.push({ date: currentDate, time: bareMatch[1], title: '', url: bareMatch[2] });
    }
  }

  return links.reverse(); // newest first
}

function renderLinksPage(content) {
  const links = parseLinks(content);

  // Group by date
  const byDate = {};
  for (const l of links) {
    if (!byDate[l.date]) byDate[l.date] = [];
    byDate[l.date].push(l);
  }

  // Format URL for display (strip protocol, truncate)
  const formatUrl = (url) => {
    try {
      const u = new URL(url);
      let display = u.hostname.replace(/^www\./, '') + u.pathname;
      if (display.length > 50) display = display.slice(0, 47) + '...';
      return display;
    } catch {
      return url.length > 50 ? url.slice(0, 47) + '...' : url;
    }
  };

  const sections = Object.entries(byDate).map(([date, items]) => {
    const rows = items.map(l => {
      const display = l.title || formatUrl(l.url);
      return `<a href="${l.url}">${display}</a>`;
    }).join('\n');
    return `<section><div class="label">${date}</div>\n${rows}</section>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>links</title>
  <style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font: 15px/1.6 -apple-system, system-ui, sans-serif; background: #111; color: #888; padding: 2rem; max-width: 800px; margin: 0 auto; }
h1 { color: #ccc; font-size: 14px; font-weight: normal; letter-spacing: 0.5px; margin-bottom: 2rem; }
section { margin-bottom: 2rem; }
.label { font-size: 12px; color: #555; margin-bottom: 0.5rem; }
a { display: block; color: #ccc; text-decoration: none; padding: 0.2rem 0; }
a:hover { color: #fff; }
  </style>
</head>
<body>
  <h1>links</h1>
${sections}
</body>
</html>`;
}

function getShortcutPage(host) {
  const baseUrl = host ? `https://${host}` : 'https://your-domain.com';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Install Save Link Shortcut</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background: #0d1117;
      color: #c9d1d9;
      line-height: 1.6;
    }
    h1 { color: #58a6ff; }
    h2 { color: #8b949e; font-size: 1.1em; margin-top: 30px; }
    .step {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 16px;
      margin: 12px 0;
    }
    .step-num {
      background: #58a6ff;
      color: #0d1117;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      margin-right: 8px;
    }
    code {
      background: #21262d;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.9em;
      word-break: break-all;
    }
    .code-block {
      background: #21262d;
      padding: 12px;
      border-radius: 6px;
      margin: 10px 0;
      overflow-x: auto;
    }
    .copy-btn {
      background: #238636;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      margin-top: 8px;
    }
    .copy-btn:active { background: #2ea043; }
    a { color: #58a6ff; }
  </style>
</head>
<body>
  <h1>Save Link Shortcut</h1>
  <p>Add this shortcut to quickly save links from Safari's share sheet.</p>

  <h2>Setup (2 minutes)</h2>

  <div class="step">
    <span class="step-num">1</span>
    <strong>Open Shortcuts app</strong> and tap <strong>+</strong> to create new shortcut
  </div>

  <div class="step">
    <span class="step-num">2</span>
    <strong>Add action:</strong> "Get Contents of URL"
  </div>

  <div class="step">
    <span class="step-num">3</span>
    <strong>Configure the action:</strong><br><br>
    URL: <code>${baseUrl}/links</code><br><br>
    Method: <code>POST</code><br><br>
    Headers (tap "Add new header" twice):<br>
    <div class="code-block">
      Authorization: Bearer YOUR_API_KEY<br>
      Content-Type: application/json
    </div>
    Request Body: <code>JSON</code><br><br>
    Add two fields:<br>
    &bull; <code>url</code> &rarr; Select "Shortcut Input"<br>
    &bull; <code>title</code> &rarr; Add action "Get Name" first, then select it
  </div>

  <div class="step">
    <span class="step-num">4</span>
    <strong>Tap the name</strong> at top, rename to "Save Link"
  </div>

  <div class="step">
    <span class="step-num">5</span>
    <strong>Tap the settings icon</strong> (top right) &rarr; enable "Show in Share Sheet"<br>
    Set "Receives" to "URLs"
  </div>

  <h2>Test It</h2>
  <p>Open Safari, tap Share, and select "Save Link" from your shortcuts.</p>

</body>
</html>`;
}

function getDateHeader() {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

function getTimeStamp() {
  const now = new Date();
  return now.toTimeString().split(' ')[0].slice(0, 5); // HH:MM
}

function appendLinkEntry(url, title, source = null) {
  const today = getDateHeader();
  const time = getTimeStamp();

  let content = fs.readFileSync(LINKS_FILE, 'utf8');

  // Check if today's section exists
  if (!content.includes(`## ${today}`)) {
    content += `\n## ${today}\n\n`;
  }

  // Format the link entry
  let entry;
  if (title) {
    entry = `- [${time}] [${title}](${url})`;
  } else {
    entry = `- [${time}] <${url}>`;
  }

  // Add source attribution for extracted links
  if (source) {
    entry += ` *(via [@${source.author}](${source.tweetUrl}))*`;
  }
  entry += '\n';

  // Append to today's section
  const sections = content.split(/(?=\n## \d{4}-\d{2}-\d{2})/);
  const lastSection = sections[sections.length - 1];
  sections[sections.length - 1] = lastSection + entry;

  fs.writeFileSync(LINKS_FILE, sections.join(''));
  return { date: today, time, url, title, source };
}

async function appendLink(url, title) {
  // Check if it's a Twitter/X URL
  if (isTwitterUrl(url)) {
    console.log(`Detected tweet URL, extracting links...`);
    const extracted = await extractUrlsFromTweet(url);

    if (extracted && extracted.urls.length > 0) {
      // Save extracted URLs instead of tweet
      const results = [];
      for (const extractedUrl of extracted.urls) {
        const result = appendLinkEntry(extractedUrl, null, {
          author: extracted.author,
          tweetUrl: url
        });
        results.push(result);
        console.log(`Extracted: ${extractedUrl} (from @${extracted.author})`);
      }
      return results[0]; // Return first for response
    } else {
      console.log(`No external links found in tweet, saving tweet URL`);
    }
  }

  // Regular URL or fallback
  return appendLinkEntry(url, title);
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // Prompts library static files (handles /prompts path from both direct access and Traefik addPrefix)
  if (req.method === 'GET' && req.url.startsWith('/prompts')) {
    // Strip /prompts prefix, query string, and default to index.html
    let urlPath = req.url.split('?')[0].replace(/^\/prompts\/?/, '/');
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

    const filePath = path.join(PROMPTS_DIR, urlPath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const contentType = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
      }[ext] || 'text/plain';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, must-revalidate'
      });
      res.end(fs.readFileSync(filePath));
      return;
    }
  }

  // Main page - show links
  if (req.method === 'GET' && (req.url === '/' || req.url === '')) {
    const content = fs.readFileSync(LINKS_FILE, 'utf8');
    const html = renderLinksPage(content);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  // Shortcut installer page
  if (req.method === 'GET' && req.url === '/shortcut') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(getShortcutPage(req.headers.host));
    return;
  }

  // JSON API - get links
  if (req.method === 'GET' && req.url === '/api/links') {
    const content = fs.readFileSync(LINKS_FILE, 'utf8');
    const links = parseLinks(content);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ links }));
    return;
  }

  // Only accept POST /links
  if (req.method !== 'POST' || req.url !== '/links') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  // Check auth
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${API_KEY}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  // Parse body
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const data = JSON.parse(body);

      if (!data.url) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'url is required' }));
        return;
      }

      const result = await appendLink(data.url, data.title);
      console.log(`[${result.date} ${result.time}] Saved: ${result.url}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...result }));
    } catch (e) {
      console.error('Error processing link:', e);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Linkdrop running on http://127.0.0.1:${PORT}`);
  console.log(`Links file: ${LINKS_FILE}`);
});
