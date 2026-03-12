# TapHoaThao — Codebase Summary

> File-by-file analysis of the TapHoaThao codebase. **Total: ~4,109 LOC across 35 source files.**

## Statistics

| Directory | Files | LOC | Purpose |
|-----------|-------|-----|---------|
| `src/app/` (pages) | 10 | 2,192 | UI pages (React client components) |
| `src/app/api/` | 12 | 560 | Next.js API routes |
| `src/lib/server/` | 8 | 1,303 | Server-side business logic |
| `src/lib/` (client) | 2 | 57 | Client utilities |
| **Total** | **35** | **4,109** | |

## Pages (`src/app/`)

| File | LOC | Description |
|------|-----|-------------|
| `page.tsx` | 5 | Root page — redirects to `/login` |
| `layout.tsx` | 60 | Root layout with nav header (Hàng hoá, Nhập lô, Bán hàng, Khách hàng, Thu/chi, Báo cáo) |
| `login/page.tsx` | 101 | Email/password login form, session check, auto-redirect |
| `products/page.tsx` | 489 | Product list with inline create form, inline editing, delete. Largest page |
| `products/[id]/page.tsx` | 194 | Product detail with batch list for a specific product |
| `batches/import/page.tsx` | 288 | Multi-line batch import form with product selection |
| `sales/page.tsx` | 331 | Sales POS UI with cart, AUTO_FIFO/MANUAL_LOT toggle, checkout |
| `customers/page.tsx` | 121 | Customer list with search, current debt display |
| `customers/[id]/debt/page.tsx` | 265 | Customer debt ledger, KPI cards, payment form |
| `cashflow/page.tsx` | 222 | Cashflow list and create transaction form |
| `reports/page.tsx` | 112 | Summary KPI cards (revenue, debt, products, net cashflow) |

## API Routes (`src/app/api/`)

| Route | Methods | LOC | Handler |
|-------|---------|-----|---------|
| `products/route.ts` | GET, POST | 50 | List/create products via `inventory.ts` |
| `products/[id]/route.ts` | GET, PATCH, DELETE | 72 | Get/update/delete product |
| `products/[id]/batches/route.ts` | GET | 29 | List batches for product |
| `batches/route.ts` | POST | 35 | Create single batch |
| `batches/import/route.ts` | POST | 35 | Bulk import batches |
| `units/route.ts` | GET, POST | 46 | List/create units |
| `sales/route.ts` | POST | 56 | Create sale via RPC |
| `customers/route.ts` | GET, POST | 49 | List/create customers |
| `cashflow/route.ts` | GET, POST | 58 | List/create cashflow entries |
| `debt/payments/route.ts` | POST | 52 | Create debt payment |
| `debt/customers/[customerId]/ledger/route.ts` | GET | 75 | Customer debt ledger query |
| `reports/summary/route.ts` | GET | 20 | Summary KPIs |

## Server Modules (`src/lib/server/`)

| File | LOC | Description |
|------|-----|-------------|
| `supabaseAdmin.ts` | 21 | Factory for Supabase admin client (service role key) |
| `inventory.ts` | 188 | Data access: products, units, batches CRUD with Supabase queries |
| `inventoryValidation.ts` | 163 | Input parsing/validation for products, units, and batches |
| `salesCore.ts` | 98 | Sale creation via `api_create_sale` RPC with PG error mapping |
| `salesDebtValidation.ts` | 214 | Validation for sale input, debt payment, debt ledger queries |
| `debtCore.ts` | 184 | Debt payment creation and customer ledger retrieval |
| `customerCashflowCore.ts` | 208 | Customer CRUD, cashflow CRUD, and summary KPI aggregation |
| `customerCashflowValidation.ts` | 185 | Validation for customer, cashflow inputs and queries |

## Client Utilities (`src/lib/`)

| File | LOC | Description |
|------|-----|-------------|
| `supabaseClient.ts` | 6 | Browser-side Supabase client initialization |
| `useRequireSession.ts` | 51 | Auth guard hook — checks session, redirects to `/login` if unauthenticated |

## Database Schema

9 tables defined in `docs/pm/schema.sql` (258 lines):

| Table | Purpose |
|-------|---------|
| `units` | Measurement units (cái, hộp, kg) |
| `products` | Product catalog with SKU, barcode, default sell price |
| `product_batches` | Lot-based inventory tracking with FIFO index |
| `customers` | Customer records with opening debt |
| `sales` | Sale headers with formula constraints (`total = subtotal - discount`) |
| `sale_items` | Line items with computed `line_total` |
| `debt_payments` | Debt payment records with method |
| `debt_ledger` | Chronological debt entries (sale_debt, payment, adjustment) |
| `cash_transactions` | Inflow/outflow with category and method |

Views: `v_customer_debt_balance` (current debt per customer).
RPC Functions: `api_create_sale`, `api_create_debt_payment`.
