import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.port, env.host, () => {
  console.log(`Zera Solutions API running at http://${env.host}:${env.port}`);
});
