# Grup 04

Ölçüt: doğruluk, eksiksizlik, istemin istediğini yapma. 1–5 (yarım puan olur). Etiketler her istemde yeniden karıştırıldı.


---

## r29

**İSTEM:**

Write a JavaScript function that debounces another function.

### r29 · A

Here is a debounce function with optional `leading`/`trailing` modes, plus `cancel` and `flush` helpers.

```js
function debounce(fn, wait = 0, { leading = false, trailing = true } = {}) {
  let timer = null;
  let lastArgs = null;
  let lastThis = null;
  let result;

  function invoke() {
    const args = lastArgs;
    const ctx = lastThis;
    lastArgs = lastThis = null;
    result = fn.apply(ctx, args);
    return result;
  }

  function timerExpired() {
    timer = null;
    // Only fire on the trailing edge if there are pending calls.
    if (trailing && lastArgs) invoke();
    lastArgs = lastThis = null;
  }

  function debounced(...args) {
    lastArgs = args;
    lastThis = this;

    const callNow = leading && timer === null;

    clearTimeout(timer);
    timer = setTimeout(timerExpired, wait);

    if (callNow) invoke(); // clears lastArgs, so no duplicate trailing call
    return result;
  }

  debounced.cancel = () => {
    clearTimeout(timer);
    timer = null;
    lastArgs = lastThis = null;
  };

  debounced.flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
      if (lastArgs) return invoke();
    }
    return result;
  };

  return debounced;
}
```

**Usage**

```js
const onResize = debounce(() => {
  console.log("Resized:", window.innerWidth);
}, 300);

window.addEventListener("resize", onResize);

// Search box: fire immediately on the first keystroke, ignore the rest
const search = debounce(query => fetchResults(query), 500, {
  leading: true,
  trailing: false,
});

// Cleanup (e.g., on component unmount)
onResize.cancel();
```

**How it works**

- Every call resets the timer. The wrapped function runs only after `wait` ms have passed with no new calls.
- The latest arguments and `this` are saved, so the trailing call uses the most recent values.
- With `leading: true`, the function runs on the first call of a burst. If `trailing` is also true, it runs again at the end only when more calls arrived during the burst. A single call does not fire twice.
- `cancel()` drops any pending invocation.
- `flush()` runs the pending invocation immediately.

**Minimal version**

If you only need the basics:

```js
const debounce = (fn, wait) => {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
};
```

Typical `wait` values are 200 to 500 ms for typing and 100 to 250 ms for resize or scroll. If you need a guaranteed call at regular intervals during continuous activity, use throttle instead.

### r29 · B

Here's a debounce function that delays invoking `fn` until it has stopped being called for `wait` milliseconds. It also supports a leading-edge option and a `cancel` method.

```javascript
/**
 * Creates a debounced version of `fn` that delays invoking it until
 * `wait` milliseconds have elapsed since the last time it was called.
 *
 * @param {Function} fn - The function to debounce.
 * @param {number} [wait=300] - Milliseconds to wait after the last call.
 * @param {Object} [options]
 * @param {boolean} [options.leading=false] - Invoke on the leading edge instead of the trailing edge.
 * @returns {Function} The debounced function, with a `cancel()` method.
 */
function debounce(fn, wait = 300, { leading = false } = {}) {
  let timerId = null;
  let lastArgs = null;
  let lastThis = null;

  function debounced(...args) {
    lastArgs = args;
    lastThis = this;

    const callNow = leading && timerId === null;

    clearTimeout(timerId);
    timerId = setTimeout(() => {
      timerId = null;
      if (!leading) {
        fn.apply(lastThis, lastArgs);
      }
      lastArgs = lastThis = null;
    }, wait);

    if (callNow) {
      fn.apply(this, args);
    }
  }

  debounced.cancel = function () {
    clearTimeout(timerId);
    timerId = lastArgs = lastThis = null;
  };

  return debounced;
}
```

Usage:

```javascript
const onResize = debounce(() => {
  console.log('Window resized to', window.innerWidth);
}, 200);

window.addEventListener('resize', onResize);
```

