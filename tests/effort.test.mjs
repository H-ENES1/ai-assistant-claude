// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Effort önerisi testleri (lib/effort.js) + forecast'teki effort okuması.
import { recommendEffort, compareEffort, applyEffortFeedback, effortSupport, LEVELS } from "../extension/lib/effort.js";
import { normalizeEffort, defaultEffort, forecastMessage } from "../extension/lib/forecast.js";
import { classify } from "../extension/lib/classify.js";
import { detectDomain } from "../extension/lib/domain.js";
import { advise } from "../extension/lib/advisor.js";

let pass = 0, fail = 0;
const ok = (name, cond, info = "") => { if (cond) { pass++; console.log("✓ " + name + (info ? " — " + info : "")); } else { fail++; console.log("✗ " + name + (info ? " — " + info : "")); } };
const rec = (q, model = "Sonnet 5.5", extra = {}) => {
  const cls = classify(q); const dom = detectDomain(q, cls);
  return { cls, dom, r: recommendEffort({ cls, dom, model, ...extra }) };
};
const at = (l) => LEVELS.indexOf(l);

// --- Model desteği ve okuma ---
ok("Opus 5.5: varsayılan medium, xhigh var", effortSupport("Opus 5.5")?.def === "medium" && effortSupport("Opus 5.5").xhigh);
ok("Sonnet 5.5: varsayılan high, xhigh yok", effortSupport("Sonnet 5.5")?.def === "high" && !effortSupport("Sonnet 5.5").xhigh);
ok("Haiku 5.5: varsayılan medium", effortSupport("Haiku 5.5")?.def === "medium");
ok("Haiku 4.5: effort seçicisi yok", effortSupport("Haiku 4.5") === null && defaultEffort("Haiku 4.5") === null);
ok("etiketler", normalizeEffort("Extra high") === "xhigh" && normalizeEffort("Çok yüksek") === "xhigh" && normalizeEffort("Maks") === "max" &&
  normalizeEffort("Max") === "max" && normalizeEffort("Yüksek") === "high" && normalizeEffort("Orta") === "medium" && normalizeEffort("Düşük") === "low",
  ["Extra high", "Çok yüksek", "Maks", "Max", "Yüksek"].map(normalizeEffort).join(","));
const base = { promptTokens: { low: 40, mid: 50, high: 60 }, attachmentTokens: { low: 0, mid: 0, high: 0 }, history: { messages: 0 }, tier: "claude_pro", cls: classify("Kuantum dolanıklık nedir") };
const fS = forecastMessage({ ...base, model: "Sonnet 5.5", effort: null }, { samples: 200 });
const fO = forecastMessage({ ...base, model: "Opus 5.5", effort: null }, { samples: 200 });
ok("okunamayan effort → modelin varsayılanı", fS.effort === "high" && fS.effortAssumed && fO.effort === "medium" && fO.effortAssumed, `${fS.effort} / ${fO.effort}`);
const fX = forecastMessage({ ...base, model: "Opus 5.5", effort: "Extra high" }, { samples: 200 });
ok("xhigh düşünme payı medium'dan büyük", fX.breakdown.thinking > fO.breakdown.thinking, `${fX.breakdown.thinking.toFixed(2)} > ${fO.breakdown.thinking.toFixed(2)}`);

// --- Öneriler ---
let x = rec("Bunu İngilizceye çevir: yarın görüşürüz");
ok("çeviri → low", x.r.level === "low", x.r.level);
x = rec("Kısaca: DNA nedir?");
ok("kısa bilim sorusu → low", x.r.level === "low", x.r.level);
x = rec("Kuantum dolanıklık nedir, basitçe anlat");
ok("kavram açıklama → medium", x.r.level === "medium", x.r.level);
x = rec("Asal sayıların sonsuz olduğunu kanıtla");
ok("ispat → en az high", at(x.r.level) >= at("high"), x.r.level + " · " + x.r.why.join(","));
x = rec("Ölçeklenebilir bir mikroservis mimarisi tasarla, veritabanı sharding ve failover dahil, production seviyesinde kodla", "Opus 5.5");
ok("zor kodlama, Opus → xhigh", x.r.level === "xhigh", x.r.level);
x = rec("Ölçeklenebilir bir mikroservis mimarisi tasarla, veritabanı sharding ve failover dahil, production seviyesinde kodla", "Sonnet 5.5");
ok("zor kodlama, Sonnet (xhigh yok) → high", x.r.level === "high", x.r.level);
x = rec("Sonbahar ve yalnızlık üzerine uzun, kapsamlı ve derinlemesine bir şiir yaz");
ok("yaratıcı yazı → en fazla medium", at(x.r.level) <= at("medium"), x.r.level + " · " + x.r.why.join(","));
x = rec("3 aylık proje planı ve kilometre taşları çıkar");
ok("proje planı → en az medium", at(x.r.level) >= at("medium"), x.r.level);
x = rec("Fırında tavuk tarifi verir misin");
ok("yemek tarifi → en fazla medium", at(x.r.level) <= at("medium"), x.r.level);

// Riskli alanda düşük önerilmez
const risky = ["Parasetamol ile ibuprofen birlikte alınır mı", "Kira artışı yasal olarak ne kadar olabilir", "Kredi kartı borcumu nasıl kapatayım",
  "Antibiyotik kullanırken alkol içilir mi", "Is a verbal agreement legally binding?", "Should I pay off my car loan early?", "Bunu kısaca söyle: KDV oranı kaç?"];
