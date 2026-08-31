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

export type PaymentMethod = "pix" | "dinheiro" | "credito" | "debito";

export type Menu = {
  storeId: string;
  storeName: string;
  categories: ProductCategory[];
  products: Product[];
  customs: ProductCustom[];
  acceptedPayments: PaymentMethod[];
};

export type Message = { from: "customer" | "store"; text: string; at?: string };

export type SavedAddress = { label: string; text: string };
export type Payment = { method: PaymentMethod; changeFor?: number };

/** Dados do cliente que a Brenda pode reaproveitar na conversa. */
export type CustomerContext = {
  addresses?: SavedAddress[];
  lastOrder?: Checkout;
};

export type Conversation = { storeId: string; messages: Message[]; customer?: CustomerContext };

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

export type DeliveryAddress = { label?: string; text: string };

export type Checkout = {
  products: CheckoutProduct[];
  totalPrice?: number;
  address?: DeliveryAddress;
  payment?: Payment;
  orderFinished?: boolean;
};

export type Result =
  | { ok: true; checkout: Checkout }
  | { ok: false; clarification?: string; reason?: string };
