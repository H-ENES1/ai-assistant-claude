// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Denetim testleri (Kasım 2026 denetimi, DENETIM.md):
//  1) Kalibrasyon taşıma: eski sürümlerin GERÇEK koduyla üretilmiş durumlar (tests/fixtures) kayıpsız okunuyor mu,
//     okunamayan veri sessizce silinmek yerine yedekleniyor mu?
//  2) "Yanlış sayı yerine okunamadı": kullanım, plan ve model okuma biçim değişikliklerinde null dönüyor mu?
//  3) Depoya yazılan kayıtlar: serbest metin giremiyor mu, boyut sınırlı mı?
import { readFileSync } from "node:fs";
import { CALIB_VERSION, emptyState, migrateCalib, applyObservations, makeCalib, observe, validObservation } from "../extension/lib/calibrate.js";
import { normalizeUsage, normalizeSse, liveUsage, tierFromOrg, USAGE_STALE_MS, MAX_PCT } from "../extension/lib/usage.js";
import { resolveModel } from "../extension/lib/forecast.js";
import { cleanSend, cleanDonePatch, trimSends, sendsCsv } from "../extension/lib/report.js";
import { buildContribution } from "../extension/lib/contrib.js";

let fail = 0;
const t = (name, cond, info = "") => { console.log(`${cond ? "✓" : "✗"} ${name}${info ? " — " + info : ""}`); if (!cond) fail++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const close = (a, b) => Math.abs(a - b) < 1e-9;
const fixture = (v) => JSON.parse(readFileSync(new URL(`./fixtures/calib-${v}.json`, import.meta.url), "utf8"));

// ---------- 1) Kalibrasyon taşıma ----------
const OBS = { at: Date.UTC(2026, 10, 12, 10, 0, 0), tier: "claude_pro", window: "session", delta: 2, cost: 60000, peak: false, predicted: { low: 0.5, mid: 2, high: 5 }, type: "explain", outTokens: 700, outMuNoAdj: 6, model: "opus 5.5" };
for (const v of ["0.9.1", "0.12.0"]) {
  const fx = fixture(v), old = fx.state, frozen = JSON.stringify(old);
  const m = migrateCalib(old);
  t(`${v}: durum bu sürümde okunuyor (taşıma gerekmedi)`, m.status === "ok" && same(m.state, old), m.status);
  const c = makeCalib(old);
  t(`${v}: ölçüm sayısı ve isabet korunuyor`, same(c.summary(), fx.summary), JSON.stringify(c.summary()));
  // Öğrenilen k: eski kodun hesapladığı sonsal ile bugünkü kodun aynı durumdan hesapladığı sonsal aynı olmalı
  const diffs = Object.entries(fx.posterior).filter(([key, p]) => { const [tier, win] = key.split("/"); const q = c.kPosterior(tier, win); return !close(q.mu, p.mu) || !close(q.sd, p.sd); }).map(([k]) => k);
  t(`${v}: öğrenilen k sonsalları eski kodla aynı (${Object.keys(fx.posterior).length} kova)`, diffs.length === 0, diffs.join(","));
  const oa = c.outputAdjust("explain");
  t(`${v}: cevap uzunluğu düzeltmesi eski kodla aynı`, close(oa.mean, fx.outputAdjust.explain.mean) && close(oa.sd, fx.outputAdjust.explain.sd), JSON.stringify(oa));
  t(`${v}: yoğun saat k'sı hesaplanabiliyor (0.9.x'te kova yoktu)`, Number.isFinite(c.kPosterior("claude_pro", "session_peak").mu));
  const r = observe(old, OBS);
  const kept = same(r.state.log.slice(0, old.log.length), old.log);
  t(`${v}: yeni gözlem eski verinin ÜSTÜNE eklenir (günlük ve sayaçlar korunur)`, r.accepted && r.state.stats.n === old.stats.n + 1 && r.state.log.length === old.log.length + 1 && kept && r.state.k.claude_max_5x.session.n === old.k.claude_max_5x.session.n,
    `n ${old.stats.n}→${r.state.stats.n}`);
  t(`${v}: girdi durumu değiştirilmedi`, JSON.stringify(old) === frozen);
  const a = applyObservations(old, [OBS, { ...OBS, window: "weekly", delta: 0.2 }]);
  t(`${v}: arka plan yazma yolu yedek gerektirmedi, iki gözlem işlendi`, a.backup === null && a.status === "ok" && a.results.length === 2 && a.results.every((x) => x.accepted) && a.calib.stats.n === old.stats.n + 1);
  // Yedek dosyası (popup → dışa aktar → içe aktar) yolu: JSON'a gidip gelince aynı
  t(`${v}: JSON'a yazılıp okununca aynı durum`, same(migrateCalib(JSON.parse(JSON.stringify(old))).state, old));
}
// Sürüm alanı olmayan çok eski biçim: v1 düzeniyle taşınır
{
  const { version, ...noVersion } = fixture("0.9.1").state;
  const m = migrateCalib(noVersion);
  t("sürüm alanı yok → taşındı, veri korundu", m.status === "migrated" && m.state.version === CALIB_VERSION && same(m.state.k, noVersion.k) && m.state.stats.n === noVersion.stats.n && m.state.log.length === noVersion.log.length);
}
// Daha yeni sürümün verisi: bu sürüm okuyamaz ama SİLMEZ
{
  const future = { ...fixture("0.12.0").state, version: CALIB_VERSION + 1, yeniAlan: { x: 1 } };
  const m = migrateCalib(future);
  t("daha yeni sürüm → 'newer', durum null", m.status === "newer" && m.state === null);
  t("daha yeni sürüm: tahmin boş durumla sürer (çökmez)", makeCalib(future).summary().measurements === 0 && makeCalib(future).status === "newer");
  const a = applyObservations(future, [OBS], 12345);
  t("daha yeni sürüm: üzerine yazmadan önce yedek döner (sessiz silme yok)", a.backup && a.backup.at === 12345 && a.backup.version === CALIB_VERSION + 1 && same(a.backup.data, future) && a.calib.version === CALIB_VERSION && a.calib.stats.n === 1,
    JSON.stringify({ status: a.status, n: a.calib.stats.n }));
}
// Bozuk / eksik alanlı veri: okunabilen korunur
{
  const partial = { version: 1, k: { claude_pro: { session: { a: 5, b: 1e6, n: 3, at: 1 }, weekly: { a: NaN, b: 1, n: 1, at: 1 } }, "<img>": { session: { a: 1, b: 1, n: 1, at: 1 } } } };
  const m = migrateCalib(partial);
  t("eksik alanlı veri → onarıldı, geçerli kova korundu, bozuk kova atıldı", m.status === "repaired" && m.state.k.claude_pro.session.n === 3 && !m.state.k.claude_pro.weekly && !m.state.k["<img>"] && Array.isArray(m.state.log) && m.state.stats.n === 0, JSON.stringify(m.state?.k));
  let threw = false, oa = null, kp = null;
  try { const c = makeCalib(partial); oa = c.outputAdjust("explain"); kp = c.kPosterior("claude_pro", "session"); c.summary(); } catch (_) { threw = true; }
  t("eksik alanlı veriyle tahmin arayüzü çökmüyor", !threw && Number.isFinite(oa?.mean) && Number.isFinite(kp?.mu));
  const r = observe(partial, OBS);
  t("eksik alanlı veriye gözlem eklenebiliyor", r.accepted && r.state.k.claude_pro.session.n === 4);
  for (const [name, junk] of [["metin", "merhaba"], ["dizi", [1, 2]], ["alakasız nesne", { foo: 1 }], ["sürüm 0", { version: 0, k: {} }]]) {
    const a = applyObservations(junk, [OBS]);
    t(`kalibrasyon yerine ${name} → yedeklenir, boş durumla sürer`, migrateCalib(junk).status === "invalid" && a.backup && same(a.backup.data, junk) && a.calib.stats.n === 1);
  }
  t("veri yok → boş durum, yedek yok", migrateCalib(undefined).status === "empty" && migrateCalib(null).status === "empty" && applyObservations(undefined, []).backup === null && same(applyObservations(null, []).calib, emptyState()));
}
// Geçersiz gözlem kalibrasyona giremez (sayfa betiği sahte veri sokmaya çalışabilir)
{
  const base = fixture("0.12.0").state;
  const bad = [
    ["bilinmeyen plan", { ...OBS, tier: "claude_ultra" }], ["plan nesne", { ...OBS, tier: { a: 1 } }],
    ["tür serbest metin", { ...OBS, type: "<script>alert(1)</script>" }], ["fark metin", { ...OBS, delta: "5" }],
    ["maliyet sonsuz", { ...OBS, cost: Infinity }], ["pencere tanımsız ad", { ...OBS, window: "monthly" }],
    ["model çok uzun", { ...OBS, model: "x".repeat(500) }], ["nesne değil", "obs"]
  ];
  for (const [name, o] of bad) {
    const r = observe(base, o);
    t(`geçersiz gözlem reddedilir: ${name}`, !validObservation(o) && !r.accepted && r.reason === "invalid" && same(r.state, base));
  }
  t("geçerli gözlem kabul edilir (pencere yok: yalnız cevap uzunluğu)", validObservation({ at: 1, tier: "claude_free", window: null, type: "math", outTokens: 300, outMuNoAdj: 6, model: "haiku 5.5" }));
  t("bir çağrıda en fazla 8 gözlem işlenir", applyObservations(emptyState(), Array.from({ length: 50 }, () => OBS)).results.length === 8);
}

// ---------- 2) Okunamadı ----------
const iso = (ms) => new Date(ms).toISOString();
const NOW = Date.UTC(2026, 10, 12, 12, 0, 0);
const raw = (u5, extra = {}) => ({ five_hour: { utilization: u5, resets_at: iso(NOW + 3600e3) }, seven_day: { utilization: 40, resets_at: iso(NOW + 3 * 864e5) }, ...extra });
t("kullanım: sayı yüzdesi okunur", normalizeUsage(raw(85)).fiveHour.pct === 85 && normalizeUsage(raw("42.5")).fiveHour.pct === 42.5);
for (const [name, v] of [["metin", "çok"], ["true", true], ["eksi", -5], ["ölçek dışı", MAX_PCT + 1], ["dizi", [50]], ["nesne", { v: 1 }], ["boş metin", ""], ["NaN", NaN]]) {
  const u = normalizeUsage(raw(v));
  t(`kullanım: ${name} değer → pencere okunamadı (sayıya çevrilmez)`, u && u.fiveHour === null && u.sevenDay.pct === 40, JSON.stringify(u?.fiveHour));
}
t("kullanım: resets_at unix saniye ya da ms de okunur", normalizeUsage({ five_hour: { utilization: 10, resets_at: Math.floor(NOW / 1000) } }).fiveHour.resetsAt === Math.floor(NOW / 1000) * 1000 && normalizeUsage({ five_hour: { utilization: 10, resets_at: NOW } }).fiveHour.resetsAt === NOW);
t("kullanım: anlamsız resets_at → null (pencere yine okunur)", normalizeUsage({ five_hour: { utilization: 10, resets_at: "yarın" } }).fiveHour.resetsAt === null && normalizeUsage({ five_hour: { utilization: 10, resets_at: 5 } }).fiveHour.resetsAt === null);
const sse = (u, st = "within_limit") => ({ windows: { "5h": { utilization: u, resets_at: Math.floor((NOW + 3600e3) / 1000), status: st }, "7d": { utilization: 0.4, resets_at: Math.floor((NOW + 864e5) / 1000), status: "within_limit" } } });
t("akış: 0–1 ölçeği yüzdeye çevrilir, yenilenme ms", normalizeSse(sse(0.2)).fiveHour.pct === 20 && normalizeSse(sse(0.2)).fiveHour.resetsAt === Math.floor((NOW + 3600e3) / 1000) * 1000);
t("akış: ölçek değişirse (55 = 0–100) pencere okunamadı, %5500 gösterilmez", normalizeSse(sse(55)).fiveHour === null && normalizeSse(sse(55)).sevenDay.pct === 40);
t("akış: eksi / sayı olmayan → okunamadı", normalizeSse(sse(-0.1)).fiveHour === null && normalizeSse(sse("0.5")).fiveHour === null && normalizeSse({ windows: { "5h": "x" } }) === null && normalizeSse(null) === null);
t("akış: limit aşıldı → %100", normalizeSse(sse(0.98, "exceeded_limit")).fiveHour.pct === 100);

// Bayat / yenilenmiş kullanım
const stored = normalizeUsage(raw(87, { seven_day_fable: { utilization: 60, resets_at: iso(NOW + 2 * 864e5) } }));
const okMeta = { fetchedAt: NOW - 60000, source: "background", error: null };
t("canlı kullanım: taze veri aynen", same(liveUsage(stored, okMeta, NOW), stored));
const afterReset = liveUsage(stored, okMeta, NOW + 2 * 3600e3);
t("yenilenme zamanı geçen 5 saatlik pencere gösterilmez (%87 kalmaz), haftalık kalır", afterReset && afterReset.fiveHour === null && afterReset.sevenDay.pct === 40 && afterReset.bottleneck === "seven_day_fable", JSON.stringify(afterReset));
t("bütün pencereler yenilenmişse → okunamadı (null)", liveUsage(stored, okMeta, NOW + 10 * 864e5) === null);
const failMeta = (ageMs) => ({ fetchedAt: NOW - ageMs, error: "usage 500", errorAt: NOW - 1000 });
t("son okuma başarısız + veri eski → okunamadı", liveUsage(stored, failMeta(USAGE_STALE_MS + 1000), NOW) === null);
t("son okuma başarısız ama veri taze → gösterilir", liveUsage(stored, failMeta(5 * 60000), NOW)?.fiveHour.pct === 87);
t("eski hata, sonraki okuma başarılı → gösterilir", liveUsage(stored, { fetchedAt: NOW - 1000, error: "x", errorAt: NOW - 5000 }, NOW + 60 * 60000 - 2000)?.fiveHour.pct === 87);
t("meta yoksa yalnız yenilenme zamanına bakılır", liveUsage(stored, null, NOW)?.fiveHour.pct === 87 && liveUsage(null, okMeta, NOW) === null);
t("depoda bozuk pencere (sayı değil) gösterilmez", liveUsage({ fiveHour: { key: "five_hour", pct: "87", resetsAt: null }, sevenDay: { key: "seven_day", pct: 12, resetsAt: null }, extras: "x" }, null, NOW)?.fiveHour === null);

// Plan
t("plan: Pro, Max 5x, Max 20x, Team, Free tanınır", tierFromOrg({ capabilities: ["chat", "claude_pro"] }) === "claude_pro" && tierFromOrg({ capabilities: ["claude_max"], rate_limit_tier: "default_claude_max_5x" }) === "claude_max_5x" &&
  tierFromOrg({ capabilities: ["claude_max"], rate_limit_tier: "default_claude_max_20x" }) === "claude_max_20x" && tierFromOrg({ capabilities: ["chat"], raven_type: "team" }) === "claude_team" && tierFromOrg({ capabilities: ["chat"] }) === "claude_free");
t("plan: biçim tanınmazsa null (ücretsiz VARSAYILMAZ)", tierFromOrg(null) === null && tierFromOrg({}) === null && tierFromOrg({ capabilities: "claude_pro" }) === null && tierFromOrg("org") === null);

// Model
const rm = (s) => resolveModel(s).key;
t("model: seçici etiketi", rm("Opus 5.5") === "opus 5.5" && rm("Claude Fable 5.2") === "fable 5.2");
t("model: API kimliği (claude-opus-5-5, tarih soneki sürüm değil)", rm("claude-opus-5-5") === "opus 5.5" && rm("claude-sonnet-5-5-20260929") === "sonnet 5.5" && rm("claude-fable-5-2") === "fable 5.2" && rm("claude-opus-5-20260101") === "opus 5" && rm("claude-haiku-4-5-20251001") === "haiku 4.5",
  [rm("claude-opus-5-5"), rm("claude-sonnet-5-5-20260929"), rm("claude-opus-5-20260101"), rm("claude-haiku-4-5-20251001")].join(" | "));
t("model: tanınmayan ad → null (model VARSAYILMAZ)", rm("Mythos 7") === null && rm("") === null && rm(null) === null && rm("claude-next") === null && resolveModel("Akıllı").info === null);
t("model: bilinen ailenin bilinmeyen sürümü → yaklaşık işaretli", resolveModel("Opus 9").approx === true && resolveModel("claude-opus-9").approx === true && !resolveModel("Opus 5.5").approx);

// ---------- 3) Depoya yazılan kayıtlar ----------
const goodSend = { id: "1731400000000-dom-1731400000000-3", at: NOW, conv: "0b1c2d3e", fam: "opus", model: "opus 5.5", type: "code_fix", eff: "medium", peak: true, cache: "warm", hist: 1234.6,
  pred: 1.234, predLo: 0.4, predHi: 3.1, predW: 0.12, adv: { k: "save_next", t: "haiku" }, save: 0.5, dom: "software", sub: "web", effRec: "low", effAs: false, effSave: 0.2, outHi: 900.4 };
const cs = cleanSend(goodSend);
t("gönderim kaydı: geçerli kayıt aynen korunur", cs && cs.id === goodSend.id && cs.type === "code_fix" && cs.model === "opus 5.5" && cs.adv.k === "save_next" && cs.hist === 1235 && cs.outHi === 900 && cs.pred === 1.234 && cs.peak === true && cs.dom === "software");
const EVIL = "GİZLİ mesaj metni <img src=x onerror=alert(1)> =cmd|' /C calc'!A0";
const dirty = cleanSend({ ...goodSend, type: EVIL, model: EVIL, fam: EVIL, eff: EVIL, cache: EVIL, dom: EVIL, sub: EVIL, effRec: EVIL, conv: EVIL, adv: { k: EVIL, t: EVIL }, text: EVIL, prompt: EVIL, [EVIL]: 1, pred: "5", hist: EVIL, nested: { a: EVIL } });
t("gönderim kaydı: serbest metin hiçbir alana giremez", dirty && !JSON.stringify(dirty).includes("GİZLİ") && !JSON.stringify(dirty).includes("<img") && dirty.type === null && dirty.model === null && dirty.adv === null && dirty.pred === null && dirty.hist === 0, JSON.stringify(dirty).slice(0, 160));
t("gönderim kaydı: bilinmeyen anahtar yok, kayıt küçük", Object.keys(dirty).every((k) => k in cs) && JSON.stringify(cleanSend({ ...goodSend, big: "x".repeat(1e6) })).length < 600);
t("gönderim kaydı: kimliksiz / zamansız / nesne olmayan → reddedilir", cleanSend({ ...goodSend, id: EVIL }) === null && cleanSend({ ...goodSend, id: undefined }) === null && cleanSend({ ...goodSend, at: "dün" }) === null && cleanSend(null) === null && cleanSend("x") === null);
t("gönderim kaydı: yedekten gelen ölçüm alanları korunur", cleanSend({ ...goodSend, d: 2, dw: 0.3, out: 800 }).d === 2 && !("d" in cs));
t("ölçüm yaması: yalnızca üç sayı alanı", same(cleanDonePatch({ out: 800, d: 2, dw: "x", type: EVIL, id: "başka" }), { out: 800, d: 2, dw: null }) && same(cleanDonePatch(null), { out: null, d: null, dw: null }));
// Süzülmüş kayıtlar CSV'ye ve topluluk katkısına giderken de metin taşımaz
const cleaned = trimSends([dirty, cs], NOW + 1000);
t("CSV dışa aktarma ve topluluk katkısı: sızan metin yok", !sendsCsv(cleaned).includes("GİZLİ") && !sendsCsv(cleaned).includes("=cmd") &&
  !JSON.stringify(buildContribution({ calib: emptyState(), sends: cleaned, tier: "claude_pro", extVersion: "t", lang: "tr", now: NOW + 1000 })).includes("GİZLİ"));

console.log(fail ? `\n${fail} BAŞARISIZ` : "\nTümü geçti");
process.exit(fail ? 1 : 0);
