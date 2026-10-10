import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
const appRoot = process.env.ZERA_TEST_APP_ROOT;
const runtimeRoot = appRoot ? new URL(`file://${appRoot}/src/`) : new URL('../src/', import.meta.url);
const { startManagedDatabase, applyMigrations, backupStoppedDatabase } = await import(new URL('localDatabase.js', runtimeRoot));
const { provisionWorkspace, validateOwner } = await import(new URL('provisionWorkspace.js', runtimeRoot));
const { prepareRecovery } = await import(new URL('recovery.js', runtimeRoot));
import bcrypt from 'bcryptjs';
const require = createRequire(import.meta.url);
const { PrismaClient } = appRoot ? require(path.join(appRoot, '.desktop-build/backend/prisma-client')) : require('../../backend/node_modules/@prisma/client');
const migrations = appRoot ? path.join(appRoot, '.desktop-build/backend/prisma/migrations') : fileURLToPath(new URL('../../backend/prisma/migrations', import.meta.url));

test('first-run rejects invalid email and weak passwords', () => {
  const valid = {name:'Owner',businessName:'Shop',email:'owner@example.test',password:'long-test-password'};
  assert.throws(() => validateOwner({...valid,password:'short'}), /12 characters/);
  assert.throws(() => validateOwner({...valid,email:'invalid'}), /valid email/);
  assert.throws(() => validateOwner({...valid,password:'é'.repeat(40)}), /72 bytes/);
});

