const state = {
  view: "overview",
  lastUpdated: new Date(),
  repo: null,
  commits: [],
  platform: null,
  regions: [],
  autoRefreshMs: 0,
  refreshTimer: null,
};

const root = document.getElementById("view-root");
const sidebar = document.getElementById("sidebar");
const menuToggle = document.getElementById("menu-toggle");
const refreshButton = document.getElementById("refresh-button");
const toast = document.getElementById("toast");
const navItems = [...document.querySelectorAll(".nav-item")];

const viewMeta = {
  overview: ["Operations / Global", "Infrastructure overview"],
  infrastructure: ["Operations / Fleet", "Infrastructure"],
  deployments: ["Delivery / Pipeline", "Deployments"],
  network: ["Operations / Edge", "Network diagnostics"],
  activity: ["Monitor / Audit", "Activity"],
  settings: ["Control plane / Workspace", "Settings"],
};

function formatTime(date) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function formatRelativeTime(dateString) {
  const diff = Math.max(0, Date.now() - new Date(dateString).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(value ?? 0);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[character]));
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function setTopbar(view) {
  const [eyebrow, title] = viewMeta[view] || viewMeta.overview;
  const eyebrowNode = document.querySelector(".eyebrow");
  const titleNode = document.querySelector(".topbar h1");
  if (eyebrowNode) eyebrowNode.textContent = eyebrow;
  if (titleNode) titleNode.textContent = title;
}

function closeSidebarOnMobile() {
  if (window.innerWidth <= 760) sidebar?.classList.remove("is-open");
}

function setActiveNav(view) {
  navItems.forEach((item) => item.classList.toggle("is-active", item.dataset.view === view));
}

function setLastUpdated(date = new Date()) {
  state.lastUpdated = date;
  const node = document.getElementById("last-updated");
  if (node) node.textContent = formatTime(date);
}

function metricCard(label, value, icon, footer, tone = "") {
  return `<article class="metric-card ${tone}">
    <div class="metric-card__top">
      <span class="metric-label">${label}</span>
      <span class="metric-icon">${icon}</span>
    </div>
    <div class="metric-value">${value}</div>
    <div class="metric-foot">${footer}</div>
  </article>`;
}

function panel(title, kicker, body, action = "") {
  return `<article class="panel">
    <div class="panel-header">
      <div><p class="panel-kicker">${kicker}</p><h3>${title}</h3></div>
      ${action}
    </div>
    ${body}
  </article>`;
}

function renderShell(content, eyebrowText, titleText) {
  root.innerHTML = content;
  setTopbar(state.view);
  setLastUpdated();
  const meta = document.querySelector(".hero-meta strong");
  if (meta) meta.textContent = formatTime(new Date());
  const eyebrow = document.querySelector(".eyebrow");
  const title = document.querySelector(".topbar h1");
  if (eyebrow) eyebrow.textContent = eyebrowText;
  if (title) title.textContent = titleText;
}

function renderOverview() {
  renderShell(`
    <div class="hero-row">
      <div>
        <p class="section-kicker">GLOBAL FLEET</p>
        <h2>Good evening, operator.</h2>
        <p class="muted hero-copy">A single view of your cloud footprint, deployments, and network health.</p>
      </div>
      <div class="hero-meta"><span class="muted">Last updated</span><strong>--:--:--</strong></div>
    </div>

    <div class="metric-grid" id="overview-metrics"></div>

    <div class="dashboard-grid">
      ${panel("Repository activity", "LIVE GIT SIGNAL", `
        <div class="chart-wrap" aria-label="Recent repository commit activity">
          <div class="chart-y-labels" id="commit-chart-y-labels"></div>
          <div class="chart">
            <div class="chart-grid-lines"><span></span><span></span><span></span><span></span><span></span></div>
            <div class="commit-chart" id="commit-chart"></div>
            <div class="chart-x-labels" id="commit-chart-labels"></div>
          </div>
        </div>`, `<div class="panel-actions"><span class="live-chip"><span class="status-dot status-dot--live"></span>Live</span><span class="data-source">GitHub</span></div>`)}

      ${panel("Current conditions", "REGIONAL TELEMETRY", '<div class="region-list" id="region-list"><div class="empty-state">Loading regional telemetry…</div></div>', '<span class="data-source">Open-Meteo</span>')}

      ${panel("Deployment pipeline", "DELIVERY", `
        <div class="pipeline" id="overview-pipeline"></div>`, '<span class="live-chip" id="branch-name">main</span>')}

      ${panel("Activity feed", "RECENT EVENTS", '<div class="activity-list" id="activity-list"><div class="empty-state">Loading repository activity…</div></div>', '<button class="text-button" data-go="activity">Open log →</button>')}
    </div>
    <footer class="footer-note"><span>CloudOps Control Center</span><span>Live data: GitHub · Cloudflare · Open-Meteo</span></footer>
  `, viewMeta.overview[0], viewMeta.overview[1]);

  renderOverviewData();
}

