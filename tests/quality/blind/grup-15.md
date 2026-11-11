# Grup 15

Ölçüt: doğruluk, eksiksizlik, istemin istediğini yapma. 1–5 (yarım puan olur). Etiketler her istemde yeniden karıştırıldı.


---

## r30

**İSTEM:**

Arduino ile sıcaklık sensöründen veri okuyan kod yaz

### r30 · A

En yaygın sensörlerden **DHT22 (veya DHT11)** için örnek kod aşağıda. Sıcaklığın yanında nemi de ölçer.

## Gerekenler
- Arduino Uno (ya da benzeri)
- DHT22 veya DHT11 sensörü
- 10 kΩ direnç (sensör modül değilse, DATA ile VCC arasına)

## Bağlantı
| DHT22 | Arduino |
|-------|---------|
| VCC   | 5V      |
| DATA  | D2      |
| GND   | GND     |

## Kütüphane
Arduino IDE'de **Araçlar > Kütüphaneleri Yönet** menüsünü açın. **"DHT sensor library" (Adafruit)** kütüphanesini kurun. Sizden istenirse **Adafruit Unified Sensor** kütüphanesini de kurun.

## Kod
```cpp
#include <DHT.h>

#define DHTPIN 2        // DATA pininin bağlı olduğu dijital pin
#define DHTTYPE DHT22   // DHT11 kullanıyorsanız: DHT11

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(9600);
  dht.begin();
  Serial.println("Sicaklik sensoru baslatildi...");
}

void loop() {
  delay(2000);  // DHT22 en fazla 2 saniyede bir okunabilir

  float nem = dht.readHumidity();
  float sicaklik = dht.readTemperature();      // Celsius
  float sicaklikF = dht.readTemperature(true); // Fahrenheit

  // Okuma başarısızsa uyar
  if (isnan(nem) || isnan(sicaklik)) {
    Serial.println("Hata: Sensorden veri okunamadi!");
    return;
  }

  Serial.print("Sicaklik: ");
  Serial.print(sicaklik);
  Serial.print(" °C  (");
  Serial.print(sicaklikF);
  Serial.print(" °F)  |  Nem: %");
  Serial.println(nem);
}
```

Kodu yükleyin ve **Seri Monitör**'ü 9600 baud hızında açın. Ölçümler her 2 saniyede bir ekrana gelir.

## Alternatif: LM35 (analog sensör, kütüphane gerekmez)
Bağlantı: VCC → 5V, OUT → A0, GND → GND

```cpp
const int sensorPin = A0;

void setup() {
  Serial.begin(9600);
}

void loop() {
  int ham = analogRead(sensorPin);           // 0-1023
  float voltaj = ham * (5.0 / 1023.0);       // Volt cinsinden
  float sicaklik = voltaj * 100.0;           // LM35: 10 mV/°C

  Serial.print("Sicaklik: ");
  Serial.print(sicaklik);
  Serial.println(" °C");
  delay(1000);
}
```

## İpuçları
- "Veri okunamadı" hatası alıyorsanız önce kabloları kontrol edin. Sonra koddaki `DHTTYPE` değerinin sensörünüzle aynı olduğundan emin olun.
- DHT11 daha ucuzdur ama hassasiyeti düşüktür (±2 °C). DHT22 ise ±0,5 °C hassasiyetle ölçer.
- Su geçirmez bir prob istiyorsanız **DS18B20** iyi bir seçenektir. Bu sensör OneWire ve DallasTemperature kütüphaneleriyle çalışır.

Hangi sensörü kullandığınızı söylerseniz kodu ona göre uyarlayabilirim. İsterseniz verileri LCD ekranda göstermeyi de ekleyebilirim.

### r30 · B

Aşağıda LM35 analog sıcaklık sensörünü okuyan bir örnek var. LM35, her 10 mV için 1 °C çıkış verir.

Bağlantı:
- LM35 sol bacak (+VS) → 5V
- Orta bacak (VOUT) → A0
- Sağ bacak (GND) → GND

