// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Uçtan uca test: eklentiyi Chromium'a yükler, claude.ai'yi taklit eden sahte bir sayfa ve
// sahte API ile çalıştırır. Çalıştır: node e2e.cjs
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const zlib = require("zlib");

const EXT = path.resolve(__dirname, "../extension");
const OUT = path.resolve(__dirname, "shots");
fs.mkdirSync(OUT, { recursive: true });
const CONV = "0b1c2d3e-0000-4000-8000-123456789abc";
const now = Date.now();
const state = { usage5h: 19, usage7d: 17, completions: 0, lastPrompt: null };

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
  ctx.on("request", (r) => netLog.push({ m: r.method(), u: r.url() }));
  await ctx.route("https://claude.ai/**", async (route) => {
    const req = route.request(); const u = new URL(req.url());
    const json = (o) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(o) });
    if (u.pathname === "/api/organizations") return json([{ uuid: "org1", capabilities: ["chat", "claude_pro"], rate_limit_tier: "default_claude_ai" }]);
    if (u.pathname === "/api/organizations/org1/usage") return json({ five_hour: { utilization: state.usage5h, resets_at: new Date(now + 3 * 3600e3).toISOString() }, seven_day: { utilization: state.usage7d, resets_at: new Date(now + 3 * 86400e3).toISOString() }, seven_day_opus: null });
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

  // 9) Hata yok
  const ours = errors.filter((e) => !/favicon/.test(e));
  // Gizlilik / "Claude kullanmıyor" denetimi: dışarı giden her istek
  const ext = netLog.filter((r) => !r.u.startsWith("chrome-extension://") && !r.u.startsWith("data:") && !r.u.startsWith("blob:"));
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
