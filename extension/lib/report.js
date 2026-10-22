// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Haftalık rapor, harcama hızı ve "neden bu kadar harcadı?" açıklaması.
//
// Girdi: chrome.storage.local'daki "sends" listesi. Her kayıt bir gönderimdir ve METİN İÇERMEZ:
//   { id, at, conv, fam, model, type, eff, peak, cache, hist, pred, predLo, predHi, predW,
//     adv: { k, t } | null, save, d, dw, out, outHi, ok,
//     dom, sub (konu alanı), effRec (önerilen effort), effAs (effort okunamadı, varsayılan sayıldı), effSave }
//   pred*: gönderim anındaki tahmin (5 saatlik limit yüzdesi; predW haftalık), d / dw: ölçülen fark.
// Bütün fonksiyonlar saftır (yan etkisiz), birim testlerinde doğrudan denenir.

import { isPeak, peakWindow } from "./forecast.js";

export const SENDS_MAX = 2000;
export const SENDS_DAYS = 70;
const DAY = 864e5;

// Kayıt listesini sınırlar içinde tutar (en eski önce silinir)
export function trimSends(list, now = Date.now()) {
  const cut = now - SENDS_DAYS * DAY;
  const out = list.filter((x) => x && x.at >= cut);
  return out.length > SENDS_MAX ? out.slice(out.length - SENDS_MAX) : out;
}

const spentOf = (x) => (Number.isFinite(x.d) ? x.d : x.pred || 0);
const spentWOf = (x) => (Number.isFinite(x.dw) ? x.dw : x.predW || 0);
const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
const LIGHT_TYPES = new Set(["short_qa", "translate", "rewrite", "summarize"]);

// Bir mesaj neden pahalıydı? (rapor ve "beklenenden fazla" uyarısı ortak kullanır)
export function costReasons(x) {
  const r = [];
  if (x.cache === "cold" && (x.hist || 0) > 5000) r.push("cold");
  if ((x.hist || 0) > 100_000) r.push("long_chat");
  if (x.peak) r.push("peak");
  if (x.eff === "high" || x.eff === "xhigh" || x.eff === "max") r.push("effort");
  if (x.out && x.outHi && x.out > x.outHi) r.push("long_answer");
  if (x.fam === "opus" || x.fam === "fable") r.push("big_model");
  return r;
}

// Ölçülen değer tahmin aralığının çok üstündeyse açıklama üretir (yoksa null)
export function surprise(x) {
  if (!Number.isFinite(x.d) || !Number.isFinite(x.predHi)) return null;
  const limit = Math.max(x.predHi * 1.5, x.predHi + 1.5);
  if (x.d < 2 || x.d <= limit) return null;
  const reasons = costReasons(x).filter((k) => k !== "big_model");
  reasons.push("elsewhere"); // aynı hesap başka sekmede, cihazda ya da Claude Code'da kullanılmış olabilir
  return { at: x.at, d: x.d, lo: x.predLo ?? 0, hi: x.predHi, reasons };
}

// Harcama hızı: mevcut 5 saatlik pencerede son ~60 dakikanın eğimi → bu hızla ne zaman dolar?
// hist: [{ at, p5, r5 }] (p5: 5 saatlik yüzde, r5: yenilenme zamanı)
export function burnRate(hist, now = Date.now(), { lookbackMin = 60, minSpanMin = 8 } = {}) {
  if (!Array.isArray(hist) || hist.length < 2) return null;
  const last = hist[hist.length - 1];
  if (!Number.isFinite(last?.p5) || now - last.at > 20 * 60000) return null; // veri bayat
  const same = hist.filter((h) => Number.isFinite(h.p5) && h.at >= now - lookbackMin * 60000 &&
    (!h.r5 || !last.r5 || Math.abs(h.r5 - last.r5) < 3 * 60000));
  if (same.length < 2) return null;
  const first = same[0];
  const spanMin = (last.at - first.at) / 60000;
  if (spanMin < minSpanMin) return null;
  const rise = last.p5 - first.p5;
  const perHour = (rise / spanMin) * 60;
  if (!(rise > 0.5) || !(perHour > 0)) return { perHour: 0, eta: null, beforeReset: false, idle: true };
  const eta = last.at + ((100 - last.p5) / perHour) * 3600e3;
  const beforeReset = !last.r5 || eta < last.r5;
  return { perHour, eta, beforeReset, idle: false, resetsAt: last.r5 || null };
}

