// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Hayrettin Enes Karalı
// Konu alanı sınıflandırıcı (TR + EN, tamamen yerel, metin cihazdan çıkmaz).
//
// İş türünden (classify.js: "açıkla", "kod yaz", "çevir"…) AYRI ikinci eksendir: aynı "açıkla" isteği
// fizikte, hukukta ya da bir yemek tarifinde çok farklı dikkat ve düşünme ister. Alan, model ve effort
// önerisini (lib/effort.js, lib/advisor.js) ve haftalık raporun alan dağılımını besler.
//
// Yöntem: anahtar kelime kökleri (Türkçe ekler için yalnız baştan sınır), her kalıbın puanı ve bir
// alt başlığı vardır. Puan = Σ puan × min(3, farklı eşleşme sayısı). İş türü ek ipucu verir
// (çeviri → dil, kod → yazılım, matematik → matematik). En yüksek puan < 1,5 ise "general".
// Çıktı: { domain, sub, second, score, confidence, hits[] }

export const DOMAINS = [
  "science", "math", "engineering", "software", "data_ai", "academic", "project", "literature",
  "business", "finance", "law", "health", "education", "language", "humanities", "daily", "general"
];

// Alanın öneriye etkisi (lib/effort.js ve lib/advisor.js kullanır):
//  stakes : yanlış cevabın bedeli (2 = sağlık/hukuk/para: hafif model önerilmez, effort en az orta)
//  depth  : akıl yürütme yoğunluğu (2 = bilim/matematik/mühendislik: açıklama ve araştırmada effort +1)
//  plan   : planlama işi (Anthropic: "proje planlama" için effort'u yükselt)
//  creative: yaratıcı yazı (uzun düşünme kaliteyi pek artırmaz; effort tavanı orta)
//  light  : gündelik/dil işleri (effort −1)
export const PROFILE = {
  science:     { stakes: 1, depth: 2 },
  math:        { stakes: 1, depth: 2 },
  engineering: { stakes: 1, depth: 2 },
  software:    { stakes: 1, depth: 1 },
  data_ai:     { stakes: 0, depth: 1 },
  academic:    { stakes: 1, depth: 1 },
  project:     { stakes: 0, depth: 1, plan: 1 },
  literature:  { stakes: 0, depth: 0, creative: 1 },
  business:    { stakes: 0, depth: 0 },
  finance:     { stakes: 2, depth: 1 },
  law:         { stakes: 2, depth: 1 },
  health:      { stakes: 2, depth: 1 },
  education:   { stakes: 0, depth: 1 },
  language:    { stakes: 0, depth: 0, light: 1 },
  humanities:  { stakes: 0, depth: 1 },
  daily:       { stakes: 0, depth: 0, light: 1 },
  general:     { stakes: 0, depth: 0 }
};

// Alt başlıklar (rapor ve bildirimde "Bilim · Fizik" gibi gösterilir)
export const SUBS = {
  science: ["physics", "chemistry", "biology", "astronomy", "earth"],
  math: ["pure", "statistics"],
  engineering: ["electrical", "mechanical", "civil", "control"],
  software: ["web", "mobile", "systems", "general"],
  data_ai: ["ml", "llm", "data"],
  academic: ["paper", "thesis", "grant"],
  project: ["planning", "agile", "startup"],
  literature: ["poetry", "fiction", "analysis", "screen"],
  business: ["career", "marketing", "management"],
  finance: ["investing", "personal", "accounting", "economics"],
  law: ["contract", "civil", "privacy", "ip"],
  health: ["medical", "nutrition", "fitness", "mental"],
  education: ["exam", "homework", "teaching"],
  language: ["grammar", "learning", "translation"],
  humanities: ["history", "philosophy", "society", "psychology"],
  daily: ["food", "travel", "home", "fun", "people"]
};

