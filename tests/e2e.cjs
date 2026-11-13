// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Uçtan uca test: eklentiyi Chromium'a yükler, claude.ai'yi taklit eden sahte bir sayfa ve
// sahte API ile çalıştırır. Çalıştır: node e2e.cjs
// Arka plan servisinin istekleri sahte sunucuya gitsin (yoksa 4-5 kontrol yanlışlıkla kırmızı olur).
// Burada ayarlanır ki Windows'ta da (npm betikleri cmd.exe ile çalışır) "npm run e2e" çalışsın.
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS ||= "1";
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const zlib = require("zlib");

const EXT = path.resolve(__dirname, "../extension");
const OUT = path.resolve(__dirname, "shots");
fs.mkdirSync(OUT, { recursive: true });
const CONV = "0b1c2d3e-0000-4000-8000-123456789abc";
const now = Date.now();
const state = { usage5h: 19, usage7d: 17, usageFable: 85, completions: 0, lastPrompt: null, usageFail: false, convFail: false };
// Gizlilik denetimi: testte yazılan / sayfada duran metinler ve dosya adları. Bunlar sayfanın kendi /completion
// isteği dışında hiçbir istekte ve eklentinin deposunda hiçbir anahtarda görünmemeli.
const EVIL = "SAHTE-SIZINTI-7f3a";
const SENTINELS = ["Kuantum dolanıklık", "toplantıya katılamayacağım", "Laguerre", "debounces another", "Fotosentez", "Hello there", "formülü açıkla",
  "kuantum tünelleme", "Kuantum tünelleme", "enerji engelini", "ONAY-ONCESI-GIZLI-METIN", "gizli-dosya", "img.png", "Elbette! İşte", EVIL];

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Claude</title>
<style>body{font-family:sans-serif;margin:0;background:#faf9f5} main{max-width:760px;margin:0 auto;padding:20px 20px 220px}
fieldset{position:fixed;left:50%;transform:translateX(-50%);bottom:20px;width:720px;border:1px solid #ccc;border-radius:16px;background:#fff;padding:12px}
.ProseMirror{min-height:48px;outline:none} .bar{display:flex;gap:8px;margin-top:8px}</style></head><body>
<main>
 <div data-testid="user-message">Merhaba, kuantum tünellemeyi anlatır mısın?</div>
 <div class="font-claude-response">Tabii! Kuantum tünelleme, bir parçacığın klasik olarak aşamayacağı bir enerji engelini geçebilmesidir...</div>
</main>
<fieldset>
 <div class="ProseMirror" contenteditable="true" role="textbox"></div>
 <div class="bar"><input type="file" id="file" multiple><button type="button">Opus 5.5</button><button type="button">Orta</button><button type="button" id="send">Gönder</button></div>
</fieldset>
<script>
document.getElementById('send').onclick = async () => {
  const ed = document.querySelector('.ProseMirror');
  const m = document.querySelector('main'); const u = document.createElement('div'); u.setAttribute('data-testid','user-message'); u.textContent = ed.innerText; m.append(u);
  const res = await fetch('/api/organizations/org1/chat_conversations/${CONV}/completion', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({prompt: ed.innerText, attachments: [], files: []})});
  const reader = res.body.getReader(); let txt='';
  for(;;){ const {value,done} = await reader.read(); if (done) break; txt += new TextDecoder().decode(value); }
  ed.innerText=''; const a = document.createElement('div'); a.className='font-claude-response'; a.setAttribute('data-is-streaming','false'); a.textContent='cevap'; m.append(a); document.title='done:'+txt.length;
};
</script></body></html>`;

function sse(text, util5h, util7d) {
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}      \n\n`;
  const resets5 = Math.floor((now + 3 * 3600e3) / 1000), resets7 = Math.floor((now + 3 * 86400e3) / 1000);
  return ev("message_start", { message: { uuid: "m2", model: "claude-opus-5-5" } }) +
    ev("content_block_start", { index: 0, content_block: { type: "thinking" } }) +
    ev("content_block_stop", { index: 0 }) +
    ev("content_block_start", { index: 1, content_block: { type: "text", text: "" } }) +
    text.match(/.{1,40}/gs).map((t) => ev("content_block_delta", { index: 1, delta: { type: "text_delta", text: t } })).join("") +
    ev("content_block_stop", { index: 1 }) +
    ev("message_delta", { delta: { stop_reason: "end_turn" } }) +
    ev("message_limit", { message_limit: { type: "within_limit", windows: { "5h": { status: "within_limit", resets_at: resets5, utilization: util5h / 100 }, "7d": { status: "within_limit", resets_at: resets7, utilization: util7d / 100 } } } }) +
    ev("message_stop", {});
}

