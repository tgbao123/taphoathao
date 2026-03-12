BEGIN;

-- =====================================
-- TapHoaThao Sales + Debt API migration
-- Implements:
-- - Manual lot allocation
-- - Retail FIFO allocation
-- - Debt ledger/payment helpers
-- =====================================

-- 1) sales: idempotency + store/currency metadata
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'default_store',
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'VND';

CREATE UNIQUE INDEX IF NOT EXISTS ux_sales_idempotency_key_not_null
  ON public.sales(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 2) sale_items: preserve client line id + allocation mode
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS client_line_id TEXT,
  ADD COLUMN IF NOT EXISTS allocation_mode TEXT;

-- 3) sale_allocations: explicit lot allocation detail
CREATE TABLE IF NOT EXISTS public.sale_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_item_id UUID NOT NULL REFERENCES public.sale_items(id) ON UPDATE CASCADE ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.product_batches(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  qty NUMERIC(14,3) NOT NULL CHECK (qty > 0),
  cost_unit NUMERIC(14,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_sale_allocations_sale_item_id
  ON public.sale_allocations(sale_item_id);

CREATE INDEX IF NOT EXISTS ix_sale_allocations_batch_id
  ON public.sale_allocations(batch_id);

-- 4) Helpful view for debt balance by customer
CREATE OR REPLACE VIEW public.v_customer_debt_balance AS
SELECT
  c.id AS customer_id,
  c.name,
  c.opening_debt,
  COALESCE(SUM(dl.amount), 0) AS ledger_delta,
  (c.opening_debt + COALESCE(SUM(dl.amount), 0))::NUMERIC(14,2) AS current_debt
FROM public.customers c
LEFT JOIN public.debt_ledger dl ON dl.customer_id = c.id
GROUP BY c.id, c.name, c.opening_debt;

-- 5) Function: create sale with manual lot / fifo + debt ledger
CREATE OR REPLACE FUNCTION public.api_create_sale(
  p_payload JSONB,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_sale_id UUID;
  v_sale_no TEXT;
  v_customer_id UUID;
  v_store_id TEXT;
  v_currency TEXT;
  v_note TEXT;
  v_subtotal NUMERIC(14,2) := 0;
  v_discount NUMERIC(14,2) := 0;
  v_total NUMERIC(14,2) := 0;
  v_paid NUMERIC(14,2) := 0;
  v_debt NUMERIC(14,2) := 0;
  v_sold_at TIMESTAMPTZ := NOW();
  v_item JSONB;
  v_items JSONB;
  v_manual_lot JSONB;
  v_mode TEXT;
  v_product_id UUID;
  v_qty NUMERIC(14,3);
  v_unit_price NUMERIC(14,2);
  v_client_line_id TEXT;
  v_line_total NUMERIC(14,2);
  v_sale_item_id UUID;
  v_remaining_need NUMERIC(14,3);
  v_take NUMERIC(14,3);
  v_batch RECORD;
  v_manual_batch_id UUID;
  v_manual_qty NUMERIC(14,3);
  v_allocations JSONB := '[]'::JSONB;
  v_item_allocations JSONB;
  v_existing_sale_id UUID;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT s.id INTO v_existing_sale_id
    FROM public.sales s
    WHERE s.idempotency_key = p_idempotency_key
    LIMIT 1;

    IF v_existing_sale_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'saleId', v_existing_sale_id,
        'status', 'COMPLETED',
        'idempotent', true
      );
    END IF;
  END IF;

  v_store_id := COALESCE(NULLIF(p_payload->>'storeId', ''), 'default_store');
  v_currency := COALESCE(NULLIF(p_payload->>'currency', ''), 'VND');
  v_note := p_payload->>'note';
  v_customer_id := NULLIF(p_payload->>'customerId', '')::UUID;

  IF (p_payload ? 'soldAt') THEN
    v_sold_at := COALESCE((p_payload->>'soldAt')::timestamptz, NOW());
  END IF;

  v_items := p_payload->'items';
  IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'items must be non-empty array';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    v_product_id := NULLIF(v_item->>'skuId', '')::UUID;
    v_qty := COALESCE((v_item->>'qty')::NUMERIC, 0);
    v_unit_price := COALESCE((v_item->>'unitPrice')::NUMERIC, 0);
    v_mode := UPPER(COALESCE(NULLIF(v_item->>'allocationMode', ''), 'AUTO_FIFO'));
    v_client_line_id := COALESCE(v_item->>'clientLineId', '');

    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'skuId is required';
    END IF;

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'qty must be > 0 for sku %', v_product_id;
    END IF;

    IF v_unit_price < 0 THEN
      RAISE EXCEPTION 'unitPrice must be >= 0 for sku %', v_product_id;
    END IF;

    IF v_mode NOT IN ('MANUAL_LOT', 'AUTO_FIFO') THEN
      RAISE EXCEPTION 'invalid allocationMode %', v_mode;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = v_product_id AND p.is_active = TRUE) THEN
      RAISE EXCEPTION 'sku % not found/active', v_product_id;
    END IF;

    v_line_total := ROUND((v_qty * v_unit_price)::NUMERIC, 2);
    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  v_discount := COALESCE((p_payload->>'discountAmount')::NUMERIC, 0);
  IF v_discount < 0 THEN
    RAISE EXCEPTION 'discountAmount must be >= 0';
  END IF;

  v_total := ROUND((v_subtotal - v_discount)::NUMERIC, 2);
  IF v_total < 0 THEN
    RAISE EXCEPTION 'total cannot be negative';
  END IF;

  v_paid := COALESCE((p_payload->>'paidAmount')::NUMERIC, v_total);
  IF v_paid < 0 THEN
    RAISE EXCEPTION 'paidAmount must be >= 0';
  END IF;

  IF v_paid > v_total THEN
    RAISE EXCEPTION 'paidAmount cannot exceed totalAmount';
  END IF;

  v_debt := ROUND((v_total - v_paid)::NUMERIC, 2);

  IF v_debt > 0 AND v_customer_id IS NULL THEN
    RAISE EXCEPTION 'customerId is required when debtAmount > 0';
  END IF;

  IF v_customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = v_customer_id AND c.is_active = TRUE) THEN
    RAISE EXCEPTION 'customerId not found/active';
  END IF;

  v_sale_no := 'SALE-' || to_char(NOW(), 'YYYYMMDD-HH24MISS-MS');

  INSERT INTO public.sales (
    sale_no,
    customer_id,
    sold_at,
    subtotal,
    discount_amount,
    total_amount,
    paid_amount,
    debt_amount,
    status,
    note,
    idempotency_key,
    store_id,
    currency
  ) VALUES (
    v_sale_no,
    v_customer_id,
    v_sold_at,
    v_subtotal,
    v_discount,
    v_total,
    v_paid,
    v_debt,
    'completed',
    v_note,
    p_idempotency_key,
    v_store_id,
    v_currency
  )
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    v_product_id := NULLIF(v_item->>'skuId', '')::UUID;
    v_qty := (v_item->>'qty')::NUMERIC;
    v_unit_price := (v_item->>'unitPrice')::NUMERIC;
    v_mode := UPPER(COALESCE(NULLIF(v_item->>'allocationMode', ''), 'AUTO_FIFO'));
    v_client_line_id := COALESCE(v_item->>'clientLineId', '');

    INSERT INTO public.sale_items (
      sale_id,
      product_id,
      batch_id,
      qty,
      unit_price,
      import_price_snapshot,
      discount_amount,
      client_line_id,
      allocation_mode
    ) VALUES (
      v_sale_id,
      v_product_id,
      NULL,
      v_qty,
      v_unit_price,
      0,
      0,
      NULLIF(v_client_line_id, ''),
      v_mode
    )
    RETURNING id INTO v_sale_item_id;

    v_item_allocations := '[]'::JSONB;

    IF v_mode = 'MANUAL_LOT' THEN
      IF NOT (v_item ? 'manualLots') OR jsonb_typeof(v_item->'manualLots') <> 'array' OR jsonb_array_length(v_item->'manualLots') = 0 THEN
        RAISE EXCEPTION 'manualLots is required for MANUAL_LOT';
      END IF;

      IF (
        SELECT COALESCE(SUM((x->>'qty')::NUMERIC), 0)
        FROM jsonb_array_elements(v_item->'manualLots') x
      ) <> v_qty THEN
        RAISE EXCEPTION 'manualLots qty sum must equal item qty';
      END IF;

      FOR v_manual_lot IN SELECT * FROM jsonb_array_elements(v_item->'manualLots')
      LOOP
        v_manual_batch_id := NULLIF(v_manual_lot->>'lotId', '')::UUID;
        v_manual_qty := COALESCE((v_manual_lot->>'qty')::NUMERIC, 0);

        IF v_manual_batch_id IS NULL OR v_manual_qty <= 0 THEN
          RAISE EXCEPTION 'invalid manual lot allocation';
        END IF;

        SELECT b.* INTO v_batch
        FROM public.product_batches b
        WHERE b.id = v_manual_batch_id
          AND b.product_id = v_product_id
        FOR UPDATE;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'lot % not found/mismatch with sku %', v_manual_batch_id, v_product_id;
        END IF;

        IF v_batch.qty_remaining < v_manual_qty THEN
          RAISE EXCEPTION 'INSUFFICIENT_STOCK_LOT lot=% requested=% available=%', v_manual_batch_id, v_manual_qty, v_batch.qty_remaining;
        END IF;

        UPDATE public.product_batches
        SET qty_remaining = qty_remaining - v_manual_qty
        WHERE id = v_manual_batch_id;

        INSERT INTO public.sale_allocations (sale_item_id, batch_id, qty, cost_unit)
        VALUES (v_sale_item_id, v_manual_batch_id, v_manual_qty, v_batch.import_price);

        v_item_allocations := v_item_allocations || jsonb_build_object(
          'lotId', v_manual_batch_id,
          'qty', v_manual_qty
        );
      END LOOP;
    ELSE
      v_remaining_need := v_qty;

      FOR v_batch IN
        SELECT b.*
        FROM public.product_batches b
        WHERE b.product_id = v_product_id
          AND b.qty_remaining > 0
        ORDER BY b.imported_at ASC, b.id ASC
        FOR UPDATE
      LOOP
        EXIT WHEN v_remaining_need <= 0;

        v_take := LEAST(v_batch.qty_remaining, v_remaining_need);
        IF v_take > 0 THEN
          UPDATE public.product_batches
          SET qty_remaining = qty_remaining - v_take
          WHERE id = v_batch.id;

          INSERT INTO public.sale_allocations (sale_item_id, batch_id, qty, cost_unit)
          VALUES (v_sale_item_id, v_batch.id, v_take, v_batch.import_price);

          v_item_allocations := v_item_allocations || jsonb_build_object(
            'lotId', v_batch.id,
            'qty', v_take
          );

          v_remaining_need := v_remaining_need - v_take;
        END IF;
      END LOOP;

      IF v_remaining_need > 0 THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK_SKU sku=% missing=%', v_product_id, v_remaining_need;
      END IF;
    END IF;

    v_allocations := v_allocations || jsonb_build_object(
      'saleItemId', v_sale_item_id,
      'clientLineId', NULLIF(v_client_line_id, ''),
      'skuId', v_product_id,
      'qty', v_qty,
      'unitPrice', v_unit_price,
      'lineAmount', ROUND((v_qty * v_unit_price)::NUMERIC, 2),
      'allocationMode', v_mode,
      'allocations', v_item_allocations
    );
  END LOOP;

  IF v_debt > 0 THEN
    INSERT INTO public.debt_ledger (
      customer_id,
      entry_type,
      amount,
      sale_id,
      occurred_at,
      note
    ) VALUES (
      v_customer_id,
      'sale_debt',
      v_debt,
      v_sale_id,
      v_sold_at,
      COALESCE(v_note, 'Debt from sale ' || v_sale_no)
    );
  END IF;

  IF v_paid > 0 THEN
    INSERT INTO public.cash_transactions (
      txn_type,
      category,
      amount,
      occurred_at,
      method,
      customer_id,
      sale_id,
      note
    ) VALUES (
      'in',
      'sale',
      v_paid,
      v_sold_at,
      'cash',
      v_customer_id,
      v_sale_id,
      COALESCE(v_note, 'Cash in from sale ' || v_sale_no)
    );
  END IF;

  RETURN jsonb_build_object(
    'saleId', v_sale_id,
    'saleNo', v_sale_no,
    'status', 'COMPLETED',
    'storeId', v_store_id,
    'currency', v_currency,
    'subTotal', v_subtotal,
    'discountTotal', v_discount,
    'taxTotal', 0,
    'grandTotal', v_total,
    'paidAmount', v_paid,
    'debtAmount', v_debt,
    'createdAt', v_sold_at,
    'items', v_allocations
  );
