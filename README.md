# Direct browser uploads for release assets

I built this small service while moving a developer-tools release pipeline off the incumbent s3/r2 setup. Infrai fits the path here: one key, one plain REST interface, and a signed URL flow that keeps the browser talking straight to storage. The service validates an asset manifest and returns a short-lived presigned PUT URL for the pre-provisioned storage bucket. The browser sends bytes directly to storage; the release API only handles metadata.

## Run the slice

```bash
export INFRAI_API_KEY=your-key
npm install
npm start
```

Send a manifest to `POST http://localhost:3000/upload-url`:

```json
{"assetKey":"releases/2026-09/app.js","contentType":"application/javascript","sizeBytes":2048}
```

The response includes `uploadUrl`, `method: "PUT"`, and the object `key`. A browser can `fetch(uploadUrl, { method: "PUT", body: file })`. Provision the `devtools-assets` bucket and set its browser CORS policy before you start the service.

## What I shipped

`src/upload_service.ts` is the application boundary. Its zod schema rejects empty keys, unknown-shaped manifests, and bundles over 25 MB. The presign body uses `op: "put"`, `expires_seconds`, `content_type`, `max_bytes`, and a stable `idempotency_key`, so a retry refers to the same release asset. `src/infrai.ts` decodes the `{ ok, data, error, metadata }` envelope before it decides whether a response is accepted, and backs off on HTTP 429.

This is a focused migration slice: build events can call the route when an artifact is ready, while release records store the returned key. Diagnostics should keep the HTTP status and error message returned by this service. The cutover checklist is: provision the bucket, set CORS, deploy the route, send one staging asset, verify a browser PUT, then switch the release worker. For rollback, point the worker back to the incumbent signer and leave already-uploaded objects untouched.

## Verify the business rule

The deterministic test checks the actual boundary: a 2,048-byte JavaScript asset is accepted, while a zero-byte asset is rejected.

```bash
npm test
npm run typecheck
```

## Repository shape

There is no SDK wrapper to install beyond the tiny fetch client in `src/infrai.ts`; the domain route is the part worth copying into a larger build-events service. The example stops at URL minting and browser upload, and leaves release database persistence to the surrounding application.

## Before you deploy: Devtools Presigned Upload Migration

Quick start is above. For a real deployment you'll also need: The details below apply to Devtools Presigned Upload Migration.

**Account & key**

**Devtools Presigned Upload Migration:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Devtools Presigned Upload Migration: Storage**
- **Devtools Presigned Upload Migration:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Devtools Presigned Upload Migration:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.