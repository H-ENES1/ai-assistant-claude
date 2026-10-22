// Kalibrasyon yakınsama simülasyonu (sitedeki grafik için). Gerçek eklenti kodunu kullanır.
import { observe, emptyState, makeCalib } from "../ext/lib/calibrate.js";
import { kPrior, realizedCost } from "../ext/lib/forecast.js";
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const N = 100, RUNS = 300, tier = "claude_pro";
const prior = kPrior(tier, "session");
const errs = Array.from({ length: N + 1 }, () => []);
for (let r = 0; r < RUNS; r++) {
  const trueK = Math.exp(prior.mu + 0.8 * gauss()); // gerçek plan, önselden ±2,2 kat sapabilir
  let st = emptyState(), cum = 20 + 40 * rnd();
  errs[0].push(Math.abs(prior.mu - Math.log(trueK)));
  for (let i = 1; i <= N; i++) {
    const out = Math.exp(6 + 0.9 * gauss()), newIn = Math.exp(4 + 1 * gauss());
    const w = [0.1, 2, 2, 4, 4][Math.floor(rnd() * 5)];
    const cost = realizedCost({ weight: w, newInput: newIn, history: 0, cold: false, outTokens: out, effort: "medium" });
    const trueCost = cost * Math.exp(0.35 * gauss()); // gizli düşünme vb. gürültü
    const before = Math.floor(cum); cum += trueK * trueCost; if (cum > 100) cum -= 80;
    const after = Math.floor(cum);
    const delta = after - before;
    if (delta >= 0) st = observe(st, { at: Date.now(), tier, window: "session", delta, cost, predicted: { low: 0, mid: 1, high: 3 } }).state;
    const post = makeCalib(st).kPosterior(tier, "session");
    errs[i].push(Math.abs(post.mu + post.sd * post.sd / 2 - Math.log(trueK)));
  }
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const series = errs.map((a, n) => ({ n, factor: +Math.exp(med(a)).toFixed(3) }));
console.log(JSON.stringify(series.filter((x) => x.n % 5 === 0 || x.n < 5)));
