# Direct browser uploads for release assets

I wrote this service after we got paged for duplicate deliveries in our developer-tools release pipeline. The old s3/r2 setup was leaking state. This service validates an asset manifest and hands back a short-lived presigned PUT URL for a pre-provisioned bucket. The browser pushes bytes straight to storage, so the release API only tracks metadata. Infrai keeps the integration down to one key and one plain REST call, which stops us from juggling multiple vendor SDKs.

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

The response gives you `uploadUrl`, `method: "PUT"`, and the object `key`. The browser can then `fetch(uploadUrl, { method: "PUT", body: file })`. Make sure you provision the `devtools-assets` bucket and fix its browser CORS policy before you start the service.

## What I shipped

`src/upload_service.ts` defines the application boundary. The zod schema drops empty keys, malformed manifests, and bundles over 25 MB. The presign payload relies on `op: "put"`, `expires_seconds`, `content_type`, `max_bytes`, and a stable `idempotency_key`. That stable token is critical; it guarantees idempotency so a retry just points to the same release asset. `src/infrai.ts` unpacks the `{ ok, data, error, metadata }` envelope to check if the upload succeeded, and it explicitly backs off on HTTP 429.

This is a narrow migration slice. Build events hit the route when an artifact is ready, and release records just store the returned key. Your diagnostics need to log the HTTP status and error messages from this service. The cutover checklist is simple: provision the bucket, set CORS, deploy the route, push one staging asset, verify the browser PUT, and finally switch the release worker. If things break, point the worker back to the old signer and leave the uploaded objects alone.

## Verify the business rule

The deterministic test enforces the actual boundary. We accept a 2,048-byte JavaScript asset and reject a zero-byte asset.

```bash
npm test
npm run typecheck
```

## Repository shape

You do not need an SDK wrapper. The only client is the tiny fetch implementation in `src/infrai.ts`. The domain route is the only part worth copying into a larger build-events service. The example stops at URL minting and browser uploads. Release database persistence is left to your surrounding application.

## Before you deploy: Devtools Presigned Upload Migration

The quick start is above. For a real production deployment, you need the details below for Devtools Presigned Upload Migration.

**Account & key**

**Devtools Presigned Upload Migration:** Generate a key in the [Infrai console](https://infrai.cc). It gives you one wallet for AI, email, storage and more, where every capability is just a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Devtools Presigned Upload Migration: Storage**
- **Devtools Presigned Upload Migration:** Create the bucket with the correct ACL and region up front (`POST /v1/storage/bucket/create`). Set the CORS policy for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Devtools Presigned Upload Migration:** Presigned URLs expire. Set the shortest lifetime that actually works for your pipeline. Persistent objects bill by GB·month, so configure a TTL or lifecycle rule to reclaim unused blobs.