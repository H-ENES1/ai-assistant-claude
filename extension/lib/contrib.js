// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Topluluk katkısı: kullanıcının ONAYIYLA paylaşılan, metin içermeyen özet.
//
// Amaç: herkesin cihazında öğrenilen değerleri (plan başına limit büyüklüğü k, Claude'un cevap
// uzunluğu sapması, tahmin isabeti, iş türü düzeltmeleri) bir araya getirip yeni kullanıcıların
// başlangıç değerlerini iyileştirmek (tools/aggregate.mjs → lib/community-priors.js).
//
// İçermez: mesaj metni, sohbet kimliği/adı, kesin tarih, hesap/kuruluş kimliği, dosya adı.
// Gönderim otomatik değildir: kullanıcı önizlemeyi görür, kopyalar ve kendisi yapıştırır.

import { makeCalib } from "./calibrate.js";

export const CONTRIB_VERSION = 1;
const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);
const OBS_SD = 0.9;

export function buildContribution({ calib, sends = [], recPrefs = null, learnFixes = null, tier, extVersion, lang, now = Date.now() }) {
  const C = makeCalib(calib);
  const st = C.state;
  const out = { kind: "token-forecast-contribution", v: CONTRIB_VERSION, ext: extVersion || null, plan: tier || null, lang: lang || null };

  // k sonsalları (yalnızca bu planın; en az 1 ölçüm olan pencereler)
  out.k = {};
  for (const win of ["session", "session_peak", "weekly"]) {
    const s = st.k?.[tier]?.[win];
    if (!s || !s.n) continue;
    const p = C.kPosterior(tier, win);
    out.k[win] = { mu: r3(p.mu), sd: r3(p.sd), n: s.n };
  }

  // Cevap uzunluğu sapması (log ölçekte): genel + tip başına
  const ob = (g) => (g && g.w > 0 ? { mean: r3(g.s / g.w), n: Math.round(g.w * OBS_SD * OBS_SD) } : null);
  out.outBias = { global: ob(st.out?.global) };
  const types = {};
  for (const [t, g] of Object.entries(st.out?.types || {})) { const v = ob(g); if (v && v.n > 0) types[t] = v; }
  out.outBias.types = types;

  out.acc = { n: st.stats?.n || 0, inRange: st.stats?.inRange || 0 };

  // Son 4 haftanın kullanım karışımı (oranlar; sayılar haftalık ortalamaya yuvarlanır)
  const recent = sends.filter((x) => x && x.at > now - 28 * 864e5);
  const share = (key) => {
    const m = {};
    for (const x of recent) { const k = x[key] || "unknown"; m[k] = (m[k] || 0) + 1; }
    for (const k of Object.keys(m)) m[k] = r3(m[k] / Math.max(1, recent.length));
    return m;
  };
  out.mix = {
    perWeek: Math.round(recent.length / 4),
    types: share("type"), models: share("fam"), domains: share("dom"), efforts: share("eff"),
    peak: r3(recent.filter((x) => x.peak).length / Math.max(1, recent.length)),
    cold: r3(recent.filter((x) => x.cache === "cold" && (x.hist || 0) > 5000).length / Math.max(1, recent.length))
  };
  // Tahmin/ölçüm oranı (log) dağılımı: k'nın planlar arası farkını doğrulamak için
  const ratios = recent.filter((x) => Number.isFinite(x.d) && x.d > 0 && x.pred > 0).map((x) => Math.log(x.d / x.pred)).sort((a, b) => a - b);
  out.ratio = ratios.length ? { n: ratios.length, median: r3(ratios[Math.floor(ratios.length / 2)]) } : null;

  // Model önerisi geri bildirimi (tip başına oylar ve kişisel sınırlar)
  out.advice = {};
  for (const [t, v] of Object.entries(recPrefs?.types || {})) {
    out.advice[t] = { votes: v.votes || {}, floor: v.floor || null, ceil: v.ceil || null };
  }
  // İş türü düzeltmeleri: "translate>rewrite": 2 gibi (metin yok)
  out.fixes = learnFixes && typeof learnFixes === "object" ? learnFixes : {};
  return out;
}

// Kopyalanacak metin: başında insan için açıklama, sonra JSON (GitHub formuna yapıştırılır)
export function contributionText(obj) {
  return "```json\n" + JSON.stringify(obj, null, 1) + "\n```";
}

// Katkı metninden nesneyi geri çıkar (tools/aggregate.mjs kullanır); bozuk girişte null
export function parseContribution(text) {
  const m = String(text || "").match(/\{[\s\S]*"kind"\s*:\s*"token-forecast-contribution"[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    if (o.kind !== "token-forecast-contribution" || o.v !== CONTRIB_VERSION) return null;
    return o;
  } catch (_) { return null; }
}

// Birçok katkıyı birleştirir (tools/aggregate.mjs). Ortanca + MAD: aykırı kullanıcıya dayanıklı.
export function aggregate(contribs) {
  const median = (a) => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
  const mad = (a) => { const m = median(a); return median(a.map((x) => Math.abs(x - m))); };
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const k = {};
  const cells = {};
  for (const c of contribs) {
    if (!c.plan) continue;
    for (const [win, v] of Object.entries(c.k || {})) {
      if (!Number.isFinite(v?.mu) || !(v.n >= 2)) continue; // tek ölçümlü kullanıcı gürültü
      ((cells[c.plan] ||= {})[win] ||= []).push(v.mu);
    }
  }
  for (const [plan, wins] of Object.entries(cells)) for (const [win, mus] of Object.entries(wins)) {
    if (mus.length < 3) continue;
    (k[plan] ||= {})[win] = { mu: r3(median(mus)), sd: r3(Math.max(0.3, 1.4826 * mad(mus))), users: mus.length };
  }
  const ob = contribs.map((c) => c.outBias?.global).filter((g) => g && Number.isFinite(g.mean) && g.n >= 3);
  const outBias = ob.length >= 3 ? { mean: r3(median(ob.map((g) => g.mean))), sd: r3(Math.max(0.15, 1.4826 * mad(ob.map((g) => g.mean)))), users: ob.length } : null;
  const fixes = {};
  for (const c of contribs) for (const [kk, n] of Object.entries(c.fixes || {})) fixes[kk] = (fixes[kk] || 0) + (Number(n) || 0);
  const acc = contribs.reduce((a, c) => ({ n: a.n + (c.acc?.n || 0), inRange: a.inRange + (c.acc?.inRange || 0) }), { n: 0, inRange: 0 });
  return { k, outBias, fixes, acc, contributors: contribs.length };
}

