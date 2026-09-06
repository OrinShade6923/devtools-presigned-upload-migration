import test from "node:test";
import assert from "node:assert/strict";
import { uploadRequest } from "./upload_service";

test("asset request accepts a bounded devtools bundle", () => {
  const parsed = uploadRequest.parse({ assetKey: "releases/2026-09/app.js", contentType: "application/javascript", sizeBytes: 2048 });
  assert.equal(parsed.sizeBytes, 2048);
});

test("asset request rejects a zero-byte upload", () => {
  assert.throws(() => uploadRequest.parse({ assetKey: "releases/app.js", contentType: "application/javascript", sizeBytes: 0 }));
});
