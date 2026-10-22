// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Topluluk katkılarını birleştirip yeni başlangıç değerleri üretir → extension/lib/community-priors.js
//
// Kullanım:
//   node tools/aggregate.mjs --gh KULLANICI/DEPO        (GitHub'da "katki" etiketli konular; gh CLI gerekir)
//   node tools/aggregate.mjs klasor/                     (her biri bir katkı metni olan .json/.txt dosyaları)
//   ... --out extension/lib/community-priors.js --dry   (yalnızca özet yaz)
//
// Yöntem: aynı plan ve penceredeki kullanıcıların k sonsallarının ORTANCASI (aykırı kullanıcıya dayanıklı);
// belirsizlik = kullanıcılar arası yayılım (MAD × 1,4826), en az 0,3. En az 3 kullanıcı yoksa o hücre boş kalır
// (eklenti kendi kaba önselini kullanmaya devam eder). Cevap uzunluğu sapması: ölçüm sayısıyla ağırlıklı ortanca.
import { readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { parseContribution, aggregate } from "../extension/lib/contrib.js";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.resolve(opt("--out") || path.join(root, "extension/lib/community-priors.js"));

let texts = [];
if (opt("--gh")) {
  const json = execFileSync("gh", ["issue", "list", "-R", opt("--gh"), "--label", "katki", "--state", "all", "--limit", "1000", "--json", "body,author"], { encoding: "utf8" });
  // Aynı GitHub hesabından birden çok katkı varsa yalnızca en yenisi sayılır (liste yeniden eskiye)
  const seen = new Set();
  for (const it of JSON.parse(json)) { const a = it.author?.login || Math.random(); if (seen.has(a)) continue; seen.add(a); texts.push(it.body); }
} else {
  const dir = args.find((a) => !a.startsWith("--") && a !== opt("--out"));
  if (!dir) { console.error("kaynak verin: klasör ya da --gh KULLANICI/DEPO"); process.exit(2); }
  const files = statSync(dir).isDirectory() ? readdirSync(dir).map((f) => path.join(dir, f)) : [dir];
  texts = files.filter((f) => /\.(json|txt|md)$/.test(f)).map((f) => readFileSync(f, "utf8"));
}

const contribs = texts.map(parseContribution).filter(Boolean);
const agg = aggregate(contribs);
console.log(`katkı: ${texts.length} metin → ${contribs.length} geçerli`);
console.log("k:", JSON.stringify(agg.k));
console.log("cevap uzunluğu sapması:", JSON.stringify(agg.outBias));
console.log("tahmin isabeti (toplam):", agg.acc.n ? `${agg.acc.inRange}/${agg.acc.n}` : "–");
console.log("en sık iş türü düzeltmeleri:", Object.entries(agg.fixes).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([a, n]) => `${a}×${n}`).join(", ") || "–");
if (!args.includes("--dry")) {
  const body = { version: 1, updated: new Date().toISOString().slice(0, 10), contributors: agg.contributors, k: agg.k, outBias: agg.outBias };
  writeFileSync(OUT, `// Topluluk başlangıç değerleri. tools/aggregate.mjs üretir (elle düzenleme).\n// ${agg.contributors} katkıdan; en az 3 kullanıcılı hücreler.\nexport default ${JSON.stringify(body, null, 2)};\n`);
  console.log("yazıldı:", path.relative(root, OUT));
}
