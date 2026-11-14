// Lighthouse ölçümü (SITE-SEO.md'deki yöntem): docs/ klasörünü GitHub Pages gibi sunar (/ai-assistant-claude/ yolu,
// gzip, max-age=600), her dil sayfasını mobil (Lighthouse varsayılanı) ve masaüstü ön ayarıyla N kez ölçer,
// performans puanına göre medyan koşuyu yazar. Ölçerken makinede başka iş çalışmamalı.
//   npm install --no-save lighthouse@12.8.2      (depo bağımlılığı değil; başka klasöre kurduysan LH_DIR=<o klasör>)
//   CHROME_PATH=<chrome.exe> node site/build/lighthouse.cjs [docs klasörü] [çıktı.json] [tr,en,…] [koşu sayısı]
const http = require("http"), fs = require("fs"), path = require("path"), zlib = require("zlib"), { pathToFileURL } = require("url");
const DOCS = path.resolve(process.argv[2] || path.join(__dirname, "../../docs"));
const OUT = process.argv[3] || "";
const LANGS = (process.argv[4] || "tr,en,de,fr,es,it,pt,ru,ja,zh").split(",");
const RUNS = Number(process.argv[5] || 3);
const NM = path.join(process.env.LH_DIR || path.join(__dirname, "../.."), "node_modules");
const PRE = "/ai-assistant-claude/";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".woff2": "font/woff2", ".ico": "image/x-icon" };
const GZ = new Set([".html", ".js", ".css", ".json", ".xml", ".txt", ".svg"]);

function serve() {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    if (!u.pathname.startsWith(PRE)) { res.writeHead(404); return res.end(); }
    let p = path.join(DOCS, decodeURIComponent(u.pathname.slice(PRE.length)));
    if (!p.startsWith(DOCS)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
    if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
    const ext = path.extname(p), h = { "Content-Type": TYPES[ext] || "application/octet-stream", "Cache-Control": "max-age=600" };
    let body = fs.readFileSync(p);
    if (GZ.has(ext) && /gzip/.test(req.headers["accept-encoding"] || "")) { body = zlib.gzipSync(body); h["Content-Encoding"] = "gzip"; }
    h["Content-Length"] = body.length;
    res.writeHead(200, h); res.end(body);
  });
  return new Promise((r) => srv.listen(0, "127.0.0.1", () => r(srv)));
}

(async () => {
  const imp = (rel) => import(pathToFileURL(path.join(NM, rel)).href);
  const lighthouse = (await imp("lighthouse/core/index.js")).default;
  const desktop = (await imp("lighthouse/core/config/desktop-config.js")).default;
  const launcher = await imp("chrome-launcher/dist/index.js");
  const srv = await serve(), base = `http://127.0.0.1:${srv.address().port}${PRE}`;
  const res = {};
  for (const form of ["mobil", "masaustu"]) {
    res[form] = {};
    for (const l of LANGS) {
      const runs = [];
      for (let i = 0; i < RUNS; i++) {
        const chrome = await launcher.launch({ chromePath: process.env.CHROME_PATH, chromeFlags: ["--headless=new", "--no-first-run", "--disable-gpu"] });
        try {
          const r = await lighthouse(base + (l === "tr" ? "" : l + "/"), { port: chrome.port, output: "json", logLevel: "error" }, form === "masaustu" ? desktop : undefined);
          const c = r.lhr.categories, a = r.lhr.audits;
          runs.push({ perf: Math.round(c.performance.score * 100), a11y: Math.round(c.accessibility.score * 100), best: Math.round(c["best-practices"].score * 100), seo: Math.round(c.seo.score * 100),
            lcp: +(a["largest-contentful-paint"].numericValue / 1000).toFixed(2), cls: +a["cumulative-layout-shift"].numericValue.toFixed(3), tbt: Math.round(a["total-blocking-time"].numericValue),
            kb: Math.round(a["total-byte-weight"].numericValue / 1024) });
        } finally { await chrome.kill(); }
      }
      const sorted = runs.slice().sort((x, y) => x.perf - y.perf), med = sorted[Math.floor(sorted.length / 2)];
      res[form][l] = { ...med, runs: runs.map((x) => x.perf) };
      console.log(form, l, JSON.stringify(res[form][l]));
    }
  }
  srv.close();
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
