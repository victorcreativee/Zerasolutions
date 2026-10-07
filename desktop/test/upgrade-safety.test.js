import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {migrationPlan,backupStoppedDatabase,dailyBackupDue,createDailyBackup} from '../src/localDatabase.js';

test('upgrade preflight rejects newer databases, modified migrations and incomplete migrations',async () => {
  const directory=await mkdtemp(path.join(tmpdir(),'zera-upgrade-plan-'));
  for (const name of ['001','002']) {await mkdir(path.join(directory,name));await writeFile(path.join(directory,name,'migration.sql'),`SELECT ${Number(name)};`);}
  const record={migration_name:'001',checksum:createHash('sha256').update('SELECT 1;').digest('hex'),finished_at:new Date(),rolled_back_at:null};
  assert.deepEqual((await migrationPlan([record],directory)).map(item=>item.name),['002']);
  for (const records of [[record,{...record,migration_name:'003'}],[{...record,checksum:'bad'}],[{...record,finished_at:null}]]) {
    await assert.rejects(migrationPlan(records,directory),error=>error.code==='ZERA_UPGRADE_BLOCKED');
  }
  assert.deepEqual((await migrationPlan([{...record,rolled_back_at:new Date()}],directory)).map(item=>item.name),['001','002']);
});

test('backup completes atomically with schema metadata and refuses a running database',async () => {
  const directory=await mkdtemp(path.join(tmpdir(),'zera-upgrade-backup-'));
  const cluster=path.join(directory,'postgres-17');await mkdir(cluster);
  await writeFile(path.join(cluster,'PG_VERSION'),'17\n');
  await writeFile(path.join(cluster,'test-data'),'preserve me');
  await writeFile(path.join(directory,'schema-version'),'original-schema');
  const backup=await backupStoppedDatabase(directory);
  assert.equal(await readFile(path.join(backup,'test-data'),'utf8'),'preserve me');
  const metadata=JSON.parse(await readFile(path.join(backup,'zera-backup.json'),'utf8'));
  assert.equal(metadata.schemaFingerprint,'original-schema');assert.equal(metadata.postgresMajor,'17');
  assert.equal((await readdir(path.join(directory,'backups'))).some(name=>name.endsWith('.incomplete')),false);
  await writeFile(path.join(cluster,'postmaster.pid'),'running');
  await assert.rejects(backupStoppedDatabase(directory),/still running/);
});

test('routine backups retain seven copies, preserve upgrade copies and ignore incomplete backups',async () => {
  const directory=await mkdtemp(path.join(tmpdir(),'zera-daily-backup-'));
  const cluster=path.join(directory,'postgres-17');await mkdir(cluster);
  await writeFile(path.join(cluster,'PG_VERSION'),'17\n');
  await writeFile(path.join(cluster,'business-data'),'sales and stock');
  assert.equal(await dailyBackupDue(directory),true);
  const upgrade=await backupStoppedDatabase(directory);
  const incomplete=path.join(directory,'backups','daily-123-abc.incomplete');await mkdir(incomplete);
  assert.equal(await dailyBackupDue(directory),true);
  for(let index=0;index<9;index++) await createDailyBackup(directory);
  assert.equal(await dailyBackupDue(directory),false);
  assert.equal(await dailyBackupDue(directory,new Date(Date.now()+25*60*60*1000)),true);
  const entries=await readdir(path.join(directory,'backups'));
  const daily=entries.filter(name=>/^daily-\d+-[a-f0-9-]+$/.test(name));
  assert.equal(daily.length,7);
  assert.equal(await readFile(path.join(upgrade,'business-data'),'utf8'),'sales and stock');
  for(const name of daily) assert.equal(await readFile(path.join(directory,'backups',name,'business-data'),'utf8'),'sales and stock');
  await writeFile(path.join(cluster,'postmaster.pid'),'running');
  await assert.rejects(createDailyBackup(directory),/still running/);
  assert.deepEqual(await readdir(path.join(directory,'backups')),entries);
});