```cpp
const int SENSOR_PIN = A0;
const float VREF = 5.0;     // Arduino referans gerilimi (V)
const int ADC_MAX = 1023;   // 10 bit ADC

void setup() {
  Serial.begin(9600);
}

void loop() {
  long toplam = 0;
  for (int i = 0; i < 10; i++) {   // gürültüyü azaltmak için ortalama al
    toplam += analogRead(SENSOR_PIN);
    delay(10);
  }
  float ortalama = toplam / 10.0;
  float gerilim = ortalama * VREF / ADC_MAX;
  float sicaklik = gerilim * 100.0;  // 10 mV / °C

  Serial.print("Sicaklik: ");
  Serial.print(sicaklik, 1);
  Serial.println(" C");

  delay(1000);
}
```

Açıklama:
- analogRead() 0-1023 arasında bir değer döndürür.
- Bu değeri gerilime çevirmek için ADC_MAX ve VREF kullanılır.
- LM35 çıkışı 10 mV/°C olduğundan gerilim × 100 sıcaklığı (°C) verir.
- Birden fazla okumanın ortalaması, değeri daha stabil hale getirir.

Not: 3.3V ile çalışan kartlarda VREF değerini 3.3 yapın. Uno'da 5V kullanılır.

DHT11 veya DHT22 kullanıyorsanız sensör dijitaldir; analogRead yerine DHT kütüphanesi gerekir. Arduino IDE Kütüphane Yöneticisi'nden "DHT sensor library" (Adafruit) kurun:

```cpp
#include <DHT.h>

#define DHTPIN 2
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(9600);
  dht.begin();
}

void loop() {
  float t = dht.readTemperature();
  if (isnan(t)) {
    Serial.println("Okuma hatasi");
  } else {
    Serial.print("Sicaklik: ");
    Serial.print(t);
    Serial.println(" C");
  }
  delay(2000);
}
```

DHT11 sensörü en fazla 2 saniyede bir okunabilir.

### r30 · C

Aşağıda en yaygın seçenek olan **LM35** (analog) sensörü için örnek var. DHT11/DHT22 kullanıyorsan en altta kısa bir not da ekledim.

## Bağlantı (LM35)
- Sol bacak (+Vs): Arduino **5V**
- Orta bacak (Vout): **A0**
- Sağ bacak (GND): **GND**

## Kod

```cpp
const int SENSOR_PIN = A0;      // LM35 çıkışı
const int ORNEK_SAYISI = 10;    // Gürültüyü azaltmak için ortalama

void setup() {
  Serial.begin(9600);
}

void loop() {
  long toplam = 0;

  for (int i = 0; i < ORNEK_SAYISI; i++) {
    toplam += analogRead(SENSOR_PIN);
    delay(10);
  }

  float ortalama = toplam / (float)ORNEK_SAYISI;

  // 5V referans, 10 bit ADC (0-1023); LM35: 10 mV / °C
  float voltaj = ortalama * (5.0 / 1023.0);
  float sicaklikC = voltaj * 100.0;

  Serial.print("Sicaklik: ");
  Serial.print(sicaklikC, 1);
  Serial.println(" C");

  delay(1000);
}
```

## Nasıl çalışır?
1. `analogRead()` 0-1023 arasında bir değer okur.
2. Bu değer voltaja çevrilir (`değer * 5.0 / 1023.0`).
3. LM35 her 10 mV için 1 °C verir, yani voltaj x 100 = sıcaklık.
4. 10 okumanın ortalaması alınarak dalgalanma azaltılır.

Sonucu görmek için Arduino IDE'de **Seri Port Monitörü**'nü aç ve hızı **9600** yap.

## İpuçları
- Daha hassas ölçüm için `analogReference(INTERNAL);` kullanıp 1.1 V referansla hesaplayabilirsin (voltaj = ortalama * 1.1 / 1023.0). Bu durumda 110 °C'ye kadar ölçersin.
- Okumalar oynaksa sensörün besleme bacakları arasına 0.1 µF kondansatör ekle.

