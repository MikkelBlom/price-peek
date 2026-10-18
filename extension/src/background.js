// Fetches exchange rates and stores them in chrome.storage.local as
// { rates: { EUR: 1, DKK: …, KRW: … }, date, source, fetchedAt }: units of each currency per 1 EUR.
const FRESH_FOR = 60 * 60 * 1000; // don't refetch more than once an hour unless forced
const NEEDED = ["KRW", "USD", "GBP", "JPY", "CNY", "SEK", "NOK", "CHF", "THB", "DKK"];

const SOURCES = [
  async () => {
    const j = await getJson("https://api.frankfurter.dev/v1/latest?base=EUR");
    return { rates: { ...j.rates, EUR: 1 }, date: j.date, source: "ECB" };
  },
  async () => {
    const j = await getJson("https://open.er-api.com/v6/latest/EUR");
    if (j.result !== "success") throw new Error("open.er-api: " + j.result);
    return { rates: { ...j.rates, EUR: 1 }, date: new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10), source: "ExchangeRate-API" };
  },
];

async function getJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

let inFlight = null;

async function refreshRates(force) {
  const { rates } = await chrome.storage.local.get("rates");
  if (!force && rates && rates.rates && Date.now() - rates.fetchedAt < FRESH_FOR) return { ok: true, rates };

  const errors = [];
  for (const source of SOURCES) {
    try {
      const r = await source();
      const missing = NEEDED.filter(c => !(r.rates[c] > 0));
      if (missing.length) throw new Error("missing " + missing.join(", "));
      const next = { ...r, fetchedAt: Date.now() };
      await chrome.storage.local.set({ rates: next, rateError: null });
      return { ok: true, rates: next };
    } catch (e) {
      errors.push(String(e.message || e));
    }
  }
  const rateError = errors.join(" | ");
  console.error("Exchange rate refresh failed:", rateError);
  await chrome.storage.local.set({ rateError });
  return { ok: false, error: rateError, rates };
}

function refreshOnce(force) {
  if (!inFlight) inFlight = refreshRates(force).finally(() => { inFlight = null; });
  return inFlight;
}

chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.local.get("settings");
  const defaults = { enabled: true, disabledSites: [], showAll: false, target: "DKK", disabledCurrencies: [], units: true };
  await chrome.storage.local.set({ settings: { ...defaults, ...(settings || {}) } });
  await chrome.storage.local.remove("rate"); // single KRW→DKK rate from v1
  refreshOnce(true);
});

chrome.runtime.onStartup.addListener(() => refreshOnce(false));

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "refreshRate") {
    refreshOnce(!!msg.force).then(sendResponse);
    return true;
  }
});
