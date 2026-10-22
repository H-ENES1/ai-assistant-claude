// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Açılır pencere: limitler, kalan limitle yapılabilecekler (adım 7), kalibrasyon (adım 10), ayarlar.
import { makeI18n, duration, clock, LANGS } from "../lib/i18n.js";
import { capacity } from "../lib/forecast.js";
import { makeCalib, CALIB_VERSION } from "../lib/calibrate.js";
import { SUPPORT_URL, CONTRIB_URL, FEEDBACK_URL } from "../lib/config.js";
import { isConsented } from "../lib/consent.js";
import { buildContribution, contributionText } from "../lib/contrib.js";
import { weeklyReport, burnRate } from "../lib/report.js";

if (new URLSearchParams(location.search).get("view") === "tab") document.documentElement.classList.add("tab");
const VIEW_KEYS = ["advisor", "effortAdvice", "tips", "explain"];
const DEFAULTS = { language: "auto", thresholds: [50, 75, 90], notifications: true, panel: true, memory: "auto", advisor: true, effortAdvice: true, tips: true, explain: true, weeklyReport: true };
const $ = (id) => document.getElementById(id);
const store = chrome.storage.local;
let I = null;

async function data() {
  const r = await store.get(["usage", "usageMeta", "settings", "calib", "tier", "lastContext", "trace", "hookHello", "lastSend", "lastDone", "pageHealth", "usageHist", "sends"]);
  return { ...r, settings: { ...DEFAULTS, ...(r.settings || {}) } };
}

function staticTexts() {
  const t = I.t;
  document.documentElement.lang = I.lang;
  $("title").textContent = t("popupTitle");
  document.title = t("detailsTitle");
  $("refresh").title = t("refresh"); $("refresh").setAttribute("aria-label", t("refresh"));
  $("capTitle").textContent = t("capTitle");
  $("calTitle").textContent = t("calTitle");
  $("setTitle").textContent = t("settings");
  $("healthTitle").textContent = t("healthTitle"); $("hHint").textContent = t("hHint");
  $("hLogTitle").textContent = t("hLogTitle"); $("copyLog").textContent = t("hCopyLog");
  $("lblLang").textContent = t("language"); $("optAuto").textContent = t("languageAuto");
  if ($("lang").options.length === 1) for (const [code, l] of Object.entries(LANGS)) { const o = document.createElement("option"); o.value = code; o.textContent = l.name; $("lang").append(o); }
  $("lblTh").textContent = t("thresholds");
  $("lblNotif").textContent = t("setNotif");
  $("lblPanel").textContent = t("setPanel");
  $("lblAdvisor").textContent = t("setAdvisor");
  $("lblEffortAdvice").textContent = t("setEffortAdvice"); $("lblTips").textContent = t("setTips"); $("lblExplain").textContent = t("setExplain");
  $("lblView").textContent = t("setView"); $("viewFull").textContent = t("viewFull"); $("viewSimple").textContent = t("viewSimple"); $("viewCustom").textContent = t("viewCustom"); $("viewNote").textContent = t("viewNote");
  $("lblWeekly").textContent = t("setWeekly");
  $("weekTitle").textContent = t("rpOpen"); $("openReport").textContent = t("rpOpenBtn");
  $("lblMem").textContent = t("setMemory"); $("memAuto").textContent = t("memAuto"); $("memOn").textContent = t("memOn"); $("memOff").textContent = t("memOff");
  $("testNotif").textContent = t("btnTestNotif");
  $("export").textContent = t("btnExport");
  $("import").textContent = t("btnImport");
  if (SUPPORT_URL) { $("support").href = SUPPORT_URL; $("support").textContent = t("supportLink"); $("supportRow").hidden = false; }
  $("resetCal").textContent = t("btnResetCal");
  $("comTitle").textContent = t("comTitle"); $("comText").textContent = t("comText");
  $("comBuild").textContent = t("comBuild"); $("comCopy").textContent = CONTRIB_URL ? t("comCopy") : t("comCopyOnly");
  if (FEEDBACK_URL) { $("feedback").href = FEEDBACK_URL; $("feedback").textContent = t("feedbackLink"); $("feedbackRow").hidden = false; }
  $("privacy").textContent = t("privacyNote");
}

