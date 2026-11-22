# Marketuz

O‘zbekiston bo‘ylab sotuvchi va xaridorlar uchun Node.js/Express/PostgreSQL marketplace. To‘rt fasl va to‘qqiz bayramga moslashtiriladigan responsive web ilova; Telegram Mini App va mobil WebView shu HTTPS manzilni ochadi.

## Ishga tushirish

Node 20+ bilan `npm ci` va `npm start` bajaring. Mahalliy `.env` faylini Node o‘zi o‘qimaydi: `node --env-file=.env server.js` ishlating. `DATABASE_URL` berilmasa katalog ochiladi, ammo hisob, buyurtma va admin yozuvlari ishlamaydi. `schema.sql` ishga tushganda mavjud ma’lumotni saqlab qolgan holda tekshiriladi. `npm run check` va `npm test` kod hamda oddiy API ssenariylarini tekshiradi.

Render: Node runtime, build `npm ci`, start `npm start`, health check `/api/healthz`; PostgreSQL ichki URL manzilini `DATABASE_URL` ga, `SESSION_SECRET` ga kamida 32 belgili noyob kalit, administrator email/parolini `ADMIN_EMAIL`/`ADMIN_PASSWORD` ga kiriting. Parol kamida 16 belgi bo‘lsin. Maxfiy qiymatlarni repoga joylamang.

## Boshqaruv

`/admin` sahifasi: sotuvchilar va mahsulotlar moderatsiyasi, platforma mahsulotlarini qo‘shish va tahrirlash, buyurtma holatlari va kuzatuv raqami, brend/nom/logotip/favicon, SEO va ulashish rasmlari, kategoriya/karta rasmlari, bosh sahifa matnlari, 20 ta alohida ikonka, qoidalar va aloqa. Administrator PNG/JPEG/WebP rasmni 1.5 MB gacha yuklaydi; fayl PostgreSQL'da saqlanadi. Sozlamalar bazada qoladi, o‘zgarishlar audit jadvaliga yoziladi.

Mavsum tizimi Toshkent sanasi asosida ishlaydi. Qish 20-noyabrdan boshlanadi. Yangi yil, 8-mart, Navro‘z, Xotira va qadrlash kuni, Mustaqillik, Ustozlar kuni va Konstitutsiya kuni oldindan belgilangan oraliqda ko‘rinadi. Ramazon va Hayitning o‘zgaruvchan sanalari admin paneldan qo‘lda belgilanadi. Har bir bayram uchun sarlavha, izoh, fon, hero va gulchambar alohida sozlanadi. Bahor/yoz/kuz/qish rasmlari va maxsus Navro‘z, Mustaqillik, 8-mart, Ustozlar kuni, Hayit san’ati repoda bor.

Har bir mahsulotda uchta nomlangan HTTPS tashqi havola tahrirlanadi. Mahsulotning o‘z URL'i, Telegram/WhatsApp va OS ulashish funksiyasi mavjud. SEO sahifa sarlavhasi, canonical, Open Graph, Product JSON-LD, sitemap va PWA manifest serverdan yaratiladi. Xaridor: katalog, qidiruv, savat, sevimlilar, hisob, buyurtma. Sotuvchi: ariza, mahsulotlar va jo‘natishga tayyorlash. Tranzaksiyalar buyurtma va ombor sonini bloklash bilan bajariladi.

## To‘lovni faollashtirish

Click va Payme hosted checkout hamda signed server callback kodlari tayyor. **Hozir kalitlar va provayder sertifikatsiyasi mavjud bo‘lmaguncha ular faol emas.** Buyurtmada «yetkazilganda to‘lov» ishlaydi. Onlayn to‘lovni ochish uchun:

1. Click/Payme bilan shartnoma va haqiqiy merchant identifikator/kalitlarini oling. Ularni faqat Render environment variables ichiga kiriting; `.env.example` nomlarni ko‘rsatadi.
2. Provayder kabinetida Click `https://DOMEN/api/payments/click/prepare` va `/complete`, Payme Merchant API `https://DOMEN/api/payments/payme` manzillarini sozlang. Sandbox'da yaratish, qayta callback, bekor qilish, noto‘g‘ri imzo va pul miqdorini tekshiring.
3. Admin panelda operatorning yuridik nomi, STIR, manzil, telefon, email va qaytarish tartibini to‘ldiring. Jo‘natish narxi mahsulot narxiga kiritilgan biznes modelidagina `SHIPPING_INCLUDED_IN_PRICE=true` o‘rnating. Shundan keyin `PAYMENTS_ENABLED=true` qilib qo‘ying. Tizim shu shartlar bajarilmaguncha onlayn variantlarni ko‘rsatmaydi. Alohida yetkazish tarifi kerak bo‘lsa, to‘lovni yoqmang; avval tarif/checkout hisobini ishlab chiqing.

Payme callbacklari uchun `PAYME_LOGIN` merchant kabinetida beriladigan HTTP Basic login bo‘lib, `PAYME_KEY` bilan tekshiriladi. Click maxfiy kaliti kodga yozilmaydi. Har bir gateway tranzaksiyasi bazada saqlanadi va takroriy xabarlar holat bo‘yicha qayta ishlanadi. Bu integratsiya provayder sandbox va real merchant sertifikatsiyasidan o‘tganini anglatmaydi.

## Telegram va mobil ilova

`TELEGRAM_BOT_TOKEN` va `TELEGRAM_WEBHOOK_SECRET` o‘rnating. So‘ng `MARKETUZ_URL=https://DOMEN node scripts/configure-telegram.mjs` ishlatib bot menu button va webhook'ni sozlang. Telegram Mini App `initData` serverda HMAC va vaqt bo‘yicha tekshiriladi, foydalanuvchi uchun o‘sha do‘kon sessiyasi ochiladi. Android/iOS WebView ayni HTTPS URL'ni ochishi mumkin; checkout tashqi to‘lov havolasini native ilovaga `marketuz:openExternal` xabari bilan beradi. Native APK/IPA alohida loyiha bo‘ladi.

## Savdoga chiqishdan oldin

UzPost API va tariflari shartnoma/texnik hujjatlarsiz ulanmaydi; hozir admin kuzatuv raqamini qo‘lda kiritadi. Rasmiy operator rekvizitlari, oferta/qaytarish tartibi, fiskal chek, shaxsga doir ma’lumotlarning saqlanish hududi va huquqiy asosini mutaxassis bilan yakunlang. Render bepul PostgreSQL vaqtinchalik va zaxira nusxasiz; haqiqiy mijoz ma’lumotlari uchun uzoq muddatli DB, backup, monitoring va tashqi object storage kerak. Katalog ko‘paysa `DB_POOL_MAX`, DB sig‘imi va ilova instansiyalarini o‘lchovga qarab ko‘paytiring.
