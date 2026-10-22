// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
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
  const nativeFetch = window.fetch;
  let origFetch = nativeFetch; // site fetch'i sonradan değiştirirse burası güncellenir (aşağıya bak)
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

  let sawCompletion = 0, probes = 0, perfSeen = 0;
  const perfPaths = new Set();
  // Tanı: sayfanın açtığı Worker'lar (gönderim worker'dan yapılıyorsa fetch kancası onu göremez)
  try {
    const OW = window.Worker;
    if (OW) window.Worker = new Proxy(OW, {
      construct(t, args) {
        try { post({ kind: "worker", path: new URL(String(args[0]), location.href).pathname.slice(0, 120) }); } catch (_) {}
        return Reflect.construct(t, args);
      }
    });
  } catch (_) {}
  // Döngü koruması: sitenin fetch'i "önceki fetch" olarak bizim sarmalayıcıyı çağırırsa, aynı adrese ait
  // iç içe çağrı doğrudan yerel fetch'e gider (sonsuz döngü olmaz, ilk çağrı zaten işlendi).
  const inflight = new Map();
  const wrapper = function (input, init) {
    let url = "";
    try { url = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url || ""; } catch (_) {}
    if (inflight.get(url) > 0) return nativeFetch.apply(window, arguments);
    inflight.set(url, (inflight.get(url) || 0) + 1);
    const release = () => { const n = (inflight.get(url) || 1) - 1; if (n > 0) inflight.set(url, n); else inflight.delete(url); };
    let out;
    try { out = wrapped(url, input, init, arguments); } catch (e) { release(); throw e; }
    Promise.resolve(out).then(release, release);
    return out;
  };
  const wrapped = function (url, input, init, args) {
    const m = url && COMPLETION_RE.exec(url);
    if (!m) {
      // Tanı: gönderim isteği beklediğimiz adrese uymuyor olabilir. Yalnızca yol (kimlikler maskeli) bildirilir.
      if (probes < 20 && !/\/assets\//.test(url) && /completion|append_message|\/messages?\b/i.test(url)) {
        probes++;
        try { post({ kind: "probe", path: new URL(url, location.href).pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ":id") }); } catch (_) {}
      }
      return origFetch.apply(window, args);
    }
    sawCompletion++;

    const id = `${Date.now()}-${++seq}`;
    post({ kind: "send", id, org: m[1], conv: m[2], retry: !!m[3], body: summarizeBody(init?.body), at: Date.now() });

    const p = origFetch.apply(window, args);
    p.then((res) => {
      try {
        const ct = res.headers.get("content-type") || "";
        if (res.ok && res.body && ct.includes("event-stream")) readStream(res.clone().body, id);
        else post({ kind: "done", id, error: res.status, at: Date.now() });
      } catch (_) {}
    }, () => post({ kind: "done", id, error: "network", at: Date.now() }));
    return p;
  };
  // claude.ai (ya da bir kütüphane) window.fetch'i sonradan kendi sürümüyle değiştirir; o zaman bizim sarmalayıcı
  // devreden çıkardı. Tanımlayıcıyla fetch'i kilitliyoruz: dışarıdan atanan her yeni fetch "içteki" fetch olur,
  // sayfanın gördüğü window.fetch hep bizim sarmalayıcı kalır ve istek yine bizden geçer.
  try {
    Object.defineProperty(window, "fetch", {
      configurable: true, enumerable: true,
      get() { return wrapper; },
      set(v) { if (typeof v === "function" && v !== wrapper) origFetch = v; }
    });
  } catch (_) { window.fetch = wrapper; }
  // Yedek tanı: fetch'i atlayan bir yol var mı? (yalnızca adres yolu, kimlikler maskeli)
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        // claude.ai'nin API adresleri (tekilleştirilmiş, en fazla 20): gönderim nereye gidiyor görmek için
        let pth = ""; try { pth = new URL(e.name).pathname; } catch (_) {}
        // Yalnızca mesaj gönderimiyle ilgili olabilecek adresler (günlüğü doldurmasın)
        if (!pth.startsWith("/api/") || perfSeen >= 10 || !/completion|append|message|stream|retry/i.test(pth)) continue;
        const masked = pth.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ":id");
        if (perfPaths.has(masked)) continue;
        if (true) {
          perfPaths.add(masked); perfSeen++;
          try { post({ kind: "perf", path: new URL(e.name).pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ":id"), via: e.initiatorType }); } catch (_) {}
        }
      }
    }).observe({ type: "resource", buffered: false });
  } catch (_) {}
  // İçerik betiği "ping" atınca kanca durumunu bildirir (fetch başkası tarafından değiştirilmiş mi?)
  window.addEventListener("message", (e) => {
    if (e.source !== window || e.data?.__tokenForecastCmd !== "ping") return;
    post({ kind: "hello", wrapped: window.fetch === wrapper, sawCompletion, at: Date.now() });
  });
  // Bazı kütüphaneler fetch.toString() ile yerel olup olmadığını kontrol eder
  try { wrapper.toString = () => origFetch.toString(); } catch (_) {}
})();
