import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rename, lstat, rm, writeFile, unlink } from 'node:fs/promises';

export async function recoverInterruptedRestore(directory) {
  const journal = path.join(directory, 'restore-pending.json');
  let pending;
  try { pending = JSON.parse(await readFile(journal, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  if (!/^before-restore-\d+-[a-f0-9-]+$/.test(pending.retained)) throw new Error('Restore recovery record is invalid. Contact support.');
  const retained = path.join(directory, 'backups', pending.retained);
  try { await lstat(retained); }
  catch (error) { if (error.code === 'ENOENT') { await unlink(journal); return; } throw error; }
  const current = path.join(directory, 'postgres-17');
  try { await lstat(path.join(current, 'postmaster.pid')); throw new Error('Stop the database before recovering an interrupted restore.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  try { await rename(current, path.join(directory, `recovery-interrupted-${randomUUID()}`)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await rename(retained, current);
  await unlink(journal);
}

export async function listRecoveryBackups(directory) {
  const root = path.join(directory, 'backups');
  let entries;
  try { entries = await readdir(root, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const result = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^(daily|before-upgrade|before-restore)-\d+-[a-f0-9-]+$/.test(entry.name)) continue;
    try {
      const metadata = JSON.parse(await readFile(path.join(root, entry.name, 'zera-backup.json'), 'utf8'));
      if (metadata.version === 1 && metadata.postgresMajor === '17' && Number.isFinite(Date.parse(metadata.createdAt))) {
        result.push({ name: entry.name, createdAt: metadata.createdAt });
      }
    } catch { /* Partial copies are not restore candidates. */ }
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function rejectLinks(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('Backups containing symbolic links cannot be restored.');
    if (entry.isDirectory()) await rejectLinks(path.join(directory, entry.name));
  }
}

// Validate a separate copy before touching the current database. The caller must
// stop all database clients and the managed cluster before calling commit().
export async function prepareRecovery(directory, name, validate) {
  if (!(await listRecoveryBackups(directory)).some(item => item.name === name)) throw new Error('Select a completed backup from this installation.');
  const source = path.join(directory, 'backups', name);
  if ((await lstat(source)).isSymbolicLink()) throw new Error('Invalid backup directory.');
  await rejectLinks(source);
  const stage = path.join(directory, `recovery-${randomUUID()}`);
  await mkdir(stage, { mode: 0o700 });
  try {
    await cp(source, path.join(stage, 'postgres-17'), { recursive: true, force: false, errorOnExist: true });
    await validate(stage);
  } catch (error) {
    await rm(stage, { recursive: true, force: true });
    throw error;
  }
  return {
    cancel: () => rm(stage, { recursive: true, force: true }),
    async commit() {
      const current = path.join(directory, 'postgres-17');
      for (const root of [current, path.join(stage, 'postgres-17')]) {
        try { await lstat(path.join(root, 'postmaster.pid')); }
        catch (error) { if (error.code === 'ENOENT') continue; throw error; }
        throw new Error('Stop the database before restoring.');
      }
      const retained = path.join(directory, 'backups', `before-restore-${Date.now()}-${randomUUID()}`);
      let schemaFingerprint = null;
      try { schemaFingerprint = await readFile(path.join(directory,'schema-version'),'utf8'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      await writeFile(path.join(current,'zera-backup.json'),JSON.stringify({version:1,createdAt:new Date().toISOString(),postgresMajor:(await readFile(path.join(current,'PG_VERSION'),'utf8')).trim(),schemaFingerprint}),{mode:0o600});
      const journal = path.join(directory, 'restore-pending.json');
      await writeFile(journal, JSON.stringify({retained:path.basename(retained)}), {flag:'wx',mode:0o600});
      await rename(current, retained);
      try { await rename(path.join(stage, 'postgres-17'), current); }
      catch (error) { await rename(retained, current); await unlink(journal); throw error; }
      await unlink(journal);
      await rm(stage, { recursive: true, force: true });
      return retained;
    }
  };
}
