// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Performans ölçümü (test değil, ölçüm): uzun sohbette eklentinin sayfaya kattığı iş.
// Sahte claude.ai, N mesajlık sohbet. Senaryolar:
//   yok     : eklenti yüklü değil (sayfanın kendi maliyeti)
//   onaysiz : eklenti yüklü, onay verilmemiş (yalnızca "aç" düğmesi)
//   api     : onaylı, sohbet geçmişi claude.ai API'sinden okunuyor (olağan yol)
//   dom     : onaylı, sohbet API'si bozuk → geçmiş sayfadan okunuyor (yedek yol)
// Ölçü: Chrome'un Performance.getMetrics değerleri (ScriptDuration, TaskDuration; sayfa sürecinin
// tamamı, içerik betiği dahil). Boşta 10 sn ve 120 tuş vuruşu (40 ms arayla).
// Çalıştır: node tests/perf.cjs [mesaj sayısı...]   (varsayılan: 60 600)
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS ||= "1";
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const os = require("os");

const EXT = path.resolve(__dirname, "../extension");
const CONV = "0b1c2d3e-0000-4000-8000-123456789abc";
const now = Date.now();
const SIZES = process.argv.slice(2).map(Number).filter((n) => n > 0);
const KEYS = 120, KEY_DELAY = 40, IDLE_MS = 10000;

