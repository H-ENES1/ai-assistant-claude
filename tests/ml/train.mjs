// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// İş türü sınıflandırıcısını eğitir ve kurallarla karşılaştırır.
//   node tests/ml/train.mjs         → eğit ve değerlendir (ağırlık YAZMAZ)
//   node tests/ml/train.mjs --write → ölçüt tutuyorsa ağırlıkları yaz (extension/lib/learn-weights.js)
// DİKKAT (12.11.2026): train + train2 ile eğitilen ağırlıklar test2 ölçütünü geçti ama kör set 5'te Haiku yanlış
// öneriyi 3 → 12'ye çıkardı ve geri alındı (CLAUDE.md). test2 ölçütü tek başına yetmiyor; bu yüzden yazma artık
// açık istekle (--write) olur ve yazılan ağırlık yeni bir kör setle ölçülmeden yayımlanmamalıdır.
// Eğitim verisi: train.tsv (600 kısa örnek) + train2.tsv (uzun ve yapıştırılmış içerikli örnekler; ayrı alt ajanlar yazdı).
// Değerlendirme: eğitim verisinden hiç türetilmemiş, ayrı yazılmış test.tsv ve test2.tsv (dağınık, gerçekçi mesajlar).
// Yazma ölçütü (test2): aday ağırlıklarla ÜRÜNÜN kararı (kurallar + ağırlıklar + korumalar) yayındaki ağırlıklardan
// daha az doğru olmamalı ve tehlikeli hata (ağır işi hafif türe atma) sayısı artmamalı; yoksa ağırlıklar yazılmaz.
// Kör set 5 (test4.tsv) burada bilerek ölçülmez: yalnız tests/blind5.mjs ölçer.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { classify } from "../../extension/lib/classify.js";
import { featurize, predict, encodeModel, decodeModel, LEARN_TYPES } from "../../extension/lib/learn.js";

const here = path.dirname(fileURLToPath(import.meta.url));
// "#" ile başlayan satırlar nottur (kör set uyarısı), örnek sayılmaz.
const read = (f) => readFileSync(path.join(here, f), "utf8").trim().split(/\r?\n/).filter((l) => l && !l.startsWith("#")).map((l) => {
  const i = l.indexOf("\t"); return { y: l.slice(0, i), x: l.slice(i + 1).replace(/\\n/g, "\n") };
});
const train1 = read("train.tsv"), train2 = existsSync(path.join(here, "train2.tsv")) ? read("train2.tsv") : [];
const train = [...train1, ...train2];
const test = read("test.tsv"), test2 = read("test2.tsv");
// KÖR SET 4 (12.11.2026): yalnızca ölçüm içindir, buna bakarak kural, ağırlık ya da sözlük değiştirme.
// train2.tsv bu setin TOPLU sonuçlarına göre (uzun mesajlar zayıf) yazıldığı için set 4 artık "bilgi amaçlı"dır.
const test3 = read("test3.tsv");
const args = new Set(process.argv.slice(2));

// ---------- Rastgelelik (tekrarlanabilir) ----------
let seed = 42;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];

