// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Konu alanı sözlüğü 2: kör yazılmış kelime listesini (tools/domain-dict/sozluk.json) MEKANİK olarak
// extension/lib/domain.js içindeki ">>> SOZLUK2 … <<< SOZLUK2" bloğuna kural satırları olarak yazar.
//
// Sözlüğü, kodu ve test setlerini görmeyen bir alt ajan yalnız alan adlarından yazdı (12.11.2026).
// Bu betik listeye kelime EKLEMEZ; yalnızca şu mekanik elemeleri yapar (hiçbiri kör set 3/4/5'e bakmaz):
//   1. biçim: küçük harf, TR ≥ 4 harf, EN ≥ 3 harf, yalnız harf/rakam/boşluk ve - ' . + # & /
//   2. sözlüğün içinde birden çok alana yazılmış madde → hepsinden çıkar (belirsiz)
//   3. mevcut kurallarla çakışma: madde zaten aynı alanın bir kuralıyla eşleşiyorsa (yinelenen puan olmasın)
//      ya da başka alanın en az o kadar puanlı bir kuralıyla eşleşiyorsa çıkar (mevcut kural kazanır)
//   4. geliştirme verisiyle isabet: tests/ml/train2.tsv (+ train2.meta.tsv alan etiketleri) ve görülmüş
//      domain-cases.json / domain-cases2.json içinde madde ≥ 2 kez eşleşip yarısından azı kendi alanındaysa çıkar;
//      güçlü madde %70'in altındaysa zayıfa indir
//   5. TR maddeler için Türkçe karaktersiz yazım (≥ 5 harf, farklıysa) eklenir: "sözleşme" → "sozlesme"
// Puan: güçlü 1,5 · zayıf 1 (domain.js'teki "genişletilmiş sözlük" bloğuyla aynı ölçek).
//
//   node tools/domain-dict.mjs          → domain.js'i güncelle + özet
//   node tools/domain-dict.mjs --check  → yalnız özet (yazmaz)
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const DOMAIN_JS = path.join(root, "extension/lib/domain.js");
const START = "  // >>> SOZLUK2", END = "  // <<< SOZLUK2";
const check = process.argv.includes("--check");

const src = JSON.parse(readFileSync(path.join(here, "domain-dict/sozluk.json"), "utf8"));
const js = readFileSync(DOMAIN_JS, "utf8");
const a = js.indexOf(START), b = js.indexOf(END);
if (a < 0 || b < 0) { console.error("domain.js içinde SOZLUK2 işaretleri yok"); process.exit(1); }
const EOL = js.includes("\r\n") ? "\r\n" : "\n"; // dosyanın satır sonu biçimi korunur
const stripped = js.slice(0, a + START.length) + EOL + js.slice(b);

// Bloksuz domain.js'i geçici klasörden yükle (mevcut kurallar = sözlük 2 eklenmeden önceki hâl)
const tmp = mkdtempSync(path.join(tmpdir(), "domdict-"));
writeFileSync(path.join(tmp, "package.json"), '{"type":"module"}');
writeFileSync(path.join(tmp, "domain.js"), stripped + "\nexport { RULES as __RULES };\n");
const base = await import(pathToFileURL(path.join(tmp, "domain.js")).href);
const DOMAINS = base.DOMAINS.filter((d) => d !== "general");

const W = "[\\p{L}\\p{N}_]";
const FOLD = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "â": "a", "î": "i", "û": "u" };
const fold = (s) => s.replace(/[çğıöşüâîû]/g, (c) => FOLD[c]);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
const variants = (t) => { const x = t.toLocaleLowerCase("tr"), y = t.toLowerCase(); return x === y ? [x] : [x, y]; };
const forms = (e) => (e.lang === "tr" && e.term.length >= 5 && fold(e.term) !== e.term ? [e.term, fold(e.term)] : [e.term]);
const termRe = (e) => new RegExp(`(?<!${W})(?:${forms(e).map(esc).join("|")})` + (e.lang === "en" ? `(?!${W})` : ""), "iu");
const matches = (re, text) => variants(text).some((v) => re.test(v));

