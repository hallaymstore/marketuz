# MarketUZ — Rivojlantirish rejasi (Development Plan)

Vazifalar ustuvorlik darajalari bo‘yicha (**P0 → P1 → P2 → P3**) bo‘lingan.

---

## P0 — Kritik xavfsizlik, SMS autentifikatsiya va sessiya arxitekturasi

1. **SMS autentifikatsiyani to‘liq yakunlash (`phone-auth.js`, `schema.sql`, `server.js`, `public/app.js`):**
   - `phone_otps` jadvalini `purpose` (`register`, `reset`, `bind`, `change_phone`) bo‘yicha ajratish va `otpDigest` ni purpose-bound qilish.
   - Eskiz API v2 integratsiyasini mustahkamlash (`auth/login`, `auth/refresh`, `message/sms/send`, `status` tekshiruvi, xavfsiz timeout/retry, maxfiy ma'lumotlarni loglamaslik).
   - Dev/test uchun izolyatsiyalangan `mock` SMS transporti (`NODE_ENV === 'production'` da qat'iyan taqiqlanadi; hech qanday universal OTP yoki bypass yo‘q).
   - `sms_requests` jadvalida xarajat/holat/purpose monitoringi (`status`, `purpose`, `provider_id`).
   - `+998` avtomatik formatlash (`+998 XX XXX XX XX`), SMS orqali ro‘yxatdan o‘tish, telefon+parol bilan kirish, email bilan eski hisoblar mosligi.
   - SMS orqali parolni tiklash (account enumeration'siz, eski barcha sessiyalarni bekor qilish bilan).
   - Mavjud email/Telegram hisobga tasdiqlangan telefon bog‘lash va telefon raqamini xavfsiz almashtirish.
   - Parol ko‘rsatish/yashirish, parol mustahkamligini baholash, SMS qayta yuborish sekundomeri, aniq xabarlar.
   - Checkout/To‘lov paytida kirilgandan so‘ng savat/checkout sahifasiga xavfsiz qaytish (`sessionStorage` + URL validation).

2. **Sessiya, TOTP 2FA va hisob boshqaruvi:**
   - PostgreSQL `user_sessions` jadvali (token hash, device/UA, IP, last_active, revoked_at, expires_at).
   - Faol sessiyalar va qurilmalarni ko‘rish, bitta sessiyani yoki barcha qurilmalardan chiqishni boshqarish, sessiyani yangilash (rotation).
   - Parol o‘zgarganda yoki tiklanganda barcha eski sessiyalarni avtomatik bekor qilish.
   - Hisobni o‘chirish jarayoni (re-autentifikatsiya + faol buyurtma/ma'lumot xavfsizligi).
   - Admin uchun kuchliroq xavfsizlik siyosati + **TOTP 2FA** (sozlash, tasdiqlash, login paytida 2-qadam).

3. **Backend OWASP himoyasi va audit loglari:**
   - Barcha `:id` marshrutlarida qat'iy ID validatsiya (PostgreSQL `500` xatolarini bartaraf etish).
   - DB-backed login brute-force & credential stuffing himoyasi, shubhali urinishlarni aniqlash.
   - `audit_logs` va `security_events` jadvallari (moliyaviy va xavfsizlik operatsiyalari uchun).
   - `SESSION_SECRET` va auth env tekshiruvlari, xavfsiz error handling.

---

## P1 — UI/UX tuzatishlar, Design System, Tungi rejim va Asosiy tijorat funksiyalari

1. **Production UI/UX kamchiliklarini tuzatish:**
   - `seed.js` dagi buzilgan `Linen Lounge kreslo` (`404`) rasmini ishonchli rasmga almashtirish.
   - Qishki yon ustunlar/chiroqlar, yuqori gulchambar va suzuvchi `"Yordam"` tugmasi ustma-ust tushishini bartaraf etish.
   - Mobil katalog uchun kategoriya, subkategoriya, narx va mavjudlik filtrlari paneli.
   - Kunduzgi va tungi rejim (Dark mode) — teal, yashil, oq, silver va me'yorida golden aksentlar bilan.
   - Loading skeletonlar, offline holat banneri, qulay toastlar, 44px+ mobil touch targetlar, keyboard navigation.
   - `@marketuz.invalid` ichki emailni foydalanuvchi UI'da yashirish.

2. **Xaridor imkoniyatlari (Asosiy):**
   - Doimiy savat (DB `cart_items` sinxronizatsiyasi).
   - Qidiruv tarixi va avtomatik qidiruv tavsiyalari.
   - Narx, reyting, subkategoriya va mavjudlik filtrlari.
   - Yaqinda ko‘rilgan mahsulotlar va mahsulotlarni taqqoslash.
   - Tasdiqlangan xaridor sharhlari va reytinglari (`product_reviews`).
   - Promokodlar va chegirmalar (backendda xavfsiz hisoblash).
   - Qaytarish bo‘yicha ariza (`return_requests`), bildirishnomalar (`notifications`), Yordam markazi sahifasi (`/help`).

---

## P2 — Sotuvchi paneli, Admin boshqaruv markazi va Yetkazib berish tizimi

1. **Sotuvchi paneli kengaytirish:**
   - Savdo statistikasi, moliyaviy hisobot va komissiya hisobi (`commission_rate`).
   - Qaytarilgan mahsulotlar bilan ishlash, sotuvchi reytingi, chegirma/promokodlar, do‘kon ko‘rinishini tahrirlash.
   - Mahsulot moderatsiyasi sababi/holati, sotuvchi notification center, qat'iy tenant izolyatsiyasi (`seller_id = req.user.id`).

2. **Admin boshqaruv markazi kengaytirish:**
   - Real ma'lumotlarga asoslangan statistika (buyurtmalar, to‘lovlar, komissiya, SMS xarajatlari).
   - Xaridorlar, banner/reklama, promokodlar, bildirishnomalar, qaytarish arizalari boshqaruvi.
   - Administrator rollari va ruxsatlari (`permissions`), audit loglar, xavfsizlik hodisalari va shubhali loginlar ko‘rinishi.
   - SMS xarajatlari monitoringi, DB va server health/error monitoring.

3. **Yetkazib berish provider abstraction (`shipping.js`):**
   - O‘zbekiston viloyat va tuman/shahar ma'lumotnomasi bog‘lanishi.
   - Yetkazish narxini backendda hisoblash mexanizmi (shaffof qoidalar bilan).
   - UzPost adapter interfeysi tayyor holatda (rasmiy kalitsiz soxta integratsiya da'vosiz).

---

## P3 — Performance, Scalability, Avtomatik Testlar va CI/CD

1. **Performance va PostgreSQL optimizatsiyasi:**
   - `pg_trgm` / GIN yoki qidiruv indekslari, `EXPLAIN ANALYZE` tekshiruvlari.
   - In-memory/TTL cache strategiyasi (`config`, `subcategories`, health), N+1 so‘rovlarni bartaraf etish.
   - Service Worker va statik resurs kesh strategiyasini yangilash.
   - Graceful shutdown va structured JSON logging.

2. **Keng qamrovli avtomatik testlar va CI:**
   - Unit + Integration + Concurrency + Security testlar (`node --test` + PostgreSQL 16):
     - Auth, OTP muddati tugashi, OTP replay, purpose izolyatsiyasi, parallel SMS/OTP race conditions.
     - Sessiya rotatsiyasi/bekor qilinishi, parol o‘zgarganda barcha sessiyalar yopilishi, TOTP 2FA.
     - RBAC (xaridor/sotuvchi/admin izolyatsiyasi), IDOR, checkout narx manipulyatsiyasi, payment callbacklar.
     - DB migratsiya idempotentligi.
   - Brauzer E2E va mobil/desktop responsivlik tekshiruvlari.
   - `.github/workflows/ci.yml` (syntax check, unit & PostgreSQL integration tests).
