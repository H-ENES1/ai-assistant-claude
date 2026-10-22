// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Tuzak testi: "çeviri", "özetle" gibi bir kelime, işin başka (daha büyük) bir görevin parçası olduğu cümlede geçiyor.
// Eklenti bu cümlelerde Haiku önermemeli; gerçek çeviri/özet istekleri ise Haiku almaya devam etmeli.
import { classify } from "../extension/lib/classify.js";
import { detectDomain } from "../extension/lib/domain.js";
import { forecastMessage } from "../extension/lib/forecast.js";
import { advise } from "../extension/lib/advisor.js";
import { estimateTokens } from "../extension/lib/tokens.js";

const TRAPS = [
 "Bir site yaptırmam lazım, bu zor bir iş. Sitede çeviri sistemi de olacak, TR ve EN.",
 "Çok dilli bir web sitesi yapıyorum, çeviri özelliği olan, kullanıcı girişli, veritabanlı. Baştan sona kodla.",
 "Çeviri uygulaması geliştirmek istiyorum, mimariyi tasarla",
 "Sitemi çeviri eklentisiyle ingilizceye açmak istiyorum, nasıl bir yol izlemeliyim",
 "Sitem için çeviri sistemi kurmam gerekiyor, hangi yöntem iyi",
 "Mobil uygulamamı İngilizceye çevirecek bir sistem kurmak istiyorum, zor mu",
 "I need to build a website with a translation feature for 5 languages, where do I start?",
 "Help me build a translation app that works offline, it's a hard project",
 "Add i18n to my React project and translate all the strings to Turkish, German and French",
 "Bir özetleme uygulaması yapmak istiyorum, nasıl başlamalıyım",
 "Write a Python script that summarizes PDFs and translates them",
 "Tüm backend kodumu baştan yazmam gerekiyor, yeniden yaz diyorum ama nasıl planlarım",
 "Bu zor bir iş: e-ticaret sitesi yaptıracağım, ödeme sistemi ve çoklu dil de olacak",
 "Rapor yazmak zor bir iş, uzun bir proje raporu hazırlamam lazım, kısaca nasıl yapılır anlat",
 "Şirketimin sitesini yeniden tasarlatacağım, İngilizce sürümü de olacak, ne yapmalıyım",
];
const CONTROLS = [
 ["Bu cümleyi İngilizceye çevir: yarın görüşürüz","haiku"],
 ["Translate to Turkish: I will be late tomorrow","haiku"],
 ["Bu paragrafı Almancaya çevir: Toplantı yarın saat onda başlayacak.","haiku"],
 ["Please translate this email into French","haiku"],
 ["Şunu özetle: kısa bir metin burada yer alıyor ve üç cümle","haiku"],
];
const run = (q, model) => {
  const cls = classify(q), dom = detectDomain(q, cls);
  const fc = forecastMessage({ promptTokens: estimateTokens(q), model, effort: "Orta", tier: "claude_pro", cls, history: { messages: 0 }, memoryOn: true }, { samples: 300 });
  return { cls, a: advise({ cls, dom, fc, currentModel: model, effort: "Orta", prefs: null }) };
};
let fail = 0;
const ok = (name, cond, info = "") => { console.log(`${cond ? "✓" : "✗"} ${name}${info ? " — " + info : ""}`); if (!cond) fail++; };
for (const model of ["Opus 5.5", "Sonnet 5.5"]) {
  const bad = TRAPS.map((q) => [q, run(q, model)]).filter(([, r]) => /^Haiku/.test(r.a.suggested || ""));
  ok(`${model}: ${TRAPS.length} tuzak cümlenin hiçbirinde Haiku önerilmiyor`, bad.length === 0, bad.map(([q]) => q.slice(0, 50)).join(" | "));
}
const notLight = TRAPS.filter((q) => ["translate", "summarize", "rewrite"].includes(classify(q).type));
ok("tuzak cümleler çeviri/özet/düzeltme tipine düşmüyor", notLight.length === 0, notLight.map((q) => q.slice(0, 50)).join(" | "));
for (const [q] of CONTROLS) ok("gerçek istek hâlâ Haiku alıyor: " + q.slice(0, 40), /^Haiku/.test(run(q, "Sonnet 5.5").a.suggested || ""));
console.log(fail ? `\n${fail} hata` : "\ntüm tuzak testleri geçti");
process.exit(fail ? 1 : 0);
