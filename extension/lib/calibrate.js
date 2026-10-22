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

import { kPrior, peakPrior, communityK, CLAUDE_OUTPUT_PRIOR } from "./forecast.js";

export const CALIB_VERSION = 1;
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

// Durum nesnesini saran, tahmin motorunun beklediği arayüz.
export function makeCalib(state) {
  const st = state && state.version === CALIB_VERSION ? state : emptyState();
  return {
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
  const st = state && state.version === CALIB_VERSION ? structuredClone(state) : emptyState();
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
