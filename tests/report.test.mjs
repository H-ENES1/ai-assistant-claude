// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Haftalık rapor, harcama hızı ve "beklenenden fazla" açıklaması için birim testleri.
import { weeklyReport, burnRate, surprise, costReasons, trimSends, nextWeeklyAt, sendsCsv, SENDS_MAX, learningCurve } from "../extension/lib/report.js";
import { forecastMessage } from "../extension/lib/forecast.js";
let fail = 0;
const t = (name, cond, info = "") => { console.log(`${cond ? "✓" : "✗"} ${name}${info ? " — " + info : ""}`); if (!cond) fail++; };

const NOW = new Date("2026-10-22T09:00:00+03:00").getTime();
const H = 3600e3, D = 24 * H;
const mk = (o) => ({ id: String(Math.random()), at: NOW - H, conv: "c1", fam: "opus", model: "opus 5.5", type: "explain", eff: "medium", peak: false,
  cache: "warm", hist: 2000, pred: 1, predLo: 0.4, predHi: 2, predW: 0.1, adv: { k: "ok", t: "opus" }, save: 0, outHi: 1500, ...o });

// Boş ve az veri
t("boş listede rapor 'yetersiz'", weeklyReport([], NOW).enough === false);

// Örnek hafta: 10 mesaj; 4'ü yoğun saatte ve pahalı, 3'ü soğuk önbellekli uzun sohbet, 2'sinde Haiku yeterdi
const wk = [];
for (let i = 0; i < 4; i++) wk.push(mk({ at: NOW - (i + 1) * 5 * H, peak: true, pred: 4, d: 5, predHi: 7 }));
for (let i = 0; i < 3; i++) wk.push(mk({ at: NOW - (i + 1) * 13 * H, cache: "cold", hist: 60000, pred: 3, d: 3 }));
wk.push(mk({ at: NOW - 2 * D, type: "translate", adv: { k: "save", t: "haiku" }, save: 1.5, pred: 2 }));
wk.push(mk({ at: NOW - 3 * D, type: "translate", adv: { k: "save", t: "haiku" }, save: 1.2, pred: 1.5 }));
wk.push(mk({ at: NOW - 4 * D, fam: "sonnet", model: "sonnet 5.5", pred: 0.5, d: 0 }));
const prevWeek = [mk({ at: NOW - 9 * D }), mk({ at: NOW - 10 * D })];
const r = weeklyReport([...prevWeek, ...wk, mk({ at: NOW - 40 * D })], NOW);
t("bu hafta 10 mesaj, önceki 2", r.n === 10 && r.nPrev === 2, `${r.n}/${r.nPrev}`);
t("harcama: ölçülen varsa o, yoksa tahmin", Math.abs(r.spent - (4 * 5 + 3 * 3 + 2 + 1.5 + 0)) < 1e-9, String(r.spent));
t("yoğun saat payı ~%62", Math.abs(r.peak.share - 20 / 32.5) < 1e-9, r.peak.share.toFixed(3));
t("soğuk önbellek 3 mesaj", r.cold.n === 3);
t("kaçan tasarruf 2,7 (2 mesaj)", Math.abs(r.advice.savePot - 2.7) < 1e-9 && r.advice.save === 2);
t("ilk öneri yoğun saat", r.tips[0]?.key === "tip_peak", r.tips.map((x) => x.key).join(","));
t("soğuk önbellek ve tasarruf önerileri de var", r.tips.some((x) => x.key === "tip_cold") && r.tips.some((x) => x.key === "tip_advice"));
t("en pahalı ilk mesaj yoğun saatte ve 'peak' gerekçeli", r.top[0].spent === 5 && r.top[0].reasons.includes("peak"));
t("model dağılımı: Opus önde", r.byFam[0].key === "opus" && r.byFam.some((x) => x.key === "sonnet"));
t("isabet: 8 ölçümün hepsi aralıkta", r.accuracy.measured === 8 && r.accuracy.inRange === 8, `${r.accuracy.inRange}/${r.accuracy.measured}`);
const heatTotal = r.heat.flat().reduce((a, b) => a + b, 0);
t("ısı haritası son 28 gün (40 gün önceki hariç)", heatTotal === 12, String(heatTotal));
t("yoğun saat penceresi Türkiye'de 15–21", r.peakHours.start === 15 && r.peakHours.end === 21, JSON.stringify(r.peakHours));

// Dengeli hafta → "iyi gidiyorsun"
const calm = Array.from({ length: 6 }, (_, i) => mk({ at: NOW - (i + 1) * 20 * H, fam: "sonnet" }));
t("dengeli haftada tip_good", weeklyReport(calm, NOW).tips[0]?.key === "tip_good");

// Beklenenden fazla
t("aralık içindeyse açıklama yok", surprise(mk({ d: 2.5, predHi: 2 })) === null);
const sp = surprise(mk({ d: 9, predHi: 2, cache: "cold", hist: 80000, peak: true }));
t("4,5 katsa açıklama var, sebepler: soğuk + yoğun + başka yer", sp && sp.reasons.includes("cold") && sp.reasons.includes("peak") && sp.reasons.at(-1) === "elsewhere", JSON.stringify(sp?.reasons));
t("ölçüm yoksa açıklama yok", surprise(mk({ d: null })) === null);
t("costReasons: uzun cevap", costReasons(mk({ out: 3000, outHi: 1500 })).includes("long_answer"));

