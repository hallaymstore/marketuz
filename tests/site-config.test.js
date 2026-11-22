import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults,seasonalState,validateSite } from '../site-config.js';
import { clickSignature } from '../payment-handlers.js';

test('seasonal dates use Uzbekistan time and holiday overrides are scoped',()=>{
  assert.equal(seasonalState(defaults,new Date('2026-11-22T00:30:00Z')).season,'winter');
  assert.equal(seasonalState(defaults,new Date('2027-03-21T00:30:00Z')).holiday,'navruz');
  assert.equal(seasonalState(defaults,new Date('2027-09-01T00:30:00Z')).holiday,'independence');
  const custom=validateSite({...defaults,theme:{...defaults.theme,holiday:'eid',customStart:'2027-03-29',customEnd:'2027-03-30'}});
  assert.equal(seasonalState(custom,new Date('2027-03-21T00:30:00Z')).holiday,null);
  assert.equal(seasonalState(custom,new Date('2027-03-29T00:30:00Z')).holiday,'eid');
});
test('settings whitelist media and reject unsafe URL',()=>{
  const next=validateSite({...defaults,brand:{...defaults.brand,logo:'/media/12345678-1234-1234-1234-123456789abc'},theme:{...defaults.theme,holidayArt:{eid:{hero:'/assets/seasons/eid-hero.webp',column:'/media/12345678-1234-1234-1234-123456789abc'}}},content:{...defaults.content,storyOneImage:'/media/12345678-1234-1234-1234-123456789abc'}});
  assert.equal(next.brand.logo,'/media/12345678-1234-1234-1234-123456789abc');
  assert.equal(next.theme.holidayArt.eid.hero,'/assets/seasons/eid-hero.webp');
  assert.equal(next.theme.holidayArt.eid.column,next.content.storyOneImage);
  assert.throws(()=>validateSite({...defaults,seo:{...defaults.seo,siteUrl:'javascript:alert(1)'}}));
  assert.throws(()=>validateSite({...defaults,brand:{...defaults.brand,logo:'data:image/svg+xml,<svg/>'}}));
  assert.throws(()=>validateSite({...defaults,content:{...defaults.content,authImage:'javascript:alert(1)'}}));
});
test('Click complete signature includes the merchant prepare ID',()=>{
  const body={click_trans_id:'123',service_id:'456',merchant_trans_id:'order',merchant_prepare_id:'789',amount:'1000.00',action:'1',sign_time:'2026-11-22 12:00:00'};
  assert.notEqual(clickSignature(body,'secret',false),clickSignature(body,'secret',true));
  assert.match(clickSignature(body,'secret',true),/^[a-f0-9]{32}$/);
});
