export type ProductCustomChoice = {
  id: string;
  title: string;
  extraPrice: number;
  active?: boolean;
};

export type ProductCustom =
  | {
      path: string;
      title: string;
      type: "unique";
      required: boolean;
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
      /** Quantidade já inclusa no preço; o excedente cobra extraPrice. */
      includedQuantity?: number;
      choices: ProductCustomChoice[];
    };

export type Product = {
  slug: string;
  categoryPath: string;
  name: string;
  description?: string;
  price: number;
  customsPaths: string[];
  active?: boolean;
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

export type Message = { from: "customer" | "store"; text: string; at?: string };
export type Conversation = { storeId: string; messages: Message[] };

export type CheckoutChosen = {
  choiceId: string;
  quantity?: number;
  /** Só no `expected` dos testes: false = asserta AUSÊNCIA da escolha. */
  shouldBeIncluded?: boolean;
};

export type CheckoutProduct = {
  productId: string;
  quantity: number;
  chosen?: CheckoutChosen[];
  notes?: string;
  /** Só no `expected` dos testes: false = asserta AUSÊNCIA do produto. */
  shouldBeIncluded?: boolean;
};

export type Checkout = {
  products: CheckoutProduct[];
  totalPrice?: number;
  orderFinished?: boolean;
};

export type Result =
  | { ok: true; checkout: Checkout }
  | { ok: false; clarification?: string; reason?: string };