// ---------- Veri çoğaltma ----------
const isTR = (s) => /[çğıöşüİ]|\b(bu|şu|ne|bir|mısın|misin|için|ve|ile|nasıl|neden)\b/i.test(s);
const FOLD = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "Ç": "C", "Ğ": "G", "İ": "I", "Ö": "O", "Ş": "S", "Ü": "U" };
const fold = (s) => s.replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => FOLD[c]);
const PRE_TR = ["merhaba, ", "selam ", "hocam ", "kanka ", "bir şey soracağım: ", "rica etsem ", "acil ", "şimdi "];
const PRE_EN = ["hi, ", "hey ", "quick question: ", "pls ", "ok so ", "hello! "];
const SUF_TR = [" teşekkürler", " lütfen", " ya", " :)", " acil lazım", " şimdiden sağ ol"];
const SUF_EN = [" thanks", " please", " thx", "!", " asap", " ty"];
const PASTE_TR = "Geçen hafta yapılan toplantıda bütçe, takvim ve ekip dağılımı konuşuldu. Proje ilk aşamada iki ay gecikti; tedarikçiyle yaşanan sorunlar ve eksik personel bunun başlıca nedenleri olarak görüldü. Yönetim yeni bir plan istedi.";
const PASTE_EN = "In last week's meeting the team discussed the budget, the timeline and staffing. The first phase slipped by two months, mainly because of supplier issues and missing staff. Management asked for a revised plan by the end of the month.";
const CODE = "\n```js\nfunction total(items) {\n  let s = 0;\n  for (let i = 0; i <= items.length; i++) s += items[i].price;\n  return s;\n}\n```";
function typo(s) {
  const ws = s.split(" "); const i = Math.floor(rnd() * ws.length); const w = ws[i];
  if (w.length > 4) { const j = 1 + Math.floor(rnd() * (w.length - 2)); ws[i] = w.slice(0, j) + w.slice(j + 1); }
  return ws.join(" ");
}
function augment(ex) {
  const tr = isTR(ex.x), out = [ex];
  out.push({ y: ex.y, x: fold(ex.x.toLocaleLowerCase(tr ? "tr" : "en")).replace(/[?.!,]/g, "") });
  out.push({ y: ex.y, x: pick(tr ? PRE_TR : PRE_EN) + ex.x.charAt(0).toLocaleLowerCase("tr") + ex.x.slice(1) });
  out.push({ y: ex.y, x: ex.x + pick(tr ? SUF_TR : SUF_EN) });
  out.push({ y: ex.y, x: typo(ex.x) });
  if (["summarize", "rewrite", "translate", "explain", "data_analysis"].includes(ex.y) && rnd() < 0.7) out.push({ y: ex.y, x: ex.x + "\n\n" + (tr ? PASTE_TR : PASTE_EN) });
  if (ex.y === "code_fix" && rnd() < 0.6) out.push({ y: ex.y, x: ex.x + CODE });
  return out;
}

// ---------- Eğitim: softmax regresyon, Adam, L2 ----------
function fit(rows, { dim = 8192, epochs = 30, lr = 0.05, l2 = 2e-5, useRules = true } = {}) {
  const K = LEARN_TYPES.length;
  const data = rows.map((r) => ({ f: featurize(r.x, useRules ? classify(r.x).scores : null, dim), y: LEARN_TYPES.indexOf(r.y) }));
  const W = new Float32Array(dim * K), b = new Float32Array(K);
  const mW = new Float32Array(dim * K), vW = new Float32Array(dim * K), mb = new Float32Array(K), vb = new Float32Array(K);
  const b1 = 0.9, b2 = 0.999, eps = 1e-8;
  let t = 0;
  const model = { dim, classes: LEARN_TYPES, W, b };
  for (let ep = 0; ep < epochs; ep++) {
    for (let i = data.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [data[i], data[j]] = [data[j], data[i]]; }
    for (const d of data) {
      t++;
      const p = predict(model, d.f);
      const g = LEARN_TYPES.map((c, k) => p.probs[c] - (k === d.y ? 1 : 0));
      const c1 = 1 - Math.pow(b1, t), c2 = 1 - Math.pow(b2, t);
      for (const [i, v] of d.f) {
        const off = i * K;
        for (let k = 0; k < K; k++) {
          const idx = off + k;
          const gr = g[k] * v + l2 * W[idx];
          mW[idx] = b1 * mW[idx] + (1 - b1) * gr; vW[idx] = b2 * vW[idx] + (1 - b2) * gr * gr;
          W[idx] -= lr * (mW[idx] / c1) / (Math.sqrt(vW[idx] / c2) + eps);
        }
      }
      for (let k = 0; k < K; k++) {
        mb[k] = b1 * mb[k] + (1 - b1) * g[k]; vb[k] = b2 * vb[k] + (1 - b2) * g[k] * g[k];
        b[k] -= lr * (mb[k] / c1) / (Math.sqrt(vb[k] / c2) + eps);
      }
    }
  }
  return model;
}

// ---------- Değerlendirme ----------
const HAIKU = new Set(["short_qa", "translate", "rewrite", "summarize"]);
function evaluate(name, rows, guess) {
  let ok = 0, danger = 0; const per = {}; const errs = [];
  for (const r of rows) {
    const g = guess(r.x);
    (per[r.y] ||= { n: 0, ok: 0 }).n++;
    if (g === r.y) { ok++; per[r.y].ok++; }
    else {
      errs.push(`${r.y.padEnd(13)} → ${String(g).padEnd(13)} ${r.x.replace(/\n/g, " ").slice(0, 70)}`);
      if (HAIKU.has(g) && !HAIKU.has(r.y)) danger++;
    }
  }
  return { name, acc: ok / rows.length, ok, n: rows.length, danger, per, errs };
}
const cell = (e) => `%${(100 * e.acc).toFixed(1)} · ${e.danger}`;
const show = (e) => console.log(`${e.name.padEnd(34)} doğruluk %${(100 * e.acc).toFixed(1)} (${e.ok}/${e.n}) · tehlikeli hata (hafif tipe kayma): ${e.danger}`);

