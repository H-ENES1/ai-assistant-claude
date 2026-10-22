// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// "Zamanla öğreniyor ve doğrulaşıyor mu?" deneyi. Eklentinin GERÇEK tahmin ve kalibrasyon kodunu kullanır
// (forecastMessage + calibrate.observe). Gizli gerçek değerleri olan yapay kullanıcılar üretir; her mesajda
// önce tahmin eder, sonra gerçeği görüp öğrenir. Öğrenme kapalı (kalibrasyonsuz) aynı mesaj akışıyla kıyaslanır.
// Not: kullanıcılar yapay; gerçek hesaplarda ispat için eklenti penceresindeki "Doğruluk geçmişi" bölümüne bak.
import { observe, emptyState, makeCalib } from "../extension/lib/calibrate.js";
import { forecastMessage, kPrior, realizedCost, outputPrior } from "../extension/lib/forecast.js";

const USERS = Number(process.env.USERS || 200), N = 120, tier = "claude_pro";
let seed = Number(process.env.SEED || 11);
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const TYPES = ["short_qa", "explain", "code_write", "code_fix", "writing", "translate", "summarize", "math", "research"];
const zero = { outputAdjust: () => ({ mean: 0, sd: 0 }) };
const prior = kPrior(tier, "session");
const BLOCKS = [[1, 3], [4, 10], [11, 20], [21, 40], [41, 80], [81, 120]];

const mkAcc = () => BLOCKS.map(() => ({ err: [], inR: 0, n: 0, agg: [] }));
const acc = { learn: mkAcc(), base: mkAcc(), oracle: mkAcc() };
const blockOf = (i) => BLOCKS.findIndex(([a, b]) => i >= a && i <= b);

