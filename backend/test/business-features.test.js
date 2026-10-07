import test from 'node:test';
import assert from 'node:assert/strict';
import { businessFeatures } from '../src/config/businessFeatures.js';
const modules=['POS','OPERATIONS','INVENTORY'].map(key=>({key,active:true}));
const retail={type:'Retail shop',posMode:'RETAIL_CHECKOUT',status:'ACTIVE',modules};
test('retail capabilities depend on type and modules, never organization identity',()=>{
 const a=businessFeatures({...retail,id:'one',name:'Adrona'}),b=businessFeatures({...retail,id:'two',name:'Another retailer'});
 assert.deepEqual(a,b);
 for(const key of ['retailCheckout','negotiatedPricing','productIssues','dailySales','cashCounts','stockNotifications','cashNotifications'])assert.equal(a[key],true,key);
 assert.equal(a.tableService,false);
});
test('linked business-type key survives renamed display labels and defines workflow profile',()=>{
 assert.equal(businessFeatures({...retail,type:'Boutique',platformBusinessType:{key:'RETAIL_SHOP'}}).profile,'RETAIL');
 assert.equal(businessFeatures({...retail,type:'Hotel'}).productIssues,false);
 const table=businessFeatures({...retail,type:'Bar and restaurant',posMode:'TABLE_SERVICE'});
 assert.equal(table.tableService,true);assert.equal(table.retailCheckout,false);assert.equal(table.productIssues,false);
 assert.equal(businessFeatures({...retail,type:'Unrecognized business'}).profile,'SERVICE');
});
test('module removal and suspended packages disable dependent features',()=>{
 const noPos=businessFeatures({...retail,modules:modules.filter(item=>item.key!=='POS')});
 assert.equal(noPos.cashCounts,false);assert.equal(noPos.cashNotifications,false);assert.equal(noPos.stockNotifications,true);
 const disabled=businessFeatures({...retail,modules:modules.map(item=>({...item,active:false}))});
 for(const value of Object.values(disabled).filter(value=>typeof value==='boolean'))assert.equal(value,false);
 const suspended=businessFeatures({...retail,packageStatus:'SUSPENDED'});
 assert.equal(suspended.cashCounts,false);assert.equal(suspended.stockNotifications,false);
});
