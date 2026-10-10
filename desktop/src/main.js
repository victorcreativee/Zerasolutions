import { app as electronApp, BrowserWindow, dialog, ipcMain, Menu, safeStorage } from "electron";
import { createRequire } from "node:module";
import { randomBytes, createHash } from 'node:crypto';
import { startManagedDatabase, applyMigrations, backupStoppedDatabase, dailyBackupDue, createDailyBackup } from './localDatabase.js';
import { provisionWorkspace, validateOwner } from './provisionWorkspace.js';
import { startApplicationServer } from './localServer.js';
import { DeviceManagement } from './deviceManagement.js';
import { validateSharedServer } from './sharedServer.js';
import { readRuntimeSettings, saveRuntimeSettings, validateDatabaseUrl } from './runtimeSettings.js';
import { prepareRecovery, listRecoveryBackups, recoverInterruptedRestore } from './recovery.js';
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resourceRoot = electronApp.isPackaged ? electronApp.getAppPath() : path.resolve(__dirname, "..");
const desktopBuildRoot = path.join(resourceRoot, ".desktop-build");
const frontendRoot = path.join(desktopBuildRoot, "frontend");
const backendRoot = path.join(desktopBuildRoot, "backend");

let apiServer;
let sharedApiServer;
let managementWindow;
let deviceManagement;
let sharedSettings = {};
const pendingTLS = {};
let setupWindow;
let desktopContext;
let configuring = false;
let managedDatabase;
let quitting = false;
process.umask(0o077);
const hasInstanceLock = electronApp.requestSingleInstanceLock();
if (!hasInstanceLock) electronApp.quit();
electronApp.on('second-instance', () => { const window = BrowserWindow.getAllWindows()[0]; if (window) window.focus(); else if (desktopContext) void createMainWindow(desktopContext); });
const require = createRequire(import.meta.url);

async function prepareManagedDatabase(settings) {
  const directory = electronApp.getPath('userData');
  await recoverInterruptedRestore(directory);
  const migrationsDir = path.join(backendRoot, 'prisma', 'migrations');
  const names = (await readdir(migrationsDir, {withFileTypes:true})).filter(item => item.isDirectory()).map(item => item.name).sort();
  const hash = createHash('sha256');
  for (const name of names) hash.update(await readFile(path.join(migrationsDir, name, 'migration.sql')));
  const fingerprint = hash.digest('hex');
  const marker = path.join(directory, 'schema-version');
  const previous = existsSync(marker) ? await readFile(marker, 'utf8') : '';
  const password = decodeURIComponent(new URL(settings.databaseUrl).password);
  managedDatabase = await startManagedDatabase(directory, password);
  const upgrading = previous && previous !== fingerprint;
  const dailyDue = previous && await dailyBackupDue(directory);
  if (upgrading || dailyDue) {
    await managedDatabase.cluster.stop();
    if (upgrading) await backupStoppedDatabase(directory);
    if (dailyDue) await createDailyBackup(directory);
    managedDatabase = await startManagedDatabase(directory, password);
  }
  await applyMigrations(managedDatabase.databaseUrl, migrationsDir);
  await writeFile(marker, fingerprint, {mode:0o600});
  return managedDatabase.databaseUrl;
}

async function verifyDatabase(databaseUrl) {
  const clientPath = path.join(backendRoot, 'prisma-client');
  const { PrismaClient } = require(clientPath);
  const url = new URL(databaseUrl);
  url.searchParams.set('connect_timeout', '5');
  url.searchParams.set('socket_timeout', '5');
  const client = new PrismaClient({ datasources: { db: { url: url.href } }, log: [] });
  try {
    // Selecting current model columns also detects missing migrations.
    await client.user.findFirst();
    await client.business.findFirst();
    await client.purchaseReceipt.findFirst();
  } catch {
    throw new Error('Database check failed. Check the connection and apply the Zera migrations.');
  } finally { await client.$disconnect(); }
}

