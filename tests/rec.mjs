import { readFileSync } from "node:fs";
const { classify, recommendTier } = await import("../extension/lib/classify.js");
const cases = JSON.parse(readFileSync(new URL("./rec-cases.json", import.meta.url), "utf8"));
let ok = 0, dangerous = 0; const bad = [];
const order = ["haiku", "sonnet", "opus", "fable"];
for (const [p, want] of cases) {
  const c = classify(p), r = recommendTier(c);
  if (want.includes(r.tier)) ok++;
  else {
    // Tehlikeli hata: gerekenden HAFİF model önermek (kalite kaybı). Ağır önermek sadece pahalı.
    const tooLight = order.indexOf(r.tier) < Math.min(...want.map((w) => order.indexOf(w)));
    if (tooLight) dangerous++;
    bad.push(`${tooLight ? "⚠ HAFİF" : "  ağır "} ${r.tier.padEnd(6)} beklenen ${want.join("/").padEnd(13)} [${c.type}, cx ${c.complexity.toFixed(2)}, ${c.confidence}] ${p.slice(0, 70).replace(/\n/g, " ")}`);
  }
}
console.log(`doğru: ${ok}/${cases.length} (%${Math.round(ok / cases.length * 100)}) · gerekenden hafif öneri: ${dangerous}`);
console.log(bad.join("\n"));
if (process.argv.includes("--strict") && (dangerous > 0 || ok / cases.length < 0.9)) process.exit(1);
