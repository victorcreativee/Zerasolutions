import { env } from "../config/env.js";

export function notFoundHandler(req, _res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

export function errorHandler(error, _req, res, _next) {
  const databaseMessages = {
    P1001: "Database is not reachable. Start PostgreSQL, then try again.",
    P2021: "Database tables are not ready. Run the Prisma migration, then try again.",
    P2022: "Database schema is out of date. Run the Prisma migration, then try again."
  };

  const isDatabaseConnectionError =
    error.name === "PrismaClientInitializationError" ||
    error.message?.includes("Can't reach database server") ||
    error.message?.includes("Can't connect to database server");

  const statusCode = error.statusCode || (databaseMessages[error.code] || isDatabaseConnectionError ? 503 : 500);
  const message =
    databaseMessages[error.code] ||
    (isDatabaseConnectionError ? "Database is not reachable. Start PostgreSQL, then try again." : null) ||
    (statusCode === 500 ? "Something went wrong." : error.message);

  if (env.nodeEnv === "development") {
    console.error(error);
  }

  res.status(statusCode).json({
    message,
    ...(env.nodeEnv === "development" && statusCode === 500 ? { detail: error.message } : {})
  });
}
