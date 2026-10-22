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


// Site için ekran görüntüleri (TR + EN): eklentiyi gerçek haliyle sahte claude.ai sayfasında çalıştırır.
// Çıktı: ../site/img/{tr,en}/{oneri,effort,tuzak,popup,rapor}.png
const LANGS = (process.env.LANGS || "tr,en").split(",");
const SITE = path.resolve(__dirname, "../site/img");
const T = {
  tr: { explain: "Kuantum dolanıklık nedir, basitçe anlat", translate: "Bu cümleyi İngilizceye çevir: Yarın toplantıya katılamayacağım.",
        trap: "Bir site yaptırmam lazım, bu zor bir iş. Sitede çeviri sistemi de olacak, TR ve EN.", eff: { max: "Maksimum", med: "Orta" }, user: "Merhaba, kuantum tünellemeyi anlatır mısın?" },
  en: { explain: "What is quantum entanglement, explain simply", translate: "Translate this sentence into Turkish: I can't make tomorrow's meeting.",
        trap: "I need a website built, which is a hard job. The site will also have a translation system, Turkish and English.", eff: { max: "Max", med: "Medium" }, user: "Hi, can you explain quantum tunneling?" }
};

async function seed(sw, lang) {
  const { observe, emptyState, makeCalib } = await import("../extension/lib/calibrate.js");
  const { kPrior, forecastMessage, outputPrior, realizedCost } = await import("../extension/lib/forecast.js");
  let seed = 3; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const tier = "claude_pro", prior = kPrior(tier, "session"), trueK = Math.exp(prior.mu + 0.95);
  const H = 3600e3, D = 24 * H;
  let st = emptyState(), cum = 20;
  const sends = [];
  const types = ["explain", "code_fix", "translate", "math", "writing", "short_qa", "code_write"];
  const doms = { explain: ["science", "physics"], code_fix: ["software", "web"], translate: ["language", "translation"], math: ["math", "pure"], writing: ["academic", "paper"], short_qa: ["daily", "food"], code_write: ["software", "web"] };
  const zero = { outputAdjust: () => ({ mean: 0, sd: 0 }) };
  for (let i = 0; i < 120; i++) {
    const type = types[Math.floor(rnd() * types.length)];
    const prompt = Math.max(10, Math.round(Math.exp(4.4 + 0.8 * gauss())));
    const cls = { type, complexity: 0.2, lengthHint: 1, confidence: "high", signals: [] };
    const inp = { promptTokens: { low: prompt * .8, mid: prompt, high: prompt * 1.25 }, attachmentTokens: { low: 0, mid: 0, high: 0 }, history: { messages: 0 }, model: "Sonnet 5.5", effort: "Orta", tier, cls, memoryOn: true };
    const fc = forecastMessage({ ...inp, calib: makeCalib(st) }, { samples: 300 });
    const base = outputPrior(cls, { promptTokens: inp.promptTokens, attachmentTokens: inp.attachmentTokens }, zero);
    const out = Math.exp(base.mu + 0.5 + 0.6 * gauss());
    const cost = realizedCost({ weight: fc.weight, newInput: prompt, history: 0, cold: false, outTokens: out, effort: fc.effort });
    const truePct = trueK * cost * Math.exp(0.25 * gauss());
    const before = Math.floor(cum); cum += truePct;
    const d = Math.floor(cum) - before; if (cum > 100) cum -= 80;
    st = observe(st, { at: Date.now() - (120 - i) * 3 * H, tier, window: "session", delta: d, cost, predicted: fc.pct.session, type, outTokens: out, outMuNoAdj: base.mu }).state;
    const at = Date.now() - (120 - i) * 3.5 * H;
    sends.push({ id: "s" + i, at, conv: "c" + (i % 6), fam: i % 5 === 0 ? "opus" : i % 3 === 0 ? "haiku" : "sonnet", model: i % 5 === 0 ? "opus 5.5" : "sonnet 5.5", type, eff: i % 7 === 0 ? "max" : "medium",
      peak: new Date(at).getUTCHours() >= 12 && new Date(at).getUTCHours() < 18, cache: i % 9 === 0 ? "cold" : "warm", hist: i % 9 === 0 ? 60000 : 3000,
      pred: fc.pct.session.mid, predLo: fc.pct.session.low, predHi: fc.pct.session.high, predW: fc.pct.weekly.mid, adv: type === "translate" || type === "short_qa" ? { k: "save", t: "haiku" } : { k: "ok", t: "sonnet" },
      save: type === "translate" ? 0.4 : 0, d, outHi: 1500, dom: doms[type][0], sub: doms[type][1], effRec: i % 7 === 0 ? "medium" : "medium", effSave: i % 7 === 0 ? 0.35 : 0 });
  }
  await sw.evaluate((o) => chrome.storage.local.set(o), { calib: st, sends });
  return st;
}

