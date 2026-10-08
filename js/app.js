const state = {
  view: "overview",
  lastUpdated: new Date(),
  repo: null,
  commits: [],
  platform: null,
};

const elements = {
  sidebar: document.getElementById("sidebar"),
  menuToggle: document.getElementById("menu-toggle"),
  refreshButton: document.getElementById("refresh-button"),
  lastUpdated: document.getElementById("last-updated"),
  sidebarClock: document.getElementById("sidebar-clock"),
  toast: document.getElementById("toast"),
  navItems: [...document.querySelectorAll(".nav-item")],
  platformStatus: document.getElementById("platform-status"),
  repoStars: document.getElementById("repo-stars"),
  repoForks: document.getElementById("repo-forks"),
  repoIssues: document.getElementById("repo-issues"),
  apiLatency: document.getElementById("api-latency"),
  apiLatencyStatus: document.getElementById("api-latency-status"),
  commitChart: document.getElementById("commit-chart"),
  commitChartLabels: document.getElementById("commit-chart-labels"),
  commitChartYLabels: document.getElementById("commit-chart-y-labels"),
  regionList: document.getElementById("region-list"),
  activityList: document.getElementById("activity-list"),
  branchName: document.getElementById("branch-name"),
  latestRelease: document.getElementById("latest-release"),
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

function setLastUpdated(date = new Date()) {
  state.lastUpdated = date;
  if (elements.lastUpdated) elements.lastUpdated.textContent = formatTime(date);
}

function showToast(message) {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2600);
}

function closeSidebarOnMobile() {
  if (window.innerWidth <= 760) elements.sidebar?.classList.remove("is-open");
}

function setText(element, value) {
  if (element) element.textContent = value;
}

function setPlatformStatus(platform) {
  if (!elements.platformStatus) return;

  const tone = getStatusTone(platform.indicator);
  const label = platform.description || "Status unavailable";
  elements.platformStatus.innerHTML =
    `<span class="status-dot ${tone === "operational" ? "status-dot--live" : ""}"></span>${label}`;

  elements.platformStatus.classList.toggle("is-degraded", tone !== "operational");
}

function renderRepository(repo) {
  state.repo = repo;
  setText(elements.repoStars, formatNumber(repo.stargazers_count));
  setText(elements.repoForks, formatNumber(repo.forks_count));
  setText(elements.repoIssues, formatNumber(repo.open_issues_count));
  setText(elements.branchName, repo.default_branch || "main");
  setText(elements.apiLatencyStatus, "Connected");
}

function buildCommitBuckets(commits) {
  const days = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  for (let index = 13; index >= 0; index -= 1) {
    const date = new Date(start);
    date.setDate(start.getDate() - index);
    days.push({
      date,
      label: new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(date),
      count: 0,
    });
  }

  commits.forEach((commit) => {
    const committedAt = new Date(commit.commit?.committer?.date || commit.commit?.author?.date);
    const key = new Date(committedAt);
    key.setHours(0, 0, 0, 0);

    const bucket = days.find((day) => day.date.getTime() === key.getTime());
    if (bucket) bucket.count += 1;
  });

  return days;
}

function renderCommitChart(commits) {
  if (!elements.commitChart) return;

  const buckets = buildCommitBuckets(commits);
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));

  elements.commitChart.innerHTML = buckets.map((bucket) => {
    const height = Math.max(8, Math.round((bucket.count / max) * 90));
    return `<div class="commit-bar-wrap" title="${bucket.label}: ${bucket.count} commit${bucket.count === 1 ? "" : "s"}">
      <span class="commit-bar" style="height:${height}%"></span>
      <small>${bucket.count || ""}</small>
    </div>`;
  }).join("");

  if (elements.commitChartLabels) {
    elements.commitChartLabels.innerHTML = buckets
      .filter((_, index) => [0, 3, 6, 9, 13].includes(index))
      .map((bucket) => `<span>${bucket.label}</span>`)
      .join("");
  }

  if (elements.commitChartYLabels) {
    elements.commitChartYLabels.innerHTML =
      `<span>${max}</span><span>${Math.ceil(max * .75)}</span><span>${Math.ceil(max * .5)}</span><span>${Math.ceil(max * .25)}</span><span>0</span>`;
  }
}

