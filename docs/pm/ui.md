# UI Routes + Wireframe Text (POS/Inventory mini-ERP)

## 1) `/login`

**Mục tiêu:** Đăng nhập nhanh, rõ trạng thái lỗi.

```text
+--------------------------------------------------+
| Logo + App Name |
|--------------------------------------------------|
| [Tiêu đề] Đăng nhập |
| [Input] Email / Username |
| [Input] Mật khẩu [👁 Hiện/Ẩn] |
| [ ] Ghi nhớ đăng nhập |
| [Button Primary] Đăng nhập |
| [Link] Quên mật khẩu? |
|--------------------------------------------------|
| [Alert Error/Info] Sai tài khoản hoặc mật khẩu |
+--------------------------------------------------+
```

**Component breakdown (ngắn):**
- `AuthCard`
- `TextField`, `PasswordField`
- `Checkbox`
- `Button`
- `InlineAlert`

---

## 2) `/products`

**Mục tiêu:** Tìm kiếm, lọc, xem tồn kho và thao tác nhanh sản phẩm.

```text
+--------------------------------------------------------------------------------+
| Header: Sản phẩm [Search....] [Filter: Category] [Filter: Stock] [+Mới]|
|--------------------------------------------------------------------------------|
| KPI: Tổng SP | Sắp hết hàng | Hết hàng | Giá trị tồn kho |
|--------------------------------------------------------------------------------|
| TABLE ⚙︎ |
| [ ] | SKU | Tên SP | Danh mục | Giá bán | Tồn kho | Trạng thái | ... |
|--------------------------------------------------------------------------------|
| Bulk actions: [Xóa] [Export] Pagination 1 2 3 ... |
+--------------------------------------------------------------------------------+
```

**Component breakdown:**
- `PageHeader` + `SearchInput`
- `FilterBar` (category, stock status)
- `StatsKpiRow`
- `DataTable` + `RowActionMenu`
- `BulkActionBar`, `Pagination`

---

## 3) `/products/[id]`

**Mục tiêu:** Xem/đổi thông tin sản phẩm + lịch sử nhập/xuất.

```text
+--------------------------------------------------------------------------------+
| Breadcrumb: Sản phẩm / [Tên SP] [Sửa] [Ngưng bán] [Xóa] |
|--------------------------------------------------------------------------------|
| LEFT (Thông tin chính) | RIGHT (Tổng quan nhanh) |
| - SKU | - Tồn hiện tại |
| - Tên, danh mục | - Giá vốn TB |
| - Đơn vị, barcode | - Giá bán |
| - Mô tả | - Lô gần hết hạn |
|--------------------------------------------------------------------------------|
| Tabs: [Biến thể] [Lô hàng] [Lịch sử giao dịch] [Cài đặt giá] |
| - Lô hàng: batch_code | exp_date | qty | cost |
| - Lịch sử: thời gian | loại | SL +/- | người thao tác |
+--------------------------------------------------------------------------------+
```

**Component breakdown:**
- `Breadcrumb`
- `ProductSummaryCard`
- `SideStatsCard`
- `Tabs`
- `BatchTable`, `TransactionTable`
- `ConfirmDialog` (ngưng bán/xóa)

---

## 4) `/batches/import`

**Mục tiêu:** Nhập lô hàng theo form hoặc file, review trước khi commit.

```text
+--------------------------------------------------------------------------------+
| Header: Nhập lô hàng [Tải mẫu CSV] |
|--------------------------------------------------------------------------------|
| Mode: (•) Nhập tay ( ) Import CSV |
|--------------------------------------------------------------------------------|
| Form nhập tay |
| [Select] Sản phẩm [Input] Batch code [Date] NSX [Date] HSD |
| [Input] Số lượng [Input] Giá vốn [Input] Nhà cung cấp |
| [ + Thêm dòng ] |
|--------------------------------------------------------------------------------|
| Preview lines |
| # | Sản phẩm | Batch | NSX | HSD | Qty | Cost | Valid? |
|--------------------------------------------------------------------------------|
| [Button Secondary] Lưu nháp [Button Primary] Xác nhận nhập kho |
+--------------------------------------------------------------------------------+
```

**Component breakdown:**
- `SegmentedControl` (manual/CSV)
- `DynamicLineItemsForm`
- `CsvUploadDropzone`
- `ValidationPreviewTable`
- `StickyActionFooter`

---

## 5) `/sales` (toggle retail/manual)

**Mục tiêu:** Bán hàng tại quầy + ghi nhận đơn thủ công.

```text
+--------------------------------------------------------------------------------+
| Header: Bán hàng Toggle: [Retail POS] [Manual Entry] |
|--------------------------------------------------------------------------------|
| RETAIL POS VIEW |
| [Search barcode/tên] [Scan] |
| LEFT: Danh sách SP / gợi ý RIGHT: Giỏ hàng |
| - Card SP (giá, tồn) - Item list |
| - Discount |
| - Tổng tiền |
| - [Chọn khách] [Chọn thanh toán] |
| - [Thanh toán] |
|--------------------------------------------------------------------------------|
| MANUAL ENTRY VIEW |
| [Input] Mã đơn / kênh bán / ghi chú |
| [Add row] Tên SP | Qty | Đơn giá | giảm giá |
| [Select] Khách hàng [Select] Phương thức thanh toán |
| [Button] Lưu đơn |
+--------------------------------------------------------------------------------+
```