// Yalnız kurallar: classify() artık yayındaki öğrenen modeli de kullandığı için useModel:false şart
// (yoksa "kurallar" satırı aslında ürünün karma kararını ölçer).
const rulesGuess = (x) => classify(x, { useModel: false }).type;
// Yayındaki ürünün kararı: kurallar + learn-weights.js'teki ağırlıklar + görev–konu korumaları.
// Hafif tür koruması açık (ürün bugün böyle çalışıyor). Yazma ölçütü bu satıra göre verilir.
// Not: ağırlıklar yazıldıktan sonra bu satır yeni ağırlıkları ölçer.
const shippedGuess = (x) => classify(x).type;
const aug = train.flatMap(augment);
console.log(`eğitim: ${train.length} örnek (train.tsv ${train1.length} + train2.tsv ${train2.length}) → çoğaltılmış ${aug.length} · test: ${test.length} (ayrı yazılmış)\n`);

const R = evaluate("kurallar (mevcut)", test, rulesGuess); show(R);
const S = evaluate("ürün (yayındaki ağırlıklar)", test, shippedGuess); show(S);
const mText = fit(aug, { useRules: false });
const T = evaluate("öğrenen model (yalnız metin)", test, (x) => predict(mText, featurize(x, null, mText.dim)).type); show(T);
const mHyb = fit(aug, { useRules: true });
const Hy = evaluate("karma (metin + kural puanları)", test, (x) => predict(mHyb, featurize(x, classify(x).scores, mHyb.dim)).type); show(Hy);

// Karar kuralı: öğrenen model eminse onu, değilse kuralları kullan
const decide = (x, thr) => { const c = classify(x); const p = predict(mHyb, featurize(x, c.scores, mHyb.dim)); return p.prob >= thr ? p.type : c.type; };
for (const thr of [0.35, 0.5, 0.65]) show(evaluate(`karma, eşik ${thr} altında kurallar`, test, (x) => decide(x, thr)));

// İkinci test seti: veri genişletildikten SONRA yazıldı, hiçbir ayar için kullanılmadı (dürüst ölçüm)
console.log("\nTest 2 (hiç bakılmadan yazılmış):");
const R2 = evaluate("kurallar (mevcut)", test2, rulesGuess); show(R2);
const S2 = evaluate("ürün (yayındaki ağırlıklar)", test2, shippedGuess); show(S2);
const H2 = evaluate("karma", test2, (x) => predict(mHyb, featurize(x, classify(x).scores, mHyb.dim)).type); show(H2);
const T2 = evaluate("öğrenen model (yalnız metin)", test2, (x) => predict(mText, featurize(x, null, mText.dim)).type); show(T2);
if (args.has("--errors2")) { console.log("\nKarma, test 2 hataları:"); H2.errs.forEach((e) => console.log("  " + e)); }

// Üçüncü test seti (kör set 4): alt ajanlar depoyu görmeden yazdı, 250 TR + 100 EN. Ayar için KULLANILMAZ;
// ağırlıkların yazılıp yazılmayacağına da karışmaz (karar ölçütü test2 olarak kalır).
console.log("\nTest 3 (kör set 4, bilgi amaçlı; alt ajanlar yazdı, depoyu görmediler):");
const R3 = evaluate("kurallar (mevcut)", test3, rulesGuess); show(R3);
const T3 = evaluate("öğrenen model (yalnız metin)", test3, (x) => predict(mText, featurize(x, null, mText.dim)).type); show(T3);
const H3 = evaluate("karma (yeniden eğitilmiş)", test3, (x) => predict(mHyb, featurize(x, classify(x).scores, mHyb.dim)).type); show(H3);
const S3 = evaluate("ürün (yayındaki ağırlıklar)", test3, shippedGuess); show(S3);
if (args.has("--errors3")) { console.log("\nÜrün, test 3 hataları:"); S3.errs.forEach((e) => console.log("  " + e)); }

