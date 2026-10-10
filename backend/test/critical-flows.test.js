import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { signAuthToken } from '../src/utils/tokens.js';

test('Zera checkout, stock, finance and sync regression suite', { skip: process.env.ZERA_INTEGRATION !== '1' }, async t => {
  if (!process.env.DATABASE_URL?.includes(':5548/zera_project_test')) throw new Error('Use the isolated zera_project_test database on port 5548.');
  const suffix = randomUUID();
  const business = await prisma.business.create({ data: {
    name: `Regression ${suffix}`, type: 'Retail shop', taxEnabled: true, taxRate: 18,
    modules: { create: ['POS','FINANCE','REPORTS','OPERATIONS','INVENTORY'].map(key => ({ key, active: true })) }
  } });
  const foreign = await prisma.business.create({ data: { name: `Foreign ${suffix}` } });
  const branch = await prisma.branch.create({ data: { name: 'Main', businessId: business.id } });
  const makeUser = async name => {
    const role = await prisma.role.create({ data: { name, businessId: business.id } });
    return prisma.user.create({ data: { name, email: `${name}-${suffix}@example.test`, passwordHash: 'fixture-only', memberships: { create: { businessId: business.id, roleId: role.id } } } });
  };
  const owner = await makeUser('Owner'), cashier = await makeUser('Cashier');
  const product = await prisma.product.create({ data: { name: 'Regression product', price: 100, businessId: business.id } });
  const stock = await prisma.inventoryStock.create({ data: { productId: product.id, branchId: branch.id, businessId: business.id, quantity: 10 } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const call = async (path, { method = 'GET', body, user = owner } = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${signAuthToken(user)}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return { status: response.status, data: response.headers.get("content-type")?.includes("text/csv") ? await response.text() : await response.json() };
  };
  const sale = (discountAmount = 0) => call('/pos/sales', { method: 'POST', body: { businessId: business.id, branchId: branch.id, paymentMethod: 'CASH', discountAmount, items: [{ productId: product.id, quantity: 1 }] } });
  const balance = async () => (await prisma.inventoryStock.findUnique({ where: { id: stock.id } })).quantity;
  const expectStatus = (result, expected) => assert.equal(result.status, expected, JSON.stringify(result));
  try {
    await t.test('installer requests are durable, deduplicated, permission checked and invalidated by configuration changes', async () => {
      const admin = await prisma.user.create({data:{name:'Build admin',email:`build-${suffix}@example.test`,passwordHash:'fixture-only',systemRole:'SYSTEM_ADMIN'}});
      const plan = await prisma.platformPackage.create({data:{key:`BUILD-${suffix}`,name:'Build test'}});
      await prisma.business.update({where:{id:business.id},data:{platformPackageId:plan.id}});
      const platform = process.platform === 'darwin' ? 'mac' : 'windows';
      const url = `/system-admin/businesses/${business.id}`;
      expectStatus(await call(`${url}/desktop-installers`,{method:'POST',body:{platform}}),403);
      const requests = await Promise.all([1,2].map(() => call(`${url}/desktop-installers`,{method:'POST',body:{platform},user:admin})));
      requests.forEach(result => expectStatus(result,202));
      assert.equal(requests[0].data.installer.id,requests[1].data.installer.id);
      const history = await call(`${url}/installations`,{user:admin}); expectStatus(history,200);
      assert.equal(history.data.builds[0].status,'QUEUED');
      assert.equal(history.data.builds[0].manifest,undefined);
      assert.equal(history.data.builds[0].outdated,false);
      await prisma.business.update({where:{id:business.id},data:{brandPrimaryColor:'#123456'}});
      const changed = await call(`${url}/installations`,{user:admin}); expectStatus(changed,200);
      assert.equal(changed.data.builds[0].outdated,true);
      await prisma.installerBuild.update({where:{id:requests[0].data.installer.id},data:{status:'READY',fileName:'test.dmg',sha256:'fake'}});
      expectStatus(await call(`${url}/desktop-installers/${platform}/download`,{user:admin}),409);
      await prisma.installerBuild.update({where:{id:requests[0].data.installer.id},data:{status:'FAILED'}});
    });
    await t.test('shop accounts cannot administer the platform and disabled accounts lose API access', async () => {
      expectStatus(await call('/system-admin/businesses'), 403);
      expectStatus(await call('/system-admin/businesses', { user: cashier }), 403);
      await prisma.user.update({ where: { id: cashier.id }, data: { status: 'INACTIVE' } });
      try {
        expectStatus(await call(`/reports/business/${business.id}/summary`, { user: cashier }), 401);
      } finally {
        await prisma.user.update({ where: { id: cashier.id }, data: { status: 'ACTIVE' } });
      }
    });
    await t.test('discounted tax reconciles across finance, payment and branch summaries', async () => {
      const receipt = await sale(10); expectStatus(receipt, 201);
      assert.equal(Number(receipt.data.sale.total), 106.2);
      const result = await call(`/finance/business/${business.id}/summary`); expectStatus(result, 200);
      assert.equal(result.data.finance.summary.taxCollected, 16.2);
      assert.equal(result.data.finance.paymentRows[0].taxCollected, 16.2);
      assert.equal(result.data.finance.branchRows[0].taxCollected, 16.2);
      const report = await call(`/reports/business/${business.id}/summary`); expectStatus(report, 200);
      assert.equal(report.data.report.summary.taxCollected, 16.2);
      const voids = await Promise.all([1,2].map(() => call(`/pos/sales/business/${business.id}/${receipt.data.sale.id}/void`, { method: 'PATCH' })));
      assert.equal(voids.filter(result => result.status === 200).length, 1, JSON.stringify(voids));
      assert.equal(await balance(), 10);
    });
    await t.test('only one simultaneous checkout can buy the final unit', async () => {
      await prisma.inventoryStock.update({ where: { id: stock.id }, data: { quantity: 1 } });
      const results = await Promise.all([sale(), sale()]);
      assert.equal(results.filter(result => result.status === 201).length, 1, JSON.stringify(results));
      assert.equal(results.filter(result => result.status === 409).length, 1, JSON.stringify(results));
      assert.equal(await balance(), 0);
    });
    await t.test('simultaneous receipts of stock preserve both additions', async () => {
      const results = await Promise.all([3,4].map(quantity => call(`/inventory/business/${business.id}/branch/${branch.id}/products/${product.id}/receive`, { method: 'POST', body: { quantity } })));
      results.forEach(result => expectStatus(result, 200));
      assert.equal(await balance(), 7);
      const movements = await prisma.stockAdjustment.findMany({ where: { productId: product.id, type: 'INCREASE', note: 'Received stock' }, orderBy: { quantityAfter: 'asc' } });
      assert.equal(movements.length, 2);
      assert.equal(movements[0].quantityBefore, 0);
      assert.equal(movements[1].quantityBefore, movements[0].quantityAfter);
      assert.equal(movements[1].quantityAfter, 7);
    });
    await t.test('one bill cannot be paid twice or both paid and cancelled', async () => {
      const table = await prisma.pOSTable.create({ data: { name: '1', businessId: business.id, branchId: branch.id, status: 'OCCUPIED' } });
      const makeOrder = () => prisma.pOSOrder.create({ data: { orderNumber: randomUUID(), subtotal: 100, total: 118, businessId: business.id, branchId: branch.id, tableId: table.id, waiterId: owner.id, items: { create: { productId: product.id, quantity: 1, unitPrice: 100, lineTotal: 100 } } } });
      const order = await makeOrder();
      const pay = id => call(`/pos/orders/${id}/pay`, { method: 'PATCH', body: { paymentMethod: 'CASH' } });
      const results = await Promise.all([pay(order.id), pay(order.id)]);
      assert.equal(results.filter(result => result.status === 200).length, 1, JSON.stringify(results));
      assert.equal(await balance(), 6);
      const second = await makeOrder();
      const race = await Promise.all([pay(second.id), call(`/pos/orders/${second.id}/cancel`, { method: 'PATCH' })]);
      assert.equal(race.filter(result => result.status === 200).length, 1, JSON.stringify(race));
      const finalOrder = await prisma.pOSOrder.findUnique({ where: { id: second.id } });
      assert.ok(['PAID','CANCELLED'].includes(finalOrder.status));
      assert.equal(await balance(), finalOrder.status === 'PAID' ? 5 : 6);
      const finalTable = await prisma.pOSTable.findUnique({ where: { id: table.id } });
      assert.equal(finalTable.status, 'AVAILABLE');
    });
    await t.test('report exports cross page boundaries and reject invalid dates', async () => {
      await prisma.sale.createMany({ data: Array.from({ length: 550 }, (_, index) => ({
        id: `export-${suffix}-${String(index).padStart(4, '0')}`, receiptNumber: `bulk-${suffix}-${index}`,
        businessId: business.id, branchId: branch.id, cashierId: owner.id,
        subtotal: 1, total: 1, paymentMethod: 'CASH'
      })) });
      const expected = await prisma.sale.count({ where: { businessId: business.id } });
      const exported = await call(`/reports/business/${business.id}/export`); expectStatus(exported, 200);
      assert.equal(exported.data.trim().split('\r\n').length - 1, expected);
      const summary = await call(`/reports/business/${business.id}/summary`); expectStatus(summary, 200);
      const counter = summary.data.report.staffRows.find(row => row.key === 'waiter-counter');
      assert.equal(counter, undefined, 'Counter sales are not waiter activity');
      const completedCount = await prisma.sale.count({ where: { businessId: business.id, status: 'COMPLETED' } });
      assert.equal(summary.data.report.staffRows.filter(row => row.role === 'Cashier').reduce((sum,row) => sum + row.quantity,0), completedCount);
      for (const path of [`/reports/business/${business.id}/export`, `/reports/business/${business.id}/summary`, `/finance/business/${business.id}/summary`]) {
        expectStatus(await call(`${path}?dateFrom=2026-02-30`), 400);
        expectStatus(await call(`${path}?dateFrom=2026-09-16&dateTo=2026-09-15`), 400);
      }
      expectStatus(await call(`/reports/business/${foreign.id}/export`), 403);
      const empty = await call(`/reports/business/${business.id}/export?paymentMethod=CARD`); expectStatus(empty, 200);
      assert.equal(empty.data.trim().split('\r\n').length, 1);
    });
    await t.test('transfers conserve stock under concurrency and reject invalid destinations', async () => {
      const destination = await prisma.branch.create({ data: { businessId: business.id, name: 'Receiving branch' } });
      const foreignBranch = await prisma.branch.create({ data: { businessId: foreign.id, name: 'Foreign branch' } });
      const item = await prisma.product.create({ data: { businessId: business.id, name: 'Transfer item', price: 1 } });
      const source = await prisma.inventoryStock.create({ data: { businessId: business.id, branchId: branch.id, productId: item.id, quantity: 10 } });
      const transfer = (fromBranchId, toBranchId, quantity) => call(`/inventory/business/${business.id}/transfer`, { method: 'POST', body: { fromBranchId, toBranchId, quantity, productId: item.id } });
      expectStatus(await transfer(branch.id, branch.id, 1), 400);
      expectStatus(await transfer(branch.id, foreignBranch.id, 1), 404);
      expectStatus(await transfer(branch.id, destination.id, 11), 400);
      assert.equal(await prisma.stockAdjustment.count({ where: { productId: item.id } }), 0);
      const outgoing = await Promise.all([transfer(branch.id, destination.id, 7), transfer(branch.id, destination.id, 7)]);
      assert.equal(outgoing.filter(result => result.status === 200).length, 1, JSON.stringify(outgoing));
      assert.equal(outgoing.filter(result => result.status === 400).length, 1, JSON.stringify(outgoing));
      const opposite = await Promise.all([transfer(branch.id, destination.id, 2), transfer(destination.id, branch.id, 2)]);
      opposite.forEach(result => expectStatus(result, 200));
      const stocks = await prisma.inventoryStock.findMany({ where: { productId: item.id } });
      assert.equal(stocks.reduce((sum, row) => sum + row.quantity, 0), 10);
      assert.equal(stocks.find(row => row.id === source.id).quantity, 3);
      const movements = await prisma.stockAdjustment.findMany({ where: { productId: item.id } });
      assert.equal(movements.length, 6);
      assert.equal(movements.reduce((sum, row) => sum + row.quantityChange, 0), 0);
      await prisma.branch.update({ where: { id: destination.id }, data: { status: 'INACTIVE' } });
      expectStatus(await transfer(branch.id, destination.id, 1), 409);
      expectStatus(await call(`/inventory/business/${business.id}/branch/${branch.id}/products/${item.id}/receive`, { method: 'POST', body: { quantity: true } }), 400);
    });
    await t.test('first stock receipts safely create one row and preserve both amounts', async () => {
      const item = await prisma.product.create({ data: { businessId: business.id, name: 'New stock item', price: 1 } });
      const results = await Promise.all([2, 3].map(quantity => call(`/inventory/business/${business.id}/branch/${branch.id}/products/${item.id}/receive`, { method: 'POST', body: { quantity } })));
      results.forEach(result => expectStatus(result, 200));
      const stocks = await prisma.inventoryStock.findMany({ where: { productId: item.id, branchId: branch.id } });
      assert.equal(stocks.length, 1);
      assert.equal(stocks[0].quantity, 5);
    });
    await t.test('purchasing approves, receives once, enforces roles and rolls back failed receipts', async () => {
      const base = `/purchasing/business/${business.id}`;
      const keeper = await makeUser('Store Keeper');
      expectStatus(await call(`${base}/suppliers`, { user: cashier }), 403);
      const supplierResult = await call(`${base}/suppliers`, { method: 'POST', body: { name: 'Supply partner', email: 'supply@example.test' } });
      expectStatus(supplierResult, 201);
      const supplier = supplierResult.data.supplier;
      const first = await prisma.product.create({ data: { businessId: business.id, name: 'Purchase A', price: 9 } });
      const second = await prisma.product.create({ data: { businessId: business.id, name: 'Purchase B', price: 7 } });
      const payload = { supplierId: supplier.id, branchId: branch.id, note: 'Test delivery', items: [{ productId: first.id, quantity: 3, unitCost: '1.25' }, { productId: second.id, quantity: 2, unitCost: '2.10' }] };
      const create = data => call(`${base}/orders`, { method: 'POST', body: data, user: keeper });
      const action = (id, step, user = owner) => call(`${base}/orders/${id}/${step}`, { method: 'POST', user });
      const bad = await create({ ...payload, items: [payload.items[0], payload.items[0]] }); expectStatus(bad, 400);
      expectStatus(await create({ ...payload, items: [{ ...payload.items[0], unitCost: '-1' }] }), 400);
      const created = await create(payload); expectStatus(created, 201);
      const order = created.data.order;
      assert.equal(order.status, 'DRAFT'); assert.equal(Number(order.total), 7.95);
      assert.equal(await prisma.inventoryStock.count({ where: { productId: first.id } }), 0);
      expectStatus(await action(order.id, 'receive', keeper), 409);
      expectStatus(await action(order.id, 'approve', keeper), 403);
      expectStatus(await call(`/purchasing/business/${foreign.id}/orders`), 403);
      expectStatus(await action(order.id, 'approve'), 200);
      const receipts = await Promise.all([action(order.id, 'receive', keeper), action(order.id, 'receive', keeper)]);
      assert.equal(receipts.filter(row => row.status === 200).length, 1, JSON.stringify(receipts));
      assert.equal(receipts.filter(row => row.status === 409).length, 1, JSON.stringify(receipts));
      const stocks = await prisma.inventoryStock.findMany({ where: { productId: { in: [first.id, second.id] } } });
      assert.equal(stocks.find(row => row.productId === first.id).quantity, 3);
      assert.equal(stocks.find(row => row.productId === second.id).quantity, 2);
      assert.equal(await prisma.stockAdjustment.count({ where: { note: `Purchase ${order.number}` } }), 2);
      const received = await prisma.purchaseOrder.findUnique({ where: { id: order.id } });
      assert.equal(received.receivedById, keeper.id);
      assert.equal(received.approvedById, owner.id);
      expectStatus(await action(order.id, 'cancel'), 409);
      const cancellation = await create(payload); expectStatus(cancellation, 201);
      expectStatus(await action(cancellation.data.order.id, 'cancel'), 200);
      expectStatus(await action(cancellation.data.order.id, 'receive'), 409);
      const rollback = await create(payload); expectStatus(rollback, 201);
      expectStatus(await action(rollback.data.order.id, 'approve'), 200);
      // The last sorted product fails, after the preceding product has been updated.
      const sorted = [first, second].sort((a,b) => a.id.localeCompare(b.id));
      await prisma.inventoryStock.update({ where: { productId_branchId: { productId: sorted[1].id, branchId: branch.id } }, data: { quantity: 2147483647 } });
      const before = await prisma.inventoryStock.findUnique({ where: { productId_branchId: { productId: sorted[0].id, branchId: branch.id } } });
      expectStatus(await action(rollback.data.order.id, 'receive'), 409);
      assert.equal((await prisma.inventoryStock.findUnique({ where: { id: before.id } })).quantity, before.quantity);
      assert.equal((await prisma.purchaseOrder.findUnique({ where: { id: rollback.data.order.id } })).status, 'ORDERED');
      assert.equal(await prisma.stockAdjustment.count({ where: { note: `Purchase ${rollback.data.order.number}` } }), 0);
      assert.equal(await prisma.purchaseReceipt.count({ where: { orderId: rollback.data.order.id } }), 0);
      assert.equal(await prisma.purchaseOrderItem.count({ where: { orderId: rollback.data.order.id, receivedQuantity: { gt: 0 } } }), 0);
      expectStatus(await call(`${base}/suppliers/${supplier.id}`, { method: 'PATCH', body: { ...supplier, active: false } }), 200);
      expectStatus(await create(payload), 400);
      const list = await call(`${base}/orders?status=RECEIVED`); expectStatus(list, 200);
      assert.equal(list.data.total, 1); assert.equal(list.data.orders[0].id, order.id);
      await prisma.businessModule.update({ where: { businessId_key: { businessId: business.id, key: 'INVENTORY' } }, data: { active: false } });
      expectStatus(await call(`${base}/orders`), 403);
      await prisma.businessModule.update({ where: { businessId_key: { businessId: business.id, key: 'INVENTORY' } }, data: { active: true } });
    });
    await t.test('purchasing snapshots restore into a fresh business and import twice without duplicates', async () => {
      const { exportBusinessSnapshot, importBusinessSnapshot } = await import('../src/utils/deploymentSync.js');
      const exported = JSON.parse(JSON.stringify(await exportBusinessSnapshot(business.id)));
      assert.equal(exported.purchaseOrders.length, 3);
      assert.equal(exported.purchaseOrderItems.length, 6);
      assert.equal(exported.purchaseReceipts.length, 1);
      const keys = ['branches', 'suppliers', 'products', 'users', 'roles', 'businessUsers', 'modules', 'purchaseOrders', 'purchaseOrderItems', 'purchaseReceipts'];
      const snapshot = { business: exported.business };
      for (const key of keys) snapshot[key] = exported[key];
      const ids = new Map([[snapshot.business.id, randomUUID()]]);
      for (const key of keys) for (const record of snapshot[key]) ids.set(record.id, randomUUID());
      const remap = value => typeof value === 'string' ? ids.get(value) || value : Array.isArray(value) ? value.map(remap) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key,item]) => [key,remap(item)])) : value;
      const restored = remap(snapshot);
      restored.users.forEach(user => { user.email = `${randomUUID()}@example.test`; });
      restored.purchaseOrders.forEach(order => { order.number = `RESTORE-${randomUUID()}`; });
      restored.purchaseReceipts.forEach(receipt => { receipt.reference = `RESTORE-PR-${randomUUID()}`; });
      await importBusinessSnapshot(restored);
      await importBusinessSnapshot(restored);
      assert.equal(await prisma.purchaseOrder.count({ where: { businessId: restored.business.id } }), 3);
      assert.equal(await prisma.purchaseOrderItem.count({ where: { order: { businessId: restored.business.id } } }), 6);
      const received = await prisma.purchaseOrder.findFirst({ where: { businessId: restored.business.id, status: 'RECEIVED' }, include: { items: true, receivedBy: true } });
      assert.equal(Number(received.total), 7.95);
      assert.equal(received.items.length, 2);
      assert.equal(received.receivedBy.name, 'Store Keeper');
      assert.equal(await prisma.purchaseReceipt.count({ where: { order: { businessId: restored.business.id } } }), 1);
      assert.ok(received.items.every(item => item.receivedQuantity === item.quantity));
    });
    await t.test('partial deliveries are retry-safe, bounded, auditable and allow cancelling the remainder', async () => {
      const base = `/purchasing/business/${business.id}`;
      const supplierResult = await call(`${base}/suppliers`, { method: 'POST', body: { name: 'Partial delivery supplier' } }); expectStatus(supplierResult, 201);
      const item = await prisma.product.create({ data: { businessId: business.id, name: 'Partial item', price: 20 } });
      const create = () => call(`${base}/orders`, { method: 'POST', body: { supplierId: supplierResult.data.supplier.id, branchId: branch.id, items: [{ productId: item.id, quantity: 10, unitCost: '5.25' }] } });
      const created = await create(); expectStatus(created, 201); const order = created.data.order;
      const action = (id, step, body = {}) => call(`${base}/orders/${id}/${step}`, { method: 'POST', body });
      const payload = (quantity, requestKey = randomUUID()) => ({ requestKey, note: 'Delivery note', items: [{ orderItemId: order.items[0].id, quantity }] });
      expectStatus(await action(order.id, 'approve'), 200);
      expectStatus(await action(order.id, 'receive', { items: [{ orderItemId: order.items[0].id, quantity: 1 }] }), 400);
      expectStatus(await action(order.id, 'receive', payload(0)), 400);
      expectStatus(await action(order.id, 'receive', payload(-1)), 400);
      expectStatus(await action(order.id, 'receive', payload(1.5)), 400);
      const first = payload(2);
      const repeated = await Promise.all([action(order.id, 'receive', first), action(order.id, 'receive', first)]);
      repeated.forEach(result => expectStatus(result, 200));
      assert.equal(repeated[0].data.order.status, 'PARTIALLY_RECEIVED');
      assert.equal(repeated[0].data.order.items[0].receivedQuantity, 2);
      assert.equal(await prisma.purchaseReceipt.count({ where: { orderId: order.id } }), 1);
      expectStatus(await action(order.id, 'receive', payload(3, first.requestKey)), 409);
      expectStatus(await action(order.id, 'receive', payload(9)), 409);
      const overlap = await Promise.all([action(order.id, 'receive', payload(5)), action(order.id, 'receive', payload(5))]);
      assert.equal(overlap.filter(result => result.status === 200).length, 1, JSON.stringify(overlap));
      assert.equal(overlap.filter(result => result.status === 409).length, 1, JSON.stringify(overlap));
      const final = await action(order.id, 'receive', payload(3)); expectStatus(final, 200);
      assert.equal(final.data.order.status, 'RECEIVED'); assert.equal(final.data.order.receipts.length, 3);
      assert.equal(final.data.order.items[0].receivedQuantity, 10);
      expectStatus(await action(order.id, 'receive', first), 200);
      const stock = await prisma.inventoryStock.findUnique({ where: { productId_branchId: { productId: item.id, branchId: branch.id } } });
      assert.equal(stock.quantity, 10);
      const adjustments = await prisma.stockAdjustment.findMany({ where: { productId: item.id }, include: { purchaseReceipt: true } });
      assert.equal(adjustments.length, 3); assert.ok(adjustments.every(row => row.purchaseReceipt?.orderId === order.id));
      const second = await create(); expectStatus(second, 201);
      expectStatus(await action(second.data.order.id, 'approve'), 200);
      const partial = await action(second.data.order.id, 'receive', { requestKey: randomUUID(), items: [{ orderItemId: second.data.order.items[0].id, quantity: 4 }] }); expectStatus(partial, 200);
      const cancelled = await action(second.data.order.id, 'cancel'); expectStatus(cancelled, 200);
      assert.equal(cancelled.data.order.items[0].receivedQuantity, 4);
      assert.equal(cancelled.data.order.receipts.length, 1);
      expectStatus(await action(second.data.order.id, 'receive'), 409);
      assert.equal((await prisma.inventoryStock.findUnique({ where: { id: stock.id } })).quantity, 14);
      const listed = await call(`${base}/orders?status=PARTIALLY_RECEIVED`); expectStatus(listed, 200);
    });
    await t.test('draft edits recalculate totals and reject stale, unauthorized and approved changes', async () => {
      const base = `/purchasing/business/${business.id}`;
      const supplier = await call(`${base}/suppliers`, { method: 'POST', body: { name: 'Draft edit supplier' } });
      expectStatus(supplier, 201);
      const body = { supplierId: supplier.data.supplier.id, branchId: branch.id, items: [{ productId: product.id, quantity: 2, unitCost: '12.50' }] };
      const created = await call(`${base}/orders`, { method: 'POST', body }); expectStatus(created, 201);
      const path = `${base}/orders/${created.data.order.id}`;
      const edited = { ...body, updatedAt: created.data.order.updatedAt, note: 'Revised delivery', items: [{ productId: product.id, quantity: 3, unitCost: '9.25' }] };
      expectStatus(await call(path, { method: 'PATCH', body: edited, user: cashier }), 403);
      expectStatus(await call(path, { method: 'PATCH', body: { ...edited, items: [] } }), 400);
      const results = await Promise.all([1,2].map(() => call(path, { method: 'PATCH', body: edited })));
      assert.deepEqual(results.map(r => r.status).sort(), [200,409]);
      const saved = results.find(r => r.status === 200).data.order;
      assert.equal(Number(saved.total), 27.75);
      assert.equal(saved.items.length, 1);
      assert.equal(saved.items[0].quantity, 3);
      assert.equal(saved.note, 'Revised delivery');
      assert.equal(saved.number, created.data.order.number);
      expectStatus(await call(`/purchasing/business/${foreign.id}/orders/${saved.id}`, { method: 'PATCH', body: edited }), 403);
      expectStatus(await call(`${path}/approve`, { method: 'POST' }), 200);
      expectStatus(await call(path, { method: 'PATCH', body: { ...edited, updatedAt: saved.updatedAt } }), 409);
      assert.equal(await prisma.stockAdjustment.count({ where: { note: `Purchase ${saved.number}` } }), 0);
    });
    await t.test('purchase filters search all pages and preserve tenant scope', async () => {
      const base = `/purchasing/business/${business.id}/orders`;
      const marker = `Search-${randomUUID()}`;
      const supplier = await prisma.supplier.create({ data: { businessId: business.id, name: marker } });
      await prisma.purchaseOrder.createMany({ data: Array.from({ length: 26 }, (_, index) => ({
        businessId: business.id, branchId: branch.id, supplierId: supplier.id, createdById: owner.id,
        number: `${marker}-${index}`, currency: 'UGX', total: 0
      })) });
      const first = await call(`${base}?search=${marker.toLowerCase()}&supplierId=${supplier.id}&branchId=${branch.id}&status=DRAFT`);
      expectStatus(first, 200); assert.equal(first.data.total, 26); assert.equal(first.data.orders.length, 25);
      const second = await call(`${base}?search=${marker}&page=2`);
      expectStatus(second, 200); assert.equal(second.data.total, 26); assert.equal(second.data.orders.length, 1);
      assert.ok(!first.data.orders.some(order => order.id === second.data.orders[0].id));
      const foreignSupplier = await prisma.supplier.create({ data: { businessId: foreign.id, name: marker } });
      const hidden = await call(`${base}?supplierId=${foreignSupplier.id}`);
      expectStatus(hidden, 200); assert.equal(hidden.data.total, 0);
      expectStatus(await call(`${base}?search=${'x'.repeat(151)}`), 400);
      expectStatus(await call(`${base}?supplierId[]=a&supplierId[]=b`), 400);
      const itemOrder = await prisma.purchaseOrder.create({ data: {
        businessId: business.id, branchId: branch.id, supplierId: supplier.id, createdById: owner.id,
        number: randomUUID(), currency: 'UGX', total: 1,
        items: { create: { productId: product.id, productName: `Needle-${marker}`, quantity: 1, unitCost: 1, lineTotal: 1 } }
      } });
      const itemSearch = await call(`${base}?search=Needle-${marker}`);
      expectStatus(itemSearch, 200); assert.equal(itemSearch.data.total, 1); assert.equal(itemSearch.data.orders[0].id, itemOrder.id);
    });
    await t.test('purchase CSV exports every batch, respects filters and escapes supplier text', async () => {
      const supplier = await prisma.supplier.create({ data: { businessId: business.id, name: '=SUM(1,2)' } });
      await prisma.purchaseOrder.createMany({ data: Array.from({length:260}, (_,i) => ({
        businessId: business.id, branchId: branch.id, supplierId: supplier.id, createdById: owner.id,
        number: `EXPORT-${suffix}-${i}`, currency: 'UGX', total: 10, note: 'Review "cost", please'
      })) });
      const path = `/purchasing/business/${business.id}/orders/export`;
      const result = await call(`${path}?supplierId=${supplier.id}&status=DRAFT`);
      expectStatus(result,200);
      const lines = result.data.trim().split('\r\n');
      assert.equal(lines.length,261);
      assert.equal(new Set(lines.slice(1).map(line => line.split(',')[0])).size,260);
      assert.ok(result.data.includes('"\'=SUM(1,2)"'));
      assert.ok(result.data.includes('"Review ""cost"", please"'));
      expectStatus(await call(path,{user:cashier}),403);
      expectStatus(await call(`/purchasing/business/${foreign.id}/orders/export`),403);
      expectStatus(await call(`${path}?status=INVALID`),400);
      const empty = await call(`${path}?supplierId=${supplier.id}&status=RECEIVED`);
      expectStatus(empty,200); assert.equal(empty.data.trim().split('\r\n').length,1);
      const cancelled = await prisma.purchaseOrder.create({data:{
        businessId: business.id, branchId: branch.id, supplierId: supplier.id, createdById:owner.id,
        number: randomUUID(), currency:'UGX', total:10, status:'CANCELLED',
        items:{create:{productId:product.id, productName:product.name, quantity:10, receivedQuantity:4, unitCost:1,lineTotal:10}}
      }});
      const cancelledCsv = await call(`${path}?search=${cancelled.number}`);
      expectStatus(cancelledCsv,200);
      assert.ok(cancelledCsv.data.includes('"10","4","0","6"'));
    });
    await t.test('purchase dates include the full UTC day and match CSV results', async () => {
      const supplier = await prisma.supplier.create({ data: { businessId: business.id, name: `Date fixture ${suffix}` } });
      const stamps = ['2026-08-09T23:59:59.999Z', '2026-08-10T00:00:00.000Z', '2026-08-10T23:59:59.999Z', '2026-08-11T00:00:00.000Z'];
      await prisma.purchaseOrder.createMany({ data: stamps.map((createdAt, i) => ({ businessId: business.id, branchId: branch.id, supplierId: supplier.id, createdById: owner.id, number: `DATE-${suffix}-${i}`, currency: 'UGX', total: 0, createdAt: new Date(createdAt) })) });
      const base = `/purchasing/business/${business.id}/orders`;
      const filter = `supplierId=${supplier.id}&dateFrom=2026-08-10&dateTo=2026-08-10`;
      const list = await call(`${base}?${filter}`); expectStatus(list, 200);
      assert.equal(list.data.total, 2);
      const csv = await call(`${base}/export?${filter}`); expectStatus(csv, 200);
      assert.equal(csv.data.trim().split('\r\n').length, 3);
      for (const order of list.data.orders) assert.ok(csv.data.includes(order.number));
      for (const query of ['dateFrom=2026-02-30', 'dateFrom=2026-08-11&dateTo=2026-08-10', 'dateTo=invalid']) {
        expectStatus(await call(`${base}?${query}`), 400);
        expectStatus(await call(`${base}/export?${query}`), 400);
      }
      const lower = await call(`${base}?supplierId=${supplier.id}&dateFrom=2026-08-10`);
      expectStatus(lower, 200); assert.equal(lower.data.total, 3);
      const upper = await call(`${base}?supplierId=${supplier.id}&dateTo=2026-08-10`);
      expectStatus(upper, 200); assert.equal(upper.data.total, 3);
    });
    await t.test('sync requires an owner and business scope and never leaks another tenant', async () => {
      await prisma.syncOperation.create({ data: { businessId: foreign.id, entityType: 'customer', operation: 'create', method: 'POST', endpoint: '/api/customers', payload: { note: 'Foreign private data' } } });
      for (const path of ['/sync/status','/sync/operations']) {
        expectStatus(await call(path, { user: null }), 401);
        expectStatus(await call(path), 400);
        expectStatus(await call(`${path}?businessId=${foreign.id}`), 403);
        expectStatus(await call(`${path}?businessId=${business.id}`, { user: cashier }), 403);
        const result = await call(`${path}?businessId=${business.id}`); expectStatus(result, 200);
        if (result.data.operations) assert.ok(result.data.operations.every(row => row.businessId === business.id));
      }
      expectStatus(await call('/sync/prepare', { method: 'POST', body: {} }), 400);
    });
    await t.test('zero-price products require a sale price and catalog suggestions remain unchanged', async () => {
      await prisma.business.update({where:{id:business.id},data:{posMode:'RETAIL_CHECKOUT',taxEnabled:true,taxRate:18}});
      const manual = await prisma.product.create({data:{businessId:business.id,name:'Price at checkout',price:0}});
      const fixed = await prisma.product.create({data:{businessId:business.id,name:'Saved price',price:100}});
      for (const item of [manual,fixed]) await prisma.inventoryStock.create({data:{businessId:business.id,branchId:branch.id,productId:item.id,quantity:5}});
      const sell = items => call('/pos/sales',{method:'POST',user:cashier,body:{businessId:business.id,branchId:branch.id,paymentMethod:'CASH',items}});
      for (const unitPrice of [undefined,null,'',0,-1,'1.234','abc',true,10000000000]) expectStatus(await sell([{productId:manual.id,quantity:1,unitPrice}]),400);
      assert.equal((await prisma.inventoryStock.findUnique({where:{productId_branchId:{productId:manual.id,branchId:branch.id}}})).quantity,5);
      const result = await sell([{productId:manual.id,quantity:2,unitPrice:'1250.50'},{productId:fixed.id,quantity:1,unitPrice:100}]);
      expectStatus(result,201);
      const recorded = await prisma.sale.findFirst({where:{businessId:business.id,items:{some:{productId:manual.id}}},include:{items:true}});
      assert.equal(Number(recorded.subtotal),2601);assert.equal(Number(recorded.taxAmount),468.18);assert.equal(Number(recorded.total),3069.18);
      assert.equal(Number(recorded.items.find(item=>item.productId===manual.id).unitPrice),1250.5);
      assert.equal(Number(recorded.items.find(item=>item.productId===fixed.id).unitPrice),100);
      assert.equal(Number((await prisma.product.findUnique({where:{id:manual.id}})).price),0);
      assert.equal((await prisma.inventoryStock.findUnique({where:{productId_branchId:{productId:manual.id,branchId:branch.id}}})).quantity,3);
      await prisma.business.update({where:{id:business.id},data:{posMode:'TABLE_SERVICE'}});
      const table=await prisma.pOSTable.create({data:{businessId:business.id,branchId:branch.id,name:'Manual-price table',seats:2}});
      const orderBody={businessId:business.id,branchId:branch.id,tableId:table.id,items:[{productId:manual.id,quantity:1,unitPrice:'22.50'}]};
      expectStatus(await call('/pos/orders',{method:'POST',body:{...orderBody,items:[{productId:manual.id,quantity:1}]}}),400);
      expectStatus(await call('/pos/orders',{method:'POST',body:orderBody}),201);
      const orderItem=await prisma.pOSOrderItem.findFirst({where:{productId:manual.id,order:{tableId:table.id}}});
      assert.equal(Number(orderItem.unitPrice),22.5);
    });
    await t.test('concurrent checkout retries return one receipt and deduct stock once',async () => {
      await prisma.business.update({where:{id:business.id},data:{posMode:'RETAIL_CHECKOUT'}});
      const item=await prisma.product.create({data:{businessId:business.id,name:'Retry checkout',price:0}});
      await prisma.inventoryStock.create({data:{businessId:business.id,branchId:branch.id,productId:item.id,quantity:5}});
      const body={businessId:business.id,branchId:branch.id,paymentMethod:'CASH',requestKey:randomUUID(),items:[{productId:item.id,quantity:2,unitPrice:'1250.50'}]};
      const submit=(payload=body,user=cashier)=>call('/pos/sales',{method:'POST',body:payload,user});
      const results=await Promise.all([submit(),submit()]);
      assert.deepEqual(results.map(r=>r.status).sort(),[200,201]);
      assert.equal(results[0].data.sale.id,results[1].data.sale.id);
      assert.equal(Number(results[0].data.sale.items[0].unitPrice),1250.5);
      assert.equal(await prisma.sale.count({where:{businessId:business.id,requestKey:body.requestKey}}),1);
      assert.equal((await prisma.inventoryStock.findUnique({where:{productId_branchId:{productId:item.id,branchId:branch.id}}})).quantity,3);
      assert.equal(await prisma.stockAdjustment.count({where:{productId:item.id}}),1);
      expectStatus(await submit({...body,items:[{...body.items[0],quantity:1}]}),409);
      expectStatus(await submit(body,owner),409);
      expectStatus(await submit({...body,businessId:foreign.id}),403);
      await prisma.product.update({where:{id:item.id},data:{status:'INACTIVE',price:5000}});
      const replay=await submit();expectStatus(replay,200);
      assert.equal(replay.data.sale.receiptNumber,results[0].data.sale.receiptNumber);
      assert.equal(Number(replay.data.sale.items[0].unitPrice),1250.5);
    });
    await t.test('owner costs stay private and store keepers can negotiate above the minimum',async () => {
      const keeperRole=await prisma.role.upsert({where:{businessId_name:{businessId:business.id,name:'Store Keeper'}},update:{},create:{businessId:business.id,name:'Store Keeper'}});
      const keeper=await prisma.user.create({data:{name:'Pricing keeper',email:`pricing-keeper-${suffix}@example.test`,passwordHash:'fixture',memberships:{create:{businessId:business.id,roleId:keeperRole.id}}}});
      const create=await call(`/products/business/${business.id}`,{method:'POST',body:{name:'Negotiated necklace',price:'100',minimumPrice:'70',costPrice:'40',type:'PHYSICAL'}});
      expectStatus(create,201);
      const product=create.data.product;assert.equal(Number(product.costPrice),40);
      await prisma.inventoryStock.create({data:{businessId:business.id,branchId:branch.id,productId:product.id,quantity:10}});
      const staffList=await call(`/products/business/${business.id}`,{user:keeper});expectStatus(staffList,200);
      const staffProduct=staffList.data.products.find(item=>item.id===product.id);
      assert.equal(Number(staffProduct.minimumPrice),70);assert.equal(staffProduct.costPrice,undefined);assert.equal(staffProduct.privateCost,undefined);
      const platformAdmin=await prisma.user.findFirst({where:{systemRole:'SYSTEM_ADMIN'}});
      const adminList=await call(`/products/business/${business.id}`,{user:platformAdmin});
      assert.equal(adminList.data.products.find(item=>item.id===product.id).costPrice,undefined);
      const url=`/products/business/${business.id}/${product.id}`;
      expectStatus(await call(url,{method:'PATCH',user:keeper,body:{name:product.name,price:100,minimumPrice:70,costPrice:1}}),403);
      expectStatus(await call(url,{method:'PATCH',user:keeper,body:{name:product.name,price:100,minimumPrice:1}}),403);
      expectStatus(await call(url,{method:'PATCH',user:keeper,body:{name:product.name,price:100,minimumPrice:70}}),200);
      const sell=(unitPrice,discountAmount=0)=>call('/pos/sales',{method:'POST',user:keeper,body:{businessId:business.id,branchId:branch.id,paymentMethod:'CASH',discountAmount,items:[{productId:product.id,quantity:1,...(unitPrice===undefined?{}:{unitPrice})}]}});
      expectStatus(await sell(69),400);expectStatus(await sell(80,11),400);
      const negotiated=await sell(80);expectStatus(negotiated,201);
      assert.equal(Number(negotiated.data.sale.items[0].unitPrice),80);
      assert.equal(Number(negotiated.data.sale.items[0].suggestedPrice),100);
      assert.equal(Number(negotiated.data.sale.items[0].minimumPrice),70);
      assert.ok(!JSON.stringify(negotiated.data).includes('costPrice'));assert.ok(!JSON.stringify(negotiated.data).includes('privateCost'));
      const normal=await sell(undefined);expectStatus(normal,201);assert.equal(Number(normal.data.sale.items[0].unitPrice),100);
      assert.equal(Number((await prisma.product.findUnique({where:{id:product.id}})).price),100);
      const ownerList=await call(`/products/business/${business.id}`);assert.equal(Number(ownerList.data.products.find(item=>item.id===product.id).costPrice),40);
      expectStatus(await call(url,{method:'PATCH',body:{name:product.name,price:100,minimumPrice:70,costPrice:''}}),200);
      assert.equal((await call(`/products/business/${business.id}`)).data.products.find(item=>item.id===product.id).costPrice,null);
    });
    await t.test('failed checkout can retry the same request after stock is corrected',async () => {
      const item=await prisma.product.create({data:{businessId:business.id,name:'Retry after failure',price:100}});
      const stock=await prisma.inventoryStock.create({data:{businessId:business.id,branchId:branch.id,productId:item.id,quantity:0}});
      const body={businessId:business.id,branchId:branch.id,paymentMethod:'CASH',requestKey:randomUUID(),items:[{productId:item.id,quantity:1}]};
      expectStatus(await call('/pos/sales',{method:'POST',body}),409);
      assert.equal(await prisma.sale.count({where:{businessId:business.id,requestKey:body.requestKey}}),0);
      await prisma.inventoryStock.update({where:{id:stock.id},data:{quantity:1}});
      expectStatus(await call('/pos/sales',{method:'POST',body}),201);
      expectStatus(await call('/pos/sales',{method:'POST',body}),200);
      assert.equal((await prisma.inventoryStock.findUnique({where:{id:stock.id}})).quantity,0);
    });
    await t.test('operations daily totals match branch receipts and enforce permissions',async () => {
      const date=new Date().toISOString().slice(0,10);
      const url=`/operations/business/${business.id}/summary?branchId=${branch.id}&date=${date}`;
      const result=await call(url);expectStatus(result,200);
      const daily=result.data.operations.dailySales;
      const records=await prisma.sale.findMany({where:{businessId:business.id,branchId:branch.id,status:'COMPLETED',createdAt:{gte:new Date(daily.from),lt:new Date(daily.to)}}});
      assert.ok(records.length>0);
      assert.equal(daily.receipts,records.length);
      assert.equal(Math.round(daily.total*100),Math.round(records.reduce((sum,row)=>sum+Number(row.total),0)*100));
      assert.equal(Math.round(daily.payments.reduce((sum,row)=>sum+row.total,0)*100),Math.round(daily.total*100));
      expectStatus(await call(url,{user:cashier}),403);
      expectStatus(await call(`/operations/business/${foreign.id}/summary`),403);
      expectStatus(await call(`/operations/business/${business.id}/summary?branchId=foreign`),404);
      expectStatus(await call(`/operations/business/${business.id}/summary?date=invalid`),400);
    });
    await t.test('cash counts calculate snapshots, reject stale totals and safely replay concurrent retries',async()=>{
      const date=new Date().toISOString().slice(0,10);
      const summary=await call(`/operations/business/${business.id}/summary?branchId=${branch.id}&date=${date}`);expectStatus(summary,200);
      const cash=summary.data.operations.dailySales.payments.find(row=>row.method==='CASH')?.total || 0;
      const path=`/operations/business/${business.id}/cash-counts`;
      const body={branchId:branch.id,date,requestKey:randomUUID(),opening:'100',cashIn:'20',cashOut:'10',counted:(cash+110).toFixed(2),previewCashSales:cash.toFixed(2),note:''};
      expectStatus(await call(path,{method:'POST',body,user:cashier}),403);
      expectStatus(await call(path,{method:'POST',body:{...body,branchId:'foreign'}}),404);
      expectStatus(await call(path,{method:'POST',body:{...body,previewCashSales:(cash+1).toFixed(2)}}),409);
      expectStatus(await call(path,{method:'POST',body:{...body,counted:'0'}}),400);
      const requests=await Promise.all([call(path,{method:'POST',body}),call(path,{method:'POST',body})]);
      assert.deepEqual(requests.map(x=>x.status).sort(),[200,201]);
      assert.equal(requests[0].data.cashCount.id,requests[1].data.cashCount.id);
      assert.equal(Number(requests[0].data.cashCount.expected),Number((cash+110).toFixed(2)));
      assert.equal(Number(requests[0].data.cashCount.difference),0);
      expectStatus(await call(path,{method:'POST',body:{...body,note:'changed'}}),409);
      const discrepancy=await call(path,{method:'POST',body:{...body,requestKey:randomUUID(),counted:(cash+100).toFixed(2),note:'Ten short'}});expectStatus(discrepancy,201);
      assert.equal(Number(discrepancy.data.cashCount.difference),-10);
      const history=await call(`/operations/business/${business.id}/summary?branchId=${branch.id}&date=${date}`);
      assert.equal(history.data.operations.cashCounts.length,2);
      assert.equal(await prisma.cashCount.count({where:{businessId:business.id}}),2);
    });
    await t.test('notifications enforce business, branch, module and role boundaries',async()=>{
      const item=await prisma.product.create({data:{businessId:business.id,name:'Notification low stock',price:20}});
      const inventory=await prisma.inventoryStock.create({data:{businessId:business.id,branchId:branch.id,productId:item.id,quantity:2,reorderLevel:3}});
      const path=`/notifications/business/${business.id}?branchId=${branch.id}`;
      const ownerAlerts=await call(path);expectStatus(ownerAlerts,200);
      assert.ok(ownerAlerts.data.alerts.some(alert=>alert.kind==='LOW_STOCK'));
      assert.ok(ownerAlerts.data.alerts.some(alert=>alert.kind==='OUT_OF_STOCK'));
      const before=ownerAlerts.data.alerts.find(alert=>alert.kind==='LOW_STOCK').id;
      await prisma.inventoryStock.update({where:{id:inventory.id},data:{quantity:1}});
      assert.notEqual((await call(path)).data.alerts.find(alert=>alert.kind==='LOW_STOCK').id,before);
      assert.deepEqual((await call(path,{user:cashier})).data.alerts,[]);
      const role=await prisma.role.findFirst({where:{businessId:business.id,name:'Store Keeper'}});
      const keeper=await prisma.user.findFirst({where:{memberships:{some:{businessId:business.id,roleId:role.id}}}});
      const staff=await call(path,{user:keeper});expectStatus(staff,200);
      assert.ok(staff.data.alerts.some(alert=>alert.kind==='LOW_STOCK'));
      assert.ok(!staff.data.alerts.some(alert=>alert.kind==='CASH_DIFFERENCE'));
      expectStatus(await call(`/notifications/business/${foreign.id}?branchId=${branch.id}`),403);
      expectStatus(await call(`/notifications/business/${business.id}?branchId=other`),404);
      await prisma.businessModule.update({where:{businessId_key:{businessId:business.id,key:'INVENTORY'}},data:{active:false}});
      try{assert.deepEqual((await call(path,{user:keeper})).data.alerts,[]);}finally{await prisma.businessModule.update({where:{businessId_key:{businessId:business.id,key:'INVENTORY'}},data:{active:true}});}
    });
    await t.test('stock receiving and transfers replay once; stale counts cannot overwrite sales',async()=>{
      const item=await prisma.product.create({data:{businessId:business.id,name:'Stock retry item',price:100}});
      const stock=await prisma.inventoryStock.create({data:{businessId:business.id,branchId:branch.id,productId:item.id,quantity:20}});
      const other=await prisma.branch.create({data:{businessId:business.id,name:'Retry destination'}});
      const base=`/inventory/business/${business.id}/branch/${branch.id}/products/${item.id}`;
      const body={quantity:5,note:'Received once',requestKey:randomUUID()};
      const received=await Promise.all([1,2].map(()=>call(`${base}/receive`,{method:'POST',body})));
      received.forEach(result=>expectStatus(result,200));
      assert.equal((await prisma.inventoryStock.findUnique({where:{id:stock.id}})).quantity,25);
      assert.equal(await prisma.stockAdjustment.count({where:{productId:item.id}}),1);
      expectStatus(await call(`${base}/receive`,{method:'POST',body:{...body,quantity:6}}),409);
      expectStatus(await call(`${base}/stock`,{method:'PATCH',body:{quantity:12,expectedQuantity:20,requestKey:randomUUID()}}),409);
      const set={quantity:12,expectedQuantity:25,reorderLevel:2,requestKey:randomUUID()};
      expectStatus(await call(`${base}/stock`,{method:'PATCH',body:set}),200);
      await call(`${base}/receive`,{method:'POST',body:{quantity:3,requestKey:randomUUID()}});
      expectStatus(await call(`${base}/stock`,{method:'PATCH',body:set}),200);
      assert.equal((await prisma.inventoryStock.findUnique({where:{id:stock.id}})).quantity,15);
      const transfer={fromBranchId:branch.id,toBranchId:other.id,productId:item.id,quantity:3,requestKey:randomUUID()};
      const moved=await Promise.all([1,2].map(()=>call(`/inventory/business/${business.id}/transfer`,{method:'POST',body:transfer})));
      moved.forEach(result=>expectStatus(result,200));
      assert.equal((await prisma.inventoryStock.findUnique({where:{id:stock.id}})).quantity,12);
      assert.equal((await prisma.inventoryStock.findUnique({where:{productId_branchId:{productId:item.id,branchId:other.id}}})).quantity,3);
      assert.equal(await prisma.stockAdjustment.count({where:{productId:item.id}}),5);
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
  }
});
