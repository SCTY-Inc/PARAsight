const assert = require("node:assert/strict");
const { mkdtemp, readFile, readdir, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createDropServer } = require("../server.js");

async function withServer(run) {
  const captureDir = await mkdtemp(path.join(tmpdir(), "drop-test-"));
  const server = createDropServer({
    captureDir,
    now: () => new Date("2026-08-07T14:15:16.000Z"),
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run({ baseUrl, captureDir });
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(captureDir, { recursive: true, force: true });
  }
}

async function captureDirectories(captureDir) {
  return (await readdir(captureDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name);
}

test("serves a fast generic Drop page instead of a link feed", async () => {
  await withServer(async ({ baseUrl }) => {
    const response = await fetch(baseUrl);
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.match(body, /<title>Drop<\/title>/);
    assert.match(body, /Paste a link or text/);
    assert.match(body, /Note \(optional\)/);
    assert.match(body, /type="file"/);
    assert.doesNotMatch(body, /Access key/);
    assert.doesNotMatch(body, /Saved Links/);
  });
});

test("serves desktop and Apple shortcut icons", async () => {
  await withServer(async ({ baseUrl }) => {
    const page = await (await fetch(baseUrl)).text();
    assert.match(page, /rel="icon"[^>]+href="icon\.svg"/);
    assert.match(page, /rel="apple-touch-icon"[^>]+href="apple-touch-icon\.png"/);

    const svgResponse = await fetch(`${baseUrl}/icon.svg`);
    assert.equal(svgResponse.status, 200);
    assert.match(svgResponse.headers.get("content-type"), /^image\/svg\+xml/);
    assert.match(await svgResponse.text(), /aria-label="Drop"/);

    const pngResponse = await fetch(`${baseUrl}/apple-touch-icon.png`);
    assert.equal(pngResponse.status, 200);
    assert.match(pngResponse.headers.get("content-type"), /^image\/png/);
    const png = Buffer.from(await pngResponse.arrayBuffer());
    assert.equal(png.subarray(1, 4).toString("ascii"), "PNG");
  });
});

test("keeps the existing iOS POST /links contract and writes one immutable raw bundle", async () => {
  await withServer(async ({ baseUrl, captureDir }) => {
    const response = await fetch(`${baseUrl}/links`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/article",
        title: "Example article",
        note: "Useful for the capture model.",
      }),
    });
    const receipt = await response.json();
    assert.equal(response.status, 201);
    assert.equal(receipt.success, true);
    assert.equal(receipt.duplicate, false);
    assert.match(receipt.path, /^2026-08-07-[a-f0-9]{12}-example-article\/capture\.md$/);

    const record = await readFile(path.join(captureDir, receipt.path), "utf8");
    assert.match(record, /source_type: "link"/);
    assert.match(record, /channel: "ios-share-sheet"/);
    assert.match(record, /url: "https:\/\/example\.com\/article"/);
    assert.match(record, /Useful for the capture model\./);
    assert.deepEqual(await captureDirectories(captureDir), [path.dirname(receipt.path)]);
  });
});

test("detects a URL sent through the generic content field", async () => {
  await withServer(async ({ baseUrl, captureDir }) => {
    const response = await fetch(`${baseUrl}/capture`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "https://example.com/from-share", note: "Generic shortcut" }),
    });
    const receipt = await response.json();
    assert.equal(response.status, 201);
    const record = await readFile(path.join(captureDir, receipt.path), "utf8");
    assert.match(record, /source_type: "link"/);
    assert.match(record, /url: "https:\/\/example\.com\/from-share"/);
  });
});

test("deduplicates exact same-day retries without overwriting the first capture", async () => {
  await withServer(async ({ baseUrl, captureDir }) => {
    const request = () =>
      fetch(`${baseUrl}/capture`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "A short observation", note: "Keep this." }),
      });

    const first = await request();
    const firstReceipt = await first.json();
    const second = await request();
    const secondReceipt = await second.json();

    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(secondReceipt.duplicate, true);
    assert.equal(secondReceipt.path, firstReceipt.path);
    assert.equal((await captureDirectories(captureDir)).length, 1);
  });
});

test("accepts a browser file upload with optional accompanying text and note", async () => {
  await withServer(async ({ baseUrl, captureDir }) => {
    const form = new FormData();
    form.set("content", "Context copied beside the file.");
    form.set("note", "Read this later.");
    form.set("file", new Blob(["hello attachment\n"], { type: "text/plain" }), "notes.txt");

    const response = await fetch(`${baseUrl}/capture`, {
      method: "POST",
      body: form,
    });
    const receipt = await response.json();
    assert.equal(response.status, 201);

    const bundle = path.dirname(path.join(captureDir, receipt.path));
    const record = await readFile(path.join(bundle, "capture.md"), "utf8");
    const attachment = await readFile(path.join(bundle, "notes.txt"), "utf8");
    assert.match(record, /source_type: "file"/);
    assert.match(record, /attachment: "notes\.txt"/);
    assert.match(record, /Context copied beside the file\./);
    assert.match(record, /Read this later\./);
    assert.equal(attachment, "hello attachment\n");
  });
});

test("keeps an attachment named capture.md separate from the record", async () => {
  await withServer(async ({ baseUrl, captureDir }) => {
    const form = new FormData();
    form.set("file", new Blob(["original attachment\n"], { type: "text/markdown" }), "capture.md");

    const response = await fetch(`${baseUrl}/capture`, {
      method: "POST",
      body: form,
    });
    const receipt = await response.json();
    assert.equal(response.status, 201);

    const bundle = path.dirname(path.join(captureDir, receipt.path));
    const record = await readFile(path.join(bundle, "capture.md"), "utf8");
    const attachment = await readFile(path.join(bundle, "attachment-capture.md"), "utf8");
    assert.match(record, /attachment: "attachment-capture\.md"/);
    assert.equal(attachment, "original attachment\n");
  });
});

test("accepts tailnet requests without an application key and rejects empty captures", async () => {
  await withServer(async ({ baseUrl }) => {
    const accepted = await fetch(`${baseUrl}/capture`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    assert.equal(accepted.status, 201);

    const empty = await fetch(`${baseUrl}/capture`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(empty.status, 400);
  });
});
