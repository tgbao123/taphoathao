# TapHoaThao — Project Roadmap

## Milestone Summary

| Milestone | Status | Description |
|-----------|--------|-------------|
| M1 — Foundation + Products + Batches | ✅ Done | Auth, products CRUD, batch import |
| M2 — Sales + Debt | ✅ Done | Sale creation (FIFO/manual), debt ledger + payment |
| M3 — Cashflow + Reports | ✅ Done | Thu/chi, summary KPIs |
| M4 — Hardening + Release | 🔲 Planned | Seed data, smoke tests, deployment |

## M1 — Foundation + Products + Batches ✅

**Completed features:**
- Admin login (Supabase Auth email/password)
- `useRequireSession` auth guard hook
- Products CRUD (list, create, inline edit, delete)
- Units management (list, create via API)
- Product detail page with batch listing
- Batch import (single and bulk import)
- Database schema: `units`, `products`, `product_batches`

## M2 — Sales + Debt ✅

**Completed features:**
- Sales page with cart-based UI
- Two allocation modes: AUTO_FIFO and MANUAL_LOT
- Sale creation via PostgreSQL RPC (`api_create_sale`)
- Customer list with search (name/phone) and current debt
- Customer debt ledger page (entries, KPI cards)
- Debt payment form (multiple payment methods)
- `v_customer_debt_balance` view for real-time debt
- Database schema: `customers`, `sales`, `sale_items`, `debt_payments`, `debt_ledger`

## M3 — Cashflow + Reports ✅

**Completed features:**
- Cashflow page (inflow/outflow entry creation + listing)
- Reports page with 4 KPIs (revenue, debt, products, net cashflow)
- Summary API with date range filtering
- Database schema: `cash_transactions`

## M4 — Hardening + Release 🔲

**Planned tasks:**
- [ ] Seed data for testing
- [ ] 3 smoke test flows (per [SMOKE_TEST.md](./pm/SMOKE_TEST.md))
- [ ] Deploy to Vercel
- [ ] Edge case handling and error messaging

## Backlog (Post-V1)

### Priority 1 (Near-term)

| Feature | Description |
|---------|-------------|
| Charts & analytics | Revenue/profit charts over time |
| Top products report | Best-selling products by quantity/revenue |
| Top customers report | Customers by revenue/debt |
| Batch expiry alerts | Warn when batches near expiry date |
| Product search | Full-text search on products list page |

### Priority 2 (Medium-term)

| Feature | Description |
|---------|-------------|
| Sale history | List and view past sales with detail |
| Sale cancellation | Cancel/refund sales with stock reversal |
| Inventory snapshot | Point-in-time inventory valuation |
| Cashflow categories | Pre-defined categories with auto-complete |
| Export to Excel/CSV | Data export for accounting |

### Priority 3 (Long-term / V2)

| Feature | Description |
|---------|-------------|
| Multi-user roles | Staff roles with permissions (viewer, cashier, admin) |
| Supplier management | Supplier profiles, purchase orders, supplier debt |
| Barcode scanning | Camera-based barcode reading for fast POS |
| Receipt printing | POS printer integration |
| Multi-store | Support multiple store locations |
| Mobile PWA | Progressive web app for mobile use |

## Technical Debt

| Item | Severity | Description |
|------|----------|-------------|
| No SSR for data pages | Low | All pages use client-side fetch; could benefit from SSR for SEO (non-issue for admin tool) |
| No test suite | Medium | No unit or integration tests; validation modules are well-structured for testing |
| Report placeholders | Low | Charts and breakdown sections are placeholders |
| Hardcoded strings | Low | Vietnamese UI strings are inline; no i18n framework |
| `v_customer_debt_balance` view | Low | View definition in RPC/migration, not in `schema.sql` |
