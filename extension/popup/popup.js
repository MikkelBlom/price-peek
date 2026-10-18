const $ = id => document.getElementById(id);
const DEFAULTS = { enabled: true, disabledSites: [], showAll: false };
let settings = { ...DEFAULTS };
let host = null;

function renderRate(rate, error) {
  if (rate && rate.rate > 0) {
    const perDkk = (1 / rate.rate).toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    $("rate").textContent = `1 kr. = ${perDkk} ₩`;
    const date = new Date(rate.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    $("meta").textContent = `${date} · ${rate.source}`;
    $("meta").classList.toggle("err", false);
  } else {
    $("rate").textContent = "No rate yet";
  }
  if (error) {
    $("meta").textContent = "Couldn't fetch rate. Check your connection and refresh.";
    $("meta").classList.add("err");
  }
}

function renderSettings() {
  $("enabled").checked = settings.enabled;
  $("siteOn").checked = !!host && !settings.disabledSites.includes(host);
  $("showAll").checked = settings.showAll;
  $("siteOn").closest(".row").classList.toggle("off", !settings.enabled || !host);
  $("showAll").closest(".row").classList.toggle("off", !settings.enabled);
}

function save() {
  chrome.storage.local.set({ settings });
  renderSettings();
}

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  try {
    const u = new URL(tab.url);
    if (u.protocol.startsWith("http")) host = u.hostname;
  } catch (e) { /* chrome:// pages etc. have no site toggle */ }
  $("site").textContent = host || "this page";
  renderSettings();
});

chrome.storage.local.get(["settings", "rate", "rateError"], data => {
  settings = { ...DEFAULTS, ...(data.settings || {}) };
  renderSettings();
  renderRate(data.rate, data.rateError && !data.rate);
});

$("enabled").addEventListener("change", e => { settings.enabled = e.target.checked; save(); });
$("showAll").addEventListener("change", e => { settings.showAll = e.target.checked; save(); });
$("siteOn").addEventListener("change", e => {
  const rest = settings.disabledSites.filter(h => h !== host);
  settings.disabledSites = e.target.checked ? rest : [...rest, host];
  save();
});

$("refresh").addEventListener("click", async () => {
  $("refresh").classList.add("spin");
  try {
    const res = await chrome.runtime.sendMessage({ type: "refreshRate", force: true });
    renderRate(res && res.rate, !res || !res.ok);
  } catch (e) {
    renderRate(null, true);
  } finally {
    $("refresh").classList.remove("spin");
  }
});
