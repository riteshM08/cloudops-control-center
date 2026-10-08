const state = {
  view: "overview",
  lastUpdated: new Date(),
};

const elements = {
  sidebar: document.getElementById("sidebar"),
  menuToggle: document.getElementById("menu-toggle"),
  refreshButton: document.getElementById("refresh-button"),
  lastUpdated: document.getElementById("last-updated"),
  sidebarClock: document.getElementById("sidebar-clock"),
  toast: document.getElementById("toast"),
  navItems: [...document.querySelectorAll(".nav-item")],
};

function formatTime(date) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
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
  showToast.timer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2400);
}

function closeSidebarOnMobile() {
  if (window.innerWidth <= 760) elements.sidebar?.classList.remove("is-open");
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

elements.refreshButton?.addEventListener("click", () => {
  setLastUpdated(new Date());
  elements.refreshButton.animate(
    [{ transform: "rotate(0deg)" }, { transform: "rotate(180deg)" }, { transform: "rotate(360deg)" }],
    { duration: 520, easing: "ease-out" }
  );
  showToast("Dashboard refreshed");
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