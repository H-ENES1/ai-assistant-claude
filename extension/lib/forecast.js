// Tahmin motoru: bir mesajın limitlerin ne kadarını kullanacağını hesaplar.
//
// Model (her şey belirsizliğiyle birlikte, Monte Carlo ile hesaplanır):
//
//   maliyet = w_model × [ yeni_girdi + önbellekte_olmayan_geçmiş + araç_girdisi
//                         + 5 × (görünen_çıktı + düşünme) ]
//   limit_yüzdesi = k_pencere × maliyet × yoğun_saat_çarpanı
//
//   w_model      : modelin girdi fiyatı ($/MTok). Limit harcamasının API fiyatıyla orantılı
//                  olduğu varsayımı lugia19/Claude-Usage-Extension'dan alınmıştır.
//                  Çıktı tokenı her modelde girdinin 5 katı fiyatlıdır (Anthropic fiyat sayfası).
//   önbellek     : son 60 dakikada kullanılmış bağlam önbellekten okunur ve limitten düşmez
//                  (lugia19 gözlemi: CACHING_MULTIPLIER = 0, TOKEN_CACHING_DURATION = 1 saat).
//   görünen_çıktı: log-normal. log(çıktı) = β_tip + 0.157·log(uzunluk_ipucu) + 1.047·karmaşıklık
//                  + δ_Claude + ε. β ve σ, CASTILLO veri setinde (büyük açık modeller, 7 veri seti)
//                  en küçük kareler ile bulundu; ayrılmış test verisinde %80 aralık %77 kapsadı.
//   k_pencere    : plan başına "1 maliyet birimi = limitin yüzde kaçı". Önsel değerler kaba
//                  tahmindir; adım 10'daki kalibrasyon her mesajın gerçek yüzde değişiminden öğrenir.

export const MODELS = {
  "fable 5.1":  { id: "claude-fable-5-1",  family: "fable",  weight: 10,  ctx: 1_000_000 },
  "fable 5":    { id: "claude-fable-5",    family: "fable",  weight: 10,  ctx: 500_000 },
  "opus 5.5":   { id: "claude-opus-5-5",   family: "opus",   weight: 4,   ctx: 1_000_000 },
  "opus 5":     { id: "claude-opus-5",     family: "opus",   weight: 5,   ctx: 1_000_000 },
  "opus 4.8":   { id: "claude-opus-4-8",   family: "opus",   weight: 5,   ctx: 500_000 },
  "opus 4.7":   { id: "claude-opus-4-7",   family: "opus",   weight: 5,   ctx: 500_000 },
  "opus 4.6":   { id: "claude-opus-4-6",   family: "opus",   weight: 5,   ctx: 500_000 },
  "opus 4.5":   { id: "claude-opus-4-5",   family: "opus",   weight: 5,   ctx: 200_000 },
  "sonnet 5.5": { id: "claude-sonnet-5-5", family: "sonnet", weight: 2,   ctx: 1_000_000 },
  "sonnet 5":   { id: "claude-sonnet-5",   family: "sonnet", weight: 2,   ctx: 1_000_000 },
  "sonnet 4.6": { id: "claude-sonnet-4-6", family: "sonnet", weight: 3,   ctx: 500_000 },
  "sonnet 4.5": { id: "claude-sonnet-4-5", family: "sonnet", weight: 3,   ctx: 200_000 },
  "haiku 5.5":  { id: "claude-haiku-5-5",  family: "haiku",  weight: 0.1, longWeight: 0.5, longAbove: 100_000, ctx: 1_000_000 },
  "haiku 4.5":  { id: "claude-haiku-4-5",  family: "haiku",  weight: 1,   ctx: 200_000 }
};
const FAMILY_DEFAULT = { fable: "fable 5.1", opus: "opus 5.5", sonnet: "sonnet 5.5", haiku: "haiku 5.5" };
export const RECOMMEND_LABEL = { haiku: "Haiku 5.5", sonnet: "Sonnet 5.5", opus: "Opus 5.5", fable: "Fable 5.1" };
const TIER_ORDER = ["haiku", "sonnet", "opus", "fable"];

