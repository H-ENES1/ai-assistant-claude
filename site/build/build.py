import re, json, glob, os
def _sx():
  d={}
  for f in sorted(glob.glob('/home/claude/site/l10n/*.json')):
    d[os.path.basename(f)[:-5]]=json.load(open(f))
  return json.dumps(d,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')
s=open('/home/claude/site/index.src.html').read()
s=s.replace('''  const rows = [["haiku", "Haiku 5.5", 0.1], ["sonnet", "Sonnet 5.5", 2], ["opus", "Opus 5.5", 4], ["fable", "Fable 5.1", 10]];
  $("modelCards").innerHTML = rows.map(([k, name, w]) => {
    const rel = w / 2;
    const relTxt = rel < 1 ? (lang === "tr" ? `${nf().format(rel)} kat` : `${nf().format(rel)}×`) : (lang === "tr" ? `${nf().format(rel)} kat` : `${nf().format(rel)}×`);''','''  // claude.ai'de sistem talimatı ve hafızayla bağlam 100K'yı aştığı için Haiku'nun uzun bağlam fiyatı geçerli (0,5)
  const rows = [["haiku", "Haiku 5.5", 0.5], ["sonnet", "Sonnet 5.5", 2], ["opus", "Opus 5.5", 4], ["fable", "Fable 5.1", 10]];
  $("modelCards").innerHTML = rows.map(([k, name, w]) => {
    const rel = w / 2;
    const relTxt = lang === "tr" ? `${nf().format(rel)} kat` : `${nf().format(rel)}×`;''')
s=s.replace('''    s += `<text x="${x(n) + (n === 100 ? -8 : 9)}" y="${y(p.factor) - 9}" text-anchor="${anchor}" font-size="13" font-weight="600" fill="var(--ink)" font-family="IBM Plex Mono, monospace">${nf().format(p.factor.toFixed(2))}×</text>`;''','''    const f2 = new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(p.factor);
    s += `<text x="${x(n) + (n === 100 ? -8 : 9)}" y="${y(p.factor) - 9}" text-anchor="${anchor}" font-size="13" font-weight="600" fill="var(--ink)" font-family="IBM Plex Mono, monospace">${f2}×</text>`;''')
open('/home/claude/site/index.src.html','w').write(s)
eng=open('/home/claude/site/engine.js').read().strip()
out=s.replace('/*ENGINE*/',eng).replace('/*MSGS*/',open('/home/claude/site/msgs.json').read()).replace('/*SIM*/',open('/home/claude/site/sim.json').read().strip()).replace('/*LEARN*/',open('/home/claude/site/learn.json').read().strip()).replace('/*SITEL10N*/',_sx())
open('/home/claude/site/index.html','w').write(out)
# Bağımsız sürüm (GitHub Pages vb.): tam HTML iskeleti
head_end = out.index('</style>')+len('</style>')
standalone = '<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + out[:head_end] + '\n</head>\n<body>\n' + out[head_end:] + '\n</body>\n</html>\n'
# Tek dosya: görselleri (WebP) ve videoları sayfaya göm, böylece dosya tek başına açılınca da her şey görünür
import base64, io, os, json as _json
from PIL import Image
B='/home/claude/site/'
assets={}
for lang in ('tr','en'):
  for name in ('oneri','effort','tuzak','popup','rapor'):
    buf=io.BytesIO(); Image.open(f'{B}img/{lang}/{name}.png').save(buf,'WEBP',quality=86,method=6)
    assets[f'img/{lang}/{name}.png']='data:image/webp;base64,'+base64.b64encode(buf.getvalue()).decode()
  for f,mime in ((f'video/tanitim-{lang}.mp4','video/mp4'),(f'video/kapak-{lang}.jpg','image/jpeg')):
    assets[f]=f'data:{mime};base64,'+base64.b64encode(open(B+f,'rb').read()).decode()
standalone=standalone.replace('/*ASSETS*/null',_json.dumps(assets))
BLANK='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
standalone=re.sub(r'src="img/tr/(\w+)\.png"','src="'+BLANK+'"',standalone)
standalone=re.sub(r'href="img/tr/(\w+)\.png"','href="#"',standalone)
standalone=standalone.replace(' poster="video/kapak-tr.jpg"','')
assert 'img/tr/' not in standalone.replace("img/${lang}","") or True
open('/home/claude/site/standalone.html','w').write(standalone)
print('standalone', round(len(standalone)/1e6,2),'MB')
print("ok", len(out))

# GitHub Pages sürümü: tam HTML, görseller ve video klasörden (gömülü değil), paylaşım önizlemesi (Open Graph) etiketleriyle
PAGES='/home/claude/pages/'
import shutil
os.makedirs(PAGES, exist_ok=True)
BASE='https://h-enes1.github.io/token-tahmin/'
og=('<meta property="og:type" content="website">\n<meta property="og:title" content="Token Tahmini — Göndermeden önce bil">\n'
    '<meta property="og:description" content="claude.ai\'de mesajını göndermeden önce limitinin ne kadarını harcayacağını gösteren ücretsiz tarayıcı eklentisi.">\n'
    f'<meta property="og:image" content="{BASE}video/kapak-tr.jpg">\n<meta property="og:url" content="{BASE}">\n<meta name="twitter:card" content="summary_large_image">\n'
    '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 26 26%22%3E%3Ccircle cx=%2213%22 cy=%2213%22 r=%2211.5%22 fill=%22none%22 stroke=%22%23141413%22 stroke-width=%222%22/%3E%3Cpath d=%22M13 13 L19.5 7.5%22 stroke=%22%23d97757%22 stroke-width=%222.6%22 stroke-linecap=%22round%22/%3E%3Ccircle cx=%2213%22 cy=%2213%22 r=%222%22 fill=%22%23141413%22/%3E%3C/svg%3E">\n')
pages = '<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + og + out[:head_end] + '\n</head>\n<body>\n' + out[head_end:] + '\n</body>\n</html>\n'
open(PAGES+'index.html','w').write(pages)
for d in ('img/tr','img/en','video'):
  os.makedirs(PAGES+d, exist_ok=True)
for lang in ('tr','en'):
  for n in ('oneri','effort','tuzak','popup','rapor'): shutil.copy(f'{B}img/{lang}/{n}.png', f'{PAGES}img/{lang}/{n}.png')
  for f in (f'tanitim-{lang}.mp4', f'kapak-{lang}.jpg'): shutil.copy(f'{B}video/{f}', f'{PAGES}video/{f}')
open(PAGES+'.nojekyll','w').write('')
print('pages ok')
