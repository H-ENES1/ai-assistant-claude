// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Model danışmanı testi: 50 örnek (rec-cases.json) + gerçek kullanımdan sohbet tarzı mesajlar.
// Ölçüt: önerilen model "kabul edilebilir" listede olmalı; gerekenden hafif öneri SIFIR olmalı.
import { readFileSync } from "node:fs";
import { classify } from "../extension/lib/classify.js";
import { decideTier, advise, applyFeedback, TIERS } from "../extension/lib/advisor.js";

const cases = JSON.parse(readFileSync(new URL("./rec-cases.json", import.meta.url)));
// Gerçek kullanımdan (sohbet tarzı, Türkçe, belirsiz) — Haiku ÖNERİLMEMELİ
const chatty = [
  ["test mesajı", ["sonnet", "opus"]],
  ["ikinci ölçümü almadı gibi", ["sonnet", "opus"]],
  ["olm bayadır kullanıom bu kişisel ölçüm saymıyor sanırım", ["sonnet", "opus"]],
  ["evet çalışıyor ama ekler kısmını ekleyip çıkarınca prompt değişmiyor öyle mi olması lazım", ["sonnet", "opus"]],
  ["önce bunu bi incele hatayı koddan bulmaya çalış", ["sonnet", "opus"]],
  ["9.4 te hala kişi kullanınca kendini güncelliyor demi kendi kendine veri topluyor ve öğreniyor", ["sonnet", "opus"]],
  ["eklentiyi açamadım", ["sonnet", "opus"]],
  ["hayrettin enes karalı kimdir", ["sonnet", "haiku", "opus"]],
  ["Bu kelimeyi Fransızcaya çevir: kitap", ["haiku", "sonnet"]],
  ["Şu cümledeki yazım hatalarını düzelt: bugun hava cok guzel", ["haiku", "sonnet"]]
];
let pass = 0, tooLight = 0, fails = [];
const all = [...cases, ...chatty];
for (const [prompt, ok] of all) {
  const cls = classify(prompt);
  const { tier } = decideTier(cls);
  if (ok.includes(tier)) pass++;
  else {
    const min = Math.min(...ok.map((t) => TIERS.indexOf(t)));
    if (TIERS.indexOf(tier) < min) tooLight++;
    fails.push(`${tier.padEnd(6)} beklenen ${ok.join("/")} · ${cls.type}/${cls.confidence}/${cls.complexity.toFixed(2)} · ${prompt.slice(0, 70)}`);
  }
}
const haikuShare = all.filter(([p]) => decideTier(classify(p)).tier === "haiku").length;
console.log(`öneri: ${pass}/${all.length} (%${Math.round(100 * pass / all.length)}) · gerekenden hafif: ${tooLight} · Haiku önerilen: ${haikuShare}`);
fails.forEach((f) => console.log("  ✗ " + f));

// advise(): tasarruf, uygun, yükselt, sohbette değiştirme maliyeti
const fc = (w, mid = 0.6, hist = 0) => ({ weight: w, cost: { mid: mid * 1e6 / 100 * 3 }, pct: { session: { mid } }, context: { usedLow: 100_000 } });
const t = (name, cond, info = "") => { console.log(`${cond ? "✓" : "✗"} ${name}${info ? " — " + info : ""}`); if (!cond) process.exitCode = 1; };
const clsT = classify("Bu paragrafı İngilizceye çevir: Yarın sabah toplantı var, lütfen hazırlıklı gelin.");
const a1 = advise({ cls: clsT, fc: fc(4), currentModel: "Opus 5.5" });
t("çeviri + Opus → Haiku tasarrufu", a1?.kind === "save" && a1.suggested.startsWith("Haiku") && a1.savingFrac > 0.9, JSON.stringify({ k: a1?.kind, s: a1?.suggested, f: a1?.savingFrac }));
const a2 = advise({ cls: clsT, fc: fc(4), currentModel: "Opus 5.5", historyTokens: 400_000, cacheWarm: true });
t("uzun sohbette model değiştirme → 'yeni sohbette' önerisi", a2?.kind === "save_next", a2?.kind);
const clsH = classify("Schrödinger denklemini adım adım türet ve her adımı kanıtla, detaylı olsun");
const a3 = advise({ cls: clsH, fc: fc(2), currentModel: "Sonnet 5.5" });
t("zor türetme + Sonnet → yükselt", a3?.kind === "upgrade" && ["opus", "fable"].includes(a3.tier), a3?.kind + " " + a3?.tier);
const clsC = classify("Bu kodu çalıştırdığımda hata veriyor:\n```py\nfor i in range(len(a)+1):\n    print(a[i])\n```");
const a4 = advise({ cls: clsC, fc: fc(2), currentModel: "Sonnet 5.5" });
t("kod düzeltme + Sonnet → uygun", a4?.kind === "ok", a4?.kind);
t("kanıt listesi dolu", a3?.evidence?.length >= 2, JSON.stringify(a3?.evidence));
t("boş/çok kısa mesajda bildirim yok", advise({ cls: classify("devam et"), fc: fc(4), currentModel: "Opus 5.5" }) === null);
const a5 = advise({ cls: clsT, fc: fc(4, 0.01), currentModel: "Opus 5.5" });
t("tasarruf çok küçükse dırdır yok (ok + not)", a5?.kind === "ok" && a5.tinySaving, a5?.kind);
// geri bildirim: iki kez 👎 → taban yükselir
let prefs = null;
for (let i = 0; i < 2; i++) prefs = applyFeedback(prefs, { type: "translate", kind: "save", tier: "haiku", curTier: "opus", good: false });
t("2× 👎 hafif öneri → taban Sonnet", prefs.types.translate.floor === "sonnet");
const a6 = advise({ cls: clsT, fc: fc(4), currentModel: "Opus 5.5", prefs });
t("tabandan sonra öneri Sonnet", a6?.suggested?.startsWith("Sonnet") && a6.why.includes("pref_floor"), a6?.suggested);
