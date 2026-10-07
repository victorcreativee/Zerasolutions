import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateDatabaseUrl, saveRuntimeSettings, readRuntimeSettings } from '../../desktop/src/runtimeSettings.js';

test('desktop setup rejects remote and invalid database targets', () => {
  for (const value of ['https://localhost/db', 'postgresql://remote.example/db', 'postgresql://localhost/', null, 'postgresql://localhost/db#fragment', 'postgresql://localhost/db?host=remote.example']) assert.throws(() => validateDatabaseUrl(value));
  assert.match(validateDatabaseUrl('postgresql://user:password@127.0.0.1:5432/zera'), /127.0.0.1/);
});

test('desktop settings require secure storage and persist a random login secret', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'zera-settings-test-'));
  // Test double: the production encryptor is Electron safeStorage.
  const storage = { isEncryptionAvailable: () => true, encryptString: value => Buffer.from(value).reverse(), decryptString: value => Buffer.from(value).reverse().toString() };
  try {
    assert.equal(await readRuntimeSettings(directory, storage), null);
    const first = await saveRuntimeSettings(directory, 'postgresql://user:secret-password@localhost/zera', storage);
    assert.ok(first.jwtSecret.length >= 48);
    assert.deepEqual(await readRuntimeSettings(directory, storage), first);
    const file = await readFile(path.join(directory, 'runtime-settings.json'), 'utf8');
    assert.ok(!file.includes('secret-password')); assert.ok(!file.includes(first.jwtSecret));
    await assert.rejects(saveRuntimeSettings(directory, first.databaseUrl, { ...storage, isEncryptionAvailable: () => false }));
    await assert.rejects(saveRuntimeSettings(directory, first.databaseUrl, { ...storage, getSelectedStorageBackend: () => 'basic_text' }));
    const second = await saveRuntimeSettings(directory, first.databaseUrl, storage);
    assert.notEqual(second.jwtSecret, first.jwtSecret);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
