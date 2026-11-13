// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// "Kurtarılan su ve enerji" dönüşümü için sabit girdili birim testleri (lib/eco.js):
// katsayılar, birim seçimi, aralık, sıfır/negatif, taslak farkı kuralı, toplamlar, CSV.
import { UNITS_PER_TOKEN, E_TOKEN_MWH, WUE_L_PER_KWH, WATER_UNITS, ENERGY_UNITS, LED_WATT, tokensEq, energyWh, waterMl,
  pickWaterUnit, pickEnergyUnit, ecoFromUnits, draftDelta, effortBelow, ecoWeek, ecoAccumulate, ecoTotalView, ecoCsvCells, ECO_CSV_COLS } from "../extension/lib/eco.js";
import { realizedCost, forecastMessage } from "../extension/lib/forecast.js";
import { sendsCsv } from "../extension/lib/report.js";
let fail = 0;
const t = (name, cond, info = "") => { console.log(`${cond ? "✓" : "✗"} ${name}${info ? " — " + info : ""}`); if (!cond) fail++; };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));

// ---------- Katsayılar ----------
t("1 Sonnet 5.5 çıktı tokenı = 10 maliyet birimi (forecast.js ile aynı)",
  UNITS_PER_TOKEN === 10 && realizedCost({ weight: 2, newInput: 0, history: 0, cold: false, outTokens: 1, effort: "off" }) === UNITS_PER_TOKEN);
t("e_token 0,6 / 1,3 / 3,0 mWh; orta = uçların geometrik ortası", E_TOKEN_MWH.low === 0.6 && E_TOKEN_MWH.high === 3.0 && Math.abs(E_TOKEN_MWH.mid - Math.sqrt(0.6 * 3.0)) < 0.05);
t("e_token kaynak denetimi: Epoch 0,3 Wh / 500 token; Jegham 2,989 Wh / 1.000 token", near(300 / 500, E_TOKEN_MWH.low) && Math.abs(2989 / 1000 - E_TOKEN_MWH.high) < 0.05);
t("WUE 3,6 / 4,2 / 5,3 L/kWh = yerinde ÷ PUE + elektrik üretimi (Li; Google + Li; Jegham AWS)",
  Math.abs(0.55 / 1.14 + 3.14 - WUE_L_PER_KWH.low) < 0.06 && Math.abs(1.15 / 1.09 + 3.14 - WUE_L_PER_KWH.mid) < 0.06 && Math.abs(0.18 / 1.14 + 5.11 - WUE_L_PER_KWH.high) < 0.06);
t("çaydanlık: 1 L suyu 20→100 °C ısıtmak 93 Wh (c = 4,186 kJ/kg·K)", Math.round((4.186 * 80) / 3.6) === ENERGY_UNITS.find((u) => u.key === "kettle").wh);
t("LED birimi = 9 W ampulün 1 dakikası", near(ENERGY_UNITS[0].wh, LED_WATT / 60) && LED_WATT === 9);

// ---------- E = token × e_token, W = E × WUE ----------
const e1k = energyWh(tokensEq(10_000)); // 10.000 birim = 1.000 token
t("1.000 token → 0,6 / 1,3 / 3,0 Wh", near(e1k.low, 0.6) && near(e1k.mid, 1.3) && near(e1k.high, 3.0), JSON.stringify(e1k));
const w1k = waterMl(e1k);
t("1.000 token → 2,16 / 5,46 / 15,9 mL (Wh × L/kWh = mL)", near(w1k.low, 2.16) && near(w1k.mid, 5.46) && near(w1k.high, 15.9), JSON.stringify(w1k));
t("aralık sıralı: düşük ≤ orta ≤ yüksek", e1k.low <= e1k.mid && e1k.mid <= e1k.high && w1k.low <= w1k.mid && w1k.mid <= w1k.high);
t("doğrusal: 2× token → 2× enerji ve su", near(energyWh(2000).mid, 2 * e1k.mid) && near(waterMl(energyWh(2000)).high, 2 * w1k.high));

