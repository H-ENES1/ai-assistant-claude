// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Birim testleri: yoğun saat, kalibrasyon (yoğun saat ayrı k), dil dosyaları, sınıflandırıcı işaretleri.
import { readFileSync } from "node:fs";
import { isPeak, peakWindow, forecastMessage, kPrior, resolveModel, defaultEffort, RECOMMEND_LABEL } from "../extension/lib/forecast.js";
import { normalizeUsage, familyWindow, FAMILY_SHARE_WARN_PCT } from "../extension/lib/usage.js";
import { contextWindowFor } from "../extension/lib/context.js";
import { observe, emptyState, makeCalib } from "../extension/lib/calibrate.js";
import { classify } from "../extension/lib/classify.js";
let fail = 0;
const t = (name, cond, info = "") => { console.log(`${cond ? "✓" : "✗"} ${name}${info ? " — " + info : ""}`); if (!cond) fail++; };

t("yoğun saat: Çar 12:30 UTC (yaz saati, 05:30 PT) yoğun", isPeak(new Date("2026-10-21T12:30:00Z")));
t("yoğun saat: Çar 18:01 UTC değil", !isPeak(new Date("2026-10-21T18:01:00Z")));
t("yoğun saat: kış saatinde 12:30 UTC değil, 13:30 yoğun", !isPeak(new Date("2026-11-04T12:30:00Z")) && isPeak(new Date("2026-11-04T13:30:00Z")));
t("yoğun saat: Cumartesi değil", !isPeak(new Date("2026-10-24T14:00:00Z")));
const w = peakWindow(new Date("2026-10-21T10:00:00Z"));
t("yoğun saat aralığı 12:00–18:00 UTC (Ekim)", new Date(w.start).toISOString().startsWith("2026-10-21T12:00") && new Date(w.end).toISOString().startsWith("2026-10-21T18:00"));

// Kalibrasyon: yoğun saat ölçümü ayrı kovaya gider; normal k etkilenmez
let st = emptyState();
st = observe(st, { at: Date.now(), tier: "claude_pro", window: "session", delta: 2, cost: 40000, peak: true, predicted: { low: 0.5, mid: 1, high: 2 }, type: "explain", outTokens: 500, outMuNoAdj: 6 }).state;
t("yoğun saat ölçümü session_peak kovasında", st.k.claude_pro.session_peak?.n === 1 && !st.k.claude_pro.session);
st = observe(st, { at: Date.now(), tier: "claude_pro", window: "session", delta: 1, cost: 40000, peak: false, predicted: { low: 0.5, mid: 1, high: 2 }, type: "explain", outTokens: 500, outMuNoAdj: 6 }).state;
t("normal ölçüm session kovasında", st.k.claude_pro.session?.n === 1);
const c = makeCalib(st);
const kN = c.kPosterior("claude_pro", "session"), kP = c.kPosterior("claude_pro", "session_peak");
t("yoğun saat k > normal k (öğrenilen)", kP.mu > kN.mu, `${Math.exp(kN.mu).toExponential(2)} vs ${Math.exp(kP.mu).toExponential(2)}`);
t("aykırı ölçüm reddi", observe(st, { at: Date.now(), tier: "claude_pro", window: "session", delta: 40, cost: 1000, predicted: { low: 0.1, mid: 0.2, high: 0.3 } }).reason === "outlier");

// Tahmin: yoğun saatte aynı mesaj daha pahalı
const cls = classify("Kuantum dolanıklığı basitçe açıkla");
const base = { promptTokens: { low: 10, mid: 12, high: 15 }, model: "Sonnet 5.5", effort: "orta", tier: "claude_pro", cls, history: { messages: 0 } };
const off = forecastMessage({ ...base, now: Date.parse("2026-10-21T20:00:00Z") });
const on = forecastMessage({ ...base, now: Date.parse("2026-10-21T13:00:00Z") });
t("tahmin: yoğun saatte daha yüksek", on.peak && !off.peak && on.pct.session.mid > off.pct.session.mid * 1.2, `${off.pct.session.mid.toFixed(3)} → ${on.pct.session.mid.toFixed(3)}`);
t("tahmin: haftalık limit yoğun saatten etkilenmez", Math.abs(on.pct.weekly.mid - off.pct.weekly.mid) < 1e-9);

// Dil dosyaları
const en = JSON.parse(readFileSync(new URL("../extension/_locales/en/messages.json", import.meta.url)));
const tr = JSON.parse(readFileSync(new URL("../extension/_locales/tr/messages.json", import.meta.url)));
const missing = [...Object.keys(en).filter((k) => !tr[k]), ...Object.keys(tr).filter((k) => !en[k])];
t("TR ve EN anahtarları birebir aynı", missing.length === 0, `${Object.keys(en).length} anahtar ${missing.join(",")}`);
const ph = (s) => (s.match(/\$\d/g) || []).sort().join("");
const phBad = Object.keys(en).filter((k) => tr[k] && ph(en[k].message) !== ph(tr[k].message));
t("TR/EN yer tutucuları ($1, $2…) uyumlu", phBad.length === 0, phBad.join(","));

