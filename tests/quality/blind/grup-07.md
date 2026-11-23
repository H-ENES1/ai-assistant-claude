# Grup 07

Ölçüt: doğruluk, eksiksizlik, istemin istediğini yapma. 1–5 (yarım puan olur). Etiketler her istemde yeniden karıştırıldı.


---

## r11

**İSTEM:**

Bu makaleyi 5 maddede özetle

### r11 · A

Bu mesajla birlikte makalenin metni iletilmedi; yalnızca "Bu makaleyi 5 maddede özetle" yazılmış. Özetleyebilmem için makalenin metnini bu sohbete yapıştırman gerekiyor. Makale erişilebilir bir çevrimiçi sayfadaysa bağlantısını paylaşman da yeterli olabilir.

Metni aldığımda her biri kısa bir cümleyle ifade edilmiş, makalenin ana fikrini ve önemli bulgularını kapsayan 5 madde hazırlarım.

İstersen özetin uzunluğunu, dilini ya da hedef okurunu da belirtebilirsin. Örneğin teknik bir okur için daha ayrıntılı, genel bir okur için daha sade bir özet yazabilirim.

### r11 · B

Memnuniyetle özetlerim, ancak mesajınızda makale yer almıyor; bana yalnızca istek ulaştı.

Makaleyi şu yollardan biriyle paylaşabilirsiniz:

- **Metni doğrudan yapıştırın** (en güvenilir yöntem)
- **Dosya olarak ekleyin** (PDF, Word vb.)
- **Bağlantı gönderin** (bağlantıları açıp açamayacağım kullandığınız ortama bağlı, bu yüzden mümkünse metni yapıştırmanız daha iyi olur)

Makaleyi aldığımda ana fikirleri 5 kısa ve net madde halinde özetleyeceğim. Belirli bir odak isterseniz (örneğin yalnızca sonuçlar, yöntem ya da iş dünyasına etkileri) bunu da belirtebilirsiniz.

### r11 · C

Mesajında özetlenecek bir makale göremiyorum; metin veya bağlantı eklenmemiş görünüyor. Olmayan bir makaleyi özetlersem uydurma bilgi vermiş olurum, bu yüzden tahminde bulunmuyorum.

Şunlardan birini yapabilirsin:

1. **Metni yapıştır:** Makalenin tam metnini (veya özetlenmesini istediğin bölümü) buraya yapıştır.
2. **Bağlantı paylaş:** Makalenin URL'sini gönder. Erişebiliyorsam içeriği okuyup özetlerim; erişemezsem metni yapıştırmanı isterim.
3. **Dosya ver:** Makale PDF veya Word dosyasıysa dosya yolunu paylaş.

Metni aldığımda şu biçimde özetleyeceğim:

- Tam 5 madde, her biri kısa ve tek fikirli
- Makalenin ana tezi ilk maddede
- Temel bulgular, veriler veya argümanlar orta maddelerde
- Sonuç ve varsa pratik çıkarım son maddede
- Yalnızca makalede yazanlar; kendi yorumum ayrıca ve açıkça belirtilmiş olarak

İstersen özetin uzunluğunu, tonunu (akademik, sade, gazete haberi gibi) ya da hedef kitleni de belirtebilirsin; buna göre ayarlarım. Makaleyi gönder, hemen başlayayım.


---

## r31

**İSTEM:**

Write a SQL query that returns the top 10 customers by revenue.

### r31 · A

Since I don't know your schema, I'll assume two common tables: `customers(customer_id, name)` and `orders(order_id, customer_id, order_date, status, total_amount)`.

```sql
SELECT
    c.customer_id,
    c.name,
    SUM(o.total_amount) AS total_revenue
FROM customers AS c
JOIN orders AS o
    ON o.customer_id = c.customer_id
WHERE o.status = 'completed'          -- exclude cancelled/refunded orders
GROUP BY c.customer_id, c.name
ORDER BY total_revenue DESC
LIMIT 10;
```

