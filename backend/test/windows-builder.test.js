import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { windowsBuilderConfig, saveWindowsArtifact } from '../src/utils/windowsBuilder.js';

test('Windows builder requires authenticated HTTPS or a loopback tunnel',()=>{
  assert.equal(windowsBuilderConfig({}),null);
  const env={ZERA_WINDOWS_BUILDER_URL:'http://127.0.0.1:5070',ZERA_WINDOWS_BUILDER_TOKEN:'a'.repeat(32)};
  assert.equal(windowsBuilderConfig(env).url,'http://127.0.0.1:5070');
  for(const url of ['http://builder.example','https://user:secret@builder.example','https://builder.example/?secret=x']) assert.throws(()=>windowsBuilderConfig({...env,ZERA_WINDOWS_BUILDER_URL:url}));
  assert.throws(()=>windowsBuilderConfig({...env,ZERA_WINDOWS_BUILDER_TOKEN:'short'}));
});

function response(bytes,overrides={}) {
  return new Response(bytes,{headers:{'x-installer-filename':'Zera-build-example-0.3.1-win-x64.exe','x-installer-sha256':createHash('sha256').update(bytes).digest('hex'),'content-length':String(bytes.length),...overrides}});
}
test('remote installer is saved only after size, executable header and checksum validation',async()=>{
  const folder=await mkdtemp(path.join(os.tmpdir(),'zera-builder-'));
  try {
    const bytes=Buffer.from('MZsample-test-only');
    const result=await saveWindowsArtifact(response(bytes),folder);
    assert.deepEqual(await readFile(result.filePath),bytes);
    assert.equal((await readdir(folder)).length,1);
  } finally {await rm(folder,{recursive:true,force:true});}
});
for(const [name,bytes,headers] of [
  ['bad checksum',Buffer.from('MZsample'),{'x-installer-sha256':'0'.repeat(64)}],
  ['truncated transfer',Buffer.from('MZsample'),{'content-length':'999'}],
  ['wrong executable',Buffer.from('not windows'),{}],
  ['path traversal',Buffer.from('MZsample'),{'x-installer-filename':'../Zera-bad-win-x64.exe'}],
  ['oversized response',Buffer.from('MZsample'),{'content-length':String(3*1024**3)}],
]) test(`rejects ${name} without leaving an installer`,async()=>{
  const folder=await mkdtemp(path.join(os.tmpdir(),'zera-builder-'));
  try {await assert.rejects(saveWindowsArtifact(response(bytes,headers),folder));assert.deepEqual(await readdir(folder),[]);}
  finally {await rm(folder,{recursive:true,force:true});}
});