// ---------- Birim seçimi (orta değere göre) ----------
const wu = (mid) => pickWaterUnit({ low: mid / 2, mid, high: mid * 3 });
const waterCases = [[0.02, "drop"], [0.05, "drop"], [4.9, "drop"], [5, "tsp"], [249, "tsp"], [250, "glass"], [499, "glass"], [500, "bottle"], [9_999, "bottle"],
  [10_000, "bucket"], [135_999, "bucket"], [136_000, "tub"], [5_000_000, "tub"]];
for (const [ml, key] of waterCases) t(`su ${ml} mL → ${key}`, wu(ml).key === key, wu(ml).key);
t("su birimleri: damla 0,05 · çay kaşığı 5 · bardak 250 · şişe 500 · kova 10.000 · küvet 136.000 mL",
  WATER_UNITS.map((u) => u.ml).join() === "0.05,5,250,500,10000,136000");
const g = wu(750);
t("750 mL → 1,5 şişe; sayı aralığı da aynı birimde", g.key === "bottle" && near(g.count.mid, 1.5) && near(g.count.low, 0.75) && near(g.count.high, 4.5), JSON.stringify(g.count));
t("bir damladan az: birim damla, sayı < 1", wu(0.02).count.mid < 1);
const eu = (mid) => pickEnergyUnit({ low: mid / 2, mid, high: mid * 2 });
for (const [wh, key] of [[0.01, "led"], [0.15, "led"], [18.9, "led"], [19, "phone"], [92.9, "phone"], [93, "kettle"], [5000, "kettle"]]) t(`enerji ${wh} Wh → ${key}`, eu(wh).key === key, eu(wh).key);
t("LED sayısı dakikadır: 1,5 Wh → 10 dk", near(eu(1.5).count.mid, 10));
t("57 Wh → 3 telefon şarjı", near(eu(57).count.mid, 3));

// ---------- Sıfır ve negatif ----------
const z = ecoFromUnits(0);
t("sıfır: işaret 'zero', enerji ve su 0", z.sign === "zero" && z.energy.high === 0 && z.water.high === 0 && z.tokens === 0);
t("yarım tokendan küçük fark sıfır sayılır (iki yönde)", ecoFromUnits(4).sign === "zero" && ecoFromUnits(-4).sign === "zero" && ecoFromUnits(6).sign === "pos");
t("sayı olmayan girdi sıfır", ecoFromUnits(NaN).sign === "zero" && ecoFromUnits(undefined).sign === "zero");
const neg = ecoFromUnits(-5000), pos = ecoFromUnits(5000);
t("negatif: işaret 'neg', büyüklükler mutlak ve pozitifle aynı", neg.sign === "neg" && neg.tokens === 500 && near(neg.energy.mid, pos.energy.mid) && near(neg.water.mid, pos.water.mid) && neg.waterUnit.key === pos.waterUnit.key);
t("5.000 birim → 500 token → 0,65 Wh → 2,73 mL → damla ve LED", pos.sign === "pos" && near(pos.energy.mid, 0.65) && near(pos.water.mid, 2.73) && pos.waterUnit.key === "drop" && pos.energyUnit.key === "led", `${pos.energy.mid} Wh · ${pos.water.mid} mL`);

// Raporun üç örnek durumu (tests/rapor-su.e2e.cjs aynı sayıları kullanır)
const small = ecoFromUnits(7_300), mid = ecoFromUnits(700_000), big = ecoFromUnits(40_000_000);
t("küçük (730 token): çay kaşığı altı → damla; LED dakikası", small.waterUnit.key === "drop" && small.energyUnit.key === "led", `${small.water.mid.toFixed(2)} mL · ${small.energy.mid.toFixed(2)} Wh`);
t("orta (70.000 token): su bardağı; telefon şarjı", mid.waterUnit.key === "glass" && mid.energyUnit.key === "phone", `${mid.water.mid.toFixed(0)} mL · ${mid.energy.mid.toFixed(0)} Wh`);
t("büyük (4.000.000 token): kova; çaydanlık", big.waterUnit.key === "bucket" && big.energyUnit.key === "kettle", `${(big.water.mid / 1000).toFixed(1)} L · ${big.energy.mid.toFixed(0)} Wh`);

