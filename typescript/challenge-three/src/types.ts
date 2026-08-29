// ============================================================================
// Contratos do desafio. Você PODE ajustar/estender estes tipos se justificar
// no README — mas os testes deterministicos dependem do formato de `Order`.
// ============================================================================

export type Money = number; // sempre em centavos, inteiro

export type MenuOption = { id: string; name: string; priceCents: Money };

export type MenuItem = {
  id: string;
  name: string;
  aliases?: string[];
  priceCents: Money;
  available: boolean;
  /** Adicionais opcionais e pagos (ex.: bacon, ovo). */
  addons?: MenuOption[];
  /** Escolha obrigatoria com variacao de preco (ex.: tamanho da batata). */
  options?: { group: string; choices: MenuOption[] };
  /**
   * Escolha JA INCLUSA no item, com N inclusas + extras pagos.
   * Ex.: marmita vem com 1 carne; a 2a carne e um extra pago.
   */
  includedChoice?: {
    group: string;
    includedQty: number;
    extraPriceCents: Money;
    choices: { id: string; name: string }[];
  };
  isCombo?: boolean;
  comboItems?: string[];
};

export type Menu = { storeId: string; storeName: string; items: MenuItem[] };

// ---- Conversa (input) ------------------------------------------------------

export type Message = { from: "customer" | "store"; text: string };
export type Conversation = { storeId: string; messages: Message[] };

// ---- Saida do LLM: um RASCUNHO, ainda NAO confiavel ------------------------
// Este e o formato que a interpretacao (LLM) deve produzir. Ele NAO tem preco
// e NAO foi validado contra o menu — isso e trabalho do nucleo deterministico.

export type OrderDraftItem = {
  /** Nome/alias do produto como o cliente pediu. */
  ref: string;
  quantity: number;
  /** Nomes de adicionais pedidos. */
  addons?: string[];
  /** Escolha de opcao/variacao paga (ex.: "M", "Coca"). */
  choice?: string;
  /**
   * Escolhas do grupo JA INCLUSO (ex.: as carnes da marmita). O cliente pode
   * pedir mais do que o incluso — o excedente vira extra pago na montagem.
   * Ex.: ["bife", "frango"] numa marmita = 1 incluso + 1 extra.
   */
  includedPicks?: string[];
  /** Remocoes ("sem cebola"). Nao afetam preco. */
  removals?: string[];
};

export type OrderDraft = {
  items: OrderDraftItem[];
  /** Se o pedido esta ambiguo demais pra montar com seguranca. */
  clarificationNeeded?: string;
};

// ---- Pedido validado e precificado (output) --------------------------------

export type OrderItem = {
  productId: string;
  name: string;
  quantity: number;
  addons: MenuOption[];
  removals: string[];
  /** Preco unitario ja com adicionais/opcoes. Vem SEMPRE do menu. */
  unitPriceCents: Money;
  lineTotalCents: Money;
};

export type Order = {
  storeId: string;
  items: OrderItem[];
  totalCents: Money;
};

export type AssembleResult =
  | { ok: true; order: Order }
  | { ok: false; reason: string; clarification?: string };
