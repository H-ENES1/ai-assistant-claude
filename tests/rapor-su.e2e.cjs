// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// "Kurtardığın su ve enerji" uçtan uca testi:
//  A) Rapor bölümü: küçük / orta / büyük tasarruf, sıfır, negatif, sayım yok; animasyon ve hareket azaltma;
//     taşma yok; koyu tema; İngilizce; CSV sütunları. Ekran görüntüleri tests/shots/rapor-su/ altına.
//  B) Sahte claude.ai'de gerçek akış: öneriyi uygula → gönder → kayıtta kaçınılan işlem; ağır modele geç → negatif.
// Çalıştır: node rapor-su.e2e.cjs   (npm run e2e içinde de çalışır)
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS ||= "1";
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const EXT = path.resolve(__dirname, "../extension");
const OUT = path.resolve(__dirname, "shots/rapor-su");
fs.mkdirSync(OUT, { recursive: true });
const CONV = "0b1c2d3e-0000-4000-8000-123456789abc";
const now = Date.now();
const H = 3600e3, D = 24 * H;
const state = { usage5h: 19, usage7d: 17 };

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
 <div class="bar"><button type="button" id="model">Opus 5.5</button><button type="button" id="effort">Orta</button><button type="button" id="send">Gönder</button></div>
</fieldset>
<script>
document.getElementById('send').onclick = async () => {
  const ed = document.querySelector('.ProseMirror');
  const m = document.querySelector('main'); const u = document.createElement('div'); u.setAttribute('data-testid','user-message'); u.textContent = ed.innerText; m.append(u);
  const res = await fetch('/api/organizations/org1/chat_conversations/${CONV}/completion', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({prompt: ed.innerText, attachments: [], files: []})});
  const reader = res.body.getReader(); let txt='';
  for(;;){ const {value,done} = await reader.read(); if (done) break; txt += new TextDecoder().decode(value); }
  ed.innerText=''; const a = document.createElement('div'); a.className='font-claude-response'; a.setAttribute('data-is-streaming','false'); a.textContent='cevap'; m.append(a);
  window.__sent = (window.__sent || 0) + 1;
};
</script></body></html>`;

function sse(text, util5h, util7d) {
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}      \n\n`;
  const resets5 = Math.floor((now + 3 * 3600e3) / 1000), resets7 = Math.floor((now + 3 * 86400e3) / 1000);
  return ev("message_start", { message: { uuid: "m2", model: "claude-opus-5-5" } }) +
    ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } }) +
    text.match(/.{1,40}/gs).map((t) => ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: t } })).join("") +
    ev("content_block_stop", { index: 0 }) +
    ev("message_delta", { delta: { stop_reason: "end_turn" } }) +
    ev("message_limit", { message_limit: { type: "within_limit", windows: { "5h": { status: "within_limit", resets_at: resets5, utilization: util5h / 100 }, "7d": { status: "within_limit", resets_at: resets7, utilization: util7d / 100 } } } }) +
    ev("message_stop", {});
}