// ---------- Taslak farkı: hangi geçiş sayılır? ----------
// Sahte maliyet: ağırlık × effort çarpanı × 1.000 (yalnızca kuralı denemek için)
const W = { haiku: 0.1, sonnet: 2, opus: 4, fable: 10 }, EF = { low: 1, medium: 1.5, high: 2.5, xhigh: 3, max: 4 };
const tierOf = (m) => Object.keys(W).find((k) => m.toLowerCase().includes(k));
const costOf = (model, effort) => W[tierOf(model)] * (EF[effort] ?? 1.5) * 1000;
const cfg = (model, effort = "medium", effRead = true) => ({ model, tier: tierOf(model), effort, effRead });
const dd = (o) => draftDelta({ costOf, ...o });
const sawBoth = { save: true, lower: true };
t("ayar değişmedi → 0, tür yok", JSON.stringify(dd({ base: cfg("Opus 5.5"), cur: cfg("Opus 5.5"), floor: { tier: "sonnet", model: "Sonnet 5.5" }, saw: sawBoth })) === '{"u":0,"k":null}');
let r = dd({ base: cfg("Opus 5.5"), cur: cfg("Sonnet 5.5"), floor: { tier: "sonnet", model: "Sonnet 5.5", effort: "medium" }, saw: { save: true } });
t("öneri kabul: Opus → Sonnet = (4 − 2) × 1,5 × 1.000 = +3.000 (model)", r.u === 3000 && r.k === "model", JSON.stringify(r));
r = dd({ base: cfg("Opus 5.5"), cur: cfg("Sonnet 5.5"), floor: { tier: "sonnet", model: "Sonnet 5.5" }, saw: { save: false } });
t("öneri gösterilmeden hafife geçiş sayılmaz", r.u === 0 && r.k === null, JSON.stringify(r));
r = dd({ base: cfg("Opus 5.5"), cur: cfg("Haiku 5.5"), floor: { tier: "sonnet", model: "Sonnet 5.5" }, saw: { save: true } });
t("önerilenden de hafife inmek: yalnızca önerilen seviyeye kadar sayılır (Opus → Sonnet)", r.u === 3000 && r.k === "model", JSON.stringify(r));
r = dd({ base: cfg("Fable 5.2"), cur: cfg("Opus 5.5"), floor: { tier: "sonnet", model: "Sonnet 5.5" }, saw: { save: true } });
t("kısmi kabul: Fable → Opus (öneri Sonnet) = +9.000", r.u === 9000 && r.k === "model", JSON.stringify(r));
r = dd({ base: cfg("Sonnet 5.5"), cur: cfg("Opus 5.5"), floor: { tier: "opus", model: "Opus 5.5" }, saw: {} });
t("daha ağır modele geçiş her zaman düşülür: Sonnet → Opus = −3.000", r.u === -3000 && r.k === "model", JSON.stringify(r));
r = dd({ base: cfg("Sonnet 5.5"), cur: cfg("Opus 5.5"), floor: null, saw: null });
t("öneri hiç yokken de ağır geçiş düşülür", r.u === -3000);
r = dd({ base: cfg("Sonnet 5.5", "max"), cur: cfg("Sonnet 5.5", "medium"), floor: { tier: "sonnet", model: "Sonnet 5.5", effort: "medium" }, saw: { lower: true } });
t("effort önerisi kabul: max → orta = 2 × (4 − 1,5) × 1.000 = +5.000 (effort)", r.u === 5000 && r.k === "effort", JSON.stringify(r));
r = dd({ base: cfg("Sonnet 5.5", "max"), cur: cfg("Sonnet 5.5", "low"), floor: { tier: "sonnet", model: "Sonnet 5.5", effort: "medium" }, saw: { lower: true } });
t("effort önerilenden de düşük: önerilen seviyeye kadar sayılır", r.u === 5000, JSON.stringify(r));
r = dd({ base: cfg("Sonnet 5.5", "medium"), cur: cfg("Sonnet 5.5", "high"), floor: { tier: "sonnet", model: "Sonnet 5.5", effort: "medium" }, saw: {} });
t("effort yükseltme düşülür: orta → yüksek = −2.000", r.u === -2000 && r.k === "effort", JSON.stringify(r));
r = dd({ base: cfg("Sonnet 5.5", "max", false), cur: cfg("Sonnet 5.5", "medium"), floor: { tier: "sonnet", model: "Sonnet 5.5", effort: "medium" }, saw: { lower: true } });
t("effort sayfadan okunamadıysa effort farkı sayılmaz", r.u === 0 && r.k === null, JSON.stringify(r));
r = dd({ base: cfg("Opus 5.5", "medium"), cur: cfg("Sonnet 5.5", "high"), floor: { tier: "sonnet", model: "Sonnet 5.5", effort: "medium" }, saw: { save: true } });
t("model hafifledi ama effort yükseldi: net = 6.000 − 5.000 = +1.000 (both)", r.u === 1000 && r.k === "both", JSON.stringify(r));
r = dd({ base: cfg("Opus 5.5"), cur: cfg("Sonnet 5.5"), floor: { tier: "sonnet", model: "Sonnet 5.5" }, saw: { save: true }, switchUnits: () => 4000 });
t("sohbet ortasında geçiş: baştan okunan geçmiş düşülür, net negatif olabilir (3.000 − 4.000)", r.u === -1000, JSON.stringify(r));
t("bilinmeyen model → null", dd({ base: { model: "?", tier: null, effort: "medium" }, cur: cfg("Opus 5.5"), saw: {} }) === null && dd({ base: null, cur: cfg("Opus 5.5") }) === null);
t("effortBelow", effortBelow("low", "high") && !effortBelow("high", "high") && !effortBelow("auto", "high") && effortBelow("off", "medium"));

