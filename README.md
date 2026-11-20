# Marketuz

O‘zbek tilidagi marketplace sinov loyihasi. Node.js + Express + PostgreSQL. Bitta xizmat frontend va API'ni beradi; shu sababli Render `nodechat` workspace'ga bitta web service va alohida PostgreSQL database bilan joylanadi.

## Ishga tushirish

Node 20+ kerak. `npm install`, `.env.example` asosida shaxsiy `.env` sozlang va `npm start` bajaring. Node bu loyihada `.env`ni o‘zi o‘qimaydi: mahalliy ishga tushirishda `node --env-file=.env server.js` ishlating. `DATABASE_URL` bo‘lmasa, katalogni ko‘rish uchun namoyish rejimi ochiladi; hisob va buyurtmalar faqat bazaga ulangan holda ishlaydi. `schema.sql` server ishga tushganda bajariladi. Birinchi marta 16 ta namuna mahsulot yuklanadi.

Render: Node runtime, `npm ci` build, `npm start` start, region `frankfurt`, health check `/api/healthz`. `DATABASE_URL` uchun shu regiondagi PostgreSQL ichki URL'i, `SESSION_SECRET` uchun kamida 32 tasodifiy belgi, `ADMIN_EMAIL`/`ADMIN_PASSWORD` uchun administratorga tegishli qiymatlar. Secrets GitHub'ga yuklanmaydi. Production uchun pullik, zaxiralanadigan PostgreSQL va sig‘imni biznes trafikiga qarab tanlang.

## Ishlaydigan bo‘limlar

- Xaridor: katalog, qidirish, saralash, mahsulot sahifasi, savat, sevimlilar, ro‘yxatdan o‘tish/kirish, profil, parol, buyurtma so‘rovi, buyurtma tarixi va bekor qilish.
- Sotuvchi: ariza, tasdiqdan keyin mahsulot qo‘shish/tahrirlash/arxivlash, buyurtma satrlarini tayyorlash.
- Administrator: arizalar va mahsulotlarni tasdiqlash, buyurtma holati hamda kuzatuv raqamini yangilash, asosiy ko‘rsatkichlar.
- PostgreSQL tranzaksiyasi va satr bloklash orqali ombor miqdorini buyurtma vaqtida tekshirish; rollar serverda tekshiriladi. Baza foydalanuvchilar soni ortishi bilan xizmatdan mustaqil ravishda kattalashtiriladi. Indekslar kategoriya, status, buyurtma va sotuvchi bo‘yicha qo‘yilgan.

## Sinov bosqichi va ishga tushirish shartlari

UzPost API yoki tariflari ulanmagan: admin tashqi jo‘natmaning kuzatuv raqami va holatini qo‘lda kiritadi. Shartnomadan so‘ng rasmiy API hujjatlari, autentifikatsiya va webhooklar asosida alohida adapter qo‘shiladi. Yetkazish narxi hisoblanmaydi va sayt haqiqiy karta to‘lovini qabul qilmaydi. Mahsulot rasmlari hozir HTTPS havola orqali qo‘shiladi; katta katalog uchun huquqlari tekshirilgan rasmlar va S3/R2 turidagi object storage hamda CDN ulanishi lozim.

Rasmiy savdo boshlanishidan oldin yuridik shaxs rekvizitlari, aloqa kanali, qaytarish/oferta va sotuvchi shartlari, shuningdek shaxsga doir ma’lumotlar joylashuvi va qayta ishlanishining huquqiy asosini tasdiqlash kerak. Render bepul PostgreSQL bazasi 30 kundan keyin tugaydi va zaxira nusxasini yaratmaydi; haqiqiy mijoz ma’lumotlarini bunday bazaga joylamang.
