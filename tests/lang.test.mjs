// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Dil testleri: 10 dilin ileti dosyaları (anahtar/yer tutucu eşitliği), dil algılama, dil başına token tahmini.
import { readFileSync, existsSync } from "node:fs";
import { LANGS, format } from "../extension/lib/i18n.js";
import { textLanguage, estimateTokens } from "../extension/lib/tokens.js";
let fail = 0;
const t = (name, cond, info = "") => { console.log(`${cond ? "✓" : "✗"} ${name}${info ? " — " + info : ""}`); if (!cond) fail++; };
const load = (d) => JSON.parse(readFileSync(new URL(`../extension/_locales/${d}/messages.json`, import.meta.url), "utf8"));
const en = load("en");
const keys = Object.keys(en);
const phs = (s) => (s.match(/\$(?:[1-9]|[A-Z]+\$)/g) || []).sort().join(",");
const manifest = JSON.parse(readFileSync(new URL("../extension/manifest.json", import.meta.url), "utf8"));

for (const [code, L] of Object.entries(LANGS)) {
  const ok = existsSync(new URL(`../extension/_locales/${L.dir}/messages.json`, import.meta.url));
  if (!ok) { t(`${code}: dosya var`, false); continue; }
  const m = load(L.dir);
  const missing = keys.filter(k => !(k in m)), extra = Object.keys(m).filter(k => !(k in en));
  t(`${code}: anahtarlar eşit (${keys.length})`, !missing.length && !extra.length, [...missing.slice(0, 3), ...extra.slice(0, 3)].join(","));
  const badPh = keys.filter(k => en[k].message && phs(en[k].message) !== phs(m[k].message));
  t(`${code}: yer tutucular aynı`, !badPh.length, badPh.slice(0, 3).join(","));
  const badPhObj = keys.filter(k => JSON.stringify(en[k].placeholders || null) !== JSON.stringify(m[k].placeholders || null));
  t(`${code}: placeholders nesneleri aynı`, !badPhObj.length, badPhObj.slice(0, 3).join(","));
  const empty = keys.filter(k => en[k].message && !String(m[k].message).trim());
  t(`${code}: boş çeviri yok`, !empty.length, empty.slice(0, 3).join(","));
  // Mağaza sınırları: ad ≤ 75, kısa ad ≤ 12 (okunabilirlik için 20), açıklama ≤ 132
  t(`${code}: extName ≤ 75, extDescription ≤ 132`, m.extName.message.length <= 75 && m.extDescription.message.length <= 132, `${m.extName.message.length}/${m.extDescription.message.length}`);
  t(`${code}: biçim çalışır`, format(m.resetsAt, ["10:30"]).includes("10:30") && format(m.panelEstimate, ["3", "5"]).includes("3"));
  if (code !== "en" && code !== "tr") {
    const same = keys.filter(k => /^(eff|dbasis|tbasis|sub_|dom_|advCaveat|privacyNote)/.test(k) && en[k].message.length > 25 && m[k].message === en[k].message);
    t(`${code}: uzun metinler İngilizceden kopya değil`, same.length === 0, same.slice(0, 3).join(","));
  }
}
t("manifest default_locale en", manifest.default_locale === "en");

// Dil algılama
const cases = [
  ["tr", "Merhaba, bu fonksiyonun neden çalışmadığını açıklar mısın? Hata veriyor."],
  ["en", "Hello, could you explain why this function does not work? It throws an error."],
  ["en", "ok thanks"],
  ["other", "Hallo, könntest du mir bitte erklären, warum diese Funktion nicht funktioniert? Sie gibt einen Fehler aus."],
  ["other", "Bonjour, pourriez-vous m'expliquer pourquoi cette fonction ne marche pas ? Elle renvoie une erreur."],
  ["other", "Hola, ¿podrías explicarme por qué esta función no funciona? Me da un error."],
  ["other", "Ciao, potresti spiegarmi perché questa funzione non funziona? Mi dà un errore."],
  ["other", "Olá, você poderia me explicar por que esta função não funciona? Ela retorna um erro."],
  ["cyrillic", "Привет, не мог бы ты объяснить, почему эта функция не работает? Она выдаёт ошибку."],
  ["cjk", "こんにちは、この関数がなぜ動かないのか説明してもらえますか？エラーが出ます。"],
  ["cjk", "你好，你能解释一下为什么这个函数不能运行吗？它报错了。"]
];
for (const [exp, txt] of cases) t(`textLanguage → ${exp}: ${txt.slice(0, 28)}…`, textLanguage(txt) === exp, textLanguage(txt));

// Token tahmini: makul aralıkta ve boş değil
for (const [, txt] of cases.slice(3)) { const e = estimateTokens(txt); t(`token tahmini makul: ${txt.slice(0, 18)}…`, e.mid > 5 && e.mid < txt.length * 1.2, JSON.stringify(e).slice(0, 80)); }
console.log(fail ? `\n${fail} BAŞARISIZ` : "\nTümü geçti");
process.exit(fail ? 1 : 0);
