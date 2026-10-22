// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Arka plan servisi (service worker).
// - Kullanım verisini düzenli okur, plan türünü belirler (adım 3).
// - Ücretsiz planda kullanım verisini cevap akışından alır (adım 3 eki).
// - Eşik bildirimleri, "limit yenilendi" bildirimi ve araç çubuğu rozeti (adım 8).
// - Kalibrasyon durumunun tek yazıcısıdır (adım 10).

import { readUsage, normalizeUsage, normalizeSse } from "./lib/usage.js";
import { observe, emptyState } from "./lib/calibrate.js";
import { makeI18n, clock } from "./lib/i18n.js";
import { applyFeedback } from "./lib/advisor.js";
import { applyEffortFeedback } from "./lib/effort.js";
import { trimSends, weeklyReport, nextWeeklyAt } from "./lib/report.js";
import { personalStep, decodeModel } from "./lib/learn.js";
import PACKED from "./lib/learn-weights.js";
let LMODEL = null;
const learnModel = () => (LMODEL ||= decodeModel(PACKED));

const ALARM = "usage-refresh";
const PERIOD_MIN = 5;
const WEEKLY_ALARM = "weekly-report";
const REPORT_URL = "popup/report.html";
export const DEFAULT_SETTINGS = { language: "auto", thresholds: [50, 75, 90], notifications: true, panel: true, memory: "auto", advisor: true, effortAdvice: true, tips: true, explain: true, weeklyReport: true };

const get = (k) => chrome.storage.local.get(k);
const set = (o) => chrome.storage.local.set(o);

async function settings() {
  const { settings: s } = await get("settings");
  return { ...DEFAULT_SETTINGS, ...(s || {}) };
}

chrome.runtime.onInstalled.addListener(async () => {
  const { settings: s, calib } = await get(["settings", "calib"]);
  await set({ settings: { ...DEFAULT_SETTINGS, ...(s || {}) }, ...(calib ? {} : { calib: emptyState() }) });
  chrome.alarms.create(ALARM, { periodInMinutes: PERIOD_MIN });
  scheduleWeekly();
  refresh();
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM, { periodInMinutes: PERIOD_MIN });
  scheduleWeekly();
  refresh();
});
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM) refresh();
  else if (a.name === WEEKLY_ALARM) weeklyNotify();
  else if (a.name.startsWith("reset:")) onReset(a.name.slice(6));
});

// ---------- Kullanım ----------
async function saveUsage(usage, source) {
  const { usage: prev, usageHist = [] } = await get(["usage", "usageHist"]);
  // Harcama hızı için kısa geçmiş (yalnızca yüzdeler): son 3 gün, en fazla 800 nokta
  const now = Date.now(), lastH = usageHist[usageHist.length - 1];
  const p5 = usage?.fiveHour?.pct ?? null;
  if (p5 !== null && (!lastH || lastH.p5 !== p5 || now - lastH.at > 4 * 60000)) {
    usageHist.push({ at: now, p5, r5: usage.fiveHour.resetsAt || null, p7: usage?.sevenDay?.pct ?? null });
    while (usageHist.length > 800 || (usageHist.length && usageHist[0].at < now - 3 * 864e5)) usageHist.shift();
  }
  await set({ usage, usageHist, usageMeta: { fetchedAt: now, source, error: null } });
  await afterUsage(prev, usage);
}

async function saveError(message) {
  const { usageMeta } = await get("usageMeta");
  await set({ usageMeta: { ...(usageMeta || {}), error: message, errorAt: Date.now() } });
}

