import test from 'node:test';
import assert from 'node:assert/strict';
import {checkoutStorageKey,saveCheckoutAttempt,readCheckoutAttempt,clearCheckoutAttempt} from '../../frontend/src/utils/checkoutRecovery.js';

function store() {
  const values = new Map();
  return {getItem:key=>values.get(key) ?? null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
}
function fixture() {
  const payload={businessId:'shop1',branchId:'branch1',paymentMethod:'CASH',discountAmount:0,items:[{productId:'product1',quantity:2,unitPrice:'1200.50'}]};
  return {key:'checkout-request-123456',payload,fingerprint:JSON.stringify(payload),cart:[{product:{id:'product1',name:'Necklace',price:'0',unit:null,type:'PHYSICAL'},quantity:2,enteredPrice:'1200.50'}]};
}
test('checkout recovery survives serialization and is isolated by cashier, business and branch',()=>{
  const storage=store(), key=checkoutStorageKey('cashier1','shop1','branch1');
  saveCheckoutAttempt(storage,key,fixture());
  const restored=readCheckoutAttempt(storage,key);
  assert.equal(restored.key,fixture().key);
  assert.deepEqual(restored.payload,fixture().payload);
  assert.equal(restored.cart[0].enteredPrice,'1200.50');
  assert.equal(restored.cart[0].quantity,2);
  for(const other of [checkoutStorageKey('cashier2','shop1','branch1'),checkoutStorageKey('cashier1','shop2','branch1'),checkoutStorageKey('cashier1','shop1','branch2')]) assert.equal(readCheckoutAttempt(storage,other),null);
  assert.equal(checkoutStorageKey(null,'shop1','branch1'),null);
});
test('successful checkout only clears its own saved attempt',()=>{
  const storage=store(), key=checkoutStorageKey('cashier1','shop1','branch1');
  saveCheckoutAttempt(storage,key,fixture());
  clearCheckoutAttempt(storage,key,'different-request-1234');
  assert.ok(readCheckoutAttempt(storage,key));
  clearCheckoutAttempt(storage,key,fixture().key);
  assert.equal(readCheckoutAttempt(storage,key),null);
});
test('invalid recovery is retained for investigation and storage failure blocks submission',()=>{
  const storage=store(), key='test-checkout';
  for(const invalid of ['{broken',JSON.stringify({...fixture(),version:1,fingerprint:'changed'}),JSON.stringify({...fixture(),version:2}),JSON.stringify({...fixture(),version:1,cart:[{product:{id:'product1',name:'Product',price:0},quantity:-2}]})]) {
    storage.setItem(key,invalid);
    assert.throws(()=>readCheckoutAttempt(storage,key),/Check Sales/);
    assert.equal(storage.getItem(key),invalid);
  }
  assert.throws(()=>saveCheckoutAttempt({setItem:()=>{throw new Error('Quota');}},key,fixture()),/No sale was submitted/);
});
