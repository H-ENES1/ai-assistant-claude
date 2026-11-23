// Video kaydedici: anim4.html'i kare kare çizer, kareleri doğrudan ffmpeg'e akıtır (diske kare yazılmaz).
//   node site/build/video/rec4.cjs onizle <video> <dil> <genişlik> <yükseklik> <klasör> [saniye,saniye,…]
//   node site/build/video/rec4.cjs kaydet <video> <dil> <genişlik> <yükseklik> <çıktı.mp4> [müzik.wav]
//   node site/build/video/rec4.cjs sure   <video> <dil> <genişlik> <yükseklik> -
// Ortam: FFMPEG = ffmpeg yolu (yoksa PATH'teki "ffmpeg"). Playwright depo kökündeki node_modules'tan gelir.
const path = require("path"), fs = require("fs"), { spawn } = require("child_process"), { pathToFileURL } = require("url");
const { chromium } = require(path.join(__dirname, "../../../node_modules/playwright"));
const FPS = 30;

(async () => {
  const [mode, v, lang, w, h, out, extra] = process.argv.slice(2);
  const W = Number(w), H = Number(h);
  if (!["onizle", "kaydet", "sure"].includes(mode) || !W || !H || !out) { console.error("kullanım: dosyanın başına bak"); process.exit(2); }
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e))); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto(pathToFileURL(path.join(__dirname, "anim4.html")).href + `?v=${v}&lang=${lang}&w=${W}&h=${H}`);
  await p.evaluate(() => document.fonts.ready);
  const DUR = await p.evaluate(() => window.DUR);
  if (errs.length || !DUR) { console.error("sayfa hatası:", errs.join("\n")); await b.close(); process.exit(1); }

  if (mode === "sure") { console.log(DUR); await b.close(); return; } // yalnız süreyi yazar (müzik uzunluğu için)

  if (mode === "onizle") {
    fs.mkdirSync(out, { recursive: true });
    const ts = extra ? extra.split(",").map(Number) : Array.from({ length: Math.ceil(DUR / 2) }, (_, i) => i * 2 + 1).filter((t) => t < DUR).concat([DUR - 0.05]);
    for (const t of ts) {
      await p.evaluate((t) => window.render(t), t);
      await p.screenshot({ path: path.join(out, `${v}-${lang}-${W}x${H}-${t.toFixed(2).padStart(6, "0")}.png`) });
    }
    console.log(errs.length ? "HATA " + errs.join("\n") : "ok", v, lang, `${W}x${H}`, DUR + " sn", ts.length + " kare");
    await b.close(); return;
  }

  const N = Math.round(DUR * FPS);
  const args = ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-"];
  if (extra) args.push("-i", extra);
  // JPEG kareler tam aralıklı BT.601 gelir; videoya BT.709 sınırlı aralık olarak çevrilir (renk kayması olmasın)
  args.push("-vf", "scale=in_color_matrix=bt601:in_range=pc:out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv");
  if (extra) args.push("-c:a", "aac", "-b:a", "128k", "-shortest");
  args.push("-movflags", "+faststart", out);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const ff = spawn(process.env.FFMPEG || "ffmpeg", args, { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((res, rej) => { ff.on("close", (c) => (c === 0 ? res() : rej(new Error("ffmpeg çıkış kodu " + c)))); ff.on("error", rej); });
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    await p.evaluate((t) => window.render(t), i / FPS);
    const buf = await p.screenshot({ type: "jpeg", quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end(); await done;
  console.log(errs.length ? "HATA " + errs.join("\n") : "ok", path.basename(out), `${W}x${H}`, DUR + " sn", N + " kare", Math.round((Date.now() - t0) / 1000) + " sn sürdü", (fs.statSync(out).size / 1048576).toFixed(2) + " MB");
  await b.close();
  if (errs.length) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
