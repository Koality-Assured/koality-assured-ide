import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const product = JSON.parse(readFileSync(new URL("../product.json", import.meta.url), "utf8"));

test("product.json disables telemetry", () => {
  assert.equal(product.enableTelemetry, false);
  assert.equal(product.aiConfig, undefined);
});

test("product.json routes extensionsGallery exclusively to Open VSX", () => {
  assert.equal(product.extensionsGallery?.serviceUrl, "https://open-vsx.org/vscode/gallery");
  assert.equal(product.extensionsGallery?.itemUrl, "https://open-vsx.org/vscode/item");
  assert.match(product.extensionsGallery?.resourceUrlTemplate ?? "", /^https:\/\/open-vsx\.org\/vscode\/unpkg\//);
  assert.equal(product.extensionsGallery?.controlUrl, "");
  assert.equal(product.extensionsGallery?.recommendationsUrl, "");
});

test("product.json contains no Microsoft marketplace or telemetry URLs", () => {
  const serialized = JSON.stringify(product).toLowerCase();
  assert.equal(serialized.includes("visualstudio.com"), false);
  assert.equal(serialized.includes("vscode-experiments"), false);
  assert.equal(serialized.includes("vortex.data.microsoft.com"), false);
});
