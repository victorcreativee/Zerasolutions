import { createHash } from 'node:crypto';

export const tokenDigest = value => createHash('sha256').update(value).digest('hex');
export function publicInstallation(device, now = Date.now()) {
  return {id:device.id,name:device.name,platform:device.platform,architecture:device.architecture,
    appVersion:device.appVersion,mode:device.mode,installedAt:device.createdAt,lastSeenAt:device.lastSeenAt,
    status:device.revokedAt ? 'REVOKED' : !device.lastSeenAt ? 'INSTALLED' : now - new Date(device.lastSeenAt).getTime() > 180000 ? 'OFFLINE' : device.healthy ? 'ONLINE' : 'NEEDS_ATTENTION'};
}
export function isNewerVersion(candidate, installed) {
  if (!/^\d+\.\d+\.\d+$/.test(candidate) || !/^\d+\.\d+\.\d+$/.test(installed)) return false;
  const a = candidate.split('.').map(Number), b = installed.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
