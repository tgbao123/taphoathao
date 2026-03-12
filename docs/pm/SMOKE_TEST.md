# TapHoaThao — Smoke Test Checklist (MVP)

## 0) Preconditions
- Supabase schema đã apply (`docs/pm/schema.sql` + migrations)
- `.env.local` có:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Chạy app local:
  - `npm run dev`

## 1) Auth flow
1. Mở `/login`
2. Đăng nhập admin hợp lệ
3. Verify redirect vào `/products`
4. Mở route protected khi chưa login -> bị chuyển về `/login`

## 2) Products / Units / Batches
1. Tạo unit mới (nếu cần)
2. Tạo product mới
3. Vào `/batches/import` tạo 1-2 batch cho product
4. Mở `/products/[id]` verify batches hiển thị đúng

## 3) Sales manual lot
1. Vào `/sales`, chọn mode Manual Lot
2. Tạo sale dùng batch cụ thể
3. Verify API trả thành công
4. Verify `qty_remaining` batch giảm đúng

## 4) Sales auto FIFO
1. Vào `/sales`, chọn mode Auto FIFO
2. Tạo sale không chọn lot
3. Verify hệ thống auto allocate theo FIFO
4. Verify thiếu tồn trả lỗi `INSUFFICIENT_STOCK`

## 5) Debt flow
1. Tạo sale credit (paid < total)
2. Verify ledger tăng nợ (`sale_debt`)
3. Vào `/customers/[id]/debt`, tạo debt payment
4. Verify ledger giảm nợ (`payment`), current debt cập nhật đúng

## 6) Cashflow + Reports
1. Vào `/cashflow`, tạo 1 inflow + 1 outflow
2. Verify `/api/cashflow` list hiển thị đủ
3. Vào `/reports`, verify summary có dữ liệu (không lỗi)

## 7) Build gate
- Chạy `npm run build` phải pass

## Pass criteria
- 7/7 mục pass và không có lỗi runtime blocker.
