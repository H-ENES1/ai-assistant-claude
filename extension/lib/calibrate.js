// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Kişisel kalibrasyon (adım 10).
//
// İki şey öğrenilir:
// 1) k: "1 maliyet birimi = limitin yüzde kaçı", plan ve pencere (5 saatlik / haftalık) başına.
//    Gözlem: bir mesajdan önce ve sonra okunan kullanım yüzdesi farkı Δ ve o mesajın
//    gerçekleşen maliyeti C (gerçek cevap uzunluğuyla). Model: Δ ≈ k·C.
//    Gamma-Poisson eşlenik güncellemesi: k ~ Gamma(a, b), a += Δ, b += C.
//    Neden bu? Yüzdeler tam sayıya yuvarlanıyor; küçük mesajlarda Δ çoğu zaman 0 ya da 1.
//    Oranların ortalaması bu durumda yanlı olur, toplamların oranı ise yansız kalır.
// 2) Claude'un cevap uzunluğu farkı: log(gerçek çıktı) − log(önsel tahmin), genel + tip başına.
//    Normal-normal hiyerarşik güncelleme: tip başına sapma, genel sapmaya doğru büzülür.
//
// Önsel değerler forecast.js'den gelir. Durum chrome.storage.local'da "calib" anahtarında saklanır
// ve yalnızca arka plan servisi tarafından yazılır (sekmeler arası çakışma olmasın diye).

import { kPrior, peakPrior, communityK, CLAUDE_OUTPUT_PRIOR, PLAN_CAPS } from "./forecast.js";

// Şema geçmişi (şema değişirse CALIB_VERSION artır ve MIGRATIONS'a adım ekle; eski veriyi SİLME):
//   1 — 0.9.x–0.12.x: { version, k: { plan: { session | weekly | session_peak: { a, b, n, at } } },
//        out: { global: { w, s, at }, types: { tür: { w, s, at } } }, log: [...], stats: { n, inRange } }
//        0.9.x'te session_peak kovası yoktu (sonradan eklendi; ek alan olduğu için taşıma gerekmedi).
export const CALIB_VERSION = 1;
// MIGRATIONS[n]: n sürümündeki durumu n+1'e çevirir. Şimdilik boş (tek sürüm var).
const MIGRATIONS = {};
const MAX_LOG = 300;
const TYPE_SHRINK_SD = 0.3;   // tip sapmasının genel sapmadan ne kadar uzaklaşabileceği
const OBS_SD = 0.9;           // tek bir cevabın log uzunluğundaki doğal gürültü (CASTILLO ~0.6–1.3)
const HALF_LIFE_DAYS = 45;    // eski gözlemler yavaşça unutulur (Anthropic limitleri değiştirebilir)

export function emptyState() {
  return { version: CALIB_VERSION, k: {}, out: { global: { w: 0, s: 0 }, types: {} }, log: [], stats: { n: 0, inRange: 0 } };
}

function gammaFromLogNormal({ mu, sd }) {
  const m = Math.exp(mu + sd * sd / 2);
  const cv2 = Math.exp(sd * sd) - 1;
  const a = 1 / cv2;
  return { a, b: a / m };
}

function logNormalFromGamma({ a, b }) {
  const sd = Math.sqrt(Math.log(1 + 1 / a));
  return { mu: Math.log(a / b) - sd * sd / 2, sd };
}

function decayFactor(lastAt, now) {
  if (!lastAt) return 1;
  const days = Math.max(0, (now - lastAt) / 864e5);
  return Math.pow(0.5, days / HALF_LIFE_DAYS);
}

const isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);
const fin = (x, d = 0) => (Number.isFinite(x) ? x : d);
const SAFE_KEY = /^[a-z0-9_]{1,32}$/;