**How it works**

- `JOIN` links each order to its customer.
- `SUM(o.total_amount)` adds up the revenue per customer.
- `GROUP BY` produces one row per customer.
- `ORDER BY ... DESC` puts the highest revenue first.
- `LIMIT 10` keeps only the top 10.

**Dialect notes**

- SQL Server: use `SELECT TOP 10 ...` and drop `LIMIT`.
- Oracle 12c+: use `FETCH FIRST 10 ROWS ONLY` instead of `LIMIT`.
- PostgreSQL, MySQL, SQLite: `LIMIT 10` works as written.

**Common variations**

1. If revenue lives in line items (`order_items(order_id, quantity, unit_price)`), compute it from them:

```sql
SELECT
    c.customer_id,
    c.name,
    SUM(oi.quantity * oi.unit_price) AS total_revenue
FROM customers c
JOIN orders o       ON o.customer_id = c.customer_id
JOIN order_items oi ON oi.order_id = o.order_id
GROUP BY c.customer_id, c.name
ORDER BY total_revenue DESC
LIMIT 10;
```

2. To restrict to a period, add a filter such as `AND o.order_date >= '2026-01-01' AND o.order_date < '2027-01-01'`.

3. Ties: if several customers share the 10th-place revenue and you want all of them, use `RANK()` in a subquery or CTE:

```sql
WITH ranked AS (
    SELECT c.customer_id, c.name,
           SUM(o.total_amount) AS total_revenue,
           RANK() OVER (ORDER BY SUM(o.total_amount) DESC) AS rnk
    FROM customers c
    JOIN orders o ON o.customer_id = c.customer_id
    GROUP BY c.customer_id, c.name
)
SELECT * FROM ranked WHERE rnk <= 10;
```

**Tips**

- Group by the customer ID, not just the name, because two customers can share a name.
- An index on `orders(customer_id)` helps the join on large tables.
- Use `LEFT JOIN` only if you also want customers with no orders, but that is not needed for a top-10 list.

If you share your actual table and column names and your database engine, I can adapt the query exactly.

### r31 · B

Here's a query that assumes a typical schema with a `customers` table and an `orders` table, where revenue is the sum of order amounts:

```sql
SELECT
    c.customer_id,
    c.customer_name,
    SUM(o.total_amount) AS total_revenue
FROM customers AS c
JOIN orders AS o
    ON o.customer_id = c.customer_id
WHERE o.status = 'completed'          -- leave out cancelled/refunded orders
GROUP BY c.customer_id, c.customer_name
ORDER BY total_revenue DESC
LIMIT 10;
```

**How it works**
- `JOIN` links each order to its customer.
- `SUM(o.total_amount)` adds up revenue per customer.
- `GROUP BY` gives one row per customer. Grouping by `customer_id` keeps two customers with the same name apart.
- `ORDER BY ... DESC LIMIT 10` keeps the 10 highest earners.

**If revenue comes from line items** (quantity × price), use this instead:

```sql
SELECT
    c.customer_id,
    c.customer_name,
    SUM(oi.quantity * oi.unit_price) AS total_revenue
FROM customers AS c
JOIN orders AS o       ON o.customer_id = c.customer_id
JOIN order_items AS oi ON oi.order_id = o.order_id
GROUP BY c.customer_id, c.customer_name
ORDER BY total_revenue DESC
LIMIT 10;
```

**Syntax differences between databases**
- **SQL Server:** use `SELECT TOP 10 ...` and drop `LIMIT`.
- **Oracle 12c+ / standard SQL:** replace `LIMIT 10` with `FETCH FIRST 10 ROWS ONLY`.

**Handling ties:** `LIMIT 10` cuts the list at exactly 10 rows, even if the 10th and 11th customers have the same revenue. To include everyone tied at the cutoff, use a window function:

```sql
SELECT *
FROM (
    SELECT
        c.customer_id,
        c.customer_name,
        SUM(o.total_amount) AS total_revenue,
        RANK() OVER (ORDER BY SUM(o.total_amount) DESC) AS revenue_rank
    FROM customers AS c
    JOIN orders AS o ON o.customer_id = c.customer_id
    GROUP BY c.customer_id, c.customer_name
) ranked
WHERE revenue_rank <= 10;
```

**Common adjustments**
- **Limit to a time period:** add something like `AND o.order_date >= '2025-01-01'` to the `WHERE` clause.
- **Net revenue:** subtract discounts, refunds or taxes if your schema stores them separately.

If you share your table and column names, I can fit the query to your schema.

### r31 · C

Assuming two tables, `customers(customer_id, name)` and `orders(order_id, customer_id, order_date, amount)`, this query returns the top 10 customers by total revenue:

```sql
SELECT
    c.customer_id,
    c.name,
    SUM(o.amount) AS total_revenue
FROM customers AS c
JOIN orders AS o
    ON o.customer_id = c.customer_id
GROUP BY
    c.customer_id,
    c.name
ORDER BY total_revenue DESC
LIMIT 10;
```

Notes:

- If revenue is stored per line item (quantity and unit price), join `order_items` and use `SUM(oi.quantity * oi.unit_price)` instead of `SUM(o.amount)`.
- To count only completed orders, add `WHERE o.status = 'completed'` before the `GROUP BY`.
- The inner `JOIN` excludes customers with no orders, which is fine for a top-10 list.
- `LIMIT 10` works in PostgreSQL, MySQL and SQLite. In SQL Server, use `SELECT TOP 10 ...` instead. In Oracle 12c or later, use `FETCH FIRST 10 ROWS ONLY`.
- If customers tied at 10th place should all be included, use `FETCH FIRST 10 ROWS WITH TIES` (Oracle, PostgreSQL 13+) or rank with `RANK() OVER (ORDER BY total_revenue DESC)` in a subquery and filter for ranks up to 10.


---

## r17

**İSTEM:**

Hocama ödev teslimini ertelemesi için kibar bir e-posta yaz

### r17 · A

Elbette! Aşağıda kendi durumuna göre düzenleyebileceğin kibar bir e-posta taslağı var. Köşeli parantez içindeki yerleri doldurman yeterli.

---

**Konu:** [Ders Kodu] – [Ödev Adı] Teslim Tarihi Hakkında Erteleme Talebi

Sayın [Unvan] [Hocanın Soyadı],

İyi günler dilerim. Ben [Ad Soyad], [Ders Adı / Kodu] dersinizin [şube/grup] öğrencisiyim. Öğrenci numaram [numara].

[Tarih] tarihinde teslim edilmesi gereken [Ödev Adı] ödevi ile ilgili olarak size yazıyorum. [Kısa ve dürüst gerekçe: Örneğin "Geçtiğimiz hafta geçirdiğim bir rahatsızlık nedeniyle birkaç gün çalışamadım" / "Aynı hafta içinde üst üste gelen sınavlar nedeniyle" / "Ailevi bir mesele sebebiyle"] ödevimi istediğim kalitede tamamlayamadım.

Şu ana kadar [ödevin ne kadarını yaptığın, ör. "literatür taramasını ve ilk bölümü"] tamamladım. Ödevi özenli ve eksiksiz bir şekilde teslim edebilmek için, uygun görmeniz hâlinde teslim süremin [ör. "3 gün" / "[yeni tarih]" tarihine kadar] uzatılmasını rica ediyorum.

Bu talebin sizin için ek bir yük oluşturabileceğinin farkındayım; anlayışınız için şimdiden teşekkür ederim. Gerekirse durumu belgeleyen [rapor/belge] iletebilirim ya da ofis saatlerinizde görüşmeye gelebilirim.

Saygılarımla,
[Ad Soyad]
[Öğrenci Numarası]
[Bölüm]
[Telefon / E-posta (isteğe bağlı)]

---

**Birkaç ipucu:**

