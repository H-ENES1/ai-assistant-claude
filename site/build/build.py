"""Site derlemesi.

    npm install                 # kökte bir kez: esbuild + playwright
    python site/build/build.py  # Python 3 + Pillow

Girdiler (site/build/): index.src.html, entry.js (demo motoru, extension/lib'den esbuild ile), msgs.json,
sim.json, learn.json, l10n/<dil>.json (tools/i18n/mk.py üretir), seo.json (dil başına başlık/açıklama), static/.

Çıktılar:
  site/index.html        claude.ai artifact sürümü (tek parça, dil JS ile değişir)
  site/standalone.html   tek başına açılan sürüm (görseller ve video gömülü; git'e girmez)
  docs/                  GitHub Pages: dil başına statik sayfa (/ = tr, /en/, /de/ ...), ortak app.js,
                         WebP görseller, paylaşım görselleri, site haritası. Metin prerender.cjs ile HTML'e yazılır.
"""
import base64, datetime, hashlib, html, io, json, os, re, shutil, subprocess, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
REPO = os.path.dirname(SITE)
DOCS = os.path.join(REPO, 'docs')
B = SITE + os.sep
LANGS = ['tr', 'en', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'ja', 'zh']
HTML_LANG = {'pt': 'pt-BR', 'zh': 'zh-CN'}
BASE = 'https://h-enes1.github.io/ai-assistant-claude/'
STORE = 'https://chromewebstore.google.com/detail/chbjpjhmkpgfocnfpdafkakjicdicige'
SHOTS = ('oneri', 'effort', 'tuzak', 'popup', 'rapor')
SIZES = {'popup': '300px', 'rapor': '(max-width: 920px) calc(100vw - 54px), 880px'}
SIZES_DEF = '(max-width: 860px) calc(100vw - 54px), 512px'


def rd(p):
    return open(p, encoding='utf8').read()


