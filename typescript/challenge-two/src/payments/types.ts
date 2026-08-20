/** Status que o PSP pode enviar no webhook. */
export const PAYMENT_STATUSES = ["pending", "confirmed", "failed"] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface PaymentEvent {
  payment_id: string;
  restaurant_id: string;
  amount: number;
  status: PaymentStatus;
}

/**
 * Valida o corpo do webhook. Devolve o evento normalizado ou a lista de erros
 * — o PSP loga o motivo da rejeicao, entao vale ser especifico.
 */
export function parsePaymentEvent(
  body: unknown
): { event: PaymentEvent } | { errors: string[] } {
  const errors: string[] = [];

  if (typeof body !== "object" || body === null) {
    return { errors: ["body deve ser um objeto JSON"] };
  }

  const raw = body as Record<string, unknown>;

  const paymentId = raw.payment_id;
  if (typeof paymentId !== "string" || paymentId.trim() === "") {
    errors.push("payment_id e obrigatorio");
  }

  const restaurantId = raw.restaurant_id;
  if (typeof restaurantId !== "string" || restaurantId.trim() === "") {
    errors.push("restaurant_id e obrigatorio");
  }

  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.push("amount deve ser um numero maior que zero");
  }

  const status = raw.status;
  if (!PAYMENT_STATUSES.includes(status as PaymentStatus)) {
    errors.push(`status deve ser um de: ${PAYMENT_STATUSES.join(", ")}`);
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    event: {
      payment_id: (paymentId as string).trim(),
      restaurant_id: (restaurantId as string).trim(),
      amount,
      status: status as PaymentStatus,
    },
  };
}