// Haftanın günü: Pazartesi = 0
const dow = (d) => (d.getDay() + 6) % 7;

// Ana fonksiyon: son 7 günün özeti + önceki 7 günle karşılaştırma + son 28 günün saat haritası
export function weeklyReport(sends, now = Date.now()) {
  const all = (sends || []).filter((x) => x && Number.isFinite(x.at));
  const wk = all.filter((x) => x.at > now - 7 * DAY && x.at <= now);
  const prev = all.filter((x) => x.at > now - 14 * DAY && x.at <= now - 7 * DAY);
  const heatSrc = all.filter((x) => x.at > now - 28 * DAY && x.at <= now);

  const n = wk.length;
  const spent = sum(wk, spentOf), spentW = sum(wk, spentWOf);
  const measured = wk.filter((x) => Number.isFinite(x.d));

  const group = (key) => {
    const m = new Map();
    for (const x of wk) {
      const k = x[key] || "unknown";
      const g = m.get(k) || { key: k, n: 0, spent: 0 };
      g.n++; g.spent += spentOf(x); m.set(k, g);
    }
    return [...m.values()].sort((a, b) => b.spent - a.spent || b.n - a.n)
      .map((g) => ({ ...g, share: spent > 0 ? g.spent / spent : 0 }));
  };

  // Anahtarı bir fonksiyonla üretilen gruplama (alan|alt başlık gibi); boş anahtarlar atlanır
  const groupBy = (keyOf) => {
    const m = new Map();
    for (const x of wk) { const k = keyOf(x); if (!k) continue; const g = m.get(k) || { key: k, n: 0, spent: 0 }; g.n++; g.spent += spentOf(x); m.set(k, g); }
    return [...m.values()].sort((a, b) => b.spent - a.spent || b.n - a.n).map((g) => ({ ...g, share: spent > 0 ? g.spent / spent : 0 }));
  };

  const peakList = wk.filter((x) => x.peak);
  const peakSpent = sum(peakList, spentOf);
  const coldList = wk.filter((x) => x.cache === "cold" && (x.hist || 0) > 5000);
  const longList = wk.filter((x) => (x.hist || 0) > 100_000);
  const effLight = wk.filter((x) => LIGHT_TYPES.has(x.type) && (x.eff === "high" || x.eff === "xhigh" || x.eff === "max"));
  // Effort önerilenden yüksek olan mesajlar (öneri kaydı olanlar) ve kaçırılan tasarruf
  const EL = ["low", "medium", "high", "xhigh", "max"];
  const effOver = wk.filter((x) => x.effRec && EL.indexOf(x.eff) > EL.indexOf(x.effRec));
  const effOverPot = sum(effOver, (x) => x.effSave || 0);
  const stakesN = wk.filter((x) => x.dom === "health" || x.dom === "law" || x.dom === "finance").length;
  const saveList = wk.filter((x) => x.adv?.k === "save");
  const savePot = sum(saveList, (x) => x.save || 0);
  const upList = wk.filter((x) => x.adv?.k === "upgrade");
  const okList = wk.filter((x) => x.adv?.k === "ok");
  const advised = wk.filter((x) => x.adv);

  // Tahmin isabeti: ölçülenlerin kaçı %80 aralığa (yuvarlama payı ±1) düştü?
  const inRange = measured.filter((x) => x.d >= Math.floor(x.predLo ?? 0) - 1 && x.d <= Math.ceil(x.predHi ?? x.pred ?? 0) + 1).length;

  // En pahalı 3 mesaj
  const top = [...wk].sort((a, b) => spentOf(b) - spentOf(a)).slice(0, 3)
    .filter((x) => spentOf(x) > 0)
    .map((x) => ({ at: x.at, fam: x.fam, model: x.model, type: x.type, dom: x.dom || null, eff: x.eff || null, spent: spentOf(x), measured: Number.isFinite(x.d), reasons: costReasons(x) }));

  // Saat haritası (yerel saat): 7 gün × 24 saat, son 28 gün
  const heat = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (const x of heatSrc) { const d = new Date(x.at); heat[dow(d)][d.getHours()]++; }
  const heatMax = Math.max(0, ...heat.flat());
  // Yoğun saat hücreleri (yerel saate çevrilmiş): bugünkü pencereyi saat olarak al
  const pw = peakWindow(new Date(now));
  const pStart = new Date(pw.start), pEnd = new Date(pw.end);
  const peakHours = { start: pStart.getHours() + pStart.getMinutes() / 60, end: pEnd.getHours() + pEnd.getMinutes() / 60 };

  // Öneriler (öncelik sırasıyla; arayüz ilk 4'ünü gösterir)
  const tips = [];
  const peakShare = spent > 0 ? peakSpent / spent : 0;
  if (n >= 5 && peakShare >= 0.25) tips.push({ key: "tip_peak", params: [Math.round(peakShare * 100)], weight: peakShare });
  if (coldList.length >= 2) tips.push({ key: "tip_cold", params: [coldList.length, Math.round(100 * sum(coldList, spentOf) / Math.max(1e-9, spent))], weight: sum(coldList, spentOf) / Math.max(1e-9, spent) });
  if (savePot >= 2) tips.push({ key: "tip_advice", params: [Math.round(savePot * 10) / 10, saveList.length], weight: savePot / Math.max(1, spent) });
  if (longList.length >= 3) tips.push({ key: "tip_long", params: [longList.length], weight: longList.length / Math.max(1, n) });
  if (effOver.length >= 3 && effOverPot >= 1) tips.push({ key: "tip_effort_over", params: [effOver.length, Math.round(effOverPot * 10) / 10], weight: effOverPot / Math.max(1, spent) + 0.01 });
  else if (effLight.length >= 3) tips.push({ key: "tip_effort", params: [effLight.length], weight: effLight.length / Math.max(1, n) });
  // Tasarruf fırsatı tek bir alanda yoğunlaşmışsa söyle
  if (savePot >= 2) {
    const byDom = {};
    for (const x of saveList) if (x.dom && x.dom !== "general") { const g = (byDom[x.dom] ||= { n: 0, s: 0 }); g.n++; g.s += x.save || 0; }
    const best = Object.entries(byDom).sort((a, b) => b[1].s - a[1].s)[0];
    if (best && best[1].s >= 0.5 * savePot && best[1].n >= 2) tips.push({ key: "tip_domain_save", params: [best[0], best[1].n], weight: 0.04 });
  }
  if (stakesN >= 3) tips.push({ key: "tip_domain_stakes", params: [stakesN], weight: 0.02 });
  if (upList.length >= 3) tips.push({ key: "tip_upgrade", params: [upList.length], weight: 0.05 });
  tips.sort((a, b) => b.weight - a.weight);
  if (!tips.length && n >= 5) tips.push({ key: "tip_good", params: [], weight: 0 });

  const change = (a, b) => (b > 0 ? (a - b) / b : null);
  return {
    from: now - 7 * DAY, to: now,
    n, nPrev: prev.length, nChange: change(n, prev.length),
    spent, spentPrev: sum(prev, spentOf), spentChange: change(spent, sum(prev, spentOf)),
    spentW, measuredShare: n ? measured.length / n : 0,
    sessionsEq: spent / 100, // kaç tam 5 saatlik limit
    chats: new Set(wk.map((x) => x.conv).filter(Boolean)).size,
    byFam: group("fam"), byType: group("type").slice(0, 6),
    byDomain: group("dom").slice(0, 8),
    bySub: groupBy((x) => (x.dom && x.sub ? `${x.dom}|${x.sub}` : null)).slice(0, 12),
    byEffort: group("eff"),
    effort: { over: effOver.length, overPot: effOverPot, assumed: wk.filter((x) => x.effAs).length },
    peak: { n: peakList.length, share: peakShare, nShare: n ? peakList.length / n : 0 },
    cold: { n: coldList.length, spent: sum(coldList, spentOf) },
    long: { n: longList.length },
    advice: { advised: advised.length, save: saveList.length, savePot, upgrade: upList.length, ok: okList.length,
      okShare: advised.length ? okList.length / advised.length : null },
    accuracy: { measured: measured.length, inRange, share: measured.length ? inRange / measured.length : null },
    learning: learningCurve(all),
    top, heat, heatMax, heatDays: 28, peakHours,
    tips: tips.slice(0, 4),
    enough: n >= 3
  };
}


