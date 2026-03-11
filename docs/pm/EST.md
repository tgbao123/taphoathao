# EST — TapHoaThao (Next.js + Supabase) — Estimate & Task Split (V1)

## Assumptions
- Next.js (choose App Router unless project already uses Pages Router)
- Supabase: Postgres + Auth
- 1 cửa hàng, 1 admin login
- Hàng hoá có đơn vị tính + **giá nhập/giá bán theo lô**
- Bán hàng có 2 chế độ:
  - **Bán theo lô (manual)**: chọn batch
  - **Bán lẻ (auto)**: tự phân bổ theo FIFO
- Công nợ: **khách hàng**

## Overall estimate
- **MVP V1:** 7–10 ngày làm việc
- **Chắc hơn (seed + smoke test + polish):** 10–14 ngày

> Nếu chưa có skeleton project / chưa có UI kit: +0.5–1 ngày.

## Milestones

### M1 — Foundation + Products + Batches (Day 1–4)
Deliverables:
- Auth admin
- Products + Units
- Batches import + tồn theo lô

### M2 — Sales + Debt (Day 5–8)
Deliverables:
- Create sale (manual lot)
- Create sale (retail FIFO auto-allocate)
- Debt ledger + debt payments

### M3 — Cashflow + Reports + Release (Day 9–10+)
Deliverables:
- Thu/chi
- Báo cáo cơ bản
- Seed data + smoke flows
- Deploy

## Task split (assignable)

### Backend/Data (Supabase) — Coder A (2–3.5 days)
- [P0] DB schema + migrations:
  - users (auth)
  - units
  - products
  - product_batches
  - customers
  - sales + sale_items
  - debt_ledger + debt_payments
  - cash_transactions
- [P0] RLS policies (tối thiểu) cho 1 admin:
  - Option nhanh: 1 user, allow owner-only by user_id
  - Option đơn giản: disable RLS cho V1 (không khuyến nghị nếu có public client writes)
- [P0] Seed data script (units + vài products + batches)

Acceptance criteria:
- Schema chạy được trên Supabase, có indexes cơ bản
- Tồn kho theo lô query được (qty_remaining)

### API/Server logic — Coder B (3–4 days)
- [P0] Products CRUD
- [P0] Batch import API
- [P0] Sales API (manual lot mode):
  - validate qty
  - trừ qty_remaining đúng
- [P0] Sales API (retail auto mode):
  - FIFO allocate
  - tạo sale_items breakdown theo từng batch
  - fail rõ nếu thiếu tồn
- [P0] Debt API:
  - khi sale credit → ghi ledger tăng nợ
  - payment → ghi ledger giảm nợ
  - query balance per customer
- [P1] Report queries:
  - inventory summary
  - debt summary
  - cashflow by date

Acceptance criteria:
- Tất cả mutation chạy trong transaction
- Không có trường hợp tồn âm

### Frontend — Coder C (3–4 days)
- [P0] Login screen + route guard
- [P0] Layout + navigation
- [P0] Products screens:
  - list/create/edit/search
  - product detail + batches list
- [P0] Import batches screen
- [P0] Sales screen:
  - toggle Retail/Manual
  - retail: chọn product+qty
  - manual: chọn batch+qty+price
- [P0] Customers + Debt screens:
  - list customers + balance
  - ledger view
  - payment form
- [P0] Cashflow screen (thu/chi)
- [P1] Reports screen

Acceptance criteria:
- CRUD flows usable end-to-end
- Error messages rõ, form validation cơ bản

### Ops/QA — Ops agent / Coder D (1–2 days)
- [P0] Env + CI basics + scripts:
  - .env.example
  - README run local
- [P0] Smoke test 3 flows:
  1) nhập lô → bán tiền mặt
  2) bán chịu → thu tiền → check balance
  3) thu/chi → check report
- [P1] Deploy (Vercel) + Supabase project setup checklist

## Risks / blockers
- RLS + client-side writes: dễ lỗi quyền nếu không design ngay từ đầu.
- FIFO auto allocation: cần xử lý edge cases (đồng thời, tồn không đủ, giá override).

## Next step checklist
- Confirm router: App Router vs Pages Router (nếu chưa có code thì chọn App Router)
- Provide Supabase env (URL, anon key, service role key server-side)
- Decide RLS strategy for V1