// Gerçek tahmin motoruyla: Opus → Sonnet farkı pozitif ve ağırlık oranına uygun (aynı tohum → aynı örnekler)
const inp = { promptTokens: { low: 40, mid: 50, high: 60 }, attachmentTokens: { low: 0, mid: 0, high: 0 }, history: { messages: 0 }, tier: "claude_pro",
  cls: { type: "explain", complexity: 0.15, lengthHint: 1 }, now: new Date("2026-10-24T12:00:00Z").getTime() };
const real = (model, effort) => forecastMessage({ ...inp, model, effort }).cost.mid;
r = draftDelta({ base: cfg("Opus 5.5"), cur: cfg("Sonnet 5.5"), floor: { tier: "sonnet", model: "Sonnet 5.5" }, saw: { save: true }, costOf: real });
t("gerçek motor: Opus 5.5 → Sonnet 5.5, maliyetin yarısı kaçınıldı", r.u > 0 && near(r.u, real("Opus 5.5", "medium") / 2, 1e-6), `${Math.round(r.u)} birim = ${Math.round(tokensEq(r.u))} token`);

// ---------- Haftalık toplam ----------
const NOW = new Date("2026-11-14T09:00:00+03:00").getTime(), H = 3600e3, D = 24 * H;
const s = (o) => ({ id: String(Math.random()), at: NOW - H, ...o });
const wk = ecoWeek([s({ ecoU: 3000, ecoK: "model" }), s({ ecoU: 5000, ecoK: "effort" }), s({ ecoU: -2000, ecoK: "effort" }), s({ ecoU: 0 }), s({}), s({ at: NOW - 8 * D, ecoU: 90000 }), s({ at: NOW + H, ecoU: 90000 })], NOW);
t("hafta: 5 mesaj, 4'ü sayılmış, 2 kazanç (8.000), 1 fazladan (2.000), net 6.000", wk.n === 5 && wk.tracked === 4 && wk.gainN === 2 && wk.gainU === 8000 && wk.extraN === 1 && wk.extraU === 2000 && wk.netU === 6000, JSON.stringify({ ...wk, view: undefined }));
t("hafta görünümü: net 600 token, pozitif", wk.view.sign === "pos" && wk.view.tokens === 600);
const wkNeg = ecoWeek([s({ ecoU: 1000 }), s({ ecoU: -7000 })], NOW);
t("ağır seçim baskınsa hafta negatif (net −6.000)", wkNeg.netU === -6000 && wkNeg.view.sign === "neg" && wkNeg.view.tokens === 600);
const wkNone = ecoWeek([s({}), s({})], NOW);
t("eski kayıtlar (alan yok): sayılmış 0, sıfır", wkNone.tracked === 0 && wkNone.view.sign === "zero" && wkNone.n === 2);
t("boş liste", ecoWeek([], NOW).n === 0 && ecoWeek(null, NOW).view.sign === "zero");