const levelClass = (p) => (p >= 90 ? "crit" : p >= 75 ? "warn" : "ok");
function labelFor(key) {
  if (key === "five_hour") return I.t("sessionLimit");
  if (key === "seven_day") return I.t("weeklyLimit");
  const base = key.startsWith("five_hour_") ? I.t("sessionLimit") : I.t("weeklyLimit");
  const name = key.replace(/^(seven_day_|five_hour_)/, "").replace(/_/g, " ");
  return `${base} · ${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

function limitRow(w, isBottleneck) {
  const el = document.createElement("div");
  el.className = "limit" + (isBottleneck ? " bottleneck" : "");
  const head = document.createElement("div"); head.className = "limit-head";
  const name = document.createElement("span"); name.textContent = labelFor(w.key);
  const pct = document.createElement("strong"); pct.textContent = I.pct(w.pct);
  head.append(name, pct);
  const bar = document.createElement("div"); bar.className = "bar";
  bar.setAttribute("role", "progressbar"); bar.setAttribute("aria-valuenow", String(Math.round(w.pct))); bar.setAttribute("aria-valuemin", "0"); bar.setAttribute("aria-valuemax", "100");
  const fill = document.createElement("div"); fill.className = `fill ${levelClass(w.pct)}`; fill.style.width = `${Math.min(100, w.pct)}%`;
  bar.append(fill);
  el.append(head, bar);
  if (w.resetsAt) {
    const p = document.createElement("p"); p.className = "muted small";
    p.textContent = I.t("resetsIn", [duration(I.t, w.resetsAt - Date.now()), clock(w.resetsAt, I.locale)]);
    el.append(p);
  }
  if (isBottleneck) { const n = document.createElement("p"); n.className = "small note"; n.textContent = I.t("bottleneck"); el.append(n); }
  return el;
}

async function render() {
  const d = await data();
  I = await makeI18n(d.settings.language);
  staticTexts();
  const { usage, usageMeta } = d;
  const limits = $("limits");
  limits.replaceChildren();

  if (!usage) {
    const p = document.createElement("p"); p.className = "muted";
    p.textContent = usageMeta?.freePlanNoUsage ? I.t("freePlanWait") : usageMeta?.error ? I.t("fetchError") : I.t("noData");
    limits.append(p);
  } else {
    const showB = (w) => w.key === usage.bottleneck && w.pct >= 50;
    for (const w of [usage.fiveHour, usage.sevenDay].filter(Boolean)) {
      const row = limitRow(w, showB(w));
      // Harcama hızı: yalnızca 5 saatlik pencere için
      if (w === usage.fiveHour) {
        const b = burnRate(d.usageHist || []);
        if (b) {
          const p = document.createElement("p"); p.className = "small burn";
          p.textContent = b.idle ? I.t("burnIdle") : b.beforeReset ? I.t("burnEta", [clock(b.eta, I.locale), b.resetsAt ? clock(b.resetsAt, I.locale) : "?"]) : I.t("burnSafe");
          if (!b.idle && b.beforeReset) p.classList.add("note");
          row.append(p);
        }
      }
      limits.append(row);
    }
    if (usage.extras?.length) {
      const h = document.createElement("h2"); h.textContent = I.t("otherLimits"); limits.append(h);
      for (const w of usage.extras) limits.append(limitRow(w, showB(w)));
    }
  }

  // Kalan limitle yapılabilecekler
  const calib = makeCalib(d.calib);
  const ctx = d.lastContext || {};
  const capSec = $("capacity");
  if (usage) {
    const memoryOn = d.settings.memory !== false;
    const rows = capacity(usage, { model: ctx.model || "Sonnet 5.5", effort: ctx.effort, tier: d.tier || ctx.tier || "claude_pro", calib, memoryOn });
    const list = $("capList"); list.replaceChildren();
    for (const r of rows) {
      const li = document.createElement("li");
      const n = document.createElement("strong");
      n.textContent = r.count >= 500 ? "500+" : I.num(r.count);
      const s = document.createElement("span");
      s.textContent = " " + I.t(`cap_${r.key}`);
      li.append(n, s);
      if (r.count === 0) li.className = "zero";
      list.append(li);
    }
    $("capSub").textContent = I.t("capSub", [ctx.model ? ctx.model : "Sonnet 5.5"]);
    capSec.hidden = rows.length === 0;
  } else capSec.hidden = true;

  // Haftalık özet satırı
  const wr = weeklyReport(d.sends || []);
  $("week").hidden = !(d.sends || []).length;
  $("weekLine").textContent = wr.sessionsEq >= 1
    ? I.t("rpWeekLine", [String(wr.n), (Math.round(wr.sessionsEq * 10) / 10).toLocaleString(I.locale)])
    : I.t("rpWeekLinePct", [String(wr.n), I.pct(wr.spent)]);

  // Kalibrasyon
  const cs = calib.summary();
  $("calText").textContent = cs.measurements === 0 ? I.t("calNone")
    : cs.measurements < 3 ? I.t("calFew", [String(cs.measurements)])
    : I.t("calSome", [String(cs.measurements), cs.inRangePct === null ? "–" : String(cs.inRangePct)]);

  renderHealth(d);

  // Ayarlar
  $("lang").value = d.settings.language;
  d.settings.thresholds.forEach((v, i) => { const el = $(`th${i}`); if (el) el.value = v; });
  $("notif").checked = !!d.settings.notifications;
  $("panel").checked = !!d.settings.panel;
  $("advisor").checked = d.settings.advisor !== false;
  $("effortAdvice").checked = d.settings.effortAdvice !== false;
  $("tips").checked = d.settings.tips !== false;
  $("explain").checked = d.settings.explain !== false;
  { const ks = VIEW_KEYS.map((k) => d.settings[k] !== false); $("view").value = ks.every(Boolean) ? "full" : ks.every((x) => !x) ? "simple" : "custom"; $("viewCustom").hidden = $("view").value !== "custom"; }
  $("weekly").checked = d.settings.weeklyReport !== false;
  $("memory").value = d.settings.memory === true ? "on" : d.settings.memory === false ? "off" : "auto";

  // Alt bilgi
  const meta = $("meta");
  if (usageMeta?.fetchedAt) {
    const ago = Date.now() - usageMeta.fetchedAt;
    meta.textContent = ago < 60000 ? I.t("updatedJustNow") : I.t("updatedAgo", [duration(I.t, ago)]);
    if (usageMeta.error && usageMeta.errorAt > usageMeta.fetchedAt) meta.textContent += " · " + I.t("staleWarning");
  } else meta.textContent = "";
}

const fmtTime = (at) => new Date(at).toLocaleTimeString(I.locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const ago = (at) => (at ? duration(I.t, Date.now() - at) : null);

function renderHealth(d) {
  const t = I.t, tr = d.trace || [];
  const rows = [];
  const hh = d.hookHello, probe = [...tr].reverse().find((x) => x.step === "hook:probe");
  rows.push([t("hHook"), !hh ? "wait" : hh.wrapped ? "ok" : "bad", !hh ? t("hHookNoReply") : hh.wrapped ? `✓ (${hh.seen || 0})` : t("hHookReplaced")]);
  rows.push([t("hSend"), d.lastSend ? "ok" : probe ? "bad" : "wait", d.lastSend ? fmtTime(d.lastSend) : probe ? `${t("hProbe")}: ${probe.info?.path}` : t("hSendWait")]);
  const ld = d.lastDone;
  const ldOk = ld && (ld.sse || ld.via === "dom");
  rows.push([t("hDone"), !ld ? "wait" : ldOk ? "ok" : "bad", !ld ? t("hNone") : `${fmtTime(ld.at)} · ${ld.via === "dom" ? t("hDomPath") : ld.sse ? t("hSseYes") : t("hSseNo")}`]);
  const um = d.usageMeta;
  rows.push([t("hUsage"), um?.fetchedAt && !(um.error && um.errorAt > um.fetchedAt) ? "ok" : um?.fetchedAt ? "wait" : "bad", um?.fetchedAt ? `${ago(um.fetchedAt) || "0"} · ${um.source || ""}` : t("hNone")]);
  const ph = d.pageHealth;
  rows.push([t("hPage"), !ph ? "wait" : ph.composer && ph.model ? "ok" : "bad", !ph ? t("hNone") : [ph.composer ? "✓" : "✗", ph.model || "✗", ph.effort || "–"].join(" / ")]);
  const last = [...tr].reverse().find((x) => /^done:(observed|skip|window)$/.test(x.step));
  const obsOk = last && last.step === "done:observed" && (last.info?.results || []).includes("ok");
  rows.push([t("hLast"), !last ? "wait" : obsOk ? "ok" : "bad", !last ? t("hNone") : `${last.step.slice(5)} ${JSON.stringify(last.info || {}).slice(0, 80)}`]);
  const ul = $("healthList"); ul.replaceChildren();
  for (const [label, state, val] of rows) {
    const li = document.createElement("li"); li.className = state;
    const dot = document.createElement("span"); dot.className = "dot"; dot.textContent = state === "ok" ? "✓" : state === "bad" ? "✗" : "…";
    const l = document.createElement("span"); l.className = "lbl"; l.textContent = label;
    const v = document.createElement("span"); v.className = "val"; v.textContent = val;
    li.append(dot, l, v); ul.append(li);
  }
  $("traceLog").textContent = tr.slice(-25).map((x) => `${fmtTime(x.at)} ${x.step}${x.info ? " " + JSON.stringify(x.info) : ""}`).join("\n") || t("hNone");
}

$("copyLog").addEventListener("click", async () => {
  const d = await data();
  const text = `Token Forecast ${chrome.runtime.getManifest().version}\n` + (d.trace || []).map((x) => `${new Date(x.at).toISOString()} ${x.step}${x.info ? " " + JSON.stringify(x.info) : ""}`).join("\n") +
    `\nhook=${JSON.stringify(d.hookHello || null)} page=${JSON.stringify(d.pageHealth || null)} usageMeta=${JSON.stringify({ ...d.usageMeta, error: d.usageMeta?.error ? "yes" : null })}`;
  try { await navigator.clipboard.writeText(text); $("copyLog").textContent = I.t("hCopied"); setTimeout(() => ($("copyLog").textContent = I.t("hCopyLog")), 1500); } catch (_) {}
});

async function saveSettings(patch) {
  const { settings } = await store.get("settings");
  await store.set({ settings: { ...DEFAULTS, ...(settings || {}), ...patch } });
}

$("lang").addEventListener("change", (e) => saveSettings({ language: e.target.value }));
for (let i = 0; i < 3; i++) {
  $(`th${i}`).addEventListener("change", async () => {
    const vals = [0, 1, 2].map((j) => Math.round(Number($(`th${j}`).value))).filter((v) => v >= 1 && v <= 100);
    const uniq = [...new Set(vals)].sort((a, b) => a - b);
    await saveSettings({ thresholds: uniq.length ? uniq : DEFAULTS.thresholds });
  });
}
$("notif").addEventListener("change", (e) => saveSettings({ notifications: e.target.checked }));
$("panel").addEventListener("change", (e) => saveSettings({ panel: e.target.checked }));
$("advisor").addEventListener("change", (e) => saveSettings({ advisor: e.target.checked }));
$("effortAdvice").addEventListener("change", (e) => saveSettings({ effortAdvice: e.target.checked }));
$("tips").addEventListener("change", (e) => saveSettings({ tips: e.target.checked }));
$("explain").addEventListener("change", (e) => saveSettings({ explain: e.target.checked }));
// Görünüm: tek anahtarla tüm önerileri aç/kapat (tahmin ve limit uyarıları her zaman kalır)
$("view").addEventListener("change", (e) => {
  if (e.target.value === "custom") return;
  const on = e.target.value === "full";
  saveSettings(Object.fromEntries(VIEW_KEYS.map((k) => [k, on])));
});
$("weekly").addEventListener("change", (e) => saveSettings({ weeklyReport: e.target.checked }));
$("openReport").addEventListener("click", () => chrome.runtime.sendMessage({ type: "open:report" }));
$("memory").addEventListener("change", (e) => saveSettings({ memory: e.target.value === "on" ? true : e.target.value === "off" ? false : "auto" }));
$("testNotif").addEventListener("click", () => chrome.runtime.sendMessage({ type: "notify:test" }));
$("resetCal").addEventListener("click", async () => {
  if ($("resetCal").dataset.confirm !== "1") {
    $("resetCal").dataset.confirm = "1";
    $("resetCal").textContent = I.t("btnResetConfirm");
    return;
  }
  await chrome.runtime.sendMessage({ type: "calib:reset" });
  $("resetCal").dataset.confirm = "";
  render();
});
$("export").addEventListener("click", async () => {
  const d = await store.get(["calib", "settings", "tier", "usage", "lastContext", "recPrefs", "sends", "learnPersonal"]);
  const blob = new Blob([JSON.stringify({ format: "token-forecast-backup", formatVersion: 1, extVersion: chrome.runtime.getManifest().version, exportedAt: new Date().toISOString(), ...d }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `token-tahmini-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});