function renderOverviewData() {
  const repo = state.repo || {};
  const rootMetrics = document.getElementById("overview-metrics");
  if (rootMetrics) {
    rootMetrics.innerHTML = [
      metricCard("Repository stars", formatNumber(repo.stargazers_count), "GH", '<span class="trend trend--up">Live</span><span class="muted">GitHub API</span>'),
      metricCard("Forks", formatNumber(repo.forks_count), "GH", '<span class="trend trend--steady">Live</span><span class="muted">GitHub API</span>'),
      metricCard("Open issues", formatNumber(repo.open_issues_count), "GH", '<span class="trend trend--down">Live</span><span class="muted">repository signal</span>'),
      metricCard("GitHub API latency", `${state.repoLatency ?? "—"}<span>ms</span>`, "HTTP", `<span class="trend trend--up">${state.repoLatency != null && state.repoLatency < 500 ? "Healthy" : "Measuring"}</span><span class="muted">browser → GitHub</span>`, "metric-card--accent"),
    ].join("");
  }

  const branch = document.getElementById("branch-name");
  if (branch) branch.textContent = repo.default_branch || "main";
  renderCommitChart(state.commits);
  renderActivity(state.commits.slice(0, 5));
  renderRegionalTelemetry(state.regions);
  renderPipeline();
}

function buildCommitBuckets(commits, daysBack = 14) {
  const days = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  for (let index = daysBack - 1; index >= 0; index -= 1) {
    const date = new Date(start);
    date.setDate(start.getDate() - index);
    days.push({
      date,
      label: new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(date),
      count: 0,
    });
  }

  commits.forEach((commit) => {
    const dateValue = commit.commit?.committer?.date || commit.commit?.author?.date;
    if (!dateValue) return;
    const date = new Date(dateValue);
    date.setHours(0, 0, 0, 0);
    const bucket = days.find((day) => day.date.getTime() === date.getTime());
    if (bucket) bucket.count += 1;
  });

  return days;
}

function renderCommitChart(commits) {
  const chart = document.getElementById("commit-chart");
  const labels = document.getElementById("commit-chart-labels");
  const yLabels = document.getElementById("commit-chart-y-labels");
  if (!chart) return;

  const buckets = buildCommitBuckets(commits);
  const max = Math.max(1, ...buckets.map((item) => item.count));

  chart.innerHTML = buckets.map((bucket) => {
    const height = Math.max(3, Math.round((bucket.count / max) * 92));
    return `<div class="commit-bar-wrap" title="${bucket.label}: ${bucket.count} commit${bucket.count === 1 ? "" : "s"}"><span class="commit-bar" style="height:${height}%"></span><small>${bucket.count || ""}</small></div>`;
  }).join("");

  if (labels) {
    labels.innerHTML = buckets
      .filter((_, index) => [0, 3, 6, 9, 13].includes(index))
      .map((bucket) => `<span>${bucket.label}</span>`)
      .join("");
  }

  if (yLabels) {
    yLabels.innerHTML = `<span>${max}</span><span>${Math.ceil(max * .75)}</span><span>${Math.ceil(max * .5)}</span><span>${Math.ceil(max * .25)}</span><span>0</span>`;
  }
}

