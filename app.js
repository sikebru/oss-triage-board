const API = TriageCore.API_ORIGIN;
const form = document.querySelector("#repo-form");
const input = document.querySelector("#repo-input");
const button = document.querySelector("#load-button");
const statusBox = document.querySelector("#status");
const dashboard = document.querySelector("#dashboard");
const LAST_SCAN_KEY = "oss-triage-board:last-successful-scan";

function setStatus(message, type = "") {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`.trim();
}

function parseRepo(value) {
  const cleaned = value.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\/+$/, "");
  const parts = cleaned.split("/");
  if (parts.length !== 2 || parts.some(part => !part || /[?#\s]/.test(part)) || !/^[\w.-]+$/.test(parts[0]) || !/^[\w.-]+$/.test(parts[1])) {
    throw new Error("Enter a repository as owner/name, or paste its github.com URL.");
  }
  return parts.map(encodeURIComponent);
}

function escapeQuery(value) { return encodeURIComponent(value); }

async function githubCount(query) {
  const { body } = await TriageCore.fetchJson(`${API}/search/issues?q=${escapeQuery(query)}&per_page=1`, fetch);
  if (!Number.isInteger(body.total_count)) throw new Error("GitHub did not provide a total count.");
  return body.total_count;
}

function ageLabel(dateString) {
  const updated = Date.parse(dateString);
  if (!Number.isFinite(updated)) return "Updated date unavailable";
  const days = Math.max(0, Math.floor((Date.now() - updated) / TriageCore.DAY_MS));
  return `Updated ${days} day${days === 1 ? "" : "s"} ago`;
}

function makePill(text, warning = false) {
  const span = document.createElement("span");
  span.className = warning ? "pill warn" : "pill";
  span.textContent = text;
  return span;
}

function renderItem(item) {
  const isPR = TriageCore.isPullRequest(item);
  const quiet = TriageCore.isQuiet(item);
  const card = document.createElement("article");
  card.className = "issue-card";
  const symbol = document.createElement("span");
  symbol.className = `item-symbol ${isPR ? "pr" : ""}`;
  symbol.textContent = isPR ? "⑂" : "#";
  symbol.setAttribute("aria-label", isPR ? "Pull request" : "Issue");
  card.append(symbol);

  const main = document.createElement("div");
  main.className = "item-main";
  const link = document.createElement("a");
  link.className = "item-title";
  link.href = item.html_url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = item.title || "Untitled item";
  main.append(link);
  const meta = document.createElement("div");
  meta.className = "item-meta";
  meta.append(document.createTextNode(`${isPR ? "Pull request" : "Issue"} #${item.number}`));
  meta.append(document.createTextNode(ageLabel(item.updated_at)));
  if (quiet) meta.append(makePill("Quiet 14+ days", true));
  (item.labels || []).forEach(label => {
    if (label && label.name) meta.append(makePill(label.name));
  });
  main.append(meta);
  card.append(main);
  return card;
}

function setCount(id, count) {
  document.querySelector(`#${id}`).textContent = Number.isInteger(count) ? count.toLocaleString() : "Unavailable";
}

function renderDashboard(repo, scan, totals) {
  const issues = scan.items.filter(item => !TriageCore.isPullRequest(item));
  const prs = scan.items.filter(TriageCore.isPullRequest);
  const quietIssues = issues.filter(item => TriageCore.isQuiet(item));
  const quietPrs = prs.filter(item => TriageCore.isQuiet(item));
  const goodFirst = issues.filter(item => TriageCore.hasLabel(item, "good first issue"));
  const helpWanted = issues.filter(item => TriageCore.hasLabel(item, "help wanted"));

  document.querySelector("#repo-name").textContent = repo.full_name;
  document.querySelector("#repo-description").textContent = repo.description || "No repository description provided.";
  document.querySelector("#repo-link").href = repo.html_url;
  setCount("total-issue-count", totals.issues);
  setCount("total-pr-count", totals.prs);
  setCount("issue-count", issues.length);
  setCount("pr-count", prs.length);
  setCount("quiet-issue-count", quietIssues.length);
  setCount("quiet-pr-count", quietPrs.length);
  setCount("starter-count", goodFirst.length);
  setCount("help-wanted-count", helpWanted.length);

  const totalNote = document.querySelector("#totals-note");
  totalNote.textContent = Number.isInteger(totals.issues) && Number.isInteger(totals.prs)
    ? "Totals from GitHub issue search; analyzed counts below are from this scan."
    : `Exact totals unavailable: ${totals.error || "GitHub did not provide separate counts."}`;
  const scanNote = document.querySelector("#scan-state");
  scanNote.className = `scan-state ${scan.complete ? "complete" : "partial"}`;
  scanNote.textContent = scan.complete
    ? `Complete scan · ${scan.items.length.toLocaleString()} unique open items analyzed across ${scan.pages} page${scan.pages === 1 ? "" : "s"}.`
    : `Partial scan · ${scan.items.length.toLocaleString()} unique open items analyzed across ${scan.pages} page${scan.pages === 1 ? "" : "s"}. ${scan.reason}`;

  const list = document.querySelector("#items-list");
  list.replaceChildren();
  const queue = TriageCore.deduplicateItems(scan.items)
    .filter(item => TriageCore.hasLabel(item, "good first issue") || TriageCore.hasLabel(item, "help wanted") || TriageCore.isQuiet(item))
    .sort((a, b) => {
      const aNew = TriageCore.hasLabel(a, "good first issue") || TriageCore.hasLabel(a, "help wanted");
      const bNew = TriageCore.hasLabel(b, "good first issue") || TriageCore.hasLabel(b, "help wanted");
      if (aNew !== bNew) return aNew ? -1 : 1;
      return Date.parse(a.updated_at || 0) - Date.parse(b.updated_at || 0);
    }).slice(0, 12);
  document.querySelector("#result-count").textContent = `${queue.length} suggested of ${scan.items.length} analyzed`;
  if (!queue.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = scan.items.length ? "No quiet or newcomer-labelled open items found in the analyzed results." : "No open issues or pull requests found.";
    list.append(empty);
  } else queue.forEach(item => list.append(renderItem(item)));

  const lastScan = document.querySelector("#last-scan");
  lastScan.textContent = `Last successful scan: ${new Date().toLocaleString()}`;
  try { localStorage.setItem(LAST_SCAN_KEY, JSON.stringify({ repo: repo.full_name, at: new Date().toISOString() })); } catch (_) { /* storage may be disabled */ }
  dashboard.classList.remove("hidden");
}

