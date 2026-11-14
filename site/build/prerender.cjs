// Dil sayfalarını önceden işler: her sayfayı gerçek tarayıcıda (Playwright) bir kez çalıştırır, sayfa kodunun ürettiği
// metni (data-i çevirileri, demo, model kartları, grafikler) HTML'e yazar. Böylece arama motoru ve JS'siz okuyucu
// metni hazır görür; ziyaretçide JS aynı içeriği yeniden çizer (TF_PAGE.done = true: çeviri adımı atlanır).
// Ayrıca: SSS'den FAQPage yapısal verisi, 1200×630 paylaşım görselleri (TR, EN).
// Kullanım: node site/build/prerender.cjs <docs klasörü>   (build.py çağırır)
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { serve } = require("./serve.cjs");

const DOCS = path.resolve(process.argv[2] || path.join(__dirname, "../../docs"));
const LANGS = ["tr", "en", "de", "fr", "es", "it", "pt", "ru", "ja", "zh"];
const HTML_LANG = { pt: "pt-BR", zh: "zh-CN" };
// Demo, yoğun saat uyarısını saate göre gösterir; çıktı her derlemede aynı olsun diye sabit, yoğun olmayan bir an (pazar).
const FIXED_TIME = new Date("2026-11-15T12:00:00Z");