// Depodaki kalibrasyonu bu sürümün şemasına getirir. Hiçbir zaman hata fırlatmaz, girdiyi değiştirmez.
// Döner: { state, status }
//   "empty"    : veri yok → boş durum
//   "ok"       : bu sürümün şeması, dokunulmadı
//   "repaired" : bu sürüm ama eksik/bozuk alan vardı; okunabilen her şey korundu
//   "migrated" : eski sürümden taşındı
//   "newer"    : daha YENİ bir sürümün verisi (eklenti eski sürüme döndü) → state = null, çağıran veriyi yedeklemeli
//   "invalid"  : nesne ama kalibrasyona benzemiyor → state = null, çağıran veriyi yedeklemeli
export function migrateCalib(raw) {
  if (raw === null || raw === undefined) return { state: emptyState(), status: "empty" };
  if (!isObj(raw) || !isObj(raw.k)) return { state: null, status: "invalid" };
  let v = raw.version === undefined ? 1 : raw.version; // sürüm alanı olmayan çok eski biçim: v1 düzeni
  if (!Number.isInteger(v) || v < 1) return { state: null, status: "invalid" };
  if (v > CALIB_VERSION) return { state: null, status: "newer" };
  let cur = raw, migrated = raw.version !== CALIB_VERSION;
  while (v < CALIB_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) return { state: null, status: "invalid" };
    cur = step(cur); v++;
  }
  // Onarım: eksik alanlar boş değerle tamamlanır, sayı olmayan kovalar atılır (gerisi korunur)
  let repaired = false;
  const k = {};
  for (const [tier, wins] of Object.entries(cur.k)) {
    if (!SAFE_KEY.test(tier) || !isObj(wins)) { repaired = true; continue; }
    for (const [win, b] of Object.entries(wins)) {
      if (!SAFE_KEY.test(win) || !isObj(b) || !(b.a >= 0) || !(b.b >= 0) || !Number.isFinite(b.a) || !Number.isFinite(b.b)) { repaired = true; continue; }
      (k[tier] ||= {})[win] = b;
    }
    if (!k[tier] && Object.keys(wins).length === 0) k[tier] = {};
  }
  const cell = (c) => (isObj(c) && Number.isFinite(c.w) && Number.isFinite(c.s) && c.w >= 0 ? c : null);
  const g = cell(cur.out?.global);
  const types = {};
  for (const [t, c] of Object.entries(isObj(cur.out?.types) ? cur.out.types : {})) {
    if (SAFE_KEY.test(t) && cell(c)) types[t] = c; else repaired = true;
  }
  if (!g || !isObj(cur.out?.types)) repaired = true;
  const log = Array.isArray(cur.log) ? cur.log.filter(isObj).slice(-MAX_LOG) : [];
  if (!Array.isArray(cur.log) || log.length !== cur.log.length) repaired = true;
  const statsOk = isObj(cur.stats) && Number.isFinite(cur.stats.n) && Number.isFinite(cur.stats.inRange);
  if (!statsOk) repaired = true;
  if (!migrated && !repaired) return { state: cur, status: "ok" };
  const state = {
    ...cur, version: CALIB_VERSION, k,
    out: { global: g || { w: 0, s: 0 }, types },
    log,
    stats: { n: Math.max(0, fin(cur.stats?.n)), inRange: Math.max(0, fin(cur.stats?.inRange)) }
  };
  return { state, status: migrated ? "migrated" : "repaired" };
}

// Arka planın tek yazma yolu: depodaki durumu taşır, gözlemleri işler. Depodaki veri okunamıyorsa
// (daha yeni sürüm ya da bozuk) SESSİZCE SİLİNMEZ: `backup` döner, çağıran onu "calibBackup" anahtarına yazar.
export function applyObservations(stored, list, now = Date.now()) {
  const m = migrateCalib(stored);
  const backup = m.state ? null : { at: now, status: m.status, version: stored?.version ?? null, data: stored };
  let calib = m.state || emptyState();
  const results = [];
  for (const obs of Array.isArray(list) ? list.slice(0, 8) : []) {
    const r = observe(calib, obs);
    calib = r.state;
    results.push({ accepted: r.accepted, reason: r.reason });
  }
  return { calib, backup, results, status: m.status };
}

// Gözlem biçimi doğru mu? (içerik betiğinden gelir; sayfa betikleri sahte veri sokmaya çalışabilir)
export function validObservation(obs) {
  if (!isObj(obs)) return false;
  if (typeof obs.tier !== "string" || !PLAN_CAPS[obs.tier]) return false;
  if (!(obs.window === "session" || obs.window === "weekly" || obs.window === null || obs.window === undefined)) return false;
  if (obs.type !== undefined && obs.type !== null && !(typeof obs.type === "string" && SAFE_KEY.test(obs.type))) return false;
  if (obs.model !== undefined && obs.model !== null && !(typeof obs.model === "string" && obs.model.length <= 32)) return false;
  for (const key of ["delta", "cost", "outTokens", "outMuNoAdj", "at", "peakMul"]) {
    if (obs[key] !== undefined && obs[key] !== null && !Number.isFinite(obs[key])) return false;
  }
  if (obs.predicted !== undefined && obs.predicted !== null && !isObj(obs.predicted)) return false;
  return true;
}

