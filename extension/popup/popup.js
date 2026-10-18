const $ = id => document.getElementById(id);
const P = globalThis.KrwParser;
const DEFAULTS = { enabled: true, disabledSites: [], showAll: false, target: "DKK", disabledCurrencies: [], units: true };
const NAMES = {
  DKK: "Danish krone", EUR: "Euro", USD: "US dollar", GBP: "British pound", SEK: "Swedish krona", NOK: "Norwegian krone",
  CHF: "Swiss franc", JPY: "Japanese yen", CNY: "Chinese yuan", KRW: "Korean won", THB: "Thai baht",
};
const BADGE = { DKK: "kr.", EUR: "€", USD: "$", GBP: "£", JPY: "¥", KRW: "₩", THB: "฿", CNY: "¥" };
let settings = { ...DEFAULTS };
let rates = null;
let host = null;

function renderRate(error) {
  const t = settings.target;
  $("badge").textContent = BADGE[t] || t;
  if (rates && rates.rates) {
    // Show the most relevant pair: 1.000 ₩ in the target, or $1 when converting to KRW.
    const [amount, from, label] = t === "KRW" ? [1, "USD", "$1"] : [1000, "KRW", "1.000 ₩"];
    $("rate").textContent = `${label} = ${P.formatMoney(P.convert(amount, from, t, rates.rates), t)}`;
    const date = new Date(rates.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    $("meta").textContent = `${date} · ${rates.source}`;
    $("meta").classList.remove("err");
  } else {
    $("rate").textContent = "No rates yet";
  }
  if (error) {
    $("meta").textContent = "Couldn't fetch rates. Check your connection and refresh.";
    $("meta").classList.add("err");
  }
}

function renderSettings() {
  $("target").value = settings.target;
  $("enabled").checked = settings.enabled;
  $("siteOn").checked = !!host && !settings.disabledSites.includes(host);
  $("showAll").checked = settings.showAll;
  $("units").checked = settings.units;
  $("siteOn").closest(".row").classList.toggle("off", !settings.enabled || !host);
  for (const id of ["showAll", "units"]) $(id).closest(".row").classList.toggle("off", !settings.enabled);
  for (const b of $("chips").children) {
    const c = b.dataset.code;
    b.setAttribute("aria-pressed", !settings.disabledCurrencies.includes(c));
    b.hidden = c === settings.target; // the target currency is never converted
  }
}

function save() {
  chrome.storage.local.set({ settings });
  renderSettings();
}

for (const code of P.CURRENCIES) {
  $("target").add(new Option(`${code} · ${NAMES[code]}`, code));
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip";
  b.dataset.code = code;
  b.textContent = code;
  b.title = NAMES[code];
  b.addEventListener("click", () => {
    const off = settings.disabledCurrencies.filter(c => c !== code);
    settings.disabledCurrencies = b.getAttribute("aria-pressed") === "true" ? [...off, code] : off;
    save();
  });
  $("chips").appendChild(b);
}

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  try {
    const u = new URL(tab.url);
    if (u.protocol.startsWith("http")) host = u.hostname;
  } catch (e) { /* chrome:// pages etc. have no site toggle */ }
  $("site").textContent = host || "this page";
  renderSettings();
});

chrome.storage.local.get(["settings", "rates", "rateError"], data => {
  settings = { ...DEFAULTS, ...(data.settings || {}) };
  rates = data.rates || null;
  renderSettings();
  renderRate(data.rateError && !rates);
});

$("target").addEventListener("change", e => { settings.target = e.target.value; save(); renderRate(); });
$("enabled").addEventListener("change", e => { settings.enabled = e.target.checked; save(); });
$("showAll").addEventListener("change", e => { settings.showAll = e.target.checked; save(); });
$("units").addEventListener("change", e => { settings.units = e.target.checked; save(); });
$("siteOn").addEventListener("change", e => {
  const rest = settings.disabledSites.filter(h => h !== host);
  settings.disabledSites = e.target.checked ? rest : [...rest, host];
  save();
});

$("refresh").addEventListener("click", async () => {
  $("refresh").classList.add("spin");
  try {
    const res = await chrome.runtime.sendMessage({ type: "refreshRate", force: true });
    if (res && res.rates) rates = res.rates;
    renderRate(!res || !res.ok);
  } catch (e) {
    renderRate(true);
  } finally {
    $("refresh").classList.remove("spin");
  }
});
