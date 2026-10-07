import dotenv from "dotenv";

dotenv.config();

if (process.env.NODE_ENV === "production" && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET === "development-secret-change-me")) {
  throw new Error("Production requires a unique JWT_SECRET of at least 32 characters.");
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: process.env.PORT || 5050,
  host: process.env.HOST || "127.0.0.1",
  frontendUrls: (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET || "development-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  desktopMode: process.env.ZERA_DESKTOP === "true",
  syncEnabled: process.env.ZERA_SYNC_ENABLED !== "false",
  syncServerUrl: process.env.ZERA_SYNC_SERVER_URL || process.env.ZERA_PUBLIC_API_URL || "",
  syncDeploymentToken: process.env.ZERA_SYNC_DEPLOYMENT_TOKEN || "",
  publicApiUrl: process.env.ZERA_PUBLIC_API_URL || process.env.PUBLIC_API_URL || ""
};
