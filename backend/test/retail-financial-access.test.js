import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { signAuthToken } from '../src/utils/tokens.js';

test('retail cost valuation, expense permissions and report totals', { skip: process.env.ZERA_INTEGRATION !== '1' }, async () => {
  if (!process.env.DATABASE_URL?.includes(':5548/zera_project_test')) throw new Error('Isolated test database required.');
  const business = await prisma.business.create({ data: { name: `Valuation ${randomUUID()}`, type: 'Retail shop', modules: { create: ['POS','INVENTORY','FINANCE','REPORTS'].map(key => ({key, active:true})) } } });
  const branch = await prisma.branch.create({data:{name:'Main', businessId:business.id}});
  const users = [];
  async function member(name) {
    const role = await prisma.role.create({data:{name,businessId:business.id}});
    const user = await prisma.user.create({data:{name,email:`${randomUUID()}@example.test`,passwordHash:'test-only',memberships:{create:{businessId:business.id,roleId:role.id}}}});
    users.push(user.id); return user;
  }
  const owner = await member('Owner'), keeper = await member('Store Keeper'), cashier = await member('Cashier');
  const server = app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  async function call(path, user=owner, method='GET', body) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{Authorization:`Bearer ${signAuthToken(user)}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    return {status:response.status,data:await response.json()};
  }
  try {
    for (const [name, quantity, cost] of [['Costed',3,'12.50'],['Free',2,'0'],['Missing',4,null]]) {
      const product = await prisma.product.create({data:{name,price:900,businessId:business.id,...(cost===null?{}:{privateCost:{create:{amount:cost}}})}});
      await prisma.inventoryStock.create({data:{productId:product.id,businessId:business.id,branchId:branch.id,quantity}});
    }
    const inventory = `/inventory/business/${business.id}/branch/${branch.id}`;
    const valued = await call(inventory);
    assert.equal(valued.status,200);
    assert.equal(valued.data.valuation.value,37.5);
    assert.equal(valued.data.valuation.missingCostProducts,1);
    const staffStock = await call(inventory,keeper);
    assert.equal(staffStock.status,200);
    assert.equal(staffStock.data.valuation,null);
    assert.ok(staffStock.data.stockItems.every(row=>!('privateCost' in row.product)&&!('costPrice' in row.product)));
    await prisma.business.update({where:{id:business.id},data:{taxEnabled:true,taxRate:18}});
    const soldProduct = await prisma.product.findFirst({where:{businessId:business.id,name:'Costed'}});
    const sold = await call('/pos/sales',owner,'POST',{businessId:business.id,branchId:branch.id,paymentMethod:'CASH',items:[{productId:soldProduct.id,quantity:1}]});
    assert.equal(sold.status,201,JSON.stringify(sold));
    const expenses = `/finance/business/${business.id}/expenses`;
    const payload = {title:'Shop transport',amount:'100.50',branchId:branch.id};
    assert.equal((await call(expenses,cashier,'POST',payload)).status,403);
    assert.equal((await call(expenses,keeper,'POST',{...payload,amount:'1.001'})).status,400);
    const created = await call(expenses,keeper,'POST',payload);
    assert.equal(created.status,201);
    assert.equal(created.data.expense.status,'PENDING');
    const id = created.data.expense.id;
    assert.equal((await call(`${expenses}/${id}/status`,keeper,'PATCH',{status:'APPROVED'})).status,403);
    assert.equal((await call(`/finance/business/${business.id}/summary`,keeper)).status,403);
    assert.equal((await call(`${expenses}/${id}/status`,owner,'PATCH',{status:'APPROVED'})).status,200);
    await call(expenses,owner,'POST',{...payload,amount:'20'});
    const ownList = await call(expenses,keeper);
    assert.equal(ownList.data.total,1);
    assert.equal(ownList.data.expenses[0].id,id);
    const report = await call(`/reports/business/${business.id}/summary`);
    assert.equal(report.status,200);
    assert.equal(report.data.report.expenses.APPROVED.amount,100.5);
    assert.equal(report.data.report.expenses.PENDING.amount,20);
    assert.equal(report.data.report.summary.totalSales,1062);
    assert.equal(report.data.report.summary.taxCollected,162);
    assert.equal(report.data.report.summary.netSales,900);
    assert.equal(report.data.report.staffRows.length,1);
    assert.equal(report.data.report.staffRows[0].role,'Cashier');
    const cashierReport = await call(`/reports/business/${business.id}/summary`,cashier);
    assert.equal(cashierReport.data.report.expenses,null);
    await prisma.business.update({where:{id:business.id},data:{type:'Hotel'}});
    assert.equal((await call(expenses,keeper)).status,403);
    assert.equal((await call(expenses,keeper,'POST',payload)).status,403);
    await prisma.business.update({where:{id:business.id},data:{type:'Retail shop'}});
    await prisma.businessModule.update({where:{businessId_key:{businessId:business.id,key:'FINANCE'}},data:{active:false}});
    assert.equal((await call(expenses,keeper,'POST',payload)).status,403);
  } finally {
    await new Promise(resolve=>server.close(resolve));
    await prisma.saleItem.deleteMany({where:{sale:{businessId:business.id}}});
    await prisma.business.delete({where:{id:business.id}});
    await prisma.user.deleteMany({where:{id:{in:users}}});
    await prisma.$disconnect();
  }
});
