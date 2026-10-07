import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { createServer } from 'node:net';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, readdir, mkdir, cp, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';

export async function availablePort() {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
  });
}

export async function startManagedDatabase(directory, password) {
  const databaseDir = path.join(directory, 'postgres-17');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const port = await availablePort();
  const cluster = new EmbeddedPostgres({ databaseDir, user: 'zera', password, port,
    persistent: true, authMethod: 'scram-sha-256',
    initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
  if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) await cluster.initialise();
  await cluster.start();
  try {
    const client = cluster.getPgClient('postgres', '127.0.0.1');
    await client.connect();
    try {
      const found = await client.query("SELECT 1 FROM pg_database WHERE datname = 'zera'");
      if (!found.rowCount) await client.query('CREATE DATABASE zera');
    } finally { await client.end(); }
    return { cluster, databaseDir, databaseUrl: `postgresql://zera:${encodeURIComponent(password)}@127.0.0.1:${port}/zera` };
  } catch (error) { await cluster.stop(); throw error; }
}

// A clean, stopped-cluster copy is retained before any upgrade. Never copy a running cluster.
export async function backupStoppedDatabase(directory, { routine = false } = {}) {
  const source = path.join(directory, 'postgres-17');
  if (!existsSync(path.join(source, 'PG_VERSION'))) return;
  if (existsSync(path.join(source, 'postmaster.pid'))) throw new Error('The local database is still running. Close other Zera instances before upgrading.');
  const destination = path.join(directory, 'backups', `${routine ? 'daily' : 'before-upgrade'}-${Date.now()}-${randomUUID()}`);
  const temporary = `${destination}.incomplete`;
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  await cp(source, temporary, { recursive: true, errorOnExist: true, force: false });
  // Preserve the schema marker with the database; credentials remain in OS secure storage.
  let schemaFingerprint = null;
  try { schemaFingerprint = await readFile(path.join(directory,'schema-version'),'utf8'); }
  catch(error) { if (error.code !== 'ENOENT') throw error; }
  await writeFile(path.join(temporary,'zera-backup.json'),JSON.stringify({version:1,createdAt:new Date().toISOString(),postgresMajor:(await readFile(path.join(source,'PG_VERSION'),'utf8')).trim(),schemaFingerprint},null,2),{mode:0o600});
  await rename(temporary,destination);
  return destination;
}

// Only completed daily copies count. Upgrade recovery copies are never pruned here.
export async function dailyBackupDue(directory, now = new Date()) {
  const backups = path.join(directory, 'backups');
  let entries;
  try { entries = await readdir(backups, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return true; throw error; }
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^daily-\d+-[a-f0-9-]+$/.test(entry.name)) continue;
    try {
      const metadata = JSON.parse(await readFile(path.join(backups, entry.name, 'zera-backup.json'), 'utf8'));
      const age = now.getTime() - new Date(metadata.createdAt).getTime();
      if (metadata.version === 1 && age >= 0 && age < 24 * 60 * 60 * 1000) return false;
    } catch { /* Incomplete or unreadable copies do not provide protection. */ }
  }
  return true;
}

export async function createDailyBackup(directory) {
  const destination = await backupStoppedDatabase(directory, { routine: true });
  if (!destination) return;
  const backups = path.join(directory, 'backups');
  const copies = (await readdir(backups, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^daily-\d+-[a-f0-9-]+$/.test(entry.name))
    .map(entry => entry.name).sort().reverse();
  // Retention runs only after the new copy has completed successfully.
  for (const name of copies.slice(7)) await rm(path.join(backups, name), { recursive: true });
  return destination;
}

export async function migrationPlan(records, migrationsDir) {
  const blocked = message => Object.assign(new Error(message),{code:'ZERA_UPGRADE_BLOCKED'});
  const directories = (await readdir(migrationsDir, {withFileTypes:true})).filter(item => item.isDirectory()).map(item => item.name).sort();
  const migrations = await Promise.all(directories.map(async name => {
    const sql = await readFile(path.join(migrationsDir,name,'migration.sql'),'utf8');
    return {name,sql,checksum:createHash('sha256').update(sql).digest('hex')};
  }));
  const active = records.filter(record => !record.rolled_back_at);
  for (const record of active) {
    const bundled = migrations.find(migration => migration.name === record.migration_name);
    if (!bundled) throw blocked('This database requires a newer Zera installer. No migrations were applied.');
    if (!record.finished_at || record.checksum !== bundled.checksum) throw blocked(`Database migration needs support: ${record.migration_name}. No migrations were applied.`);
  }
  // Validate every existing migration before applying any new one.
  return migrations.filter(migration => !active.some(record => record.migration_name === migration.name));
}

export async function applyMigrations(databaseUrl, migrationsDir) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock(728391021)');
    await client.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      id varchar(36) PRIMARY KEY, checksum varchar(64) NOT NULL, finished_at timestamptz,
      migration_name varchar(255) NOT NULL, logs text, rolled_back_at timestamptz,
      started_at timestamptz NOT NULL DEFAULT now(), applied_steps_count integer NOT NULL DEFAULT 0)`);
    const applied = await client.query('SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"');
    const pending = await migrationPlan(applied.rows,migrationsDir);
    for (const {name,sql,checksum} of pending) {
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, applied_steps_count) VALUES ($1,$2,$3,now(),1)', [randomUUID(), checksum, name]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
    }
  } finally { await client.end(); }
}
