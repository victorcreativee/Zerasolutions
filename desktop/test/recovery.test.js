import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {backupStoppedDatabase} from '../src/localDatabase.js';
import {prepareRecovery,listRecoveryBackups,recoverInterruptedRestore} from '../src/recovery.js';

async function fixture() {
  const directory=await mkdtemp(path.join(tmpdir(),'zera-recovery-'));
  const cluster=path.join(directory,'postgres-17');
  await mkdir(cluster);
  await writeFile(path.join(cluster,'PG_VERSION'),'17');
  await writeFile(path.join(cluster,'data'),'old sale');
  const backup=await backupStoppedDatabase(directory);
  await writeFile(path.join(cluster,'data'),'new sale');
  return {directory,cluster,name:path.basename(backup)};
}

test('restore validates before replacement and retains current data',async () => {
  const {directory,cluster,name}=await fixture();
  assert.equal((await listRecoveryBackups(directory)).length,1);
  await assert.rejects(prepareRecovery(directory,'../postgres-17',async()=>{}),/Select a completed/);
  await assert.rejects(prepareRecovery(directory,name,async()=>{throw new Error('invalid database');}),/invalid database/);
  assert.equal(await readFile(path.join(cluster,'data'),'utf8'),'new sale');
  const prepared=await prepareRecovery(directory,name,async stage=>{
    assert.equal(await readFile(path.join(stage,'postgres-17','data'),'utf8'),'old sale');
  });
  const retained=await prepared.commit();
  assert.equal(await readFile(path.join(cluster,'data'),'utf8'),'old sale');
  assert.equal(await readFile(path.join(retained,'data'),'utf8'),'new sale');
  assert.equal((await listRecoveryBackups(directory)).some(item=>item.name===path.basename(retained)),true);
});

test('restore refuses a running database',async () => {
  const {directory,cluster,name}=await fixture();
  const prepared=await prepareRecovery(directory,name,async()=>{});
  await writeFile(path.join(cluster,'postmaster.pid'),'running');
  await assert.rejects(prepared.commit(),/Stop the database/);
  assert.equal(await readFile(path.join(cluster,'data'),'utf8'),'new sale');
  await prepared.cancel();
});

test('interrupted restore recovers the original database before startup',async () => {
  for (const replacementPresent of [false,true]) {
    const {directory,cluster}=await fixture();
    const retained='before-restore-123-abcd';
    await writeFile(path.join(directory,'restore-pending.json'),JSON.stringify({retained}));
    await rename(cluster,path.join(directory,'backups',retained));
    if (replacementPresent) {await mkdir(cluster);await writeFile(path.join(cluster,'data'),'partial replacement');}
    await recoverInterruptedRestore(directory);
    assert.equal(await readFile(path.join(cluster,'data'),'utf8'),'new sale');
    await recoverInterruptedRestore(directory);
  }
});
