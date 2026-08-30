// Servidor mock local — a casca mínima pra você ter onde criar endpoints.
// Já vem com um /health só pra existir uma rota. Estenda à vontade: adicione
// as rotas que o seu desafio pedir (ex.: receber a notificação do dono).
// Zero deps (http nativo). Sobe com: npm run mock
//
//   GET /health  -> 200 { ok: true }
//
// Pra adicionar uma rota, registre em `routes` no formato "MÉTODO /caminho".

import { createServer, IncomingMessage, ServerResponse } from "http";

type Handler = (req: IncomingMessage, res: ServerResponse, body: string) => void;

const json = (res: ServerResponse, status: number, data: unknown) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
};

const routes: Record<string, Handler> = {
  "GET /health": (_req, res) => json(res, 200, { ok: true }),

  // Exemplo de como estender (descomente/adapte):
  // "POST /owner/notify": (_req, res, body) => {
  //   console.log("[mock] recebido:", body);
  //   json(res, 200, { received: true });
  // },
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
  server.listen(PORT, () =>
    console.log(`[mock] http://localhost:${PORT} — rotas: ${Object.keys(routes).join(", ")}`)
  );
}
