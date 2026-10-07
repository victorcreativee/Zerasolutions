import { randomBytes } from 'node:crypto';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';

export function validateDatabaseUrl(value) {
  if (typeof value !== 'string' || value.length > 4096) throw new Error('Enter a valid PostgreSQL connection URL.');
  let url;
  try { url = new URL(value); } catch { throw new Error('Enter a valid PostgreSQL connection URL.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2 || url.hash) throw new Error('Enter a PostgreSQL URL including the database name.');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Standalone setup requires a database on this computer.');
  const allowedOptions = new Set(['schema', 'connection_limit', 'connect_timeout', 'pool_timeout', 'socket_timeout', 'sslmode']);
  for (const key of url.searchParams.keys()) if (!allowedOptions.has(key)) throw new Error('Remove unsupported connection options.');
  return url.href;
}

export async function readRuntimeSettings(directory, secureStorage) {
  let settings;
  try { settings = JSON.parse(await readFile(path.join(directory, 'runtime-settings.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw new Error('Saved settings could not be read. Open Application settings to reconnect.'); }
  try {
    if (settings.version !== 1) throw new Error();
    const secret = JSON.parse(secureStorage.decryptString(Buffer.from(settings.encrypted, 'base64')));
    if (typeof secret.jwtSecret !== 'string' || secret.jwtSecret.length < 48) throw new Error();
    return { databaseUrl: validateDatabaseUrl(secret.databaseUrl), jwtSecret: secret.jwtSecret, managed: secret.managed === true };
  } catch { throw new Error('Saved settings could not be unlocked. Open Application settings to reconnect.'); }
}

export async function saveRuntimeSettings(directory, databaseUrl, secureStorage, managed = false) {
  const validated = validateDatabaseUrl(databaseUrl);
  if (!secureStorage.isEncryptionAvailable() || secureStorage.getSelectedStorageBackend?.() === 'basic_text') throw new Error('Secure storage is unavailable. Enable your operating system keychain and try again.');
  const secret = { databaseUrl: validated, jwtSecret: randomBytes(48).toString('base64url'), managed };
  const encrypted = secureStorage.encryptString(JSON.stringify(secret)).toString('base64');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const filename = path.join(directory, 'runtime-settings.json');
  const temporary = `${filename}.${randomBytes(8).toString('hex')}.tmp`;
  await writeFile(temporary, JSON.stringify({ version: 1, encrypted }), { mode: 0o600 });
  await rename(temporary, filename);
  return secret;
}
