// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Haftalık rapor sayfası. Veri: chrome.storage.local "sends" (metin içermeyen gönderim kayıtları).
import { makeI18n } from "../lib/i18n.js";
import { weeklyReport, sendsCsv } from "../lib/report.js";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const FAM = { haiku: "Haiku", sonnet: "Sonnet", opus: "Opus", fable: "Fable", unknown: "?" };
let I = null;

async function render() {
  const { settings, sends = [] } = await chrome.storage.local.get(["settings", "sends"]);
  I = await makeI18n(settings?.language || "auto");
  const t = I.t;
  document.documentElement.lang = I.lang;
  document.title = t("rpTitle");
  $("title").textContent = t("rpTitle");
  $("csv").textContent = t("rpCsv");
  $("back").textContent = t("rpBack");
  const now = Date.now();
  const r = weeklyReport(sends, now);
  const day = (ms) => new Date(ms).toLocaleDateString(I.locale, { day: "numeric", month: "short" });
  $("range").textContent = t("rpRange", [day(r.from), day(r.to)]);
  $("csv").disabled = !sends.length;

  if (!r.enough) {
    $("empty").hidden = false; $("main").hidden = true;
    $("empty").textContent = t("rpNoData");
    return;
  }
  $("empty").hidden = true; $("main").hidden = false;
  const pctN = (x) => t("pct", [String(Math.round(x * 100))]);
  const one = (x) => (Math.round(x * 10) / 10).toLocaleString(I.locale);

  // Kutucuklar
  const tiles = $("tiles"); tiles.replaceChildren();
  const tile = (lbl, val, sub, hot) => { const d = el("div", "tile" + (hot ? " hot" : "")); d.append(el("div", "lbl", lbl), el("div", "val", val), el("div", "sub", sub)); tiles.append(d); };
  const ch = r.nChange === null ? t("rpChangeNone") : Math.abs(r.nChange) < 0.05 ? t("rpChangeSame") : t(r.nChange > 0 ? "rpChangeUp" : "rpChangeDown", [String(Math.round(Math.abs(r.nChange) * 100))]);
  tile(t("rpMsgs"), I.num(r.n), `${t("rpChats", [String(r.chats)])} · ${ch}`);
  if (r.sessionsEq >= 1) tile(t("rpSpent"), t("rpSessions", [one(r.sessionsEq)]), t("rpSpentSub", [I.pct(r.spent)]));
  else tile(t("rpSpent"), I.pct(r.spent), t("rpSpentSmall"));
  tile(t("rpPeak"), pctN(r.peak.share), t("rpPeakSub", [pctN(r.peak.nShare)]), r.peak.share >= 0.25);
  tile(t("rpSave"), r.advice.savePot > 0 ? I.pct(r.advice.savePot) : "–", r.advice.save ? t("rpSaveSub", [String(r.advice.save)]) : t("rpSaveNone"), r.advice.savePot >= 2);

  // Öneriler
  const hm = (h) => { const d = new Date(); d.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0); return d.toLocaleTimeString(I.locale, { hour: "2-digit", minute: "2-digit" }); };
  const tips = $("tips"); tips.replaceChildren();
  $("tipsTitle").textContent = t("rpTips");
  for (const tp of r.tips) {
    let params = tp.params.map(String);
    if (tp.key === "tip_peak") params = [String(tp.params[0]), `${hm(r.peakHours.start)}–${hm(r.peakHours.end)}`];
    if (tp.key === "tip_advice") params = [I.pct(tp.params[0]), String(tp.params[1])];
    if (tp.key === "tip_effort_over") params = [String(tp.params[0]), I.pct(tp.params[1])];
    if (tp.key === "tip_domain_save") params = [t(`dom_${tp.params[0]}`), String(tp.params[1])];
    const li = el("li", tp.key === "tip_good" ? "good" : "", t(tp.key, params));
    tips.append(li);
  }
  $("tipsSec").hidden = !r.tips.length;

  // Çubuklar
  const bars = (box, rows, name) => {
    box.replaceChildren();
    const max = Math.max(1e-9, ...rows.map((x) => x.share));
    for (const x of rows) {
      const row = el("div", "brow");
      const tr = el("div", "track"); const i = el("i"); i.style.width = `${(100 * x.share) / max}%`; tr.append(i);
      row.append(el("span", "name", name(x)), tr, el("span", "v", pctN(x.share)));
      row.title = `${name(x)}: ${x.n} · ${pctN(x.share)}`;
      box.append(row);
    }
  };
  $("famTitle").textContent = t("rpByModel");
  bars($("fam"), r.byFam, (x) => FAM[x.key] || x.key);
  $("typeTitle").textContent = t("rpByType");
  bars($("types"), r.byType, (x) => (x.key === "unknown" ? t("rpOther") : t(`type_${x.key}`)));

  // Alanlar (konu) ve alt başlıklar
  $("domTitle").textContent = t("rpByDomain");
  bars($("doms"), r.byDomain, (x) => (x.key === "unknown" ? t("rpOther") : t(`dom_${x.key}`)));
  const subs = $("subs"); subs.replaceChildren();
  for (const x of r.bySub.slice(0, 10)) {
    const [d, sb] = String(x.key).split("|");
    const lbl = d && sb ? t(`sub_${d}_${sb}`) : "";
    if (!lbl) continue;
    const sp = el("span"); sp.append(document.createTextNode(lbl + " "), el("b", "", pctN(x.share))); subs.append(sp);
  }
  $("domNote").textContent = t("rpDomainNote");
  // Effort ayarları
  $("effTitle").textContent = t("rpByEffort");
  bars($("effs"), r.byEffort, (x) => (x.key === "unknown" || x.key === "auto" ? t("rpOther") : t(`eff_${x.key}`)));
  $("effNote").textContent = r.effort.over ? t("rpEffOver", [String(r.effort.over), I.pct(r.effort.overPot)]) : t("rpEffOk");

  // Saat haritası
  $("heatTitle").textContent = t("rpHeat");
  const heat = $("heat"); heat.replaceChildren();
  const days = t("rpDays").split(",");
  heat.append(el("span"));
  for (let h = 0; h < 24; h++) heat.append(el("span", "hl", h % 3 === 0 ? String(h) : ""));
  const { start, end } = r.peakHours;
  const inPeak = (h) => (start <= end ? h + 0.5 > start && h + 0.5 < end : h + 0.5 > start || h + 0.5 < end);
  for (let d = 0; d < 7; d++) {
    heat.append(el("span", "dl", days[d] || ""));
    for (let h = 0; h < 24; h++) {
      const v = r.heat[d][h];
      const c = el("span", "c" + (d < 5 && inPeak(h) ? " pk" : ""));
      if (v > 0) c.style.background = `color-mix(in srgb, var(--accent) ${Math.round(18 + 82 * (v / Math.max(1, r.heatMax)))}%, var(--track))`;
      c.title = `${days[d]} ${String(h).padStart(2, "0")}:00 · ${v}`;
      heat.append(c);
    }
  }
  heat.setAttribute("aria-label", t("rpHeat"));
  $("heatNote").textContent = t("rpHeatPeak");


  // Öğrenme kanıtı: kendi ölçümlerinden, zamanla tahmin hatası düşüyor mu?
  const ln = r.learning, fx = (x) => (Math.round(x * 100) / 100).toLocaleString(I.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  $("learnTitle").textContent = t("rpLearn");
  const lc = $("learnChart"); lc.replaceChildren();
  if (ln.verdict === "few") {
    $("learnMsg").textContent = t("rpLearnFew", [String(ln.measured), String(Math.max(0, 30 - ln.measured))]);
    $("learnNote").textContent = "";
  } else {
    $("learnMsg").textContent = t(ln.verdict === "better" ? "rpLearnBetter" : ln.verdict === "worse" ? "rpLearnWorse" : "rpLearnSame", [fx(ln.first.factor), fx(ln.last.factor)]) +
      " " + t("rpLearnRange", [pctN(ln.first.inRange), pctN(ln.last.inRange)]);
    const maxF = Math.max(2, ...ln.curve.map((x) => x.factor));
    const bars = ln.curve.slice(-24);
    for (const [i, x] of bars.entries()) {
      const b = el("div", "lb");
      const h = Math.round(100 * (Math.log(x.factor) / Math.log(maxF)));
      const bar = el("i"); bar.style.height = Math.max(4, h) + "%";
      b.title = t("rpLearnBar", [String(x.from), String(x.to), fx(x.factor)]);
      b.append(bar, el("span", "", fx(x.factor)));
      lc.append(b);
    }
    lc.setAttribute("aria-label", t("rpLearn"));
    $("learnNote").textContent = t("rpLearnNote");
  }

  // En pahalı mesajlar
  $("topTitle").textContent = t("rpTop");
  const top = $("top"); top.replaceChildren();
  for (const x of r.top) {
    const li = el("li");
    const when = new Date(x.at).toLocaleString(I.locale, { weekday: "short", hour: "2-digit", minute: "2-digit" });
    li.append(el("strong", "", I.pct(x.spent)), document.createTextNode(" "),
      el("span", "meta", `${x.measured ? t("rpMeasured") : t("rpEstimated")} · ${when} · ${FAM[x.fam] || "?"}${x.eff && x.eff !== "auto" ? " (" + t(`eff_${x.eff}`) + ")" : ""} · ${t(`type_${x.type}`)}${x.dom && x.dom !== "general" ? " · " + t(`dom_${x.dom}`) : ""}`));
    if (x.reasons.length) { const w = el("div", "why"); for (const k of x.reasons) w.append(el("span", "", t(`cr_${k}`))); li.append(w); }
    top.append(li);
  }

  // İsabet
  $("accTitle").textContent = t("rpAcc");
  $("acc").textContent = r.accuracy.measured ? t("rpAccVal", [String(r.accuracy.measured), String(r.accuracy.inRange)]) : t("rpAccNone");
  $("measured").textContent = t("rpMeasuredShare", [pctN(r.measuredShare)]);
  $("privacy").textContent = t("rpPrivacy");
}

$("csv").addEventListener("click", async () => {
  const { sends = [] } = await chrome.storage.local.get("sends");
  const blob = new Blob([sendsCsv(sends)], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `token-tahmini-gonderimler-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});

chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && (ch.sends || ch.settings)) render(); });
render();
