# TapHoaThao — PM Plan (V1)

## Goals
- Web app quản lý tạp hoá cho **1 cửa hàng**.
- Có **đăng nhập 1 admin**.
- Quản lý **hàng hoá + tồn kho theo lô** (giá nhập/giá bán theo lô, đơn vị tính).
- Bán hàng: **bán lẻ** (không cần chọn lô) và **bán theo lô** (chọn lô cụ thể).
- Quản lý **công nợ khách hàng**.
- Quản lý **thu/chi**.

## Non-goals (V1)
- Phân quyền nhiều user/role.
- Nhà cung cấp + công nợ NCC.
- POS/in hoá đơn/máy in/QR.

## Key decisions
- Đăng nhập 1 admin (session/cookie).
- Bán hàng có 2 chế độ:
  - **Bán theo lô**: người dùng chọn batch_id.
  - **Bán lẻ**: hệ thống tự trừ tồn theo quy tắc (mặc định **FIFO** theo imported_at, có thể đổi sau).

## Data model (core)
- users
- units
- products
- product_batches (lot)
- customers
- sales, sale_items
- debt_ledger, debt_payments
- cash_transactions

## Milestones
### M1 — Foundation + Products + Batches (Week 1)
Deliverables:
- Auth admin
- Products CRUD
- Batches import + tồn theo lô

### M2 — Sales + Debt (Week 2)
Deliverables:
- Create sale (lot/manual + retail/FIFO)
- Debt ledger + payment

### M3 — Cashflow + Reports (Week 3)
Deliverables:
- Thu/chi
- Reports (inventory, debt, cashflow)

### M4 — Hardening + Release (Week 4)
Deliverables:
- Seed data
- Smoke test flows
- Deploy

## Backlog (assignable)

### Backend 1 — Inventory/Batches
- [P0] DB migrations: users/units/products/product_batches
- [P0] API products CRUD + search
- [P0] API batches: import, list by product, qty_remaining

### Backend 2 — Sales/Debt
- [P0] DB migrations: customers/sales/sale_items/debt_ledger/debt_payments
- [P0] API create sale (manual lot mode)
- [P0] API create sale (retail mode: auto allocate FIFO)
- [P0] API debt ledger + debt payment

### Frontend 1 — Shell/Products
- [P0] Login admin + route guard
- [P0] Layout + navigation
- [P0] Products screen (list/create/edit/search)
- [P1] Product detail + batches list

### Frontend 2 — Import/Sales/Debt
- [P0] Import batches screen
- [P0] Sales screen (manual lot + retail)
- [P0] Debt screens (customers list + ledger + payment)

### Fullstack/QA
- [P0] Thu/chi API + UI
- [P1] Reports UI + API endpoints
- [P0] Seed data + 3 smoke flows

