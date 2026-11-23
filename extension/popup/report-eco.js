// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Haftalık rapordaki "kurtardığın su ve enerji" bölümü. Hesap: lib/eco.js (hepsi tahmin, aralıklı).
// Animasyon: kap dolar, damlalar düşer, sayı yukarı sayar; prefers-reduced-motion'da hepsi statik.
import { ecoWeek, ecoTotalView, UNITS_PER_TOKEN, E_TOKEN_MWH, WUE_L_PER_KWH } from "../lib/eco.js";
import { duration } from "../lib/i18n.js";

const NS = "http://www.w3.org/2000/svg";
const S = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

// 64×64 çizimler. d: dış çizgi (aynı yol suyu kırpar), extra: yalnızca çizgi, fx: dolunca beliren ayrıntı,
// top / bottom: iç boşluğun üst ve alt kenarı (dolum yüksekliği bunların arasında).
const ART = {
  drop: { d: "M32 7C32 7 13 31 13 42a19 19 0 0 0 38 0C51 31 32 7 32 7Z", top: 12, bottom: 61 },
  tsp: { d: "M8 40a16 11 0 1 0 32 0a16 11 0 1 0-32 0Z", extra: "M38 35L59 21", top: 29, bottom: 51 },
  glass: { d: "M15 9H49L45 58H19Z", top: 13, bottom: 58 },
  bottle: { d: "M27 5h10v9c0 5 9 7 9 15v27a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4V29c0-8 9-10 9-15Z", top: 18, bottom: 60 },
  bucket: { d: "M9 22H55L49 59H15Z", extra: "M9 22C9 2 55 2 55 22", top: 26, bottom: 59 },
  tub: { d: "M4 26H60V36A17 17 0 0 1 43 53H21A17 17 0 0 1 4 36Z", extra: "M16 53v6M48 53v6M52 26V14a5 5 0 0 0-10 0", top: 30, bottom: 53 },
  led: { d: "M32 8a17 17 0 0 0-10 30.7V46h20v-7.3A17 17 0 0 0 32 8Z", extra: "M24 51h16M27 56h10", fx: "M32-8v7M8 2l5 5M56 2l-5 5M2 25h7M62 25h-7", top: 8, bottom: 46 },
  phone: { d: "M22 6h20a4 4 0 0 1 4 4v44a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4Z", extra: "M29 11h6", fx: "M34 20l-8 13h6l-2 11 8-13h-6Z", top: 9, bottom: 58 },
  kettle: { d: "M17 28h28l4 28a3 3 0 0 1-3 3H16a3 3 0 0 1-3-3Z", extra: "M17 32L8 25M45 31c12 0 12 20 2 20M24 28c0-7 14-7 14 0", fx: "M26 14c-3-4 3-6 0-10M36 14c-3-4 3-6 0-10", top: 31, bottom: 59 }
};
const DROP = "M0-9c-2.2 3-3.4 5-3.4 6.6a3.4 3.4 0 0 0 6.8 0C3.4-4 2.2-6 0-9Z";

// kind: "water" | "energy"; level: 0–1; state: "pos" | "neg"
function art(key, kind, level, state, animate) {
  const a = ART[key];
  const svg = S("svg", { viewBox: "0 -12 64 76", class: `eco-art ${kind} ${state}${animate ? " anim" : ""}`, "aria-hidden": "true", focusable: "false" });
  const id = `ecoClip-${key}`;
  const clip = S("clipPath", { id }); clip.append(S("path", { d: a.d }));
  const defs = S("defs"); defs.append(clip);
  const y = a.bottom - Math.max(0, Math.min(1, level)) * (a.bottom - a.top);
  const g = S("g", { "clip-path": `url(#${id})` });
  const lvl = S("rect", { class: "lvl", x: 0, y: 0, width: 64, height: 64 });
  lvl.style.setProperty("--from", `${a.bottom}px`); lvl.style.setProperty("--to", `${y}px`);
  g.append(lvl);
  svg.append(defs, g, S("path", { class: "line", d: a.d }));
  if (a.extra) svg.append(S("path", { class: "line", d: a.extra }));
  if (a.fx && state === "pos") svg.append(S("path", { class: kind === "energy" && key === "phone" ? "fx solid" : "fx", d: a.fx }));
  if (kind === "water" && state === "pos") {
    // Duran bir damla (hareket azaltmada da görünür) + düşen üç damla
    const still = S("path", { class: "dr0", d: DROP, transform: "translate(32 0)" });
    svg.append(still);
    for (let i = 0; i < 3; i++) {
      const d = S("path", { class: `dr d${i + 1}`, d: DROP });
      d.style.setProperty("--fall", `${Math.max(14, y - 2)}px`);
      svg.append(d);
    }
  }
  return svg;
}

const reduceMotion = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (_) { return false; } };
function countUp(node, to, fmt, animate) {
  if (!animate || !(to > 0)) { node.textContent = fmt(to); return; }
  const t0 = performance.now(), dur = 1300;
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    node.textContent = fmt(p < 1 ? to * e : to);
    if (p < 1 && node.isConnected) requestAnimationFrame(step);
  };
  node.textContent = fmt(0);
  requestAnimationFrame(step);
}

