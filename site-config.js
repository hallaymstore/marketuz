import { categories as seedCategories } from './seed.js';
export const seasons = ['spring','summer','autumn','winter'];
export const iconNames = ['home','menu','close','search','heart','user','bag','grid','truck','shield','store','file','sliders','sparkle','check','box','clock','lock','filter','logout'];
export const holidays = {
  new_year: { name:'Yangi yil', season:'winter', line:'Yangi yil kayfiyati va qishki topilmalar', title:'Sovg‘alar va qishki topilmalar.' },
  women: { name:'8-mart', season:'spring', line:'Ayollar bayramiga nafis sovg‘alar', title:'Mehrga to‘la sovg‘alar.' },
  navruz: { name:'Navro‘z', season:'spring', line:'Navro‘zga yangi ranglar va topilmalar', title:'Yangi fasl nafasi.' },
  remembrance: { name:'Xotira kuni', season:'spring', line:'Qadrlash va ehtirom fasli', title:'Mehr va ehtirom bilan.' },
  independence: { name:'Mustaqillik', season:'summer', line:'Yurtimiz bayramiga yorqin tanlov', title:'Yorqin topilmalar.' },
  teachers: { name:'Ustozlar kuni', season:'autumn', line:'Ustozlarga mehr bilan tanlang', title:'Minnatdorlik sovg‘alari.' },
  constitution: { name:'Konstitutsiya', season:'winter', line:'Bayramona topilmalarni kashf eting', title:'Qadriyatlarimizga ehtirom.' },
  ramadan: { name:'Ramazon', season:'spring', line:'Mehr va saxovat oyi', title:'Mehrli lahzalar uchun.' },
  eid: { name:'Hayit', season:'spring', line:'Hayitga samimiy sovg‘alar', title:'Yaqinlaringizga quvonch.' }
};
const cover = name => `/assets/seasons/${name}-cover.webp`;
const hero = name => `/assets/seasons/${name}-hero.webp`;
export const defaults = {
  categories:seedCategories.map(c=>({...c,image:''})),
  brand: { name:'Marketuz', tagline:'HAMMASI BIR JOYDA', logo:'', favicon:'/favicon.svg', description:'O‘zbekiston bo‘ylab aksessuarlar, kiyim-kechak va uy buyumlari.' },
  seo: { title:'Marketuz — har kuni ajoyib topilmalar', description:'Marketuz — aksessuarlar, kiyim-kechak va uy uchun tanlangan buyumlarni kashf eting.', siteUrl:'https://marketuz-dsph.onrender.com', ogImage:'/assets/winter-hero.webp', keywords:'marketuz, onlayn do‘kon, aksessuarlar, kiyim-kechak, O‘zbekiston' },
  theme: { mode:'auto', holiday:'auto', customStart:'', customEnd:'', announcement:'', titles:{}, subtitles:{}, holidayTitles:{}, holidaySubtitles:{}, background:{spring:cover('spring'),summer:cover('summer'),autumn:cover('autumn'),winter:'/assets/decor/winter-ivory-background.webp'}, hero:{spring:hero('spring'),summer:hero('summer'),autumn:hero('autumn'),winter:'/assets/winter-hero.webp'}, holidayArt:{ new_year:{background:'/assets/decor/winter-ivory-background.webp',hero:'/assets/winter-hero.webp',garland:''}, women:{background:cover('spring'),hero:hero('women'),garland:''}, navruz:{background:cover('spring'),hero:hero('navruz'),garland:''}, remembrance:{background:cover('spring'),hero:hero('spring'),garland:''}, independence:{background:cover('summer'),hero:hero('independence'),garland:''}, teachers:{background:cover('autumn'),hero:hero('teachers'),garland:''}, constitution:{background:'/assets/decor/winter-ivory-background.webp',hero:hero('independence'),garland:''}, ramadan:{background:cover('eid'),hero:hero('eid'),garland:''}, eid:{background:cover('eid'),hero:hero('eid'),garland:''} }, decor:{ column:'',garland:'',lantern:'',corner:'' } },
  icons: {},
  content:{storyOneTitle:'O‘zingizga mos aksessuarlar',storyTwoTitle:'Uyingizga yangi kayfiyat',storyOneCategory:'aksessuar',storyTwoCategory:'uy',storyOneImage:'',storyTwoImage:'',editorialImage:'',deliveryImage:'',authImage:'',categoryTitle:'Kategoriyalarni kashf eting',productTitle:'Sizga yoqishi mumkin',editorialTitle:'Uyingizga yangi kayfiyat.',editorialText:'Uy uchun nafis buyumlar va mavsumga mos topilmalarni kashf eting.',footerText:'Har kuningizga yangi topilmalar, xaridingizga yangi kayfiyat.'},
  promo:{enabled:false,eyebrow:'Maxsus taklif',title:'Bayramga mos topilmalarni kashf eting',button:'Aksiyalarni ko‘rish',href:'/catalog?sort=newest',image:'/assets/winter-hero.webp',mobileImage:'',start:'',end:'',dismissible:true},
  assistant:{enabled:true,icon:'/assets/bag-premium.webp',title:'Marketuz yordamchisi',greeting:'Salom! Mahsulot, yetkazish yoki sotuvchilik bo‘yicha yordam beraman.',contactText:'Operator bilan bog‘lanish',bots:[
    {id:'shopping',name:'Xarid',intro:'Mahsulot nomini yozing yoki quyidagi savollardan birini tanlang.',faqs:[{question:'Savatga qanday qo‘shaman?',answer:'Mahsulot kartasidagi “Savatga qo‘shish” tugmasini bosing. Savatingizni yuqoridagi yoki telefonning pastki menyusidagi Savat orqali ochasiz.'},{question:'Qanday to‘layman?',answer:'Mavjud to‘lov usullari buyurtmani yakunlash sahifasida ko‘rsatiladi. Click va Payme faqat merchant sozlamalari faollashtirilganda paydo bo‘ladi.'},{question:'Buyurtmalarim qayerda?',answer:'Shaxsiy kabinetdagi “Buyurtmalarim” bo‘limida holat va kuzatuv raqamini ko‘rasiz.'}]},
    {id:'delivery',name:'Yetkazish',intro:'Hudud va jo‘natish haqidagi savollaringizga javob beraman.',faqs:[{question:'Qaysi hududlarga yetkaziladi?',answer:'Buyurtma shaklida O‘zbekistonning barcha hududlarini tanlash mumkin. Aynan sizning manzilingizga xizmat mavjudligi operator tasdiqlaganda aniqlanadi.'},{question:'Yetkazish narxi qancha?',answer:'Yetkazish narxi va muddati manzilga qarab buyurtma tasdiqlanishida belgilanadi. Agar to‘lov sahifasida narxga kiritilgani yozilgan bo‘lsa, alohida haq olinmaydi.'},{question:'UzPost kuzatuv raqami qayerda?',answer:'Jo‘natma rasmiylashtirilgach kuzatuv raqami shaxsiy kabinetdagi buyurtma ichida ko‘rinadi.'}]},
    {id:'seller',name:'Sotuvchi',intro:'Mahsulot joylash va sotuvchi arizasi bo‘yicha ko‘maklashaman.',faqs:[{question:'Sotuvchi bo‘lish uchun nima qilaman?',answer:'Hisobga kiring va “Sotuvchi bo‘lish” sahifasida ariza yuboring. Administrator tasdiqlagach sotuvchi paneli ochiladi.'},{question:'Mahsulot rasmini yuklasam bo‘ladimi?',answer:'Ha. Sotuvchi panelida mahsulot rasmi uchun HTTPS havola kiriting yoki “Qurilmadan yuklash” tugmasini bosing.'},{question:'Mahsulot qachon katalogga chiqadi?',answer:'Yangi yoki tahrirlangan mahsulot administrator tekshiruvidan keyin katalogga chiqadi.'}]}
  ]},
  onboarding:{enabled:true,version:'1',title:'Marketuzga xush kelibsiz!',subtitle:'Bir necha qadamda do‘kondan qulay foydalanishni boshlang.',steps:[{title:'Topilmalarni kashf eting',text:'Katalogdagi kategoriyalarni ko‘ring va nomi bo‘yicha qidiring.',href:'/catalog'},{title:'Savat va buyurtma',text:'Yoqtirgan mahsulotlarni savatga yig‘ib, manzilni to‘ldiring.',href:'/cart'},{title:'Yordam doim yoningizda',text:'Pastki o‘ngdagi yordamchi xarid, yetkazish va sotuvchi savollariga javob beradi.',href:'/delivery'}]},
  links: { telegram:'', instagram:'', support:'', privacyContact:'' },
  legal: { operator:'', taxId:'', address:'', phone:'', email:'', effectiveDate:'2026-11-22', returnPolicy:'', termsExtra:'', privacyExtra:'' }
};
const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
const str = (v,max) => typeof v === 'string' ? v.trim().slice(0,max) : '';
export const assetUrl = v => typeof v==='string' && (v==='/favicon.svg' || /^\/media\/[a-f0-9-]{36}$/.test(v) || /^\/assets\/[a-z0-9/.-]+\.(webp|png|jpg|svg)$/.test(v));
const publicUrl = v => { try { const u=new URL(v); return u.protocol==='https:' && !u.username && !u.password && v.length<=1000; } catch { return false; } };
const mediaOrUrl = v => v==='' || assetUrl(v) || publicUrl(v);
const destination = v => typeof v==='string' && (/^\/(?!\/)[a-zA-Z0-9/?=&%_.-]{0,300}$/.test(v) || publicUrl(v));
export function validateSite(raw) {
  if(!raw || typeof raw!=='object' || Array.isArray(raw)) throw new Error('Sozlamalar obyekt shaklida bo‘lishi kerak.');
  const out=structuredClone(defaults);
  if(raw.categories){
    if(!Array.isArray(raw.categories)||!raw.categories.length||raw.categories.length>24) throw new Error('Kategoriya ro‘yxati xato.');
    out.categories=raw.categories.map(c=>{
      const id=str(c?.id,40),name=str(c?.name,80),subtitle=str(c?.subtitle,120),image=str(c?.image,1000);
      if(!/^[a-z0-9-]{2,40}$/.test(id)||!name||!mediaOrUrl(image)) throw new Error('Kategoriya ID, nomi yoki rasmi xato.');
      return {id,name,subtitle,image};
    });
    if(new Set(out.categories.map(c=>c.id)).size!==out.categories.length) throw new Error('Kategoriya ID takrorlangan.');
  }
  if(raw.brand) { for(const k of ['name','tagline','description']) if(own(raw.brand,k)) out.brand[k]=str(raw.brand[k],k==='description'?240:80); for(const k of ['logo','favicon']) if(own(raw.brand,k)) { if(!mediaOrUrl(raw.brand[k])) throw new Error('Brend rasmi havolasi xato.'); out.brand[k]=raw.brand[k]; } }
  if(!out.brand.name) throw new Error('Sayt nomi bo‘sh bo‘lmasin.');
  if(raw.seo) { for(const k of ['title','description','keywords']) if(own(raw.seo,k)) out.seo[k]=str(raw.seo[k],k==='description'?320:180); if(own(raw.seo,'siteUrl')) { if(!publicUrl(raw.seo.siteUrl)) throw new Error('Sayt manzili HTTPS bo‘lishi kerak.'); out.seo.siteUrl=new URL(raw.seo.siteUrl).origin; } if(own(raw.seo,'ogImage')) { if(!mediaOrUrl(raw.seo.ogImage)) throw new Error('OG rasmi havolasi xato.'); out.seo.ogImage=raw.seo.ogImage; } }
  if(raw.theme) {
    const t=raw.theme;
    if(own(t,'mode')) { if(!['auto',...seasons].includes(t.mode)) throw new Error('Mavsum xato.'); out.theme.mode=t.mode; }
    if(own(t,'holiday')) { if(!['auto','none',...Object.keys(holidays)].includes(t.holiday)) throw new Error('Bayram xato.'); out.theme.holiday=t.holiday; }
    for(const k of ['customStart','customEnd']) if(own(t,k)) { if(t[k] && !/^\d{4}-\d{2}-\d{2}$/.test(t[k])) throw new Error('Sana YYYY-MM-DD bo‘lishi kerak.'); out.theme[k]=t[k]; }
    if(own(t,'announcement')) out.theme.announcement=str(t.announcement,150);
    for(const group of ['titles','subtitles']) if(t[group]) for(const s of seasons) if(own(t[group],s)) out.theme[group][s]=str(t[group][s],group==='titles'?90:240);
    for(const group of ['holidayTitles','holidaySubtitles']) if(t[group]) for(const h of Object.keys(holidays)) if(own(t[group],h)) out.theme[group][h]=str(t[group][h],group==='holidayTitles'?90:240);
    for(const group of ['background','hero']) if(t[group]) for(const s of seasons) if(own(t[group],s)) { if(!mediaOrUrl(t[group][s])) throw new Error('Mavsum rasmi havolasi xato.'); out.theme[group][s]=t[group][s]; }
    if(t.holidayArt) for(const h of Object.keys(holidays)) if(t.holidayArt[h]) for(const k of ['background','hero','garland','column','lantern','corner']) if(own(t.holidayArt[h],k)) { if(!mediaOrUrl(t.holidayArt[h][k])) throw new Error('Bayram rasmi havolasi xato.'); out.theme.holidayArt[h]??={background:'',hero:'',garland:''}; out.theme.holidayArt[h][k]=t.holidayArt[h][k]; }
    if(t.decor) for(const k of ['column','garland','lantern','corner']) if(own(t.decor,k)) { if(!mediaOrUrl(t.decor[k])) throw new Error('Bezak havolasi xato.'); out.theme.decor[k]=t.decor[k]; }
  }
  if(raw.icons) for(const key of iconNames) if(own(raw.icons,key)) { if(!mediaOrUrl(raw.icons[key])) throw new Error('Ikonka havolasi xato.'); out.icons[key]=raw.icons[key]; }
  if(raw.content) for(const k of Object.keys(out.content)) if(own(raw.content,k)) {const imageField=k.endsWith('Image');if(imageField && !mediaOrUrl(raw.content[k])) throw new Error('Bo‘lim rasmi havolasi xato.');out.content[k]=str(raw.content[k],imageField?1000:k==='editorialText'||k==='footerText'?260:100);}
  if(raw.promo){const p=raw.promo;if(own(p,'enabled'))out.promo.enabled=p.enabled===true;if(own(p,'dismissible'))out.promo.dismissible=p.dismissible===true;for(const k of ['eyebrow','title','button'])if(own(p,k))out.promo[k]=str(p[k],k==='title'?140:50);for(const k of ['image','mobileImage'])if(own(p,k)){if(!mediaOrUrl(p[k]))throw new Error('Aksiya rasmi havolasi xato.');out.promo[k]=str(p[k],1000);}if(own(p,'href')){if(!destination(p.href))throw new Error('Aksiya havolasi xato.');out.promo.href=p.href;}for(const k of ['start','end'])if(own(p,k)){if(p[k]&&!/^\d{4}-\d{2}-\d{2}$/.test(p[k]))throw new Error('Aksiya sanasi xato.');out.promo[k]=p[k];}if(out.promo.start&&out.promo.end&&out.promo.start>out.promo.end)throw new Error('Aksiya tugash sanasi boshlanishidan oldin.');}
  if(raw.assistant){const a=raw.assistant;if(own(a,'enabled'))out.assistant.enabled=a.enabled===true;if(own(a,'icon')){if(!mediaOrUrl(a.icon))throw new Error('Yordamchi ikonkasini tekshiring.');out.assistant.icon=a.icon;}for(const k of ['title','greeting','contactText'])if(own(a,k))out.assistant[k]=str(a[k],k==='greeting'?240:70);if(own(a,'bots')){if(!Array.isArray(a.bots)||a.bots.length!==3||a.bots.map(b=>b.id).join(',')!=='shopping,delivery,seller')throw new Error('Yordamchi bo‘limlari xato.');out.assistant.bots=a.bots.map(b=>{if(!Array.isArray(b.faqs)||b.faqs.length>8)throw new Error('Savollar soni xato.');return{id:b.id,name:str(b.name,40),intro:str(b.intro,180),faqs:b.faqs.map(f=>({question:str(f?.question,130),answer:str(f?.answer,700)})).filter(f=>f.question&&f.answer)};});}}
  if(raw.onboarding){const o=raw.onboarding;if(own(o,'enabled'))out.onboarding.enabled=o.enabled===true;for(const k of ['version','title','subtitle'])if(own(o,k))out.onboarding[k]=str(o[k],k==='subtitle'?240:100);if(own(o,'steps')){if(!Array.isArray(o.steps)||o.steps.length<1||o.steps.length>5)throw new Error('Tanishuv qadamlari xato.');out.onboarding.steps=o.steps.map(step=>{if(!destination(step?.href))throw new Error('Tanishuv havolasi xato.');return{title:str(step.title,100),text:str(step.text,240),href:step.href};});}}
  if(!out.categories.some(c=>c.id===out.content.storyOneCategory)||!out.categories.some(c=>c.id===out.content.storyTwoCategory)) throw new Error('Banner kategoriyasi ro‘yxatda yo‘q.');
  if(raw.links) for(const key of Object.keys(out.links)) if(own(raw.links,key)) { if(raw.links[key] && !publicUrl(raw.links[key]) && key!=='privacyContact') throw new Error('Tashqi havola HTTPS bo‘lishi kerak.'); out.links[key]=str(raw.links[key],250); }
  if(raw.legal) for(const key of Object.keys(out.legal)) if(own(raw.legal,key)) out.legal[key]=str(raw.legal[key],key.endsWith('Extra')||key==='returnPolicy'?4000:250);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(out.legal.effectiveDate)) throw new Error('Qoidalar sanasi YYYY-MM-DD bo‘lsin.');
  return out;
}
export function seasonalState(site, now=new Date()) {
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const [,m,d]=date.match(/^\d{4}-(\d\d)-(\d\d)$/)||[];
  const md=`${m}-${d}`;
  let holiday=null;
  if(site.theme.holiday!=='none') {
    if(site.theme.holiday!=='auto' && ['ramadan','eid'].includes(site.theme.holiday)) {
      if(site.theme.customStart && site.theme.customEnd && date>=site.theme.customStart && date<=site.theme.customEnd) holiday=site.theme.holiday;
    }
    else if(site.theme.holiday!=='auto') holiday=site.theme.holiday;
    else if(md>='12-20'||md<='01-10') holiday='new_year';
    else if(md>='03-05'&&md<='03-09') holiday='women';
    else if(md>='03-17'&&md<='03-25') holiday='navruz';
    else if(md>='05-07'&&md<='05-10') holiday='remembrance';
    else if(md>='08-28'&&md<='09-03') holiday='independence';
    else if(md>='09-29'&&md<='10-02') holiday='teachers';
    else if(md>='12-06'&&md<='12-09') holiday='constitution';
  }
  const season=site.theme.mode==='auto' ? (holiday?holidays[holiday].season:(m==='12'||m==='01'||m==='02'||(m==='11'&&d>='20')?'winter':m==='03'||m==='04'||m==='05'?'spring':m==='06'||m==='07'||m==='08'?'summer':'autumn')) : site.theme.mode;
  return { season, holiday, holidayName:holiday?holidays[holiday].name:'', holidayTitle:holiday?holidays[holiday].title:'', holidayLine:holiday?holidays[holiday].line:'', announcement:site.theme.announcement || (holiday?holidays[holiday].line:{spring:'Bahorning yangi ranglari',summer:'Yozgi topilmalar',autumn:'Kuzgi tanlovlar',winter:'Qishki topilmalar'}[season]) };
}