function pngOf(w, h) { // tek renkli, sıkıştırılmış PNG
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const results = [];
const check = (name, ok, info = "") => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? "✓" : "✗"} ${name}${info ? " — " + info : ""}`); };

(async () => {
  const userDataDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "tf-"));
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium", headless: true, locale: "tr-TR", viewport: { width: 1280, height: 860 },
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, "--lang=tr-TR"]
  });
  const errors = [];
  const netLog = []; // gizlilik denetimi: tüm istekler (yöntem + adres)
  ctx.on("request", (r) => { let b = ""; try { b = r.postData() || ""; } catch (_) {} netLog.push({ m: r.method(), u: r.url(), b }); });
  const wsLog = []; // WebSocket istek olayı üretmez: ayrıca izlenir
  const watchWs = (p) => p.on("websocket", (ws) => wsLog.push(ws.url()));
  ctx.pages().forEach(watchWs); ctx.on("page", watchWs);
  await ctx.route("https://claude.ai/**", async (route) => {
    const req = route.request(); const u = new URL(req.url());
    const json = (o) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(o) });
    if (u.pathname === "/api/organizations") return json([{ uuid: "org1", capabilities: ["chat", "claude_pro"], rate_limit_tier: "default_claude_ai" }]);
    if (u.pathname === "/api/organizations/org1/usage" && state.usageFail) return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    if (u.pathname.endsWith(`/chat_conversations/${CONV}`) && state.convFail) return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    if (u.pathname === "/api/organizations/org1/usage") return json({ five_hour: { utilization: state.usage5h, resets_at: new Date(now + 3 * 3600e3).toISOString() }, seven_day: { utilization: state.usage7d, resets_at: new Date(now + 3 * 86400e3).toISOString() }, seven_day_opus: null, seven_day_fable: { utilization: state.usageFable, resets_at: new Date(now + 5 * 86400e3).toISOString() } });
    if (u.pathname.endsWith(`/chat_conversations/${CONV}`)) return json({
      uuid: CONV, model: "claude-opus-5-5", current_leaf_message_uuid: "m1",
      chat_messages: [
        { uuid: "h1", parent_message_uuid: "00000000-0000-4000-8000-000000000000", sender: "human", content: [{ type: "text", text: "Merhaba, kuantum tünellemeyi anlatır mısın?" }], created_at: new Date(now - 10 * 60000).toISOString() },
        { uuid: "m1", parent_message_uuid: "h1", sender: "assistant", content: [{ type: "text", text: "Tabii! Kuantum tünelleme, bir parçacığın klasik olarak aşamayacağı bir enerji engelini geçebilmesidir. ".repeat(12) }], created_at: new Date(now - 9 * 60000).toISOString() }
      ]
    });
    if (u.pathname.endsWith("/completion") && req.method() === "POST") {
      state.completions++;
      try { state.lastPrompt = JSON.parse(req.postData()).prompt; } catch (_) {}
      state.usage5h += 1; state.usage7d += 0.1;
      const reply = "Elbette! İşte açıklama: ".repeat(30);
      return route.fulfill({ status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" }, body: sse(reply, state.usage5h, state.usage7d) });
    }
    if (u.pathname.startsWith("/api/")) return json({});
    return route.fulfill({ status: 200, contentType: "text/html", body: PAGE });
  });

  let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent("serviceworker", { timeout: 15000 });
  const extId = sw.url().split("/")[2];
  check("eklenti yüklendi", !!extId, extId);
  const storage = (keys) => sw.evaluate((k) => chrome.storage.local.get(k), keys);

  // 0) Açık onay: kurulumda karşılama sayfası açılır; onay yokken sayfada hiçbir şey okunmaz
  const welcome = ctx.pages().find((p) => p.url().includes("/popup/welcome.html")) || await ctx.waitForEvent("page", { predicate: (p) => p.url().includes("/popup/welcome.html"), timeout: 8000 }).catch(() => null);
  check("kurulumda onay sayfası açıldı", !!welcome, welcome ? "welcome.html" : "yok");
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  const before = netLog.length;
  await page.goto(`https://claude.ai/chat/${CONV}`);
  await page.waitForFunction(() => document.getElementById("token-forecast-consent")?.shadowRoot?.querySelector("button")?.textContent, null, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const chipTxt = await page.evaluate(() => document.getElementById("token-forecast-consent")?.shadowRoot?.querySelector("button")?.textContent || "");
  const apiBefore = netLog.slice(before).filter((r) => /claude\.ai\/api\//.test(r.u));
  check("onaysız: yalnızca 'aç' düğmesi, panel yok, claude.ai API'sine istek yok", !!chipTxt && !(await page.$("[data-token-forecast]")) && apiBefore.length === 0, `${chipTxt} · API ${apiBefore.length}`);
  // 0b) Onay yokken sayfa kancası da uykuda: sayfa mesaj gönderse bile istek ve cevap OKUNMAZ, hiçbir şey yayılmaz
  await page.evaluate(() => {
    window.__tfSeen = [];
    window.addEventListener("message", (e) => { const d = e.data; if (d && d.__tokenForecast === 1) window.__tfSeen.push({ kind: d.kind, enabled: d.enabled, json: JSON.stringify({ ...d, text: undefined }) }); });
  });
  await page.evaluate(async (conv) => {
    const res = await fetch(`/api/organizations/org1/chat_conversations/${conv}/completion`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "ONAY-ONCESI-GIZLI-METIN", attachments: [{ file_name: "gizli-dosya.txt", extracted_content: "x" }], files: [] }) });
    await res.text();
    window.postMessage({ __tokenForecastCmd: "ping" }, location.origin);
  }, CONV);
  await page.waitForTimeout(600);
  const preSeen = await page.evaluate(() => window.__tfSeen);
  check("onaysız: sayfa kancası isteği ve cevabı okumadı (uykuda)", state.completions === 1 && preSeen.every((x) => x.kind === "hello" && x.enabled === false) && preSeen.length === 1 && Object.keys(await storage(["sends", "trace", "usage", "convActivity"])).length === 0,
    preSeen.map((x) => `${x.kind}:${x.enabled}`).join(",") || "mesaj yok");
  Object.assign(state, { completions: 0, lastPrompt: null, usage5h: 19, usage7d: 17 });
  await page.evaluate(() => { window.__tfSeen = []; });
  if (welcome) {
    await welcome.waitForSelector("#accept:not(:empty)");
    const wt = await welcome.evaluate(() => document.body.innerText);
    check("onay sayfası: okunanlar, saklananlar, gizlilik bağlantısı", /claude\.ai/.test(wt) && /token/i.test(wt) && (await welcome.getAttribute("#welPolicy", "href")).includes("privacy"), wt.split("\n")[0]);
    await welcome.click("#accept");
  } else {
    await sw.evaluate(() => chrome.storage.local.set({ consent: { v: 1, at: Date.now() } }));
  }
  const host = page.locator("[data-token-forecast]");
  await page.waitForFunction(() => document.querySelector("[data-token-forecast]")?.shadowRoot?.querySelector(".head")?.textContent, null, { timeout: 15000 });
  const head = () => page.evaluate(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".head").textContent);
  const cardText = () => page.evaluate(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".card").innerText);
  check("panel boşta görünüyor", (await head()).length > 0, await head());
  check("onaydan sonra 'aç' düğmesi kalktı", !(await page.$("#token-forecast-consent")));

  // 1) Yazınca tahmin
  const ed = page.locator(".ProseMirror");
  await ed.click();
  await page.keyboard.type("Kuantum dolanıklık nedir, basitçe açıklar mısın?");
  await page.waitForFunction(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".head").textContent.startsWith("≈"), null, { timeout: 5000 });
  check("yazınca yüzde tahmini çıkıyor", (await head()).startsWith("≈"), await head());
  const last = await page.evaluate(() => {
    // içerik betiği izole dünyada; son hesap sonucu sayfaya yansımaz, panel metninden kontrol ediyoruz
    return document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".card").innerText;
  });
  check("tip: açıklama, model: Opus 5.5, effort algılandı", /Açıklama/.test(last) && /Opus 5\.5/.test(last) && /orta effort/.test(last), last.split("\n").filter((l) => /Açıklama|Opus|effort/.test(l)).join(" | "));
  check("geçmiş sohbet API'sinden okundu (2 mesaj, önbellek sıcak + geri sayım)", /2 mesaj/.test(last) && /sıcak · geçmiş \d+ dk/.test(last), (last.match(/Önbellek.*/) || [""])[0]);

  // 2) Paneli aç, ekran görüntüsü
  await host.locator(".pill").click().catch(() => {});
  await page.evaluate(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".pill").click());
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "1-panel-acik.png") });

  // 3) Çeviri → Haiku önerisi
  await ed.click(); await page.keyboard.press("Control+A"); await page.keyboard.press("Backspace");
  await page.keyboard.type("Bu cümleyi İngilizceye çevir: Yarın toplantıya katılamayacağım.");
  await page.waitForTimeout(700);
  const t2 = await cardText();
  check("çeviride Haiku önerisi", /Haiku 5\.5/.test(t2), (t2.match(/.*Haiku.*/) || [""])[0].slice(0, 120));

  // 3b) Model önerisi bildirimi (mesaj kutusunun üstünde, gerekçeli)
  const bn = (sel) => page.evaluate((s) => { const b = document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".banner"); return s ? b.querySelector(s)?.innerText || "" : { cls: b.className, text: b.innerText, vis: getComputedStyle(b).display !== "none" }; }, sel);
  let b1 = await bn();
  check("bildirim görünüyor: çeviri → Haiku ile tasarruf", b1.vis && /t-save/.test(b1.cls) && /Haiku 5\.5 yeterli/.test(b1.text), b1.text.split("\n")[0]);
  await page.evaluate(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelector('.banner button[data-act="why"]').click());
  await page.waitForTimeout(300);
  b1 = await bn();
  check("Neden? açılınca: algılanan iş, işaretler, dayanak, ne zaman", /Algılanan iş/.test(b1.text) && /Gördüğüm işaretler/i.test(b1.text) && /Dayanak/i.test(b1.text) && /Ne zaman/i.test(b1.text) && /[İi]ngilizceye/.test(b1.text), b1.text.replace(/\n/g, " | ").slice(0, 300));
  await page.screenshot({ path: path.join(OUT, "4-oneri-bildirimi.png") });
  await page.evaluate(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelector('.banner button[data-act="bad"]').click());
  await page.waitForTimeout(500);
  const rp = (await storage("recPrefs")).recPrefs;
  check("👎 geri bildirimi kaydedildi", rp?.types?.translate?.votes?.down_bad === 1, JSON.stringify(rp));
  // İş türü düzeltmesi → cihazda kişisel öğrenme (metin saklanmaz)
  await page.evaluate(() => { const sel = document.querySelector("[data-token-forecast]").shadowRoot.querySelector('.banner select[data-act="relabel"]'); sel.value = "rewrite"; sel.dispatchEvent(new Event("change", { bubbles: true })); });
  await page.waitForTimeout(700);
  const lp = (await storage("learnPersonal")).learnPersonal;
  check("iş türü düzeltmesi cihazda öğrenildi (metin yok)", lp?.n === 1 && Object.keys(lp.w || {}).length > 10 && !/toplant|İngilizce|ingilizce/i.test(JSON.stringify(lp)), `n=${lp?.n} · ${Object.keys(lp?.w || {}).length} özellik`);
  await page.evaluate(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelector('.banner button[data-act="hide"]').click());
  await page.waitForTimeout(300);
  check("× ile gizlenince kayboluyor", !(await bn()).vis || !/show/.test((await bn()).cls));

  // 3c) Zor iş + hafif model → yükselt önerisi
  await page.evaluate(() => { [...document.querySelectorAll("fieldset button")].find((b) => b.textContent === "Opus 5.5").textContent = "Sonnet 5.5"; });
  await ed.click(); await page.keyboard.press("Control+A"); await page.keyboard.press("Backspace");
  await page.keyboard.type("Hidrojen atomu için radyal dalga fonksiyonlarını adım adım türet ve Laguerre polinomlarıyla ilişkisini kanıtla");
  await page.waitForTimeout(900);
  const b2 = await bn();
  check("zor türetme + Sonnet → yükselt önerisi", b2.vis && /t-up/.test(b2.cls) && /(Opus|Fable)/.test(b2.text), b2.text.split("\n")[0]);
  await page.screenshot({ path: path.join(OUT, "5-yukselt-onerisi.png") });
  // 3d) Uygun model → sakin onay
  await ed.click(); await page.keyboard.press("Control+A"); await page.keyboard.press("Backspace");
  await page.keyboard.type("Write a JavaScript function that debounces another function.");
  await page.waitForTimeout(900);
  const b3 = await bn();
  check("kod yazma + Sonnet → 'uygun' onayı", b3.vis && /t-ok/.test(b3.cls) && /uygun/.test(b3.text), b3.text.split("\n")[0]);
  check("uygun onayında effort da yazıyor", /effort: Orta/.test(b3.text), b3.text.split("\n")[0]);

  // 3e) Effort önerisi: Sonnet + Maksimum effort ile basit kavram sorusu → "effort'u Orta yap"
  const setEffort = (label) => page.evaluate((l) => { const b = [...document.querySelectorAll("fieldset button")].find((x) => /^(Orta|Maksimum|Düşük|Yüksek)$/.test(x.textContent)); b.textContent = l; }, label);
  await setEffort("Maksimum");
  await ed.click(); await page.keyboard.press("Control+A"); await page.keyboard.press("Backspace");
  await page.keyboard.type("Kuantum dolanıklık nedir, basitçe anlatır mısın?");
  await page.waitForTimeout(900);
  const b4 = await bn();
  check("effort fazla → 'effort'u Orta yap' bildirimi", b4.vis && /t-save/.test(b4.cls) && /Effort'u Orta yap/.test(b4.text), b4.text.split("\n")[0]);
  await page.evaluate(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelector('.banner button[data-act="why"]').click());
  await page.waitForTimeout(200);
  const b4o = await bn();
  check("Neden? içinde alan (Bilim · Fizik) ve effort gerekçesi", /Alan\s*\n?\s*Bilim · Fizik/.test(b4o.text) && /Effort önerisi/.test(b4o.text) && /Orta öneriyorum/.test(b4o.text) && /Şu an: Maksimum/.test(b4o.text), b4o.text.replace(/\n/g, " | ").slice(0, 260));
  const c4 = await cardText();
  check("kartta alan satırı ve effort tasarrufu", /Alan\s*Bilim · Fizik/.test(c4) && /Effort'u Orta yapmak/.test(c4), (c4.match(/Alan.*|Effort'u.*/g) || []).join(" | "));
  await page.evaluate(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelector('.banner button[data-act="bad"]').click());
  await page.waitForTimeout(1200);
  const rp2 = (await storage("recPrefs")).recPrefs;
  const fbLeft = await page.evaluate(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelectorAll('.banner .fb button').length);
  check("effort 👎 kaydedildi, düğmeler kapandı ve geri gelmedi", rp2?.types?.explain?.votes?.edown_bad === 1 && fbLeft === 0 && /Teşekkürler|✓/.test(await bn(".fb")), `${JSON.stringify(rp2?.types?.explain?.votes)} · düğme ${fbLeft}`);
  await page.screenshot({ path: path.join(OUT, "8-effort-onerisi.png") });
  await setEffort("Orta");

  // 3f) Hap taşınabilir: sürükle → konum kaydedilir; kartta "eski yerine al"; menü açılınca geri çekilir
  const pillBox = () => page.evaluate(() => { const h = document.querySelector("[data-token-forecast]"); const r = h.shadowRoot.querySelector(".pill").getBoundingClientRect(); const f = document.querySelector("fieldset").getBoundingClientRect(); const wr = h.shadowRoot.querySelector(".wrap"); return { x: r.left, y: r.top, w: r.width, h: r.height, ft: f.top, wl: wr.style.left, wt: wr.style.top, open: wr.classList.contains("open") }; });
  await page.waitForTimeout(1200); // effort değişimi hapı yeniden çizer; genişlik otursun
  const p0 = await pillBox();
  await page.mouse.move(p0.x + 20, p0.y + p0.h / 2);
  await page.mouse.down();
  await page.mouse.move(p0.x - 60, p0.y - 30, { steps: 6 });
  await page.mouse.move(p0.x - 200, p0.y - 90, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const p1 = await pillBox();
  const off = (await storage("pillOffset")).pillOffset;
  const openAfterDrag = await page.evaluate(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".wrap").classList.contains("open"));
  check("hap sürüklenince taşındı ve konum kaydedildi (kart açılmadı)", Math.abs(p1.x - (p0.x - 220)) < 16 && Math.abs(p1.y - (p0.y - 105)) < 6 && off && Math.abs(off.dx + 220) < 16 && Math.abs(off.dy + 105) < 6 && !openAfterDrag, JSON.stringify({ p0, p1, off }));
  await page.setViewportSize({ width: 1180, height: 820 }); await page.waitForTimeout(600);
  const p1b = await pillBox();
  check("pencere boyutu değişince de taşınan yerde (görünür)", p1b.x >= 0 && p1b.y >= 0 && p1b.x + p1b.w <= 1180, JSON.stringify(p1b));
  await page.setViewportSize({ width: 1280, height: 860 }); await page.waitForTimeout(400);
  // claude.ai menüsü (ör. effort seçici) hapın üstüne açılırsa hap geri çekilir
  await page.evaluate((b) => { const m = document.createElement("div"); m.id = "fakeMenu"; m.setAttribute("role", "menu"); Object.assign(m.style, { position: "fixed", left: (b.x - 10) + "px", top: (b.y - 10) + "px", width: "260px", height: "160px", background: "#eee", zIndex: 5 }); document.body.append(m); }, await pillBox());
  await page.waitForTimeout(350);
  const yieldOn = await page.evaluate(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".wrap").classList.contains("yield"));
  await page.evaluate(() => document.getElementById("fakeMenu").remove());
  await page.waitForTimeout(700);
  const yieldOff = await page.evaluate(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".wrap").classList.contains("yield"));
  check("menü hapın üstüne açılınca hap gizlenir, kapanınca geri gelir", yieldOn && !yieldOff, `${yieldOn} → ${yieldOff}`);
  await page.evaluate(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".pill").click());
  await page.waitForTimeout(250);
  const hasReset = await page.evaluate(() => !!document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".card button.reset"));
  await page.evaluate(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".card button.reset")?.click());
  await page.waitForTimeout(500);
  const p2 = await pillBox();
  check("'Hapı eski yerine al' konumu sıfırlar", hasReset && (await storage("pillOffset")).pillOffset == null && Math.abs(p2.x - p0.x) < 3 && Math.abs(p2.y - p0.y) < 3, JSON.stringify({ hasReset, p0, p2 }));
  await page.evaluate(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".wrap").classList.contains("open") && document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".pill").click());
  // Kod yazma metnine geri dön (sonraki adımlar onu bekliyor)
  await ed.click(); await page.keyboard.press("Control+A"); await page.keyboard.press("Backspace");
  await page.keyboard.type("Write a JavaScript function that debounces another function.");
  await page.waitForTimeout(700);
  // 3d2) claude.ai'nin kendi uyarısı mesaj kutusunun üstündeyse bizimkiler onun üstüne çıkmalı
  const noticeTop = await page.evaluate(() => {
    const f = document.querySelector("fieldset"); const fr = f.getBoundingClientRect();
    const n = document.createElement("div"); n.id = "claude-notice"; n.textContent = "Haftalık limitinin %80'ini kullandın";
    n.style.cssText = `position:fixed;left:${fr.left}px;width:${fr.width}px;top:${fr.top - 40}px;height:36px;background:#fde;`;
    f.before(n); return fr.top - 40;
  });
  await page.waitForTimeout(1200);
  const pos = await page.evaluate(() => { const r = document.querySelector("[data-token-forecast]").shadowRoot; return { pill: r.querySelector(".pill").getBoundingClientRect().bottom, ban: r.querySelector(".banner").getBoundingClientRect().bottom }; });
  check("claude.ai'nin kendi uyarısıyla üst üste binmiyor", pos.pill <= noticeTop + 1 && pos.ban <= noticeTop + 1, JSON.stringify({ ...pos, noticeTop }));
  await page.screenshot({ path: path.join(OUT, "6-claude-uyarisi-ile.png") });
  await page.evaluate(() => document.getElementById("claude-notice").remove());

  // 3e) Ayardan kapatınca görünmez
  await sw.evaluate(() => chrome.storage.local.get("settings").then(({ settings }) => chrome.storage.local.set({ settings: { ...settings, advisor: false } })));
  await page.waitForTimeout(700);
  check("ayardan kapatılınca bildirim yok", !/show/.test((await bn()).cls));
  await sw.evaluate(() => chrome.storage.local.get("settings").then(({ settings }) => chrome.storage.local.set({ settings: { ...settings, advisor: true } })));
  await page.evaluate(() => { [...document.querySelectorAll("fieldset button")].find((b) => b.textContent === "Sonnet 5.5").textContent = "Opus 5.5"; });

  // 3f) Fable payı: sahte /usage seven_day_fable %85 döndürür; yalnızca Fable seçiliyken görünür
  await page.waitForTimeout(800);
  const tOpus = await cardText();
  check("Opus seçiliyken Fable payı görünmez", !/Fable payı/.test(tOpus), (tOpus.match(/.*Fable.*/) || [""])[0]);
  await page.evaluate(() => { [...document.querySelectorAll("fieldset button")].find((b) => b.textContent === "Opus 5.5").textContent = "Fable 5.2"; });
  await page.waitForFunction(() => /Fable payı/.test(document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".card").innerText), null, { timeout: 5000 }).catch(() => {});
  const tFable = await cardText();
  check("Fable 5.2 seçili: kartta Fable payı %85", /Fable payı\s*%85/.test(tFable) && /Fable 5\.2/.test(tFable), (tFable.match(/.*Fable.*/g) || []).join(" | "));
  check("Fable payı %80'i geçince Opus 5.5'e geç uyarısı", /Fable payın dolmak üzere \(%85\)\. Opus 5\.5'e geç/.test(tFable), (tFable.match(/.*dolmak.*/) || [""])[0]);
  await page.evaluate(() => { [...document.querySelectorAll("fieldset button")].find((b) => b.textContent === "Fable 5.2").textContent = "Opus 5.5"; });
  await page.waitForTimeout(800);

  // 4) Görsel ekle
  fs.writeFileSync(path.join(OUT, "img.png"), pngOf(1000, 1000));
  await page.setInputFiles("#file", path.join(OUT, "img.png"));
  await page.waitForTimeout(800);
  const t3 = await cardText();
  check("görsel ek tokenı hesaplandı (1000×1000 → 1.296)", /Ekler/.test(t3) && /1\.296/.test(t3), (t3.match(/Ekler.*\n?.*/) || [""])[0].replace(/\n/g, " "));

  // 5) Gönder → akış → kalibrasyon
  // Site, sayfa yüklendikten sonra window.fetch'i kendi sürümüyle değiştirsin (gerçek claude.ai'de olan bu)
  await page.evaluate(() => { const f = window.fetch; window.__siteFetchCalls = 0; window.fetch = function () { window.__siteFetchCalls++; return f.apply(this, arguments); }; });
  await page.click("#send");
  await page.waitForFunction(() => document.title.startsWith("done:"), null, { timeout: 10000 });
  await page.waitForTimeout(2500);
  const st = await storage(["calib", "usage", "usageMeta", "convActivity", "tier"]);
  check("tamamlama isteği orijinal haliyle gitti", state.completions === 1 && /debounce/.test(state.lastPrompt || ""));
  check("akıştan kullanım birleştirildi (%20)", st.usage?.fiveHour?.pct === 20 && st.usageMeta?.source === "stream", JSON.stringify(st.usage?.fiveHour));
  check("plan tespiti: Pro", st.tier === "claude_pro");
  const log = st.calib?.log || [];
  check("kalibrasyon gözlemi kaydedildi", log.length >= 1 && log.at(-1).delta === 1 && log.at(-1).accepted, JSON.stringify(log.at(-1)));
  check("sohbet etkinliği kaydedildi", !!st.convActivity?.[CONV]);
  const postSeen = await page.evaluate(() => window.__tfSeen);
  const sendMsg = postSeen.find((x) => x.kind === "send");
  check("onaydan sonra kanca uyandı; yaydığı gönderim mesajında istem metni ve dosya adı yok", !!sendMsg && postSeen.some((x) => x.kind === "done") && !/debounce|img\.png|"prompt":"/.test(sendMsg.json) && /"promptChars":\d+/.test(sendMsg.json), (sendMsg?.json || "").slice(0, 200));

  // 5b) Worker yolu: fetch hiç görülmez, yalnızca sayfa değişir (gerçek claude.ai'de gönderim worker'dan gidiyor)
  await ed.click(); await page.keyboard.type("Fotosentezi kısaca açıkla");
  await page.waitForTimeout(600);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  state.usage5h = 21.5;
  await page.evaluate(() => {
    document.querySelector(".ProseMirror").innerText = "";
    const m = document.querySelector("main");
    document.querySelector('[data-testid="user-message"]').remove(); // uzun sohbet: eski mesaj sayfadan kalkar, sayı değişmez
    const u = document.createElement("div"); u.setAttribute("data-testid", "user-message"); u.textContent = "Fotosentezi kısaca açıkla"; m.append(u);
    // Eski cevap ekranda dururken yeni cevap 6 sn gecikmeyle gelsin (gerçek claude.ai'de görülen durum)
    const a = document.createElement("div"); a.className = "font-claude-response"; a.setAttribute("data-is-streaming", "true"); a.textContent = "Fotosentez, ";
    setTimeout(() => m.append(a), 6000);
    setTimeout(() => { a.textContent += "bitkilerin ışık enerjisini kimyasal enerjiye çevirmesidir. ".repeat(8); }, 6800);
    setTimeout(() => a.setAttribute("data-is-streaming", "false"), 7600);
  });
  setTimeout(() => { state.usage5h = 22.5; }, 16000); // kullanım geç işlensin
  await page.waitForFunction(async () => true);
  let domObs = null;
  for (let i = 0; i < 100 && !domObs; i++) {
    await page.waitForTimeout(500);
    const tr0 = (await storage("trace")).trace || [];
    const seenDom = tr0.some((x) => x.step === "send:seen" && x.info?.via === "dom");
    const ob = [...tr0].reverse().find((x) => x.step === "done:observed");
    if (seenDom && ob && tr0.indexOf(ob) > tr0.findIndex((x) => x.step === "send:seen" && x.info?.via === "dom")) domObs = ob;
  }
  check("worker yolu: sayfadan gönderim + cevap algılandı ve ölçüldü", domObs && (domObs.info.deltas || []).some((x) => x > 0), JSON.stringify(domObs?.info));
  const trD = (await storage("trace")).trace || [];
  const dseen = [...trD].reverse().find((x) => x.step === "done:seen" && x.info?.via === "dom");
  check("eski cevap yeni sanılmadı (yeni cevabın uzunluğu ölçüldü)", dseen && dseen.info.chars > 300, JSON.stringify(dseen?.info));
  const sends = (await storage("sends")).sends || [];
  const lastSend = sends.at(-1) || {};
  check("gönderim kaydı: 2 kayıt, ölçülen fark işlendi, metin yok", sends.length >= 2 && Number.isFinite(lastSend.d) && lastSend.type && !Object.keys(lastSend).some((k) => /text|prompt/i.test(k)) && !JSON.stringify(sends).includes("Fotosentez"), JSON.stringify(lastSend));

  // 5c) Beklenenden fazla harcama açıklaması + harcama dökümü kartta
  await sw.evaluate(() => chrome.storage.local.set({ lastSurprise: { at: Date.now(), d: 9, lo: 0.5, hi: 2, reasons: ["cold", "elsewhere"] } }));
  await ed.click(); await page.keyboard.type("Bu formülü açıkla");
  await page.waitForTimeout(900);
  const t5 = await cardText();
  check("kartta 'beklenenden fazla harcadı' açıklaması", /beklenenden fazla harcadı/.test(t5) && /geçmiş baştan okundu/.test(t5), (t5.match(/.*beklenenden.*/) || [""])[0]);
  check("kartta harcama dökümü", /Harcamanın dökümü/.test(t5) && /Cevap/.test(t5), (t5.match(/Harcamanın dökümü[\s\S]{0,80}/) || [""])[0].replace(/\n/g, " "));
  // 5d) "Neden bu kadar harcadı?" anahtarı kapalıyken açıklama görünmez
  await sw.evaluate(() => chrome.storage.local.get("settings").then(({ settings }) => chrome.storage.local.set({ settings: { ...settings, explain: false } })));
  await page.waitForTimeout(800);
  const t5b = await cardText();
  check("açıklama anahtarı kapalıyken 'beklenenden fazla' yok, tahmin kartı duruyor", !/beklenenden fazla harcadı/.test(t5b) && /Harcamanın dökümü/.test(t5b), (t5b.match(/.*beklenenden.*/) || [""])[0]);
  await sw.evaluate(() => chrome.storage.local.get("settings").then(({ settings }) => chrome.storage.local.set({ settings: { ...settings, explain: true } })));
  await page.evaluate(() => { document.querySelector(".ProseMirror").innerText = ""; });
  await sw.evaluate(() => chrome.storage.local.remove("lastSurprise"));

  // 6) Eşik bildirimi: kullanım %80'e çıksın
  state.usage5h = 80;
  await sw.evaluate(() => new Promise((r) => chrome.runtime.onMessage.dispatch ? r() : r()));
  const pop = await ctx.newPage();
  pop.on("pageerror", (e) => errors.push("popup: " + e));
  pop.on("console", (m) => { if (m.type() === "error") errors.push("popup: " + m.text()); });
  await pop.goto(`chrome-extension://${extId}/popup/popup.html`);
  await pop.waitForTimeout(1500);
  const notified = (await storage("notified")).notified || {};
  check("%75 eşiği bildirimi işaretlendi", Object.entries(notified).some(([k, v]) => k.startsWith("five_hour@") && v === 75), JSON.stringify(notified));
  const popText = await pop.evaluate(() => document.body.innerText);
  check("popup: limitler", /5 saatlik oturum/.test(popText) && /%80/.test(popText));
  const capItems = await pop.locator("#capList li").count();
  check("popup: kalan limitle yapılabilecekler (6 satır)", capItems === 6, (await pop.locator("#capList").innerText()).replace(/\n/g, " · "));
  check("popup: kalibrasyon metni", /ölçüm/.test(popText), (popText.match(/.*ölçüm.*/) || [""])[0]);
  check("popup: Opus seçiliyken Fable penceresi yalnızca 'Diğer limitler'de", !/Fable payı/.test(popText) && /Diğer limitler/.test(popText) && /Haftalık limit · Fable/.test(popText), (popText.match(/.*Fable.*/g) || []).join(" | "));
  const ctxBefore = (await storage("lastContext")).lastContext;
  await sw.evaluate(() => chrome.storage.local.get("lastContext").then(({ lastContext }) => chrome.storage.local.set({ lastContext: { ...lastContext, model: "Fable 5.2", at: Date.now() } })));
  await pop.reload(); await pop.waitForTimeout(1000);
  const popFable = await pop.evaluate(() => document.body.innerText);
  check("popup: Fable seçiliyken 'Fable payı' ve Opus 5.5 uyarısı", /Fable payı \(haftalık\)/.test(popFable) && /Opus 5\.5'e geç/.test(popFable) && !/Haftalık limit · Fable/.test(popFable), (popFable.match(/.*Fable.*/g) || []).join(" | "));
  await sw.evaluate((c) => chrome.storage.local.set({ lastContext: c }), ctxBefore);
  await pop.reload(); await pop.waitForTimeout(800);
  const tr = (await storage("trace")).trace || [];
  const steps = tr.map((x) => x.step);
  check("tanı günlüğü: gönderim ve cevap adımları", ["send:seen", "send:pre", "done:seen", "done:observed"].every((x) => steps.includes(x)), steps.join(","));
  check("fetch sonradan değiştirilse de gönderim yakalandı", steps.includes("send:seen") && (await page.evaluate(() => window.__siteFetchCalls)) > 0);
  const hk = (await storage("hookHello")).hookHello;
  check("tanı: kanca yanıt verdi ve fetch sarılı", hk && hk.wrapped === true, JSON.stringify(hk));
  await pop.evaluate(() => (document.getElementById("health").open = true));
  const rowsN = await pop.locator("#healthList li").count();
  const okN = await pop.locator("#healthList li.ok").count();
  check("popup: sağlık ekranı 6 satır, çoğu yeşil", rowsN === 6 && okN >= 4, `${okN}/${rowsN} · ` + (await pop.locator("#healthList").innerText()).replace(/\n/g, " | "));
  // Yedekten geri yükleme (kaldır-kur sonrası öğrenilenler geri gelsin)
  const cur = (await storage("calib")).calib;
  const backup = { format: "token-forecast-backup", formatVersion: 1, exportedAt: new Date().toISOString(), calib: { ...cur, stats: { n: 42, inRange: 30 } }, recPrefs: { types: { math: { floor: "opus", votes: {} } } } };
  fs.writeFileSync(path.join(OUT, "yedek.json"), JSON.stringify(backup));
  await pop.evaluate(() => (document.getElementById("settings").open = true));
  await pop.setInputFiles("#importFile", path.join(OUT, "yedek.json"));
  await pop.waitForTimeout(400);
  const msg1 = await pop.locator("#importMsg").innerText();
  await pop.click("#import");
  await pop.waitForTimeout(800);
  const after = await storage(["calib", "recPrefs"]);
  check("yedek içe aktarıldı (onaylı, 42 ölçüm + kişisel öneri ayarı)", after.calib?.stats?.n === 42 && after.recPrefs?.types?.math?.floor === "opus", msg1 + " → " + (await pop.locator("#importMsg").innerText()));
  fs.writeFileSync(path.join(OUT, "bozuk.json"), "{\"merhaba\": 1}");
  await pop.setInputFiles("#importFile", path.join(OUT, "bozuk.json"));
  await pop.waitForTimeout(300);
  check("bozuk yedek reddedildi", /geçerli/.test(await pop.locator("#importMsg").innerText()) && (await storage("calib")).calib?.stats?.n === 42);
  // Görünüm anahtarı: Sade → dört öneri anahtarı kapanır, Tam → açılır, tek tek değişince "Özel"
  await pop.evaluate(() => (document.getElementById("settings").open = true));
  await pop.selectOption("#view", "simple"); await pop.waitForTimeout(500);
  const vs = (await storage("settings")).settings;
  check("görünüm 'Sade': model, effort, ipucu ve açıklama kapalı; tahmin ve bildirim açık", ["advisor", "effortAdvice", "tips", "explain"].every((k) => vs[k] === false) && vs.panel === true, JSON.stringify(vs));
  await pop.selectOption("#view", "full"); await pop.waitForTimeout(500);
  const vf = (await storage("settings")).settings;
  check("görünüm 'Tam': dört anahtar açık", ["advisor", "effortAdvice", "tips", "explain"].every((k) => vf[k] === true));
  await pop.uncheck("#tips"); await pop.waitForTimeout(500);
  check("tek anahtar kapanınca görünüm 'Özel'", (await pop.locator("#view").inputValue()) === "custom");
  await pop.check("#tips"); await pop.waitForTimeout(400);
  await pop.setViewportSize({ width: 340, height: 720 });
  await pop.evaluate(() => (document.getElementById("settings").open = true));
  await pop.screenshot({ path: path.join(OUT, "2-popup.png"), fullPage: true });

  // 6b) Haftalık rapor: örnek kayıtlarla sayfa açılıyor mu?
  check("popup: haftalık özet satırı", /Son 7 gün: \d+ mesaj/.test(await pop.evaluate(() => document.body.innerText)));
  await sw.evaluate(() => chrome.storage.local.get("sends").then(({ sends = [] }) => {
    const now = Date.now(), H = 3600e3;
    for (let i = 0; i < 14; i++) sends.push({ id: "x" + i, at: now - (i + 1) * 9 * H, conv: "c" + (i % 4), fam: i % 3 ? "opus" : "sonnet", model: i % 3 ? "opus 5.5" : "sonnet 5.5",
      type: ["explain", "code_fix", "translate", "math"][i % 4], eff: "medium", peak: i % 2 === 0, cache: i % 5 === 0 ? "cold" : "warm", hist: i % 5 === 0 ? 70000 : 3000,
      pred: 1 + (i % 4), predLo: 0.4, predHi: 3 + (i % 4), predW: 0.1, adv: i % 4 === 2 ? { k: "save", t: "haiku" } : { k: "ok", t: "opus" }, save: i % 4 === 2 ? 1.6 : 0, d: i % 2 ? 2 : null, outHi: 1200,
      dom: ["science", "software", "language", "math"][i % 4], sub: ["physics", "web", "translation", "pure"][i % 4], effRec: ["medium", "medium", "low", "high"][i % 4], effSave: i % 4 === 2 ? 0.4 : 0 });
    // Öğrenme kanıtı için eski ölçümler (28 günden eski: ısı haritasını ve haftalık sayıları etkilemez): hata zamanla azalıyor
    for (let i = 0; i < 60; i++) sends.push({ id: "o" + i, at: now - (62 - i) * 24 * H * 0.5 - 29 * 24 * H, conv: "o", fam: "sonnet", model: "sonnet 5.5", type: "explain", eff: "medium", peak: false, cache: "warm", hist: 2000,
      pred: 4, predLo: 2, predHi: 8, predW: 0.1, adv: { k: "ok", t: "sonnet" }, save: 0, d: Math.max(1, Math.round(4 * (i < 20 ? 2.4 : i < 40 ? 1.6 : 1.1))), outHi: 1200 });
    sends.sort((a, b) => a.at - b.at);
    return chrome.storage.local.set({ sends });
  }));
  const rpg = await ctx.newPage();
  rpg.on("pageerror", (e) => errors.push("rapor: " + e));
  rpg.on("console", (m) => { if (m.type() === "error") errors.push("rapor: " + m.text()); });
  await rpg.setViewportSize({ width: 1000, height: 1300 });
  await rpg.goto(`chrome-extension://${extId}/popup/report.html`);
  await rpg.waitForTimeout(1000);
  const rpText = await rpg.evaluate(() => document.body.innerText);
  const cells = await rpg.locator("#heat .c").count();
  const tipsN = await rpg.locator("#tips li").count();
  check("haftalık rapor: 4 kutucuk, öneriler, 7×24 harita", (await rpg.locator(".tile").count()) === 4 && tipsN >= 1 && cells === 168, `${tipsN} öneri · ${cells} hücre · ` + (rpText.match(/Önerilerim\n.*/) || [""])[0].replace(/\n/g, " "));
  check("haftalık rapor: alanlar, alt başlıklar ve effort dağılımı", (await rpg.locator("#doms .brow").count()) >= 3 && (await rpg.locator("#subs span").count()) >= 3 && (await rpg.locator("#effs .brow").count()) >= 1 && /Bilim/.test(rpText) && /Fizik/.test(rpText),
    ((rpText.match(/Alanlar[\s\S]{0,140}/) || [""])[0]).replace(/\n/g, " | "));
  const learnBars = await rpg.locator("#learnChart .lb").count();
  const learnTxt = await rpg.locator("#learnMsg").innerText();
  check("haftalık rapor: öğrenme kanıtı grafiği ve 'öğreniyor' sonucu", learnBars === 6 && /öğreniyor/.test(learnTxt), `${learnBars} çubuk · ${learnTxt.slice(0, 90)}`);
  check("haftalık rapor: yoğun saat hücreleri işaretli, en pahalı mesajlar listelendi", (await rpg.locator("#heat .c.pk").count()) === 30 && (await rpg.locator("#top li").count()) === 3);
  await rpg.screenshot({ path: path.join(OUT, "7-haftalik-rapor.png"), fullPage: true });
  await rpg.close();

  // 6c) Topluluk katkısı: önizleme metin içermiyor
  await pop.bringToFront();
  await pop.evaluate(() => (document.getElementById("community").open = true));
  await pop.click("#comBuild");
  await pop.waitForTimeout(400);
  const comTxt = await pop.locator("#comPreview").innerText().catch(() => "");
  check("topluluk katkısı önizlemesi: biçim doğru, metin yok", /token-forecast-contribution/.test(comTxt) && /"plan"/.test(comTxt) && !/Fotosentez|İngilizce|toplant/i.test(comTxt), comTxt.replace(/\s+/g, " ").slice(0, 120));

  // 7) Dil değişimi → İngilizce panel
  await pop.selectOption("#lang", "en");
  await page.waitForTimeout(800);
  await page.bringToFront();
  await ed.click(); await page.keyboard.type("Hello there");
  await page.waitForTimeout(700);
  const t4 = await cardText();
  check("dil İngilizceye geçti", /This message will use/.test(t4), t4.split("\n")[1]);
  await page.screenshot({ path: path.join(OUT, "3-panel-en.png") });
  await pop.selectOption("#lang", "auto");

  // 8) Rozet
  const badge = await sw.evaluate(() => chrome.action.getBadgeText({}));
  check("araç çubuğu rozeti", badge === "80", badge);

  // 9) Hata yok (aşağıdaki denetimler bilerek hata üretir; konsol hataları burada dondurulur)
  const ours = errors.filter((e) => !/favicon/.test(e));

  // 10) Denetim: sayfa betiği sahte kanca mesajı yollarsa (aynı penceredeki her betik bunu yapabilir)
  const sendsBefore = ((await storage("sends")).sends || []).length;
  await page.evaluate(({ conv, evil }) => {
    const big = evil + "A".repeat(200000);
    const post = (o) => window.postMessage({ __tokenForecast: 1, ...o }, location.origin);
    post({ kind: "perf", path: big, via: big });
    post({ kind: "worker", path: big });
    post({ kind: "probe", path: big });
    post({ kind: "probe", path: "/api/toplantıya katılamayacağım/" + evil + "0000" });
    post({ kind: "done", id: "sahte-3", messageLimit: { windows: { "5h": { utilization: 0.2, status: "Kuantum dolanıklık nedir" } } } });
    post({ kind: "hello", wrapped: big, sawCompletion: big });
    post({ kind: "send", id: big, conv: big });
    post({ kind: "send", id: "sahte-1", conv: evil + " <b>", at: Date.now() });
    post({ kind: "send", id: "sahte-2", conv, at: Date.now(), via: "dom", prePromise: { then: 1 }, body: { keys: [big], prompt: big },
      estimate: { unread: [], empty: false, cls: { type: evil, scores: {} }, dom: { domain: evil, sub: evil }, pt: { low: 1, mid: 1, high: 1 }, att: { low: 0, mid: 0, high: 0 }, hist: { tokens: { mid: 0 } },
        fc: { model: evil, weight: 1e9, effort: evil, peak: false, cache: evil, pct: { session: { low: 1, mid: 50, high: 99 }, weekly: { low: 1, mid: 50, high: 99 } }, output: { high: 1 } }, adv: { kind: evil, tier: evil } } });
    post({ kind: "done", id: "sahte-2", text: "x", model: big, messageLimit: { windows: { "5h": { utilization: 55, resets_at: 1, status: big }, "7d": { utilization: -3 } }, extra: big } });
  }, { conv: CONV, evil: EVIL });
  await page.waitForTimeout(4000);
  const afterFake = await sw.evaluate(() => chrome.storage.local.get(null));
  const fakeJson = JSON.stringify(afterFake);
  const SEND_KEYS = ["id", "at", "conv", "fam", "model", "type", "eff", "peak", "cache", "hist", "pred", "predLo", "predHi", "predW", "adv", "save", "dom", "sub", "effRec", "effAs", "effSave", "outHi", "d", "dw", "out", "ecoU", "ecoK"];
  const newSends = (afterFake.sends || []).slice(sendsBefore);
  check("sahte mesaj: sayfanın verdiği 'tahmin' ve dizeler depoya girmedi", !fakeJson.includes(EVIL) && !fakeJson.includes("AAAAAAAAAA") && newSends.every((x) => Object.keys(x).every((k) => SEND_KEYS.includes(k)) && x.model !== EVIL),
    `yeni kayıt ${newSends.length}: ` + JSON.stringify(newSends.map((x) => [x.model, x.type, x.pred])));
  check("sahte mesaj: ölçek dışı kullanım (%5500) kabul edilmedi", afterFake.usage?.fiveHour?.pct <= 100 && Object.keys(afterFake.calib?.k || {}).every((k) => k === "claude_pro"), JSON.stringify(afterFake.usage?.fiveHour));
  check("sahte mesaj: tanı günlüğü kayıtları küçük kaldı", (afterFake.trace || []).length <= 60 && (afterFake.trace || []).every((x) => JSON.stringify(x).length < 900), String(Math.max(...(afterFake.trace || []).map((x) => JSON.stringify(x).length))));

  // 11) Denetim: okunamayan değer yerine sayı gösterilmez
  // 11a) Model seçici okunamıyor ama sohbetin modeli API'den biliniyor → sayı kalır, kaynağı yazar
  const setModel = (pg, from, to) => pg.evaluate(([a, b]) => { [...document.querySelectorAll("fieldset button")].find((x) => x.textContent === a).textContent = b; }, [from, to]);
  await setModel(page, "Opus 5.5", "Akıllı");
  await page.waitForFunction(() => /sohbetten okundu/.test(document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".card").innerText), null, { timeout: 5000 }).catch(() => {});
  const tChat = await cardText();
  check("model seçici okunamadı, sohbetin modeli kullanıldı ve işaretlendi", /Opus 5\.5 \(sohbetten okundu\)/.test(tChat) && (await head()).startsWith("≈"), (tChat.match(/Model.*/) || [""])[0]);
  await setModel(page, "Akıllı", "Opus 5.5");
  // 11b) Yeni sohbet + okunamayan model → "Okunamadı", sayı yok, gönderim kalibrasyona yazılmaz
  const pn = await ctx.newPage();
  await pn.goto("https://claude.ai/new");
  const head2 = () => pn.evaluate(() => document.querySelector("[data-token-forecast]")?.shadowRoot?.querySelector(".head")?.textContent || "");
  const card2 = () => pn.evaluate(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".card").innerText);
  await pn.waitForFunction(() => document.querySelector("[data-token-forecast]")?.shadowRoot?.querySelector(".head")?.textContent, null, { timeout: 15000 });
  await pn.locator(".ProseMirror").click();
  await pn.keyboard.type("Kuantum dolanıklık nedir, basitçe açıklar mısın?");
  await pn.waitForFunction(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".head").textContent.startsWith("≈"), null, { timeout: 5000 }).catch(() => {});
  const okHead = await head2();
  await setModel(pn, "Opus 5.5", "Akıllı");
  await pn.waitForFunction(() => !document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".head").textContent.startsWith("≈"), null, { timeout: 5000 }).catch(() => {});
  const unHead = await head2(), unCard = await card2();
  const unBanner = await pn.evaluate(() => /show/.test(document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".banner").className));
  check("model okunamadı → 'Okunamadı', sayı ve öneri yok (Sonnet varsayılmadı)", okHead.startsWith("≈") && unHead === "Okunamadı" && /Seçili model okunamadı/.test(unCard) && !/≈|Sonnet|%\d/.test(unCard.replace(/5 sa.*/g, "")) && !unBanner, `${okHead} → ${unHead} | ${unCard.replace(/\n/g, " | ").slice(0, 160)}`);
  await pn.evaluate(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".pill").click());
  await pn.waitForTimeout(300);
  await pn.screenshot({ path: path.join(OUT, "9-okunamadi.png") });
  const nSends = ((await storage("sends")).sends || []).length, nLog = ((await storage("calib")).calib?.log || []).length;
  await pn.click("#send");
  await pn.waitForFunction(() => document.title.startsWith("done:"), null, { timeout: 10000 });
  await pn.waitForTimeout(2500);
  const trU = ((await storage("trace")).trace || []).map((x) => x.step);
  check("model okunamadıyken gönderim: kayıt ve kalibrasyon gözlemi üretilmedi", ((await storage("sends")).sends || []).length === nSends && ((await storage("calib")).calib?.log || []).length === nLog && trU.includes("send:unread"), trU.slice(-6).join(","));
  // 11c) Sohbet API'si okunamıyor → sayfadaki mesajlar sayılır ve "eksik olabilir" uyarısı çıkar
  state.convFail = true;
  await pn.goto(`https://claude.ai/chat/${CONV}`);
  await pn.waitForFunction(() => document.querySelector("[data-token-forecast]")?.shadowRoot?.querySelector(".head")?.textContent, null, { timeout: 15000 });
  await pn.locator(".ProseMirror").click();
  await pn.keyboard.type("Kuantum dolanıklık nedir?");
  await pn.waitForFunction(() => /okunamadı/.test(document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".card").innerText), null, { timeout: 6000 }).catch(() => {});
  const tPart = await card2();
  check("sohbet API'si okunamadı → sayfadan sayıldı ve uyarı verildi", /Sohbet geçmişi claude\.ai'den okunamadı/.test(tPart) && /2 mesaj/.test(tPart), (tPart.match(/.*Sohbet geçmişi.*/) || [""])[0].slice(0, 120));
  state.convFail = false;
  await pn.close();
  // 11d) Kullanım okunamıyor ve depodaki değer eski / penceresi yenilenmiş → sayı yerine "okunamadı", rozet "?"
  state.usageFail = true;
  await sw.evaluate(() => chrome.storage.local.get("usage").then(({ usage }) => chrome.storage.local.set({
    usage: { ...usage, fiveHour: { ...usage.fiveHour, pct: 87, resetsAt: Date.now() - 60000 } },
    usageMeta: { fetchedAt: Date.now() - 40 * 60000, source: "background", error: null } })));
  await page.bringToFront();
  await page.waitForTimeout(900);
  const tExp = await cardText();
  check("panel: yenilenme zamanı geçmiş %87 gösterilmiyor", !/%87/.test(tExp) && !/%87/.test(await page.evaluate(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".pill").innerText)), tExp.split("\n").slice(0, 3).join(" | "));
  await pop.bringToFront(); await pop.reload(); await pop.waitForTimeout(1500);
  const popStale = await pop.evaluate(() => document.body.innerText);
  const badgeStale = await sw.evaluate(() => chrome.action.getBadgeText({}));
  check("popup: okuma başarısız + veri eski → 'okunamadı', eski yüzde yok; rozet '?'", /Kullanım yüzdesi okunamadı/.test(popStale) && !/%87/.test(popStale) && !/5 saatlik oturum/.test(popStale) && badgeStale === "?", `rozet ${badgeStale} · ` + (popStale.match(/.*okunamadı.*/) || [""])[0]);
  await page.bringToFront(); await page.waitForTimeout(700);
  check("panel: kullanım okunamadı uyarısı", /Kullanım yüzdesi okunamadı/.test(await cardText()));
  state.usageFail = false;
  await pop.bringToFront(); await pop.click("#refresh"); await pop.waitForTimeout(1500);
  const popBack = await pop.evaluate(() => document.body.innerText);
  check("okuma düzelince sayılar ve rozet geri geldi", /5 saatlik oturum/.test(popBack) && !/Kullanım yüzdesi okunamadı/.test(popBack) && /^\d+$/.test(await sw.evaluate(() => chrome.action.getBadgeText({}))), await sw.evaluate(() => chrome.action.getBadgeText({})));

  // 12) Denetim: kalibrasyon verisi sessizce silinmez
  const calNow = (await storage("calib")).calib;
  await sw.evaluate((c) => chrome.storage.local.set({ calib: { ...c, version: 99 } }), calNow);
  await pop.evaluate(() => chrome.runtime.sendMessage({ type: "calib:observe", list: [{ at: Date.now(), tier: "claude_pro", window: "session", delta: 1, cost: 50000, predicted: { low: 0.5, mid: 1, high: 3 }, type: "explain", outTokens: 400, outMuNoAdj: 6, model: "opus 5.5" }] }));
  const cb = await storage(["calib", "calibBackup"]);
  check("daha yeni sürümün kalibrasyonu silinmedi: yedeğe alındı", cb.calibBackup?.version === 99 && cb.calibBackup?.data?.stats?.n === calNow.stats.n && cb.calib?.version === 1 && cb.calib?.stats?.n === 1, JSON.stringify({ yedek: cb.calibBackup?.data?.stats, yeni: cb.calib?.stats }));
  await sw.evaluate((c) => chrome.storage.local.set({ calib: c }).then(() => chrome.storage.local.remove("calibBackup")), calNow);
  // 0.9.1 kodunun ürettiği durum yedek dosyası olarak içe aktarılabiliyor
  const fx091 = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "calib-0.9.1.json"), "utf8"));
  fs.writeFileSync(path.join(OUT, "yedek-0.9.1.json"), JSON.stringify({ format: "token-forecast-backup", formatVersion: 1, extVersion: "0.9.1", exportedAt: "2026-10-21T10:00:00.000Z", calib: fx091.state }));
  await pop.evaluate(() => (document.getElementById("settings").open = true));
  await pop.setInputFiles("#importFile", path.join(OUT, "yedek-0.9.1.json"));
  await pop.waitForTimeout(400);
  await pop.click("#import");
  await pop.waitForTimeout(800);
  const imp = (await storage("calib")).calib;
  check("0.9.1 yedeği içe aktarıldı: ölçümler ve öğrenilen k korundu", imp?.stats?.n === fx091.state.stats.n && imp?.log?.length === fx091.state.log.length && imp?.k?.claude_max_5x?.session?.n === fx091.state.k.claude_max_5x.session.n, JSON.stringify(imp?.stats));
  await sw.evaluate((c) => chrome.storage.local.set({ calib: c }), calNow);

  // 13) Denetim: eklenti sayfaları CSP ile yalnızca claude.ai'ye bağlanabilir; dışa aktarma çalışır
  const blocked = await pop.evaluate(() => fetch("https://example.com/tf-denetim").then(() => "gitti", () => "engellendi"));
  const blockedSw = await sw.evaluate(() => fetch("https://example.com/tf-denetim-sw").then(() => "gitti", () => "engellendi"));
  check("CSP: popup ve arka plan başka alan adına bağlanamıyor", blocked === "engellendi" && blockedSw === "engellendi" && !netLog.some((r) => /example\.com/.test(r.u)), `popup ${blocked} · arka plan ${blockedSw}`);
  const [dl] = await Promise.all([pop.waitForEvent("download", { timeout: 8000 }).catch(() => null), pop.click("#export")]);
  let exported = "";
  if (dl) { try { exported = fs.readFileSync(await dl.path(), "utf8"); } catch (_) {} }
  check("dışa aktarma: yedek dosyası iniyor, içinde mesaj metni yok", !!dl && /^token-tahmini-.*\.json$/.test(dl.suggestedFilename()) && /"token-forecast-backup"/.test(exported) && !SENTINELS.some((x) => exported.includes(x)), dl ? dl.suggestedFilename() : "indirme yok");
  const wel2 = await ctx.newPage();
  const welErr = [];
  wel2.on("pageerror", (e) => welErr.push(String(e))); wel2.on("console", (m) => { if (m.type() === "error") welErr.push(m.text()); });
  await wel2.goto(`chrome-extension://${extId}/popup/welcome.html`);
  await wel2.waitForSelector("#welTitle:not(:empty)", { timeout: 5000 }).catch(() => {});
  const welTxt = await wel2.evaluate(() => document.body.innerText);
  check("onay sayfası CSP altında hatasız; saklanan kimlikler ve okunan cevaplar yazıyor", welErr.length === 0 && /kuruluş kimliği/.test(welTxt) && /Claude'un cevapları/.test(welTxt) && /plan türünü/.test(welTxt), welErr[0] || welTxt.split("\n")[0]);
  await wel2.screenshot({ path: path.join(OUT, "10-onay-sayfasi.png"), fullPage: true });
  await wel2.close();

  // 14) Gizlilik: yazılan hiçbir metin ağda (sayfanın kendi gönderimi dışında) ya da depoda yok
  const allStore = await sw.evaluate(() => chrome.storage.local.get(null));
  const storeJson = JSON.stringify(allStore);
  const inStore = SENTINELS.filter((x) => storeJson.includes(x));
  check("depo: hiçbir anahtarda mesaj metni, cevap metni ya da dosya adı yok", inStore.length === 0, inStore.join(","));
  const KNOWN_KEYS = ["settings", "calib", "consent", "usage", "usageHist", "usageMeta", "orgId", "tier", "notified", "sends", "trace", "hookHello", "lastSend", "lastDone", "pageHealth", "convActivity", "recPrefs", "learnPersonal", "learnFixes", "lastContext", "pillOffset", "eco", "tikoPark", "tikoHintSeen"];
  const unknownKeys = Object.keys(allStore).filter((k) => !KNOWN_KEYS.includes(k));
  check("depo: yalnızca bilinen anahtarlar, toplam 1 MB altında", unknownKeys.length === 0 && storeJson.length < 1e6, `${unknownKeys.join(",")} ${Math.round(storeJson.length / 1024)} KB`);
  check("depo: storage.sync ve storage.session boş (hiçbir şey hesaba eşitlenmiyor)", Object.keys(await sw.evaluate(() => chrome.storage.sync.get(null))).length === 0 && Object.keys(await sw.evaluate(() => chrome.storage.session.get(null))).length === 0);
  check("ağ: WebSocket açılmadı", wsLog.length === 0, wsLog.join(","));

  // Gizlilik / "Claude kullanmıyor" denetimi: dışarı giden her istek
  const ext = netLog.filter((r) => !r.u.startsWith("chrome-extension://") && !r.u.startsWith("data:") && !r.u.startsWith("blob:"));
  // İçerik denetimi: adreste ya da gövdede yazılan metinlerden biri var mı? (yalnızca sayfanın kendi /completion gövdesi içerebilir)
  const dec = (s) => { try { return decodeURIComponent(s); } catch (_) { return s; } };
  const leaks = ext.filter((r) => SENTINELS.some((x) => dec(r.u).includes(x) || (!(r.m === "POST" && /\/completion(\?|$)/.test(r.u)) && (r.b || "").includes(x))));
  check("ağ: hiçbir adreste ya da eklenti isteğinde mesaj metni / dosya adı yok", leaks.length === 0 && ext.some((r) => (r.b || "").includes("debounces another")), leaks.slice(0, 3).map((r) => r.m + " " + r.u.slice(0, 80)).join(" | "));
  const gets = ext.filter((r) => r.m === "GET" && /claude\.ai\/api\//.test(r.u)).map((r) => new URL(r.u).pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ":id"));
  const getKinds = [...new Set(gets)].sort();
  check("ağ: eklentinin okuduğu uç noktalar yalnızca kuruluş, kullanım ve açık sohbet", getKinds.every((p) => ["/api/organizations", "/api/organizations/org1/usage", "/api/organizations/org1/chat_conversations/:id"].includes(p)), getKinds.join(" , "));
  const hosts = [...new Set(ext.map((r) => new URL(r.u).host))];
  check("ağ: yalnızca claude.ai'ye istek gitti", hosts.every((h) => h === "claude.ai"), hosts.join(","));
  const posts = ext.filter((r) => r.m !== "GET");
  check("ağ: POST yalnızca sayfanın kendi mesaj gönderimi (/completion)", posts.every((r) => /\/completion(\?|$)/.test(r.u)), posts.filter((r) => !/\/completion/.test(r.u)).map((r) => r.m + " " + r.u).join(" | "));
  console.log("  ağ özeti:", hosts.join(","), "· GET", ext.length - posts.length, "· POST", posts.length);
  check("konsolda hata yok", ours.length === 0, ours.slice(0, 3).join(" | "));

  await ctx.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} kontrol geçti`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
