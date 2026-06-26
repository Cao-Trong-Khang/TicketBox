CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL,
  provider VARCHAR(32) NOT NULL,
  transaction_id VARCHAR(255) NOT NULL,
  amount NUMERIC(18, 2) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT payments_order_provider_unique UNIQUE (order_id, provider),
  CONSTRAINT payments_status_check CHECK (status IN ('pending', 'completed', 'failed')),
  CONSTRAINT payments_provider_check CHECK (provider IN ('vnpay', 'momo'))
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON payments (provider);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status);