test('standalone database installs, provisions, persists, backs up and upgrades without resetting data', {timeout:120000}, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'zera-install-test-'));
  const password = randomBytes(32).toString('hex');
  let runtime;
  let client;
  let savedReceipt;
  const originalFetch=globalThis.fetch;
  globalThis.fetch=(input,options)=>{
    const address=new URL(typeof input==='string' ? input : input.url || input);
    if (!['127.0.0.1','localhost','[::1]'].includes(address.hostname)) throw new Error('External network disabled for offline acceptance');
    return originalFetch(input,options);
  };
  try {
    runtime = await startManagedDatabase(directory, password);
    await applyMigrations(runtime.databaseUrl, migrations);
    await applyMigrations(runtime.databaseUrl, migrations);
    client = new PrismaClient({datasources:{db:{url:runtime.databaseUrl}}});
    const owner = {name:'Test owner', email:'owner@example.test', password:'test-password-only-123', businessName:'Test shop'};
    await provisionWorkspace(client, {business:{name:'Configured shop',currency:'UGX',type:'Boutique',typeKey:'RETAIL_SHOP'},branding:{useBrandTheme:true,primaryColor:'#123456'},branches:[{id:'source-main',name:'Main',status:'ACTIVE'}],catalog:{version:1,products:[{name:'Transferred necklace',sku:'TRANSFER-1',type:'PHYSICAL',price:'100',minimumPrice:'70',status:'ACTIVE',inventoryStocks:[{branchId:'source-main',quantity:14,reorderLevel:2}]}]},package:{key:'SHOP',name:'Shop',limits:{users:5,branches:2,products:100}}}, owner);
    const user = await client.user.findUnique({where:{email:owner.email},include:{memberships:{include:{role:true}}}});
    assert.equal(await bcrypt.compare(owner.password, user.passwordHash), true);
    assert.equal(user.memberships[0].role.name, 'Owner');
    assert.equal((await client.business.findFirst()).useBrandTheme, true);
    assert.equal((await client.business.findFirst({include:{platformBusinessType:true}})).platformBusinessType.key,'RETAIL_SHOP');
    assert.equal(await client.businessModule.count(), 5);
    const imported = await client.product.findFirst({where:{sku:'TRANSFER-1'},include:{inventoryStocks:true,privateCost:true}});
    assert.equal(Number(imported.price),100);
    assert.equal(Number(imported.minimumPrice),70);
    assert.equal(imported.privateCost,null);
    assert.equal(imported.inventoryStocks[0].quantity,14);
    assert.equal(imported.inventoryStocks[0].reorderLevel,2);
    assert.equal(imported.inventoryStocks[0].branchId,(await client.branch.findFirst()).id);

    assert.equal((await client.platformPackage.findFirst()).maxUsers, 5);
    process.env.DATABASE_URL = runtime.databaseUrl;
    process.env.JWT_SECRET = randomBytes(48).toString('hex');
    process.env.NODE_ENV = 'production';
    process.env.ZERA_DESKTOP = appRoot ? 'true' : 'false';
    const backendRoot = appRoot ? path.join(appRoot, '.desktop-build/backend/src') : fileURLToPath(new URL('../../backend/src', import.meta.url));
    const { app } = await import(pathToFileURL(path.join(backendRoot, 'app.js')));
    const { prisma: apiClient } = await import(pathToFileURL(path.join(backendRoot, 'config/prisma.js')));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
      const url = `http://127.0.0.1:${server.address().port}/api`;
      const login = await fetch(`${url}/auth/login`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:owner.email,password:owner.password})});
      assert.equal(login.status, 200);
      const {token} = await login.json();
      const businesses = await fetch(`${url}/businesses`, {headers:{Authorization:`Bearer ${token}`}});
      assert.equal(businesses.status, 200);
      assert.match(await businesses.text(), /Configured shop/);
      const branch=await client.branch.findFirst();
      const business=await client.business.findFirst();
      const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
      const body={businessId:business.id,branchId:branch.id,paymentMethod:'CASH',requestKey:'offline-acceptance-checkout',items:[{productId:imported.id,quantity:2,unitPrice:'90'}]};
      const checkout=await fetch(`${url}/pos/sales`,{method:'POST',headers,body:JSON.stringify(body)});
      assert.equal(checkout.status,201);
      const {sale}=await checkout.json();
      savedReceipt=sale.receiptNumber;
      assert.equal(Number(sale.total),180);
      const retry=await fetch(`${url}/pos/sales`,{method:'POST',headers,body:JSON.stringify(body)});
      assert.equal(retry.status,200);
      assert.equal((await retry.json()).sale.receiptNumber,savedReceipt);
      const date=new Date().toISOString().slice(0,10);
      const count=await fetch(`${url}/operations/business/${business.id}/cash-counts`,{method:'POST',headers,body:JSON.stringify({branchId:branch.id,date,requestKey:'offline-acceptance-count',opening:'100',cashIn:'0',cashOut:'0',counted:'280',previewCashSales:'180',note:''})});
      assert.equal(count.status,201);
      assert.equal(Number((await count.json()).cashCount.difference),0);
    } finally { await new Promise(resolve => server.close(resolve)); await apiClient.$disconnect(); }
    await assert.rejects(provisionWorkspace(client, null, owner), /already has a workspace/);
    assert.equal((await client.inventoryStock.findFirst({where:{productId:imported.id}})).quantity,12);
    await client.$disconnect(); client = null;
    await runtime.cluster.stop(); runtime = null;
    const recoveryBackup = await backupStoppedDatabase(directory);
    runtime = await startManagedDatabase(directory, password);
    await applyMigrations(runtime.databaseUrl, migrations);
    client = new PrismaClient({datasources:{db:{url:runtime.databaseUrl}}});
    assert.equal(await client.user.count(), 1);
    assert.equal((await client.business.findFirst()).name, 'Configured shop');
    assert.equal(await client.sale.count(),1);
    assert.equal((await client.sale.findFirst()).receiptNumber,savedReceipt);
    assert.equal((await client.inventoryStock.findFirst()).quantity,12);
    assert.equal(await client.cashCount.count(),1);
    await client.$executeRaw`INSERT INTO "_prisma_migrations" (id,checksum,migration_name,finished_at,applied_steps_count) VALUES ('upgrade-test-future','future-checksum','999999_future',now(),1)`;
    await assert.rejects(applyMigrations(runtime.databaseUrl,migrations),error => error.code === 'ZERA_UPGRADE_BLOCKED');
    assert.equal(await client.user.count(),1);
    assert.equal((await client.business.findFirst()).name,'Configured shop');
    await client.$executeRaw`DELETE FROM "_prisma_migrations" WHERE id = 'upgrade-test-future'`;
    await applyMigrations(runtime.databaseUrl,migrations);
    await client.business.updateMany({data:{name:'Changed after backup'}});
    const recovery = await prepareRecovery(directory,path.basename(recoveryBackup),async stage => {
      const trial = await startManagedDatabase(stage,password);
      try { await applyMigrations(trial.databaseUrl,migrations); }
      finally { await trial.cluster.stop(); }
    });
    await client.$disconnect(); client = null;
    await runtime.cluster.stop(); runtime = null;
    await recovery.commit();
    runtime = await startManagedDatabase(directory,password);
    client = new PrismaClient({datasources:{db:{url:runtime.databaseUrl}}});
    assert.equal((await client.business.findFirst()).name,'Configured shop');
    assert.equal((await client.sale.findFirst()).receiptNumber,savedReceipt);
    assert.equal((await client.inventoryStock.findFirst()).quantity,12);
    assert.equal(await client.cashCount.count(),1);
  } finally {
    globalThis.fetch=originalFetch;
    if (client) await client.$disconnect();
    if (runtime) await runtime.cluster.stop();
  }
});
