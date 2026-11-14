// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Kalite ölçümü, adım 2–3: alt ajanların yazdığı ham cevapları toplar (answers/<model>.json) ve
// hakem için körler: her istemde üç cevap rastgele A/B/C olur, 5'er istemlik gruplar yazılır.
// Eşleme blind/key.json'da durur; hakem puanlamayı bitirmeden bu dosyayı AÇMAZ.
// Çalıştır: node tests/quality/blind.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomInt, randomBytes } from "node:crypto";

const here = (p) => new URL(p, import.meta.url);
const MODELS = ["haiku", "sonnet", "opus"];
const GROUP = 5;
const prompts = JSON.parse(readFileSync(here("./prompts.json"), "utf8"));
const words = (s) => (s.trim().match(/\S+/g) || []).length;

// 1) Ham cevaplar → answers/<model>.json (id → metin). Ham dosya yoksa var olan JSON kullanılır.
const answers = {};
const missing = [];
for (const m of MODELS) {
  const file = here(`./answers/${m}.json`);
  answers[m] = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  for (const p of prompts) {
    const raw = here(`./answers/raw/${p.id}.${m}.md`);
    if (existsSync(raw)) answers[m][p.id] = readFileSync(raw, "utf8").replace(/^﻿/, "").trim();
    if (!answers[m][p.id]) missing.push(`${p.id}.${m}`);
  }
  writeFileSync(file, JSON.stringify(answers[m], null, 1) + "\n");
}
if (missing.length) { console.error(`eksik cevap (${missing.length}): ${missing.join(" ")}`); process.exit(1); }
// Kelime sayısı yalnızca toplu olarak yazdırılır (model başına döküm körlüğü bozar; analyze.mjs raporlar).
const over = prompts.filter((p) => MODELS.some((m) => words(answers[m][p.id]) > 400)).length;
console.log(`${prompts.length * MODELS.length} cevap toplandı · 400 kelimeyi aşan cevabı olan istem: ${over}`);

// 2) Körleme. Var olan anahtarın üstüne yazılmaz (puanlar eski etiketlere bağlıdır).
if (existsSync(here("./blind/key.json"))) { console.error("blind/key.json zaten var; yeni tur için blind/ ve scores/ klasörlerini taşı ya da sil."); process.exit(1); }
mkdirSync(here("./blind/"), { recursive: true });
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const order = shuffle(prompts.map((p) => p.id)); // grup içi istem sırası da rastgele
const key = { created: new Date().toISOString(), nonce: randomBytes(8).toString("hex"), labels: {} };
const byId = Object.fromEntries(prompts.map((p) => [p.id, p]));
const pad = (n) => String(n).padStart(2, "0");
for (let g = 0; g * GROUP < order.length; g++) {
  let md = `# Grup ${pad(g + 1)}\n\nÖlçüt: doğruluk, eksiksizlik, istemin istediğini yapma. 1–5 (yarım puan olur). Etiketler her istemde yeniden karıştırıldı.\n`;
  for (const id of order.slice(g * GROUP, (g + 1) * GROUP)) {
    const perm = shuffle(MODELS);
    key.labels[id] = { A: perm[0], B: perm[1], C: perm[2] };
    md += `\n\n---\n\n## ${id}\n\n**İSTEM:**\n\n${byId[id].prompt}\n`;
    ["A", "B", "C"].forEach((L, i) => { md += `\n### ${id} · ${L}\n\n${answers[perm[i]][id]}\n`; });
  }
  writeFileSync(here(`./blind/grup-${pad(g + 1)}.md`), md);
}
writeFileSync(here("./blind/key.json"), JSON.stringify(key, null, 1) + "\n");
console.log(`${Math.ceil(order.length / GROUP)} grup yazıldı: tests/quality/blind/grup-NN.md · eşleme: blind/key.json (puanlama bitene kadar açma)`);
