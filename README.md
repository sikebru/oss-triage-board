# OSS Triage Board

A lightweight, read-only dashboard for understanding the public GitHub issues and pull requests that may need maintainer attention.

**Status:** Early preview · **License:** MIT

## Features

- Analyze a public GitHub repository using `owner/name` or its GitHub URL.
- Separately show GitHub-reported open issue and pull-request totals and counts actually analyzed.
- Fetch open items sorted by most recently updated, following GitHub pagination links (with a safe query-page fallback).
- Identify quiet issues and PRs using their `updated_at` timestamp and a 14-day threshold.
- Count `good first issue` and `help wanted` labels case-insensitively.
- Prioritize newcomer-friendly items and quiet items in a deduplicated action queue.
- Report complete versus partial scans, preserve successfully retrieved pages after later failures, and describe rate limits and other errors.
- No login, token, backend, database, build step, dependency, or paid API key required.

## Run locally

Open `index.html` in a browser. If local-file API requests are blocked, run `python -m http.server 8000` and visit `http://localhost:8000`.

## Tests

Requires Node.js (no installed packages):

```bash
node --test tests/triage-core.test.js
node --check app.js
node --check triage-core.js
```

## Deploy with GitHub Pages

Select the repository root as the GitHub Pages source. No build step is required.

## Data and limitations

The app calls GitHub's public REST API from the browser. The open items endpoint is paginated, sorted by `updated` descending, and scanned up to a safety limit of 10 pages (1,000 items) per run to avoid unbounded requests. Scans reaching that cap are explicitly marked partial. If a later page fails, earlier fetched pages remain visible with a clear partial warning. Exact issue and PR totals are requested separately from GitHub's issue-search endpoint; if GitHub does not return a total, the UI says the total is unavailable rather than substituting a fetched count. Search results and unauthenticated API calls are subject to GitHub limits and API availability.

Only public repositories are supported. “Quiet” means the item's `updated_at` is at least 14 days old; it does not mean abandoned. The last successful scan time is stored locally in the browser. The app is read-only and does not change repository data.

## Privacy

The repository name is sent directly from your browser to GitHub's public API. The app has no separate server and does not transmit the input elsewhere.

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md). MIT; see [LICENSE](LICENSE).
