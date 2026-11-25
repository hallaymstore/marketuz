const $ = (s, root = document) => root.querySelector(s);
const app = $('#app');
const state = { config: null, user: null, cart: readLocal('marketuz_cart', []), favorites: new Set(readLocal('marketuz_favorites', [])), products: new Map(), request: 0, authNext: null, sellerProducts: [], sellerOrders: [], admin: {}, toastTimer: null, feed:null,feedObserver:null,view:null,shop:null,checkoutKey:null,paymentTimer:null };
const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', close: '<path d="M5 5l14 14M19 5 5 19"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
  heart: '<path d="M20.8 4.9a5.5 5.5 0 0 0-7.8 0L12 6l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.3a5.5 5.5 0 0 0 0-7.8z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.4-6 8-6s8 2 8 6"/>',
  bag: '<path d="M4 8h16l-1.1 13H5.1L4 8zM9 9V6a3 3 0 0 1 6 0v3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  truck: '<path d="M3 5h11v12H3zM14 9h4l3 4v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3z"/><path d="m9 12 2 2 4-4"/>',
  store: '<path d="M3 9h18l-2-5H5L3 9zM5 9v12h14V9M9 21v-7h6v7"/>',
  file: '<path d="M6 2h9l4 4v16H6zM14 2v5h5M9 12h7M9 16h7"/>',
  sliders: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="9" cy="18" r="2"/>',
  sparkle: '<path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2z"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  box: '<path d="m12 2 9 5-9 5-9-5 9-5zM3 7v10l9 5 9-5V7M12 12v10"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  filter: '<path d="M4 7h16M7 12h10M10 17h4"/>',
  logout: '<path d="M10 4H4v16h6M15 8l4 4-4 4M8 12h11"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.1A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3.4 4.5M6.6 6.6A17.7 17.7 0 0 0 2 12s3.5 7 10 7a10.4 10.4 0 0 0 5.4-1.5"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3L5.8 21 7 14.2 2 9.3l6.9-1z"/>'
};
const icon = name => { const custom=state.config?.site?.icons?.[name]; return custom&&safeImage(custom)?`<img class="ui-custom-icon" src="${safeImage(custom)}" alt="" aria-hidden="true">`:`<svg class="ui-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.sparkle}</svg>`; };
const bagArtwork = () => state.config?.site?.icons?.bag?icon('bag'):'<img class="bag-artwork" src="/assets/bag-premium.webp" width="20" height="20" alt="" aria-hidden="true">';
const esc = value => String(value ?? '').replace(/[&<>"']/g, s => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[s]);
const money = n => `${new Intl.NumberFormat('uz-UZ').format(Number(n) || 0)} so‘m`;
const safeImage = value => { if (typeof value === 'string' && (value==='/favicon.svg'||/^\/assets\/[a-z0-9/.-]+\.(webp|png|svg|jpg)$/.test(value)||/^\/media\/[a-f0-9-]{36}$/.test(value))) return value; try { const u = new URL(value); return u.protocol === 'https:' ? esc(u.href) : ''; } catch { return ''; } };
const scenicImage = (value,width=560) => { try { const url=new URL(value); if(url.origin==='https://images.unsplash.com'){url.searchParams.set('w',String(width));url.searchParams.set('q','56');return esc(url.href);} } catch {} return safeImage(value); };
const img = (value, alt, extra = '') => {
  const source=safeImage(value); let responsive='';
  if (source.startsWith('https://images.unsplash.com/')) {
    const u=new URL(value), variant=(width,quality)=>{ const copy=new URL(u); copy.searchParams.set('w',width); copy.searchParams.set('q',quality); return esc(copy.href); };
    const sizes=extra.includes('detail-image')?'(max-width: 780px) 100vw, 50vw':'(max-width: 520px) 50vw, (max-width: 1100px) 33vw, 25vw';
    responsive=`srcset="${variant(380,76)} 380w, ${variant(760,80)} 760w, ${variant(1100,84)} 1100w" sizes="${sizes}"`;
  }
  return `<img src="${source}" ${responsive} alt="${esc(alt)}" loading="lazy" ${extra}>`;
};
const labelStatus = { awaiting_payment:'To‘lov kutilmoqda',new:'Yangi so‘rov', accepted:'Qabul qilindi', packing:'Tayyorlanmoqda', handed_over:'Topshirildi', in_transit:'Yo‘lda', delivered:'Yetkazildi', cancelled:'Bekor qilingan', pending:'Tekshiruvda', active:'Faol', rejected:'Rad etilgan', archived:'Arxiv', approved:'Tasdiqlangan', ready:'Tayyor' };
const dateText = s => new Date(s).toLocaleDateString('uz-UZ', { day:'2-digit', month:'long', year:'numeric' });
function readLocal(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function saveLocal(key, value) { try { localStorage.setItem(key,JSON.stringify(value)); } catch {} }
function notify(message, error = false) { const t=$('#toast'); t.textContent=message; t.className=`toast show${error?' error':''}`; clearTimeout(state.toastTimer); state.toastTimer=setTimeout(()=>t.className='toast',3700); }
async function api(url, options = {}) {
  const response = await fetch('/api' + url, { credentials:'same-origin', headers: { ...(options.body ? {'Content-Type':'application/json'} : {}), ...options.headers }, ...options });
  let body; try { body = await response.json(); } catch { throw new Error('Server javobini o‘qib bo‘lmadi.'); }
  if (!response.ok) throw new Error(body.error || 'So‘rov bajarilmadi.');
  return body;
}
function recordInterest(kind,extra={}) {
  if(!state.user?.personalization_enabled)return;
  fetch('/api/events',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,...extra}),keepalive:true}).catch(()=>{});
}
function finishView(){if(!state.view)return;const {id,start}=state.view;state.view=null;const seconds=Math.min(180,Math.round((Date.now()-start)/1000));if(seconds>=5)recordInterest('dwell',{productId:Number(id),durationSeconds:seconds});}
function nav(href, replace = false) { finishView();closeMenu(); if(replace) history.replaceState({},'',href); else history.pushState({},'',href); render(); scrollTo({ top:0, behavior:'instant' }); }
function applyTheme(mode) {
  const saved = mode || readLocal('marketuz_theme', 'light');
  const dark = saved === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const btn = $('#theme-toggle');
  if (btn) {
    btn.setAttribute('aria-label', dark ? 'Kunduzgi rejimga o‘tish' : 'Tungi rejimga o‘tish');
    btn.innerHTML = icon(dark ? 'sun' : 'moon');
  }
}
function updateOnlineState() {
  const banner = $('#offline-banner');
  if (banner) banner.hidden = navigator.onLine !== false;
}
function loadingSkeleton() {
  return `<div class="skeleton-wrap" aria-label="Yuklanmoqda"><div class="skeleton-hero"></div><div class="skeleton-grid">${Array.from({ length: 8 }, () => '<div class="skeleton-card"></div>').join('')}</div></div>`;
}
function syncCartServer() {
  if (!state.user || state.config?.demoOnly) return;
  api('/cart', { method: 'PUT', body: JSON.stringify({ items: state.cart }) }).catch(() => {});
}
function headerUpdate() {
  const count=state.cart.reduce((n,x)=>n+Number(x.qty||0),0);
  $('#cart-count').textContent=count; $('#bottom-cart-count').style.display=count?'block':'none';
  const adminLink = $('#drawer-admin-link');
  if (adminLink) adminLink.hidden = state.user?.role !== 'admin';
  document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav === (location.pathname.startsWith('/product/')?'/catalog':location.pathname)));
}
function closeMenu() { $('#mobile-drawer').classList.remove('open'); $('#mobile-drawer').setAttribute('aria-hidden','true'); $('#drawer-backdrop').hidden=true; $('.menu-trigger').setAttribute('aria-expanded','false'); document.body.style.overflow=''; }
function openMenu() { $('#mobile-drawer').classList.add('open'); $('#mobile-drawer').setAttribute('aria-hidden','false'); $('#drawer-backdrop').hidden=false; $('.menu-trigger').setAttribute('aria-expanded','true'); document.body.style.overflow='hidden'; }
const crumbs = (...parts) => `<div class="breadcrumbs"><a href="/" data-link>Bosh sahifa</a>${parts.map((p,i)=>`<span>›</span>${i===parts.length-1?`<span class="current">${esc(p[0])}</span>`:`<a href="${p[1]}" data-link>${esc(p[0])}</a>`}`).join('')}</div>`;
function productCard(p) {
  state.products.set(String(p.id),p);
  const isFav=state.favorites.has(String(p.id));
  const bg=scenicImage(p.card_background||p.image_url);
  const rating=Number(p.rating_count)>0?`<small class="card-rating">★ ${Number(p.rating_avg).toFixed(1)} (${p.rating_count})</small>`:'';
  return `<article class="product-card"><a href="/product/${p.id}" data-link class="product-image">${img(p.image_url,p.name)}${p.badge?`<span class="badge ${p.badge==='Chegirma'?'hot':''}">${esc(p.badge)}</span>`:''}</a><button class="favorite-btn ${isFav?'active':''}" data-action="favorite" data-id="${p.id}" aria-label="${isFav?'Sevimlilardan olib tashlash':'Sevimlilarga qo‘shish'}">${icon('heart')}</button><div class="product-info">${bg?`<img class="product-card-backdrop" src="${bg}" alt="" loading="lazy" aria-hidden="true">`:''}<small>${esc(p.reason||state.config.categories.find(c=>c.id===p.category)?.name||'Marketuz')}</small><a href="/product/${p.id}" data-link class="product-title">${esc(p.name)}</a>${rating}<div class="price-row"><strong>${money(p.price)}</strong>${p.old_price?`<s>${money(p.old_price)}</s>`:''}</div>${p.stock_mode==='replenishable'?'<span class="restock-chip">↻ Buyurtma asosida</span>':''}<div class="product-bottom"><button class="btn btn-soft" data-action="${p.variant_count?'product-choose':'add-cart'}" data-id="${p.id}" ${p.stock_mode!=='replenishable'&&p.stock<1?'disabled':''}>${bagArtwork()} <span>${p.variant_count?'Variantlar':'Savatga'}</span></button></div></div></article>`;
}
function empty(title, description, actionText, actionHref, iconName='bag') { return `<div class="empty"><div class="empty-icon">${icon(iconName)}</div><h2>${esc(title)}</h2><p>${esc(description)}</p>${actionHref?`<a href="${actionHref}" data-link class="btn btn-primary">${esc(actionText)}</a>`:''}</div>`; }
const sectionHead = (kicker,title,subtitle,href,textValue) => `<div class="section-heading"><div><span class="eyebrow">${kicker}</span><h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div>${href?`<a href="${href}" data-link>${textValue||'Barchasini ko‘rish'}</a>`:''}</div>`;
function updateTitle(title) { document.title=title+' | '+(state.config?.site?.brand?.name||'Marketuz'); }
const seasonNames={spring:'Bahorgi',summer:'Yozgi',autumn:'Kuzgi',winter:'Qishki'};
const seasonCopies={spring:'Navro‘z nafasi, nafis aksessuarlar va yangi mavsumga mos buyumlar.',summer:'Yorqin kunlar uchun aksessuarlar, yengil kiyimlar va uyga fayz beruvchi topilmalar.',autumn:'Iliq ranglar, qulay kiyimlar va uy uchun did bilan tanlangan buyumlar.',winter:'Yangi yilga mos aksessuarlar, qishki kiyim-kechak va uy uchun yoqimli buyumlar.'};
function applySite(){
  const cfg=state.config,site=cfg.site,s=cfg.seasonal.season,t=site.theme,h=t.holidayArt?.[cfg.seasonal.holiday]||{};
  document.body.dataset.season=s;document.body.dataset.holiday=cfg.seasonal.holiday||'';
  const source=(url)=>`url(${JSON.stringify(safeImage(url)||'')})`;
  for(const [k,url] of Object.entries({'--season-cover':h.background||t.background[s],'--season-hero':h.hero||t.hero[s],'--season-garland':h.garland||t.decor.garland|| (s==='winter'?'/assets/decor/pine-garland.webp':`/assets/seasons/${s}-garland.webp`),'--season-corner':h.corner||t.decor.corner|| (s==='winter'?'/assets/decor/pine-corner.webp':`/assets/seasons/${s}-garland.webp`),'--story-one':site.content.storyOneImage||h.hero||t.hero[s],'--story-two':site.content.storyTwoImage||h.background||t.background[s],'--editorial-image':site.content.editorialImage||h.hero||t.hero[s],'--delivery-image':site.content.deliveryImage||h.hero||t.hero[s],'--auth-image':site.content.authImage||h.hero||t.hero[s]})) document.documentElement.style.setProperty(k,source(url));
  document.querySelectorAll('.nav-garland img,.winter-seam img').forEach(el=>el.src=h.garland||t.decor.garland|| (s==='winter'?'/assets/decor/pine-garland.webp':`/assets/seasons/${s}-garland.webp`));
  document.body.dataset.customColumn=Boolean(h.column||t.decor.column);
  document.querySelectorAll('.winter-column').forEach(el=>el.src=h.column||t.decor.column||'/assets/decor/winter-pillar.webp');
  document.querySelectorAll('.winter-lantern').forEach(el=>el.src=h.lantern||t.decor.lantern||'/assets/decor/gold-lantern.webp');
  $('#announcement-text').textContent=`${site.brand.name} · ${cfg.seasonal.announcement}`;
  document.querySelectorAll('.brand').forEach(el=>{
    const sign=el.querySelector('.brand-sign'),word=el.querySelector('.brand-word');
    sign.innerHTML=site.brand.logo?`<img class="brand-logo-upload" src="${safeImage(site.brand.logo)}" alt="">`:'<span>m</span><i></i>';
    word.innerHTML=`${esc(site.brand.name)}<small>${esc(site.brand.tagline)}</small>`;
    el.setAttribute('aria-label',site.brand.name+' bosh sahifa');
  });
  $('#footer-name').textContent=site.brand.name; $('.footer-brand p').textContent=site.content.footerText;
  $('#footer-contact').textContent=site.legal.phone||site.legal.email||'Aloqa uchun ma’lumotlar admin panelda kiritiladi';
  document.querySelectorAll('[data-icon]').forEach(slot=>slot.innerHTML=icon(slot.dataset.icon));
  const favicon=document.querySelector('link[rel="icon"]');if(favicon) favicon.href=site.brand.favicon||'/favicon.svg';
  document.querySelector('meta[name="theme-color"]').content=s==='autumn'?'#4a4a37':'#173f37';
  window.MarketuzExperience?.update(site);
}

