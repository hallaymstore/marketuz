# MarketUZ — Loyiha holati (Yangilangan)

**Yangilangan sana:** 2026-11-25  
**Repozitoriy:** `https://github.com/hallaymstore/marketuz`  
**Faol development branch:** `security/phone-auth` (asosiy branch: `main` — `c7e49f4`)  
**Production URL:** `https://market.hallaym.com` va `https://marketuz-dsph.onrender.com` (hozircha `main` branch ishlamoqda; `security/phone-auth` hali merge/push qilinmagan)

---

## 1. Bajarilgan ishlar va joriy arxitektura

### A. SMS autentifikatsiya, sessiyalar va kiberxavfsizlik (`phone-auth.js`, `security.js`, `server.js`, `schema.sql`)
- **Eskiz SMS API integratsiyasi (`phone-auth.js`):**
  - `POST /api/auth/login`, `PATCH /api/auth/refresh`, `POST /api/message/sms/send`, 401 token qayta urinish, xavfsiz timeout (`12s`).
  - `+998` normalizatsiya va formatlash (`+998 XX XXX XX XX`).
  - OTP maqsad izolyatsiyasi (`purpose`: `register`, `reset`, `bind`, `change_phone`), `phone_otps` birikma PK `(phone, purpose)` va HMAC-SHA256 digest.
  - IP + telefon bo‘yicha PostgreSQL `pg_advisory_xact_lock` atomik rate limiting (60s qayta yuborish cheklovi, kuniga 5 SMS/telefon, 20 SMS/IP) va `FOR UPDATE` OTP race-condition / replay himoyasi.
  - SMS xarajatlari va holati (`queued`, `sent`, `failed`, `mock`) `sms_requests` jadvalida saqlanadi.
  - Test/dev muhiti uchun `smsTransport` / `SMS_MOCK` qo‘llab-quvvatlanadi; **`NODE_ENV === 'production'` da mock SMS qat'iyan bloklangan va hech qanday universal/test OTP yo‘q.**
