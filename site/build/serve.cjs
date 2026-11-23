// Küçük statik sunucu (prerender ve site testleri için). docs/ klasörünü kökten sunar; klasör → index.html.
const http = require("http");
const fs = require("fs");
const path = require("path");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8" };
const DOCS = path.resolve(__dirname, "../../docs");

function serve(dir = DOCS) {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    let p = path.join(dir, decodeURIComponent(u.pathname));
    if (!p.startsWith(dir)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
      if (!u.pathname.endsWith("/")) { res.writeHead(301, { Location: u.pathname + "/" }); return res.end(); }
      p = path.join(p, "index.html");
    }
    if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
    res.end(fs.readFileSync(p));
  });
  return new Promise((r) => srv.listen(0, "127.0.0.1", () => { srv.base = `http://127.0.0.1:${srv.address().port}/`; r(srv); }));
}
module.exports = { serve, DOCS };
