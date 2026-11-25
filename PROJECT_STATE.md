# MarketUZ — Loyiha holati (Audit natijalari)

**Tekshirilgan sana:** 2026-11-25  
**Repozitoriy:** `https://github.com/hallaymstore/marketuz`  
**Tekshirilgan branchlar:** `main` (`c7e49f4aa317c9ff91a140d5609a48395d295b0d`) va `security/phone-auth` (`eddcd52914c45aa5053bc093b08de9e8996ad3c3`)  
**Production URL:** `https://market.hallaym.com` va `https://marketuz-dsph.onrender.com`

---

## 1. Infratuzilma va Git holati

| Komponent | Holat | Izoh |
|---|---|---|
| GitHub repozitoriy | Klonlangan (`main` + `security/phone-auth`) | `gh` CLI o‘rnatilmagan; push uchun keyinchalik GitHub autentifikatsiyasi kerak bo‘ladi |
| Render deployment | Jonli (`HTTP 200`) | `https://marketuz-dsph.onrender.com` ham, `https://market.hallaym.com` ham `main` branchdagi versiyani bermoqda (`SMS` auth hali productionga chiqmagan) |
| Runtime | Node.js `v22.23.5`, Express `^4.21.2`, `pg ^8.13.1`, `exceljs ^4.4.0` | `engines.node >= 20`, ESM (`"type": "module"`) |
| PostgreSQL | Lokal test muhiti: PostgreSQL 16 (`marketuz_test`) | `schema.sql` 2 marta ketma-ket (idempotent) xatosiz ishlaydi |
| Boshlang‘ich testlar | `12 / 12` o‘tdi (`npm test`) | Hozircha DB va SMS auth uchun integratsion testlar mavjud emas |

---

## 2. Mavjud fayllar va modullar arxitekturasi

### Backend modullari
- `server.js` (582 qator) — Express ilova, security headers/CSP, CSRF tekshiruvi, statik HMAC cookie sessiyalar, katalog/qidiruv, mahsulotlar, tavsiyalar, buyurtmalar, sotuvchi va admin API endpointlari, SEO (`robots.txt`, `sitemap.xml`, OG/JSON-LD), fon vazifalar (cleanup/expire).
- `phone-auth.js` (74 qator, faqat `security/phone-auth` branchda) — `+998` telefon normalizatsiyasi, Eskiz API integratsiyasi, 6 xonali OTP + HMAC-SHA256 digest, IP/telefon limitlari, `/api/auth/phone/status`, `/send`, `/register`, `/login`.
- `payment-handlers.js` (126 qator) — Payme Merchant JSON-RPC (`/api/payments/payme`) va Click Prepare/Complete (`/api/payments/click/prepare`, `/complete`) callbacklari, imzo va summa tekshiruvi, tranzaksiya jadvali.
- `order-safety.js` (39 qator) — Luhn karta raqami filtri, checkout payload whitelisting, buyurtma holat mashinasi (`canAdvanceOrder`).
- `recommendations.js` (56 qator) — Foydalanuvchi qiziqishlari (`buildInterests`) va tavsiya reytingi (`rankProducts`).
- `product-import.js` (61 qator) — Excel shablon generatsiyasi va `.xlsx` import parsing (`exceljs`).
- `site-config.js` (98 qator) — CMS default sozlamalar, `validateSite`, Toshkent vaqti bo‘yicha mavsum va bayramlar (`seasonalState`).
- `seed.js` (39 qator) — 7 ta kategoriya, 22 ta namuna mahsulot, 14 ta O‘zbekiston hududi.
- `schema.sql` (167 qator) — 13 ta jadval: `users`, `products`, `orders`, `order_items`, `favorites`, `product_subcategories`, `product_variants`, `product_events`, `seller_follows`, `site_settings`, `settings_audit`, `site_assets`, `payment_transactions`, `shipment_events`, `phone_otps`, `sms_requests`.

### Frontend modullari (`public/`)
- `public/index.html` (56 qator) — SPA shell, Google Fonts (`Manrope`, `DM Sans`), Telegram WebApp SDK, header, mobile search, bottom nav, drawer, helper chat, onboarding modal.
- `public/app.js` (493 qator) — Client-side router va barcha sahifalar (`renderHome`, `renderCatalog`, `renderDiscover`, `renderRichProduct`, `renderStudio`, `renderCart`, `renderCheckout`, `renderPayment`, `renderAuth`, `renderFavorites`, `renderAccount`, `renderShop`, `renderSeller`, `renderAdmin`, `renderDelivery`, `renderLegal`).
- `public/product-studio.js` (40 qator) — Mahsulot qo‘shish/tahrirlash, variantlar, galereya, Excel import UI.
- `public/cms-ui.js` (35 qator) — Admin CMS formalari.
- `public/experience.js` (81 qator) — Aksiya lentasi, suzuvchi "Yordam" FAQ/qidiruv chati, 3 bosqichli onboarding modal.
- `public/sw.js` (9 qator) — App shell Service Worker (`marketuz-shell-20261124c`).
- CSS fayllar: `styles.css`, `winter.css`, `seasonal.css`, `discovery.css`, `studio.css`, `payment.css`.

