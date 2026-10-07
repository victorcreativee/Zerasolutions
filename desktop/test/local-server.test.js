import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {startApplicationServer} from '../src/localServer.js';
test('local address serves frontend routes and backend from the same private port', async () => {
  const root = await mkdtemp(path.join(tmpdir(),'zera-frontend-test-'));
  await writeFile(path.join(root,'index.html'),'<html><head></head><body>Shop</body></html>');
  const backend = express();
  backend.get('/health',(_req,res) => res.json({status:'ok'}));
  backend.get('/api/test',(_req,res) => res.json({ok:true}));
  const {server,accessUrl} = await startApplicationServer(backend,root);
  try {
    assert.match(accessUrl,/^http:\/\/127\.0\.0\.1:/);
    assert.match(await (await fetch(`${accessUrl}/login`)).text(),/name="zera-api-base" content="\/api"/);
    assert.deepEqual(await (await fetch(`${accessUrl}/api/test`)).json(),{ok:true});
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
test('missing frontend build fails installation checks', async () => {
  const root = await mkdtemp(path.join(tmpdir(),'zera-missing-build-'));
  await assert.rejects(startApplicationServer(express(),root), /ENOENT/);
});
