const API = "https://api.github.com";
const STALE_DAYS = 14;
const form = document.querySelector("#repo-form");
const input = document.querySelector("#repo-input");
const button = document.querySelector("#load-button");
const statusBox = document.querySelector("#status");
const dashboard = document.querySelector("#dashboard");

function setStatus(message, type = "") {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`.trim();
}

function parseRepo(value) {
  const cleaned = value.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\/+$/, "");
  const parts = cleaned.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1] || parts.some(p => p.includes("?") || p.includes("#"))) {
    throw new Error("Enter a repository as owner/name, or paste its github.com URL.");
  }
  return parts.map(encodeURIComponent);
}

async function githubGet(path) {
  const response = await fetch(`${API}${path}`, {
    headers: { "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }
  });
  if (response.status === 404) throw new Error("Repository not found, or it isn't public. Check the owner and repository name.");
  if (response.status === 403 || response.status === 429) {
    throw new Error("GitHub's unauthenticated API rate limit may have been reached. Wait a while and try again.");
  }
  if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}. Please try again.`);
  return response.json();
}

function ageInDays(dateString) {
  return Math.floor((Date.now() - new Date(dateString).getTime()) / 86400000);
}

function makePill(text, warning = false) {
  const span = document.createElement("span");
  span.className = warning ? "pill warn" : "pill";
  span.textContent = text;
  return span;
}

function renderItem(item) {
  const isPR = Boolean(item.pull_request);
  const age = ageInDays(item.updated_at);
  const card = document.createElement("article");
  card.className = "issue-card";

  const symbol = document.createElement("span");
  symbol.className = `item-symbol ${isPR ? "pr" : ""}`;
  symbol.textContent = isPR ? "⑂" : "#";
  card.append(symbol);

  const main = document.createElement("div");
  main.className = "item-main";
  const link = document.createElement("a");
  link.className = "item-title";
  link.href = item.html_url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = item.title;
  main.append(link);

  const meta = document.createElement("div");
  meta.className = "item-meta";
  meta.append(document.createTextNode(`${isPR ? "Pull request" : "Issue"} #${item.number}`));
  meta.append(document.createTextNode(`Updated ${age} day${age === 1 ? "" : "s"} ago`));
  if (age >= STALE_DAYS) meta.append(makePill("Quiet 14+ days", true));
  (item.labels || []).slice(0, 3).forEach(label => meta.append(makePill(label.name)));
  main.append(meta);
  card.append(main);
  return card;
}

function renderDashboard(repo, items) {
  const issues = items.filter(item => !item.pull_request);
  const prs = items.filter(item => item.pull_request);
  const stale = items.filter(item => ageInDays(item.updated_at) >= STALE_DAYS);
  const starter = issues.filter(item => (item.labels || []).some(label =>
    ["good first issue", "help wanted"].includes(label.name.toLowerCase())
  ));

  document.querySelector("#repo-name").textContent = `${repo.full_name}`;
  document.querySelector("#repo-description").textContent = repo.description || "No repository description provided.";
  const repoLink = document.querySelector("#repo-link");
  repoLink.href = repo.html_url;
  document.querySelector("#issue-count").textContent = issues.length.toLocaleString();
  document.querySelector("#pr-count").textContent = prs.length.toLocaleString();
  document.querySelector("#stale-count").textContent = stale.length.toLocaleString();
  document.querySelector("#starter-count").textContent = starter.length.toLocaleString();

  const list = document.querySelector("#items-list");
  list.replaceChildren();
  const prioritized = [...stale, ...starter.filter(item => !stale.includes(item))]
    .filter((item, index, arr) => arr.findIndex(other => other.id === item.id) === index)
    .slice(0, 12);

  document.querySelector("#result-count").textContent = `${prioritized.length} suggested items`;
  if (!prioritized.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No quiet or newcomer-labelled open items found in the latest results.";
    list.append(empty);
  } else {
    prioritized.forEach(item => list.append(renderItem(item)));
  }
  dashboard.classList.remove("hidden");
}

async function analyze(value) {
  let owner, repoName;
  try { [owner, repoName] = parseRepo(value); }
  catch (error) { setStatus(error.message, "error"); return; }

  button.disabled = true;
  button.textContent = "Analyzing…";
  dashboard.classList.add("hidden");
  setStatus("Fetching public repository details and open items…");
  try {
    const base = `/repos/${owner}/${repoName}`;
    const [repo, items] = await Promise.all([
      githubGet(base),
      githubGet(`${base}/issues?state=open&per_page=100&sort=created&direction=asc`)
    ]);
    renderDashboard(repo, items);
    setStatus(`Analysis loaded for ${repo.full_name}.`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    button.disabled = false;
    button.innerHTML = 'Analyze repository <span aria-hidden="true">→</span>';
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  analyze(input.value);
});

document.querySelectorAll("[data-example]").forEach(example => {
  example.addEventListener("click", () => {
    input.value = example.dataset.example;
    analyze(input.value);
  });
});
