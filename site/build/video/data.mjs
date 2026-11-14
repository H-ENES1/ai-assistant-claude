// Videolardaki bütün sayılar buradan gelir: eklentinin kendi tahmin, öneri ve su/enerji kodu çalıştırılır,
// sonuç site/build/video/data.js dosyasına yazılır (anim4.html onu <script> ile okur).
//   node site/build/video/data.mjs
// Varsayımlar (videoda da yazar): Pro planı, kalibrasyonsuz (yeni kurulum), bellek açık.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.join(HERE, "../../../extension");
const lib = (f) => import(pathToFileURL(path.join(EXT, "lib", f)).href);
const { estimateTokens } = await lib("tokens.js");
const { classify } = await lib("classify.js");
const { forecastMessage } = await lib("forecast.js");
const { advise } = await lib("advisor.js");
const { detectDomain } = await lib("domain.js");
const { ecoFromUnits } = await lib("eco.js");

const NOW = Date.UTC(2026, 10, 14, 19, 0, 0); // sabit an: yoğun saat dışı, sonuç her çalıştırmada aynı
const LOCALE = { tr: "tr-TR", en: "en-US" };

function run(text, model, effort, history) {
  const cls = classify(text), dom = detectDomain(text, cls), pt = estimateTokens(text);
  const hist = history || { messages: 0 };
  const fc = forecastMessage({ promptTokens: pt, model, effort, tier: "claude_pro", cls, history: hist, memoryOn: true, now: NOW });
  const a = advise({ cls, dom, fc, currentModel: model, effort: fc.effort, effortAssumed: fc.effortAssumed, historyTokens: hist.tokens?.mid || 0, cacheWarm: false, attachmentTokens: 0, emptyPrompt: false });
  return { cls, dom, pt, fc, a };
}

