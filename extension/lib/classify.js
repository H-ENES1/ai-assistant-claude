// Soru tipi sınıflandırıcı (TR + EN, kural tabanlı, tamamen yerel).
// Çıktı: { type, confidence, scores, complexity (0..1), lengthHint (çarpan), signals[] }
//
// Neden kural tabanlı? Eklenti her tuş vuruşunda çalışır; küçük, hızlı, açıklanabilir ve
// çevrimdışı olmalı. Adım 10'daki kalibrasyon, tip başına çıktı uzunluğunu kullanıcının
// gerçek verisine göre düzelttiği için sınıflandırıcının mükemmel olması gerekmez.

export const TYPES = [
  "short_qa",      // kısa soru / tek cevaplı bilgi
  "explain",       // kavram açıklama, "nedir / nasıl çalışır"
  "math",          // problem çözme, türetme, kanıt
  "code_write",    // sıfırdan kod yazma
  "code_fix",      // hata ayıklama / kod düzeltme / kod açıklama
  "translate",     // çeviri
  "writing",       // e-posta, makale, hikâye, beyin fırtınası
  "rewrite",       // verilen metni düzeltme / sadeleştirme / kısaltma
  "summarize",     // metin / belge özeti
  "data_analysis", // tablo, CSV, Excel, istatistik
  "research",      // web araştırması, güncel bilgi, kaynak karşılaştırma
  "file_create"    // rapor, sunum, doküman, Excel dosyası üretme
];

