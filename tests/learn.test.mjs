// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Öğrenen sınıflandırıcı: yükleme, tutarlılık, kişisel düzeltme, gizlilik.
import { classify, modelInfo } from "../extension/lib/classify.js";
import { featurize, predict, personalStep, decodeModel, normalize } from "../extension/lib/learn.js";
import PACKED from "../extension/lib/learn-weights.js";
let fail = 0;
const t = (name, cond, info = "") => { console.log(`${cond ? "✓" : "✗"} ${name}${info ? " — " + info : ""}`); if (!cond) fail++; };

const info = modelInfo();
t("model yüklendi ve ölçüm bilgisi var", info && info.test2AccHybrid > info.test2AccRules, JSON.stringify(info));
t("aksan katlama: 'Çevirir misin' = 'cevirir misin'", normalize("Çevirir misin") === "cevirir misin");
const a = classify("bu cümleyi ingilizceye çevir: yarın geliyorum"), b = classify("bu cumleyi ingilizceye cevir: yarin geliyorum");
t("aksansız yazımda aynı tip", a.type === "translate" && b.type === "translate", `${a.type}/${b.type}`);
t("kod hatası tanınıyor", classify("TypeError: cannot read property 'x' of undefined, neden?").type === "code_fix");
t("çok kısa mesajda model devreye girmiyor", classify("teşekkürler").source === "rules");
const c = classify("kuantum dolanıklığı lise öğrencisine anlatır mısın");
t("model kaynağı ve olasılık raporlanıyor", c.source === "model" && c.modelProb > 0 && c.modelProb <= 1, JSON.stringify({ type: c.type, p: c.modelProb, conf: c.confidence }));

// Kişisel düzeltme: kullanıcı bu tür mesajları "writing" sayıyor
const M = decodeModel(PACKED);
const text = "dükkanımız için google yorumlarına cevap şablonu hazırla";
const f = featurize(text, classify(text, { useModel: false }).scores, M.dim);
const before = predict(M, f).type;
let P = null;
for (let i = 0; i < 2; i++) P = personalStep(M, P, f, before === "writing" ? "rewrite" : "writing");
const target = before === "writing" ? "rewrite" : "writing";
const after = predict(M, f, P).type;
t("2 düzeltmeden sonra aynı mesaj yeni tipte", after === target, `${before} → ${after}`);
const other = classify("integral sin x dx hesapla", { personal: P }).type;
t("düzeltme ilgisiz mesajları bozmuyor", other === "math", other);
const json = JSON.stringify(P);
t("kişisel düzeltme metin içermiyor", !/google|yorum|şablon|sablon/.test(json) && P.n === 2);
t("kişisel düzeltme küçük", json.length < 60000, `${json.length} bayt`);

// Hız: her tuş vuruşunda çalışabilmeli
const long = "Bu raporu özetler misin? " + "Geçen çeyrekte satışlar arttı ama maliyetler de yükseldi. ".repeat(200);
const t0 = performance.now(); for (let i = 0; i < 20; i++) classify(long); const ms = (performance.now() - t0) / 20;
t("uzun metinde sınıflandırma < 60 ms (kurallar + model)", ms < 60, ms.toFixed(1) + " ms");

console.log(fail ? `\n${fail} test başarısız` : "\ntüm öğrenme testleri geçti");
process.exit(fail ? 1 : 0);
