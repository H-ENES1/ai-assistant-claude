const { chromium } = require("/home/claude/repo/node_modules/playwright");
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  const errs = []; let fails = 0;
  const ok = (n, c, i = "") => { console.log(`${c ? "✓" : "✗"} ${n}${i ? " — " + i : ""}`); if (!c) fails++; };
  for (const [lang, loc] of [["tr", "tr-TR"], ["en", "en-US"]]) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: loc, colorScheme: "light" });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errs.push(lang + ": " + e)); p.on("console", (m) => m.type() === "error" && !/fonts|favicon|net::ERR/.test(m.text()) && errs.push(lang + ": " + m.text()));
    p.on("requestfailed", (r) => /img\//.test(r.url()) && errs.push("görsel yüklenmedi " + r.url()));
    await p.goto("file:///home/claude/site/standalone.html");
    await p.waitForTimeout(2600);
    ok(`[${lang}] dil`, (await p.evaluate(() => document.documentElement.lang)) === lang);
    const srcs = await p.evaluate(() => [...document.querySelectorAll("img[data-img]")].map((i) => i.getAttribute("src")));
    const want = await p.evaluate((l) => ["oneri","effort","tuzak","popup","rapor"].map((n) => TF_ASSETS && TF_ASSETS[`img/${l}/${n}.png`]), lang);
    ok(`[${lang}] görseller gömülü ve dile göre`, srcs.length === 5 && srcs.every((s, i) => s.startsWith("data:image/webp") && s === want[i]), srcs.map((x) => x.slice(0, 30)).join(","));
    const vid = await p.evaluate(() => { const v = document.getElementById("vid"); return { src: v.getAttribute("src"), poster: v.getAttribute("poster") }; });
    const fileB64 = require("fs").readFileSync(`/home/claude/site/video/tanitim-${lang}.mp4`).toString("base64");
    ok(`[${lang}] video gömülü, dosyayla aynı, kapak var`, vid.src === "data:video/mp4;base64," + fileB64 && /^data:image\/jpeg/.test(vid.poster), (vid.src || "").slice(0, 30));
    const lb = await p.evaluate(async () => { const a = document.querySelector("a.zoom"); a.click(); await new Promise((r) => setTimeout(r, 300)); const b = document.getElementById("lbox"); const r = !b.hidden && b.querySelector("img").naturalWidth > 100; b.click(); return r && b.hidden; });
    ok(`[${lang}] görsele tıklayınca büyütme açılıp kapanıyor`, lb);
    // görseller yüklendi mi (lazy): kaydırarak
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); });
    await p.waitForTimeout(800);
    const loaded = await p.evaluate(() => [...document.querySelectorAll("img[data-img]")].map((i) => i.complete && i.naturalWidth > 100));
    ok(`[${lang}] 5 görsel de yüklendi`, loaded.every(Boolean), loaded.join(","));
    // demo
    await p.fill("#prompt", lang === "tr" ? "Çeviri sistemi olan bir web sitesi yaptıracağım, bu zor bir iş" : "I need a website built with a translation system, it is a hard job");
    await p.waitForTimeout(400);
    const dem = await p.evaluate(() => ({ fType: document.getElementById("fType").textContent, fDom: document.getElementById("fDom").textContent, banner: document.getElementById("banner").innerText }));
    ok(`[${lang}] demo: iş türü kod yazma, Haiku önerilmiyor`, !/Haiku/.test(dem.banner.split("\n")[0]) && /(code|kod)/i.test(dem.fType), dem.fType + " | " + dem.banner.split("\n")[0]);
    ok(`[${lang}] demo: konu satırı dolu`, dem.fDom && dem.fDom !== "–", dem.fDom);
    await p.click("#whyBtn"); await p.waitForTimeout(200);
    const bt = await p.evaluate(() => document.getElementById("banner").innerText);
    ok(`[${lang}] demo: Neden? içinde konu ve effort`, new RegExp(lang === "tr" ? "Konu|Alan" : "Topic").test(bt) && new RegExp("Effort").test(bt), bt.replace(/\n/g, " | ").slice(0, 160));
    await p.selectOption("#effort", "xhigh"); await p.waitForTimeout(300);
    ok(`[${lang}] demo: Çok yüksek effort seçilebilir`, (await p.inputValue("#effort")) === "xhigh");
    // alan ve effort bölümü, kanıt
    const cards = await p.locator("#domGrid .dcard").count(), rows = await p.locator("#effTable .effrow").count(), pbar = await p.locator("#proofChart circle").count(), stats = await p.locator("#proofStats .stat").count();
    ok(`[${lang}] alan kartları 16, effort satırı 5(+başlık), kanıt grafiği ve 3 kutu`, cards === 16 && rows === 6 && pbar === 18 && stats === 3, `${cards}/${rows}/${pbar}/${stats}`);
    // bot
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
    const vis = await p.evaluate(() => { const b = document.getElementById("tfbot"); const r = b.getBoundingClientRect(); return { hidden: b.hidden, w: r.width, h: r.height, x: r.x, y: r.y }; });
    ok(`[${lang}] bot görünür`, !vis.hidden && vis.w >= 40, JSON.stringify(vis));
    // Özellikler bölümüne in, bir kartın üstüne mouse
    await p.evaluate(() => document.getElementById("ozellikler").scrollIntoView()); await p.waitForTimeout(500);
    const card = p.locator(".feat").nth(4); await card.scrollIntoViewIfNeeded(); await p.waitForTimeout(300); const cb = await card.boundingBox();
    await p.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2, { steps: 5 }); await p.waitForTimeout(1500);
    const pos = await p.evaluate(() => { const b = document.getElementById("tfbot").getBoundingClientRect(); return { x: b.x, y: b.y, bottom: b.bottom }; });
    ok(`[${lang}] bot mouse'un olduğu kartın üstüne kondu`, Math.abs(pos.bottom - cb.y) < 14 && pos.x > cb.x - 60 && pos.x < cb.x + cb.width, `bot alt ${pos.bottom.toFixed(0)} · kart üst ${cb.y.toFixed(0)}`);
    // mouse sabitken kaydır: bot yeni bloğun üstüne iner
    await p.mouse.wheel(0, 900); await p.waitForTimeout(1800);
    const under = await p.evaluate(() => { const bt = document.getElementById("tfbot"); const m = window.__tiko; return bt.getBoundingClientRect().bottom; });
    const hover = await p.evaluate(({ x, y }) => { const el = document.elementsFromPoint(x, y).find((e) => e.id !== "tfbot"); const blk = el.closest(".feat,.stat,.shot,.fact,.model,.dcard,.effrow,.note,.tablebox,.chart,.proofchart,.honest,.loop,.faq details,.road > div,.demo,.sec-head,.formula,.terms > div,.layers li") || el.closest(".wrap > *") || el.closest("section") || el; const r = blk.getBoundingClientRect(); return { top: r.top, cls: blk.className }; }, { x: cb.x + cb.width / 2, y: cb.y + cb.height / 2 });
    ok(`[${lang}] kaydırınca bot seninle indi (yeni bloğun üstü)`, Math.abs(under - Math.max(hover.top + 3, 0)) < 110, `bot alt ${under.toFixed(0)} · blok üst ${hover.top.toFixed(0)} (${hover.cls})`);
    // tıkla → konuşur
    const bb = await p.evaluate(() => { const r = document.getElementById("tfbot").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await p.mouse.click(bb.x, bb.y); await p.waitForTimeout(300);
    const said = await p.evaluate(() => ({ say: document.getElementById("tfbot").classList.contains("say"), txt: document.querySelector("#tfbot .bub").textContent }));
    ok(`[${lang}] bota tıklayınca konuşuyor`, said.say && said.txt.length > 10, said.txt);
    // dil değişince bot metni
    await p.selectOption("#langSel", lang === "tr" ? "en" : "tr");
    await p.waitForTimeout(400);
    // gizle/göster
    await p.evaluate(() => document.getElementById("botToggle").scrollIntoView()); await p.waitForTimeout(300);
    const t0 = await p.evaluate(() => document.getElementById("botToggle").textContent);
    await p.click("#botToggle"); await p.waitForTimeout(200);
    ok(`[${lang}] bot gizlendi`, await p.evaluate(() => document.getElementById("tfbot").hidden), t0);
    await p.click("#botToggle"); await p.waitForTimeout(1500);
    ok(`[${lang}] bot geri geldi`, !(await p.evaluate(() => document.getElementById("tfbot").hidden)));
    // yatay taşma
    ok(`[${lang}] yatay taşma yok`, !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
    await ctx.close();
  }
  // telefon
  const pc = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "tr-TR", hasTouch: true, isMobile: true });
  const mp = await pc.newPage(); mp.on("pageerror", (e) => errs.push("tel: " + e));
  await mp.goto("file:///home/claude/site/standalone.html"); await mp.waitForTimeout(2200);
  ok("[tel] yatay taşma yok", !(await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth)), String(await mp.evaluate(() => document.documentElement.scrollWidth)));
  await mp.evaluate(() => document.getElementById("kanit").scrollIntoView()); await mp.waitForTimeout(900);
  await mp.screenshot({ path: "/home/claude/site/s-phone-kanit.png" });
  await pc.close();
  console.log(errs.length ? "HATA:\n" + errs.join("\n") : "konsol hatası yok");
  console.log(fails ? fails + " başarısız" : "hepsi geçti");
  await b.close();
})();