- **Erken yaz:** Talebi son güne bırakmadan, mümkünse teslim tarihinden birkaç gün önce gönder.
- **Somut bir tarih öner:** "Biraz daha süre" yerine net bir tarih istemek, hocanın karar vermesini kolaylaştırır.
- **Gerekçeyi kısa ve dürüst tut:** Uzun açıklamalar yerine bir iki cümle yeterli.
- **İlerlemeni göster:** Ödeve başladığını belirtmek ciddiyetini gösterir.
- **Okul e-postanı kullan** ve konu satırına ders kodunu yaz.
- **Ders izlencesine (syllabus) bak:** Geç teslim kuralları yazıyorsa e-postada buna atıf yapabilirsin.

İstersen gerekçeni ve dersin bilgilerini yaz, e-postayı sana göre tamamen kişiselleştireyim.

### r17 · B

**Konu:** [Ders Adı] Ödev Teslim Tarihi Hakkında Rica

Sayın Hocam,

Umarım iyisinizdir. Ben [Ders Adı] dersinden [Öğrenci Numarası] numaralı öğrenciniz [Ad Soyad].

[Ödev adı/numarası] teslim tarihinin [teslim tarihi] olduğunun farkındayım. Ancak [kısa ve dürüst bir neden: örneğin sağlık sorunu, yoğun sınav haftası, ailevi bir durum] nedeniyle ödevimi zamanında, istediğiniz kalitede tamamlayamayacağım.

Ödeve gereken özeni göstermek ve eksiksiz bir çalışma teslim etmek istiyorum. Bu nedenle, uygun görürseniz teslim süresini [önerilen tarih, örneğin 3 gün / bir hafta] uzatabilir misiniz? Ödevin büyük bölümünü hazırladım; kalan kısmı belirttiğim tarihe kadar tamamlayıp size ileteceğimi taahhüt ederim.

Gerekirse durumumu destekleyen bir belgeyi (rapor, vb.) sizinle paylaşabilirim. Bu talebimin sizi zor durumda bırakabileceğinin farkındayım; anlayışınız ve ayırdığınız zaman için şimdiden çok teşekkür ederim.

Saygılarımla,

[Ad Soyad]
[Öğrenci Numarası]
[Bölüm / Sınıf]
[E-posta / Telefon]

---

**Kısa ipuçları:**
- Mümkünse teslim tarihinden önce gönderin; son dakikaya bırakmak talebin ciddiyetini azaltır.
- Nedeni abartmadan, dürüst ve kısa tutun.
- Net bir yeni tarih önermek, hocanın karar vermesini kolaylaştırır.

### r17 · C

Konu: Ödev Teslim Tarihi Hakkında Ertelem Talebi

Sayın Hocam,

[Ders adı] dersi için vermiş olduğunuz [ödev adı] ödevinin teslim tarihi konusunda sizinle iletişime geçmek istiyorum.

Açıkçası, bu hafta beklenmedik bazı kişisel ve akademik yükler nedeniyle ödevi planladığım zamanda tamamlayamayacağımı fark ettim. Ödevi özenle ve gerektiği kalitede hazırlamak istiyorum. Bu nedenle teslim tarihinin [yeni tarih] tarihine kadar ertelenmesini rica ediyorum.

Bu talepte bulunduğum için özür dilerim. Eğer bu süre uygun değilse anlayışınız için yine de teşekkür ederim; dilerseniz mevcut teslim tarihine uygun bir çalışma planı da paylaşabilirim.

Zamanınız ve anlayışınız için teşekkür ederim.

Saygılarımla,
[Adınız Soyadınız]
[Öğrenci numaranız]
[Bölüm / Sınıf]


---

## c04

**İSTEM:**

evet çalışıyor ama ekler kısmını ekleyip çıkarınca prompt değişmiyor öyle mi olması lazım

### c04 · A