const lows = risky.map((q) => [q, rec(q).r.level]).filter(([, l]) => l === "low");
ok("sağlık/hukuk/finans: hiç low yok", lows.length === 0, lows.map((z) => z[0]).join(" | "));

// max yalnızca en zor derin işlerde
const nomax = ["Bu React bileşenindeki hatayı düzelt", "Bana bir e-posta yaz", "Kuantum dolanıklık nedir", "Excel'de pivot tablo yap"];
ok("sıradan işlerde max yok", nomax.every((q) => rec(q, "Opus 5.5").r.level !== "max"));

// --- Karşılaştırma ---
const bd = { thinking: 0.5, output: 0.3, input: 0.2, history: 0, tool: 0 };
let cmp = compareEffort({ level: "low", why: [], def: "high" }, "high", { breakdown: bd });
ok("high → low: düşür, tasarruf ≈ %42", cmp.kind === "lower" && Math.abs(cmp.saving - 0.5 * (1 - 0.25 / 1.6)) < 1e-9, cmp.kind + " " + cmp.saving?.toFixed(3));
cmp = compareEffort({ level: "high", why: [], def: "high" }, "low", { breakdown: bd });
ok("low → high: yükselt", cmp.kind === "raise" && cmp.extra > 0, cmp.kind);
cmp = compareEffort({ level: "medium", why: [], def: "high" }, "low", { breakdown: bd });
ok("low → medium: uyarı yok", cmp.kind === "ok", cmp.kind);
cmp = compareEffort({ level: "medium", why: [], def: "high" }, "high", { breakdown: { thinking: 0.05, output: 0.3 } });
ok("tasarruf %8'in altında: dırdır yok", cmp.kind === "ok", `${cmp.kind} ${cmp.tiny?.toFixed(3)}`);
cmp = compareEffort({ level: "low", why: [], def: "high" }, "auto", { breakdown: bd });
ok("okunamayan ayar: varsayılandan kıyas, 'varsayılan' işareti", cmp.kind === "lower" && cmp.from === "high" && cmp.assumed);

// --- Geri bildirim ---
let prefs = null;
prefs = applyEffortFeedback(prefs, { type: "translate", kind: "lower", good: false });
prefs = applyEffortFeedback(prefs, { type: "translate", kind: "lower", good: false });
ok("2× 👎 'düşür' → çeviri tipinde +1", prefs.types.translate.effOff === 1);
x = rec("Bunu İngilizceye çevir: yarın görüşürüz", "Sonnet 5.5", { prefs });
ok("kişisel ayardan sonra çeviri → medium", x.r.level === "medium" && x.r.why.includes("e_pref"), x.r.level);

// --- Danışman entegrasyonu ---
const q = "Bunu İngilizceye çevir: yarın sabah toplantıda görüşelim, saat dokuzda";
const cls = classify(q), dom = detectDomain(q, cls);
const fc = forecastMessage({ ...base, cls, model: "Opus 5.5", effort: "Yüksek" }, { samples: 300 });
const a = advise({ cls, dom, fc, currentModel: "Opus 5.5", effort: fc.effort, effortAssumed: fc.effortAssumed, prefs: null });
ok("danışman: alan bilgisi var", a?.domain?.domain === "language", a?.domain?.domain);
ok("danışman: model değişince effort önerilen model için", a?.effort && (a.kind === "save" || a.kind === "upgrade" ? a.effort.kind === "with_switch" : true), `${a?.kind} / ${a?.effort?.kind} → ${a?.effort?.to}`);
const q2 = "Kuantum dolanıklık nedir, basitçe anlat";
const c2 = classify(q2), d2 = detectDomain(q2, c2);
const f2 = forecastMessage({ ...base, cls: c2, model: "Sonnet 5.5", effort: "Max" }, { samples: 300 });
const a2 = advise({ cls: c2, dom: d2, fc: f2, currentModel: "Sonnet 5.5", effort: f2.effort, prefs: null });
ok("danışman: Sonnet + Max ile kavram sorusu → effort düşür önerisi", a2?.effort?.kind === "lower" && a2.effort.to === "medium" && a2.effort.savedPct > 0, `${a2?.kind} / ${a2?.effort?.kind} ${a2?.effort?.from}→${a2?.effort?.to}`);
const hq = "Parasetamol ile ibuprofen birlikte alınır mı, kısaca";
const hc = classify(hq), hd = detectDomain(hq, hc);
const hf = forecastMessage({ ...base, cls: hc, model: "Sonnet 5.5", effort: "Orta" }, { samples: 300 });
const ha = advise({ cls: hc, dom: hd, fc: hf, currentModel: "Sonnet 5.5", effort: hf.effort, prefs: null });
ok("sağlık sorusunda Haiku önerilmez", ha && ha.suggested !== "Haiku 5.5" && ha.gate.reasons.includes("stakes"), `${ha?.suggested} · ${ha?.gate?.reasons}`);

console.log(fail ? `\n${fail} hata, ${pass} geçti` : `\ntüm effort testleri geçti (${pass})`);
process.exit(fail ? 1 : 0);
