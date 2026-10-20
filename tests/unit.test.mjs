// Birim testleri: node --test unit.test.mjs  (eklenti klasörünün yanında çalışır)
import test from "node:test";
import assert from "node:assert/strict";
const L = (p) => import(new URL(`../extension/lib/${p}`, import.meta.url));
const { forecastMessage, fitCheck, capacity, recommendModel, recommendEffort, resolveModel, modelWeight, isPeak, normalizeEffort, outputPrior, realizedCost } = await L("forecast.js");
const { classify, recommendTier } = await L("classify.js");
const { estimateTokens, sumRanges } = await L("tokens.js");
const { makeCalib, observe, emptyState } = await L("calibrate.js");
const { summarizeConversation, activeBranch, conversationIdFromPath } = await L("conversation.js");
const { normalizeUsage, normalizeSse, tierFromOrg } = await L("usage.js");
const { format } = await L("i18n.js");

const base = (p, extra = {}) => ({ promptTokens: estimateTokens(p), cls: classify(p), model: "Opus 5.5", effort: "Orta", tier: "claude_pro", history: { messages: 0 }, now: Date.parse("2026-10-20T20:00:00Z"), ...extra });

test("tokens: Türkçe aynı içerikte İngilizceden fazla token", () => {
  const tr = estimateTokens("Yarın sabah sınavım var ve kuantum mekaniğinde dalga fonksiyonunun normalizasyonu konusunda kafam çok karışık.");
  const en = estimateTokens("I have an exam tomorrow morning and I'm really confused about normalizing the wave function in quantum mechanics.");
  assert.ok(tr.mid > en.mid * 1.15, `${tr.mid} vs ${en.mid}`);
  assert.ok(tr.low < tr.mid && tr.mid < tr.high);
  assert.deepEqual(estimateTokens(""), { low: 0, mid: 0, high: 0, lang: { tr: 0, en: 0, code: 0 }, trShare: 0 });
});

test("forecast: aralık sıralı, sonlu ve deterministik", () => {
  const a = forecastMessage(base("Kuantum dolanıklık nedir?")), b = forecastMessage(base("Kuantum dolanıklık nedir?"));
  for (const w of ["session", "weekly"]) {
    const p = a.pct[w];
    assert.ok(Number.isFinite(p.low) && p.low > 0 && p.low <= p.mid && p.mid <= p.p80 && p.p80 <= p.high, JSON.stringify(p));
  }
  assert.deepEqual(a.pct, b.pct);
  assert.ok(a.pct.weekly.mid < a.pct.session.mid, "haftalık pencere daha büyük olmalı");
});

test("forecast: model ağırlığı ve Haiku 5.5 uzun prompt fiyatı", () => {
  const opus = forecastMessage(base("Bir şiir yaz")), sonnet = forecastMessage(base("Bir şiir yaz", { model: "Sonnet 5.5" }));
  assert.ok(Math.abs(opus.pct.session.mid / sonnet.pct.session.mid - 2) < 0.05, "Opus 5.5 ≈ 2× Sonnet 5.5");
  const h = resolveModel("Haiku 5.5").info;
  assert.equal(modelWeight(h, 50_000), 0.1); assert.equal(modelWeight(h, 150_000), 0.5);
  // Sistem talimatı ~94,9K: hafıza açıkken (+24,8K) eşik aşılır, kapalıyken kısa mesajda aşılmaz
  assert.equal(forecastMessage(base("Bir şiir yaz", { model: "Haiku 5.5", memoryOn: true })).weight, 0.5);
  assert.equal(forecastMessage(base("Bir şiir yaz", { model: "Haiku 5.5", memoryOn: false })).weight, 0.1);
  assert.equal(resolveModel("Opus 9").approx, true);
});

test("forecast: soğuk önbellek geçmişi ücretlendirir, sıcak önbellek ücretlendirmez", () => {
  const hist = { messages: 20, tokens: { low: 40000, mid: 50000, high: 60000 } };
  const now = Date.parse("2026-10-20T20:00:00Z");
  const warm = forecastMessage(base("Devam et", { history: { ...hist, lastActivityAt: now - 10 * 60000 }, now }));
  const cold = forecastMessage(base("Devam et", { history: { ...hist, lastActivityAt: now - 90 * 60000 }, now }));
  assert.equal(warm.cache, "warm"); assert.equal(cold.cache, "cold");
  assert.ok(cold.pct.session.mid > warm.pct.session.mid * 3);
});

test("forecast: effort yüksekse maliyet artar; yoğun saat yalnızca Free/Team", () => {
  const lo = forecastMessage(base("Bir şiir yaz", { effort: "Düşük" })), hi = forecastMessage(base("Bir şiir yaz", { effort: "Yüksek" }));
  assert.ok(hi.pct.session.mid > lo.pct.session.mid * 1.5);
  const peakTime = Date.parse("2026-10-20T13:00:00Z"); // Salı 13:00 UTC
  assert.equal(isPeak(new Date(peakTime)), true); assert.equal(isPeak(new Date("2026-10-18T13:00:00Z")), false);
  assert.equal(forecastMessage(base("x", { tier: "claude_free", now: peakTime })).peak, true);
  assert.equal(forecastMessage(base("x", { tier: "claude_pro", now: peakTime })).peak, false);
  assert.equal(normalizeEffort("Çok yüksek"), "max"); assert.equal(normalizeEffort(null), "auto");
});

