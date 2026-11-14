// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// KÖR SET 4 ölçümü (tests/domain-cases4.json + tests/ml/test3.tsv): iş türü, konu alanı, model ve effort önerisi.
//
// KÖR SET: bu setin hatalarına bakarak kural, ağırlık ya da sözlük EKLEME. Yeni sözlük gerekiyorsa
// yeni bir kör set yaz (CLAUDE.md). Bu betik yalnızca rapor verir; doğruluk için eşik yoktur.
// Tek sert denetim setin bütünlüğüdür (sayılar, etiket adları, iki dosyanın aynı sırada olması).
//
//   node tests/blind4.mjs            → özet + eski setlerle yan yana tablolar
//   node tests/blind4.mjs --errors   → ayrıca tek tek hatalar (bakıp kural yazmak için DEĞİL; hata türlerini saymak için)
//
// Etiketler: "t"/"d"/"tier"/"effort" alt ajanın etiketi (bariz hatalar ikinci gözle düzeltildi, eski değer "duz" içinde).
// "talt"/"alt" yazarın makul saydığı ikinci etiket; "g2" ikinci gözün farklı düşündüğü yerler.
// "Katı" ölçüm yalnızca ana etiketi, "esnek" ölçüm talt/alt/g2'yi de doğru sayar.
import { readFileSync } from "node:fs";
import { classify, TYPES } from "../extension/lib/classify.js";
import { detectDomain, DOMAINS, PROFILE } from "../extension/lib/domain.js";
import { decideTier, TIERS } from "../extension/lib/advisor.js";
import { recommendEffort, LEVELS } from "../extension/lib/effort.js";

const args = new Set(process.argv.slice(2));
const url = (f) => new URL(f, import.meta.url);
const json = (f) => JSON.parse(readFileSync(url(f), "utf8"));
const tsv = (f) => readFileSync(url(f), "utf8").trim().split(/\r?\n/).filter((l) => l && !l.startsWith("#")).map((l) => {
  const i = l.indexOf("\t"); return { t: l.slice(0, i), q: l.slice(i + 1).replace(/\\n/g, "\n") };
});
const pct = (a, b) => (b ? `%${(100 * a / b).toFixed(1)}` : "–");

// ---------- Setler ----------
const set4 = json("./domain-cases4.json");
const cases = set4.cases;
const t3 = tsv("./ml/test3.tsv");

