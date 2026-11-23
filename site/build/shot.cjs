// Gözle kontrol için ekran görüntüleri (Pages sürümü, docs/). Önce `python site/build/build.py`.
//   node site/build/shot.cjs [çıktı klasörü]   (varsayılan: işletim sisteminin geçici klasörü)
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");
const { serve } = require("./serve.cjs");
const OUT = process.argv[2] || os.tmpdir();
(async () => {
  const srv = await serve();
  const b = await chromium.launch();
  const errs = [];
  for (const [name, url, vp, scheme, loc] of [["desk-light", "", { width: 1280, height: 900 }, "light", "tr-TR"], ["desk-dark", "en/", { width: 1280, height: 900 }, "dark", "en-US"], ["phone", "", { width: 390, height: 844 }, "light", "tr-TR"]]) {
    const ctx = await b.newContext({ viewport: vp, colorScheme: scheme, locale: loc });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errs.push(name + ": " + e)); p.on("console", (m) => m.type() === "error" && errs.push(name + ": " + m.text()));
    await p.goto(srv.base + url);
    await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(OUT, `s-${name}.png`), fullPage: name !== "desk-light" });
    if (name === "desk-light") {
      await p.click("#preset-2"); await p.waitForTimeout(300);
      await p.click("#whyBtn"); await p.waitForTimeout(200);
      await p.screenshot({ path: path.join(OUT, "s-desk-light-why.png") });
    }
    if (await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) errs.push(name + ": yatay taşma");
    await ctx.close();
  }
  console.log(errs.length ? errs.join("\n") : "hata yok", "→", OUT);
  await b.close(); srv.close();
})();