## DHT11 / DHT22 kullanıyorsan
"DHT sensor library" (Adafruit) kütüphanesini kur:

```cpp
#include <DHT.h>

#define DHTPIN 2
#define DHTTYPE DHT11   // DHT22 ise değiştir
DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(9600);
  dht.begin();
}

void loop() {
  float t = dht.readTemperature();
  if (isnan(t)) {
    Serial.println("Okuma hatasi!");
  } else {
    Serial.print("Sicaklik: ");
    Serial.print(t);
    Serial.println(" C");
  }
  delay(2000);
}
```

Hangi sensörü kullandığını (LM35, DS18B20, DHT, NTC vb.) söylersen koduna göre uyarlayabilirim.


---

## r01

**İSTEM:**

Türkiye'nin başkenti neresi?

### r01 · A

Türkiye'nin başkenti Ankara'dır. Ankara, 13 Ekim 1923'te, Cumhuriyet'in ilanından kısa bir süre önce başkent olarak ilan edilmiştir. Bu tarihe kadar başkent İstanbul'du. Ankara, ülkenin İç Anadolu Bölgesi'nde yer alır ve nüfus bakımından İstanbul'dan sonra ikinci büyük şehirdir.

### r01 · B

Türkiye'nin başkenti **Ankara**'dır. Ankara, 13 Ekim 1923'te başkent ilan edilmiştir. Bu tarih, Cumhuriyet'in 29 Ekim 1923'teki ilanından kısa bir süre öncesine denk gelir. Türkiye'nin en kalabalık şehri ise İstanbul'dur.

### r01 · C

Türkiye'nin başkenti Ankara'dır. Cumhuriyet'in ilan edildiği 29 Ekim 1923'ten bu yana başkent Ankara'dır. İstanbul ise Türkiye'nin en kalabalık şehridir ve Osmanlı Devleti'nin başkentliğini yapmıştır.


---

## t02

**İSTEM:**

Çok dilli bir web sitesi yapıyorum, çeviri özelliği olan, kullanıcı girişli, veritabanlı. Baştan sona kodla.

### t02 · A

Bu kapsam büyük, o yüzden tek seferde her şeyi yazmak yerine adım adım ilerlemek daha sağlıklı. Aşağıda yığın önerisi, klasör yapısı ve ilk temel kodları veriyorum.

**Önerilen yığın**
- Next.js (App Router) + TypeScript
- PostgreSQL + Prisma (veritabanı)
- Auth.js (NextAuth) ile e-posta/şifre giriş
- next-intl ile çeviri; diller URL'de (`/tr`, `/en`)

**Klasör yapısı**
```
app/[locale]/layout.tsx
app/[locale]/page.tsx
app/[locale]/login/page.tsx
app/api/auth/[...nextauth]/route.ts
messages/tr.json
messages/en.json
prisma/schema.prisma
i18n/request.ts
middleware.ts
```

**1. Çeviri yönlendirmesi (middleware.ts)**
```ts
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['tr', 'en'],
  defaultLocale: 'tr',
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
```

**2. Çeviri dosyası (messages/tr.json)**
```json
{ "home": { "title": "Hoş geldiniz" }, "login": { "submit": "Giriş yap" } }
```

**3. Veritabanı (prisma/schema.prisma)**
```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  locale       String   @default("tr")
  createdAt    DateTime @default(now())
}
```

**Sonraki adımlar**
1. Kimlik doğrulama: Auth.js ile giriş/kayıt, şifreler bcrypt ile hashlenir.
2. Korumalı sayfalar: middleware veya sunucu tarafında oturum kontrolü.
3. Çeviri içeriği: veritabanındaki metinler için dil alanı (ör. `Post` ve `PostTranslation` tabloları).
4. Test ve dağıtım.