async function renderHome() {
  const seasonal=state.config.seasonal,s=seasonal.season,t=state.config.site.theme,h=t.holidayArt?.[seasonal.holiday]||{},season=seasonNames[s],headline=seasonal.holiday?seasonal.holidayName:season,title=seasonal.holiday?(t.holidayTitles?.[seasonal.holiday]||seasonal.holidayTitle):(t.titles[s]||'ajoyib topilmalar.'),subtitle=seasonal.holiday?(t.holidaySubtitles?.[seasonal.holiday]||seasonal.holidayLine):(t.subtitles[s]||seasonCopies[s]);
  updateTitle(headline+' '+title);
  const [{products},{products:recommended}]=await Promise.all([api('/catalog?sort=newest'),api('/recommendations?kind=for-you&limit=8')]);
  const c=state.config.categories,content=state.config.site.content;
  return `<div class="hero-grid"><section class="hero-main"><div class="hero-copy"><span class="hero-kicker"><b></b> ${esc((seasonal.holidayName||season+' mavsum tanlovi').toUpperCase())}</span><h1>${esc(headline)}<br><em>${esc(title)}</em></h1><p>${esc(subtitle)}</p><div class="hero-buttons"><a href="/catalog" data-link class="btn btn-lime">Mahsulotlarni kashf eting</a><a href="/seller" data-link class="btn btn-outline-light">Sotuvchi bo‘ling</a></div></div><div class="hero-image-panel" aria-hidden="true"><img src="${safeImage(h.hero||t.hero[s])}" alt="" fetchpriority="high"><span>✦ &nbsp; ${esc(state.config.site.brand.name)} tanlovi</span></div><img class="hero-sprig" src="${safeImage(h.corner||t.decor.corner||'/assets/decor/pine-corner.webp')}" alt="" aria-hidden="true"></section><div class="hero-side"><a href="/catalog?category=${encodeURIComponent(content.storyOneCategory)}" data-link class="story-card one"><span class="story-kicker">${esc(season)} uslub</span><h2>${esc(content.storyOneTitle)}</h2><span class="story-link">Kolleksiyani ko‘ring</span></a><a href="/catalog?category=${encodeURIComponent(content.storyTwoCategory)}" data-link class="story-card two"><span class="story-kicker">Uy uchun g‘oyalar</span><h2>${esc(content.storyTwoTitle)}</h2><span class="story-link">G‘oyalarni ko‘ring</span></a></div></div>
  <div class="benefits"><div class="benefit"><span class="benefit-icon">${icon('sparkle')}</span><div><strong>Tanlangan mahsulotlar</strong><p>Did bilan jamlangan katalog</p></div></div><div class="benefit"><span class="benefit-icon">${icon('truck')}</span><div><strong>Hududlar bo‘ylab</strong><p>Yetkazish tafsilotlari tasdiqlanadi</p></div></div><div class="benefit"><span class="benefit-icon">${icon('shield')}</span><div><strong>Qulay xarid</strong><p>Bir necha qadamda so‘rov</p></div></div><div class="benefit"><span class="benefit-icon">${icon('heart')}</span><div><strong>Sevimlilar ro‘yxati</strong><p>Yoqtirganlaringizni saqlang</p></div></div></div>
  <div class="winter-seam" aria-hidden="true"><img src="${safeImage(h.garland||t.decor.garland|| (s==='winter'?'/assets/decor/pine-garland.webp':`/assets/seasons/${s}-garland.webp`))}" alt="" loading="lazy"></div>
  <section class="section">${sectionHead('Siz uchun',esc(content.categoryTitle),'Aksessuarlar, kiyim-kechak va har kuni kerak bo‘ladigan buyumlar.','/catalog','Katalogga o‘tish')}<div class="category-grid">${c.map(x=>`<a href="/catalog?category=${x.id}" data-link class="category-tile category-${esc(x.id)}">${x.image?img(x.image,'','class="category-cover" loading="lazy"'): ''}<span class="category-arrow">✳</span><span><strong>${esc(x.name)}</strong><small>${esc(x.subtitle)}</small></span></a>`).join('')}</div></section>
  <section class="section">${sectionHead(season+' topilmalar',esc(content.productTitle),'Xarid qilishning eng yoqimli qismi — aynan o‘zingizga mosini topish.','/discover','Siz uchun tavsiyalar')}<div class="products-grid">${recommended.map(productCard).join('')}</div></section>
  <section class="section editorial"><div class="editorial-copy"><span class="eyebrow eyebrow-light">${esc(season)} ilhom</span><h2>${esc(content.editorialTitle)}</h2><p>${esc(content.editorialText)}</p><a href="/catalog?category=uy" data-link class="btn btn-lime">Uy buyumlarini ko‘rish</a></div></section>
  <section class="section">${sectionHead('Yana ham ko‘proq','Bugun nimalarni tanlaysiz?','','/catalog','Barchasini ko‘rish')}<div class="products-grid">${products.slice(8,16).map(productCard).join('')}</div></section>`;
}
async function renderCatalog() {
  updateTitle('Katalog');
  const params=new URLSearchParams(location.search),q=(params.get('q')||'').slice(0,80),category=params.get('category')||'',subcategory=params.get('subcategory')||'',sort=params.get('sort')||'newest';
  const minPrice=params.get('minPrice')||'',maxPrice=params.get('maxPrice')||'',inStock=params.get('inStock')==='true',minRating=params.get('minRating')||'';
  const query=new URLSearchParams({q,category,subcategory,sort,limit:'24'});
  if(minPrice)query.set('minPrice',minPrice);if(maxPrice)query.set('maxPrice',maxPrice);if(inStock)query.set('inStock','true');if(minRating)query.set('minRating',minRating);
  const [data,subData]=await Promise.all([api('/catalog/feed?'+query),api('/subcategories').catch(()=>({subcategories:[]}))]);
  state.feed={query,cursor:data.nextCursor,hasMore:data.hasMore,count:data.products.length,loading:false};
  const categoryTitle=state.config.categories.find(c=>c.id===category)?.name;
  const matchedSubs=(subData.subcategories||[]).filter(s=>!category||s.category===category);
  const urlWith=(name,value)=>{const x=new URLSearchParams(location.search);if(value)x.set(name,value);else x.delete(name);if(name==='category')x.delete('subcategory');return '/catalog'+(x.size?'?'+x:'');};
  const recentIds=readLocal('marketuz_recent',[]).filter(Boolean);
  const recentHtml=recentIds.length&&!q&&!category?`<section class="section"><h3>Yaqinda ko‘rilganlar</h3><div class="products-grid">${recentIds.slice(0,4).map(id=>state.products.get(String(id))).filter(Boolean).map(productCard).join('')}</div></section>`:'';
  return `${crumbs([categoryTitle||'Katalog'])}<div class="page-heading"><span class="eyebrow">Cheksiz kashfiyot</span><h1>${q?`“${esc(q)}” uchun natijalar`:esc(categoryTitle||'Barcha mahsulotlar')}</h1><p>Yangi mahsulotlar uzluksiz qo‘shiladi. Pastga tushgan sari keyingilari yuklanadi.</p></div>
  <div class="mobile-filters" aria-label="Kategoriyalar">
    <a href="${urlWith('category','')}" data-link class="filter-chip ${!category?'active':''}">Hammasi</a>
    ${state.config.categories.map(c=>`<a href="${urlWith('category',c.id)}" data-link class="filter-chip ${c.id===category?'active':''}">${esc(c.name)}</a>`).join('')}
  </div>
  <div class="catalog-layout"><aside class="filter-panel"><h3>Kategoriyalar</h3><a href="${urlWith('category','')}" data-link class="${!category?'active':''}">Hammasi <span>✳</span></a>${state.config.categories.map(c=>`<a href="${urlWith('category',c.id)}" data-link class="${c.id===category?'active':''}">${esc(c.name)} <span>✳</span></a>`).join('')}${matchedSubs.length?`<h3>Quyi bo‘limlar</h3>${matchedSubs.slice(0,12).map(s=>`<a href="${urlWith('subcategory',s.name)}" data-link class="${s.name===subcategory?'active':''}">${esc(s.name)} <span>›</span></a>`).join('')}`:''}<a href="/discover" data-link>✦ Sizga tavsiyalar</a></aside><div>
  <form class="catalog-filters-bar" data-form="catalog-filter">
    <input type="number" name="minPrice" min="0" placeholder="Narx dan" value="${esc(minPrice)}" aria-label="Minimal narx">
    <input type="number" name="maxPrice" min="0" placeholder="Narx gacha" value="${esc(maxPrice)}" aria-label="Maksimal narx">
    <select name="minRating" aria-label="Minimal reyting"><option value="">Barcha baholar</option><option value="4" ${minRating==='4'?'selected':''}>4+ yulduz</option><option value="3" ${minRating==='3'?'selected':''}>3+ yulduz</option></select>
    <label><input type="checkbox" name="inStock" ${inStock?'checked':''}> Mavjudlari</label>
    <button class="small-btn" type="submit">Qo‘llash</button>
    ${minPrice||maxPrice||inStock||minRating||subcategory?`<a href="/catalog${category?'?category='+encodeURIComponent(category):''}" data-link class="small-btn reject">Tozalash</a>`:''}
  </form>
  <div class="catalog-top"><span id="feed-count">${data.products.length} ta mahsulot ko‘rsatilmoqda</span><select id="catalog-sort" aria-label="Saralash"><option value="newest" ${sort==='newest'?'selected':''}>Eng yangilar</option><option value="popular" ${sort==='popular'?'selected':''}>Ommabop</option><option value="rating" ${sort==='rating'?'selected':''}>Yuqori reyting</option><option value="price_asc" ${sort==='price_asc'?'selected':''}>Arzonidan</option><option value="price_desc" ${sort==='price_desc'?'selected':''}>Qimmatidan</option></select></div>${data.products.length?`<div class="products-grid" id="feed-grid">${data.products.map(productCard).join('')}</div>`:empty('Hozircha mahsulot topilmadi','Boshqa so‘z yoki kategoriyani sinab ko‘ring.','Barcha mahsulotlar','/catalog','search')}<div class="feed-sentinel" id="feed-sentinel" ${data.hasMore?'':'hidden'}><span>Yana topilmalar yuklanmoqda</span><button type="button" class="small-btn" data-action="feed-more">Yana ko‘rish</button></div><p class="feed-end" id="feed-end" ${data.hasMore?'hidden':''}>Hozircha hammasini ko‘rdingiz ✦</p></div></div>${recentHtml}`;
}
async function loadFeed() {
  const feed=state.feed;
  if(!feed||!feed.hasMore||feed.loading||location.pathname!=='/catalog')return;
  feed.loading=true;const request=state.request,query=new URLSearchParams(feed.query);query.set('cursor',feed.cursor);
  const sentinel=$('#feed-sentinel');if(sentinel)sentinel.querySelector('span').textContent='Yuklanmoqda...';
  try {
    const data=await api('/catalog/feed?'+query);
    if(request!==state.request||feed!==state.feed)return;
    const grid=$('#feed-grid');if(grid)grid.insertAdjacentHTML('beforeend',data.products.map(productCard).join(''));
    feed.cursor=data.nextCursor;feed.hasMore=data.hasMore;feed.count+=data.products.length;
    $('#feed-count').textContent=`${feed.count} ta mahsulot ko‘rsatilmoqda`;
    $('#feed-sentinel').hidden=!feed.hasMore;$('#feed-end').hidden=feed.hasMore;
    if(feed.hasMore) requestAnimationFrame(observeFeed);
  }catch(e){if(request===state.request){notify(e.message,true);if(sentinel)sentinel.querySelector('span').textContent='Yuklanmadi. Qayta urinib ko‘ring.';}}
  finally{feed.loading=false;}
}
function observeFeed(){
  state.feedObserver?.disconnect();const el=$('#feed-sentinel');if(!el||el.hidden)return;
  if(!('IntersectionObserver'in window))return;
  state.feedObserver=new IntersectionObserver(entries=>{if(entries.some(x=>x.isIntersecting))loadFeed();},{rootMargin:'650px 0px'});
  state.feedObserver.observe(el);
}
async function renderDiscover() {
  updateTitle('Kashfiyot');
  const [suggested,trending]=await Promise.all([api('/recommendations?kind=for-you&limit=12'),api('/recommendations?kind=trending&limit=8')]);
  const personalized=suggested.personalized;
  return `${crumbs(['Kashfiyot'])}<section class="discover-hero"><span class="eyebrow">✦ MARKETUZ KASHFIYOT</span><h1>Sizga yaqin topilmalar</h1><p>${personalized?'Qiziqishlaringiz va saqlagan mahsulotlaringiz asosida tanlandi.':'Hamma uchun ommabop va yangi topilmalar. Shaxsiy tavsiyalarni profilingizda yoqishingiz mumkin.'}</p><div><a href="/catalog" data-link class="btn btn-primary">Katalogni ko‘rish</a><a href="/account?tab=preferences" data-link class="btn btn-outline">Tavsiyalarni boshqarish</a></div></section><section class="section">${sectionHead('Siz uchun','Did bilan tanlanganlar','Tanlovingiz o‘zgargani sari tavsiyalar ham yangilanadi.','/catalog','Katalog')}<div class="products-grid">${suggested.products.map(productCard).join('')}</div></section><section class="section">${sectionHead('Ko‘p tanlangan','Ommabop topilmalar','Hozir xaridorlar tanlayotgan mahsulotlar.')}<div class="products-grid">${trending.products.map(productCard).join('')}</div></section>`;
}
async function renderRichProduct(id){
  const [{product:p},{products:related},reviewsData]=await Promise.all([
    api('/products/'+encodeURIComponent(id)),
    api('/recommendations?kind=together&productId='+encodeURIComponent(id)+'&limit=8').catch(()=>({products:[]})),
    api('/products/'+encodeURIComponent(id)+'/reviews').catch(()=>({reviews:[]}))
  ]);
  state.products.set(String(p.id),p);updateTitle(p.name);
  const recent=readLocal('marketuz_recent',[]).filter(x=>String(x)!==String(p.id));
  saveLocal('marketuz_recent',[String(p.id),...recent].slice(0,8));
  const category=state.config.categories.find(x=>x.id===p.category),images=[p.image_url,...(Array.isArray(p.gallery)?p.gallery:[])].filter(Boolean);
  const unique=[...new Set(images)],variants=p.variants||[],replenishable=p.stock_mode==='replenishable';
  const placeholder=p.image_url?.includes('product-placeholder.svg');
  const scenery=scenicImage(p.detail_background||p.card_background||p.image_url,900);
  const reviews=reviewsData.reviews||[];
  const compareList=readLocal('marketuz_compare',[]);
  const inCompare=compareList.includes(String(p.id));
  return `${crumbs(['Katalog','/catalog'],[category?.name||'Mahsulot','/catalog?category='+p.category],[p.name])}<div class="detail-grid"><div class="detail-gallery"><div class="detail-art">${img(unique[0]||'/assets/product-placeholder.svg',p.name,'class="detail-image" id="detail-gallery-main" loading="eager"')}${unique.length>1?`<button class="gallery-switch prev" data-action="gallery-shift" data-delta="-1" aria-label="Oldingi rasm">‹</button><button class="gallery-switch next" data-action="gallery-shift" data-delta="1" aria-label="Keyingi rasm">›</button>`:''}</div>${unique.length>1?`<div class="gallery-strip" id="detail-gallery-strip">${unique.map((url,i)=>`<button type="button" data-action="gallery-select" data-index="${i}" class="${i===0?'active':''}" aria-label="${i+1}-rasm">${img(url,p.name)}</button>`).join('')}</div>`:''}</div><section class="detail-copy">${scenery?`<img class="detail-scenery" src="${scenery}" alt="" aria-hidden="true">`:''}<span class="eyebrow">${esc(category?.name||'Marketuz tanlovi')}${p.subcategory?' · '+esc(p.subcategory):''}</span><h1>${esc(p.name)}</h1>${placeholder?'<span class="studio-placeholder">Vaqtinchalik rasm · haqiqiy surat kutilmoqda</span>':''}<p class="lead">${esc(p.description)}</p>${Number(p.rating_count)>0?`<p class="summary-note">★ <strong>${Number(p.rating_avg).toFixed(1)}</strong> · ${p.rating_count} ta xaridor bahosi</p>`:''}<div class="detail-price" id="detail-selected-price">${money(p.price)} ${p.old_price?`<s>${money(p.old_price)}</s>`:''}</div>${variants.length?`<div class="variant-choices" aria-label="Variant tanlash">${variants.map(v=>`<button type="button" data-action="variant-select" data-id="${v.id}" ${!replenishable&&v.stock<1?'disabled':''}>${esc(v.label)}${v.price!==p.price?' · '+money(v.price):''}</button>`).join('')}</div><span id="variant-hint" class="summary-note">Rang yoki o‘lchamni tanlang.</span>`:''}<span id="detail-stock" class="in-stock">${replenishable?`● Buyurtma asosida · taxminan ${p.restock_days} kun ichida to‘ldiriladi; mavjudlik tasdiqlanadi`:p.stock>0?`● Omborda ${p.stock} dona mavjud`:'Hozircha tugagan'}</span>${p.brand||p.sku||Object.keys(p.specifications||{}).length?`<div class="detail-specs">${[['Brend',p.brand],['Artikul',p.sku],...Object.entries(p.specifications||{})].filter(x=>x[1]).map(([k,v])=>`<div><small>${esc(k)}</small><strong>${esc(v)}</strong></div>`).join('')}</div>`:''}<div class="detail-meta"><div><span>Kategoriya</span><strong>${esc(category?.name||'—')}</strong></div><div><span>Sotuvchi</span><strong>${p.seller_id?`<a href="/shop/${p.seller_id}" data-link>${esc(p.seller_name||'Do‘kon')} ↗</a>`:esc(p.seller_name||'Marketuz tanlovi')}</strong></div><div><span>Yetkazib berish</span><strong>Manzilga qarab tasdiqlanadi</strong></div><div><span>To‘lov</span><strong>${replenishable?'Tasdiqdan so‘ng kelishiladi':state.config.payments.length>1?'Click, Payme yoki yetkazilganda':'Yetkazilganda'}</strong></div></div><div class="detail-actions"><button class="btn btn-primary" data-action="add-cart" data-id="${p.id}" ${!replenishable&&p.stock<1?'disabled':''}>${icon('bag')} Savatga qo‘shish</button><button class="icon-button" data-action="favorite" data-id="${p.id}" aria-label="Sevimlilarga qo‘shish">${icon('heart')}</button><button type="button" class="btn btn-outline" data-action="compare-toggle" data-id="${p.id}">${inCompare?'Taqqoslashda ✓':'Taqqoslash'}</button></div><div class="share-actions"><button data-action="share" data-id="${p.id}">${icon('sparkle')} Ulashish</button><a href="https://t.me/share/url?url=${encodeURIComponent(location.origin+'/product/'+p.id)}&text=${encodeURIComponent(p.name)}" target="_blank" rel="noopener noreferrer">Telegram</a><a href="https://wa.me/?text=${encodeURIComponent(p.name+' '+location.origin+'/product/'+p.id)}" target="_blank" rel="noopener noreferrer">WhatsApp</a></div>${p.external_links?.length?`<div class="external-links">${p.external_links.map(l=>`<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} ↗</a>`).join('')}</div>`:''}<p class="summary-note">Buyurtma va yetkazish tafsilotlari manzil bo‘yicha tasdiqlanadi.</p></section></div>
  <section class="section"><div class="profile-card"><h2>Xaridor sharhlari (${reviews.length})</h2>${state.user?`<form data-form="review" data-id="${p.id}" class="form-grid"><label class="field">Bahoyingiz<select name="rating" required><option value="5">5 ★ — A’lo</option><option value="4">4 ★ — Yaxshi</option><option value="3">3 ★ — O‘rtacha</option><option value="2">2 ★ — Qoniqarsiz</option><option value="1">1 ★ — Yomon</button></select></label><label class="field full">Sharhingiz<textarea name="comment" required minlength="3" maxlength="1000" placeholder="Mahsulot sifati haqida fikringiz..."></textarea></label><button class="btn btn-primary" type="submit">Sharh qoldirish</button></form>`:'<p class="summary-note">Sharh qoldirish uchun <a href="/account" data-link>hisobingizga kiring</a>.</p>'}${reviews.length?`<div class="session-list">${reviews.map(r=>`<div class="session-item"><div><strong>${esc(r.author_name)} · ${'★'.repeat(r.rating)} ${r.verified_purchase?'<span class="status active">Tasdiqlangan xaridor</span>':''}</strong><p>${esc(r.comment)}</p><small>${dateText(r.created_at)}</small></div></div>`).join('')}</div>`:'<p class="summary-note">Hozircha sharhlar yo‘q. Birinchi bo‘lib baho bering!</p>'}</div></section>
  <section class="section">${sectionHead('Birga xarid qilishadi','Bu mahsulot bilan mos topilmalar','','/discover','Yana kashf etish')}<div class="products-grid">${related.map(productCard).join('')}</div></section>`;
}
async function renderStudio(role,kind,id){
  updateTitle(kind==='import'?'Excel import':kind==='subcategories'?'Quyi kategoriyalar':'Mahsulot muharriri');
  if(!state.user)return empty('Hisobga kiring','Mahsulotlarni boshqarish uchun hisobingizga kiring.','Hisobga kirish','/account');
  if(state.user.role!==role)return empty('Ruxsat yo‘q','Bu sahifa hisobingiz uchun mavjud emas.','Bosh sahifa','/');
  if(kind==='import')return MarketuzStudio.importer(role);
  const cats=await api('/subcategories');state.studioSubcategories=cats.subcategories;
  if(kind==='subcategories'){const all=await api('/admin/subcategories');return MarketuzStudio.subcategoryPage(state.config.categories,all.subcategories);}
  const product=id?(await api(role==='seller'?'/seller/products/'+id:'/admin/products/'+id+'/details')).product:null;
  return MarketuzStudio.editor({role,product:product||{},categories:state.config.categories,subcategories:cats.subcategories});
}
async function loadCart() {
  const entries=state.cart.filter(x=>Number.isSafeInteger(Number(x.id))&&Number(x.qty)>0);
  const found=await Promise.all(entries.map(async item=>{ try { let p=state.products.get(String(item.id));if(!p || (item.variantId && !p.variants))p=(await api('/products/'+item.id)).product;state.products.set(String(item.id),p);const v=item.variantId?p.variants?.find(x=>String(x.id)===String(item.variantId)):null;if(p.variant_count && !v)return null;return {...p,name:v?`${p.name} · ${v.label}`:p.name,price:v?.price||p.price,image_url:v?.image_url||p.image_url,stock:v?.stock??p.stock,variantId:v?.id||null,qty:Math.max(1,Math.min(20,Number(item.qty)))}; } catch { return null; } }));
  return found.filter(Boolean);
}
const summary = (products,checkout=false) => { const count=products.reduce((n,p)=>n+p.qty,0), total=products.reduce((n,p)=>n+p.price*p.qty,0),included=state.config.shipping==='included'; return `<aside class="summary"><h2>Buyurtma xulosasi</h2><div class="summary-row"><span>Mahsulotlar (${count})</span><strong>${money(total)}</strong></div><div class="summary-row"><span>Yetkazib berish</span><strong>${included?'Narxga kiritilgan':'Alohida aniqlanadi'}</strong></div><div class="summary-row summary-total"><span>Mahsulotlar jami</span><strong>${money(total)}</strong></div>${checkout?'':`<a href="/checkout" data-link class="btn btn-primary">Buyurtmaga o‘tish</a>`}<p class="summary-note">${included?'Yetkazish narxi mahsulot narxiga kiritilgan.':'Yetkazish narxi va yakuniy shartlar siz bilan bog‘langandan keyin tasdiqlanadi.'} Onlayn to‘lov faqat faollashtirilgan provayder orqali amalga oshiriladi.</p></aside>`; };
async function renderCart() {
  updateTitle('Savat'); const p=await loadCart();
  return `${crumbs(['Savat'])}<div class="page-heading"><span class="eyebrow">Sizning tanlovingiz</span><h1>Savatim</h1><p>Yoqtirgan mahsulotlaringizni bir joyda ko‘ring.</p></div>${!p.length?empty('Savat hozircha bo‘sh','Mahsulotlarni ko‘rib, o‘zingizga yoqqanini savatga qo‘shing.','Katalogni ko‘rish','/catalog'): `<div class="cart-layout"><div class="cart-list">${p.map(x=>`<article class="cart-item">${img(x.image_url,x.name)}<div><a href="/product/${x.id}" data-link><h3>${esc(x.name)}</h3></a><small>${esc(state.config.categories.find(c=>c.id===x.category)?.name||'Marketuz')}</small><div class="item-price">${money(x.price)}</div></div><div class="cart-right"><strong>${money(x.price*x.qty)}</strong><div class="quantity-picker"><button data-action="cart-qty" data-id="${x.id}" data-variant="${x.variantId||''}" data-delta="-1" aria-label="Soni kamaytirish">−</button><span>${x.qty}</span><button data-action="cart-qty" data-id="${x.id}" data-variant="${x.variantId||''}" data-delta="1" aria-label="Soni oshirish">+</button></div><button class="text-button" data-action="cart-remove" data-id="${x.id}" data-variant="${x.variantId||''}">O‘chirish</button></div></article>`).join('')}</div>${summary(p)}</div>`}`;
}
function paymentChoices(products) {
  const available=state.config.payments.filter(x=>x==='cod'||!products.some(p=>p.stock_mode==='replenishable'));
  available.sort((a,b)=>({click:0,payme:1,cod:2}[a]-{click:0,payme:1,cod:2}[b]));
  const info={click:['Karta bilan · Click','Click ilovasi shart emas. Karta faqat Click’ning xavfsiz oynasiga kiritiladi.'],payme:['Karta bilan · Payme','Karta Payme to‘lov sahifasiga kiritiladi.'],cod:['Yetkazilganda to‘lash','Buyurtmani hozir yuboring, to‘lov shartlari operator bilan kelishiladi.']};
  return `<fieldset class="payment-selector full"><legend>To‘lov usuli</legend><div class="payment-choice-grid">${available.map((method,i)=>`<label class="payment-choice"><input type="radio" name="paymentMethod" value="${method}" ${i===0?'checked':''} required><span class="payment-choice-body"><span class="payment-choice-icon">${icon(method==='cod'?'truck':'shield')}</span><span><strong>${info[method][0]}</strong><small>${info[method][1]}</small></span><span class="payment-choice-tick">✓</span></span></label>`).join('')}</div><p class="payment-disclaimer">Marketuz karta raqami, amal qilish muddati yoki CVV ni so‘ramaydi va saqlamaydi. To‘lov holati faqat provayder tasdig‘idan keyin yangilanadi.</p></fieldset>`;
}
function setAuthNext(path) {
  const safe = typeof path === 'string' && /^\/(?!\/)/.test(path) ? path : '';
  state.authNext = safe || null;
  try { if (safe) sessionStorage.setItem('marketuz_auth_next', safe); else sessionStorage.removeItem('marketuz_auth_next'); } catch {}
}
function getAuthNext() {
  if (state.authNext && /^\/(?!\/)/.test(state.authNext)) return state.authNext;
  try { const v = sessionStorage.getItem('marketuz_auth_next') || ''; return /^\/(?!\/)/.test(v) ? v : null; } catch { return null; }
}
function formatUzPhoneInput(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('998')) digits = digits.slice(0, 12);
  else if (digits.length <= 9) digits = ('998' + digits).slice(0, 12);
  else digits = digits.slice(0, 12);
  const p = [digits.slice(0, 3), digits.slice(3, 5), digits.slice(5, 8), digits.slice(8, 10), digits.slice(10, 12)].filter(Boolean);
  return '+' + p.join(' ');
}
function evalPasswordStrength(password) {
  const s = String(password || '');
  if (!s) return { score: 0, label: 'Kamida 10 ta belgi kiriting', cls: '' };
  if (s.length < 10) return { score: 1, label: `Kamida 10 belgi (${s.length}/10)`, cls: 'weak' };
  let score = 1;
  if (s.length >= 12) score++;
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) score++;
  if (/\d/.test(s)) score++;
  if (/[^A-Za-z0-9]/.test(s)) score++;
  if (/^(.)\1+$/.test(s) || ['1234567890', 'password123', 'qwerty12345'].includes(s.toLowerCase())) {
    return { score: 1, label: 'Juda oddiy parol — murakkabroq tanlang', cls: 'weak' };
  }
  if (score >= 4) return { score: 4, label: 'Kuchli parol', cls: 'strong' };
  if (score >= 3) return { score: 3, label: 'Yaxshi parol', cls: 'good' };
  return { score: 2, label: 'O‘rtacha parol (raqam yoki belgi qo‘shing)', cls: 'medium' };
}
const passwordField = (name, label, opts = {}) => `<label class="field ${opts.full ? 'full' : ''}">${label}<span class="password-field"><input name="${name}" type="password" autocomplete="${opts.autocomplete || 'current-password'}" ${opts.required === false ? '' : 'required'} minlength="${opts.minlength || 1}" maxlength="128" placeholder="${esc(opts.placeholder || '')}" ${opts.strength ? 'data-strength-input="true"' : ''}><button type="button" class="password-toggle" data-action="toggle-password" aria-label="Parolni ko‘rsatish" aria-pressed="false">${icon('eye')}</button></span>${opts.strength ? '<span class="strength-meter" data-strength-meter><i class="strength-bar"></i><small>Kamida 10 ta belgi kiriting</small></span>' : ''}</label>`;
const defaultAuthMode = () => state.config?.smsEnabled ? 'phone-login' : 'login';

