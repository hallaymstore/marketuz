# Marketuz

O‘zbekiston bo‘ylab sotuvchi va xaridorlar uchun Node.js/Express/PostgreSQL marketplace. To‘rt fasl va to‘qqiz bayramga moslashtiriladigan responsive web ilova; Telegram Mini App va mobil WebView shu HTTPS manzilni ochadi.

## Ishga tushirish

Node 20+ bilan `npm ci` va `npm start` bajaring. Mahalliy `.env` faylini Node o‘zi o‘qimaydi: `node --env-file=.env server.js` ishlating. `DATABASE_URL` berilmasa katalog ochiladi, ammo hisob, buyurtma va admin yozuvlari ishlamaydi. `schema.sql` ishga tushganda mavjud ma’lumotni saqlab qolgan holda tekshiriladi. `npm run check` va `npm test` kod hamda oddiy API ssenariylarini tekshiradi.

Render: Node runtime, build `npm ci`, start `npm start`, health check `/api/healthz`; PostgreSQL ichki URL manzilini `DATABASE_URL` ga, `SESSION_SECRET` ga kamida 32 belgili noyob kalit, administrator email/parolini `ADMIN_EMAIL`/`ADMIN_PASSWORD` ga kiriting. Parol kamida 16 belgi bo‘lsin. Maxfiy qiymatlarni repoga joylamang.

## Boshqaruv

Mahsulotlar uchun `/seller/product/new` va `/admin/product/new` alohida muharrir sahifalari ochiladi; tahrir havolalari mahsulot ro‘yxatida. Asosiy kategoriya va quyi kategoriyani tanlash, brend/SKU, narx/zaxira, 4000 belgigacha tavsif, 24 xususiyat, asosiy rasm, 12 ta galereya rasmi, ikki xil fon, 30 variant (har birining nomi, SKU, narxi, qoldig‘i va rasmi), uchta tashqi havola qo‘llanadi. Quyi kategoriyalar `/admin/subcategories` sahifasidan qo‘shiladi yoki o‘chiriladi. Asosiy surat bo‘sh bo‘lsa neytral “rasm kutilmoqda” tasviri ishlatiladi; haqiqiy mahsulot rasmi sifatida ko‘rsatilmaydi. Muharrirdagi rasmlarni qurilmadan bittadan yoki galereyaga bir nechtasini yuklash va HTTPS havoladan kiritish mumkin.

`/seller/products/import` va `/admin/products/import` da `.xlsx` shablonini yuklab, `Mahsulotlar` va `Variantlar` varaqlarini to‘ldiring. Har mahsulotga alohida SKU, har variantga ota mahsulot SKU yoziladi. `galereya` ustunidagi rasm havolalarini `|` bilan ajrating; `xususiyatlar` ustuni `Nomi: qiymat | Nomi: qiymat` formatida. Faylga rasm ichki obyekt sifatida joylamang. Oldin preview va maydon tekshiruvi, so‘ng bitta tranzaksiyada 200 tagacha mahsulot va 800 tagacha variant kiritiladi. Yangi mahsulotlar tekshiruv holatida qoladi; takror SKU bo‘lsa import to‘liq qaytariladi. Variantli mahsulot kartasida tanlash uchun batafsil sahifaga o‘tiladi; savat, narx, qoldiq va buyurtma o‘sha variant bo‘yicha yuradi. Buyurtma bekor bo‘lsa band qilingan qoldiq qaytariladi.

`/admin` sahifasi: sotuvchilar va mahsulotlar moderatsiyasi, platforma mahsulotlarini qo‘shish va tahrirlash, buyurtma holatlari va kuzatuv raqami, brend/nom/logotip/favicon, SEO va ulashish rasmlari, kategoriya/karta rasmlari, bosh sahifa matnlari hamda banner, katta karta, yetkazish va kirish sahifasi rasmlari, 20 ta alohida ikonka, qoidalar va aloqa. Navbar ustidagi rasmli aksiya lentasi sanalar va mobil rasm bilan yoqiladi; pastki o‘ngdagi suriladigan yordamchining uch FAQ bo‘limi va birinchi kirish yo‘lko‘rsatgichi ham shu paneldan tahrirlanadi. Administrator bezak va brend rasmlarini, sotuvchi esa mahsulotning asosiy rasmi, katalog kartasi foni va batafsil sahifa fonini PNG/JPEG/WebP formatida 1.5 MB gacha yuklaydi yoki HTTPS rasm manzilini kiritadi; fayl PostgreSQL'da saqlanadi. Fon tanlanmasa asosiy rasm yumshoq qatlamda ishlatiladi. Sozlamalar bazada qoladi, o‘zgarishlar audit jadvaliga yoziladi.

