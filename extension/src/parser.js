// KRW price detection and DKK formatting. Pure functions, no DOM.
// Loaded as a classic content script (exposes globalThis.KrwParser) and required by the Node tests.
(function (root) {
  // A number: "1,500,000", "1.500.000", "3.5", "1,5", "12,345.67". Never followed by another digit.
  const NUM = String.raw`(?:\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(?!\d)`;

  // Korean unit amounts: "3억 5,000만원", "3억5천만", "12억 5,000", "150만", "5천원", "1조 2,000억".
  // Needs a 조/억/만 unit, or 천/백 directly followed by 원.
  const UNITS_SEQ = String.raw`(?:${NUM}\s?[천백]?\s?[조억만]\s?)+`;
  const TRAIL = String.raw`(?:${NUM}(?:\s?[천백])?)?`;
  const KOR = String.raw`(?:${UNITS_SEQ}${TRAIL}|${NUM}\s?[천백]\s?(?=원))(?:\s?원)?`;

  const MULT = String.raw`(?:\s?(?:k|m|b|bn|mn|mil|million|billion|thousand)\b)`;
  const PREFIX = String.raw`(?:₩|￦|\bKRW)\s?(?:${KOR}|${NUM}${MULT}?)`;
  const SUFFIX = String.raw`${NUM}${MULT}?\s?(?:원|KRW\b|won\b|₩)`;

  const KRW_RE = new RegExp(String.raw`(?<![\d.,])(?:${PREFIX}|${KOR}|${SUFFIX})`, "gi");
  const KOR_GROUP_RE = new RegExp(String.raw`(${NUM})\s?([천백])?\s?([조억만])?`, "g");
  const PLAIN_RE = new RegExp(String.raw`^(${NUM})\s?([a-z]+)?$`, "i");
  // 평 (pyeong) area; "평균" (average) and other words starting with 평 are excluded.
  const AREA_RE = new RegExp(String.raw`(?<![\d.,])(${NUM})\s?평(?:형|대)?(?![가-힣])`, "g");

  const BIG = { "조": 1e12, "억": 1e8, "만": 1e4 };
  const SMALL = { "천": 1e3, "백": 1e2 };
  const MULTS = { k: 1e3, thousand: 1e3, m: 1e6, mn: 1e6, mil: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9 };
  const M2_PER_PYEONG = 3.305785;

  // Comma or dot can be a thousands separator or a decimal mark; decide from the digit grouping.
  function parseNum(s) {
    if (/^\d{1,3}(?:[.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ""));
    if (/^\d{1,3}(?:,\d{3})+\.\d+$/.test(s)) return Number(s.replace(/,/g, ""));
    if (/^\d{1,3}(?:\.\d{3})+,\d+$/.test(s)) return Number(s.replace(/\./g, "").replace(",", "."));
    return Number(s.replace(",", "."));
  }

  function evalKorean(s) {
    let total = 0;
    let lastBig = null;
    KOR_GROUP_RE.lastIndex = 0;
    for (const [, num, small, big] of s.matchAll(KOR_GROUP_RE)) {
      let v = parseNum(num);
      if (small) v *= SMALL[small];
      if (big) {
        v *= BIG[big];
        lastBig = big;
      } else if (lastBig === "억") {
        v *= 1e4; // "12억 5,000" means 12억 5,000만
      } else if (lastBig === "조") {
        v *= 1e8;
      }
      total += v;
    }
    return total;
  }

  function evaluate(raw) {
    const s = raw.replace(/₩|￦|krw|won|원/gi, "").trim();
    if (/[조억만천백]/.test(s)) return evalKorean(s);
    const m = s.match(PLAIN_RE);
    if (!m) return NaN;
    const mult = m[2] ? MULTS[m[2].toLowerCase()] : 1;
    return mult ? parseNum(m[1]) * mult : NaN;
  }

  // Returns non-overlapping matches: { start, end, kind: "krw" | "area", value, plus }.
  // value is KRW for "krw" and m² for "area".
  function findMatches(text) {
    const out = [];
    KRW_RE.lastIndex = 0;
    for (const m of text.matchAll(KRW_RE)) {
      const raw = m[0].replace(/\s+$/, "");
      const value = Math.round(evaluate(raw));
      if (!(value > 0)) continue;
      const start = m.index;
      const end = start + raw.length;
      out.push({ start, end, kind: "krw", value, plus: text[end] === "+" });
    }
    AREA_RE.lastIndex = 0;
    for (const m of text.matchAll(AREA_RE)) {
      const start = m.index;
      const end = start + m[0].length;
      if (out.some(o => start < o.end && end > o.start)) continue;
      const value = parseNum(m[1]) * M2_PER_PYEONG;
      if (value > 0) out.push({ start, end, kind: "area", value, plus: false });
    }
    return out.sort((a, b) => a.start - b.start);
  }

  const dk = (n, d = 0) => n.toLocaleString("da-DK", { minimumFractionDigits: d, maximumFractionDigits: d });

  function formatDkk(kr, plus = false) {
    const p = plus ? "+" : "";
    if (kr >= 1e9) return `${dk(kr / 1e9, 1)}${p} mia. kr.`;
    if (kr >= 1e8) return `${dk(kr / 1e6, 0)}${p} mio. kr.`;
    if (kr >= 1e6) return `${dk(kr / 1e6, 1)}${p} mio. kr.`;
    if (kr >= 10) return `${dk(Math.round(kr))}${p} kr.`;
    return `${dk(kr, 2)}${p} kr.`;
  }

  const formatArea = m2 => `${dk(Math.round(m2))} m²`;

  const api = { findMatches, evaluate, parseNum, formatDkk, formatArea };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.KrwParser = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