Hâlâ netleşmesi gerekenler:
- Hangi içerik çevrilecek: sabit arayüz metinleri mi, kullanıcıların girdiği içerik mi?
- Giriş yöntemi: yalnızca e-posta/şifre mi, Google/GitHub ile giriş de olacak mı?
- Veritabanı tercihin var mı (PostgreSQL, MySQL, SQLite)?
- Hedef: yalnızca yerel geliştirme mi, yoksa Vercel gibi bir yerde yayın mı?

Bu cevapları verirsen, bir sonraki adımda çalışan projeyi dosya dosya kurabilirim.

### t02 · B

Bütün bir siteyi tek mesajda yazmak mümkün değil, o yüzden çalışan ve büyütülebilir bir iskelet veriyorum. "Çeviri"yi arayüzün çok dilli olması (i18n) olarak varsaydım. Kullanıcı içeriğinin otomatik çevrilmesini (DeepL/Google API) istiyorsan söyle, onu da eklerim.

**Kullanılanlar:** Node.js + Express, SQLite, bcrypt, express-session

```bash
npm init -y
npm i express express-session better-sqlite3 bcrypt
```

**locales.js**
```js
module.exports = {
  tr: { welcome: "Hoş geldin", login: "Giriş", register: "Kayıt ol", logout: "Çıkış" },
  en: { welcome: "Welcome", login: "Log in", register: "Sign up", logout: "Log out" }
};
```

**server.js**
```js
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const Database = require("better-sqlite3");
const locales = require("./locales");

const db = new Database("app.db");
db.exec(`CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, email TEXT UNIQUE, hash TEXT)`);

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(session({ secret: process.env.SECRET || "dev", resave: false, saveUninitialized: false }));

// Dil seçimi: ?lang=en → oturumda saklanır
app.use((req, res, next) => {
  const lang = req.query.lang || req.session.lang;
  req.session.lang = locales[lang] ? lang : "tr";
  req.t = locales[req.session.lang];
  next();
});

const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const page = body => `<!doctype html><meta charset="utf-8">
<a href="?lang=tr">TR</a> | <a href="?lang=en">EN</a><hr>${body}`;
const form = (action, label) => `<form method="post" action="${action}">
<input name="email" type="email" required>
<input name="password" type="password" minlength="8" required>
<button>${label}</button></form>`;

app.get("/", (req, res) => {
  const t = req.t, u = req.session.user;
  res.send(page(u
    ? `<h1>${t.welcome}, ${esc(u)}</h1><a href="/logout">${t.logout}</a>`
    : form("/login", t.login) + form("/register", t.register)));
});

app.post("/register", async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 12);
  try {
    db.prepare("INSERT INTO users(email, hash) VALUES (?, ?)").run(req.body.email, hash);
    res.redirect("/");
  } catch { res.status(400).send("Bu e-posta zaten kayıtlı"); }
});

app.post("/login", async (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE email = ?").get(req.body.email);
  if (!u || !(await bcrypt.compare(req.body.password, u.hash)))
    return res.status(401).send("E-posta veya şifre hatalı");
  req.session.regenerate(() => { req.session.user = u.email; res.redirect("/"); });
});

app.get("/logout", (req, res) => req.session.destroy(() => res.redirect("/")));

app.listen(3000, () => console.log("http://localhost:3000"));
```

Çalıştırmak için: `node server.js`

**Yayına almadan önce mutlaka yap:**
- `SECRET` ortam değişkenini güçlü bir değerle ayarla, HTTPS'e geç ve `cookie: { secure: true }` ekle.
- CSRF koruması (`csrf-sync`) ve giriş denemelerine sınır (`express-rate-limit`) ekle.
- Oturumları kalıcı bir yerde sakla (`connect-sqlite3`), büyüyünce PostgreSQL'e geç.

Proje büyüyecekse Next.js + next-intl + Auth.js + Prisma daha uygun olur. Hangi teknolojileri kullanmak istediğini ve "çeviri"den ne kastettiğini söylersen ona göre genişleteyim.

