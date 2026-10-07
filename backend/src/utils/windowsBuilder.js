import { open, mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { localWindowsBuilderStatus, buildWindowsLocally } from './localWindowsBuilder.js';

export function windowsBuilderConfig(env = process.env) {
  if (!env.ZERA_WINDOWS_BUILDER_URL || !env.ZERA_WINDOWS_BUILDER_TOKEN) return null;
  const url = new URL(env.ZERA_WINDOWS_BUILDER_URL);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Invalid Windows builder URL.');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) throw new Error('Windows builder requires HTTPS or a local tunnel.');
  if (env.ZERA_WINDOWS_BUILDER_TOKEN.length < 32) throw new Error('Windows builder token must contain at least 32 characters.');
  return {url: url.origin, token: env.ZERA_WINDOWS_BUILDER_TOKEN};
}

export async function windowsBuilderStatus(version) {
  try {
    const config = windowsBuilderConfig();
    if (!config) return localWindowsBuilderStatus();
    const response = await fetch(`${config.url}/health`, {headers:{Authorization:`Bearer ${config.token}`}, redirect:'error', signal:AbortSignal.timeout(3000)});
    if (!response.ok) throw new Error('unavailable');
    const status = await response.json();
    if (status.platform !== 'windows' || status.architecture !== 'x64' || status.appVersion !== version) return {available:false,message:'Windows builder must run the same Zera version on Windows x64.'};
    return {available:true, architecture:'x64', remote:true, busy:Boolean(status.busy)};
  } catch { return {available:false,message:'Windows builder is unavailable. Check its connection and credentials.'}; }
}

export async function buildOnWindows(job, folder) {
  const config = windowsBuilderConfig();
  if (!config) return buildWindowsLocally(job,folder);
  const response = await fetch(`${config.url}/build`, {method:'POST', headers:{Authorization:`Bearer ${config.token}`,'Content-Type':'application/json'}, body:JSON.stringify({id:job.id, appVersion:job.appVersion, manifest:job.manifest}), redirect:'error', signal:AbortSignal.timeout(12*60*1000)});
  if (!response.ok) throw new Error(`Windows build failed (${response.status}).`);
  return saveWindowsArtifact(response, folder);
}

export async function saveWindowsArtifact(response, folder) {
  const fileName = response.headers.get('x-installer-filename');
  const expected = response.headers.get('x-installer-sha256');
  const size = Number(response.headers.get('content-length'));
  if (!fileName || !/^Zera-[a-zA-Z0-9._-]+-win-x64\.exe$/.test(fileName) || !/^[a-f0-9]{64}$/.test(expected || '') || !Number.isSafeInteger(size) || size < 2 || size > 2*1024**3 || !response.body) {
    await response.body?.cancel();
    throw new Error('Invalid Windows installer response.');
  }
  await mkdir(folder,{recursive:true,mode:0o700});
  const filePath=path.join(folder,fileName);
  const temporary=`${filePath}.partial`;
  const file=await open(temporary,'wx',0o600);
  const hash=createHash('sha256');
  let received=0;
  let prefix=Buffer.alloc(0);
  try {
    for await (const chunk of response.body) {
      received+=chunk.length;
      if (received>size) throw new Error('Installer exceeds declared size.');
      if (prefix.length<2) prefix=Buffer.concat([prefix,Buffer.from(chunk)]).subarray(0,2);
      hash.update(chunk);
      await file.writeFile(chunk);
    }
    if (received!==size || hash.digest('hex')!==expected || prefix.toString('ascii')!=='MZ') throw new Error('Windows installer failed its integrity check.');
    await file.close();
    await rename(temporary,filePath);
    return {filePath,fileName};
  } catch(error) { await file.close().catch(()=>{}); await rm(temporary,{force:true}); throw error; }
}