for (let u = 0; u < USERS; u++) {
  // Gizli gerçekler: plan büyüklüğü (önselden ±2,2 kat), Claude'un bu kullanıcıya verdiği cevap uzunlukları
  const trueK = Math.exp(prior.mu + 0.8 * gauss());
  const gShift = 0.35 * gauss();
  const tShift = Object.fromEntries(TYPES.map((t) => [t, 0.35 * gauss()]));
  const favs = TYPES.map(() => rnd() ** 2); // kullanıcının iş türü alışkanlığı
  let st = emptyState(), cum = 20 + 40 * rnd();
  const agg = {};
  for (let i = 1; i <= N; i++) {
    let r = rnd() * favs.reduce((a, b) => a + b, 0), ti = 0;
    while (ti < TYPES.length - 1 && r > favs[ti]) { r -= favs[ti]; ti++; }
    const type = TYPES[ti];
    const prompt = Math.max(8, Math.round(Math.exp(4.2 + 0.9 * gauss())));
    const cls = { type, complexity: Math.min(1, rnd() * 0.5), lengthHint: 1, confidence: "medium", signals: [] };
    const input = { promptTokens: { low: prompt * 0.8, mid: prompt, high: prompt * 1.25 }, attachmentTokens: { low: 0, mid: 0, high: 0 }, history: { messages: 0 },
      model: "Sonnet 5.5", effort: "Orta", tier, cls, memoryOn: true, now: Date.UTC(2026, 9, 21, 20) };
    const fcL = forecastMessage({ ...input, calib: makeCalib(st) }, { samples: 400 });
    const fcB = forecastMessage(input, { samples: 400 });
    // Kusursuz bilgili (kıyas tabanı): gerçek k ve gerçek cevap uzunluğu kaymalarını bilen tahminci. Daha iyisi mümkün değil.
    const oracleCalib = { kPosterior: () => ({ mu: Math.log(trueK), sd: 0.02 }), outputAdjust: (t) => ({ mean: gShift + tShift[t], sd: 0.02 }) };
    const fcO = forecastMessage({ ...input, calib: oracleCalib }, { samples: 400 });
    // Gerçek: bu kullanıcıda cevap uzunluğu ve harcama
    const base = outputPrior(cls, { promptTokens: input.promptTokens, attachmentTokens: input.attachmentTokens }, zero);
    const out = Math.exp(base.mu + gShift + tShift[type] + 0.7 * gauss());
    const cost = realizedCost({ weight: fcL.weight, newInput: prompt, history: 0, cold: false, outTokens: out, effort: fcL.effort });
    const trueCost = cost * Math.exp(0.3 * gauss()); // gizli düşünme vb. gürültü
    const truePct = trueK * trueCost;
    // Değerlendirme: tahmin orta değeri gerçekten ne kadar uzak, aralık kapsıyor mu (eklentinin ±1 yuvarlama payıyla)
    const b = blockOf(i);
    for (const [key, fc] of [["learn", fcL], ["base", fcB], ["oracle", fcO]]) {
      const p = fc.pct.session;
      const e = Math.abs(Math.log(Math.max(0.02, p.mid) / Math.max(0.02, truePct)));
      acc[key][b].err.push(e); acc[key][b].n++;
      if (truePct >= p.low && truePct <= p.high) acc[key][b].inR++; // sıkı: yuvarlama payı yok
      const A = (agg[key + b] ||= { m: 0, t: 0, key, b }); A.m += p.mid; A.t += truePct;
    }
    // Öğrenme: yalnızca eklentinin gördüğü şeyler (yüzde farkı, gerçek maliyet, cevap uzunluğu)
    const before = Math.floor(cum); cum += truePct; if (cum > 100) cum -= 80;
    const delta = Math.floor(cum) - before;
    if (delta >= 0) st = observe(st, { at: Date.now(), tier, window: "session", delta, cost: cost, predicted: fcL.pct.session, type, outTokens: out, outMuNoAdj: base.mu }).state;
  }
  for (const A of Object.values(agg)) acc[A.key][A.b].agg.push(Math.abs(Math.log(A.m / A.t))); // kullanıcının bu bloktaki toplam tahmini ↔ toplam gerçek
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const rows = BLOCKS.map(([a, b], i) => {
  const L = acc.learn[i], B = acc.base[i], O = acc.oracle[i];
  return { blok: `${a}–${b}`, ogren: Math.exp(med(L.err)), ogrenKapsama: L.inR / L.n, baz: Math.exp(med(B.err)), bazKapsama: B.inR / B.n,
    oracle: Math.exp(med(O.err)), ogrenAgg: Math.exp(med(L.agg)), bazAgg: Math.exp(med(B.agg)), oracleAgg: Math.exp(med(O.agg)) };
});
console.log(`Yapay kullanıcı: ${USERS}, her biri ${N} mesaj. Hata = ortanca "kaç kat uzak" (1,00× = kusursuz).`);
console.log("TEK MESAJ: hata ve %80 aralığın gerçeği kapsama oranı (hedef ≈ %80)");
console.log("mesaj   | öğrenen         | öğrenmeyen      | kusursuz bilgili (taban)");
for (const r of rows) console.log(`${r.blok.padEnd(8)}| ${r.ogren.toFixed(2)}×  %${(100 * r.ogrenKapsama).toFixed(0).padStart(3)}   | ${r.baz.toFixed(2)}×  %${(100 * r.bazKapsama).toFixed(0).padStart(3)}   | ${r.oracle.toFixed(2)}×`);
console.log("BLOK TOPLAMI: bloktaki tüm mesajların toplam limiti, tahmin ↔ gerçek");
console.log("mesaj   | öğrenen | öğrenmeyen | kusursuz bilgili");
for (const r of rows) console.log(`${r.blok.padEnd(8)}| ${r.ogrenAgg.toFixed(2)}×   | ${r.bazAgg.toFixed(2)}×      | ${r.oracleAgg.toFixed(2)}×`);
const first = rows[0], last = rows.at(-1);
const ok = last.ogren < first.ogren && last.ogren < last.baz - 0.3 && last.ogren < last.oracle * 1.08 && last.ogrenKapsama > 0.72 && last.ogrenKapsama < 0.88 && last.ogrenAgg < last.bazAgg;
console.log(ok ? "✓ öğrenme hatayı azaltıyor ve öğrenmeyenden iyi" : "✗ beklenen iyileşme görülmedi");
if (process.env.JSON) console.log(JSON.stringify(rows));
process.exit(ok ? 0 : 1);
