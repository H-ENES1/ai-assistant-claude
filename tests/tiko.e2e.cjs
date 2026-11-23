// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Tiko uçtan uca testi: eklentiyi Chromium'a yükler, claude.ai'yi taklit eden sahte bir sayfada Tiko'nun
// davranışını ve kurallarını denetler, durumların ekran görüntüsünü tests/shots/tiko/ altına yazar.
// Çalıştır: node tiko.e2e.cjs   (npm run e2e içinde de çalışır)
// Uyku 2 dakika hareketsizlik ister; varsayılan koşuda beklenmez. Gerçek bekleyişle denemek için: TIKO_SLEEP=1
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS ||= "1";
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const EXT = path.resolve(__dirname, "../extension");
const OUT = path.resolve(__dirname, "shots/tiko");
fs.mkdirSync(OUT, { recursive: true });
const CONV = "0b1c2d3e-0000-4000-8000-123456789abc";
const now = Date.now();
const state = { usage5h: 19, usage7d: 17 };
const SLEEP = process.env.TIKO_SLEEP === "1";

// Sahte claude.ai: sağa yaslı kullanıcı balonu, düz cevap metni, altta sabit mesaj kutusu.
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Claude</title>
<style>body{font:15px/1.6 ui-serif,Georgia,serif;margin:0;background:#faf9f5;color:#141413}
header{position:fixed;top:0;left:0;right:0;height:44px;background:#faf9f5;border-bottom:1px solid #e8e6dc;font:14px system-ui;padding:12px 16px;box-sizing:border-box;z-index:2}
main{max-width:720px;margin:0 auto;padding:70px 20px 260px}
[data-testid="user-message"]{margin:18px 0 18px auto;max-width:70%;width:fit-content;background:#f0eee6;border-radius:14px;padding:8px 14px;font-family:system-ui}
.font-claude-response{margin:18px 0}
fieldset{position:fixed;left:50%;transform:translateX(-50%);bottom:20px;width:720px;box-sizing:border-box;border:1px solid #d9d6cc;border-radius:18px;background:#fff;padding:14px 14px 10px;margin:0;box-shadow:0 2px 14px rgba(0,0,0,.05)}
.ProseMirror{min-height:48px;max-height:200px;overflow:auto;outline:none;font:15px/1.5 system-ui} .ProseMirror p{margin:0}
.bar{display:flex;gap:8px;margin-top:8px;align-items:center} .bar button{font:13px system-ui;border:1px solid #e0ddd3;background:#fff;border-radius:8px;padding:5px 10px}
#send{margin-left:auto;background:#d97757;color:#fff;border-color:#d97757}</style></head><body>
<header>Claude</header>
<main>
 <div data-testid="user-message">Merhaba, kuantum tünellemeyi anlatır mısın?</div>
 <div class="font-claude-response">Tabii! Kuantum tünelleme, bir parçacığın klasik olarak aşamayacağı bir enerji engelini geçebilmesidir. Dalga fonksiyonu engelin içinde üstel olarak söner ama sıfıra inmez; bu yüzden parçacığın öte yanda bulunma olasılığı vardır.</div>
</main>
<fieldset>
 <div class="ProseMirror" contenteditable="true" role="textbox"><p><br></p></div>
 <div class="bar"><button type="button">+</button><button type="button">Opus 5.5</button><button type="button">Orta</button><button type="button" id="send">Gönder</button></div>
</fieldset>
<script>
// Gönder: mesaj sayfaya eklenir, yarım saniye sonra cevap yazılmaya başlar (data-is-streaming="true").
document.getElementById('send').onclick = () => {
  const ed = document.querySelector('.ProseMirror'), m = document.querySelector('main');
  const u = document.createElement('div'); u.setAttribute('data-testid', 'user-message'); u.textContent = ed.innerText.trim(); m.append(u);
  ed.innerHTML = '<p><br></p>';
  setTimeout(() => window.__startReply(), 500);
};
window.__startReply = () => {
  const m = document.querySelector('main');
  const a = document.createElement('div'); a.className = 'font-claude-response'; a.setAttribute('data-is-streaming', 'true'); a.textContent = 'Elbette. ';
  m.append(a); window.__reply = a;
  window.__grow = setInterval(() => { a.textContent += 'Fotosentez, bitkilerin ışık enerjisini kimyasal enerjiye çevirmesidir. '; }, 400);
};
window.__finishReply = () => { clearInterval(window.__grow); window.__reply.setAttribute('data-is-streaming', 'false'); };
</script></body></html>`;

const results = [];
const check = (name, ok, info = "") => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? "✓" : "✗"} ${name}${info ? " — " + info : ""}`); };
const hitsBox = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

(async () => {
  const userDataDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "tf-tiko-"));
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium", headless: true, locale: "tr-TR", viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, "--lang=tr-TR"]
  });
  const errors = [], netLog = [];
  ctx.on("request", (r) => netLog.push({ m: r.method(), u: r.url() }));
  await ctx.route("https://claude.ai/**", async (route) => {
    const req = route.request(); const u = new URL(req.url());
    const json = (o) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(o) });
    if (u.pathname === "/api/organizations") return json([{ uuid: "org1", capabilities: ["chat", "claude_pro"], rate_limit_tier: "default_claude_ai" }]);
    if (u.pathname === "/api/organizations/org1/usage") return json({ five_hour: { utilization: state.usage5h, resets_at: new Date(now + 3 * 3600e3).toISOString() }, seven_day: { utilization: state.usage7d, resets_at: new Date(now + 3 * 86400e3).toISOString() } });
    if (u.pathname.endsWith(`/chat_conversations/${CONV}`)) return json({
      uuid: CONV, model: "claude-opus-5-5", current_leaf_message_uuid: "m1",
      chat_messages: [
        { uuid: "h1", parent_message_uuid: "00000000-0000-4000-8000-000000000000", sender: "human", content: [{ type: "text", text: "Merhaba, kuantum tünellemeyi anlatır mısın?" }], created_at: new Date(now - 10 * 60000).toISOString() },
        { uuid: "m1", parent_message_uuid: "h1", sender: "assistant", content: [{ type: "text", text: "Tabii! Kuantum tünelleme, bir parçacığın klasik olarak aşamayacağı bir enerji engelini geçebilmesidir. " }], created_at: new Date(now - 9 * 60000).toISOString() }
      ]
    });
    if (u.pathname.startsWith("/api/")) return json({});
    return route.fulfill({ status: 200, contentType: "text/html", body: PAGE });
  });

  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent("serviceworker", { timeout: 15000 });
  const extId = sw.url().split("/")[2];
  const storage = (keys) => sw.evaluate((k) => chrome.storage.local.get(k), keys);
  const setSetting = (patch) => sw.evaluate((p) => chrome.storage.local.get("settings").then(({ settings }) => chrome.storage.local.set({ settings: { ...settings, ...p } })), patch);
  const welcome = ctx.pages().find((p) => p.url().includes("/popup/welcome.html")) || await ctx.waitForEvent("page", { predicate: (p) => p.url().includes("/popup/welcome.html"), timeout: 8000 }).catch(() => null);

  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`https://claude.ai/chat/${CONV}`);
  await page.waitForTimeout(1200);
  check("onay yokken Tiko yok", !(await page.$("[data-token-forecast-tiko]")));
  if (welcome) { await welcome.waitForSelector("#accept:not(:empty)"); await welcome.click("#accept"); await welcome.close().catch(() => {}); }
  else await sw.evaluate(() => chrome.storage.local.set({ consent: { v: 2, at: Date.now() } }));
  await page.bringToFront();

  // Tiko'nun durumu: kutusu, sınıfları, baloncuğu
  const tk = () => page.evaluate(() => {
    const h = document.querySelector("[data-token-forecast-tiko]");
    if (!h) return null;
    const root = h.shadowRoot, mv = root.querySelector(".mv"), r = mv.getBoundingClientRect();
    return { ...Object.assign({}, h.dataset), left: r.left, top: r.top, right: r.right, bottom: r.bottom, cx: r.left + r.width / 2, w: r.width, h: r.height,
      gone: mv.classList.contains("gone"), cls: root.querySelector(".tk").className, say: mv.classList.contains("say"), bub: root.querySelector(".bub").textContent,
      anims: root.getAnimations().filter((a) => a.playState === "running").length, frames: Number(h.dataset.frames || 0) };
  });
  const waitTk = (fn, arg, timeout = 6000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
  const settled = () => waitTk(() => { const h = document.querySelector("[data-token-forecast-tiko]"); return h && h.dataset.raf === "0" && h.dataset.hidden === "0"; });
  const poseIs = (p, timeout) => waitTk((x) => document.querySelector("[data-token-forecast-tiko]")?.dataset.pose === x, p, timeout);
  const faceIs = (f, timeout) => waitTk((x) => document.querySelector("[data-token-forecast-tiko]")?.dataset.face === x, f, timeout);
  const stateIs = (s, timeout) => waitTk((x) => document.querySelector("[data-token-forecast-tiko]")?.dataset.state === x, s, timeout);
  const caret = () => page.evaluate(() => { const r = getSelection().getRangeAt(0).getBoundingClientRect(); return { x: r.right, left: r.left, right: r.right + 1, top: r.top, bottom: r.bottom }; });
  const shot = async (name, pad = { l: 150, r: 190, t: 120, b: 80 }) => {
    const b = await tk();
    const x = Math.max(0, Math.min(1280 - (pad.l + pad.r), b.left - pad.l)), y = Math.max(0, Math.min(860 - (pad.t + pad.b), b.top - pad.t));
    await page.screenshot({ path: path.join(OUT, name), clip: { x, y, width: pad.l + pad.r, height: pad.t + pad.b } });
  };
  const ed = page.locator(".ProseMirror");
  const clearEd = async () => { await ed.click(); await page.keyboard.press("Control+A"); await page.keyboard.press("Backspace"); };

  // 1) İlk görünüş: mesaj kutusunun üstünde, bir kez "beni buradan kapatabilirsin" baloncuğu
  const appeared = await waitTk(() => document.querySelector("[data-token-forecast-tiko]")?.dataset.hidden === "0", null, 15000);
  await settled();
  let b = await tk();
  const fs0 = await page.evaluate(() => { const r = document.querySelector("fieldset").getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; });
  check("onaydan sonra Tiko mesaj kutusunun üstünde görünür", appeared && b && b.state === "idle" && b.left >= fs0.left && b.right <= fs0.right && b.bottom <= fs0.top + 20 && b.bottom > fs0.top - 80, JSON.stringify(b && { state: b.state, left: b.left, bottom: b.bottom, fsTop: fs0.top }));
  check("boyut yaklaşık 28 px", b && b.w === 28 && b.h === 34, b && `${b.w}×${b.h}`);
  await page.waitForFunction(() => document.querySelector("[data-token-forecast-tiko]").shadowRoot.querySelector(".mv").classList.contains("say"), null, { timeout: 4000 }).catch(() => {});
  b = await tk();
  check("ilk görünüşte bir kez 'kapatabilirsin' baloncuğu", b.say && /Tiko/.test(b.bub) && /Ayarlar/.test(b.bub) && (await storage("tikoHintSeen")).tikoHintSeen === true, b.bub);
  await page.waitForTimeout(250);
  await shot("8-ilk-baloncuk.png", { l: 150, r: 210, t: 130, b: 90 });
  // Baloncuk ve çevresi tıklamayı geçirir; yalnızca gövde tıklanabilir
  const through = await page.evaluate(() => {
    const h = document.querySelector("[data-token-forecast-tiko]"), root = h.shadowRoot;
    const at = (r, fx = 0.5, fy = 0.5) => document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
    const bub = root.querySelector(".bub").getBoundingClientRect(), mv = root.querySelector(".mv").getBoundingClientRect();
    return { bubble: at(bub) !== h, body: at(mv, 0.5, 0.6) === h, corner: document.elementFromPoint(mv.left + 0.5, mv.top + 0.5) !== h, hostPe: getComputedStyle(root.querySelector(".mv")).pointerEvents };
  });
  check("pointer-events: baloncuk ve boşluk tıklamayı geçirir, yalnız gövde tıklanabilir", through.bubble && through.body && through.corner && through.hostPe === "none", JSON.stringify(through));

  const hintGone = await waitTk(() => !document.querySelector("[data-token-forecast-tiko]").shadowRoot.querySelector(".mv").classList.contains("say"), null, 11000);
  check("baloncuk kendiliğinden kaybolur", hintGone);

  // 2) Yazarken: görünür, imleci takip eder, yazıyı ve imleci örtmez
  await ed.click();
  await page.keyboard.type("Fotosentez nedir", { delay: 25 });
  const typingSeen = await stateIs("typing", 1500);
  await settled();
  let c = await caret(); b = await tk();
  const x1 = b.cx;
  check("yazarken görünür ve imlecin üstünde", typingSeen && !b.gone && Math.abs(b.cx - c.x) < 8 && b.bottom <= c.top && c.top - b.bottom < 40, `Tiko x=${b.cx.toFixed(1)} imleç x=${c.x.toFixed(1)} · aradaki boşluk ${(c.top - b.bottom).toFixed(1)} px`);
  await shot("1-yazarken.png");
  await page.keyboard.type(", bitkiler ışığı nasıl kullanır ve bu süreç neden önemlidir", { delay: 12 });
  const moving = await waitTk(() => document.querySelector("[data-token-forecast-tiko]").dataset.raf === "1", null, 1500);
  const mid = await tk(); const cMid = await caret();
  await settled();
  c = await caret(); b = await tk();
  check("yazı ilerledikçe imleci takip eder (yay gibi gecikmeyle)", b.cx - x1 > 150 && Math.abs(b.cx - c.x) < 8 && moving && mid.cx < cMid.x + 1, `x: ${x1.toFixed(0)} → ${b.cx.toFixed(0)}, imleç ${c.x.toFixed(0)}; yoldayken ${mid.cx.toFixed(0)} (imleç ${cMid.x.toFixed(0)})`);
  const cover = await page.evaluate(() => {
    const h = document.querySelector("[data-token-forecast-tiko]"), t = h.shadowRoot.querySelector(".mv").getBoundingClientRect();
    const hit = (r) => r.width >= 0 && t.left < r.right && t.right > r.left && t.top < r.bottom && t.bottom > r.top;
    const edEl = document.querySelector(".ProseMirror"), rg = document.createRange(); rg.selectNodeContents(edEl);
    const pf = document.querySelector("[data-token-forecast]").shadowRoot;
    return { text: [...rg.getClientRects()].some(hit), caret: hit(getSelection().getRangeAt(0).getBoundingClientRect()),
      buttons: [...document.querySelectorAll("fieldset button")].some((x) => hit(x.getBoundingClientRect())),
      pill: hit(pf.querySelector(".pill").getBoundingClientRect()), banner: pf.querySelector(".banner").classList.contains("show") && hit(pf.querySelector(".banner").getBoundingClientRect()),
      messages: [...document.querySelectorAll("main > div")].some((x) => hit(x.getBoundingClientRect())) };
  });
  check("yazıyı, imleci, düğmeleri, hapı ve bildirimi örtmüyor", !cover.text && !cover.caret && !cover.buttons && !cover.pill && !cover.banner && !cover.messages, JSON.stringify(cover));
  // Çok satır: imleç aşağı inse de Tiko yazının üstüne inmez
  await page.keyboard.press("Shift+Enter"); await page.keyboard.type("ikinci satır", { delay: 10 });
  await settled();
  const cover2 = await page.evaluate(() => {
    const t = document.querySelector("[data-token-forecast-tiko]").shadowRoot.querySelector(".mv").getBoundingClientRect();
    const rg = document.createRange(); rg.selectNodeContents(document.querySelector(".ProseMirror"));
    return [...rg.getClientRects()].some((r) => t.left < r.right && t.right > r.left && t.top < r.bottom && t.bottom > r.top);
  });
  c = await caret(); b = await tk();
  check("çok satırlı yazıda da yazının üstüne inmez, imlecin hizasında kalır", !cover2 && Math.abs(b.cx - c.x) < 8, `Tiko alt=${b.bottom.toFixed(0)} imleç üst=${c.top.toFixed(0)}`);

  // 3) Kare yalnız hareket ederken: durduktan sonra kare sayısı artmaz; kare maliyeti 1 ms'nin altında
  const idleSeen = await stateIs("idle", 4000);
  await poseIs("stand", 4000); // önce bir tepki (onay) oynuyorsa bitsin
  await settled();
  const f0 = (await tk()).frames;
  await page.waitForTimeout(1500);
  b = await tk();
  check("yazma durunca boşta: göz kırpar, etrafa bakınır (CSS), rAF çalışmaz", idleSeen && b.pose === "stand" && b.frames === f0 && b.raf === "0" && b.anims > 0, `${b.state}/${b.pose} · 1,5 sn'de kare: ${b.frames - f0} · çalışan CSS animasyonu: ${b.anims}`);
  check("kare başına ortalama süre < 1 ms", Number(b.us) < 1000 && b.frames > 20, `${b.us} µs (ölçüm dahil ${b.frames} kare ortalaması)`);

  // 4) Hafif model önerisi → onay hareketi
  await clearEd();
  await page.waitForTimeout(700); // kutu boşken öneri kalkar; yeni öneri yeni bir onay demektir
  await page.keyboard.type("Bu cümleyi İngilizceye çevir: Yarın toplantıya katılamayacağım.", { delay: 8 });
  const nod = await poseIs("nod", 5000);
  await page.waitForTimeout(300);
  await shot("3-hafif-model-onay.png");
  b = await tk();
  const bannerTxt = await page.evaluate(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".banner .ttl")?.textContent || "");
  check("hafif model önerilince onaylar", nod && b.face === "happy" && /Haiku/.test(bannerTxt), `bildirim: ${bannerTxt}`);
  const cover3 = await page.evaluate(() => {
    const t = document.querySelector("[data-token-forecast-tiko]").shadowRoot.querySelector(".mv").getBoundingClientRect();
    const pf = document.querySelector("[data-token-forecast]").shadowRoot, hit = (r) => t.left < r.right && t.right > r.left && t.top < r.bottom && t.bottom > r.top;
    return { banner: hit(pf.querySelector(".banner").getBoundingClientRect()), pill: hit(pf.querySelector(".pill").getBoundingClientRect()), shown: pf.querySelector(".banner").classList.contains("show") };
  });
  check("bildirim açıkken bildirimin ve hapın üstüne binmez", cover3.shown && !cover3.banner && !cover3.pill, JSON.stringify(cover3));
  // Tıklama: küçük tepki + durum satırı (tahmin ve öneri); mesaj kutusundaki odak kaybolmaz
  await poseIs("stand", 4000);
  b = await tk();
  await page.mouse.click(b.cx, b.top + 22);
  const waved = await poseIs("wave", 1500);
  b = await tk();
  const focusKept = await page.evaluate(() => document.activeElement === document.querySelector(".ProseMirror"));
  check("tıklanınca el sallar ve tahmini söyler; odak mesaj kutusunda kalır", waved && b.say && /≈/.test(b.bub) && /Haiku/.test(b.bub) && focusKept, b.bub);
  await page.waitForTimeout(200);
  await shot("9-tiklama-durum.png", { l: 150, r: 220, t: 120, b: 80 });

  // 5) Ağır tahmin → zorlanan ifade (5 saatlik limitin büyük kısmını yiyecek uzun mesaj)
  await clearEd();
  await page.evaluate(() => {
    const p = document.querySelector(".ProseMirror p");
    p.textContent = "Aşağıdaki kod tabanının tamamını baştan sona incele, mimariyi yeniden tasarla ve her modül için ayrıntılı bir rapor yaz. ".repeat(900);
    const rg = document.createRange(); rg.selectNodeContents(p); rg.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(rg);
    p.dispatchEvent(new InputEvent("input", { bubbles: true }));
  });
  const strain = await faceIs("strain", 6000);
  const est = await page.evaluate(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".head").textContent);
  await page.waitForTimeout(300);
  await shot("2-agir-tahmin.png");
  b = await tk();
  check("tahmin yüksekse yazma durunca zorlanır", strain && b.state === "idle", `hap: ${est}`);
  await clearEd();
  await page.keyboard.type("Fotosentezi kısaca açıkla", { delay: 10 });
  check("mesaj hafifleyince ifade normale döner", await faceIs("neutral", 5000));

  // 6) Gönder → uçar; cevap yazılırken cevabın üst kenarına oturur
  await page.waitForTimeout(600);
  await page.click("#send");
  const flew = await poseIs("fly", 3000);
  await page.waitForTimeout(260);
  await shot("4-gonder.png", { l: 150, r: 190, t: 150, b: 60 });
  check("gönderince uçar", flew);
  const perched = await stateIs("perch", 5000);
  await settled();
  await page.waitForTimeout(500);
  const rep = () => page.evaluate(() => { const r = window.__reply.getBoundingClientRect(); const u = [...document.querySelectorAll('[data-testid="user-message"]')].pop().getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, user: { left: u.left, right: u.right, top: u.top, bottom: u.bottom } }; });
  let r = await rep(); b = await tk();
  check("cevap yazılırken cevabın üst kenarına oturur", perched && b.pose === "sit" && Math.abs(b.bottom - r.top) < 1.5 && b.left >= r.left && b.right <= r.right, `Tiko alt=${b.bottom.toFixed(1)} cevap üst=${r.top.toFixed(1)} · x=${b.left.toFixed(0)}`);
  check("otururken kullanıcı mesajını örtmez, ayak sallar (CSS)", !hitsBox(b, r.user) && b.anims > 0, `çalışan CSS animasyonu: ${b.anims}`);
  await shot("5-cevabin-ustunde.png", { l: 60, r: 300, t: 90, b: 110 });
  // Cevap uzar, sayfa kayar: kenardan düşmez
  await page.evaluate(() => { const d = document.createElement("div"); d.id = "spacer"; d.style.height = "90px"; document.querySelector("main").insertBefore(d, window.__reply); });
  await page.waitForTimeout(1000);
  r = await rep(); b = await tk();
  check("cevap yer değiştirince kenarla birlikte gider", Math.abs(b.bottom - r.top) < 1.5, `Tiko alt=${b.bottom.toFixed(1)} cevap üst=${r.top.toFixed(1)}`);
  // Sekme gizliyken tamamen durur
  const other = await ctx.newPage();
  await other.goto(`chrome-extension://${extId}/popup/popup.html`);
  await page.bringToFront();
  // Başsız Chromium'da sayfa hiç "gizli" olmaz (öne başka sekme almak ya da pencereyi küçültmek işe yaramıyor).
  // Bu yüzden gizlilik, içerik betiğinin kendi dünyasında taklit edilir: document.hidden = true + visibilitychange.
  const cdp = await ctx.newCDPSession(page);
  const worlds = [];
  cdp.on("Runtime.executionContextCreated", (e) => worlds.push(e.context));
  await cdp.send("Runtime.enable");
  const iso = worlds.find((w) => w.auxData?.type === "isolated" && String(w.origin || "").includes(extId));
  const inExt = (expression) => cdp.send("Runtime.evaluate", { expression, contextId: iso.id });
  const hidden = !!iso && await inExt(`Object.defineProperty(document, "hidden", { get: () => true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); document.hidden`).then((x) => x.result?.value === true, () => false);
  await page.waitForTimeout(300);
  const fh0 = await tk();
  await page.evaluate(() => { const d = document.getElementById("spacer"); d.style.height = "40px"; }); // gizliyken cevap yer değiştirse de izlemez
  await page.waitForTimeout(1600);
  const fh1 = await tk();
  check("sekme gizliyken tamamen durur (kare yok, animasyon duraklatılmış)", hidden && fh1.frames === fh0.frames && fh1.anims === 0 && fh1.raf === "0" && fh1.top === fh0.top, `gizli=${hidden} · 1,6 sn'de kare: ${fh1.frames - fh0.frames} · çalışan animasyon: ${fh1.anims}`);
  if (iso) await inExt(`delete document.hidden; document.dispatchEvent(new Event("visibilitychange")); document.hidden`);
  await page.waitForTimeout(900);
  r = await rep(); b = await tk();
  check("sekme geri gelince devam eder", b.anims > 0 && b.state === "perch" && Math.abs(b.bottom - r.top) < 1.5, `${b.state} · çalışan animasyon: ${b.anims}`);

  // 7) Cevap bitince sevinir, sonra mesaj kutusuna döner
  await page.evaluate(() => window.__finishReply());
  const cheered = await stateIs("cheer", 3000);
  await page.waitForTimeout(350);
  b = await tk();
  await shot("6-cevap-bitti.png", { l: 60, r: 300, t: 90, b: 110 });
  check("cevap bitince alkışlar ya da gerinir", cheered && ["clap", "stretch"].includes(b.pose), b.pose);
  const backIdle = await stateIs("idle", 4000);
  await settled();
  b = await tk();
  const fs1 = await page.evaluate(() => { const q = document.querySelector("fieldset").getBoundingClientRect(); return { left: q.left, right: q.right, top: q.top }; });
  check("sonra mesaj kutusuna döner", backIdle && b.place === "home" && b.left >= fs1.left && b.right <= fs1.right && Math.abs(b.bottom - fs1.top) < 60, `alt=${b.bottom.toFixed(0)} kutu üst=${fs1.top.toFixed(0)}`);

  // 7b) Sohbet yazısı Tiko'nun altına kayarsa saydamlaşır ve tıklamayı geçirir; yazı çekilince geri gelir
  const under = () => page.evaluate(() => {
    const h = document.querySelector("[data-token-forecast-tiko]"), root = h.shadowRoot, q = root.querySelector(".mv").getBoundingClientRect();
    const el = document.elementFromPoint(q.left + q.width / 2, q.top + q.height * 0.6);
    return { ghost: h.dataset.ghost, opacity: Number(getComputedStyle(root.querySelector(".tk")).opacity), clickHitsTiko: el === h, what: el?.className || el?.tagName };
  });
  const clear = await under();
  // Sohbet kayınca olan şey: bir cevabın satırları mesaj kutusunun hemen üstüne, Tiko'nun durduğu yere gelir
  await page.evaluate(() => {
    const q = document.querySelector("[data-token-forecast-tiko]").shadowRoot.querySelector(".mv").getBoundingClientRect();
    const d = document.createElement("div"); d.id = "scrolledText"; d.className = "font-claude-response";
    d.textContent = "Fotosentez, bitkilerin ışık enerjisini kimyasal enerjiye çevirmesidir. ".repeat(6);
    d.style.cssText = `position:fixed;left:${q.left - 150}px;top:${q.top - 40}px;width:420px;margin:0;z-index:1`;
    document.body.append(d);
    window.dispatchEvent(new Event("scroll"));
  });
  const ghosted = await waitTk(() => document.querySelector("[data-token-forecast-tiko]").dataset.ghost === "1", null, 3000);
  await page.waitForTimeout(400);
  const over = await under();
  await shot("15-yazinin-ustunde-saydam.png", { l: 150, r: 190, t: 110, b: 90 });
  check("altında sohbet yazısı varken saydamlaşır ve tıklamayı geçirir", clear.ghost !== "1" && clear.clickHitsTiko && ghosted && over.opacity < 0.5 && !over.clickHitsTiko, JSON.stringify({ clear, over }));
  await page.evaluate(() => { document.getElementById("scrolledText").remove(); window.dispatchEvent(new Event("scroll")); });
  check("yazı çekilince yeniden belirginleşir", await waitTk(() => document.querySelector("[data-token-forecast-tiko]").dataset.ghost === "0", null, 3000) && (await under()).clickHitsTiko);
  await page.waitForTimeout(300);

  // 8) claude.ai menüsü üstüne açılırsa geri çekilir
  await page.evaluate((q) => { const m = document.createElement("div"); m.id = "fakeMenu"; m.setAttribute("role", "menu"); Object.assign(m.style, { position: "fixed", left: (q.left - 20) + "px", top: (q.top - 30) + "px", width: "200px", height: "120px", background: "#eee", zIndex: 5 }); document.body.append(m); }, b);
  await page.mouse.click(700, 300);
  const yielded = await waitTk(() => document.querySelector("[data-token-forecast-tiko]").dataset.hidden === "1", null, 2500);
  await page.evaluate(() => document.getElementById("fakeMenu").remove());
  await page.mouse.click(700, 300);
  const cameBack = await waitTk(() => document.querySelector("[data-token-forecast-tiko]").dataset.hidden === "0", null, 2500);
  check("claude.ai menüsü üstüne açılınca gizlenir, kapanınca geri gelir", yielded && cameBack, `${yielded} → ${cameBack}`);

  // 9) Sürükle → park; yazarken yerinde kalır; çift tık → eve döner
  await settled();
  b = await tk();
  await page.mouse.move(b.cx, b.top + 22);
  await page.mouse.down();
  await page.mouse.move(b.cx + 60, b.top - 80, { steps: 5 });
  await page.mouse.move(1100, 300, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const park = (await storage("tikoPark")).tikoPark;
  b = await tk();
  check("sürükleyip bırakınca park eder ve yeri kaydedilir", b.place === "park" && Math.abs(b.cx - 1100) < 6 && park && park.rx > 0.7 && park.ry > 0.2 && park.ry < 0.5, JSON.stringify({ x: b.cx, y: b.top, park }));
  await ed.click(); await page.keyboard.type(" ve örnek ver", { delay: 15 });
  await page.waitForTimeout(500);
  const b2 = await tk();
  check("parktayken yazı onu yerinden oynatmaz, ifade yine çalışır", Math.abs(b2.cx - b.cx) < 1 && Math.abs(b2.top - b.top) < 1 && b2.state === "typing", `${b2.cx.toFixed(0)},${b2.top.toFixed(0)} · ${b2.state}`);
  await page.waitForTimeout(300);
  await shot("11-park.png");
  await page.mouse.dblclick(b2.cx, b2.top + 22);
  await page.waitForTimeout(300);
  await waitTk(() => document.querySelector("[data-token-forecast-tiko]").dataset.place !== "park", null, 3000);
  await settled();
  b = await tk();
  check("çift tıklayınca mesaj kutusuna döner, park silinir", b.place !== "park" && b.bottom > fs1.top - 80 && (await storage("tikoPark")).tikoPark == null, `${b.place} · alt=${b.bottom.toFixed(0)}`);

  // 10) Haftalık limit %80 üstü → endişeli
  state.usage7d = 86;
  await other.reload(); await other.waitForTimeout(1200); // popup açılınca kullanım yenilenir
  const worried = await faceIs("worry", 6000);
  await clearEd();
  await stateIs("idle", 4000);
  await settled();
  await page.waitForTimeout(300);
  await shot("7-haftalik-endise.png");
  check("haftalık limit %80 üstünde endişeli", worried && (await tk()).face === "worry", `haftalık %${state.usage7d}`);
  state.usage7d = 17;
  await other.reload(); await other.waitForTimeout(1200);
  check("limit düşünce endişe geçer", await faceIs("neutral", 6000));

  // 11) Uyku (yalnız TIKO_SLEEP=1: gerçek 2 dakika bekler)
  if (SLEEP) {
    await page.bringToFront();
    const slept = await stateIs("sleep", 135000);
    await page.waitForTimeout(600);
    await shot("10-uyku.png");
    b = await tk();
    check("2 dk hareketsizlikte uyur (zzz)", slept && b.pose === "sleep" && b.face === "closed", `${b.state}`);
    await page.mouse.move(400, 300); await page.mouse.move(420, 320);
    check("fare oynayınca uyanır ve esner", await poseIs("yawn", 2000));
    await stateIs("idle", 3000);
  } else console.log("  (uyku: atlandı; TIKO_SLEEP=1 ile 2 dakika bekleyerek denenir. Geçişler tiko.test.mjs'te.)");

  // 12) Hareket azaltma: kıpırdamayan küçük ikon
  await page.emulateMedia({ reducedMotion: "reduce" });
  await poseIs("still", 3000);
  await page.waitForTimeout(400);
  b = await tk();
  const rm = await page.evaluate(() => { const root = document.querySelector("[data-token-forecast-tiko]").shadowRoot; const tkEl = root.querySelector(".tk"), r = tkEl.getBoundingClientRect(); return { w: r.width, all: root.getAnimations().length, tr: getComputedStyle(root.querySelector(".mv")).transitionDuration, pupil: getComputedStyle(root.querySelector(".pupil")).animationName }; });
  // Yazarken 40 ms'de bir konum örneği: imleci izlemez; yalnızca bildirim çıkınca üstüne tek adımda geçer (ara konum yok)
  await ed.click();
  const samples = [];
  const sampler = setInterval(() => tk().then((q) => q && samples.push(`${q.left.toFixed(1)},${q.top.toFixed(1)}`), () => {}), 40);
  await page.keyboard.type("hareket azaltma açıkken yazıyorum", { delay: 25 });
  await page.waitForTimeout(900);
  clearInterval(sampler);
  const b3 = await tk();
  const spots = [...new Set(samples)], xs = new Set(spots.map((q) => q.split(",")[0]));
  check("reduced-motion: animasyon yok, küçük ikon", b.pose === "still" && rm.all === 0 && b3.anims === 0 && rm.pupil === "none" && /^0s/.test(rm.tr) && rm.w < 24, JSON.stringify(rm));
  check("reduced-motion: yazarken imleci izlemez, kayarak hareket etmez", xs.size === 1 && spots.length <= 2 && b3.raf === "0" && samples.length > 15, `${samples.length} örnekte ${spots.length} ayrı konum: ${spots.join(" | ")}`);
  await shot("12-hareket-azaltma.png");
  await page.click("#send");
  await page.waitForTimeout(2600);
  const b4 = await tk();
  check("reduced-motion: gönderim ve cevapta da kıpırdamaz", b4.anims === 0 && Math.abs(b4.left - b.left) < 0.5 && b4.pose === "still" && b4.place === "home", `${b4.state} · ${b4.pose} · ${b4.place}`);
  await page.evaluate(() => window.__finishReply());
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForTimeout(2500);
  check("hareket azaltma kapanınca yeniden canlanır", (await tk()).anims > 0 && (await tk()).pose !== "still");

  // 13) claude.ai'nin yapısı değişirse sessizce gizlenir, hata atmaz
  await page.evaluate(() => { window.__fs = document.querySelector("fieldset"); window.__fs.remove(); });
  const hid = await waitTk(() => { const h = document.querySelector("[data-token-forecast-tiko]"); return !h || h.dataset.hidden === "1"; }, null, 5000);
  check("mesaj kutusu kaybolunca sessizce gizlenir", hid, (await tk())?.state || "kaldırıldı");
  await page.evaluate(() => document.body.append(window.__fs));
  const back = await waitTk(() => document.querySelector("[data-token-forecast-tiko]")?.dataset.hidden === "0", null, 6000);
  check("mesaj kutusu geri gelince döner", back);
  // Seçim API'si beklenmedik davranırsa (aralık yok) da hata yok
  await page.evaluate(() => getSelection().removeAllRanges());
  await page.evaluate(() => { const p = document.querySelector(".ProseMirror p") || document.querySelector(".ProseMirror"); p.dispatchEvent(new InputEvent("input", { bubbles: true })); });
  await page.waitForTimeout(500);
  check("imleç bulunamazsa da görünür kalır (varsayılan yerinde)", (await tk())?.hidden === "0");

  // 13b) Koyu tema ve dar pencere: yalnızca görsel kontrol + taşma yok
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
    const st = document.createElement("style"); st.id = "darkfake";
    st.textContent = "body,header{background:#262624;color:#faf9f5} header{border-color:#3d3d3a} fieldset{background:#30302e;border-color:#44433f} .ProseMirror{color:#faf9f5} [data-testid=user-message]{background:#3d3d3a} .bar button{background:#30302e;color:#faf9f5;border-color:#44433f}";
    document.head.append(st);
  });
  await page.setViewportSize({ width: 760, height: 700 });
  await clearEd(); await page.keyboard.type("Koyu temada kısa bir soru", { delay: 12 });
  await stateIs("idle", 4000); await poseIs("stand", 4000); await settled();
  b = await tk();
  await page.mouse.click(b.cx, b.top + 22);
  await page.waitForTimeout(450);
  b = await tk();
  const bubBox = await page.evaluate(() => { const q = document.querySelector("[data-token-forecast-tiko]").shadowRoot.querySelector(".bub").getBoundingClientRect(); return { left: q.left, right: q.right, top: q.top }; });
  await page.screenshot({ path: path.join(OUT, "14-koyu-tema-dar-pencere.png"), clip: { x: 0, y: 380, width: 760, height: 320 } });
  check("dar pencerede Tiko ve baloncuğu ekrandan taşmaz", b.left >= 0 && b.right <= 760 && bubBox.left >= 0 && bubBox.right <= 760 && bubBox.top >= 0, JSON.stringify(bubBox));
  await page.evaluate(() => { delete document.documentElement.dataset.theme; document.getElementById("darkfake").remove(); });
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.waitForTimeout(600);

  // 14) Popup'tan kapat / aç
  await other.bringToFront();
  await other.evaluate(() => (document.getElementById("settings").open = true));
  const label = await other.locator("#lblTiko").innerText();
  const wasOn = await other.locator("#tiko").isChecked();
  await other.setViewportSize({ width: 340, height: 720 });
  await other.locator("#tiko").scrollIntoViewIfNeeded();
  await other.screenshot({ path: path.join(OUT, "13-popup-ayar.png") });
  await other.uncheck("#tiko");
  await page.bringToFront();
  const removed = await waitTk(() => !document.querySelector("[data-token-forecast-tiko]"), null, 4000);
  check("popup'ta 'Tiko' anahtarı var ve varsayılan açık", /Tiko/.test(label) && wasOn, label);
  check("kapatınca kaybolur; hap yerinde kalır", removed && !!(await page.$("[data-token-forecast]")) && (await storage("settings")).settings.tiko === false);
  await ed.click(); await page.keyboard.type(" deneme", { delay: 15 });
  await page.waitForTimeout(900);
  check("kapalıyken yazınca da geri gelmez", !(await page.$("[data-token-forecast-tiko]")));
  await setSetting({ tiko: true });
  const again = await waitTk(() => document.querySelector("[data-token-forecast-tiko]")?.dataset.hidden === "0", null, 5000);
  await page.waitForTimeout(600);
  check("açınca geri gelir; baloncuk ikinci kez çıkmaz", again && !(await tk()).say);

  // 15) İzin ve ağ: yeni izin yok, yalnız claude.ai
  const manifest = JSON.parse(fs.readFileSync(path.join(EXT, "manifest.json"), "utf8"));
  check("yeni izin istenmedi", JSON.stringify(manifest.permissions) === '["storage","alarms","notifications"]' && JSON.stringify(manifest.host_permissions) === '["https://claude.ai/*"]', manifest.permissions.join(","));
  const ext = netLog.filter((q) => !q.u.startsWith("chrome-extension://") && !q.u.startsWith("data:") && !q.u.startsWith("blob:"));
  const hosts = [...new Set(ext.map((q) => new URL(q.u).host))];
  check("ağ: yalnızca claude.ai", hosts.every((h) => h === "claude.ai"), hosts.join(","));
  const ours = errors.filter((e) => !/favicon/.test(e));
  check("konsolda hata yok", ours.length === 0, ours.slice(0, 3).join(" | "));

  await ctx.close();
  const failed = results.filter((q) => !q.ok);
  console.log(`\n${results.length - failed.length}/${results.length} Tiko kontrolü geçti`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
