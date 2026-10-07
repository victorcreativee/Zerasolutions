import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const config = new URL("../src/config/env.js", import.meta.url).href;
test("production refuses missing, default, and short login-signing secrets", () => {
  for (const secret of ["", "development-secret-change-me", "short"]) {
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(config)})`], { env: { ...process.env, NODE_ENV: "production", JWT_SECRET: secret }, encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Production requires a unique JWT_SECRET/);
  }
});
test("production accepts an explicitly configured strong-length secret", () => {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(config)})`], { env: { ...process.env, NODE_ENV: "production", JWT_SECRET: "test-only-unique-secret-with-at-least-32-characters" } });
  assert.equal(result.status, 0);
});
