// Bütün videoları üretir: müzik (music.py) + kayıt (rec4.cjs) + siteye ve tanıtıma giden küçük sürümler.
//   node site/build/video/render4.cjs            hepsi
//   node site/build/video/render4.cjs shorts     adı "shorts" içerenler
//   node site/build/video/render4.cjs --son      yalnız son adım (site sürümleri, kapaklar, demo kopyaları, GIF)
// Ortam: FFMPEG (yoksa "ffmpeg"), PYTHON (yoksa "python"). Büyük dosyalar site/build/video/out/ altında kalır (git'e girmez).
const path = require("path"), fs = require("fs"), { execFileSync } = require("child_process");
const HERE = __dirname, ROOT = path.join(HERE, "../../.."), OUT = path.join(HERE, "out");
const FF = process.env.FFMPEG || "ffmpeg", PY = process.env.PYTHON || "python";
const T = [];
for (const l of ["tr", "en"]) {
  T.push({ n: `tanitim-${l}`, v: "main", l, w: 1920, h: 1080 });
  T.push({ n: `shorts-tiko-${l}`, v: "tiko", l, w: 1080, h: 1920 }, { n: `shorts-su-${l}`, v: "water", l, w: 1080, h: 1920 }, { n: `shorts-model-${l}`, v: "model", l, w: 1080, h: 1920 });
  T.push({ n: `linkedin-${l}`, v: "linkedin", l, w: 1080, h: 1350 });
}
T.push({ n: "demo-en-1920x1080", v: "demo", l: "en", w: 1920, h: 1080 }, { n: "demo-en-1080x1080", v: "demo", l: "en", w: 1080, h: 1080 });

const args = process.argv.slice(2), onlyLast = args.includes("--son"), filt = args.filter((a) => !a.startsWith("--"));
const run = (cmd, a) => execFileSync(cmd, a, { stdio: ["ignore", "pipe", "inherit"] }).toString().trim();
const ff = (a) => run(FF, ["-y", "-loglevel", "error", ...a]);
const mb = (f) => (fs.statSync(f).size / 1048576).toFixed(2) + " MB";
fs.mkdirSync(OUT, { recursive: true });

if (!onlyLast) {
  for (const t of T) {
    if (filt.length && !filt.some((f) => t.n.includes(f))) continue;
    const dur = Number(run(process.execPath, [path.join(HERE, "rec4.cjs"), "sure", t.v, t.l, String(t.w), String(t.h), "-"]));
    const wav = path.join(OUT, `${t.n}.wav`);
    run(PY, [path.join(HERE, "music.py"), String(dur), wav]);
    console.log(run(process.execPath, [path.join(HERE, "rec4.cjs"), "kaydet", t.v, t.l, String(t.w), String(t.h), path.join(OUT, `${t.n}.mp4`), wav]));
    fs.rmSync(wav);
  }
}

// ---- son adım: depoya giren küçük sürümler ----
if (onlyLast || !filt.length) {
  const has = (n) => fs.existsSync(path.join(OUT, n));
  for (const l of ["tr", "en"]) {
    if (!has(`tanitim-${l}.mp4`)) continue;
    const src = path.join(OUT, `tanitim-${l}.mp4`), dst = path.join(ROOT, "site/video", `tanitim-${l}.mp4`), cov = path.join(ROOT, "site/video", `kapak-${l}.jpg`);
    ff(["-i", src, "-vf", "scale=1280:720:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", dst]);
    ff(["-ss", "17", "-i", src, "-frames:v", "1", "-vf", "scale=1280:720:flags=lanczos", "-q:v", "3", cov]); // kapak: tahmin + öneri + Tiko aynı karede
    console.log("site/video/" + path.basename(dst), mb(dst), "·", path.basename(cov), mb(cov));
  }
  const PV = path.join(ROOT, "promo/video"); fs.mkdirSync(PV, { recursive: true });
  for (const n of ["demo-en-1920x1080.mp4", "demo-en-1080x1080.mp4"]) if (has(n)) { fs.copyFileSync(path.join(OUT, n), path.join(PV, n)); console.log("promo/video/" + n, mb(path.join(PV, n))); }
  if (has("demo-en-1920x1080.mp4")) {
    // 800 px GIF, en çok 8 MB: sığmazsa kare hızı ve renk sayısı düşürülür
    const src = path.join(OUT, "demo-en-1920x1080.mp4"), gif = path.join(PV, "demo-en-800.gif");
    for (const [fps, colors] of [[15, 128], [12, 96], [10, 64], [8, 48]]) {
      ff(["-i", src, "-vf", `fps=${fps},scale=800:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, gif]);
      console.log("promo/video/demo-en-800.gif", mb(gif), `(${fps} kare/sn, ${colors} renk)`);
      if (fs.statSync(gif).size <= 8 * 1048576) break;
    }
  }
}