// İçe aktarma: dışa aktarılan yedeği geri yükler (eklentiyi kaldırıp kurunca öğrenilenler kaybolmasın)
let pendingImport = null;
const importMsg = (text, ok) => { const p = $("importMsg"); p.hidden = false; p.textContent = text; p.className = "small " + (ok ? "note-ok" : "note-bad"); };
$("import").addEventListener("click", () => {
  if (pendingImport) {
    chrome.runtime.sendMessage({ type: "data:import", data: pendingImport }, (r) => {
      pendingImport = null; $("import").textContent = I.t("btnImport");
      importMsg(r?.ok ? I.t("importDone", [String(r.measurements ?? 0)]) : I.t("importBad"), !!r?.ok);
      render();
    });
    return;
  }
  $("importFile").click();
});
$("importFile").addEventListener("change", async (e) => {
  const f = e.target.files?.[0]; e.target.value = "";
  if (!f) return;
  try {
    if (f.size > 5e6) throw new Error("size");
    const j = JSON.parse(await f.text());
    if (!j || typeof j !== "object" || !j.calib || j.calib.version !== CALIB_VERSION || typeof j.calib.k !== "object") throw new Error("format");
    pendingImport = { calib: j.calib, settings: j.settings || null, recPrefs: j.recPrefs || null, sends: Array.isArray(j.sends) ? j.sends : null, learnPersonal: j.learnPersonal || null };
    const n = j.calib.stats?.n || 0;
    $("import").textContent = I.t("btnImportConfirm");
    importMsg(I.t("importReady", [String(n), j.exportedAt ? new Date(j.exportedAt).toLocaleDateString(I.locale) : "?"]), true);
  } catch (_) { pendingImport = null; importMsg(I.t("importBad"), false); }
});

