import { createServer } from "node:http";
import { z } from "zod";
import { infrai, InfraiError } from "./infrai";

export const uploadRequest = z.object({ assetKey: z.string().min(1).regex(/^[a-zA-Z0-9/_ .-]+$/), contentType: z.string().min(1), sizeBytes: z.number().int().positive().max(25_000_000) });
export const BUCKET = "devtools-assets";

export async function createUploadUrl(input: unknown) {
  const request = uploadRequest.parse(input);
  const signed = await infrai.storage.object.presign(BUCKET, request.assetKey, { op: "put", expires_seconds: 600, content_type: request.contentType, max_bytes: request.sizeBytes, idempotency_key: `asset:${request.assetKey}` });
  return { key: request.assetKey, uploadUrl: signed.url, method: "PUT" as const };
}

export function startServer(port = Number(process.env.PORT ?? 3000)) {
  const server = createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/upload-url") { res.writeHead(404).end(); return; }
    try {
      const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const result = await createUploadUrl(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(result));
    } catch (error) {
      const status = error instanceof z.ZodError ? 400 : error instanceof InfraiError && error.status < 500 ? error.status : 500;
      res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify({ error: error instanceof Error ? error.message : "request failed" }));
    }
  });
  server.listen(port); return server;
}

if (import.meta.url === `file://${process.argv[1]}`) startServer();
