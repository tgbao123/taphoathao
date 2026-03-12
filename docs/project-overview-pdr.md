# TapHoaThao — Project Overview & PDR

> **Product Development Requirements** for a single-admin grocery/sport-shop management system.

## Vision

TapHoaThao is a lightweight web-based POS and inventory management tool built for a single grocery store administrator. It handles daily operations: product catalog, lot-based inventory, sales with flexible stock allocation, customer debt tracking, and cashflow recording.

## Target Users

| Role | Description |
|------|-------------|
| Admin (single user) | Store owner who manages products, sales, debt, and cashflow |

## Functional Requirements

### FR-1: Authentication
- Single admin login via Supabase Auth (email/password)
- Client-side session guard (`useRequireSession`) redirecting unauthenticated users to `/login`
- Server-side operations use Supabase Service Role Key (`supabaseAdmin`)

### FR-2: Product & Unit Management
- CRUD operations on products (SKU, name, unit, barcode, default sell price, active status)
- Unit management (code, name, symbol)
- Inline editing in products table
- Product detail page with batch listing

### FR-3: Inventory (Lot/Batch System)
- Import batches with: product, batch number, import price, sell price, quantity, import date, expiry date
- Bulk import (multiple batches in one request)
- Track `qty_in` vs `qty_remaining` per batch
- FIFO index for automatic allocation (`ix_product_batches_available_fifo`)

### FR-4: Sales
- Cart-based sales UI supporting two allocation modes:
  - **AUTO_FIFO** — server allocates stock from oldest batches first
  - **MANUAL_LOT** — user specifies batch IDs per line item
- Sale creation via PostgreSQL RPC (`api_create_sale`) for atomicity
- Sale fields: subtotal, discount, total, paid, debt amounts with formula constraints
- Idempotency key support to prevent duplicate sales

### FR-5: Customer Debt Management
- Customer list with search (name/phone) and current debt display
- Debt ledger per customer (sale_debt, payment, adjustment entries)
- Debt payment recording with multiple methods (cash, bank_transfer, card, ewallet, other)
- Current debt calculated via `v_customer_debt_balance` view
- Opening debt support per customer

### FR-6: Cashflow (Thu/Chi)
- Record inflow/outflow transactions with category, amount, method, note
- List cashflow entries with filtering by type, category, and date range
- Pagination support

### FR-7: Reports
- Summary KPIs: revenue, current debt, product count, net cashflow
- Date range filtering for sales and cashflow aggregations
- Placeholder sections for charts and breakdown analysis

## Non-Functional Requirements

| NFR | Specification |
|-----|---------------|
| Language | Vietnamese UI, English codebase |
| Performance | Client-side rendering with fetch (no SSR for data pages) |
| Data precision | NUMERIC(14,2) for monetary values, NUMERIC(14,3) for quantities |
| Validation | Two-layer: client-side (React forms) + server-side (validation modules) |
| Security | Supabase Auth + Service Role Key isolation |
| Database | PostgreSQL via Supabase with triggers, views, and RPC functions |

## Non-Goals (V1)

- Multi-user roles/permissions
- Supplier management & supplier debt
- POS hardware integration (receipt printer, barcode scanner, QR)
- Mobile app
- Multi-store support

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Supabase as BaaS | Quick setup with Auth, Postgres, and real-time out of the box |
| PostgreSQL RPC for sales | Atomic stock allocation within a single transaction |
| FIFO as default allocation | Most common inventory method for perishable goods |
| Client-side session guard | Simplicity — single admin, no complex RBAC needed |
| Validation layer separation | `*Validation.ts` files separate from `*Core.ts` for testability |
| Vietnamese UI / English code | Local store use case with developer-friendly codebase |

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side) |
