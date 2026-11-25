# MarketUZ — Rivojlantirish rejasi (Development Plan)

## P0 — Kritik xavfsizlik, SMS autentifikatsiya va sessiya arxitekturasi — **BAJARILDI**
- [x] `phone_otps` purpose izolyatsiyasi (`register`, `reset`, `bind`, `change_phone`) va HMAC digest.
- [x] Eskiz API v2 (`auth/login`, `auth/refresh`, `message/sms/send`, retry) + prod-safe mock guard.
- [x] `+998` avtomatik formatlash, SMS ro‘yxatdan o‘tish, telefon+parol kirish, email mosligi.
- [x] SMS orqali parolni tiklash, bog‘lash, raqamni almashtirish, hisobni o‘chirish.
- [x] Parol ko‘rsatish/yashirish, parol kuchini baholash, 60s SMS sekundomer, checkout -> auth qaytish.
- [x] PostgreSQL `user_sessions` (faol sessiyalar, rotatsiya, boshqa/barcha qurilmalardan chiqish, parol o‘zgarganda bekor qilish).
- [x] Admin kuchli xavfsizlik siyosati + TOTP 2FA.
- [x] Brute-force lockout, prototype pollution guard, `:id` validatsiya, `audit_logs`, `security_events`.

## P1 — UI/UX tuzatishlar, Design System, Tungi rejim va Xaridor funksiyalari — **BAJARILDI**
- [x] Buzilgan `Linen Lounge kreslo` rasmini tuzatish, desktop/tablet/mobil overlaylarni bartaraf etish.
- [x] Kunduzgi va tungi rejim (Dark mode).
- [x] Loading skeletonlar, offline indikator, mobil kategoriya va narx/reyting/mavjudlik filtrlari.
- [x] Qidiruv tarixi va avtomatik qidiruv tavsiyalari.
- [x] Doimiy savat sinxronizatsiyasi, taqqoslash (`/compare`), yaqinda ko‘rilganlar, xaridor sharhlari, promokodlar, qaytarish arizalari, bildirishnomalar, Yordam markazi (`/help`).

## P2 — Sotuvchi, Admin va Yetkazib berish tizimi — **BAJARILDI**
- [x] Sotuvchi savdo statistikasi, komissiya hisobi, qaytarish arizalari, bildirishnomalar va do‘kon dizayni.
- [x] Admin: xaridorlar, promokodlar, to‘lov tranzaksiyalari, qaytarishlar, SMS xarajatlari, 5xx xato va audit/security monitoring, DB/server health va xavfsiz zaxira eksporti.
- [x] Yetkazish provider abstraction (`shipping.js`), viloyat-tuman bog‘lanishi, 24 ta UzPost filiali (GPS eng yaqin + qo‘lda tanlash) va `CLICK_SANDBOX_MOCK` sinov karta oynasi (production'da qat'iyan o‘chirilgan).

## P3 — Performance, Avtomatik Testlar va CI/CD — **BAJARILDI (Production deploy kutilmoqda)**
- [x] PostgreSQL indekslari va `EXPLAIN ANALYZE` tekshiruvi (`0.058 ms` index scan).
- [x] `21 / 21` unit, API, OTP replay/expiry/concurrency, session, TOTP 2FA, UzPost branch, Click sandbox, RBAC va marketplace testlari.
- [x] Desktop (`1280x800`), Tablet (`847x800`), Mobil (`390x844`) brauzer QA tekshiruvlari.
- [x] `.github/workflows/ci.yml` CI pipeline.
- [ ] GitHub'ga push qilish va Render'da production deployni tekshirish (GitHub/Render autentifikatsiyasi bilan).
