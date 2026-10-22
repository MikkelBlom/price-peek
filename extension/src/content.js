// Finds prices (and 평/坪/畳/근) in the page text and shows a small badge with the converted value
// on each one's top-right corner, in the currency picked in the popup.
// Never modifies the page: badges live in a fixed, click-through shadow-DOM layer.
(() => {
  const P = globalThis.KrwParser;
  const MAX_VISIBLE = 3;
  const RATE_MAX_AGE = 12 * 60 * 60 * 1000;
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION", "TEMPLATE", "SVG", "CANVAS", "IFRAME"]);
  // Every match needs a digit, so text groups without one are skipped before the (slower) parser runs.
  const CANDIDATE = /\d/;
  const ITEM_GAP = " ";

  let settings = { enabled: true, disabledSites: [], showAll: false, target: "DKK", disabledCurrencies: [], units: true };
  let rates = null;
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

  const active = () => settings.enabled && !settings.disabledSites.includes(siteHost) && rates;

  // Badge text, or null when this match shouldn't get a badge.
  function labelFor(m) {
    if (m.kind === "area") return settings.units ? P.formatArea(m.value) : null;
    if (m.kind === "weight") return settings.units ? P.formatWeight(m.value) : null;
    if (m.currency === settings.target || settings.disabledCurrencies.includes(m.currency)) return null;
    const v = P.convert(m.value, m.currency, settings.target, rates.rates);
    return v > 0 ? P.formatMoney(v, settings.target, m.plus) : null;
  }

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
    // A manual popover lives in the browser's top layer, so badges can sit above modal dialogs
    // (LinkedIn's post composer) and fullscreen elements, which no z-index can beat.
    if (host.showPopover) host.popover = "manual";
    raiseLayer();
  }

  // The top layer stacks in opening order: re-show the overlay whenever another top-layer element is open,
  // so it stays the last (topmost) one. Hiding and re-showing in the same task causes no flicker.
  const TOP_LAYER = "dialog:modal, :popover-open:not(krw-dkk-overlay), :fullscreen";
  function raiseLayer() {
    if (!host || !host.showPopover) return;
    try {
      if (host.matches(":popover-open")) {
        if (!document.querySelector(TOP_LAYER)) return;
        host.hidePopover();
      }
      host.showPopover();
    } catch (e) {
      // not connected yet or popovers unsupported: the z-index fallback still applies
    }
  }

  function clearBadges() {
    matches = [];
    fields.clear();
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

  // Ancestors that clip their content (overflow other than visible). Text cut off by one of them,
  // like Google's collapsed "see more" boxes, must not get a badge floating over empty space.
  function clipAncestors(el, cache) {
    const out = [];
    for (let cur = el; cur && cur !== document.documentElement; cur = cur.parentElement) {
      let clips = cache.get(cur);
      if (clips === undefined) {
        const s = getComputedStyle(cur);
        cache.set(cur, (clips = s.overflowX !== "visible" || s.overflowY !== "visible"));
      }
      if (clips) out.push(cur);
    }
    return out;
  }

  function isShownAt(m, r) {
    const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
    for (const c of m.clips) {
      const cr = c.getBoundingClientRect();
      if (cx < cr.left || cx > cr.right || cy < cr.top || cy > cr.bottom) return false;
    }
    const p = m.sNode.parentElement;
    return !p.checkVisibility || p.checkVisibility({ opacityProperty: true, visibilityProperty: true });
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
    // Every text node is kept, even ones without digits: a lone "%" between "15" and "310,000원" must stay a boundary.
    // <br> elements are visited too: a line break separates text just like a flex item boundary does.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(n) {
        if (n.nodeType === 1) return n.tagName === "BR" ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        const p = n.parentElement;
        // Rich-text editors (contenteditable, e.g. a LinkedIn post or a Gmail draft) are scanned like page text:
        // the typed amount gets its badge where it stands, and typing re-scans through the mutation observer.
        if (!p || SKIP_TAGS.has(p.tagName.toUpperCase())) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let breakBefore = false;
    for (let n; (n = walker.nextNode()); ) {
      if (n.nodeType === 1) { breakBefore = true; continue; }
      const { item, block } = contextOf(n.parentElement, cache);
      if (!current || current.block !== block) groups.push((current = { block, nodes: [], items: [], breaks: [] }));
      current.nodes.push(n);
      current.items.push(item);
      current.breaks.push(breakBefore);
      breakBefore = false;
    }

    const found = [];
    for (const g of groups) {
      // Virtual text: node values, with an en space wherever the text crosses into another flex/grid item.
      // An en space still counts as whitespace ("48,500 원") but is never a thousands separator ("15 310,000원").
      const offsets = [];
      let text = "";
      g.nodes.forEach((n, i) => {
        if (i > 0 && (g.breaks[i] || g.items[i] !== g.items[i - 1])) text += ITEM_GAP;
        offsets.push(text.length);
        text += n.nodeValue;
      });
      if (!CANDIDATE.test(text)) continue;
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

    for (const m of matches) m.el.remove();
    const clipCache = new Map();
    pageCurrency = mainCurrency(found);
    matches = found.map(m => ({ ...m, label: labelFor(m) })).filter(m => m.label).map(m => {
      const el = document.createElement("div");
      el.className = "b";
      el.hidden = true;
      el.textContent = m.label;
      const style = getComputedStyle(m.sNode.parentElement);
      const fs = parseFloat(style.fontSize) || 16;
      el.style.fontSize = Math.min(15, Math.max(11, fs * 0.72)) + "px";
      layer.appendChild(el);
      // Crossed-out old prices rank below everything else.
      const struck = style.textDecorationLine.includes("line-through") || !!m.sNode.parentElement.closest("del, s, strike");
      return { ...m, el, w: 0, h: 0, rank: struck ? 0 : fs, clips: clipAncestors(m.sNode.parentElement, clipCache) };
    });
    scanFields();
    raiseLayer();
    schedule();
  }

  function requestScan() {
    clearTimeout(scanTimer);
    // Debounced, and at most once a second on pages that never stop changing.
    const wait = Math.max(400, 1000 - (Date.now() - lastScan));
    scanTimer = setTimeout(scan, wait);
  }

  // ---------- form fields ----------
  // Typed values aren't text nodes, so fields are read separately. A bare number takes the currency
  // named around the field (placeholder, label, nearby text), e.g. Naver's "최소 ___ 원" price filter.
  const FIELD_SELECTOR = "input:not([type]), input[type=text], input[type=search], input[type=number], input[type=tel], textarea";
  const fields = new Map(); // input element → { el, label }
  let pageCurrency = null; // the currency most prices on the page use (at least 3), for bare numbers in fields

  function mainCurrency(found) {
    const counts = {};
    for (const m of found) if (m.kind === "money") counts[m.currency] = (counts[m.currency] || 0) + 1;
    const [top] = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return top && top[1] >= 3 ? top[0] : null;
  }

  function fieldContext(input) {
    const parts = [input.placeholder, input.getAttribute("aria-label"), input.name, input.id];
    if (input.labels) for (const l of input.labels) parts.push(l.textContent);
    let p = input.parentElement;
    for (let i = 0; i < 3 && p; i++, p = p.parentElement) {
      const t = p.textContent;
      if (t.length > 300) break;
      parts.push(t);
    }
    return parts.filter(Boolean).join(" ");
  }

  function scanField(input) {
    const value = (input.value || "").slice(0, 200);
    const m = value.trim() && P.parseFieldValue(value, fieldContext(input), pageCurrency);
    const label = m && labelFor(m);
    let f = fields.get(input);
    if (!label) {
      if (f) { f.el.remove(); fields.delete(input); }
      return;
    }
    if (!f) {
      f = { el: document.createElement("div") };
      f.el.className = "b";
      layer.appendChild(f.el);
      fields.set(input, f);
    }
    if (f.label !== label) {
      f.label = f.el.textContent = label;
      f.w = f.el.offsetWidth;
      f.h = f.el.offsetHeight;
    }
  }

  function scanFields() {
    for (const [input, f] of fields) if (!input.isConnected) { f.el.remove(); fields.delete(input); }
    document.querySelectorAll(FIELD_SELECTOR).forEach(scanField);
  }

  function onFieldInput(e) {
    const t = e.target;
    if (!observer || !layer || !t || !t.matches || !t.matches(FIELD_SELECTOR)) return;
    scanField(t);
    raiseLayer();
    schedule();
  }

  // ---------- positioning ----------
  function schedule() {
    if (!frame) frame = requestAnimationFrame(render);
  }

  function render() {
    frame = 0;
    if (!matches.length && !fields.size) return;
    const vw = innerWidth, vh = innerHeight;
    const placed = [];
    // While a modal dialog or a fullscreen element covers the page, only what's inside it gets badges;
    // the overlay sits above it in the top layer, so badges from the page behind would float on top.
    const modals = document.querySelectorAll("dialog:modal");
    const front = document.fullscreenElement || modals[modals.length - 1] || null;
    const behind = node => !!front && !front.contains(node);

    // Field badges always show, and go first so price badges make room for them.
    for (const [input, f] of fields) {
      const r = input.getBoundingClientRect();
      const off = !r.width || !r.height || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw || behind(input);
      f.el.hidden = off;
      if (off) continue;
      const x = Math.min(r.right - 10, vw - f.w - 4);
      const y = Math.max(2, r.top - f.h + 1);
      placed.push({ x, y, w: f.w, h: f.h });
      f.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }

    const visible = [];
    for (const m of matches) {
      m.rect = null;
      if (!m.sNode.isConnected || !m.eNode.isConnected || behind(m.sNode)) continue;
      try {
        range.setStart(m.sNode, m.sOff);
        range.setEnd(m.eNode, m.eOff);
      } catch (e) {
        continue; // text changed under us; the next scan fixes it
      }
      const r = range.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
      if (!isShownAt(m, r)) continue;
      m.rect = r;
      visible.push(m);
    }
    // The limited set favours the biggest text on screen (the main prices), then top to bottom.
    visible.sort((a, b) => b.rank - a.rank || a.rect.top - b.rect.top || a.rect.left - b.rect.left);

    const shown = new Set();
    // Money and units each get their own limit of MAX_VISIBLE.
    for (const isMoney of [true, false]) {
      const ofKind = visible.filter(m => (m.kind === "money") === isMoney);
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
      let x = Math.min(m.rect.right - 10, vw - m.w - 4);
      let y = Math.max(2, m.rect.top - m.h + 1);
      // Prices close together on one line: slide right past the badge in the way, or stack above it.
      for (const p of placed) {
        if (x < p.x + p.w + 3 && x + m.w + 3 > p.x && y < p.y + p.h && y + m.h > p.y) {
          if (p.x + p.w + 3 + m.w <= vw - 4) x = p.x + p.w + 3;
          else y = p.y - m.h - 2;
        }
      }
      placed.push({ x, y, w: m.w, h: m.h });
      m.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
  }

  // ---------- wiring ----------
  let wired = false;

  function start() {
    if (observer) return;
    observer = new MutationObserver(requestScan);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    if (!wired) {
      // Listeners stay after stop(); they do nothing while there is nothing to show.
      wired = true;
      addEventListener("scroll", schedule, { capture: true, passive: true });
      addEventListener("resize", schedule, { passive: true });
      addEventListener("input", onFieldInput, { capture: true, passive: true });
      addEventListener("change", onFieldInput, { capture: true, passive: true });
      // Dialogs, popovers and fullscreen open and close through attributes and the top layer, which the
      // mutation observer doesn't see: re-raise the overlay and redraw (who's in front decides who gets badges).
      const onTopLayer = () => { if (observer) { raiseLayer(); schedule(); } };
      for (const type of ["toggle", "close", "cancel"]) addEventListener(type, onTopLayer, { capture: true, passive: true });
      document.addEventListener("fullscreenchange", onTopLayer, { passive: true });
      addEventListener("mousemove", e => {
        pointer = { x: e.clientX, y: e.clientY };
        if (matches.length) schedule();
      }, { passive: true });
    }
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

  const validRates = r => (r && r.rates && r.rates.EUR === 1 ? r : null);

  chrome.storage.local.get(["settings", "rates"], data => {
    settings = { ...settings, ...(data.settings || {}) };
    rates = validRates(data.rates);
    if (!rates || Date.now() - rates.fetchedAt > RATE_MAX_AGE) chrome.runtime.sendMessage({ type: "refreshRate" }).catch(() => {});
    if (document.body) apply();
    else addEventListener("DOMContentLoaded", apply, { once: true });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.settings) settings = { ...settings, ...changes.settings.newValue };
    if (changes.rates && validRates(changes.rates.newValue)) rates = changes.rates.newValue;
    if (changes.settings || changes.rates) apply();
  });
})();