// ---------- "Kurduğundan beri" sayacı ----------
let tot = ecoAccumulate(null, s({ ecoU: 3000 }), NOW - 30 * D);
tot = ecoAccumulate(tot, s({ ecoU: -500 }), NOW - 20 * D);
tot = ecoAccumulate(tot, s({}), NOW - 10 * D);          // sayılmamış kayıt toplamı değiştirmez
tot = ecoAccumulate(tot, s({ ecoU: 0 }), NOW);
t("sayaç: başlangıç ilk çağrıda, 3 sayılmış, kazanç 3.000, fazladan 500", tot.v === 1 && tot.since === NOW - 30 * D && tot.n === 3 && tot.gainU === 3000 && tot.gainN === 1 && tot.extraU === 500 && tot.extraN === 1, JSON.stringify(tot));
const tv = ecoTotalView(tot);
t("sayaç görünümü: net 2.500 birim = 250 token", tv.netU === 2500 && tv.view.tokens === 250 && tv.view.sign === "pos" && tv.since === tot.since);
t("sayaç yoksa görünüm null; girdi değişmez", ecoTotalView(null) === null && ecoTotalView({ v: 2 }) === null && ecoAccumulate(tot, s({ ecoU: 1 }), NOW) !== tot && tot.n === 3);

// ---------- CSV ----------
t("CSV sütun adları", ECO_CSV_COLS.join() === "avoided_tokens_eq,avoided_by,energy_wh_low,energy_wh_mid,energy_wh_high,water_ml_low,water_ml_mid,water_ml_high");
t("CSV hücreleri: +10.000 birim", ecoCsvCells({ ecoU: 10000, ecoK: "model" }).join() === "1000,model,0.6,1.3,3,2.16,5.46,15.9", ecoCsvCells({ ecoU: 10000, ecoK: "model" }).join());
t("CSV hücreleri: negatif işaretli", ecoCsvCells({ ecoU: -10000, ecoK: "effort" }).join() === "-1000,effort,-0.6,-1.3,-3,-2.16,-5.46,-15.9");
t("CSV hücreleri: sıfır ve sayılmamış", ecoCsvCells({ ecoU: 0 }).join() === "0,,0,0,0,0,0,0" && ecoCsvCells({}).join() === ",,,,,,,");
const base = { at: NOW, model: "opus 5.5", type: "explain", pred: 1, predLo: 0.4, predHi: 2, predW: 0.1 };
const csv = sendsCsv([{ ...base, ecoU: 10000, ecoK: "model" }, { ...base }]).split("\n");
t("sendsCsv: yeni sütunlar başlıkta, her satır başlıkla aynı uzunlukta", csv[0].endsWith(ECO_CSV_COLS.join()) && csv.every((l) => l.split(",").length === csv[0].split(",").length) && csv[1].endsWith("1000,model,0.6,1.3,3,2.16,5.46,15.9") && csv[2].endsWith(",,,,,,,"), csv[1].slice(-60));

console.log(fail ? `\n${fail} BAŞARISIZ` : "\ntüm eko testleri geçti");
process.exit(fail ? 1 : 0);
