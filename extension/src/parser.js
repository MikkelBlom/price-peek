// Price and unit detection plus formatting. Pure functions, no DOM.
// Loaded as a classic content script (exposes globalThis.KrwParser) and required by the Node tests.
(function (root) {
  const CURRENCIES = ["KRW", "USD", "EUR", "GBP", "JPY", "CNY", "SEK", "NOK", "CHF", "THB", "DKK"];

  // Symbols, codes and words around a number, mapped to a currency.
  // "$" is always USD; CA$, A$, HK$ etc. are excluded because "$" may not follow a letter.
  // A bare "kr" is never matched (DKK, SEK and NOK all use it).
  const PREFIX = {
    "US$": "USD", "CN¥": "CNY", "JP¥": "JPY", "RMB": "CNY",
    USD: "USD", EUR: "EUR", GBP: "GBP", JPY: "JPY", CNY: "CNY", SEK: "SEK", NOK: "NOK", CHF: "CHF", THB: "THB", KRW: "KRW", DKK: "DKK",
    "$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "￥": "JPY", "₩": "KRW", "￦": "KRW", "฿": "THB",
  };
  const SUFFIX = {
    "원": "KRW", "₩": "KRW", "円": "JPY", "元": "CNY", "块": "CNY", "塊": "CNY", "บาท": "THB", "€": "EUR",
    USD: "USD", EUR: "EUR", GBP: "GBP", JPY: "JPY", CNY: "CNY", RMB: "CNY", SEK: "SEK", NOK: "NOK", CHF: "CHF", THB: "THB", KRW: "KRW", DKK: "DKK",
    dollars: "USD", dollar: "USD", euros: "EUR", euro: "EUR", yen: "JPY", yuan: "CNY", baht: "THB", won: "KRW",
  };

  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const alt = obj => Object.keys(obj).sort((a, b) => b.length - a.length).map(esc).join("|");
  const lookup = (obj, token) => obj[token] || obj[token.toUpperCase()] || obj[token.toLowerCase()];

  // A number: "1,500,000", "1.500.000", "1 200", "3.5", "1,5", "12,345.67", "1.234,56". Never followed by another digit.
  const NUM = String.raw`(?:\d{1,3}(?:[   ]\d{3})+(?:[.,]\d+)?|\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(?!\d)`;

  // Korean unit amounts: "3억 5,000만원", "3억5천만", "12억 5,000", "150만", "5천원", "1조 2,000억".
  // Needs a 조/억/만 unit, or 천/백 directly followed by 원. Bare 억/만 amounts count as KRW.
  const KOR_SEQ = String.raw`(?:${NUM}\s?[천백]?\s?[조억만]\s?)+`;
  const KOR = String.raw`(?:${KOR_SEQ}(?:${NUM}(?:\s?[천백])?)?|${NUM}\s?[천백]\s?(?=원))(?:\s?원)?`;

  // Japanese/Chinese unit amounts: "3万", "1億2000万", "5千". Only count with 円/元 or a ¥ prefix.
  const CJK_SEQ = String.raw`(?:${NUM}\s?千?\s?[兆億亿万萬]\s?)+`;
  const CJK = String.raw`(?:${CJK_SEQ}(?:${NUM}(?:\s?千)?)?|${NUM}\s?千)`;

  const MULT = String.raw`(?:\s?(?:k|m|mn|mil|million|mio\.?|b|bn|billion|mia\.?|mrd\.?|thousand)(?![A-Za-z]))`;

  // Neither edge may touch a word, path or host character, so codes inside links don't count:
  // Outlook's "eur03.safelinks.protection.outlook.com" is not EUR 3.
  const MONEY_RE = new RegExp(
    String.raw`(?<![A-Za-z0-9.,/@_=%])(?:` +
      String.raw`(?<pre>${alt(PREFIX)})\s?(?<a1>${KOR}|${CJK}|${NUM}${MULT}?)` +
      String.raw`|(?<a2>${KOR})` +
      String.raw`|(?<a3>${CJK})\s?(?<s3>円|元|块|塊)` +
      // A symbol that can also be a prefix belongs to the number after it: "1 € 415" (a 1-person pill next to the price) is €415, not €1.
      String.raw`|(?<a4>${NUM}${MULT}?)\s?(?<s4>${alt(SUFFIX)})(?![A-Za-z])(?<![€₩](?=\s?\d))` +
    String.raw`)(?![A-Za-z_@]|\.[A-Za-z0-9])`,
    "gi"
  );
  const UNIT_GROUP_RE = new RegExp(String.raw`(${NUM})\s?([천백千百])?\s?([조억만兆億亿万萬])?`, "g");
  const PLAIN_RE = new RegExp(String.raw`^(${NUM})\s?([a-z]+\.?)?$`, "i");

  // Metric only. 평/坪 (≈3.3 m²), 畳/帖 (tatami, ≈1.62 m²), 근 (Korean market weight, 600 g).
  const MEASURE_RE = new RegExp(
    String.raw`(?<![A-Za-z0-9.,])(?<n>${NUM})\s?(?:(?<py>평(?:형|대)?(?![가-힣])|坪)|(?<jo>畳|帖)|(?<geun>근(?![가-힣])))`,
    "g"
  );

  const BIG = { "조": 1e12, "兆": 1e12, "억": 1e8, "億": 1e8, "亿": 1e8, "만": 1e4, "万": 1e4, "萬": 1e4 };
  const SMALL = { "천": 1e3, "千": 1e3, "백": 1e2, "百": 1e2 };
  const MULTS = { k: 1e3, thousand: 1e3, m: 1e6, mn: 1e6, mil: 1e6, million: 1e6, mio: 1e6, b: 1e9, bn: 1e9, billion: 1e9, mia: 1e9, mrd: 1e9 };
  const M2_PER_PYEONG = 3.305785;
  const M2_PER_JO = 1.62;
  const G_PER_GEUN = 600;

  // Comma or dot can be a thousands separator or a decimal mark; decide from the digit grouping.
  // scaled: the number is followed by a unit or multiplier ("4.015 billion", "1.234억"); then a lone dot
  // is a decimal point, since nobody writes thousands separators in front of "billion".
  function parseNum(s, scaled = false) {
    s = s.replace(/[   ]/g, "");
    if (scaled && /^\d+\.\d+$/.test(s)) return Number(s);
    if (/^\d{1,3}(?:[.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ""));
    if (/^\d{1,3}(?:,\d{3})+\.\d+$/.test(s)) return Number(s.replace(/,/g, ""));
    if (/^\d{1,3}(?:\.\d{3})+,\d+$/.test(s)) return Number(s.replace(/\./g, "").replace(",", "."));
    return Number(s.replace(",", "."));
  }

  function evalUnits(s) {
    const korean = /[가-힣]/.test(s);
    let total = 0;
    let lastBig = null;
    for (const [, num, small, big] of s.matchAll(UNIT_GROUP_RE)) {
      let v = parseNum(num, !!(small || big));
      if (small) v *= SMALL[small];
      if (big) {
        v *= BIG[big];
        lastBig = BIG[big];
      } else if (korean && lastBig === 1e8) {
        v *= 1e4; // "12억 5,000" means 12억 5,000만
      } else if (korean && lastBig === 1e12) {
        v *= 1e8;
      }
      total += v;
    }
    return total;
  }

  function evalAmount(raw) {
    const s = raw.replace(/원/g, "").trim();
    if (/[조억만천백兆億亿万萬千百]/.test(s)) return evalUnits(s);
    const m = s.match(PLAIN_RE);
    if (!m) return NaN;
    const mult = m[2] ? MULTS[m[2].toLowerCase().replace(".", "")] : 1;
    return mult ? parseNum(m[1], mult > 1) * mult : NaN;
  }

  // Returns non-overlapping, sorted matches:
  //   { start, end, kind: "money", currency, value, plus }  value in that currency
  //   { start, end, kind: "area", value }                    value in m²
  //   { start, end, kind: "weight", value }                  value in g
  function findMatches(text) {
    const out = [];
    for (const m of text.matchAll(MONEY_RE)) {
      const g = m.groups;
      let currency, amount;
      if (g.pre) { currency = lookup(PREFIX, g.pre); amount = g.a1; }
      else if (g.a2) { currency = "KRW"; amount = g.a2; }
      else if (g.a3) { currency = g.s3 === "円" ? "JPY" : "CNY"; amount = g.a3; }
      else { currency = lookup(SUFFIX, g.s4); amount = g.a4; }
      const value = evalAmount(amount);
      if (!currency || !(value > 0)) continue;
      const raw = m[0].replace(/\s+$/, "");
      const start = m.index;
      const end = start + raw.length;
      out.push({ start, end, kind: "money", currency, value: currency === "KRW" || currency === "JPY" ? Math.round(value) : value, plus: text[end] === "+" });
    }
    for (const m of text.matchAll(MEASURE_RE)) {
      const start = m.index;
      const end = start + m[0].length;
      if (out.some(o => start < o.end && end > o.start)) continue;
      const n = parseNum(m.groups.n);
      if (!(n > 0)) continue;
      if (m.groups.py) out.push({ start, end, kind: "area", value: n * M2_PER_PYEONG });
      else if (m.groups.jo) out.push({ start, end, kind: "area", value: n * M2_PER_JO });
      else out.push({ start, end, kind: "weight", value: n * G_PER_GEUN });
    }
    return out.sort((a, b) => a.start - b.start);
  }

  // First currency symbol/code/word in some text, e.g. a price filter's label "최소 ___ 원". Null if none.
  const HINT_RE = new RegExp(String.raw`(?<![A-Za-z])(${alt({ ...PREFIX, ...SUFFIX })})(?![A-Za-z])`, "i");
  function guessCurrency(text) {
    const m = text && text.match(HINT_RE);
    return m ? lookup(PREFIX, m[1]) || lookup(SUFFIX, m[1]) : null;
  }

  // A value typed into a form field. Uses its own currency if it has one ("₩500,000", "50만"),
  // otherwise a bare number ("500000") takes the currency named around the field, or failing that
  // the page's main currency (fallback), since translated pages can lose the label ("원" → "one").
  // A field labelled with a unit that isn't money ("min", "h", "MB", "files") holds a count, not a price,
  // so it never borrows the page's main currency.
  const NON_MONEY_UNIT_RE = /(?<![\p{L}\d])(?:ms|secs?|seconds?|min|mins|minutes?|h|hrs?|hours?|days?|weeks?|[KMGT]i?B|bytes?|px|pt|em|rem|%|files?|links?|items?|pcs|stk|kg|km|cm|mm|minutter|timer|dage|uger|filer)(?![\p{L}\d])/iu;

  function parseFieldValue(value, context, fallback) {
    const money = findMatches(value).find(m => m.kind === "money");
    if (money) return money;
    if (!/^\s*\d[\d.,\s ]*$/.test(value)) return null;
    const currency = guessCurrency(context) || (NON_MONEY_UNIT_RE.test(context || "") ? null : fallback);
    const n = parseNum(value.trim());
    return currency && n > 0 ? { kind: "money", currency, value: n, plus: false } : null;
  }

  // rates: units of each currency per 1 EUR (EUR itself = 1).
  function convert(value, from, to, rates) {
    if (from === to) return value;
    const f = rates && rates[from], t = rates && rates[to];
    return f > 0 && t > 0 ? (value / f) * t : NaN;
  }

  const dk = (n, d = 0) => n.toLocaleString("da-DK", { minimumFractionDigits: d, maximumFractionDigits: d });

  // How a target currency is written: prefix symbol or suffix.
  const TARGET_FORMAT = {
    DKK: { suf: " kr." }, SEK: { suf: " SEK" }, NOK: { suf: " NOK" }, EUR: { pre: "€" }, USD: { pre: "$" }, GBP: { pre: "£" },
    CHF: { pre: "CHF " }, JPY: { pre: "¥", whole: true }, CNY: { pre: "CN¥" }, KRW: { pre: "₩", whole: true }, THB: { pre: "฿" },
  };

  function formatMoney(v, currency = "DKK", plus = false) {
    const f = TARGET_FORMAT[currency] || { suf: " " + currency };
    const p = plus ? "+" : "";
    let num, scale = "";
    if (v >= 1e9) { num = dk(v / 1e9, 1); scale = " mia."; }
    else if (v >= 1e8) { num = dk(v / 1e6, 0); scale = " mio."; }
    else if (v >= 1e6) { num = dk(v / 1e6, 1); scale = " mio."; }
    else if (v >= 10 || f.whole) num = dk(Math.round(v));
    else num = dk(v, 2);
    return f.pre ? `${f.pre}${num}${p}${scale}` : `${num}${p}${scale}${f.suf}`;
  }

  const formatDkk = (v, plus) => formatMoney(v, "DKK", plus);
  const formatArea = m2 => `${m2 < 10 ? dk(m2, 1) : dk(Math.round(m2))} m²`;
  const formatWeight = g => (g < 1000 ? `${dk(Math.round(g))} g` : `${dk(g / 1000, 1)} kg`);

  const api = { CURRENCIES, findMatches, parseNum, guessCurrency, parseFieldValue, convert, formatMoney, formatDkk, formatArea, formatWeight };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.KrwParser = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