// [regex, puan, alan, alt başlık]. TR kökler ek alabilir (sonda sınır yok); EN kelimeler tam sınırlı.
// Çok anlamlı kelimeler (limit, lisans, tarih, akım, ateş, haiku, sonnet…) bilerek dışarıda ya da düşük puanlı.
const R = [
  // ---- Bilim ----
  [/\b(fizik|kuantum|görelilik|izafiyet|elektromanyeti|manyetik alan|elektrik alan|parçacık|foton|elektron\b|elektronun|elektronlar|proton|nötron|optik|lazer|kırınım|girişim deseni|çift yarık|dalga fonksiyon|schrödinger|schrodinger|hamiltonyen|lagranj|kinetik enerji|potansiyel enerji|termodinami|entropi|ışık hızı|yerçekim|kütle çekim|kütleçekim|newton yasa|maxwell denklem|plazmon|yarı ?iletken|süper ?iletken|katı hal|spektroskopi|kırılma indis|polarizasyon|interferometre|michelson|fizeau|dalga boy|saçılma|frekans|rezonans)/i, 2, "science", "physics"],
  [/\b(physics|quantum|relativity|electromagnet\w*|particles?|photons?|electrons?|protons?|neutrons?|optics|lasers?|diffraction|wave ?function|schr[öo]dinger|hamiltonian|lagrangian|kinetic energy|potential energy|thermodynamics?|entropy|speed of light|gravity|gravitation\w*|maxwell'?s equations|plasmon\w*|semiconductors?|superconduct\w*|condensed matter|spectroscopy|refractive index|polari[sz]ation|interferometer|double[- ]slit|wavelengths?|scattering|rayleigh|resonance)\b/i, 2, "science", "physics"],
  [/\b(momentum|ivme|atom|hız vektör|sürtünme|eylemsizlik)/i, 1, "science", "physics"],
  [/\b(kimya|molekül|tepkime|reaksiyon denklem|asit|organik kimya|bileşik|katalizör|oksidasyon|indirgenme|kovalent|iyonik bağ|polimer|stokiyometri|titrasyon|periyodik tablo|elektronegatif|mol kütle)/i, 2, "science", "chemistry"],
  [/\b(chemistry|chemical|molecules?|molecular|acids?|organic chemistry|compounds?|catalysts?|oxidation|covalent|ionic bond|polymers?|stoichiometr\w*|titration|periodic table|electronegativ\w*|molar)\b/i, 2, "science", "chemistry"],
  [/\b(biyoloji|hücre zar|hücre bölün|mitoz|mayoz|dna|rna|genetik|enzim|evrim|türleşme|doğal seçilim|ekoloji|bakteri|virüs|mitokondri|fotosentez|nöron|organizma|kromozom|mutasyon|ekosistem)/i, 2, "science", "biology"],
  [/\b(biology|biological|dna|rna|genes?|genetics?|genome|enzymes?|evolution\w*|natural selection|ecolog\w*|bacteri\w*|virus\w*|mitochondri\w*|photosynthesis|neurons?|organisms?|chromosomes?|mutations?|ecosystems?|species)\b/i, 2, "science", "biology"],
  [/\b(protein|hücre)/i, 1, "science", "biology"],
  [/\b(astronomi|astrofizik|gezegen|galaksi|kara delik|karadelik|kozmoloji|teleskop|güneş sistemi|nebula|süpernova|ötegezegen|karanlık madde|büyük patlama|evrenin)/i, 2, "science", "astronomy"],
  [/\b(astronom\w*|astrophysics|planets?|galax\w*|black holes?|cosmolog\w*|telescopes?|solar system|nebula\w*|supernova\w*|exoplanets?|dark matter|big bang)\b/i, 2, "science", "astronomy"],
  [/\b(jeoloji|deprem|fay hatt|volkan|yanardağ|iklim değişik|küresel ısınma|atmosfer|tektonik|kayaç|mineral|okyanus akıntı)/i, 2, "science", "earth"],
  [/\b(geolog\w*|earthquakes?|volcan\w*|climate change|global warming|atmospher\w*|tectonic\w*|minerals?|ocean currents?)\b/i, 2, "science", "earth"],
  [/\b(bilim|bilimsel|deney\b|deneyi\b|deneyde|deneyler|deney düzene|hipotez|laboratuvar)/i, 1, "science", null],
  [/\b(science|scientific|experiments?|hypothes[ie]s|laboratory|lab report)\b/i, 1, "science", null],

  // ---- Matematik ----
  [/\b(matematik|denklem|türev|integral|diferansiyel|matris|özdeğer|özvektör|olasılık (hesab|dağılım|teori|yoğunluk)|koşullu olasılık|olasılığını hesapla|kombinasyon|permütasyon|teorem|lemma|ispat|kanıtla|polinom|logaritma|trigonometri|geometri|üçgen|asal sayı|topoloji|lineer cebir|doğrusal cebir|kalkülüs|fourier|laplace|koordinat sistem|küresel koordinat|silindirik koordinat|vektör alan|gradyan|diverjans|rotasyonel|seri açılım|taylor seri)/i, 2, "math", "pure"],
  [/\b(math\w*|equations?|derivatives?|integrals?|differential|matrix|matrices|eigen\w*|probability|combinatoric\w*|permutations?|theorems?|lemmas?|proofs?|prove|polynomials?|logarithms?|trigonometr\w*|geometry|prime numbers?|topolog\w*|linear algebra|algebra|calculus|fourier|laplace|coordinate systems?|vector fields?|divergence|taylor series)\b/i, 2, "math", "pure"],
  [/\b(istatistik|standart sapma|varyans|hipotez testi|p-?değeri|güven aralığı|regresyon|korelasyon|normal dağılım|olasılık dağılım|örneklem)/i, 2, "math", "statistics"],
  [/\b(statistic\w*|standard deviation|variance|hypothesis test\w*|p-?values?|confidence intervals?|regression|correlation|normal distribution|probability distribution|sample size)\b/i, 2, "math", "statistics"],

  // ---- Mühendislik ----
  [/\b(elektronik|devre(?! dışı)(\b|si|ler|yi|nin|de\b)|direnç|kondansatör|kapasitör|bobin|transistör|diyot|op-?amp|mosfet|arduino|raspberry|mikrodenetleyici|esp32|sensör|pcb|lehim|voltaj|kirchhoff|thevenin|norton eşdeğer|empedans|osiloskop|sinyal işleme|güç kaynağı|motor sürücü|röle|doğrultucu|yükselteç|lojik kapı|flip-?flop|alçak geçiren|yüksek geçiren|bant geçiren|kesim frekans|rc devre|rlc)/i, 2, "engineering", "electrical"],
  [/\b(electronics?|circuits?|resistors?|capacitors?|inductors?|transistors?|diodes?|op[- ]?amps?|mosfets?|arduino|raspberry pi|microcontrollers?|esp32|sensors?|pcb|solder\w*|voltage|kirchhoff|thevenin|impedance|oscilloscope|signal processing|power supply|relays?|rectifier|amplifiers?|logic gates?|flip-?flops?|low-pass|high-pass|band-pass|cutoff frequency|rc filter|rlc)\b/i, 2, "engineering", "electrical"],
  [/\b(gerilim|akım|ohm)/i, 1, "engineering", "electrical"],
  [/\b(makine mühendis|mukavemet|tork|dişli|rulman|solidworks|autocad|ısı transfer|akışkanlar mekaniği|türbin|hidrolik|pnömatik|cnc|3d yazıcı|sonlu eleman|teknik resim)/i, 2, "engineering", "mechanical"],
  [/\b(mechanical engineering|torque|gears?|bearings?|solidworks|autocad|heat transfer|fluid mechanics|turbines?|hydraulic\w*|pneumatic\w*|cnc|3d print\w*|finite element|fea|technical drawing)\b/i, 2, "engineering", "mechanical"],
  [/\b(inşaat mühendis|yapı statiği|betonarme|kiriş|zemin etüd|deprem yönetmeli|köprü tasarım|taşıyıcı sistem)/i, 2, "engineering", "civil"],
  [/\b(civil engineering|structural analysis|reinforced concrete|soil mechanics|bridge design|load-bearing)\b/i, 2, "engineering", "civil"],
  [/\b(kontrol sistem|pid|plc|scada|otomasyon|transfer fonksiyon|kararlılık analiz|endüstri mühendis|yalın üretim|kalite kontrol|üretim planlama)/i, 2, "engineering", "control"],
  [/\b(control systems?|pid|plc|scada|automation|transfer functions?|bode|nyquist|stability analysis|industrial engineering|lean manufacturing|six sigma|quality control)\b/i, 2, "engineering", "control"],
  [/\b(mühendis|prototip|teknik şartname)/i, 1, "engineering", null],
  [/\b(engineering|engineers?|prototyp\w*|specifications?)\b/i, 1, "engineering", null],

  // ---- Yazılım ----
  [/\b(html|css|javascript|typescript|react|vue|angular|next\.?js|node\.?js|express\b|django|flask|fastapi|frontend|backend|web sitesi|web sayfası|tarayıcı eklenti|chrome eklenti|tailwind)/i, 2, "software", "web"],
  [/\b(html|css|javascript|typescript|react|vue|angular|next\.?js|node\.?js|express|django|flask|fastapi|frontend|backend|website|web app|browser extension|chrome extension|tailwind|rest api|graphql)\b/i, 2, "software", "web"],
  [/\b(android|ios uygulama|swift|kotlin|flutter|react native|mobil uygulama)/i, 2, "software", "mobile"],
  [/\b(android|ios app|swift|kotlin|flutter|react native|mobile app)\b/i, 2, "software", "mobile"],
  [/\b(sql|postgres|mysql|mongodb|veritabanı|docker|kubernetes|linux|bash\b|github|gitlab|ci\/cd|deploy|sunucu|aws|azure|nginx)/i, 2, "software", "systems"],
  [/\b(sql|postgres\w*|mysql|mongodb|database|docker|kubernetes|linux|bash|git (commit|push|pull|merge|rebase|branch|clone)|github|gitlab|ci\/cd|deploy\w*|servers?|aws|azure|gcp|nginx)\b/i, 2, "software", "systems"],
  [/\b(kod|yazılım|algoritma|nesneye yönelik|oop\b|python|java\b|c\+\+|c#|rust|golang|regex|debug|refactor|derleme|kütüphane|framework|npm|pip install|nesne yönelimli|veri yapı)/i, 2, "software", "general"],
  [/\b(code|coding|software|algorithms?|python|java|c\+\+|c#|rust|golang|regex|debug\w*|refactor\w*|compil\w*|library|framework|npm|pip|object[- ]oriented|data structures?|unit tests?|api)\b/i, 2, "software", "general"],
  [/\b(fonksiyon|program|uygulama)/i, 1, "software", "general"],
  [/\b(functions?|program|application|app)\b/i, 1, "software", "general"],

  // ---- Veri ve yapay zekâ ----
  [/\b(makine öğren|derin öğren|yapay zek|sinir ağ|model eğit|veri set|aşırı öğrenme|sınıflandırıcı|transformer|attention|dikkat mekanizma|pytorch|tensorflow|scikit|keras|hugging ?face|öznitelik|eğitim verisi)/i, 2, "data_ai", "ml"],
  [/\b(machine learning|deep learning|artificial intelligence|ai|neural net\w*|train(ing)? (a|the) model|datasets?|overfit\w*|classifiers?|transformers?|attention mechanism|self-attention|pytorch|tensorflow|scikit|keras|hugging ?face|features? engineering|training data)\b/i, 2, "data_ai", "ml"],
  [/\b(llm|büyük dil model|prompt|token|gpt|claude|chatgpt|gemini|embedding|fine-?tun|ince ayar|rag\b|ajan\b|ajanlar|ajanı|agent)/i, 2, "data_ai", "llm"],
  [/\b(llms?|large language models?|prompts?|prompting|tokens?|gpt|claude|chatgpt|gemini|embeddings?|fine-?tun\w*|rag|agents?|agentic)\b/i, 2, "data_ai", "llm"],
  [/\b(veri analiz|veri bilim|pandas|numpy|dataframe|csv|excel|grafik çiz|görselleştir|dashboard|power bi|tableau|pivot)/i, 2, "data_ai", "data"],
  [/\b(data analysis|data science|pandas|numpy|dataframes?|csv|spreadsheets?|excel|visuali[sz]\w*|dashboards?|power bi|tableau|pivot tables?)\b/i, 2, "data_ai", "data"],

  // ---- Akademik ----
  [/\b(akademik|tez\b|tezim|tezin|tezde|tezi\b|doktora tez|yüksek lisans|literatür|kaynakça|atıf|apa format|ieee format|hakem yorum|hakem değerlendir|hakemler|dergi(ye)? gönder|yayınlanmış|yayın listesi|konferans|bildiri\b|bildirisi|bildiri özet|araştırma sorusu|yöntem bölüm|bulgular bölüm|tartışma bölüm|giriş bölüm|abstract|makale(mi|yi|nin)? (yaz|düzenle|gözden)|bilimsel makale|yorum makalesi|preprint|arxiv)/i, 2, "academic", "paper"],
  [/\b(academic|thesis|dissertation|phd|master'?s|literature review|bibliography|citations?|cite|apa style|ieee style|mla|peer review\w*|reviewers?|journals?|publications?|conference paper|manuscript|research question|methodology|findings|abstract|preprint|arxiv|research paper)\b/i, 2, "academic", "paper"],
  [/\b(tez\b|tezim|bitirme projesi|bitirme tezi)/i, 1, "academic", "thesis"],
  [/\b(tübitak|2209|1001|2247|burs başvuru|proje öneri|hibe|fon başvuru|motivasyon mektub|niyet mektub)/i, 2, "academic", "grant"],
  [/\b(grant proposal|research proposal|funding application|scholarship|fellowship|statement of purpose|motivation letter)\b/i, 2, "academic", "grant"],
  [/\b(makale)/i, 1, "academic", "paper"],

  // ---- Proje ve planlama ----
  [/\b(proje plan|proje yönetim|iş paket|iş plan|zaman çizelge|gantt|kilometre taş|yol harita|görev dağılım|paydaş|risk yönetim|fizibilite|teslim tarihi|iş akışı|takvim(i)? (çıkar|hazırla|oluştur)|planlama)/i, 2, "project", "planning"],
  [/\b(project plan\w*|project management|work packages?|business plan|timelines?|gantt|milestones?|roadmap|stakeholders?|risk management|feasibility|deliverables?)\b/i, 2, "project", "planning"],
  [/\b(deadlines?|workflow|schedule)\b/i, 1, "project", "planning"],
  [/\b(sprint|scrum|agile|çevik|kanban|backlog|jira|trello)/i, 2, "project", "agile"],
  [/\b(sprints?|scrum|agile|kanban|backlog|jira|trello|okrs?)\b/i, 2, "project", "agile"],
  [/\b(girişim|startup|mvp|iş modeli|yatırımcı sunum|pitch deck|ürün yönetim)/i, 2, "project", "startup"],
  [/\b(startups?|mvp|business model|pitch deck|product management|go-to-market)\b/i, 2, "project", "startup"],
  [/\b(proje|plan\b|planla|planı\b|planın|planlar)/i, 1, "project", null],
  [/\b(projects?|plan)\b/i, 1, "project", null],

  // ---- Edebiyat ve yaratıcı yazı ----
  [/\b(şiir|dize\b|dizeler|dizesi|kafiye|uyak|hece ölçü|aruz|nazım|serbest vezin|gazel)/i, 2, "literature", "poetry"],
  [/\b(poems?|poetry|verses?|rhym\w*|stanzas?|limericks?|free verse)\b/i, 2, "literature", "poetry"],
  [/\b(hikaye|hikâye|öykü|roman(?! (empire|imparatorlu|hukuk|rakam))\b|romanı|romanın|romanda|romanlar|ana karakter|karakter gelişim|karakter analiz|kurgu|olay örgü|anlatıcı|masal|fantastik|bilim ?kurgu|distopya|ütopya|kahraman|diyalog yaz)/i, 2, "literature", "fiction"],
  [/\b(story|stories|short story|novel|main characters?|character development|fiction|plot twist|storyline|narrator|fairy tales?|fantasy|sci-?fi|science fiction|dystopi\w*|protagonist|dialogue)\b/i, 2, "literature", "fiction"],
  [/\b(edebiyat|edebi\b|edebî|edebi (akım|eser|metin|tür)|şair|metin çözümleme|metin inceleme|romanın teması|şiirin teması|ana tema|motif|sembol|alegori|divan edebiyat|tanzimat|servet-i fünun|kitap özeti|kitabın ana fikri|okuma notu|orhan pamuk|sait faik|nazım hikmet|yaşar kemal|oğuz atay|shakespeare|dostoyevski|tolstoy|kafka|camus)/i, 2, "literature", "analysis"],
  [/\b(literature|literary|poets?|close reading|central theme|theme of the (novel|poem|story|book)|motifs?|symbolism|allegor\w*|book summary|book review|shakespeare|dostoevsky|tolstoy|kafka|camus|orwell)\b/i, 2, "literature", "analysis"],
  [/\b(film senaryo|dizi senaryo|senaryo yaz|sahne|tiyatro|oyun metni)/i, 2, "literature", "screen"],
  [/\b(screenplay|theat(er|re)|stage play|film script)\b/i, 2, "literature", "screen"],
  [/\b(yaratıcı yazı|yazarı\b|yazarın|yazarlar)/i, 1, "literature", null],
  [/\b(creative writing|authors?|writers?)\b/i, 1, "literature", null],

  // ---- İş, kariyer, pazarlama ----
  [/\b(özgeçmiş|cv\b|ön yazı|iş başvuru|mülakat|linkedin|kariyer|terfi|maaş görüşme|işe alım|insan kaynak|staj başvuru)/i, 2, "business", "career"],
  [/\b(resume|cv|cover letter|job application|job interview|interview|linkedin|career|promotion|salary negotiation|hiring|recruit\w*|human resources|internship)\b/i, 2, "business", "career"],
  [/\b(pazarlama|reklam|kampanya|marka|müşteri|satış|sosyal medya|instagram|tiktok|seo|e-?ticaret|içerik takvim|hedef kitle|rakip analiz|swot)/i, 2, "business", "marketing"],
  [/\b(marketing|advertis\w*|campaigns?|brand\w*|customers?|sales|social media|instagram|tiktok|seo|e-?commerce|content calendar|target audience|competitor analysis|swot)\b/i, 2, "business", "marketing"],
  [/\b(yönetici|ekip yönet|ekip arkadaş|çalışanım|çalışanlar|toplantı|performans değerlendir|şirket|kurumsal|iş e-?posta|müdür|geri bildirim ver)/i, 1.5, "business", "management"],
  [/\b(manager|team lead\w*|team members?|employees?|coworkers?|colleagues?|meetings?|performance review|company|corporate|business email|kpis?|give feedback)\b/i, 1.5, "business", "management"],

  // ---- Ekonomi ve finans ----
  [/\b(borsa|hisse|yatırım|fon\b|kripto|bitcoin|portföy|temettü|halka arz)/i, 2, "finance", "investing"],
  [/\b(stocks?|shares|invest(ing|ment|ments|or|ors)?|funds?|crypto\w*|bitcoin|portfolio|dividends?|ipo|etf)\b/i, 2, "finance", "investing"],
  [/\b(kredi|konut kredi|faiz|bütçe|tasarruf|emeklilik|bes\b|sigorta|borç|taksit|kira artış)/i, 2, "finance", "personal"],
  [/\b(loans?|mortgage|interest rates?|budget\w*|savings|retirement|pension|insurance|debt|installments?)\b/i, 2, "finance", "personal"],
  [/\b(vergi|kdv|muhasebe|bilanço|gelir tablo|nakit akış|fatura|e-?fatura|amortisman|maliyet muhasebe)/i, 2, "finance", "accounting"],
  [/\b(tax(es)?|taxation|taxable|vat|accounting|balance sheet|income statement|cash flow|invoices?|depreciation|bookkeeping)\b/i, 2, "finance", "accounting"],
  [/\b(ekonomi|enflasyon|döviz|kur farkı|merkez bankası|gsyh|makroekonomi|mikroekonomi|arz ve talep|resesyon)/i, 2, "finance", "economics"],
  [/\b(econom\w*|inflation|exchange rates?|currency|central bank|gdp|macroeconomic\w*|microeconomic\w*|supply and demand|recession)\b/i, 2, "finance", "economics"],

  // ---- Hukuk ----
  [/\b(sözleşme|kira sözleşme|kiracı|ev sahibi|ihtarname|tazminat|kıdem tazminat|iş hukuk|lisans sözleşme|kullanım koşul|hizmet sözleşme)/i, 2, "law", "contract"],
  [/\b(contracts?|lease|tenants?|landlords?|damages|severance|employment law|license agreement|terms of (service|use)|nda|non-disclosure)\b/i, 2, "law", "contract"],
  [/\b(hukuk|kanun|yasa\b|yasası|yasal|yönetmelik|hakem heyet|tüketici hak|dava|mahkeme|avukat|hakim|savcı|dilekçe|miras|boşanma|velayet|anayasa|tck|tmk|icra\b|icra takib|tebligat)/i, 2, "law", "civil"],
  [/\b(law|legal\w*|statutes?|regulations?|lawsuits?|courts?|attorneys?|lawyers?|judges?|petitions?|inheritance|divorce|custody|constitution\w*|liability|litigation|appeals?)\b/i, 2, "law", "civil"],
  [/\b(kvkk|gdpr|kişisel veri|gizlilik politika|aydınlatma metn|çerez politika)/i, 2, "law", "privacy"],
  [/\b(gdpr|ccpa|personal data|privacy polic\w*|cookie polic\w*|data protection)\b/i, 2, "law", "privacy"],
  [/\b(telif|marka tescil|patent|fikri mülkiyet|lisans hakk|açık kaynak lisans|gpl|mit lisans)/i, 2, "law", "ip"],
  [/\b(copyright|trademarks?|patents?|intellectual property|open[- ]source licen[sc]e|gpl|mit license|fair use)\b/i, 2, "law", "ip"],

  // ---- Sağlık ----
  [/\b(sağlık|sağlıklı|doktor(\b|um|u\b|lar)|hekim|baş ağrı|baş dönme|bulanık görme|bulantı|kusma|öksürük|ishal|nefes darlı|çarpıntı|hastane|ilaç|doz|yan etki|belirti|semptom|tansiyon|şeker hastalığ|diyabet|kolesterol|enfeksiyon|antibiyotik|aşı\b|aşısı|aşılar|aşılama|hastalık|tedavi|teşhis|kanser|migren|alerji|hamile|gebelik|reçete|muayene|tahlil|kan değer)/i, 2, "health", "medical"],
  [/\b(health|healthy|doctors?|hospital|headaches?|dizziness|nausea|cough\w*|shortness of breath|medications?|medicine|dose|dosage|side effects?|symptoms?|blood pressure|diabetes|cholesterol|infections?|antibiotics?|vaccines?|diseases?|treatment|diagnos\w*|cancer|migraine|allerg\w*|pregnan\w*|prescription|lab results)\b/i, 2, "health", "medical"],
  [/\b(beslenme|diyet|kalori|vitamin|protein tozu|protein ihtiyac|günlük protein|makro besin|öğün plan|aralıklı oruç)/i, 2, "health", "nutrition"],
  [/\b(nutrition|diet\w*|calories?|vitamins?|protein powder|protein intake|macros|meal plan|intermittent fasting|fasting)\b/i, 2, "health", "nutrition"],
  [/\b(egzersiz|antrenman|spor salonu|kas yap|koşu program|esneme|fitness)/i, 2, "health", "fitness"],
  [/\b(exercise routine|workouts?|gym|running plan|stretching|fitness)\b/i, 2, "health", "fitness"],
  [/\b(psikolog|psikiyatr|terapi|kaygı|anksiyete|depresyon|stres|uyku|motivasyonum|tükenmişlik)/i, 2, "health", "mental"],
  [/\b(psychologists?|psychiatr\w*|therapy|therapist|anxiety|depression|stress(?! test)|insomnia|sleep (schedule|quality|problems?)|burnout)\b/i, 2, "health", "mental"],
  [/\b(parasetamol|ibuprofen|aspirin|majezik|parol|nurofen|antidepresan|antihistamin|kortizon|insülin|metformin|tansiyon ilac|ağrı kesici|kas gevşetici)/i, 2, "health", "medical"],
  [/\b(paracetamol|acetaminophen|ibuprofen|aspirin|antidepressants?|antihistamines?|cortisone|insulin|metformin|painkillers?|can i take)\b/i, 2, "health", "medical"],
  [/\b(ağrı|ateş|kilo|kalp)/i, 1, "health", "medical"],
  [/\b(pain|fever|weight loss|heart)\b/i, 1, "health", "medical"],

  // ---- Ders ve sınav ----
  [/\b(sınav|vize sınav|vizeler|final sınav|finaller|quiz|yks|tyt|ayt|kpss|ales|lgs|soru bankas|çoktan seçmeli|deneme sınav|sınava hazırlan)/i, 2, "education", "exam"],
  [/\b(exams?|midterms?|finals|quiz\w*|gre|gmat|multiple[- ]choice|practice test|test prep)\b/i, 2, "education", "exam"],
  [/\b(ödev|ödevim|ders not|ders çalış|konu anlatım|çalışma plan|dönem ödev|proje ödev|hoca)/i, 2, "education", "homework"],
  [/\b(homework|assignments?|lecture notes|study plan|study guide|coursework|problem sets?)\b/i, 2, "education", "homework"],
  [/\b(öğretmen|öğrenci|müfredat|ders plan|ders anlat|sınıf yönetim|eğitim materyal|kazanım)/i, 2, "education", "teaching"],
  [/\b(teachers?|students?|curriculum|syllab\w*|lesson plans?|classroom|teaching materials?|learning outcomes?)\b/i, 2, "education", "teaching"],
  [/\b(ders|üniversite|lise|okul)/i, 1, "education", null],
  [/\b(course|classroom|university|college|school)\b/i, 1, "education", null],

  // ---- Dil ----
  [/\b(dil ?bilgisi|gramer|eş anlam|zıt anlam|telaffuz|okunuş|deyim|atasöz|cümle yapı|imla|yazım kural|noktalama|kelime anlam)/i, 2, "language", "grammar"],
  [/\b(grammar|synonyms?|antonyms?|pronunciation|idioms?|proverbs?|sentence structure|spelling|punctuation|vocabulary|tenses?|present perfect|past perfect)\b/i, 2, "language", "grammar"],
  [/\b(ingilizce öğren|almanca öğren|dil öğren|ielts|toefl|yds|yökdil|kelime ezber|seviye testi)/i, 2, "language", "learning"],
  [/\b(learn (english|german|french|spanish|turkish|japanese)|language learning|ielts|toefl|cefr|flashcards?)\b/i, 2, "language", "learning"],
  [/\b(çevir|tercüme|ingilizcesi|türkçesi|almancası|ingilizceye|türkçeye)/i, 2, "language", "translation"],
  [/\b(translat\w*|into english|into turkish|how do you say)\b/i, 2, "language", "translation"],

  // ---- Tarih, felsefe, toplum ----
  [/\b(tarihsel|tarihte|tarihçi|tarih dersi|osmanlı|selçuklu|bizans|imparatorluk|kurtuluş savaşı|dünya savaşı|antik|ortaçağ|rönesans|sanayi devrimi|fransız devrimi)/i, 2, "humanities", "history"],
  [/\b(history of|historical|historians?|world history|art history|in history|ottoman|byzantine|empires?|world war|ancient|medieval|renaissance|industrial revolution|french revolution)\b/i, 2, "humanities", "history"],
  [/\b(felsefe|filozof|etik\b|etiği|ahlak|varoluş|epistemoloji|ontoloji|metafizik|nietzsche|kant\b|platon|aristoteles|sokrates|stoacı)/i, 2, "humanities", "philosophy"],
  [/\b(philosoph\w*|ethic\w*|moral\w*|existential\w*|epistemolog\w*|ontolog\w*|metaphysic\w*|nietzsche|kant|plato|aristotle|socrates|stoic\w*)\b/i, 2, "humanities", "philosophy"],
  [/\b(sosyoloji|toplum|kültür|antropoloji|siyaset|siyasi|politikacı|seçimler|seçim sonuç|genel seçim|yerel seçim|demokrasi|ideoloji|mitoloji|din\b|teoloji|arkeoloji|coğrafya|göç)/i, 2, "humanities", "society"],
  [/\b(sociolog\w*|society|cultur\w*|anthropolog\w*|politic\w*|elections?|democracy|ideolog\w*|mytholog\w*|religions?|theolog\w*|archaeolog\w*|geography)\b/i, 2, "humanities", "society"],
  [/\b(psikoloji|bilişsel|davranış bilim|bilinçaltı)/i, 2, "humanities", "psychology"],
  [/\b(psychology|cognitive|behavio(u)?ral science|subconscious)\b/i, 2, "humanities", "psychology"],

  // ---- Günlük yaşam ----
  [/\b(yemek|tarif\b|tarifi|tarifler|mutfak|kahvaltı|akşam yemeğ|fırında|pişir|tatlı tarif|çorba|salata|malzeme listesi)/i, 2, "daily", "food"],
  [/\b(recipes?|cook(ing|ed|s)?|kitchen|breakfast|dinner|lunch|bak(e|ing)|soup|salad|ingredients?)\b/i, 2, "daily", "food"],
  [/\b(seyahat|tatil|gezi\b|gezisi|otel|uçak bilet|gezilecek yer|rota\b|rotası|vize başvuru|schengen|valiz|kamp\b|kampa|kamping)/i, 2, "daily", "travel"],
  [/\b(travel\w*|vacation|holiday|trip|hotels?|flights?|itinerar\w*|places to visit|packing list|camping)\b/i, 2, "daily", "travel"],
  [/\b(ev temizli|dekorasyon|bahçe|bitki bakım|evcil hayvan|kedi|köpek|tadilat|mobilya|alışveriş|hangi telefon|hangi laptop)/i, 2, "daily", "home"],
  [/\b(house cleaning|decor\b|decorat(e|ing|ion)|garden\w*|houseplants?|pets?|cats?|dogs?|renovat\w*|furniture|shopping|which (phone|laptop) should)\b/i, 2, "daily", "home"],
  [/\b(film öneri|dizi öneri|kitap öneri|oyun öneri|kutu oyun|hobi|futbol|maç|kıyafet|moda\b|modası|makyaj|şaka|bilmece|bulmaca)/i, 2, "daily", "fun"],
  [/\b(movie recommendations?|board games?|family night|tv shows?|book recommendations?|game recommendations?|hobb(y|ies)|football|soccer|outfits?|fashion|makeup|jokes?|riddles?|puzzles?)\b/i, 2, "daily", "fun"],
  [/\b(sevgilim|arkadaşım|annem|babam|ailem|ilişkim|ilişki tavsiye|doğum günü|hediye|düğün|davetiye|tebrik)/i, 2, "daily", "people"],
  [/\b(girlfriend|boyfriend|my friend|my mom|my dad|my family|my relationship|relationship advice|dating|birthday|gifts?|wedding|invitation|congratulat\w*)\b/i, 2, "daily", "people"],

  // ===== Genişletilmiş sözlük (günlük dilde geçen alan kelimeleri; çoğu 1,5 puan) =====
  // Bilim
  [/\b(manyeti|süperpozisyon|belirsizlik ilkesi|heisenberg|dalga-parçacık|fotoelektrik|higgs|bozon|kuark|nükleer|radyoaktif|yarılanma ömr|fisyon|füzyon|kaldırma kuvvet|arşimet|statik elektrik|donma noktas|kaynama noktas|buharlaşma|maddenin hal|gel-?git|ayın evre|güneş tutulma|ay tutulma|kuyruklu yıldız|meteor|yörünge|astronot|roket|uzay istasyon|ozon|sera gaz|karbon salın|fosil|dinozor|bağışıklık|antikor|hormon|metabolizma|sinir sistem|kalıtım|mendel|nesli tüken|izotop|elektroliz|alaşım|ışığın|sesin hız|basınç)/i, 1.5, "science", null],
  [/\b(magnet\w*|superposition|uncertainty principle|heisenberg|photoelectric|higgs|bosons?|quarks?|nuclear|radioactiv\w*|half-life|fission|fusion|buoyancy|archimedes|static electricity|freezing point|boiling point|evaporation|states of matter|tides?|moon phases?|eclipses?|comets?|meteors?|orbits?|astronauts?|rockets?|space station|ozone|greenhouse gas\w*|carbon emissions?|fossils?|dinosaurs?|immune system|antibod\w*|hormones?|metabolism|nervous system|heredity|mendel\w*|extinct\w*|isotopes?|electrolysis|alloys?|speed of sound|air pressure)\b/i, 1.5, "science", null],
  [/\b(yıldızın|yıldızlar|metaller|bitkiler|hayvanlar|canlılar|sıcaklık|donar|erir)/i, 1, "science", null],
  [/\b(stars?|metals?|plants?|animals|temperature|freez(e|es|ing)|melt(s|ing)?)\b/i, 1, "science", null],
  // Matematik
  [/\b(alt küme|boş küme|kümeler|bölünebil|asal|tam sayı|kesir|oran ?orantı|faktöriyel|yakınsa|ıraksa|limit al|limitini|sınır değer|parabol|hiperbol|elips|pisagor|sinüs|kosinüs|tanjant|determinant|doğrusal denklem|denklem sistem|eşitsizli|mutlak değer|karmaşık sayı|kompleks sayı|bayes|beklenen değer|rastgele değişken|binom|poisson|markov|graf teori|kombinatorik|modüler aritmetik|sayılar teori|2 sigma|sigma dışı)/i, 1.5, "math", null],
  [/\b(subsets?|empty set|set theory|divisib\w*|primes?|integers?|fractions?|factorial|converg\w*|parabola|hyperbola|ellipse|pythagor\w*|sine|cosine|tangent line|determinant|linear equations?|system of equations|solve the system|absolute value|complex numbers?|bayes\w*|posterior|expected value|random variables?|binomial|poisson|markov|graph theory|combinatorics|modular arithmetic|number theory)\b/i, 1.5, "math", null],
  [/\b(series|limits?|prior|angles?|circle|vectors?)\b/i, 1, "math", null],
  // Mühendislik
  [/\b(ac motor|dc motor|step motor|servo|enkoder|555|entegre devre|şarj kontrol|güneş panel|batarya|akü|invertör|inverter|trafo|transformatör|jeneratör|kablo kesit|topraklama|elektrik tesisat|rüzgar yük|statik hesap|yük hesab|basınç kab|kaynak dikiş|cıvata|tolerans|malzeme seçim|robot|drone|dron|iha\b|baz direnc|anahtar olarak|pascal ilke)/i, 1.5, "engineering", null],
  [/\b(ac motors?|dc motors?|stepper|servos?|encoders?|555 timer|integrated circuits?|charge controller|solar panels?|batter(y|ies)|inverters?|generators?|wiring|grounding|wind load|load calculation|pressure vessels?|welding|bolts?|tolerances?|material selection|robot\w*|drones?|3d printer|stepper motor)\b/i, 1.5, "engineering", null],
  [/\b(motor|çelik|alüminyum|verim)/i, 1, "engineering", null],
  [/\b(motors?|steel|aluminum|efficiency)\b/i, 1, "engineering", null],
  // Yazılım
  [/\b(monorepo|paket yönetici|bellek sızıntı|iş parçacığı|thread|coroutine|async|asenkron|promise|callback|generic tip|derleyici|birim test|test yaz|betik|komut satır|terminal|kod taban|commit|branch|pull request|bağımlılık|endpoint|json|yaml|dosyaları yeniden adlandır|index out of|stack overflow|null pointer)/i, 1.5, "software", null],
  [/\b(monorepo|repo(sitory)?|package manager|memory leaks?|threads?|coroutines?|async|await|promises?|callbacks?|generics?|interfaces?|compilers?|unit tests?|scripts?|command line|cli|vs ?code|ide|codebase|commits?|branch(es)?|pull requests?|merge conflicts?|dependenc(y|ies)|endpoints?|json|yaml|xml|index out of bounds|stack overflow|runtime|panics?)\b/i, 1.5, "software", null],
  // Veri ve yapay zekâ
  [/\b(dil model|yapay zeka model|kendi verim|verimle|gradyan iniş|kayıp fonksiyon|doğruluk oran|tahmin model|öneri sistem|görüntü işleme|nesne tanıma|ses tanıma|chatbot|sohbet bot|kümeleme|k-means|karar ağac|rastgele orman|xgboost|veri temizle|veriyi görselleştir|grafikle|grafiğe dök)/i, 1.5, "data_ai", null],
  [/\b(language models?|gradient descent|loss function|accuracy|precision and recall|predictive models?|recommendation systems?|computer vision|image recognition|object detection|speech recognition|chatbots?|clustering|k-means|decision trees?|random forest|xgboost|data cleaning|visuali[sz]e|charts?|graphs?|inference|benchmarks?|model weights)\b/i, 1.5, "data_ai", null],
  // Akademik
  [/\b(araştırma öneri|doktora başvuru|yüksek lisans başvuru|kapak mektub|editöre|sistematik derleme|meta-?analiz|et al|kaynak göster|alıntı|intihal|benzerlik oran|turnitin|akademik dil|bilimsel yazım|deney rapor|lab rapor|sempozyum|yazar sıra|impact factor|scopus|web of science)/i, 1.5, "academic", null],
  [/\b(systematic reviews?|meta-?analys[ie]s|et al|citing|plagiarism|turnitin|academic writing|scientific writing|lab reports?|symposium|authorship|impact factor|scopus|web of science|letter to the editor|research proposals?|phd application|grad school|papers)\b/i, 1.5, "academic", null],
  // Proje
  [/\b(organizasyon|etkinlik plan|yapılacaklar|görev liste|önceliklendir|öncelik sıra|haftalık görev|aylık hedef|kaynak tahsis|proje bütçe|iş bölüm|lansman plan|takip tablo|ilerleme rapor|retrospektif|hedeflere böl|adımlara böl)/i, 1.5, "project", null],
  [/\b(event planning|to-?do lists?|task lists?|prioriti[sz]\w*|rice scoring|moscow method|weekly tasks|break (this|it) (down|into)|action plan|resource allocation|project budget|launch plan|trackers?|progress reports?|retrospectives?)\b/i, 1.5, "project", null],
  // Edebiyat
  [/\b(anısına|ağıt|dörtlük|mısra|büyü sistem|dünya kurgu|ejderha|kötü karakter|antagonist|hikayeye devam|hikâyeye devam|devamını yaz|yabancılaşma|dönüşüm'?ün|kitap incele|kitap yorum|edebi akım|realizm|natüralizm|postmodern)/i, 1.5, "literature", null],
  [/\b(elegy|memorial poem|haiku-style|haiku poem|magic systems?|worldbuilding|dragons?|villains?|antagonists?|continue (this|the) story|chapters?|narratives?|alienation|metamorphosis|book analysis|literary movements?|realism|romanticism|postmodern\w*)\b/i, 1.5, "literature", null],
  // İş ve kariyer
  [/\b(oryantasyon|yeni başlayan|basın bülten|ürün lansman|ürün tanıtım|zam iste|maaş artış|patron|yöneticim|müdürüm|satış görüşme|itirazları|fiyat teklif|müşteri şikayet|iş ortaklı|tedarikçi|bayi|franchise|şirket kur|resmi e-?posta|kurumsal iletişim|halkla ilişki|yeni işim)/i, 1.5, "business", null],
  [/\b(onboarding|new hires?|press release|product launch|ask (my )?(boss|manager) for a raise|pay raise|boss|sales calls?|objection handling|customer complaints?|partnerships?|suppliers?|vendors?|franchise|announcing my new job|new job|job offer|negotiat\w*|public relations)\b/i, 1.5, "business", null],
  // Finans
  [/\b(altın\b|altını|gram altın|dolar\b|doları|dolar kur|euro|para biriktir|birikim|taksit|kredi kart|maaşım|gelir gider|giderler|kâr|değerleme|dcf|şirket değer|hisse senedi|tahvil|bono|mevduat|vadeli|yatırım fon|kripto para|net servet)/i, 1.5, "finance", null],
  [/\b(gold|dollars?|euros?|save money|savings account|compound interest|installments?|credit cards?|salary|income|expenses?|profit|valuation|dcf|bonds?|deposits?|car loan|pay off|net worth|financial|money)\b/i, 1.5, "finance", null],
  // Hukuk
  [/\b(yasal olarak|hukuken|kanunen|haklarım|hakkım var mı|şikayet et|savcılı|polise|gürültü|trafik ceza|cezasına itiraz|şarkı söz|telif hakk|izin almadan|sözleşme taslağ|gizlilik sözleşme|noter|vekaletname|tapu|imar|miras pay|nafaka|işten çıkar|mobbing|sgk|ihbar süre)/i, 1.5, "law", null],
  [/\b(legally|my rights|is it legal|sue|police|noise complaints?|traffic tickets?|song lyrics|without permission|draft (a|an) (contract|agreement)|notary|power of attorney|deeds?|zoning|alimony|wrongful termination|harassment|evictions?|copyrighted)\b/i, 1.5, "law", null],
  // Sağlık
  [/\b(ateşi|ateş düşür|çocuğumun|bebeğimin|kas ağrı|sıcak mı soğuk mu|buz koy|su içmeli|kaç litre su|koşu\b|koşuya|koşmaya|5 km|yürüyüş|kansızlık|demir eksik|b12|d vitamin|tahlil sonuç|kan tahlil|röntgen|ultrason|eczane|şurup|merhem|sivilce|egzama|saç dökül|diş\b|dişim|diş ağrı|diş eti|dişçi|gözüm|gözlük|kulak ağrı|boğaz ağrı|grip|soğuk algınlığı|covid|nezle|astım|uykusuzluk|yorgunluk|halsizlik|kilo ver|kilo al|zayıfla|hangi besin|besinler)/i, 1.5, "health", null],
  [/\b(drink (enough )?water|hydration|go running|start running|beginner run\w*|5k|10k|marathon|jogging|anemia|iron deficiency|b12|vitamin d|blood tests?|x-?rays?|mri|ultrasound|pharmacy|syrup|ointment|acne|eczema|hair loss|toothache|sore throat|flu|cold symptoms|covid|asthma|fatigue|lose weight|gain weight|muscle pain|sore muscles|ice or heat|fever|my (child|baby|son|daughter) (has|is))\b/i, 1.5, "health", null],
  // Ders ve sınav
  [/\b(öğretir gibi|yaşındaki birine|çocuğa anlat|ezber teknik|ezberle|çalışma teknik|pomodoro|not alma|konu tekrar|lise öğrenci|ortaokul|ilkokul|sözlü sınav|not ortalama|transkript|ders seçim|bölüm seçim)/i, 1.5, "education", null],
  [/\b(like i'?m (5|five|a child|ten)|eli5|teach me|memori[sz]\w*|study techniques?|pomodoro|note-?taking|revision|high school|middle school|elementary school|gpa|transcripts?|quiz me|test me|lessons?)\b/i, 1.5, "education", null],
  // Dil
  [/\b(fransızca|almanca|ispanyolca|italyanca|japonca|korece|çince|rusça|fiil çekim|çekimleri|geçmiş zaman|gelecek zaman|nasıl söylenir|nasıl denir|sözcük|cümle kur|dil kurs|aksan)/i, 1.5, "language", null],
  [/\b(french|german|spanish|italian|japanese|korean|chinese|mandarin|russian|conjugat\w*|past tense|future tense|how (do|would) (you|i) say|phrasal verbs?|accent|fluent|fluency)\b/i, 1.5, "language", null],
  // Tarih, felsefe, toplum
  [/\b(rönesans|reform hareket|aydınlanma çağ|sömürge|kolonyal|padişah|atatürk|cumhuriyet|devrim|ihtilal|antik yunan|roma imparator|mezopotamya|medeniyet|uygarlı|özgür irade|determinizm|bilinç nedir|zihin felsefe|hayatın anlam|faydacılık|varoluşçuluk|nihilizm|marksizm|kapitalizm|sosyalizm|liberalizm|feminizm|insan hakları|şehirleşme|kentleşme|nüfus|demografi|eşitsizlik|savaşı|savaşın)/i, 1.5, "humanities", null],
  [/\b(renaissance|reformation|enlightenment|coloni\w*|emperors?|sultans?|revolution|civili[sz]ations?|ancient (greece|rome|egypt)|mesopotamia|free will|determinism|consciousness|philosophy of mind|meaning of life|utilitarian\w*|existentialism|nihilism|marxism|capitalism|socialism|liberalism|feminism|human rights|urbani[sz]ation|populations?|demograph\w*|inequality|art movements?|wars?)\b/i, 1.5, "humanities", null],
  // Günlük yaşam
  [/\b(ekmek|mayala|hamur|kek\b|keki|kurabiye|börek|pilav|tavuk|sebze|meyve|kahve|balon tur|kapadokya|müze|plaj|tatile|ne giysem|ne giyeyim|tuvalet eğitim|mama\b|veteriner|yavru|akvaryum|saksı|çiçek|leke|çamaşır|ütü|bulaşık|evlilik teklif|buluşma|sürpriz|bayram|yılbaşı|hafta sonu|piknik|bisiklet|telefon öneri|laptop öneri|kulaklık)/i, 1.5, "daily", null],
  [/\b(bread|dough|yeast|cakes?|pasta|rice|chicken|vegetables?|fruits?|coffee|tea|balloon (ride|tour)|tours?|museums?|beach|pack for|what (should i|to) (wear|pack)|potty training|vet|veterinar\w*|puppy|kitten|aquarium|flowers?|stains?|laundry|ironing|dishes|date night|surprise|celebrat\w*|weekend|picnic|bikes?|headphones|which (phone|laptop|car))\b/i, 1.5, "daily", null]
];

// Unicode uyumlu kelime sınırı (classify.js ile aynı yöntem)
// Hız için: baştaki \b → "öncesinde harf yok", diğerleri (hep bir harften sonra gelir) → "sonrasında harf yok".
const W = "[\\p{L}\\p{N}_]";
const RULES = R.map(([re, pts, dom, sub]) => {
  let src = re.source;
  if (src.startsWith("\\b")) src = `(?<!${W})` + src.slice(2);
  src = src.replaceAll("\\b", `(?!${W})`);
  return { re: new RegExp(src, "giu"), pts, dom, sub };
});

// İş türünden gelen ipuçları
const TYPE_HINT = {
  translate: [["language", 2]], code_write: [["software", 2]], code_fix: [["software", 2]],
  math: [["math", 1.5]], data_analysis: [["data_ai", 1.5]]
};

function variants(text) {
  const a = text.toLocaleLowerCase("tr"), b = text.toLowerCase();
  return a === b ? [a] : [a, b];
}

// cls: classify() çıktısı (isteğe bağlı; iş türü ipucu ve kod işareti için)
export function detectDomain(prompt, cls = null) {
  const text = String(prompt || "");
  const ruleText = text.length > 3500 ? text.slice(0, 2500) + "\n" + text.slice(-1000) : text;
  const vs = variants(ruleText);
  const score = {}, subScore = {}, hits = {};
  for (const r of RULES) {
    let seen = null;
    for (const v of vs) {
      r.re.lastIndex = 0;
      const m = v.match(r.re);
      if (m && (!seen || m.length > seen.length)) seen = m;
    }
    if (!seen) continue;
    const distinct = [...new Set(seen.map((x) => x.trim()))];
    const pts = r.pts * Math.min(3, distinct.length);
    score[r.dom] = (score[r.dom] || 0) + pts;
    if (r.sub) (subScore[r.dom] ||= {})[r.sub] = ((subScore[r.dom] || {})[r.sub] || 0) + pts;
    for (const w of distinct) if (w.length >= 2 && w.length <= 30) { const h = (hits[r.dom] ||= []); if (!h.includes(w) && h.length < 6) h.push(w); }
  }
  // İş türü ve kod işareti
  // (çok kısa ya da belirsiz mesajda iş türü tahmini zayıf: "devam et" ipucu vermez)
  // Kurallar ve öğrenen model aynı türde anlaşmıyorsa ipucu verilmez (yanlış "çeviri" tahmini dil alanı sanılmasın)
  if ((cls?.words || 0) >= 3 && cls?.confidence !== "low" && (!cls.ruleType || cls.ruleType === cls.type)) for (const [d, p] of TYPE_HINT[cls?.type] || []) score[d] = (score[d] || 0) + p;
  if ((cls?.signals || []).includes("code")) score.software = (score.software || 0) + 2;
  if ((cls?.signals || []).includes("sheet")) score.data_ai = (score.data_ai || 0) + 1.5;

  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  const [d1, s1] = ranked[0] || ["general", 0];
  const [d2, s2] = ranked[1] || [null, 0];
  if (s1 < 1.5) return { domain: "general", sub: null, second: null, score: s1, confidence: "low", hits: [] };
  const subs = subScore[d1] || {};
  const sub = Object.keys(subs).sort((a, b) => subs[b] - subs[a])[0] || null;
  const margin = s1 - s2;
  const confidence = margin >= 3 || (s1 >= 4 && margin >= 2) ? "high" : margin >= 1 ? "medium" : "low";
  // İkinci alan: anlamlıysa (≥ 2 puan ve ilkinin %60'ı) gösterilir, ör. "Bilim · Fizik + Ders ve sınav"
  const second = d2 && s2 >= 2 && s2 >= 0.6 * s1 ? d2 : null;
  return { domain: d1, sub, second, score: s1, confidence, hits: (hits[d1] || []).slice(0, 3) };
}