let inFlight = null;
async function refresh() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const { orgId } = await get("orgId");
      const res = await readUsage({ orgId });
      const patch = {};
      if (res.orgId !== orgId) patch.orgId = res.orgId;
      if (res.tier) patch.tier = res.tier;
      if (Object.keys(patch).length) await set(patch);
      if (res.usage) await saveUsage(res.usage, "background");
      else await set({ usageMeta: { ...((await get("usageMeta")).usageMeta || {}), freePlanNoUsage: true, checkedAt: Date.now() } });
      return { ok: true };
    } catch (e) {
      await saveError(String(e?.message || e));
      return { ok: false, error: String(e?.message || e) };
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

// Cevap akışından gelen değer: daha yenidir, 5 saatlik ve haftalık pencereyi günceller.
async function mergeSse(messageLimit) {
  const fresh = normalizeSse(messageLimit);
  if (!fresh) return;
  const { usage: prev } = await get("usage");
  const merged = prev ? { ...prev, fiveHour: fresh.fiveHour || prev.fiveHour, sevenDay: fresh.sevenDay || prev.sevenDay } : fresh;
  const all = [merged.fiveHour, merged.sevenDay, ...(merged.extras || [])].filter(Boolean);
  merged.bottleneck = all.reduce((a, b) => (b.pct > a.pct ? b : a)).key;
  await saveUsage(merged, "stream");
}

// ---------- Uyarılar (adım 8) ----------
function windowsOf(u) {
  return [u?.fiveHour, u?.sevenDay, ...(u?.extras || [])].filter(Boolean);
}

async function afterUsage(prev, next) {
  const s = await settings();
  await updateBadge(next);
  const { notified = {} } = await get("notified");
  const now = Date.now();
  // eski kayıtları temizle
  for (const k of Object.keys(notified)) if (Number(k.split("@")[1]) < now - 864e5) delete notified[k];

  const i18n = await makeI18n(s.language);
  const ths = [...s.thresholds].filter((x) => x > 0 && x <= 100).sort((a, b) => a - b);
  for (const w of windowsOf(next)) {
    const key = `${w.key}@${w.resetsAt ? Math.round(w.resetsAt / 60000) * 60000 : 0}`;
    const crossed = ths.filter((th) => w.pct >= th).pop();
    if (crossed && (notified[key] || 0) < crossed) {
      notified[key] = crossed;
      if (s.notifications) {
        const name = w.key === "five_hour" ? i18n.t("sessionLimit") : w.key === "seven_day" ? i18n.t("weeklyLimit") : i18n.t("otherLimits");
        const when = w.resetsAt ? i18n.t("notifResets", [clock(w.resetsAt, i18n.locale)]) : "";
        notify(`th:${key}`, i18n.t("notifThresholdTitle", [name, String(Math.round(w.pct))]), `${i18n.t(crossed >= 90 ? "notifThresholdBodyHigh" : "notifThresholdBody")} ${when}`.trim());
      }
    }
    // Yenilenme alarmı: eşiklerden birini geçmiş her pencere için
    if (ths.length && w.pct >= ths[0] && w.resetsAt && w.resetsAt > now) {
      chrome.alarms.create(`reset:${w.key}`, { when: w.resetsAt + 30_000 });
    }
  }
  await set({ notified });
}

async function onReset(windowKey) {
  await refresh();
  const s = await settings();
  if (!s.notifications) return;
  const i18n = await makeI18n(s.language);
  const name = windowKey === "five_hour" ? i18n.t("sessionLimit") : windowKey === "seven_day" ? i18n.t("weeklyLimit") : i18n.t("otherLimits");
  notify(`reset:${windowKey}:${Date.now()}`, i18n.t("notifResetTitle", [name]), i18n.t("notifResetBody"));
}

function notify(id, title, message) {
  try {
    chrome.notifications.create(id, { type: "basic", iconUrl: chrome.runtime.getURL("icons/icon128.png"), title, message, priority: 1 });
  } catch (_) {}
}

async function updateBadge(u) {
  try {
    const w = u?.fiveHour;
    if (!w) { await chrome.action.setBadgeText({ text: "" }); return; }
    const top = windowsOf(u).reduce((a, b) => (b.pct > a.pct ? b : a));
    await chrome.action.setBadgeText({ text: String(Math.min(99, Math.round(w.pct))) });
    const color = top.pct >= 90 ? "#d0463b" : top.pct >= 75 ? "#d99a1b" : "#2e9e6a";
    await chrome.action.setBadgeBackgroundColor({ color });
  } catch (_) {}
}

// ---------- Haftalık rapor ----------
function scheduleWeekly() {
  chrome.alarms.get(WEEKLY_ALARM, (a) => {
    if (!a) chrome.alarms.create(WEEKLY_ALARM, { when: nextWeeklyAt(), periodInMinutes: 7 * 24 * 60 });
  });
}

async function weeklyNotify() {
  const s = await settings();
  if (!s.notifications || s.weeklyReport === false) return;
  const { sends = [] } = await get("sends");
  const r = weeklyReport(sends);
  if (!r.enough) return;
  const i18n = await makeI18n(s.language);
  const parts = [i18n.t("wkNotifMsgs", [String(r.n)]), i18n.t("wkNotifSpent", [(Math.round(r.sessionsEq * 10) / 10).toLocaleString(i18n.locale)])];
  if (r.peak.share >= 0.2) parts.push(i18n.t("wkNotifPeak", [String(Math.round(r.peak.share * 100))]));
  notify(`weekly:${Date.now()}`, i18n.t("wkNotifTitle"), parts.join(" · "));
}

chrome.notifications?.onClicked?.addListener((id) => {
  if (id.startsWith("weekly:")) chrome.tabs.create({ url: chrome.runtime.getURL(REPORT_URL) });
});

// Gönderim kayıtları (metin yok): haftalık rapor ve "beklenenden fazla" açıklaması için
let sendsQueue = Promise.resolve();
function sendsUpdate(fn) {
  sendsQueue = sendsQueue.then(async () => {
    const { sends = [] } = await get("sends");
    const out = fn(sends);
    await set({ sends: trimSends(sends) });
    return out;
  }).catch((e) => ({ ok: false, error: String(e) }));
  return sendsQueue;
}

// ---------- Kalibrasyon (adım 10) ----------
let calibQueue = Promise.resolve();
function calibObserve(list) {
  calibQueue = calibQueue.then(async () => {
    let { calib } = await get("calib");
    const results = [];
    for (const obs of list) {
      const r = observe(calib, obs);
      calib = r.state;
      results.push({ accepted: r.accepted, reason: r.reason });
    }
    await set({ calib });
    return results;
  });
  return calibQueue;
}

// ---------- Tanı günlüğü ----------
// Ölçüm hattının adımları (yalnızca adım adları ve sayılar). Son 60 kayıt tutulur.
let traceQueue = Promise.resolve();
function addTrace(entry) {
  traceQueue = traceQueue.then(async () => {
    const { trace = [] } = await get("trace");
    trace.push(entry);
    if (trace.length > 60) trace.splice(0, trace.length - 60);
    const patch = { trace };
    if (entry.step === "hook:hello") patch.hookHello = { at: entry.at, ...(entry.info || {}) };
    if (entry.step === "send:seen") patch.lastSend = entry.at;
    if (entry.step === "done:seen") patch.lastDone = { at: entry.at, ...(entry.info || {}) };
    await set(patch);
  }).catch(() => {});
  return traceQueue;
}

// ---------- Mesajlar ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  const reply = (p) => p.then(sendResponse, (e) => sendResponse({ ok: false, error: String(e) }));
  switch (msg?.type) {
    case "ping": sendResponse({ ok: true }); return false;
    case "usage:refresh": reply(refresh()); return true;
    case "usage:report": {
      const usage = normalizeUsage(msg.raw);
      const tasks = [];
      if (msg.orgId) tasks.push(set({ orgId: msg.orgId }));
      if (msg.tier) tasks.push(set({ tier: msg.tier }));
      if (usage) tasks.push(saveUsage(usage, "page"));
      reply(Promise.all(tasks).then(() => ({ ok: !!usage })));
      return true;
    }
    case "usage:sse": reply(mergeSse(msg.messageLimit).then(() => ({ ok: true }))); return true;
    case "trace": reply(addTrace({ step: String(msg.step || "").slice(0, 40), info: msg.info || null, at: msg.at || Date.now() }).then(() => ({ ok: true }))); return true;
    case "health:hook": reply(set({ hookHello: { at: msg.at || Date.now(), wrapped: msg.wrapped, seen: msg.seen } }).then(() => ({ ok: true }))); return true;
    case "health": reply(set({ pageHealth: { ...msg.page, at: msg.at || Date.now() } }).then(() => ({ ok: true }))); return true;
    case "calib:observe": reply(calibObserve(msg.list || [])); return true;
    case "log:send": {
      const e = msg.entry || {};
      reply(sendsUpdate((list) => { if (e.id && !list.some((x) => x.id === e.id)) list.push(e); return { ok: true }; }));
      return true;
    }
    case "log:done": {
      reply(sendsUpdate((list) => {
        const x = [...list].reverse().find((y) => y.id === msg.id);
        if (!x) return { ok: false };
        Object.assign(x, msg.patch || {});
        return { ok: true };
      }));
      return true;
    }
    case "learn:label": {
      // Kişisel düzeltme: kalibrasyon kuyruğundan geçer (tek yazıcı)
      calibQueue = calibQueue.then(async () => {
        const feats = Array.isArray(msg.feats) ? msg.feats.filter((f) => Array.isArray(f) && Number.isInteger(f[0]) && Number.isFinite(f[1])).slice(0, 4000) : [];
        if (!feats.length) return { ok: false };
        const { learnPersonal, learnFixes = {} } = await get(["learnPersonal", "learnFixes"]);
        const key = `${String(msg.from || "?").slice(0, 20)}>${String(msg.label).slice(0, 20)}`;
        learnFixes[key] = (learnFixes[key] || 0) + 1;
        await set({ learnPersonal: personalStep(learnModel(), learnPersonal, feats, String(msg.label)), learnFixes });
        return { ok: true };
      });
      reply(calibQueue); return true;
    }
    case "surprise": reply(set({ lastSurprise: msg.surprise || null }).then(() => ({ ok: true }))); return true;
    case "open:report": {
      const url = chrome.runtime.getURL(REPORT_URL);
      reply((async () => {
        const ctxs = await chrome.runtime.getContexts?.({ contextTypes: ["TAB"], documentUrls: [url] }).catch(() => []) || [];
        const open = ctxs.find((c) => c.tabId >= 0);
        if (open) await chrome.tabs.update(open.tabId, { active: true });
        else await chrome.tabs.create({ url });
        return { ok: true };
      })());
      return true;
    }
    case "open:details": {
      // Ayrıntı sayfası zaten açıksa ona geç, değilse yeni sekmede aç
      const url = chrome.runtime.getURL("popup/popup.html?view=tab");
      reply((async () => {
        // getContexts ek izin gerektirmeden eklentinin kendi açık sayfalarını bulur (Chrome 116+)
        const ctxs = await chrome.runtime.getContexts?.({ contextTypes: ["TAB"], documentUrls: [url] }).catch(() => []) || [];
        const open = ctxs.find((c) => c.tabId >= 0);
        if (open) {
          await chrome.tabs.update(open.tabId, { active: true });
          if (open.windowId >= 0) await chrome.windows.update(open.windowId, { focused: true }).catch(() => {});
        } else await chrome.tabs.create({ url, index: sender.tab ? sender.tab.index + 1 : undefined });
        return { ok: true };
      })());
      return true;
    }
    case "data:import": {
      // Yedeği geri yükle (tek yazıcı: kalibrasyon kuyruğundan geçer). Biçim popup'ta doğrulandı, burada yine kontrol edilir.
      calibQueue = calibQueue.then(async () => {
        const d = msg.data || {};
        if (!d.calib || d.calib.version !== emptyState().version || typeof d.calib.k !== "object") return { ok: false };
        const patch = { calib: d.calib };
        if (d.recPrefs && typeof d.recPrefs === "object") patch.recPrefs = d.recPrefs;
        if (d.settings && typeof d.settings === "object") patch.settings = { ...DEFAULT_SETTINGS, ...d.settings };
        if (d.learnPersonal && typeof d.learnPersonal === "object" && d.learnPersonal.w) patch.learnPersonal = d.learnPersonal;
        if (Array.isArray(d.sends)) patch.sends = trimSends(d.sends.filter((x) => x && Number.isFinite(x.at)));
        await set(patch);
        return { ok: true, measurements: d.calib.stats?.n || 0 };
      });
      reply(calibQueue); return true;
    }
    case "calib:reset": reply(set({ calib: emptyState(), recPrefs: null, learnPersonal: null, learnFixes: {} }).then(() => ({ ok: true }))); return true;
    case "advisor:feedback": {
      // Tek yazıcı: geri bildirim sırayla uygulanır
      calibQueue = calibQueue.then(async () => {
        const { recPrefs } = await get("recPrefs");
        const a = msg.adv || {};
        const next = a.target === "effort"
          ? applyEffortFeedback(recPrefs, { type: a.type, kind: a.ekind, good: !!msg.good })
          : applyFeedback(recPrefs, { type: a.type, kind: a.kind, tier: a.tier, curTier: a.curTier, good: !!msg.good });
        await set({ recPrefs: next });
        return { ok: true };
      });
      reply(calibQueue); return true;
    }
    case "notify:test": {
      reply(settings().then(async (s) => {
        const i18n = await makeI18n(s.language);
        notify(`test:${Date.now()}`, i18n.t("extName"), i18n.t("notifTestBody"));
        return { ok: true };
      }));
      return true;
    }
  }
  return false;
});
