import test from 'node:test';
import assert from 'node:assert/strict';
import { operationIssues } from '../../frontend/src/utils/operationIssues.js';
const product={id:'p',name:'Necklace',status:'ACTIVE',type:'PHYSICAL',price:100,minimumPrice:70,sku:'N1'};
test('operations shows absent stock even without a reorder alert, and combines price/code issues',()=>{
 const rows=operationIssues([{...product,price:0,minimumPrice:0,sku:null}],[],true);
 assert.equal(rows.length,1);
 assert.deepEqual(rows[0].issues,['Out of stock','Manual price','No minimum price','Missing code']);
 assert.equal(rows[0].quantity,0);
});
test('operations excludes paused items and avoids stock alerts for services or disabled inventory',()=>{
 assert.deepEqual(operationIssues([{...product,status:'INACTIVE'}],[],true),[]);
 assert.deepEqual(operationIssues([{...product,type:'SERVICE'}],[],true),[]);
 assert.deepEqual(operationIssues([product],[],false),[]);
});
test('operations distinguishes low stock from zero stock and respects branch snapshot balances',()=>{
 assert.deepEqual(operationIssues([product],[{productId:'p',quantity:3,reorderLevel:3}],true)[0].issues,['Low stock']);
 assert.deepEqual(operationIssues([product],[{productId:'p',quantity:4,reorderLevel:3}],true),[]);
});
