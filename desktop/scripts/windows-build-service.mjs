// Run on a dedicated Windows x64 build host with a matching Zera checkout.
// Keep loopback binding; expose through an authenticated tunnel or HTTPS proxy.
import http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, stat, rm } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('The build service requires Windows x64. Request builds from any computer through System Admin.');
const token=process.env.ZERA_WINDOWS_BUILDER_TOKEN;
if (!token || token.length<32) throw new Error('Set a random ZERA_WINDOWS_BUILDER_TOKEN of at least 32 characters.');
const expectedToken=createHash('sha256').update(`Bearer ${token}`).digest();
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const execute=promisify(execFile);
let busy=false;
const version=async()=>JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version;
const server=http.createServer(async(req,res)=>{
  if (!timingSafeEqual(expectedToken,createHash('sha256').update(req.headers.authorization || '').digest())) {req.resume();res.writeHead(401);res.end();return;}
  if (req.method==='GET' && req.url==='/health') {res.setHeader('Content-Type','application/json');res.end(JSON.stringify({platform:'windows',architecture:'x64',appVersion:await version(),busy}));return;}
  if (req.method!=='POST' || req.url!=='/build') {req.resume();res.writeHead(404);res.end();return;}
  if (busy) {req.resume();res.writeHead(409);res.end('Builder is busy.');return;}
  busy=true;
  let manifestPath;
  let artifactPath;
  try {
    let size=0;
    const chunks=[];
    for await (const chunk of req) {size+=chunk.length;if(size>20*1024**2) throw new Error('Request too large.');chunks.push(chunk);}
    const job=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(job.id || '') || !job.manifest?.business?.name || job.appVersion!==await version()) throw new Error('Invalid build request or version mismatch.');
    // Never accept commands, paths, target OS, or deployment slugs from a request.
    const slug=`build-${job.id}`;
    const folder=path.join(root,'.system-admin-manifests');
    await mkdir(folder,{recursive:true});
    manifestPath=path.join(folder,`${slug}.json`);
    await writeFile(manifestPath,JSON.stringify({...job.manifest,deploymentSlug:slug}));
    await execute('npm.cmd',['run','build:customer:win'],{cwd:root,shell:true,env:{...process.env,ZERA_DEPLOYMENT_MANIFEST:manifestPath},timeout:10*60*1000,maxBuffer:20*1024**2});
    const fileName=`Zera-${slug}-${job.appVersion}-win-x64.exe`;
    if (!(await readdir(path.join(root,'release'))).includes(fileName)) throw new Error('Installer output missing.');
    artifactPath=path.join(root,'release',fileName);
    const hash=createHash('sha256');
    for await (const chunk of createReadStream(artifactPath)) hash.update(chunk);
    const info=await stat(artifactPath);
    res.writeHead(200,{'Content-Type':'application/vnd.microsoft.portable-executable','Content-Length':info.size,'X-Installer-Filename':fileName,'X-Installer-SHA256':hash.digest('hex'),'Cache-Control':'no-store'});
    await pipeline(createReadStream(artifactPath),res);
  } catch(error) {
    console.error('Windows build failed:',error.code || error.name);
    if (!res.headersSent) {res.writeHead(500);res.end('Windows build failed. Check the builder and matching application version.');}
    else res.destroy();
  } finally {
    if(manifestPath) await rm(manifestPath,{force:true}).catch(()=>{});
    if(artifactPath) await rm(artifactPath,{force:true}).catch(()=>{});
    // Prepared resources contain organization configuration; discard them after transfer.
    await rm(path.join(root,'.desktop-build'),{recursive:true,force:true}).catch(()=>{});
    busy=false;
  }
});
server.requestTimeout=60*1000;
server.listen(Number(process.env.ZERA_WINDOWS_BUILDER_PORT || 5070),'127.0.0.1',()=>console.log('Zera Windows builder listening on loopback.'));
