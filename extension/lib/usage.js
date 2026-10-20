// Claude.ai kullanım verisini okuma ve sadeleştirme.
// Not: Bu uç noktalar resmi/belgelenmiş değil; Claude.ai'nin kendi sayfasının kullandığı iç API.
// Değişirse tek düzeltilecek yer bu dosya.

const BASE = "https://claude.ai/api";

// Plan tespiti (lugia19/Claude-Usage-Extension yöntemi): raven_type → Team; "claude_max" yeteneği
// + rate_limit_tier içinde "5x" → Max 5x, değilse Max 20x; "claude_pro" → Pro; aksi halde Free.
export function tierFromOrg(org) {
  if (!org) return "claude_free";
  const caps = Array.isArray(org.capabilities) ? org.capabilities : [];
  if (org.raven_type) return "claude_team";
  if (caps.includes("claude_max")) return String(org.rate_limit_tier || "").includes("5x") ? "claude_max_5x" : "claude_max_20x";
  if (caps.includes("claude_pro")) return "claude_pro";
  return "claude_free";
}

export async function fetchOrg(fetchFn = fetch) {
  const res = await fetchFn(`${BASE}/organizations`, { credentials: "include" });
  if (!res.ok) throw new Error(`organizations ${res.status}`);
  const orgs = await res.json();
  if (!Array.isArray(orgs) || orgs.length === 0) throw new Error("no organizations");
  const chatOrg = orgs.find((o) => Array.isArray(o?.capabilities) && o.capabilities.includes("chat"));
  const org = chatOrg || orgs[0];
  if (!org?.uuid) throw new Error("organization without uuid");
  return { orgId: org.uuid, tier: tierFromOrg(org) };
}

export async function fetchOrgId(fetchFn = fetch) {
  return (await fetchOrg(fetchFn)).orgId;
}

export async function fetchRawUsage(orgId, fetchFn = fetch) {
  const res = await fetchFn(`${BASE}/organizations/${orgId}/usage`, { credentials: "include" });
  if (!res.ok) {
    const err = new Error(`usage ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function toWindow(key, w) {
  if (!w || typeof w !== "object") return null;
  const pct = Number(w.utilization);
  if (w.utilization === null || w.utilization === undefined || !Number.isFinite(pct)) return null;
  const resetsAt = w.resets_at ? Date.parse(w.resets_at) : NaN;
  return { key, pct: Math.max(0, pct), resetsAt: Number.isFinite(resetsAt) ? resetsAt : null };
}

// Ham yanıtı { fiveHour, sevenDay, extras[], bottleneck } biçimine çevirir.
// Ücretsiz planda /usage tüm alanları boş döndürür → null (yedek: cevap akışı, normalizeSse).
export function normalizeUsage(raw) {
  if (!raw || typeof raw !== "object") return null;
  const fiveHour = toWindow("five_hour", raw.five_hour);
  const sevenDay = toWindow("seven_day", raw.seven_day);
  const extras = [];
  for (const [key, value] of Object.entries(raw)) {
    if (key === "five_hour" || key === "seven_day") continue;
    if (!key.startsWith("seven_day_") && !key.startsWith("five_hour_")) continue;
    const w = toWindow(key, value);
    if (w) extras.push(w);
  }
  return finalize({ fiveHour, sevenDay, extras });
}

function finalize(u) {
  const all = [u.fiveHour, u.sevenDay, ...(u.extras || [])].filter(Boolean);
  if (all.length === 0) return null;
  let bottleneck = all[0];
  for (const w of all) if (w.pct > bottleneck.pct) bottleneck = w;
  return { ...u, extras: u.extras || [], bottleneck: bottleneck.key };
}

// Cevap akışındaki message_limit → aynı biçim. utilization 0–1, resets_at unix saniye.
// "exceeded_limit" durumunda değer 0.98 gibi görünebilir; durum öncelikli (lugia19 gözlemi).
export function normalizeSse(messageLimit) {
  const win = (key, w) => {
    if (!w || typeof w.utilization !== "number") return null;
    const pct = w.status === "exceeded_limit" ? 100 : Math.round(w.utilization * 10000) / 100;
    return { key, pct, resetsAt: w.resets_at ? w.resets_at * 1000 : null };
  };
  const ws = messageLimit?.windows || {};
  return finalize({ fiveHour: win("five_hour", ws["5h"]), sevenDay: win("seven_day", ws["7d"]), extras: [] });
}

export async function readUsage({ orgId, fetchFn = fetch } = {}) {
  let id = orgId, tier = null;
  if (!id) ({ orgId: id, tier } = await fetchOrg(fetchFn));
  let raw;
  try {
    raw = await fetchRawUsage(id, fetchFn);
  } catch (e) {
    if (orgId && (e.status === 403 || e.status === 404)) {
      ({ orgId: id, tier } = await fetchOrg(fetchFn));
      raw = await fetchRawUsage(id, fetchFn);
    } else throw e;
  }
  return { orgId: id, tier, usage: normalizeUsage(raw), raw };
}
