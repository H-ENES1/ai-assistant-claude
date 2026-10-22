const { chromium } = require("/home/claude/repo/node_modules/playwright");
const LANGS = ["tr","en","de","fr","es","it","pt","ru","ja","zh"];
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  const errs = []; let fails = 0;
  const ok = (n, c, i = "") => { console.log(`${c ? "✓" : "✗"} ${n}${i ? " — " + i : ""}`); if (!c) fails++; };
  const en = {};
  for (const [w, label] of [[1280, "masaüstü"], [390, "telefon"]]) {
    for (const lang of LANGS) {
      const ctx = await b.newContext({ viewport: { width: w, height: 860 }, locale: "en-US", isMobile: w < 500, hasTouch: w < 500 });
      await ctx.addInitScript((l) => { try { localStorage.setItem("tf-lang", l); } catch (_) {} }, lang);
      const p = await ctx.newPage();
      p.on("pageerror", (e) => errs.push(`${lang}/${label}: ${e}`));
      p.on("console", (m) => m.type() === "error" && !/fonts|favicon|net::ERR/.test(m.text()) && errs.push(`${lang}/${label}: ${m.text()}`));
      await p.goto("file:///home/claude/site/standalone.html"); await p.waitForTimeout(1500);
      const r = await p.evaluate(() => {
        const t = [...document.querySelectorAll("[data-i]")];
        return { lang: document.documentElement.lang, sel: document.getElementById("langSel").value, n: t.length,
          h1: document.querySelector("h1").textContent.trim(), over: document.documentElement.scrollWidth > innerWidth,
          sw: document.documentElement.scrollWidth, banner: document.getElementById("banner").innerText.slice(0, 80),
          fq: document.querySelectorAll(".faq details").length,
          a1: (document.querySelector(".faq details p, .faq details div") || {}).textContent || "" };
      });
      ok(`[${lang}/${label}] lang+select`, r.lang.startsWith(lang) && r.sel === lang);
      ok(`[${lang}/${label}] yatay taşma yok`, !r.over, String(r.sw));
      if (label === "masaüstü") {
        en[lang] = r.h1;
        // demo: farklı dillerde mesaj
        const msg = { tr: "Merhaba, bu cümleyi İngilizceye çevirir misin?", en: "Hello, can you translate this sentence into French?", de: "Hallo, könntest du diesen Satz bitte ins Englische übersetzen und danach erklären?", fr: "Bonjour, pourrais-tu traduire cette phrase en anglais, puis expliquer la grammaire ?", es: "Hola, ¿puedes traducir esta frase al inglés y explicarme la gramática?", it: "Ciao, puoi tradurre questa frase in inglese e spiegarmi la grammatica?", pt: "Olá, você pode traduzir esta frase para o inglês e explicar a gramática?", ru: "Привет, можешь перевести это предложение на английский и объяснить грамматику?", ja: "こんにちは、この文を英語に翻訳して、文法も説明してくれますか？", zh: "你好，你能把这句话翻译成英文并解释一下语法吗？" }[lang];
        await p.fill("#prompt", msg); await p.waitForTimeout(500);
        const d = await p.evaluate(() => ({ fType: document.getElementById("fType").textContent, banner: document.getElementById("banner").innerText, tok: document.getElementById("fTok") && document.getElementById("fTok").textContent }));
        const lim = !["tr","en"].includes(lang);
        ok(`[${lang}] demo çalışıyor (token var)`, /\d/.test(d.tok || ""), d.tok);
        if (lim) ok(`[${lang}] analiz dışı: öneri bandı yok / not var`, !/Haiku|Sonnet|Opus/.test(d.banner), d.banner.replace(/\n/g, " | ").slice(0, 100));
        // FAQ a1-a5 gerçek cevap (altı metinleri değil)
        const faqs = await p.evaluate(() => [...document.querySelectorAll(".faq details")].slice(0, 5).map((d) => d.textContent.length));
        ok(`[${lang}] SSS cevapları dolu`, faqs.length === 5 && faqs.every((n) => n > 12), faqs.join(","));
        // eksik anahtar: ham anahtar görünmesin
        const raw = await p.evaluate(() => /\b(d|ui|x|s)\.[a-z]\w+\b/.test(document.body.innerText));
        ok(`[${lang}] ham anahtar görünmüyor`, !raw);
        // ilk 5 görsel alt'ı
        const alts = await p.evaluate(() => [...document.querySelectorAll("img[data-img]")].map((i) => i.alt));
        ok(`[${lang}] görsel alt metinleri farklı ve dolu`, new Set(alts).size === 5 && alts.every((a) => a.length > 15));
      }
      await ctx.close();
    }
  }
  ok("h1'ler dillere göre farklı", new Set(Object.values(en)).size === 10, JSON.stringify(en));
  // select değişimi + kalıcılık
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: "tr-TR" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push("sel: " + e));
  await p.goto("file:///home/claude/site/standalone.html"); await p.waitForTimeout(1200);
  ok("tarayıcı tr → site tr", (await p.evaluate(() => document.documentElement.lang)) === "tr");
  await p.selectOption("#langSel", "ru"); await p.waitForTimeout(500);
  ok("select ru", (await p.evaluate(() => document.documentElement.lang)) === "ru" && /Узнайте/.test(await p.evaluate(() => document.querySelector("h1").textContent)));
  await p.reload(); await p.waitForTimeout(1200);
  ok("kalıcı: reload sonrası ru", (await p.evaluate(() => document.documentElement.lang)) === "ru");
  // video: de için İngilizce video
  const vsrc = await p.evaluate(() => document.getElementById("vid").getAttribute("src").slice(0, 25) + "|" + document.getElementById("vidBox").querySelector("figcaption").textContent.slice(-40));
  ok("ru: video/figcaption", /data:video|video\//.test(vsrc), vsrc);
  await p.screenshot({ path: "/home/claude/site/_work/s-ru.png" });
  await ctx.close();
  console.log(errs.length ? "HATA:\n" + errs.join("\n") : "konsol hatası yok");
  console.log(fails ? fails + " başarısız" : "hepsi geçti");
  await b.close();
})();