// ---------- Bütünlük (tek sert denetim) ----------
const errs = [];
const nTR = cases.filter((c) => c.lang === "tr").length, nEN = cases.filter((c) => c.lang === "en").length;
if (!/KÖR SET/.test(set4._not || "")) errs.push("domain-cases4.json başında KÖR SET notu yok");
if (!/^#.*KÖR SET/.test(readFileSync(url("./ml/test3.tsv"), "utf8"))) errs.push("test3.tsv başında KÖR SET notu yok");
if (nTR !== 250 || nEN !== 100) errs.push(`beklenen 250 TR + 100 EN, bulunan ${nTR} + ${nEN}`);
if (t3.length !== cases.length) errs.push(`test3.tsv (${t3.length}) ile domain-cases4.json (${cases.length}) satır sayısı farklı`);
if (new Set(cases.map((c) => c.q)).size !== cases.length) errs.push("yinelenen istem var");
cases.forEach((c, i) => {
  const bad = (m) => errs.push(`#${i + 1}: ${m}`);
  if (!TYPES.includes(c.t)) bad("iş türü " + c.t);
  if (c.talt && !TYPES.includes(c.talt)) bad("talt " + c.talt);
  if (!DOMAINS.includes(c.d)) bad("alan " + c.d);
  if (!(c.alt || []).every((d) => DOMAINS.includes(d))) bad("alt " + c.alt);
  if (!TIERS.includes(c.tier)) bad("tier " + c.tier);
  if (!LEVELS.includes(c.effort)) bad("effort " + c.effort);
  if (c.g2 && ((c.g2.t && !TYPES.includes(c.g2.t)) || (c.g2.d && !DOMAINS.includes(c.g2.d)) || (c.g2.tier && !TIERS.includes(c.g2.tier)) || (c.g2.effort && !LEVELS.includes(c.g2.effort)))) bad("g2 etiketi");
  // (TSV satır sonunu "\n" diye kaçırır; istemin içindeki düz ters eğik çizgi + n de okurken satır sonu olur)
  if (t3[i] && (t3[i].t !== c.t || t3[i].q !== c.q.replace(/\\n/g, "\n"))) bad("test3.tsv ile aynı sırada/metinde değil");
});

// ---------- Ölçüm ----------
const LIGHT = new Set(["short_qa", "translate", "rewrite", "summarize"]);
const FAMILY_MODEL = { haiku: "haiku 5.5", sonnet: "sonnet 5.5", opus: "opus 5.5", fable: "fable 5.1" };
const run = (q) => {
  const rules = classify(q, { useModel: false }), cls = classify(q);
  const dom = detectDomain(q, cls);
  const tier = decideTier(cls, { domain: dom.domain }).tier;
  const eff = recommendEffort({ cls, dom, model: FAMILY_MODEL[tier] })?.level || null;
  return { rules: rules.type, type: cls.type, conf: cls.confidence, dom: dom.domain, tier, eff };
};
const out = cases.map((c) => run(c.q));

// İş türü: katı / esnek / tehlikeli (ağır işi hafif türe atma; kabul edilen hiçbir etiket hafif değilse)
function typeStats(list, guessOf) {
  let strict = 0, lenient = 0, danger = 0;
  for (const { c, g } of list.map((r) => ({ c: r.c, g: guessOf(r) }))) {
    const okSet = [c.t, c.talt, c.g2?.t].filter(Boolean);
    if (g === c.t) strict++;
    if (okSet.includes(g)) lenient++;
    else if (LIGHT.has(g) && !okSet.some((t) => LIGHT.has(t))) danger++;
  }
  return { n: list.length, strict, lenient, danger };
}
const rows = cases.map((c, i) => ({ c, o: out[i] }));
const sub = (lang) => rows.filter((r) => !lang || r.c.lang === lang);
const fmtT = (s) => `${pct(s.strict, s.n)} / ${pct(s.lenient, s.n)} · ${s.danger}`;

console.log(`KÖR SET 4: ${cases.length} istem (${nTR} TR + ${nEN} EN) · yalnızca ölçüm, eşik yok\n`);
console.log("İş türü — katı / esnek doğruluk · tehlikeli hata (ağır işi hafif türe atma)");
console.log("| yöntem | tümü | TR | EN |\n|---|---|---|---|");
for (const [name, f] of [["kurallar", (r) => r.o.rules], ["ürün (kurallar + yayındaki ağırlıklar)", (r) => r.o.type]])
  console.log(`| ${name} | ${["", "tr", "en"].map((l) => fmtT(typeStats(sub(l), f))).join(" | ")} |`);

// Eski setlerle yan yana (ürün ve kurallar; yalnız metin ve yeniden eğitilmiş karma için: node tests/ml/train.mjs --no-write)
const old = [["test (120)", tsv("./ml/test.tsv")], ["test2 (120)", tsv("./ml/test2.tsv")], [`test3, kör (${t3.length})`, t3]];
const accOld = (set, f) => { let ok = 0, dg = 0; for (const r of set) { const g = f(r.q); if (g === r.t) ok++; else if (LIGHT.has(g) && !LIGHT.has(r.t)) dg++; } return `${pct(ok, set.length)} · ${dg}`; };
console.log("\nİş türü, setler yan yana — katı doğruluk · tehlikeli hata");
console.log(`| yöntem | ${old.map((o) => o[0]).join(" | ")} |\n|---|${old.map(() => "---").join("|")}|`);
console.log(`| kurallar | ${old.map((o) => accOld(o[1], (q) => classify(q, { useModel: false }).type)).join(" | ")} |`);
console.log(`| ürün | ${old.map((o) => accOld(o[1], (q) => classify(q).type)).join(" | ")} |`);

// Tür başına (ürün, katı) ve en çok karışan çiftler
const perT = {}; const confT = {};
for (const r of rows) {
  const p = (perT[r.c.t] ||= { n: 0, ok: 0 }); p.n++;
  if (r.o.type === r.c.t) p.ok++;
  else if (![r.c.talt, r.c.g2?.t].includes(r.o.type)) { const k = `${r.c.t} → ${r.o.type}`; confT[k] = (confT[k] || 0) + 1; }
}
console.log("\nTür başına (ürün, katı): " + TYPES.map((t) => `${t} ${perT[t]?.ok ?? 0}/${perT[t]?.n ?? 0}`).join(" · "));
const top = (m, k = 8) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, k).map(([a, b]) => `${a} ×${b}`).join(" · ");
console.log("En çok karışan tür çiftleri (esnekte de yanlış): " + top(confT));