// Her kalıp: [regex, puan]. TR kalıplar ek almaya açık köklerle yazılmıştır.
const RULES = {
  short_qa: [
    [/^(kaç|ne zaman|kim|hangi|nerede|kaçta|ne kadar)\b/i, 2],
    [/^(who|when|where|which|how many|how much|what year|is it|are there|does|did|can i)\b/i, 2],
    [/\b(evet mi hayır mı|yes or no|tek kelime|one word|kısaca|briefly|in short)\b/i, 1.5]
  ],
  explain: [
    [/\b(açıkla|açıklar|açıklayabilir|anlat|anlatır|nedir|ne demek|nasıl çalışı|ne işe yar|nasıl oluyor|nasıl olur|neden|niçin|niye|farkı ne|arasındaki fark)/i, 2],
    [/\b(anlamadım|anlamıyorum|kafam karıştı|kafam karışık)/i, 1.5],
    [/\b(karar vermem|karar ver|hangisini seçmeliyim|strateji öner|strateji\w* (hazırla|geliştir)|plan hazırla|yol haritası|riskleri\w*|artı(ları)? ve eksi|avantaj(ları)? ve dezavantaj)/i, 2.2],
    [/\b(derinlemesine analiz|analiz et)/i, 1.0],
    [/\b(should i|help me decide|pros and cons|trade-?offs?|strategy for|roadmap|risk analysis|evaluate (the|these) options)\b/i, 2.2],
    [/\b(explain|what is|what are|what does|how does|how do|why does|why do|why is|difference between|meaning of|tell me about|help me understand)\b/i, 2],
    [/\b(kavram|mantığı|sezgisel|intuition|concept|örnekle|with an example|basitçe|simply)\b/i, 1]
  ],
  math: [
    [/\b(çöz|çözer|hesapla|hesaplar|kanıtla|ispatla|türet|özdeğer)/i, 2.4],
    [/\b(türev|integral|limit|denklem|eşitsizlik|matris|olasılık|diferansiyel|vektör|seri açılım)/i, 1.2],
    [/\b(solve|calculate|compute|prove|derive|find the (value|eigen))/i, 2.4],
    [/\b(derivative|integral|equation|inequality|matrix|probability|eigen\w*|differential|theorem|lemma)\b/i, 1.2],
    [/[=∫∑√∂≤≥π^]|\b\d+\s*[x*/+\-]\s*\d+|\b[a-z]\^\d/i, 0.8]
  ],
  code_write: [
    [/\b(kod(u|unu)? yaz|program yaz|fonksiyon yaz|script yaz|betik yaz|uygulama yap|site yap|eklenti yap|bot yaz|api yaz|kodla)/i, 2.4],
    [/\b(write (a |an |the |me a |me an )?([\w+#-]+ ){0,2}(code|script|function|program|class|query|regex|component|api|bot)|implement|build (a|an|the)|create (a|an) (app|website|script|function|tool))\b/i, 2.4],
    [/\b(python|javascript|typescript|java|c\+\+|c#|rust|golang|sql|html|css|react|node|arduino|bash|matlab|regex)\b/i, 1.0],
    [/\b(the function should|should return|write self-contained code|return(s)? (a|the|an) (list|dict|string|integer|number|array|tuple)|example 1:|sample input|input format|output format|constraints:)/i, 2.4],
    [/\b(fonksiyon(u)? .*döndür|girdi:|çıktı:|örnek girdi)/i, 2],
    [/\b(mimari\w* (tasarla|kur|oluştur|çiz)|sistem(i)? tasarla|altyapı\w* (tasarla|kur)|backend|frontend|veritabanı şema|api tasarla|mikroservis|ölçeklenebilir)/i, 2.4],
    [/\b(design (a|an|the) [\w -]{0,40}(system|architecture|app|service|api|database|backend|platform)|system design|scalable|microservices?|database sharding|load balanc)/i, 2.4]
  ],
  code_fix: [
    [/\b(hata\w* (veriyor|alıyorum|aldım|çıkıyor|var|verdi)|çalışmıyor|kodu düzelt|hatayı düzelt|hatayı bul|debug|neden çalışmı|bug|exception|traceback|derlenmiyor|patlıyor|refactor|optimize et|kodu açıkla|bu kod ne yap)/i, 2.4],
    [/\b(error|exception|traceback|doesn'?t work|not working|fix (this|my|the)|debug|bug|crash|refactor|optimi[sz]e (this|my)|what does this code|explain this code|undefined|null pointer|segfault)\b/i, 2.4],
    [/(Error:|Exception|Traceback \(most recent call last\)|at .+:\d+:\d+|line \d+)/, 2],
    [/(\w+(exception|error)\b|err!|\berrno\b|exit code \d+|segmentation fault|stack trace)/i, 1.6]
  ],
  translate: [
    [/\b(çevir|çevril|tercüme|ingilizceye|türkçeye|almancaya|fransızcaya|ingilizcesi|türkçesi|ingilizce olarak|türkçe olarak)/i, 3],
    [/\b(translate|translation|into (english|turkish|german|french|spanish)|in (english|turkish) please|how do you say)\b/i, 3]
  ],
  writing: [
    [/\b(yaz|yazar mısın|yazabilir|taslak|hazırla|oluştur)\b.*\b(e-?posta|mail|mektup|makale|yazı|metin|hikaye|hikâye|şiir|deneme|duyuru|paylaşım|tweet|gönderi|konuşma|sunuş|özgeçmiş|cv|motivasyon)/i, 2.6],
    [/\b(e-?posta|mail|mektup|makale|hikaye|hikâye|şiir|duyuru|motivasyon mektubu|ön yazı|blog)/i, 1.2],
    [/\b(makale|hikaye|hikâye|şiir|mektup|e-?posta|duyuru|blog yazısı)\w* (yaz|hazırla|oluştur)/i, 2.2],
    [/\b(write|draft|compose)\b.*\b(email|e-mail|letter|essay|article|story|poem|post|tweet|speech|announcement|cover letter|bio|blog)/i, 2.6],
    [/\b(fik(ir|ri|irler) (ver|öner|üret)|beyin fırtınası|öneri listesi|isim öner|brainstorm|ideas for|give me ideas|suggest (some|names))\b/i, 2.2],
    [/^\s*(write|compose|draft|imagine you are|pretend you are|create a (story|poem|dialogue|scene))\b(?!\s+(a |an |the |me a |me an )?([\w-]+ ){0,2}(function|code|script|program|class|query|regex|component|api|bot|sql|test|unit test|method|algorithm|loop))/i, 2.0],
    [/\b(list (several|some|a few|ten|five|\d+)|give (me )?(several|some|a few|\d+|three|five|ten) (ways|ideas|tips|reasons|points|examples|suggestions)|what are some (ways|ideas|tips|good|fun)|top (three|five|ten|\d+))\b/i, 1.8],
    [/\b(listele|birkaç (yol|fikir|öneri|örnek)|\d+ (madde|öneri|fikir|yol|ipucu)|ipuçları ver|önerilerin neler)/i, 1.8],
    [/^\s*(yaz|hayal et|bir (hikaye|hikâye|şiir|diyalog) )/i, 1.6],
    [/(yaz|yazar mısın|yazabilir misin|yazsana|hazırla|hazırlar mısın|hazırlayabilir misin|oluştur|oluşturur musun)\s*[.!?]*$/i, 1.8],
    [/\b(mesaj|paylaşım|gönderi|tebrik|kutlama|davetiye|başvuru yazısı|dilekçe)/i, 1.2]
  ],
  rewrite: [
    [/\b(yeniden yaz|baştan yaz|düzenle|sadeleştir|kısalt|akademik (bir )?dil|resmi (bir )?dil|daha akıcı|imla|yazım hata|dil bilgisi|gözden geçir|toparla|iyileştir|metni düzelt|cümleyi düzelt|daha profesyonel)/i, 2.6],
    [/\b(rewrite|rephrase|paraphrase|proofread|edit (this|my)|polish|make (it|this|my|the)( \w+)? (shorter|longer|more|less|sound)|improve (this|my) (text|writing|paragraph|email)|grammar|tone)\b/i, 2.6]
  ],
  summarize: [
    [/\b(özetle|özetler|özet çıkar|özetini|ana fikir|kısaca anlat|maddeler halinde özet|tl;?dr)/i, 3],
    [/\b(summari[sz]e|summary|tl;?dr|key points|main points|gist|condense)\b/i, 3],
    [/\b(extract|from the following (passage|text|article)|from (the|this) (passage|text|article)|based on (the|this) (passage|text|article))\b/i, 2],
    [/\b(metinden|paragraftan|makaleden|metne göre|paragrafa göre|yukarıdaki metin|aşağıdaki metin)/i, 2]
  ],
  data_analysis: [
    [/\b(veri(yi|leri|setini)? (analiz|incele)|tablo(yu|daki)|grafik çiz|grafiğ|istatistik|ortalama|standart sapma|korelasyon|regresyon|excel|csv|sütun|satır|pivot)/i, 2.2],
    [/\b(analy[sz]e (this|the|my) (data|dataset|table|csv|spreadsheet)|plot|chart|statistics|mean|median|standard deviation|correlation|regression|dataframe|pandas|spreadsheet|column|pivot)\b/i, 2.2]
  ],
  // (tasarım ve karar istekleri ayrı tip değil; ilgili tipe puan + karmaşıklık verir)
  research: [
    [/\b(araştır|araştırır|kaynak(lar)?(ı)? bul|güncel|son (gelişmeler|haberler)|bugün|şu an|bu yıl|202[4-9]|karşılaştır|en iyi .* hangisi|fiyat(ı|ları)|piyasa|literatür tara)/i, 2.4],
    [/\b(research|look up|search (for|the web)|latest|current|recent news|today|this year|202[4-9]|compare|which is the best|price of|market|literature review|find sources)\b/i, 2.4]
  ],
  file_create: [
    [/\b(sunum|slayt|rapor hazırla|rapor oluştur|doküman oluştur|belge oluştur|excel dosyası|word dosyası|pdf (oluştur|hazırla)|tablo oluştur|dashboard|web sayfası yap|şablon)/i, 2.4],
    [/\b(presentation|slides?|slide deck|create (a|an) (report|document|spreadsheet|pdf|dashboard|template)|make (a|an) (deck|report|spreadsheet|dashboard)|excel file|word document)\b/i, 2.4]
  ]
};

const HARD = /\b(kanıtla|ispatla|türet|adım adım|detaylı|ayrıntılı|kapsamlı|derinlemesine|mimari|optimize|tasarla|tasarım|karmaşık|ileri düzey|ölçeklenebilir|dağıtık|mikroservis|strateji|karar|risk|vergi|uzun vadeli|baştan sona|refactor|literatür|açık problem|kanıt|tamamını|her şeyi|production|üretim seviyesi)|\b(prove|proof|derive|derivation|rigorous|step by step|in detail|detailed|comprehensive|in-depth|thorough|architecture|design (a|an|the)|scalable|distributed|microservices?|sharding|failover|trade-?offs?|strategy|decision|risks?|complex|advanced|end-to-end|production|literature|refactor)\b/gi;
const SHORT_HINT = /\b(kısaca|kısa|tek cümle|bir cümle|tek kelime|sadece|yalnızca|özetle söyle|briefly|short|one sentence|one word|just|only|tl;?dr|in a nutshell)\b/i;
const LONG_HINT = /\b(detaylı|ayrıntılı|kapsamlı|uzun|derinlemesine|her şeyi|tamamını|adım adım|örneklerle|in detail|detailed|comprehensive|long|in-depth|thorough|step by step|with examples|everything|full)\b/i;

// JavaScript'te \b yalnızca ASCII harfleri tanır (İ, ş, ğ… kelime harfi sayılmaz).
// Kuralları Unicode uyumlu sınırla yeniden derler.
const UB = "(?:(?<=[\\p{L}\\p{N}_])(?![\\p{L}\\p{N}_])|(?<![\\p{L}\\p{N}_])(?=[\\p{L}\\p{N}_]))";
const toUnicode = (re) => new RegExp(re.source.replaceAll("\\b", UB), re.flags.includes("u") ? re.flags : re.flags + "u");
for (const rules of Object.values(RULES)) for (const r of rules) r[0] = toUnicode(r[0]);
const HARD_U = toUnicode(HARD), SHORT_U = toUnicode(SHORT_HINT), LONG_U = toUnicode(LONG_HINT);

// Türkçe büyük/küçük harf: "İ"→"i", "I"→"ı". İngilizce için normal küçük harf de denenir.
function variants(text) {
  const a = text.toLocaleLowerCase("tr"), b = text.toLowerCase();
  return a === b ? [a] : [a, b];
}
const anyMatch = (re, vs) => vs.some((v) => re.test(v));

function wordCount(s) { return (s.match(/\p{L}+/gu) || []).length; }

// ctx: { attachments: [{kind, high}], hasCodeBlock?, historyMessages? }
export function classify(prompt, ctx = {}) {
  const text = String(prompt || "");
  const words = wordCount(text);
  const scores = Object.fromEntries(TYPES.map((t) => [t, 0]));
  const signals = [];

  // Uzun yapıştırmalarda talimat genelde başta ya da sonda olur; kurallar sadece bu kısımlara
  // uygulanır (60K karakterde 270 ms → birkaç ms).
  const ruleText = text.length > 6000 ? text.slice(0, 4000) + "\n" + text.slice(-1500) : text;
  const vs = variants(ruleText);
  for (const [type, rules] of Object.entries(RULES)) {
    for (const [re, pts] of rules) if (anyMatch(re, vs)) scores[type] += pts;
  }

  // Yapısal ipuçları
  const codeBlock = /```/.test(text) || ctx.hasCodeBlock;
  const codeLines = text.slice(0, 20000).split("\n").filter((l) => /[{}();=]/.test(l) && /[a-zA-Z_]\w*\s*[(=]/.test(l)).length;
  if (codeBlock || codeLines >= 3) {
    signals.push("code");
    const errorish = /(error|exception|traceback|hata|çalışmı|doesn'?t work|not working|bug|fix|düzelt|neden|why)/i.test(ruleText);
    if (errorish) scores.code_fix += 1.5;
    else if (scores.code_write > 0) scores.code_write += 1.2;
    else scores.code_fix += 1.0; // kod verilmiş, onunla ilgili bir şey soruluyor
  }

  const att = ctx.attachments || [];
  const docs = att.filter((a) => a.kind === "pdf" || a.kind === "office" || a.kind === "text" || a.kind === "pasted");
  const sheets = att.filter((a) => /\.(csv|tsv|xlsx|xls|ods)$/i.test(a.name || ""));
  const images = att.filter((a) => a.kind === "image");
  if (docs.length) { scores.summarize += 1.2; scores.explain += 0.4; signals.push("document"); }
  if (sheets.length) { scores.data_analysis += 2.5; signals.push("sheet"); }
  if (images.length) { scores.explain += 0.6; signals.push("image"); }

  // Uzun yapıştırılmış metin + kısa talimat → yeniden yazma / özet / çeviri lehine
  if (words > 250 && scores.rewrite + scores.summarize + scores.translate === 0) scores.summarize += 0.6;

  // Varsayılan: kısa ve soru gibi ise short_qa, değilse explain
  let best = TYPES.reduce((a, b) => (scores[b] > scores[a] ? b : a), TYPES[0]);
  let top = scores[best];
  if (top === 0) {
    best = words <= 8 ? "short_qa" : "explain";
    scores[best] = 0.5;
    top = 0.5;
    signals.push("default");
  } else if (best === "explain" && words <= 12 && /\?\s*$/.test(text) && scores.explain < 3) {
    // "X nedir?" gibi çok kısa sorular çoğu zaman kısa cevaplıdır, ama açıklama olarak kalsın;
    // uzunluk ipucu aşağıda kısaltır.
  }

  const sorted = Object.values(scores).sort((a, b) => b - a);
  const margin = sorted[0] - (sorted[1] || 0);
  const confidence = signals.includes("default") ? "low" : margin >= 2 ? "high" : margin >= 0.8 ? "medium" : "low";

  // Karmaşıklık (0..1): uzunluk, zor kelimeler, ek boyutu, çok maddeli istek
  const hard = Math.max(...vs.map((v) => (v.match(new RegExp(HARD_U.source, "giu")) || []).length));
  const bullets = (ruleText.match(/^\s*([-*•]|\d+[.)])\s+/gm) || []).length;
  const attTokens = att.reduce((s, a) => s + (a.high || 0), 0);
  let complexity =
    0.12 * Math.min(1, words / 150) * 2 +
    0.13 * Math.min(4, hard) +
    (/(kanıtla|ispatla|türet|prove|derive|rigorous)/i.test(ruleText) ? 0.12 : 0) +
    0.05 * Math.min(4, bullets) +
    0.15 * Math.min(1, attTokens / 50000) +
    (best === "math" ? 0.15 : 0) +
    (best === "code_write" || best === "code_fix" ? 0.1 : 0) +
    (best === "research" ? 0.1 : 0);
  complexity = Math.max(0, Math.min(1, complexity));

  // Çıktı uzunluğu ipucu (log uzayında çarpan)
  let lengthHint = 1;
  if (anyMatch(SHORT_U, vs)) { lengthHint *= 0.55; signals.push("short"); }
  if (anyMatch(LONG_U, vs)) { lengthHint *= 1.7; signals.push("long"); }
  if (bullets >= 3) lengthHint *= 1 + 0.08 * Math.min(8, bullets);

  return { type: best, confidence, scores, complexity, lengthHint, signals, words };
}

// ---------- Model önerisi ----------
// Sıra: ucuzdan pahalıya. "min" = bu tip için yeterli en hafif model ailesi.
export const MODEL_TIERS = ["haiku", "sonnet", "opus", "fable"];
const MIN_TIER = {
  short_qa: "haiku", translate: "haiku", rewrite: "haiku", summarize: "haiku",
  explain: "sonnet", writing: "sonnet", data_analysis: "sonnet", file_create: "sonnet",
  code_write: "sonnet", code_fix: "sonnet", research: "sonnet",
  math: "sonnet"
};

// Döner: { tier: "haiku"|"sonnet"|"opus"|"fable", reasonKey }
export function recommendTier(cls) {
  let i = MODEL_TIERS.indexOf(MIN_TIER[cls.type] || "sonnet");
  let reasonKey = `rec_${cls.type}`;
  // Güvenlik kuralı: tip belirsizse Haiku önerme (hafif model önermek, pahalı model
  // önermekten daha kötü bir hatadır: kullanıcı kötü cevap alır). Çok kısa sohbet
  // mesajları ("Teşekkürler", "Devam et") bu kuralın dışındadır.
  if (i === 0 && cls.confidence === "low" && (cls.words || 0) > 8) i = 1;
  if (cls.complexity >= 0.3) i = Math.max(i, 1);
  if (cls.complexity >= 0.5) { i = Math.max(i, 2); reasonKey = "rec_complex"; }
  if (cls.complexity >= 0.85 && (cls.type === "math" || cls.type === "code_write" || cls.type === "research")) {
    i = 3; reasonKey = "rec_hardest";
  }
  return { tier: MODEL_TIERS[i], reasonKey };
}
