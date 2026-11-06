const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../triage-core.js");

function response(body, { status = 200, headers = {} } = {}) {
  const normalized = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: name => normalized[name.toLowerCase()] || null },
    json: async () => body
  };
}

test("classifies issues separately from pull requests", () => {
  assert.equal(core.isPullRequest({ pull_request: { url: "https://api.github.com/pr" } }), true);
  assert.equal(core.isPullRequest({ number: 1 }), false);
});

test("normalizes labels and matches case-insensitively", () => {
  assert.equal(core.normalizeLabel({ name: "  GOOD First Issue " }), "good first issue");
  assert.equal(core.hasLabel({ labels: [{ name: "HeLp WaNtEd" }] }, "help wanted"), true);
});

test("quiet threshold uses updated_at and an exact 14-day boundary", () => {
  const now = Date.parse("2026-01-20T00:00:00Z");
  assert.equal(core.isQuiet({ updated_at: "2026-01-06T00:00:00Z" }, now), true);
  assert.equal(core.isQuiet({ updated_at: "2026-01-06T00:00:00.001Z" }, now), false);
  assert.equal(core.isQuiet({ updated_at: "invalid" }, now), false);
});

test("follows pagination Link headers and deduplicates items", async () => {
  const urls = [];
  const fetchImpl = async url => {
    urls.push(url);
    if (url.includes("page=1")) return response([{ id: 1 }, { id: 2 }], { headers: { link: '<https://api.github.com/repos/a/b/issues?page=2>; rel="next"' } });
    return response([{ id: 2 }, { id: 3 }]);
  };
  const result = await core.fetchAllOpenItems("/repos/a/b/issues?state=open&sort=updated&direction=desc&per_page=2&page=1", { fetchImpl });
  assert.equal(urls.length, 2);
  assert.equal(result.complete, true);
  assert.deepEqual(result.items.map(item => item.id), [1, 2, 3]);
});

test("falls back to page query pagination when Link header is absent", async () => {
  const urls = [];
  const result = await core.fetchAllOpenItems("/repos/a/b/issues?per_page=100&page=1", {
    fetchImpl: async url => { urls.push(url); return response(url.includes("page=1") ? Array(100).fill(null).map((_, id) => ({ id })) : []); }
  });
  assert.equal(urls.length, 2);
  assert.equal(result.complete, true);
});

test("rate limit preserves fetched pages and marks scan partial", async () => {
  let calls = 0;
  const result = await core.fetchAllOpenItems("/repos/a/b/issues?page=1", {
    fetchImpl: async () => ++calls === 1
      ? response([{ id: 8 }], { headers: { link: '<https://api.github.com/repos/a/b/issues?page=2>; rel="next"' } })
      : response({ message: "API rate limit exceeded" }, { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "2000000000" } })
  });
  assert.equal(result.complete, false);
  assert.equal(result.items.length, 1);
  assert.match(result.reason, /rate limit/i);
});

test("network error after a good page returns partial data", async () => {
  let calls = 0;
  const result = await core.fetchAllOpenItems("/repos/a/b/issues?page=1", {
    fetchImpl: async () => {
      if (++calls === 1) return response([{ id: 4 }], { headers: { link: '<https://api.github.com/repos/a/b/issues?page=2>; rel="next"' } });
      throw new Error("offline");
    }
  });
  assert.equal(result.complete, false);
  assert.equal(result.items[0].id, 4);
  assert.match(result.reason, /Network request failed/);
});

test("duplicate pagination link stops safely without dropping items", async () => {
  const url = "https://api.github.com/repos/a/b/issues?page=1";
  const result = await core.fetchAllOpenItems(url, { fetchImpl: async () => response([{ id: 5 }], { headers: { link: `<${url}>; rel="next"` } }) });
  assert.equal(result.complete, false);
  assert.equal(result.items.length, 1);
  assert.match(result.reason, /repeated a page link/i);
});

test("page safety limit reports a partial scan", async () => {
  const result = await core.fetchAllOpenItems("/repos/a/b/issues?page=1", {
    maxPages: 1,
    fetchImpl: async () => response([{ id: 6 }], { headers: { link: '<https://api.github.com/repos/a/b/issues?page=2>; rel="next"' } })
  });
  assert.equal(result.complete, false);
  assert.match(result.reason, /safety limit/);
});

test("rate limit response is identified with a useful warning", () => {
  const message = core.rateLimitMessage(response({}, { status: 429, headers: { "retry-after": "60" } }), {});
  assert.match(message, /rate limit/i);
  assert.match(message, /60 seconds/);
});