How it works:
- Each call clears the pending timer and starts a new one, so `fn` only runs after calls stop for `wait` ms.
- With `leading: true`, `fn` runs immediately on the first call of a burst, and subsequent calls within the window only reset the timer.
- `this` and the arguments from the most recent call are preserved for the trailing invocation.
- `cancel()` drops any pending invocation.

### r29 · C

Here's a debounce function. It delays calling `fn` until `wait` milliseconds have passed since the last call.

```javascript
function debounce(fn, wait = 300, { leading = false } = {}) {
  let timeoutId = null;

  function debounced(...args) {
    const context = this;
    const callNow = leading && timeoutId === null;

    clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (!leading) fn.apply(context, args);
    }, wait);

    if (callNow) fn.apply(context, args);
  }

  debounced.cancel = () => {
    clearTimeout(timeoutId);
    timeoutId = null;
  };

  return debounced;
}
```

## How it works

1. **Closure state:** `timeoutId` lives in the closure, so it persists between calls to the debounced function.
2. **Reset on every call:** each call clears the pending timer and starts a new one. `fn` only runs once calls stop for `wait` ms.
3. **Preserves `this` and arguments:** `fn.apply(context, args)` passes along the caller's `this` and the arguments from the *most recent* call. That's why `debounced` is a regular `function`, not an arrow function.
4. **`leading` option:** when `true`, `fn` runs right away on the first call of a burst. Further calls are ignored until `wait` ms of quiet have passed.
5. **`cancel()`:** throws away a pending call. This is handy when a component unmounts.

## Usage

```javascript
// Trailing (default): search runs 300ms after the user stops typing
const input = document.querySelector('#search');

const search = debounce(function (event) {
  console.log('Searching for:', event.target.value);
}, 300);

input.addEventListener('input', search);

// Leading: the first click fires right away, rapid repeat clicks are ignored
const save = debounce(() => console.log('Saved!'), 1000, { leading: true });
button.addEventListener('click', save);

// Cleanup
search.cancel();
```

## Debounce vs. throttle

- **Debounce:** waits for a pause in activity, then fires once. Good for search inputs, window resize, and autosave.
- **Throttle:** fires at most once per interval while activity continues. Good for scroll and mousemove handlers.

## Minimal version

If you only need the basic trailing behavior:

```javascript
const debounce = (fn, wait) => {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
};
```

For production code, `lodash.debounce` is another option. It adds `maxWait`, `flush()` and both-edge calls.


---

## r24

**İSTEM:**

Bir zarın iki kez atılmasında toplamın 7 olma olasılığını hesapla

### r24 · A

## Toplamın 7 Olma Olasılığı

**1. Örnek uzay:** Zar her atışta 6 farklı sonuç verebilir. İki atışta toplam sonuç sayısı:

6 × 6 = **36** (hepsi eşit olasılıklı)

**2. Toplamı 7 yapan durumlar:**

| 1. atış | 2. atış |
|---|---|
| 1 | 6 |
| 2 | 5 |
| 3 | 4 |
| 4 | 3 |
| 5 | 2 |
| 6 | 1 |

Toplam **6** uygun durum var. (Sıra önemli: (1,6) ile (6,1) farklı sonuçlardır.)

**3. Olasılık:**

P(toplam = 7) = 6 / 36 = **1/6 ≈ %16,67**

**Not:** 7, iki zarla elde edilebilecek en olası toplamdır. Birinci atış ne gelirse gelsin, ikinci atışta toplamı 7'ye tamamlayan tam olarak bir sayı vardır; bu yüzden olasılık doğrudan 1/6 çıkar.

### r24 · B

Bir zar iki kez atıldığında toplamın 7 olma olasılığını bulmak için tüm sonuçları sayabiliriz.

Örnek uzay, her atışta 6 olasılık olduğundan 6 × 6 = 36 eşit olasılıklı sonuçtan oluşur.

Toplamı 7 yapan çiftler şunlardır:
(1, 6), (2, 5), (3, 4), (4, 3), (5, 2), (6, 1)

Bu durumda 6 uygun sonuç vardır. Buna göre:

P(toplam = 7) = 6 / 36 = 1 / 6 ≈ 0,1667 (yaklaşık %16,7)

### r24 · C

**Cevap: 1/6 (yaklaşık %16,67)**

**Çözüm:**

Adil bir zar iki kez atıldığında örnek uzay 6 × 6 = 36 eşit olasılıklı sonuçtan oluşur. Her sonuç (birinci atış, ikinci atış) çifti olarak yazılır.

**Toplamı 7 yapan sonuçlar:**

- (1, 6)
- (2, 5)
- (3, 4)
- (4, 3)
- (5, 2)
- (6, 1)

Toplam 6 uygun sonuç vardır.

**Olasılık:**

P(toplam = 7) = uygun sonuç sayısı / tüm sonuç sayısı = 6 / 36 = **1/6 ≈ 0,1667**

**Neden 7 en olası toplamdır?**

Birinci atış ne gelirse gelsin, toplamı 7 yapacak tam olarak bir ikinci atış değeri vardır (7 − birinci atış, bu değer her zaman 1 ile 6 arasındadır). Dolayısıyla olasılık, ikinci atışın o belirli değeri gelme olasılığına, yani 1/6'ya eşittir. Diğer toplamlar için bu durum geçerli değildir; örneğin toplam 2 için yalnızca (1, 1) uygundur, olasılığı 1/36'dır. Bu yüzden 7, iki zar toplamında en sık görülen değerdir.

**Sonuç:** İki kez zar atıldığında toplamın 7 olma olasılığı 1/6'dır.


---

## r36

**İSTEM:**

Mikroservis mimarisinde dağıtık işlem yönetimini (saga pattern) tasarla ve örnek kodla açıkla

### r36 · A

# Mikroservislerde Saga Deseni

## Problem
Her mikroservisin kendi veritabanı vardır; birden fazla servisi kapsayan tek bir ACID transaction kurulamaz. Saga, her adımı yerel bir transaction olan bir işlem dizisidir. Bir adım başarısız olursa önceki adımlar **telafi edici (compensating)** işlemlerle geri alınır.

## Tasarım seçenekleri
- **Choreography:** Servisler olay (event) yayınlar ve dinler. Merkezi koordinatör yoktur. Basit akışlarda uygundur, ama akış büyüdükçe takibi zorlaşır.
- **Orchestration:** Bir orkestratör adımları yönetir. Akış açık ve izlenebilirdir.

Örnek akış: Ödeme → Stok rezervasyonu → Kargo. Stok yetersizse ödeme iade edilir ve sipariş iptal edilir.

## Orkestratör örneği (TypeScript)

```ts
interface OrderCtx { orderId: string; amount: number; items: string[]; }

interface Step {
  action: (ctx: OrderCtx) => Promise<void>;
  compensate: (ctx: OrderCtx) => Promise<void>;
}

async function runSaga(steps: Step[], ctx: OrderCtx): Promise<void> {
  const done: Step[] = [];
  try {
    for (const step of steps) {
      await step.action(ctx);
      done.push(step);
    }
  } catch (err) {
    for (const step of done.reverse()) {
      await step.compensate(ctx); // kalıcı hatada alarm ve yeniden deneme kuyruğu
    }
    throw err;
  }
}

const orderSaga: Step[] = [
  {
    action: ctx => payment.charge(ctx.orderId, ctx.amount),
    compensate: ctx => payment.refund(ctx.orderId),
  },
  {
    action: ctx => inventory.reserve(ctx.orderId, ctx.items),
    compensate: ctx => inventory.release(ctx.orderId),
  },
  {
    action: ctx => shipping.schedule(ctx.orderId),
    compensate: ctx => shipping.cancel(ctx.orderId),
  },
];
```

