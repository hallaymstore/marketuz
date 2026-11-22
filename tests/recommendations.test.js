import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInterests, rankProducts } from '../recommendations.js';

const items = [
  {id:1,name:'Charm sumka',category:'aksessuar',price:120000,stock:4,sold_count:0},
  {id:2,name:'Qishki charm hamyon',category:'aksessuar',price:80000,stock:0,stock_mode:'replenishable',sold_count:0},
  {id:3,name:'Sport gilamcha',category:'sport',price:90000,stock:4,sold_count:20},
  {id:4,name:'Sovg‘a tasmasi',category:'uy',price:20000,stock:0,sold_count:100}
];

test('search and meaningful dwell inform recommendations; unavailable items stay out', () => {
  const events=[
    {kind:'search',query:'charm hamyon',created_at:new Date().toISOString()},
    {kind:'dwell',id:1,category:'aksessuar',name:'Charm sumka',duration_seconds:85,created_at:new Date().toISOString()}
  ];
  const interests=buildInterests(events);
  const ranked=rankProducts(items,interests,{limit:4});
  assert.equal(ranked[0].id,2);
  assert.ok(!ranked.some(p=>p.id===4));
});

test('co-purchased complements outrank generic popularity for a product', () => {
  const ranked=rankProducts(items,null,{context:items[0],together:new Map([['3',4]]),limit:3});
  assert.equal(ranked[0].id,3);
  assert.equal(ranked[0].reason,'Birga xarid qilishadi');
  assert.ok(!ranked.some(p=>p.id===1));
});