### t02 · C

Baştan sona yapılabilir, ama tek cevapta tüm kodu vermem mantıklı olmaz. Önce birkaç şeyi netleştirelim, sonra parça parça ilerleyelim.

**Önce sorularım**
1. Site ne yapacak (blog, e-ticaret, panel)? Hangi diller?
2. "Çeviri özelliği" ne demek: arayüz metinlerinin çevirisi mi (i18n), kullanıcıların girdiği içeriğin otomatik çevirisi mi, yoksa yönetici panelinden elle çeviri girişi mi?
3. Hangi dilleri/teknolojileri biliyorsun? Nereye yayınlayacaksın?
4. Giriş yöntemi: e-posta/şifre, Google ile giriş, ikisi birden?

**Önerdiğim yığın (tercihin yoksa)**
- Next.js (App Router) + TypeScript
- Çok dillilik: `next-intl` (`/tr`, `/en` gibi yol tabanlı diller, `messages/tr.json`, `messages/en.json`)
- Kullanıcı girişi: Auth.js (NextAuth)
- Veritabanı: PostgreSQL + Prisma
- Otomatik çeviri gerekiyorsa: DeepL veya Google Translate API (sunucu tarafında, sonuçları veritabanında önbelleğe alarak)

**Veritabanı fikri (içerik çevirisi için)**
```prisma
model User { id String @id @default(cuid())
  email String @unique
  passwordHash String
  locale String @default("tr") }

model Post { id String @id @default(cuid())
  translations PostTranslation[] }

model PostTranslation {
  id String @id @default(cuid())
  postId String
  locale String
  title String
  body String
  post Post @relation(fields: [postId], references: [id])
  @@unique([postId, locale]) }
```

**Adımlar**
1. Proje kurulumu + `next-intl` ile dil yönlendirmesi ve dil değiştirici
2. Prisma şeması + migrasyon
3. Kayıt/giriş (şifreler `bcrypt`/`argon2` ile hashlenir, oturum çerezi httpOnly)
4. İçerik CRUD ve dil bazlı gösterim (dil yoksa varsayılan dile düş)
5. Çeviri API'si entegrasyonu (anahtar sunucuda, istemciye asla gitmez)
6. Güvenlik: girdi doğrulama (zod), CSRF, hız sınırı, `.env` ile gizli anahtarlar
7. Yayın: Vercel + yönetilen Postgres (Neon/Supabase)

Cevaplarına göre 1. adımdan başlayıp her adımın tam kodunu (dosya dosya) verebilirim. Kendi bilgisayarında çalıştırmak istersen proje bir klasörde oluşturulup doğrudan çalışır hâle de getirilebilir. Soruları yanıtlarsan ya da "önerdiğin yığınla başla" dersen hemen başlarım.


---

## c03

**İSTEM:**

olm bayadır kullanıom bu kişisel ölçüm saymıyor sanırım

### c03 · A

Anladığım kadarıyla uzun süredir bu aracı kişisel amaçla kullanıyorsun ve kullanımının sistem tarafından sayılmadığını düşünüyorsun. Bunu doğrulayamam; elimde bu araca ait bir ölçüm kaydı, sayaç ya da hesap bilgisi yok ve bu konuşmada herhangi bir dosyaya ya da sisteme bakmadım.

Kullanımın nasıl sayıldığını anlamak için bakabileceğin birkaç yer var:

- Hesap ayarları veya kullanım/faturalandırma sayfası: Hangi dönemde ne kadar kullanıldığı genellikle burada görünür.
- Kullandığın arayüz: Mobil uygulama, web, masaüstü ya da bir API entegrasyonu farklı şekilde ölçülebilir. Her biri için kullanım bilgisi ayrı yerde olabilir.
- Sayaçların sıfırlanma tarihi: Kullanım limitleri belirli periyotlarla yenilenir; bu yüzden eski kullanımın görünmediği izlenimi oluşabilir.
- Oturum ve hesap: Farklı bir hesapla ya da farklı bir cihazda oturum açmış olabilirsin. Kullanım başka bir hesaba yazılmış olabilir.