// claude.ai'nin her sohbette taşıdığı sabit sistem talimatı + araç tanımları (lugia19 ölçümü,
// Ekim 2026: davranış 28,6K + araçlar 58,5K + beceriler 5,5K + diğer 2,3K). Önbellekte durur,
// limitten düşmez ama bağlam penceresinde yer kaplar. Hafıza açıksa ~24,8K daha eklenir.
export const SYSTEM_TOKENS = 94_900;
export const MEMORY_TOKENS = 24_800;
export const CACHE_TTL_MS = 60 * 60 * 1000;
export const CACHE_READ_WEIGHT = 0;
const OUTPUT_PRICE_RATIO = 5;

// Plan başına önsel limit büyüklüğü (maliyet birimi; 1 birim = 1 token × $/MTok).
// lugia19'un "kaba tahmin" değerleri: Max 5x oturum 15M, haftalık ≈ 10 oturum; Free oturum 375K.
// Belirsizlik çok büyük (log-σ 0.8 ≈ ×2.2); kalibrasyon birkaç mesajda daraltır.
export const PLAN_CAPS = {
  claude_free:    { session: 375_000,    weekly: 3_750_000 },
  claude_pro:     { session: 3_000_000,  weekly: 30_000_000 },
  claude_team:    { session: 3_750_000,  weekly: 37_500_000 },
  claude_max_5x:  { session: 15_000_000, weekly: 150_000_000 },
  claude_max_20x: { session: 60_000_000, weekly: 600_000_000 }
};
export const PRIOR_K_LOGSD = 0.8;

// Mayıs 2026'dan beri Pro ve Max'te yoğun saat kısıtlaması yok; Free ve Team için
// hafta içi 12:00–18:00 UTC arası oturum limiti ~1,5 kat hızlı doluyor (lugia19).
export const PEAK = { multiplier: 1.5, tiers: ["claude_free", "claude_team"] };
export function isPeak(now = new Date()) {
  const d = now.getUTCDay(), h = now.getUTCHours();
  return d !== 0 && d !== 6 && h >= 12 && h < 18;
}

// Effort → gizli düşünme tokenı / görünen çıktı oranı (önsel; kalibrasyon k içinde emer).
const EFFORT = {
  off: { m: 0, sd: 0 }, low: { m: 0.25, sd: 0.6 }, medium: { m: 0.7, sd: 0.6 },
  high: { m: 1.6, sd: 0.6 }, max: { m: 3, sd: 0.7 }, auto: { m: 0.7, sd: 0.8 }
};
export function normalizeEffort(label) {
  const s = String(label || "").toLocaleLowerCase("tr");
  if (/düşük|low/.test(s)) return "low";
  if (/orta|medium/.test(s)) return "medium";
  if (/çok yüksek|maks|max|extra/.test(s)) return "max";
  if (/yüksek|high/.test(s)) return "high";
  if (/kapalı|off|none/.test(s)) return "off";
  return "auto";
}

export const effortMean = (key) => (EFFORT[key] || EFFORT.auto).m;

// Kalibrasyon için: bir mesajın GERÇEKLEŞEN maliyeti (görünen çıktı ölçülür; düşünme ve
// araç girdisi görünmez, beklenen değerleriyle eklenir; k bu farkı zamanla emer).
export function realizedCost({ weight, newInput, history, cold, outTokens, effort, toolMedian = 0 }) {
  return weight * (newInput + (cold ? history : history * CACHE_READ_WEIGHT) + toolMedian +
    OUTPUT_PRICE_RATIO * outTokens * (1 + effortMean(effort)));
}

// CASTILLO'dan öğrenilen çıktı uzunluğu modeli (log token).
const LEN = {
  beta: {
    code_fix: 5.706, code_write: 5.772, data_analysis: 5.338, explain: 5.624, file_create: 6.061,
    math: 5.412, research: 5.327, rewrite: 4.361, short_qa: 5.310, summarize: 4.807,
    translate: 4.722, writing: 5.779
  },
  sd: {
    code_fix: 0.594, code_write: 0.431, data_analysis: 0.578, explain: 1.042, file_create: 0.573,
    math: 0.854, research: 1.197, rewrite: 1.262, short_qa: 1.128, summarize: 1.122,
    translate: 1.345, writing: 1.048
  },
  lengthHint: 0.157,
  complexity: 1.047
};
// Claude ile açık modeller arasındaki fark için önsel: cevaplar ~%30 daha uzun, ek belirsizlik.
export const CLAUDE_OUTPUT_PRIOR = { mean: Math.log(1.3), sd: 0.35 };