// Yan yana tablo: doğruluk · tehlikeli hata (ağır işi hafif türe atma)
// Aday ürün: yeni ağırlıklar (int8'e sıkıştırılmış, yazılacak hâliyle) + kurallar + görev–konu korumaları.
// Yazma kararı bu satırla verilir (ham "karma" satırı korumaları içermez).
const candModel = decodeModel(encodeModel(mHyb));
const candGuess = (x) => classify(x, { model: candModel }).type;
const C = evaluate("aday ürün (yeni ağırlıklar)", test, candGuess), C2 = evaluate("aday ürün (yeni ağırlıklar)", test2, candGuess), C3 = evaluate("aday ürün (yeni ağırlıklar)", test3, candGuess);
console.log("\nAday ürün (yeni ağırlıklar + kurallar + korumalar):"); show(C); show(C2); show(C3);
console.log(`\n| yöntem | test (${test.length}) | test2 (${test2.length}) | test3, kör set 4, bilgi amaçlı (${test3.length}) |\n|---|---|---|---|`);
for (const [n, a, b, c] of [["kurallar", R, R2, R3], ["öğrenen model (yalnız metin)", T, T2, T3], ["karma (yeniden eğitilmiş, ham)", Hy, H2, H3], ["ürün (yayındaki ağırlıklar)", S, S2, S3], ["aday ürün (yeni ağırlıklar)", C, C2, C3]])
  console.log(`| ${n} | ${cell(a)} | ${cell(b)} | ${cell(c)} |`);

// Eğitim setinde 5 katlı çapraz doğrulama (karma)
let cvOk = 0;
const folds = 5;
for (let f = 0; f < folds; f++) {
  const tr = train.filter((_, i) => i % folds !== f).flatMap(augment), te = train.filter((_, i) => i % folds === f);
  const m = fit(tr, { useRules: true, epochs: 20 });
  cvOk += te.filter((r) => predict(m, featurize(r.x, classify(r.x).scores, m.dim)).type === r.y).length;
}
console.log(`\nçapraz doğrulama (eğitim seti, karma): %${(100 * cvOk / train.length).toFixed(1)}`);

console.log("\nTip başına (test): kurallar → karma");
for (const t of LEARN_TYPES) {
  const a = R.per[t], b = Hy.per[t];
  console.log(`  ${t.padEnd(14)} ${a.ok}/${a.n} → ${b.ok}/${b.n}`);
}
if (args.has("--errors")) { console.log("\nKarma modelin hataları:"); Hy.errs.forEach((e) => console.log("  " + e)); console.log("\nKuralların hataları:"); R.errs.forEach((e) => console.log("  " + e)); }

// Sıkıştırma kaybı: int8'e çevrilmiş model aynı sonucu veriyor mu?
const meta = { trained: new Date().toISOString().slice(0, 10), train: train.length, train2: train2.length, augmented: aug.length, test: test.length,
  testAccRules: +R.acc.toFixed(3), testAccHybrid: +Hy.acc.toFixed(3), test2AccRules: +R2.acc.toFixed(3), test2AccHybrid: +H2.acc.toFixed(3),
  dangerRules: R.danger + R2.danger, dangerHybrid: Hy.danger + H2.danger, cv: +(cvOk / train.length).toFixed(3) };
const packed = encodeModel(mHyb, meta);
const back = decodeModel(packed);
const Q = evaluate("karma (int8 sıkıştırılmış)", test, (x) => predict(back, featurize(x, classify(x).scores, back.dim)).type); show(Q);
console.log(`ağırlık boyutu: ${(packed.W.length / 1024).toFixed(0)} KB (base64)`);

// Yazma ölçütü: test2'de aday ürün, yayındaki üründen kötü olmamalı (doğruluk ve tehlikeli hata).
const worse = [];
if (C2.acc < S2.acc) worse.push(`test2 doğruluğu düştü (%${(100 * S2.acc).toFixed(1)} → %${(100 * C2.acc).toFixed(1)})`);
if (C2.danger > S2.danger) worse.push(`test2 tehlikeli hata arttı (${S2.danger} → ${C2.danger})`);
console.log(`\nyazma ölçütü (test2): yayındaki ${cell(S2)} → aday ${cell(C2)} · ${worse.length ? "TUTMADI: " + worse.join("; ") : "tuttu"}`);
if (worse.length) console.log("ağırlıklar YAZILMADI");
else if (!args.has("--write") || args.has("--no-write")) console.log("ağırlıklar yazılmadı (yazmak için --write; önce başlıktaki DİKKAT notunu oku)");
else {
  const out = path.join(here, "../../extension/lib/learn-weights.js");
  writeFileSync(out, `// Otomatik üretildi: tests/ml/train.mjs (elle düzenleme). ${meta.trained}\nexport default ${JSON.stringify(packed)};\n`);
  console.log("yazıldı:", path.relative(process.cwd(), out));
}