function branchOptionsHtml(branches, selectedId='') {
  return branches.map(b => {
    const dist = Number.isFinite(b.distanceKm) ? ` (~${b.distanceKm} km)` : '';
    return `<option value="${esc(b.id)}" ${String(b.id)===String(selectedId)?'selected':''}>${esc(b.region)} · ${esc(b.name)}${dist}</option>`;
  }).join('');
}
function branchDetailsHtml(branch) {
  if (!branch) return '<small>UzPost filialini tanlang.</small>';
  const dist = Number.isFinite(branch.distanceKm) ? `<small>Masofa: taxminan ${branch.distanceKm} km</small>` : '';
  return `<strong>${esc(branch.name)}</strong><small>${esc(branch.region)}, ${esc(branch.district)} · ${esc(branch.address)}</small><small>Ish vaqti: ${esc(branch.hours)}${dist ? ' · ' + dist : ''}</small>`;
}
function makeUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
async function renderCheckout() {
  updateTitle('Buyurtma'); const products=await loadCart();
  const fingerprint=JSON.stringify(state.cart);
  const savedKey=readLocal('marketuz_checkout_key',null);
  if(savedKey?.fingerprint===fingerprint&&typeof savedKey.key==='string')state.checkoutKey=savedKey.key;
  else{state.checkoutKey=makeUuid();saveLocal('marketuz_checkout_key',{key:state.checkoutKey,fingerprint});}
  if(!products.length) return `${crumbs(['Buyurtma'])}<div class="page-heading"><h1>Buyurtma</h1></div>${empty('Savat bo‘sh','Buyurtma berish uchun mahsulot tanlang.','Katalogga o‘tish','/catalog')}`;
  if(!state.user) { setAuthNext('/checkout'); return `${crumbs(['Buyurtma'])}<div class="page-heading"><h1>Davom etish uchun kiring</h1><p>Kirish yoki ro‘yxatdan o‘tishdan so‘ng savatingiz va buyurtma sahifasiga qaytasiz.</p></div>${renderAuth(defaultAuthMode(),true)}`; }
  if(!state.shippingMeta) state.shippingMeta = await api('/shipping/meta').catch(() => null);
  const branches = state.shippingMeta?.branches || [];
  const defaultPickup = branches.length > 0;
  const firstBranch = branches[0] || null;
  return `${crumbs(['Savat','/cart'],['Buyurtma'])}<div class="page-heading"><span class="eyebrow">Yakunlash</span><h1>Buyurtma ma’lumotlari</h1><p>Qabul qilish usulini va manzilni kiriting. ${state.config.shipping==='included'?'Yetkazish mahsulot narxiga kiritilgan.':'Yetkazish narxi va imkoniyati operator tomonidan alohida tasdiqlanadi.'}</p></div><div class="checkout-layout"><form class="form-card" data-form="checkout"><h2>Qabul qiluvchi va yetkazish</h2><div class="form-grid"><label class="field">Ism va familiya<input name="recipient" value="${esc(state.user.full_name)}" maxlength="120" required></label><label class="field">Telefon raqami<input name="phone" type="tel" data-phone-format="true" value="${esc(formatUzPhoneInput(state.user.verified_phone||state.user.phone||''))}" placeholder="+998 90 123 45 67" required></label><fieldset class="payment-selector full"><legend>Qabul qilish usuli</legend><div class="payment-choice-grid delivery-choice-grid"><label class="payment-choice"><input type="radio" name="deliveryMode" value="uzpost_pickup" ${defaultPickup?'checked':''} ${branches.length?'':'disabled'}><span class="payment-choice-body"><span class="payment-choice-icon">${icon('store')}</span><span><strong>UzPost filialidan olib ketish</strong><small>Yaqin filialni avtomatik yoki qo‘lda tanlang.</small></span><span class="payment-choice-tick">✓</span></span></label><label class="payment-choice"><input type="radio" name="deliveryMode" value="courier" ${defaultPickup?'':'checked'}><span class="payment-choice-body"><span class="payment-choice-icon">${icon('truck')}</span><span><strong>Manzilga yetkazib berish</strong><small>Tarif va muddat operator bilan aniqlanadi.</small></span><span class="payment-choice-tick">✓</span></span></label></div></fieldset><div class="branch-picker-card field full" id="branch-picker-box" ${defaultPickup?'':'hidden'}><div class="branch-picker-actions"><strong>UzPost filialini tanlash</strong><button type="button" class="btn btn-outline" data-action="find-nearest-branch">Eng yaqin filialni avtomatik tanlash</button></div><div class="form-grid"><label class="field">Hudud bo‘yicha saralash<select id="checkout-branch-region"><option value="">Barcha hududlar</option>${state.config.regions.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join('')}</select></label><label class="field">UzPost filiali<select name="pickupBranchId" id="checkout-branch" ${defaultPickup?'required':''}><option value="">Filialni tanlang</option>${branchOptionsHtml(branches, firstBranch?.id || '')}</select></label></div><div class="branch-details" id="branch-details-box">${branchDetailsHtml(firstBranch)}</div></div><div class="form-grid field full" id="courier-address-fields" ${defaultPickup?'hidden':''}><label class="field">Viloyat / shahar<select name="region" id="checkout-region" ${defaultPickup?'':'required'}><option value="">Hududni tanlang</option>${state.config.regions.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join('')}</select></label><label class="field">Tuman / shahar<input name="district" list="checkout-districts" placeholder="Masalan, Kasbi tumani" ${defaultPickup?'':'required'} maxlength="100"><datalist id="checkout-districts"></datalist></label><label class="field full">To‘liq manzil<input name="address" placeholder="Ko‘cha, uy, xonadon va mo‘ljal" ${defaultPickup?'':'required'} maxlength="300"></label></div><label class="field">Promokod (ixtiyoriy)<span class="asset-field"><input name="promoCode" placeholder="Masalan, YANGI10" maxlength="32"><button type="button" class="small-btn" data-action="check-promo">Tekshirish</button></span><small id="promo-status"></small></label><label class="field full">Izoh (ixtiyoriy)<textarea name="note" maxlength="500" placeholder="Yetkazuvchi uchun qo‘shimcha ma’lumot"></textarea></label>${paymentChoices(products)}<div class="hint-box full" id="shipping-quote-box">${icon('truck')} ${state.config.shipping==='included'?'Yetkazish mahsulot narxiga kiritilgan.':defaultPickup?'UzPost filialidan olib ketish tanlandi; jo‘natma operator tasdig‘idan so‘ng yuboriladi.':'Yetkazish xizmati va narxi manzil tasdiqlangach belgilanadi.'}${products.some(p=>p.stock_mode==='replenishable')?' Buyurtma asosidagi mahsulotlar mavjudligi operator bilan tasdiqlanadi.':''}</div><div class="field full"><label class="checkbox-row"><input type="checkbox" required name="agree"> Buyurtma shartlari, <a href="/terms" data-link>foydalanish shartlari</a> va <a href="/privacy" data-link>maxfiylik siyosati</a> bilan tanishganimni tasdiqlayman.</label></div><button class="btn btn-primary full" type="submit">Buyurtmani yuborish</button></div></form>${summary(products,true)}</div>`;
}
async function renderPayment(id) {
  updateTitle('To‘lov');
  if(!state.user){setAuthNext('/pay/'+id);return `${crumbs(['To‘lov'])}${renderAuth(defaultAuthMode(),true)}`;}
  const p=await api('/orders/'+encodeURIComponent(id)+'/payment');
  state.payment=p;
  const paid=p.paymentStatus==='paid',pending=p.status==='awaiting_payment'&&!!p.paymentUrl;
  const isSandboxOpen=pending&&state.config?.clickSandbox&&p.paymentUrl?.startsWith('/api/payments/click/sandbox-pay')&&new URLSearchParams(location.search).get('sandbox')==='1';
  if(isSandboxOpen){
    return `${crumbs(['Buyurtmalar','/account?tab=orders'],['To‘lov','/pay/'+p.id],['Click Sandbox'])}<div class="page-heading"><span class="eyebrow">Sinov to‘lov oynasi</span><h1>Click karta orqali to‘lov</h1><p>Buyurtma #${esc(p.id.slice(0,8).toUpperCase())} · ${money(p.total)}</p></div><section class="payment-page"><div class="payment-panel"><div class="payment-emblem">${icon('shield')}</div><span class="eyebrow">CLICK SANDBOX · SINOV OYNASI</span><h2>${money(p.total)}</h2><p>Bu sinov muhiti uchun bir martalik karta to‘lov oynasi simulyatsiyasi. Haqiqiy pul yechilmaydi; tasdiqlash buyurtmani bazada to‘langan holatga o‘tkazadi.</p><form data-form="click-sandbox" data-id="${esc(p.id)}" class="form-grid"><label class="field full">Sinov karta raqami (Uzcard / Humo)<input name="testCard" value="8600 0000 0000 0001" maxlength="19" required></label><label class="field">Amal muddati<input name="testExpiry" value="12/28" maxlength="5" required></label><label class="field">To‘lov turi<input value="Bir martalik xarid" disabled></label><button class="btn btn-primary full" type="submit">To‘lovni tasdiqlash →</button><button class="btn btn-outline full" type="button" data-action="click-sandbox-cancel" data-id="${esc(p.id)}">Bekor qilish</button></form></div><aside class="payment-assurance"><span class="payment-assurance-art">✳</span><h3>Karta ma’lumotlari Marketuzga saqlanmaydi</h3><p>Haqiqiy muhitda karta faqat Click to‘lov shlyuziga kiritiladi. Hozir Click API ulanishi kutilayotgani sababli sinov oynasi yoqilgan.</p><div><span>${icon('shield')} Click Sandbox</span><span>${icon('check')} Bir martalik xarid</span><span>${icon('lock')} Production’da o‘chirilgan</span></div></aside></section>`;
  }
  const sandboxNotice=pending&&state.config?.clickSandbox&&p.paymentUrl?.startsWith('/api/payments/click/sandbox-pay')?'<p class="summary-note">Sinov muhiti: Click bir martalik karta to‘lov oynasi simulyatori faol (haqiqiy karta yechilmaydi).</p>':'';
  return `${crumbs(['Buyurtmalar','/account?tab=orders'],['To‘lov'])}<div class="page-heading"><span class="eyebrow">Xavfsiz xarid</span><h1>${paid?'To‘lov tasdiqlandi':pending?'Buyurtma to‘lovi':'Buyurtma holati'}</h1><p>Buyurtma #${esc(p.id.slice(0,8).toUpperCase())}</p></div><section class="payment-page"><div class="payment-panel"><div class="payment-emblem">${icon(paid?'check':'shield')}</div><span class="eyebrow">${p.method==='click'?'CLICK TO‘LOVI':p.method==='payme'?'PAYME TO‘LOVI':'BUYURTMA'}</span><h2>${paid?'Xaridingiz qabul qilindi':pending?money(p.total):p.status==='cancelled'?'Buyurtma bekor qilingan':'Buyurtma qabul qilingan'}</h2><p>${paid?'To‘lov serverga kelgan tasdiq orqali tekshirildi. Buyurtmangiz tayyorlashga yuborildi.':pending?'Kartangizni Click yoki Payme tomonidan ochilgan to‘lov oynasiga kiriting. Ularning ilovasi bo‘lishi shart emas.':'Holatni buyurtmalar sahifasida kuzatishingiz mumkin.'}</p>${pending?`<div class="payment-actions">${p.clickWidget?`<button class="btn btn-primary" data-action="pay-inline" data-id="${esc(p.id)}">${icon('lock')} Shu yerda karta bilan to‘lash</button>`:`<button class="btn btn-primary" data-action="pay-external" data-id="${esc(p.id)}">${icon('lock')} Himoyalangan to‘lov oynasini ochish</button>`}${p.clickWidget?`<button class="btn btn-outline" data-action="pay-external" data-id="${esc(p.id)}">Click sahifasida ochish ↗</button>`:''}<button class="small-btn" data-action="payment-refresh" data-id="${esc(p.id)}">To‘lov holatini tekshirish</button></div>${sandboxNotice}<p class="payment-wait" id="payment-wait" aria-live="polite">To‘lov tasdig‘i kutilmoqda. Oynani yopib qaytsangiz ham holat shu yerda yangilanadi.</p>`:`<a href="/account?tab=orders" data-link class="btn btn-primary">Buyurtmalarimga o‘tish</a>`}</div><aside class="payment-assurance"><span class="payment-assurance-art">✳</span><h3>Karta ma’lumotlari bizga kelmaydi</h3><p>Karta raqami, amal qilish muddati va CVV Marketuz formasi, serveri yoki bazasidan o‘tmaydi. Faqat buyurtma raqami, summa va to‘lovning tasdiqlangan holati saqlanadi.</p><div><span>${icon('shield')} Provayder oynasi</span><span>${icon('check')} Bir martalik xarid</span><span>${icon('lock')} Imzolangan tasdiq</span></div></aside></section>`;
}
function renderAuth(mode='login',embedded=false) {
  const register=mode==='register'||mode==='phone-register';
  const reset=mode==='phone-reset';
  const phone=mode.startsWith('phone-');
  const title=reset?'Parolni tiklash':register?'Ro‘yxatdan o‘tish':'Kirish';
  updateTitle(title);
  const heading=reset?'Parolni tiklash':register?'Hisob ochish':'Hisobga kirish';
  const sub=reset?'Tasdiqlangan telefon raqamingizga 6 xonali SMS kod yuboriladi.':register?'Xaridlaringizni qulay boshqarish uchun hisob yarating.':'Davom etish uchun ma’lumotlaringizni kiriting.';
  const formKind=reset?'phone-reset':phone?(register?'phone-register':'phone-login'):(register?'register':'login');
  return `${embedded?'':crumbs([title])}<div class="auth-shell"><div class="auth-art"><div><span class="eyebrow eyebrow-light">Marketuz oilasi</span><h2>Yangi topilmalar shu yerdan boshlanadi.</h2><p>Sevimli mahsulotlaringiz, buyurtmalar va sotuvchi markazi bitta joyda.</p></div></div><form class="auth-form" data-form="${formKind}"><span class="eyebrow">Xush kelibsiz</span><h1>${heading}</h1><p>${sub}</p>${register?'<label class="field">Ism va familiya<input name="name" autocomplete="name" required minlength="2" maxlength="100" placeholder="Ismingiz"></label>':''}${phone?`<label class="field">Telefon raqami<input type="tel" name="phone" data-phone-format="true" autocomplete="tel" inputmode="tel" required maxlength="25" placeholder="+998 90 123 45 67"></label>${(register||reset)?`<div class="sms-action-row"><button class="btn btn-outline" type="button" data-action="send-sms" data-purpose="${reset?'reset':'register'}">SMS kod olish</button></div><p class="sms-status" aria-live="polite" data-sms-status></p><div class="dev-sms-box" data-dev-sms-box hidden></div><label class="field">SMS tasdiqlash kodi<input name="code" data-otp-input="true" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required placeholder="6 xonali kod"></label>`:''}`:'<label class="field">Email manzil<input type="email" name="email" autocomplete="email" required maxlength="200" placeholder="name@example.com"></label>'}${passwordField(reset?'newPassword':'password',reset?'Yangi parol':'Parol',{autocomplete:(register||reset)?'new-password':'current-password',minlength:(register||reset)?10:1,placeholder:(register||reset)?'Kamida 10 ta belgi':'Parolingiz',strength:register||reset})}${mode==='login'?'<div id="admin-2fa-box" class="auth-2fa-box" hidden><p class="summary-note">Administrator hisobi uchun autentifikator ilovasidagi 6 xonali kodni kiriting.</p><label class="field">2FA tasdiqlash kodi<input name="totpCode" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" placeholder="6 xonali TOTP kod"></label><input type="hidden" name="challengeToken" value=""></div>':''}${register?'<label class="checkbox-row"><input name="agree" type="checkbox" required> <span><a href="/terms" data-link>Foydalanish shartlari</a> va <a href="/privacy" data-link>maxfiylik siyosati</a> bilan tanishdim.</span></label>':''}<button class="btn btn-primary" type="submit">${reset?'Parolni yangilash':register?'Ro‘yxatdan o‘tish':'Kirish'}</button><div class="auth-links-row">${mode==='phone-login'&&state.config.smsEnabled?'<button type="button" data-action="auth-mode" data-mode="phone-reset">Parolni unutdingizmi?</button>':''}<button type="button" data-action="auth-mode" data-mode="${reset?'phone-login':phone?(register?'phone-login':'phone-register'):(register?'login':'register')}">${reset?'Kirishga qaytish':register?'Hisobingiz bormi? Kirish':'Ro‘yxatdan o‘tish'}</button></div><div class="auth-switch"><button type="button" data-action="auth-mode" data-mode="${phone?(register?'register':'login'):'phone-login'}">${phone?'Email orqali kirish (eski hisob / admin)':'Telefon raqami orqali kirish'}</button>${!phone&&state.config.smsEnabled?'<button type="button" data-action="auth-mode" data-mode="phone-register">Telefon bilan hisob ochish</button>':''}</div>${phone&&(register||reset)&&!state.config.smsEnabled?'<p class="summary-note">SMS xizmati hozircha faol emas. Email orqali kirishingiz yoki hisob ochishingiz mumkin.</p>':''}</form></div>`;
}
async function renderFavorites() {
  updateTitle('Sevimlilar'); let products=[];
  if(state.user) products=(await api('/favorites')).products; else products=(await Promise.all([...state.favorites].map(async id=>{try {return state.products.get(id)||(await api('/products/'+id)).product;}catch{return null;}}))).filter(Boolean);
  return `${crumbs(['Sevimlilar'])}<div class="page-heading"><span class="eyebrow">Sizning tanlovingiz</span><h1>Sevimlilar</h1><p>Yoqqan mahsulotlarni shu yerda saqlab boring.</p></div>${products.length?`<div class="products-grid">${products.map(productCard).join('')}</div>`:empty('Sevimlilar hozircha bo‘sh','Mahsulot kartasidagi yurakchani bosing, ular shu yerda paydo bo‘ladi.','Katalogni ko‘rish','/catalog','heart')}`;
}
const profileAvatar=(url,name)=>safeImage(url)?img(url,name,'class="profile-avatar"'):`<span class="profile-avatar profile-initial">${esc((name||'M')[0].toUpperCase())}</span>`;
async function renderAccount() {
  const modeParam=new URLSearchParams(location.search).get('mode');
  if(!state.user)return renderAuth((['register','phone-register','phone-login','phone-reset'].includes(modeParam)?modeParam:(state.config.smsEnabled?'phone-login':'login')));
  updateTitle('Profil');const tab=new URLSearchParams(location.search).get('tab')||'profile',u=state.user;
  let content='';
  if(tab==='orders') {const {orders}=await api('/orders');content=orders.length?orders.map(o=>`<article class="order-card"><div class="order-head"><div><strong>Buyurtma #${esc(o.id.slice(0,8).toUpperCase())}</strong><small>${dateText(o.created_at)} · ${esc(o.region)}, ${esc(o.district)}</small></div><span class="status ${esc(o.status)}">${esc(labelStatus[o.status]||o.status)}</span></div><div class="order-items">${o.items.map(i=>img(i.image_url,i.title,`title="${esc(i.title)}"`)).join('')}</div><div class="profile-row"><span>Mahsulotlar jami</span><strong>${money(o.subtotal)}</strong></div>${o.discount_amount>0?`<div class="profile-row"><span>Chegirma (${esc(o.promo_code||'')})</span><strong>−${money(o.discount_amount)}</strong></div>`:''}${o.delivery_mode==='uzpost_pickup'&&o.pickup_branch_label?`<p class="summary-note">UzPost olib ketish filiali: <strong>${esc(o.pickup_branch_label)}</strong></p>`:''}${o.tracking_number?`<p class="summary-note">Kuzatuv raqami: <strong>${esc(o.tracking_number)}</strong></p>`:''}${o.shipment_events?.length?`<ol class="shipment-timeline">${o.shipment_events.map(e=>`<li><strong>${esc(labelStatus[e.status]||e.status)}</strong><small>${dateText(e.occurred_at)} · ${e.source==='uzpost'?'UzPost':'Marketuz'}</small></li>`).join('')}</ol>`:''}${o.return_status?`<p class="summary-note">Qaytarish arizasi holati: <strong>${esc(labelStatus[o.return_status]||o.return_status)}</strong> ${o.return_note?'— '+esc(o.return_note):''}</p>`:''}<p class="summary-note">Yetkazish narxi: ${state.config.shipping==='included'?'mahsulot narxiga kiritilgan':'operator tomonidan aniqlanadi'}.</p>${o.status==='awaiting_payment'?`<button data-action="resume-payment" data-id="${esc(o.id)}" class="small-btn">To‘lovni davom ettirish</button>`:''}${o.payment_status!=='paid'&&['awaiting_payment','new','accepted','packing'].includes(o.status)?`<button data-action="cancel-order" data-id="${esc(o.id)}" class="small-btn reject">Buyurtmani bekor qilish</button>`:''}${o.status==='delivered'&&!o.return_status?`<button data-action="request-return" data-id="${esc(o.id)}" class="small-btn">Qaytarish arizasi</button>`:''}</article>`).join(''):empty('Buyurtmalar yo‘q','Birinchi topilmangiz sizni kutmoqda.','Katalogga o‘tish','/catalog','box');}
  else if(tab==='notifications'){const {notifications,unread}=await api('/notifications');content=`<div class="profile-card"><div class="dashboard-heading"><h2>Bildirishnomalar ${unread?`(${unread})`:''}</h2>${unread?'<button type="button" class="small-btn" data-action="mark-notifications-read">Hammasini o‘qilgan deb belgilash</button>':''}</div>${notifications.length?`<div class="session-list">${notifications.map(n=>`<div class="session-item"><div><strong>${esc(n.title)} ${n.is_read?'':'<span class="status new">Yangi</span>'}</strong><p>${esc(n.body)}</p><small>${dateText(n.created_at)}</small></div>${n.href?`<a href="${esc(n.href)}" data-link class="small-btn">Ko‘rish</a>`:''}</div>`).join('')}</div>`:empty('Bildirishnomalar yo‘q','Buyurtma va hisob yangiliklari shu yerda ko‘rinadi.','Katalogga o‘tish','/catalog','bell')}</div>`;}
  else if(tab==='security'){
    const {sessions}=await api('/me/sessions');
    const phoneSection=u.role==='admin'?'':`<div class="profile-card"><h2>Tasdiqlangan telefon raqami</h2>${u.verified_phone?`<p class="summary-note">Kirish uchun bog‘langan raqam: <strong>${esc(formatUzPhoneInput(u.verified_phone))}</strong></p>${state.config.smsEnabled?`<form data-form="me-phone" data-purpose="change_phone" class="form-grid"><label class="field">Yangi telefon raqami<input name="phone" type="tel" data-phone-format="true" placeholder="+998 90 123 45 67" required></label>${passwordField('currentPassword','Joriy parol',{required:!u.telegram_id})}<div class="field full sms-action-row"><button type="button" class="btn btn-outline" data-action="send-me-sms" data-purpose="change_phone">Yangi raqamga SMS kod olish</button></div><p class="sms-status field full" aria-live="polite" data-sms-status></p><div class="dev-sms-box field full" data-dev-sms-box hidden></div><label class="field full">SMS tasdiqlash kodi<input name="code" data-otp-input="true" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required placeholder="6 xonali kod"></label><button class="btn btn-primary full" type="submit">Telefon raqamini almashtirish</button></form>`:'<p class="summary-note">Raqamni almashtirish uchun SMS xizmati yoqilgan bo‘lishi kerak.</p>'}`:`<p class="summary-note">Hisobingizga hali tasdiqlangan telefon raqami bog‘lanmagan.</p>${state.config.smsEnabled?`<form data-form="me-phone" data-purpose="bind" class="form-grid"><label class="field full">Telefon raqami<input name="phone" type="tel" data-phone-format="true" placeholder="+998 90 123 45 67" required></label><div class="field full sms-action-row"><button type="button" class="btn btn-outline" data-action="send-me-sms" data-purpose="bind">SMS kod olish</button></div><p class="sms-status field full" aria-live="polite" data-sms-status></p><div class="dev-sms-box field full" data-dev-sms-box hidden></div><label class="field full">SMS tasdiqlash kodi<input name="code" data-otp-input="true" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required placeholder="6 xonali kod"></label><button class="btn btn-primary full" type="submit">Telefon raqamini bog‘lash</button></form>`:'<p class="summary-note">SMS xizmati hozircha faol emas.</p>'}`}</div>`;
    const admin2faSection=u.role!=='admin'?'':`<div class="profile-card"><h2>Administrator 2FA himoyasi (TOTP)</h2><p class="summary-note">Holati: <strong>${u.totp_enabled?'Yoqilgan ✓':'O‘chirilgan'}</strong>. Autentifikator ilovasi orqali qo‘shimcha himoya.</p>${u.totp_enabled?`<form data-form="admin-2fa-disable" class="form-grid">${passwordField('currentPassword','Joriy parol')}<label class="field">Autentifikator kodi<input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required placeholder="6 xonali kod"></label><button class="btn btn-outline full" type="submit">2FA ni o‘chirish</button></form>`:`<button type="button" class="btn btn-outline" data-action="admin-2fa-setup">2FA sozlashni boshlash</button><div id="admin-2fa-setup-box" hidden><p class="summary-note">Quyidagi kalitni Google Authenticator yoki 1Password ilovasiga kiriting:</p><code id="admin-2fa-secret" class="totp-secret"></code><form data-form="admin-2fa-enable" class="form-grid">${passwordField('currentPassword','Joriy parol')}<label class="field">Tasdiqlash kodi<input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required placeholder="6 xonali kod"></label><button class="btn btn-primary full" type="submit">2FA ni faollashtirish</button></form></div>`}</div>`;
    const sessionsSection=`<div class="profile-card"><h2>Faol sessiyalar va qurilmalar</h2><p class="summary-note">Hisobingiz ochiq turgan qurilmalarni boshqaring.</p><div class="session-list">${sessions.map(s=>`<div class="session-item"><div><strong>${esc(s.device_label||'Qurilma')} ${s.current?'<span class="status active">Joriy</span>':''}</strong><small>IP: ${esc(s.ip||'—')} · Oxirgi faollik: ${dateText(s.last_active_at)}</small></div>${s.current?'':`<button type="button" class="small-btn reject" data-action="revoke-session" data-id="${esc(s.id)}">Chiqish</button>`}</div>`).join('')}</div><div class="session-actions"><button type="button" class="small-btn" data-action="refresh-session">Sessiyani yangilash</button><button type="button" class="small-btn" data-action="logout-others">Boshqa qurilmalardan chiqish</button><button type="button" class="small-btn reject" data-action="logout-all">Barcha qurilmalardan chiqish</button></div></div>`;
    const deleteSection=u.role==='admin'?'':`<div class="profile-card danger-card"><h2>Hisobni o‘chirish</h2><p class="summary-note">Hisob o‘chirilganda shaxsiy ma’lumotlaringiz tozalanadi va barcha sessiyalar yopiladi. Faol buyurtmalar tugamaguncha hisob o‘chirilmaydi.</p><form data-form="delete-account" class="form-grid">${u.telegram_id?'<label class="field full">Tasdiqlash uchun O‘CHIRISH so‘zini yozing<input name="confirm" required placeholder="O‘CHIRISH"></label>':passwordField('currentPassword','Tasdiqlash uchun joriy parolingiz',{full:true})}<button class="small-btn reject" type="submit">Hisobni butunlay o‘chirish</button></form></div>`;
    content=`<div class="security-stack">${phoneSection}<div class="profile-card"><h2>Parolni yangilash</h2><p class="summary-note">Parol o‘zgarganda boshqa qurilmalardagi barcha sessiyalar avtomatik yopiladi.</p><form data-form="password" class="form-grid">${passwordField('currentPassword','Joriy parol',{full:true})}${passwordField('newPassword','Yangi parol',{full:true,autocomplete:'new-password',minlength:10,placeholder:'Kamida 10 ta belgi',strength:true})}<button class="btn btn-primary" type="submit">Parolni saqlash</button></form></div>${admin2faSection}${sessionsSection}${deleteSection}</div>`;
  }
  else if(tab==='edit'){
    const internalAccount=u.email?.endsWith('@marketuz.invalid');
    const identityLabel=u.verified_phone?formatUzPhoneInput(u.verified_phone):(u.telegram_id?'Telegram orqali ulangan hisob':'Telefon orqali hisob');
    content=`<div class="profile-card"><h2>Profilni bezash</h2><p>Surat va foningizni qurilmadan yuklang yoki HTTPS havolasini kiriting. Xaridor profili faqat o‘zingizga ko‘rinadi; sotuvchi do‘koni ommaga ochiq.</p><form data-form="profile" class="form-grid"><label class="field">Ism va familiya<input name="name" value="${esc(u.full_name)}" required maxlength="100"></label><label class="field">Aloqa telefoni<input name="phone" type="tel" data-phone-format="true" value="${esc(formatUzPhoneInput(u.phone||'')||u.phone||'')}" placeholder="+998 90 123 45 67"></label><label class="field full">Bio<textarea name="bio" maxlength="300" placeholder="Do‘koningiz yoki didingiz haqida...">${esc(u.bio||'')}</textarea></label><label class="field full">Avatar<span class="asset-field"><input name="avatarUrl" data-setting="profile.avatarUrl" value="${esc(u.avatar_url||'')}" placeholder="https://... yoki rasm yuklang"><button type="button" data-action="upload-asset" data-target="profile.avatarUrl">Rasm yuklash</button><img src="${safeImage(u.avatar_url)}" alt="Avatar" ${u.avatar_url?'':'hidden'}></span></label><label class="field full">Profil fon rasmi<span class="asset-field"><input name="coverUrl" data-setting="profile.coverUrl" value="${esc(u.cover_url||'')}" placeholder="https://... yoki rasm yuklang"><button type="button" data-action="upload-asset" data-target="profile.coverUrl">Rasm yuklash</button><img src="${safeImage(u.cover_url)}" alt="Fon" ${u.cover_url?'':'hidden'}></span></label><label class="field full">${internalAccount?'Kirish hisobi':'Email'}<input value="${esc(internalAccount?identityLabel:u.email)}" disabled></label><button class="btn btn-primary" type="submit">Profilni saqlash</button></form></div>`;
  }
  else if(tab==='preferences')content=`<div class="profile-card"><span class="eyebrow">O‘zingiz tanlaysiz</span><h2>Shaxsiy tavsiyalar</h2><p>Yoqilganda qidirgan so‘zlaringiz, ko‘rgan mahsulotlaringiz, sahifada qolgan vaqtingiz va savatga qo‘shishlar 90 kungacha tavsiyalar uchun saqlanadi. O‘chirilganda yig‘ilgan faoliyat tarixi o‘chadi. Sevimlilar va buyurtmalar o‘zgarmaydi.</p><div class="preference-switch"><div><strong>Qiziqishimga mos tanlovlar</strong><small>${u.personalization_enabled?'Yoqilgan · sizga mos mahsulotlar tanlanadi':'O‘chirilgan · umumiy ommabop tanlovlar ko‘rinadi'}</small></div><button class="btn ${u.personalization_enabled?'btn-outline':'btn-primary'}" data-action="personalization" data-enabled="${u.personalization_enabled?'false':'true'}">${u.personalization_enabled?'O‘chirish':'Yoqish'}</button></div><button class="small-btn reject" data-action="clear-activity">Tavsiya tarixini tozalash</button><p class="summary-note">Faoliyat tarixi faqat sizga tavsiya tuzish uchun ishlatiladi. <a href="/privacy" data-link>Maxfiylik siyosati</a></p></div>`;
  else if(tab==='following'){const {sellers}=await api('/me/follows');content=`<section class="profile-card"><h2>Kuzatayotgan do‘konlar</h2>${sellers.length?`<div class="follow-list">${sellers.map(x=>`<a href="/shop/${x.id}" data-link class="follow-item">${profileAvatar(x.avatar_url,x.full_name)}<span><strong>${esc(x.full_name)}</strong><small>${x.product_count} ta mahsulot · ${esc(x.bio||'Marketuz sotuvchisi')}</small></span><span>→</span></a>`).join('')}</div>`:empty('Hozircha kuzatayotgan do‘kon yo‘q','Mahsulot sahifasidan sotuvchi do‘koniga o‘ting.','Katalogga o‘tish','/catalog','store')}</section>`;}
  else if(tab==='saved'){const {products}=await api('/favorites');content=`<section class="section">${sectionHead('Saqlanganlar','Sevimli topilmalaringiz')} ${products.length?`<div class="products-grid">${products.map(productCard).join('')}</div>`:empty('Hozircha saqlanmagan','Mahsulot kartasidagi yurakchani bosing.','Katalogga o‘tish','/catalog','heart')}</section>`;}
  else {const {products,personalized}=await api('/recommendations?kind=for-you&limit=8');content=`<div class="profile-welcome"><span>✦ DIDINGIZGA MOS OQIM</span><h2>Yangi ilhom, har safar.</h2><p>${personalized?'Qiziqish va saqlangan mahsulotlar asosida yangilanadi.':'Ommabop tanlovlardan boshlang. Xohlasangiz shaxsiy tavsiyalarni yoqing.'}</p><a href="/discover" data-link class="btn btn-primary">Kashfiyotga o‘tish</a></div><section class="section">${sectionHead('Siz uchun','Tavsiya etilgan mahsulotlar','','/discover','Barchasini ko‘rish')}<div class="products-grid">${products.map(productCard).join('')}</div></section>`;}
  const tabs=[['profile','Oqim','sparkle'],['saved','Saqlanganlar','heart'],['following','Kuzatishlar','store'],['orders','Buyurtmalar','box'],['notifications','Bildirishnomalar','bell'],['edit','Profilni tahrirlash','user'],['preferences','Tavsiyalar','sliders'],['security','Xavfsizlik','lock']];
  return `${crumbs(['Profil'])}<section class="social-profile"><div class="social-cover">${safeImage(u.cover_url)?img(u.cover_url,'','class="social-cover-image" aria-hidden="true"'):''}<span>MARKETUZ · MENING MAKONIM</span></div><div class="social-identity">${profileAvatar(u.avatar_url,u.full_name)}<div><span class="eyebrow">${u.role==='admin'?'ADMINISTRATOR':u.role==='seller'?'SOTUVCHI':'XARIDOR'} · #${esc(u.id)}</span><h1>${esc(u.full_name)}</h1><p>${esc(u.bio||'Har kun yangi topilmalar bilan.')}</p></div><a href="/account?tab=edit" data-link class="btn btn-outline">Profilni bezash</a></div><nav class="social-tabs" aria-label="Profil bo‘limlari">${tabs.map(([key,label,glyph])=>`<a href="/account?tab=${key}" data-link class="${tab===key?'active':''}">${icon(glyph)} ${label}</a>`).join('')}</nav></section><div class="social-content">${content}</div><div class="profile-quicklinks">${u.role==='seller'?`<a href="/shop/${u.id}" data-link>Ommaviy do‘konim ↗</a>`:''}<a href="/seller" data-link>Sotuvchi markazi</a>${u.role==='admin'?`<a href="/admin" data-link>Admin panel</a>`:''}<button data-action="logout">Hisobdan chiqish</button></div>`;
}
async function renderShop(id) {
  updateTitle('Sotuvchi do‘koni');const data=await api('/shops/'+encodeURIComponent(id));const s=data.seller;
  state.shop={id,cursor:data.nextCursor,loading:false};
  return `${crumbs(['Do‘konlar','/discover'],[s.full_name])}<section class="social-profile shop-profile"><div class="social-cover">${safeImage(s.cover_url)?img(s.cover_url,'','class="social-cover-image" aria-hidden="true"'):''}<span>MARKETUZ · SOTUVCHI DO‘KONI</span></div><div class="social-identity">${profileAvatar(s.avatar_url,s.full_name)}<div><span class="eyebrow">TANLANGAN SOTUVCHI</span><h1>${esc(s.full_name)}</h1><p>${esc(s.bio||'Siz uchun tanlangan topilmalar.')}</p><small>${s.product_count} ta mahsulot · ${s.followers} kuzatuvchi</small></div>${state.user&&String(state.user.id)!==String(s.id)?`<button class="btn ${data.following?'btn-outline':'btn-primary'}" data-action="follow-shop" data-id="${s.id}" data-following="${data.following}">${data.following?'Kuzatilmoqda ✓':'Kuzatish +'}</button>`:''}</div></section><section class="section">${sectionHead('Kolleksiya','Do‘kon mahsulotlari')}<div class="products-grid" id="shop-grid">${data.products.map(productCard).join('')}</div><div class="feed-sentinel" id="shop-more" ${data.nextCursor?'':'hidden'}><button data-action="shop-more" class="btn btn-outline">Yana mahsulotlar</button></div></section>`;
}
const sellerIntro = `<div class="delivery-hero seller-hero"><span class="eyebrow eyebrow-light">Sotuvchilar uchun</span><h1>Mahsulotlaringizni ko‘proq odamlar bilan tanishtiring.</h1><p>O‘z do‘koningizni boshqaring: mahsulotlarni joylang, buyurtmalarni kuzating va o‘sish uchun yangi qadam tashlang.</p></div><div class="steps"><div class="step"><span class="benefit-icon">${icon('user')}</span><strong>Ariza yuboring</strong><p>Hisobingizdan sotuvchi bo‘lish uchun so‘rov qoldiring.</p></div><div class="step"><span class="benefit-icon">${icon('store')}</span><strong>Mahsulot qo‘shing</strong><p>Admin tasdiqlagach o‘z katalogingizni to‘ldiring.</p></div><div class="step"><span class="benefit-icon">${icon('box')}</span><strong>Buyurtmalarni boshqaring</strong><p>Buyurtma satrlarini tayyorlash holatiga o‘tkazing.</p></div></div>`;
async function renderSeller() {
  updateTitle('Sotuvchi markazi');
  if(!state.user) return `${sellerIntro}${empty('Sotuvchi bo‘lishga tayyormisiz?','Ariza topshirish uchun avval hisobga kiring.','Hisobga kirish','/account','store')}`;
  state.user=(await api('/me')).user;
  if(state.user.role==='admin') return `${sellerIntro}${empty('Administrator hisobidasiz','Sotuvchi arizalarini administrator panelida boshqaring.','Admin panelga o‘tish','/admin','sliders')}`;
  if(state.user.role !== 'seller') return `${sellerIntro}<div class="form-card seller-apply"><h2>${state.user.seller_status==='pending'?'So‘rovingiz ko‘rib chiqilmoqda':'Sotuvchi bo‘lish uchun ariza'}</h2><p class="summary-note">${state.user.seller_status==='pending'?'Administrator arizangizni tekshiradi. Tasdiqlangach bu bo‘limda boshqaruv paneli ochiladi.':'Sotuvchi arizasi administratorga yuboriladi. Mahsulotlar katalogga chiqishidan oldin tekshiriladi.'}</p>${state.user.seller_status==='pending'?'':`<button class="btn btn-primary" data-action="seller-request">Ariza yuborish</button>`}</div>`;
  const tab=new URLSearchParams(location.search).get('tab')||'products';
  const [p,o,analytics]=await Promise.all([api('/seller/products'),api('/seller/orders'),api('/seller/analytics')]); state.sellerProducts=p.products; state.sellerCursor=p.nextCursor; state.sellerOrders=o.items;
  const st=analytics.stats;
  const finance=`<div class="stat-grid"><div class="stat-card"><span>Jami buyurtmalar</span><strong>${st.total_orders}</strong></div><div class="stat-card"><span>Umumiy savdo</span><strong>${money(st.gross_revenue)}</strong></div><div class="stat-card"><span>Platforma komissiyasi (${Math.round(st.commission_rate*100)}%)</span><strong>${money(st.commission_amount)}</strong></div><div class="stat-card"><span>Sof daromad · Baho</span><strong>${money(st.net_revenue)} · ${Number(st.avg_rating||0).toFixed(1)}★</strong></div></div><div class="dashboard-card"><h2>Qaytarish arizalari</h2>${analytics.returns.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Buyurtma</th><th>Summa</th><th>Sabab</th><th>Holat</th></tr></thead><tbody>${analytics.returns.map(r=>`<tr><td>#${esc(r.order_id.slice(0,8).toUpperCase())}</td><td>${money(r.subtotal)}</td><td>${esc(r.reason)}</td><td><span class="status ${esc(r.status)}">${esc(labelStatus[r.status]||r.status)}</span></td></tr>`).join('')}</tbody></table></div>`:'<p class="summary-note">Hozircha qaytarish arizalari yo‘q.</p>'}</div>`;
  const products=`<div class="dashboard-heading"><h1>Mahsulotlarim</h1><div class="hero-buttons"><a class="btn btn-outline" href="/seller/products/import" data-link>Excel orqali qo‘shish</a><a class="btn btn-primary" href="/seller/product/new" data-link>+ Yangi mahsulot</a></div></div><div class="dashboard-card"><h2>Mahsulotlar · ${p.products.length} ta ko‘rsatilmoqda</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Mahsulot</th><th>Narxi</th><th>Qoldiq</th><th>Holati</th><th>Amallar</th></tr></thead><tbody id="seller-products-body">${p.products.length?p.products.map(x=>`<tr><td>${img(x.image_url,x.name)}<strong>${esc(x.name)}</strong></td><td>${money(x.price)}${x.old_price>x.price?`<br><small><s>${money(x.old_price)}</s></small>`:''}</td><td>${x.stock_mode==='replenishable'?'Buyurtma asosida':x.stock+' dona'}</td><td><span class="status ${esc(x.status)}">${esc(labelStatus[x.status]||x.status)}</span></td><td><a class="small-btn" href="/seller/product/${x.id}/edit" data-link>Tahrirlash</a>${x.status!=='archived'?`<button class="small-btn reject" data-action="seller-archive" data-id="${x.id}">Arxivlash</button>`:''}</td></tr>`).join(''):'<tr><td colspan="5">Hozircha mahsulot yo‘q.</td></tr>'}</tbody></table></div><button class="btn btn-outline admin-more" data-action="seller-more" ${p.nextCursor?'':'hidden'}>Yana mahsulotlar</button></div>`;
  const orders=`<div class="dashboard-heading"><h1>Buyurtma satrlari</h1></div><div class="dashboard-card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Mahsulot</th><th>Qabul qiluvchi</th><th>Hudud</th><th>Buyurtma</th><th>Tayyorlash</th></tr></thead><tbody>${o.items.length?o.items.map(x=>`<tr><td>${img(x.image_url,x.title)}<strong>${esc(x.title)}</strong><br>${x.quantity} dona · ${money(x.price*x.quantity)}</td><td>${esc(x.recipient)}<br>${esc(x.phone)}</td><td>${esc(x.region)}, ${esc(x.district)}</td><td><span class="status ${esc(x.order_status)}">${esc(labelStatus[x.order_status]||x.order_status)}</span></td><td><span class="status ${esc(x.fulfillment_status)}">${esc(labelStatus[x.fulfillment_status]||x.fulfillment_status)}</span>${!['awaiting_payment','cancelled','delivered'].includes(x.order_status)?`<br><button class="small-btn" data-action="seller-item-status" data-id="${x.id}" data-status="${x.fulfillment_status==='new'?'packing':'ready'}">${x.fulfillment_status==='new'?'Tayyorlanmoqda':x.fulfillment_status==='packing'?'Tayyor':'Tayyor'}</button>`:''}</td></tr>`).join(''):'<tr><td colspan="5">Hozircha buyurtmalar yo‘q.</td></tr>'}</tbody></table></div></div>`;
  let sellerNotifs='';
  if(tab==='notifications'){const {notifications,unread}=await api('/notifications');sellerNotifs=`<div class="dashboard-card"><div class="dashboard-heading"><h2>Sotuvchi bildirishnomalari ${unread?`(${unread})`:''}</h2>${unread?'<button type="button" class="small-btn" data-action="mark-notifications-read">Hammasini o‘qilgan deb belgilash</button>':''}</div>${notifications.length?`<div class="session-list">${notifications.map(n=>`<div class="session-item"><div><strong>${esc(n.title)} ${n.is_read?'':'<span class="status new">Yangi</span>'}</strong><p>${esc(n.body)}</p><small>${dateText(n.created_at)}</small></div>${n.href?`<a href="${esc(n.href)}" data-link class="small-btn">Ko‘rish</a>`:''}</div>`).join('')}</div>`:'<p class="summary-note">Hozircha bildirishnomalar yo‘q.</p>'}</div>`;}
  const sellerDesign=`<div class="dashboard-card"><h2>Do‘kon dizayni va vitrina</h2><p class="summary-note">Do‘koningizning muqova rasmi, logotip/avatari va tavsifini tahrirlab xaridorlarga chiroyli ko‘rinishda taqdim eting.</p><div class="hero-buttons"><a href="/account?tab=edit" data-link class="btn btn-primary">Do‘kon dizaynini tahrirlash</a><a href="/shop/${esc(state.user.id)}" data-link class="btn btn-outline">Ommaviy do‘konni ko‘rish ↗</a></div></div>`;
  return `${crumbs(['Sotuvchi markazi'])}<div class="page-heading"><span class="eyebrow">Mening do‘konim</span><h1>Sotuvchi markazi</h1><p>Mahsulotlar, buyurtmalar, dizayn va moliyaviy hisobot bitta panelda.</p></div><div class="dashboard-shell"><nav class="dashboard-nav"><button data-action="seller-tab" data-tab="products" class="${tab==='products'?'active':''}">${icon('grid')} Mahsulotlar</button><button data-action="seller-tab" data-tab="orders" class="${tab==='orders'?'active':''}">${icon('box')} Buyurtmalar</button><button data-action="seller-tab" data-tab="finance" class="${tab==='finance'?'active':''}">${icon('sliders')} Moliya va statistika</button><button data-action="seller-tab" data-tab="notifications" class="${tab==='notifications'?'active':''}">${icon('bell')} Bildirishnomalar</button><button data-action="seller-tab" data-tab="design" class="${tab==='design'?'active':''}">${icon('store')} Do‘kon dizayni</button></nav><div class="dashboard-main">${tab==='orders'?orders:tab==='finance'?finance:tab==='notifications'?sellerNotifs:tab==='design'?sellerDesign:products}</div></div>`;
}
function adminOrderOptions(order) {
  const allowed={new:['accepted','cancelled'],accepted:['packing','cancelled'],packing:['handed_over','cancelled'],handed_over:['in_transit'],in_transit:['delivered'],delivered:[],cancelled:[],awaiting_payment:[]};
  const choices=[order.status,...(allowed[order.status]||[]).filter(x=>x!=='cancelled'||order.payment_status!=='paid')];
  return `<select name="status" aria-label="Buyurtma holati" ${order.status==='awaiting_payment'||order.status==='cancelled'?'disabled':''}>${choices.map(x=>`<option value="${esc(x)}">${esc(labelStatus[x]||x)}</option>`).join('')}</select>`;
}
async function renderAdmin() {
  updateTitle('Administrator');
  if(!state.user) return `${crumbs(['Administrator'])}<div class="page-heading"><h1>Administrator paneli</h1></div>${empty('Hisobga kiring','Bu bo‘lim faqat administrator uchun.','Kirish','/account','lock')}`;
  if(state.user.role!=='admin') return `${crumbs(['Administrator'])}<div class="page-heading"><h1>Administrator paneli</h1></div>${empty('Ruxsat yo‘q','Bu bo‘lim faqat administrator uchun.','Bosh sahifaga','/','lock')}`;
  const tab=new URLSearchParams(location.search).get('tab')||'overview';
  const [overview,sellers,products,orders,settings]=await Promise.all([api('/admin/overview'),api('/admin/sellers'),api('/admin/products'),api('/admin/orders'),api('/admin/settings')]);
  state.admin={ overview:overview.stats, sellers:sellers.sellers, products:products.products, productsCursor:products.nextCursor, orders:orders.orders, settings };
  const s=overview.stats;
  let extraView='';
  if(tab==='customers'){const {customers}=await api('/admin/customers');extraView=`<div class="dashboard-card"><h2>Foydalanuvchilar (${customers.length})</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Ism</th><th>Aloqa</th><th>Rol</th><th>Buyurtmalar</th><th>Oxirgi kirish</th></tr></thead><tbody>${customers.map(c=>`<tr><td><strong>${esc(c.full_name)}</strong></td><td>${esc(c.verified_phone||c.phone||c.email)}</td><td><span class="status">${esc(c.role)}</span></td><td>${c.order_count}</td><td>${c.last_login_at?dateText(c.last_login_at):'—'}</td></tr>`).join('')}</tbody></table></div></div>`;}
  else if(tab==='promos'){const {promos}=await api('/admin/promos');extraView=`<div class="dashboard-card"><h2>Yangi promokod</h2><form data-form="admin-promo" class="form-grid"><label class="field">Kod<input name="code" required maxlength="32" placeholder="YANGI10"></label><label class="field">Turi<select name="discountType"><option value="percent">Foiz (%)</option><option value="fixed">Aniq summa (so‘m)</option></select></label><label class="field">Qiymati<input name="discountValue" type="number" min="1" required></label><label class="field">Minimal buyurtma<input name="minOrder" type="number" min="0" value="0"></label><label class="field">Maksimal chegirma<input name="maxDiscount" type="number" min="0"></label><label class="field">Limit (soni)<input name="usageLimit" type="number" min="1"></label><button class="btn btn-primary full" type="submit">Promokod yaratish</button></form></div><div class="dashboard-card"><h2>Mavjud promokodlar</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Kod</th><th>Chegirma</th><th>Ishlatilgan</th><th>Holat</th><th>Amal</th></tr></thead><tbody>${promos.length?promos.map(p=>`<tr><td><strong>${esc(p.code)}</strong></td><td>${p.discount_type==='percent'?p.discount_value+'%':money(p.discount_value)}</td><td>${p.used_count}${p.usage_limit?' / '+p.usage_limit:''}</td><td><span class="status ${p.active?'active':'rejected'}">${p.active?'Faol':'O‘chirilgan'}</span></td><td><button class="small-btn" data-action="admin-promo-toggle" data-id="${p.id}" data-active="${!p.active}">${p.active?'O‘chirish':'Yoqish'}</button></td></tr>`).join(''):'<tr><td colspan="5">Promokodlar yo‘q.</td></tr>'}</tbody></table></div></div>`;}
  else if(tab==='returns'){const {returns}=await api('/admin/returns');extraView=`<div class="dashboard-card"><h2>Qaytarish arizalari</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Buyurtma</th><th>Xaridor</th><th>Summa</th><th>Sabab</th><th>Holat</th><th>Boshqarish</th></tr></thead><tbody>${returns.length?returns.map(r=>`<tr><td>#${esc(r.order_id.slice(0,8).toUpperCase())}</td><td>${esc(r.buyer_name)}</td><td>${money(r.subtotal)}</td><td>${esc(r.reason)}</td><td><span class="status ${esc(r.status)}">${esc(labelStatus[r.status]||r.status)}</span></td><td><form data-form="admin-return" data-id="${r.id}"><select name="status"><option value="approved">Tasdiqlash</option><option value="refunded">Pul qaytarildi</option><option value="rejected">Rad etish</option></select><input class="input" name="note" value="${esc(r.resolution_note||'')}" placeholder="Izoh"><button class="small-btn" type="submit">Saqlash</button></form></td></tr>`).join(''):'<tr><td colspan="6">Qaytarish arizalari yo‘q.</td></tr>'}</tbody></table></div></div>`;}
  else if(tab==='payments'){const {transactions,summary:ps}=await api('/admin/payments');extraView=`<div class="stat-grid"><div class="stat-card"><span>Tasdiqlangan tushum</span><strong>${money(ps.paid_total)}</strong></div><div class="stat-card"><span>Qaytarilgan</span><strong>${money(ps.refunded_total)}</strong></div><div class="stat-card"><span>Muvaffaqiyatli · Kutilmoqda</span><strong>${ps.paid_count} · ${ps.pending_count}</strong></div></div><div class="dashboard-card"><h2>To‘lov tranzaksiyalari</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Buyurtma</th><th>Shlyuz / ID</th><th>Xaridor</th><th>Summa</th><th>Holat</th></tr></thead><tbody>${transactions.length?transactions.map(t=>`<tr><td><strong>#${esc(t.order_id.slice(0,8).toUpperCase())}</strong></td><td>${esc(t.gateway.toUpperCase())}<br><small>${esc(t.gateway_id)}</small></td><td>${esc(t.buyer_name||t.recipient||'—')}</td><td><strong>${money(t.amount)}</strong></td><td><span class="status ${t.state===2?'active':t.state<0?'rejected':'pending'}">${t.state===2?'Tasdiqlangan':t.state===1?'Kutilmoqda':'Bekor / Qaytarildi'}</span></td></tr>`).join(''):'<tr><td colspan="5">Hozircha tranzaksiyalar yo‘q.</td></tr>'}</tbody></table></div></div>`;}
  else if(tab==='monitoring'){const mon=await api('/admin/monitoring');extraView=`<div class="stat-grid"><div class="stat-card"><span>30 kunlik SMS</span><strong>${mon.sms.total_30d} (${mon.sms.failed_30d} xato)</strong></div><div class="stat-card"><span>Faol sessiyalar · 24s xato</span><strong>${mon.health.active_sessions} · ${mon.health.errors_24h||0}</strong></div><div class="stat-card"><span>Xotira · Baza</span><strong>${mon.health.memoryMb} MB · ${Math.round(mon.health.db_bytes/1024/1024*10)/10} MB</strong></div><div class="stat-card"><span>Uptime · Node</span><strong>${mon.health.uptimeSeconds}s · ${esc(mon.health.nodeVersion)}</strong></div></div><div class="dashboard-card"><div class="dashboard-heading"><h2>Ma’lumotlar zaxira nusxasi</h2><a href="/api/admin/backup" class="btn btn-outline" download>Zaxira nusxani yuklash (JSON) ↓</a></div><p class="summary-note">Katalog, variantlar, promokodlar va sayt sozlamalarining parol/sessiyalarsiz xavfsiz nusxasi.</p></div><div class="dashboard-card"><h2>Xavfsizlik hodisalari</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Hodisa</th><th>Daraja</th><th>Foydalanuvchi</th><th>IP</th><th>Vaqt</th></tr></thead><tbody>${mon.securityEvents.slice(0,20).map(e=>`<tr><td><strong>${esc(e.event_type)}</strong></td><td><span class="status">${esc(e.severity)}</span></td><td>${esc(e.user_name||e.user_id||'—')}</td><td>${esc(e.ip||'—')}</td><td>${dateText(e.created_at)}</td></tr>`).join('')}</tbody></table></div></div><div class="dashboard-card"><h2>Audit jurnali</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Amal</th><th>Obyekt</th><th>Ijrochi</th><th>IP</th><th>Vaqt</th></tr></thead><tbody>${mon.auditLogs.slice(0,20).map(a=>`<tr><td><strong>${esc(a.action)}</strong></td><td>${esc(a.target_type)} #${esc(a.target_id)}</td><td>${esc(a.actor_name||a.actor_id||'—')}</td><td>${esc(a.ip||'—')}</td><td>${dateText(a.created_at)}</td></tr>`).join('')}</tbody></table></div></div>`;}
  const stats=`<div class="stat-grid"><div class="stat-card"><span>Jami foydalanuvchilar</span><strong>${s.users}</strong></div><div class="stat-card"><span>Faol mahsulotlar</span><strong>${s.active_products}</strong></div><div class="stat-card"><span>Buyurtmalar</span><strong>${s.orders}</strong></div><div class="stat-card"><span>Kutilayotgan tasdiqlar</span><strong>${s.seller_requests+s.pending_products}</strong></div></div>`;
  const sellerTable=`<div class="dashboard-card"><h2>Sotuvchi arizalari</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Foydalanuvchi</th><th>Email</th><th>Holati</th><th>Amallar</th></tr></thead><tbody>${sellers.sellers.length?sellers.sellers.map(x=>`<tr><td><strong>${esc(x.full_name)}</strong></td><td>${esc(x.email)}</td><td><span class="status ${esc(x.seller_status)}">${esc(labelStatus[x.seller_status]||x.seller_status)}</span></td><td>${x.seller_status==='pending'?`<button class="small-btn" data-action="admin-seller" data-id="${x.id}" data-status="approved">Tasdiqlash</button><button class="small-btn reject" data-action="admin-seller" data-id="${x.id}" data-status="rejected">Rad etish</button>`:'—'}</td></tr>`).join(''):'<tr><td colspan="4">Arizalar yo‘q.</td></tr>'}</tbody></table></div></div>`;
  const productTable=`<div class="dashboard-card"><div class="dashboard-heading"><h2>Mahsulotlar nazorati</h2><div class="hero-buttons"><a href="/admin/subcategories" data-link class="btn btn-outline">Quyi kategoriyalar</a><a href="/admin/products/import" data-link class="btn btn-outline">Excel import</a><a href="/admin/product/new" data-link class="btn btn-primary">+ Mahsulot qo‘shish</a></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Mahsulot</th><th>Sotuvchi</th><th>Narxi</th><th>Holati</th><th>Amallar</th></tr></thead><tbody id="admin-products-body">${products.products.map(x=>`<tr><td>${img(x.image_url,x.name)}<strong>${esc(x.name)}</strong></td><td>${esc(x.seller_name||'Platforma katalogi')}</td><td>${money(x.price)}</td><td><span class="status ${esc(x.status)}">${esc(labelStatus[x.status]||x.status)}</span></td><td><a class="small-btn" href="/admin/product/${x.id}/edit" data-link>Tahrirlash</a>${x.status==='pending'?`<button class="small-btn" data-action="admin-product" data-id="${x.id}" data-status="active">E’lon qilish</button><button class="small-btn reject" data-action="admin-product" data-id="${x.id}" data-status="rejected">Rad etish</button>`:x.status==='active'?`<button class="small-btn reject" data-action="admin-product" data-id="${x.id}" data-status="archived">Yashirish</button>`:''}</td></tr>`).join('')}</tbody></table></div><button class="btn btn-outline admin-more" data-action="admin-more" ${products.nextCursor?'':'hidden'}>Yana mahsulotlar</button></div>`;
  const orderTable=`<div class="dashboard-card"><h2>Buyurtmalar</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Buyurtma</th><th>Xaridor</th><th>Manzil</th><th>Mahsulotlar</th><th>Holat va kuzatuv</th></tr></thead><tbody>${orders.orders.length?orders.orders.map(x=>`<tr><td><strong>#${esc(x.id.slice(0,8).toUpperCase())}</strong><br>${dateText(x.created_at)}<br><small>${esc(x.payment_method.toUpperCase())} · ${esc(x.payment_status)}</small></td><td>${esc(x.recipient)}<br>${esc(x.phone)}<br>${esc(x.buyer_email)}</td><td><small>${esc(x.delivery_mode==='uzpost_pickup'?'UzPost filial':'Manzilga')}</small><br>${esc(x.region)} · ${esc(x.district)}<br>${esc(x.address)}</td><td><strong>${money(x.subtotal)}</strong><br><small>${state.config.shipping==='included'?'Yetkazish narxga kiritilgan':'Yetkazish alohida'}</small></td><td><form data-form="admin-order" data-id="${esc(x.id)}">${adminOrderOptions(x)}<input class="input" name="trackingNumber" value="${esc(x.tracking_number||'')}" placeholder="UzPost kuzatuv raqami" maxlength="100"><button class="small-btn" type="submit" ${['cancelled','awaiting_payment'].includes(x.status)?'disabled':''}>Saqlash</button></form></td></tr>`).join(''):'<tr><td colspan="5">Buyurtmalar yo‘q.</td></tr>'}</tbody></table></div></div>`;
  const cmsTabs={brand:['sparkle','Brend va SEO'],seasons:['sparkle','Mavsum va bayram'],promo:['sparkle','Aksiya lentasi'],categories:['grid','Kategoriyalar'],content:['file','Bosh sahifa'],assistant:['sparkle','Yordamchi'],onboarding:['file','Yo‘lko‘rsatkich'],icons:['grid','Ikonkalar'],legal:['file','Qoidalar va aloqa'],integrations:['shield','Integratsiyalar']};
  return `${crumbs(['Administrator'])}<div class="page-heading"><span class="eyebrow">Boshqaruv</span><h1>Administrator paneli</h1><p>Do‘kon ko‘rinishi, mahsulotlar, xavfsizlik va buyurtmalar bir joyda.</p></div><div class="dashboard-shell"><nav class="dashboard-nav"><button data-action="admin-tab" data-tab="overview" class="${tab==='overview'?'active':''}">${icon('grid')} Umumiy</button><button data-action="admin-tab" data-tab="sellers" class="${tab==='sellers'?'active':''}">${icon('store')} Sotuvchilar ${s.seller_requests?`(${s.seller_requests})`:''}</button><button data-action="admin-tab" data-tab="products" class="${tab==='products'?'active':''}">${icon('box')} Mahsulotlar ${s.pending_products?`(${s.pending_products})`:''}</button><button data-action="admin-tab" data-tab="orders" class="${tab==='orders'?'active':''}">${icon('truck')} Buyurtmalar</button><button data-action="admin-tab" data-tab="payments" class="${tab==='payments'?'active':''}">${icon('shield')} To‘lovlar</button><button data-action="admin-tab" data-tab="customers" class="${tab==='customers'?'active':''}">${icon('user')} Xaridorlar</button><button data-action="admin-tab" data-tab="promos" class="${tab==='promos'?'active':''}">${icon('sparkle')} Promokodlar</button><button data-action="admin-tab" data-tab="returns" class="${tab==='returns'?'active':''}">${icon('box')} Qaytarishlar</button><button data-action="admin-tab" data-tab="monitoring" class="${tab==='monitoring'?'active':''}">${icon('shield')} Xavfsizlik va holat</button>${Object.entries(cmsTabs).map(([key,[glyph,label]])=>`<button data-action="admin-tab" data-tab="${key}" class="${tab===key?'active':''}">${icon(glyph)} ${label}</button>`).join('')}</nav><div class="dashboard-main">${extraView||(tab==='sellers'?sellerTable:tab==='products'?productTable:tab==='orders'?orderTable:cmsTabs[tab]?MarketuzCMS.render(tab,settings,icon,esc):`${stats}<div class="dashboard-card"><h2>Tezkor boshqaruv</h2><div class="hero-buttons"><a href="/admin?tab=seasons" data-link class="btn btn-soft">Mavsumiy dizayn</a><a href="/admin?tab=brand" data-link class="btn btn-soft">Brend va SEO</a><a href="/admin?tab=monitoring" data-link class="btn btn-soft">Xavfsizlik va SMS monitoringi</a><a href="/admin?tab=products" data-link class="btn btn-soft">${s.pending_products} ta mahsulot tekshiruvda</a></div></div>`)}</div></div>`;
}
function renderDelivery() {
  updateTitle('Yetkazib berish');
  return `${crumbs(['Yetkazib berish'])}<div class="page-heading"><span class="eyebrow">Butun O‘zbekiston uchun</span><h1>Yetkazib berish</h1><p>Mahsulotingiz manzilga qanday yetib borishini qulay kuzating.</p></div><div class="delivery-hero"><span class="eyebrow eyebrow-light">Qulay jarayon</span><h1>Siz tanlang, qolganini birgalikda hal qilamiz.</h1><p>Jo‘natish xizmati, hudud, muddat va narx har bir buyurtma bo‘yicha alohida tasdiqlanadi.</p></div><div class="steps"><div class="step"><span class="benefit-icon">${icon('bag')}</span><strong>Mahsulot tanlang</strong><p>O‘zingizga yoqqanlarini savatga yig‘ing va buyurtma so‘rovini yuboring.</p></div><div class="step"><span class="benefit-icon">${icon('check')}</span><strong>Operator tasdiqlaydi</strong><p>Mavjudlik, yetkazish hududi, muddati va narxi siz bilan kelishiladi.</p></div><div class="step"><span class="benefit-icon">${icon('truck')}</span><strong>Jo‘natmani kuzating</strong><p>Kuzatuv raqami taqdim etilgach uni shaxsiy kabinetda ko‘rasiz.</p></div></div><div class="legal-card"><h2>UzPost bilan yetkazish rejasi</h2><p>Platforma UzPost bilan shartnoma asosida ishlashga mo‘ljallangan. Shartnoma va texnik hujjatlar olinguncha jo‘natmalar avtomatik yaratilmaydi, muddat va narx kafolatlanmaydi. Administrator jo‘natma holati va kuzatuv raqamini qo‘lda yangilashi mumkin.</p><h2>Qaysi hududlar?</h2><p>Buyurtma shaklida O‘zbekistonning barcha viloyatlari, Toshkent shahri va Qoraqalpog‘iston tanlanadi. Muayyan manzilga xizmat mavjudligi buyurtma tasdiqlanganda aniqlanadi.</p><a href="/catalog" data-link class="btn btn-primary">Xaridni boshlash</a></div>`;
}
function renderLegal(which) {
  const privacy=which==='privacy',legal=state.config.site.legal; updateTitle(privacy?'Maxfiylik siyosati':'Foydalanish shartlari');
  return `${crumbs([privacy?'Maxfiylik siyosati':'Foydalanish shartlari'])}<div class="page-heading"><span class="eyebrow">Ochiq va tushunarli</span><h1>${privacy?'Maxfiylik siyosati':'Foydalanish shartlari'}</h1><p>Oxirgi tahrir: ${new Date(legal.effectiveDate+'T00:00:00Z').toLocaleDateString('uz-UZ',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})}</p></div><div class="legal-wrap"><aside class="legal-side"><strong>Ma’lumotlar</strong><a href="/terms" data-link>Foydalanish shartlari</a><a href="/privacy" data-link>Maxfiylik siyosati</a><a href="/delivery" data-link>Yetkazib berish</a><p>Operator rekvizitlari va aloqa ma’lumotlari admin panelda ko‘rsatiladi.</p></aside><article class="legal-card">${privacy?`
    <h1>Sizning ma’lumotlaringiz</h1><p class="legal-note">Platforma operatori haqidagi ma’lumotlar quyida ko‘rsatiladi. Karta ma’lumotlari Click yoki Payme oynasiga kiritiladi, Marketuz serveriga yuborilmaydi.</p>
    <h2>1. Qanday ma’lumotlar olinadi?</h2><p>Hisob ochganda ism, email va parolning kriptografik xeshi; profilga kiritilsa telefon raqami, avatar, fon va bio; buyurtma so‘rovida qabul qiluvchi ismi, telefon, hudud, manzil va buyurtma tarkibi saqlanadi. Parolning o‘zi bazada saqlanmaydi. Karta ma’lumotlari olinmaydi; to‘lov provayderi uchun buyurtma ID si, summa va tasdiqlangan holat saqlanadi.</p><p>Shaxsiy tavsiyalarni o‘zingiz yoqsangiz, qidiruv so‘zlari, ko‘rilgan mahsulot, sahifada faol qolgan vaqt va savatga qo‘shishlar qayd etiladi. Bu faoliyat 90 kungacha tavsiya uchun saqlanadi; o‘chirishingiz yoki tarixni tozalashingiz mumkin. Sevimlilar va buyurtmalar alohida saqlanadi.</p>
    <h2>2. Nima uchun ishlatiladi?</h2><p>Hisobga kirish, savdo oqimini tashkil etish, buyurtmani tasdiqlash, sotuvchi va yetkazuvchi bilan kerakli tafsilotlarni ulashish, xavfsizlik va xizmat ko‘rsatish uchun. Marketing xabarlari alohida roziliksiz yuborilmaydi.</p>
    <h2>3. Kimlar ko‘radi?</h2><p>Administrator buyurtma va aloqa ma’lumotlarini, tegishli sotuvchi esa o‘z mahsulotiga doir buyurtma ma’lumotlarini ko‘rishi mumkin. Yetkazish bo‘yicha shartnoma tuzilgandan keyin jo‘natish uchun zarur ma’lumotlar xizmat ko‘rsatuvchiga berilishi mumkin.</p>
    <h2>4. Saqlash va himoya</h2><p>Ma’lumotlar alohida ma’lumotlar bazasida saqlanadi. Sessiyalar HttpOnly cookie bilan yuritiladi, parollar scrypt xeshi sifatida saqlanadi. Xosting hududi O‘zbekistondan tashqarida bo‘lishi mumkin; operator mahalliylashtirish va transchegaraviy ishlov berish masalalarini rasmiylashtirishi zarur.</p>
    <h2>5. Sizning tanlovingiz</h2><p>Profil ma’lumotlarini kabinetda yangilashingiz, shaxsiy tavsiyalarni yoqishingiz yoki o‘chirishingiz va faoliyat tarixini tozalashingiz mumkin. Tavsiyalar o‘chirilganda shu faoliyat tarixi o‘chadi. Ma’lumotlarga kirish, tuzatish yoki o‘chirish uchun operatorning rasmiy aloqa kanali ishga tushirilgach murojaat qiling. Murojaat kanali quyida keltiriladi.</p>
    <h2>6. Huquqiy asos</h2><p>Shaxsga doir ma’lumotlarga ishlov berishda amaldagi O‘zbekiston qonunchiligi hisobga olinadi. <a href="https://lex.uz/uz/docs/-4396419" target="_blank" rel="noopener noreferrer">“Shaxsga doir ma’lumotlar to‘g‘risida”gi qonun</a> bilan tanishing.</p>`: `
    <h1>Platformadan foydalanish</h1><p class="legal-note">Platforma operatorining rekvizitlari va qaytarish tartibi quyida keltiriladi. Yetkazish shartlari buyurtma bo‘yicha tasdiqlanadi.</p>
    <h2>1. Platforma va hisob</h2><p>Marketuz xaridorlar va sotuvchilarni bog‘lovchi marketplace sifatida ishlab chiqilmoqda. Xaridor hisob ochishi, katalogni ko‘rishi, savatga qo‘shishi va buyurtma so‘rovini yuborishi mumkin. Hisob egasi parolini sir saqlaydi.</p>
    <h2>2. Mahsulot va sotuvchilar</h2><p>Sotuvchi arizasi administrator tomonidan tasdiqlanadi. Sotuvchi o‘zi joylashtirgan mahsulot ma’lumotlari, rasm va qonuniy savdosi uchun javobgar bo‘ladi. Mahsulot e’lonlari tasdiqlashdan keyin katalogda ko‘rinadi. “Buyurtma asosida” deb belgilangan mahsulotlar doimiy ombor va kafolatli muddatni anglatmaydi: mavjudlik va yetkazish operator tasdig‘iga bog‘liq. Yetkazish narxi buyurtma sahifasida ko‘rsatilgan tartibda aniqlanadi.</p>
    <h2>3. Buyurtma va to‘lov</h2><p>Yetkazilganda to‘lanadigan buyurtma so‘rovi operator tomonidan tasdiqlanadi. Onlayn to‘lov faqat mahsulot narxiga yetkazish kiritilgan va provayder yoqilgan paytda ko‘rsatiladi; buyurtma faqat imzolangan to‘lov tasdig‘idan keyin tayyorlashga o‘tadi. Karta rekvizitlari Click yoki Payme oynasiga kiritiladi; Marketuz ularni olmaydi yoki saqlamaydi.</p>
    <h2>4. Yetkazish va qaytarish</h2><p>UzPost bilan shartnoma va API ulanishi rejalashtirilgan. Hozir jo‘natma avtomatik rasmiylashtirilmaydi. Buyurtmaning yetkazish narxi va qaytarish tartibi operator tomonidan bildiriladi. To‘lanmagan buyurtmani jo‘natishdan oldin kabinet orqali bekor qilish mumkin. To‘langan buyurtma va qaytarish bo‘yicha operatorga murojaat qiling; pul qaytarilishi provayder tasdig‘idan keyin amalga oshiriladi.</p>
    <h2>5. Ruxsat etilmagan harakatlar</h2><p>Soxta mahsulot e’lonlari, noqonuniy yoki boshqalarning huquqini buzuvchi kontent joylash, boshqa hisobga ruxsatsiz kirish va xizmat ishiga zarar yetkazish taqiqlanadi.</p>
    <h2>6. Amaldagi huquq</h2><p>Faoliyat O‘zbekistonning amaldagi qonunchiligi asosida yo‘lga qo‘yilishi ko‘zda tutilgan. <a href="https://lex.uz/docs/-6213382" target="_blank" rel="noopener noreferrer">“Elektron tijorat to‘g‘risida”gi qonun</a> bilan tanishing.</p>`}<h2>Platforma operatori</h2><p>${legal.operator?esc(legal.operator):'Yuridik operator rekvizitlari hozircha kiritilmagan.'} ${legal.taxId?`· STIR: ${esc(legal.taxId)}`:''}</p><p>${esc(legal.address||'Manzil ko‘rsatilmagan.')} ${esc(legal.phone||'')} ${esc(legal.email||'')}</p>${!privacy&&legal.returnPolicy?`<h2>Qaytarish tartibi</h2><p>${esc(legal.returnPolicy)}</p>`:''}${(privacy?legal.privacyExtra:legal.termsExtra)?`<h2>Qo‘shimcha qoidalar</h2><p>${esc(privacy?legal.privacyExtra:legal.termsExtra)}</p>`:''}</article></div>`;
}

function renderHelp() {
  updateTitle('Yordam markazi');
  const bots = state.config?.site?.assistant?.bots || [];
  return `${crumbs(['Yordam markazi'])}<div class="page-heading"><span class="eyebrow">Qo‘llab-quvvatlash</span><h1>Yordam markazi</h1><p>Xarid, to‘lov, yetkazib berish va sotuvchilik bo‘yicha ko‘p beriladigan savollar.</p></div><div class="legal-card">${bots.map(b => `<h2>${esc(b.name)}</h2><p>${esc(b.intro)}</p>${(b.faqs || []).map(f => `<details class="cms-holiday"><summary>${esc(f.question)}</summary><p>${esc(f.answer)}</p></details>`).join('')}`).join('')}<h2>Aloqa</h2><p>${esc(state.config?.site?.legal?.phone || state.config?.site?.legal?.email || 'Operator ma’lumotlari admin panelda ko‘rsatiladi.')}</p></div>`;
}
async function renderCompare() {
  updateTitle('Taqqoslash');
  const ids = readLocal('marketuz_compare', []).slice(0, 4);
  const items = (await Promise.all(ids.map(async id => { try { return state.products.get(String(id)) || (await api('/products/' + id)).product; } catch { return null; } }))).filter(Boolean);
  return `${crumbs(['Taqqoslash'])}<div class="page-heading"><span class="eyebrow">Tanlov</span><h1>Mahsulotlarni taqqoslash</h1><p>Tanlangan mahsulotlarning narxi, mavjudligi va xususiyatlarini solishtiring.</p></div>${items.length ? `<div class="dashboard-card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Mahsulot</th><th>Narxi</th><th>Kategoriya</th><th>Omborda</th><th>Bahosi</th><th>Amal</th></tr></thead><tbody>${items.map(p => `<tr><td>${img(p.image_url, p.name)}<a href="/product/${p.id}" data-link><strong>${esc(p.name)}</strong></a></td><td><strong>${money(p.price)}</strong></td><td>${esc(state.config.categories.find(c => c.id === p.category)?.name || p.category)}</td><td>${p.stock_mode === 'replenishable' ? 'Buyurtma asosida' : p.stock + ' dona'}</td><td>${Number(p.rating_count) > 0 ? '★ ' + Number(p.rating_avg).toFixed(1) : '—'}</td><td><button class="small-btn reject" data-action="compare-toggle" data-id="${p.id}">Olib tashlash</button></td></tr>`).join('')}</tbody></table></div></div>` : empty('Taqqoslash ro‘yxati bo‘sh', 'Mahsulot sahifasidan "Taqqoslash" tugmasini bosing.', 'Katalogga o‘tish', '/catalog', 'sliders')}`;
}
async function render() {
  state.feedObserver?.disconnect();state.feedObserver=null;clearInterval(state.paymentTimer);state.paymentTimer=null;
  const id=++state.request; headerUpdate(); app.innerHTML=loadingSkeleton();
  try {
    const pathname=location.pathname; let html;
    if(pathname==='/') html=await renderHome();
    else if(pathname==='/catalog') html=await renderCatalog();
    else if(pathname==='/discover') html=await renderDiscover();
    else if(pathname==='/help') html=renderHelp();
    else if(pathname==='/compare') html=await renderCompare();
    else if(pathname.startsWith('/product/')) html=await renderRichProduct(pathname.split('/')[2]);
    else if(pathname.startsWith('/shop/')) html=await renderShop(pathname.split('/')[2]);
    else if(pathname==='/cart') html=await renderCart();
    else if(pathname==='/checkout') html=await renderCheckout();
    else if(/^\/pay\/[a-f0-9-]{36}$/i.test(pathname)) html=await renderPayment(pathname.split('/')[2]);
    else if(pathname==='/favorites') html=await renderFavorites();
    else if(pathname==='/account') html=await renderAccount();
    else if(/^\/(seller|admin)\/product\/(new|\d+\/edit)$/.test(pathname)){const [,who,part]=pathname.match(/^\/(seller|admin)\/product\/(new|\d+\/edit)$/);html=await renderStudio(who,'editor',part==='new'?null:part.split('/')[0]);}
    else if(pathname==='/seller/products/import'||pathname==='/admin/products/import')html=await renderStudio(pathname.split('/')[1],'import');
    else if(pathname==='/admin/subcategories')html=await renderStudio('admin','subcategories');
    else if(pathname==='/seller') html=await renderSeller();
    else if(pathname==='/admin') html=await renderAdmin();
    else if(pathname==='/delivery') html=renderDelivery();
    else if(pathname==='/terms'||pathname==='/privacy') html=renderLegal(pathname.slice(1));
    else { updateTitle('Sahifa topilmadi'); html=empty('Sahifa topilmadi','Manzilni tekshirib ko‘ring.','Bosh sahifa','/','search'); }
    if(id===state.request) { app.innerHTML=html; headerUpdate(); $('#search-input').value=new URLSearchParams(location.search).get('q')||''; if(pathname==='/catalog')requestAnimationFrame(observeFeed);if(pathname.startsWith('/pay/')&&state.user&&state.payment?.id===pathname.split('/')[2]&&state.payment.status==='awaiting_payment')watchPayment(state.payment.id);if(pathname.startsWith('/product/')&&state.user?.personalization_enabled){const productId=Number(pathname.split('/')[2]);recordInterest('view',{productId});state.view={id:productId,start:Date.now()};} }
  } catch(e) { if(id===state.request) app.innerHTML=`${empty('Sahifani ochib bo‘lmadi',e.message,'Qayta urinish',location.pathname+location.search,'clock')}`; }
}
async function refreshPayment(id) {
  const latest=await api('/orders/'+encodeURIComponent(id)+'/payment');
  const before=state.payment;
  state.payment=latest;
  if(location.pathname==='/pay/'+id && (before?.paymentStatus!==latest.paymentStatus||before?.status!==latest.status)){await render();if(latest.paymentStatus==='paid')notify('To‘lov tasdiqlandi.');}
  return latest;
}
function watchPayment(id) {
  let attempts=0,busy=false;
  state.paymentTimer=setInterval(async()=>{
    if(location.pathname!=='/pay/'+id||++attempts>40){clearInterval(state.paymentTimer);state.paymentTimer=null;return;}
    if(document.hidden||busy)return;
    busy=true;try{await refreshPayment(id);}catch{}finally{busy=false;}
  },3000);
}
let clickScriptPromise;
function loadClickWidget() {
  if(typeof window.createPaymentRequest==='function')return Promise.resolve();
  clickScriptPromise ||= new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://my.click.uz/pay/checkout.js';script.async=true;
    script.onload=()=>typeof window.createPaymentRequest==='function'?resolve():reject(Error('Click to‘lov oynasi yuklanmadi.'));
    script.onerror=()=>reject(Error('Click to‘lov oynasi yuklanmadi.'));
    document.head.append(script);
  }).catch(e=>{clickScriptPromise=null;throw e;});
  return clickScriptPromise;
}

function formValues(form) { return Object.fromEntries(new FormData(form).entries()); }
function collectLinks(v){return [1,2,3].map(n=>({label:v['linkLabel'+n]?.trim(),url:v['linkUrl'+n]?.trim()})).filter(x=>x.label&&x.url);}
function openPayment(url){
  const isSandboxLocal = state.config?.clickSandbox && typeof url === 'string' && url.startsWith('/api/payments/click/sandbox-pay?');
  if(!isSandboxLocal && !/^https:\/\/(checkout\.paycom\.uz|my\.click\.uz)\//.test(url)) return notify('To‘lov havolasi xato.',true);
  if(isSandboxLocal){
    const oid=new URL(url,location.origin).searchParams.get('orderId');
    if(oid) return nav('/pay/'+encodeURIComponent(oid)+'?sandbox=1');
  }
  const tg=window.Telegram?.WebApp;
  if(tg?.initData) tg.openLink(url);
  else if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'marketuz:openExternal',url}));
  else window.location.assign(url);
}
async function submitForm(form) {
  const kind=form.dataset.form, v=formValues(form), btn=form.querySelector('button[type="submit"]'); if(btn) btn.disabled=true;
  try {
    if(['login','register','phone-login','phone-register'].includes(kind)) {
      if(kind==='login' && v.challengeToken){
        const {user}=await api('/auth/login/2fa',{method:'POST',body:JSON.stringify({challengeToken:v.challengeToken,code:v.totpCode})});
        state.user=user;
      } else {
        const payload=kind==='phone-register'?{name:v.name,phone:v.phone,code:v.code,password:v.password,agree:!!v.agree}:kind==='phone-login'?{phone:v.phone,password:v.password}:kind==='register'?{ name:v.name,email:v.email,password:v.password,agree:!!v.agree }:{email:v.email,password:v.password};
        const resp=await api('/auth/'+(kind.startsWith('phone-')?'phone/'+kind.slice(6):kind),{method:'POST',body:JSON.stringify(payload)});
        if(resp.requires2fa){
          const box=$('#admin-2fa-box');if(box){box.hidden=false;form.elements.challengeToken.value=resp.challengeToken;form.elements.totpCode.required=true;form.elements.totpCode.focus();}
          notify('Autentifikator ilovasidagi 2FA kodni kiriting.');
          return;
        }
        state.user=resp.user;
      }
      try { const f=await api('/favorites'); state.favorites=new Set(f.products.map(p=>String(p.id))); } catch {}
      notify('Xush kelibsiz!');
      const next=getAuthNext()||'/account';setAuthNext(null);nav(next);
    } else if(kind==='phone-reset') {
      const resp=await api('/auth/phone/reset-password',{method:'POST',body:JSON.stringify({phone:v.phone,code:v.code,newPassword:v.newPassword})});
      notify(resp.message||'Parol yangilandi.');
      nav('/account?mode=phone-login');
    } else if(kind==='me-phone') {
      const resp=await api('/me/phone/verify',{method:'POST',body:JSON.stringify({phone:v.phone,code:v.code,purpose:form.dataset.purpose||'bind'})});
      state.user=resp.user;notify('Telefon raqami tasdiqlandi.');render();
    } else if(kind==='admin-2fa-enable') {
      await api('/admin/security/2fa/enable',{method:'POST',body:JSON.stringify({currentPassword:v.currentPassword,code:v.code})});
      state.user.totp_enabled=true;notify('2FA himoyasi yoqildi.');render();
    } else if(kind==='admin-2fa-disable') {
      await api('/admin/security/2fa/disable',{method:'POST',body:JSON.stringify({currentPassword:v.currentPassword,code:v.code})});
      state.user.totp_enabled=false;notify('2FA o‘chirildi.');render();
    } else if(kind==='delete-account') {
      if(!confirm('Hisobingizni butunlay o‘chirishni tasdiqlaysizmi?')) return;
      await api('/me/delete',{method:'POST',body:JSON.stringify(v)});
      state.user=null;state.favorites=new Set();saveLocal('marketuz_favorites',[]);notify('Hisobingiz o‘chirildi.');nav('/');
    } else if(kind==='checkout') {
      const products=await loadCart();
      const deliveryMode=v.deliveryMode==='uzpost_pickup'?'uzpost_pickup':'courier';
      const payload={
        recipient:v.recipient,
        phone:v.phone,
        deliveryMode,
        ...(deliveryMode==='uzpost_pickup'
          ? { pickupBranchId:v.pickupBranchId }
          : { region:v.region, district:v.district, address:v.address }),
        promoCode:v.promoCode||'',
        note:v.note||'',
        paymentMethod:v.paymentMethod,
        agree:!!v.agree,
        checkoutKey:state.checkoutKey,
        items:products.map(x=>({id:x.id,variantId:x.variantId,qty:x.qty}))
      };
      const order=await api('/orders',{method:'POST',body:JSON.stringify(payload)});
      state.checkoutKey=null;try{localStorage.removeItem('marketuz_checkout_key');}catch{}state.cart=[];saveLocal('marketuz_cart',state.cart);syncCartServer();notify(order.message);nav(order.paymentUrl?'/pay/'+order.id:'/account?tab=orders');
    } else if(kind==='click-sandbox') {
      const r=await api('/payments/click/sandbox-pay',{method:'POST',body:JSON.stringify({orderId:form.dataset.id,decision:'pay',testCard:v.testCard,testExpiry:v.testExpiry})});
      notify('To‘lov muvaffaqiyatli tasdiqlandi!');
      nav(r.redirect||('/pay/'+form.dataset.id));
    } else if(kind==='catalog-filter') {
      const x=new URLSearchParams(location.search);
      for(const k of ['minPrice','maxPrice','minRating']){if(v[k])x.set(k,v[k]);else x.delete(k);}
      if(v.inStock)x.set('inStock','true');else x.delete('inStock');
      nav('/catalog'+(x.size?'?'+x.toString():''));
    } else if(kind==='review') {
      await api('/products/'+form.dataset.id+'/reviews',{method:'POST',body:JSON.stringify({rating:Number(v.rating),comment:v.comment})});
      notify('Sharhingiz saqlandi.');render();
    } else if(kind==='admin-promo') {
      await api('/admin/promos',{method:'POST',body:JSON.stringify(v)});
      notify('Promokod yaratildi.');render();
    } else if(kind==='admin-return') {
      await api('/admin/returns/'+form.dataset.id,{method:'PATCH',body:JSON.stringify(v)});
      notify('Qaytarish arizasi yangilandi.');render();
    } else if(kind==='profile') { const {user}=await api('/me',{method:'PATCH',body:JSON.stringify(v)}); state.user=user; notify('Profil saqlandi.'); render(); }
    else if(kind==='password') { const r=await api('/me/password',{method:'POST',body:JSON.stringify(v)}); form.reset(); notify(r.message||'Parol yangilandi.'); render(); }
    else if(kind==='admin-order') { await api('/admin/orders/'+form.dataset.id,{method:'PATCH',body:JSON.stringify(v)}); notify('Buyurtma holati saqlandi.'); render(); }
    else if(kind==='studio-product') { const payload=MarketuzStudio.collect(form),role=form.dataset.role,id=form.dataset.editId;await api('/'+role+'/products'+(id?'/'+id+(role==='admin'?'/details':''):''),{method:id?'PATCH':'POST',body:JSON.stringify(payload)});notify(role==='seller'?'Mahsulot tekshiruvga yuborildi.':'Mahsulot saqlandi.');nav('/'+role+'?tab=products'); }
    else if(kind==='studio-subcategory'){await api('/admin/subcategories',{method:'POST',body:JSON.stringify(v)});notify('Quyi kategoriya qo‘shildi.');render();}
    else if(kind==='site-settings') { const next=MarketuzCMS.collect(form,state.admin.settings.site); const result=await api('/admin/settings',{method:'PATCH',body:JSON.stringify(next)}); state.config.site=result.site;state.config.categories=result.site.categories;state.config.seasonal=result.seasonal;applySite();notify('Sayt sozlamalari saqlandi.');render(); }
  } catch(e) { notify(e.message,true); } finally { if(btn) btn.disabled=false; }
}
function startSmsTimer(button, seconds = 60, resetText = 'SMS kodni qayta yuborish') {
  const until = Date.now() + Number(seconds || 60) * 1000;
  const timer = setInterval(() => {
    if (!button.isConnected) { clearInterval(timer); return; }
    const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    button.textContent = left ? `Qayta yuborish (${left} s)` : resetText;
    if (!left) { clearInterval(timer); button.disabled = false; }
  }, 250);
}
function listenWebOtp(input) {
  if (!('OTPCredential' in window) || !navigator.credentials?.get) return;
  const ac = new AbortController();
  setTimeout(() => ac.abort(), 120_000);
  navigator.credentials.get({ otp: { transport: ['sms'] }, signal: ac.signal })
    .then(otp => { if (otp?.code && input?.isConnected) input.value = String(otp.code).replace(/\D/g, '').slice(0, 6); })
    .catch(() => {});
}
async function loadDevSmsInbox(form, rawPhone) {
  if (!state.config?.mockSms) return;
  const box = form?.querySelector('[data-dev-sms-box]');
  if (!box) return;
  try {
    const r = await api('/auth/phone/dev-inbox?phone=' + encodeURIComponent(rawPhone || ''));
    const msg = r.messages?.[0];
    if (!msg) return;
    box.innerHTML = `<div class="dev-sms-head"><strong>Test SMS qutisi</strong><small>${esc(formatUzPhoneInput(msg.phone))}</small></div><p>${esc(msg.message)}</p><button type="button" class="small-btn" data-action="fill-dev-otp" data-code="${esc(msg.code)}">Kodni qo‘yish (${esc(msg.code)})</button>`;
    box.hidden = false;
  } catch {}
}
async function actionOf(button) {
  const action=button.dataset.action,id=button.dataset.id;
  if(action==='menu') return openMenu(); if(action==='menu-close') return closeMenu();
  if(action==='toggle-password'){
    const wrap=button.closest('.password-field'),input=wrap?.querySelector('input');if(!input)return;
    const show=input.type==='password';input.type=show?'text':'password';
    button.setAttribute('aria-pressed',String(show));
    button.setAttribute('aria-label',show?'Parolni yashirish':'Parolni ko‘rsatish');
    button.innerHTML=icon(show?'eyeOff':'eye');return;
  }
  if(action==='fill-dev-otp'){
    const form=button.closest('form');
    if(form?.elements.code){form.elements.code.value=button.dataset.code||'';form.elements.code.focus();}
    return;
  }
  if(action==='find-nearest-branch'){
    if(!navigator.geolocation)return notify('Brauzer geolokatsiyani qo‘llab-quvvatlamaydi. Filialni ro‘yxatdan tanlang.',true);
    button.disabled=true;
    try{
      const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:7000,maximumAge:120000}));
      const r=await api(`/shipping/branches?lat=${encodeURIComponent(pos.coords.latitude)}&lng=${encodeURIComponent(pos.coords.longitude)}`);
      if(r.branches?.length){
        state.shippingMeta={...(state.shippingMeta||{}),branches:r.branches};
        const regionSel=$('#checkout-branch-region'),branchSel=$('#checkout-branch'),details=$('#branch-details-box');
        if(regionSel)regionSel.value='';
        if(branchSel){branchSel.innerHTML='<option value="">Filialni tanlang</option>'+branchOptionsHtml(r.branches,r.branches[0].id);branchSel.value=r.branches[0].id;}
        if(details)details.innerHTML=branchDetailsHtml(r.branches[0]);
        notify(`Eng yaqin filial tanlandi: ${r.branches[0].name} (~${r.branches[0].distanceKm} km).`);
      }
    }catch{notify('Joylashuvga ruxsat berilmadi yoki aniqlanmadi. Filialni qo‘lda tanlang.',true);}
    finally{button.disabled=false;}
    return;
  }
  if(action==='send-sms'||action==='send-me-sms'){
    const form=button.closest('form'),phone=form.elements.phone,status=form.querySelector('[data-sms-status]');
    if(!phone.reportValidity())return;
    const purpose=button.dataset.purpose||form.dataset.purpose||'register';
    const endpoint=action==='send-me-sms'?'/me/phone/send':'/auth/phone/send';
    const body={phone:phone.value,purpose};
    if(action==='send-me-sms'&&purpose==='change_phone'&&form.elements.currentPassword)body.currentPassword=form.elements.currentPassword.value;
    button.disabled=true;
    try{
      const r=await api(endpoint,{method:'POST',body:JSON.stringify(body)});
      status.textContent=r.message||'SMS yuborildi. Kod 5 daqiqa amal qiladi.';
      status.classList.remove('is-error');
      form.elements.code.focus();
      listenWebOtp(form.elements.code);
      startSmsTimer(button,r.retryAfter||60);
      loadDevSmsInbox(form,phone.value);
    }catch(e){status.textContent=e.message;status.classList.add('is-error');button.disabled=false;notify(e.message,true);}
    return;
  }
  if(action==='toggle-theme'){
    const next=document.documentElement.dataset.theme==='dark'?'light':'dark';
    saveLocal('marketuz_theme',next);applyTheme(next);return;
  }
  if(action==='compare-toggle'){
    const list=readLocal('marketuz_compare',[]);
    const idx=list.indexOf(String(id));
    if(idx>=0){list.splice(idx,1);notify('Taqqoslashdan olib tashlandi.');}
    else if(list.length>=4){return notify('Ko‘pi bilan 4 ta mahsulot taqqoslanadi.',true);}
    else{list.push(String(id));notify('Taqqoslashga qo‘shildi.');}
    saveLocal('marketuz_compare',list);
    if(location.pathname==='/compare')render();else button.textContent=idx>=0?'Taqqoslash':'Taqqoslashda ✓';
    return;
  }
  if(action==='check-promo'){
    const form=button.closest('form'),code=form.elements.promoCode?.value?.trim(),status=$('#promo-status');
    if(!code)return notify('Promokodni kiriting.',true);
    const products=await loadCart(),subtotal=products.reduce((n,p)=>n+p.price*p.qty,0);
    const r=await api('/promo/check',{method:'POST',body:JSON.stringify({code,subtotal})});
    if(status)status.textContent=`Chegirma: −${money(r.discount)} (yakuniy: ${money(r.finalSubtotal)})`;
    notify('Promokod qo‘llandi!');return;
  }
  if(action==='request-return'){
    const reason=prompt('Mahsulotni qaytarish sababini yozing (kamida 10 belgi):');
    if(!reason)return;
    await api('/orders/'+encodeURIComponent(id)+'/return',{method:'POST',body:JSON.stringify({reason})});
    notify('Qaytarish arizasi yuborildi.');render();return;
  }
  if(action==='mark-notifications-read'){await api('/notifications/read',{method:'POST',body:'{}'});notify('Barcha bildirishnomalar o‘qildi.');render();return;}
  if(action==='admin-promo-toggle'){await api('/admin/promos/'+id,{method:'PATCH',body:JSON.stringify({active:button.dataset.active==='true'})});notify('Promokod holati yangilandi.');render();return;}
  if(action==='admin-2fa-setup'){
    const r=await api('/admin/security/2fa/setup',{method:'POST',body:'{}'});
    $('#admin-2fa-secret').textContent=r.secret;$('#admin-2fa-setup-box').hidden=false;button.hidden=true;return;
  }
  if(action==='revoke-session'){await api('/me/sessions/'+encodeURIComponent(id),{method:'DELETE',body:'{}'});notify('Sessiya yopildi.');render();return;}
  if(action==='refresh-session'){await api('/me/sessions/refresh',{method:'POST',body:'{}'});notify('Sessiya yangilandi.');render();return;}
  if(action==='logout-others'){await api('/me/sessions/logout-others',{method:'POST',body:'{}'});notify('Boshqa qurilmalardagi sessiyalar yopildi.');render();return;}
  if(action==='logout-all'){if(!confirm('Barcha qurilmalardan chiqilsinmi?'))return;await api('/me/sessions/logout-all',{method:'POST',body:'{}'});state.user=null;state.favorites=new Set();saveLocal('marketuz_favorites',[]);notify('Barcha qurilmalardan chiqildi.');nav('/');return;}
  if(action==='auth-mode') return nav('/account?mode='+button.dataset.mode);
  if(action==='product-choose')return nav('/product/'+id);
  if(action==='gallery-select'||action==='gallery-shift'){
    const strip=$('#detail-gallery-strip'),buttons=[...strip?.querySelectorAll('button')||[]];if(!buttons.length)return;
    const current=Math.max(0,buttons.findIndex(x=>x.classList.contains('active'))),next=action==='gallery-shift'?(current+Number(button.dataset.delta)+buttons.length)%buttons.length:Number(button.dataset.index);
    buttons.forEach((x,i)=>x.classList.toggle('active',i===next));$('#detail-gallery-main').src=buttons[next].querySelector('img').src;return;
  }
  if(action==='variant-select'){
    const p=state.products.get(location.pathname.split('/')[2]),v=p?.variants?.find(x=>String(x.id)===String(id));if(!v)return;
    document.querySelectorAll('.variant-choices button').forEach(x=>x.classList.toggle('active',x===button));
    $('#detail-selected-price').textContent=money(v.price);$('#detail-stock').textContent=p.stock_mode==='replenishable'?'● Buyurtma asosida · mavjudlik tasdiqlanadi':`● Ushbu variant: ${v.stock} dona`;$('#variant-hint').textContent=`Tanlandi: ${v.label}`;
    if(v.image_url)$('#detail-gallery-main').src=safeImage(v.image_url);return;
  }
  if(action==='add-cart') { let p=state.products.get(String(id))||(await api('/products/'+id)).product;if(p.variant_count&&!p.variants){p=(await api('/products/'+id)).product;state.products.set(String(id),p);}const variantId=p.variant_count?$('.variant-choices button.active')?.dataset.id:null;const variant=variantId?p.variants?.find(x=>String(x.id)===String(variantId)):null;if(p.variant_count&&!variant)return notify('Avval rang yoki o‘lcham variantini tanlang.',true);const available=variant?.stock??p.stock;if(p.stock_mode!=='replenishable'&&available<1)return notify('Mahsulot hozircha tugagan.',true);const item=state.cart.find(x=>String(x.id)===String(id)&&String(x.variantId||'')===String(variantId||''));if(item)item.qty=Math.min(p.stock_mode==='replenishable'?20:Math.min(available,20),Number(item.qty)+1);else state.cart.push({id:Number(id),variantId:variantId?Number(variantId):null,qty:1});saveLocal('marketuz_cart',state.cart);syncCartServer();headerUpdate();recordInterest('cart',{productId:Number(id)});notify('Mahsulot savatga qo‘shildi.');return;}
  if(action==='resume-payment'){nav('/pay/'+id);return;}
  if(action==='click-sandbox-cancel'){const r=await api('/payments/click/sandbox-pay',{method:'POST',body:JSON.stringify({orderId:id,decision:'cancel'})});notify('To‘lov bekor qilindi.');nav(r.redirect||('/pay/'+id));return;}
  if(action==='payment-refresh'){const p=await refreshPayment(id);if(p.paymentStatus!=='paid')notify('To‘lov tasdig‘i hali kelmadi.');return;}
  if(action==='pay-external'){const p=await api('/orders/'+id+'/payment');if(!p.paymentUrl)return notify('To‘lov havolasi hozir mavjud emas.',true);openPayment(p.paymentUrl);return;}
  if(action==='pay-inline'){
    button.disabled=true;
    try{
      const p=await api('/orders/'+id+'/payment');
      if(!p.clickWidget||!p.paymentUrl)throw Error('Click oynasi hozir faol emas.');
      await loadClickWidget();
      window.createPaymentRequest(p.clickWidget,async result=>{
        if(Number(result?.status)<0)notify('To‘lov yakunlanmadi. Qayta urinib ko‘ring.',true);
        try{await refreshPayment(id);}catch{}
      });
    }catch(e){notify(e.message+' Click sahifasida to‘lash mumkin.',true);}
    finally{button.disabled=false;}
    return;
  }
  if(action==='share') {const p=state.products.get(String(id)),url=location.origin+'/product/'+id;if(navigator.share){try{await navigator.share({title:p?.name||'Marketuz',text:p?.name,url});return;}catch(e){if(e.name==='AbortError')return;}}await navigator.clipboard.writeText(url);notify('Mahsulot havolasi nusxalandi.');return;}
  if(action==='cart-remove') {state.cart=state.cart.filter(x=>!(String(x.id)===String(id)&&String(x.variantId||'')===String(button.dataset.variant||'')));saveLocal('marketuz_cart',state.cart);syncCartServer();return render();}
  if(action==='cart-qty') {const item=state.cart.find(x=>String(x.id)===String(id)&&String(x.variantId||'')===String(button.dataset.variant||''));if(item){const products=await loadCart(),p=products.find(x=>String(x.id)===String(id)&&String(x.variantId||'')===String(item.variantId||''));item.qty=Math.max(1,Math.min(p?.stock_mode==='replenishable'?20:Math.min(p?.stock||1,20),Number(item.qty)+Number(button.dataset.delta)));saveLocal('marketuz_cart',state.cart);syncCartServer();render();}return;}
  if(action==='studio-add-gallery'){const box=$('#studio-gallery-list');if(box.children.length>=12)return notify('Ko‘pi bilan 12 ta rasm.',true);box.insertAdjacentHTML('beforeend',MarketuzStudio.galleryRow());return;}
  if(action==='studio-add-variant'){const box=$('#studio-variant-list');if(box.children.length>=30)return notify('Ko‘pi bilan 30 ta variant.',true);box.insertAdjacentHTML('beforeend',MarketuzStudio.variantRow());return;}
  if(action==='studio-add-spec'){const box=$('#studio-spec-list');if(box.children.length>=24)return notify('Ko‘pi bilan 24 ta xususiyat.',true);box.insertAdjacentHTML('beforeend',MarketuzStudio.specRow());return;}
  if(action==='studio-remove-row'){button.closest('.studio-list-row')?.remove();return;}
  if(action==='studio-upload'||action==='studio-upload-gallery'){
    const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.multiple=action==='studio-upload-gallery';
    input.onchange=async()=>{const files=[...input.files||[]];if(!files.length)return;const box=$('#studio-gallery-list');if(input.multiple&&box.children.length+files.length>12)return notify('Galereyada ko‘pi bilan 12 ta rasm bo‘lsin.',true);for(const file of files){if(file.size>1_500_000){notify('Har rasm 1.5 MB dan kichik bo‘lsin.',true);return;}try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});const r=await api('/assets',{method:'POST',body:JSON.stringify({data})});if(input.multiple)box.insertAdjacentHTML('beforeend',MarketuzStudio.galleryRow(r.url));else{const parent=button.closest('.asset-field'),field=parent.querySelector('input');field.value=r.url;parent.querySelector('img').src=r.url;}notify(`${file.name} yuklandi.`);}catch(e){notify(e.message,true);return;}}};input.click();return;
  }
  if(action==='studio-preview-import'){
    const file=$('#studio-excel-file')?.files?.[0];if(!file)return notify('Avval Excel faylni tanlang.',true);if(file.size>1_200_000)return notify('Excel fayl 1.2 MB dan kichik bo‘lsin.',true);
    button.disabled=true;try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});const result=await api('/products/import/preview',{method:'POST',body:JSON.stringify({data})});state.studioImportData=data;const panel=$('#studio-import-preview');panel.hidden=false;panel.innerHTML=`<span class="studio-number">03</span><h2>Tekshiruv · ${result.count} ta mahsulot · ${result.variants} ta variant</h2><p>Quyidagi ro‘yxatni tasdiqlang. Fayldagi rasmlar havola bo‘yicha chiqadi; rasm yo‘q bo‘lsa vaqtinchalik tasvir ko‘rinadi.</p><div class="studio-preview-table"><table><thead><tr><th>SKU</th><th>Mahsulot</th><th>Kategoriya</th><th>Narxi</th><th>Variant</th></tr></thead><tbody>${result.products.map(x=>`<tr><td>${esc(x.sku)}</td><td>${esc(x.name)}</td><td>${esc(x.category)}${x.subcategory?' / '+esc(x.subcategory):''}</td><td>${money(x.price)}</td><td>${x.variants}</td></tr>`).join('')}</tbody></table></div><button class="btn btn-primary" type="button" data-action="studio-commit-import">${result.count} tasini saqlash →</button>`;panel.scrollIntoView({behavior:'smooth'});}finally{button.disabled=false;}return;
  }
  if(action==='studio-commit-import'){if(!state.studioImportData)return notify('Faylni qayta tekshiring.',true);button.disabled=true;try{const result=await api('/products/import/commit',{method:'POST',body:JSON.stringify({data:state.studioImportData})});state.studioImportData=null;notify(result.message);nav('/'+location.pathname.split('/')[1]+'?tab=products');}finally{button.disabled=false;}return;}
  if(action==='studio-delete-subcategory'){if(!confirm('Quyi kategoriya o‘chirilsinmi?'))return;await api('/admin/subcategories/'+id,{method:'DELETE',body:'{}'});notify('O‘chirildi.');render();return;}
  if(action==='feed-more')return loadFeed();
  if(action==='shop-more'){const shop=state.shop;if(!shop?.cursor||shop.loading)return;shop.loading=true;try{const data=await api('/shops/'+shop.id+'?cursor='+shop.cursor);if(location.pathname!=='/shop/'+shop.id)return;$('#shop-grid').insertAdjacentHTML('beforeend',data.products.map(productCard).join(''));shop.cursor=data.nextCursor;$('#shop-more').hidden=!shop.cursor;}finally{shop.loading=false;}return;}
  if(action==='follow-shop'){if(!state.user){state.authNext=location.pathname;return nav('/account');}const following=button.dataset.following==='true';await api('/shops/'+id+'/follow',{method:following?'DELETE':'PUT',body:'{}'});notify(following?'Kuzatish to‘xtatildi.':'Do‘kon kuzatishga qo‘shildi.');render();return;}
  if(action==='personalization'){const enabled=button.dataset.enabled==='true';await api('/me/personalization',{method:'PATCH',body:JSON.stringify({enabled})});state.user.personalization_enabled=enabled;notify(enabled?'Shaxsiy tavsiyalar yoqildi.':'Shaxsiy tarix o‘chirildi.');render();return;}
  if(action==='clear-activity'){await api('/me/activity',{method:'DELETE',body:'{}'});notify('Tavsiya tarixi tozalandi.');return;}
  if(action==='favorite') { const key=String(id), active=state.favorites.has(key); if(state.user) await api('/favorites/'+id,{method:active?'DELETE':'PUT',body:'{}'}); if(active) state.favorites.delete(key); else state.favorites.add(key); saveLocal('marketuz_favorites',[...state.favorites]); notify(active?'Sevimlilardan olib tashlandi.':'Sevimlilarga qo‘shildi.'); if(location.pathname==='/favorites'||(location.pathname==='/account'&&new URLSearchParams(location.search).get('tab')==='saved')) render(); else { button.classList.toggle('active',!active); button.setAttribute('aria-label',active?'Sevimlilarga qo‘shish':'Sevimlilardan olib tashlash'); } return; }
  if(action==='logout') { await api('/auth/logout',{method:'POST',body:'{}'}); state.user=null; state.favorites=new Set(); saveLocal('marketuz_favorites',[]); notify('Hisobdan chiqildi.'); nav('/'); return; }
  if(action==='cancel-order') { if(!confirm('Buyurtmani bekor qilasizmi?')) return; await api('/orders/'+id+'/cancel',{method:'POST',body:'{}'}); notify('Buyurtma bekor qilindi.'); render(); return; }
  if(action==='seller-request') { await api('/seller/request',{method:'POST',body:'{}'}); state.user.seller_status='pending'; notify('Ariza yuborildi.'); render(); return; }
  if(action==='seller-tab') return nav('/seller?tab='+button.dataset.tab);
  if(action==='admin-tab') return nav('/admin?tab='+button.dataset.tab);
  if(action==='seller-more'){
    if(!state.sellerCursor)return;button.disabled=true;
    try{const data=await api('/seller/products?cursor='+encodeURIComponent(state.sellerCursor));if(location.pathname!=='/seller')return;state.sellerProducts.push(...data.products);$('#seller-products-body').insertAdjacentHTML('beforeend',data.products.map(x=>`<tr><td>${img(x.image_url,x.name)}<strong>${esc(x.name)}</strong></td><td>${money(x.price)}</td><td>${x.stock_mode==='replenishable'?'Buyurtma asosida':x.stock+' dona'}</td><td><span class="status ${esc(x.status)}">${esc(labelStatus[x.status]||x.status)}</span></td><td><button class="small-btn" data-action="seller-edit" data-id="${x.id}">Tahrirlash</button>${x.status!=='archived'?`<button class="small-btn reject" data-action="seller-archive" data-id="${x.id}">Arxivlash</button>`:''}</td></tr>`).join(''));state.sellerCursor=data.nextCursor;button.hidden=!data.nextCursor;}finally{button.disabled=false;}return;
  }
  if(action==='admin-more'){
    if(!state.admin.productsCursor)return;button.disabled=true;
    try{const data=await api('/admin/products?cursor='+encodeURIComponent(state.admin.productsCursor));if(location.pathname!=='/admin')return;state.admin.products.push(...data.products);$('#admin-products-body').insertAdjacentHTML('beforeend',data.products.map(x=>`<tr><td>${img(x.image_url,x.name)}<strong>${esc(x.name)}</strong></td><td>${esc(x.seller_name||'Platforma katalogi')}</td><td>${money(x.price)}</td><td><span class="status ${esc(x.status)}">${esc(labelStatus[x.status]||x.status)}</span></td><td><button class="small-btn" data-action="admin-edit-product" data-id="${x.id}">Tahrirlash</button>${x.status==='pending'?`<button class="small-btn" data-action="admin-product" data-id="${x.id}" data-status="active">E’lon qilish</button><button class="small-btn reject" data-action="admin-product" data-id="${x.id}" data-status="rejected">Rad etish</button>`:x.status==='active'?`<button class="small-btn reject" data-action="admin-product" data-id="${x.id}" data-status="archived">Yashirish</button>`:''}</td></tr>`).join(''));state.admin.productsCursor=data.nextCursor;button.hidden=!data.nextCursor;}finally{button.disabled=false;}return;
  }
  if(action==='category-add') {MarketuzCMS.addCategory($('#cms-categories'));return;}
  if(action==='category-remove') {button.closest('[data-category-row]')?.remove();return;}
  if(action==='seller-new') return nav('/seller/product/new');
  if(action==='seller-form-close') return nav('/seller?tab=products');
  if(action==='seller-edit') return nav('/seller/product/'+id+'/edit');
  if(action==='admin-new-product') return nav('/admin/product/new');
  if(action==='admin-edit-product') return nav('/admin/product/'+id+'/edit');
  if(action==='seller-archive') { if(!confirm('Mahsulot arxivlansinmi?')) return; await api('/seller/products/'+id,{method:'DELETE',body:'{}'}); notify('Mahsulot arxivlandi.'); render(); return; }
  if(action==='seller-item-status') { await api('/seller/order-items/'+id,{method:'PATCH',body:JSON.stringify({status:button.dataset.status})}); notify('Tayyorlash holati o‘zgardi.'); render(); return; }
  if(action==='admin-seller') { await api('/admin/sellers/'+id,{method:'PATCH',body:JSON.stringify({status:button.dataset.status})}); notify('Sotuvchi arizasi yangilandi.'); render(); return; }
  if(action==='admin-product') { await api('/admin/products/'+id,{method:'PATCH',body:JSON.stringify({status:button.dataset.status})}); notify('Mahsulot holati yangilandi.'); render(); return; }
  if(action==='upload-asset') {const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.onchange=async()=>{const file=input.files?.[0];if(!file)return;if(file.size>1_500_000)return notify('Rasm 1.5 MB dan kichik bo‘lsin.',true);const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});try{const r=await api('/assets',{method:'POST',body:JSON.stringify({data})});const target=document.querySelector(`[data-setting="${button.dataset.target}"]`);if(target){target.value=r.url;const preview=target.parentElement.querySelector('img');if(preview){preview.src=r.url;preview.hidden=false;}}notify('Rasm yuklandi. Sozlamalarni saqlang.');}catch(e){notify(e.message,true);}};input.click();return;}
}

