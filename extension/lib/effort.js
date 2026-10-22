// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Effort önerisi: bu mesaj için hangi effort seviyesi yeter, şu anki ayar fazla mı / az mı, fark ne kadar?
//
// Dayanak (kullanıcıya da gösterilir):
//  - Anthropic destek makalesi "Change the model, effort, and thinking settings": Düşük ve Orta rutin işler
//    için uygundur ve kullanımı uzatır; Yüksek "en iyi genel denge"dir; Extra high (xhigh) uzun kodlama ve
//    ajan işleri içindir (Opus 4.7 ve sonrası); Max en derin akıl yürütme ve en kapsamlı analiz içindir.
//    Matematik ispatı, zor kodlama, proje planlama, belge analizi ve çok adımlı teknik işlerde effort artırılır.
//  - Anthropic effort belgesi: effort "katı bir bütçe değil, davranış sinyalidir"; düşük seviyede basit
//    sorularda düşünme hiç olmayabilir; effort tüm çıktı tokenlarını (metin, araç, düşünme) etkiler.
//    Varsayılan: Opus 5.5 ve Haiku 5.5'te medium, diğerlerinde high. Sohbet için Sonnet 5.5'te medium/low.
//  - Bu projenin kuralları: iş türü + konu alanı (lib/domain.js) + karmaşıklık + kişisel geri bildirim.
//
// İlke (advisor.js ile aynı): riskli alanlarda (sağlık, hukuk, para) effort düşük önerilmez.

import { MODELS, resolveModel, EFFORT_RATIO } from "./forecast.js";
import { PROFILE } from "./domain.js";

export const LEVELS = ["low", "medium", "high", "xhigh", "max"];
const idx = (l) => LEVELS.indexOf(l);

// Modelin claude.ai'deki effort seçicisi (yoksa null)
export function effortSupport(modelLabel) {
  const m = resolveModel(modelLabel);
  const e = m.info?.eff;
  if (!e) return null;
  return { model: m.key, def: e.def, xhigh: !!e.x, levels: e.x ? LEVELS : LEVELS.filter((l) => l !== "xhigh") };
}

// İş türüne göre başlangıç seviyesi (0 = low, 1 = medium, 2 = high)
// (Anthropic, Sonnet 5.5: iyi tanımlanmış kodlama işinde medium, zorlarda high; sohbette medium/low.)
const BASE = {
  short_qa: 0, translate: 0, rewrite: 0, summarize: 0,
  explain: 1, writing: 1, file_create: 1, data_analysis: 1, code_fix: 1, code_write: 1, research: 1,
  math: 2
};
const LIGHT = new Set(["short_qa", "translate", "rewrite", "summarize"]);
const PROOF = /^(kanıtla|ispatla|türet|prove|proof|derive|derivation|rigorous|kanıt)$/i;