## Dikkat edilmesi gerekenler
- **Idempotency:** `action` ve `compensate` tekrar çağrılsa da aynı sonucu vermelidir. İstek ID'si kullanın.
- **Her adım telafi edilemez:** Gönderilmiş e-posta geri alınamaz. Bu tür adımları sagaın sonuna koyun (pivot transaction).
- **Kalıcı durum:** Orkestratör çökerse kaldığı yerden devam edebilmek için saga durumunu veritabanında saklayın.
- **İzolasyon eksikliği:** Ara durumlar (ör. `PENDING`) diğer isteklere görünür. Semantik kilitler veya durum kontrolleri kullanın.
- **Zaman aşımı ve yeniden deneme:** Her adım için timeout ve üstel geri çekilme (backoff) tanımlayın.

## Özet
Saga, dağıtık sistemde ACID yerine **nihai tutarlılık (eventual consistency)** sağlar. Basit akışlarda choreography, izlenmesi gereken karmaşık akışlarda orchestration tercih edilir.

### r36 · B

# Saga Pattern ile Dağıtık İşlem Yönetimi

## Sorun
Mikroservislerde her servisin kendi veritabanı vardır; bu yüzden tek bir ACID/2PC işlemi pratik değildir. Saga, bir iş akışını **yerel işlemler zinciri** olarak yürütür. Bir adım başarısız olursa önceki adımlar **telafi işlemleri (compensation)** ile geri alınır.

## İki Yaklaşım
- **Choreography:** Servisler olay yayınlar, birbirini dinler. Merkez yoktur, basittir; ancak akış büyüdükçe takibi zorlaşır.
- **Orchestration:** Bir orkestratör adımları sırayla yönetir. Akış tek yerde görünür, hata yönetimi kolaydır; orkestratör ek bir bileşendir.

Birden fazla adım ve dallanma varsa orkestrasyon önerilir.

## Örnek Akış: Sipariş
1. Sipariş oluştur (PENDING)
2. Stok rezerve et
3. Ödeme al
4. Siparişi onayla

Hata durumunda geri alma: ödeme iade, stok serbest bırak, sipariş iptal.

## Örnek Kod (Python, orkestrasyon)

```python
class SagaStep:
    def __init__(self, action, compensation):
        self.action = action
        self.compensation = compensation

class SagaOrchestrator:
    def __init__(self, steps):
        self.steps = steps

    def run(self, ctx):
        done = []
        for step in self.steps:
            try:
                step.action(ctx)
                done.append(step)
            except Exception as e:
                print(f"Hata: {e}. Geri alma başlıyor.")
                for s in reversed(done):
                    try:
                        s.compensation(ctx)   # idempotent olmalı
                    except Exception:
                        log_and_alert(ctx, s)  # manuel müdahale / retry kuyruğu
                return "FAILED"
        return "COMPLETED"

saga = SagaOrchestrator([
    SagaStep(create_order,   cancel_order),
    SagaStep(reserve_stock,  release_stock),
    SagaStep(charge_payment, refund_payment),
    SagaStep(confirm_order,  lambda ctx: None),
])
result = saga.run({"order_id": "A-1001", "amount": 250})
```

## Tasarım İlkeleri
- **İdempotentlik:** Aynı komut/olay iki kez gelse de sonuç değişmemeli (idempotency key kullan).
- **Outbox pattern:** Veritabanı yazımı ve olay yayını aynı işlemde atomik olmalı; aksi halde olay kaybolur.
- **Saga durumunu kalıcı tut:** Orkestratör çökerse kaldığı yerden devam etmeli (state tablosu).
- **Retry + zaman aşımı:** Geçici hatalarda üstel geri çekilme ile yeniden dene; kalıcı hatada telafiye geç.
- **Semantik kilitler:** Saga izolasyon sağlamaz; ara durumları (PENDING, RESERVED) açıkça modelle.
- **Telafi geri alma değildir:** E-posta gönderildiyse "iptal e-postası" yollanır; telafi iş açısından anlamlı olmalı.
- **Gözlemlenebilirlik:** Correlation ID ile dağıtık izleme ve uyarılar ekle.