**Component breakdown:**
- `SalesModeToggle`
- `ProductQuickGrid` + `BarcodeSearch`
- `CartPanel`
- `PaymentSheet`
- `ManualOrderForm` + `OrderLineTable`

---

## 6) `/customers`

**Mục tiêu:** Quản lý danh sách khách + công nợ tổng.

```text
+--------------------------------------------------------------------------------+
| Header: Khách hàng [Search] [Filter: nhóm] [Filter: nợ] [+Thêm KH] |
|--------------------------------------------------------------------------------|
| KPI: Tổng KH | Đang nợ | Nợ quá hạn | Doanh thu tháng |
|--------------------------------------------------------------------------------|
| TABLE |
| Tên KH | SĐT | Nhóm | Tổng mua | Công nợ hiện tại | Lần mua gần nhất | ... |
|--------------------------------------------------------------------------------|
| Row action: [Xem chi tiết] [Tạo đơn] [Ghi nhận thanh toán] |
+--------------------------------------------------------------------------------+
```

**Component breakdown:**
- `CustomerFilterBar`
- `KpiCards`
- `CustomerTable`
- `QuickActionMenu`
- `CreateCustomerModal`

---

## 7) `/customers/[id]/debt`

**Mục tiêu:** Theo dõi công nợ chi tiết, thu nợ, lịch sử đối soát.

```text
+--------------------------------------------------------------------------------+
| Breadcrumb: Khách hàng / [Tên KH] / Công nợ [Thu nợ] [In sao kê] |
|--------------------------------------------------------------------------------|
| Debt Summary: Nợ đầu kỳ | Phát sinh tăng | Đã thu | Nợ hiện tại | Quá hạn |
|--------------------------------------------------------------------------------|
| Tabs: [Sổ công nợ] [Hóa đơn chưa thanh toán] [Lịch sử thanh toán] |
|--------------------------------------------------------------------------------|
| Sổ công nợ timeline: |
| 11/03 HĐ #S123 +1,200,000 |
| 12/03 Thu tiền -500,000 |
| ... |
|--------------------------------------------------------------------------------|
| [Form mini] Thu nợ: số tiền | phương thức | ghi chú | [Xác nhận] |
+--------------------------------------------------------------------------------+
```

**Component breakdown:**
- `DebtSummaryCards`
- `LedgerTimeline`
- `UnpaidInvoicesTable`
- `PaymentHistoryTable`
- `CollectPaymentModal`

---

## 8) `/cashflow`

**Mục tiêu:** Quản lý dòng tiền vào/ra theo ngày, danh mục, nguồn.

```text
+--------------------------------------------------------------------------------+
| Header: Dòng tiền [Date range] [Filter loại] [+Ghi nhận] |
|--------------------------------------------------------------------------------|
| KPI: Thu | Chi | Dòng tiền ròng | Số dư cuối kỳ |
|--------------------------------------------------------------------------------|
| Chart: Thu vs Chi theo ngày/tuần |
|--------------------------------------------------------------------------------|
| TABLE: Ngày | Loại (thu/chi) | Danh mục | Số tiền | Liên kết chứng từ | ... |
|--------------------------------------------------------------------------------|
| [Export Excel] [Đối soát quỹ] |
+--------------------------------------------------------------------------------+
```

**Component breakdown:**
- `DateRangePicker`
- `CashflowKpis`
- `InOutBarChart`
- `CashflowTable`
- `CashEntryModal`

---

## 9) `/reports`

**Mục tiêu:** Xem báo cáo tổng hợp theo module, lọc nhanh, export.

```text
+--------------------------------------------------------------------------------+
| Header: Báo cáo [Date range] [Store] [Export PDF/Excel] |
|--------------------------------------------------------------------------------|
| Tabs: [Doanh thu] [Lợi nhuận] [Tồn kho] [Công nợ] [Dòng tiền] |
|--------------------------------------------------------------------------------|
| Section A: KPI cards |
| Section B: Chart chính |
| Section C: Breakdown table (top SP, top KH, theo danh mục...) |
|--------------------------------------------------------------------------------|
| Saved views: [Hôm nay] [7 ngày] [Tháng này] [Tuỳ chỉnh] |
+--------------------------------------------------------------------------------+
```

**Component breakdown:**
- `ReportTabs`
- `GlobalReportFilters`
- `KpiGrid`
- `ChartPanel`
- `BreakdownTable`
- `ExportActions`

---

## Shared UI primitives
- `AppShell` (sidebar + topbar + breadcrumb)
- `PageHeader`
- `FilterBar`
- `DataTable`
- `KpiCard`
- `Tabs`
- `Modal/Drawer`
- `ConfirmDialog`
- `Toast/InlineAlert`
