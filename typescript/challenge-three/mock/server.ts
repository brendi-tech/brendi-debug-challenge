// Servidor mock local (zero deps). npm run mock

import { createServer, IncomingMessage, ServerResponse } from "http";

type Handler = (req: IncomingMessage, res: ServerResponse, body: string) => void;

const json = (res: ServerResponse, status: number, data: unknown) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
};

const routes: Record<string, Handler> = {
  "GET /health": (_req, res) => json(res, 200, { ok: true }),

  "POST /owner/notify": (_req, res, body) => {
    let parsed: unknown = body;
    try {
      parsed = JSON.parse(body);
    } catch {}
    console.log("[owner] escalação recebida:", parsed);
    json(res, 200, { received: true });
  },
};

const PORT = Number(process.env.MOCK_PORT || 4000);

export const server = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const handler = routes[`${req.method} ${req.url}`];
    if (handler) return handler(req, res, body);
    json(res, 404, { error: "not found" });
  });
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`[mock] http://localhost:${PORT}`));
}
