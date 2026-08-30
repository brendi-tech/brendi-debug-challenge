// ============================================================================
// Tipos do desafio. Espelham (de forma enxuta) o modelo real do bot da Brenda:
//   - Menu: listas planas (categories/products/customs) ligadas por path/slug,
//     não objetos aninhados. (brendi-commons/types/menu + product)
//   - Complementos: ProductCustom, uniao discriminada por `type`.
//   - Pedido montado: Checkout (o que o placeOrder produz e o que os testes de
//     precisao comparam). Sem preco por item — so `totalPrice`.
//
// Cortamos o que nao importa pra este desafio: pizza, o Order persistido
// (pesado), e os campos de delivery/payment/customer do Checkout.
// ============================================================================

// ---- Menu / cardapio -------------------------------------------------------

export type ProductCustomChoice = {
  id: string;
  title: string;
  /** Preco somado ao escolher esta opcao (reais). */
  extraPrice: number;
  active?: boolean;
};

/**
 * Grupo de complementos de um produto. Uniao discriminada por `type` (igual ao
 * bot): `unique` = escolha unica (radio), `check` = multipla (checkbox),
 * `increase` = quantidade (steppers).
 */
export type ProductCustom =
  | {
      path: string; // chave de ligacao (customsPaths do produto aponta pra ca)
      title: string;
      type: "unique";
      required: boolean; // precisa escolher uma
      choices: ProductCustomChoice[];
    }
  | {
      path: string;
      title: string;
      type: "check";
      minChoices?: number;
      maxChoices: number;
      choices: ProductCustomChoice[];
    }
  | {
      path: string;
      title: string;
      type: "increase";
      minChoices?: number;
      maxChoices: number;
      /**
       * Quantidade JA inclusa no preco do produto; o excedente cobra extraPrice.
       * (Ex.: marmita ja vem com 1 carne; a 2a e extra.) Simplificacao fiel do
       * comportamento de complemento-incluso do bot.
       */
      includedQuantity?: number;
      choices: ProductCustomChoice[];
    };

export type Product = {
  slug: string; // id do produto (usado como productId no Checkout)
  categoryPath: string;
  name: string;
  description?: string;
  price: number; // reais
  customsPaths: string[]; // liga aos ProductCustom por `path`
  active?: boolean;
  /** Extensao do desafio: apelidos pra ajudar o matching por texto. */
  aliases?: string[];
};

export type ProductCategory = {
  slug: string;
  name: string;
  productsPaths: string[];
  type: "normal";
};

export type Menu = {
  storeId: string;
  storeName: string;
  categories: ProductCategory[];
  products: Product[];
  customs: ProductCustom[];
};

// ---- Conversa (input) ------------------------------------------------------

export type Message = { from: "customer" | "store"; text: string };
export type Conversation = { storeId: string; messages: Message[] };

// ---- Checkout (o pedido montado) -------------------------------------------
// Espelha brendi-commons/types/precision/Checkout. Referencia produtos e
// escolhas por id + quantidade, nao embute o objeto do produto. Sem preco por
// item — o total fica em `totalPrice` (preenchido pelo priceCheckout).

export type CheckoutChosen = {
  choiceId: string;
  quantity?: number;
  /** So no `expected` dos testes: false = asserta AUSENCIA da escolha. */
  shouldBeIncluded?: boolean;
};

export type CheckoutProduct = {
  productId: string; // = Product.slug
  quantity: number;
  chosen?: CheckoutChosen[];
  notes?: string;
  /** So no `expected` dos testes: false = asserta AUSENCIA do produto. */
  shouldBeIncluded?: boolean;
};

export type Checkout = {
  products: CheckoutProduct[];
  totalPrice?: number; // preenchido pela camada deterministica
  orderFinished?: boolean;
};

// ---- Resultado ------------------------------------------------------------

/**
 * O que o pipeline devolve: o pedido montado (Checkout com totalPrice), ou uma
 * recusa. Use `clarification` quando a conversa for ambigua demais pra montar;
 * `escalated` quando nao e pra Brenda resolver e o dono foi acionado.
 */
export type Result =
  | { ok: true; checkout: Checkout }
  | { ok: false; clarification?: string; reason?: string; escalated?: boolean };
