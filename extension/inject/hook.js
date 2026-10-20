// Sayfa dünyasında (MAIN world) çalışır. claude.ai'nin mesaj gönderme isteğini ve cevap
// akışını (Server-Sent Events) dinler, ama hiçbir şeyi DEĞİŞTİRMEZ: orijinal yanıt aynen
// sayfaya döner, biz yalnızca kopyasını (clone) okuruz.
//
// Akıştan alınanlar (lugia19/Claude-Usage-Extension gözlemleri, Ağustos–Ekim 2026):
//   message_start.message.model  → bu cevabı hangi model verdi
//   content_block_delta text_delta → cevap metni (token saymak için; sayfadan dışarı çıkmaz)
//   message_limit.windows["5h"|"7d"] → { utilization (0–1), resets_at (unix sn), status }
// Akışta token sayısı ve düşünme metni YOKTUR.
//
// Bulunanlar aynı sayfadaki içerik betiğine window.postMessage ile iletilir.

(() => {
  if (window.__tokenForecastHook) return;
  window.__tokenForecastHook = true;

  const COMPLETION_RE = /\/api\/organizations\/([^/]+)\/chat_conversations\/([^/?#]+)\/(retry_)?completion(?:[?#]|$)/;
  const INTERESTING = /"(?:message_start|text_delta|message_limit|message_delta|message_stop)"/;
  const MAX_TEXT = 2 * 1024 * 1024;
  const origFetch = window.fetch;
  let seq = 0;

  const post = (payload) => {
    try { window.postMessage({ __tokenForecast: 1, ...payload }, location.origin); } catch (_) {}
  };

  function summarizeBody(body) {
    if (typeof body !== "string") return null;
    try {
      const j = JSON.parse(body);
      return {
        prompt: typeof j.prompt === "string" ? j.prompt : "",
        model: typeof j.model === "string" ? j.model : null,
        attachments: Array.isArray(j.attachments)
          ? j.attachments.map((a) => ({ name: a?.file_name || "", chars: (a?.extracted_content || "").length }))
          : [],
        files: Array.isArray(j.files) ? j.files.length : 0,
        keys: Object.keys(j).slice(0, 40)
      };
    } catch (_) { return null; }
  }

  async function readStream(stream, id) {
    const reader = stream.getReader();
    const dec = new TextDecoder();
    let buf = "", text = "", model = null, messageLimit = null, stopReason = null, truncated = false, aborted = false;
    const handle = (record) => {
      if (!INTERESTING.test(record)) return;
      const line = record.split("\n").find((l) => l.startsWith("data:"));
      if (!line) return;
      let j;
      try { j = JSON.parse(line.slice(5)); } catch (_) { return; }
      if (j.type === "message_start") model = j.message?.model || model;
      else if (j.type === "content_block_delta" && j.delta?.type === "text_delta") {
        if (text.length < MAX_TEXT) text += j.delta.text || ""; else truncated = true;
      } else if (j.type === "message_limit") messageLimit = j.message_limit || null;
      else if (j.type === "message_delta") stopReason = j.delta?.stop_reason || stopReason;
    };
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          handle(buf.slice(0, idx));
          buf = buf.slice(idx + 2);
        }
      }
      if (buf) handle(buf);
    } catch (_) {
      aborted = true; // kullanıcı durdurdu ya da bağlantı koptu
    }
    post({ kind: "done", id, model, text, truncated, messageLimit, stopReason, aborted, at: Date.now() });
  }

  window.fetch = function (input, init) {
    let url = "";
    try { url = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url || ""; } catch (_) {}
    const m = url && COMPLETION_RE.exec(url);
    if (!m) return origFetch.apply(window, arguments);

    const id = `${Date.now()}-${++seq}`;
    post({ kind: "send", id, org: m[1], conv: m[2], retry: !!m[3], body: summarizeBody(init?.body), at: Date.now() });

    const p = origFetch.apply(window, arguments);
    p.then((res) => {
      try {
        const ct = res.headers.get("content-type") || "";
        if (res.ok && res.body && ct.includes("event-stream")) readStream(res.clone().body, id);
        else post({ kind: "done", id, error: res.status, at: Date.now() });
      } catch (_) {}
    }, () => post({ kind: "done", id, error: "network", at: Date.now() }));
    return p;
  };
  // Bazı kütüphaneler fetch.toString() ile yerel olup olmadığını kontrol eder
  try { window.fetch.toString = () => origFetch.toString(); } catch (_) {}
})();
