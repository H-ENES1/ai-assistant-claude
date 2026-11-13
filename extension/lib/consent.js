// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Açık onay: Chrome Web Store kuralı gereği eklenti, kullanıcı ne okuduğunu görüp onaylamadan
// claude.ai'de hiçbir şey okumaz (mesaj kutusu, sohbet geçmişi, kullanım yüzdeleri).
// Onay yalnızca yerel depoda tutulur: { v, at }. Okunan veriler değişirse CONSENT_VERSION artırılır
// ve kullanıcıdan yeniden onay istenir.
export const CONSENT_VERSION = 2; // 2: 0.13.0 (denetim: onay metni ve gizlilik politikası yeniden yazıldı)
export const isConsented = (c) => !!(c && Number(c.v) >= CONSENT_VERSION);
export async function hasConsent(store = chrome.storage.local) {
  const { consent } = await store.get("consent");
  return isConsented(consent);
}
