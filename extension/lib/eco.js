// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// "Kurtarılan su ve enerji": kaçınılan işlemi (maliyet birimi) fiziksel karşılıklara çevirir.
// Bütün fonksiyonlar saftır; birim testleri tests/eco.test.mjs.
//
// Hesap (hepsi TAHMİN; Anthropic, Claude için enerji ve su rakamı yayımlamıyor):
//
//   token = kaçınılan işlem ÷ 10          (Sonnet 5.5 çıktı tokenı eşdeğeri)
//   E     = token × e_token               (enerji)
//   W     = E × WUE                       (su: veri merkezi soğutması + elektrik üretimi)
//
// "Kaçınılan işlem" eklentinin kendi maliyet birimidir (forecast.js: ağırlık × [girdi + 5 × çıktı]).
// 1 Sonnet 5.5 çıktı tokenı = 2 × 5 = 10 birim. Model başına enerjinin limit ağırlığıyla (API fiyatı)
// orantılı olduğu VARSAYILIR; sitedeki "Doğa" bölümü de aynı varsayımı kullanır.
//
// Katsayıların kaynağı:
//   e_token düşük 0,6 mWh : Epoch AI (J. You, 7.2.2025) "How much energy does ChatGPT use?":
//                           GPT-4o, 500 çıktı tokenlı tipik sorgu ≈ 0,3 Wh.
//   e_token yüksek 3,0 mWh: Jegham ve ark. 2025, arXiv:2505.09598v5, Tablo 4: Claude 3.7 Sonnet
//                           0,950 Wh (100 girdi / 300 çıktı), 2,989 Wh (1.000 / 1.000).
//   e_token orta 1,3 mWh  : ikisinin geometrik ortası (ölçüm değil).
//   Karşılaştırma: Google 2025, arXiv:2508.15734: medyan Gemini istemi 0,24 Wh (token sayısı açıklanmadı).
//   WUE düşük 3,6 L/kWh   : Li ve ark. 2023, arXiv:2304.03271 (CACM 2025), ABD ortalaması:
//                           yerinde 0,55 + elektrik üretimi 3,14 L/kWh.
//   WUE orta 4,2 L/kWh    : Google'ın yerinde değeri 1,15 L/kWh (arXiv:2508.15734, PUE 1,09) + 3,14.
//   WUE yüksek 5,3 L/kWh  : Jegham ve ark., Tablo 1, Anthropic/AWS: yerinde 0,18 (PUE 1,14) + 5,11.
//   Su = E × (WUE_yerinde ÷ PUE + WUE_elektrik); E veri merkezi düzeyindeki enerjidir.

import { MODELS } from "./forecast.js";

export const UNITS_PER_TOKEN = MODELS["sonnet 5.5"].weight * 5;
export const E_TOKEN_MWH = { low: 0.6, mid: 1.3, high: 3.0 };
export const WUE_L_PER_KWH = { low: 3.6, mid: 4.2, high: 5.3 };

// Fiziksel karşılıklar (küçükten büyüğe).
//   damla 0,05 mL: metrik damla (1 mL = 20 damla) · çay kaşığı 5 mL: ABD 21 CFR 101.9(b)(5)(viii)
//   su bardağı 250 mL, şişe 0,5 L, kova 10 L: anma boyutu (tanım) · küvet 136 L: USGS Water Science School
//   ("a full tub ... 36 gallons").
export const WATER_UNITS = [
  { key: "drop", ml: 0.05 }, { key: "tsp", ml: 5 }, { key: "glass", ml: 250 },
  { key: "bottle", ml: 500 }, { key: "bucket", ml: 10_000 }, { key: "tub", ml: 136_000 }
];
//   LED 9 W ≈ 800 lümen: US FTC "Shopping for Light Bulbs" (Ağustos 2023); birim = 1 dakika yanma.
//   telefon şarjı 19 Wh: US EPA Greenhouse Gas Equivalencies Calculator (0,019 kWh / şarj; US DOE 2024).
//   çaydanlık 93 Wh: 1 L suyu 20 °C'den 100 °C'ye ısıtmak, Q = m·c·ΔT, c = 4,186 kJ/(kg·K), kayıpsız.
export const LED_WATT = 9;
export const ENERGY_UNITS = [
  { key: "led", wh: LED_WATT / 60 }, { key: "phone", wh: 19 }, { key: "kettle", wh: 93 }
];

