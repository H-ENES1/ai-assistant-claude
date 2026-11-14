// Site testi: docs/ altındaki her dil sayfası (/ = tr, /en/ … /zh/). Önce `python site/build/build.py`.
//   node site/build/site-test.cjs
// Denetler: arama motoru etiketleri (lang, title, description, canonical, hreflang, OG, JSON-LD), JS'siz metin,
// görseller (WebP, srcset, yükleniyor, büyütme), video, demo, bölümler, Tiko, dil seçici (URL'ye gider),
// dil önerisi şeridi (yönlendirme yok), yatay taşma, konsol hataları, site haritası.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { serve, DOCS } = require("./serve.cjs");

const LANGS = ["tr", "en", "de", "fr", "es", "it", "pt", "ru", "ja", "zh"];
const HTML_LANG = { pt: "pt-BR", zh: "zh-CN" };
const BASE = "https://h-enes1.github.io/ai-assistant-claude/";
const SEO = JSON.parse(fs.readFileSync(path.join(__dirname, "seo.json"), "utf8"));
const url = (l) => (l === "tr" ? "" : l + "/");
const file = (l) => path.join(DOCS, l === "tr" ? "index.html" : l + "/index.html");

(async () => {
  const srv = await serve();
  const b = await chromium.launch();
  const errs = []; let fails = 0;
  const ok = (n, c, i = "") => { console.log(`${c ? "✓" : "✗"} ${n}${i ? " — " + i : ""}`); if (!c) fails++; };
  const watch = (p, tag) => {
    p.on("pageerror", (e) => errs.push(tag + ": " + e));
    p.on("console", (m) => m.type() === "error" && !/fonts|favicon|net::ERR/.test(m.text()) && errs.push(tag + ": " + m.text()));
    p.on("requestfailed", (r) => /img\/|video\/|app\.js/.test(r.url()) && !/ERR_ABORTED/.test(r.failure()?.errorText || "") && errs.push(tag + ": yüklenmedi " + r.url()));
  };

  // ---- site haritası ----
  const sm = fs.readFileSync(path.join(DOCS, "sitemap.xml"), "utf8");
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  ok("site haritası: 10 dil + gizlilik", LANGS.every((l) => locs.includes(BASE + url(l))) && locs.includes(BASE + "privacy.html") && locs.length === 11, String(locs.length));
  ok("site haritası: her dil sayfasında 11 xhtml:link (10 dil + x-default)", (sm.match(/<xhtml:link /g) || []).length === 110 && /xmlns:xhtml="http:\/\/www.w3.org\/1999\/xhtml"/.test(sm));
  ok("robots.txt site haritasını gösteriyor", /Sitemap: https:\/\/h-enes1\.github\.io\/ai-assistant-claude\/sitemap\.xml/.test(fs.readFileSync(path.join(DOCS, "robots.txt"), "utf8")));
  for (const cl of ["tr", "en"]) {
    const png = fs.readFileSync(path.join(DOCS, "img", `og-${cl}.png`));
    ok(`[${cl}] paylaşım görseli 1200×630`, png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630, `${(png.length / 1024).toFixed(0)} KB`);
  }

  for (const l of LANGS) {
    const T = `[${l}]`;
    // ---- ham HTML (JS çalışmadan): etiketler ve metin ----
    const raw = fs.readFileSync(file(l), "utf8");
    const head = raw.slice(0, raw.indexOf("</head>"));
    const meta = (re) => (head.match(re) || [])[1];
    ok(`${T} <html lang>`, new RegExp(`<html lang="${HTML_LANG[l] || l}">`).test(raw));
    ok(`${T} title ve description dile özel`, meta(/<title>([^<]+)<\/title>/) === SEO[l].title.replace(/&/g, "&amp;") && (meta(/<meta name="description" content="([^"]+)"/) || "").length > 60, meta(/<title>([^<]+)<\/title>/));
    ok(`${T} canonical kendi adresi`, meta(/<link rel="canonical" href="([^"]+)"/) === BASE + url(l));
    const hl = [...head.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map((m) => m[1] + "=" + m[2]);
    ok(`${T} hreflang: 10 dil + x-default=/en/`, hl.length === 11 && LANGS.every((x) => hl.includes(`${x}=${BASE + url(x)}`)) && hl.includes(`x-default=${BASE}en/`), String(hl.length));
    const og = meta(/<meta property="og:image" content="([^"]+)"/);
    ok(`${T} Open Graph ve Twitter kartı`, og === `${BASE}img/og-${l === "tr" ? "tr" : "en"}.png` && /og:locale" content="[a-z]{2}_[A-Z]{2}"/.test(head) && /twitter:card" content="summary_large_image"/.test(head) && meta(/og:url" content="([^"]+)"/) === BASE + url(l));
    const lds = [...head.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const app = lds.find((x) => x["@type"] === "SoftwareApplication"), faq = lds.find((x) => x["@type"] === "FAQPage");
    ok(`${T} JSON-LD SoftwareApplication (dile özel)`, app && app.inLanguage === (HTML_LANG[l] || l) && app.url === BASE + url(l) && app.description === SEO[l].desc && app.offers.price === "0");
    ok(`${T} JSON-LD FAQPage, 12 soru`, faq && faq.mainEntity.length === 12 && faq.mainEntity.every((q) => q.name.length > 2 && q.acceptedAnswer.text.length > 5));
    const body = raw.slice(raw.indexOf("<body>"));
    const h1 = (body.match(/<h1[^>]*>(.*?)<\/h1>/) || [])[1] || "";
    ok(`${T} metin HTML'de hazır (JS'siz): h1, SSS, model kartları`, h1.length > 5 && (l === "tr" || !/Göndermeden/.test(h1)) && (body.match(/<details>/g) || []).length === 12 && (body.match(/<article class="model">/g) || []).length === 4, h1.replace(/<[^>]+>/g, ""));
    ok(`${T} başka dilin metni sızmamış`, l === "tr" ? !/Know <em>before/.test(body) : !/Hesap yok|Sıkça|Aklına takılabilecekler/.test(body));
    ok(`${T} SSS yapısal verisi görünen SSS ile aynı`, faq && faq.mainEntity[0].name === ((body.match(/<summary data-i="q11">([^<]+)</) || [])[1] || "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"'));

    {
      const st = (body.match(/<script type="application\/json" id="tfStage">(.*?)<\/script>/s) || [])[1];
      let sj = null; try { sj = JSON.parse(st); } catch (_) {}
      ok(`${T} sahne HTML'de son durumda (JS'siz): tahmin, öneri, Tiko, veri`, /id="stage"[^>]*data-ph="done"/.test(body) && /id="stBig">≈[^<]*\d[^<]*</.test(body) && /id="stAdvT">[^<]{8,}</.test(body) && /id="stTiko"[^>]*><svg/.test(body) && sj && sj.ex.length === 3 && sj.ex.every((x) => x.text.length > 20 && /\d/.test(x.big) && x.adv.length > 8), (body.match(/id="stBig">([^<]*)</) || [])[1]);
      ok(`${T} hikâye 6 bölüm, su örneği ve ölçüm çubukları HTML'de`, (body.match(/<li class="chap">/g) || []).length === 6 && /id="sc5W">≈[^<]*\d[^<]*(mL|L)</.test(body) && (body.match(/class="v" data-v="[\d.]+">[^<]*\d[^<]*</g) || []).length === 4 && (body.match(/<i class="(g|c|w|)"><\/i>/g) || []).length >= 58, (body.match(/id="sc5W">([^<]*)</) || [])[1]);
    }

    // ---- tarayıcıda ----
    const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: HTML_LANG[l] || l, colorScheme: "light" });
    const p = await ctx.newPage(); watch(p, l);
    await p.goto(srv.base + url(l)); await p.waitForTimeout(1800);
    ok(`${T} otomatik yönlendirme yok, şerit yok (tarayıcı dili = sayfa dili)`, p.url() === srv.base + url(l) && (await p.evaluate(() => document.getElementById("langHint").hidden)));
    ok(`${T} lang ve seçici`, (await p.evaluate(() => [document.documentElement.lang, document.getElementById("langSel").value].join())) === `${HTML_LANG[l] || l},${l}`);
    const im = await p.evaluate(() => [...document.querySelectorAll("img[data-img]")].map((i) => ({ src: i.getAttribute("src"), set: i.getAttribute("srcset"), w: +i.getAttribute("width"), h: +i.getAttribute("height"), lazy: i.loading })));
    const cl = l === "tr" ? "tr" : "en";
    ok(`${T} görseller: WebP, srcset, boyut, lazy, dile göre`, im.length === 5 && im.every((x) => x.src.includes(`img/${cl}/`) && /\.webp$/.test(x.src) && /-1x\.webp \d+w, .+\.webp \d+w/.test(x.set) && x.w > 100 && x.h > 100 && x.lazy === "lazy"), im.map((x) => x.src).join(","));
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 100)); } scrollTo(0, 0); });
    await p.waitForTimeout(700);
    const loaded = await p.evaluate(() => [...document.querySelectorAll("img[data-img]")].map((i) => i.complete && i.naturalWidth > 100 && Math.abs(i.naturalWidth / i.naturalHeight - i.width / i.height) < 0.02));
    ok(`${T} 5 görsel yüklendi, en-boy oranı width/height ile aynı`, loaded.every(Boolean), loaded.join(","));
    const lb = await p.evaluate(async () => { document.querySelector("a.zoom").click(); await new Promise((r) => setTimeout(r, 400)); const x = document.getElementById("lbox"); const r = !x.hidden && x.querySelector("img").naturalWidth > 100; x.click(); return r && x.hidden; });
    ok(`${T} görsel büyütme açılıp kapanıyor`, lb);
    const vid = await p.evaluate(() => { const v = document.getElementById("vid"); return { src: v.getAttribute("src"), poster: v.getAttribute("poster"), pre: v.getAttribute("preload"), hid: document.getElementById("vidBox").hidden }; });
    ok(`${T} video: dile göre, WebP kapak, preload=none`, !vid.hid && new RegExp(`video/tanitim-${cl}\\.mp4$`).test(vid.src) && new RegExp(`video/kapak-${cl}\\.webp$`).test(vid.poster) && vid.pre === "none", JSON.stringify(vid));
    // demo
    if (l === "tr" || l === "en") {
      await p.fill("#prompt", l === "tr" ? "Çeviri sistemi olan bir web sitesi yaptıracağım, bu zor bir iş" : "I need a website built with a translation system, it is a hard job");
      await p.waitForTimeout(400);
      const dem = await p.evaluate(() => ({ fType: document.getElementById("fType").textContent, fDom: document.getElementById("fDom").textContent, banner: document.getElementById("banner").innerText }));
      ok(`${T} demo: iş türü kod yazma, Haiku önerilmiyor`, !/Haiku/.test(dem.banner.split("\n")[0]) && /(code|kod)/i.test(dem.fType), dem.fType + " | " + dem.banner.split("\n")[0]);
      ok(`${T} demo: konu satırı dolu`, dem.fDom && dem.fDom !== "–", dem.fDom);
      await p.click("#whyBtn"); await p.waitForTimeout(200);
      const bt = await p.evaluate(() => document.getElementById("banner").innerText);
      ok(`${T} demo: Neden? içinde konu ve effort`, new RegExp(l === "tr" ? "Konu|Alan" : "Topic").test(bt) && /Effort/.test(bt), bt.replace(/\n/g, " | ").slice(0, 120));
    }
    await p.selectOption("#effort", "xhigh"); await p.waitForTimeout(200);
    ok(`${T} demo: Çok yüksek effort seçilebilir, token sayısı var`, (await p.inputValue("#effort")) === "xhigh" && /\d/.test(await p.textContent("#fTok")));
    const cards = await p.locator("#domGrid .dcard").count(), rows = await p.locator("#effTable .effrow").count(), pbar = await p.locator("#proofChart circle").count(), stats = await p.locator("#proofStats .stat").count();
    ok(`${T} alan kartları 16, effort 5(+başlık), kanıt grafiği ve 3 kutu`, cards === 16 && rows === 6 && pbar === 18 && stats === 3, `${cards}/${rows}/${pbar}/${stats}`);
    // Tiko: her dilde konar, seninle iner, konuşur
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
    {
      // kahraman sahnesi: oynar, durdurulur, Tiko fareyi izler ve cevabın üstüne oturur
      await p.evaluate(() => scrollTo({ top: 0, behavior: "instant" })); await p.waitForTimeout(200);
      const sb = await p.locator("#stage").boundingBox();
      await p.mouse.move(sb.x - 200, sb.y + 120, { steps: 3 }); await p.waitForTimeout(500);
      const vis = await p.evaluate(() => { const x = document.getElementById("tfbot"), k = document.getElementById("stTiko"), st = document.getElementById("stage"); const r = k.getBoundingClientRect(); return { away: x.classList.contains("away"), hidden: x.hidden, w: r.width, out: st.classList.contains("tk-out"), op: getComputedStyle(k).opacity }; });
      ok(`${T} kahramanda büyük Tiko görünür, gezen bot sahnede`, !vis.hidden && vis.away && vis.w >= 70 && !vis.out && vis.op === "1", JSON.stringify(vis));
      await p.click("#stTabs button >> nth=0"); await p.waitForTimeout(1500);
      const ty = await p.evaluate(() => ({ ph: document.getElementById("stage").dataset.ph, typed: document.getElementById("stType").textContent.length, pressed: document.querySelector("#stTabs button").getAttribute("aria-pressed") }));
      ok(`${T} sahne: örnek mesaj yazılıyor`, ty.ph === "type" && ty.typed > 5 && ty.pressed === "true", JSON.stringify(ty));
      await p.mouse.move(sb.x + sb.width * 0.7, sb.y + sb.height * 0.45, { steps: 4 }); await p.waitForTimeout(900);
      const fol = await p.evaluate(() => { const r = document.getElementById("stTiko").getBoundingClientRect(); return { x: r.left + r.width / 2, bottom: r.bottom }; });
      ok(`${T} sahne: Tiko fareyi izliyor`, Math.abs(fol.x - (sb.x + sb.width * 0.7)) < 40 && Math.abs(fol.bottom + 16 - (sb.y + sb.height * 0.45)) < 40, JSON.stringify(fol));
      await p.waitForFunction(() => document.getElementById("stage").dataset.ph === "ans", null, { timeout: 9000 }); await p.waitForTimeout(1300);
      const sit = await p.evaluate(() => { const k = document.getElementById("stTiko"), a = document.getElementById("stAns"), st = document.getElementById("stage"); const kr = k.getBoundingClientRect(), ar = a.getBoundingClientRect(); const tp = parseFloat(getComputedStyle(st).getPropertyValue("--tp")); return { d: kr.bottom - 2 * tp - ar.top, cls: k.className, pill: st.classList.contains("pill-on"), big: document.getElementById("stBig").textContent }; });
      ok(`${T} sahne: tahmin hapı görünür, Tiko cevabın üstünde oturuyor`, Math.abs(sit.d) < 4 && /\bsit\b/.test(sit.cls) && sit.pill && /\d/.test(sit.big), JSON.stringify(sit));
      await p.click("#stPlay"); const ph1 = await p.evaluate(() => document.getElementById("stage").dataset.ph + document.getElementById("stPlay").getAttribute("aria-pressed")); await p.waitForTimeout(2600);
      const ph2 = await p.evaluate(() => document.getElementById("stage").dataset.ph + document.getElementById("stPlay").getAttribute("aria-pressed"));
      ok(`${T} sahne: durdur düğmesi durduruyor`, ph1 === ph2 && /true$/.test(ph2), ph1 + " → " + ph2);
      await p.click("#stPlay");
      // hikâye: kaydırdıkça ilerler
      const f = async (frac) => p.evaluate(async (frac) => { const li = document.querySelectorAll(".chap")[1]; scrollTo({ top: li.getBoundingClientRect().top + scrollY - innerHeight * frac, behavior: "instant" }); await new Promise((r) => setTimeout(r, 350)); return Number(li.lastElementChild.style.getPropertyValue("--f")); }, frac);
      const f0 = await f(0.8), f1 = await f(0.2);
      ok(`${T} hikâye: sahne kaydırdıkça ilerliyor (--f)`, f0 < 0.3 && f1 >= 0.95, `${f0} → ${f1}`);
      await p.evaluate(() => scrollTo({ top: 0, behavior: "instant" })); await p.waitForTimeout(300);
    }
    {
      await p.evaluate(() => document.getElementById("ozellikler").scrollIntoView()); await p.waitForTimeout(500);
      const card = p.locator(".feat").nth(4); await card.scrollIntoViewIfNeeded(); await p.waitForTimeout(300); const cb = await card.boundingBox();
      await p.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2, { steps: 5 }); await p.waitForTimeout(1500);
      const pos = await p.evaluate(() => { const r = document.getElementById("tfbot").getBoundingClientRect(); return { x: r.x, bottom: r.bottom }; });
      ok(`${T} Tiko fareyle kartın üstüne kondu`, Math.abs(pos.bottom - cb.y) < 14 && pos.x > cb.x - 60 && pos.x < cb.x + cb.width, `bot alt ${pos.bottom.toFixed(0)} · kart üst ${cb.y.toFixed(0)}`);
      await p.mouse.wheel(0, 900); await p.waitForTimeout(1800);
      const under = await p.evaluate(() => document.getElementById("tfbot").getBoundingClientRect().bottom);
      const hover = await p.evaluate(({ x, y }) => { const el = document.elementsFromPoint(x, y).find((e) => e.id !== "tfbot"); const blk = el.closest(".feat,.stat,.shot,.fact,.model,.dcard,.effrow,.note,.tablebox,.chart,.proofchart,.honest,.loop,.faq details,.road > div,.demo,.sec-head,.formula,.terms > div,.layers li") || el.closest(".wrap > *") || el.closest("section") || el; return blk.getBoundingClientRect().top; }, { x: cb.x + cb.width / 2, y: cb.y + cb.height / 2 });
      const cy = cb.y + cb.height / 2, exp = hover < 78 ? Math.max(cy - 30, 82) : hover + 3; // blok tepesi ekran dışındaysa imlecin yanında yürür
      ok(`${T} kaydırınca Tiko seninle indi`, Math.abs(under - exp) < 110, `bot alt ${under.toFixed(0)} · beklenen ${exp.toFixed(0)} · blok üst ${hover.toFixed(0)}`);
    }
    const bb = await p.evaluate(() => { const r = document.getElementById("tfbot").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await p.mouse.click(bb.x, bb.y); await p.waitForTimeout(300);
    const said = await p.evaluate(() => ({ say: document.getElementById("tfbot").classList.contains("say"), txt: document.querySelector("#tfbot .bub").textContent }));
    ok(`${T} Tiko'ya tıklayınca konuşuyor`, said.say && said.txt.length > 6, said.txt);
    await p.evaluate(() => document.getElementById("botToggle").scrollIntoView()); await p.waitForTimeout(200);
    await p.click("#botToggle"); await p.waitForTimeout(200);
    const hid = await p.evaluate(() => document.getElementById("tfbot").hidden);
    await p.click("#botToggle"); await p.waitForTimeout(1200);
    ok(`${T} Tiko gizlenip geri geliyor`, hid && !(await p.evaluate(() => document.getElementById("tfbot").hidden)));
    ok(`${T} yatay taşma yok`, !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
    // dil seçici: bir sonraki dilin adresine gider
    const nx = LANGS[(LANGS.indexOf(l) + 1) % LANGS.length];
    await p.evaluate(() => scrollTo(0, 0));
    await Promise.all([p.waitForURL(srv.base + url(nx)), p.selectOption("#langSel", nx)]);
    ok(`${T} dil seçici ${nx} adresine gidiyor`, p.url() === srv.base + url(nx) && (await p.evaluate(() => document.documentElement.lang)) === (HTML_LANG[nx] || nx));
    await ctx.close();
  }

  // ---- dil önerisi şeridi ----
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: "en-US" });
    const p = await ctx.newPage(); watch(p, "şerit");
    await p.goto(srv.base); await p.waitForTimeout(800);
    const h = await p.evaluate(() => { const e = document.getElementById("langHint"); return { hidden: e.hidden, txt: e.innerText, href: document.getElementById("lhA").getAttribute("href"), lang: e.lang, top: e.getBoundingClientRect().top }; });
    ok("şerit: tarayıcı İngilizce, sayfa Türkçe → üstte İngilizce öneri, yönlendirme yok", !h.hidden && /available in English/.test(h.txt) && h.href === "en/" && h.lang === "en" && h.top === 0 && p.url() === srv.base, JSON.stringify(h));
    await p.click("#lhX");
    await p.reload(); await p.waitForTimeout(500);
    ok("şerit: kapatınca bir daha çıkmıyor", await p.evaluate(() => document.getElementById("langHint").hidden));
    await ctx.close();
    const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "ja-JP", isMobile: true, hasTouch: true });
    const q = await c2.newPage(); watch(q, "şerit-tel");
    await q.goto(srv.base + "de/"); await q.waitForTimeout(800);
    const h2 = await q.evaluate(() => ({ hidden: document.getElementById("langHint").hidden, txt: document.getElementById("langHint").innerText, over: document.documentElement.scrollWidth > innerWidth }));
    ok("şerit: Japonca tarayıcı, Almanca sayfa → Japonca öneri, telefonda taşma yok", !h2.hidden && /日本語/.test(h2.txt) && !h2.over && q.url() === srv.base + "de/", h2.txt.replace(/\n/g, " "));
    await Promise.all([q.waitForURL(srv.base + "ja/"), q.click("#lhA")]);
    ok("şerit: bağlantı Japonca sayfaya götürüyor, orada şerit yok", (await q.evaluate(() => document.getElementById("langHint").hidden)) && (await q.evaluate(() => document.documentElement.lang)) === "ja");
    await c2.close();
  }
  // ---- az hareket tercihi: sahne ve hikâye hareketsiz, son durumda ----
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: "tr-TR", reducedMotion: "reduce" });
    const p = await ctx.newPage(); watch(p, "az hareket");
    await p.goto(srv.base); await p.waitForTimeout(3500);
    const r = await p.evaluate(() => { const st = document.getElementById("stage"); return { ph: st.dataset.ph, live: st.classList.contains("live"), rv: document.querySelectorAll(".rv").length, f: document.querySelector(".scene").style.getPropertyValue("--f"), play: document.getElementById("stPlay").getAttribute("aria-pressed"), big: document.getElementById("stBig").textContent, tk: document.getElementById("stTiko").getBoundingClientRect().width }; });
    ok("az hareket: sahne son durumda duruyor, oynatma kapalı, bloklar görünür", r.ph === "done" && !r.live && r.rv === 0 && r.f === "" && r.play === "true" && /\d/.test(r.big) && r.tk >= 70, JSON.stringify(r));
    await p.keyboard.press("Tab");
    const keys = await p.evaluate(() => ({ tabs: [...document.querySelectorAll("#stTabs button")].every((x) => x.tabIndex === 0), play: document.getElementById("stPlay").tabIndex === 0, sr: document.getElementById("stSr").textContent.length, hid: document.getElementById("stage").getAttribute("aria-hidden") }));
    ok("erişim: sahne düğmeleri klavyeyle ulaşılır, sahnenin metin karşılığı var", keys.tabs && keys.play && keys.sr > 60 && keys.hid === "true", JSON.stringify(keys));
    await ctx.close();
    // 0.13 öncesi app.js 299.340 bayttı (site-seo); yeni sahne, hikâye ve ölçüm kodu 100 KB'ı geçmemeli
    const added = fs.statSync(path.join(DOCS, "app.js")).size - 299340;
    ok("ek betik 100 KB'ın altında", added < 100 * 1024, `${(added / 1024).toFixed(1)} KB`);
  }
  // ---- JS kapalı ----
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, javaScriptEnabled: false });
    const p = await ctx.newPage();
    await p.goto(srv.base + "fr/");
    const t = await p.evaluate(() => ({ h1: document.querySelector("h1").innerText, faq: document.querySelectorAll(".faq details").length, model: document.querySelectorAll("#modelCards article").length, links: document.querySelectorAll("footer .langs a[hreflang]").length }));
    ok("JS kapalı: Fransızca metin, SSS, model kartları ve 10 dil bağlantısı görünüyor", /envoyer/.test(t.h1) && t.faq === 12 && t.model === 4 && t.links === 10, JSON.stringify(t));
    await ctx.close();
  }
  console.log(errs.length ? "HATA:\n" + errs.join("\n") : "konsol hatası yok");
  if (errs.length) fails++;
  console.log(fails ? fails + " başarısız" : "hepsi geçti");
  await b.close(); srv.close();
  process.exit(fails ? 1 : 0);
})();