---

## 3. Mavjud API endpointlar ro‘yxati

- **Tizim & Media:** `GET /api/healthz`, `GET /api/config`, `GET /media/:id`, `POST /api/assets`, `GET /manifest.webmanifest`, `GET /robots.txt`, `GET /sitemap.xml`
- **Katalog & Tavsiyalar:** `GET /api/catalog/feed` (keyset cursor), `GET /api/catalog` (page-based), `GET /api/products/:id`, `GET /api/recommendations`, `GET /api/subcategories`, `GET /api/shops/:id`
- **Autentifikatsiya:** `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/telegram`, `POST /api/telegram/webhook`, `POST /api/auth/logout`, hamda `security/phone-auth` da: `GET /api/auth/phone/status`, `POST /api/auth/phone/send`, `POST /api/auth/phone/register`, `POST /api/auth/phone/login`
- **Profil & Faoliyat:** `GET /api/me`, `PATCH /api/me`, `PATCH /api/me/personalization`, `DELETE /api/me/activity`, `POST /api/events`, `POST /api/me/password`, `GET /api/me/follows`, `PUT/DELETE /api/shops/:id/follow`
- **Sevimlilar & Buyurtmalar:** `GET /api/favorites`, `PUT/DELETE /api/favorites/:id`, `POST /api/orders`, `GET /api/orders`, `GET /api/orders/:id/payment`, `GET /api/orders/:id/payment-link`, `POST /api/orders/:id/cancel`
- **To‘lovlar:** `POST /api/payments/payme`, `POST /api/payments/click/prepare`, `POST /api/payments/click/complete`
- **Sotuvchi:** `POST /api/seller/request`, `GET/POST /api/seller/products`, `GET/PATCH/DELETE /api/seller/products/:id`, `GET /api/seller/orders`, `PATCH /api/seller/order-items/:id`, `GET /api/catalog-tools/template.xlsx`, `POST /api/products/import/preview`, `POST /api/products/import/commit`
- **Admin:** `GET/PATCH /api/admin/settings`, `GET /api/admin/overview`, `GET /api/admin/sellers`, `PATCH /api/admin/sellers/:id`, `GET/POST /api/admin/products`, `GET/PATCH /api/admin/products/:id(/details)`, `GET/POST/DELETE /api/admin/subcategories(/:id)`, `GET/PATCH /api/admin/orders(/:id)`

---

## 4. Aniqlangan muammolar va bo‘shliqlar

