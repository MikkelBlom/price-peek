// Finds KRW prices in the page text and shows a small DKK badge on each price's top-right corner.
// Never modifies the page: badges live in a fixed, click-through shadow-DOM layer.
(() => {
  const P = globalThis.KrwParser;
  const MAX_VISIBLE = 3;
  const RATE_MAX_AGE = 12 * 60 * 60 * 1000;
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION", "TEMPLATE", "SVG", "CANVAS", "IFRAME"]);
  const CANDIDATE = /[\d₩￦원억만조천백평]|krw|won/i;

  let settings = { enabled: true, disabledSites: [], showAll: false };
  let rate = null;
  let matches = [];
  let pointer = { x: -1, y: -1 };
  let host, layer, observer, scanTimer, lastScan = 0, frame = 0;
  const range = document.createRange();

  // Inside embedded frames, the site toggle follows the tab's top-level site.
  const siteHost = (() => {
    try {
      const a = location.ancestorOrigins;
      return a && a.length ? new URL(a[a.length - 1]).hostname : location.hostname;
    } catch (e) {
      return location.hostname;
    }
  })();

  const active = () => settings.enabled && !settings.disabledSites.includes(siteHost) && rate;

  // ---------- overlay layer ----------
  function ensureLayer() {
    if (host) return;
    host = document.createElement("krw-dkk-overlay");
    host.style.cssText = "all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647;contain:layout style;";
    const shadow = host.attachShadow({ mode: "closed" });
    shadow.innerHTML = `<style>
      .b { position: fixed; left: 0; top: 0; white-space: nowrap; pointer-events: none;
           font: 600 12px/1.75 "Segoe UI", system-ui, -apple-system, sans-serif; font-variant-numeric: tabular-nums;
           background: #16181d; color: #fff; padding: 0 .55em; border-radius: 6px 6px 6px 1px;
           box-shadow: 0 1px 3px rgba(0,0,0,.25); letter-spacing: 0; }
      .b[hidden] { display: none; }
    </style><div id="l"></div>`;
    layer = shadow.getElementById("l");
    document.documentElement.appendChild(host);
  }

  function clearBadges() {
    matches = [];
    if (layer) layer.textContent = "";
  }

  // ---------- scanning ----------
  // Text is grouped so prices split across elements still match:
  //  - inline elements join their block ancestor directly ("3억 <b>5,000</b>"),
  //  - flex/grid items join their container with a space between items
  //    ("<strong>48,500</strong><span>원</span>" in a flex row, as Naver does).
  const MAX_FLEX_CLIMB = 3;

  function displayOf(el, cache) {
    let d = cache.get(el);
    if (d === undefined) cache.set(el, (d = getComputedStyle(el).display));
    return d;
  }

  function nearestBlock(el, cache) {
    let cur = el;
    while (cur && cur !== document.body && displayOf(cur, cache).startsWith("inline")) cur = cur.parentElement;
    return cur || document.body;
  }

  function contextOf(el, cache) {
    const item = nearestBlock(el, cache);
    let block = item;
    for (let i = 0; i < MAX_FLEX_CLIMB && block !== document.body; i++) {
      const parent = block.parentElement;
      if (!parent || !/flex|grid/.test(displayOf(parent, cache))) break;
      block = nearestBlock(parent, cache);
    }
    return { item, block };
  }

  function scan() {
    lastScan = Date.now();
    if (!active() || !document.body) return clearBadges();
    ensureLayer();

    const cache = new Map();
    const groups = [];
    let current = null;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (!p || SKIP_TAGS.has(p.tagName.toUpperCase()) || p.isContentEditable) return NodeFilter.FILTER_REJECT;
        return CANDIDATE.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });
    for (let n; (n = walker.nextNode()); ) {
      const { item, block } = contextOf(n.parentElement, cache);
      if (!current || current.block !== block) groups.push((current = { block, nodes: [], items: [] }));
      current.nodes.push(n);
      current.items.push(item);
    }

    const found = [];
    for (const g of groups) {
      // Virtual text: node values, with a space wherever the text crosses into another flex/grid item.
      const offsets = [];
      let text = "";
      g.nodes.forEach((n, i) => {
        if (i > 0 && g.items[i] !== g.items[i - 1]) text += " ";
        offsets.push(text.length);
        text += n.nodeValue;
      });
      const hits = P.findMatches(text);
      if (!hits.length) continue;
      const locate = (pos, isEnd) => {
        for (let i = g.nodes.length - 1; i >= 0; i--) {
          if (offsets[i] < pos || (!isEnd && offsets[i] === pos)) {
            return [g.nodes[i], Math.min(pos - offsets[i], g.nodes[i].nodeValue.length)];
          }
        }
        return [g.nodes[0], 0];
      };
      for (const h of hits) {
        const [sNode, sOff] = locate(h.start, false);
        const [eNode, eOff] = locate(h.end, true);
        found.push({ ...h, sNode, sOff, eNode, eOff });
      }
    }

    layer.textContent = "";
    matches = found.map(m => {
      const el = document.createElement("div");
      el.className = "b";
      el.hidden = true;
      el.textContent = m.kind === "area" ? P.formatArea(m.value) : P.formatDkk(m.value * rate.rate, m.plus);
      const fs = parseFloat(getComputedStyle(m.sNode.parentElement).fontSize) || 16;
      el.style.fontSize = Math.min(15, Math.max(11, fs * 0.72)) + "px";
      layer.appendChild(el);
      return { ...m, el, w: 0, h: 0 };
    });
    schedule();
  }

  function requestScan() {
    clearTimeout(scanTimer);
    // Debounced, and at most once a second on pages that never stop changing.
    const wait = Math.max(400, 1000 - (Date.now() - lastScan));
    scanTimer = setTimeout(scan, wait);
  }

  // ---------- positioning ----------
  function schedule() {
    if (!frame) frame = requestAnimationFrame(render);
  }

  function render() {
    frame = 0;
    if (!matches.length) return;
    const vw = innerWidth, vh = innerHeight;
    const visible = [];
    for (const m of matches) {
      m.rect = null;
      if (!m.sNode.isConnected || !m.eNode.isConnected) continue;
      try {
        range.setStart(m.sNode, m.sOff);
        range.setEnd(m.eNode, m.eOff);
      } catch (e) {
        continue; // text changed under us; the next scan fixes it
      }
      const r = range.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
      m.rect = r;
      visible.push(m);
    }
    visible.sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);

    const shown = new Set();
    for (const kind of ["krw", "area"]) {
      const ofKind = visible.filter(m => m.kind === kind);
      (settings.showAll ? ofKind : ofKind.slice(0, MAX_VISIBLE)).forEach(m => shown.add(m));
    }
    for (const m of visible) {
      const r = m.rect;
      if (pointer.x >= r.left - 4 && pointer.x <= r.right + 4 && pointer.y >= r.top - 4 && pointer.y <= r.bottom + 4) shown.add(m);
    }

    for (const m of matches) {
      if (!shown.has(m)) { m.el.hidden = true; continue; }
      if (m.el.hidden) {
        m.el.hidden = false;
        m.w = m.el.offsetWidth;
        m.h = m.el.offsetHeight;
      }
      const x = Math.min(m.rect.right - 10, vw - m.w - 4);
      const y = Math.max(2, m.rect.top - m.h + 1);
      m.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
  }

  // ---------- wiring ----------
  function start() {
    if (observer) return;
    observer = new MutationObserver(requestScan);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    addEventListener("scroll", schedule, { capture: true, passive: true });
    addEventListener("resize", schedule, { passive: true });
    addEventListener("mousemove", e => {
      pointer = { x: e.clientX, y: e.clientY };
      if (matches.length) schedule();
    }, { passive: true });
    scan();
  }

  function stop() {
    if (observer) observer.disconnect();
    observer = null;
    clearBadges();
  }

  function apply() {
    if (!active()) return stop();
    if (observer) scan();
    else start();
  }

  function needsRefresh(r) {
    return !r || !(r.rate > 0) || Date.now() - r.fetchedAt > RATE_MAX_AGE;
  }

  chrome.storage.local.get(["settings", "rate"], data => {
    settings = { ...settings, ...(data.settings || {}) };
    rate = data.rate && data.rate.rate > 0 ? data.rate : null;
    if (needsRefresh(data.rate)) chrome.runtime.sendMessage({ type: "refreshRate" }).catch(() => {});
    if (document.body) apply();
    else addEventListener("DOMContentLoaded", apply, { once: true });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.settings) settings = { ...settings, ...changes.settings.newValue };
    if (changes.rate && changes.rate.newValue && changes.rate.newValue.rate > 0) rate = changes.rate.newValue;
    if (changes.settings || changes.rate) apply();
  });
})();