const PARA = "Kuantum tünelleme, bir parçacığın klasik olarak aşamayacağı bir enerji engelini geçebilmesidir. Bu olay dalga fonksiyonunun engelin içinde sıfıra inmemesinden kaynaklanır. ";
function pageHtml(n) {
  // claude.ai'ye benzer derinlik: her mesaj birkaç sarmalayıcı içinde, cevaplar paragraflı
  const msgs = [];
  for (let i = 0; i < n; i++) {
    const user = i % 2 === 0;
    const body = user ? `<p>Soru ${i}: ${PARA.slice(0, 120)}</p>` : `<p>${PARA}</p><p>${PARA}</p><ul><li>${PARA.slice(0, 80)}</li><li>${PARA.slice(0, 90)}</li></ul><p>${PARA}</p>`;
    const inner = user ? `<div data-testid="user-message">${body}</div>` : `<div data-is-streaming="false"><div class="font-claude-response">${body}</div></div>`;
    msgs.push(`<div class="turn"><div class="w1"><div class="w2"><div class="w3">${inner}</div></div></div></div>`);
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>Claude</title>
<style>body{font-family:sans-serif;margin:0;background:#faf9f5} main{max-width:760px;margin:0 auto;padding:20px 20px 220px}
fieldset{position:fixed;left:50%;transform:translateX(-50%);bottom:20px;width:720px;border:1px solid #ccc;border-radius:16px;background:#fff;padding:12px}
.ProseMirror{min-height:48px;outline:none} .bar{display:flex;gap:8px;margin-top:8px}</style></head><body>
<main><div class="thread">${msgs.join("\n")}</div></main>
<fieldset>
 <div class="ProseMirror" contenteditable="true" role="textbox"></div>
 <div class="bar"><input type="file" id="file" multiple><button type="button">Opus 5.5</button><button type="button">Orta</button><button type="button" id="send">Gönder</button></div>
</fieldset></body></html>`;
}
function convJson(n) {
  const chat_messages = [];
  let parent = "00000000-0000-4000-8000-000000000000";
  for (let i = 0; i < n; i++) {
    const uuid = `m${i}`, user = i % 2 === 0;
    chat_messages.push({ uuid, parent_message_uuid: parent, sender: user ? "human" : "assistant", content: [{ type: "text", text: user ? `Soru ${i}: ${PARA.slice(0, 120)}` : PARA.repeat(4) }], created_at: new Date(now - (n - i) * 60000).toISOString() });
    parent = uuid;
  }
  return { uuid: CONV, model: "claude-opus-5-5", current_leaf_message_uuid: parent, chat_messages };
}

async function run(n, mode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-perf-"));
  const args = mode === "yok" ? [] : [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`];
  const ctx = await chromium.launchPersistentContext(dir, { channel: "chromium", headless: true, locale: "tr-TR", viewport: { width: 1280, height: 860 }, args: [...args, "--lang=tr-TR"] });
  const html = pageHtml(n), conv = JSON.stringify(convJson(n));
  await ctx.route("https://claude.ai/**", (route) => {
    const u = new URL(route.request().url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body });
    if (u.pathname === "/api/organizations") return json(JSON.stringify([{ uuid: "org1", capabilities: ["chat", "claude_pro"] }]));
    if (u.pathname === "/api/organizations/org1/usage") return json(JSON.stringify({ five_hour: { utilization: 20, resets_at: new Date(now + 3 * 3600e3).toISOString() }, seven_day: { utilization: 10, resets_at: new Date(now + 3 * 86400e3).toISOString() } }));
    if (u.pathname.endsWith(`/chat_conversations/${CONV}`)) return mode === "dom" ? json("{}", 500) : json(conv);
    if (u.pathname.startsWith("/api/")) return json("{}");
    return route.fulfill({ status: 200, contentType: "text/html", body: html });
  });
  if (mode !== "yok") {
    const isOurs = (w) => /^chrome-extension:\/\/.*\/background\.js$/.test(w.url());
    const sw = ctx.serviceWorkers().find(isOurs) || await ctx.waitForEvent("serviceworker", { predicate: isOurs, timeout: 15000 });
    // Çalışan yeni başlarken bağlanılırsa genel nesne henüz hazır olmayabiliyor: hazır olana kadar dışarıdan bekle
    for (let i = 0; i < 100 && !(await sw.evaluate(() => !!globalThis.chrome?.storage?.local).catch(() => false)); i++) await new Promise((r) => setTimeout(r, 100));
    if (mode !== "onaysiz") await sw.evaluate(() => chrome.storage.local.set({ consent: { v: 2, at: Date.now() } }));
    for (const p of ctx.pages()) if (/welcome\.html/.test(p.url())) await p.close();
  }
  const page = await ctx.newPage();
  await page.goto(`https://claude.ai/chat/${CONV}`);
  if (mode === "api" || mode === "dom") await page.waitForFunction(() => document.querySelector("[data-token-forecast]")?.shadowRoot?.querySelector(".head")?.textContent, null, { timeout: 20000 });
  await page.waitForTimeout(3000);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Performance.enable");
  const m = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]));
  const d = (a, b, k) => (b[k] - a[k]) * 1000; // ms
  const m0 = await m(); const t0 = Date.now();
  await page.waitForTimeout(IDLE_MS);
  const m1 = await m(); const idleSec = (Date.now() - t0) / 1000;
  await page.locator(".ProseMirror").click();
  const t1 = Date.now();
  await page.keyboard.type("Kuantum dolanıklık nedir ve kuantum bilgisayarlarda nasıl kullanılır? Basit örneklerle anlatır mısın lütfen ".repeat(2).slice(0, KEYS), { delay: KEY_DELAY });
  await page.waitForTimeout(1500);
  const m2 = await m(); const typeSec = (Date.now() - t1) / 1000;
  const head = await page.evaluate(() => document.querySelector("[data-token-forecast]")?.shadowRoot?.querySelector(".head")?.textContent || "-");
  await ctx.close();
  const idleScript = d(m0, m1, "ScriptDuration") / idleSec, idleTask = d(m0, m1, "TaskDuration") / idleSec;
  const typeScript = d(m1, m2, "ScriptDuration"), typeTask = d(m1, m2, "TaskDuration");
  return { n, mode, head,
    idleScriptMsPerSec: idleScript, idleTaskMsPerSec: idleTask,
    perKeyScriptMs: (typeScript - idleScript * typeSec) / KEYS, perKeyTaskMs: (typeTask - idleTask * typeSec) / KEYS };
}

(async () => {
  const rows = [];
  for (const n of SIZES.length ? SIZES : [60, 600]) for (const mode of ["yok", "onaysiz", "api", "dom"]) {
    const r = await run(n, mode); rows.push(r);
    const f = (x) => x.toFixed(2).padStart(7);
    console.log(`${String(n).padStart(4)} mesaj  ${mode.padEnd(8)} boşta betik ${f(r.idleScriptMsPerSec)} ms/sn  görev ${f(r.idleTaskMsPerSec)} ms/sn · tuş başı betik ${f(r.perKeyScriptMs)} ms  görev ${f(r.perKeyTaskMs)} ms · hap: ${r.head}`);
  }
  if (process.env.PERF_JSON) fs.writeFileSync(process.env.PERF_JSON, JSON.stringify(rows, null, 1));
})();
