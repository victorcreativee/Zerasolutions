import { app } from "./app.js";
import { env } from "./config/env.js";
import { startInstallerWorker } from './modules/systemAdmin/systemAdmin.routes.js';

app.listen(env.port, env.host, () => {
  if (process.env.ZERA_INSTALLER_WORKER !== 'false') startInstallerWorker();
  console.log(`Zera Solutions API running at http://${env.host}:${env.port}`);
});
