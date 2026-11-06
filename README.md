# OSS Triage Board

A lightweight, read-only dashboard for understanding the public GitHub issues and pull requests that may need maintainer attention.

**Status:** Early preview (v0.1.0) · **License:** MIT

## Why this exists

Small open-source projects often have limited maintainer time. Open issues and pull requests can become difficult to scan, and first-time contributors may struggle to find approachable work.

OSS Triage Board gives maintainers a quick overview without changing anything in their repository.

## Current features

- Analyze a public GitHub repository using `owner/name` or its GitHub URL.
- Show open issue and pull-request counts.
- Identify open items that have not been updated in 14 days.
- Count issues labelled `good first issue` or `help wanted`.
- Link every suggested item to its original GitHub page.
- No login, token, backend, database, or paid API key required.

## Run locally

1. Download or clone this repository.
2. Open `index.html` in a modern browser.

If your browser blocks API requests from a local file, serve the folder with any static web server. For example, with Python installed:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy with GitHub Pages

1. Push this repository to GitHub.
2. Open **Settings → Pages**.
3. Under Build and deployment, choose **Deploy from a branch**.
4. Select `main` and `/ (root)`, then save.
5. Wait for the Pages URL to appear.

No build step is required.

## How it works

The app calls GitHub's public REST API from the browser:

- `GET /repos/{owner}/{repo}`
- `GET /repos/{owner}/{repo}/issues?state=open&per_page=100`

GitHub's issues endpoint also returns pull requests. The app separates them using the `pull_request` field.

## Important limitations

- Only public repositories are supported.
- The app requests at most 100 open items in this first version; busy repositories may have more.
- Unauthenticated GitHub API requests have rate limits. If the limit is reached, wait and retry.
- “Quiet for 14+ days” means the item's `updated_at` timestamp is at least 14 days old. It does not mean the item is abandoned.
- “Good first issues” is based only on the exact `good first issue` and `help wanted` label names.
- Counts and recommendations are a triage aid, not a complete measure of repository health.
- The app is read-only. It does not create, edit, label, close, or comment on GitHub items.

## Privacy

The repository name you enter is sent to GitHub's public API from your browser. The app does not send it to a separate OSS Triage Board server because no such server exists in this version. Do not enter private repository URLs or secrets.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports and focused pull requests are welcome.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned work. Roadmap items are proposals, not shipped features.

## License

MIT. See [LICENSE](LICENSE).
