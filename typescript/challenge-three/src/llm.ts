// ============================================================================
// Wrapper de LLM — FORNECIDO. Não precisa mexer aqui (mas pode, se quiser).
//
// Duas formas de uso:
//   createLLM()  -> real (usa OPENAI_API_KEY + BRENDA_MODEL). Precisa de chave.
//   createLLM({ mock: true }) -> mock offline, útil pra rodar sem chave.
//
// O mock NÃO interpreta bem — ele existe só pra você desenvolver o pipeline
// sem gastar token. O sinal de qualidade real vem do `npm run eval` com a LLM
// de verdade.
// ============================================================================

export type ChatOptions = {
  system: string;
  user: string;
  /** Se passado, pedimos JSON e devolvemos já parseado. */
  jsonSchemaHint?: string;
  temperature?: number;
};

export interface LLM {
  chat(opts: ChatOptions): Promise<string>;
}

class OpenAILLM implements LLM {
  private client: any;
  private model: string;
  constructor() {
    // require dinâmico pra não quebrar quando rodando só os testes offline
    const OpenAI = require("openai").default ?? require("openai");
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY ausente. Peça a chave ao entrevistador, copie .env.example para .env, ou use createLLM({ mock: true })."
      );
    }
    this.client = new OpenAI({ apiKey });
    this.model = process.env.BRENDA_MODEL || "gpt-4o-mini";
  }
  async chat(opts: ChatOptions): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      temperature: opts.temperature ?? 0,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      ...(opts.jsonSchemaHint ? { response_format: { type: "json_object" } } : {}),
    });
    return res.choices[0]?.message?.content ?? "";
  }
}

// Mock ingênuo: casa por palavra-chave. NÃO é o alvo — é só andaime offline.
class MockLLM implements LLM {
  async chat(opts: ChatOptions): Promise<string> {
    const t = opts.user.toLowerCase();
    const items: any[] = [];
    if (t.includes("x-tudo") || t.includes("x tudo")) items.push({ ref: "x-tudo", quantity: 1 });
    if (t.includes("x-salada") || t.includes("x salada")) items.push({ ref: "x-salada", quantity: 1 });
    if (items.length === 0) items.push({ ref: "x-salada", quantity: 1 });
    return JSON.stringify({ items });
  }
}

export function createLLM(opts?: { mock?: boolean }): LLM {
  return opts?.mock ? new MockLLM() : new OpenAILLM();
}
