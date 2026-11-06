# Roadmap

This roadmap describes possible work. A feature is not shipped until it exists, is tested, and is documented.

## v0.1.0 — first public preview

- [x] Analyze a public GitHub repository
- [x] Show open issues and pull requests
- [x] Flag items quiet for 14+ days
- [x] Count newcomer-labelled issues
- [x] Keep the app read-only and browser-based

## Next candidates

- [ ] Pagination so repositories with more than 100 open items are covered
- [ ] Filters for issues, pull requests, labels, and age
- [ ] Configurable quiet-period threshold
- [ ] Better handling of GitHub API rate-limit headers
- [ ] Export a shareable Markdown triage report
- [ ] Unit tests for sorting, filtering, and age calculations
- [ ] Accessibility review and keyboard-navigation improvements

## Later, only if maintainers need it

- [ ] Optional authenticated mode with narrowly scoped GitHub permissions
- [ ] Saved repository list stored locally in the browser
- [ ] Maintainer-defined triage rules

## Non-goals for the first versions

- Automatically closing issues or merging pull requests
- Sending repository data to an AI service by default
- Claiming to measure whether a project is healthy or abandoned
