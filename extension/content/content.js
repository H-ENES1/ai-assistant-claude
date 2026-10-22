// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// İçerik betiği: claude.ai sayfasında çalışır ve her şeyi birbirine bağlar.
//
//  sayfa ──(prompt, ekler, model, effort)──┐
//  sohbet API'si ──(geçmiş, son etkinlik)──┼─→ tahmin motoru ─→ panel
//  depo ──(kullanım, plan, kalibrasyon)────┘
//  sayfa kancası (inject/hook.js) ──(gönderim, cevap, message_limit)─→ kalibrasyon gözlemi
//
// Hiçbir metin cihazdan çıkmaz: tüm hesaplar burada, yerelde yapılır.

(() => {
  if (window.__tokenForecastLoaded) return;
  window.__tokenForecastLoaded = true;

  // Onay kapısı: kullanıcı karşılama sayfasında onay vermeden sayfada hiçbir şey okunmaz (lib/consent.js).
  const gate = async (start) => {
    const { isConsented } = await import(chrome.runtime.getURL("lib/consent.js"));
    const { consent, settings } = await chrome.storage.local.get(["consent", "settings"]);
    if (isConsented(consent)) { start(); return; }
    let chip = null;
    try {
      const { makeI18n } = await import(chrome.runtime.getURL("lib/i18n.js"));
      const I = await makeI18n(settings?.language || "auto");
      const host = document.createElement("div");
      host.id = "token-forecast-consent";
      host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483646";
      const root = host.attachShadow({ mode: "open" });
      root.innerHTML = '<style>button{font:600 12.5px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;color:#141413;background:#faf9f5;border:1px solid #d9d6cc;border-radius:999px;padding:8px 13px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.12)}button:hover{background:#fff}i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#d97757;margin-right:7px}</style><button type="button"><i></i></button>';
      const b = root.querySelector("button");
      b.append(I.t("consentChip"));
      b.addEventListener("click", () => { try { chrome.runtime.sendMessage({ type: "consent:open" }); } catch (_) {} });
      (document.body || document.documentElement).append(host);
      chip = host;
    } catch (_) {}
    const onCh = (ch, area) => {
      if (area !== "local" || !ch.consent || !isConsented(ch.consent.newValue)) return;
      chrome.storage.onChanged.removeListener(onCh);
      chip?.remove();
      start();
    };
    chrome.storage.onChanged.addListener(onCh);
  };

  gate(() => {

  const L = {};
  const loading = (async () => {
    const mod = (p) => import(chrome.runtime.getURL(p));
    [L.usage, L.tokens, L.page, L.att, L.ctx, L.cls, L.fc, L.cal, L.conv, L.i18n, L.panel, L.adv, L.rep, L.learn, L.dom] = await Promise.all([
      mod("lib/usage.js"), mod("lib/tokens.js"), mod("lib/page.js"), mod("lib/attachments.js"), mod("lib/context.js"),
      mod("lib/classify.js"), mod("lib/forecast.js"), mod("lib/calibrate.js"), mod("lib/conversation.js"),
      mod("lib/i18n.js"), mod("lib/panel.js"), mod("lib/advisor.js"), mod("lib/report.js"), mod("lib/learn.js"), mod("lib/domain.js")
    ]);
  })().catch((e) => { console.debug("[Token Forecast] yüklenemedi", e); try { chrome.runtime.sendMessage({ type: "trace", step: "load:error", info: { message: String(e?.message || e).slice(0, 160) }, at: Date.now() }); } catch (_) {} });

  // ---------- Durum ----------
  const S = {
    settings: { language: "auto", thresholds: [50, 75, 90], notifications: true, panel: true, memory: "auto", advisor: true, effortAdvice: true, tips: true, explain: true },
    recPrefs: null, bannerHidden: null, pillOffset: null,
    i18n: null, usage: null, tier: null, orgId: null, calib: null,
    conv: { id: null, summary: null, fetchedAt: 0, error: null },
    activity: {}, // sohbet → son gönderim zamanı (bu cihazda görülen)
    pending: [], limbo: null, nextId: 1,
    snapshots: new Map(), // hook id → gönderim anındaki tahmin
    last: null
  };
  const store = chrome.storage.local;

  async function loadState() {
    const r = await store.get(["settings", "usage", "tier", "orgId", "calib", "convActivity", "recPrefs", "lastSurprise", "learnPersonal", "pillOffset"]);
    S.pillOffset = r.pillOffset || null;
    S.learnPersonal = r.learnPersonal || null;
    S.recPrefs = r.recPrefs || null;
    S.surprise = r.lastSurprise || null;
    S.settings = { ...S.settings, ...(r.settings || {}) };
    S.usage = r.usage || null; S.tier = r.tier || null; S.orgId = r.orgId || null;
    S.calib = L.cal.makeCalib(r.calib);
    S.activity = r.convActivity || {};
    S.i18n = await L.i18n.makeI18n(S.settings.language);
  }

  chrome.storage.onChanged.addListener(async (ch, area) => {
    if (area !== "local") return;
    await loading;
    if (ch.usage) S.usage = ch.usage.newValue || null;
    if (ch.tier) S.tier = ch.tier.newValue || null;
    if (ch.orgId) S.orgId = ch.orgId.newValue || null;
    if (ch.calib) S.calib = L.cal.makeCalib(ch.calib.newValue);
    if (ch.recPrefs) S.recPrefs = ch.recPrefs.newValue || null;
    if (ch.lastSurprise) S.surprise = ch.lastSurprise.newValue || null;
    if (ch.learnPersonal) { S.learnPersonal = ch.learnPersonal.newValue || null; memo = null; }
    if (ch.pillOffset) { S.pillOffset = ch.pillOffset.newValue || null; const cur = panel?.getOffset?.(); if (panel && JSON.stringify(cur) !== JSON.stringify(S.pillOffset)) panel.setOffset(S.pillOffset); }
    if (ch.settings) {
      S.settings = { ...S.settings, ...(ch.settings.newValue || {}) };
      S.i18n = await L.i18n.makeI18n(S.settings.language);
    }
    schedule(50);
  });

  const send = (msg) => new Promise((res) => {
    try { chrome.runtime.sendMessage(msg, (r) => { void chrome.runtime.lastError; res(r); }); } catch (_) { res(null); }
  });

  // Tanı günlüğü: ölçüm hattının her adımını kaydeder (yalnızca adım adları ve sayılar; metin yok).
  const trace = (step, info) => send({ type: "trace", step, info: info || null, at: Date.now() });

  // ---------- Kullanım (adım 3) ----------
  async function ensureOrg() {
    if (S.orgId && S.tier) return S.orgId;
    const o = await L.usage.fetchOrg();
    S.orgId = o.orgId; S.tier = o.tier;
    await store.set({ orgId: o.orgId, tier: o.tier });
    return S.orgId;
  }
  async function readUsageNow() {
    const orgId = await ensureOrg();
    const raw = await L.usage.fetchRawUsage(orgId);
    send({ type: "usage:report", raw, orgId, tier: S.tier });
    return L.usage.normalizeUsage(raw);
  }
  async function periodicUsage() {
    try { await loading; await readUsageNow(); } catch (e) { console.debug("[Token Forecast] kullanım:", e?.message || e); }
  }
  setInterval(() => document.visibilityState === "visible" && periodicUsage(), 5 * 60 * 1000);

  // ---------- Sohbet verisi ----------
  let convTimer = null;
  function refreshConversation(delay = 0) {
    clearTimeout(convTimer);
    convTimer = setTimeout(async () => {
      const id = L.conv.conversationIdFromPath();
      if (!id) { S.conv = { id: null, summary: null, fetchedAt: 0, error: null }; schedule(0); return; }
      try {
        const orgId = await ensureOrg();
        const json = await L.conv.fetchConversation(orgId, id);
        if (L.conv.conversationIdFromPath() !== id) return; // bu arada sayfa değişti
        S.conv = { id, summary: L.conv.summarizeConversation(json, opts()), fetchedAt: Date.now(), error: null };
      } catch (e) {
        S.conv = { id, summary: null, fetchedAt: Date.now(), error: String(e?.message || e) };
      }
      schedule(0);
    }, delay);
  }
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      S.pending = []; S.limbo = null;
      refreshConversation(400);
    }
  }, 700);

  const opts = () => ({ fallbackTr: S.i18n?.lang === "tr" ? 0.5 : 0 });

  // ---------- Ekler (adım 4) ----------
  const PASTE_ATTACH_CHARS = 2000;
  async function addFiles(files) {
    if (!files?.length) return;
    await loading;
    for (const file of files) {
      const item = { id: S.nextId++, name: file.name || "", status: "analyzing", low: 0, mid: 0, high: 0, addedAt: Date.now() };
      S.pending.push(item);
      schedule(50);
      L.att.analyzeFile(file, opts()).then((r) => {
        Object.assign(item, r, { status: "done", mid: r.mid ?? Math.round(Math.sqrt(Math.max(1, r.low) * Math.max(1, r.high))) });
        schedule(50);
      });
    }
  }
  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el instanceof HTMLInputElement && el.type === "file") addFiles([...el.files]);
  }, true);
  document.addEventListener("drop", (e) => {
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) addFiles(files);
  }, true);
  document.addEventListener("paste", async (e) => {
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) { addFiles(files); return; }
    const text = e.clipboardData?.getData("text/plain") || "";
    if (text.length >= PASTE_ATTACH_CHARS) {
      await loading;
      const r = L.att.analyzePastedText(text, opts());
      S.pending.push({ id: S.nextId++, ...r, mid: Math.round((r.low + r.high) / 2), status: "done", pastedHead: text.slice(0, 60), addedAt: Date.now() });
    }
    schedule(300);
  }, true);

  function reconcileAttachments(chipCount, promptText) {
    S.pending = S.pending.filter((p) => !(p.kind === "pasted" && p.pastedHead && promptText.includes(p.pastedHead.slice(0, 40))));
    const settled = S.pending.filter((p) => Date.now() - p.addedAt > 1500);
    if (chipCount >= S.pending.length || settled.length === 0) return;
    if (chipCount === 0) { S.pending = []; return; }
    const composerText = L.page.getComposer()?.innerText || "";
    const byName = S.pending.filter((p) => p.name && composerText.includes(p.name.slice(0, 12)));
    S.pending = byName.length === chipCount ? byName : S.pending.slice(-chipCount);
  }

  // ---------- Hesap ----------
  let domHistCache = { key: "", est: null, count: 0 };
  function domHistory() {
    const h = L.page.readHistory();
    const all = [...h.user, ...h.assistant];
    const key = all.length + ":" + all.reduce((s, x) => s + x.length, 0);
    if (key !== domHistCache.key) domHistCache = { key, est: L.tokens.estimateConversation(all, opts()), count: all.length };
    return domHistCache;
  }

  function historyInput() {
    const id = L.conv.conversationIdFromPath();
    const local = id ? S.activity[id] || null : null;
    if (id && S.conv.id === id && S.conv.summary) {
      const s = S.conv.summary;
      return { source: "api", messages: s.messages, tokens: s.tokens, lastActivityAt: Math.max(s.lastActivityAt || 0, local || 0) || null, files: s.files, model: s.model };
    }
    const d = domHistory();
    return { source: "dom", messages: d.count, tokens: d.est || { low: 0, mid: 0, high: 0 }, lastActivityAt: local, files: 0 };
  }

  let memo = null;
  function compute() {
    if (!S.i18n || !S.calib) return null;
    if (!L.page.isConversationPage()) return null;
    const prompt = L.page.readPrompt();
    reconcileAttachments(L.page.readAttachments().count, prompt.text);
    const attKey = S.pending.map((p) => `${p.id}:${p.status}`).join(",");
    // Metin ve ekler değişmediyse token sayımı ve sınıflandırma tekrarlanmaz
    if (!memo || memo.text !== prompt.text || memo.attKey !== attKey || memo.lang !== S.i18n.lang) {
      let cls0 = L.cls.classify(prompt.text, { attachments: S.pending, personal: S.learnPersonal });
      // Mesaj Türkçe ya da İngilizce değilse iş türü ve alan tespiti güvenilmez: nötr varsayım kullan, öneri gösterme
      const langLimited = ["other", "cyrillic", "cjk"].includes(L.tokens.textLanguage(prompt.text));
      let dom0 = L.dom.detectDomain(prompt.text, cls0);
      if (langLimited) { cls0 = { ...cls0, type: "explain", confidence: "low", complexity: Math.min(cls0.complexity || 0, 0.15), langLimited: true }; dom0 = { domain: "general" }; }
      memo = {
        text: prompt.text, attKey, lang: S.i18n.lang,
        pt: L.tokens.estimateTokens(prompt.text, opts()),
        cls: cls0,
        dom: dom0
      };
    }
    const pt = memo.pt, cls = memo.cls, dom = memo.dom;
    const att = L.tokens.sumRanges(...S.pending);
    const analyzing = S.pending.some((x) => x.status === "analyzing");
    const hist = historyInput();
    const model = L.page.detectModel() || hist.model || "Sonnet 5.5";
    const effort = L.page.detectEffort();
    const tier = S.tier || "claude_pro";
    const memoryOn = S.settings.memory === "auto" ? true : !!S.settings.memory;
    const input = { promptTokens: pt, attachmentTokens: att, history: hist, model, effort, tier, cls, calib: S.calib, memoryOn };
    const fc = L.fc.forecastMessage(input);
    const fit = L.fc.fitCheck(fc, S.usage);
    const rec = L.fc.recommendModel(fc, L.cls.recommendTier(cls), input);
    const ctxLevel = L.ctx.contextLevel({ low: fc.context.usedLow, high: fc.context.used }, fc.context.window);
    const empty = !prompt.text && !S.pending.length;
    let adv = null;
    try {
      adv = L.adv.advise({ cls, dom, fc, currentModel: model, effort: fc.effort, effortAssumed: fc.effortAssumed,
        historyTokens: hist.tokens?.mid || 0, cacheWarm: fc.cache === "warm",
        attachmentTokens: att.mid || 0, prefs: S.recPrefs, analyzing, emptyPrompt: empty });
    } catch (e) { console.debug("[Token Forecast] öneri", e); }
    if (cls.langLimited) adv = null; // bu dilde model/effort önerisi yok
    if (adv && S.settings.effortAdvice === false) adv = { ...adv, effort: null }; // effort önerisi kapalı
    const r = { at: Date.now(), prompt, pt, att, analyzing, hist, cls, dom, input, fc, fit, rec, ctxLevel, adv, empty, langLimited: !!cls.langLimited };
    S.last = r;
    if (!r.empty) S.lastFull = r;
    window.__tokenForecastLast = r;
    rememberContext(model, effort, tier);
    return r;
  }

  let ctxSavedAt = 0, ctxSaved = "";
  function rememberContext(model, effort, tier) {
    const k = `${model}|${effort}|${tier}`;
    if (k === ctxSaved && Date.now() - ctxSavedAt < 60000) return;
    ctxSaved = k; ctxSavedAt = Date.now();
    store.set({ lastContext: { model, effort, tier, at: Date.now(), memoryOn: S.settings.memory !== false } });
  }

  // ---------- Panel görünümü ----------
  let panel = null;
  function viewModel(r) {
    const { t, num, pct } = S.i18n;
    const fc = r.fc;
    const sess = fc.pct.session, week = fc.pct.weekly;
    const range = (p) => (p.high < 0.1 ? t("lessThan", [pct(0.1)]) : `${pct(p.low)}–${pct(p.high)}`);
    const warnings = [];

    // 1) Sığar mı?
    for (const w of r.fit.windows) {
      if (w.status === "ok") continue;
      const name = w.window === "session" ? t("sessionLimit") : t("weeklyLimit");
      const when = w.resetsAt ? t("resetsIn", [L.i18n.duration(t, w.resetsAt - Date.now()), L.i18n.clock(w.resetsAt, S.i18n.locale)]) : "";
      warnings.push({ sev: w.status === "no" ? "crit" : "warn", text: t(w.status === "no" ? "warnNoFit" : "warnMaybeFit", [name, pct(w.remaining)]) + (when ? " " + when + "." : "") });
    }
    // 2) Bağlam penceresi
    if (r.ctxLevel.level !== "ok") {
      const big = S.pending.some((p) => p.high > 100_000);
      warnings.push({ sev: r.ctxLevel.level === "over" ? "crit" : "warn", text: t(r.ctxLevel.level === "over" ? "ctxOver" : "ctxNear") + (big && S.tier !== "claude_free" ? " " + t("ctxWorkspace") : "") });
    }
    for (const it of S.pending) {
      if (it.detail?.tooLarge) warnings.push({ sev: "crit", text: t("pdfTooLarge") });
      else if (it.detail?.textOnly) warnings.push({ sev: "info", text: t("pdfTextOnly") });
    }
    // 3) Önbellek ve sohbet ipuçları (Ayarlar → "İpuçları"; kapalıysa gösterilmez)
    const tipsOn = S.settings.tips !== false;
    const histMid = r.hist.tokens.mid || 0;
    if (!tipsOn) { /* ipuçları kapalı */ } else if (fc.cache === "cold" && histMid > 5000) {
      warnings.push({ sev: "warn", text: t("warnCacheCold", [String(Math.round(fc.minutesSince)), num(histMid)]) });
    } else if (fc.cache === "unknown" && histMid > 20000) {
      warnings.push({ sev: "info", text: t("warnCacheUnknown", [num(histMid)]) });
    }
    if (tipsOn && histMid > 150_000) warnings.push({ sev: "info", text: t("tipNewChat", [num(histMid)]) });
    // 3b) Devir özeti: uzun sohbette yeni sohbete geçmek için Claude'dan kısa özet iste (metin yerelde kopyalanır)
    if (tipsOn && histMid > 60_000 && !r.empty) {
      warnings.push({ sev: "tip", text: t(fc.cache === "warm" ? "tipHandoffWarm" : "tipHandoff", [num(histMid)]), action: { label: t("btnHandoff"), copy: t("handoffPrompt"), done: t("hCopied") } });
    }
    // 4) Yoğun saat
    if (tipsOn && fc.peak) {
      // Yoğun saatler hafta içi 05:00–11:00 Pasifik; kullanıcının yerel saatine çevrilir
      const pw = L.fc.peakWindow();
      const d0 = new Date(pw.start), d1 = new Date(pw.end);
      const hm = (d) => d.toLocaleTimeString(S.i18n.locale, { hour: "2-digit", minute: "2-digit" });
      const leftMs = pw.end - Date.now();
      warnings.push({ sev: "info", text: t("warnPeak", [hm(d0), hm(d1)]) + (leftMs > 0 ? " " + t("peakLeft", [L.i18n.duration(t, leftMs)]) : "") });
    }
    // 4b) Son mesaj beklenenden çok fazla harcadıysa nedenini açıkla (30 dk gösterilir)
    const sp = S.surprise;
    if (S.settings.explain !== false && sp && Date.now() - sp.at < 30 * 60000) {
      const why = (sp.reasons || []).map((k) => t(`cr_${k}`)).filter(Boolean).join("; ");
      warnings.push({ sev: "warn", text: t("warnSurprise", [pct(sp.d), `${pct(sp.lo)}–${pct(sp.hi)}`, why]) });
    }
    if (r.langLimited && !r.empty) warnings.push({ sev: "info", text: t("warnLangLimited") });
    // 5) Model ve effort önerisi
    const a = r.adv;
    const modelAdvOn = S.settings.advisor !== false;
    if (!modelAdvOn) { /* model önerisi kapalı */ }
    else if (a?.kind === "save") warnings.push({ sev: "tip", text: t("advSave", [a.suggested]) + " · " + t("advSaveDetail", [pct(a.curPct), a.suggested, pct(a.sugPct), String(Math.round(a.savingFrac * 100))]) });
    else if (a?.kind === "save_next") warnings.push({ sev: "info", text: t("advSaveNext", [a.suggested]) });
    else if (a?.kind === "upgrade") warnings.push({ sev: "info", text: t("advUpgrade", [a.current, a.suggested]) });
    const ef = a?.effort;
    if (ef?.kind === "lower") warnings.push({ sev: "tip", text: t("effLowerX", [t(`eff_${ef.to}`), ef.savedPct > 0 ? pct(ef.savedPct) : "–"]) + (ef.assumed ? " " + t("effAssumedNote", [t(`eff_${ef.from}`)]) : "") });
    else if (ef?.kind === "raise") warnings.push({ sev: "info", text: t("effRaiseX", [t(`eff_${ef.to}`)]) });

    const level = warnings.some((w) => w.sev === "crit") ? "crit" : warnings.some((w) => w.sev === "warn") ? "warn" : "ok";
    const used = S.usage?.fiveHour?.pct ?? null;
    const typeName = t(`type_${r.cls.type}`);
    const conf = t(fc.confidence === "high" ? "confidenceHigh" : fc.confidence === "medium" ? "confidenceMedium" : "confidenceLow");
    const tokRange = (x) => (Math.round(x.low) === Math.round(x.high) ? num(x.high) : `${num(x.low)}–${num(x.high)}`);
    const inTokens = { low: r.pt.low + r.att.low, high: r.pt.high + r.att.high };

    const rows = [
      [t("rowWeekly"), range(week)],
      [t("rowType"), r.langLimited ? t("typeNA") : `${typeName} · ${conf}`],
      ...(r.langLimited ? [] : [[t("rowDomain"), domainLabel(r.dom)]]),
      [t("rowModel"), `${fc.model ? S.i18n.t("modelName", [cap(fc.model)]) : "?"}${fc.effort !== "auto" ? " · " + t(`effort_${fc.effort}`) + (fc.effortAssumed ? " " + t("effDefaultMark") : "") : ""}`],
      [t("rowInput"), tokRange(inTokens) + " " + t("dbgTokens")],
      [t("rowOutput"), `${num(fc.output.low)}–${num(fc.output.high)} ${t("dbgTokens")}`]
    ];
    const detail = [];
    if (r.att.high > 0 || r.analyzing) detail.push([t("dbgAttachments"), r.analyzing ? t("dbgAnalyzing") : `${S.pending.length} · ${tokRange(r.att)}`]);
    if (r.hist.messages) {
      detail.push([t("dbgHistory"), `${t("dbgMessages", [String(r.hist.messages)])} · ${tokRange(r.hist.tokens)}`]);
      const left = fc.cache === "warm" && fc.minutesSince !== null ? Math.max(1, Math.round(60 - fc.minutesSince)) : null;
      detail.push([t("rowCache"), left !== null ? t("cacheWarmLeft", [String(left)]) : fc.cache === "cold" && fc.minutesSince !== null ? t("cacheColdAgo", [L.i18n.duration(t, fc.minutesSince * 60000)]) : t(`cache_${fc.cache}`)]);
    }
    detail.push([t("rowContext"), `${pct(100 * r.ctxLevel.highPct)} / ${num(fc.context.window / 1000)}K`]);
    const cs = S.calib.summary();
    const foot = cs.measurements >= 3
      ? t("footCalibrated", [String(cs.measurements), cs.inRangePct === null ? "–" : String(cs.inRangePct)])
      : t("footLearning");

    return {
      level,
      head: r.empty ? t("pillIdle") : `≈ ${pct(sess.mid)}`,
      sub: r.empty ? (used !== null ? t("pillUsed", [pct(used)]) : "") : `(${range(sess)}) ${t("pillSub")}`,
      title: t("extName"),
      cardTitle: t("cardTitle"),
      big: r.empty ? (used !== null ? pct(used) : "–") : `≈ ${pct(sess.mid)}`,
      bigSub: r.empty ? t("cardIdleSub") : t("cardSub", [range(sess)]),
      bar: used !== null ? { used, est: r.empty ? 0 : sess.mid } : null,
      warnings, rows: r.empty ? rows.slice(0, 1).concat(rows.slice(3, 4)) : rows, detail, foot,
      breakdown: r.empty ? null : {
        label: t("bdTitle"),
        parts: ["output", "thinking", "input", "history", "tool"].map((k) => ({ key: k, share: fc.breakdown?.[k] || 0, label: t(`bd_${k}`), pctText: t("pct", [String(Math.round(100 * (fc.breakdown?.[k] || 0)))]) })).filter((p) => p.share >= 0.005)
      },
      closeLabel: t("close"),
      moreLabel: t("moreDetails"),
      dragTitle: t("pillDragTitle"),
      resetLabel: t("pillReset")
    };
  }
  const cap = (s) => String(s).replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  // "Bilim · Fizik" (+ ikinci alan)
  function domainLabel(d) {
    const { t } = S.i18n;
    if (!d || d.domain === "general") return t("dom_general");
    let s = t(`dom_${d.domain}`) + (d.sub ? " · " + t(`sub_${d.domain}_${d.sub}`) : "");
    if (d.second) s += " + " + t(`dom_${d.second}`);
    return s;
  }

  // ---------- Model + effort önerisi bildirimi ----------
  const advKey = (a) => `${a.type}|${a.kind}|${a.tier}|${a.curTier}|${a.effort?.kind || ""}|${a.effort?.to || ""}`;
  function bannerVM(r) {
    const a = r.adv;
    if (!a || S.settings.advisor === false || r.empty) return null;
    if (S.bannerHidden && S.bannerHidden === advKey(a)) return null;
    const { t, pct, num } = S.i18n;
    const ef = a.effort || null;
    const effName = (l) => t(`eff_${l}`);
    let tone = { save: "save", save_next: "next", upgrade: "up", ok: "ok" }[a.kind];
    let icon = { save: "↓", save_next: "i", upgrade: "↑", ok: "✓" }[a.kind];
    let title, detail = "", target = a.kind === "ok" ? null : "model";
    if (a.kind === "save") { title = t("advSave", [a.suggested]); detail = t("advSaveDetail", [pct(a.curPct), a.suggested, pct(a.sugPct), String(Math.round(a.savingFrac * 100))]); }
    else if (a.kind === "save_next") { title = t("advSaveNext", [a.suggested]); detail = t("advSaveNextDetail", [num(a.switchExtraTokens), a.suggested]); }
    else if (a.kind === "upgrade") { title = t("advUpgrade", [a.current, a.suggested]); detail = t("advUpgradeDetail", [a.suggested, (1 + a.extraFrac).toFixed(1).replace(/\.0$/, ""), a.current]); }
    else { title = t("advOk", [a.current]); detail = a.tinySaving ? t("advOkTiny", [a.tinySaving.model, pct(a.tinySaving.savedPct)]) : ""; }
    // Effort: model uygunsa effort önerisi başlığa çıkar; model değişecekse önerilen effort başlığa eklenir
    if (ef?.kind === "with_switch") title += " · " + t("advEffWith", [effName(ef.to)]);
    else if (a.kind === "ok" && ef?.kind === "lower") {
      tone = "save"; icon = "↓"; target = "effort";
      title = t("advEffLowerTitle", [effName(ef.to), ef.savedPct > 0 ? pct(ef.savedPct) : "–"]);
      detail = t("advEffLowerDetail", [effName(ef.from) + (ef.assumed ? " " + t("effDefaultMark") : ""), effName(ef.to), ef.saving != null ? String(Math.round(ef.saving * 100)) : "–"]);
    } else if (a.kind === "ok" && ef?.kind === "raise") {
      tone = "up"; icon = "↑"; target = "effort";
      title = t("advEffRaiseTitle", [effName(ef.to)]);
      detail = t("advEffRaiseDetail", [effName(ef.from) + (ef.assumed ? " " + t("effDefaultMark") : ""), effName(ef.to), ef.extra != null ? String(Math.round(ef.extra * 100)) : "–"]);
    } else if (a.kind === "ok" && ef?.kind === "ok") title += " · " + t("advEffWith", [effName(ef.to)]);
    else if (a.kind !== "ok" && ef?.kind === "lower") detail += (detail ? " " : "") + t("advEffAlsoLower", [effName(ef.to)]);

    const conf = t(a.confidence === "high" ? "confidenceHigh" : a.confidence === "medium" ? "confidenceMedium" : "confidenceLow");
    const fixOpts = L.cls.TYPES.filter((x) => x !== a.type).map((x) => ({ value: x, label: t(`type_${x}`) }));
    const sections = [
      { label: t("advDetected"), text: t("advDetectedVal", [t(`type_${a.type}`), t(`level_${a.level}`), conf]), fix: S.fixDone === advKey(a) ? { done: true, thanks: t("advRelabelThanks") } : { label: t("advRelabel"), options: fixOpts, thanks: t("advRelabelThanks") } }
    ];
    if (a.domain && a.domain.domain !== "general") sections.push({ label: t("advDomain"), text: domainLabel(a.domain) + ". " + t(`dbasis_${a.domain.domain}`) });
    sections.push({ label: t("advSignals"), chips: a.evidence.map((e) => t(e.key, e.params.map((x) => (typeof x === "number" ? num(x) : x)))) });
    if (ef) {
      const cur = ef.kind === "with_switch" ? t("advEffForModel", [ef.model]) : t("advEffNow", [effName(ef.from) + (ef.assumed ? " " + t("effDefaultMark") : "")]);
      sections.push({ label: t("advEffort"), text: `${t("advEffortVal", [effName(ef.to)])} ${cur}`, chips: (ef.why || []).map((k) => t(`ewhy_${k}`)) });
    }
    sections.push(
      { label: t("advBasis"), text: [t(a.typeBasisKey), t(a.basisKey), ...a.why.map((w) => t(`why_${w}`))].join(" ") + (ef ? " " + t("effBasis") : "") },
      { label: t("advWhen"), text: t(a.whenKey) }
    );
    return {
      key: advKey(a), tone, icon, title, detail, sections,
      caveat: t("advCaveat"), source: t("advSource"), whyLabel: t("advWhy"), hideLabel: t("advHide"), fbThanks: t("advFbThanks"),
      feedback: !target ? null : (S.fbDone === advKey(a) ? { done: true } : { q: t(target === "effort" ? "advFbQEff" : "advFbQ"), good: t("advFbGood"), bad: t("advFbBad") }),
      adv: { type: a.type, kind: a.kind, tier: a.tier, curTier: a.curTier, target, ekind: ef?.kind || null }
    };
  }

  function render(r) {
    if (!S.settings.panel || !r) { panel?.update(null); panel?.updateBanner(null); return; }
    if (!panel) panel = L.panel.createPanel({
      getAnchor: () => L.page.getComposer(),
      getAnchorTop: () => L.page.composerTop(),
      onMore: () => send({ type: "open:details" }),
      initialOffset: S.pillOffset,
      onMoved: (o) => { S.pillOffset = o; store.set({ pillOffset: o }); trace("pill:moved", o ? { dx: o.dx, dy: o.dy } : { reset: true }); },
      onBannerFeedback: (b, good) => { S.fbDone = b?.key || null; if (b?.adv) { send({ type: "advisor:feedback", adv: b.adv, good }); trace("advisor:feedback", { ...b.adv, good }); } },
      onBannerHide: (b) => { S.bannerHidden = b?.key || null; },
      onBannerRelabel: (b, label) => {
        S.fixDone = b?.key || null;
        // Kişisel öğrenme: mevcut mesajın özellik vektörü (metin değil, sayı dizisi) + doğru etiket
        const text = S.last?.prompt?.text || "";
        if (!text) return;
        const feats = L.learn.featurize(text, S.last.cls.scores);
        send({ type: "learn:label", feats, label, from: b?.adv?.type || null });
        trace("learn:label", { from: b?.adv?.type || null, to: label, n: feats.length });
        memo = null; schedule(300);
      }
    });
    panel.update(viewModel(r));
    panel.updateBanner(bannerVM(r));
  }

  // ---------- Kalibrasyon gözlemi (adım 10) ----------
  window.addEventListener("message", (e) => {
    if (e.source !== window || e.origin !== location.origin) return;
    const d = e.data;
    if (!d || d.__tokenForecast !== 1) return;
    if (d.kind === "send") onSend(d);
    else if (d.kind === "done") onDone(d);
    else if (d.kind === "hello") {
      // Yalnızca durum değişince günlüğe yaz (her odaklanmada aynı satır birikmesin)
      const sig = `${d.wrapped}|${d.sawCompletion}`;
      if (sig !== S.lastHello) { S.lastHello = sig; trace("hook:hello", { wrapped: d.wrapped, seen: d.sawCompletion }); }
      else send({ type: "health:hook", at: Date.now(), wrapped: d.wrapped, seen: d.sawCompletion });
    }
    else if (d.kind === "perf") trace("hook:perf", { path: d.path, via: d.via });
    else if (d.kind === "worker") trace("hook:worker", { path: d.path });
    else if (d.kind === "probe") trace("hook:probe", { path: String(d.path || "").slice(0, 120) });
  });

  async function preUsage() {
    // Ücretli planlarda /usage anlık okunur. Ücretsiz planda (/usage boş) son akış değeri kullanılır.
    try {
      const u = await readUsageNow();
      if (u) return { usage: u, at: Date.now() };
    } catch (_) {}
    const { usage, usageMeta } = await store.get(["usage", "usageMeta"]);
    if (usage && usageMeta?.source === "stream" && Date.now() - usageMeta.fetchedAt < 30 * 60000) return { usage, at: usageMeta.fetchedAt };
    return null;
  }

  async function onSend(d) {
    await loading;
    if (d.via !== "dom") {
      S.hookSends = (S.hookSends || 0) + 1; S.hookSendAt = Date.now();
      // Sayfa yolu bu gönderimi bir an önce yakaladıysa onu iptal et: kanca daha ayrıntılı veri verir
      if (DOMW.pending && Date.now() - DOMW.pending.at < 10000) { S.snapshots.delete(DOMW.pending.id); DOMW.pending = null; DOMW.consumed = S.hookSends; }
    }
    // DOM yolunda mesaj kutusu çoktan boşalmış olur: gönderimden hemen önceki tahmini kullan
    const r = d.estimate || compute() || S.last;
    const conv = d.conv;
    trace("send:seen", { via: d.via || "hook", estimate: !!r, retry: !!d.retry, bodyKeys: d.body ? d.body.keys : null });
    S.activity[conv] = d.at;
    store.set({ convActivity: trimActivity(S.activity) });
    if (!r) return;
    const zero = { outputAdjust: () => ({ mean: 0, sd: 0 }) };
    const base = L.fc.outputPrior(r.cls, { promptTokens: r.pt, attachmentTokens: r.att }, zero);
    const snap = {
      at: d.at, conv, retry: d.retry, cls: r.cls, tier: S.tier || "claude_pro",
      model: r.fc.model, weight: r.fc.weight, effort: r.fc.effort, peak: r.fc.peak,
      newInput: r.pt.mid + r.att.mid, history: r.hist.tokens.mid || 0, cold: r.fc.cache === "cold",
      cacheKnown: r.fc.cache !== "unknown", toolMedian: base.tool ? base.tool.median : 0,
      predicted: r.fc.pct, outMuNoAdj: base.mu, pre: null, logId: `${d.at}-${d.id}`
    };
    S.snapshots.set(d.id, snap);
    // Haftalık rapor için gönderim kaydı (metin yok; yalnızca tahmin, model, tip, öneri)
    const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);
    const fam = L.fc.resolveModel(r.fc.model || "").info?.family || null;
    snap.log = {
      id: snap.logId, at: d.at, conv: String(conv || "").slice(0, 8), fam, model: r.fc.model, type: r.cls.type, eff: r.fc.effort,
      peak: !!r.fc.peak, cache: r.fc.cache, hist: Math.round(r.hist.tokens.mid || 0),
      pred: r3(r.fc.pct.session.mid), predLo: r3(r.fc.pct.session.low), predHi: r3(r.fc.pct.session.high), predW: r3(r.fc.pct.weekly.mid),
      adv: r.adv ? { k: r.adv.kind, t: r.adv.tier } : null, save: r.adv?.kind === "save" ? r3(r.adv.savedPct) : 0,
      dom: r.dom?.domain || null, sub: r.dom?.sub || null,
      effRec: r.adv?.effort?.to || null, effAs: !!r.fc.effortAssumed,
      effSave: r.adv?.effort?.kind === "lower" && r.adv.effort.savedPct > 0 ? r3(r.adv.effort.savedPct) : 0,
      outHi: Math.round(r.fc.output.high || 0)
    };
    send({ type: "log:send", entry: snap.log });
    S.pending = [];
    // Önceki değeri hemen iste; cevap bundan önce biterse onDone bu sözü bekler
    // "Önce" değeri: gönderim tuşuna basıldığı an alınmış okuma varsa o (istek sunucuya ulaşmadan önce), yoksa şimdi oku
    const armedPre = DOMW.armed && Date.now() - DOMW.armed.at < 20000 ? DOMW.armed.pre : null;
    snap.prePromise = (d.prePromise || armedPre || preUsage()).then((p) => { snap.pre = p; trace("send:pre", p ? { five: p.usage?.fiveHour?.pct ?? null } : { usage: "none" }); return p; });
    // Çok eski anlık görüntüleri temizle
    for (const [k, v] of S.snapshots) if (Date.now() - v.at > 20 * 60000) S.snapshots.delete(k);
    schedule(100);
  }

  async function onDone(d) {
    await loading;
    const snap = S.snapshots.get(d.id);
    S.snapshots.delete(d.id);
    trace("done:seen", { via: d.via || "hook", snap: !!snap, error: d.error || null, aborted: !!d.aborted, sse: !!d.messageLimit, chars: (d.text || "").length });
    let post = null;
    if (d.messageLimit) {
      post = L.usage.normalizeSse(d.messageLimit);
      send({ type: "usage:sse", messageLimit: d.messageLimit });
    }
    if (!post) {
      await new Promise((res) => setTimeout(res, d.via === "dom" ? 4000 : 1500));
      try { post = await readUsageNow(); } catch (_) {}
    }
    // Yedek yolda kullanım geç işlenebilir: 30 sn sonra bir kez daha oku ve büyük olanı al
    // (bu arada yeni bir mesaj gönderildiyse ikinci okuma o mesajı da içereceği için yapılmaz).
    if (d.via === "dom" && post) {
      const doneAt = Date.now();
      await new Promise((res) => setTimeout(res, 26000));
      const newer = DOMW.pending && DOMW.pending.at > doneAt;
      if (!newer) {
        try {
          const late = await readUsageNow();
          for (const k of ["fiveHour", "sevenDay"]) if (late?.[k] && post[k] && late[k].pct > post[k].pct && Math.abs((late[k].resetsAt || 0) - (post[k].resetsAt || 0)) < 120000) post = { ...post, [k]: late[k] };
          trace("done:late", { five: late?.fiveHour?.pct ?? null });
        } catch (_) {}
      }
    }
    refreshConversation(1500);
    if (snap?.prePromise) await snap.prePromise.catch(() => null);
    if (!snap || !post || d.error || d.aborted) { trace("done:skip", { reason: !snap ? "no-snapshot" : !post ? "no-usage-after" : d.error ? "http-error" : "aborted" }); return; }
    if (!snap.cacheKnown && snap.history > 5000) { trace("done:skip", { reason: "cache-unknown", history: snap.history }); return; } // önbellek durumu bilinmiyorsa maliyet belirsiz → öğrenme

    const outTokens = L.tokens.estimateTokens(d.text || "", opts()).mid;
    const cost = L.fc.realizedCost({ weight: snap.weight, newInput: snap.newInput, history: snap.history, cold: snap.cold, outTokens, effort: snap.effort, toolMedian: snap.toolMedian });
    const list = [];
    for (const [win, key] of [["session", "fiveHour"], ["weekly", "sevenDay"]]) {
      const a = snap.pre?.usage?.[key], b = post[key];
      if (!a || !b) { trace("done:window", { win, reason: !a ? "no-before" : "no-after" }); continue; }
      if (a.resetsAt && b.resetsAt && Math.abs(a.resetsAt - b.resetsAt) > 2 * 60000) { trace("done:window", { win, reason: "reset-mismatch", diffMin: Math.round(Math.abs(a.resetsAt - b.resetsAt) / 60000) }); continue; } // pencere yenilendi
      if (Date.now() - snap.pre.at > 15 * 60000) { trace("done:window", { win, reason: "before-too-old" }); continue; }
      list.push({
        at: Date.now(), tier: snap.tier, window: win, delta: Math.round((b.pct - a.pct) * 100) / 100, cost,
        peakMul: 1, peak: win === "session" && !!snap.peak,
        predicted: snap.predicted[win], type: snap.cls.type, outTokens, outMuNoAdj: snap.outMuNoAdj, model: snap.model
      });
    }
    if (!list.length && outTokens > 0) {
      // Kullanım farkı ölçülemedi ama cevap uzunluğu yine de öğrenilebilir
      list.push({ at: Date.now(), tier: snap.tier, window: null, type: snap.cls.type, outTokens, outMuNoAdj: snap.outMuNoAdj, model: snap.model });
    }
    // Gönderim kaydını ölçülen değerlerle tamamla; beklenenden çok fazlaysa açıklama üret
    if (snap.log) {
      const sess = list.find((x) => x.window === "session"), week = list.find((x) => x.window === "weekly");
      const patch = { out: outTokens || null, d: sess ? sess.delta : null, dw: week ? week.delta : null };
      send({ type: "log:done", id: snap.logId, patch });
      const sp = L.rep.surprise({ ...snap.log, ...patch });
      if (sp) { send({ type: "surprise", surprise: sp }); trace("done:surprise", { d: sp.d, hi: sp.hi, reasons: sp.reasons }); }
    }
    if (list.length) {
      const res = await send({ type: "calib:observe", list });
      trace("done:observed", { n: list.length, deltas: list.map((x) => x.delta ?? null), results: Array.isArray(res) ? res.map((x) => x.reason) : res });
    } else trace("done:skip", { reason: "nothing-to-observe", outTokens });
  }

  function trimActivity(a) {
    const keys = Object.keys(a);
    if (keys.length <= 300) return a;
    keys.sort((x, y) => a[x] - a[y]).slice(0, keys.length - 300).forEach((k) => delete a[k]);
    return a;
  }

  // ---------- Yedek gönderim/cevap tespiti (sayfa yapısından) ----------
  // claude.ai gönderimi bir Web Worker içinden yapabiliyor (completionGzipWorker); o zaman sayfadaki fetch kancası
  // isteği hiç görmez. Bu yedek yol, kullanıcı mesajı sayısının artmasından gönderimi, son asistan mesajının
  // yazılmasının bitmesinden cevabı anlar. Kanca çalışırsa bu yol devreye girmez (çift sayım yok).
  const DOMW = { conv: undefined, lastEl: null, lastKey: "", armed: null, seq: 0, pending: null, consumed: 0 };
  const grabPre = () => {
    try {
      if (DOMW.armed && Date.now() - DOMW.armed.at < 1500) return; // aynı gönderim için ikinci olay
      const r = compute();
      // Kullanımın "önce" değerini gönderim anında iste (cevap başladıktan sonra okumak farkı küçültür)
      const pre = preUsage().catch(() => null);
      DOMW.armed = { r: r && !r.empty ? r : S.lastFull, at: Date.now(), pre };
    } catch (_) {}
  };
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && L.page?.getInputElement?.()?.contains(e.target)) grabPre();
  }, true);
  document.addEventListener("pointerdown", (e) => {
    const b = e.target?.closest?.("button");
    if (b && L.page?.getComposer?.()?.contains(b)) grabPre();
  }, true);

  function domTick() {
    if (!L.page?.lastUserMessage) return;
    const convId = (location.pathname.match(/\/chat\/([^/?#]+)/) || [])[1] || null;
    const u = L.page.lastUserMessage();
    const armedRecent = !!(DOMW.armed && Date.now() - DOMW.armed.at < 20000);
    if (DOMW.conv !== convId) {
      // Sohbet değişti. Yeni sohbetin ilk mesajıysa (az önce Enter'a basıldı) mevcut mesaj "yeni" sayılsın.
      DOMW.conv = convId; DOMW.consumed = S.hookSends || 0; DOMW.pending = null;
      if (armedRecent) { DOMW.lastEl = null; DOMW.lastKey = ""; } else { DOMW.lastEl = u.el; DOMW.lastKey = u.key; return; }
    }
    // Sayfa yüklenirken mesajlar sonradan çizilir: daha önce hiç mesaj görmediysek yalnızca gönderim tuşuyla yeni say
    const isNew = u.el && u.el !== DOMW.lastEl && u.key && u.key !== DOMW.lastKey && (DOMW.lastKey !== "" || armedRecent);
    if (u.el && u.el !== DOMW.lastEl) DOMW.lastEl = u.el; // aynı mesaj yeniden çizildiyse yalnızca öğeyi güncelle
    if (isNew) {
      DOMW.lastKey = u.key;
      if (DOMW.pending) { trace("done:skip", { reason: "superseded" }); S.snapshots.delete(DOMW.pending.id); DOMW.pending = null; }
      const hookCaught = (S.hookSends || 0) > (DOMW.consumed || 0) && Date.now() - (S.hookSendAt || 0) < 15000;
      DOMW.consumed = S.hookSends || 0;
      if (hookCaught) return; // kanca zaten yakaladı
      const armed = DOMW.armed && Date.now() - DOMW.armed.at < 20000 ? DOMW.armed : null;
      const pre = armed ? armed.r : (S.lastFull && Date.now() - S.lastFull.at < 120000 ? S.lastFull : null);
      DOMW.armed = null;
      const id = `dom-${Date.now()}-${++DOMW.seq}`;
      const a0 = L.page.lastAssistant();
      DOMW.pending = { id, at: Date.now(), stableSince: 0, lastText: "", startText: a0.text, startEl: a0.el, userEl: u.el, userKey: u.key };
      onSend({ kind: "send", via: "dom", id, conv: convId, retry: false, at: Date.now(), estimate: pre, prePromise: armed?.pre || null });
      if (!pre) trace("send:no-estimate");
      return;
    }
    const p = DOMW.pending;
    if (!p) return;
    const a = L.page.lastAssistant();
    if (Date.now() - p.at > 10 * 60000) { DOMW.pending = null; onDone({ kind: "done", via: "dom", id: p.id, aborted: true, at: Date.now() }); return; }
    // Cevap, gönderilen mesajdan SONRA gelen yeni bir asistan mesajı olmalı. Gönderim anında ekranda olan eski
    // cevap (yeni cevap henüz çizilmeden "durmuş" görünür) asla bitmiş cevap sayılmaz.
    const userEl = p.userEl && p.userEl.isConnected ? p.userEl : (L.page.lastUserMessage().key === p.userKey ? L.page.lastUserMessage().el : null);
    const after = a.el && userEl ? !!(userEl.compareDocumentPosition(a.el) & Node.DOCUMENT_POSITION_FOLLOWING) : null;
    const isNewReply = after === true || (after === null && a.el && a.el !== p.startEl && a.text !== p.startText);
    if (!isNewReply || a.streaming || !a.text) { p.stableSince = 0; p.lastText = a.text; return; }
    if (a.text !== p.lastText || !p.stableSince) { p.lastText = a.text; p.stableSince = Date.now(); return; }
    // Yazılıyor göstergesi kapalı ve metin 4 sn değişmedi → bitti (araç kullanan cevaplarda ara duraklamalar olur)
    if (Date.now() - p.stableSince >= 4000) {
      DOMW.pending = null;
      onDone({ kind: "done", via: "dom", id: p.id, text: a.text, messageLimit: null, at: Date.now() });
    }
  }
  setInterval(() => { try { domTick(); } catch (_) {} }, 700);

  // ---------- Tetikleyiciler ----------
  let timer = null;
  function schedule(ms = 300) {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try { await loading; if (!S.i18n) await loadState(); render(compute()); } catch (e) { console.debug("[Token Forecast]", e); }
    }, ms);
  }
  document.addEventListener("input", () => schedule(250), true);
  document.addEventListener("keyup", (e) => { if (e.key === "Backspace" || e.key === "Delete") schedule(250); }, true);
  new MutationObserver((muts) => {
    if (panel && muts.every((m) => panel.host.contains(m.target))) return;
    schedule(900);
  }).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(() => { if (S.pending.length) schedule(0); }, 3000);

  (async () => {
    await loading;
    await loadState();
    periodicUsage();
    refreshConversation(300);
    schedule(400);
    // Sağlık: sayfa öğeleri bulundu mu, kanca yerinde mi?
    const pingHook = () => { try { window.postMessage({ __tokenForecastCmd: "ping" }, location.origin); } catch (_) {} };
    const report = () => {
      send({ type: "health", at: Date.now(), page: {
        composer: !!L.page.getComposer(), model: L.page.detectModel(), effort: L.page.detectEffort(), url: location.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ":id")
      } });
    };
    setTimeout(() => { pingHook(); report(); }, 2500);
    setTimeout(() => { pingHook(); report(); }, 12000);
    window.addEventListener("focus", () => { pingHook(); report(); });
    trace("content:ready");
  })();
  });
})();
