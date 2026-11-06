(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TriageCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const API_ORIGIN = "https://api.github.com";
  const DAY_MS = 24 * 60 * 60 * 1000;
  const STALE_DAYS = 14;
  const PAGE_SIZE = 100;
  const MAX_PAGES = 10;

  function isPullRequest(item) {
    return Boolean(item && item.pull_request);
  }

  function normalizeLabel(label) {
    const name = typeof label === "string" ? label : label && label.name;
    return typeof name === "string" ? name.trim().toLocaleLowerCase() : "";
  }

  function hasLabel(item, expected) {
    const target = normalizeLabel(expected);
    return (Array.isArray(item && item.labels) ? item.labels : []).some(label => normalizeLabel(label) === target);
  }

  function isQuiet(item, now = Date.now(), days = STALE_DAYS) {
    const updated = Date.parse(item && item.updated_at);
    return Number.isFinite(updated) && now - updated >= days * DAY_MS;
  }

  function deduplicateItems(items) {
    const seen = new Set();
    return items.filter(item => {
      const key = item && (item.id != null ? `id:${item.id}` : item.html_url ? `url:${item.html_url}` : null);
      if (key === null) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function parseLinkHeader(header) {
    const links = {};
    if (!header) return links;
    for (const part of header.split(/,(?=\s*<)/)) {
      const match = part.match(/\s*<([^>]+)>\s*;\s*rel="?([^";]+)"?/);
      if (match) links[match[2]] = match[1];
    }
    return links;
  }

  function rateLimitMessage(response, body) {
    const remaining = response.headers && response.headers.get("x-ratelimit-remaining");
    const retryAfter = response.headers && response.headers.get("retry-after");
    const reset = response.headers && response.headers.get("x-ratelimit-reset");
    const limited = response.status === 429 || (response.status === 403 && (remaining === "0" || /rate limit/i.test(body && body.message || "")));
    if (!limited) return null;
    let wait = retryAfter ? ` Retry after ${retryAfter} seconds.` : "";
    if (!wait && reset) {
      const seconds = Math.max(0, Number(reset) - Math.floor(Date.now() / 1000));
      if (Number.isFinite(seconds)) wait = ` Retry in about ${seconds} seconds.`;
    }
    return `GitHub API rate limit reached.${wait} Previously fetched pages are retained.`;
  }

  async function fetchJson(url, fetchImpl) {
    let response;
    try {
      response = await fetchImpl(url, {
        headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }
      });
    } catch (error) {
      const wrapped = new Error(`Network request failed: ${error && error.message ? error.message : "check your connection and try again"}`);
      wrapped.kind = "network";
      throw wrapped;
    }
    let body;
    try { body = await response.json(); } catch (_) { body = null; }
    if (!response.ok) {
      const limited = rateLimitMessage(response, body);
      const error = new Error(limited || (response.status === 404
        ? "Repository not found, or it is not public. Check the owner and repository name."
        : `GitHub returned HTTP ${response.status}${body && body.message ? `: ${body.message}` : "."}`));
      error.kind = limited ? "rate-limit" : response.status === 404 ? "not-found" : "http";
      error.status = response.status;
      throw error;
    }
    return { body, response };
  }

  async function fetchAllOpenItems(initialUrl, options = {}) {
    const fetchImpl = options.fetchImpl || fetch;
    const maxPages = options.maxPages || MAX_PAGES;
    const origin = options.apiOrigin || API_ORIGIN;
    const items = [];
    const visited = new Set();
    let url = initialUrl.startsWith("http") ? initialUrl : `${origin}${initialUrl}`;
    let pages = 0;
    let complete = false;
    let reason = "";

    while (url && pages < maxPages) {
      if (!url.startsWith(`${origin}/`) || visited.has(url)) {
        reason = visited.has(url) ? "Pagination stopped because GitHub repeated a page link." : "Pagination stopped because GitHub returned an unexpected page URL.";
        break;
      }
      visited.add(url);
      let result;
      try {
        result = await fetchJson(url, fetchImpl);
      } catch (error) {
        reason = error.message;
        break;
      }
      if (!Array.isArray(result.body)) {
        reason = "GitHub returned an unexpected response while fetching open items.";
        break;
      }
      pages += 1;
      items.push(...result.body);
      const links = parseLinkHeader(result.response.headers && result.response.headers.get("link"));
      if (links.next) {
        url = links.next;
      } else if (!result.response.headers?.get("link") && result.body.length === PAGE_SIZE) {
        // Fallback for environments where the Link header is unavailable.
        const current = new URL(url);
        const page = Number(current.searchParams.get("page") || "1");
        current.searchParams.set("page", String(page + 1));
        url = current.toString();
      } else {
        url = "";
        complete = true;
      }
    }
    if (url && pages >= maxPages && !reason) reason = `Scan stopped at the safety limit of ${maxPages} pages.`;
    return { items: deduplicateItems(items), pages, complete, reason };
  }

  return { API_ORIGIN, DAY_MS, STALE_DAYS, PAGE_SIZE, MAX_PAGES, isPullRequest, normalizeLabel, hasLabel, isQuiet, deduplicateItems, parseLinkHeader, rateLimitMessage, fetchJson, fetchAllOpenItems };
});
