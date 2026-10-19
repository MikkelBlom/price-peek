// Records promo-video.html into price-peek-promo.mp4: steps render(t) in headless Chrome over the DevTools
// protocol and pipes screenshots to ffmpeg. Each output frame averages several sub-frames spread over a
// 180° shutter, which gives real motion blur on fast camera moves. Needs Chrome and ffmpeg; no npm packages.
//   node store/video/record.js [--fps 60] [--sub 6] [--from 0] [--to 30] [--audio music.mp3] [--out file.mp4]
//   node store/video/record.js --stills 2,10,16 --dir out/   (single PNG frames, no blur, for checking)
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const arg = (name, def) => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : def; };
const FPS = +arg("fps", 60);
const SUB = +arg("sub", 6);
const SHUTTER = 0.5;
const DIR = __dirname;
const OUT = path.resolve(arg("out", path.join(DIR, "price-peek-promo.mp4")));
const AUDIO = arg("audio");
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
  const done = () => { ws.close(); chrome.kill(); try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} };

  await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await send("Page.enable");
  await send("Page.navigate", { url: "file:///" + path.join(DIR, "promo-video.html").replace(/\\/g, "/") + "?record" });
  for (let i = 0; i < 100; i++) { await sleep(100); if (await evaluate("typeof window.ready === 'object'").catch(() => false)) break; }
  await evaluate("window.ready");
  const shot = async (t, format = "png") => {
    await evaluate(`render(${t})`);
    return Buffer.from((await send("Page.captureScreenshot", { format, optimizeForSpeed: true })).data, "base64");
  };

  const stills = arg("stills");
  if (stills) {
    const dir = path.resolve(arg("dir", "."));
    for (const t of stills.split(",").map(Number)) fs.writeFileSync(path.join(dir, `still-${t}.png`), await shot(t));
    return done();
  }

  const duration = await evaluate("window.DURATION");
  const from = +arg("from", 0), to = Math.min(+arg("to", duration), duration);
  const frames = Math.round((to - from) * FPS);
  // average each group of SUB sub-frames into one output frame
  const vf = SUB > 1 ? `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/${FPS}/TB` : "null";
  const ffArgs = ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS * SUB), "-i", "-"];
  if (AUDIO) ffArgs.push("-i", AUDIO);
  ffArgs.push("-vf", vf, "-r", String(FPS), "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p");
  if (AUDIO) ffArgs.push("-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "192k", "-shortest");
  ffArgs.push("-movflags", "+faststart", OUT);
  const ff = spawn("ffmpeg", ffArgs, { stdio: ["pipe", "inherit", "inherit"] });
  const ffDone = new Promise((res, rej) => ff.on("close", c => c === 0 ? res() : rej(new Error("ffmpeg exited " + c))));

  const t0 = Date.now();
  for (let f = 0; f < frames; f++) {
    for (let s = 0; s < SUB; s++) {
      // sub-frames centred on the frame time, spanning SHUTTER of a frame
      const t = from + (f + (SUB > 1 ? (s / (SUB - 1) - .5) * SHUTTER : 0)) / FPS;
      const img = await shot(Math.max(0, t));
      if (!ff.stdin.write(img)) await new Promise(r => ff.stdin.once("drain", r));
    }
    if (f % FPS === 0) process.stdout.write(`\r${(from + f / FPS).toFixed(0)}s / ${to}s  (${((Date.now() - t0) / 1000).toFixed(0)}s elapsed)`);
  }
  ff.stdin.end();
  await ffDone;
  done();
  console.log("\nwrote", OUT);
}

main().catch(e => { console.error(e); process.exit(1); });