const results = [];
const check = (name, ok, info = "") => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? "✓" : "✗"} ${name}${info ? " — " + info : ""}`); };

// Haftanın sıradan gönderimleri (rapor en az 3 mesaj ister). eco alanı yok: "sayılmamış" eski kayıt gibi davranır.
function baseSends() {
  const list = [];
  for (let i = 0; i < 12; i++) list.push({ id: "b" + i, at: now - (i + 1) * 11 * H, conv: "c" + (i % 4), fam: i % 3 ? "opus" : "sonnet", model: i % 3 ? "opus 5.5" : "sonnet 5.5",
    type: ["explain", "code_fix", "translate", "math"][i % 4], eff: "medium", peak: i % 2 === 0, cache: "warm", hist: 3000,
    pred: 1 + (i % 4), predLo: 0.4, predHi: 3 + (i % 4), predW: 0.1, adv: { k: "ok", t: "opus" }, save: 0, d: i % 2 ? 2 : null, outHi: 1200,
    dom: ["science", "software", "language", "math"][i % 4], sub: ["physics", "web", "translation", "pure"][i % 4], effRec: "medium", effSave: 0 });
  return list;
}
const eco = (i, u, k = "model") => ({ id: "e" + i + "_" + u, at: now - (i + 1) * 5 * H, conv: "e", fam: "sonnet", model: "sonnet 5.5", type: "explain", eff: "medium", peak: false, cache: "warm", hist: 2000,
  pred: 1, predLo: 0.4, predHi: 2, predW: 0.1, adv: { k: "ok", t: "sonnet" }, save: 0, d: 1, outHi: 1200, dom: "science", sub: "physics", effRec: "medium", effSave: 0, ecoU: u, ...(u ? { ecoK: k } : {}) });
const total = (o) => ({ v: 1, since: now - 40 * D, n: 60, gainU: 0, gainN: 0, extraU: 0, extraN: 0, ...o });
// Üç örnek durum (tests/eco.test.mjs aynı büyüklükleri dener)
const SCEN = {
  kucuk: { sends: [eco(0, 7300)], eco: total({ since: now - 3 * D, n: 9, gainU: 7300, gainN: 1 }) },
  orta: { sends: [...Array.from({ length: 12 }, (_, i) => eco(i, i < 2 ? 260000 : 24000, i % 3 ? "model" : "effort")), eco(13, -40000), eco(14, -20000, "effort")], eco: total({ gainU: 2_700_000, gainN: 41, extraU: 100_000, extraN: 5 }) },
  buyuk: { sends: Array.from({ length: 20 }, (_, i) => eco(i, 2_000_000, i % 2 ? "model" : "both")), eco: total({ since: now - 200 * D, n: 900, gainU: 300_000_000, gainN: 310, extraU: 1_000_000, extraN: 12 }) },
  sifir: { sends: [eco(0, 0), eco(1, 0), eco(2, 5000), eco(3, -5000)], eco: total({ n: 4, gainU: 5000, gainN: 1, extraU: 5000, extraN: 1 }) },
  negatif: { sends: [eco(0, 24000), eco(1, -180000), eco(2, -90000, "effort"), eco(3, -60000)], eco: total({ n: 30, gainU: 24000, gainN: 1, extraU: 330000, extraN: 3 }) },
  sayimYok: { sends: [], eco: null }
};

(async () => {
  const userDataDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "tf-su-"));
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium", headless: true, locale: "tr-TR", viewport: { width: 1000, height: 1300 }, acceptDownloads: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, "--lang=tr-TR"]
  });
  const errors = [];
  await ctx.route("https://claude.ai/**", async (route) => {
    const req = route.request(); const u = new URL(req.url());
    const json = (o) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(o) });
    if (u.pathname === "/api/organizations") return json([{ uuid: "org1", capabilities: ["chat", "claude_pro"], rate_limit_tier: "default_claude_ai" }]);
    if (u.pathname === "/api/organizations/org1/usage") return json({ five_hour: { utilization: state.usage5h, resets_at: new Date(now + 3 * 3600e3).toISOString() }, seven_day: { utilization: state.usage7d, resets_at: new Date(now + 3 * 86400e3).toISOString() } });
    if (u.pathname.endsWith(`/chat_conversations/${CONV}`)) return json({
      uuid: CONV, model: "claude-opus-5-5", current_leaf_message_uuid: "m1",
      chat_messages: [
        { uuid: "h1", parent_message_uuid: "00000000-0000-4000-8000-000000000000", sender: "human", content: [{ type: "text", text: "Merhaba, kuantum tünellemeyi anlatır mısın?" }], created_at: new Date(now - 10 * 60000).toISOString() },
        { uuid: "m1", parent_message_uuid: "h1", sender: "assistant", content: [{ type: "text", text: "Tabii! Kuantum tünelleme, bir parçacığın klasik olarak aşamayacağı bir enerji engelini geçebilmesidir. ".repeat(12) }], created_at: new Date(now - 9 * 60000).toISOString() }
      ]
    });
    if (u.pathname.endsWith("/completion") && req.method() === "POST") {
      state.usage5h += 1; state.usage7d += 0.1;
      return route.fulfill({ status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" }, body: sse("Elbette! İşte cevap: ".repeat(20), state.usage5h, state.usage7d) });
    }
    if (u.pathname.startsWith("/api/")) return json({});
    return route.fulfill({ status: 200, contentType: "text/html", body: PAGE });
  });

  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent("serviceworker", { timeout: 15000 });
  const extId = sw.url().split("/")[2];
  const storage = (keys) => sw.evaluate((k) => chrome.storage.local.get(k), keys);
  // Kurulumda karşılama sayfası açılır; servis hazır olunca onayı doğrudan yaz (onay akışını e2e.cjs dener)
  if (!ctx.pages().some((p) => p.url().includes("/popup/welcome.html"))) await ctx.waitForEvent("page", { predicate: (p) => p.url().includes("/popup/welcome.html"), timeout: 8000 }).catch(() => null);
  for (let i = 0; i < 40 && !(await sw.evaluate(() => !!globalThis.chrome?.storage?.local).catch(() => false)); i++) await new Promise((r) => setTimeout(r, 250));
  await sw.evaluate(() => chrome.storage.local.set({ consent: { v: 1, at: Date.now() } }));
  await new Promise((r) => setTimeout(r, 800));
  for (const p of ctx.pages()) if (p.url().includes("welcome.html")) await p.close().catch(() => {});

  // ---------- A) Rapor bölümü ----------
  const setScene = (name, lang = "auto") => sw.evaluate(async ({ sends, eco, lang }) => {
    const { settings } = await chrome.storage.local.get("settings");
    await chrome.storage.local.set({ sends, settings: { ...settings, language: lang } });
    if (eco) await chrome.storage.local.set({ eco }); else await chrome.storage.local.remove("eco");
  }, { sends: [...baseSends(), ...SCEN[name].sends].sort((a, b) => a.at - b.at), eco: SCEN[name].eco, lang });
  const openReport = async (opts = {}) => {
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push("rapor: " + e));
    p.on("console", (m) => { if (m.type() === "error") errors.push("rapor: " + m.text()); });
    await p.setViewportSize({ width: opts.width || 1000, height: 1300 });
    await p.emulateMedia({ reducedMotion: opts.reduce ? "reduce" : "no-preference", colorScheme: opts.dark ? "dark" : "light" });
    await p.goto(`chrome-extension://${extId}/popup/report.html`);
    await p.waitForSelector("#ecoTitle:not(:empty)");
    return p;
  };
  const read = (p) => p.evaluate(() => {
    const sec = document.getElementById("ecoSec");
    const cards = [...sec.querySelectorAll(".eco-card")].map((c) => ({ unit: c.dataset.unit, text: c.innerText.replace(/\n+/g, " | "), num: c.querySelector(".eco-num").textContent,
      over: c.scrollWidth > c.clientWidth + 1 || [...c.querySelectorAll(".eco-txt *")].some((x) => x.getBoundingClientRect().right > c.getBoundingClientRect().right + 1),
      drops: c.querySelectorAll(".dr").length, anim: c.querySelector(".eco-art").classList.contains("anim") }));
    return { state: sec.dataset.state, lead: document.getElementById("ecoLead").innerText, tag: document.getElementById("ecoTag").innerText, cards,
      total: document.getElementById("ecoTotal").hidden ? null : document.getElementById("ecoTotal").innerText.replace(/\n+/g, " | "),
      howOpen: document.getElementById("ecoHowBox").open, formula: document.getElementById("ecoFormula").textContent, assume: document.getElementById("ecoAssume").textContent,
      sources: document.getElementById("ecoSources").innerText, pageOver: document.documentElement.scrollWidth > window.innerWidth + 1,
      running: document.getAnimations().filter((a) => /^eco-/.test(a.animationName || "") && a.playState !== "finished").length };
  });
  const settle = (p) => p.waitForTimeout(3400); // dolum 1,5 sn, sayı 1,3 sn, damlalar ~3 sn
  const shot = (p, file) => p.locator("#ecoSec").screenshot({ path: path.join(OUT, file) });

  // Küçük: hareket açık; önce animasyonun gerçekten çalıştığını gör
  await setScene("kucuk");
  let p = await openReport();
  const early = await read(p);
  await settle(p);
  let s = await read(p);
  check("küçük: bölüm başlığı ve 'tahmin' etiketi", /kurtardığın su ve enerji/.test(await p.locator("#ecoTitle").innerText()) && s.tag === "tahmin", s.tag);
  check("küçük: damla ve LED süresi seçildi, sayı aralıklı", s.state === "pos" && s.cards.length === 2 && s.cards[0].unit === "drop" && s.cards[1].unit === "led" && /damla/.test(s.cards[0].text) && /dk/.test(s.cards[1].num) && s.cards.every((c) => /tahmin aralığı .+ – .+/.test(c.text)), s.cards.map((c) => c.text).join(" || "));
  check("küçük: kutlayan giriş cümlesi (1 kez)", /Eline sağlık: bu hafta 1 kez önerilen daha hafif ayara geçtin/.test(s.lead) && !/düşüldü/.test(s.lead), s.lead);
  check("animasyon: kap doluyor, damlalar düşüyor, sayı yukarı sayıyor", early.running >= 4 && early.cards[0].anim && early.cards[0].drops === 3 && early.cards[0].num !== s.cards[0].num && s.running === 0, `başta ${early.running} animasyon, sayı ${early.cards[0].num} → ${s.cards[0].num}`);
  check("formül açılır kutuda düz metin (kapalı başlar)", !s.howOpen && s.formula.startsWith("E = token × e_token\nW = E × WUE") && /0,6 \/ 1,3 \/ 3,0 mWh/.test(s.formula) && /3,6 \/ 4,2 \/ 5,3 L\/kWh/.test(s.formula) && /Bu hafta: token ≈ 730/.test(s.formula), s.formula.replace(/\n/g, " ⏎ "));
  check("dipnotta kaynaklar ve 'ölçüm değil, tahmin'", /Epoch AI/.test(s.sources) && /arXiv:2505\.09598/.test(s.sources) && /arXiv:2304\.03271/.test(s.sources) && /arXiv:2508\.15734/.test(s.sources) && /USGS/.test(s.sources) && /EPA/.test(s.sources) && /ölçüm değil, tahmin/.test(s.assume));
  check("kurduğundan beri toplamı ayrı satırda", /Kurduğundan beri/.test(s.total || "") && /Sayım .+ tarihinde başladı/.test(s.total || ""), s.total);
  check("küçük: taşma yok", !s.pageOver && s.cards.every((c) => !c.over));
  await shot(p, "1-kucuk.png");
  await p.close();

  await setScene("orta");
  p = await openReport(); await settle(p); s = await read(p);
  check("orta: su bardağı ve telefon şarjı", s.cards[0]?.unit === "glass" && s.cards[1]?.unit === "phone" && /su bardağı \(250 mL\)/.test(s.cards[0].text) && /telefon şarjı \(19 Wh\)/.test(s.cards[1].text), s.cards.map((c) => c.text).join(" || "));
  check("orta: ağır geçişlerin düşüldüğü söyleniyor", /12 kez/.test(s.lead) && /2 mesajın farkı toplamdan düşüldü/.test(s.lead), s.lead);
  check("orta: toplamda şişe / çaydanlık, taşma yok", /şişe/.test(s.total) && /çaydanlık/.test(s.total) && !s.pageOver && s.cards.every((c) => !c.over), s.total);
  await shot(p, "2-orta.png");
  await p.evaluate(() => { document.getElementById("ecoHowBox").open = true; });
  await shot(p, "2b-orta-formul-acik.png");
  await p.screenshot({ path: path.join(OUT, "2c-orta-tam-sayfa.png"), fullPage: true });
  // CSV: yeni sütunlar
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 10000 }), p.click("#csv")]);
  const csv = fs.readFileSync(await dl.path(), "utf8").split("\n");
  const head = csv[0].split(",");
  const iTok = head.indexOf("avoided_tokens_eq");
  check("CSV: su ve enerji sütunları, sayılmış satırda değer, eski satırda boş", iTok > 0 && head.slice(iTok).join() === "avoided_tokens_eq,avoided_by,energy_wh_low,energy_wh_mid,energy_wh_high,water_ml_low,water_ml_mid,water_ml_high" &&
    csv.some((l) => /,26000,(model|effort),15\.6,33\.8,78,56\.16,141\.96,413\.4$/.test(l)) && csv.some((l) => /,,,,,,,$/.test(l)) && csv.every((l) => l.split(",").length === head.length), csv.find((l) => /,26000,/.test(l))?.split(",").slice(iTok).join(","));
  await p.close();

  await setScene("buyuk");
  p = await openReport(); await settle(p); s = await read(p);
  check("büyük: kova ve çaydanlık; toplamda küvet", s.cards[0]?.unit === "bucket" && s.cards[1]?.unit === "kettle" && /küvet/.test(s.total), s.cards.map((c) => c.text).join(" || ") + " ## " + s.total);
  check("büyük: taşma yok", !s.pageOver && s.cards.every((c) => !c.over));
  await shot(p, "3-buyuk.png");
  await p.close();

  // Sıfır ve negatif: sakin ve dürüst, ders vermeden
  await setScene("sifir");
  p = await openReport(); await settle(p); s = await read(p);
  check("sıfır: kart yok, sakin cümle", s.state === "zero" && s.cards.length === 0 && /ne tasarruf ne ek harcama/.test(s.lead) && /Henüz bir fark birikmedi/.test(s.total), s.lead);
  await shot(p, "4-sifir.png");
  await p.close();
  await setScene("negatif");
  p = await openReport(); const earlyNeg = await read(p); await settle(p); s = await read(p);
  check("negatif: 'net tasarruf yok', 'fazladan' etiketi, damla yok", s.state === "neg" && /Bu hafta net tasarruf yok\. 3 kez/.test(s.lead) && /doğru seçim buydu/.test(s.lead) && s.cards.length === 2 && s.cards.every((c) => /fazladan/.test(c.text) && c.drops === 0) && /Net tasarruf yok/.test(s.total), s.lead + " ## " + s.cards.map((c) => c.text).join(" || "));
  check("negatif: suçlayıcı kelime yok", !/israf|boşa|zarar|kötü|yanlış|suç/i.test(s.lead + s.total + s.cards.map((c) => c.text).join(" ")));
  check("negatif: formülde eksi işaretli değerler", /token ≈ −30\.600 → E ≈ −40 Wh \(−92 Wh – −18 Wh\)/.test(s.formula), (s.formula.split("\n").pop() || ""));
  void earlyNeg;
  await shot(p, "5-negatif.png");
  await p.close();
  await setScene("sayimYok");
  p = await openReport(); await settle(p); s = await read(p);
  check("sayım yok (eski kayıtlar): açıklama var, kart ve toplam yok", s.state === "none" && s.cards.length === 0 && s.total === null && /henüz sayım yok/.test(s.lead), s.lead);
  await p.close();

  // Hareket azaltma: animasyon yok, sayı baştan son değerinde
  await setScene("orta");
  p = await openReport({ reduce: true });
  const r0 = await read(p);
  await p.waitForTimeout(1600);
  const r1 = await read(p);
  check("prefers-reduced-motion: animasyon yok, sayı ilk andan son değerde, kap dolu", r0.running === 0 && r0.cards.every((c) => !c.anim) && r0.cards[0].num === r1.cards[0].num && r0.cards[1].num === r1.cards[1].num && /^1,5×$/.test(r0.cards[0].num), `${r0.cards[0].num} / ${r0.cards[1].num}`);
  const lvl = await p.evaluate(() => { const l = document.querySelector(".eco-art .lvl"); return { tr: getComputedStyle(l).transform, an: getComputedStyle(l).animationName }; });
  check("prefers-reduced-motion: dolum son konumunda duruyor", lvl.an === "none" && /matrix\(1, 0, 0, 1, 0, \d/.test(lvl.tr), JSON.stringify(lvl));
  await shot(p, "6-orta-hareket-azaltma.png");
  await p.close();

  // Dar pencere ve koyu tema
  p = await openReport({ width: 380, dark: true }); await settle(p); s = await read(p);
  check("dar pencere (380 px) + koyu tema: taşma yok", !s.pageOver && s.cards.every((c) => !c.over), s.cards.map((c) => c.text).join(" || "));
  await shot(p, "7-orta-dar-koyu.png");
  await p.close();

  // İngilizce
  await setScene("orta", "en");
  p = await openReport(); await settle(p); s = await read(p);
  check("İngilizce: başlık, birimler ve etiket çevrildi", /Water and energy you saved this week/.test(await p.locator("#ecoTitle").innerText()) && s.tag === "estimate" && /glass of water/.test(s.cards[0].text) && /phone charge/.test(s.cards[1].text) && /12×/.test(s.lead) && !s.pageOver, s.lead);
  await shot(p, "8-orta-en.png");
  await p.close();
  // Diğer 8 dil: metinler geliyor ve taşmıyor
  const bad = [];
  for (const lang of ["de", "fr", "es", "it", "pt", "ru", "ja", "zh"]) {
    await setScene("buyuk", lang);
    p = await openReport({ reduce: true, width: 720 }); s = await read(p);
    if (s.pageOver || s.cards.some((c) => c.over) || s.cards.length !== 2 || /^eco[A-Z]/.test(s.lead) || s.lead.length < 20) bad.push(lang);
    await p.close();
  }
  check("diğer 8 dil: bölüm dolu, taşma yok (720 px)", bad.length === 0, bad.join(","));

  // ---------- B) Gerçek akış: sahte claude.ai ----------
  await sw.evaluate(async () => { const { settings } = await chrome.storage.local.get("settings"); await chrome.storage.local.set({ sends: [], settings: { ...settings, language: "auto" } }); await chrome.storage.local.remove("eco"); });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text())) errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto(`https://claude.ai/chat/${CONV}`);
  await page.waitForFunction(() => document.querySelector("[data-token-forecast]")?.shadowRoot?.querySelector(".head")?.textContent, null, { timeout: 15000 });
  const ed = page.locator(".ProseMirror");
  const banner = () => page.evaluate(() => { const b = document.querySelector("[data-token-forecast]").shadowRoot.querySelector(".banner"); return { cls: b.className, text: b.innerText }; });
  const setBtn = (id, label) => page.evaluate(([i, l]) => { document.getElementById(i).textContent = l; }, [id, label]);
  const typeMsg = async (text) => { await ed.click(); await page.keyboard.press("Control+A"); await page.keyboard.press("Backspace"); await page.keyboard.type(text); await page.waitForTimeout(900); };
  const sendMsg = async () => {
    const before = await page.evaluate(() => window.__sent || 0);
    await page.click("#send");
    await page.waitForFunction((b) => (window.__sent || 0) > b, before, { timeout: 10000 });
    await page.waitForTimeout(2500);
    return ((await storage("sends")).sends || []).at(-1) || {};
  };

  // 1) Çeviri + Opus → "Haiku yeterli" önerisi → kullanıcı Haiku'ya geçer → gönderir
  await typeMsg("Bu cümleyi İngilizceye çevir: Yarın toplantıya katılamayacağım.");
  const b1 = await banner();
  await setBtn("model", "Haiku 5.5");
  await page.waitForTimeout(1400);
  const s1 = await sendMsg();
  check("öneri uygulandı (Opus → Haiku): kayıtta kaçınılan işlem pozitif, tür 'model'", /t-save/.test(b1.cls) && s1.ecoU > 0 && s1.ecoK === "model" && s1.fam === "haiku", `${b1.text.split("\n")[0]} → ecoU ${s1.ecoU} (${Math.round(s1.ecoU / 10)} token)`);
  // 2) Aynı ayarla (değişiklik yok) gönderim → 0
  await typeMsg("Şu cümleyi Almancaya çevir: Bugün hava çok güzel.");
  const s2 = await sendMsg();
  check("ayar değişmeden gönderim: fark 0 (sayılmış)", s2.ecoU === 0 && !("ecoK" in s2), JSON.stringify({ ecoU: s2.ecoU, ecoK: s2.ecoK }));
  // 3) Yazarken daha güçlü modele geçiş → negatif
  await typeMsg("Fotosentezi lise öğrencisine anlatır gibi açıklar mısın?");
  await setBtn("model", "Opus 5.5");
  await page.waitForTimeout(1400);
  const s3 = await sendMsg();
  check("daha güçlü modele geçiş (Haiku → Opus): fark negatif", s3.ecoU < 0 && s3.ecoK === "model" && s3.fam === "opus", `ecoU ${s3.ecoU}`);
  // 4) Effort önerisi: Maksimum → Orta
  await setBtn("model", "Sonnet 5.5"); await setBtn("effort", "Maksimum");
  await page.waitForTimeout(1200);
  await typeMsg("Kuantum dolanıklık nedir, basitçe anlatır mısın?");
  const b4 = await banner();
  await setBtn("effort", "Orta");
  await page.waitForTimeout(1400);
  const s4 = await sendMsg();
  check("effort önerisi uygulandı (Maksimum → Orta): pozitif, tür 'effort'", /Effort'u Orta yap/.test(b4.text) && s4.ecoU > 0 && s4.ecoK === "effort", `${b4.text.split("\n")[0]} → ecoU ${s4.ecoU}`);
  // 5) Öneri yokken kendiliğinden hafife geçiş sayılmaz (kod yazma + Sonnet uygun → Haiku)
  await typeMsg("Write a JavaScript function that debounces another function.");
  const b5 = await banner();
  await setBtn("model", "Haiku 5.5");
  await page.waitForTimeout(1400);
  const s5 = await sendMsg();
  check("öneri yokken hafif modele inmek tasarruf sayılmaz", /t-ok/.test(b5.cls) && s5.ecoU === 0 && s5.fam === "haiku", `${b5.text.split("\n")[0]} → ecoU ${s5.ecoU}`);

  const st = await storage(["sends", "eco"]);
  const all = st.sends || [];
  check("kayıtlarda metin yok; yalnızca sayı ve etiket eklendi", all.length === 5 && !/çevir|Fotosentez|debounce|dolanıklık|toplant/i.test(JSON.stringify(st)) && all.every((x) => Number.isFinite(x.ecoU)) && all.every((x) => !Object.keys(x).some((k) => /text|prompt/i.test(k))));
  const e = st.eco || {};
  check("kurulumdan beri sayacı: 5 gönderim, 2 kazanç, 1 fazladan, toplamlar kayıtlarla aynı", e.v === 1 && e.n === 5 && e.gainN === 2 && e.extraN === 1 && e.gainU === s1.ecoU + s4.ecoU && e.extraU === -s3.ecoU && e.since <= Date.now() && e.since > now - 60000, JSON.stringify(e));
  p = await openReport({ reduce: true }); s = await read(p);
  const net = s1.ecoU + s4.ecoU + s3.ecoU;
  check("rapor gerçek kayıtlardan çiziliyor", s.state === (net > 5 ? "pos" : net < -5 ? "neg" : "zero") && (s.state === "zero" || s.cards.length === 2) && s.total !== null, `net ${net} birim → ${s.state}: ${s.lead}`);
  await shot(p, "9-gercek-akis.png");
  await p.close();

  check("konsolda hata yok", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} kontrol geçti (rapor-su)`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