function renderActivity(commits, targetId = "activity-list") {
  const target = document.getElementById(targetId);
  if (!target) return;

  if (!commits.length) {
    target.innerHTML = '<div class="empty-state">No recent commits found.</div>';
    return;
  }

  target.innerHTML = commits.map((item) => {
    const message = (item.commit?.message || "Repository update").split("\n")[0];
    const author = item.commit?.author?.name || item.author?.login || "Unknown author";
    const verified = item.commit?.verification?.verified;
    const date = item.commit?.committer?.date || item.commit?.author?.date;

    return `<div class="activity-row">
      <span class="activity-icon ${verified ? "activity-icon--success" : ""}">${verified ? "✓" : "↗"}</span>
      <div><strong>${escapeHtml(message)}</strong><span>${escapeHtml(author)} / ${item.sha.slice(0, 7)}</span></div>
      <time>${date ? formatRelativeTime(date) : "—"}</time>
    </div>`;
  }).join("");
}

function renderRegionalTelemetry(regionsData) {
  const target = document.getElementById("region-list");
  if (!target) return;

  if (!regionsData.length) {
    target.innerHTML = '<div class="empty-state">Regional telemetry unavailable.</div>';
    return;
  }

  target.innerHTML = regionsData.map((region) => {
    const temperature = region.available ? `${Math.round(region.temperature)}°C` : "—";
    const secondary = region.available ? `${getWeatherLabel(region.weatherCode)} · ${Math.round(region.humidity)}% RH` : "Telemetry unavailable";

    return `<div class="region-row">
      <div class="region-name"><span class="region-flag">${region.code}</span><div><strong>${escapeHtml(region.name)}</strong><span>${escapeHtml(region.zone)}</span></div></div>
      <div class="region-stat"><strong>${temperature}</strong><span>${secondary}</span></div>
      <span class="status-dot ${region.available ? "status-dot--live" : ""}"></span>
    </div>`;
  }).join("");
}

function renderPipeline() {
  const target = document.getElementById("overview-pipeline");
  if (!target) return;

  const latest = state.commits[0];
  const message = latest ? (latest.commit?.message || "latest change").split("\n")[0] : "awaiting latest commit";

  target.innerHTML = [
    ["1", "Build", "source synced", "is-complete"],
    ["2", "Test", `${state.commits.length ? "repository checks ready" : "waiting for source"}`, "is-complete"],
    ["3", "Deploy", `${message.slice(0, 28)}${message.length > 28 ? "…" : ""}`, "is-current"],
    ["4", "Verify", "monitor rollout", ""],
  ].map(([num, name, detail, status]) => `<div class="pipeline-step ${status}"><span>${num}</span><div><strong>${name}</strong><small>${escapeHtml(detail)}</small></div></div>`).join('<div class="pipeline-connector"></div>');
}

function renderInfrastructure() {
  const repo = state.repo || {};
  const live = state.regions.filter((item) => item.available).length;
  renderShell(`
    <div class="hero-row">
      <div><p class="section-kicker">FLEET INVENTORY</p><h2>Infrastructure map.</h2><p class="muted hero-copy">Regional telemetry and repository configuration, consolidated for one operational view.</p></div>
      <div class="hero-meta"><span class="muted">Telemetry</span><strong>${live}/${state.regions.length || 5} regions online</strong></div>
    </div>
    <div class="metric-grid">
      ${metricCard("Regions monitored", `${state.regions.length || "—"}`, "REG", '<span class="trend trend--up">Live</span><span class="muted">Open-Meteo</span>')}
      ${metricCard("Regions responding", `${live}`, "UP", '<span class="trend trend--steady">Healthy</span><span class="muted">current fetch</span>')}
      ${metricCard("Repository size", repo.size != null ? `${repo.size}<span>KB</span>` : "—", "SIZE", '<span class="trend trend--steady">Live</span><span class="muted">GitHub metadata</span>')}
      ${metricCard("Default branch", escapeHtml(repo.default_branch || "main"), "GIT", '<span class="trend trend--up">Active</span><span class="muted">source of truth</span>', "metric-card--accent")}
    </div>
    <div class="dashboard-grid">
      ${panel("Regional fleet", "EDGE LOCATIONS", '<div class="region-list" id="region-list"></div>', '<span class="data-source">Live</span>')}
      ${panel("Repository metadata", "CONTROL PLANE", `
        <div class="detail-list">
          <div><span>Repository</span><strong>${escapeHtml(repo.full_name || "riteshM08/cloudops-control-center")}</strong></div>
          <div><span>Visibility</span><strong>${escapeHtml(repo.visibility || "public")}</strong></div>
          <div><span>Language</span><strong>${escapeHtml(repo.language || "HTML")}</strong></div>
          <div><span>Created</span><strong>${repo.created_at ? new Date(repo.created_at).toLocaleDateString("en-IN") : "—"}</strong></div>
          <div><span>Last push</span><strong>${repo.pushed_at ? new Date(repo.pushed_at).toLocaleString("en-IN") : "—"}</strong></div>
        </div>`, '<span class="data-source">GitHub</span>')}
    </div>
    <footer class="footer-note"><span>Fleet inventory</span><span>Source: GitHub + Open-Meteo</span></footer>
  `, viewMeta.infrastructure[0], viewMeta.infrastructure[1]);

  renderRegionalTelemetry(state.regions);
}

