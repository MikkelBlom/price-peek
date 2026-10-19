// Records promo-video.html into price-peek-promo.mp4: steps render(t) frame by frame in headless Chrome,
// screenshots each frame over the DevTools protocol and pipes them to ffmpeg, then adds a synthesized
// sound-effects track from the page's cue list. Needs Chrome and ffmpeg; no npm packages.
//   node store/video/record.js [--fps 60] [--from 0] [--to 30] [--out file.mp4]
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const arg = (name, def) => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : def; };
const FPS = +arg("fps", 60);
const DIR = __dirname;
const OUT = path.resolve(arg("out", path.join(DIR, "price-peek-promo.mp4")));
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9333;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "pp-video-"));
  const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    "--hide-scrollbars", "--force-color-profile=srgb", "--window-size=1920,1080", "about:blank"], { stdio: "ignore" });
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === "page"); } catch {}
  }
  if (!target) throw new Error("Chrome did not start");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const n = ++id; pending.set(n, m => m.error ? rej(new Error(method + ": " + m.error.message)) : res(m.result));
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  const evaluate = async expr => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };

  await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await send("Page.enable");
  await send("Page.navigate", { url: "file:///" + path.join(DIR, "promo-video.html").replace(/\\/g, "/") + "?record" });
  for (let i = 0; i < 100; i++) { await sleep(100); if (await evaluate("typeof window.ready === 'object'").catch(() => false)) break; }
  await evaluate("window.ready");
  const duration = await evaluate("window.DURATION");
  const sfx = await evaluate("window.SFX");
  // --stills 1.5,8,16 writes single PNG frames to --dir for checking, instead of a video
  const stills = arg("stills");
  if (stills) {
    const dir = path.resolve(arg("dir", "."));
    for (const t of stills.split(",").map(Number)) {
      await evaluate(`render(${t})`);
      const { data } = await send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(dir, `still-${t}.png`), Buffer.from(data, "base64"));
    }
    ws.close(); chrome.kill(); return;
  }
  const from = +arg("from", 0), to = Math.min(+arg("to", duration), duration);
  const frames = Math.round((to - from) * FPS);

  const silent = OUT.replace(/\.mp4$/, ".video.mp4");
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-movflags", "+faststart", silent], { stdio: ["pipe", "inherit", "inherit"] });
  const ffDone = new Promise((res, rej) => ff.on("close", c => c === 0 ? res() : rej(new Error("ffmpeg exited " + c))));

  for (let f = 0; f < frames; f++) {
    const t = from + f / FPS;
    await evaluate(`render(${t})`);
    const { data } = await send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true });
    if (!ff.stdin.write(Buffer.from(data, "base64"))) await new Promise(r => ff.stdin.once("drain", r));
    if (f % FPS === 0) process.stdout.write(`\r${t.toFixed(0)}s / ${to}s`);
  }
  ff.stdin.end();
  await ffDone;
  ws.close(); chrome.kill();
  process.stdout.write("\n");

  // sound effects, shifted to the recorded range
  const wav = OUT.replace(/\.mp4$/, ".sfx.wav");
  fs.writeFileSync(wav, makeSfx(sfx.map(c => ({ ...c, t: c.t - from })).filter(c => c.t >= 0 && c.t < to - from), to - from));
  await new Promise((res, rej) => spawn("ffmpeg", ["-y", "-loglevel", "error", "-i", silent, "-i", wav,
    "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", OUT], { stdio: "inherit" })
    .on("close", c => c === 0 ? res() : rej(new Error("mux failed"))));
  fs.rmSync(silent); fs.rmSync(wav);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  console.log("wrote", OUT);
}

// Small synthesized sounds: soft pops for badges, ticks for keys, a click, a whoosh and a two-note chime.
function makeSfx(cues, seconds) {
  const SR = 48000, n = Math.ceil(seconds * SR), buf = new Float32Array(n);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const add = (t0, len, fn) => { const s0 = Math.round(t0 * SR); for (let i = 0; i < len * SR && s0 + i < n; i++) if (s0 + i >= 0) buf[s0 + i] += fn(i / SR); };
  for (const { t, kind } of cues) {
    if (kind === "pop" || kind === "soft") {
      const f0 = kind === "pop" ? 1250 : 700, f1 = kind === "pop" ? 520 : 380, amp = kind === "pop" ? .22 : .11, d = .09;
      let ph = 0;
      add(t, d, x => { const f = f1 + (f0 - f1) * Math.exp(-x * 45); ph += 2 * Math.PI * f / SR; return Math.sin(ph) * amp * Math.exp(-x * 38) * Math.min(1, x * 2000); });
    } else if (kind === "key") {
      let lp = 0;
      add(t, .035, x => { lp += (rnd() - lp) * .35; return lp * .3 * Math.exp(-x * 160); });
    } else if (kind === "click") {
      let ph = 0;
      add(t, .03, x => { ph += 2 * Math.PI * 1800 / SR; return (Math.sin(ph) * .12 + rnd() * .05) * Math.exp(-x * 220); });
    } else if (kind === "whoosh") {
      let lp = 0, lp2 = 0;
      add(t, .8, x => { const k = .02 + .12 * Math.sin(Math.PI * x / .8); lp += (rnd() - lp) * k; lp2 += (lp - lp2) * k; return lp2 * .5 * Math.sin(Math.PI * x / .8); });
    } else if (kind === "chime") {
      for (const [f, dt] of [[1046.5, 0], [1568, .11]]) add(t + dt, 1.4, x => (Math.sin(2 * Math.PI * f * x) + .25 * Math.sin(4 * Math.PI * f * x)) * .09 * Math.exp(-x * 3.2) * Math.min(1, x * 400));
    }
  }
  const out = Buffer.alloc(44 + n * 2);
  out.write("RIFF", 0); out.writeUInt32LE(36 + n * 2, 4); out.write("WAVE", 8); out.write("fmt ", 12);
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22); out.writeUInt32LE(SR, 24);
  out.writeUInt32LE(SR * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34); out.write("data", 36); out.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf[i])) * 32767), 44 + i * 2);
  return out;
}

main().catch(e => { console.error(e); process.exit(1); });
