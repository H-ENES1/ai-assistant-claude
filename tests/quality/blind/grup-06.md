# Grup 06

Ölçüt: doğruluk, eksiksizlik, istemin istediğini yapma. 1–5 (yarım puan olur). Etiketler her istemde yeniden karıştırıldı.


---

## r37

**İSTEM:**

Bu React uygulamasını baştan sona refactor et, state yönetimini Redux'tan Zustand'a taşı, tüm testleri güncelle

### r37 · A

Bu isteği yerinde uygulamak için projeye erişmem gerekir. Şu an elimde kod yok, bu yüzden bir yol haritası ve sorular sunuyorum.

**1. Mevcut durumu çıkar**
- Redux store yapısını (slice'lar, reducer'lar, thunk veya saga gibi middleware'ler) ve bağımlılıkları (`react-redux`, `@reduxjs/toolkit`) listele.
- Kullanım yerlerini bul: `useSelector`, `useDispatch`, `connect`, `Provider`.
- Test altyapısını kontrol et: Jest mi Vitest mi, React Testing Library var mı, `redux-mock-store` gibi bağımlılıklar var mı.

**2. Zustand'a eşleme**
- Her slice için bir store oluştur: `create<State>()(...)`. State ve action'lar aynı store'da olsun.
- Reducer'daki switch-case yapısı yerine doğrudan `set` ve `get` çağrıları kullan.
- Thunk'ları store action'ı içinde async fonksiyon olarak yaz.
- Selector'larda tek değer seçmek için `useStore(s => s.x)` kullan. Nesne döndüren selector'larda `useShallow` kullan, yoksa gereksiz render olur.
- Kalıcılık gerekiyorsa `persist`, geliştirici araçları için `devtools` middleware'ini ekle.
- Redux `Provider`'ını kaldır. Store'u modül düzeyinde export et.
- TypeScript kullanılıyorsa state ve action'lar için açık tipler tanımla.

**3. Refactor adımları (sırayla, her adımda testler yeşil kalmalı)**
1. Zustand'ı ekle ve bir slice'ı taşı.
2. Bileşenlerdeki `useSelector` ve `useDispatch` çağrılarını yeni hook'lara çevir.
3. Her slice taşındıktan sonra testleri çalıştır.
4. Redux bağımlılıklarını ve `Provider`'ı kaldır.
5. Ölü kodu temizle.

**4. Testler**
- `Provider` sarmalayıcılarını kaldır. Store'u doğrudan kullan.
- Store'lar modül düzeyinde olduğu için her testten önce `store.setState(initialState, true)` ile sıfırla.
- `redux-mock-store` gibi kütüphaneleri kaldır. Gerekirse gerçek Zustand store'unu kullan.
- Reducer testleri, store action testlerine dönüşür: `act(() => useStore.getState().action())` çağır, sonra state'i kontrol et.
- Async akışlar için API katmanını mock'la (ör. MSW).

**5. Riskler**
- Redux DevTools'a bağlı kayıt ve replay özellikleri kaybolur.
- Store'lar singleton olduğu için testler arasında state sızabilir. Sıfırlama zorunludur.
- Tüm uygulamayı tek seferde değiştirmek yerine kademeli geçiş daha güvenlidir.

Bir sonraki adımda proje dosya yapısını (özellikle `store/` veya `slices/` klasörünü), `package.json` dosyasını ve birkaç örnek bileşen ile test dosyasını paylaşırsan, bu planı gerçek dosyalara göre somutlaştırıp refactor'a başlayabilirim.

### r37 · B

Bunu yapabilmem için önce kodu görmem gerekiyor; şu an projenin dosyaları elimde değil. Şunları paylaşırsan başlarım:

- `package.json`
- Redux store kurulumu (store, slice'lar/reducer'lar, middleware)
- Store'a bağlı birkaç bileşen
- Mevcut testlerden örnekler (Jest mi Vitest mi, React Testing Library var mı?)

Proje büyükse hepsini bir kerede yapıştırmak yerine slice slice ilerlemek daha güvenli olur. İzleyeceğim yol şu:

**1. Envanter:** Slice'lar, async thunk'lar, selector'lar ve middleware'ler (redux-persist, saga vb.) listelenir.

**2. Her slice için bir Zustand store:**

```js
// Önce (Redux Toolkit)
const counterSlice = createSlice({
  name: 'counter',
  initialState: { value: 0 },
  reducers: { increment: (s) => { s.value += 1 } },
});

// Sonra (Zustand)
import { create } from 'zustand';
export const useCounterStore = create((set) => ({
  value: 0,
  increment: () => set((s) => ({ value: s.value + 1 })),
}));
```

**3. Bileşenler:** `useSelector`/`useDispatch` yerine `useCounterStore((s) => s.value)` gelir. Birden fazla alan seçerken `useShallow` kullanılır, böylece gereksiz render olmaz.

**4. Thunk'lar:** Async action'lar store'un içinde düz `async` fonksiyonlara dönüşür.

**5. Middleware karşılıkları:** redux-persist yerine `persist`, Redux DevTools için `devtools`, mutasyon tarzı yazıma alışkınsanız `immer` (hepsi `zustand/middleware` altında).

**6. Kademeli geçiş:** İki sistem bir süre yan yana çalışabilir. Slice'lar tek tek taşınır, her adımda testler yeşil tutulur. `<Provider>` en son kaldırılır.

**7. Testler:** `renderWithProviders` ve mock store'lar kaldırılır. Her testten önce store sıfırlanır:

```js
const initialState = useCounterStore.getState();
beforeEach(() => useCounterStore.setState(initialState, true));
```

Store mantığı bileşen render etmeden de test edilebilir: `useCounterStore.getState().increment()`.

**Netleştirmem gereken bir nokta:** "Baştan sona refactor" ile yalnızca state geçişini mi kastediyorsun, yoksa klasör yapısı, TypeScript'e geçiş, bileşenlerin bölünmesi gibi başka değişiklikleri de mi? Bunları aynı anda yapmak, bir şey bozulduğunda sebebini bulmayı zorlaştırır. Önce state geçişini davranışı değiştirmeden bitirmeyi, genel refactor'u ise ayrı bir adımda yapmayı öneririm.

Kodu paylaş, ilk slice'tan başlayalım.

### r37 · C

Mesajında kod, repo ya da dosya yok; bu yüzden uygulamanı göremiyorum ve "baştan sona" refactor yapamam. Kodu (veya en azından store, slice, selector ve birkaç temsilci bileşen ile test dosyalarını) paylaşırsan somut değişiklikleri yazabilirim. Aşağıda göç için güvenli bir yol haritası var.

**Önce netleştirmem gerekenler**
- Redux Toolkit mı, eski tarz reducer/saga mı kullanıyorsun? Thunk, saga, RTK Query var mı?
- Kaç slice var, ne kadar bileşen `useSelector`/`connect` kullanıyor?
- Test aracı ne: Jest veya Vitest, React Testing Library?
- "Refactor" ile sadece state taşıma mı kastediyorsun, yoksa klasör yapısı ve bileşen bölme de dahil mi?

**Önerdiğim yaklaşım: tek seferde değil, kademeli**
Tüm uygulamayı bir anda çevirmek hem riskli hem gözden geçirmesi zor bir PR üretir.

1. **Envanter:** Her slice'ı, action'ı, selector'ı ve async akışı listele. Hangileri gerçekten istemci state'i, hangileri sunucu verisi (bunlar TanStack Query'ye gitmeye daha uygun olabilir)?
2. **Test güvenceni kur:** Taşımaya başlamadan önce davranış testlerinin yeşil olduğundan emin ol. Mümkünse testleri store'a değil kullanıcı davranışına bağla; böylece göçte az değişirler.
3. **Slice slice taşı:** Her slice için bir Zustand store yaz (`create`), action'ları store içindeki fonksiyonlara çevir, thunk'ları `async` fonksiyonlara dönüştür. Bileşenlerde `useSelector` yerine `useStore(s => s.alan)` kullan; çoklu alan için `useShallow` ekle.
4. **Geçiş dönemi:** Redux ve Zustand bir süre birlikte yaşayabilir. Her slice ayrı commit olsun.
5. **Testleri güncelle:** `Provider` sarmalayıcılarını kaldır. Zustand için her testten önce store'u sıfırla (`useStore.setState(initialState, true)` veya resmi dokümandaki mock yaklaşımı). Async testlerde `act` ve `findBy*` kullan.
6. **Temizlik:** `redux`, `react-redux`, `@reduxjs/toolkit` bağımlılıklarını kaldır, kullanılmayan dosyaları sil, Redux DevTools gerekiyorsa Zustand `devtools` middleware'ini ekle.

**Dikkat edilecekler**
- Zustand'da tek global store yerine alan başına küçük store'lar ya da slice pattern'i tercih et.
- Selector'ı geniş tutma; aksi halde gereksiz render olur.
- Persist gerekiyorsa `persist` middleware'i.

Kodu gönderirsen, ilk slice için tam bir dönüşüm ve ona ait güncellenmiş test örneğini hemen yazarım.


---

## r22

**İSTEM:**

x^2 - 5x + 6 = 0 denklemini çöz

### r22 · A

**Denklem:** x² − 5x + 6 = 0

**Çarpanlara ayırma yöntemi**

Çarpımı 6, toplamı −5 olan iki sayı arıyoruz: −2 ve −3.

(x − 2)(x − 3) = 0

Bir çarpım sıfırsa çarpanlardan en az biri sıfırdır:

- x − 2 = 0 → x = 2
- x − 3 = 0 → x = 3

**Diskriminant ile doğrulama**

a = 1, b = −5, c = 6

Δ = b² − 4ac = 25 − 24 = 1

x = (−b ± √Δ) / 2a = (5 ± 1) / 2

- x₁ = (5 + 1) / 2 = 3
- x₂ = (5 − 1) / 2 = 2

**Kontrol**

- x = 2: 4 − 10 + 6 = 0 ✓
- x = 3: 9 − 15 + 6 = 0 ✓

**Çözüm kümesi:** {2, 3}

Not: Kökler toplamı 2 + 3 = 5 (= −b/a), kökler çarpımı 2 · 3 = 6 (= c/a) olduğundan sonuç Vieta bağıntılarıyla da uyumludur.

### r22 · B

Denklem: x² - 5x + 6 = 0

Çarpanlarına ayırma yöntemi:
Çarpımı 6, toplamı -5 olan iki sayı aranır: -2 ve -3.
x² - 5x + 6 = (x - 2)(x - 3) = 0

Her çarpan ayrı ayrı sıfıra eşitlenir:
x - 2 = 0 ise x = 2
x - 3 = 0 ise x = 3

Kontrol:
x = 2 için: 4 - 10 + 6 = 0 (sağlar)
x = 3 için: 9 - 15 + 6 = 0 (sağlar)

Diskriminant yöntemiyle doğrulama:
Δ = b² - 4ac = 25 - 24 = 1
x = (5 ± 1) / 2, buradan x₁ = 3 ve x₂ = 2

Cevap: x = 2 veya x = 3

### r22 · C

**Çözüm: x = 2 veya x = 3**

**1. Yol: Çarpanlara ayırma**

Çarpımı 6, toplamı −5 olan iki sayı arıyoruz: −2 ve −3.

x² − 5x + 6 = (x − 2)(x − 3) = 0

Buradan:
- x − 2 = 0 → **x = 2**
- x − 3 = 0 → **x = 3**

**2. Yol: Diskriminant (kontrol)**

a = 1, b = −5, c = 6

Δ = b² − 4ac = 25 − 24 = 1

x = (5 ± √1) / 2 → x₁ = 3, x₂ = 2

**Doğrulama:**
- x = 2: 4 − 10 + 6 = 0 ✓
- x = 3: 9 − 15 + 6 = 0 ✓

**Çözüm kümesi: {2, 3}**


---

## t05

**İSTEM:**

Sitem için çeviri sistemi kurmam gerekiyor, hangi yöntem iyi

### t05 · A

Yöntem, sitenizin nasıl yapıldığına bağlı. Önce onu netleştirmek gerekir.

**1. Statik site üreteci (Next.js, Astro, Hugo, Jekyll vb.)**
- Her dil için ayrı URL yapısı kullanın (örneğin /tr/ ve /en/).
- Metinleri JSON veya YAML dil dosyalarında tutun.
- Next.js için next-intl, Astro ve Hugo'nun yerleşik çoklu dil desteği bu işi standart biçimde çözer.
- Avantajı: Her dilin kendi URL'si olur, arama motorları için uygundur ve hreflang etiketleri kolay eklenir.

**2. Düz HTML sitesi**
- Metinleri tr.json ve en.json gibi dosyalara taşıyın, dil seçimine göre JavaScript ile metinleri değiştirin.
- Küçük siteler için yeterlidir.
- Dezavantajı: Tüm dillerin tek URL altında olması SEO için zayıftır. Mümkünse dil başına ayrı sayfalar üretin.

**3. WordPress veya benzeri CMS**
- Polylang (ücretsiz) veya WPML eklentisini kullanın.

**4. Çeviri servisleri**
- DeepL veya Google Translate API ile çevirileri otomatik üretebilirsiniz.
- Çeviriyi çalışma zamanında değil, build aşamasında yapıp sonucu dosyaya yazmak hem maliyeti hem gecikmeyi düşürür.
- Otomatik çeviriler mutlaka bir insan tarafından gözden geçirilmelidir, özellikle pazarlama ve hukuki metinlerde.

**Önerim (genel durum için)**
1. Tüm metinleri koddan ayırıp anahtar-değer dosyalarına taşıyın. Bu adım her yöntemde ortaktır.
2. Dil başına ayrı URL kullanın.
3. İlk taslak çevirileri DeepL ile üretip bir kişinin kontrol etmesini sağlayın.

Sitenizin teknolojisini (Next.js, WordPress, düz HTML vb.) ve kaç dil gerektiğini yazarsanız somut bir kurulum önerebilirim.

### t05 · B

En doğru yöntem sitenin hangi teknolojiyle yapıldığına ve kaç dil hedeflediğine bağlı. Çoğu durumda önerim: **i18n kütüphanesi + ayrı çeviri dosyaları**.

## Başlıca seçenekler

**1. Kod tabanlı i18n (kendi kodunu yazıyorsan önerilen)**
Metinleri koddan ayırıp dil dosyalarında tutarsın (`tr.json`, `en.json`). Kodda metin yerine anahtar kullanılır: `t("menu.anasayfa")`.
- React / Next.js: `next-intl`, `react-i18next`
- Vue / Nuxt: `vue-i18n`, `@nuxtjs/i18n`
- Laravel: yerleşik `__()` ve `lang/` klasörü
- Django: gettext (`.po` dosyaları)

Artısı: hızlı, SEO dostu, tam kontrol. Eksisi: kurulum emeği ister.

**2. CMS eklentisi**
- WordPress: Polylang (ücretsiz), WPML, TranslatePress
- Shopify: Translate & Adapt

Kod bilmeden sayfa ve ürün içeriklerini çevirebilirsin.

**3. Çeviri yönetim platformu (TMS)**
Crowdin, Lokalise, Phrase veya açık kaynak Tolgee. Dil dosyalarını çevirmenlerle senkronize eder, makine çevirisi önerir. Çok dilli ve büyüyen projeler için 1. yöntemin üstüne eklenir.

**4. Otomatik çeviri servisi / widget**
Weglot hızlı ve SEO destekli ama ücretli. Google Translate widget'ı ise kalite ve SEO açısından zayıf; ciddi bir site için önermem.

## Dikkat edilmesi gerekenler

- **URL yapısı:** `site.com/en/`, `site.com/tr/` gibi alt dizinler en pratik ve SEO dostu seçenek.
- **hreflang etiketleri** ekle ki Google doğru dili doğru kullanıcıya göstersin.
- **Dil seçici** koy; tarayıcı diline göre zorla yönlendirme yapma, en fazla öner.
- **Tarih, sayı, para birimi** için `Intl` API veya kütüphanenin biçimlendirme fonksiyonlarını kullan.
- **Çoğul ve değişkenli ifadeler** için ICU formatı kullan; cümleleri string birleştirerek kurma (`"Sepette " + n + " ürün"` yerine `t("sepet", { n })`), çünkü dillerin kelime sırası farklı.
- **Makine çevirisi** (DeepL, yapay zekâ) taslak için iyi ama önemli sayfaları bir insan gözden geçirsin.
- İleride Arapça gibi **sağdan sola** diller düşünüyorsan CSS'te logical properties (`margin-inline-start` vb.) kullan.

## Kısa tavsiye

- WordPress → Polylang veya WPML
- Next.js / React / Vue gibi kendi kodun → `next-intl` / `vue-i18n`, büyürse Tolgee veya Crowdin
- Hızlı çözüm, kod yok → Weglot

Siten hangi altyapıyla yapıldı ve kaç dil eklemek istiyorsun? Söylersen adım adım kurulumu anlatabilirim.

### t05 · C

En iyi yöntem, sitenin teknolojisine ve çeviri hacmine bağlı. Ama genel olarak şu seçenekler var.

## 1. Çeviri dosyaları (i18n kütüphanesi) — çoğu proje için önerilen yöntem

Metinleri koddan ayırıp her dil için ayrı bir dosyada (JSON, PO, YAML) tutarsınız. Kod yalnızca anahtarları kullanır, ör. `t("giris.baslik")`.

- **Artıları:** SEO dostu, hızlı, çeviri kalitesini siz kontrol edersiniz, çoğul/tarih/para birimi biçimlendirmesi hazır gelir.
- **Eksileri:** Başta kurulum ve düzenli bakım ister.
- **Kütüphane örnekleri:**
  - React/Next.js: `next-intl`, `react-i18next`
  - Vue: `vue-i18n`
  - Django: yerleşik gettext
  - Laravel: yerleşik lang dosyaları
  - WordPress: WPML, Polylang veya TranslatePress

## 2. Çeviri yönetim platformu ekleme

Çeviri dosyalarını Crowdin, Lokalise, Weblate veya Phrase gibi bir platformla senkronize edersiniz. Çevirmenler web arayüzünden çalışır, değişiklikler otomatik olarak depoya gelir. Birden fazla çevirmen veya sık güncelleme varsa çok işe yarar.

## 3. Otomatik makine çevirisi (Google Translate widget'ı vb.)

Kurulumu en kolay yöntemdir ama kalite ve kontrol düşüktür. İçerik arama motorlarında düzgün indekslenmez. Kurumsal veya satış odaklı bir site için pek önermem. Yalnızca geçici çözüm veya düşük öncelikli sayfalar için uygundur.

## 4. Hibrit yaklaşım (benim önerim)

Yapay zekâ veya DeepL ile ilk taslağı üretin, sonra bir insan gözden geçirsin. Sonucu seçenek 1 veya 2'deki yapıya kaydedin. Hız ile kaliteyi dengeler.

## Dikkat edilecek noktalar

- **URL yapısı:** `/tr/`, `/en/` gibi alt dizinler SEO için genellikle en iyisidir. Ayrıca `hreflang` etiketlerini ekleyin.
- **Varsayılan dil:** Tarayıcı diline göre yönlendirin ama kullanıcıya dil seçtirme imkânı da bırakın.
- **Metin uzunluğu:** Almanca gibi diller daha uzundur, tasarımınız taşmaya dayanıklı olsun.
- **Sağdan sola diller:** Arapça veya İbranice planlıyorsanız baştan RTL desteğini düşünün.
- **Veritabanı içeriği:** Ürün, blog gibi dinamik içerikler için ayrı bir çeviri tablosu veya CMS desteği gerekir.

## Kısa tavsiye

- Küçük, statik site: i18n dosyaları veya hazır eklenti.
- Büyüyen ürün: i18n kütüphanesi + Crowdin/Lokalise + yapay zekâ taslağı + insan kontrolü.

Siteniz hangi teknolojiyle yapıldı (WordPress, React, Next.js, PHP vb.), kaç dil ve kaç sayfa planlıyorsunuz? Bunu söylerseniz size net bir kurulum önerebilirim.


---

## c10

**İSTEM:**

Şu cümledeki yazım hatalarını düzelt: bugun hava cok guzel

### c10 · A

Bugün hava çok güzel.

### c10 · B

Düzeltilmiş cümle: **Bugün hava çok güzel.**

Düzeltilen yazım hataları:
- "bugun" → "Bugün" (ü harfi eksikti, ayrıca cümle büyük harfle başlamalı)
- "cok" → "çok" (ç harfi eksikti)
- "guzel" → "güzel" (ü harfi eksikti)

### c10 · C

Düzeltilmiş hâli:

**Bugün hava çok güzel.**

Yapılan düzeltmeler:
- **bugun → Bugün:** "ü" harfi eklendi; cümle başı olduğu için büyük harfle başlatıldı.
- **cok → çok:** "c" yerine "ç" yazıldı.
- **guzel → güzel:** "u" yerine "ü" yazıldı.
- Cümle sonuna nokta eklendi.


---

## r43

**İSTEM:**

Bu konuyla ilgili 10 slaytlık bir sunum hazırla

### r43 · A

Hangi konuda sunum hazırlamamı istediğinizi belirtmediniz. Önceki mesajlarda da bir konu geçmiyor, bu yüzden konuyu bilmeden içerik üretemem.

Konuyu yazarsanız, aşağıdaki yapıda 10 slaytlık bir sunum hazırlayabilirim:

1. Kapak: Sunum başlığı, sunan kişi, tarih
2. Gündem: Sunumun akışı
3. Konuya giriş: Neden önemli?
4. Temel kavramlar: Tanımlar ve kapsam
5. Mevcut durum: Güncel veriler ve eğilimler
6. Ana bulgu 1
7. Ana bulgu 2
8. Uygulama örnekleri: Somut vaka veya senaryo
9. Riskler ve sınırlılıklar
10. Sonuç ve öneriler: Özet ve sonraki adımlar

İsterseniz her slayt için kısa konuşma notu da ekleyebilirim. Hedef kitleyi (öğrenciler, yöneticiler, teknik ekip vb.), sunum süresini ve tercih ettiğiniz formatı (PowerPoint, Google Slides ya da görsel bir sayfa) da belirtirseniz içeriği ona göre ayarlarım.

### r43 · B

"Bu konu" ifadesiyle neyi kastettiğini göremiyorum; mesajında bir konu yer almıyor ve önceki bir konuşma da yok. Konuyu yazarsan sunumu hemen hazırlarım.

Bu arada, hangi konu olursa olsun işe yarayacak 10 slaytlık bir iskelet:

1. **Başlık slaytı:** Sunum başlığı, sunucu adı, tarih.
2. **Gündem:** Sunumda neleri ele alacağın (3-4 madde).
3. **Giriş ve önem:** Konu nedir, neden önemli? Dikkat çekici bir veri veya soruyla başla.
4. **Arka plan:** Kısa tarihçe ya da temel kavramlar.
5. **Mevcut durum:** Bugün konu nerede? Güncel rakamlar, grafik veya tablo.
6. **Temel sorunlar / fırsatlar:** En önemli 3 başlık.
7. **Örnek olay:** Somut bir vaka ya da uygulama örneği.
8. **Çözüm önerileri / yaklaşım:** Neler yapılabilir, hangi adımlar atılmalı?
9. **Gelecek perspektifi:** Beklenen gelişmeler ve eğilimler.
10. **Sonuç ve soru-cevap:** Ana mesajların özeti, kapanış cümlesi, kaynaklar.

**Tasarım ipuçları:**
- Slayt başına tek ana fikir, en fazla 5-6 kısa madde.
- Metin yerine görsel, grafik ve ikon kullan.
- En az 24 punto yazı boyutu, tutarlı renk paleti.
- Her slayta konuşmacı notu ekle; ayrıntıları orada anlat.

**Bana şunları söylersen sunumu sana özel yazarım:**
- Konu nedir?
- Hedef kitle kimdir (öğrenciler, yöneticiler, müşteriler vb.)?
- Süre ne kadar (ör. 10 veya 15 dakika)?
- Ton nasıl olsun (akademik, kurumsal, samimi)?
- İstediğin biçim nedir (slayt metinleri, konuşmacı notları, PowerPoint dosyası)?

Konuyu gönder, her slaytın başlığını, maddelerini ve konuşmacı notlarını yazayım.

### r43 · C

Memnuniyetle hazırlarım. Yalnız "bu konu" derken hangi konuyu kastettiğinizi göremiyorum. Sohbette bir konu, metin ya da dosya paylaşılmamış. Konuyu yazarsanız sunumu hemen hazırlarım.

İçeriği size daha iyi uydurabilmem için şu bilgiler de işe yarar (zorunlu değil):

- **Hedef kitle:** Öğrenciler mi, yöneticiler mi, teknik ekip mi, genel izleyici mi?
- **Amaç:** Bilgilendirmek mi, ikna etmek mi (örneğin bir proje ya da bütçe onayı), eğitim vermek mi?
- **Süre:** Kaç dakikalık bir sunum?
- **Ton:** Resmi mi, samimi mi?
- **Kaynak:** Kullanmamı istediğiniz bir metin, rapor ya da veri var mı?

Konuyu beklerken, çoğu konuya uyan 10 slaytlık bir taslak:

1. **Kapak:** Başlık, alt başlık, sunan kişi, tarih
2. **Gündem:** Sunumda neler konuşulacak
3. **Giriş / Arka plan:** Konu neden önemli, bağlamı ne
4. **Sorun ya da ihtiyaç:** Çözülmesi gereken mesele
5. **Temel kavramlar:** Bilinmesi gereken 3-4 ana fikir
6. **Veriler ve kanıtlar:** İstatistikler, grafikler, örnekler
7. **Çözüm / Yaklaşım:** Önerilen yol ya da yöntem
8. **Örnek vaka:** Somut bir uygulama ya da başarı hikayesi
9. **Sonuç ve öneriler:** Akılda kalması gereken 3 mesaj, sonraki adımlar
10. **Soru-cevap / Teşekkür:** İletişim bilgileri ve kaynaklar

Konuyu verdiğinizde her slayt için şunları hazırlarım:
- Başlık
- 3-5 maddelik içerik
- Konuşmacı notu (o slaytta ne anlatacağınız)
- Görsel ya da grafik önerisi

Hangi konuda hazırlayayım?