test("forecast: çeviri çıktısı metin uzunluğuyla ölçeklenir", () => {
  const long = "Bu cümleyi İngilizceye çevir: " + "Bugün hava çok güzel ve parkta yürüyüş yaptık. ".repeat(40);
  const p = estimateTokens(long);
  const o = outputPrior(classify(long), { promptTokens: p });
  assert.ok(Math.exp(o.mu) > p.mid * 0.9, `${Math.exp(o.mu)} vs ${p.mid}`);
});

test("fitCheck ve kapasite", () => {
  const fc = forecastMessage(base("Detaylı bir rapor hazırla, kapsamlı olsun"));
  const usage = { fiveHour: { key: "five_hour", pct: 99.9, resetsAt: Date.now() + 3600e3 }, sevenDay: { key: "seven_day", pct: 10, resetsAt: Date.now() + 86400e3 } };
  assert.equal(fitCheck(fc, usage).worst.window, "session");
  const rows = capacity({ fiveHour: { pct: 20 }, sevenDay: { pct: 10 } }, { model: "Opus 5.5", effort: "Orta", tier: "claude_pro" });
  assert.equal(rows.length, 6);
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.count]));
  assert.ok(byKey.short_qa > byKey.research, JSON.stringify(byKey));
  assert.ok(capacity({ fiveHour: { pct: 100 } }, { model: "Opus 5.5", tier: "claude_pro" }).every((r) => r.count === 0));
});

test("model ve effort önerisi", () => {
  const p = "Şu cümleyi İngilizceye çevir: Yarın gelemeyeceğim.";
  const fc = forecastMessage(base(p));
  const r = recommendModel(fc, recommendTier(classify(p)), { model: "Opus 5.5" }); // hafıza kapalı: Haiku 0.1
  assert.equal(r.kind, "downgrade"); assert.equal(r.label, "Haiku 5.5"); assert.ok(r.saving > 0.8);
  const hard = "Prove step by step and in detail that every bounded monotone sequence converges, with a comprehensive and rigorous derivation of each lemma.";
  const up = recommendModel(forecastMessage(base(hard, { model: "Haiku 5.5" })), recommendTier(classify(hard)), { model: "Haiku 5.5" });
  assert.equal(up.kind, "upgrade");
  assert.equal(recommendEffort(classify("Türkiye'nin başkenti neresi?"), "high")?.kind, "lower");
});

test("kalibrasyon: aykırı ve negatif gözlemler reddedilir, durum kopyalanır", () => {
  const s0 = emptyState();
  const pred = { low: 0.5, mid: 1, high: 2 };
  const r1 = observe(s0, { tier: "claude_pro", window: "session", delta: 50, cost: 1000, predicted: pred });
  assert.equal(r1.accepted, false); assert.equal(r1.reason, "outlier");
  assert.equal(observe(s0, { tier: "claude_pro", window: "session", delta: -3, cost: 1000, predicted: pred }).reason, "negative");
  const r3 = observe(s0, { tier: "claude_pro", window: "session", delta: 1, cost: 1000, predicted: pred, type: "explain", outTokens: 400, outMuNoAdj: Math.log(300) });
  assert.equal(r3.accepted, true); assert.deepEqual(s0, emptyState(), "girdi değişmemeli");
  const c = makeCalib(r3.state);
  assert.equal(c.summary().measurements, 1);
  assert.ok(c.outputAdjust("explain").mean > makeCalib(emptyState()).outputAdjust("explain").mean);
  assert.ok(realizedCost({ weight: 2, newInput: 100, history: 1000, cold: false, outTokens: 100, effort: "off" }) === 2 * (100 + 500));
});

