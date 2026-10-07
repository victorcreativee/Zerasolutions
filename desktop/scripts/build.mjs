import { spawnSync } from 'node:child_process';
const script = process.platform === 'win32' ? 'build:win' : process.platform === 'darwin' ? 'build:mac' : null;
if (!script) throw new Error('Desktop installers require Windows or macOS.');
const result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', script], {stdio:'inherit'});
process.exit(result.status ?? 1);