Eğer "kişisel ölçüm" ile kastettiğin başka bir şeyse, örneğin kendi yazdığın bir ölçüm aracı, bir takip tablosu ya da bir uygulamanın istatistik ekranı, biraz daha açıklarsan hangi kaydın neden eksik göründüğünü birlikte inceleyebiliriz. Hangi arayüzü kullandığını, bunu ne zaman fark ettiğini ve ekranda ne gördüğünü yazman yeterli olur.

### c03 · B

Tam olarak neyi kastettiğini anlayamadım. "Bu" dediğin şey ne, ve "saymıyor" derken neyi kastediyorsun? Birkaç ihtimal var:

1. **Cihaz ölçümünü kaydetmiyor/saymıyor:** Akıllı saat, bileklik, tartı, tansiyon ya da şeker ölçer gibi bir şey kullanıyorsan ve ölçümler uygulamada görünmüyorsa genelde sebebi şunlardan biri oluyor:
   - Cihaz başka bir kullanıcı profiline eşleşmiş (özellikle aile ortak kullanıyorsa tartılarda çok olur)
   - Bluetooth senkronizasyonu kopmuş, uygulama arka planda çalışmıyor
   - Uygulama izinleri (Sağlık / Google Fit / Health Connect) kapalı
   - Profil bilgilerin (yaş, boy, kilo, cinsiyet) eksik ya da yanlış girilmiş

2. **"Kişisel ölçüm resmi sayılmıyor" demek istiyorsan:** Bu doğru. Evde aldığın ölçümler (tansiyon, şeker, kilo, nabız vs.) kendini takip etmek için çok faydalı, ama doktor, sigorta ya da resmi bir işlem için tek başına geçerli belge sayılmaz. Yine de düzenli kaydedip doktora götürürsen çoğu doktor bu verilere bakar ve işine yarar.

3. **Bir uygulama ya da hizmetteki kullanım sayacından bahsediyorsan:** Mesela bir abonelik, puan ya da istatistik sistemi kullanımını saymıyorsa bunun sebebi oturumun açık olmaması, farklı hesapla girmen ya da verinin gecikmeyle güncellenmesi olabilir.

Hangi cihazı ya da uygulamayı kullandığını ve tam olarak neyin sayılmadığını yazarsan daha net yardımcı olurum.

### c03 · C

Valla "bu" derken neyi kastettiğini tam anlayamadım, o yüzden birkaç ihtimale göre gidiyorum. Hangisi olduğunu söylersen nokta atışı yardım ederim.

**Önce şunu sorayım:** Hangi uygulama, cihaz ya da hizmet bu? (Akıllı saat, bileklik, adım sayar, bir sağlık uygulaması, bir oyun, bir ölçüm/istatistik sayfası... ) Marka ve model, bir de ne saymıyor (adım, uyku, nabız, kalori, puan vb.) yazarsan iş çok kolaylaşır.

**Genel olarak "ölçüm saymıyor" durumunda en sık sebepler:**

1. **Senkronizasyon:** Cihaz ile telefondaki uygulama eşleşmemiş ya da veri buluta gitmemiş olabilir. Uygulamayı aç, elle senkronize et, Bluetooth'un açık olduğuna bak.
2. **İzinler:** Uygulamanın konum, fiziksel aktivite, sağlık verisi ya da arka planda çalışma izni kapanmış olabilir. Telefon güncellemelerinden sonra bu izinler sık sık sıfırlanır.
3. **Pil tasarrufu:** Telefon uygulamayı arka planda kapatıyordur. Pil optimizasyonundan uygulamayı muaf tut.
4. **Kişisel hesap/profil ayarı:** "Kişisel" ölçüm ile "genel", "ekip" ya da "paylaşılan" ölçüm ayrı sayılıyor olabilir. Bazı sistemlerde sadece belirli koşullarda (örneğin belli süre, belli mod, doğrulanmış cihaz) kayıt sayılır. Profil ve gizlilik ayarlarına bak.
5. **Tarih/saat dilimi sorunu:** Cihazın saati yanlışsa kayıtlar başka güne düşebilir, "saymıyor" gibi görünür.
6. **Yazılım hatası ya da güncelleme:** Uygulamayı ve cihaz yazılımını güncelle. Olmazsa uygulamayı kaldırıp yeniden kurmak (verin hesabında duruyorsa) çoğu zaman çözer.
7. **Cihaz kullanımı:** Sensör kirli olabilir, cihaz bilekte gevşek durabilir ya da yanlış koldaki ayar seçilmiş olabilir.

