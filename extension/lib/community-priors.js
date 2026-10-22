// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Topluluk başlangıç değerleri. tools/aggregate.mjs üretir (elle düzenleme).
// Boşken eklenti kendi kaba önsellerini kullanır (lib/forecast.js PLAN_CAPS, CLAUDE_OUTPUT_PRIOR).
// k[plan][pencere] = { mu, sd, users }  → log(limit yüzdesi / maliyet birimi) önseli
// outBias = { mean, sd, users }         → Claude cevap uzunluğu sapması (log) önseli
export default { version: 0, updated: null, contributors: 0, k: {}, outBias: null };
