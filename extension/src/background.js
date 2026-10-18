// Fetches the KRW→DKK rate and stores it in chrome.storage.local as { rate, date, source, fetchedAt }.
const FRESH_FOR = 60 * 60 * 1000; // don't refetch more than once an hour unless forced

const SOURCES = [
  async () => {
    const j = await getJson("https://api.frankfurter.dev/v1/latest?base=KRW&symbols=DKK");
    return { rate: j.rates.DKK, date: j.date, source: "ECB" };
  },
  async () => {
    const j = await getJson("https://open.er-api.com/v6/latest/KRW");
    if (j.result !== "success") throw new Error("open.er-api: " + j.result);
    return { rate: j.rates.DKK, date: new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10), source: "ExchangeRate-API" };
  },
];

async function getJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

let inFlight = null;

async function refreshRate(force) {
  const { rate } = await chrome.storage.local.get("rate");
  if (!force && rate && rate.rate > 0 && Date.now() - rate.fetchedAt < FRESH_FOR) return { ok: true, rate };

  const errors = [];
  for (const source of SOURCES) {
    try {
      const r = await source();
      if (!(r.rate > 0)) throw new Error("invalid rate " + r.rate);
      const next = { ...r, fetchedAt: Date.now() };
      await chrome.storage.local.set({ rate: next, rateError: null });
      return { ok: true, rate: next };
    } catch (e) {
      errors.push(String(e.message || e));
    }
  }
  const rateError = errors.join(" | ");
  console.error("KRW→DKK rate refresh failed:", rateError);
  await chrome.storage.local.set({ rateError });
  return { ok: false, error: rateError, rate };
}

function refreshOnce(force) {
  if (!inFlight) inFlight = refreshRate(force).finally(() => { inFlight = null; });
  return inFlight;
}

chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.local.get("settings");
  await chrome.storage.local.set({ settings: { enabled: true, disabledSites: [], showAll: false, ...(settings || {}) } });
  refreshOnce(true);
});

chrome.runtime.onStartup.addListener(() => refreshOnce(false));

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "refreshRate") {
    refreshOnce(!!msg.force).then(sendResponse);
    return true;
  }
});
