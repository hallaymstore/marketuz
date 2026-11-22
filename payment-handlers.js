import { createHash, timingSafeEqual } from 'node:crypto';

const error=(code,message,data)=>({code,message:{uz:message,ru:message,en:message},...(data?{data}:{})});
const rpcFail=(code,message,data)=>{throw error(code,message,data);};
const idOk=v=>typeof v==='string' && /^[a-f0-9-]{36}$/i.test(v);
const compare=(a,b)=>{
  if(typeof a!=='string'||typeof b!=='string') return false;
  const x=Buffer.from(a),y=Buffer.from(b);
  return x.length===y.length&&timingSafeEqual(x,y);
};
export function clickSignature(body,secret,complete=false){
  return createHash('md5').update([body.click_trans_id,body.service_id,secret,body.merchant_trans_id,...(complete?[body.merchant_prepare_id]:[]),body.amount,body.action,body.sign_time].join('')).digest('hex');
}
async function releaseOrder(db,orderId,paid=false){
  await db.query("UPDATE orders SET status='cancelled',payment_status=$2,updated_at=now() WHERE id=$1 AND status!='cancelled'",[orderId,paid?'refunded':'cancelled']);
  const items=await db.query('SELECT product_id,quantity FROM order_items WHERE order_id=$1',[orderId]);
  for(const p of items.rows) await db.query('UPDATE products SET stock=stock+$1 WHERE id=$2',[p.quantity,p.product_id]);
}
export function mountPayments(app,pool,ready){
  app.post('/api/payments/payme',async(req,res)=>{
    const id=req.body?.id??null,method=req.body?.method,params=req.body?.params||{};
    const response=(result,issue)=>res.json({id,...(issue?{error:issue}:{result})});
    if(!ready('payme')) return res.status(503).json({id,error:error(-32400,'To‘lov xizmati faol emas.')});
    const actual=req.get('authorization')||'',expected='Basic '+Buffer.from(`${process.env.PAYME_LOGIN}:${process.env.PAYME_KEY}`).toString('base64');
    if(!compare(actual,expected)) return res.status(401).json({id,error:error(-32504,'Ruxsat yo‘q.')});
    const db=await pool.connect();
    try {
      if(['CheckPerformTransaction','CreateTransaction'].includes(method)){
        const orderId=params.account?.order_id;
        if(!idOk(orderId)) rpcFail(-31050,'Buyurtma topilmadi.','account.order_id');
        const order=(await db.query('SELECT id,total,status,payment_method FROM orders WHERE id=$1',[orderId])).rows[0];
        if(!order||order.payment_method!=='payme') rpcFail(-31050,'Buyurtma topilmadi.','account.order_id');
        if(!Number.isSafeInteger(params.amount)||params.amount!==order.total*100) rpcFail(-31001,'Summa buyurtmaga mos emas.');
        if(method==='CheckPerformTransaction') return response(order.status==='awaiting_payment'?{allow:true}:null,order.status==='awaiting_payment'?null:error(-31008,'Buyurtmani to‘lab bo‘lmaydi.'));
      }
      if(method==='GetStatement'){
        const from=Number(params.from),to=Number(params.to);
        if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||to<from||to-from>93*864e5) rpcFail(-32602,'Vaqt oralig‘i xato.');
        const {rows}=await db.query("SELECT * FROM payment_transactions WHERE gateway='payme' AND create_time BETWEEN $1 AND $2 ORDER BY create_time LIMIT 10000",[from,to]);
        return response({transactions:rows.map(t=>({id:t.gateway_id,time:Number(t.create_time),amount:t.amount*100,account:{order_id:t.order_id},create_time:Number(t.create_time),perform_time:Number(t.perform_time),cancel_time:Number(t.cancel_time),transaction:String(t.id),state:t.state,reason:t.reason}))});
      }
      if(!['CreateTransaction','PerformTransaction','CancelTransaction','CheckTransaction'].includes(method)) rpcFail(-32601,'Metod topilmadi.');
      if(typeof params.id!=='string'||!params.id.length||params.id.length>120) rpcFail(-32602,'Tranzaksiya ID xato.');
      await db.query('BEGIN');
      let t=(await db.query("SELECT * FROM payment_transactions WHERE gateway='payme' AND gateway_id=$1 FOR UPDATE",[params.id])).rows[0];
      let result;
      if(method==='CreateTransaction'){
        const orderId=params.account.order_id;
        const o=(await db.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[orderId])).rows[0];
        if(!o || o.payment_method!=='payme') rpcFail(-31050,'Buyurtma topilmadi.','account.order_id');
        if(o.total*100!==params.amount) rpcFail(-31001,'Summa buyurtmaga mos emas.');
        if(!t){
          if(o.status!=='awaiting_payment') rpcFail(-31008,'Buyurtmani to‘lab bo‘lmaydi.');
          if(!Number.isSafeInteger(params.time)||Math.abs(Date.now()-params.time)>12*3600e3) rpcFail(-31008,'Tranzaksiya vaqti xato.');
          const other=await db.query('SELECT id FROM payment_transactions WHERE order_id=$1 AND state IN(1,2) LIMIT 1',[orderId]);
          if(other.rowCount) rpcFail(-31008,'Boshqa to‘lov jarayonda.');
          t=(await db.query("INSERT INTO payment_transactions(gateway,gateway_id,order_id,amount,state,create_time) VALUES('payme',$1,$2,$3,1,$4) RETURNING *",[params.id,orderId,o.total,Date.now()])).rows[0];
        }
        if(t.order_id!==orderId) rpcFail(-31008,'Tranzaksiya boshqa buyurtmaga tegishli.');
        result={create_time:Number(t.create_time),transaction:String(t.id),state:t.state};
      } else {
        if(!t) rpcFail(-31003,'Tranzaksiya topilmadi.');
        const o=(await db.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[t.order_id])).rows[0];
        if(method==='PerformTransaction'){
          if(t.state===1){
            if(o.status!=='awaiting_payment') rpcFail(-31008,'Buyurtma holati to‘lovga mos emas.');
            t=(await db.query('UPDATE payment_transactions SET state=2,perform_time=$2 WHERE id=$1 RETURNING *',[t.id,Date.now()])).rows[0];
            await db.query("UPDATE orders SET status='new',payment_status='paid',updated_at=now() WHERE id=$1",[t.order_id]);
          } else if(t.state!==2) rpcFail(-31008,'Tranzaksiya holati xato.');
          result={transaction:String(t.id),perform_time:Number(t.perform_time),state:t.state};
        } else if(method==='CancelTransaction'){
          if(t.state===1||t.state===2){
            if(['handed_over','in_transit','delivered'].includes(o.status)) rpcFail(-31007,'Buyurtma topshirilgan.');
            const previous=t.state;
            t=(await db.query('UPDATE payment_transactions SET state=$2,cancel_time=$3,reason=$4 WHERE id=$1 RETURNING *',[t.id,previous===1?-1:-2,Date.now(),Number(params.reason)||null])).rows[0];
            if(o.status!=='cancelled') await releaseOrder(db,t.order_id,previous===2);
          }
          result={transaction:String(t.id),cancel_time:Number(t.cancel_time),state:t.state};
        } else result={create_time:Number(t.create_time),perform_time:Number(t.perform_time),cancel_time:Number(t.cancel_time),transaction:String(t.id),state:t.state,reason:t.reason};
      }
      await db.query('COMMIT'); return response(result);
    }catch(e){ try{await db.query('ROLLBACK');}catch{} if(!e.code || typeof e.code!=='number') console.error('Payme callback:',e.message); return response(null,typeof e.code==='number'?e:error(-32400,'Tizim xatosi.')); }
    finally{db.release();}
  });
  for(const action of ['prepare','complete']) app.post('/api/payments/click/'+action,async(req,res)=>{
    const p=req.body||{},complete=action==='complete';
    const out=(code,note,extra={})=>res.json({click_trans_id:p.click_trans_id,merchant_trans_id:p.merchant_trans_id,error:code,error_note:note,...extra});
    if(!ready('click')) return res.status(503).json({error:-8,error_note:'Service unavailable'});
    if(String(p.action)!==(complete?'1':'0')) return out(-3,'Action not found');
    if(String(p.service_id)!==process.env.CLICK_SERVICE_ID || !compare(String(p.sign_string||'').toLowerCase(),clickSignature(p,process.env.CLICK_SECRET_KEY,complete))) return out(-1,'SIGN CHECK FAILED');
    if(!idOk(p.merchant_trans_id)||!/^\d+$/.test(String(p.click_trans_id||''))) return out(-5,'User does not exist');
    const db=await pool.connect();
    try{
      await db.query('BEGIN');
      const o=(await db.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[p.merchant_trans_id])).rows[0];
      if(!o||o.payment_method!=='click') return await done(-5,'User does not exist');
      if(!Number.isFinite(Number(p.amount))||Number(p.amount)!==o.total) return await done(-2,'Incorrect parameter amount');
      let t=(await db.query("SELECT * FROM payment_transactions WHERE gateway='click' AND gateway_id=$1 FOR UPDATE",[String(p.click_trans_id)])).rows[0];
      async function done(code,note,extra={}) { await db.query('COMMIT');return out(code,note,extra); }
      if(!complete){
        if(Number(p.error)!==0) return await done(-8,'Error in request from click');
        if(o.status!=='awaiting_payment' && !t) return await done(-4,'Already paid');
        if(!t){
          const other=await db.query('SELECT id FROM payment_transactions WHERE order_id=$1 AND state IN(1,2) LIMIT 1',[o.id]);
          if(other.rowCount) return await done(-4,'Already paid');
          t=(await db.query("INSERT INTO payment_transactions(gateway,gateway_id,order_id,amount,state,create_time) VALUES('click',$1,$2,$3,1,$4) RETURNING *",[String(p.click_trans_id),o.id,o.total,Date.now()])).rows[0];
        }
        if(t.order_id!==o.id||t.state!==1) return await done(-4,'Already paid');
        return await done(0,'Success',{merchant_prepare_id:t.id});
      }
      if(!t||String(t.id)!==String(p.merchant_prepare_id)||t.order_id!==o.id) return await done(-6,'Transaction does not exist');
      if(Number(p.error)!==0){
        if(t.state===1){await db.query('UPDATE payment_transactions SET state=-1,cancel_time=$2 WHERE id=$1',[t.id,Date.now()]);if(o.status!=='cancelled') await releaseOrder(db,o.id);}
        return await done(-9,'Transaction cancelled');
      }
      if(t.state===2) return await done(0,'Success',{merchant_confirm_id:t.id});
      if(t.state!==1||o.status!=='awaiting_payment') return await done(-9,'Transaction cancelled');
      await db.query('UPDATE payment_transactions SET state=2,perform_time=$2 WHERE id=$1',[t.id,Date.now()]);
      await db.query("UPDATE orders SET status='new',payment_status='paid',updated_at=now() WHERE id=$1",[o.id]);
      return await done(0,'Success',{merchant_confirm_id:t.id});
    }catch(e){try{await db.query('ROLLBACK');}catch{}console.error('Click callback:',e.message);return out(-8,'Error in request from click');}finally{db.release();}
  });
}
