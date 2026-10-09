import https from "node:https";
import fs from "node:fs";
import { createSignerService, privateFile } from "../apps/signer/service.js";
import { installSafeErrors } from "./safe-errors.js";
installSafeErrors();
const service = createSignerService();
const server = https.createServer(
  {
    cert: fs.readFileSync(process.env.SIGNER_TLS_CERT_FILE ?? ""),
    key: privateFile(process.env.SIGNER_TLS_KEY_FILE ?? ""),
  },
  async (req, res) => {
    res.setHeader("content-type", "application/json");
    res.setHeader("cache-control", "no-store");
    try {
      service.authenticate(req.headers.authorization);
      if (req.method !== "POST" || req.url !== "/sign")
        throw new Error("SIGNER_ROUTE_FORBIDDEN");
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 32768) throw new Error("SIGNER_BODY_TOO_LARGE");
        chunks.push(Buffer.from(chunk));
      }
      res.end(
        JSON.stringify(
          await service.sign(JSON.parse(Buffer.concat(chunks).toString())),
        ),
      );
    } catch (e) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error:
            (e as Error).message.match(/^([A-Z][A-Z0-9_]+)(?::|$)/)?.[1] ??
            "SIGNER_REJECTED",
        }),
      );
    }
  },
);
server.requestTimeout = 20000;
server.headersTimeout = 10000;
server.listen(Number(process.env.SIGNER_PORT ?? 3443), "127.0.0.1", () =>
  console.log(
    JSON.stringify({
      event: "SIGNER_READY",
      role: service.role,
      address: service.address,
      tls: true,
    }),
  ),
);
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.once(signal, () =>
    server.close(() => {
      service.close();
      process.exit(0);
    }),
  );
