// Açılır pencere: limitler, kalan limitle yapılabilecekler (adım 7), kalibrasyon (adım 10), ayarlar.
import { makeI18n, duration, clock } from "../lib/i18n.js";
import { capacity } from "../lib/forecast.js";
import { makeCalib } from "../lib/calibrate.js";

if (new URLSearchParams(location.search).get("view") === "tab") document.documentElement.classList.add("tab");
const DEFAULTS = { language: "auto", thresholds: [50, 75, 90], notifications: true, panel: true, memory: "auto" };
const $ = (id) => document.getElementById(id);
const store = chrome.storage.local;
let I = null;

async function data() {
  const r = await store.get(["usage", "usageMeta", "settings", "calib", "tier", "lastContext"]);
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
  $("lblLang").textContent = t("language"); $("optAuto").textContent = t("languageAuto");
  $("lblTh").textContent = t("thresholds");
  $("lblNotif").textContent = t("setNotif");
  $("lblPanel").textContent = t("setPanel");
  $("lblMem").textContent = t("setMemory"); $("memAuto").textContent = t("memAuto"); $("memOn").textContent = t("memOn"); $("memOff").textContent = t("memOff");
  $("testNotif").textContent = t("btnTestNotif");
  $("export").textContent = t("btnExport");
  $("resetCal").textContent = t("btnResetCal");
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
    for (const w of [usage.fiveHour, usage.sevenDay].filter(Boolean)) limits.append(limitRow(w, showB(w)));
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

  // Kalibrasyon
  const cs = calib.summary();
  $("calText").textContent = cs.measurements === 0 ? I.t("calNone")
    : cs.measurements < 3 ? I.t("calFew", [String(cs.measurements)])
    : I.t("calSome", [String(cs.measurements), cs.inRangePct === null ? "–" : String(cs.inRangePct)]);

  // Ayarlar
  $("lang").value = d.settings.language;
  d.settings.thresholds.forEach((v, i) => { const el = $(`th${i}`); if (el) el.value = v; });
  $("notif").checked = !!d.settings.notifications;
  $("panel").checked = !!d.settings.panel;
  $("memory").value = d.settings.memory === true ? "on" : d.settings.memory === false ? "off" : "auto";

  // Alt bilgi
  const meta = $("meta");
  if (usageMeta?.fetchedAt) {
    const ago = Date.now() - usageMeta.fetchedAt;
    meta.textContent = ago < 60000 ? I.t("updatedJustNow") : I.t("updatedAgo", [duration(I.t, ago)]);
    if (usageMeta.error && usageMeta.errorAt > usageMeta.fetchedAt) meta.textContent += " · " + I.t("staleWarning");
  } else meta.textContent = "";
}

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
  const d = await store.get(["calib", "settings", "tier", "usage", "lastContext"]);
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...d }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `token-tahmini-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});
$("refresh").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true; btn.classList.add("spin");
  await chrome.runtime.sendMessage({ type: "usage:refresh" });
  btn.disabled = false; btn.classList.remove("spin");
  render();
});

chrome.storage.onChanged.addListener((ch, area) => {
  if (area === "local" && (ch.usage || ch.usageMeta || ch.settings || ch.calib)) render();
});

if (document.documentElement.classList.contains("tab")) $("settings").open = true;
render();
chrome.runtime.sendMessage({ type: "usage:refresh" });