// Durum nesnesini saran, tahmin motorunun beklediği arayüz.
export function makeCalib(state) {
  const mig = migrateCalib(state);
  const st = mig.state || emptyState();
  return {
    status: mig.status,
    state: st,
    kPosterior(tier, win) {
      // Yoğun saat k'sı: önseli, normal saatlerde öğrenilen k × 1,5 (belirsizliği artırılmış)
      const base = win === "session_peak" ? (communityK(tier, "session_peak") || peakPrior(this.kPosterior(tier, "session"))) : kPrior(tier, win);
      const prior = gammaFromLogNormal(base);
      const s = st.k?.[tier]?.[win];
      if (!s) return logNormalFromGamma(prior);
      return logNormalFromGamma({ a: prior.a + s.a, b: prior.b + s.b });
    },
    outputAdjust(type) {
      const p0 = CLAUDE_OUTPUT_PRIOR;
      const g = st.out.global;
      const gPrec = 1 / (p0.sd * p0.sd) + g.w;
      const gMean = (p0.mean / (p0.sd * p0.sd) + g.s) / gPrec;
      const t = st.out.types[type];
      if (!t) return { mean: gMean, sd: Math.sqrt(1 / gPrec + TYPE_SHRINK_SD * TYPE_SHRINK_SD) };
      const tPrec = 1 / (TYPE_SHRINK_SD * TYPE_SHRINK_SD) + t.w;
      const tMean = (gMean / (TYPE_SHRINK_SD * TYPE_SHRINK_SD) + t.s) / tPrec;
      return { mean: tMean, sd: Math.sqrt(1 / tPrec + 1 / gPrec * 0.25) };
    },
    summary() {
      const n = st.stats.n;
      return {
        measurements: n,
        inRangePct: n ? Math.round((st.stats.inRange / n) * 100) : null,
        tiers: Object.keys(st.k)
      };
    }
  };
}

// Bir gözlemi işler. obs:
// { at, tier, window: "session"|"weekly", delta, cost, peakMul, predicted: {low, mid, high},
//   type, outTokens, outMuNoAdj, conv, model }
// Döner: { state, accepted, reason }
export function observe(state, obs) {
  const mig = migrateCalib(state);
  const st = mig.state ? structuredClone(mig.state) : emptyState();
  if (!validObservation(obs)) return { state: st, accepted: false, reason: "invalid" };
  const now = obs.at || Date.now();
  let accepted = true, reason = "ok";

  // --- k güncellemesi ---
  if (obs.window && Number.isFinite(obs.delta) && obs.cost > 0) {
    const pm = obs.peakMul || 1;
    const delta = obs.delta / pm;
    const pred = obs.predicted || {};
    // Aykırı değer: başka bir cihaz / Claude Code aynı limiti aynı anda harcamış olabilir.
    const tooBig = obs.delta > Math.max(3, 4 * (pred.high || 0) + 1);
    if (obs.delta < 0) { accepted = false; reason = "negative"; }
    else if (tooBig) { accepted = false; reason = "outlier"; }
    if (accepted) {
      st.k[obs.tier] ||= {};
      const bucket = obs.window === "session" && obs.peak ? "session_peak" : obs.window;
      const cur = st.k[obs.tier][bucket] || { a: 0, b: 0, n: 0, at: 0 };
      const f = decayFactor(cur.at, now);
      st.k[obs.tier][bucket] = { a: cur.a * f + delta, b: cur.b * f + obs.cost, n: cur.n + 1, at: now };
      if (obs.window === "session") {
        st.stats.n++;
        // Yuvarlama payı ±1 ile aralıkta mı?
        if (obs.delta >= Math.floor((pred.low || 0)) - 1 && obs.delta <= Math.ceil(pred.high || 0) + 1) st.stats.inRange++;
      }
    }
  }

  // --- çıktı uzunluğu güncellemesi ---
  if (obs.window !== "weekly" && obs.type && obs.outTokens > 0 && Number.isFinite(obs.outMuNoAdj)) {
    const r = Math.log(obs.outTokens) - obs.outMuNoAdj;
    const prec = 1 / (OBS_SD * OBS_SD);
    const g = st.out.global, f = decayFactor(g.at, now);
    st.out.global = { w: g.w * f + prec, s: g.s * f + r * prec, at: now };
    const t = st.out.types[obs.type] || { w: 0, s: 0, at: 0 };
    const ft = decayFactor(t.at, now);
    st.out.types[obs.type] = { w: t.w * ft + prec, s: t.s * ft + r * prec, at: now };
  }

  if (obs.window !== "weekly") {
    st.log.push({
      at: now, tier: obs.tier, model: obs.model, type: obs.type,
      delta: obs.delta, pred: obs.predicted ? [round2(obs.predicted.low), round2(obs.predicted.mid), round2(obs.predicted.high)] : null,
      cost: Math.round(obs.cost || 0), out: obs.outTokens || 0, accepted, reason
    });
    if (st.log.length > MAX_LOG) st.log.splice(0, st.log.length - MAX_LOG);
  }
  return { state: st, accepted, reason };
}

const round2 = (x) => Math.round((x || 0) * 100) / 100;
