// Run after deploying, with TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and MARKETUZ_URL set.
const token=process.env.TELEGRAM_BOT_TOKEN,secret=process.env.TELEGRAM_WEBHOOK_SECRET,base=process.env.MARKETUZ_URL;
if(!token||!secret||!base||new URL(base).protocol!=='https:') throw new Error('TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and HTTPS MARKETUZ_URL are required.');
async function call(method,body){
  const res=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await res.json();if(!data.ok)throw new Error(`${method}: ${data.description}`);
}
await call('setWebhook',{url:new URL('/api/telegram/webhook',base).href,secret_token:secret,allowed_updates:['message']});
await call('setChatMenuButton',{menu_button:{type:'web_app',text:'Marketuz',web_app:{url:new URL('/',base).href}}});
console.log('Telegram menu button and webhook configured.');