Kısa cevap: büyük ihtimalle **hayır, öyle olmaması lazım**. Ama bu, "ekler"in sistemde nasıl kullanıldığına bağlı. Önceki konuşmayı göremiyorum, o yüzden iki durumu ayırayım:

**1. Ekler prompt metninin içine yazılıyorsa (beklenen davranış)**
Bir ek eklediğinde ya da çıkardığında, oluşan prompt da (önizleme ya da gönderilen metin) hemen değişmeli. Değişmiyorsa hata var demektir.

**2. Ekler ayrı bir alan olarak gönderiliyorsa (normal olabilir)**
Bazı sistemler dosya ve görselleri prompt metnine koymaz, API isteğinde ayrı bir parça olarak (ör. `attachments`, `files`, `images`) yollar. Bu durumda prompt metninin aynı kalması normaldir. Kontrol etmen gereken şey isteğin gövdesi (payload) olur.

**Hata varsa en sık sebepler:**

- **Prompt bir kere oluşturulup saklanıyor.** Sayfa açılınca ya da ilk tıklamada üretilip bir değişkende tutuluyor ve ekler değişince yeniden hesaplanmıyor.
- **Reaktivite / bağımlılık eksik.** React kullanıyorsan `useMemo`/`useEffect` bağımlılık dizisinde `ekler` (attachments) state'i yok. Vue'da da `computed` yerine düz bir değişken kullanılıyor olabilir.
- **State yerinde değiştiriliyor (mutation).** `ekler.push(...)` ya da `splice` ile aynı dizi değiştirilirse React değişikliği fark etmez. Bunun yerine `setEkler([...ekler, yeni])` / `setEkler(ekler.filter(...))` gibi yeni bir dizi ver.
- **Önizleme ile gönderilen prompt farklı kaynaktan geliyor.** Arayüzdeki metin eski state'ten, gönderilen metin güncel state'ten okunuyor olabilir (ya da tam tersi).
- **Önbellek.** Aynı girdiler için cache'lenmiş bir sonuç dönüyor ve cache anahtarında ekler yok.

**Hızlıca test etmek için:**
1. Prompt'u oluşturan fonksiyonun en başına `console.log(ekler)` koy. Ek ekleyip çıkarınca bu log tekrar çalışıyor mu, ve listede doğru öğeler var mı?
2. Tarayıcıda Network sekmesini aç, gönderilen isteğin gövdesine bak: ekler orada mı, prompt metni değişiyor mu?
3. Fonksiyon hiç tekrar çağrılmıyorsa sorun tetiklemede; çağrılıyor ama eski veriyi görüyorsa sorun state güncellemesinde.

Prompt'u oluşturan kısmı ve eklerin state'ini tutan kodu paylaşırsan (hangi framework olduğunu da yazarsan), sorunun tam nerede olduğunu gösterebilirim.

### c04 · B

Hayır, olmaması gereken bir durum. "Ekler" bölümünü açıp kapattığında prompt'un da buna göre değişmesi lazım. Değişmiyorsa büyük ihtimalle ya ekler prompt'a hiç bağlanmamış ya da prompt eski haliyle tekrar kullanılıyor.

Bunu görmeden kesin teşhis koyamam, çünkü hangi araçtan ya da koddan bahsettiğini bilmiyorum. Ama en sık nedenler şunlar:

1. **Önbellek / eski değer:** Prompt bir kez oluşturulup saklanıyor (cache, state, değişken) ve ekler değişince yeniden oluşturulmuyor. Uygulamayı ya da sayfayı yeniden başlatınca değişiyorsa sebep budur.
2. **Yanlış yerde değişiklik yapıyorsun:** Ekler bölümü bir şablonun ya da dosyanın kopyasında duruyor, çalışan sürüm ise başka bir yerden okuyor. Eklerin içine bilerek bozuk bir şey yazıp çıktıda görünüp görünmediğine bak.
3. **Koşul hep aynı sonucu veriyor:** "Ekler varsa ekle" kontrolü her zaman doğru ya da her zaman yanlış çıkıyor. Ekler boş olsa bile başlık prompt'ta kalıyor olabilir.
4. **Önizleme ile gerçek prompt farklı:** Ekranda gördüğün metin, modele giden metinle aynı olmayabilir. Modele gönderilen son isteği (log ya da debug çıktısı) kontrol et.
5. **Yeniden render olmuyor:** Arayüzde toggle durumu değişiyor ama prompt'u üreten fonksiyon bu duruma bağlı değil.

