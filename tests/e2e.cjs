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
  const res = await fetch('/api/organizations/org1/chat_conversations/${CONV}/completion', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({prompt: ed.innerText, attachments: [], files: []})});
  const reader = res.body.getReader(); let txt='';
  for(;;){ const {value,done} = await reader.read(); if (done) break; txt += new TextDecoder().decode(value); }
  ed.innerText=''; document.title='done:'+txt.length;
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
      // Gerçekte kullanım cevap üretildikten sonra artar: önce bekle, sonra artır
      await new Promise((r) => setTimeout(r, 600));
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
  // Arka plan servisinin isteklerini Playwright yakalayamaz: fetch'i sahte API ile değiştir
  const patchSw = () => sw.evaluate(({ now, u5, u7 }) => {
    self.__mock = { u5, u7 };
    self.fetch = async (url) => {
      const p = new URL(String(url)).pathname;
      const body = p === "/api/organizations" ? [{ uuid: "org1", capabilities: ["chat", "claude_pro"] }]
        : p.endsWith("/usage") ? { five_hour: { utilization: self.__mock.u5, resets_at: new Date(now + 3 * 3600e3).toISOString() }, seven_day: { utilization: self.__mock.u7, resets_at: new Date(now + 3 * 86400e3).toISOString() } }
        : {};
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    };
  }, { now, u5: state.usage5h, u7: state.usage7d });
  await patchSw();

  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`https://claude.ai/chat/${CONV}`);
  const host = page.locator("[data-token-forecast]");
  await page.waitForFunction(() => document.querySelector("[data-token-forecast]")?.shadowRoot?.querySelector(".head")?.textContent, null, { timeout: 15000 });
  const head = () => page.evaluate(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".head").textContent);
  const cardText = () => page.evaluate(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".card").innerText);
  check("panel boşta görünüyor", (await head()).length > 0, await head());

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
  check("geçmiş sohbet API'sinden okundu (2 mesaj, önbellek aktif)", /2 mesaj/.test(last) && /aktif/.test(last));

  // 2) Paneli aç, ekran görüntüsü
  await page.evaluate(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".pill").click());
  check("rozet uyarı yokken gizli", await page.evaluate(() => getComputedStyle(document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".badge")).display === "none"));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "1-panel-acik.png") });

  // 2b) "Ayrıntılar ve ayarlar" düğmesi tam sayfayı yeni sekmede açar
  const [detailsTab] = await Promise.all([
    ctx.waitForEvent("page", { timeout: 5000 }).catch(() => null),
    page.evaluate(() => document.querySelector("[data-token-forecast]").shadowRoot.querySelector("button.more").click())
  ]);
  if (detailsTab) await detailsTab.waitForLoadState();
  check("'Ayrıntılar ve ayarlar' tam sayfayı açıyor", detailsTab && detailsTab.url().includes("popup/popup.html?view=tab"), detailsTab?.url());
  if (detailsTab) {
    await detailsTab.waitForTimeout(800);
    check("tam sayfa: ayarlar açık, başlık doğru", await detailsTab.evaluate(() => document.getElementById("settings").open && document.title.includes("Token")));
    await detailsTab.setViewportSize({ width: 1100, height: 900 });
    await detailsTab.screenshot({ path: path.join(OUT, "5-ayrintilar-sayfasi.png"), fullPage: true });
    // ikinci tıklama yeni sekme açmamalı, mevcut olana geçmeli
    const before = ctx.pages().length;
    await page.bringToFront();
    await page.evaluate(() => { const r = document.querySelector("[data-token-forecast]").shadowRoot; r.querySelector(".pill").click(); r.querySelector("button.more").click(); });
    await page.waitForTimeout(800);
    check("ikinci tıklamada yeni sekme açılmıyor", ctx.pages().length === before, `${before} → ${ctx.pages().length}`);
    await detailsTab.close();
    await page.bringToFront();
  }

  // 3) Çeviri → Haiku önerisi
  await ed.click(); await page.keyboard.press("Control+A"); await page.keyboard.press("Backspace");
  await page.keyboard.type("Bu cümleyi İngilizceye çevir: Yarın toplantıya katılamayacağım.");
  await page.waitForTimeout(700);
  const t2 = await cardText();
  check("çeviride Haiku önerisi", /Haiku 5\.5/.test(t2), (t2.match(/.*Haiku.*/) || [""])[0].slice(0, 120));

  // 4) Görsel ekle
  fs.writeFileSync(path.join(OUT, "img.png"), pngOf(1000, 1000));
  await page.setInputFiles("#file", path.join(OUT, "img.png"));
  await page.waitForTimeout(800);
  const t3 = await cardText();
  check("görsel ek tokenı hesaplandı (1000×1000 → 1.296)", /Ekler/.test(t3) && /1\.296/.test(t3), (t3.match(/Ekler.*\n?.*/) || [""])[0].replace(/\n/g, " "));

  // 5) Gönder → akış → kalibrasyon
  await page.click("#send");
  await page.waitForFunction(() => document.title.startsWith("done:"), null, { timeout: 10000 });
  await page.waitForTimeout(2500);
  const st = await storage(["calib", "usage", "usageMeta", "convActivity", "tier"]);
  check("tamamlama isteği orijinal haliyle gitti", state.completions === 1 && /İngilizceye/.test(state.lastPrompt || ""));
  check("akıştan kullanım birleştirildi (%20)", st.usage?.fiveHour?.pct === 20 && st.usageMeta?.source === "stream", JSON.stringify(st.usage?.fiveHour));
  check("plan tespiti: Pro", st.tier === "claude_pro");
  const log = st.calib?.log || [];
  check("kalibrasyon gözlemi kaydedildi", log.length >= 1 && log.at(-1).delta === 1 && log.at(-1).accepted, JSON.stringify(log.at(-1)));
  check("sohbet etkinliği kaydedildi", !!st.convActivity?.[CONV]);

  // 6) Eşik bildirimi: kullanım %80'e çıksın
  state.usage5h = 80;
  await sw.evaluate((v) => { self.__mock.u5 = v; }, 80);
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
  await pop.setViewportSize({ width: 340, height: 720 });
  await pop.evaluate(() => (document.getElementById("settings").open = true));
  await pop.screenshot({ path: path.join(OUT, "2-popup.png"), fullPage: true });

  // 7) Dil değişimi → İngilizce panel
  await pop.selectOption("#lang", "en");
  await page.waitForTimeout(800);
  await page.bringToFront();
  await ed.click(); await page.keyboard.type("Hello there");
  await page.waitForTimeout(700);
  const t4 = await cardText();
  check("dil İngilizceye geçti", /This message will use/.test(t4), t4.split("\n")[1]);
  await page.screenshot({ path: path.join(OUT, "3-panel-en.png") });
  // Uyarı durumu: limit neredeyse dolu + uzun, kapsamlı bir istek → sığmaz uyarısı
  await pop.selectOption("#lang", "tr"); await page.waitForTimeout(500);
  await sw.evaluate(() => chrome.storage.local.set({ usage: { fiveHour: { key: "five_hour", pct: 99.6, resetsAt: Date.now() + 47 * 60000 }, sevenDay: { key: "seven_day", pct: 40, resetsAt: Date.now() + 3 * 864e5 }, extras: [], bottleneck: "five_hour" } }));
  await ed.click(); await page.keyboard.press("Control+A"); await page.keyboard.press("Backspace");
  await page.keyboard.type("Bana kapsamlı ve detaylı bir pazar araştırması yap, 2026 fiyatlarını karşılaştır, adım adım rapor hazırla");
  await page.waitForTimeout(800);
  const t5 = await cardText();
  check("limit dolarken 'sığmaz' uyarısı", /sığma/.test(t5), (t5.match(/.*sığma.*/) || [""])[0].slice(0, 140));
  check("rozette uyarı sayısı", await page.evaluate(() => !document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".badge").hidden));
  await page.screenshot({ path: path.join(OUT, "4-panel-uyari.png") });
  await pop.selectOption("#lang", "auto");

  // 8) Rozet
  const badge = await sw.evaluate(() => chrome.action.getBadgeText({}));
  check("araç çubuğu rozeti", badge === "80", badge);

  // 9) Hata yok
  const ours = errors.filter((e) => !/favicon/.test(e));
  check("konsolda hata yok", ours.length === 0, ours.slice(0, 3).join(" | "));

  await ctx.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} kontrol geçti`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