const ZERO_TOKENS = 0.5; // yarım tokendan küçük fark "sıfır" sayılır
const map3 = (r, f) => ({ low: f(r.low, "low"), mid: f(r.mid, "mid"), high: f(r.high, "high") });

export const tokensEq = (units) => (Number.isFinite(units) ? units / UNITS_PER_TOKEN : 0);
// Wh (düşük / orta / yüksek)
export const energyWh = (tokens) => map3(E_TOKEN_MWH, (e) => (tokens * e) / 1000);
// mL: Wh × L/kWh = mL. Alt uç = düşük enerji × düşük WUE, üst uç = yüksek × yüksek (en geniş aralık).
export const waterMl = (wh) => map3(WUE_L_PER_KWH, (w, k) => wh[k] * w);

// Miktara göre birim: orta değer en az 1 birim eden en büyük birim (hiçbiri etmiyorsa en küçüğü).
function pick(units, range, size) {
  let u = units[0];
  for (const x of units) if (range.mid / x[size] >= 1) u = x;
  return { key: u.key, size: u[size], count: map3(range, (v) => v / u[size]) };
}
export const pickWaterUnit = (ml) => pick(WATER_UNITS, ml, "ml");
// LED için count = dakika
export const pickEnergyUnit = (wh) => pick(ENERGY_UNITS, wh, "wh");

// İşaretli maliyet birimi → gösterim modeli. Negatifte büyüklükler mutlak değerdir ("fazladan").
export function ecoFromUnits(units) {
  const u = Number.isFinite(units) ? units : 0;
  const tokens = Math.abs(u) / UNITS_PER_TOKEN;
  const sign = tokens < ZERO_TOKENS ? "zero" : u > 0 ? "pos" : "neg";
  const energy = energyWh(sign === "zero" ? 0 : tokens), water = waterMl(energy);
  return { sign, units: u, tokens: sign === "zero" ? 0 : tokens, energy, water,
    waterUnit: pickWaterUnit(water), energyUnit: pickEnergyUnit(energy) };
}

// ---------- Gönderim anı: taslağın başındaki ayar ↔ gönderilen ayar ----------
const TIER = ["haiku", "sonnet", "opus", "fable"];
const EFF = ["low", "medium", "high", "xhigh", "max"];
const effIdx = (e) => (e === "off" ? 0 : EFF.indexOf(e));
export const effortBelow = (a, b) => effIdx(a) >= 0 && effIdx(b) >= 0 && effIdx(a) < effIdx(b);

// base / cur: { model, tier, effort, effRead }   (taslağın ilk hali / gönderilen hali)
// floor: { tier, model, effort } | null           gönderim anında eklentinin önerdiği seviye
// saw:   { save, lower }                          bu taslakta "daha hafif model" / "daha düşük effort" önerisi gösterildi mi
// costOf(model, effort) → maliyet birimi; switchUnits(model) → sohbet ortasında model değişince baştan okunan geçmiş
// Dönen: null (karşılaştırılamaz) ya da { u (işaretli; + = kaçınılan, − = fazladan), k: null | "model" | "effort" | "both" }
//
// Kural: daha HAFİF ayara geçiş yalnızca eklenti önerdiyse ve önerilen seviyeye kadar sayılır (önerilenden de hafife
// inmek "tasarruf" diye kutlanmaz: hafif model önermek en kötü hata). Daha AĞIR ayara geçiş her zaman düşülür.
export function draftDelta({ base, cur, floor = null, saw = null, costOf, switchUnits = () => 0 }) {
  if (!base || !cur) return null;
  const bt = TIER.indexOf(base.tier), ct = TIER.indexOf(cur.tier);
  if (bt < 0 || ct < 0) return null;
  let tier = bt, model = base.model;
  if (ct > bt) { tier = ct; model = cur.model; }
  else if (ct < bt && saw?.save && floor?.tier) {
    const credit = Math.max(ct, TIER.indexOf(floor.tier));
    if (credit < bt) { tier = credit; model = credit === ct ? cur.model : floor.model; }
  }
  let effort = base.effort;
  const be = effIdx(base.effort), ce = effIdx(cur.effort);
  if (base.effRead && cur.effRead && be >= 0 && ce >= 0) {
    if (ce > be) effort = cur.effort;
    else if (ce < be && saw?.lower && floor?.effort) {
      const credit = Math.max(ce, effIdx(floor.effort));
      if (credit < be) effort = EFF[credit];
    }
  }
  const mCh = tier !== bt, eCh = effort !== base.effort;
  if (!mCh && !eCh) return { u: 0, k: null };
  const u0 = costOf(base.model, base.effort);
  const u1 = costOf(model, effort) + (mCh ? switchUnits(model) || 0 : 0);
  if (!Number.isFinite(u0) || !Number.isFinite(u1)) return null;
  return { u: u0 - u1, k: mCh && eCh ? "both" : mCh ? "model" : "effort" };
}

