import test from 'node:test';
import assert from 'node:assert/strict';
import { clickSignature, mountPayments } from '../payment-handlers.js';

test('Click rejects forged callbacks and confirms only signed matching transactions once',async()=>{
  const previous={CLICK_SERVICE_ID:process.env.CLICK_SERVICE_ID,CLICK_SECRET_KEY:process.env.CLICK_SECRET_KEY};
  process.env.CLICK_SERVICE_ID='service-test';process.env.CLICK_SECRET_KEY='test-secret';
  const id='00000000-0000-4000-8000-000000000001';
  const order={id,total:1000,status:'awaiting_payment',payment_method:'click',payment_status:'pending'};
  const handlers=new Map(),transactions=new Map();let connections=0,updates=0;
  const db={
    release(){},
    async query(sql,args=[]){
      if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return {rows:[],rowCount:0};
      if(sql.includes('SELECT * FROM orders WHERE id='))return {rows:[order],rowCount:1};
      if(sql.includes("SELECT * FROM payment_transactions WHERE gateway='click'")){const t=transactions.get(args[0]);return {rows:t?[t]:[],rowCount:t?1:0};}
      if(sql.includes('SELECT id FROM payment_transactions WHERE order_id='))return {rows:[],rowCount:0};
      if(sql.includes('INSERT INTO payment_transactions')){const t={id:1,order_id:id,state:1};transactions.set(args[0],t);return {rows:[t],rowCount:1};}
      if(sql.includes('UPDATE payment_transactions SET state=2')){transactions.get('42').state=2;return {rows:[],rowCount:1};}
      if(sql.includes("UPDATE orders SET status='new'")){order.status='new';order.payment_status='paid';updates++;return {rows:[],rowCount:1};}
      throw Error('Unexpected SQL: '+sql);
    }
  };
  const pool={async connect(){connections++;return db;}};
  const app={post(route,handler){handlers.set(route,handler);}};
  mountPayments(app,pool,()=>true);
  async function call(action,body){
    let output,status=200;
    const res={status(code){status=code;return this;},json(value){output=value;return this;}};
    await handlers.get('/api/payments/click/'+action)({body,get(){return ''; }},res);
    return {status,output};
  }
  const prepare={click_trans_id:'42',service_id:'service-test',merchant_trans_id:id,amount:'1000.00',action:'0',error:'0',sign_time:'2026-11-24 12:00:00'};
  try{
    assert.equal((await call('prepare',{...prepare,sign_string:'forged'})).output.error,-1);
    assert.equal(connections,0);
    const wrong={...prepare,amount:'999.00'};wrong.sign_string=clickSignature(wrong,'test-secret');
    assert.equal((await call('prepare',wrong)).output.error,-2);
    prepare.sign_string=clickSignature(prepare,'test-secret');
    const first=await call('prepare',prepare);
    assert.equal(first.output.error,0);assert.equal(first.output.merchant_prepare_id,1);
    assert.equal((await call('prepare',prepare)).output.merchant_prepare_id,1);
    const complete={...prepare,action:'1',merchant_prepare_id:'1'};complete.sign_string=clickSignature(complete,'test-secret',true);
    assert.equal((await call('complete',complete)).output.error,0);
    assert.equal((await call('complete',complete)).output.error,0);
    assert.equal(order.payment_status,'paid');assert.equal(updates,1);
  }finally{
    for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  }
});
