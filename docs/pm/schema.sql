BEGIN;

-- For gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Common updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================
-- 1) units
-- =========================
CREATE TABLE IF NOT EXISTS public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,                -- e.g. cai, hop, kg
  name TEXT NOT NULL,
  symbol TEXT,                              -- e.g. cái, hộp, kg
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_units_updated_at
BEFORE UPDATE ON public.units
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- 2) products
-- =========================
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  barcode TEXT,
  default_sell_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (default_sell_price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_products_barcode_not_null
  ON public.products(barcode)
  WHERE barcode IS NOT NULL AND btrim(barcode) <> '';

CREATE INDEX IF NOT EXISTS ix_products_name ON public.products(name);
CREATE INDEX IF NOT EXISTS ix_products_unit_id ON public.products(unit_id);

CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- 3) customers
-- =========================
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,                         -- optional customer code
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  note TEXT,
  opening_debt NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (opening_debt >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_phone_not_null
  ON public.customers(phone)
  WHERE phone IS NOT NULL AND btrim(phone) <> '';

CREATE INDEX IF NOT EXISTS ix_customers_name ON public.customers(name);

CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- 4) sales
-- =========================
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_no TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL,
  sold_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subtotal NUMERIC(14,2) NOT NULL CHECK (subtotal >= 0),
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount >= 0),
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  debt_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (debt_amount >= 0),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('draft', 'completed', 'cancelled', 'refunded')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_sales_total_formula CHECK (total_amount = subtotal - discount_amount),
  CONSTRAINT ck_sales_paid_plus_debt CHECK (paid_amount + debt_amount = total_amount)
);

CREATE INDEX IF NOT EXISTS ix_sales_customer_id_sold_at ON public.sales(customer_id, sold_at DESC);
CREATE INDEX IF NOT EXISTS ix_sales_sold_at ON public.sales(sold_at DESC);

CREATE TRIGGER trg_sales_updated_at
BEFORE UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- 5) product_batches (lô)
-- =========================
CREATE TABLE IF NOT EXISTS public.product_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  batch_no TEXT,                            -- optional lot code
  import_price NUMERIC(14,2) NOT NULL CHECK (import_price >= 0),
  sell_price NUMERIC(14,2) NOT NULL CHECK (sell_price >= 0),
  qty_in NUMERIC(14,3) NOT NULL CHECK (qty_in > 0),
  qty_remaining NUMERIC(14,3) NOT NULL CHECK (qty_remaining >= 0),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_batches_remaining_le_in CHECK (qty_remaining <= qty_in)
);

CREATE INDEX IF NOT EXISTS ix_product_batches_product_imported_at
  ON public.product_batches(product_id, imported_at DESC);

CREATE INDEX IF NOT EXISTS ix_product_batches_available_fifo
  ON public.product_batches(product_id, imported_at ASC)
  WHERE qty_remaining > 0;

CREATE INDEX IF NOT EXISTS ix_product_batches_imported_at
  ON public.product_batches(imported_at DESC);

CREATE TRIGGER trg_product_batches_updated_at
BEFORE UPDATE ON public.product_batches
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- 6) sale_items
-- =========================
CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON UPDATE CASCADE ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  batch_id UUID REFERENCES public.product_batches(id) ON UPDATE CASCADE ON DELETE SET NULL,
  qty NUMERIC(14,3) NOT NULL CHECK (qty > 0),
  unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
  import_price_snapshot NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (import_price_snapshot >= 0),
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  line_total NUMERIC(14,2) GENERATED ALWAYS AS ((qty * unit_price) - discount_amount) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_sale_items_line_total_non_negative CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS ix_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS ix_sale_items_product_id ON public.sale_items(product_id);
CREATE INDEX IF NOT EXISTS ix_sale_items_batch_id ON public.sale_items(batch_id);

-- =========================
-- 7) debt_payments
-- =========================
CREATE TABLE IF NOT EXISTS public.debt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash', 'bank_transfer', 'card', 'ewallet', 'other')),
  reference TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_debt_payments_customer_paid_at
  ON public.debt_payments(customer_id, paid_at DESC);

CREATE INDEX IF NOT EXISTS ix_debt_payments_paid_at
  ON public.debt_payments(paid_at DESC);

CREATE TRIGGER trg_debt_payments_updated_at
BEFORE UPDATE ON public.debt_payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- 8) debt_ledger
-- =========================
CREATE TABLE IF NOT EXISTS public.debt_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('sale_debt', 'payment', 'adjustment')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount <> 0), -- + tăng nợ, - giảm nợ
  balance_after NUMERIC(14,2),
  sale_id UUID REFERENCES public.sales(id) ON UPDATE CASCADE ON DELETE SET NULL,
  payment_id UUID REFERENCES public.debt_payments(id) ON UPDATE CASCADE ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_debt_ledger_customer_occurred_at
  ON public.debt_ledger(customer_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS ix_debt_ledger_sale_id
  ON public.debt_ledger(sale_id)
  WHERE sale_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_debt_ledger_payment_id
  ON public.debt_ledger(payment_id)
  WHERE payment_id IS NOT NULL;

-- =========================
-- 9) cash_transactions
-- =========================
CREATE TABLE IF NOT EXISTS public.cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_type TEXT NOT NULL CHECK (txn_type IN ('in', 'out')),
  category TEXT NOT NULL,                   -- e.g. sale, debt_payment, expense, import, adjustment
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash', 'bank_transfer', 'card', 'ewallet', 'other')),
  customer_id UUID REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL,
  sale_id UUID REFERENCES public.sales(id) ON UPDATE CASCADE ON DELETE SET NULL,
  debt_payment_id UUID REFERENCES public.debt_payments(id) ON UPDATE CASCADE ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_cash_transactions_occurred_at
  ON public.cash_transactions(occurred_at DESC);

CREATE INDEX IF NOT EXISTS ix_cash_transactions_type_occurred_at
  ON public.cash_transactions(txn_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS ix_cash_transactions_sale_id
  ON public.cash_transactions(sale_id)
  WHERE sale_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_cash_transactions_debt_payment_id
  ON public.cash_transactions(debt_payment_id)
  WHERE debt_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_cash_transactions_customer_id
  ON public.cash_transactions(customer_id)
  WHERE customer_id IS NOT NULL;

CREATE TRIGGER trg_cash_transactions_updated_at
BEFORE UPDATE ON public.cash_transactions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
