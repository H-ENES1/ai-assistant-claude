// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// KÖR SET 5 ölçümü (tests/domain-cases5.json + tests/ml/test4.tsv) ve setler yan yana tablo:
// test / test2 / set 4 (bilgi amaçlı) / set 5 için doğruluk, tehlikeli hata, hafif-öneri hatası,
// Haiku yanlış öneri, riskli alanda Haiku; ayrıca konu alanı.
//
// KÖR SET: bu setin hatalarına bakarak kural, ağırlık ya da sözlük EKLEME (CLAUDE.md). Bu betik bilerek
// tek tek hataları BASMAZ; yalnızca toplam sayıları verir. Doğruluk için eşik yoktur; tek sert denetim
// setin bütünlüğüdür. Set 4 artık yanmıştır (eğitim verisi onun toplu sonuçlarına göre yazıldı): bilgi amaçlı.
//
//   node tests/blind5.mjs                 → bugünkü ürün
//   node tests/blind5.mjs --base=<klasör> → ayrıca "önce" satırları; <klasör>/extension/lib eski bir sürümün
//                                           kopyasıdır (ör. git archive kor-set-4 extension/lib | tar -x -C <klasör>)
//   node tests/blind5.mjs --base=<klasör> --alt="<ad>=<klasör>" → ek ara sürüm satırları (ör. eski ağırlık + yeni kod)
//   node tests/blind5.mjs --check         → yalnız set bütünlüğü, ölçüm yok (npm run test)
//
// Etiketler: "t"/"d"/"tier"/"effort" yazar alt ajanın etiketi (model ve effort TAHMİNDİR, ölçülmüş değil).
// "talt"/"alt" yazarın makul saydığı ikinci etiket; "g2" bağımsız ikinci etiketleyicinin farklı düşündüğü yerler;
// "duz" bariz hata diye düzeltilen etiketin eski değeri. "Katı" yalnız ana etiketi, "esnek" talt/alt/g2'yi de doğru sayar.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const argv = process.argv.slice(2);
const baseDir = (argv.find((a) => a.startsWith("--base=")) || "").slice(7);
const json = (f) => JSON.parse(readFileSync(path.join(here, f), "utf8"));
const tsv = (f) => readFileSync(path.join(here, f), "utf8").trim().split(/\r?\n/).filter((l) => l && !l.startsWith("#")).map((l) => {
  const i = l.indexOf("\t"); return { t: l.slice(0, i), q: l.slice(i + 1).replace(/\\n/g, "\n") };
});
const pct = (a, b) => (b ? `%${(100 * a / b).toFixed(1)}` : "–");

// ---------- Ürün sürümleri ("önce" isteğe bağlı, "sonra" bu çalışma ağacı) ----------
async function load(name, dir) {
  const u = (f) => pathToFileURL(path.join(dir, "extension", "lib", f)).href;
  const c = await import(u("classify.js")), d = await import(u("domain.js")), a = await import(u("advisor.js")), e = await import(u("effort.js"));
  return { name, c, d, a, e };
}
const trees = [];
if (baseDir) {
  if (!existsSync(path.join(baseDir, "extension", "lib", "classify.js"))) { console.error("--base klasöründe extension/lib/classify.js yok"); process.exit(1); }
  trees.push(await load("önce", path.resolve(baseDir)));
}
// --alt=<ad>=<klasör>: ek bir ara sürüm (ör. "eski ağırlık + yeni kod"); birden çok verilebilir
for (const a of argv.filter((x) => x.startsWith("--alt="))) {
  const [name, dir] = a.slice(6).split(/=(.*)/s);
  trees.push(await load(name, path.resolve(dir)));
}
trees.push(await load(baseDir ? "sonra" : "ürün", root));
const cur = trees[trees.length - 1];
const { TYPES } = cur.c, { DOMAINS, PROFILE } = cur.d, { TIERS } = cur.a, { LEVELS } = cur.e;

// ---------- Setler ----------
const set5 = json("./domain-cases5.json"), cases5 = set5.cases, t4 = tsv("./ml/test4.tsv");
const cases4 = json("./domain-cases4.json").cases;
const SETS = [
  { key: "test", name: "test (120)", cases: tsv("./ml/test.tsv") },
  { key: "test2", name: "test2 (120)", cases: tsv("./ml/test2.tsv") },
  { key: "set4", name: `set 4 (${cases4.length}, bilgi amaçlı)`, cases: cases4, labeled: true },
  { key: "set5", name: `set 5 (${cases5.length}, kör)`, cases: cases5, labeled: true }
];