function renderDeployments() {
  renderShell(`
    <div class="hero-row">
      <div><p class="section-kicker">SOURCE DELIVERY</p><h2>Deployment activity.</h2><p class="muted hero-copy">Recent repository changes represented as a lightweight delivery timeline.</p></div>
      <div class="hero-meta"><span class="muted">Branch</span><strong>${escapeHtml(state.repo?.default_branch || "main")}</strong></div>
    </div>
    <div class="metric-grid">
      ${metricCard("Recent commits", `${state.commits.length}`, "GIT", '<span class="trend trend--up">Loaded</span><span class="muted">last 30 commits</span>')}
      ${metricCard("Latest change", state.commits[0] ? formatRelativeTime(state.commits[0].commit?.committer?.date) : "—", "NOW", '<span class="trend trend--steady">Source</span><span class="muted">commit timestamp</span>')}
      ${metricCard("Default branch", escapeHtml(state.repo?.default_branch || "main"), "BR", '<span class="trend trend--up">Active</span><span class="muted">GitHub</span>')}
      ${metricCard("Working tree", "Clean", "OK", '<span class="trend trend--up">Remote</span><span class="muted">public repository</span>', "metric-card--accent")}
    </div>
    ${panel("Delivery timeline", "RECENT COMMITS", '<div class="timeline" id="deployment-timeline"></div>', '<span class="data-source">GitHub</span>')}
    <footer class="footer-note"><span>Deployment activity</span><span>No backend required</span></footer>
  `, viewMeta.deployments[0], viewMeta.deployments[1]);

  const timeline = document.getElementById("deployment-timeline");
  if (timeline) {
    timeline.innerHTML = state.commits.slice(0, 12).map((commit, index) => {
      const message = (commit.commit?.message || "Repository update").split("\n")[0];
      const date = commit.commit?.committer?.date || commit.commit?.author?.date;
      const author = commit.commit?.author?.name || commit.author?.login || "Unknown";
      return `<div class="timeline-item">
        <div class="timeline-marker ${index === 0 ? "is-current" : ""}">${index === 0 ? "●" : "✓"}</div>
        <div class="timeline-main"><strong>${escapeHtml(message)}</strong><span>${escapeHtml(author)} · ${commit.sha.slice(0, 7)}</span></div>
        <time>${date ? new Date(date).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</time>
      </div>`;
    }).join("") || '<div class="empty-state">No deployment signals found.</div>';
  }
}