document.addEventListener('click',event=>{
  const link=event.target.closest('a[data-link]'); if(link && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.button===0) { event.preventDefault(); nav(link.pathname+link.search+link.hash); return; }
  const button=event.target.closest('[data-action]'); if(button) { event.preventDefault(); Promise.resolve(actionOf(button)).catch(e=>notify(e.message,true)); }
});
document.addEventListener('submit',event=>{
  if(event.target.id==='header-search'||event.target.id==='mobile-search-form') {
    event.preventDefault();
    const q=String(new FormData(event.target).get('q')||'').trim().slice(0,80);
    if(q.length>=2){
      recordInterest('search',{query:q});
      const hist=readLocal('marketuz_search_history',[]).filter(x=>x.toLowerCase()!==q.toLowerCase());
      saveLocal('marketuz_search_history',[q,...hist].slice(0,6));
    }
    const pop=$('#search-suggest');if(pop)pop.hidden=true;
    nav('/catalog?q='+encodeURIComponent(q));return;
  }
  if(event.target.dataset.form) { event.preventDefault(); submitForm(event.target); }
});
document.addEventListener('change',event=>{
  if(event.target.id==='catalog-sort'){const x=new URLSearchParams(location.search);x.set('sort',event.target.value);x.delete('page');nav('/catalog?'+x.toString());}
  if(event.target.name==='deliveryMode'){
    const form=event.target.closest('form'),pickup=event.target.value==='uzpost_pickup';
    const picker=$('#branch-picker-box'),courier=$('#courier-address-fields'),branch=$('#checkout-branch'),region=$('#checkout-region'),box=$('#shipping-quote-box');
    if(picker)picker.hidden=!pickup;
    if(courier)courier.hidden=pickup;
    if(branch)branch.required=pickup;
    if(region)region.required=!pickup;
    if(form?.elements.district)form.elements.district.required=!pickup;
    if(form?.elements.address)form.elements.address.required=!pickup;
    if(box&&state.config?.shipping!=='included'){
      const selectedBranch=(state.shippingMeta?.branches||[]).find(b=>String(b.id)===String(branch?.value||''));
      box.innerHTML=pickup?`${icon('truck')} UzPost filialidan olib ketish tanlandi${selectedBranch?' ('+esc(selectedBranch.name)+')':''}; jo‘natma operator tasdig‘idan so‘ng yuboriladi.`:`${icon('truck')} Yetkazish xizmati va narxi manzil tasdiqlangach belgilanadi.`;
    }
  }
  if(event.target.id==='checkout-branch-region'){
    const region=event.target.value,all=state.shippingMeta?.branches||[];
    const filtered=region?all.filter(b=>b.region===region):all;
    const branchSel=$('#checkout-branch'),details=$('#branch-details-box');
    const first=filtered[0]||null;
    if(branchSel){branchSel.innerHTML='<option value="">Filialni tanlang</option>'+branchOptionsHtml(filtered,first?.id||'');if(first)branchSel.value=first.id;}
    if(details)details.innerHTML=branchDetailsHtml(first);
  }
  if(event.target.id==='checkout-branch'){
    const branch=(state.shippingMeta?.branches||[]).find(b=>String(b.id)===String(event.target.value));
    const details=$('#branch-details-box'),box=$('#shipping-quote-box');
    if(details)details.innerHTML=branchDetailsHtml(branch);
    if(box&&branch&&state.config?.shipping!=='included'){
      api('/shipping/quote',{method:'POST',body:JSON.stringify({region:branch.region,deliveryMode:'uzpost_pickup',subtotal:0})}).then(q=>{if(box.isConnected)box.innerHTML=`${icon('truck')} ${esc(branch.name)} (${esc(q.label)}): taxminan <strong>${money(q.fee)}</strong> (500 000 so‘mdan yuqori xaridda bepul; operator tasdiqlaydi).`;}).catch(()=>{});
    }
  }
  if(event.target.id==='checkout-region'){
    const list=$('#checkout-districts'),box=$('#shipping-quote-box'),region=event.target.value;
    if(list&&state.shippingMeta?.districts?.[region]){list.innerHTML=state.shippingMeta.districts[region].map(d=>`<option value="${esc(d)}">`).join('');}
    if(box&&region&&state.config?.shipping!=='included'){api('/shipping/quote',{method:'POST',body:JSON.stringify({region,deliveryMode:'courier',subtotal:0})}).then(q=>{if(box.isConnected)box.innerHTML=`${icon('truck')} ${esc(region)} uchun ${esc(q.label)}: taxminan <strong>${money(q.fee)}</strong> (500 000 so‘mdan yuqori xaridda bepul; operator tasdiqlaydi).`;}).catch(()=>{});}
  }
  if(event.target.name==='category'&&event.target.closest('.studio-form')){const select=event.target.form.elements.subcategory;select.innerHTML='<option value="">Tanlanmagan</option>'+((state.studioSubcategories||[]).filter(x=>x.category===event.target.value).map(x=>`<option value="${esc(x.name)}">${esc(x.name)}</option>`).join(''));}
  if(event.target.closest('.studio-form .asset-field')&&event.target.tagName==='INPUT'){const preview=event.target.parentElement.querySelector('img');if(preview)preview.src=safeImage(event.target.value)||'/assets/product-placeholder.svg';}
  if(event.target.id==='studio-excel-file'){state.studioImportData=null;const panel=$('#studio-import-preview');if(panel)panel.hidden=true;}
});
let suggestTimer=null;
function showSearchSuggest(items, isHistory=false){
  const form=$('#header-search');if(!form)return;
  let box=$('#search-suggest');
  if(!box){box=document.createElement('div');box.id='search-suggest';box.className='search-suggest';box.hidden=true;form.append(box);}
  if(!items.length){box.hidden=true;return;}
  box.innerHTML=isHistory
    ?items.map(q=>`<a href="/catalog?q=${encodeURIComponent(q)}" data-link><span>${esc(q)}</span><small>Oxirgi qidiruv</small></a>`).join('')
    :items.map(p=>`<a href="/product/${p.id}" data-link><span>${esc(p.name)}</span><small>${money(p.price)}</small></a>`).join('');
  box.hidden=false;
}
document.addEventListener('focusin',event=>{
  if(event.target.id==='search-input' && !event.target.value.trim()){
    const hist=readLocal('marketuz_search_history',[]);
    if(hist.length)showSearchSuggest(hist,true);
  }
});
document.addEventListener('click',event=>{
  if(!event.target.closest('#header-search')){const box=$('#search-suggest');if(box)box.hidden=true;}
});
document.addEventListener('input',event=>{
  const el=event.target;
  if(el.id==='search-input'){
    clearTimeout(suggestTimer);
    const val=el.value.trim();
    if(val.length<2){const hist=readLocal('marketuz_search_history',[]);showSearchSuggest(val?[]:hist,true);return;}
    suggestTimer=setTimeout(async()=>{
      try{const r=await api('/catalog/suggestions?q='+encodeURIComponent(val));if($('#search-input')?.value.trim()===val)showSearchSuggest(r.suggestions||[],false);}catch{}
    },180);
  }
  if(el.matches('[data-phone-format]')){
    const formatted=formatUzPhoneInput(el.value);
    if(el.value!==formatted) el.value=formatted;
  }
  if(el.matches('[data-otp-input]')){
    const clean=el.value.replace(/\D/g,'').slice(0,6);
    if(el.value!==clean) el.value=clean;
  }
  if(el.matches('[data-strength-input]')){
    const meter=el.closest('.field')?.querySelector('[data-strength-meter]');
    if(meter){const info=evalPasswordStrength(el.value);meter.dataset.level=info.cls;meter.querySelector('small').textContent=info.label;}
  }
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
$('#drawer-backdrop').addEventListener('click',closeMenu);
window.addEventListener('popstate',()=>{finishView();closeMenu();render();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)finishView();else if(location.pathname.startsWith('/product/')&&state.user?.personalization_enabled)state.view={id:Number(location.pathname.split('/')[2]),start:Date.now()};});
document.addEventListener('error',event=>{if(event.target.tagName==='IMG' && !event.target.dataset.fallback){ event.target.dataset.fallback='true'; event.target.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="700" height="700"><defs><linearGradient id="g"><stop stop-color="#dfe9d7"/><stop offset="1" stop-color="#f6e6d1"/></linearGradient></defs><rect width="700" height="700" fill="url(#g)"/><circle cx="540" cy="120" r="165" fill="#fff" opacity=".4"/><text x="50%" y="51%" text-anchor="middle" fill="#396652" font-family="sans-serif" font-size="54" font-weight="bold">marketuz ✳</text></svg>');}},true);
window.addEventListener('online',updateOnlineState);
window.addEventListener('offline',updateOnlineState);
$('#year').textContent=new Date().getFullYear();
for(const slot of document.querySelectorAll('[data-icon]')) slot.innerHTML=icon(slot.dataset.icon);
applyTheme();
updateOnlineState();
async function start() {
  try { state.config=await api('/config');applySite();applyTheme();api('/shipping/meta').then(m=>{state.shippingMeta=m;}).catch(()=>{});const tg=window.Telegram?.WebApp;if(tg?.initData){tg.ready();tg.expand();try{tg.setHeaderColor('#153d37');}catch{}} if(!state.config.demoOnly) { try { state.user=(await api('/me')).user; } catch {} if(!state.user && tg?.initData && state.config.telegramEnabled){try{state.user=(await api('/auth/telegram',{method:'POST',body:JSON.stringify({initData:tg.initData})})).user;}catch(e){notify(e.message,true);}} if(state.user){try{const [f,c]=await Promise.all([api('/favorites'),api('/cart').catch(()=>null)]);state.favorites=new Set(f.products.map(p=>String(p.id)));if(c?.items?.length&&!state.cart.length){state.cart=c.items;saveLocal('marketuz_cart',state.cart);}else if(state.cart.length){syncCartServer();}}catch{}} } await render();window.MarketuzExperience?.maybeWelcome(state.user?.role);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'marketuz:ready',title:state.config.site.brand.name}));if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{}); }
  catch(e) { app.innerHTML=empty('Ulanishda xatolik',e.message,'Qayta yuklash','/','clock'); }
}
start();
