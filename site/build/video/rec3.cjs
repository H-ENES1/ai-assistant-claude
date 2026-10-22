// Kullanım: node rec2.cjs preview|render tr|en [v]
const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const [mode = "preview", lang = "tr", vert = ""] = process.argv.slice(2);
  const V = vert === "v";
  const src = fs.readFileSync("anim3.html", "utf8").replace("/*LEARN*/", fs.readFileSync("../site/learn.json", "utf8").trim());
  fs.writeFileSync("anim3.built.html", src);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: V ? 1920 : 1080 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(`file:///home/claude/video/anim3.built.html?lang=${lang}${V ? "&v=1" : ""}`);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  const tag = `${lang}${V ? "-v" : ""}`;
  if (mode === "preview") {
    fs.mkdirSync("prev2", { recursive: true });
    for (const t of [3.6, 6.6, 11.6, 17.4, 23.4, 27.8, 32.5, 36.6, 41.2, 46.5]) {
      await p.evaluate((t) => window.render(t), t);
      await p.screenshot({ path: `prev2/${tag}-${String(t).replace(".", "_")}.png` });
    }
  } else {
    const dir = `frames-${tag}`;
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
    const FPS = 30, N = Math.round((await p.evaluate(() => window.DUR)) * FPS);
    for (let i = 0; i < N; i++) {
      await p.evaluate((t) => window.render(t), i / FPS);
      await p.screenshot({ path: `${dir}/f${String(i).padStart(4, "0")}.jpg`, type: "jpeg", quality: 92 });
    }
  }
  console.log(errs.length ? errs.join("\n") : "ok", await p.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family + f.weight).join(",")));
  await b.close();
})();
