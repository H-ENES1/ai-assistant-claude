// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Karşılama ve açık onay sayfası (ilk kurulumda açılır). Onay verilmeden eklenti claude.ai'de hiçbir şey okumaz.
import { makeI18n, LANGS } from "../lib/i18n.js";
import { CONSENT_VERSION, isConsented } from "../lib/consent.js";
import { PRIVACY_URL } from "../lib/config.js";

const $ = (id) => document.getElementById(id);
const store = chrome.storage.local;
const KEYS = ["welTitle", "welLead", "welReadTitle", "welRead1", "welRead2", "welRead3", "welStoreTitle", "welStore", "welNeverTitle", "welNever"];

async function paint() {
  const { settings, consent } = await store.get(["settings", "consent"]);
  const I = await makeI18n(settings?.language || "auto");
  document.documentElement.lang = I.lang;
  document.title = I.t("welTitle");
  for (const k of KEYS) $(k).textContent = I.t(k);
  $("welPolicy").textContent = I.t("welPolicy"); $("welPolicy").href = PRIVACY_URL;
  $("accept").textContent = I.t("welAccept"); $("later").textContent = I.t("welLater");
  if (!$("lang").options.length) {
    for (const [code, l] of Object.entries(LANGS)) { const o = document.createElement("option"); o.value = code; o.textContent = l.name; $("lang").append(o); }
  }
  $("lang").value = I.lang;
  if (isConsented(consent)) done(I, I.t("welDone"));
  return I;
}
function done(I, text, ok = true) {
  $("result").hidden = false; $("result").textContent = text; $("result").classList.toggle("ok", ok);
  if (ok) $("actions").hidden = true;
}

let I = await paint();
$("lang").addEventListener("change", async (e) => {
  const { settings } = await store.get("settings");
  await store.set({ settings: { ...(settings || {}), language: e.target.value } });
  I = await paint();
});
$("accept").addEventListener("click", async () => {
  await store.set({ consent: { v: CONSENT_VERSION, at: Date.now() } });
  done(I, I.t("welDone"));
});
$("later").addEventListener("click", () => done(I, I.t("welLaterNote"), false));
