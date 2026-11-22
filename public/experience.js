/* Lightweight storefront help: editable FAQ, catalog lookup, first-visit guide. */
window.MarketuzExperience=(()=>{
  let site, activeBot='shopping', dragging=false, moved=false, introStep=0, introOpen=false;
  const $=id=>document.getElementById(id);
  const asset=url=>typeof url==='string' && (/^\/assets\/[a-z0-9/.-]+\.(webp|png|svg|jpg)$/.test(url)||/^\/media\/[a-f0-9-]{36}$/.test(url)||/^https:\/\//.test(url))?url:'';
  const destination=url=>typeof url==='string' && (/^\/(?!\/)/.test(url)||/^https:\/\//.test(url))?url:'/catalog';
  const setLink=(el,url)=>{el.href=destination(url);if(el.href.startsWith(location.origin+'/')){el.dataset.link='';el.removeAttribute('target');el.removeAttribute('rel');}else{delete el.dataset.link;el.target='_blank';el.rel='noopener noreferrer';}};
  const introKey=()=>`marketuz_intro_${site?.onboarding?.version||'1'}`;
  function update(next){
    site=next;
    const promo=site.promo||{}, now=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const current=promo.enabled && (!promo.start||now>=promo.start) && (!promo.end||now<=promo.end);
    const stamp=[promo.title,promo.start,promo.end].join('|');
    let dismissed=false;try{dismissed=promo.dismissible && localStorage.getItem('marketuz_promo_dismissed')===stamp;}catch{}
    const ribbon=$('promo-banner'), standard=$('announcement-default');
    ribbon.hidden=!current||dismissed;standard.hidden=!ribbon.hidden;
    document.querySelector('.announcement').classList.toggle('has-promo',!ribbon.hidden);
    if(!ribbon.hidden){
      $('promo-eyebrow').textContent=promo.eyebrow||'Maxsus taklif';$('promo-title').textContent=promo.title||'Topilmalar';$('promo-button').textContent=promo.button||'Ko‘rish';
      setLink($('promo-link'),promo.href);$('promo-image').src=asset(promo.image)||'/assets/winter-hero.webp';
      const mobile=$('promo-mobile-image');if(asset(promo.mobileImage)) mobile.srcset=asset(promo.mobileImage);else mobile.removeAttribute('srcset');
      $('promo-dismiss').hidden=!promo.dismissible;
      $('promo-dismiss').onclick=()=>{try{localStorage.setItem('marketuz_promo_dismissed',stamp);}catch{}ribbon.hidden=true;standard.hidden=false;document.querySelector('.announcement').classList.remove('has-promo');};
    }
    const help=$('market-helper');help.hidden=!site.assistant?.enabled;
    if(site.assistant?.enabled){$('market-helper-icon').src=asset(site.assistant.icon)||'/assets/bag-premium.webp';$('market-helper').setAttribute('aria-label',site.assistant.title||'Yordamchi');$('market-chat-title').textContent=site.assistant.title||'Marketuz yordamchisi';$('market-chat-greeting').textContent=site.assistant.greeting||'';renderBot(activeBot);}
  }
  function setOpen(open){const panel=$('market-chat'),button=$('market-helper');panel.hidden=!open;button.classList.toggle('chat-open',open);button.setAttribute('aria-expanded',String(open));if(open){renderBot(activeBot);$('market-chat-input').focus();}else button.focus();}
  function message(text,kind){const line=document.createElement('div');line.className='market-message '+kind;line.textContent=text;$('market-chat-log').append(line);line.scrollIntoView({block:'nearest'});return line;}
  function renderBot(id){
    const config=site?.assistant;if(!config)return;
    const bot=config.bots?.find(x=>x.id===id)||config.bots?.[0];if(!bot)return;
    activeBot=bot.id;
    const tabs=$('market-chat-tabs'),quick=$('market-chat-quick');tabs.replaceChildren();quick.replaceChildren();$('market-chat-log').replaceChildren();
    for(const item of config.bots){const b=document.createElement('button');b.type='button';b.className=item.id===bot.id?'active':'';b.textContent=item.name;b.setAttribute('aria-pressed',String(item.id===bot.id));b.addEventListener('click',()=>renderBot(item.id));tabs.append(b);}
    message(bot.intro,'bot');
    for(const faq of bot.faqs||[]){const b=document.createElement('button');b.type='button';b.textContent=faq.question;b.addEventListener('click',()=>{message(faq.question,'person');message(faq.answer,'bot');});quick.append(b);}
    const contact=$('market-chat-contact'),href=site.links?.support||site.links?.telegram;
    contact.hidden=!href; if(href){setLink(contact,href);contact.textContent=config.contactText||'Operator bilan bog‘lanish';}
  }
  async function ask(text){
    const question=text.trim().slice(0,90);if(!question)return;
    const bot=site.assistant.bots.find(x=>x.id===activeBot);message(question,'person');
    const normalized=question.toLocaleLowerCase('uz-UZ');
    const found=bot.faqs?.find(f=>f.question.toLocaleLowerCase('uz-UZ')===normalized)||bot.faqs?.find(f=>{const words=f.question.toLocaleLowerCase('uz-UZ').split(/\W+/).filter(w=>w.length>4);return words.some(w=>normalized.includes(w));});
    if(found){message(found.answer,'bot');return;}
    if(activeBot==='shopping'){
      const pending=message('Katalogdan qidiryapman…','bot');
      try{const response=await fetch('/api/catalog?'+new URLSearchParams({q:question,sort:'newest'}),{credentials:'same-origin'});if(!response.ok)throw new Error('search');const data=await response.json();pending.textContent=data.products?.length?'Quyidagi mahsulotlarni topdim:':'Bu nomda mahsulot topilmadi. Katalogda boshqa so‘z bilan qidiring.';
        for(const product of (data.products||[]).slice(0,3)){const link=document.createElement('a');link.className='market-chat-product';link.href='/product/'+encodeURIComponent(product.id);link.dataset.link='';link.textContent=product.name+' · '+new Intl.NumberFormat('uz-UZ').format(product.price)+' so‘m';$('market-chat-log').append(link);}
      }catch{pending.textContent='Hozir qidiruvga ulanib bo‘lmadi. Katalog sahifasida sinab ko‘ring.';}
      return;
    }
    message('Bu savol uchun yuqoridagi tayyor javoblarni tanlang yoki operatorga yozing.','bot');
  }
  function drawIntro(){
    const guide=site.onboarding,steps=guide.steps||[];if(!steps.length)return;
    const step=steps[introStep];$('market-intro-title').textContent=guide.title;$('market-intro-subtitle').textContent=guide.subtitle;$('market-intro-step').textContent=`${introStep+1} / ${steps.length}`;$('market-intro-heading').textContent=step.title;$('market-intro-text').textContent=step.text;
    const link=$('market-intro-link');setLink(link,step.href);link.textContent='Shu bo‘limni ko‘rish ↗';
    $('market-intro-next').textContent=introStep===steps.length-1?'Boshlash':'Keyingi →';
    const dots=$('market-intro-dots');dots.replaceChildren();steps.forEach((_,i)=>{const dot=document.createElement('i');dot.className=i===introStep?'active':'';dots.append(dot);});
  }
  function closeIntro(){introOpen=false;$('market-intro').hidden=true;try{localStorage.setItem(introKey(),'done');}catch{};$('market-helper').focus();}
  function openIntro(){if(!site?.onboarding?.enabled)return;introStep=0;introOpen=true;drawIntro();$('market-intro').hidden=false;$('market-intro-close').focus();}
  function maybeWelcome(role){if(!site?.onboarding?.enabled||role==='admin'||role==='seller')return;let done=false;try{done=localStorage.getItem(introKey())==='done';}catch{}if(!done)setTimeout(()=>{if(!introOpen)openIntro();},700);}
  document.addEventListener('DOMContentLoaded',()=>{
    const helper=$('market-helper');let origin;
    helper.addEventListener('pointerdown',event=>{if(event.button!==0)return;origin={x:event.clientX,y:event.clientY,left:helper.getBoundingClientRect().left,top:helper.getBoundingClientRect().top};moved=false;dragging=true;helper.setPointerCapture(event.pointerId);});
    helper.addEventListener('pointermove',event=>{if(!dragging||!origin)return;const dx=event.clientX-origin.x,dy=event.clientY-origin.y;if(Math.abs(dx)+Math.abs(dy)>8)moved=true;if(!moved)return;helper.style.left=Math.max(8,Math.min(innerWidth-64,origin.left+dx))+'px';helper.style.top=Math.max(8,Math.min(innerHeight-70,origin.top+dy))+'px';helper.style.right='auto';helper.style.bottom='auto';});
    helper.addEventListener('pointerup',()=>{dragging=false;origin=null;});
    helper.addEventListener('click',event=>{if(moved){event.preventDefault();moved=false;return;}setOpen($('market-chat').hidden);});
    $('market-chat-close').addEventListener('click',()=>setOpen(false));
    $('market-chat-form').addEventListener('submit',event=>{event.preventDefault();const input=$('market-chat-input'),text=input.value;input.value='';ask(text);});
    $('market-chat-guide').addEventListener('click',()=>{setOpen(false);openIntro();});
    $('market-intro-close').addEventListener('click',closeIntro);$('market-intro-skip').addEventListener('click',closeIntro);
    $('market-intro-next').addEventListener('click',()=>{if(introStep+1<(site.onboarding.steps||[]).length){introStep++;drawIntro();}else closeIntro();});
    $('market-intro-link').addEventListener('click',()=>closeIntro());
    document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(introOpen)closeIntro();else if(!$('market-chat').hidden)setOpen(false);}});
  });
  return {update,maybeWelcome};
})();