// CASTILLO'da iyi temsil edilmeyen tipler için uzman önselleri.
const OVERRIDE = {
  research:    { median: 1200, sd: 0.7, tool: { median: 25_000, sd: 0.8 } }, // web arama sonuçları girdiye eklenir
  file_create: { median: 2500, sd: 0.7 },
  data_analysis_with_file: { median: 900, sd: 0.8, tool: { median: 4_000, sd: 1.0 } }
};

export function resolveModel(label) {
  const s = String(label || "").toLowerCase().match(/(fable|opus|sonnet|haiku)\s*(\d+(?:\.\d+)?)/);
  if (!s) return { key: null, info: null };
  const key = `${s[1]} ${s[2]}`;
  if (MODELS[key]) return { key, info: MODELS[key] };
  const fk = FAMILY_DEFAULT[s[1]];
  return { key: fk, info: MODELS[fk], approx: true };
}

export function modelWeight(info, promptTokens) {
  if (!info) return 4;
  if (info.longWeight && promptTokens > info.longAbove) return info.longWeight;
  return info.weight;
}

// ---------- Rastgele sayılar (tekrarlanabilir: aynı girdi → aynı sonuç, ekranda titreme yok) ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function normals(rand) {
  let spare = null;
  return () => {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let u = 0, v = 0;
    while (u === 0) u = rand();
    v = rand();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
}
const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))];
const logRange = (r) => {
  // {low, mid, high} → log-normal (μ, σ); low/high ≈ %10/%90
  const lo = Math.max(1, r.low || 0), hi = Math.max(lo, r.high || 0);
  const md = Math.max(lo, Math.min(hi, r.mid || Math.sqrt(lo * hi)));
  return { mu: Math.log(md), sd: Math.max(0.01, (Math.log(hi) - Math.log(lo)) / (2 * 1.2816)) };
};

// Çıktı uzunluğu dağılımı (log uzayı): { mu, sd, tool? }
export function outputPrior(cls, ctx = {}, calib = null) {
  const type = cls.type;
  let mu, sd, tool = null;
  const contentTokens = ctx.promptTokens?.mid || 0;
  const docTokens = ctx.attachmentTokens?.mid || 0;

  if ((type === "translate" || type === "rewrite") && contentTokens > 150) {
    mu = Math.log(1.05 * contentTokens + 40); sd = 0.3;
  } else if (type === "summarize" && docTokens + contentTokens > 1500) {
    mu = Math.log(Math.min(1800, 150 + 0.03 * (docTokens + contentTokens))); sd = 0.6;
  } else if (type === "research") {
    const o = OVERRIDE.research; mu = Math.log(o.median); sd = o.sd; tool = o.tool;
  } else if (type === "file_create") {
    const o = OVERRIDE.file_create; mu = Math.log(o.median); sd = o.sd;
  } else if (type === "data_analysis" && docTokens > 0) {
    const o = OVERRIDE.data_analysis_with_file; mu = Math.log(o.median); sd = o.sd; tool = o.tool;
  } else {
    mu = LEN.beta[type] ?? LEN.beta.explain;
    sd = LEN.sd[type] ?? 1.0;
  }
  mu += LEN.lengthHint * Math.log(cls.lengthHint || 1) + LEN.complexity * (cls.complexity || 0);

  // Claude farkı: kalibrasyon varsa onun sonsalı, yoksa önsel
  const adj = calib?.outputAdjust?.(type) || { mean: CLAUDE_OUTPUT_PRIOR.mean, sd: CLAUDE_OUTPUT_PRIOR.sd };
  mu += adj.mean;
  sd = Math.sqrt(sd * sd + adj.sd * adj.sd);
  return { mu, sd, tool };
}

// k (yüzde / maliyet birimi) dağılımı, pencere başına
export function kPrior(tier, window) {
  const caps = PLAN_CAPS[tier] || PLAN_CAPS.claude_pro;
  const cap = caps[window];
  return { mu: Math.log(100 / cap), sd: PRIOR_K_LOGSD + (PLAN_CAPS[tier] ? 0 : 0.4) };
}