async function renderNetwork() {
  renderShell(`
    <div class="hero-row">
      <div><p class="section-kicker">EDGE DIAGNOSTICS</p><h2>Network diagnostics.</h2><p class="muted hero-copy">Measure response time from this browser to the public services powering the dashboard.</p></div>
      <div class="hero-meta"><span class="muted">Tested</span><strong id="network-tested">—</strong></div>
    </div>
    <div class="metric-grid">
      ${metricCard("GitHub API", "—<span>ms</span>", "GH", '<span class="trend trend--steady">Testing</span><span class="muted">repository endpoint</span>')}
      ${metricCard("Cloudflare", "—<span>ms</span>", "CF", '<span class="trend trend--steady">Testing</span><span class="muted">status endpoint</span>')}
      ${metricCard("Telemetry API", "—<span>ms</span>", "WX", '<span class="trend trend--steady">Testing</span><span class="muted">Open-Meteo</span>')}
      ${metricCard("Browser", navigator.onLine ? "Online" : "Offline", "NET", `<span class="trend ${navigator.onLine ? "trend--up" : "trend--down"}">${navigator.onLine ? "Connected" : "Offline"}</span><span class="muted">navigator status</span>`, "metric-card--accent")}
    </div>
    ${panel("Endpoint response times", "LIVE PROBES", '<div class="probe-list" id="probe-list"><div class="empty-state">Running probes…</div></div>', '<span class="data-source">Browser fetch</span>')}
    ${panel("Regional fetch latency", "OPEN-METEO", '<div class="latency-list" id="region-latency-list"><div class="empty-state">Waiting for telemetry…</div></div>', '<span class="data-source">Live</span>')}
    <footer class="footer-note"><span>Network diagnostics</span><span>Measurements vary by connection and location</span></footer>
  `, viewMeta.network[0], viewMeta.network[1]);

  await populateNetworkDiagnostics();
}

async function populateNetworkDiagnostics() {
  const endpoints = [
    { name: "GitHub repository", key: "github", url: API.githubRepo },
    { name: "Cloudflare status", key: "cloudflare", url: API.cloudflareStatus },
    { name: "Open-Meteo telemetry", key: "weather", url: "https://api.open-meteo.com/v1/forecast?latitude=19.076&longitude=72.8777&current=temperature_2m&timezone=auto" },
  ];

  const results = await Promise.all(endpoints.map(async (endpoint) => {
    try {
      const result = await timedFetch(endpoint.url, { cache: "no-store" });
      return { ...endpoint, duration: result.duration, ok: true };
    } catch (error) {
      return { ...endpoint, duration: null, ok: false, error: error.message };
    }
  }));

  const cards = document.querySelectorAll(".metric-card");
  const cardValueSlots = [...cards].slice(0, 3).map((card) => card.querySelector(".metric-value"));
  const cardFooters = [...cards].slice(0, 3).map((card) => card.querySelector(".trend"));

  results.forEach((result, index) => {
    if (cardValueSlots[index]) cardValueSlots[index].innerHTML = result.duration != null ? `${result.duration}<span>ms</span>` : "—";
    if (cardFooters[index]) {
      cardFooters[index].textContent = result.ok ? (result.duration < 500 ? "Healthy" : "Slow") : "Unavailable";
      cardFooters[index].className = `trend ${result.ok && result.duration < 500 ? "trend--up" : "trend--down"}`;
    }
  });

  const probeList = document.getElementById("probe-list");
  if (probeList) {
    probeList.innerHTML = results.map((result) => `<div class="probe-row">
      <div><strong>${escapeHtml(result.name)}</strong><span>${escapeHtml(result.url)}</span></div>
      <strong class="${result.ok ? "value-good" : "value-warn"}">${result.ok ? `${result.duration} ms` : "Failed"}</strong>
    </div>`).join("");
  }

  const latencyList = document.getElementById("region-latency-list");
  if (latencyList) {
    latencyList.innerHTML = state.regions.map((region) => `<div class="latency-row">
      <span>${escapeHtml(region.name)}</span><strong>${region.available ? `${region.latency} ms` : "—"}</strong><span class="${region.available ? "value-good" : "value-warn"}">${region.available ? "reachable" : "failed"}</span>
    </div>`).join("");
  }

  const tested = document.getElementById("network-tested");
  if (tested) tested.textContent = formatTime(new Date());
}