Mavsum tizimi Toshkent sanasi asosida ishlaydi. Qish 20-noyabrdan boshlanadi. Yangi yil, 8-mart, Navro‘z, Xotira va qadrlash kuni, Mustaqillik, Ustozlar kuni va Konstitutsiya kuni oldindan belgilangan oraliqda ko‘rinadi. Ramazon va Hayitning o‘zgaruvchan sanalari admin paneldan qo‘lda belgilanadi. Har bir bayram uchun sarlavha, izoh, fon, hero va gulchambar alohida sozlanadi. Bahor/yoz/kuz/qish rasmlari va maxsus Navro‘z, Mustaqillik, 8-mart, Ustozlar kuni, Hayit san’ati repoda bor.

Har bir mahsulotda uchta nomlangan HTTPS tashqi havola tahrirlanadi. Mahsulotning o‘z URL'i, Telegram/WhatsApp va OS ulashish funksiyasi mavjud. SEO sahifa sarlavhasi, canonical, Open Graph, Product JSON-LD, sitemap va PWA manifest serverdan yaratiladi. Xaridor: katalog, qidiruv, savat, sevimlilar, hisob, buyurtma. Sotuvchi: ariza, mahsulotlar va jo‘natishga tayyorlash. Yordamchi sozlanadigan FAQ va katalog bo‘yicha qidiruv bilan ishlaydi; u generativ AI emas. Tranzaksiyalar buyurtma va ombor sonini bloklash bilan bajariladi.

## Katta katalog va tavsiyalar

`/catalog` 24 tadan mahsulotni keyset cursor bilan oladi: foydalanuvchi pastga tushganda `IntersectionObserver` keyingi bo‘lakni olib keladi, qo‘lda «Yana ko‘rish» tugmasi ham bor. Saralash yangilik, narx va `sold_count` asosidagi ommaboplikni qo‘llaydi. Baza indekslari kategoriya, narx, ommaboplik va sotuvchi ro‘yxatini qamraydi. Admin va sotuvchi mahsulot jadvali 50 tadan «Yana mahsulotlar» bilan ochiladi. Katalog soniga dasturiy yuqori chegara qo‘yilmagan; amaliy hajm PostgreSQL, media xotirasi va hosting rejasiga bog‘liq.

Mahsulotning `stock_mode` turi `tracked` bo‘lsa har bir buyurtma ombor sonini kamaytiradi. `replenishable` bo‘lsa mahsulot «Buyurtma asosida» deb ko‘rinadi, ko‘rsatilgan muddat taxminiy va ombor soni cheklanmagan deb ko‘rsatilmaydi. Bunday mahsulot buyurtmada operator tasdig‘ini kutadi; hozir uning uchun faqat yetkazilganda to‘lov variantiga ruxsat beriladi. Har bir buyurtma satri zaxira band qilinganini saqlaydi, shuning uchun keyinchalik mahsulot turini tahrirlash bekor qilish hisobini buzmaydi. Bitta buyurtmada xavfsizlik uchun 20 dona va 30 xil mahsulot chegarasi saqlanadi.

`/discover` ixcham tavsiyalar sahifasi, `/product/:id` «birga xarid qilishadi» bloki, `/account` shaxsiy ijtimoiy ko‘rinishdagi profil va `/shop/:id` ommaviy sotuvchi do‘koni mavjud. Xaridor profili ommaga ochilmaydi; sotuvchi bio/cover/avatar va mahsulotlari ommaga ko‘rinadi. Foydalanuvchi sotuvchini kuzata oladi. Tavsiya ballari qidiruv so‘zlari, ko‘rilgan mahsulot, faol ko‘rish vaqti, savat, sevimlilar, buyurtmalar, kategoriya/narx o‘xshashligi va bir buyurtmada birga kelgan mahsulotlardan tuziladi. Bo‘sh tarixda yangi va ommabop mahsulotlar ko‘rinadi; bitta kategoriya haddan ko‘p chiqmasligi uchun tanlov aralashtiriladi.

Qidiruv/ko‘rish/faol vaqt/savat hodisalari faqat xaridor profilida shaxsiy tavsiyalar **yoqilganda** saqlanadi. Dwell 5 soniyadan boshlab, har hodisa 180 soniyagacha; har hisobda kunlik 300 hodisa. 90 kundan oshgan ma’lumotlar bosqichma bosqich o‘chiriladi. Profil orqali tavsiyalarni o‘chirish barcha faoliyat tarixini o‘chiradi; tarixni alohida tozalash ham bor. Buyurtmalar va sevimlilar bu tugmalar bilan o‘chmaydi.

Rasmlar hozir PostgreSQL `site_assets` jadvalida BYTEA ko‘rinishida. Minglab suratlar uchun productionda object storage/CDN, thumbnail pipeline, zaxira nusxa va kuzatuvni o‘rnatish kerak; PostgreSQL diskini cheksiz deb hisoblamang. `images.unsplash.com` manzillari uchun brauzerga mos `srcset` bor, qurilmadan yuklangan fayllar hozir 1.5 MB bilan cheklangan. Ko‘p minglab yozuvda ILIKE qidiruvni `pg_trgm` yoki alohida qidiruv indeksiga o‘tkazish va katalog/recommendation so‘rovlarini real ma’lumotda `EXPLAIN ANALYZE` bilan o‘lchash tavsiya etiladi.

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