// Konu alanı
function domStats(list) {
  let exact = 0, ok = 0, wrong = 0, toGeneral = 0;
  for (const { c, g } of list) {
    const okSet = [c.d, ...(c.alt || []), c.g2?.d].filter(Boolean);
    if (g === c.d) exact++;
    if (okSet.includes(g)) ok++; else if (g === "general") toGeneral++; else wrong++;
  }
  return { n: list.length, exact, ok, wrong, toGeneral };
}
const domOf = (q) => detectDomain(q, classify(q)).domain;
const d4 = (lang) => domStats(sub(lang).map((r) => ({ c: r.c, g: r.o.dom })));
const dOld = (f) => domStats(json(f).map((c) => ({ c, g: domOf(c.q) })));
const fmtD = (s) => `| ${s.n} | ${pct(s.exact, s.n)} | ${pct(s.ok, s.n)} | ${s.wrong} (${pct(s.wrong, s.n)}) | ${s.toGeneral} (${pct(s.toGeneral, s.n)}) |`;
console.log("\nKonu alanı, setler yan yana");
console.log("| set | istem | tam isabet | kabul edilebilir | yanlış alan | \"genel\"e düşen |\n|---|---|---|---|---|---|");
console.log("| set 1 (geliştirme) " + fmtD(dOld("./domain-cases.json")));
console.log("| set 2 (görüldü) " + fmtD(dOld("./domain-cases2.json")));
console.log("| set 3 (neredeyse kör) " + fmtD(dOld("./domain-cases3.json")));
console.log("| **set 4 (kör)** " + fmtD(d4("")));
console.log("| set 4, TR " + fmtD(d4("tr")));
console.log("| set 4, EN " + fmtD(d4("en")));
const perD = {}; const confD = {};
for (const r of rows) {
  const p = (perD[r.c.d] ||= { n: 0, ok: 0 }); p.n++;
  if ([r.c.d, ...(r.c.alt || []), r.c.g2?.d].includes(r.o.dom)) p.ok++;
  else { const k = `${r.c.d} → ${r.o.dom}`; confD[k] = (confD[k] || 0) + 1; }
}
console.log("\nAlan başına (kabul edilebilir): " + DOMAINS.map((d) => `${d} ${perD[d]?.ok ?? 0}/${perD[d]?.n ?? 0}`).join(" · "));
console.log("En çok karışan alan çiftleri: " + top(confD));

// Model ailesi ve effort (etiket = "yeten en hafif"; öznel, kaba ölçüm)
const cmp = (order, key, lab) => {
  let same = 0, lighter = 0, heavier = 0, light2 = 0, n = 0;
  for (const r of rows) {
    const g = order.indexOf(r.o[key]); if (g < 0) continue; n++;
    const want = order.indexOf(r.c[lab]), want2 = r.c.g2?.[lab] ? order.indexOf(r.c.g2[lab]) : want;
    if (g === want) same++; else if (g < want) lighter++; else heavier++;
    if (g < Math.min(want, want2)) light2++;
  }
  return { n, same, lighter, heavier, light2 };
};
const ti = cmp(TIERS, "tier", "tier"), ef = cmp(LEVELS, "eff", "effort");
console.log("\nÖneri (ürün) ile etiket karşılaştırması");
console.log("| | aynı | etiketten hafif | etiketten ağır | iki etiketleyiciden de hafif |\n|---|---|---|---|---|");
console.log(`| model ailesi | ${pct(ti.same, ti.n)} | ${ti.lighter} (${pct(ti.lighter, ti.n)}) | ${ti.heavier} (${pct(ti.heavier, ti.n)}) | ${ti.light2} |`);
console.log(`| effort | ${pct(ef.same, ef.n)} | ${ef.lighter} (${pct(ef.lighter, ef.n)}) | ${ef.heavier} (${pct(ef.heavier, ef.n)}) | ${ef.light2} |`);
// Haiku önerilen ama iki etiketleyicinin de daha ağır model istediği istemler ve riskli alan kaçakları
const haikuBad = rows.filter((r) => r.o.tier === "haiku" && r.c.tier !== "haiku" && (r.c.g2?.tier || r.c.tier) !== "haiku");
const stakesMiss = rows.filter((r) => (PROFILE[r.c.d]?.stakes || 0) >= 2 && r.o.tier === "haiku");
console.log(`Haiku önerildi, iki etiketleyici de daha ağırını istedi: ${haikuBad.length} · riskli alan (sağlık/hukuk/para) etiketli istemde Haiku: ${stakesMiss.length}`);
console.log(`Haiku önerilen: ${rows.filter((r) => r.o.tier === "haiku").length} · etikette Haiku: ${rows.filter((r) => r.c.tier === "haiku").length}`);

if (args.has("--errors")) {
  const cut = (q) => q.replace(/\s+/g, " ").slice(0, 80);
  console.log("\nİş türü hataları (ürün; esnekte de yanlış):");
  for (const r of rows) if (![r.c.t, r.c.talt, r.c.g2?.t].includes(r.o.type)) console.log(`  ${r.c.t.padEnd(13)} → ${r.o.type.padEnd(13)} [kural: ${r.o.rules}, ${r.o.conf}] ${cut(r.c.q)}`);
  console.log("\nAlan hataları:");
  for (const r of rows) if (![r.c.d, ...(r.c.alt || []), r.c.g2?.d].includes(r.o.dom)) console.log(`  ${r.c.d.padEnd(11)} → ${r.o.dom.padEnd(11)} ${cut(r.c.q)}`);
  console.log("\nHaiku önerildi, iki etiketleyici de daha ağırını istedi:");
  for (const r of haikuBad) console.log(`  etiket ${r.c.tier} · ${r.c.t}→${r.o.type} · ${cut(r.c.q)}`);
}

if (errs.length) { console.error("\nHATA (set bütünlüğü):\n  " + errs.slice(0, 20).join("\n  ")); process.exit(1); }
console.log("\n✓ kör set 4 bütün (ölçüm bilgi amaçlı, eşik yok)");