def wr(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf8', newline='\n').write(s)


def js_json(o):
    return json.dumps(o, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')


# ---- girdiler ----
node = shutil.which('node')
if not node:
    sys.exit('node bulunamadı (PATH)')
engine = subprocess.run([node, os.path.join(REPO, 'node_modules', 'esbuild', 'bin', 'esbuild'), os.path.join(HERE, 'entry.js'),
                         '--bundle', '--format=iife', '--global-name=TF', '--minify', '--log-level=warning'],
                        check=True, capture_output=True, encoding='utf8').stdout.strip()
src = rd(os.path.join(HERE, 'index.src.html'))
MSGS = json.loads(rd(os.path.join(HERE, 'msgs.json')))
SIM = rd(os.path.join(HERE, 'sim.json')).strip()
LEARN = rd(os.path.join(HERE, 'learn.json')).strip()
SX = {os.path.basename(f)[:-5]: json.loads(rd(os.path.join(HERE, 'l10n', f)))
      for f in sorted(os.listdir(os.path.join(HERE, 'l10n'))) if f.endswith('.json')}
SEO = json.loads(rd(os.path.join(HERE, 'seo.json')))

# ---- 1. artifact sürümü (site/index.html): her şey tek parçada, dil JS ile ----
out = (src.replace('/*ENGINE*/', engine).replace('/*MSGS*/', js_json(MSGS)).replace('/*SIM*/', SIM)
       .replace('/*LEARN*/', LEARN).replace('/*SITEL10N*/', js_json(SX))
       .replace('<!--LANGHINT-->\n', '').replace('<!--LANGLINKS-->\n', ''))
wr(B + 'index.html', out)
head_end = out.index('</style>') + len('</style>')

# ---- 2. tek dosyalık sürüm (site/standalone.html): görseller (WebP) ve video gömülü ----
SKEL = '<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
standalone = SKEL + out[:head_end] + '\n</head>\n<body>\n' + out[head_end:] + '\n</body>\n</html>\n'
assets = {}
for cl in ('tr', 'en'):
    for name in SHOTS:
        buf = io.BytesIO(); Image.open(f'{B}img/{cl}/{name}.png').save(buf, 'WEBP', quality=86, method=6)
        assets[f'img/{cl}/{name}.png'] = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()
    for f, mime in ((f'video/tanitim-{cl}.mp4', 'video/mp4'), (f'video/kapak-{cl}.jpg', 'image/jpeg')):
        assets[f] = f'data:{mime};base64,' + base64.b64encode(open(B + f, 'rb').read()).decode()
standalone = standalone.replace('/*ASSETS*/null', json.dumps(assets))
BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
standalone = re.sub(r'src="img/tr/(\w+)\.png"', 'src="' + BLANK + '"', standalone)
standalone = re.sub(r'href="img/tr/(\w+)\.png"', 'href="#"', standalone)
standalone = standalone.replace(' poster="video/kapak-tr.jpg"', '')
wr(B + 'standalone.html', standalone)
print('standalone', round(len(standalone) / 1e6, 2), 'MB')

# ---- 3. GitHub Pages (docs/) ----
# Eski çıktıyı temizle (yalnızca bu betiğin ürettikleri)
for l in LANGS[1:]:
    shutil.rmtree(os.path.join(DOCS, l), ignore_errors=True)
for d in ('img', 'video'):
    shutil.rmtree(os.path.join(DOCS, d), ignore_errors=True)
for f in os.listdir(DOCS) if os.path.isdir(DOCS) else []:
    if re.fullmatch(r'app\.js|index\.html|sitemap\.xml', f):
        os.remove(os.path.join(DOCS, f))
os.makedirs(DOCS, exist_ok=True)

# 3a. görseller: WebP, 1x ve 2x; video kapağı WebP
DIMS = {}
for cl in ('tr', 'en'):
    os.makedirs(f'{DOCS}/img/{cl}', exist_ok=True)
    for n in SHOTS:
        im = Image.open(f'{B}img/{cl}/{n}.png').convert('RGB')
        im.save(f'{DOCS}/img/{cl}/{n}.webp', 'WEBP', quality=82, method=6)
        half = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
        half.save(f'{DOCS}/img/{cl}/{n}-1x.webp', 'WEBP', quality=84, method=6)
        DIMS[(cl, n)] = (im.width, im.height, half.width, half.height)
    os.makedirs(f'{DOCS}/video', exist_ok=True)
    for f in (f'tanitim-{cl}.mp4', f'kapak-{cl}.jpg'):
        shutil.copy(f'{B}video/{f}', f'{DOCS}/video/{f}')
    Image.open(f'{B}video/kapak-{cl}.jpg').convert('RGB').save(f'{DOCS}/video/kapak-{cl}.webp', 'WEBP', quality=80, method=6)

# 3b. ortak betik: motor + sayfa kodu. Dile özel veri sayfadaki window.TF_PAGE'de.
s_open = '<script>\n/*ENGINE*/\n</script>\n<script>\n'
i0 = src.index(s_open)
i1 = src.rindex('</script>')
body_src = src[src.index('</style>') + len('</style>'):i0]
head_src = src[:src.index('</style>') + len('</style>')]
head_src = re.sub(r'<title>.*?</title>\n|<meta name="claude:viewport-fit-sides"[^>]*>\n|<meta name="description"[^>]*>\n', '', head_src)
main = src[i0 + len(s_open):i1]
for k, v in (('/*MSGS*/', 'TFD.msg'), ('/*SITEL10N*/', 'TFD.sx'), ('/*SIM*/', SIM), ('/*LEARN*/', LEARN), ('/*ASSETS*/null', 'null')):
    assert k in main, k
    main = main.replace(k, v)
app = ('/*! Token Tahmini / Token Forecast — site betiği. SPDX-License-Identifier: AGPL-3.0-or-later. '
       'Kaynak: https://github.com/H-ENES1/ai-assistant-claude (site/build) */\n' + engine + '\n' + main.strip() + '\n')
wr(f'{DOCS}/app.js', app)
APPV = hashlib.sha256(app.encode()).hexdigest()[:10]

ICON = ('<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 26 26%22%3E%3Ccircle cx=%2213%22 cy=%2213%22 r=%2211.5%22 '
        'fill=%22none%22 stroke=%22%23141413%22 stroke-width=%222%22/%3E%3Cpath d=%22M13 13 L19.5 7.5%22 stroke=%22%23d97757%22 stroke-width=%222.6%22 stroke-linecap=%22round%22/%3E'
        '%3Ccircle cx=%2213%22 cy=%2213%22 r=%222%22 fill=%22%23141413%22/%3E%3C/svg%3E">')
URL = {l: BASE + ('' if l == 'tr' else l + '/') for l in LANGS}
esc = lambda s: html.escape(s, quote=True)


def rel(frm, to):
    up = '' if frm == 'tr' else '../'
    return (up + ('' if to == 'tr' else to + '/')) or './'


def head_for(l):
    S = SEO[l]
    cl = 'tr' if l == 'tr' else 'en'
    og_img = f'{BASE}img/og-{cl}.png'
    alt = ''.join(f'<link rel="alternate" hreflang="{x}" href="{URL[x]}">\n' for x in LANGS) + f'<link rel="alternate" hreflang="x-default" href="{URL["en"]}">\n'
    loc_alt = ''.join(f'<meta property="og:locale:alternate" content="{SEO[x]["locale"]}">\n' for x in LANGS if x != l)
    app_ld = {
        '@context': 'https://schema.org', '@type': 'SoftwareApplication',
        'name': 'Token Tahmini' if l == 'tr' else 'Token Forecast', 'alternateName': ['Token Forecast for Claude', 'Token Tahmini' if l != 'tr' else 'Token Forecast'],
        'description': S['desc'], 'inLanguage': HTML_LANG.get(l, l), 'url': URL[l], 'image': og_img,
        'screenshot': f'{BASE}img/{cl}/oneri.webp',
        'applicationCategory': 'BrowserApplication', 'operatingSystem': 'Chrome, Edge, Opera, Brave',
        'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'USD'},
        'author': {'@type': 'Person', 'name': 'Hayrettin Enes Karalı', 'url': 'https://github.com/H-ENES1'},
        'license': 'https://www.gnu.org/licenses/agpl-3.0.html', 'downloadUrl': STORE, 'installUrl': STORE,
        'isAccessibleForFree': True,
    }
    return (f'<!doctype html>\n<html lang="{HTML_LANG.get(l, l)}">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            f'<title>{esc(S["title"])}</title>\n<meta name="description" content="{esc(S["desc"])}">\n'
            f'<link rel="canonical" href="{URL[l]}">\n{alt}'
            '<meta property="og:type" content="website">\n<meta property="og:site_name" content="Token Forecast">\n'
            f'<meta property="og:title" content="{esc(S["ogTitle"])}">\n<meta property="og:description" content="{esc(S["desc"])}">\n'
            f'<meta property="og:url" content="{URL[l]}">\n<meta property="og:image" content="{og_img}">\n'
            '<meta property="og:image:type" content="image/png">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n'
            f'<meta property="og:image:alt" content="{esc(S["ogTitle"])}">\n<meta property="og:locale" content="{S["locale"]}">\n{loc_alt}'
            f'<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="{esc(S["ogTitle"])}">\n'
            f'<meta name="twitter:description" content="{esc(S["desc"])}">\n<meta name="twitter:image" content="{og_img}">\n'
            '<meta name="author" content="Hayrettin Enes Karalı">\n'
            '<meta name="theme-color" content="#faf9f5" media="(prefers-color-scheme: light)">\n<meta name="theme-color" content="#262624" media="(prefers-color-scheme: dark)">\n'
            f'{ICON}\n<script type="application/ld+json">{js_json(app_ld)}</script>\n<!--FAQLD-->\n'
            + head_src + '\n</head>\n')


HINT_JS = ('(function(){var P=%s,H=%s;var el=document.getElementById("langHint"),s=null,w=null;'
           'try{if(localStorage.getItem("tf-hint-off")==="1")return;s=localStorage.getItem("tf-lang");}catch(e){}'
           'if(s&&H[s])w=s;else{var L=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||""];'
           'for(var i=0;i<L.length;i++){var b=String(L[i]).toLowerCase().split(/[-_]/)[0];if(H[b]){w=b;break;}}}'
           'if(!w||w===P)return;var h=H[w],a=document.getElementById("lhA"),x=document.getElementById("lhX");'
           'el.lang=h.l;document.getElementById("lhT").textContent=h.a;a.textContent=h.g;a.href=h.u;x.setAttribute("aria-label",h.c);x.title=h.c;el.hidden=false;'
           'a.addEventListener("click",function(){try{localStorage.setItem("tf-lang",w);}catch(e){}});'
           'x.addEventListener("click",function(){el.hidden=true;try{localStorage.setItem("tf-hint-off","1");}catch(e){}});})();')


# Sayfa sonu: dil seçici app.js'i beklemeden çalışır. Yazı tipleri ve app.js, tarayıcı ilk içerikli boyamayı bildirdikten
# sonra yüklenir (metin önce sistem yazı tipiyle görünür; telefonda ilk boyamayı geciktirmezler). Olay gelmezse 4 sn sonra.
# F: yazı tipi CSS adresleri, 3e adımı doldurur.
LOADER_JS = ('(function(){var P=window.TF_PAGE,s=document.getElementById("langSel");'
             's.addEventListener("change",function(){try{localStorage.setItem("tf-lang",s.value);}catch(e){}if(s.value!==P.lang&&P.urls[s.value])location.href=P.urls[s.value];});'
             'var F="__TF_FONTS__",done=0;function go(){if(done++)return;'
             '(F.links||[]).forEach(function(u){var l=document.createElement("link");l.rel="stylesheet";l.href=u;document.head.appendChild(l);});'
             'var j=document.createElement("script");j.src=%s;document.body.appendChild(j);}'
             'function later(){setTimeout(go,0);}'
             'try{var po=new PerformanceObserver(function(l){if(l.getEntriesByName("first-contentful-paint").length){po.disconnect();later();}});po.observe({type:"paint",buffered:true});}'
             'catch(e){requestAnimationFrame(later);}setTimeout(go,4000);})();')


def body_for(l):
    cl = 'tr' if l == 'tr' else 'en'
    root = '' if l == 'tr' else '../'
    b = body_src
    hints = {x: {'a': SEO[x]['hint']['avail'], 'g': SEO[x]['hint']['go'], 'c': SEO[x]['hint']['close'], 'u': rel(l, x), 'l': HTML_LANG.get(x, x)} for x in LANGS}
    hint = ('<div id="langHint" class="langhint" hidden><div class="wrap"><span id="lhT"></span><a id="lhA" href="./"></a>'
            '<button type="button" id="lhX">×</button></div></div>\n'
            f'<script>{HINT_JS % (js_json(l), js_json(hints))}</script>\n')
    b = b.replace('<!--LANGHINT-->\n', hint)
    cur = ' aria-current="page"'
    links = ''.join(f'<li><a href="{rel(l, x)}" hreflang="{x}" lang="{HTML_LANG.get(x, x)}"{cur if x == l else ""}>{esc(SEO[x]["name"])}</a></li>' for x in LANGS)
    b = b.replace('<!--LANGLINKS-->\n', f'    <nav aria-label="Language"><ul class="langs">{links}</ul></nav>\n')

    # ekran görüntüleri: dile göre WebP, 1x/2x, gerçek boyut
    def shot(m):
        n = m.group(1)
        W, H, w, h = DIMS[(cl, n)]
        return (f'<a class="zoom" data-img="{n}" href="{root}img/{cl}/{n}.webp"{m.group(2)}><img data-img="{n}"{m.group(3)}'
                f'src="{root}img/{cl}/{n}.webp" srcset="{root}img/{cl}/{n}-1x.webp {w}w, {root}img/{cl}/{n}.webp {W}w" sizes="{SIZES.get(n, SIZES_DEF)}"'
                f'{m.group(4)}width="{w}" height="{h}" loading="lazy" decoding="async">')
    b, k = re.subn(r'<a class="zoom" data-img="(\w+)" href="img/tr/\w+\.png"([^>]*)><img data-img="\w+"( [^>]*?)src="img/tr/\w+\.png"( alt="[^"]*" )width="\d+" height="\d+" loading="lazy">', shot, b)
    assert k == len(SHOTS), k
    b = b.replace('poster="video/kapak-tr.jpg"', f'poster="{root}video/kapak-{cl}.webp"')
    data = {'lang': l, 'root': root, 'ext': 'webp', 'urls': {x: rel(l, x) for x in LANGS},
            'msg': {l: MSGS[l], 'en': MSGS['en']} if l != 'en' else {'en': MSGS['en']}}
    if l in SX:
        data['sx'] = {l: SX[l]}
    else:
        data['sx'] = {}
    return ('<body>\n' + b.lstrip('\n') + f'<script id="tfPage">window.TF_PAGE={js_json(data)};</script>\n'
            f'<script>{LOADER_JS % js_json(root + "app.js?v=" + APPV)}</script>\n</body>\n</html>\n')


for l in LANGS:
    page = head_for(l) + body_for(l)
    wr(os.path.join(DOCS, 'index.html') if l == 'tr' else os.path.join(DOCS, l, 'index.html'), page)

# 3c. sabit dosyalar, site haritası
for f in os.listdir(os.path.join(HERE, 'static')):
    shutil.copy(os.path.join(HERE, 'static', f), os.path.join(DOCS, f))
open(os.path.join(DOCS, '.nojekyll'), 'w').write('')
today = datetime.date.today().isoformat()
alts = ''.join(f'    <xhtml:link rel="alternate" hreflang="{x}" href="{URL[x]}"/>\n' for x in LANGS) + f'    <xhtml:link rel="alternate" hreflang="x-default" href="{URL["en"]}"/>\n'
sm = ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
      + ''.join(f'  <url>\n    <loc>{URL[l]}</loc>\n    <lastmod>{today}</lastmod>\n{alts}  </url>\n' for l in LANGS)
      + f'  <url>\n    <loc>{BASE}privacy.html</loc>\n    <lastmod>2026-10-23</lastmod>\n  </url>\n</urlset>\n')
wr(os.path.join(DOCS, 'sitemap.xml'), sm)

# 3d. metni HTML'e yaz (JS'siz okunur), SSS yapısal verisi, paylaşım görselleri
subprocess.run([node, os.path.join(HERE, 'prerender.cjs'), DOCS], check=True)

# 3e. yazı tipleri. Ölçüm (Lighthouse, telefon): tüm aileler Google'dan 406 KB idi (tr) ve ilk boyamayı geciktiriyordu.
#     Şimdi Google Fonts'tan yalnızca sayfada geçen harfler istenir (text= alt kümesi, tr: 148 KB): Newsreader (başlık yazısı)
#     başlık/rakam harfleriyle, Inter ve IBM Plex Mono sayfanın (ve sayfa verisinin) tüm harfleriyle. Japonca/Çince gibi
#     bu yazı tiplerinde olmayan harfler zaten sistem yazı tipine düşer, listeye girmez. Yükleme sayfa sonundaki
#     betikle, ilk içerikli boyamadan sonra (LOADER_JS).
from urllib.parse import quote
FONT_RE = re.compile(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com/css2\?[^"]*" media="print" onload="this\.media=\'all\'">\n<noscript><link rel="stylesheet" href="https://fonts\.googleapis\.com/css2\?[^"]*"></noscript>\n')
in_font = lambda c: 32 <= ord(c) < 0x530 or 0x2000 <= ord(c) < 0x2300
ASCII = ''.join(chr(c) for c in range(32, 127))
GF = 'https://fonts.googleapis.com/css2?'


def font_urls(page):
    body = page[page.index('<body>'):]
    disp = ' '.join(m[1] for m in re.findall(r'<(h1|h2|h3)\b[^>]*>(.*?)</\1>', body, re.S))
    disp += ' '.join(re.findall(r'<(?:div|b) class="(?:v|v good|v water|big|mono)"[^>]*>(.*?)</(?:div|b)>', body, re.S))
    disp = html.unescape(re.sub(r'<[^>]+>', ' ', disp)) + 'Token TahminiForecast 0123456789%.,:;<>≈×→–-+()/ '
    allc = html.unescape(re.sub(r'<[^>]+>', ' ', page)) + ASCII
    cs = lambda t: quote(''.join(sorted({c for c in t if in_font(c)})), safe='')
    return [GF + f'family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap&text={cs(disp)}',
            GF + f'family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap&text={cs(allc)}']


for l in LANGS:
    f = os.path.join(DOCS, 'index.html') if l == 'tr' else os.path.join(DOCS, l, 'index.html')
    page = rd(f)
    urls = font_urls(page)
    page, k = FONT_RE.subn(lambda m: '<noscript>' + ''.join(f'<link rel="stylesheet" href="{u}">' for u in urls) + '</noscript>\n', page)
    assert k == 1 and page.count('"__TF_FONTS__"') == 1, (l, k)
    page = page.replace('"__TF_FONTS__"', js_json({'links': urls}))
    wr(f, page)
print('pages ok', {l: os.path.getsize(os.path.join(DOCS, 'index.html') if l == 'tr' else os.path.join(DOCS, l, 'index.html')) for l in LANGS}, 'app.js', os.path.getsize(f'{DOCS}/app.js'))
