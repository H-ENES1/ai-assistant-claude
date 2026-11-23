// Çok dilli site testi: her dil sayfası, masaüstü ve telefon. Önce `python site/build/build.py`.
//   node site/build/multilang-test.cjs
const { chromium } = require("playwright");
const { serve } = require("./serve.cjs");
const LANGS = ["tr", "en", "de", "fr", "es", "it", "pt", "ru", "ja", "zh"];
const HTML_LANG = { pt: "pt-BR", zh: "zh-CN" };
const url = (l) => (l === "tr" ? "" : l + "/");
const MSG = { tr: "Merhaba, bu cümleyi İngilizceye çevirir misin?", en: "Hello, can you translate this sentence into French?", de: "Hallo, könntest du diesen Satz bitte ins Englische übersetzen und danach erklären?", fr: "Bonjour, pourrais-tu traduire cette phrase en anglais, puis expliquer la grammaire ?", es: "Hola, ¿puedes traducir esta frase al inglés y explicarme la gramática?", it: "Ciao, puoi tradurre questa frase in inglese e spiegarmi la grammatica?", pt: "Olá, você pode traduzir esta frase para o inglês e explicar a gramática?", ru: "Привет, можешь перевести это предложение на английский и объяснить грамматику?", ja: "こんにちは、この文を英語に翻訳して、文法も説明してくれますか？", zh: "你好，你能把这句话翻译成英文并解释一下语法吗？" };

(async () => {
  const srv = await serve();
  const b = await chromium.launch();
  const errs = []; let fails = 0;
  const ok = (n, c, i = "") => { console.log(`${c ? "✓" : "✗"} ${n}${i ? " — " + i : ""}`); if (!c) fails++; };
  const h1s = {}, titles = {};
  for (const [w, label] of [[1280, "masaüstü"], [390, "telefon"]]) {
    for (const lang of LANGS) {
      // tarayıcı dili bilerek farklı: sayfa dili URL'den gelmeli
      const ctx = await b.newContext({ viewport: { width: w, height: 860 }, locale: lang === "en" ? "tr-TR" : "en-US", isMobile: w < 500, hasTouch: w < 500 });
      const p = await ctx.newPage();
      p.on("pageerror", (e) => errs.push(`${lang}/${label}: ${e}`));
      p.on("console", (m) => m.type() === "error" && !/fonts|favicon|net::ERR/.test(m.text()) && errs.push(`${lang}/${label}: ${m.text()}`));
      await p.goto(srv.base + url(lang)); await p.waitForTimeout(1300);
      const r = await p.evaluate(() => ({ lang: document.documentElement.lang, sel: document.getElementById("langSel").value, h1: document.querySelector("h1").textContent.trim(), title: document.title,
        over: document.documentElement.scrollWidth > innerWidth, sw: document.documentElement.scrollWidth, hint: !document.getElementById("langHint").hidden }));
      ok(`[${lang}/${label}] dil URL'den (tarayıcı dili farklı) + seçici`, r.lang === (HTML_LANG[lang] || lang) && r.sel === lang, r.lang);
      ok(`[${lang}/${label}] yatay taşma yok (öneri şeridi açıkken)`, !r.over && r.hint, String(r.sw));
      if (label === "masaüstü") {
        h1s[lang] = r.h1; titles[lang] = r.title;
        await p.fill("#prompt", MSG[lang]); await p.waitForTimeout(500);
        const d = await p.evaluate(() => ({ banner: document.getElementById("banner").innerText, tok: document.getElementById("fTok").textContent }));
        ok(`[${lang}] demo çalışıyor (token var)`, /\d/.test(d.tok), d.tok);
        if (!["tr", "en"].includes(lang)) ok(`[${lang}] analiz dışı: öneri yok`, !/Haiku|Sonnet|Opus/.test(d.banner), d.banner.replace(/\n/g, " | ").slice(0, 100));
        const faqs = await p.evaluate(() => [...document.querySelectorAll(".faq details")].map((x) => x.textContent.length));
        ok(`[${lang}] SSS 12 soru, cevaplar dolu`, faqs.length === 12 && faqs.every((n) => n > 12), faqs.join(","));
        ok(`[${lang}] ham anahtar görünmüyor`, !(await p.evaluate(() => /\b(d|ui|x|s)\.[a-z]\w+\b/.test(document.body.innerText))));
        const alts = await p.evaluate(() => [...document.querySelectorAll("img[data-img]")].map((i) => i.alt));
        ok(`[${lang}] görsel alt metinleri farklı ve dolu`, new Set(alts).size === 5 && alts.every((a) => a.length > 15));
        const bt = await p.evaluate(() => document.getElementById("botToggle").textContent);
        ok(`[${lang}] Tiko düğmesi dile göre`, bt.length > 3, bt);
      }
      await ctx.close();
    }
  }
  ok("h1'ler dillere göre farklı", new Set(Object.values(h1s)).size === 10, JSON.stringify(h1s));
  ok("başlıklar dillere göre farklı", new Set(Object.values(titles)).size === 10);
  // seçici + kalıcılık: seçilen dil hatırlanır, başka dil sayfasında o dil önerilir (yönlendirme yok)
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: "tr-TR" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push("sel: " + e));
  await p.goto(srv.base); await p.waitForTimeout(900);
  ok("tarayıcı tr → / türkçe, şerit yok", (await p.evaluate(() => document.documentElement.lang)) === "tr" && (await p.evaluate(() => document.getElementById("langHint").hidden)));
  await Promise.all([p.waitForURL(srv.base + "ru/"), p.selectOption("#langSel", "ru")]);
  ok("seçici ru → /ru/", (await p.evaluate(() => document.documentElement.lang)) === "ru" && /Узнайте/.test(await p.textContent("h1")));
  await p.goto(srv.base); await p.waitForTimeout(900);
  const h = await p.evaluate(() => ({ lang: document.documentElement.lang, hint: !document.getElementById("langHint").hidden, txt: document.getElementById("langHint").innerText }));
  ok("seçim hatırlanır: / Türkçe kalır, üstte Rusça öneri", h.lang === "tr" && h.hint && /русском/.test(h.txt), h.txt.replace(/\n/g, " "));
  await p.goto(srv.base + "ru/"); await p.waitForTimeout(900);
  const vsrc = await p.evaluate(() => document.getElementById("vid").getAttribute("src") + "|" + document.getElementById("vidBox").querySelector("figcaption").textContent.slice(-40));
  ok("ru: İngilizce video ve notu", /video\/tanitim-en\.mp4/.test(vsrc), vsrc);
  await ctx.close();
  console.log(errs.length ? "HATA:\n" + errs.join("\n") : "konsol hatası yok");
  if (errs.length) fails++;
  console.log(fails ? fails + " başarısız" : "hepsi geçti");
  await b.close(); srv.close();
  process.exit(fails ? 1 : 0);
})();
