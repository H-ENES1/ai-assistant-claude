// Sürüm paketi: extension/ klasörünü dist/ altına kopyalar, JavaScript dosyalarını küçültür
// (her dosya ayrı ayrı, modül yapısı ve dosya adları aynı kalır), her dosyanın başına lisans
// bildirimini ekler ve mağazaya yüklenecek zip'i üretir.
//
// Mağaza kuralları: küçültme (minify) serbesttir, kodu gizleme (obfuscation) yasaktır.
// Bu betik yalnızca küçültür; değişken adları kısalır ama kod okunabilir mantıkta kalır.
//
// Kullanım:  node tools/build-release.mjs [kaynak_klasör] [çıktı_klasörü]
//   varsayılan: extension → dist
import { transform } from "esbuild";
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.resolve(process.argv[2] || path.join(root, "extension"));
const OUT = path.resolve(process.argv[3] || path.join(root, "dist"));
const manifest = JSON.parse(await fs.readFile(path.join(SRC, "manifest.json"), "utf8"));
const HEADER = `/*! Token Tahmini / Token Forecast ${manifest.version} — (c) 2026 Hayrettin Enes Karalı. SPDX-License-Identifier: AGPL-3.0-or-later. Kaynak / Source: https://github.com/H-ENES1/ai-assistant-claude */\n`;
const SKIP = new Set(["README.md", ".DS_Store"]);

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name) || e.name.endsWith(".bak")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

await fs.rm(OUT, { recursive: true, force: true });
let before = 0, after = 0;
for (const file of await walk(SRC)) {
  const rel = path.relative(SRC, file);
  const dest = path.join(OUT, "unpacked", rel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  if (file.endsWith(".js")) {
    const code = await fs.readFile(file, "utf8");
    // content.js ve hook.js klasik betik; geri kalanı ES modülü
    const isModule = /^\s*(import|export)\s/m.test(code);
    const r = await transform(code, { minify: true, format: isModule ? "esm" : undefined, target: "chrome110", legalComments: "none", charset: "utf8" });
    await fs.writeFile(dest, HEADER + r.code);
    before += code.length; after += r.code.length + HEADER.length;
  } else {
    await fs.copyFile(file, dest);
  }
}
for (const f of ["LICENSE", "NOTICE"]) {
  try { await fs.copyFile(path.join(root, f), path.join(OUT, "unpacked", f)); } catch (_) {}
}
const zip = path.join(OUT, `token-tahmin-${manifest.version}.zip`);
execFileSync("zip", ["-qr", zip, "."], { cwd: path.join(OUT, "unpacked") });
console.log(`JS: ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB · paket: ${path.relative(root, zip)}`);