**Hızlı bir deneme:** Uygulamayı tamamen kapat, cihazı yeniden başlat, tekrar aç ve 5 dakika hareket edip sayacın değişip değişmediğine bak. Cihaz ekranında sayıyor ama uygulamada görünmüyorsa sorun senkronizasyonda. Cihazda da saymıyorsa sorun sensörde ya da ayarlarda.

Bir de "bayadır" kullanıyorsun diyorsun; yani eskiden sayıyordu da bir noktada mı bıraktı, yoksa hiç saymadı mı? Bunun da cevabı sebebi çok daraltır (güncelleme sonrası mı, pil değişince mi, hesap değişince mi başladı gibi).

Bana şu üçünü yaz, gerisini hallederiz:
- Ne kullanıyorsun (marka/uygulama)?
- Tam olarak neyi saymıyor?
- Ne zaman başladı?


---

## r21

**İSTEM:**

Hafta sonu yapılacak 5 etkinlik fikri ver

### r21 · A

İşte hafta sonu için 5 etkinlik fikri:

1. **Doğa yürüyüşü veya piknik**
   Şehrin yakınındaki bir orman, göl kenarı ya da milli parkta kısa bir yürüyüş planla. Yanına basit bir piknik sepeti al. Hem temiz hava hem sohbet için çok uygun. Hava yağışlıysa yürüyüşü bir müze gezisiyle değiştirebilirsin.

2. **Evde film veya dizi maratonu**
   Bir tema belirle (örneğin bir yönetmenin filmleri, klasik korku ya da çocukluk animasyonları). Atıştırmalıkları hazırla, battaniyeni al ve telefonu kenara koy. Arkadaşlarını davet edersen film sonrası tartışma da eğlenceli olur.

3. **Yeni bir tarif veya mutfak günü**
   Daha önce hiç yapmadığın bir yemeği dene: ev yapımı pizza, mantı ya da bir tatlı. İstersen arkadaşlarınla "herkes bir yemek yapsın" usulü bir sofra kur. Hem öğretici hem de sonunda yiyebileceğin bir ödülü var.

4. **Şehirde keşif turu**
   Hep önünden geçip hiç girmediğin bir semti, kafeyi, kitapçıyı ya da sergiyi keşfet. Bir fotoğraf makinesi ya da telefon kamerasıyla gezip en güzel kareleri biriktirebilirsin. Akşam da yerel bir restoranda yemek yiyerek günü tamamlayabilirsin.

5. **Yeni bir hobiye başlama günü**
   Resim, çizim, seramik, gitar, örgü ya da bir dil öğrenme gibi merak ettiğin bir şeye birkaç saat ayır. Çevrimiçi başlangıç dersleri veya atölyeler bunun için ideal. Küçük bir adım bile yeni bir tutku başlatabilir.

**Bonus ipucu:** Hafta sonunun bir gününü tamamen dinlenmeye ayırmayı unutma. Planlı etkinlikler kadar hiçbir şey yapmamak da insanı toparlar. Bütçen, havan ve kiminle vakit geçirmek istediğin (yalnız, partner, aile, arkadaşlar) belliyse, sana daha kişiye özel öneriler de verebilirim.

### r21 · B

