import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { signAuthToken } from '../src/utils/tokens.js';
import { configurationDigest } from '../src/utils/installerArtifacts.js';
import { publicInstallation, isNewerVersion } from '../src/utils/installationStatus.js';

test('online status uses server time, health and revocation independently of updates',() => {
  const now=Date.now(), device={lastSeenAt:new Date(now),healthy:true};
  assert.equal(publicInstallation(device,now).status,'ONLINE');
  assert.equal(publicInstallation(device,now+180001).status,'OFFLINE');
  assert.equal(publicInstallation({...device,healthy:false},now).status,'NEEDS_ATTENTION');
  assert.equal(publicInstallation({...device,revokedAt:new Date()},now).status,'REVOKED');
  assert.equal(publicInstallation({...device,lastSeenAt:null},now).status,'INSTALLED');
  assert.equal(isNewerVersion('0.10.0','0.9.0'),true);
  assert.equal(isNewerVersion('0.2.0','0.3.0'),false);
  assert.equal(isNewerVersion('0.3.0','0.3.0'),false);
});

test('device enrollment, heartbeats, tenant-scoped updates and revocation', {skip:process.env.ZERA_INTEGRATION !== '1'},async () => {
  if (!process.env.DATABASE_URL?.includes(':5548/zera_project_test')) throw new Error('Use the isolated test database.');
  const suffix=randomUUID();
  const business=await prisma.business.create({data:{name:`Device test ${suffix}`}});
  const foreign=await prisma.business.create({data:{name:`Foreign device test ${suffix}`}});
  const admin=await prisma.user.create({data:{name:'Device admin',email:`device-${suffix}@example.test`,passwordHash:'fixture',systemRole:'SYSTEM_ADMIN'}});
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const root=`http://127.0.0.1:${server.address().port}/api`;
  const call=async (route,method='GET',body,token=signAuthToken(admin))=>{
    const response=await fetch(root+route,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},...(body?{body:JSON.stringify(body)}:{})});
    return {status:response.status,body:await response.json()};
  };
  try {
    const enrollment=await call(`/system-admin/businesses/${business.id}/installations/enrollment`,'POST',{});
    assert.equal(enrollment.status,201);
    const token=randomBytes(32).toString('hex');
    const input={code:enrollment.body.code,deviceToken:token,businessId:business.id,name:'Till 1',platform:'mac',architecture:'x64',appVersion:'0.0.1'};
    assert.equal((await call('/installations/enroll','POST',{...input,businessId:foreign.id})).status,401);
    const enrolled=await call('/installations/enroll','POST',input);
    assert.equal(enrolled.status,201);
    assert.equal((await call('/installations/enroll','POST',input)).body.id,enrolled.body.id);
    assert.equal((await call('/installations/enroll','POST',{...input,deviceToken:randomBytes(32).toString('hex')})).status,401);
    assert.equal((await call('/installations/heartbeat','POST',{appVersion:'0.0.1',mode:'SHARED_SERVER',healthy:true},token)).status,200);
    const history=await call(`/system-admin/businesses/${business.id}/installations`);
    assert.equal(history.body.devices[0].status,'ONLINE');
    assert.equal(history.body.devices[0].tokenHash,undefined);
    const {manifest}=(await call(`/system-admin/businesses/${business.id}/deployment-manifest`)).body;
    const version=JSON.parse(await readFile(new URL('../../desktop/package.json',import.meta.url),'utf8')).version;
    const build=await prisma.installerBuild.create({data:{businessId:business.id,platform:'mac',architecture:'x64',appVersion:version,status:'READY',configHash:configurationDigest(manifest),manifest,createdById:admin.id,fileName:'test.dmg',sha256:'0'.repeat(64),byteSize:123}});
    assert.equal((await call('/installations/update','GET',null,token)).body.update.id,build.id);
    assert.equal((await call(`/installations/update/${build.id}/download`,'GET',null,token)).status,409);
    await prisma.installerBuild.update({where:{id:build.id},data:{architecture:'arm64'}});
    assert.equal((await call('/installations/update','GET',null,token)).body.update,null);
    assert.equal((await call(`/system-admin/businesses/${foreign.id}/installations/${enrolled.body.id}`,'DELETE')).status,404);
    assert.equal((await call(`/system-admin/businesses/${business.id}/installations/${enrolled.body.id}`,'DELETE')).status,200);
    assert.equal((await call('/installations/heartbeat','POST',{appVersion:version,mode:'DESKTOP',healthy:true},token)).status,401);
  } finally {
    server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));
    await prisma.business.deleteMany({where:{id:{in:[business.id,foreign.id]}}});
    await prisma.user.delete({where:{id:admin.id}});
    await prisma.$disconnect();
  }
});