// Öğrenme kanıtı: art arda 10 ölçülen mesajlık gruplar; her grupta tahmin edilen toplam limit, gerçekte harcananın kaç katı uzakta.
// (Yüzdeler tam sayıya yuvarlandığı için tek tek mesaj değil grup toplamı alınır; 1,00 = kusursuz.)
export function learningCurve(sends, batch = 10) {
  const m = (sends || []).filter((x) => x && Number.isFinite(x.at) && Number.isFinite(x.d) && Number.isFinite(x.pred) && x.d >= 0).sort((a, b) => a.at - b.at);
  const curve = [];
  for (let i = 0; i + batch <= m.length; i += batch) {
    const g = m.slice(i, i + batch);
    const p = sum(g, (x) => x.pred), d = sum(g, (x) => x.d);
    const factor = Math.exp(Math.abs(Math.log(Math.max(0.5, p) / Math.max(0.5, d))));
    const inR = g.filter((x) => x.d >= Math.floor(x.predLo ?? 0) - 1 && x.d <= Math.ceil(x.predHi ?? x.pred ?? 0) + 1).length;
    curve.push({ from: i + 1, to: i + batch, at: g.at(-1).at, factor, inRange: inR / batch, pred: p, spent: d });
  }
  const out = { measured: m.length, batch, curve, verdict: "few", first: null, last: null };
  if (m.length >= 30) {
    // İlk 10 ölçüm (öğrenme en çok burada olur) ↔ son 20 ölçüm (tek bir gürültülü grup yargıyı belirlemesin)
    const stat = (g) => {
      const p = sum(g, (x) => x.pred), d = sum(g, (x) => x.d);
      return { factor: Math.exp(Math.abs(Math.log(Math.max(0.5, p) / Math.max(0.5, d)))),
        inRange: g.filter((x) => x.d >= Math.floor(x.predLo ?? 0) - 1 && x.d <= Math.ceil(x.predHi ?? x.pred ?? 0) + 1).length / g.length };
    };
    out.first = stat(m.slice(0, 10)); out.last = stat(m.slice(-20));
    const ratio = out.last.factor / out.first.factor;
    out.verdict = ratio < 0.87 ? "better" : ratio > 1.15 ? "worse" : "same";
  }
  return out;
}