END;
$$;

-- 6) Function: create debt payment + ledger + cash txn
CREATE OR REPLACE FUNCTION public.api_create_debt_payment(
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_customer_id UUID;
  v_amount NUMERIC(14,2);
  v_method TEXT;
  v_note TEXT;
  v_reference TEXT;
  v_paid_at TIMESTAMPTZ := NOW();
  v_payment_id UUID;
  v_balance NUMERIC(14,2);
BEGIN
  v_customer_id := NULLIF(p_payload->>'customerId', '')::UUID;
  v_amount := COALESCE((p_payload->>'amount')::NUMERIC, 0);
  v_method := COALESCE(NULLIF(p_payload->>'method', ''), 'cash');
  v_note := p_payload->>'note';
  v_reference := p_payload->>'reference';

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'customerId is required';
  END IF;

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be > 0';
  END IF;

  IF v_method NOT IN ('cash', 'bank_transfer', 'card', 'ewallet', 'other') THEN
    RAISE EXCEPTION 'invalid method';
  END IF;

  IF (p_payload ? 'paidAt') THEN
    v_paid_at := COALESCE((p_payload->>'paidAt')::timestamptz, NOW());
  END IF;

  PERFORM 1
  FROM public.customers c
  WHERE c.id = v_customer_id
    AND c.is_active = TRUE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customerId not found/active';
  END IF;

  INSERT INTO public.debt_payments (
    customer_id,
    amount,
    paid_at,
    method,
    reference,
    note
  ) VALUES (
    v_customer_id,
    v_amount,
    v_paid_at,
    v_method,
    v_reference,
    v_note
  )
  RETURNING id INTO v_payment_id;

  INSERT INTO public.debt_ledger (
    customer_id,
    entry_type,
    amount,
    payment_id,
    occurred_at,
    note
  ) VALUES (
    v_customer_id,
    'payment',
    -v_amount,
    v_payment_id,
    v_paid_at,
    COALESCE(v_note, 'Debt payment')
  );

  INSERT INTO public.cash_transactions (
    txn_type,
    category,
    amount,
    occurred_at,
    method,
    customer_id,
    debt_payment_id,
    note
  ) VALUES (
    'in',
    'debt_payment',
    v_amount,
    v_paid_at,
    v_method,
    v_customer_id,
    v_payment_id,
    COALESCE(v_note, 'Debt payment')
  );

  SELECT (c.opening_debt + COALESCE(SUM(dl.amount), 0))::NUMERIC(14,2)
  INTO v_balance
  FROM public.customers c
  LEFT JOIN public.debt_ledger dl ON dl.customer_id = c.id
  WHERE c.id = v_customer_id
  GROUP BY c.id, c.opening_debt;

  RETURN jsonb_build_object(
    'paymentId', v_payment_id,
    'customerId', v_customer_id,
    'amount', v_amount,
    'method', v_method,
    'paidAt', v_paid_at,
    'balanceAfter', COALESCE(v_balance, 0)
  );
END;
$$;

-- 7) Function: customer ledger query
CREATE OR REPLACE FUNCTION public.api_get_customer_ledger(
  p_customer_id UUID,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'customerId is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer_id) THEN
    RAISE EXCEPTION 'customer not found';
  END IF;

  WITH ledger_rows AS (
    SELECT
      dl.id,
      dl.customer_id,
      dl.entry_type,
      dl.amount,
      dl.balance_after,
      dl.sale_id,
      dl.payment_id,
      dl.occurred_at,
      dl.note
    FROM public.debt_ledger dl
    WHERE dl.customer_id = p_customer_id
    ORDER BY dl.occurred_at DESC, dl.id DESC
    LIMIT GREATEST(1, LEAST(p_limit, 200))
    OFFSET GREATEST(0, p_offset)
  ),
  totals AS (
    SELECT
      c.id AS customer_id,
      c.opening_debt,
      COALESCE(SUM(dl.amount), 0) AS delta,
      (c.opening_debt + COALESCE(SUM(dl.amount), 0))::NUMERIC(14,2) AS current_debt
    FROM public.customers c
    LEFT JOIN public.debt_ledger dl ON dl.customer_id = c.id
    WHERE c.id = p_customer_id
    GROUP BY c.id, c.opening_debt
  )
  SELECT jsonb_build_object(
    'customerId', p_customer_id,
    'openingDebt', t.opening_debt,
    'currentDebt', t.current_debt,
    'entries', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', lr.id,
          'entryType', lr.entry_type,
          'amount', lr.amount,
          'balanceAfter', lr.balance_after,
          'saleId', lr.sale_id,
          'paymentId', lr.payment_id,
          'occurredAt', lr.occurred_at,
          'note', lr.note
        )
      ) FILTER (WHERE lr.id IS NOT NULL),
      '[]'::JSONB
    )
  )
  INTO v_result
  FROM totals t
  LEFT JOIN ledger_rows lr ON TRUE
  GROUP BY t.customer_id, t.opening_debt, t.current_debt;

  RETURN v_result;
END;
$$;

COMMIT;