test("sohbet verisi: aktif dal, ekler, dosyalar", () => {
  const conv = {
    current_leaf_message_uuid: "c",
    chat_messages: [
      { uuid: "a", parent_message_uuid: "root", sender: "human", content: [{ type: "text", text: "Merhaba, bu PDF'i özetler misin?" }], attachments: [{ extracted_content: "uzun metin ".repeat(500) }], files_v2: [{ file_kind: "image", preview_asset: { image_width: 1000, image_height: 1000 } }, { file_kind: "document", document_asset: { page_count: 10 } }], created_at: "2026-10-20T19:00:00Z" },
      { uuid: "b", parent_message_uuid: "a", sender: "assistant", content: [{ type: "thinking", thinking: "gizli" }, { type: "text", text: "Tabii, işte özet." }], created_at: "2026-10-20T19:01:00Z" },
      { uuid: "x", parent_message_uuid: "a", sender: "assistant", content: [{ type: "text", text: "terk edilmiş dal ".repeat(2000) }], created_at: "2026-10-20T18:00:00Z" },
      { uuid: "c", parent_message_uuid: "b", sender: "human", content: [{ type: "text", text: "Teşekkürler" }], created_at: "2026-10-20T19:05:00Z" }
    ]
  };
  assert.deepEqual(activeBranch(conv).map((m) => m.uuid), ["a", "b", "c"]);
  const s = summarizeConversation(conv);
  assert.equal(s.messages, 3); assert.equal(s.files, 3);
  assert.equal(s.lastActivityAt, Date.parse("2026-10-20T19:05:00Z"));
  assert.ok(s.tokens.mid > 1296 + 15700 && s.tokens.mid < 40000, String(s.tokens.mid));
  assert.equal(conversationIdFromPath("/chat/0b1c2d3e-0000-4000-8000-123456789abc"), "0b1c2d3e-0000-4000-8000-123456789abc");
  assert.equal(summarizeConversation({}).messages, 0);
});

test("kullanım: /usage, ücretsiz plan, akış ve plan tespiti", () => {
  assert.equal(normalizeUsage({ five_hour: { utilization: null }, seven_day: null }), null);
  const u = normalizeUsage({ five_hour: { utilization: 19, resets_at: "2026-10-20T22:30:00Z" }, seven_day: { utilization: 17, resets_at: "2026-10-23T11:00:00Z" } });
  assert.equal(u.bottleneck, "five_hour");
  const s = normalizeSse({ windows: { "5h": { utilization: 0.21, resets_at: 1792530000, status: "within_limit" }, "7d": { utilization: 0.98, resets_at: 1792900000, status: "exceeded_limit" } } });
  assert.equal(s.fiveHour.pct, 21); assert.equal(s.sevenDay.pct, 100); assert.equal(s.fiveHour.resetsAt, 1792530000000);
  assert.equal(tierFromOrg({ capabilities: ["chat", "claude_max"], rate_limit_tier: "default_claude_max_5x" }), "claude_max_5x");
  assert.equal(tierFromOrg({ capabilities: ["chat", "claude_pro"] }), "claude_pro");
  assert.equal(tierFromOrg({ capabilities: ["chat"], raven_type: "team" }), "claude_team");
  assert.equal(tierFromOrg({ capabilities: ["chat"] }), "claude_free");
});

test("i18n biçimlendirme", () => {
  assert.equal(format({ message: "$1 sonra ($2)" }, ["5 dk", "23:30"]), "5 dk sonra (23:30)");
  assert.equal(format({ message: "Tahmini: %$LOW$–%$HIGH$", placeholders: { low: { content: "$1" }, high: { content: "$2" } } }, ["2", "6"]), "Tahmini: %2–%6");
});

test("performans: 57K karakterlik prompt + tahmin < 80 ms (ısınmadan sonra)", () => {
  const long = "Bu çok uzun bir metin, içinde kod da var: function f(x){ return x*2; }\n".repeat(800);
  classify(long); estimateTokens(long); // düzenli ifadelerin ilk derlenmesi
  const runs = [0, 1, 2].map(() => {
    const t0 = performance.now();
    const cls = classify(long);
    forecastMessage({ ...base(long), cls, promptTokens: estimateTokens(long) });
    return performance.now() - t0;
  }).sort((a, b) => a - b);
  assert.ok(runs[1] < 80, `medyan ${runs[1].toFixed(1)} ms`);
});

test("i18n yüzde biçimi: 0, küçük ve büyük değerler", async () => {
  const msgs = { pct: { message: "%$1" } };
  globalThis.chrome = { runtime: { getURL: (p) => p }, i18n: { getUILanguage: () => "tr" } };
  globalThis.fetch = async () => ({ json: async () => msgs });
  const { makeI18n } = await L("i18n.js");
  const i = await makeI18n("tr");
  assert.equal(i.pct(0), "%0"); assert.equal(i.pct(0.034), "%0,03"); assert.equal(i.pct(0.004), "%0,01");
  assert.equal(i.pct(0.46), "%0,5"); assert.equal(i.pct(7.25), "%7,3"); assert.equal(i.pct(80), "%80");
});

test("model önerisi: 50 prompt, gerekenden hafif öneri yok, doğruluk ≥ %90", async () => {
  const { readFileSync } = await import("node:fs");
  const cases = JSON.parse(readFileSync(new URL("./rec-cases.json", import.meta.url), "utf8"));
  const order = ["haiku", "sonnet", "opus", "fable"];
  let ok = 0; const tooLight = [];
  for (const [p, want] of cases) {
    const tier = recommendTier(classify(p)).tier;
    if (want.includes(tier)) ok++;
    else if (order.indexOf(tier) < Math.min(...want.map((w) => order.indexOf(w)))) tooLight.push(p.slice(0, 50));
  }
  assert.deepEqual(tooLight, []);
  assert.ok(ok / cases.length >= 0.9, `${ok}/${cases.length}`);
});
