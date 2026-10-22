// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Model danışmanı: yazılan mesaja göre hangi modelin yeteceğini, NEDEN öyle düşündüğünü ve
// ne kadar tasarruf (ya da ek maliyet) çıkacağını hesaplar. Mesaj kutusunun üstündeki
// bildirim (lib/panel.js → banner) bu modülün çıktısını gösterir.
//
// Dayanak (kullanıcıya da gösterilir):
//  1) Anthropic'in model seçme rehberi (platform.claude.com/docs/en/about-claude/models/choosing-a-model):
//     Haiku 5.5  → "en düşük gecikme ve fiyat": gerçek zamanlı, yüksek hacimli, alt görevler
//     Sonnet 5.5 → "günlük işler için hız ve yetenek": kod üretme, veri analizi, içerik yazma
//     Opus 5.5   → "karmaşık ajan kodlama ve kurumsal işler": büyük refactor, sistem mühendisliği
//     Fable 5.1  → "en yüksek yetenek": saatler süren ajan işleri, çok adımlı derin araştırma
//  2) Bu projenin 50 örnekli öneri test seti (tests/rec-cases.json): her örnek için "yeterli" modeller.
//  3) Kullanıcının kendi 👍/👎 geri bildirimi (yerelde tutulur, tip başına alt/üst sınırı kaydırır).
//
// İlke: hafif model önermek, pahalı model önermekten daha kötü bir hatadır (kötü cevap = tekrar
// sorma = daha çok harcama). Haiku yalnızca açıkça basit ve sınıflandırıcının emin olduğu işlerde önerilir.

import { MODELS, RECOMMEND_LABEL, resolveModel, modelWeight } from "./forecast.js";
import { PROFILE } from "./domain.js";
import { recommendEffort, compareEffort } from "./effort.js";

export const TIERS = ["haiku", "sonnet", "opus", "fable"];
const FAMILY_MODEL = { haiku: "haiku 5.5", sonnet: "sonnet 5.5", opus: "opus 5.5", fable: "fable 5.1" };

// Haiku'nun yetebileceği tipler ve kuralları
const HAIKU_TYPES = new Set(["translate", "rewrite", "summarize", "short_qa"]);
// Tip başına en hafif yeterli model (Haiku tipleri burada "sonnet"; Haiku ayrıca kapıdan geçer)
const MIN_TIER = {
  short_qa: "sonnet", translate: "sonnet", rewrite: "sonnet", summarize: "sonnet",
  explain: "sonnet", writing: "sonnet", data_analysis: "sonnet", file_create: "sonnet",
  code_write: "sonnet", code_fix: "sonnet", research: "sonnet", math: "sonnet"
};

// Bildirimde gösterilen tasarrufun anlamlı sayılması için alt sınırlar
export const MIN_SAVING_FRAC = 0.3;      // bu mesajın maliyetinin en az %30'u
export const MIN_SAVING_PCT = 0.02;      // ve 5 saatlik limitin en az %0,02'si

const idx = (t) => TIERS.indexOf(t);

// Haiku kapısı: hepsi sağlanmalı
export function haikuGate(cls, ctx = {}) {
  const reasons = [];
  if (!HAIKU_TYPES.has(cls.type)) reasons.push("type");
  if (cls.confidence === "low") reasons.push("confidence");
  if ((cls.complexity || 0) >= 0.25) reasons.push("complexity");
  if ((cls.words || 0) < 3) reasons.push("too_short");
  if (cls.type === "short_qa" && (cls.words || 0) > 25) reasons.push("long_question");
  if ((cls.signals || []).includes("code")) reasons.push("code");
  if ((ctx.attachmentTokens || 0) > 50_000) reasons.push("big_attachment");
  if ((cls.hardWords || []).length) reasons.push("hard_words");
  // Riskli alan (sağlık, hukuk, para): yanlış cevabın bedeli yüksek → hafif model önerilmez
  if ((PROFILE[ctx.domain]?.stakes || 0) >= 2) reasons.push("stakes");
  return { ok: reasons.length === 0, reasons };
}

// Gerekli en hafif model ailesi + neden anahtarları
export function decideTier(cls, ctx = {}, prefs = null) {
  const why = [];
  let t = MIN_TIER[cls.type] || "sonnet";
  const gate = haikuGate(cls, ctx);
  if (gate.ok) { t = "haiku"; why.push("simple_task"); }
  else if (HAIKU_TYPES.has(cls.type) && gate.reasons.includes("confidence")) why.push("unsure_safe");
  else if (HAIKU_TYPES.has(cls.type) && gate.reasons.includes("stakes")) why.push("stakes");

  const c = cls.complexity || 0;
  if (c >= 0.5 && idx(t) < idx("opus")) { t = "opus"; why.push("complex"); }
  if (c >= 0.85 && ["math", "code_write", "research"].includes(cls.type)) { t = "fable"; why.push("hardest"); }

  // Kişisel ayar (👍/👎): tip başına alt ve üst sınır
  const p = prefs?.types?.[cls.type];
  if (p?.floor && idx(t) < idx(p.floor)) { t = p.floor; why.push("pref_floor"); }
  if (p?.ceil && idx(t) > idx(p.ceil)) { t = p.ceil; why.push("pref_ceil"); }
  return { tier: t, why, gate };
}

