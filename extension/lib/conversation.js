// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// claude.ai sohbet verisini (iç API) okur ve token tahmini için sadeleştirir.
// Bu uç nokta belgelenmemiştir; alan adları lugia19/Claude-Usage-Extension projesinin
// gözlemlerinden (Ekim 2026) alınmıştır. Her alan isteğe bağlı kabul edilir: bir alan yoksa
// sessizce atlanır, gerekirse sayfa (DOM) okumaya geri dönülür.

import { estimateTokens, sumRanges } from "./tokens.js";
import { imageTokens, IMAGE_TIERS, pdfTokens } from "./attachments.js";

export function conversationIdFromPath(path = location.pathname) {
  const m = String(path).match(/\/chat\/([0-9a-f-]{36})/i);
  return m ? m[1] : null;
}

export async function fetchConversation(orgId, convId, fetchFn = fetch) {
  const url = `https://claude.ai/api/organizations/${orgId}/chat_conversations/${convId}` +
    "?tree=True&rendering_mode=messages&render_all_tools=true";
  const res = await fetchFn(url, { credentials: "include" });
  if (!res.ok) throw new Error(`conversation ${res.status}`);
  return res.json();
}

// Ağaç halindeki sohbetten, görünen dalı (current_leaf_message_uuid'den köke) seçer.
export function activeBranch(conv) {
  const msgs = Array.isArray(conv?.chat_messages) ? conv.chat_messages : [];
  if (!msgs.length) return [];
  const leaf = conv.current_leaf_message_uuid;
  const byId = new Map(msgs.map((m) => [m.uuid, m]));
  if (!leaf || !byId.has(leaf) || !msgs.some((m) => "parent_message_uuid" in m)) {
    return [...msgs].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  }
  const out = [];
  const seen = new Set();
  let cur = byId.get(leaf);
  while (cur && !seen.has(cur.uuid)) {
    seen.add(cur.uuid);
    out.push(cur);
    cur = byId.get(cur.parent_message_uuid);
  }
  return out.reverse();
}

function textOfContent(content) {
  const parts = [];
  const walk = (c) => {
    if (!c) return;
    if (typeof c === "string") { parts.push(c); return; }
    if (Array.isArray(c)) { c.forEach(walk); return; }
    if (typeof c !== "object") return;
    if (c.type === "thinking") return; // düşünme metni zaten verilmiyor; sayılmaz
    if (typeof c.text === "string") parts.push(c.text);
    if (c.type === "tool_use" && c.input) parts.push(JSON.stringify(c.input));
    if (c.type === "tool_result" && c.content) walk(c.content);
  };
  walk(content);
  return parts.join("\n");
}

function fileTokens(f) {
  const kind = f?.file_kind;
  if (kind === "image") {
    const a = f.preview_asset || f.thumbnail_asset || {};
    const w = a.image_width, h = a.image_height;
    if (w && h) {
      const low = imageTokens(w, h, IMAGE_TIERS.standard), high = imageTokens(w, h, IMAGE_TIERS.highRes);
      return { low, mid: Math.round((low + high) / 2), high };
    }
    return { low: 800, mid: 1500, high: 4784 };
  }
  if (kind === "document") {
    const d = f.document_asset || {};
    if (Number.isFinite(d.token_count)) return { low: d.token_count, mid: d.token_count, high: d.token_count };
    if (Number.isFinite(d.page_count)) {
      const r = pdfTokens(d.page_count);
      return { low: r.low, mid: 1570 * d.page_count, high: r.high };
    }
  }
  return { low: 0, mid: 0, high: 0 };
}

// Döner: { messages, tokens{low,mid,high}, lastActivityAt, model, lastAssistantText, lastHumanText }
export function summarizeConversation(conv, opts = {}) {
  const branch = activeBranch(conv);
  const parts = [];
  let lastActivityAt = 0, lastAssistantText = "", lastHumanText = "";
  let files = 0, unknownFiles = 0;
  for (const m of branch) {
    const t = textOfContent(m.content) || (typeof m.text === "string" ? m.text : "");
    parts.push(estimateTokens(t, opts));
    if (m.sender === "assistant") lastAssistantText = t; else lastHumanText = t;
    for (const a of m.attachments || []) {
      if (typeof a?.extracted_content === "string") { parts.push(estimateTokens(a.extracted_content, opts)); files++; }
    }
    for (const f of [...(m.files_v2 || m.files || [])]) {
      const ft = fileTokens(f);
      if (ft.high === 0) unknownFiles++; else files++;
      parts.push(ft);
    }
    const ts = Date.parse(m.updated_at || m.created_at || "");
    if (Number.isFinite(ts)) lastActivityAt = Math.max(lastActivityAt, ts);
  }
  return {
    messages: branch.length,
    tokens: sumRanges(...parts),
    files,
    unknownFiles,
    lastActivityAt: lastActivityAt || null,
    model: conv?.model || null,
    lastAssistantText,
    lastHumanText
  };
}
