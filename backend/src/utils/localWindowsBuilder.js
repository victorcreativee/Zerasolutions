import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readdir, rm, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const execute=promisify(execFile);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
let cached;
export async function localWindowsBuilderStatus() {
  if(cached && Date.now()-cached.at<10000) return cached.value;
  let value;
  try {const result=await execute('docker',['info','--format','{{.OSType}}'],{timeout:3000,maxBuffer:4096});
    if(result.stdout.trim()!=='linux') throw new Error('Linux containers required');
    value={available:true,architecture:'x64',local:true,remote:false};
  } catch {value={available:false,message:'Start Docker Desktop to build Windows installers on this computer.'};}
  cached={at:Date.now(),value};return value;
}
export async function buildWindowsLocally(job,folder) {
  if(!/^[a-zA-Z0-9_-]+$/.test(job.id)) throw new Error('Invalid build ID.');
  const name=`zera-build-${job.id}`;
  const stage=path.join(root,'desktop','.system-admin-manifests',job.id);
  await mkdir(stage,{recursive:true,mode:0o700});
  await mkdir(folder,{recursive:true,mode:0o700});
  try {
    // Explicit build inputs only. No project-root mount, .env, databases or host home.
    const inputs=['backend/package.json','backend/package-lock.json','backend/src','backend/prisma',
      'frontend/package.json','frontend/package-lock.json','frontend/src','frontend/public','frontend/index.html','frontend/vite.config.js','frontend/tailwind.config.js','frontend/postcss.config.js',
      'desktop/package.json','desktop/package-lock.json','desktop/src','desktop/scripts'];
    for(const entry of inputs) await cp(path.join(root,entry),path.join(stage,entry),{recursive:true,filter:source=>!['.env','.git','node_modules'].includes(path.basename(source))});
    await writeFile(path.join(stage,'deployment.json'),JSON.stringify({...job.manifest,deploymentSlug:`build-${job.id}`}),{mode:0o600});
    await execute('docker',['run','--rm','--name',name,'--platform','linux/amd64',
      '--mount',`type=bind,source=${stage},target=/source,readonly`,
      '--mount',`type=bind,source=${folder},target=/output`,
      'electronuserland/builder@sha256:41ae540902461b6cbc988987db79547fcc10cda04d2a6c6367504f59d4b37c64','bash','/source/desktop/scripts/build-windows-container.sh'],{timeout:40*60*1000,maxBuffer:20*1024**2});
    const fileName=`Zera-build-${job.id}-${job.appVersion}-win-x64.exe`;
    if(!(await readdir(folder)).includes(fileName)) throw new Error('Installer output missing.');
    return {fileName,filePath:path.join(folder,fileName)};
  } catch(error) {
    await writeFile(path.join(folder,'build.log'),[
      `Exit: ${error.code ?? 'unknown'}; signal: ${error.signal ?? 'none'}`,
      String(error.stdout || '').slice(-80000),
      String(error.stderr || '').slice(-20000),
      String(error.message || '').split('\n')[0]
    ].join('\n'),{mode:0o600});
    throw error;
  } finally {
    await execute('docker',['rm','-f',name],{timeout:10000}).catch(()=>{});
    await rm(stage,{recursive:true,force:true});
  }
}
