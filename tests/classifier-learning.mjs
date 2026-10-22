// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Kişisel düzeltmeler iş türü tanımayı iyileştiriyor mu? Elle etiketli 240 mesaj (tests/ml/test*.tsv; eğitimde
// kullanılmadı) rastgele sırayla akar. Eklenti yanlış bildiğinde kullanıcı (olasılık 0,5) doğrusunu seçer.
// Aynı akışta düzeltme kapalıyken doğruluk karşılaştırılır. 20 farklı sıra, ortalama.
import { readFileSync } from "node:fs";
import { classify } from "../extension/lib/classify.js";
import { featurize, personalStep, decodeModel } from "../extension/lib/learn.js";
import PACKED from "../extension/lib/learn-weights.js";
const M = decodeModel(PACKED);
const rows = ["ml/test.tsv", "ml/test2.tsv"].flatMap((f) => readFileSync(new URL(f, import.meta.url), "utf8").split("\n").filter(Boolean).map((l) => l.split("\t"))).map(([t, q]) => ({ t, q }));
let seed = 5; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const RUNS = 20, B = 4, size = rows.length / B;
const learn = Array(B).fill(0), base = Array(B).fill(0);
for (let r = 0; r < RUNS; r++) {
  const order = [...rows].sort(() => rnd() - 0.5);
  let P = null;
  order.forEach((x, i) => {
    const b = Math.floor(i / size);
    const c0 = classify(x.q);                       // düzeltmesiz
    if (c0.type === x.t) base[b]++;
    const c1 = classify(x.q, { personal: P });      // öğrenen
    if (c1.type === x.t) learn[b]++;
    else if (rnd() < 0.5) { const f = featurize(x.q, c1.scores, M.dim); P = personalStep(M, P, f, x.t); }
  });
}
const pct = (v) => (100 * v / (RUNS * size)).toFixed(1);
console.log(`İş türü doğruluğu, ${rows.length} mesaj, ${B} ardışık dilim (her dilim ${size} mesaj), ${RUNS} farklı sıra`);
console.log("dilim | düzeltmesiz | kişisel düzeltmeli");
for (let b = 0; b < B; b++) console.log(`${b + 1}.     | %${pct(base[b])}       | %${pct(learn[b])}`);