// Gördüğü işaretler (kullanıcıya "neye baktım" diye gösterilir). i18n anahtarı + parametreler.
export function evidence(cls, ctx = {}) {
  const ev = [];
  if (cls.hits?.length) ev.push({ key: "ev_trigger", params: [cls.hits.slice(0, 2).map((h) => `“${h}”`).join(", ")] });
  if (cls.hardWords?.length) ev.push({ key: "ev_hard", params: [cls.hardWords.slice(0, 3).map((h) => `“${h}”`).join(", ")] });
  if ((cls.signals || []).includes("code")) ev.push({ key: "ev_code", params: [] });
  if ((ctx.attachmentTokens || 0) > 0) ev.push({ key: "ev_attach", params: [Math.round(ctx.attachmentTokens)] });
  if ((cls.bullets || 0) >= 3) ev.push({ key: "ev_bullets", params: [cls.bullets] });
  if ((cls.signals || []).includes("long")) ev.push({ key: "ev_long", params: [] });
  if ((cls.signals || []).includes("short")) ev.push({ key: "ev_short", params: [] });
  if (cls.source === "model" && Number.isFinite(cls.modelProb)) ev.push({ key: "ev_ml", params: [String(Math.min(99, Math.round(cls.modelProb * 100)))] });
  if (ctx.dom?.hits?.length && ctx.dom.domain !== "general") ev.push({ key: "ev_domain", params: [ctx.dom.hits.slice(0, 2).map((h) => `“${h}”`).join(", ")] });
  ev.push({ key: "ev_words", params: [cls.words || 0] });
  return ev.slice(0, 5);
}

export function complexityLevel(c) { return c >= 0.5 ? "high" : c >= 0.25 ? "mid" : "low"; }

// Ana fonksiyon.
// in: { cls, fc, currentModel, historyTokens, cacheWarm, attachmentTokens, prefs, analyzing, emptyPrompt }
// out: null (bildirim yok) ya da { kind, current, suggested, tier, curTier, savingFrac, savedPct, extraFrac,
//        switchExtraTokens, level, confidence, type, evidence, why, basisKey, whenKey, gate }
function adviseModel(inp) {
  const { cls, fc } = inp;
  if (!cls || !fc || inp.emptyPrompt || inp.analyzing) return null;
  if ((cls.words || 0) < 3 && !(inp.attachmentTokens > 0)) return null; // "teşekkürler", "devam et"

  const cur = resolveModel(inp.currentModel);
  if (!cur.info) return null;
  const curTier = cur.info.family;
  const dom = inp.dom || null;
  const d = decideTier(cls, { attachmentTokens: inp.attachmentTokens || 0, domain: dom?.domain }, inp.prefs);
  const sugKey = FAMILY_MODEL[d.tier];
  const sug = MODELS[sugKey];

  const promptAll = fc.context?.usedLow || 0;
  const wCur = modelWeight(cur.info, promptAll), wSug = modelWeight(sug, promptAll);
  const base = (fc.cost?.mid || 0) / Math.max(1e-9, fc.weight || wCur); // modelden bağımsız birim
  const sessMid = fc.pct?.session?.mid || 0;
  const unitPct = base > 0 ? sessMid / (base * wCur) : 0; // 1 maliyet birimi = limitin yüzde kaçı

  const out = {
    current: cur.key ? cap(cur.key) : RECOMMEND_LABEL[curTier],
    suggested: RECOMMEND_LABEL[d.tier], tier: d.tier, curTier,
    type: cls.type, confidence: cls.confidence, level: complexityLevel(cls.complexity || 0),
    evidence: evidence(cls, { attachmentTokens: inp.attachmentTokens || 0, dom }),
    domain: dom ? { domain: dom.domain, sub: dom.sub, second: dom.second, confidence: dom.confidence } : null,
    why: d.why, gate: d.gate,
    basisKey: `basis_${d.tier}`, typeBasisKey: `tbasis_${cls.type}`, whenKey: `when_${d.tier}`,
    curPct: sessMid
  };

  const ci = idx(curTier), si = idx(d.tier);
  if (si === ci) return { ...out, kind: "ok" };

  if (si > ci) {
    // Daha güçlü model gerekli: maliyet artışı bilgi olarak verilir
    return { ...out, kind: "upgrade", extraFrac: wSug / wCur - 1, sugPct: base * wSug * unitPct };
  }

  // Daha hafif model yeter
  const savingFrac = 1 - wSug / wCur;
  const savedPct = sessMid * savingFrac;
  // Bu sohbette model değiştirmek: geçmiş yeni modelin önbelleğinde yok → baştan okunur
  const hist = inp.historyTokens || 0;
  const switchExtra = inp.cacheWarm && hist > 0 ? hist : 0;
  const costStay = base * wCur;
  const costSwitch = (base + switchExtra) * wSug;
  if (switchExtra > 0 && costSwitch >= costStay * 0.9) {
    return { ...out, kind: "save_next", savingFrac, savedPct, switchExtraTokens: switchExtra, switchPct: costSwitch * unitPct };
  }
  if (savingFrac < MIN_SAVING_FRAC || savedPct < MIN_SAVING_PCT) {
    return { ...out, kind: "ok", tinySaving: { model: RECOMMEND_LABEL[d.tier], savedPct } };
  }
  const netFrac = 1 - costSwitch / costStay;
  return { ...out, kind: "save", savingFrac: netFrac, savedPct: sessMid * netFrac, sugPct: costSwitch * unitPct, switchExtraTokens: switchExtra };
}

