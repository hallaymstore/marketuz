import {createHmac,randomInt,timingSafeEqual} from 'node:crypto';

export function normalizePhone(value) {
  const raw=String(value??'').trim();
  if(raw.length>32 || !/^\+?[\d ()-]+$/.test(raw)) return null;
  let digits=raw.replace(/\D/g,'');
  if(digits.length===9) digits='998'+digits;
  return /^998\d{9}$/.test(digits)?digits:null;
}
export const smsReady=()=>process.env.SMS_ENABLED==='true'&&!!(process.env.ESKIZ_EMAIL&&process.env.ESKIZ_PASSWORD&&process.env.OTP_SECRET?.length>=32);
let token,tokenUntil=0;
async function provider(path,fields,bearer){
  const response=await fetch('https://notify.eskiz.uz/api/'+path,{method:'POST',headers:bearer?{Authorization:'Bearer '+bearer}:{},body:new URLSearchParams(fields),signal:AbortSignal.timeout(12000)});
  if(!response.ok) throw new Error('SMS provider rejected request');
  return response.json();
}
async function sendCode(phone,code){
  if(!token||Date.now()>=tokenUntil){
    const result=await provider('auth/login',{email:process.env.ESKIZ_EMAIL,password:process.env.ESKIZ_PASSWORD});
    token=result.data?.token;
    if(!token) throw new Error('SMS provider authentication failed');
    tokenUntil=Date.now()+20*60*1000;
  }
  try{
    const result=await provider('message/sms/send',{mobile_phone:phone,message:'MarketUZ tasdiqlash kodi: '+code+'. Kodni hech kimga bermang.',from:process.env.ESKIZ_SENDER||'4546'},token);
    if(!['waiting','success','accepted'].includes(String(result.status).toLowerCase())) throw new Error('SMS rejected');
  }catch(e){token=null;throw e;}
}
export function otpDigest(phone,code,secret){return createHmac('sha256',secret).update('register:'+phone+':'+code).digest('hex');}
export function mountPhoneAuth(app,{pool,requireDb,rateAuth,route,fail,hashPassword,verifyPassword,setSession}){
  const ready=()=>{if(!smsReady())throw fail(503,'SMS xizmati hozircha mavjud emas.');};
  const phoneOf=value=>{const phone=normalizePhone(value);if(!phone)throw fail(400,'Telefon raqamini to‘g‘ri kiriting.');return phone;};
  app.get('/api/auth/phone/status',(req,res)=>res.json({enabled:!!pool&&smsReady()}));
  app.post('/api/auth/phone/send',requireDb,rateAuth,route(async(req,res)=>{
    ready();const phone=phoneOf(req.body.phone),ip=req.ip||'unknown';
    const code=String(randomInt(0,1000000)).padStart(6,'0');
    const db=await pool.connect();
    try{
      await db.query('BEGIN');
      await db.query("SELECT pg_advisory_xact_lock(hashtext($1))",['sms-ip:'+ip]);
      await db.query("SELECT pg_advisory_xact_lock(hashtext($1))",['sms-phone:'+phone]);
      const {rows:[limits]}=await db.query("SELECT count(*) FILTER(WHERE phone=$1)::int AS phone_count,count(*) FILTER(WHERE ip=$2)::int AS ip_count,count(*) FILTER(WHERE phone=$1 AND created_at>now()-interval '60 seconds')::int AS recent FROM sms_requests WHERE created_at>now()-interval '1 day' AND (phone=$1 OR ip=$2)",[phone,ip]);
      if(limits.recent||limits.phone_count>=5||limits.ip_count>=20)throw fail(429,'SMS limiti. Keyinroq urinib ko‘ring.');
      await db.query('INSERT INTO sms_requests(phone,ip) VALUES($1,$2)',[phone,ip]);
      await db.query("INSERT INTO phone_otps(phone,digest,expires_at,attempts) VALUES($1,$2,now()+interval '5 minutes',0) ON CONFLICT(phone) DO UPDATE SET digest=excluded.digest,expires_at=excluded.expires_at,attempts=0",[phone,otpDigest(phone,code,process.env.OTP_SECRET)]);
      await db.query('COMMIT');
    }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
    try{await sendCode(phone,code);}catch{await pool.query('DELETE FROM phone_otps WHERE phone=$1 AND digest=$2',[phone,otpDigest(phone,code,process.env.OTP_SECRET)]);throw fail(502,'SMS yuborilmadi. Keyinroq urinib ko‘ring.');}
    res.json({ok:true,retryAfter:60});
  }));
  app.post('/api/auth/phone/register',requireDb,rateAuth,route(async(req,res)=>{
    ready();const phone=phoneOf(req.body.phone),code=String(req.body.code??''),name=String(req.body.name??'').trim(),password=String(req.body.password??'');
    if(!/^\d{6}$/.test(code)||name.length<2||name.length>100||password.length<10||password.length>128||req.body.agree!==true)throw fail(400,'Ism, SMS kod, parol va rozilikni tekshiring.');
    const db=await pool.connect();let user;
    try{
      await db.query('BEGIN');
      const {rows:[otp]}=await db.query('SELECT * FROM phone_otps WHERE phone=$1 FOR UPDATE',[phone]);
      if(!otp||otp.attempts>=5||new Date(otp.expires_at)<=new Date())throw fail(400,'Kod noto‘g‘ri yoki muddati tugagan.');
      if(!timingSafeEqual(Buffer.from(otp.digest,'hex'),Buffer.from(otpDigest(phone,code,process.env.OTP_SECRET),'hex'))){
        await db.query('UPDATE phone_otps SET attempts=attempts+1 WHERE phone=$1',[phone]);await db.query('COMMIT');throw fail(400,'Kod noto‘g‘ri yoki muddati tugagan.');
      }
      const result=await db.query("INSERT INTO users(full_name,email,phone,verified_phone,password_hash) VALUES($1,$2,$3,$3,$4) RETURNING id,full_name,email,phone,role,seller_status",[name,'phone-'+phone+'@marketuz.invalid','+'+phone,await hashPassword(password)]);
      user=result.rows[0];await db.query('DELETE FROM phone_otps WHERE phone=$1',[phone]);await db.query('COMMIT');
    }catch(e){await db.query('ROLLBACK');if(e.code==='23505')throw fail(409,'Hisob mavjud. Parol bilan kiring.');throw e;}finally{db.release();}
    setSession(res,user.id);res.status(201).json({user});
  }));
  app.post('/api/auth/phone/login',requireDb,rateAuth,route(async(req,res)=>{
    const phone=phoneOf(req.body.phone),password=String(req.body.password??'');
    if(!password||password.length>128)throw fail(401,'Telefon yoki parol noto‘g‘ri.');
    const {rows:[user]}=await pool.query("SELECT id,full_name,email,phone,role,seller_status,password_hash FROM users WHERE verified_phone=$1 AND role!='admin'",['+'+phone]);
    if(!user||!await verifyPassword(password,user.password_hash))throw fail(401,'Telefon yoki parol noto‘g‘ri.');
    delete user.password_hash;setSession(res,user.id);res.json({user});
  }));
}