// Sınıflandırıcı işaretleri orijinal yazımla
const cc = classify("Bu cümleyi İngilizceye çevir: Yarın gelemem.");
t("işaret orijinal yazımla (İngilizceye)", cc.hits.includes("İngilizceye"), JSON.stringify(cc.hits));
const perf = []; const long = "Bu metni özetle. " + "Lorem ipsum dolor sit amet ".repeat(4000);
for (let i = 0; i < 3; i++) { const s = performance.now(); classify(long); perf.push(performance.now() - s); }
perf.sort((a, b) => a - b);
t("uzun metinde sınıflandırma hızlı (<80 ms)", perf[1] < 80, `${perf[1].toFixed(1)} ms`);
// Fable 5.2 (0.12.2)
const f52 = resolveModel("Claude Fable 5.2");
t("Fable 5.2 tanınır (yaklaşık değil)", f52.key === "fable 5.2" && !f52.approx && f52.info.id === "claude-fable-5-2", JSON.stringify(f52.key));
t("Fable 5.2 ağırlığı 10 (5.1 ile aynı varsayım), 1M bağlam", f52.info.weight === 10 && f52.info.ctx === 1_000_000 && contextWindowFor("Fable 5.2").tokens === 1_000_000);
t("Fable 5.2 varsayılan effort medium, xhigh var", defaultEffort("Fable 5.2") === "medium" && f52.info.eff.x === true);
t("bilinmeyen Fable sürümü → Fable 5.2 (yaklaşık)", resolveModel("Fable 5.9").key === "fable 5.2" && resolveModel("Fable 5.9").approx);
t("öneri etiketi Fable 5.2", RECOMMEND_LABEL.fable === "Fable 5.2");
const fcF = forecastMessage({ promptTokens: { low: 40, mid: 50, high: 60 }, model: "Fable 5.2", effort: null, tier: "claude_pro", cls: classify("Kuantum dolanıklığı basitçe açıkla") }, { samples: 200 });
t("Fable 5.2 effort okunamazsa medium varsayılır", fcF.effort === "medium" && fcF.effortAssumed && fcF.model === "fable 5.2");

// Fable payı: model ailesine özel haftalık pencere
const win = (u) => ({ utilization: u, resets_at: "2026-11-16T23:59:00Z" });
const ubase = { five_hour: win(10), seven_day: win(20) };
t("seven_day_fable → Fable payı", familyWindow(normalizeUsage({ ...ubase, seven_day_fable: win(42) }), "fable")?.pct === 42);
t("seven_day_fable_5_2 → Fable payı", familyWindow(normalizeUsage({ ...ubase, seven_day_fable_5_2: win(55) }), "fable")?.pct === 55);
t("seven_day_fable_models → Fable payı", familyWindow(normalizeUsage({ ...ubase, seven_day_fable_models: win(61) }), "fable")?.pct === 61);
const nested = normalizeUsage({ ...ubase, seven_day_models: { fable: win(83), opus: win(5) } });
t("iç içe pencere düzleştirilir (seven_day_models.fable)", familyWindow(nested, "fable")?.pct === 83 && nested.extras.some((w) => w.key === "seven_day_models_opus"), nested.extras.map((w) => w.key).join(","));
t("seven_day_opus Fable sayılmaz", familyWindow(normalizeUsage({ ...ubase, seven_day_opus: win(70) }), "fable") === null);
t("seven_day_opus Opus penceresi", familyWindow(normalizeUsage({ ...ubase, seven_day_opus: win(70) }), "opus")?.pct === 70);
t("Fable penceresi yoksa ya da boşsa → null", familyWindow(normalizeUsage({ ...ubase, seven_day_fable: null }), "fable") === null && familyWindow(normalizeUsage(ubase), "fable") === null && familyWindow(null, "fable") === null);
const unk = normalizeUsage({ ...ubase, seven_day_cowork: win(12), seven_day_fable: win(30) });
t("bilinmeyen ek pencere de listede kalır", unk.extras.some((w) => w.key === "seven_day_cowork") && unk.extras.length === 2);
t("Fable payı uyarı eşiği %80", FAMILY_SHARE_WARN_PCT === 80);
const tr2 = JSON.parse(readFileSync(new URL("../extension/_locales/tr/messages.json", import.meta.url), "utf8"));
const en2 = JSON.parse(readFileSync(new URL("../extension/_locales/en/messages.json", import.meta.url), "utf8"));
t("Fable payı metinleri TR/EN", ["rowFableShare", "fableSharePill", "fableShareLabel", "fableShareNear"].every((k) => tr2[k]?.message && en2[k]?.message));

console.log(fail ? `${fail} test başarısız` : "tüm birim testleri geçti");
process.exitCode = fail ? 1 : 0;
