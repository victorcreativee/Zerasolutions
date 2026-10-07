import { randomBytes, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm, open } from 'node:fs/promises';
import path from 'node:path';

export function centralAddress(value) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || !['','/','/api','/api/'].includes(url.pathname) || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname)))) throw new Error('Use the central HTTPS address (localhost HTTP is allowed for testing).');
  return `${url.origin}/api/installations`;
}

export class DeviceManagement {
  constructor({directory,secureStorage,version,businessId,health,mode,fetcher=fetch}) {
    Object.assign(this,{directory,secureStorage,version,businessId,health,mode,fetcher});
    this.state = {connected:false,message:'Not connected',update:null};
  }
  async load() {
    try {
      const saved = JSON.parse(this.secureStorage.decryptString(Buffer.from(await readFile(path.join(this.directory,'device-registration'),'utf8'),'base64')));
      if (!this.businessId || saved.businessId !== this.businessId) throw new Error('Reconnect this organization using a new enrollment code.');
      if (!/^[a-f0-9]{64}$/.test(saved.token || '') || typeof saved.base !== 'string' || !saved.base.endsWith('/api/installations') || centralAddress(saved.base.slice(0,-'/api/installations'.length)) !== saved.base) throw new Error('Invalid registration.');
      this.registration = saved;
    }
    catch(error) { this.registration = null; if (error.code !== 'ENOENT') this.state.message = 'Saved registration could not be used. Connect this organization with a new enrollment code.'; }
  }
  async persist() {
    if (!this.secureStorage.isEncryptionAvailable() || this.secureStorage.getSelectedStorageBackend?.() === 'basic_text') throw new Error('Operating system secure storage is required.');
    await mkdir(this.directory,{recursive:true,mode:0o700});
    const filename = path.join(this.directory,'device-registration');
    const temp = `${filename}.${randomBytes(8).toString('hex')}.tmp`;
    await writeFile(temp,this.secureStorage.encryptString(JSON.stringify(this.registration)).toString('base64'),{mode:0o600});
    await rename(temp,filename);
  }
  async request(route,body) {
    const response = await this.fetcher(`${this.registration.base}${route}`,{method:body ? 'POST' : 'GET',redirect:'error',headers:{'Content-Type':'application/json',Authorization:`Bearer ${this.registration.token}`},...(body ? {body:JSON.stringify(body)} : {}),signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error(response.status === 401 ? 'Registration expired or revoked. Request a new enrollment code.' : 'Central server unavailable. Local work can continue.');
    return response.json();
  }
  async enroll({address,code,name}) {
    if (!this.businessId) throw new Error('Install an organization-specific package before connecting.');
    const base = centralAddress(address);
    if (!/^[a-f0-9]{64}$/.test(code || '') || !name?.trim() || name.length > 80) throw new Error('Enter a device name and valid enrollment code.');
    if (!this.registration || this.registration.code !== code || this.registration.base !== base) this.registration = {base,code,businessId:this.businessId,token:randomBytes(32).toString('hex')};
    await this.persist();
    const {id} = await this.request('/enroll',{code,deviceToken:this.registration.token,businessId:this.businessId,name,platform:process.platform === 'darwin' ? 'mac' : 'windows',architecture:process.arch,appVersion:this.version});
    this.registration.id = id;
    delete this.registration.code;
    await this.persist();
    await this.report();
    this.start();
    return this.state;
  }
  async report() {
    if (!this.registration?.id || this.reporting) return this.state;
    this.reporting = true;
    try {
      const healthy = await this.health().catch(() => false);
      await this.request('/heartbeat',{appVersion:this.version,mode:this.mode(),healthy});
      this.state = {...this.state,connected:true,message:healthy ? 'Connected' : 'Local services need attention',lastReportedAt:new Date().toISOString()};
      const result = await this.request('/update');
      this.state.update = result.update;
    } catch(error) { this.state = {...this.state,connected:false,message:error.message,update:null}; }
    finally { this.reporting = false; }
    return this.state;
  }
  start() { this.stop(); if (this.registration?.id) { this.timer = setInterval(() => void this.report(),60000); this.timer.unref(); void this.report(); } }
  stop() { clearInterval(this.timer); }
  async download(destination) {
    if (this.downloading) throw new Error('An update download is already running.');
    const update = this.state.update;
    if (!update || !/^[a-f0-9]{64}$/.test(update.sha256) || !Number.isSafeInteger(update.byteSize) || update.byteSize < 1 || update.byteSize > 2_000_000_000) throw new Error('Check for an update first.');
    this.downloading = true;
    const temp = `${destination}.${randomBytes(8).toString('hex')}.part`;
    let file;
    try {
      const response = await this.fetcher(`${this.registration.base}/update/${encodeURIComponent(update.id)}/download`,{redirect:'error',headers:{Authorization:`Bearer ${this.registration.token}`},signal:AbortSignal.timeout(10*60*1000)});
      if (!response.ok || !response.body) throw new Error('Update download is unavailable. Check again.');
      file = await open(temp,'wx',0o600);
      const hash = createHash('sha256'); let size = 0;
      for await (const chunk of response.body) { size += chunk.length; if (size > update.byteSize) throw new Error('Update size mismatch.'); hash.update(chunk); await file.writeFile(chunk); }
      await file.close(); file = null;
      if (size !== update.byteSize || hash.digest('hex') !== update.sha256) throw new Error('Update integrity check failed.');
      await rename(temp,destination);
      return {ok:true,message:'Download verified. Close Zera before running the installer. Distribution signing has not been verified.'};
    } finally { await file?.close(); await rm(temp,{force:true}); this.downloading = false; }
  }
}