// ---------- Bütünlük (tek sert denetim) ----------
const errs = [];
const nTR = cases5.filter((c) => c.lang === "tr").length, nEN = cases5.filter((c) => c.lang === "en").length;
if (!/KÖR SET/.test(set5._not || "")) errs.push("domain-cases5.json başında KÖR SET notu yok");
if (!/^#.*KÖR SET/.test(readFileSync(path.join(here, "./ml/test4.tsv"), "utf8"))) errs.push("test4.tsv başında KÖR SET notu yok");
if (nTR !== 200 || nEN !== 100) errs.push(`beklenen 200 TR + 100 EN, bulunan ${nTR} + ${nEN}`);
if (t4.length !== cases5.length) errs.push(`test4.tsv (${t4.length}) ile domain-cases5.json (${cases5.length}) satır sayısı farklı`);
if (new Set(cases5.map((c) => c.q)).size !== cases5.length) errs.push("yinelenen istem var");
cases5.forEach((c, i) => {
  const bad = (m) => errs.push(`#${i + 1}: ${m}`);
  if (!TYPES.includes(c.t)) bad("iş türü " + c.t);
  if (c.talt && !TYPES.includes(c.talt)) bad("talt " + c.talt);
  if (!DOMAINS.includes(c.d)) bad("alan " + c.d);
  if (!(c.alt || []).every((d) => DOMAINS.includes(d))) bad("alt " + c.alt);
  if (!TIERS.includes(c.tier)) bad("tier " + c.tier);
  if (!LEVELS.includes(c.effort)) bad("effort " + c.effort);
  if (c.g2 && ((c.g2.t && !TYPES.includes(c.g2.t)) || (c.g2.d && !DOMAINS.includes(c.g2.d)) || (c.g2.tier && !TIERS.includes(c.g2.tier)) || (c.g2.effort && !LEVELS.includes(c.g2.effort)))) bad("g2 etiketi");
  if (t4[i] && (t4[i].t !== c.t || t4[i].q !== c.q.replace(/\\n/g, "\n"))) bad("test4.tsv ile aynı sırada/metinde değil");
});
// --check: yalnız bütünlük (npm run test bunu çalıştırır). Ölçüm her test koşusunda basılmaz ki
// set 5 sayılarına bakarak ayar yapma alışkanlığı oluşmasın; ölçüm için: npm run blind5
if (argv.includes("--check")) {
  if (errs.length) { console.error("HATA (set bütünlüğü):\n  " + errs.slice(0, 20).join("\n  ")); process.exit(1); }
  console.log(`✓ kör set 5 bütün (${cases5.length} istem; ölçülmedi)`); process.exit(0);
}

// ---------- Ölçüm ----------
const LIGHT = new Set(["short_qa", "translate", "rewrite", "summarize"]);
const FAMILY_MODEL = { haiku: "haiku 5.5", sonnet: "sonnet 5.5", opus: "opus 5.5", fable: "fable 5.1" };
const run = (T, q) => {
  const rules = T.c.classify(q, { useModel: false }), cls = T.c.classify(q);
  const dom = T.d.detectDomain(q, cls);
  const tier = T.a.decideTier(cls, { domain: dom.domain }).tier;
  const eff = T.e.recommendEffort({ cls, dom, model: FAMILY_MODEL[tier] })?.level || null;
  return { rules: rules.type, type: cls.type, conf: cls.confidence, dom: dom.domain, tier, eff };
};
const OUT = {}; // OUT[ağaç][set] = [{c, o}]
for (const T of trees) { OUT[T.name] = {}; for (const S of SETS) OUT[T.name][S.key] = S.cases.map((c) => ({ c, o: run(T, c.q) })); }

// İş türü: katı / esnek / tehlikeli (ağır işi hafif türe atma; kabul edilen hiçbir etiket hafif değilse)
function typeStats(rows, guessOf) {
  let strict = 0, lenient = 0, danger = 0;
  for (const r of rows) {
    const g = guessOf(r), okSet = [r.c.t, r.c.talt, r.c.g2?.t].filter(Boolean);
    if (g === r.c.t) strict++;
    if (okSet.includes(g)) lenient++;
    else if (LIGHT.has(g) && !okSet.some((t) => LIGHT.has(t))) danger++;
  }
  return { n: rows.length, strict, lenient, danger };
}
// Öneri güvenliği. Etiketli setlerde (4, 5) model ailesi etiketi vardır; test/test2'de yalnız iş türü etiketi
// olduğundan "hafif öneri" = hafif olmayan türe (etikete göre) Haiku önerilmesi; alan etiketi yok → riskli alan ölçülemez.
function recStats(rows, labeled) {
  let lighter = 0, light2 = 0, haikuBad = 0, stakes = 0, haiku = 0;
  for (const r of rows) {
    if (r.o.tier === "haiku") haiku++;
    if (labeled) {
      const g = TIERS.indexOf(r.o.tier), want = TIERS.indexOf(r.c.tier), want2 = r.c.g2?.tier ? TIERS.indexOf(r.c.g2.tier) : want;
      if (g < want) lighter++;
      if (g < Math.min(want, want2)) light2++;
      if (r.o.tier === "haiku" && Math.min(want, want2) > 0) haikuBad++;
      if ((PROFILE[r.c.d]?.stakes || 0) >= 2 && r.o.tier === "haiku") stakes++;
    } else if (r.o.tier === "haiku" && !LIGHT.has(r.c.t)) { lighter++; light2++; haikuBad++; }
  }
  return { lighter, light2, haikuBad, stakes: labeled ? stakes : null, haiku };
}
function domStats(list) {
  let exact = 0, ok = 0, wrong = 0, toGeneral = 0;
  for (const { c, g } of list) {
    const okSet = [c.d, ...(c.alt || []), c.g2?.d].filter(Boolean);
    if (g === c.d) exact++;
    if (okSet.includes(g)) ok++; else if (g === "general") toGeneral++; else wrong++;
  }
  return { n: list.length, exact, ok, wrong, toGeneral };
}

console.log(`KÖR SET 5: ${cases5.length} istem (${nTR} TR + ${nEN} EN) · yalnızca ölçüm, eşik yok · model ve effort etiketleri tahmindir\n`);

const head = `| yapılandırma | ${SETS.map((s) => s.name).join(" | ")} |\n|---|${SETS.map(() => "---").join("|")}|`;
console.log("İş türü — katı doğruluk (esnek) · tehlikeli hata (ağır işi hafif türe atma)");
console.log(head);
const cellT = (s, labeled) => `${pct(s.strict, s.n)}${labeled ? ` (${pct(s.lenient, s.n)})` : ""} · ${s.danger}`;
for (const T of trees) {
  console.log(`| kurallar, ${T.name} | ${SETS.map((S) => cellT(typeStats(OUT[T.name][S.key], (r) => r.o.rules), S.labeled)).join(" | ")} |`);
  console.log(`| ürün (kurallar + ağırlıklar), ${T.name} | ${SETS.map((S) => cellT(typeStats(OUT[T.name][S.key], (r) => r.o.type), S.labeled)).join(" | ")} |`);
}

console.log("\nÖneri güvenliği (ürün) — hafif-öneri hatası [iki etiketleyiciden de hafif] · Haiku yanlış öneri · riskli alanda (sağlık/hukuk/para) Haiku · (Haiku önerilen toplam)");
console.log(head);
for (const T of trees) console.log(`| ${T.name} | ${SETS.map((S) => { const s = recStats(OUT[T.name][S.key], S.labeled); return `${s.lighter} [${s.light2}] · ${s.haikuBad} · ${s.stakes ?? "–"} · (${s.haiku})`; }).join(" | ")} |`);
console.log("(test ve test2'de model etiketi yok: hafif-öneri = etikete göre hafif olmayan türe Haiku önerilmesi; alan etiketi olmadığından riskli alan ölçülemez)");

console.log("\nKonu alanı — tam isabet · kabul edilebilir · yanlış alan · \"genel\"e düşen");
const DSETS = [["set 1 (geliştirme)", json("./domain-cases.json")], ["set 2 (görüldü)", json("./domain-cases2.json")], ["set 3 (neredeyse kör)", json("./domain-cases3.json")],
  ["set 4 (bilgi amaçlı)", cases4], ["set 5 (kör)", cases5], ["set 5, TR", cases5.filter((c) => c.lang === "tr")], ["set 5, EN", cases5.filter((c) => c.lang === "en")]];
console.log(`| set | istem | ${trees.map((T) => T.name).join(" | ")} |\n|---|---|${trees.map(() => "---").join("|")}|`);
for (const [name, cs] of DSETS) {
  const cells = trees.map((T) => { const s = domStats(cs.map((c) => ({ c, g: T.d.detectDomain(c.q, T.c.classify(c.q)).domain }))); return `${pct(s.exact, s.n)} · ${pct(s.ok, s.n)} · ${s.wrong} · ${s.toGeneral}`; });
  console.log(`| ${name} | ${cs.length} | ${cells.join(" | ")} |`);
}

// Set 5 ayrıntısı (yalnız toplamlar): dil, uzunluk, tür başına, güven
const words = (q) => (q.trim().match(/\S+/g) || []).length;
const bucket = (q) => { const n = words(q); return n < 20 ? "<20 kelime" : n <= 150 ? "20–150 kelime" : ">150 kelime"; };
console.log("\nSet 5 ayrıntısı (ürün) — katı (esnek) · tehlikeli");
console.log(`| dilim | istem | ${trees.map((T) => T.name).join(" | ")} |\n|---|---|${trees.map(() => "---").join("|")}|`);
const slices = [["tümü", () => true], ["TR", (c) => c.lang === "tr"], ["EN", (c) => c.lang === "en"], ...["<20 kelime", "20–150 kelime", ">150 kelime"].map((b) => [b, (c) => bucket(c.q) === b])];
for (const [name, f] of slices) {
  const n = cases5.filter(f).length;
  console.log(`| ${name} | ${n} | ${trees.map((T) => cellT(typeStats(OUT[T.name].set5.filter((r) => f(r.c)), (r) => r.o.type), true)).join(" | ")} |`);
}
for (const T of trees) {
  const rows = OUT[T.name].set5, per = {}, conf = {}, pairs = {};
  for (const r of rows) {
    const p = (per[r.c.t] ||= { n: 0, ok: 0 }); p.n++; if (r.o.type === r.c.t) p.ok++;
    const k = (conf[r.o.conf] ||= { n: 0, ok: 0 }); k.n++; if (r.o.type === r.c.t) k.ok++;
    if (![r.c.t, r.c.talt, r.c.g2?.t].includes(r.o.type)) { const key = `${r.c.t} → ${r.o.type}`; pairs[key] = (pairs[key] || 0) + 1; }
  }
  console.log(`\n[${T.name}] tür başına (katı): ` + TYPES.map((t) => `${t} ${per[t]?.ok ?? 0}/${per[t]?.n ?? 0}`).join(" · "));
  console.log(`[${T.name}] en çok karışan tür çiftleri (esnekte de yanlış): ` + Object.entries(pairs).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([a, b]) => `${a} ×${b}`).join(" · "));
  console.log(`[${T.name}] güvene göre doğruluk: ` + ["high", "medium", "low"].map((k) => `${k} ${pct(conf[k]?.ok || 0, conf[k]?.n || 0)} (${conf[k]?.n || 0})`).join(" · "));
  const perD = {};
  for (const r of rows) { const p = (perD[r.c.d] ||= { n: 0, ok: 0 }); p.n++; if ([r.c.d, ...(r.c.alt || []), r.c.g2?.d].includes(r.o.dom)) p.ok++; }
  console.log(`[${T.name}] alan başına (kabul edilebilir): ` + DOMAINS.map((d) => `${d} ${perD[d]?.ok ?? 0}/${perD[d]?.n ?? 0}`).join(" · "));
  const cmp = (order, key, lab) => { let same = 0, lighter = 0, heavier = 0, n = 0; for (const r of rows) { const g = order.indexOf(r.o[key]); if (g < 0) continue; n++; const want = order.indexOf(r.c[lab]); if (g === want) same++; else if (g < want) lighter++; else heavier++; } return `aynı ${pct(same, n)} · hafif ${lighter} · ağır ${heavier}`; };
  console.log(`[${T.name}] etiketle karşılaştırma — model ailesi: ${cmp(TIERS, "tier", "tier")} · effort: ${cmp(LEVELS, "eff", "effort")}`);
}

if (errs.length) { console.error("\nHATA (set bütünlüğü):\n  " + errs.slice(0, 20).join("\n  ")); process.exit(1); }
console.log("\n✓ kör set 5 bütün (ölçüm bilgi amaçlı, eşik yok)");
