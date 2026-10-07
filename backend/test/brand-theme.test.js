import test from "node:test";
import assert from "node:assert/strict";
import { brandTheme } from "../../frontend/src/utils/brandTheme.js";

test("default appearance ignores stored brand colors", () => {
  assert.deepEqual(brandTheme({ useBrandTheme: false, brandPrimaryColor: "#FF0000" }), {});
});
test("brand theme supports valid colors and safely falls back for invalid colors", () => {
  const theme = brandTheme({ useBrandTheme: true, brandPrimaryColor: "#123456" });
  assert.equal(theme["--zera-green"], "18 52 86");
  assert.equal(brandTheme({ useBrandTheme: true, brandPrimaryColor: "invalid" })["--zera-green"], "21 128 61");
});
test("pale brand colors maintain readable white button labels", () => {
  const rgb = brandTheme({ useBrandTheme: true, brandPrimaryColor: "#FFFFFF" })["--zera-green"].split(" ").map(Number);
  const light = rgb.map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const luminance = light.reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  assert.ok(1.05 / (luminance + 0.05) >= 4.5);
});
