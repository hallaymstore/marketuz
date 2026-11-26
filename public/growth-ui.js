/* Marketuz Growth UI · Map, I18n UZ/RU, Timers, Modals (Receipts, Shipping Labels, Order Chat) */
window.MarketuzGrowth = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => `${new Intl.NumberFormat('uz-UZ').format(Number(n) || 0)} so‘m`;

  const dict = {
    uz: {
      catalog: 'Katalog', discover: '✦ Kashfiyot', delivery: 'Yetkazib berish', sellerBtn: 'Sotuvchi bo‘lish',
      searchPlaceholder: 'Nima qidiryapsiz?', searchBtn: 'Qidirish', cart: 'Savat',
      home: 'Bosh sahifa', profile: 'Profil', addToCart: 'Savatga', variants: 'Variantlar',
      quickBuy: '1 bosishda xarid', selectAll: 'Hammasini tanlash', selectedTotal: 'Tanlanganlar jami',
      checkoutSelected: 'Tanlanganlarni rasmiylashtirish', moveToCart: 'Savatga ko‘chirish',
      wallet: 'Bonus hamyon', alerts: 'Kuzatuvlar', qaTitle: 'Savol-javob', askQuestion: 'Savol yozish',
      useBonus: 'Bonus balansdan yechish', saveCard: 'Kartani keyingi xaridlar uchun eslab qolish (Click)',
      receiptBtn: 'Chek / Kvitansiya', chatBtn: 'Sotuvchi bilan chat', nakladnoyBtn: 'Nakladnoy chop etish',
      excelExport: 'Excel (.xlsx) yuklash', lowStockOnly: 'Kam qoldi (≤ 3)', promoteTop: 'TOP ga chiqarish',
      promoted: 'TOPda', payouts: 'Balans va yechish', questionsTab: 'Savollar'
    },
    ru: {
      catalog: 'Каталог', discover: '✦ Открытия', delivery: 'Доставка', sellerBtn: 'Стать продавцом',
      searchPlaceholder: 'Что вы ищете?', searchBtn: 'Поиск', cart: 'Корзина',
      home: 'Главная', profile: 'Профиль', addToCart: 'В корзину', variants: 'Варианты',
      quickBuy: 'Купить в 1 клик', selectAll: 'Выбрать все', selectedTotal: 'Итого выбранное',
      checkoutSelected: 'Оформить выбранные', moveToCart: 'В корзину',
      wallet: 'Бонусный кошелёк', alerts: 'Подписки', qaTitle: 'Вопросы и ответы', askQuestion: 'Задать вопрос',
      useBonus: 'Списать с бонусного баланса', saveCard: 'Сохранить карту для следующих покупок (Click)',
      receiptBtn: 'Чек / Квитанция', chatBtn: 'Чат с продавцом', nakladnoyBtn: 'Печать накладной',
      excelExport: 'Скачать Excel (.xlsx)', lowStockOnly: 'Мало осталось (≤ 3)', promoteTop: 'В ТОП',
      promoted: 'В ТОПе', payouts: 'Баланс и вывод', questionsTab: 'Вопросы'
    }
  };

  function getLang() {
    try { return localStorage.getItem('marketuz_lang') === 'ru' ? 'ru' : 'uz'; } catch { return 'uz'; }
  }
  function setLang(next) {
    const lang = next === 'ru' ? 'ru' : 'uz';
    try { localStorage.setItem('marketuz_lang', lang); } catch {}
    applyLang(lang);
    return lang;
  }
  function t(key) {
    const lang = getLang();
    return dict[lang]?.[key] || dict.uz[key] || key;
  }
  function applyLang(lang = getLang()) {
    document.documentElement.lang = lang;
    const btn = document.getElementById('lang-toggle');
    if (btn) btn.textContent = lang === 'ru' ? 'RU' : 'UZ';
    const d = dict[lang] || dict.uz;
    const navMap = { '/catalog': d.catalog, '/discover': d.discover, '/delivery': d.delivery, '/seller': d.sellerBtn };
    document.querySelectorAll('.desktop-links a, #mobile-drawer nav a').forEach(a => {
      const href = a.getAttribute('href');
      if (navMap[href]) {
        const slot = a.querySelector('.icon-slot');
        if (slot) a.replaceChildren(slot, document.createTextNode(navMap[href]));
        else a.textContent = navMap[href];
      }
    });
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.placeholder = d.searchPlaceholder;
    const searchBtn = document.querySelector('#header-search button[type="submit"]');
    if (searchBtn) searchBtn.textContent = d.searchBtn;
    const cartText = document.querySelector('.cart-text');
    if (cartText) cartText.textContent = d.cart;
  }

  function flashSaleActive(p) {
    const fp = Number(p?.flash_sale_price || 0);
    if (fp < 1000) return false;
    if (!p?.flash_sale_until) return true;
    return new Date(p.flash_sale_until).getTime() > Date.now();
  }
  function effectivePrice(p) {
    return flashSaleActive(p) ? Number(p.flash_sale_price) : Number(p?.price || 0);
  }
  function formatCountdown(until) {
    const diff = Math.max(0, Math.floor((new Date(until).getTime() - Date.now()) / 1000));
    if (!diff) return 'Tugadi';
    const h = String(Math.floor(diff / 3600)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }
  function flashBadgeHtml(p) {
    if (!flashSaleActive(p)) return '';
    const timer = p.flash_sale_until
      ? ` · <span class="flash-timer" data-until="${esc(p.flash_sale_until)}">${formatCountdown(p.flash_sale_until)}</span>`
      : '';
    return `<span class="flash-badge">⚡ Flash Sale${timer}</span>`;
  }
  let countdownHandle = null;
  function startCountdowns() {
    if (countdownHandle) clearInterval(countdownHandle);
    const tick = () => {
      document.querySelectorAll('.flash-timer[data-until]').forEach(el => {
        el.textContent = formatCountdown(el.dataset.until);
      });
    };
    tick();
    countdownHandle = setInterval(tick, 1000);
  }
  function installmentHint(price) {
    const monthly = Math.ceil((Number(price || 0) * 1.24) / 12 / 1000) * 1000;
    if (!monthly || Number(price) < 50_000) return '';
    return `<small class="nasiya-chip">Nasiya: ${money(monthly)} / oy · 12 oy</small>`;
  }
  function socialProofHtml(p) {
    const chips = [];
    if (p.is_promoted && (!p.promoted_until || new Date(p.promoted_until).getTime() > Date.now())) {
      chips.push('<span class="proof-chip promoted">★ TOP</span>');
    }
    if (p.stock_mode !== 'replenishable' && Number(p.stock) > 0 && Number(p.stock) <= 5) {
      chips.push(`<span class="proof-chip low">🔥 Oxirgi ${p.stock} dona</span>`);
    } else if (Number(p.sold_count) >= 5) {
      chips.push(`<span class="proof-chip sold">✓ ${p.sold_count} ta sotilgan</span>`);
    }
    if (Number(p.bundle_discount_percent) > 0) {
      chips.push(`<span class="proof-chip bundle">📦 2+ dona = −${p.bundle_discount_percent}%</span>`);
    }
    return chips.length ? `<div class="proof-row">${chips.join('')}</div>` : '';
  }

  // Self-hosted Interactive Uzbekistan SVG Coordinate Map for UzPost Branches (100% CSP safe, zero inline styles)
  function projectUz(lat, lng) {
    const x = Math.round(Math.max(60, Math.min(940, ((Number(lng) - 58.2) / (73.4 - 58.2)) * 880 + 60)));
    const y = Math.round(Math.max(55, Math.min(545, (1 - (Number(lat) - 37.0) / (43.1 - 37.0)) * 490 + 55)));
    return { x, y };
  }
  function uzpostMapHtml(branches, selectedId = '') {
    if (!Array.isArray(branches) || !branches.length) return '';
    const pins = branches.map(b => {
      const { x, y } = projectUz(b.lat || 41.3, b.lng || 69.2);
      const active = String(b.id) === String(selectedId);
      const shortRegion = esc(b.region.replace(' shahri', '').replace(' viloyati', ''));
      return `<g class="uzp-pin ${active ? 'active' : ''}" data-action="map-select-branch" data-id="${esc(b.id)}" role="button" tabindex="0" aria-label="${esc(b.name)}">
        <title>${esc(b.name)} (${esc(b.region)})</title>
        <circle class="uzp-pin-halo" cx="${x}" cy="${y}" r="20"/>
        <circle class="uzp-pin-dot" cx="${x}" cy="${y}" r="11"/>
        <text class="uzp-pin-label" x="${x}" y="${y - 16}" text-anchor="middle">${shortRegion}</text>
      </g>`;
    }).join('');
    return `<div class="uzpost-map-wrap" id="uzpost-map">
      <svg class="uzpost-map-svg" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet" role="img" aria-label="O‘zbekiston UzPost filiallari xaritasi">
        <defs><linearGradient id="uzMapGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="rgba(18,68,59,0.14)"/><stop offset="100%" stop-color="rgba(199,221,98,0.22)"/></linearGradient></defs>
        <path d="M70,160 L240,100 L350,240 L540,240 L690,160 L760,220 L920,260 L940,350 L820,420 L740,550 L580,520 L420,400 L220,360 L80,280 Z" fill="url(#uzMapGrad)" stroke="rgba(18,68,59,0.34)" stroke-width="4"/>
        ${pins}
      </svg>
    </div>`;
  }

  function showModal(html) {
    let backdrop = document.getElementById('growth-modal-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'growth-modal-backdrop';
      backdrop.className = 'growth-modal-backdrop';
      document.body.appendChild(backdrop);
    }
    backdrop.innerHTML = `<div class="growth-modal" role="dialog" aria-modal="true"><button type="button" class="growth-modal-close" data-action="growth-close-modal" aria-label="Yopish">×</button>${html}</div>`;
    backdrop.hidden = false;
  }
  function closeModal() {
    const backdrop = document.getElementById('growth-modal-backdrop');
    if (backdrop) backdrop.hidden = true;
  }

  function openReceiptModal(r) {
    showModal(`<div class="receipt-sheet printable-sheet">
      <div class="receipt-head"><span class="eyebrow">ELEKTRON CHEK</span><h2>${esc(r.operator || 'Marketuz')}</h2><small>№ ${esc(r.receiptNumber)} · ${new Date(r.createdAt).toLocaleString('uz-UZ')}</small></div>
      <div class="receipt-meta"><div><span>Qabul qiluvchi:</span><strong>${esc(r.recipient)}</strong></div><div><span>Telefon:</span><strong>${esc(r.phone)}</strong></div><div><span>Manzil:</span><strong>${esc(r.deliveryMode === 'uzpost_pickup' && r.pickupBranchLabel ? r.pickupBranchLabel : `${r.region}, ${r.district}, ${r.address}`)}</strong></div><div><span>To‘lov:</span><strong>${esc((r.paymentMethod || '').toUpperCase())} (${esc(r.paymentStatus)})</strong></div></div>
      <table class="receipt-table"><thead><tr><th>Mahsulot</th><th>Soni</th><th>Summa</th></tr></thead><tbody>${(r.items || []).map(i => `<tr><td>${esc(i.title)}${i.variant ? ' · ' + esc(i.variant) : ''}</td><td>${i.quantity} × ${money(i.price)}</td><td>${money(i.lineTotal)}</td></tr>`).join('')}</tbody></table>
      <div class="receipt-totals">
        <div><span>Mahsulotlar</span><strong>${money(r.subtotal)}</strong></div>
        ${r.discountAmount > 0 ? `<div><span>Promokod chegirmasi</span><strong>−${money(r.discountAmount)}</strong></div>` : ''}
        ${r.bonusUsed > 0 ? `<div><span>Bonusdan yechildi</span><strong>−${money(r.bonusUsed)}</strong></div>` : ''}
        <div class="receipt-grand"><span>Jami to‘lov</span><strong>${money(r.total)}</strong></div>
        ${r.bonusEarned > 0 ? `<div><span>Hisoblangan keshbek</span><strong>+${money(r.bonusEarned)}</strong></div>` : ''}
      </div>
      <div class="modal-actions no-print"><button type="button" class="btn btn-primary" data-action="print-modal">Chop etish / PDF ↓</button></div>
    </div>`);
  }

  function openShippingLabelModal(l) {
    showModal(`<div class="label-sheet printable-sheet">
      <div class="label-head"><strong>MARKETUZ × UZPOST NAKLADNOY</strong><span>#${esc(l.code)}</span></div>
      <div class="label-barcode">${esc(l.trackingNumber)}</div>
      <div class="label-grid">
        <div><small>JO‘NATUVCHI</small><strong>${esc(l.sellerName)}</strong></div>
        <div><small>QABUL QILUVCHI</small><strong>${esc(l.recipient)}</strong><span>${esc(l.phone)}</span></div>
        <div class="full"><small>MANZIL / FILIAL</small><strong>${esc(l.destination)}</strong></div>
        <div class="full"><small>TARKIB</small><strong>${esc(l.title)}${l.variant ? ' · ' + esc(l.variant) : ''} — ${l.quantity} dona</strong></div>
      </div>
      <div class="modal-actions no-print"><button type="button" class="btn btn-primary" data-action="print-modal">Nakladnoyni chop etish ↓</button></div>
    </div>`);
  }

  function openOrderChatModal(orderId, messages) {
    showModal(`<div class="order-chat-sheet">
      <h2>Buyurtma #${esc(String(orderId).slice(0, 8).toUpperCase())} chati</h2>
      <div class="order-chat-log" id="order-chat-log">${messages.length ? messages.map(m => `<div class="chat-msg role-${esc(m.sender_role)}"><strong>${esc(m.sender_name || m.sender_role)}</strong><p>${esc(m.message)}</p><small>${new Date(m.created_at).toLocaleString('uz-UZ')}</small></div>`).join('') : '<p class="summary-note">Hali xabarlar yo‘q. Savol yoki izoh yozishingiz mumkin.</p>'}</div>
      <form data-form="order-chat-send" data-id="${esc(orderId)}" class="chat-send-form">
        <input name="message" required maxlength="800" placeholder="Xabar yozing...">
        <button type="submit" class="btn btn-primary">Yuborish →</button>
      </form>
    </div>`);
  }

  return {
    getLang, setLang, t, applyLang,
    flashSaleActive, effectivePrice, flashBadgeHtml, startCountdowns,
    installmentHint, socialProofHtml, uzpostMapHtml,
    openReceiptModal, openShippingLabelModal, openOrderChatModal, closeModal
  };
})();
