// Arka plan servisi (service worker).
// - Kullanım verisini düzenli okur, plan türünü belirler (adım 3).
// - Ücretsiz planda kullanım verisini cevap akışından alır (adım 3 eki).
// - Eşik bildirimleri, "limit yenilendi" bildirimi ve araç çubuğu rozeti (adım 8).
// - Kalibrasyon durumunun tek yazıcısıdır (adım 10).

import { readUsage, normalizeUsage, normalizeSse } from "./lib/usage.js";
import { observe, emptyState } from "./lib/calibrate.js";
import { makeI18n, clock } from "./lib/i18n.js";

const ALARM = "usage-refresh";
const PERIOD_MIN = 5;
export const DEFAULT_SETTINGS = { language: "auto", thresholds: [50, 75, 90], notifications: true, panel: true, memory: "auto" };

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
  refresh();
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM, { periodInMinutes: PERIOD_MIN });
  refresh();
});
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM) refresh();
  else if (a.name.startsWith("reset:")) onReset(a.name.slice(6));
});

// ---------- Kullanım ----------
async function saveUsage(usage, source) {
  const { usage: prev } = await get("usage");
  await set({ usage, usageMeta: { fetchedAt: Date.now(), source, error: null } });
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
    case "calib:observe": reply(calibObserve(msg.list || [])); return true;
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
    case "calib:reset": reply(set({ calib: emptyState() }).then(() => ({ ok: true }))); return true;
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