(async () => {
  for (const lang of LANGS) {
    const tx = T[lang];
    const userDataDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "tfs-"));
    const ctx = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium", headless: true, locale: lang === "tr" ? "tr-TR" : "en-US", viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2,
      args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, `--lang=${lang === "tr" ? "tr-TR" : "en-US"}`]
    });
    state.usage5h = 64; state.usage7d = 17;
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
    for (let i = 0; i < 20 && !(await sw.evaluate(() => !!(self.chrome && chrome.storage)).catch(() => false)); i++) { await new Promise((r) => setTimeout(r, 300)); sw = ctx.serviceWorkers().find((w) => w.url().includes(extId)) || sw; }
    await sw.evaluate((l) => chrome.storage.local.get("settings").then(({ settings }) => chrome.storage.local.set({ settings: { ...settings, language: l } })), lang);
    await seed(sw, lang);
    const dir = path.join(SITE, lang); fs.mkdirSync(dir, { recursive: true });
    const page = await ctx.newPage();
    await page.goto(`https://claude.ai/chat/${CONV}`);
    await page.waitForFunction(() => document.querySelector("[data-token-forecast]")?.shadowRoot?.querySelector(".head")?.textContent, null, { timeout: 15000 });
    // Sayfa metni dile göre
    await page.evaluate(({ user, eff, med, lang }) => {
      document.querySelector('[data-testid="user-message"]').textContent = user;
      const btns = [...document.querySelectorAll("fieldset button")];
      btns[0].textContent = "Sonnet 5.5"; btns[1].textContent = eff; btns[2].textContent = lang === "tr" ? "Gönder" : "Send";
    }, { user: tx.user, eff: tx.eff.max, med: tx.eff.med, lang });
    const ed = page.locator(".ProseMirror");
    const sh = (fn) => page.evaluate(fn);
    const clipOf = async () => page.evaluate(() => {
      const root = document.querySelector("[data-token-forecast]").shadowRoot;
      const rs = [root.querySelector(".banner"), root.querySelector(".pill")].filter(Boolean).map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
      const x = Math.min(...rs.map((r) => r.left)), y = Math.min(...rs.map((r) => r.top)), x2 = Math.max(...rs.map((r) => r.right)), y2 = Math.max(...rs.map((r) => r.bottom));
      return { x: Math.max(0, x - 12), y: Math.max(0, y - 12), width: x2 - x + 24, height: y2 - y + 24 };
    });
    const type = async (text) => { await ed.click(); await page.keyboard.press("Control+A"); await page.keyboard.press("Backspace"); await page.keyboard.type(text); await page.waitForTimeout(1100); };
    const click = (sel) => page.evaluate((s) => document.querySelector("[data-token-forecast]").shadowRoot.querySelector(s)?.click(), sel);

    // 1) Çeviri → Haiku, "Neden?" açık (alan satırı dahil). Model Sonnet.
    await type(tx.translate); await click('.banner button[data-act="why"]'); await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(dir, "oneri.png"), clip: await clipOf() });
    await click('.banner button[data-act="hide"]');
    // 2) Effort önerisi (Max → Medium)
    await page.evaluate(() => { const b = [...document.querySelectorAll("fieldset button")]; b[0].textContent = "Sonnet 5.5"; });
    await type(tx.explain); await click('.banner button[data-act="why"]'); await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(dir, "effort.png"), clip: await clipOf() });
    // 3) Tuzak: "çeviri" geçen büyük iş → Haiku önerilmez
    await page.evaluate((m) => { const b = [...document.querySelectorAll("fieldset button")]; b[1].textContent = m; }, tx.eff.med);
    await type(tx.trap); await click('.banner button[data-act="why"]'); await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(dir, "tuzak.png"), clip: await clipOf() });
    // 4) Popup
    const pop = await ctx.newPage();
    await pop.setViewportSize({ width: 340, height: 720 });
    await pop.goto(`chrome-extension://${extId}/popup/popup.html`);
    await pop.waitForTimeout(1500);
    await pop.screenshot({ path: path.join(dir, "popup.png"), fullPage: true });
    // 5) Rapor
    const rp = await ctx.newPage();
    await rp.setViewportSize({ width: 920, height: 1300 });
    await rp.goto(`chrome-extension://${extId}/popup/report.html`);
    await rp.waitForTimeout(1200);
    await rp.screenshot({ path: path.join(dir, "rapor.png"), fullPage: true });
    await ctx.close();
    console.log("tamam", lang);
  }
})().catch((e) => { console.error(e); process.exit(1); });