function showPreviousScan() {
  try {
    const previous = JSON.parse(localStorage.getItem(LAST_SCAN_KEY));
    if (previous && previous.at) document.querySelector("#last-scan").textContent = `Last successful scan: ${new Date(previous.at).toLocaleString()} (${previous.repo})`;
  } catch (_) { /* storage may be disabled or contain invalid data */ }
}

async function analyze(value) {
  let owner, repoName;
  try { [owner, repoName] = parseRepo(value); }
  catch (error) { setStatus(error.message, "error"); return; }

  button.disabled = true;
  button.innerHTML = '<span class="spinner" aria-hidden="true"></span> Scanning…';
  dashboard.classList.add("hidden");
  document.querySelector("#loading-indicator").classList.remove("hidden");
  setStatus("Fetching repository details, open items and GitHub totals…", "loading");
  try {
    const base = `/repos/${owner}/${repoName}`;
    const { body: repo } = await TriageCore.fetchJson(`${API}${base}`, fetch);
    const initial = `${API}${base}/issues?state=open&sort=updated&direction=desc&per_page=${TriageCore.PAGE_SIZE}&page=1`;
    const [scan, issueCount, prCount] = await Promise.all([
      TriageCore.fetchAllOpenItems(initial, { fetchImpl: fetch }),
      githubCount(`repo:${repo.full_name} is:open is:issue`).then(count => ({ count })).catch(error => ({ error: error.message })),
      githubCount(`repo:${repo.full_name} is:open is:pr`).then(count => ({ count })).catch(error => ({ error: error.message }))
    ]);
    const totals = { issues: issueCount.count, prs: prCount.count, error: issueCount.error || prCount.error };
    renderDashboard(repo, scan, totals);
    if (!scan.complete) {
      const rateLimit = /rate limit/i.test(scan.reason);
      setStatus(`${rateLimit ? "Rate-limit warning" : "Partial data warning"}: ${scan.reason} Successfully fetched pages are included below.`, rateLimit ? "warning" : "partial");
    } else if (!Number.isInteger(totals.issues) || !Number.isInteger(totals.prs)) {
      const rateLimit = /rate limit/i.test(totals.error || "");
      setStatus(`${rateLimit ? "Rate-limit warning" : "Count limitation"}: scanned item data is available, but one or more exact totals could not be retrieved.`, rateLimit ? "warning" : "partial");
    } else setStatus(`Analysis loaded for ${repo.full_name}.`, "success");
  } catch (error) {
    const rateLimit = error.kind === "rate-limit";
    setStatus(`${rateLimit ? "GitHub API rate limit reached. " : ""}${error.message}`, rateLimit ? "warning" : "error");
  } finally {
    document.querySelector("#loading-indicator").classList.add("hidden");
    button.disabled = false;
    button.innerHTML = 'Analyze repository <span aria-hidden="true">→</span>';
  }
}

form.addEventListener("submit", event => { event.preventDefault(); analyze(input.value); });
document.querySelectorAll("[data-example]").forEach(example => example.addEventListener("click", () => { input.value = example.dataset.example; analyze(input.value); }));
showPreviousScan();
