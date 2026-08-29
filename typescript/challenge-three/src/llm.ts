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
    const t0 = Date.now();
    const res = await this.client.chat.completions.create({
      model: this.model,
      temperature: opts.temperature ?? 0,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      ...(opts.jsonSchemaHint ? { response_format: { type: "json_object" } } : {}),
    });
    const u = res.usage ?? {};
    // stderr pra não sujar o stdout (onde sai o JSON do pedido)
    console.error(
      `[llm] model=${this.model} prompt=${u.prompt_tokens ?? "?"} completion=${u.completion_tokens ?? "?"} total=${u.total_tokens ?? "?"} ms=${Date.now() - t0}`
    );
    return res.choices[0]?.message?.content ?? "";
  }
}

// Mock ingênuo: casa por palavra-chave e devolve um Checkout cru (sem preço).
// NÃO é o alvo — é só andaime offline pra o harness rodar sem chave.
class MockLLM implements LLM {
  async chat(opts: ChatOptions): Promise<string> {
    const t = opts.user.toLowerCase();
    const products: any[] = [];
    if (t.includes("x-tudo") || t.includes("x tudo")) products.push({ productId: "x-tudo", quantity: 1 });
    if (t.includes("x-salada") || t.includes("x salada")) products.push({ productId: "x-salada", quantity: 1 });
    if (products.length === 0) products.push({ productId: "x-salada", quantity: 1 });
    return JSON.stringify({ products });
  }
}

export function createLLM(opts?: { mock?: boolean }): LLM {
  return opts?.mock ? new MockLLM() : new OpenAILLM();
}

/**
 * LLM de teste: ignora o prompt e sempre devolve `output` (JSON). Útil pra
 * testar o comportamento determinístico do seu pipeline sem depender da LLM real.
 * O `output` é o que o seu código vai receber de `llm.chat(...)` e parsear.
 */
export function makeFakeLLM(output: unknown): LLM {
  const s = typeof output === "string" ? output : JSON.stringify(output);
  return { chat: async () => s };
}