// ---------- Toplamlar ----------
// Kayıt alanı: ecoU (işaretli maliyet birimi; alan yoksa o gönderim sayılmamıştır), ecoK (ne değişti).
const tracked = (x) => x && Number.isFinite(x.ecoU);
function tally(list) {
  const o = { n: list.length, tracked: 0, gainU: 0, gainN: 0, extraU: 0, extraN: 0, netU: 0 };
  for (const x of list) {
    if (!tracked(x)) continue;
    o.tracked++;
    if (x.ecoU > 0) { o.gainU += x.ecoU; o.gainN++; } else if (x.ecoU < 0) { o.extraU -= x.ecoU; o.extraN++; }
  }
  o.netU = o.gainU - o.extraU;
  return o;
}
const DAY = 864e5;
// Son 7 gün
export function ecoWeek(sends, now = Date.now()) {
  const wk = (sends || []).filter((x) => x && Number.isFinite(x.at) && x.at > now - 7 * DAY && x.at <= now);
  const t = tally(wk);
  return { ...t, view: ecoFromUnits(t.netU) };
}

// "Kurduğundan beri" sayacı (chrome.storage.local "eco"): gönderim kayıtları 70 günde silindiği için ayrı tutulur.
export function ecoAccumulate(total, entry, now = Date.now()) {
  const t = total && total.v === 1 ? { ...total } : { v: 1, since: now, n: 0, gainU: 0, gainN: 0, extraU: 0, extraN: 0 };
  if (!tracked(entry)) return t;
  t.n++;
  if (entry.ecoU > 0) { t.gainU += entry.ecoU; t.gainN++; } else if (entry.ecoU < 0) { t.extraU -= entry.ecoU; t.extraN++; }
  return t;
}
export function ecoTotalView(total) {
  if (!total || total.v !== 1 || !Number.isFinite(total.since)) return null;
  const netU = (total.gainU || 0) - (total.extraU || 0);
  return { since: total.since, n: total.n || 0, gainN: total.gainN || 0, extraN: total.extraN || 0, netU, view: ecoFromUnits(netU) };
}

// CSV için: bir kaydın token eşdeğeri, enerji ve su aralığı (işaretli; sayılmamış kayıtta boş)
export function ecoCsvCells(x) {
  if (!tracked(x)) return ["", "", "", "", "", "", "", ""];
  const s = x.ecoU < 0 ? -1 : 1, tok = Math.abs(x.ecoU) / UNITS_PER_TOKEN;
  const e = energyWh(tok), w = waterMl(e);
  const r = (v) => Math.round(s * v * 1000) / 1000 || 0;
  return [Math.round(s * tok) || 0, x.ecoK || "", r(e.low), r(e.mid), r(e.high), r(w.low), r(w.mid), r(w.high)];
}
export const ECO_CSV_COLS = ["avoided_tokens_eq", "avoided_by", "energy_wh_low", "energy_wh_mid", "energy_wh_high", "water_ml_low", "water_ml_mid", "water_ml_high"];
