// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Kalite ölçümü, adım 4: kör puanları (scores/grup-NN.json) eşlemeyle (blind/key.json) birleştirir,
// her istem için "yeterli en hafif model"i bulur ve eklentinin önerisiyle karşılaştırır.
//   Kabul edilebilir = puan ≥ 4 VE en iyi cevaptan en fazla 0,5 düşük.
//   (a) hafif öneri hatası  : öneri, yeterli en hafif modelden hafif
//   (b) gereksiz ağır öneri : öneri, yeterli en hafif modelden ağır
// Çalıştır: node tests/quality/analyze.mjs  → sonuc.json + tablolar.md
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const here = (p) => new URL(p, import.meta.url);
const TIERS = ["haiku", "sonnet", "opus", "fable"];
const MODELS = ["haiku", "sonnet", "opus"];
const MIN_SCORE = 4, MAX_GAP = 0.5;
const prompts = JSON.parse(readFileSync(here("./prompts.json"), "utf8"));
const key = JSON.parse(readFileSync(here("./blind/key.json"), "utf8")).labels;
const answers = Object.fromEntries(MODELS.map((m) => [m, JSON.parse(readFileSync(here(`./answers/${m}.json`), "utf8"))]));
const scored = {};
for (const f of readdirSync(here("./scores/")).filter((f) => /^grup-\d+\.json$/.test(f)).sort()) {
  for (const it of JSON.parse(readFileSync(here(`./scores/${f}`), "utf8")).items) {
    if (scored[it.id]) throw new Error("iki kez puanlanmış: " + it.id);
    scored[it.id] = it;
  }
}
const words = (s) => (s.trim().match(/\S+/g) || []).length;

// langSlip: İngilizce isteme Türkçe cevap için hakemin kestiği 1 puan. restoreLang=true bu cezayı geri verir
// (duyarlılık hesabı: dil kayması ölçüm düzeninden kaynaklanıyor olabilir, bkz. RAPOR.md).
const buildRows = (restoreLang, minScore = MIN_SCORE, maxGap = MAX_GAP) => prompts.map((p) => {
  const s = scored[p.id], k = key[p.id];
  if (!s || !k) throw new Error("puan ya da eşleme yok: " + p.id);
  const score = {};
  for (const L of ["A", "B", "C"]) {
    if (!(s[L] >= 1 && s[L] <= 5)) throw new Error(`geçersiz puan ${p.id}.${L}`);
    score[k[L]] = restoreLang && (s.langSlip || []).includes(L) ? Math.min(5, s[L] + 1) : s[L];
  }
  const best = Math.max(...MODELS.map((m) => score[m]));
  const ok = Object.fromEntries(MODELS.map((m) => [m, score[m] >= minScore && score[m] >= best - maxGap]));
  const lightest = MODELS.find((m) => ok[m]) || null; // hiçbiri 4'e ulaşmadıysa null
  const ri = TIERS.indexOf(p.tier), li = lightest ? TIERS.indexOf(lightest) : -1;
  const verdict = !lightest ? "olculemedi" : ri < li ? "hafif" : ri > li ? "agir" : "uygun";
  return {
    id: p.id, set: p.set, prompt: p.prompt, noContext: p.noContext, type: p.type, domain: p.domain,
    confidence: p.confidence, complexity: p.complexity, words: p.words, shown: p.shown,
    rec: p.tier, recEffort: p.fromSonnet?.effort || null, authorOk: p.authorOk,
    score, best, lightest, verdict, steps: lightest ? ri - li : null,
    // Önerilen modelin kendi cevabı kabul edilebilir mi? (Fable cevaplatılmadı → null)
    recOk: MODELS.includes(p.tier) ? ok[p.tier] : null,
    authorAgrees: lightest ? p.authorOk.includes(lightest) : null,
    langSlip: (s.langSlip || []).map((L) => k[L]), unblinded: (s.unblinded || []).map((L) => k[L]),
    answerWords: Object.fromEntries(MODELS.map((m) => [m, words(answers[m][p.id])])),
    note: s.note || ""
  };
});
const rows = buildRows(false), rowsLang = buildRows(true);