// Harcama hızı
const r5 = NOW + 3 * H;
const hist = [{ at: NOW - 70 * 60000, p5: 10, r5 }, { at: NOW - 50 * 60000, p5: 20, r5 }, { at: NOW - 25 * 60000, p5: 32, r5 }, { at: NOW - 2 * 60000, p5: 40, r5 }];
const b = burnRate(hist, NOW);
t("hız: %25/saat", b && Math.abs(b.perHour - (20 / 48) * 60) < 0.01, b?.perHour?.toFixed(2));
t("bu hızla yenilenmeden önce dolar", b && b.beforeReset && b.eta < r5);
const slow = burnRate([{ at: NOW - 50 * 60000, p5: 40, r5 }, { at: NOW - 2 * 60000, p5: 42, r5 }], NOW);
t("yavaşsa yenilenmeden önce dolmaz", slow && !slow.idle && !slow.beforeReset);
t("bayat veride hız yok", burnRate([{ at: NOW - 5 * H, p5: 1 }, { at: NOW - 4 * H, p5: 3 }], NOW) === null);
t("pencere değiştiyse eski noktalar sayılmaz", burnRate([{ at: NOW - 40 * 60000, p5: 90, r5: NOW - H }, { at: NOW - 2 * 60000, p5: 3, r5 }], NOW) === null);

// Sınırlar, zamanlama, CSV
const many = Array.from({ length: SENDS_MAX + 50 }, (_, i) => mk({ at: NOW - i * 60000 }));
t("kayıt sınırı", trimSends(many.reverse(), NOW).length === SENDS_MAX);
t("70 günden eski silinir", trimSends([mk({ at: NOW - 80 * D }), mk({})], NOW).length === 1);
const nw = new Date(nextWeeklyAt(NOW));
t("haftalık bildirim: sonraki Pazartesi 09:00", nw.getDay() === 1 && nw.getHours() === 9 && nw.getTime() > NOW, nw.toString());
const csv = sendsCsv([mk({ d: 1.5 })]);
t("CSV başlık + 1 satır, metin alanı yok", csv.split("\n").length === 2 && !/prompt|text/i.test(csv.split("\n")[0]));

// Tahmin dökümü
const fc = forecastMessage({ promptTokens: { low: 40, mid: 50, high: 60 }, history: { messages: 0 }, model: "Opus 5.5", effort: "Yüksek", tier: "claude_pro", cls: { type: "explain", complexity: 0.2, lengthHint: 1 } });
const bsum = Object.values(fc.breakdown).reduce((a, x) => a + x, 0);
t("döküm payları toplamı 1", Math.abs(bsum - 1) < 1e-9, JSON.stringify(fc.breakdown));
t("yüksek effort'ta cevap+düşünme baskın", fc.breakdown.output + fc.breakdown.thinking > 0.9);

// Alan ve effort
const dset = [
  ...Array.from({ length: 4 }, (_, i) => mk({ at: NOW - (i + 1) * H, dom: "science", sub: "physics", eff: "max", effRec: "medium", effSave: 0.6, d: 2 })),
  ...Array.from({ length: 3 }, (_, i) => mk({ at: NOW - (i + 10) * H, dom: "health", sub: "medical", eff: "medium", effRec: "medium", d: 1 })),
  mk({ at: NOW - 20 * H, dom: "literature", sub: "poetry", eff: "high", effRec: "medium", effSave: 0.1, d: 0.5 })
];
const dr = weeklyReport(dset, NOW);
t("alan dağılımı: bilim en üstte", dr.byDomain[0]?.key === "science" && dr.byDomain.length === 3, JSON.stringify(dr.byDomain.map((x) => x.key)));
t("alt başlık anahtarı alan|alt", dr.bySub[0]?.key === "science|physics");
t("effort dağılımı", dr.byEffort.some((x) => x.key === "max"));
t("effort önerilenden yüksek: 5 mesaj", dr.effort.over === 5, String(dr.effort.over));
t("öneri: effort fazlası", dr.tips.some((x) => x.key === "tip_effort_over"), dr.tips.map((x) => x.key).join(","));
t("öneri: riskli alan notu", dr.tips.some((x) => x.key === "tip_domain_stakes"));
t("costReasons: xhigh de yüksek effort", costReasons(mk({ eff: "xhigh" })).includes("effort"));
const csv2 = sendsCsv([mk({ dom: "law", sub: "contract", effRec: "medium" })]);
t("CSV alan ve önerilen effort sütunları", /domain,subdomain,effort,effort_suggested/.test(csv2) && /law,contract/.test(csv2));

// Öğrenme kanıtı
const lcs = Array.from({ length: 60 }, (_, i) => mk({ at: NOW - (60 - i) * 60000, pred: 10, predLo: 5, predHi: 20, d: i < 20 ? 22 : i < 40 ? 15 : 11 }));
const lc = learningCurve(lcs);
t("öğrenme: 60 ölçüm 6 grup", lc.curve.length === 6 && lc.measured === 60);
t("öğrenme: hata düşünce 'better'", lc.verdict === "better" && lc.last.factor < lc.first.factor, `${lc.first?.factor.toFixed(2)} → ${lc.last?.factor.toFixed(2)}`);
t("öğrenme: az ölçümde 'few'", learningCurve(lcs.slice(0, 25)).verdict === "few");
t("öğrenme: hata aynıysa 'same'", learningCurve(lcs.map((x) => ({ ...x, d: 15 }))).verdict === "same");
t("öğrenme: hata artınca 'worse'", learningCurve(lcs.map((x, i) => ({ ...x, d: i < 30 ? 11 : 24 }))).verdict === "worse");
t("öğrenme raporda", weeklyReport(lcs, NOW).learning?.measured === 60);

console.log(fail ? `\n${fail} test başarısız` : "\ntüm rapor testleri geçti");
process.exit(fail ? 1 : 0);
