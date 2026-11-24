import test from 'node:test';
import assert from 'node:assert/strict';
import { canAdvanceOrder, checkoutContainsCardData, hasCardNumber } from '../order-safety.js';

test('checkout rejects card data while ordinary delivery details remain valid',()=>{
  assert.equal(hasCardNumber('8600 1234 5678 9013'),false);
  assert.equal(hasCardNumber('4111 1111 1111 1111'),true);
  const safe={recipient:'Xaridor',phone:'+998 90 123 45 67',address:'Kasbi tumani, 10-uy',items:[{id:1,qty:1}],agree:'on',paymentMethod:'click'};
  assert.equal(checkoutContainsCardData(safe),false);
  assert.equal(checkoutContainsCardData({...safe,cardNumber:'4111111111111111'}),true);
  assert.equal(checkoutContainsCardData({...safe,note:'4111 1111 1111 1111'}),true);
  assert.equal(checkoutContainsCardData({...safe,items:[{id:1,qty:1,cvv:'123'}]}),true);
});

test('delivery cannot skip stages or reopen finished orders',()=>{
  assert.equal(canAdvanceOrder('new','accepted'),true);
  assert.equal(canAdvanceOrder('accepted','packing'),true);
  assert.equal(canAdvanceOrder('packing','handed_over'),true);
  assert.equal(canAdvanceOrder('handed_over','in_transit'),true);
  assert.equal(canAdvanceOrder('in_transit','delivered'),true);
  assert.equal(canAdvanceOrder('new','delivered'),false);
  assert.equal(canAdvanceOrder('awaiting_payment','accepted'),false);
  assert.equal(canAdvanceOrder('delivered','cancelled'),false);
  assert.equal(canAdvanceOrder('cancelled','new'),false);
});