// Bir sonraki Pazartesi 09:00 (yerel) — haftalık bildirim zamanı
export function nextWeeklyAt(now = Date.now(), hour = 9) {
  const d = new Date(now);
  const add = (7 - dow(d)) % 7;
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + add, hour, 0, 0, 0);
  if (t.getTime() <= now) t.setDate(t.getDate() + 7);
  return t.getTime();
}

// CSV dışa aktarma (metin yok; yalnızca sayılar ve etiketler)
export function sendsCsv(sends) {
  const cols = ["at", "model", "type", "domain", "subdomain", "effort", "effort_suggested", "peak", "cache", "history_tokens", "pred_pct", "pred_low", "pred_high", "measured_pct", "weekly_pred_pct", "weekly_measured_pct", "advice", "advice_model"];
  const rows = (sends || []).map((x) => [new Date(x.at).toISOString(), x.model || "", x.type || "", x.dom || "", x.sub || "", x.eff || "", x.effRec || "", x.peak ? 1 : 0, x.cache || "", Math.round(x.hist || 0),
    r2(x.pred), r2(x.predLo), r2(x.predHi), Number.isFinite(x.d) ? x.d : "", r2(x.predW), Number.isFinite(x.dw) ? x.dw : "", x.adv?.k || "", x.adv?.t || ""]);
  return [cols, ...rows].map((r) => r.join(",")).join("\n");
}
const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : "");

export { isPeak };