const count = (list, f) => list.filter(f).length;
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
// Wilson %95 aralığı (küçük örneklemde oranın belirsizliği)
const wilson = (k, n) => {
  if (!n) return [0, 0];
  const z = 1.96, p = k / n, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), w = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, Math.round((100 * (c - w)) / d)), Math.min(100, Math.round((100 * (c + w)) / d))];
};
const summarize = (list) => {
  const n = list.length, h = count(list, (r) => r.verdict === "hafif"), a = count(list, (r) => r.verdict === "agir");
  return {
    n, uygun: count(list, (r) => r.verdict === "uygun"), hafif: h, agir: a, olculemedi: count(list, (r) => r.verdict === "olculemedi"),
    hafifCI: wilson(h, n), agirCI: wilson(a, n),
    lightest: Object.fromEntries([...MODELS, null].map((m) => [m || "hicbiri", count(list, (r) => r.lightest === m)])),
    mean: Object.fromEntries(MODELS.map((m) => [m, n ? +(list.reduce((s, r) => s + r.score[m], 0) / n).toFixed(2) : 0])),
    acceptable: Object.fromEntries(MODELS.map((m) => [m, count(list, (r) => r.score[m] >= MIN_SCORE && r.score[m] >= r.best - MAX_GAP)])),
    recNotOk: count(list, (r) => r.recOk === false)
  };
};
const group = (list, k) => Object.fromEntries([...new Set(list.map((r) => r[k]))].sort().map((v) => [v, summarize(list.filter((r) => r[k] === v))]));

const solo = rows.filter((r) => !r.noContext), ctx = rows.filter((r) => r.noContext);
const result = {
  rule: { minScore: MIN_SCORE, maxGap: MAX_GAP }, all: summarize(rows), standalone: summarize(solo), noContext: summarize(ctx),
  byRec: group(solo, "rec"), byType: group(solo, "type"), byDomain: group(solo, "domain"), bySet: group(rows, "set"),
  langRestored: {
    standalone: null, all: null,
    changed: rows.filter((r, i) => r.verdict !== rowsLang[i].verdict || r.lightest !== rowsLang[i].lightest)
      .map((r) => ({ id: r.id, from: `${r.lightest || "yok"}/${r.verdict}`, to: `${rowsLang.find((x) => x.id === r.id).lightest || "yok"}/${rowsLang.find((x) => x.id === r.id).verdict}` }))
  },
  langSlipByModel: Object.fromEntries(MODELS.map((m) => [m, count(rows, (r) => r.langSlip.includes(m))])),
  best: Object.fromEntries(MODELS.map((m) => [m, count(solo, (r) => r.score[m] === r.best)])),
  authorAgree: { n: count(rows, (r) => r.authorAgrees !== null), yes: count(rows, (r) => r.authorAgrees === true) },
  answerWords: Object.fromEntries(MODELS.map((m) => [m, { mean: Math.round(rows.reduce((s, r) => s + r.answerWords[m], 0) / rows.length), over400: count(rows, (r) => r.answerWords[m] > 400) }])),
  rows
};
// Kural duyarlılığı: "kabul edilebilir" tanımı değişirse sonuç ne kadar oynuyor? (yalnızca kendi başına cevaplanabilir istemler)
result.ruleVariants = [[4, 0.5], [4, 1], [4, Infinity], [4.5, 0.5]].map(([mn, gap]) => {
  const l = buildRows(false, mn, gap).filter((r) => !r.noContext);
  return { minScore: mn, maxGap: Number.isFinite(gap) ? gap : null, uygun: count(l, (r) => r.verdict === "uygun"), hafif: count(l, (r) => r.verdict === "hafif"), agir: count(l, (r) => r.verdict === "agir"), olculemedi: count(l, (r) => r.verdict === "olculemedi"), hafifIds: l.filter((r) => r.verdict === "hafif").map((r) => r.id) };
});
result.langRestored.standalone = summarize(rowsLang.filter((r) => !r.noContext));
result.langRestored.all = summarize(rowsLang);
writeFileSync(here("./sonuc.json"), JSON.stringify(result, null, 1) + "\n");

