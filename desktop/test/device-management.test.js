import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DeviceManagement,centralAddress} from '../src/deviceManagement.js';

test('central endpoint requires HTTPS and rejects credentials, query strings and alternate paths',()=>{
  assert.equal(centralAddress('https://central.example.com/api'),'https://central.example.com/api/installations');
  assert.equal(centralAddress('http://127.0.0.1:5050'),'http://127.0.0.1:5050/api/installations');
  for (const value of ['http://shop.example.com','https://user:pw@example.com','https://example.com/?token=x','file:///tmp/x','https://example.com/untrusted']) assert.throws(()=>centralAddress(value));
});
test('enrollment survives retry, reports health, and verifies streamed downloads',async ()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'zera-device-'));
  const secureStorage={isEncryptionAvailable:()=>true,encryptString:value=>Buffer.from(value),decryptString:value=>value.toString()};
  const content=Buffer.from('installer bytes');
  let fail=false; let corrupted=false; let enrollmentCalls=0;
  const fetcher=async (url,options)=>{
    assert.equal(options.redirect,'error');
    if(fail) throw new Error('Offline');
    if(url.endsWith('/enroll')) {enrollmentCalls++;return Response.json({id:'device1'});}
    if(url.endsWith('/heartbeat')) {assert.equal(JSON.parse(options.body).healthy,true);return Response.json({ok:true});}
    if(url.endsWith('/update')) return Response.json({update:{id:'build1',sha256:createHash('sha256').update(content).digest('hex'),byteSize:content.length,version:'0.3.0'}});
    return new Response(corrupted?Buffer.from('corrupt content'):content);
  };
  const manager=new DeviceManagement({directory,secureStorage,version:'0.2.0',businessId:'business1',health:async()=>true,mode:()=> 'DESKTOP',fetcher});
  try {
    await manager.enroll({address:'https://central.example.com',code:'a'.repeat(64),name:'Till'});
    // Enrollment starts a background report; wait for that report before forcing network failure.
    while(manager.reporting) await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(manager.state.connected,true);
    const destination=path.join(directory,'update.dmg');
    await manager.download(destination);
    assert.deepEqual(await readFile(destination),content);
    corrupted=true;
    await assert.rejects(manager.download(path.join(directory,'bad.dmg')),/mismatch|integrity/);
    await assert.rejects(access(path.join(directory,'bad.dmg')));
    fail=true;
    await manager.report();
    assert.equal(manager.state.connected,false);
    assert.equal(enrollmentCalls,1);
    const restored=new DeviceManagement({directory,secureStorage,businessId:'business1'});
    await restored.load();
    assert.equal(restored.registration.id,'device1');
    assert.equal(restored.registration.code,undefined);
    const differentOrganization=new DeviceManagement({directory,secureStorage,businessId:'business2'});
    await differentOrganization.load();
    assert.equal(differentOrganization.registration,null);
    assert.match(differentOrganization.state.message,/new enrollment code/);
  } finally {manager.stop();}
});
