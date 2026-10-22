// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Topluluk katkısı: gizlilik, biçim, birleştirme.
import { buildContribution, contributionText, parseContribution, aggregate } from "../extension/lib/contrib.js";
import { observe, emptyState } from "../extension/lib/calibrate.js";
let fail = 0;
const t = (name, cond, info = "") => { console.log(`${cond ? "✓" : "✗"} ${name}${info ? " — " + info : ""}`); if (!cond) fail++; };

const NOW = Date.now();
let st = emptyState();
for (let i = 0; i < 6; i++) st = observe(st, { at: NOW - i * 3600e3, tier: "claude_pro", window: "session", delta: 1 + (i % 2), cost: 40000, predicted: { low: 0.5, mid: 1, high: 2 }, type: "explain", outTokens: 600, outMuNoAdj: 6 }).state;
const sends = [{ at: NOW - 3600e3, conv: "a1b2c3d4", fam: "opus", model: "opus 5.5", type: "explain", peak: true, cache: "warm", hist: 3000, pred: 1, d: 2, prompt: "GİZLİ METİN" }];
const c = buildContribution({ calib: st, sends, recPrefs: { types: { translate: { votes: { down_bad: 1 } } } }, learnFixes: { "translate>rewrite": 2 }, tier: "claude_pro", extVersion: "1.0.0", lang: "tr", now: NOW });
const json = JSON.stringify(c);
t("katkı: plan, k (oturum, 6 ölçüm), isabet", c.plan === "claude_pro" && c.k.session?.n === 6 && c.acc.n === 6, JSON.stringify(c.k));
t("katkı metin, sohbet kimliği, tarih içermez", !/GİZLİ|a1b2c3d4|"at"|20\d\d-/.test(json), json.slice(0, 120));
t("katkı: kullanım karışımı oran olarak", c.mix.types.explain === 1 && c.mix.peak === 1);
t("katkı: düzeltmeler ve oylar", c.fixes["translate>rewrite"] === 2 && c.advice.translate.votes.down_bad === 1);
const back = parseContribution("Merhaba, katkım:\n" + contributionText(c) + "\nteşekkürler");
t("form metninden geri okunuyor", back && back.k.session.mu === c.k.session.mu);
t("bozuk metin reddedilir", parseContribution("{\"kind\":\"baska\"}") === null && parseContribution("çöp") === null);

// Birleştirme: 5 Pro kullanıcı, biri aykırı
const mk = (mu, n = 5) => ({ ...c, k: { session: { mu, sd: 0.3, n } } });
const agg = aggregate([mk(-10.2), mk(-10.0), mk(-10.1), mk(-9.9), mk(-4.0), mk(-10.0, 1)]);
t("ortanca aykırı kullanıcıdan etkilenmez", Math.abs(agg.k.claude_pro.session.mu - -10.05) < 0.11, JSON.stringify(agg.k.claude_pro.session));
t("tek ölçümlü kullanıcı sayılmaz (5 kullanıcı)", agg.k.claude_pro.session.users === 5);
t("3'ten az kullanıcılı plan boş kalır", !aggregate([mk(-10), mk(-10)]).k.claude_pro);
t("düzeltmeler toplanır", agg.fixes["translate>rewrite"] === 12);

console.log(fail ? `\n${fail} test başarısız` : "\ntüm katkı testleri geçti");
process.exit(fail ? 1 : 0);