function renderActivity(commits) {
  if (!elements.activityList) return;

  elements.activityList.innerHTML = commits.slice(0, 4).map((item) => {
    const message = (item.commit?.message || "Repository update").split("\n")[0];
    const author = item.commit?.author?.name || item.author?.login || "Unknown author";
    const verified = item.commit?.verification?.verified;

    return `<div class="activity-row">
      <span class="activity-icon ${verified ? "activity-icon--success" : ""}">${verified ? "✓" : "↗"}</span>
      <div>
        <strong>${escapeHtml(message)}</strong>
        <span>${escapeHtml(author)} / ${item.sha.slice(0, 7)}</span>
      </div>
      <time>${formatRelativeTime(item.commit?.committer?.date || item.commit?.author?.date)}</time>
    </div>`;
  }).join("") || '<div class="empty-state">No recent commits found.</div>';

  const newest = commits[0];
  if (newest && elements.latestRelease) {
    const message = (newest.commit?.message || "Latest commit").split("\n")[0];
    elements.latestRelease.textContent = `${message.slice(0, 30)}${message.length > 30 ? "…" : ""}`;
  }
}

function renderRegionalTelemetry(regionsData) {
  if (!elements.regionList) return;

  elements.regionList.innerHTML = regionsData.map((region) => {
    const temperature = region.available ? `${Math.round(region.temperature)}°C` : "—";
    const secondary = region.available
      ? `${getWeatherLabel(region.weatherCode)} · ${Math.round(region.humidity)}% RH`
      : "Telemetry unavailable";

    return `<div class="region-row">
      <div class="region-name">
        <span class="region-flag">${region.code}</span>
        <div><strong>${escapeHtml(region.name)}</strong><span>${escapeHtml(region.zone)}</span></div>
      </div>
      <div class="region-stat"><strong>${temperature}</strong><span>${secondary}</span></div>
      <span class="status-dot ${region.available ? "status-dot--live" : ""}"></span>
    </div>`;
  }).join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[character]));
}

async function loadLiveData() {
  try {
    const [repoResult, commitsResult, platformResult, regionalData] = await Promise.all([
      getRepository(),
      getRecentCommits(),
      getPlatformStatus(),
      getRegionalTelemetry(),
    ]);

    state.commits = commitsResult.data;
    state.platform = platformResult.data.page;

    renderRepository(repoResult.data);
    renderCommitChart(state.commits);
    renderActivity(state.commits);
    renderRegionalTelemetry(regionalData);
    setPlatformStatus(platformResult.data.page);

    setText(elements.apiLatency, repoResult.duration);
    setText(elements.apiLatencyStatus, repoResult.duration < 500 ? "Healthy" : "Slow");
  } catch (error) {
    console.error("Live data load failed:", error);
    showToast("Some live data could not be refreshed");
  } finally {
    setLastUpdated(new Date());
  }
}

elements.navItems.forEach((item) => {
  item.addEventListener("click", () => {
    elements.navItems.forEach((nav) => nav.classList.remove("is-active"));
    item.classList.add("is-active");
    state.view = item.dataset.view || "overview";
    closeSidebarOnMobile();

    if (state.view !== "overview") {
      showToast(`${item.textContent.trim()} view is ready for the next module`);
    }
  });
});

elements.menuToggle?.addEventListener("click", () => {
  elements.sidebar?.classList.toggle("is-open");
});

elements.refreshButton?.addEventListener("click", async () => {
  setLastUpdated(new Date());
  elements.refreshButton.animate(
    [{ transform: "rotate(0deg)" }, { transform: "rotate(180deg)" }, { transform: "rotate(360deg)" }],
    { duration: 520, easing: "ease-out" }
  );

  showToast("Refreshing live data…");
  await loadLiveData();
  showToast("Live data refreshed");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") elements.sidebar?.classList.remove("is-open");
});

function tickClock() {
  const now = new Date();
  if (elements.sidebarClock) elements.sidebarClock.textContent = formatTime(now);
}

setLastUpdated();
tickClock();
setInterval(tickClock, 1000);
loadLiveData();