// ---- tablolar.md (RAPOR.md buradaki sayılara dayanır; elle düzenleme) ----
const line = (name, s) => `| ${name} | ${s.n} | ${s.uygun} | ${s.hafif} | ${s.agir} | ${s.olculemedi} | ${s.lightest.haiku}/${s.lightest.sonnet}/${s.lightest.opus}/${s.lightest.hicbiri} | ${s.mean.haiku} / ${s.mean.sonnet} / ${s.mean.opus} |`;
const head = "| | n | uygun | (a) hafif | (b) ağır | ölçülemedi | yeterli en hafif H/S/O/yok | ortalama puan H / S / O |\n|---|---|---|---|---|---|---|---|";
const table = (title, obj) => `\n### ${title}\n\n${head}\n${Object.entries(obj).map(([k, s]) => line(k, s)).join("\n")}\n`;
let md = "# Kalite ölçümü: tablolar (analyze.mjs üretir)\n";
md += table("Özet", { "tümü": result.all, "kendi başına cevaplanabilir": result.standalone, "bağlamsız": result.noContext });
md += `\n(a) hafif öneri oranı, kendi başına cevaplanabilir istemlerde: ${solo.length ? pct(result.standalone.hafif, solo.length) : 0}% (Wilson %95: ${result.standalone.hafifCI.join("–")}%) · (b) ağır: ${pct(result.standalone.agir, solo.length)}% (${result.standalone.agirCI.join("–")}%)\n`;
md += table("Duyarlılık: dil kayması cezası geri verilirse", { "tümü": result.langRestored.all, "kendi başına cevaplanabilir": result.langRestored.standalone });
md += `
Değişen istemler: ${result.langRestored.changed.map((c) => `${c.id} (${c.from} → ${c.to})`).join(", ") || "yok"} · dil kayması sayısı H/S/O: ${MODELS.map((m) => result.langSlipByModel[m]).join("/")}
`;
md += `
Kendi başına cevaplanabilir istemlerde en yüksek puanı alan (beraberlikler dahil) H/S/O: ${MODELS.map((m) => result.best[m]).join("/")} · yazarın rec-cases etiketi ölçülen "yeterli en hafif"i içeriyor: ${result.authorAgree.yes}/${result.authorAgree.n}
`;
md += `
### Kural duyarlılığı (kendi başına cevaplanabilir, n = ${solo.length})

| en az puan | en iyiden en fazla fark | uygun | (a) hafif | (b) ağır | ölçülemedi | hafif sayılanlar |
|---|---|---|---|---|---|---|
${result.ruleVariants.map((v) => `| ${v.minScore} | ${v.maxGap ?? "sınırsız"} | ${v.uygun} | ${v.hafif} | ${v.agir} | ${v.olculemedi} | ${v.hafifIds.join(", ")} |`).join("\n")}\n`;
md += table("Önerilen modele göre (kendi başına cevaplanabilir)", result.byRec);
md += table("İş türüne göre (kendi başına cevaplanabilir)", result.byType);
md += table("Konu alanına göre (kendi başına cevaplanabilir)", result.byDomain);
md += table("Kaynak sete göre (tümü)", result.bySet);
md += `\n### Cevap uzunluğu (kelime)\n\n| model | ortalama | 400'ü aşan |\n|---|---|---|\n${MODELS.map((m) => `| ${m} | ${result.answerWords[m].mean} | ${result.answerWords[m].over400} |`).join("\n")}\n`;
md += "\n### İstem başına\n\n| id | tür | alan | öneri | H | S | O | yeterli en hafif | sonuç | istem | hakem notu |\n|---|---|---|---|---|---|---|---|---|---|---|\n";
const esc = (s) => s.replace(/\|/g, "\\|").replace(/\s+/g, " ");
for (const r of rows) md += `| ${r.id}${r.noContext ? " ᴮ" : ""} | ${r.type} | ${r.domain} | ${r.rec} | ${r.score.haiku} | ${r.score.sonnet} | ${r.score.opus} | ${r.lightest || "yok"} | ${r.verdict} | ${esc(r.prompt).slice(0, 60)} | ${esc(r.note)} |\n`;
md += "\nᴮ = bağlamsız (metin/dosya/önceki sohbet eksik).\n";
writeFileSync(here("./tablolar.md"), md);

const s = result.standalone;
console.log(`kendi başına ${s.n}: uygun ${s.uygun} · hafif ${s.hafif} · ağır ${s.agir} · ölçülemedi ${s.olculemedi} | tümü ${rows.length}: uygun ${result.all.uygun} · hafif ${result.all.hafif} · ağır ${result.all.agir} · ölçülemedi ${result.all.olculemedi}`);
console.log(`ortalama puan (tümü) H/S/O: ${result.all.mean.haiku} / ${result.all.mean.sonnet} / ${result.all.mean.opus}`);
