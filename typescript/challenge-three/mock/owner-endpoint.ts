// Endpoint mock do "dono do restaurante". Recebe a escalação da Brenda e só
// confirma o recebimento — no mundo real seria um push/WhatsApp pro dono.
// Zero deps (http nativo). Sobe com: npm run mock-owner
//
//   POST /owner/notify  -> 200 { received: true }
//   qualquer outra rota -> 404

import { createServer } from "http";

const PORT = Number(process.env.OWNER_PORT || 4000);

const server = createServer((req, res) => {
  if (req.method === "POST" && req.url === "/owner/notify") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let parsed: unknown = body;
      try {
        parsed = JSON.parse(body);
      } catch {}
      console.log(`[owner] escalação recebida:`, parsed);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ received: true }));
    });
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, () => console.log(`[owner] mock ouvindo em http://localhost:${PORT}/owner/notify`));