let lastKey = "";
// ctx: { $, I (i18n), sends, eco (sayaç), now }
export function renderEco({ $, I, sends, eco, now }) {
  const t = I.t;
  const wk = ecoWeek(sends, now), tot = ecoTotalView(eco);
  const key = JSON.stringify([I.lang, wk.netU, wk.tracked, wk.gainN, wk.extraN, tot?.netU ?? null, tot?.since ?? null]);
  if (key === lastKey) return; // veri değişmediyse yeniden çizme (animasyon baştan başlamasın)
  lastKey = key;
  const animate = !reduceMotion();

  const sig = (x, d = 2) => Number(Number(x).toPrecision(d));
  const nf = (x, max = 2) => x.toLocaleString(I.locale, { maximumFractionDigits: max });
  const vol = (ml) => (ml >= 1000 ? `${nf(sig(ml / 1000))} L` : `${nf(sig(ml))} mL`);
  const wh = (x) => (x >= 1000 ? `${nf(sig(x / 1000))} kWh` : `${nf(sig(x))} Wh`);
  const times = (c) => (c > 0 && c < 0.1 ? "< " + nf(0.1, 1) : nf(c >= 10 ? Math.round(c) : Math.round(c * 10) / 10, 1)) + "×";
  const ledTime = (min) => (min < 1 ? t("ecoSecs", [String(Math.max(1, Math.round(min * 60)))]) : duration(t, min * 60000));

  $("ecoTitle").textContent = t("ecoTitle");
  $("ecoTag").textContent = t("rpEstimated");
  const v = wk.view;
  $("ecoLead").textContent =
    !wk.tracked ? t("ecoLeadNone")
    : v.sign === "pos" ? t("ecoLeadPos", [String(wk.gainN)]) + (wk.extraN ? " " + t("ecoLeadNet", [String(wk.extraN)]) : "")
    : v.sign === "neg" ? t("ecoLeadNeg", [String(wk.extraN)])
    : t("ecoLeadZero");
  $("ecoSec").dataset.state = !wk.tracked ? "none" : v.sign;

  // Kartlar: su ve enerji (sıfırda kart yok)
  const cards = $("ecoCards"); cards.replaceChildren();
  const card = (kind, unit, range, fmtRange, state) => {
    const c = el("div", `eco-card ${kind} ${state}`);
    const mid = unit.count.mid;
    c.append(art(unit.key, kind, mid >= 1 ? 0.88 : Math.max(0.18, mid * 0.88), state, animate));
    const tx = el("div", "eco-txt");
    const head = el("div", "eco-lbl", t(kind === "water" ? "ecoWater" : "ecoEnergy"));
    if (state === "neg") head.append(" ", el("span", "eco-chip", t("ecoExtra")));
    const big = el("div", "eco-big"), num = el("span", "eco-num");
    big.append("≈ ", num);
    countUp(num, mid, unit.key === "led" ? ledTime : times, animate);
    tx.append(head, big, el("div", "eco-unit", t(`ecoU_${unit.key}`)),
      el("div", "eco-sub", `≈ ${fmtRange(range.mid)} · ${t("ecoRange", [fmtRange(range.low), fmtRange(range.high)])}`));
    c.append(tx);
    c.dataset.unit = unit.key;
    return c;
  };
  if (wk.tracked && v.sign !== "zero") cards.append(card("water", v.waterUnit, v.water, vol, v.sign), card("energy", v.energyUnit, v.energy, wh, v.sign));
  cards.hidden = !cards.childElementCount;

  // Kurduğundan beri
  const tb = $("ecoTotal"); tb.replaceChildren();
  if (tot) {
    const tvw = tot.view;
    tb.append(el("strong", "", t("ecoTotalTitle")));
    if (tvw.sign === "zero") tb.append(el("span", "", t("ecoTotalZero")));
    else {
      if (tvw.sign === "neg") tb.append(el("span", "", t("ecoTotalNeg")));
      const chip = (kind, unit, mid, fmt) => {
        const s = el("span", `eco-pill ${kind} ${tvw.sign}`);
        s.append(el("b", "", "≈ " + (unit.key === "led" ? ledTime(unit.count.mid) : times(unit.count.mid))), " " + t(`ecoU_${unit.key}`) + ` · ≈ ${fmt(mid)}`);
        if (tvw.sign === "neg") s.append(" · " + t("ecoExtra"));
        return s;
      };
      tb.append(chip("water", tvw.waterUnit, tvw.water.mid, vol), chip("energy", tvw.energyUnit, tvw.energy.mid, wh));
    }
    tb.append(el("span", "eco-since", t("ecoTotalSince", [new Date(tot.since).toLocaleDateString(I.locale, { day: "numeric", month: "long", year: "numeric" })])));
  }
  tb.hidden = !tot;

  // Formül (düz metin) ve varsayımlar
  $("ecoHow").textContent = t("ecoHow");
  const n1 = (x) => x.toLocaleString(I.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const lines = ["E = token × e_token", "W = E × WUE", "",
    t("ecoFormulaTok", [String(UNITS_PER_TOKEN)]),
    t("ecoFormulaE", [n1(E_TOKEN_MWH.low), n1(E_TOKEN_MWH.mid), n1(E_TOKEN_MWH.high)]),
    t("ecoFormulaW", [n1(WUE_L_PER_KWH.low), n1(WUE_L_PER_KWH.mid), n1(WUE_L_PER_KWH.high)])];
  if (wk.tracked && v.sign !== "zero") {
    const sg = v.sign === "neg" ? "−" : "";
    // Negatifte aralık da eksi işaretlidir (büyük eksiden küçüğe)
    const rng = (r, f) => (sg ? `${sg}${f(r.mid)} (${sg}${f(r.high)} – ${sg}${f(r.low)})` : `${f(r.mid)} (${f(r.low)} – ${f(r.high)})`);
    lines.push("", t("ecoFormulaWeek", [sg + I.num(v.tokens), rng(v.energy, wh), rng(v.water, vol)]));
  }
  $("ecoFormula").textContent = lines.join("\n");
  $("ecoAssume").textContent = t("ecoAssume");
  $("ecoSources").textContent = t("ecoSources");
}
