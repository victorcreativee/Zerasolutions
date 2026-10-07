import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical).sort((a,b) => { const first = JSON.stringify(a); const second = JSON.stringify(b); return first < second ? -1 : first > second ? 1 : 0; });
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key,canonical(value[key])]));
  return value;
}
export function configurationDigest(manifest) {
  const {generatedAt, deploymentSlug, setupStatus, catalog, ...configuration} = manifest;
  return createHash('sha256').update(JSON.stringify(canonical(configuration))).digest('hex');
}
export async function artifactDigest(filename) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}
export function publicBuild(build, currentHash, currentVersion) {
  return {id:build.id, platform:build.platform, architecture:build.architecture, appVersion:build.appVersion,
    status:build.status, fileName:build.fileName, sha256:build.sha256, byteSize:build.byteSize,
    error:build.error, createdAt:build.createdAt, startedAt:build.startedAt, finishedAt:build.finishedAt,
    outdated:build.configHash !== currentHash || build.appVersion !== currentVersion,
    verification:{readyForDirectCustomerOpen:false, warning:'Distribution signature has not been verified.'}};
}
