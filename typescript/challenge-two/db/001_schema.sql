-- Esquema do ledger de pagamentos.
--
-- restaurantes -> saldo consolidado (balances) + eventos de pagamento do PSP (payments)

CREATE TABLE restaurants (
    id          TEXT PRIMARY KEY,
    name        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Saldo consolidado do restaurante. E o valor que o restaurante ve no app
-- e a base para o repasse.
CREATE TABLE balances (
    restaurant_id TEXT PRIMARY KEY REFERENCES restaurants (id),
    balance       NUMERIC(12, 2) NOT NULL DEFAULT 0,
    updated_at    TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- Eventos de pagamento entregues pelo PSP via webhook.
-- Um pagamento passa por mais de um status ao longo do seu ciclo de vida
-- (pending -> confirmed, ou pending -> failed), entao guardamos um registro
-- por transicao de status.
CREATE TABLE payments (
    id            BIGSERIAL PRIMARY KEY,
    payment_id    TEXT           NOT NULL,
    restaurant_id TEXT           NOT NULL REFERENCES restaurants (id),
    amount        NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    status        TEXT           NOT NULL,
    received_at   TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX payments_restaurant_id_idx ON payments (restaurant_id);