// Ana tahmin.
// input: { promptTokens, attachmentTokens, history: {tokens, lastActivityAt, messages},
//          model, effort, tier, cls, now, calib, memoryOn }
export function forecastMessage(input, { samples = 800 } = {}) {
  const now = input.now ?? Date.now();
  const m = resolveModel(input.model);
  const effortKey = normalizeEffort(input.effort);
  const eff = EFFORT[effortKey];
  const tier = input.tier || "claude_pro";
  const cls = input.cls;
  const calib = input.calib || null;
  const prompt = input.promptTokens || { low: 0, mid: 0, high: 0 };
  const att = input.attachmentTokens || { low: 0, mid: 0, high: 0 };
  const histT = input.history?.tokens || { low: 0, mid: 0, high: 0 };
  const hasHistory = (input.history?.messages || 0) > 0 && histT.high > 0;

  // Önbellek durumu
  const last = input.history?.lastActivityAt || null;
  let cache = "none", pCold = 0, minutesSince = null;
  if (hasHistory) {
    if (last) {
      minutesSince = Math.max(0, (now - last) / 60000);
      cache = now - last < CACHE_TTL_MS ? "warm" : "cold";
      pCold = cache === "cold" ? 1 : 0;
    } else { cache = "unknown"; pCold = 0.5; }
  }

  const contextBase = SYSTEM_TOKENS + (input.memoryOn ? MEMORY_TOKENS : 0);
  const promptAll = contextBase + prompt.mid + att.mid + histT.mid;
  const w = modelWeight(m.info, promptAll);
  const out = outputPrior(cls, { promptTokens: prompt, attachmentTokens: att }, calib);
  const pIn = logRange({ low: prompt.low + att.low, mid: prompt.mid + att.mid, high: prompt.high + att.high });
  const pHist = logRange(histT);
  const kS = calib?.kPosterior?.(tier, "session") || kPrior(tier, "session");
  const kW = calib?.kPosterior?.(tier, "weekly") || kPrior(tier, "weekly");
  const peak = PEAK.tiers.includes(tier) && isPeak(new Date(now));
  const peakMul = peak ? PEAK.multiplier : 1;

  const seed = Math.round(prompt.mid * 7 + att.mid * 13 + histT.mid * 3 + (cls.type.length * 101)) || 1;
  const N = normals(mulberry32(seed));
  const S = { out: [], cost: [], sess: [], week: [], think: [] };
  for (let i = 0; i < samples; i++) {
    const zOut = N();
    const visible = Math.exp(out.mu + out.sd * zOut);
    const think = eff.m > 0 ? visible * eff.m * Math.exp(eff.sd * N() - eff.sd * eff.sd / 2) : 0;
    const newIn = (prompt.mid + att.mid) > 0 ? Math.exp(pIn.mu + pIn.sd * N()) : 0;
    const hist = hasHistory ? Math.exp(pHist.mu + pHist.sd * N()) : 0;
    const cold = pCold >= 1 || (pCold > 0 && (i % 2 === 0));
    const histCost = hist * (cold ? 1 : CACHE_READ_WEIGHT);
    const toolIn = out.tool ? Math.exp(Math.log(out.tool.median) + out.tool.sd * N()) : 0;
    const cost = w * (newIn + histCost + toolIn + OUTPUT_PRICE_RATIO * (visible + think));
    const zk = N();
    S.out.push(visible); S.think.push(think); S.cost.push(cost);
    S.sess.push(cost * Math.exp(kS.mu + kS.sd * zk) * peakMul);
    S.week.push(cost * Math.exp(kW.mu + kW.sd * zk)); // aynı z: iki pencere birlikte yanılır
  }
  const q = (arr) => { const s = [...arr].sort((a, b) => a - b); return { low: quantile(s, 0.1), mid: quantile(s, 0.5), high: quantile(s, 0.9), p80: quantile(s, 0.8) }; };

  const sess = q(S.sess), week = q(S.week);
  const spreadRatio = sess.high / Math.max(1e-9, sess.low);
  const confidence = spreadRatio < 3 ? "high" : spreadRatio < 8 ? "medium" : "low";

  return {
    model: m.key, modelApprox: !!m.approx, weight: w, effort: effortKey, tier, peak,
    cache, minutesSince,
    output: q(S.out), thinking: q(S.think), cost: q(S.cost),
    pct: { session: sess, weekly: week },
    confidence,
    context: {
      used: contextBase + prompt.high + att.high + histT.high + q(S.out).high,
      usedLow: contextBase + prompt.low + att.low + histT.low,
      window: m.info?.ctx || 200_000,
      system: contextBase
    }
  };
}