// Ana fonksiyon: model önerisi + effort önerisi.
// Effort, kullanılacak model için hesaplanır: model değişikliği öneriliyorsa önerilen modelde, değilse mevcut modelde.
export function advise(inp) {
  const res = adviseModel(inp);
  if (!res) return null;
  try {
    const switching = res.kind === "save" || res.kind === "upgrade";
    const target = switching ? FAMILY_MODEL[res.tier] : inp.currentModel;
    const rec = recommendEffort({ cls: inp.cls, dom: inp.dom, model: target, prefs: inp.prefs, attachmentTokens: inp.attachmentTokens || 0 });
    if (rec) {
      res.effort = switching
        ? { kind: "with_switch", to: rec.level, why: rec.why, def: rec.def, model: RECOMMEND_LABEL[res.tier] }
        : compareEffort(rec, inp.effort, { assumed: !!inp.effortAssumed, breakdown: inp.fc?.breakdown });
      if (res.effort && Number.isFinite(res.curPct)) {
        if (res.effort.saving != null) res.effort.savedPct = res.curPct * res.effort.saving;
        if (res.effort.extra != null) res.effort.extraPct = res.curPct * res.effort.extra;
      }
    } else res.effort = null;
  } catch (_) { res.effort = null; }
  return res;
}

function cap(key) { return key.replace(/\b\w/g, (c) => c.toUpperCase()); }

// ---------- 👍/👎 geri bildirimi → kişisel sınırlar ----------
// prefs: { types: { [type]: { floor?, ceil?, votes: { down_bad, down_good, up_bad, up_good } } } }
// "down" = daha hafif model önerisi, "up" = daha güçlü model önerisi.
export function applyFeedback(prefs, { type, kind, tier, curTier, good }) {
  const p = structuredClone(prefs || { types: {} });
  p.types ||= {};
  const t = (p.types[type] ||= { votes: {} });
  t.votes ||= {};
  if (kind === "ok") return p; // "uygun" bildiriminde geri bildirim düğmesi yok
  const dir = kind === "upgrade" ? "up" : "down";
  const k = `${dir}_${good ? "good" : "bad"}`;
  t.votes[k] = (t.votes[k] || 0) + 1;
  const bad = t.votes[`${dir}_bad`] || 0, gd = t.votes[`${dir}_good`] || 0;
  if (!good && bad >= 2 && bad > gd) {
    if (dir === "down") {
      // Hafif öneri iki kez yanlış: bu tip için önerilen modelin bir üstü taban olsun
      const next = TIERS[Math.min(TIERS.length - 1, idx(tier) + 1)];
      if (!t.floor || idx(next) > idx(t.floor)) t.floor = next;
      if (t.ceil && idx(t.ceil) < idx(t.floor)) delete t.ceil;
    } else if (dir === "up") {
      // Güçlü model önerisi iki kez gereksiz: bu tip için tavan, kullanıcının kullandığı model olsun
      if (!t.ceil || idx(curTier) < idx(t.ceil)) t.ceil = curTier;
      if (t.floor && idx(t.floor) > idx(t.ceil)) delete t.floor;
    }
    t.votes[`${dir}_bad`] = 0; t.votes[`${dir}_good`] = 0; // ayar yapıldı, sayaç sıfırlanır
  }
  return p;
}
