const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  const errs = [];
  for (const [name, vp, scheme, lang] of [["desk-light", { width: 1280, height: 900 }, "light", "tr"], ["desk-dark", { width: 1280, height: 900 }, "dark", "en"], ["phone", { width: 390, height: 844 }, "light", "tr"]]) {
    const ctx = await b.newContext({ viewport: vp, colorScheme: scheme, locale: lang === "tr" ? "tr-TR" : "en-US" });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errs.push(name + ": " + e)); p.on("console", (m) => m.type() === "error" && errs.push(name + ": " + m.text()));
    await p.goto("file:///home/claude/site/standalone.html");
    await p.waitForTimeout(600);
    await p.screenshot({ path: `/home/claude/site/s-${name}.png`, fullPage: name !== "desk-light" });
    if (name === "desk-light") {
      await p.click("#whyBtn"); await p.click("#preset-2"); await p.waitForTimeout(300);
      await p.click("#whyBtn"); await p.waitForTimeout(200);
      await p.screenshot({ path: `/home/claude/site/s-desk-light-why.png` });
      await p.screenshot({ path: `/home/claude/site/s-full.png`, fullPage: true });
    }
    const ov = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (ov) errs.push(name + ": yatay taşma");
    await ctx.close();
  }
  console.log(errs.length ? errs.join("\n") : "hata yok");
  await b.close();
})();