İşte hafta sonu için farklı zevklere hitap eden 5 etkinlik fikri:

**1. Doğa yürüyüşü ve piknik**
Şehre yakın bir orman, göl kenarı ya da yürüyüş parkuru seçin. Yanınıza termosta çay veya kahve, sandviç ve meyve alın. Hem hareket etmiş hem de kafanızı dinlemiş olursunuz. Rahat ayakkabı ve hava durumuna uygun kıyafet unutmayın.

**2. Evde tematik yemek günü**
Bir mutfak seçin (İtalyan, Meksika, Japon ya da Ege mutfağı gibi) ve birlikte baştan sona bir menü hazırlayın. Yeni bir tarif denemek, alışverişi beraber yapmak ve sofrayı temaya uygun kurmak etkinliği eğlenceli hale getirir. Arkadaşlarınızı da davet edebilirsiniz.

**3. Müze, sergi veya tarihi mekân gezisi**
Kendi şehrinizde hiç gitmediğiniz bir müzeyi, sanat galerisini ya da tarihi semti keşfedin. Birçok müzenin belirli günlerde ücretsiz veya indirimli girişi olur. Gezinin sonunda yakındaki bir kafede mola vermek günü güzel tamamlar.

**4. Kitap, film veya dizi maratonu**
Dinlenmeye ihtiyacınız varsa evde rahat bir köşe hazırlayın. Uzun süredir okumak istediğiniz bir kitabı bitirin ya da bir film serisini (örneğin bir üçlemeyi) baştan sona izleyin. Patlamış mısır ve battaniye eşliğinde tam bir dinlenme günü olur.

**5. Yeni bir beceri öğrenme atölyesi**
Seramik, resim, fotoğrafçılık, dans ya da kahve demleme gibi tek günlük bir atölyeye katılın. Birçok kültür merkezi ve kafe hafta sonu kısa kurslar düzenler. Hem yeni insanlarla tanışır hem de rutin dışına çıkmış olursunuz.

**Küçük bir ipucu:** Cumartesiyi daha aktif bir etkinliğe, pazarı ise dinlenmeye ayırırsanız yeni haftaya daha enerjik başlarsınız. İsterseniz bütçenize, şehrinize ya da kiminle vakit geçireceğinize göre daha özel öneriler de hazırlayabilirim.

### r21 · C

Hafta sonu için 5 etkinlik fikri:

1. **Doğa yürüyüşü ve piknik:** Şehrin dışındaki bir orman ya da göl kenarı patikasını seçin. Yanınıza sandviç, meyve ve termos çay alın. Yürüyüşü kısa tutarsanız hem sporu hem dinlenmeyi bir arada yaşarsınız.

2. **Yerel pazar ve sokak yemeği turu:** Semtinizdeki pazarı gezin, mevsim sebze ve meyvelerinden birkaç tane alın. Ardından eve dönüp bu malzemelerle basit bir yemek hazırlayın.

3. **Ev yemeği atölyesi:** Arkadaşlarınızı ya da ailenizi çağırın. Herkes bir yemeğin bir kısmını hazırlasın. Tarifleri birlikte denemek, yemekten daha eğlenceli bir deneyim sunar.

4. **Müze, galeri veya kütüphane ziyareti:** Şehrinizdeki bir sergiyi ya da kütüphanenin etkinlik programını inceleyin. Sonrasında kısa bir kahve molasıyla gördüklerinizi konuşun.

5. **Bir hobiye başlama günü:** Seramik, resim, fotoğrafçılık ya da bahçecilik gibi yeni bir uğraş seçin. Bir kurs ya da atölye bulabilirsiniz. Ya da evde küçük bir saksı bitkisi ekip bakımını üstlenebilirsiniz.

Bu fikirlerden hangisini seçerseniz, plan yapmak isterseniz yardımcı olabilirim. Bütçenize, hava durumuna ya da kaç kişiyle yapacağınıza göre öneriyi daraltabilirim.