// in: { cls, dom, model, prefs, attachmentTokens }
// out: null (bu modelde effort seçimi yok) ya da { level, why[], model, def, levels }
export function recommendEffort({ cls, dom, model, prefs = null, attachmentTokens = 0 }) {
  const sup = effortSupport(model);
  if (!sup || !cls) return null;
  const why = [];
  const p = PROFILE[dom?.domain] || PROFILE.general;
  const c = cls.complexity || 0;
  let l = BASE[cls.type] ?? 1;
  why.push(l === 0 ? "e_light_type" : l === 1 ? "e_mid_type" : "e_deep_type");

  if (cls.type === "summarize" && attachmentTokens > 20_000) { l += 1; why.push("e_big_doc"); }
  // Kod yazma ve araştırma: sıradan istekte orta, biraz zorlaşınca yüksek
  if ((cls.type === "code_write" || cls.type === "research") && (c >= 0.3 || (cls.signals || []).includes("long"))) { l += 1; why[0] = "e_deep_type"; }
  if (p.stakes >= 2) {
    // Riskli alan: en az orta; ayrıntılı açıklama/araştırma ise bir seviye daha
    why.push("e_stakes");
    if (l < 1) l = 1;
    else if (["explain", "research", "data_analysis"].includes(cls.type) && c >= 0.15) l += 1;
  }
  if (p.depth >= 2 && ["explain", "short_qa", "research", "data_analysis", "writing"].includes(cls.type) && c >= 0.15) { l += 1; why.push("e_depth"); }
  if (p.plan && ["explain", "writing", "file_create"].includes(cls.type)) { l += 1; why.push("e_plan"); }
  else if (p.plan && dom?.sub === "planning" && l < 1) { l = 1; why.push("e_plan"); }
  if (c >= 0.5) { l += 1; why.push("e_complex"); }
  if (c >= 0.85) { l += 1; why.push("e_hardest"); }
  if ((cls.hardWords || []).some((w) => PROOF.test(w)) && l < 2) { l = 2; why.push("e_proof"); }
  if (p.creative && ["writing", "rewrite"].includes(cls.type) && l > 1) { l = 1; why.push("e_creative"); }
  if (p.light && p.stakes < 2 && l > 0) { l -= 1; why.push("e_light_domain"); }
  if ((cls.signals || []).includes("short") && l > 0 && l <= 2 && p.stakes < 2) { l -= 1; why.push("e_short"); }

  // Kişisel ayar (👍/👎 ile öğrenilir): tip başına −1/+1
  const off = prefs?.types?.[cls.type]?.effOff || 0;
  if (off) { l += off; why.push("e_pref"); }
  if (p.stakes >= 2 && l < 1) l = 1; // riskli alanda en az orta

  // Üst seviyeler yalnızca gerektiği yerde:
  //  xhigh → zor kodlama/veri işi (Anthropic: Opus 4.7+ için karmaşık kodlamada önce xhigh dene)
  //  max   → en zor matematik/araştırma/bilim (doğruluk kritik, yavaş)
  const codey = ["code_write", "code_fix", "data_analysis", "file_create"].includes(cls.type);
  const deep = ["math", "research"].includes(cls.type) || p.depth >= 2;
  if (codey && c >= 0.5 && sup.xhigh && l >= 2) { l = Math.max(l, 3); if (!why.includes("e_long_code")) why.push("e_long_code"); }
  if (l >= 4 && !(deep && c >= 0.85)) l = 3;
  if (l === 3 && !(codey && sup.xhigh)) l = deep && c >= 0.85 ? 4 : 2; // xhigh yoksa ya max (en zor) ya high
  l = Math.max(0, Math.min(4, l));
  let level = LEVELS[l];
  if (!sup.levels.includes(level)) level = "high";
  return { level, why: [...new Set(why)].slice(0, 4), model: sup.model, def: sup.def, levels: sup.levels };
}

// Öneri ile şu anki ayarı karşılaştırır. current: normalizeEffort çıktısı (fc.effort), assumed: sayfadan okunamadı.
// breakdown: forecast'teki harcama dökümü (paylar). Dönen: { kind: "ok"|"lower"|"raise", from, to, saving?, extra?, assumed }
export function compareEffort(rec, current, { assumed = false, breakdown = null } = {}) {
  if (!rec) return null;
  const cur = current === "off" ? "low" : LEVELS.includes(current) ? current : rec.def;
  const ci = idx(cur), ri = idx(rec.level);
  const out = { from: cur, to: rec.level, assumed: assumed || !LEVELS.includes(current), why: rec.why, def: rec.def };
  const rCur = EFFORT_RATIO[cur] ?? 0.7, rRec = EFFORT_RATIO[rec.level] ?? 0.7;
  const think = breakdown?.thinking ?? null, outp = breakdown?.output ?? null;
  if (ri < ci) {
    // Daha düşük effort: gizli düşünme payı oranla azalır
    const saving = think !== null && rCur > 0 ? think * (1 - rRec / rCur) : null;
    if (saving !== null && saving < 0.08) return { ...out, kind: "ok", tiny: saving };
    return { ...out, kind: "lower", saving };
  }
  if (ri > ci) {
    if (ri < 2 && ri - ci < 2) return { ...out, kind: "ok" }; // low→medium gibi küçük farklar için uyarı yok
    const extra = outp !== null ? outp * (rRec - rCur) : null;
    return { ...out, kind: "raise", extra };
  }
  return { ...out, kind: "ok" };
}

// 👍/👎 → tip başına effort ayarı (iki kez "yanlış" denince bir seviye kaydırılır)
export function applyEffortFeedback(prefs, { type, kind, good }) {
  const p = structuredClone(prefs || { types: {} });
  p.types ||= {};
  const t = (p.types[type] ||= { votes: {} });
  t.votes ||= {};
  const dir = kind === "raise" ? "eup" : "edown";
  const k = `${dir}_${good ? "good" : "bad"}`;
  t.votes[k] = (t.votes[k] || 0) + 1;
  const bad = t.votes[`${dir}_bad`] || 0, gd = t.votes[`${dir}_good`] || 0;
  if (!good && bad >= 2 && bad > gd) {
    // "düşür" önerisi yanlıştı → bu tipte bir seviye yukarı; "yükselt" gereksizdi → bir seviye aşağı
    t.effOff = Math.max(-1, Math.min(1, (t.effOff || 0) + (dir === "edown" ? 1 : -1)));
    t.votes[`${dir}_bad`] = 0; t.votes[`${dir}_good`] = 0;
  }
  return p;
}

export { MODELS };
