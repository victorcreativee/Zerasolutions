import assert from 'node:assert/strict';
import {prisma} from '../src/config/prisma.js';
import {runInstallerWorker} from '../src/modules/systemAdmin/systemAdmin.routes.js';
import {app} from '../src/app.js';
import {signAuthToken} from '../src/utils/tokens.js';
import {createHash} from 'node:crypto';
if (process.env.ZERA_REAL_BUILD !== '1' || !process.env.DATABASE_URL?.includes(':5548/zera_project_test')) throw new Error('Real build acceptance requires the isolated test database and explicit opt-in.');
const server = app.listen(0,'127.0.0.1');
await new Promise(resolve => server.once('listening',resolve));
try {
  const fixture = await prisma.installerBuild.findFirst({where:{status:'FAILED'},orderBy:{createdAt:'desc'}});
  assert.ok(fixture,'Run the integration suite first to create a deployment fixture.');
  const admin = await prisma.user.findUnique({where:{id:fixture.createdById}});
  const headers = {Authorization:`Bearer ${signAuthToken(admin)}`,'Content-Type':'application/json'};
  const base = `http://127.0.0.1:${server.address().port}/api/system-admin/businesses/${fixture.businessId}`;
  const platform = process.platform === 'darwin' ? 'mac' : 'windows';
  const requested = await fetch(`${base}/desktop-installers`,{method:'POST',headers,body:JSON.stringify({platform})});
  assert.equal(requested.status,202);
  const {installer:job} = await requested.json();
  await runInstallerWorker();
  const result = await prisma.installerBuild.findUnique({where:{id:job.id}});
  assert.equal(result.status,'READY',result.error || result.status);
  assert.equal(result.sha256.length,64);
  assert.ok(result.byteSize > 1000000);
  const download = await fetch(`${base}/desktop-installers/${platform}/download?buildId=${job.id}`,{headers});
  assert.equal(download.status,200);
  const digest = createHash('sha256');
  let size = 0;
  for await (const chunk of download.body) {digest.update(chunk);size += chunk.length;}
  assert.equal(digest.digest('hex'),result.sha256);
  assert.equal(size,result.byteSize);
  console.log(JSON.stringify({id:result.id,status:result.status,fileName:result.fileName,sha256:result.sha256,byteSize:result.byteSize}));
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await prisma.$disconnect(); }