Hızlı test için:
- Eklere "TEST-123" gibi benzersiz bir ifade yaz, prompt'u yeniden oluştur ve çıktıda ara.
- Eklerin açık ve kapalı hallerinde son prompt'u iki ayrı dosyaya kaydedip karşılaştır.
- Prompt'u üreten yerde ekler değişkenini yazdır (print/log).

Bana şunları gönderirsen nokta atışı söyleyebilirim: hangi araç ya da dil kullandığın, prompt'u oluşturan kod (ya da ayar ekranı), "ekler" bölümünün tam olarak ne olduğu ve değiştirdikten sonra nasıl kontrol ettiğin.

### c04 · C

Tam olarak hangi ekranda ya da uygulamada çalıştığınızı bilmediğim için genel bir cevap vereyim.

Ekler bölümü ile prompt metni ayrı şeyler olduğu için, ekleri ekleyip çıkarmanın prompt metnini değiştirmemesi normaldir. Prompt, kullanıcının yazdığı metindir; ekler ise bu metinle birlikte modele gönderilen ayrı bir içeriktir (dosya, görsel vb.).

Ancak şu durumlardan biri geçerliyse prompt'un da değişmesi gerekir:
- Ekin içeriği prompt'a gömülüyorsa (ör. dosya metni bir şablona ekleniyorsa), ek eklendiğinde ya da çıkarıldığında prompt'un son hali güncellenmelidir.
- Ekler, prompt şablonundaki bir yer tutucuya (ör. {{ekler}}) bağlıysa, yer tutucunun doldurulması ya da boşaltılması gerekir.

Prompt'un önizlemesi ya da modele giden son metin ekle birlikte değişmiyorsa hata olabilir. Şunları kontrol etmenizi öneririm:
1. Ek bilgisi prompt oluşturma fonksiyonuna iletiliyor mu?
2. Önbellek (cache) güncelleniyor mu? Eski bir prompt kullanılıyor olabilir.
3. Ekler modele gerçekten gönderiliyor mu, yoksa yalnızca arayüzde mi gösteriliyor?

Hangi uygulamada ve nasıl bir yapıda çalıştığınızı (ekler nasıl eklenir ve prompt'a ne zaman yansıması beklenir) paylaşırsanız daha kesin bir cevap verebilirim.


---

## c09

**İSTEM:**

Bu kelimeyi Fransızcaya çevir: kitap

### c09 · A

"Kitap" kelimesinin Fransızcası **livre**'dir.

- Telaffuzu: "livr" gibi okunur.
- Cinsiyeti eril: **un livre** (bir kitap), **le livre** (kitap).
- Çoğulu: **des livres** (kitaplar), **les livres** (kitaplar).

### c09 · B

"Kitap" Fransızcada **"livre"** demektir (eril isim: *un livre*).

Örnek: "Bu kitabı seviyorum." → "J'aime ce livre."

Not: Fransızcada "livre" kelimesi eril olduğunda "kitap", dişil olduğunda (*une livre*) "pound (ağırlık/para birimi)" anlamına gelir.

### c09 · C

"Kitap" kelimesinin Fransızcası **livre**'dir (eril).

- Tekil: **le livre** (kitap), **un livre** (bir kitap)
- Çoğul: **les livres** (kitaplar), **des livres** (birkaç kitap)
- Telaffuz: [liv] (sonundaki "e" okunmaz, "r" harfi yazılmaz)

Örnek cümle:
*J'ai lu ce livre hier.* (Bu kitabı dün okudum.)
