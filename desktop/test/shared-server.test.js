import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import https from 'node:https';
import express from 'express';
import {startApplicationServer} from '../src/localServer.js';
import {availablePort} from '../src/localDatabase.js';
import {validateSharedServer} from '../src/sharedServer.js';

test('shared HTTPS serves frontend and API with certificate verification and refuses unsafe settings',async ()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'zera-tls-'));
  await writeFile(path.join(directory,'index.html'),'<html><head></head><body>Shared shop</body></html>');
  await writeFile(path.join(directory,'openssl.cnf'),'[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=127.0.0.1\n[ext]\nsubjectAltName=IP:127.0.0.1\n');
  await promisify(execFile)('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-keyout',path.join(directory,'key.pem'),'-out',path.join(directory,'cert.pem'),'-config',path.join(directory,'openssl.cnf')]);
  const key=await readFile(path.join(directory,'key.pem'),'utf8'),cert=await readFile(path.join(directory,'cert.pem'),'utf8');
  const port=await availablePort();
  const shared={enabled:true,address:`https://127.0.0.1:${port}`,key,cert};
  assert.throws(()=>validateSharedServer({...shared,address:`http://127.0.0.1:${port}`}),/HTTPS/);
  assert.throws(()=>validateSharedServer({...shared,address:`https://other.example.com:${port}`}),/match/);
  assert.throws(()=>validateSharedServer({...shared,key:'invalid'}));
  const backend=express();
  backend.get('/health',(_req,res)=>res.json({status:'ok'}));
  backend.get('/api/test',(_req,res)=>res.json({shared:true}));
  const local=await startApplicationServer(backend,directory,{shared});
  const get=route=>new Promise((resolve,reject)=>{
    https.get(`${shared.address}${route}`,{ca:cert},res=>{let body='';res.on('data',data=>body+=data);res.on('end',()=>resolve(body));}).on('error',reject);
  });
  try {
    assert.equal(local.sharedAccessUrl,shared.address);
    assert.match(await get('/login'),/Shared shop/);
    assert.deepEqual(JSON.parse(await get('/api/test')),{shared:true});
    assert.equal((await fetch(local.accessUrl)).status,200);
    await assert.rejects(startApplicationServer(backend,directory,{shared}),/EADDRINUSE/);
  } finally { for(const server of [local.sharedServer,local.server]) {server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));} }
});
