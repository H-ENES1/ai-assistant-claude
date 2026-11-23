// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Kalite ölçümü, adım 1: istem setini toplar ve her istem için eklentinin önerisini (model + effort) kaydeder.
// Kaynaklar (tek doğruluk kaynağı test dosyalarıdır, burada kopya tutulmaz):
//   r01–r50  tests/rec-cases.json
//   c01–c10  tests/advisor.test.mjs içindeki "chatty" (gerçek kullanımdan sohbet cümleleri)
//   t01–t15  tests/traps.test.mjs TRAPS · k01–k05 CONTROLS
// Çalıştır: node tests/quality/build-prompts.mjs  → tests/quality/prompts.json
import { readFileSync, writeFileSync } from "node:fs";
import { classify } from "../../extension/lib/classify.js";
import { detectDomain } from "../../extension/lib/domain.js";
import { forecastMessage } from "../../extension/lib/forecast.js";
import { advise, decideTier } from "../../extension/lib/advisor.js";
import { estimateTokens } from "../../extension/lib/tokens.js";

const here = (p) => new URL(p, import.meta.url);
const literal = (file, name) => {
  const m = readFileSync(here(file), "utf8").match(new RegExp(`const ${name} = (\\[[\\s\\S]*?\\n\\];)`));
  if (!m) throw new Error(`${file}: ${name} bulunamadı`);
  return new Function("return " + m[1].replace(/;$/, ""))();
};
const rec = JSON.parse(readFileSync(here("../rec-cases.json"), "utf8"));
const chatty = literal("../advisor.test.mjs", "chatty");
const traps = literal("../traps.test.mjs", "TRAPS");
const controls = literal("../traps.test.mjs", "CONTROLS");

// Kendi başına cevaplanamayan istemler: metin/dosya/önceki sohbet eksik. Cevaplar GÖRÜLMEDEN işaretlendi.
// Bunlarda üç model de "metni gönderir misin" der; kalite farkı ölçülemez, ana sayılardan ayrı raporlanır.
const NO_CONTEXT = new Map([
  ["Şu metni sadeleştir ve kısalt", "metin yok"],
  ["Bu makaleyi 5 maddede özetle", "makale yok"],
  ["TL;DR of this thread please", "sohbet yok"],
  ["Bu React uygulamasını baştan sona refactor et, state yönetimini Redux'tan Zustand'a taşı, tüm testleri güncelle", "kod yok"],
  ["Bu CSV dosyasındaki satışları aylara göre analiz et", "dosya yok"],
  ["Excel tablosundaki notların ortalamasını ve standart sapmasını bul", "tablo yok"],
  ["Bu konuyla ilgili 10 slaytlık bir sunum hazırla", "konu yok"],
  ["Bir yatırım kararı vermem lazım: şu üç seçeneğin risklerini, vergi etkilerini ve uzun vadeli getirilerini derinlemesine analiz et", "seçenekler yok"],
  ["Merhaba", "selam"], ["Teşekkürler!", "selam"],
  ["Devam et", "önceki sohbet yok"], ["Bunu bir daha düşün, emin misin?", "önceki sohbet yok"],
  ["test mesajı", "önceki sohbet yok"], ["ikinci ölçümü almadı gibi", "önceki sohbet yok"],
  ["olm bayadır kullanıom bu kişisel ölçüm saymıyor sanırım", "önceki sohbet yok"],
  ["evet çalışıyor ama ekler kısmını ekleyip çıkarınca prompt değişmiyor öyle mi olması lazım", "önceki sohbet yok"],
  ["önce bunu bi incele hatayı koddan bulmaya çalış", "kod yok"],
  ["9.4 te hala kişi kullanınca kendini güncelliyor demi kendi kendine veri topluyor ve öğreniyor", "önceki sohbet yok"],
  ["eklentiyi açamadım", "önceki sohbet yok"],
  ["hayrettin enes karalı kimdir", "alt ajanın bağlamında depo sahibi bilgisi var (bulaşma)"],
  ["Please translate this email into French", "e-posta yok"],
  ["Şunu özetle: kısa bir metin burada yer alıyor ve üç cümle", "yer tutucu metin"],
]);

const pad = (n) => String(n).padStart(2, "0");
const items = [
  ...rec.map(([q, ok], i) => ({ id: "r" + pad(i + 1), set: "rec", q, authorOk: ok })),
  ...chatty.map(([q, ok], i) => ({ id: "c" + pad(i + 1), set: "chatty", q, authorOk: ok })),
  ...traps.map((q, i) => ({ id: "t" + pad(i + 1), set: "trap", q, authorOk: ["sonnet", "opus", "fable"] })),
  ...controls.map(([q, m], i) => ({ id: "k" + pad(i + 1), set: "control", q, authorOk: [m] })),
];

// traps.test.mjs'deki run() ile aynı çağrı: Pro plan, boş sohbet, effort Orta.
const run = (q, model) => {
  const cls = classify(q), dom = detectDomain(q, cls);
  const fc = forecastMessage({ promptTokens: estimateTokens(q), model, effort: "Orta", tier: "claude_pro", cls, history: { messages: 0 }, memoryOn: true }, { samples: 300 });
  return { cls, dom, a: advise({ cls, dom, fc, currentModel: model, effort: "Orta", prefs: null }) };
};

const out = items.map((it) => {
  const s = run(it.q, "Sonnet 5.5"), o = run(it.q, "Opus 5.5");
  const d = decideTier(s.cls, { attachmentTokens: 0, domain: s.dom?.domain }, null);
  const eff = (a) => a?.effort ? (a.effort.to || null) : null;
  return {
    id: it.id, set: it.set, prompt: it.q, authorOk: it.authorOk,
    noContext: NO_CONTEXT.get(it.q) || null,
    type: s.cls.type, confidence: s.cls.confidence, complexity: +(s.cls.complexity || 0).toFixed(2), words: s.cls.words,
    domain: s.dom?.domain || "general", sub: s.dom?.sub || null,
    // Önerilen model ailesi mevcut modelden bağımsızdır; advise() 3 kelimeden kısa mesajda bildirim göstermez (null).
    tier: d.tier, why: d.why, shown: !!s.a,
    fromSonnet: s.a ? { kind: s.a.kind, suggested: s.a.suggested, effort: eff(s.a), effortKind: s.a.effort?.kind || null } : null,
    fromOpus: o.a ? { kind: o.a.kind, suggested: o.a.suggested, effort: eff(o.a), effortKind: o.a.effort?.kind || null } : null,
  };
});
for (const q of NO_CONTEXT.keys()) if (!items.some((it) => it.q === q)) throw new Error("NO_CONTEXT eşleşmedi: " + q);
writeFileSync(here("./prompts.json"), JSON.stringify(out, null, 1) + "\n");
const by = (k) => Object.entries(out.reduce((m, x) => (m[x[k]] = (m[x[k]] || 0) + 1, m), {})).map(([a, b]) => `${a} ${b}`).join(" · ");
console.log(`${out.length} istem · bağlamsız ${out.filter((x) => x.noContext).length} · öneri: ${by("tier")} · bildirim yok: ${out.filter((x) => !x.shown).length}`);
console.log("tür: " + by("type"));
console.log("alan: " + by("domain"));
