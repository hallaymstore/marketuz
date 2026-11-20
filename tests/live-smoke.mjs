// Run manually against a disposable preview. Reads admin credentials as one JSON line from stdin.
import assert from 'node:assert/strict';
import { createInterface } from 'node:readline';
import { randomBytes } from 'node:crypto';

const rl=createInterface({input:process.stdin});
const input=await new Promise(resolve=>rl.once('line',resolve)); rl.close();
const {email,password}=JSON.parse(input);
const base=(process.env.MARKETUZ_BASE_URL||'http://localhost:3000')+'/api';
async function call(path,{method='GET',body,cookie}={}) {
  const r=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
  const data=await r.json(); if(!r.ok) throw new Error(`${method} ${path}: ${r.status} ${data.error}`);
  return {data,cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
const suffix=Date.now();
const demoPassword=randomBytes(20).toString('base64url');
const admin=(await call('/auth/login',{method:'POST',body:{email,password}})).cookie;
assert.ok(admin,'admin session');
for (const old of (await call('/admin/sellers',{cookie:admin})).data.sellers.filter(x=>x.seller_status==='pending'&&x.email.startsWith('qa-seller-'))) {
  await call('/admin/sellers/'+old.id,{method:'PATCH',body:{status:'rejected'},cookie:admin});
}
const buyer=(await call('/auth/register',{method:'POST',body:{name:'QA Xaridor',email:`qa-buyer-${suffix}@example.invalid`,password:demoPassword,agree:true}})).cookie;
const seller=(await call('/auth/register',{method:'POST',body:{name:'QA Sotuvchi',email:`qa-seller-${suffix}@example.invalid`,password:demoPassword,agree:true}})).cookie;
await call('/seller/request',{method:'POST',body:{},cookie:seller});
const sellerList=(await call('/admin/sellers',{cookie:admin})).data.sellers;
const requested=sellerList.find(x=>x.email===`qa-seller-${suffix}@example.invalid`); assert.ok(requested,'seller request');
await call('/admin/sellers/'+requested.id,{method:'PATCH',body:{status:'approved'},cookie:admin});
const product=(await call('/seller/products',{method:'POST',cookie:seller,body:{name:'QA sinov chirog‘i',description:'Faqat funksional tekshiruv uchun',category:'uy',price:99000,oldPrice:129000,stock:3,image:'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&q=80'}})).data.product;
assert.equal(product.status,'pending');
await call('/admin/products/'+product.id,{method:'PATCH',cookie:admin,body:{status:'active'}});
const found=(await call('/catalog?q=QA%20sinov')).data.products; assert.ok(found.some(x=>String(x.id)===String(product.id)),'approved product visible');
await call('/favorites/'+product.id,{method:'PUT',cookie:buyer,body:{}});
const favs=(await call('/favorites',{cookie:buyer})).data.products; assert.ok(favs.some(x=>String(x.id)===String(product.id)),'favorite persisted');
const order=(await call('/orders',{method:'POST',cookie:buyer,body:{recipient:'QA Xaridor',phone:'+998 90 000 00 00',region:'Qashqadaryo',district:'Kasbi tumani',address:'Sinov ko‘chasi 1, haqiqiy manzil emas',paymentMethod:'cod',items:[{id:product.id,qty:2}]}})).data;
assert.equal(order.subtotal,198000);
const sellerOrders=(await call('/seller/orders',{cookie:seller})).data.items;
const item=sellerOrders.find(x=>x.order_id===order.id);assert.ok(item,'seller only order item');
await call('/seller/order-items/'+item.id,{method:'PATCH',cookie:seller,body:{status:'packing'}});
await call('/admin/orders/'+order.id,{method:'PATCH',cookie:admin,body:{status:'accepted',trackingNumber:'QA-TEST-NOT-A-SHIPMENT'}});
const buyerOrders=(await call('/orders',{cookie:buyer})).data.orders;
assert.ok(buyerOrders.some(x=>x.id===order.id&&x.tracking_number==='QA-TEST-NOT-A-SHIPMENT'),'buyer tracking visible');
await call('/orders/'+order.id+'/cancel',{method:'POST',cookie:buyer,body:{}});
const stock=(await call('/products/'+product.id)).data.product.stock;assert.equal(stock,3,'cancel restores stock');
await call('/seller/products/'+product.id,{method:'DELETE',cookie:seller,body:{}});
console.log(JSON.stringify({ok:true,tests:['admin login','buyer registration','seller approval','product moderation','catalog search','favorites','checkout','seller order','tracking','cancel and restock','archive'],testOrder:order.id}));