function build(lang) {
  const M = JSON.parse(fs.readFileSync(path.join(EXT, "_locales", lang, "messages.json"), "utf8"));
  const t = (k, subs = []) => { if (!M[k]) throw new Error("metin yok: " + k); return M[k].message.replace(/\$(\d)/g, (_, i) => subs[i - 1] ?? ""); };
  const nf = new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: 2 });
  // lib/i18n.js içindeki pct ile aynı yuvarlama
  const pct = (x) => { const v = !(x > 0) ? 0 : x < 0.1 ? Math.max(0.01, Math.round(x * 100) / 100) : x < 10 ? Math.round(x * 10) / 10 : Math.round(x); return t("pct", [nf.format(v)]); };
  const sig = (v) => new Intl.NumberFormat(LOCALE[lang], { maximumSignificantDigits: 2 }).format(v);
  const eff = (k) => t("eff_" + k);
  const head = (a) => {
    let title = a.kind === "save" ? t("advSave", [a.suggested]) : a.kind === "upgrade" ? t("advUpgrade", [a.current, a.suggested]) : t("advOk", [a.current]);
    if (a.effort?.kind === "with_switch") title += " · " + t("advEffWith", [eff(a.effort.to)]);
    return title;
  };
  const one = (text, model, effort, history) => {
    const r = run(text, model, effort, history), s = r.fc.pct.session, w = r.fc.pct.weekly;
    return {
      text, model, effort: eff(r.fc.effort), tokens: r.pt.mid,
      pill: "≈ " + pct(s.mid), range: pct(s.low) + "–" + pct(s.high), weekly: "≈ " + pct(w.mid), sub: t("pillSub"),
      mid: s.mid, low: s.low, high: s.high,
      kind: r.a.kind, title: head(r.a), suggested: r.a.suggested || null, sugEffort: r.a.effort?.to ? eff(r.a.effort.to) : null,
      from: r.a.curPct != null ? pct(r.a.curPct) : null, to: r.a.sugPct != null ? pct(r.a.sugPct) : null,
      saving: r.a.savingFrac != null ? Math.round(r.a.savingFrac * 100) : null,
      type: t("type_" + r.cls.type), conf: r.cls.confidence, cost: r.fc.cost.mid,
    };
  };
  const TX = {
    tr: {
      light: "Bu paragrafı İngilizceye çevir: Yarın sabahki toplantıya katılamayacağım, notları akşam paylaşırım.",
      heavy: "Hidrojen atomu için radyal dalga fonksiyonlarını adım adım türet ve Laguerre polinomlarıyla ilişkisini kanıtla.",
      trap: "Çeviri sistemi olan bir web sitesi yaptıracağım, bu zor bir iş",
    },
    en: {
      light: "Translate this paragraph into Turkish: I can't make tomorrow morning's meeting, I'll share my notes in the evening.",
      heavy: "Derive the radial wave functions of the hydrogen atom step by step and prove their relation to Laguerre polynomials.",
      trap: "I need a website built with a translation system, it is a hard job",
    },
  }[lang];
  const light = one(TX.light, "Opus 5.5", "high");
  const heavy = one(TX.heavy, "Sonnet 5.5", "medium");
  const trap = one(TX.trap, "Haiku 5.5", "medium");
  // Öneri uygulanınca hap ne gösterir: aynı mesaj, önerilen model ve effort ile
  const EFF_KEY = (name) => ["low", "medium", "high", "xhigh", "max"].find((k) => M["eff_" + k] && eff(k) === name) || "medium";
  const aft = one(TX.light, light.suggested, EFF_KEY(light.sugEffort));
  light.after = { model: aft.model, effort: aft.effort, pill: aft.pill, range: aft.range, title: aft.title, kind: aft.kind };
  // Su ve enerji: aynı çeviri, Opus 5.5 (Yüksek) yerine önerilen Haiku 5.5 (Düşük); N mesaj
  const N = 50, lite = run(TX.light, "Haiku 5.5", "low"), ec = ecoFromUnits(N * (light.cost - lite.fc.cost.mid));
  const ml = (v) => (v >= 1000 ? sig(v / 1000) + " L" : sig(v) + " mL"), wh = (v) => sig(v) + " Wh";
  const eco = {
    n: N, title: t("ecoTitle"), waterL: t("ecoWater"), energyL: t("ecoEnergy"),
    water: "≈ " + ml(ec.water.mid), waterRange: t("ecoRange", [ml(ec.water.low), ml(ec.water.high)]), waterMid: ec.water.mid,
    glass: "≈ " + sig(ec.water.mid / 250) + " × " + t("ecoU_glass"), fill: Math.min(1, ec.water.mid / 250),
    energy: "≈ " + wh(ec.energy.mid), energyRange: t("ecoRange", [wh(ec.energy.low), wh(ec.energy.high)]), energyMid: ec.energy.mid,
    phone: "≈ " + sig(ec.energy.mid / 19) + " × " + t("ecoU_phone"), phones: ec.energy.mid / 19,
  };
  for (const d of [light, heavy, trap]) delete d.cost;
  return { light, heavy, trap, eco, name: t("extName") };
}

const out = { tr: build("tr"), en: build("en") };
fs.writeFileSync(path.join(HERE, "data.js"), "// node site/build/video/data.mjs üretir; elle düzenleme.\nwindow.VDATA = " + JSON.stringify(out, null, 1) + ";\n");
for (const l of ["tr", "en"]) {
  const d = out[l];
  console.log(l, "| hafif:", d.light.pill, d.light.range, "→", d.light.title, d.light.from, "→", d.light.to, "%" + d.light.saving);
  console.log(l, "| öneri uygulanınca:", d.light.after.model, d.light.after.effort, d.light.after.pill, d.light.after.range, "→", d.light.after.title);
  console.log(l, "| ağır:", d.heavy.pill, "→", d.heavy.title);
  console.log(l, "| tuzak:", d.trap.type, d.trap.conf, "→", d.trap.title);
  console.log(l, "| su:", d.eco.water, d.eco.waterRange, d.eco.glass, "|", d.eco.energy, d.eco.energyRange, d.eco.phone);
}
