// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Claude.ai kullanım verisini okuma ve sadeleştirme.
// Not: Bu uç noktalar resmi/belgelenmiş değil; Claude.ai'nin kendi sayfasının kullandığı iç API.
// Değişirse tek düzeltilecek yer bu dosya.

const BASE = "https://claude.ai/api";

// Plan tespiti (lugia19/Claude-Usage-Extension yöntemi): raven_type → Team; "claude_max" yeteneği
// + rate_limit_tier içinde "5x" → Max 5x, değilse Max 20x; "claude_pro" → Pro; aksi halde Free.
// Biçim tanınmıyorsa (capabilities dizi değil) null döner: plan "okunamadı" sayılır, ücretsiz varsayılmaz
// (yanlış plan, tahmini 8 kata kadar saptırır).
export function tierFromOrg(org) {
  if (!org || typeof org !== "object") return null;
  if (!Array.isArray(org.capabilities)) return org.raven_type ? "claude_team" : null;
  const caps = org.capabilities;
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

// Akla yatkın en büyük yüzde. Üstü (ya da eksi değer) ölçek/biçim değişmiş demektir: pencere "okunamadı" sayılır.
export const MAX_PCT = 200;

// resets_at: ISO metni (bugünkü biçim) ya da unix saniye/milisaniye (biçim değişirse)
function parseTime(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v > 1e12 ? v : v > 1e9 ? v * 1000 : null;
  if (typeof v !== "string" || !v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

function toWindow(key, w) {
  if (!w || typeof w !== "object") return null;
  const u = w.utilization;
  const pct = typeof u === "number" ? u : typeof u === "string" && u.trim() !== "" ? Number(u) : NaN;
  if (!Number.isFinite(pct) || pct < 0 || pct > MAX_PCT) return null;
  return { key, pct, resetsAt: parseTime(w.resets_at) };
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
    if (w) { extras.push(w); continue; }
    // Bilinmeyen biçim: pencereler bir alt nesnede olabilir ({ seven_day_models: { fable: {...} } }) → seven_day_models_fable
    if (value && typeof value === "object" && !Array.isArray(value) && !("utilization" in value)) {
      for (const [sub, v] of Object.entries(value)) {
        const ws = toWindow(`${key}_${sub}`.toLowerCase().replace(/[^a-z0-9_]+/g, "_"), v);
        if (ws) extras.push(ws);
      }
    }
  }
  return finalize({ fiveHour, sevenDay, extras });
}

// Model ailesine özel haftalık pencere. Kasım 2026'da Fable 5.2 lansman haftasında Pro ve standart Team
// koltuklarında Fable, haftalık limitin bir payıyla ("up to 50%") sınırlandı (support.claude.com/en/articles/17506494).
// claude.ai bunu hangi anahtarla döndürüyor bilinmiyor: önce bilinen adlar, sonra aile adını içeren her
// seven_day_* anahtarı (seven_day_fable_5_2, seven_day_models_fable …) kabul edilir.
// seven_day_opus Fable sayılmaz: Opus'un kendi penceresi olabilir. Gerçek cevapta Fable başka adla gelirse listeye ekle.
export const FAMILY_WINDOW_KEYS = {
  fable: ["seven_day_fable", "seven_day_fable_models", "seven_day_fable_5_2"],
  opus: ["seven_day_opus"],
  sonnet: ["seven_day_sonnet"],
  haiku: ["seven_day_haiku"]
};
export const FAMILY_SHARE_WARN_PCT = 80;

export function familyWindow(usage, family) {
  if (!family) return null;
  const extras = (usage?.extras || []).filter(Boolean);
  for (const k of FAMILY_WINDOW_KEYS[family] || []) {
    const w = extras.find((x) => x.key === k);
    if (w) return w;
  }
  const re = new RegExp(`^seven_day_(?:[a-z0-9]+_)*${family}(?:_|$)`);
  return extras.find((x) => re.test(x.key)) || null;
}

function finalize(u) {
  const all = [u.fiveHour, u.sevenDay, ...(u.extras || [])].filter(Boolean);
  if (all.length === 0) return null;
  let bottleneck = all[0];
  for (const w of all) if (w.pct > bottleneck.pct) bottleneck = w;
  return { ...u, extras: u.extras || [], bottleneck: bottleneck.key };
}

// Depodaki kullanım hâlâ gösterilebilir mi? Yanlış sayı göstermek en kötü durum olduğu için:
//  - yenilenme zamanı geçmiş pencere atılır (gerçek değer artık bilinmiyor: sıfırlanmış olabilir),
//  - son okuma denemesi başarısızsa ve veri USAGE_STALE_MS'den eskiyse hiçbir pencereye güvenilmez.
// Döner: gösterilebilir kullanım ya da null ("okunamadı"). meta = usageMeta { fetchedAt, error, errorAt }.
export const USAGE_STALE_MS = 20 * 60000;
export function liveUsage(usage, meta = null, now = Date.now()) {
  if (!usage || typeof usage !== "object") return null;
  const failed = !!(meta && meta.error && (meta.errorAt || 0) > (meta.fetchedAt || 0));
  if (failed && now - (meta.fetchedAt || 0) > USAGE_STALE_MS) return null;
  const ok = (w) => (w && typeof w === "object" && Number.isFinite(w.pct) && w.pct >= 0 && w.pct <= MAX_PCT && !(w.resetsAt && w.resetsAt <= now) ? w : null);
  return finalize({ fiveHour: ok(usage.fiveHour), sevenDay: ok(usage.sevenDay), extras: (Array.isArray(usage.extras) ? usage.extras : []).map(ok).filter(Boolean) });
}

// Cevap akışındaki message_limit → aynı biçim. utilization 0–1, resets_at unix saniye.
// "exceeded_limit" durumunda değer 0.98 gibi görünebilir; durum öncelikli (lugia19 gözlemi).
export function normalizeSse(messageLimit) {
  const win = (key, w) => {
    // utilization 0–1 beklenir; aralık dışı (ör. ölçek 0–100'e dönerse) → pencere okunamadı
    if (!w || typeof w !== "object" || typeof w.utilization !== "number" || !Number.isFinite(w.utilization)) return null;
    if (w.utilization < 0 || w.utilization > MAX_PCT / 100) return null;
    const pct = w.status === "exceeded_limit" ? 100 : Math.round(w.utilization * 10000) / 100;
    return { key, pct, resetsAt: parseTime(w.resets_at) };
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
