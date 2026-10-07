import express from 'express';
import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { validateSharedServer } from './sharedServer.js';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

export async function startApplicationServer(backendApp, frontendRoot, options = {}) {
  const shared = validateSharedServer(options.shared);
  const index = path.join(frontendRoot,'index.html');
  await access(index);
  const html = (await readFile(index,'utf8')).replace('<head>','<head><meta name="zera-api-base" content="/api">');
  for (const match of html.matchAll(/(?:src|href)="\.\/(assets\/[^"?]+)"/g)) await access(path.join(frontendRoot,match[1]));
  const sendIndex = (_req,res) => res.type('html').send(html);
  const gateway = express();
  gateway.use((req,res,next) => req.path === '/health' || req.path.startsWith('/api/') ? backendApp(req,res,next) : next());
  gateway.get(['/', '/index.html'],sendIndex);
  gateway.use(express.static(frontendRoot));
  gateway.get('*',sendIndex);
  const server = createServer(gateway);
  const port = await new Promise((resolve,reject) => {
    server.once('error',reject);
    server.listen(0,'127.0.0.1',() => resolve(server.address().port));
  });
  const accessUrl = `http://127.0.0.1:${port}`;
  let sharedServer;
  try {
    const [backend,frontend] = await Promise.all([fetch(`${accessUrl}/health`,{signal:AbortSignal.timeout(5000)}),fetch(accessUrl,{signal:AbortSignal.timeout(5000)})]);
    if (!backend.ok || (await backend.json()).status !== 'ok' || !frontend.ok || !(await frontend.text()).includes('<html')) throw new Error('Installation health check failed.');
    if (shared) {
      sharedServer = createHttpsServer({key:shared.key,cert:shared.cert,minVersion:'TLSv1.2'},gateway);
      await new Promise((resolve,reject) => {sharedServer.once('error',reject); sharedServer.listen(shared.port,'0.0.0.0',resolve);});
      sharedServer.requestTimeout = 120000;
    }
    return {server,sharedServer,sharedAccessUrl:shared?.address || null,accessUrl,apiBaseUrl:`${accessUrl}/api`};
  } catch(error) { sharedServer?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); throw error; }
}