async function openApplicationSettings() {
  if (setupWindow && !setupWindow.isDestroyed()) { setupWindow.focus(); return; }
  setupWindow = new BrowserWindow({ width: 640, height: 660, minWidth: 420, minHeight: 540,
    title: 'Zera — Application settings', webPreferences: { preload: path.join(__dirname, 'setup-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  setupWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  setupWindow.webContents.on('will-navigate', event => event.preventDefault());
  setupWindow.on('closed', () => { setupWindow = null; });
  await setupWindow.loadFile(path.join(__dirname, 'setup.html'));
}

function findDeploymentManifest() {
  const embeddedManifest = path.join(desktopBuildRoot, "deployment-manifest.json");

  if (existsSync(embeddedManifest)) {
    return embeddedManifest;
  }

  const explicitManifest = process.env.ZERA_DEPLOYMENT_MANIFEST;

  if (explicitManifest && existsSync(explicitManifest)) {
    return explicitManifest;
  }

  const appDir = process.env.ZERA_APP_DIR;

  if (appDir) {
    const appManifest = path.join(appDir, "config", "deployment-manifest.json");

    if (existsSync(appManifest)) {
      return appManifest;
    }
  }

  return null;
}

function readDeploymentManifest() {
  const manifestPath = findDeploymentManifest();

  if (!manifestPath) {
    return null;
  }

  return {
    path: manifestPath,
    data: JSON.parse(readFileSync(manifestPath, "utf8"))
  };
}

async function ensureDesktopStorage(manifest) {
  const slug = String(manifest?.data?.deploymentSlug || "local-workspace").replace(/[^a-zA-Z0-9_-]/g, '-');
  const appDir = process.env.ZERA_APP_DIR || path.join(electronApp.getPath("home"), "Zera", slug);
  const configDir = path.join(appDir, "config");
  const backupDir = path.join(appDir, "backups");

  await mkdir(configDir, { recursive: true });
  await mkdir(backupDir, { recursive: true });

  return { appDir, backupDir, configDir };
}

async function startLocalApi() {
  const manifest = readDeploymentManifest();
  const storage = await ensureDesktopStorage(manifest);

  process.env.NODE_ENV = process.env.NODE_ENV || "production";
  process.env.HOST = "127.0.0.1";
  process.env.PORT = "0";
  process.env.ZERA_DESKTOP = "true";
  process.env.ZERA_APP_DIR = storage.appDir;
  process.env.ZERA_DEPLOYMENT_MANIFEST = manifest?.path || "";
  process.env.FRONTEND_URLS = "app://zera-desktop,null";

  const backendAppPath = path.join(backendRoot, "src", "app.js");
  const backendModule = await import(pathToFileURL(backendAppPath).href);

  let local;
  try { local = await startApplicationServer(backendModule.app, frontendRoot, {shared:sharedSettings}); }
  catch(error) {
    if (!sharedSettings.enabled) throw error;
    local = await startApplicationServer(backendModule.app,frontendRoot);
    await dialog.showMessageBox({type:'warning',message:'Shared access could not start.',detail:'This computer can still work locally. Check the certificate and port in Application → Connection & services.'});
  }
  apiServer = local.server;
  sharedApiServer = local.sharedServer;
  const {env} = await import(pathToFileURL(path.join(backendRoot,'src/config/env.js')).href);
  env.frontendUrls.push(local.accessUrl);
  if (local.sharedAccessUrl) env.frontendUrls.push(local.sharedAccessUrl);
  deviceManagement = new DeviceManagement({directory:electronApp.getPath('userData'),secureStorage:safeStorage,
    businessId:manifest?.data?.business?.id,version:electronApp.getVersion(),mode:() => sharedSettings.enabled ? 'SHARED_SERVER' : 'DESKTOP',
    health:async () => {
      const {prisma} = await import(pathToFileURL(path.join(backendRoot,'src/config/prisma.js')).href);
      await prisma.$queryRaw`SELECT 1`;
      const response = await fetch(`${local.accessUrl}/health`,{signal:AbortSignal.timeout(5000)});
      return response.ok && apiServer.listening && (!sharedSettings.enabled || Boolean(sharedApiServer?.listening));
    }});
  await deviceManagement.load();
  deviceManagement.start();

  return {
    apiBaseUrl: local.apiBaseUrl,
    accessUrl: local.accessUrl,
    sharedAccessUrl: local.sharedAccessUrl,
    manifest,
    storage
  };
}

async function createMainWindow(desktopContext) {
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1120,
    minHeight: 720,
    title: desktopContext.manifest?.data?.applicationName || "Zera Solutions",
    backgroundColor: "#f8faf8",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [`--zera-api-base=${desktopContext.apiBaseUrl}`, `--zera-app-version=${electronApp.getVersion()}`]
    }
  });

  const indexPath = path.join(frontendRoot, "index.html");
  window.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  window.webContents.on('will-navigate', event => event.preventDefault());

  if (!existsSync(indexPath)) {
    await dialog.showMessageBox({
      type: "error",
      title: "Zera frontend missing",
      message: "The desktop build is missing frontend files. Run npm run prepare:app before opening the desktop app."
    });
    return;
  }

  await window.loadURL(desktopContext.accessUrl);
}

async function openManagement() {
  if (managementWindow && !managementWindow.isDestroyed()) {managementWindow.focus(); return;}
  managementWindow = new BrowserWindow({width:680,height:850,webPreferences:{preload:path.join(__dirname,'management-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  managementWindow.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  managementWindow.webContents.on('will-navigate',event => event.preventDefault());
  managementWindow.on('closed',() => {managementWindow=null;});
  await managementWindow.loadFile(path.join(__dirname,'management.html'));
}

async function stopWorkspace() {
  deviceManagement?.stop();
  for (const server of [sharedApiServer, apiServer]) {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  }
  sharedApiServer = null;
  apiServer = null;
  if (desktopContext) {
    const { prisma } = await import(pathToFileURL(path.join(backendRoot, 'src/config/prisma.js')).href);
    await prisma.$disconnect();
  }
  if (managedDatabase) { await managedDatabase.cluster.stop(); managedDatabase = null; }
}

async function restoreLocalBackup() {
  if (configuring) return;
  configuring = true;
  let prepared;
  let stopped = false;
  try {
    const directory = electronApp.getPath('userData');
    const settings = await readRuntimeSettings(directory, safeStorage);
    if (!settings?.managed || !managedDatabase || !desktopContext) throw new Error('Open your local workspace before restoring a backup.');
    if (!(await listRecoveryBackups(directory)).length) throw new Error('No completed backups are available yet.');
    const selection = await dialog.showOpenDialog({title:'Select a local Zera backup',defaultPath:path.join(directory,'backups'),properties:['openDirectory']});
    if (selection.canceled) return;
    const selected = selection.filePaths[0];
    if (path.dirname(selected) !== path.join(directory,'backups')) throw new Error('Select a backup inside this installation’s backups folder.');
    const candidates = await listRecoveryBackups(directory);
    const backup = candidates.find(item => item.name === path.basename(selected));
    if (!backup) throw new Error('Select a completed backup.');
    const confirmation = await dialog.showMessageBox({type:'warning',title:'Restore backup',message:`Restore the backup from ${new Date(backup.createdAt).toLocaleString()}?`,detail:'Sales, stock and other changes after this backup will be removed from the active workspace. Connected tills will disconnect. The current database will be retained on this computer. Zera will restart.',buttons:['Cancel','Restore backup'],defaultId:0,cancelId:0});
    if (confirmation.response !== 1) return;
    const { PrismaClient } = require(path.join(backendRoot,'prisma-client'));
    const currentClient = new PrismaClient({datasources:{db:{url:managedDatabase.databaseUrl}}});
    let businessIds;
    try { businessIds = (await currentClient.business.findMany({select:{id:true}})).map(item=>item.id).sort().join(','); }
    finally { await currentClient.$disconnect(); }
    prepared = await prepareRecovery(directory, backup.name, async stage => {
      const trial = await startManagedDatabase(stage, decodeURIComponent(new URL(settings.databaseUrl).password));
      let client;
      try {
        await applyMigrations(trial.databaseUrl,path.join(backendRoot,'prisma','migrations'));
        await verifyDatabase(trial.databaseUrl);
        client = new PrismaClient({datasources:{db:{url:trial.databaseUrl}}});
        const restoredIds = (await client.business.findMany({select:{id:true}})).map(item=>item.id).sort().join(',');
        if (!businessIds || restoredIds !== businessIds) throw new Error('This backup belongs to another workspace.');
      } finally { if (client) await client.$disconnect(); await trial.cluster.stop(); }
    });
    stopped = true;
    await stopWorkspace();
    await prepared.commit();
    prepared = null;
    await dialog.showMessageBox({message:'Backup restored. Zera will restart.',detail:'Sign in again to continue.'});
  } catch (error) {
    await dialog.showMessageBox({type:'error',message:'Restore could not complete.',detail:error.message});
  } finally {
    if (prepared) await prepared.cancel();
    configuring = false;
    if (stopped) { electronApp.relaunch(); electronApp.quit(); }
  }
}

electronApp.whenReady().then(async () => {
  if (!hasInstanceLock) return;
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { label: 'Application', submenu: [{ label: 'Settings…', click: () => openApplicationSettings() },{label:'Connection & services…',click:() => openManagement()}, {label:'Access address',click:() => dialog.showMessageBox({message:desktopContext?.sharedAccessUrl || desktopContext?.accessUrl || 'Complete setup first.',detail:sharedApiServer ? 'Shared HTTPS access is available while Zera is running.' : 'This address works on this computer while Zera is running.'})}, { role: 'quit' }] },
    {label:'Recovery',submenu:[{label:'Restore local backup…',click:() => restoreLocalBackup()}]},
    { role: 'editMenu' }, { role: 'viewMenu' }
  ]));
  try {
    try { sharedSettings = JSON.parse(safeStorage.decryptString(Buffer.from(await readFile(path.join(electronApp.getPath('userData'),'shared-services'),'utf8'),'base64'))); }
    catch(error) { if (error.code !== 'ENOENT') await dialog.showMessageBox({type:'warning',message:'Shared settings could not be unlocked.',detail:'Local access remains available. Configure shared access again in Connection & services.'}); }
    const settings = await readRuntimeSettings(electronApp.getPath('userData'), safeStorage);
    if (!settings) { await openApplicationSettings(); return; }
    process.env.DATABASE_URL = settings.managed ? await prepareManagedDatabase(settings) : settings.databaseUrl;
    process.env.JWT_SECRET = settings.jwtSecret;
    await verifyDatabase(process.env.DATABASE_URL);
    if (settings.managed) {
      const { PrismaClient } = require(path.join(backendRoot, 'prisma-client'));
      const client = new PrismaClient({datasources:{db:{url:process.env.DATABASE_URL}}});
      let users;
      try { users = await client.user.count(); } finally { await client.$disconnect(); }
      if (!users) { await openApplicationSettings(); return; }
    }
    desktopContext = await startLocalApi();
    const background = sharedApiServer && sharedSettings.autoStart && (process.argv.includes('--zera-service') || electronApp.getLoginItemSettings().wasOpenedAtLogin);
    if (!background) await createMainWindow(desktopContext);
  } catch (error) {
    if (managedDatabase) { await managedDatabase.cluster.stop().catch(() => {}); managedDatabase = null; }
    if (error.code === 'ZERA_UPGRADE_BLOCKED') {
      await dialog.showMessageBox({type:'error',title:'Zera upgrade stopped',message:error.message,detail:'Your workspace has been kept. Open the matching Zera version or contact your administrator. Do not create a new workspace.'});
      electronApp.quit();
      return;
    }
    await dialog.showMessageBox({
      type: "error",
      title: "Zera could not start",
      message: "Zera needs application setup.",
      detail: "Check your database connection in Application settings."
    });
    await openApplicationSettings();
  }
});

electronApp.on("window-all-closed", () => {
  if (sharedApiServer) return;
  if (process.platform !== "darwin") {
    electronApp.quit();
  }
});

electronApp.on("before-quit", event => {
  if (quitting) return;
  if (configuring) { event.preventDefault(); return; }
  event.preventDefault();
  quitting = true;
  (async () => {
    deviceManagement?.stop();
    if (sharedApiServer) { sharedApiServer.closeAllConnections(); await new Promise(resolve => sharedApiServer.close(resolve)); }
    if (apiServer) { apiServer.closeAllConnections(); await new Promise(resolve => apiServer.close(resolve)); }
    if (managedDatabase) await managedDatabase.cluster.stop();
  })().finally(() => electronApp.quit());
});

electronApp.on('activate', async () => {
  if (!BrowserWindow.getAllWindows().length) {
    if (desktopContext) await createMainWindow(desktopContext);
    else await openApplicationSettings();
  }
});

ipcMain.handle('zera:configure', async (event, databaseUrl) => {
  if (!setupWindow || event.sender !== setupWindow.webContents || event.senderFrame !== setupWindow.webContents.mainFrame) return { ok: false, error: 'Open Application settings to configure Zera.' };
  if (configuring) return { ok: false, error: 'A connection check is already running.' };
  configuring = true;
  try {
    const validated = validateDatabaseUrl(databaseUrl);
    await verifyDatabase(validated);
    await saveRuntimeSettings(electronApp.getPath('userData'), validated, safeStorage);
    setTimeout(() => { electronApp.relaunch(); electronApp.quit(); }, 500);
    return { ok: true };
  } catch (error) { return { ok: false, error: error.message }; }
  finally { configuring = false; }
});

ipcMain.handle('zera:install', async (event, input) => {
  if (!setupWindow || event.sender !== setupWindow.webContents || event.senderFrame !== setupWindow.webContents.mainFrame) return {ok:false,error:'Open Application settings.'};
  if (configuring || desktopContext) return {ok:false,error:'Close the workspace before first-run setup.'};
  configuring = true;
  try {
    validateOwner(input);
    let settings = await readRuntimeSettings(electronApp.getPath('userData'), safeStorage);
    if (settings && !settings.managed) throw new Error('An existing database is configured. Use its existing accounts.');
    if (!settings) settings = await saveRuntimeSettings(electronApp.getPath('userData'), `postgresql://zera:${randomBytes(32).toString('hex')}@127.0.0.1:5432/zera`, safeStorage, true);
    const databaseUrl = managedDatabase?.databaseUrl || await prepareManagedDatabase(settings);
    const { PrismaClient } = require(path.join(backendRoot, 'prisma-client'));
    const client = new PrismaClient({datasources:{db:{url:databaseUrl}}});
    try { await provisionWorkspace(client, readDeploymentManifest()?.data, input); } finally { await client.$disconnect(); }
    process.env.DATABASE_URL = databaseUrl;
    process.env.JWT_SECRET = settings.jwtSecret;
    await verifyDatabase(databaseUrl);
    desktopContext = await startLocalApi();
    return {ok:true,accessUrl:desktopContext.accessUrl};
  } catch (error) { return {ok:false,error:error.message}; }
  finally { configuring = false; }
});

ipcMain.handle('zera:open-workspace', async event => {
  if (!setupWindow || event.sender !== setupWindow.webContents || event.senderFrame !== setupWindow.webContents.mainFrame || !desktopContext) return;
  await createMainWindow(desktopContext);
  setupWindow.close();
});

ipcMain.handle('zera:management',async (event,action,input) => {
  if (!managementWindow || event.sender !== managementWindow.webContents || event.senderFrame !== managementWindow.webContents.mainFrame) return {error:'Open Connection & services.'};
  try {
    if (action === 'status') return {reporting:deviceManagement?.state,shared:{enabled:Boolean(sharedSettings.enabled),address:sharedSettings.address,autoStart:Boolean(sharedSettings.autoStart)}};
    if (!desktopContext || !deviceManagement) throw new Error('Complete workspace setup first.');
    if (action === 'connect') return await deviceManagement.enroll(input);
    if (action === 'check') return await deviceManagement.report();
    if (action === 'download') {
      const update = deviceManagement.state.update;
      if (!update) throw new Error('No update available.');
      const result = await dialog.showSaveDialog(managementWindow,{defaultPath:path.join(electronApp.getPath('downloads'),path.basename(update.fileName))});
      return result.canceled ? {message:'Download canceled.'} : await deviceManagement.download(result.filePath);
    }
    if (action === 'choose') {
      if (!['cert','key'].includes(input)) throw new Error('Invalid certificate selection.');
      const result = await dialog.showOpenDialog(managementWindow,{properties:['openFile'],filters:[{name:'PEM certificate or key',extensions:['pem','crt','key']}]});
      if (result.canceled) return {message:'Selection canceled.'};
      const content = await readFile(result.filePaths[0],'utf8');
      if (content.length > 65536) throw new Error('Certificate file is too large.');
      pendingTLS[input] = content;
      return {message:input === 'cert' ? 'Certificate selected.' : 'Private key selected.'};
    }
    if (action === 'services') {
      if (!electronApp.isPackaged && input.autoStart) throw new Error('Background startup requires an installed build.');
      const settings = {...sharedSettings,...pendingTLS,enabled:input.enabled === true,address:input.address,autoStart:input.autoStart === true};
      validateSharedServer(settings);
      if (!safeStorage.isEncryptionAvailable() || safeStorage.getSelectedStorageBackend?.() === 'basic_text') throw new Error('Operating system secure storage is required.');
      const filename = path.join(electronApp.getPath('userData'),'shared-services');
      const temporary = `${filename}.${randomBytes(8).toString('hex')}.tmp`;
      await writeFile(temporary,safeStorage.encryptString(JSON.stringify(settings)).toString('base64'),{mode:0o600});
      await rename(temporary,filename);
      if (electronApp.isPackaged) electronApp.setLoginItemSettings({openAtLogin:settings.enabled && settings.autoStart,args:['--zera-service']});
      setTimeout(() => {electronApp.relaunch({args:process.argv.slice(1).filter(arg => arg !== '--zera-service')}); electronApp.quit();},500);
      return {message:'Services saved. Restarting…'};
    }
    throw new Error('Unknown management action.');
  } catch(error) { return {error:error.message}; }
});
