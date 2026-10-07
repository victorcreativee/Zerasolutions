const { contextBridge } = require("electron");

const apiArgument = process.argv.find((argument) => argument.startsWith("--zera-api-base="));
const apiBaseUrl = apiArgument ? apiArgument.replace("--zera-api-base=", "") : "http://127.0.0.1:5050/api";
const versionArgument = process.argv.find((argument) => argument.startsWith("--zera-app-version="));
const appVersion = versionArgument ? versionArgument.replace("--zera-app-version=", "") : "";

contextBridge.exposeInMainWorld("zeraDesktop", {
  appVersion,
  apiBaseUrl,
  mode: "desktop"
});