### A. SMS autentifikatsiya (`security/phone-auth`) muammolari
1. **Testlanmagan va tugallanmagan oqimlar:** SMS orqali parolni tiklash, mavjud email/Telegram hisobga tasdiqlangan telefon bog‘lash, telefon raqamini almashtirish, hisobni o‘chirish va faol sessiyalar boshqaruvi yo‘q.
2. **OTP maqsadi (purpose) ajratilmagan:** `phone_otps` jadvalida `purpose` ustuni yo‘q; `otpDigest` faqat `'register:'` prefiksi bilan ishlaydi.
3. **Eskiz integratsiyasi:** `PATCH /api/auth/refresh`, 401 token qayta olish, `status: 'error'` javobini aniq ajratish, SMS xarajat/holat audit loglari hamda dev/test uchun xavfsiz (productionda qat'iyan bloklangan) mock SMS transporti yetishmaydi.
4. **Checkout -> Auth qaytish:** `renderCheckout` va `renderPayment` `renderAuth('login', true)` ni majburiy chaqiradi (SMS yoqilganda ham telefon login emas), `state.authNext` sahifa yangilanganda yo‘qoladi.
5. **Profil tahrirlashda ichki email:** Telefon bilan ro‘yxatdan o‘tgan foydalanuvchiga `phone-998...@marketuz.invalid` ko‘rinib qoladi.
6. **Frontend auth UX:** `+998` avtomatik formatlash, parol ko‘rsatish/yashirish, parol kuchini baholash va aniq SMS xato/taymer boshqaruvi yo‘q.

### B. Kiberxavfsizlik muammolari
1. **Stateless cookie sessiya:** `user_sessions` jadvali yo‘q — parol o‘zgarganda eski sessiyalar bekor bo‘lmaydi, barcha qurilmalardan chiqish va sessiyalarni ko‘rish/bekor qilish imkonsiz.
2. **Admin TOTP 2FA yo‘q:** Admin login faqat email + parol bilan himoyalangan.
3. **Numeric ID validation yetishmovchiligi:** `/api/favorites/:id`, `/api/seller/products/:id`, `/api/admin/products/:id`, `/api/admin/sellers/:id`, `/api/admin/subcategories/:id`, `/api/shops/:id/follow` `req.params.id` raqam ekanini tekshirmaydi — noto‘g‘ri ID yuborilsa PostgreSQL `500` xatosi chiqadi.
4. **Rate limiting & brute-force:** Faqat xotiradagi IP hisoblagich (`authHits`, 25/15 min) bor; login urinishlari hisob/telefon kesimida bloklanmaydi, shubhali kirishlar qayd etilmaydi.
5. **Audit loglar yetishmaydi:** Moliyaviy (to‘lov, bekor qilish, qaytarish) va xavfsizlik (login, parol, admin moderatsiyasi, ruxsat o‘zgarishlari) operatsiyalari uchun umumiy `audit_logs` va `security_events` jadvallari yo‘q.
6. **`SESSION_SECRET` production tekshiruvi:** `SESSION_SECRET` bo‘lmasa server tasodifiy kalit bilan ishga tushib ketadi.

### C. Production brauzer auditi (`https://market.hallaym.com`) muammolari
1. **Buzilgan rasm havolasi:** `seed.js` dagi `Linen Lounge kreslo` (`photo-1598300053653-4b754a5c5824`) `404 / ERR_BLOCKED_BY_ORB` bermoqda.
2. **Dekor va suzuvchi tugma ustma-ust tushishi (Desktop va Mobil):**
   - Desktop (`1280x800`): Qishki yon ustunlar/chiroqlar `/catalog`, `/seller`, `/discover` sarlavha (`h1`) chap chetiga tegib turibdi; yuqori archa gulchambari breadcrumb chetini berkitadi.
   - Suzuvchi `"Yordam"` tugmasi `/account` dagi `"Ro‘yxatdan o‘tish"`, desktop kartalardagi narx va mobildagi o‘ng ustun `"Savatga qo‘shish"` tugmasi ustiga tushmoqda.
3. **Mobil katalogda kategoriya filtri yo‘q:** `<=780px` da `.filter-panel` yashirilgan, mobil uchun kategoriya/narx filtrlari mavjud emas.
4. **Tungi rejim (Dark mode), loading skeleton va offline indikator yo‘q.**
5. **Katalog tugmasi matni qisqarishi:** Kartadagi `"Savatga qo‘shish"` tugmasi tor ekranda `"Savatga qo‘s..."` bo‘lib qolmoqda; kichik touch targetlar (`13x13` checkbox, `20px` matn tugmalari).
6. **Admin drawer havolasi:** Mobil menyuda kirilmagan foydalanuvchiga ham `Administrator` havolasi ko‘rsatiladi.

### D. Funksional bo‘shliqlar (Xaridor, Sotuvchi, Admin, Yetkazish, CI)
- **Xaridor:** Qidiruv tarixi/tavsiyalari, narx/mavjudlik/reyting filtrlari, taqqoslash, yaqinda ko‘rilganlar, xaridor sharhlari va reytinglari, doimiy savat (DB sync), promokodlar, qaytarish arizalari, bildirishnomalar, yordam markazi sahifasi.
- **Sotuvchi:** Savdo statistikasi, moliyaviy hisobot va komissiya hisobi, qaytarilgan mahsulotlar, sotuvchi reytingi, chegirma/promokod boshqaruvi, bildirishnoma markazi.
- **Admin:** Xaridorlar boshqaruvi, to‘lov/refundlar, yetkazib berish/banner/reklama/promokod boshqaruvi, admin rollari va ruxsatlari, audit/xavfsizlik loglari, SMS xarajatlari monitoringi, DB va server health monitoringi.
- **Yetkazish:** UzPost uchun provider abstraction, viloyat/tuman bog‘liqligi, yetkazish narxi kalkulyatsiyasi, standartlashtirilgan holatlar.
- **CI/CD va Testlar:** GitHub Actions CI pipeline yo‘q; DB migratsiya, auth, OTP, concurrency, RBAC, E2E testlar yetishmaydi.