## Araçlar
Temporal, Camunda, MassTransit (C#), Axon, NServiceBus gibi çerçeveler saga durumunu ve yeniden denemeyi hazır sunar.

## Sonuç
Saga, tutarlılıktan **nihai tutarlılığa (eventual consistency)** geçişi kabul eder. Telafi mantığını, idempotentliği ve outbox'ı doğru kurarsanız güvenilir bir dağıtık işlem yönetimi elde edersiniz.

### r36 · C

# Saga Pattern ile Dağıtık İşlem Yönetimi

Mikroservislerde her servisin kendi veritabanı olur, bu yüzden 2PC (iki aşamalı commit) pratik değildir. **Saga**, büyük işlemi her biri yerel transaction olan adımlara böler. Bir adım başarısız olursa, önceki adımlar **telafi (compensating) işlemleriyle** geri alınır.

## İki Yaklaşım

| | Koreografi | Orkestrasyon |
|---|---|---|
| Kontrol | Servisler olaylarla birbirini tetikler | Merkezi orkestratör yönetir |
| Avantaj | Gevşek bağlılık, tek hata noktası yok | Akış görünür, test etmesi kolay |
| Dezavantaj | Akışı izlemek zor, döngüsel bağımlılık riski | Orkestratör ek bileşen |

## Örnek Senaryo: Sipariş

1. Sipariş oluştur → telafi: siparişi iptal et
2. Stok ayır → telafi: stoğu serbest bırak
3. Ödeme al → telafi: iade et

## Orkestrasyon Örneği (TypeScript)

```typescript
interface SagaStep {
  name: string;
  execute: (ctx: any) => Promise<void>;
  compensate: (ctx: any) => Promise<void>;
}

class SagaOrchestrator {
  constructor(private steps: SagaStep[]) {}

  async run(ctx: any) {
    const done: SagaStep[] = [];
    for (const step of this.steps) {
      try {
        await step.execute(ctx);
        done.push(step);
        await saveState(ctx.sagaId, step.name, "DONE"); // kalıcı durum
      } catch (err) {
        console.error(`${step.name} başarısız, geri alınıyor`);
        for (const s of done.reverse()) {
          await retry(() => s.compensate(ctx)); // telafi tekrar denenmeli
        }
        throw new Error("Saga iptal edildi");
      }
    }
  }
}

const orderSaga = new SagaOrchestrator([
  { name: "order",
    execute: c => orderSvc.create(c),
    compensate: c => orderSvc.cancel(c.orderId) },
  { name: "inventory",
    execute: c => inventorySvc.reserve(c.items),
    compensate: c => inventorySvc.release(c.items) },
  { name: "payment",
    execute: c => paymentSvc.charge(c.userId, c.total),
    compensate: c => paymentSvc.refund(c.paymentId) },
]);
```

## Koreografi Örneği (olay tabanlı)

```typescript
bus.on("OrderCreated", async e => {
  try { await reserve(e.items); bus.publish("StockReserved", e); }
  catch { bus.publish("StockFailed", e); }
});
bus.on("StockFailed", e => orderSvc.cancel(e.orderId));
```

## Kritik Tasarım İlkeleri

- **İdempotency:** Mesajlar tekrar gelebilir; her adım ve telafi, aynı `sagaId` ile birden fazla çalışsa da güvenli olmalı.
- **Transactional Outbox:** Veritabanı yazımı ve olay yayını aynı yerel transaction'da yapılmalı (outbox tablosu + relay).
- **Kalıcı saga durumu:** Orkestratör çökerse kaldığı yerden devam edebilmeli.
- **İzolasyon eksikliği:** Ara durumlar görünür olur; "PENDING" gibi semantik kilitler kullanın.
- **Timeout ve retry:** Yanıt gelmeyen adımlar için zaman aşımı ve üstel geri çekilme.
- **Gözlemlenebilirlik:** Correlation ID ile dağıtık izleme (OpenTelemetry).

**Araçlar:** Temporal, Camunda, Axon, MassTransit veya Kafka tabanlı çözümler.

**Öneri:** 3–4 adımdan az basit akışlarda koreografi, karmaşık iş süreçlerinde orkestrasyon tercih edin.


---

## k04

**İSTEM:**

Please translate this email into French

### k04 · A

I'd be glad to translate your email into French, but the email text didn't come through. Only your request arrived, with nothing attached or pasted.

Could you paste the full text of the email here? Once I have it, I'll translate it right away.

To get the best result, it would help to know a few things:

1. **Tone:** Should it be formal (using "vous", suited to business or official correspondence) or informal (using "tu", suited to friends or close colleagues)? If you don't say, I'll default to a polite, formal register.
2. **Purpose:** Is it a business email, a personal message, a complaint, a job application, or something else? This helps me choose the right phrasing and closing formulas, such as "Cordialement" or "Bien à vous".
3. **Specific terms:** If there are names, product titles, or technical terms that should stay untranslated or be rendered in a particular way, let me know.
4. **Subject line and signature:** Tell me whether you'd like those translated as well. I'll include them by default.

Once you send the text, I'll provide a natural, idiomatic French version rather than a word-for-word one, and I can add brief notes on any phrases where the translation involved a judgment call.

### k04 · B

It looks like the email didn't come through. Only the request to translate it arrived, so there is no text for me to work with.

Please paste the email's text into your next message, and I'll translate it into French. If you have a preference, let me know any of the following:

- Formal (vouvoiement) or informal (tutoiement) tone. Formal is the default for business email.
- Whether you want the subject line translated too.
- Whether the recipient is French-speaking in France, Canada, or elsewhere, since spelling and some expressions differ.

### k04 · C

I'd be happy to translate it into French, but the email itself didn't come through. Only the request did. Could you paste the text of the email here?

A couple of quick questions so the translation fits:

- **Tone:** Should it be formal (using *vous*, e.g. for a client, a colleague you don't know well, or an official contact) or informal (using *tu*, e.g. for a friend or close coworker)? If you're not sure, I'll go with formal, which is the safe default in French business emails.
- **Regional variant:** Is the reader in France, Canada (Québec), Belgium, or Switzerland? The differences are small, but they can affect vocabulary and greetings.

Once you send the text, I'll translate the whole email, including the subject line, greeting, and sign-off, and adapt phrases like "Best regards" to their natural French equivalents (e.g. *Cordialement* or *Bien à vous*) instead of translating them word for word.


---

## t12

**İSTEM:**

Tüm backend kodumu baştan yazmam gerekiyor, yeniden yaz diyorum ama nasıl planlarım

### t12 · A

Planlamaya başlamadan önce önemli bir uyarı: "Her şeyi sıfırdan yazıp bir günde geçelim" yaklaşımı yazılımda en çok batan projelerden biridir. Eski kod çirkin olabilir ama yıllar içinde biriken pek çok iş kuralını ve hata düzeltmesini içinde taşır. Bu yüzden önerim, mümkünse **parça parça yeniden yazmak**. Buna "Strangler Fig" deseni deniyor.

## 1. Neden yeniden yazdığını netleştir
Sorunu tek cümleyle yaz: Performans mı, bakımı zor bir kod mu, eskimiş bir teknoloji mi, ölçeklenememek mi? Hedef ölçülebilir olsun, örneğin "p95 yanıt süresi 200 ms altında" ya da "yeni bir endpoint 1 günde eklenebilsin". Bu cümle kapsamın kontrolden çıkmasını engeller.

## 2. Mevcut sistemin envanterini çıkar
- Tüm endpoint'ler, arka plan işleri (cron, kuyruk), dış entegrasyonlar
- Veritabanı şeması ve veri akışları
- Yazılı olmayan iş kuralları (koddaki tuhaf `if`'ler genelde bir sebeple oradadır)
- Kim, neyi, ne sıklıkla kullanıyor? Loglara bak. Hiç kullanılmayan özellikleri taşıma.

## 3. Önce testleri yaz
Eski sistemin **şu anki davranışını** kayda alan testler yaz (characterization/contract test). API seviyesinde istek ve yanıt testleri en değerlisidir, çünkü aynı testler yeni sistemde de çalışır ve "aynı şeyi yapıyor mu?" sorusunu cevaplar.

## 4. Mimari kararları erkenden ver
Dil ve framework, katmanlar, kimlik doğrulama, hata yönetimi, loglama ve izleme, deployment. Kararları kısa notlar olarak (ADR) yaz. Bütün bir sistemi yazmadan önce tek bir dikey dilimle prototip çıkar.

## 5. Modüllere böl ve sırala
Sistemi bağımsız parçalara ayır (kullanıcı, sipariş, ödeme...). Sıralamayı şöyle yap:
- İlk olarak **az riskli ama gerçek** bir modül seç, öğrenme fırsatı olsun
- Kritik ve karmaşık modülleri (ödeme gibi) ekip ve altyapı oturduktan sonra ele al

## 6. Kademeli geçiş stratejisi
- Önüne bir proxy/API gateway koy, trafiği endpoint bazında eskiden yeniye yönlendir
- Feature flag ile kullanıcıların küçük bir yüzdesinden başla
- Mümkünse "gölge trafik" kullan: aynı isteği iki sisteme gönder, sonuçları karşılaştır
- Her adımın geri alma (rollback) planı olsun

## 7. Veri göçü ayrı bir proje
Şema değişecekse göç scriptlerini, çift yazma (dual write) dönemini ve veri doğrulamayı ayrıca planla. En riskli kısım çoğu zaman burasıdır.

## 8. Takvim ve gerçekçilik
Tahminini al ve en az 1,5 ile çarp. Bu süreçte eski sisteme gelecek acil düzeltmeleri de hesaba kat, iki sistemi bir süre birlikte yaşatacaksın.

Sistemin büyüklüğünü, kullandığın teknolojiyi ve yeniden yazma sebebini paylaşırsan sana daha somut bir yol haritası çıkarabilirim.

### t12 · B

Önce yeniden yazmanın gerçekten gerekli olup olmadığını netleştirin. Sorun mimariyse (değiştirilemeyen veri modeli, test edilemeyen katmanlar, sürekli kırılan bağımlılıklar) yeniden yazmak mantıklıdır. Sorun sadece dağınık kodsa, parça parça iyileştirmek genelde daha ucuzdur. Nedenleri yazılı tutun ki hedef ölçülebilir olsun.

Plan:

1. Mevcut sistemi envanterleyin
- Tüm endpoint'leri, arka plan işlerini, cron görevlerini ve dış entegrasyonları (ödeme, e-posta, üçüncü taraf API'ler) listeleyin.
- Veritabanı şemasını ve tablo ilişkilerini çıkarın.
- Loglardan hangi özelliklerin gerçekten kullanıldığını kontrol edin. Kullanılmayanları taşımayın.

2. Mevcut davranışı testle kilitleyin
- Yeni kod yazmadan önce karakterizasyon testleri yazın: gerçek istek-yanıt çiftlerini kaydedip yeni sistemle karşılaştırabilmek için.
- Giriş, ödeme ve hesaplama gibi kritik akışlara uçtan uca testler ekleyin.

3. API sözleşmesini sabitleyin
- Mevcut API'yi OpenAPI gibi bir şemayla belgeleyin. Frontend bozulmadan yeni backend aynı sözleşmeyi sağlamalıdır.

4. Mimariyi sade tutun
- Ekip küçükse modüler bir monolit çoğu zaman mikroservislerden daha iyidir.
- HTTP katmanını, iş kurallarını ve veri erişimini ayırın. İş kurallarını framework'ten bağımsız yazın.
- Yeni dil veya framework'ü gerçek bir ihtiyaç için seçin, "yeni olduğu için" seçmeyin.

5. Büyük patlama yerine kademeli geçiş yapın (strangler fig)
- Yeni sistemi eskisinin yanında kurun. Bir gateway veya reverse proxy ile trafiği özellik özellik yeni tarafa yönlendirin.
- Her özellik için sırayla yazın, test edin, gölge modda (shadow traffic) karşılaştırın ve geçirin.
- Bir özellik yeni tarafa geçtikten sonra eski kodunu silin. İki kopya uzun süre yaşamasın.

6. Veri geçişi en riskli kısımdır
- Veriyi tek seferde değil, kademeli taşıyın. Gerekirse bir dönem çift yazma (dual write) uygulayın.
- Her adımda geri dönüş (rollback) yolunu hazır tutun.

7. Örnek sıra (ekibinize göre ayarlayın)
- Hafta 1-2: envanter, karakterizasyon testleri, API sözleşmesi.
- Hafta 3-4: yeni iskelet, CI/CD, kimlik doğrulama, temel modeller.
- Sonraki dönemler: en az riskli modüllerden başlayarak taşıma.
- Son: eski sistemi kapatma, izleme ve temizlik.

Kaçının: Her şeyi uzun süre ayrı bir dalda yazıp tek seferde değiştirmek. Bu, geliştirme hızını ve kullanıcıları bekletir.

Daha somut bir plan için kullandığınız dil ve framework, veritabanı, kod boyutu, ekip büyüklüğü ve yeniden yazmanın asıl nedenini paylaşabilirsiniz.

### t12 · C

Tamamen baştan yazmak riskli bir karardır. Önce gerçekten gerekli mi diye kontrol et, gerekliyse aşağıdaki sırayla ilerle.

**1. Nedenini netleştir**
"Kod kötü" yeterli bir gerekçe değil. Somut bir hedef yaz: performans, ölçeklenme, teknoloji eskimesi, bakım maliyeti, güvenlik. Hedef olmadan "bitti" demenin bir ölçüsü kalmaz.

**2. Mevcut sistemi çıkar**
- Tüm endpoint'leri, veri modelini, dış servis entegrasyonlarını ve zamanlanmış işleri listele.
- Kodda yazılı ama hiçbir yerde belgelenmemiş iş kurallarını bul. En çok bunlar kaybolur.
- Kullanılmayan özellikleri ayıkla. Taşımamak en ucuz iştir.

**3. Davranışı testle sabitle**
Yeniden yazmadan önce mevcut sistem için entegrasyon veya sözleşme (API contract) testleri yaz. Yeni sistem aynı testleri geçmeli. Bu, en değerli güvencendir.

**4. Büyük patlama yerine kademeli geçiş (strangler fig)**
Her şeyi sıfırdan yazıp bir gecede değiştirmek çoğu zaman aylarca gecikir ve hata getirir. Bunun yerine:
- Önüne bir yönlendirici (API gateway/reverse proxy) koy.
- Modülleri tek tek yeni sisteme taşı, trafiği yavaş yavaş yönlendir (örneğin %5, %25, %100).
- Sorun çıkarsa eski sisteme geri dönebil.

**5. Modül sırasını belirle**
Önce düşük riskli ve az bağımlılığı olan bir modülle başla, süreci dene. Sonra değeri yüksek olanlara geç. Kritik ödeme/kimlik doğrulama gibi parçaları ortada, deneyim kazandıktan sonra taşı.

**6. Veri geçişini ayrı bir proje say**
Şema değişecekse bir süre iki sistemin aynı veriyi okuyup yazabilmesini planla. Taşıma betiklerini prova ortamında defalarca dene, doğrulama sorguları yaz.

**7. Teknik kararlar**
Dil, framework ve mimariyi (monolit mu, servisler mi) ekibin bilgisine göre seç. Yeni teknolojiyi yalnızca gerçek bir kazancı varsa tercih et. Çoğu ekip için "iyi yapılandırılmış monolit" yeterlidir.

**8. Takvim ve kapsam**
Tahminini en az 1,5-2 kat ile çarp. Rewrite sırasında yeni özellik eklemeyi dondur veya çok sınırla. Her 2-4 haftada çalışan, test edilebilir bir parça teslim et.

**9. Gözlemlenebilirlik ve geri dönüş**
Loglama, metrikler ve hata izleme baştan kurulu olsun. Eski ve yeni sistem çıktısını karşılaştıran bir "gölge mod" (shadow traffic) çok işe yarar.

**10. Başlangıç adımları**
1. Hedefi ve başarı ölçütlerini yaz.
2. Envanteri çıkar.
3. Test güvencesini kur.
4. Küçük bir modülü pilot olarak taşı.
5. Pilottan öğrendiklerinle planı güncelle.

İstersen mevcut yığınını (dil, veritabanı, kod boyutu) ve rewrite nedenini yaz; sana daha somut bir yol haritası çıkarayım.