- **To‘liq auth va profil oqimlari:**
  - SMS orqali ro‘yxatdan o‘tish (`/api/auth/phone/register`), telefon+parol bilan kirish (`/api/auth/phone/login` — SMS yoqilmaganda ham mavjud tasdiqlangan hisoblar ishlaydi), email orqali eski hisoblar, Telegram Mini App kirish.
  - SMS orqali parolni tiklash (`/api/auth/phone/reset-password`, account enumeration'siz, eski barcha sessiyalarni bekor qiladi).
  - Mavjud hisobga tasdiqlangan telefon bog‘lash va telefon raqamini almashtirish (`/api/me/phone/send`, `/api/me/phone/verify`).
  - PostgreSQL `user_sessions` jadvali: faol sessiyalar ro‘yxati, sessiyani yangilash (rotation), bitta qurilmadan chiqish, boshqa qurilmalardan chiqish, barcha qurilmalardan chiqish, parol o‘zgarganda eski sessiyalarni avtomatik bekor qilish.
  - Hisobni o‘chirish (`/api/me/delete` — faol buyurtma nazorati, PII anonimizatsiyasi, sessiyalarni yopish).
  - **Administrator kuchli xavfsizlik siyosati:** telefon login/SMS reset/self-delete bloklangan; **TOTP 2FA** (RFC 6238, `security.js`, `/api/admin/security/2fa/*`, `/api/auth/login/2fa`).
  - **OWASP himoyasi:** Brute-force lockout (`auth_attempts`), `security_events` va `audit_logs`, barcha `:id` marshrutlarda qat'iy raqam tekshiruvi, prototype pollution filtri, CSP `object-src 'none'`, checkout Luhn karta filtri va backend narx/promokod hisoblash.

### B. Frontend UI/UX va Dark Mode (`public/app.js`, `public/styles.css`, `public/winter.css`, `public/discovery.css`, `public/index.html`, `public/sw.js`)
- Kunduzgi va tungi rejim (`[data-theme="dark"]` — teal, yashil, silver-oq va me'yoriy golden aksentlar).
- Loading skeletonlar, offline holat banneri (`#offline-banner`), toast xabarnomalar.
- `+998` avtomatik telefon formatlash, parol ko‘rsatish/yashirish, parol kuchini baholash indikatori, WebOTP / `one-time-code`, 60 soniyalik SMS sekundomeri, checkout -> auth qaytish (`sessionStorage`).
- Production brauzer auditida topilgan kamchiliklar tuzatildi: `seed.js` dagi buzilgan Unsplash rasm (`/assets/home-story.webp` ga almashtirildi), desktop/tablet yon ustun va gulchambar ustma-ust tushishi, search autocomplete z-index, mobil drawer non-admin yashirish, dark mode scrim kontrast, `/account` tab strip.

### C. Xaridor, Sotuvchi, Admin, Yetkazish va CI (`marketplace-features.js`, `shipping.js`, `.github/workflows/ci.yml`)
- **Xaridor:** Qidiruv tarixi va `/api/catalog/suggestions`, mobil kategoriya filtrlari, subkategoriya/narx/reyting/mavjudlik filtrlari, doimiy savat (`/api/cart`), tasdiqlangan xaridor sharhlari (`/api/products/:id/reviews`), taqqoslash (`/compare`), yaqinda ko‘rilganlar, promokodlar (`/api/promo/check`), qaytarish arizalari (`/api/orders/:id/return`), bildirishnomalar (`/api/notifications`), Yordam markazi (`/help`).
- **Sotuvchi:** Savdo statistikasi, komissiya hisobi (`5%`), qaytarish arizalari ko‘rinishi (`/api/seller/analytics`), chegirma narxlari (`old_price`), sotuvchi bildirishnomalar markazi va do‘kon dizayni tezkor boshqaruvi.
- **Admin:** Xaridorlar, promokodlar, qaytarish arizalari, to‘lov tranzaksiyalari (`/api/admin/payments`), xavfsiz JSON zaxira nusxasi (`/api/admin/backup`), SMS xarajatlari, 5xx xato va xavfsizlik hodisalari, audit loglar va DB/server health monitoringi (`/api/admin/monitoring`).
- **Yetkazish va UzPost (`shipping.js`, `marketplace-features.js`, `schema.sql`, `public/app.js`):** 14 ta hudud bo‘yicha tuman/shahar ma'lumotnomasi, 24 ta UzPost filial ma'lumotnomasi (koordinatalar bilan), Haversine eng yaqin filial qidiruvi (`GET /api/shipping/branches`), checkoutda **UzPost filialidan olib ketish** (GPS avtomatik yoki qo‘lda tanlash) vs **Manzilga yetkazish** tanlovi, va UzPost adapter interfeysi (rasmiy API kalitsiz avtomatik jo‘natma yaratmaydi).
- **SMS va Click Sandbox (`phone-auth.js`, `payment-handlers.js`, `public/app.js`):** Eskiz/Click kalitlari olinguncha lokal sinov uchun `SMS_MOCK=true` (`/api/auth/phone/dev-inbox` UI qutisi) va `CLICK_SANDBOX_MOCK=true` (`/api/payments/click/sandbox-pay` bir martalik karta to‘lovi simulyatori) qo‘shildi; **`NODE_ENV === 'production'` da ikkalasi ham qat'iyan 404/bloklangan.**
- **Testlar va CI:** `21 / 21` unit va PostgreSQL 16 integratsion testlar o‘tmoqda; `.github/workflows/ci.yml` yaratilgan; desktop va mobil brauzer QA tekshirildi.

---

## 2. Qolgan tashqi / production qadamlari (foydalanuvchi ishtirokini talab qiladi)
1. **GitHub push va PR:** Lokal `security/phone-auth` branchidagi commitlarni GitHub'ga push qilish va testlar/reviewdan so‘ng `main` ga merge qilish (GitHub autentifikatsiyasi talab qilinadi).
2. **Render environment variables:** `SMS_ENABLED=true`, `ESKIZ_EMAIL`, `ESKIZ_PASSWORD`, `ESKIZ_SENDER`, `OTP_SECRET` (>=32 belgi), `SESSION_SECRET` (>=32 belgi) sozlash (Eskiz akkaunti tayyor bo‘lgach).
3. **Click / Payme / UzPost:** Rasmiy shartnoma va sandbox/merchant kalitlari olingach faollashtirish.