function renderActivityView() {
  renderShell(`
    <div class="hero-row">
      <div><p class="section-kicker">AUDIT STREAM</p><h2>Repository activity.</h2><p class="muted hero-copy">A searchable stream of the latest changes visible from the public GitHub repository.</p></div>
      <div class="hero-meta"><span class="muted">Entries</span><strong>${state.commits.length}</strong></div>
    </div>
    ${panel("Commit stream", "SOURCE EVENTS", `
      <div class="filter-row">
        <input id="activity-search" class="search-input" type="search" placeholder="Filter commit messages or authors…" aria-label="Filter activity">
        <span class="data-source">GitHub commits</span>
      </div>
      <div class="activity-list activity-list--expanded" id="activity-stream"></div>`, '<span class="live-chip">30 latest</span>')}
    <footer class="footer-note"><span>Activity audit</span><span>Read-only public data</span></footer>
  `, viewMeta.activity[0], viewMeta.activity[1]);

  const stream = document.getElementById("activity-stream");
  const search = document.getElementById("activity-search");
  const draw = () => {
    const query = search.value.trim().toLowerCase();
    const filtered = state.commits.filter((item) => {
      const message = item.commit?.message || "";
      const author = item.commit?.author?.name || item.author?.login || "";
      return `${message} ${author}`.toLowerCase().includes(query);
    });
    renderActivity(filtered, "activity-stream");
  };
  search?.addEventListener("input", draw);
  draw();
  search?.focus();
}

function renderSettings() {
  renderShell(`
    <div class="hero-row">
      <div><p class="section-kicker">WORKSPACE</p><h2>Control center settings.</h2><p class="muted hero-copy">Local preferences only. No account or backend is required.</p></div>
      <div class="hero-meta"><span class="muted">Storage</span><strong>Browser local</strong></div>
    </div>
    <div class="settings-layout">
      ${panel("Refresh cadence", "LIVE DATA", `
        <div class="setting-row"><div><strong>Automatic refresh</strong><span>Refresh the connected APIs while the dashboard is open.</span></div>
          <label class="switch"><input id="auto-refresh-toggle" type="checkbox" ${state.autoRefreshMs ? "checked" : ""}><span></span></label>
        </div>
        <div class="setting-row"><div><strong>Interval</strong><span>Choose how often the browser re-fetches live data.</span></div>
          <select id="refresh-interval" class="select-input">
            <option value="0" ${state.autoRefreshMs === 0 ? "selected" : ""}>Manual only</option>
            <option value="30000" ${state.autoRefreshMs === 30000 ? "selected" : ""}>30 seconds</option>
            <option value="60000" ${state.autoRefreshMs === 60000 ? "selected" : ""}>1 minute</option>
            <option value="300000" ${state.autoRefreshMs === 300000 ? "selected" : ""}>5 minutes</option>
          </select>
        </div>`, '<span class="data-source">LocalStorage</span>')}
      ${panel("Data sources", "CONNECTED SERVICES", `
        <div class="source-list">
          <div><span class="status-dot status-dot--live"></span><div><strong>GitHub REST API</strong><span>Repository metadata + commits</span></div><a href="https://api.github.com" target="_blank" rel="noreferrer">API ↗</a></div>
          <div><span class="status-dot status-dot--live"></span><div><strong>Cloudflare Status API</strong><span>External service health signal</span></div><a href="https://www.cloudflarestatus.com/api" target="_blank" rel="noreferrer">API ↗</a></div>
          <div><span class="status-dot status-dot--live"></span><div><strong>Open-Meteo</strong><span>Regional weather telemetry</span></div><a href="https://open-meteo.com" target="_blank" rel="noreferrer">API ↗</a></div>
        </div>`, '<span class="data-source">Public APIs</span>')}
      ${panel("Workspace", "LOCAL PROFILE", `
        <div class="detail-list">
          <div><span>Repository</span><strong>riteshM08/cloudops-control-center</strong></div>
          <div><span>Mode</span><strong>Static frontend</strong></div>
          <div><span>Authentication</span><strong>Not required</strong></div>
          <div><span>Persistence</span><strong>Browser localStorage</strong></div>
        </div>`, '<span class="data-source">Client-side</span>')}
    </div>
    <footer class="footer-note"><span>Settings stay in this browser</span><span>No credentials stored</span></footer>
  `, viewMeta.settings[0], viewMeta.settings[1]);

  wireSettings();
}