// Topluluk katkısı: önce göster, sonra kullanıcı isterse kopyala (otomatik gönderim yok)
let contribText = "";
$("comBuild").addEventListener("click", async () => {
  const d = await store.get(["calib", "sends", "recPrefs", "learnFixes", "tier", "settings"]);
  const c = buildContribution({ calib: d.calib, sends: d.sends || [], recPrefs: d.recPrefs, learnFixes: d.learnFixes, tier: d.tier || "claude_pro", extVersion: chrome.runtime.getManifest().version, lang: I.lang });
  const pre = $("comPreview");
  if (!Object.keys(c.k).length && !(c.acc.n > 0)) { pre.hidden = true; $("comCopy").hidden = true; $("comNote").hidden = false; $("comNote").textContent = I.t("comEmpty"); return; }
  contribText = contributionText(c);
  pre.textContent = JSON.stringify(c, null, 1); pre.hidden = false;
  $("comCopy").hidden = false; $("comNote").hidden = true;
});
$("comCopy").addEventListener("click", async () => {
  if (!contribText) return;
  try { await navigator.clipboard.writeText(contribText); } catch (_) {}
  $("comNote").hidden = false; $("comNote").textContent = CONTRIB_URL ? I.t("comCopied") : I.t("comNoUrl");
  if (CONTRIB_URL) chrome.tabs.create({ url: CONTRIB_URL });
});

$("refresh").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true; btn.classList.add("spin");
  await chrome.runtime.sendMessage({ type: "usage:refresh" });
  btn.disabled = false; btn.classList.remove("spin");
  render();
});

chrome.storage.onChanged.addListener((ch, area) => {
  if (area === "local" && (ch.usage || ch.usageMeta || ch.settings || ch.calib || ch.trace || ch.hookHello || ch.pageHealth || ch.sends)) render();
});

async function renderConsent() {
  const { consent } = await store.get("consent");
  const J = await makeI18n(((await store.get("settings")).settings || {}).language || "auto");
  const off = !isConsented(consent);
  $("consentBox").hidden = !off;
  if (off) { $("consentText").textContent = J.t("consentPopup"); $("consentBtn").textContent = J.t("consentPopupBtn"); }
}
$("consentBtn").addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("popup/welcome.html") }));
chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && (ch.consent || ch.settings)) renderConsent(); });

if (document.documentElement.classList.contains("tab")) { $("settings").open = true; $("health").open = true; }
renderConsent();
render();
chrome.runtime.sendMessage({ type: "usage:refresh" });