// ---------- 1. Oku ve biçim ele ----------
const stats = { okunan: 0, bicim: 0, cokAlan: 0, yinelenen: 0, cakisma: 0, isabet: 0, zayifa: 0 };
let entries = [];
for (const d of DOMAINS) {
  const o = src[d] || {};
  for (const [key, lang, pts] of [["tr", "tr", 1.5], ["tr_zayif", "tr", 1], ["en", "en", 1.5], ["en_weak", "en", 1]]) {
    for (const raw of o[key] || []) {
      stats.okunan++;
      const term = String(raw).toLocaleLowerCase(lang === "tr" ? "tr" : "en").replace(/\s+/g, " ").trim();
      if (!/^[\p{L}\p{N}][\p{L}\p{N} .'+#&/-]*$/u.test(term) || term.replace(/[^\p{L}\p{N}]/gu, "").length < (lang === "tr" ? 4 : 3)) { stats.bicim++; continue; }
      entries.push({ d, lang, pts, term });
    }
  }
}
// ---------- 2. Birden çok alana yazılmış maddeler; alan içi yinelenenler (güçlü olan kalır) ----------
const domsOf = new Map();
for (const e of entries) { const k = e.lang + ":" + e.term; if (!domsOf.has(k)) domsOf.set(k, new Set()); domsOf.get(k).add(e.d); }
entries = entries.filter((e) => { if (domsOf.get(e.lang + ":" + e.term).size > 1) { stats.cokAlan++; return false; } return true; });
const seen = new Map();
for (const e of entries.sort((x, y) => y.pts - x.pts)) { const k = e.lang + ":" + e.term; if (seen.has(k)) stats.yinelenen++; else seen.set(k, e); }
entries = [...seen.values()];
// ---------- 3. Mevcut kurallarla çakışma ----------
entries = entries.filter((e) => {
  const hit = base.__RULES.filter((r) => forms(e).some((f) => { r.re.lastIndex = 0; return r.re.test(f); }));
  if (hit.some((r) => r.dom === e.d) || hit.some((r) => r.pts >= e.pts)) { stats.cakisma++; return false; }
  return true;
});
// ---------- 4. Geliştirme verisiyle isabet ----------
const dev = [];
const tsv = path.join(root, "tests/ml/train2.tsv"), meta = path.join(root, "tests/ml/train2.meta.tsv");
if (existsSync(tsv) && existsSync(meta)) {
  const lines = (f) => readFileSync(f, "utf8").trim().split(/\r?\n/).filter((l) => l && !l.startsWith("#"));
  const T = lines(tsv), M = lines(meta);
  if (T.length !== M.length) { console.error(`train2.tsv (${T.length}) ile train2.meta.tsv (${M.length}) satır sayısı farklı`); process.exit(1); }
  // meta: dil, alan (yazar), ikinci gözün farklı düşündüğü alan ya da "-"; ikisi de doğru sayılır
  T.forEach((l, i) => { const m = M[i].split("\t"); dev.push({ q: l.slice(l.indexOf("\t") + 1).replace(/\\n/g, "\n"), ok: [m[1], m[2]].filter((d) => d && d !== "-") }); });
}
for (const f of ["tests/domain-cases.json", "tests/domain-cases2.json"]) for (const c of JSON.parse(readFileSync(path.join(root, f), "utf8"))) dev.push({ q: c.q, ok: [c.d, ...(c.alt || [])] });
// (domain.js uzun metinde yalnız baş ve sona bakar; aynı kırpma)
for (const x of dev) if (x.q.length > 3500) x.q = x.q.slice(0, 2500) + "\n" + x.q.slice(-1000);
entries = entries.filter((e) => {
  const re = termRe(e); let n = 0, good = 0;
  for (const x of dev) if (matches(re, x.q)) { n++; if (x.ok.includes(e.d)) good++; }
  e.n = n; e.good = good;
  if (n >= 2 && good / n < 0.5) { stats.isabet++; return false; }
  if (n >= 2 && e.pts > 1 && good / n < 0.7) { e.pts = 1; stats.zayifa++; }
  return true;
});

// ---------- 5. Kural satırları ----------
const lines = [];
for (const d of DOMAINS) for (const lang of ["tr", "en"]) for (const pts of [1.5, 1]) {
  const list = entries.filter((e) => e.d === d && e.lang === lang && e.pts === pts).flatMap(forms);
  if (!list.length) continue;
  const alt = [...new Set(list)].sort((x, y) => y.length - x.length || x.localeCompare(y, "tr")).map(esc).join("|");
  lines.push(`  [/\\b(${alt})${lang === "en" ? "\\b" : ""}/i, ${pts}, "${d}", null],`);
}
const block = START + EOL + lines.join(EOL) + EOL;
const outJs = js.slice(0, a) + block + js.slice(b);

console.log(`sözlük 2: okunan ${stats.okunan} madde → kalan ${entries.length} (${lines.length} kural satırı)`);
console.log(`  elenen: biçim ${stats.bicim} · birden çok alanda ${stats.cokAlan} · yinelenen ${stats.yinelenen} · mevcut kurallarla çakışan ${stats.cakisma} · geliştirme verisinde isabetsiz ${stats.isabet} · zayıfa indirilen ${stats.zayifa}`);
console.log("  alan başına kalan: " + DOMAINS.map((d) => `${d} ${entries.filter((e) => e.d === d).length}`).join(" · "));
console.log(`  geliştirme verisi: ${dev.length} metin`);
if (check) console.log("(--check: yazılmadı)");
else if (outJs !== js) { writeFileSync(DOMAIN_JS, outJs); console.log("yazıldı: extension/lib/domain.js"); }
else console.log("değişiklik yok");