function loadSettings() {
  const saved = Number(localStorage.getItem("cloudops-refresh-ms") || "0");
  state.autoRefreshMs = [0, 30000, 60000, 300000].includes(saved) ? saved : 0;
  configureAutoRefresh();
}

function configureAutoRefresh() {
  clearInterval(state.refreshTimer);
  if (!state.autoRefreshMs) return;

  state.refreshTimer = setInterval(async () => {
    await loadLiveData(false);
    if (state.view === "overview") renderOverviewData();
  }, state.autoRefreshMs);
}

function wireSettings() {
  const toggle = document.getElementById("auto-refresh-toggle");
  const interval = document.getElementById("refresh-interval");

  const update = () => {
    const next = Number(interval?.value || "0");
    state.autoRefreshMs = toggle?.checked ? (next || 60000) : 0;
    localStorage.setItem("cloudops-refresh-ms", String(state.autoRefreshMs));
    configureAutoRefresh();
    if (toggle && interval && !toggle.checked) interval.value = "0";
    showToast(state.autoRefreshMs ? `Automatic refresh enabled: ${Math.round(state.autoRefreshMs / 1000)}s` : "Automatic refresh disabled");
  };

  toggle?.addEventListener("change", update);
  interval?.addEventListener("change", update);
}

async function loadLiveData(showFeedback = true) {
  try {
    const [repoResult, commitsResult, platformResult, regionalData] = await Promise.all([
      getRepository(),
      getRecentCommits(),
      getPlatformStatus(),
      getRegionalTelemetry(),
    ]);

    state.repo = repoResult.data;
    state.repoLatency = repoResult.duration;
    state.commits = commitsResult.data;
    state.platform = platformResult.data.page;
    state.regions = regionalData;

    const platformStatus = document.getElementById("platform-status");
    if (platformStatus) {
      const tone = getStatusTone(state.platform.indicator);
      platformStatus.innerHTML = `<span class="status-dot ${tone === "operational" ? "status-dot--live" : ""}"></span>${escapeHtml(state.platform.description || "Status unavailable")}`;
      platformStatus.classList.toggle("is-degraded", tone !== "operational");
    }

    if (state.view === "overview") renderOverviewData();
    setLastUpdated(new Date());

    if (showFeedback) showToast("Live data refreshed");
  } catch (error) {
    console.error("Live data load failed:", error);
    if (showFeedback) showToast("Some live data could not be refreshed");
  }
}

async function navigate(view) {
  state.view = view;
  setActiveNav(view);
  closeSidebarOnMobile();

  if (view === "overview") renderOverview();
  if (view === "infrastructure") renderInfrastructure();
  if (view === "deployments") renderDeployments();
  if (view === "network") await renderNetwork();
  if (view === "activity") renderActivityView();
  if (view === "settings") renderSettings();

  setTopbar(view);
}

navItems.forEach((item) => {
  item.addEventListener("click", () => navigate(item.dataset.view || "overview"));
});

document.addEventListener("click", (event) => {
  const go = event.target.closest("[data-go]");
  if (go) navigate(go.dataset.go);
});

menuToggle?.addEventListener("click", () => sidebar?.classList.toggle("is-open"));

refreshButton?.addEventListener("click", async () => {
  refreshButton.animate(
    [{ transform: "rotate(0deg)" }, { transform: "rotate(180deg)" }, { transform: "rotate(360deg)" }],
    { duration: 520, easing: "ease-out" }
  );
  showToast("Refreshing live data…");
  await loadLiveData(false);

  if (state.view === "infrastructure") renderInfrastructure();
  if (state.view === "deployments") renderDeployments();
  if (state.view === "network") await renderNetwork();
  if (state.view === "activity") renderActivityView();
  if (state.view === "settings") renderSettings();

  showToast("Live data refreshed");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") sidebar?.classList.remove("is-open");
});

function tickClock() {
  const clock = document.getElementById("sidebar-clock");
  if (clock) clock.textContent = formatTime(new Date());
}

loadSettings();
tickClock();
setInterval(tickClock, 1000);
renderOverview();
loadLiveData(false);