const OG = {
  tr: { brand: "Token Tahmini", sub: "Claude kullanım limiti · token sayacı · model önerisi", foot: "Ücretsiz Chrome eklentisi · açık kaynak · mesajın cihazından çıkmaz", meter: "5 saatlik limit", used: "kullanılan", msg: "bu mesaj" },
  en: { brand: "Token Forecast", sub: "Claude usage limit · token counter · model suggestion", foot: "Free Chrome extension · open source · your messages stay on your device", meter: "5-hour limit", used: "used", msg: "this message" },
};
const ogHtml = (o, h1, bot) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
*{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;overflow:hidden}
body{background:#262624;color:#faf9f5;font-family:Inter,"Segoe UI",sans-serif;position:relative}
.grid{position:absolute;inset:0;background-image:linear-gradient(#30302e 1px,transparent 1px),linear-gradient(90deg,#30302e 1px,transparent 1px);background-size:40px 40px;opacity:.55}
.l{position:absolute;left:72px;top:64px;width:780px}
.brand{display:flex;align-items:center;gap:14px;font:600 34px Newsreader,Georgia,serif}
h1{font:500 88px/1.02 Newsreader,Georgia,serif;letter-spacing:-.015em;margin:42px 0 22px}
h1 em{color:#e8896a}
.sub{font-size:27px;color:#d6d4cb;font-weight:500}
.card{position:absolute;left:72px;top:448px;width:700px;background:#30302e;border:2px solid #44433f;border-radius:18px;padding:20px 24px}
.card .t{display:flex;justify-content:space-between;font:500 19px "IBM Plex Mono",monospace;color:#b0aea5;letter-spacing:.04em}
.bar{margin-top:14px;height:22px;border-radius:11px;background:#3d3d3a;overflow:hidden;display:flex}
.bar i{display:block;height:100%}
.foot{position:absolute;left:72px;bottom:26px;font-size:19px;color:#b0aea5}
.bot{position:absolute;right:96px;bottom:118px;width:252px;height:306px}
.bot svg{width:100%;height:100%;shape-rendering:crispEdges;overflow:visible}
.bot .lgB{display:none}.bot .lid{opacity:0}
.shadow{position:absolute;right:120px;bottom:104px;width:204px;height:22px;border-radius:50%;background:rgba(0,0,0,.35)}
.plat{position:absolute;right:56px;bottom:84px;width:332px;height:20px;border-radius:10px;background:#3d3d3a;border:2px solid #44433f}
</style></head><body><div class="grid"></div>
<div class="l"><div class="brand"><svg width="44" height="44" viewBox="0 0 26 26"><circle cx="13" cy="13" r="11.5" fill="none" stroke="#faf9f5" stroke-width="2"/><path d="M13 13 L19.5 7.5" stroke="#d97757" stroke-width="2.6" stroke-linecap="round"/><circle cx="13" cy="13" r="2" fill="#faf9f5"/></svg>${o.brand}</div>
<h1>${h1}</h1><div class="sub">${o.sub}</div></div>
<div class="card"><div class="t"><span>${o.meter}</span><span>▮ ${o.used} &nbsp; <span style="color:#d97757">▮ ${o.msg}</span></span></div><div class="bar"><i style="width:58%;background:#77756d"></i><i style="width:9%;background:#d97757"></i></div></div>
<div class="plat"></div><div class="shadow"></div><div class="bot">${bot}</div>
<div class="foot">${o.foot}</div></body></html>`;

(async () => {
  const srv = await serve(DOCS);
  const base = srv.base;
  const browser = await chromium.launch();
  const errs = [];
  const bots = {}, h1s = {};
  for (const l of LANGS) {
    const file = l === "tr" ? path.join(DOCS, "index.html") : path.join(DOCS, l, "index.html");
    // reducedMotion: sahne ve hikâye son durumlarında (hareketsiz) yazılır; JS'siz okuyucu ve az hareket tercihi bunu görür.
    const ctx = await browser.newContext({ locale: HTML_LANG[l] || l, viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errs.push(`${l}: ${e}`));
    page.on("console", (m) => m.type() === "error" && !/fonts|favicon|net::ERR/.test(m.text()) && errs.push(`${l}: ${m.text()}`));
    await page.clock.setFixedTime(FIXED_TIME);
    await page.goto(base + (l === "tr" ? "" : l + "/"), { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelectorAll("#modelCards article").length === 4 && document.getElementById("tfbot") && document.querySelector("#proofStats .stat") && document.getElementById("tfStage") && document.querySelector("#stTiko svg"), null, { timeout: 30000 });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const bot = document.querySelector("#tfbot svg").outerHTML;
      document.getElementById("tfbot").remove();
      const lb = document.getElementById("lbox"); if (lb) lb.remove();
      const hint = document.getElementById("langHint"); hint.hidden = true;
      document.getElementById("stage").classList.remove("tk-out", "live"); document.getElementById("stTiko").removeAttribute("style");
      // form durumunu özniteliğe yaz (innerHTML yalnızca öznitelikleri taşır)
      document.querySelectorAll("textarea").forEach((t) => { t.textContent = t.value; });
      document.querySelectorAll("select").forEach((s) => [...s.options].forEach((o) => o.toggleAttribute("selected", o.selected)));
      document.querySelectorAll("input").forEach((i) => i.setAttribute("value", i.value));
      document.querySelectorAll('script[src*="app.js"]').forEach((x) => x.remove()); // yükleyici ekledi; son sayfada yükleyici yeniden ekler
      const sc = document.getElementById("tfPage");
      sc.textContent = sc.textContent.replace("window.TF_PAGE={", 'window.TF_PAGE={"done":true,');
      const faq = [...document.querySelectorAll(".faq details")].map((d) => ({ q: d.querySelector("summary").textContent.trim(), a: d.querySelector("p").textContent.trim() }));
      return { body: document.body.innerHTML, faq, bot, h1: document.querySelector("h1").innerHTML, lang: document.documentElement.lang };
    });
    if (r.lang !== (HTML_LANG[l] || l)) errs.push(`${l}: html lang ${r.lang}`);
    bots[l] = r.bot; h1s[l] = r.h1;
    let html = fs.readFileSync(file, "utf8");
    const ld = { "@context": "https://schema.org", "@type": "FAQPage", inLanguage: HTML_LANG[l] || l,
      mainEntity: r.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
    html = html.replace("<!--FAQLD-->", `<script type="application/ld+json">${JSON.stringify(ld).replace(/<\//g, "<\\/")}</script>`);
    html = html.slice(0, html.indexOf("<body>") + 6) + "\n" + r.body.trim() + "\n</body>\n</html>\n";
    fs.writeFileSync(file, html);
    console.log(`prerender ${l}: ${r.faq.length} SSS, ${(html.length / 1024).toFixed(0)} KB`);
    await ctx.close();
  }
  // paylaşım görselleri
  for (const cl of ["tr", "en"]) {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.setContent(ogHtml(OG[cl], h1s[cl], bots[cl]), { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    fs.mkdirSync(path.join(DOCS, "img"), { recursive: true });
    await page.screenshot({ path: path.join(DOCS, "img", `og-${cl}.png`) });
    await ctx.close();
  }
  await browser.close();
  srv.close();
  if (errs.length) { console.error("HATA:\n" + errs.join("\n")); process.exit(1); }
})();
