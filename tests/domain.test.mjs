// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Konu alanı sınıflandırıcı testi: elle etiketlenmiş TR+EN istekler (tests/domain-cases.json).
// "alt": makul kabul edilen ikinci alan (ör. "Arduino kodu" hem mühendislik hem yazılım).
// Not: istekleri de proje yazdı; gerçek kullanıcı mesajlarıyla ölçülmedi.
import { readFileSync } from "node:fs";
import { detectDomain, DOMAINS } from "../extension/lib/domain.js";
import { classify } from "../extension/lib/classify.js";

const cases = JSON.parse(readFileSync(new URL("./domain-cases.json", import.meta.url)));
let exact = 0, ok = 0, fails = [];
const per = {};
for (const c of cases) {
  const cls = classify(c.q);
  const d = detectDomain(c.q, cls);
  const accepted = d.domain === c.d || (c.alt || []).includes(d.domain);
  if (d.domain === c.d) exact++;
  if (accepted) ok++; else fails.push(`${c.d} → ${d.domain} (${d.sub || "-"}) · ${c.q}`);
  const p = (per[c.d] ||= { n: 0, ok: 0 }); p.n++; if (accepted) p.ok++;
}
const n = cases.length;
console.log(`alan: ${n} istek · tam isabet %${Math.round(100 * exact / n)} · kabul edilebilir %${Math.round(100 * ok / n)}`);
for (const [k, v] of Object.entries(per)) if (v.ok < v.n) console.log(`  ${k}: ${v.ok}/${v.n}`);
for (const f of fails) console.log("  ✗ " + f);

// Set 2: ilk ölçümde kördü (%59 kabul edilebilir), sonra sözlük genişletilirken görüldü.
// Set 3: sözlük bittikten sonra yazıldı; ilk ölçüm %72 kabul edilebilir, 6 yanlış alan. Ardından yalnızca
// 4 yanlış tetikleme hatası düzeltildi ("edebilir"→edebi, "Roman Empire"→roman, OOP kalıtım, çeviri ipucu);
// eksik kelime eklenmedi. Bilgi amaçlı, eşik yok.
const blind = {};
for (const [name, file] of [["set 2 (görüldü)", "./domain-cases2.json"], ["set 3 (neredeyse kör)", "./domain-cases3.json"]]) {
  const cs = JSON.parse(readFileSync(new URL(file, import.meta.url)));
  let okb = 0, exb = 0, wrong = 0; const fl = [];
  for (const c of cs) {
    const d = detectDomain(c.q, classify(c.q));
    if (d.domain === c.d) exb++;
    if (d.domain === c.d || (c.alt || []).includes(d.domain)) okb++;
    else { fl.push(`${c.d} → ${d.domain} · ${c.q}`); if (d.domain !== "general") wrong++; }
  }
  blind[name] = { n: cs.length, ok: okb / cs.length, wrong };
  console.log(`alan, ${name}: ${cs.length} istek · tam isabet %${Math.round(100 * exb / cs.length)} · kabul edilebilir %${Math.round(100 * okb / cs.length)} · yanlış alan ${wrong} (geri kalan hatalar "genel")`);
  for (const f of fl) console.log("  · " + f);
}

// Hız: uzun metinde de hızlı olmalı
const long = "Bu bir deneme metnidir. ".repeat(3000);
const t0 = performance.now(); for (let i = 0; i < 20; i++) detectDomain(long); const ms = (performance.now() - t0) / 20;
console.log(`hız: uzun metin ${ms.toFixed(1)} ms`);

const errs = [];
if (ok / n < 0.85) errs.push(`kabul edilebilir isabet %85'in altında (%${Math.round(100 * ok / n)})`);
if (ms > 25) errs.push("uzun metin 25 ms'den yavaş");
if (!cases.every((c) => DOMAINS.includes(c.d))) errs.push("bilinmeyen alan etiketi");
if (detectDomain("").domain !== "general") errs.push("boş metin general olmalı");
if (errs.length) { console.error("HATA: " + errs.join("; ")); process.exit(1); }
console.log("✓ alan testleri geçti");