// Bir pencerenin kalan yüzdesine göre bu mesaj sığar mı?
export function fitCheck(fc, usage) {
  const res = [];
  for (const [win, key] of [["session", "fiveHour"], ["weekly", "sevenDay"]]) {
    const w = usage?.[key];
    if (!w) continue;
    const remaining = Math.max(0, 100 - w.pct);
    const p = fc.pct[win];
    let status = "ok";
    if (p.mid >= remaining) status = "no";
    else if (p.high >= remaining) status = "maybe";
    res.push({ window: win, remaining, status, resetsAt: w.resetsAt });
  }
  const worst = res.find((r) => r.status === "no") || res.find((r) => r.status === "maybe") || null;
  return { windows: res, worst };
}

// ---------- Model önerisi ----------
export function recommendModel(fc, rec, input) {
  const cur = resolveModel(input.model);
  if (!cur.info) return null;
  const curTier = TIER_ORDER.indexOf(cur.info.family);
  const recTier = TIER_ORDER.indexOf(rec.tier);
  const label = RECOMMEND_LABEL[rec.tier];
  const recInfo = MODELS[FAMILY_DEFAULT[rec.tier]];
  const promptAll = fc.context.usedLow;
  const wRec = modelWeight(recInfo, promptAll), wCur = modelWeight(cur.info, promptAll);
  if (recTier < curTier && wRec < wCur) {
    return { kind: "downgrade", label, saving: 1 - wRec / wCur, reasonKey: rec.reasonKey };
  }
  if (recTier > curTier) {
    return { kind: "upgrade", label, extra: wRec / wCur - 1, reasonKey: rec.reasonKey };
  }
  return { kind: "ok", label: cur.key };
}

export function recommendEffort(cls, effortKey) {
  const light = ["short_qa", "translate", "rewrite", "summarize"];
  if (light.includes(cls.type) && (effortKey === "high" || effortKey === "max") && cls.complexity < 0.4) {
    return { kind: "lower", to: "low" };
  }
  if ((cls.type === "math" || cls.type === "code_write") && cls.complexity >= 0.6 && (effortKey === "low" || effortKey === "off")) {
    return { kind: "raise", to: "high" };
  }
  return null;
}

// ---------- Kalan limitle yapılabilecekler (adım 7) ----------
// Temsilci görevler: tipik girdi büyüklükleriyle, YENİ bir sohbette (geçmiş yok, sistem önbellekte).
export const CAPACITY_TASKS = [
  { key: "short_qa", cls: { type: "short_qa", complexity: 0.05, lengthHint: 1 }, prompt: 40 },
  { key: "explain", cls: { type: "explain", complexity: 0.15, lengthHint: 1 }, prompt: 80 },
  { key: "code_fix", cls: { type: "code_fix", complexity: 0.3, lengthHint: 1 }, prompt: 600 },
  { key: "writing", cls: { type: "writing", complexity: 0.2, lengthHint: 1 }, prompt: 150 },
  { key: "summarize", cls: { type: "summarize", complexity: 0.25, lengthHint: 1 }, prompt: 60, attachment: 15_000 },
  { key: "research", cls: { type: "research", complexity: 0.35, lengthHint: 1 }, prompt: 80 }
];

export function capacity(usage, base) {
  const rows = [];
  for (const t of CAPACITY_TASKS) {
    const fc = forecastMessage({
      ...base,
      cls: t.cls,
      promptTokens: { low: t.prompt * 0.8, mid: t.prompt, high: t.prompt * 1.25 },
      attachmentTokens: t.attachment ? { low: t.attachment * 0.6, mid: t.attachment, high: t.attachment * 1.6 } : undefined,
      history: { messages: 0 }
    }, { samples: 400 });
    let count = Infinity, binding = null;
    for (const [win, key] of [["session", "fiveHour"], ["weekly", "sevenDay"]]) {
      const w = usage?.[key];
      if (!w) continue;
      const remaining = Math.max(0, 100 - w.pct);
      // Temkinli: dağılımın %80 noktası, yani "az söz ver, fazlasını yap"
      const c = Math.floor(remaining / Math.max(1e-6, fc.pct[win].p80));
      if (c < count) { count = c; binding = win; }
    }
    if (!Number.isFinite(count)) continue;
    rows.push({ key: t.key, count, binding, perTask: fc.pct.session });
  }
  return rows;
}
