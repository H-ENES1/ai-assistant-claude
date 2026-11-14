# Son karedeki QR kodu: mağaza adresini kodlar, site/build/video/qr.js dosyasına modül ızgarası olarak yazar.
#   pip install qrcode
#   python site/build/video/qr.py            -> qr.js
#   python site/build/video/qr.py kare.png   -> bir video karesindeki QR'ı okuyup adresi doğrular (opencv-python gerekir)
import os
import sys

URL = 'https://chromewebstore.google.com/detail/chbjpjhmkpgfocnfpdafkakjicdicige'
HERE = os.path.dirname(os.path.abspath(__file__))

if len(sys.argv) > 1:
    import cv2
    bad = 0
    for p in sys.argv[1:]:
        img = cv2.imread(p)
        txt = cv2.QRCodeDetector().detectAndDecode(img)[0] if img is not None else ''
        ok = txt == URL
        bad += not ok
        print(('ok   ' if ok else 'HATA ') + os.path.basename(p) + ('' if ok else ' -> ' + repr(txt)))
    sys.exit(1 if bad else 0)

import qrcode
q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=0)
q.add_data(URL)
q.make(fit=True)
rows = [''.join('1' if c else '0' for c in r) for r in q.get_matrix()]
with open(os.path.join(HERE, 'qr.js'), 'w', encoding='utf8', newline='\n') as f:
    f.write('// python site/build/video/qr.py üretir; elle düzenleme. Adres: ' + URL + '\n')
    f.write('window.VQR = [\n' + ''.join(f'  "{r}",\n' for r in rows) + '];\n')
print('qr.js', len(rows), 'modül')
