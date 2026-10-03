# Đơn vị đặt hàng — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay "Đơn vị tổ chức" bằng "Đơn vị đặt hàng" trên khóa bồi dưỡng; chỉ Quản trị ghi; Sở/Phòng/Trường xem theo 2 quy tắc R1 (đặt hàng → toàn bộ học viên) và R2 (tham gia → học viên trong phạm vi).

**Architecture:** Đổi tên cột `don_vi_to_chuc_id` → `don_vi_dat_hang_id` (DB + API). Gom phạm vi xem khóa vào 2 hàm mới của `ScopeService`, thay `getKhoaIdsTheoDoi`; xóa luồng duyệt khóa và bảng `khoa_don_vi_theo_doi`. Frontend Admin ẩn thao tác ghi với vai trò khác `quan_tri`.

**Tech Stack:** NestJS + Prisma (PostgreSQL), Jest (unit + e2e `--runInBand`); React 18 + Mantine + TanStack Query, Vitest + MSW.

**Spec:** `docs/superpowers/specs/2026-10-03-don-vi-dat-hang-design.md`

## Global Constraints

- Tên field API giữ snake_case, đúng tên cột DB: `don_vi_dat_hang_id`, `pham_vi_hoc_vien`.
- Lỗi theo dạng `{ error: { code, message, fields: [{ field, message }] } }` (dùng `ValidationException`, `ForbiddenAppException`, `NotFoundAppException` sẵn có).
- Message validate đúng nguyên văn: "Bắt buộc", "Không hợp lệ", "Sai loại đơn vị".
- Loại đơn vị đặt hàng hợp lệ: `so_gddt`, `truong`, `khac` (từ chối `phong_vhxh`).
- `pham_vi_hoc_vien`: `'toan_bo'` (R1 hoặc `quan_tri`) | `'don_vi'` (chỉ R2).
- Chữ hiển thị cố định: "Đặt hàng: …", "Tổ chức: Trường ĐHSP TP.HCM", "Bạn đang xem các học viên thuộc đơn vị của mình trong khóa này."
- Giao diện tiếng Việt có dấu; không thêm thư viện mới.
- Mỗi commit xong thì `git push` ngay (không force-push). Commit kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Backend và frontend deploy cùng lúc (đổi tên field API).
- Sai lệch có chủ đích so với spec §7: migration tách 2 file (Task 1 đổi tên cột, Task 6 chuyển dữ liệu + xóa bảng + đổi trạng thái), deploy cùng một lần `prisma migrate deploy`.

## Review Focus

1. Quản trị đổi đơn vị đặt hàng của khóa đã có học viên → quyền xem của Sở cũ/mới đổi ngay ở lần gọi kế tiếp (không cache). Test: Task 4.
2. Tài khoản Sở/Trường không gắn `don_vi_id` hoặc cây rỗng → thấy 0 khóa, 200 rỗng, không 500. Test: Task 2.
3. Lọc `?don_vi_dat_hang_id=` bằng đơn vị ngoài phạm vi → 200 danh sách rỗng hoặc chỉ khóa xem được, không 403. Test: Task 4.
4. Trường là đơn vị đặt hàng của khóa chưa có học viên nào → vẫn thấy khóa (R1 không phụ thuộc đăng ký). Test: Task 2.
5. Dữ liệu cũ: khóa có 0 hoặc ≥2 đơn vị theo dõi → migration giữ nguyên đơn vị đặt hàng, script liệt kê để gán tay. Test: Task 6 (chạy script trên DB e2e có dữ liệu mẫu).

---

### Task 1: Đổi tên cột sang `don_vi_dat_hang_id` (không đổi hành vi)

**Files:**
- Create: `backend/prisma/migrations/20261003120000_don_vi_dat_hang_rename/migration.sql`
- Modify: `backend/prisma/schema.prisma:671-697` (field + relation `don_vi_to_chuc` → `don_vi_dat_hang`; quan hệ ngược trên `don_vi_cong_tac`)
- Modify (đổi tên cơ học): `backend/src/khoa-boi-duong/**`, `backend/src/bao-cao/bao-cao.service.ts`, `backend/src/bao-cao/bao-cao.types.ts:46`, `backend/src/bao-cao/util/report-excel.util.ts:163` (+ tiêu đề cột "Đơn vị đặt hàng"), `backend/src/thong-bao/thong-bao.service.ts`, các `*.spec.ts` và `backend/test/*.e2e-spec.ts` đang dùng `don_vi_to_chuc_id`
- Modify: `docs/database-ddl.sql` (cột + FK/index)

**Interfaces:**
- Produces: cột/field Prisma `khoa_boi_duong.don_vi_dat_hang_id`, relation `don_vi_dat_hang`; DTO field `don_vi_dat_hang_id` (create + query); `TongHopKhoaRow.don_vi_dat_hang: string`.

- [ ] **Step 1:** Viết migration: `ALTER TABLE khoa_boi_duong RENAME COLUMN don_vi_to_chuc_id TO don_vi_dat_hang_id;` và đổi tên FK/index đang mang tên `don_vi_to_chuc` (tra tên thật trong `prisma/migrations/20260924000000_init/migration.sql`).
- [ ] **Step 2:** Sửa `schema.prisma`, chạy `npx prisma migrate dev` trên DB local → không phát sinh migration thừa (`npx prisma migrate diff` rỗng).
- [ ] **Step 3:** Đổi tên mọi tham chiếu (grep `don_vi_to_chuc` trong `backend/src`, `backend/test` → 0 kết quả ngoài comment lịch sử).
- [ ] **Step 4:** Run `npm run build && npm test && npm run test:e2e` trong `backend/` → tất cả PASS (hành vi không đổi).
- [ ] **Step 5:** Commit `refactor(khoa): doi ten don_vi_to_chuc_id -> don_vi_dat_hang_id` + push.

### Task 2: `ScopeService` — R1/R2

**Files:**
- Modify: `backend/src/auth/scope/scope.service.ts`
- Test: `backend/src/auth/scope/scope.service.spec.ts`

**Interfaces:**
- Produces:
  - `getKhoaIdsXemDuoc(caller: { vai_tro; don_vi_id: string | null }): Promise<DonViScope>` — `quan_tri` → `'ALL'`; `hoc_vien` hoặc scope rỗng → `[]`; còn lại → id các khóa thỏa R1 ∪ R2.
  - `getHocVienScopeTrongKhoa(caller, khoa: { don_vi_dat_hang_id: string }): Promise<DonViScope>` — `quan_tri` hoặc R1 → `'ALL'`; ngược lại → `getAccessibleDonViIds(caller)`.
- Consumes: `getAccessibleDonViIds` (giữ nguyên).

- [ ] **Step 1: Viết test fail** (mock `prisma.khoa_boi_duong.findMany`, kiểm tra cả `where` truyền vào):
  - `getKhoaIdsXemDuoc`: `quan_tri` → `'ALL'`, không query; `truong` không `don_vi_id` → `[]`, không query khóa; `truong` `don_vi_id='T1'` → gọi `findMany` với `where.OR` chứa `{ don_vi_dat_hang_id: { in: ['T1'] } }` và `{ dang_ky_hoc: { some: { hoc_vien: { don_vi_cong_tac_id: { in: ['T1'] } } } } }`, trả `['k1','k2']`; `so_gddt` → `in` là danh sách cây con.
  - `getHocVienScopeTrongKhoa`: `quan_tri` → `'ALL'`; Sở `so-A` + khóa đặt bởi `so-A` → `'ALL'`; Sở `so-A` + khóa đặt bởi trường con `T1` (thuộc cây) → `'ALL'`; Sở `so-A` + khóa đặt bởi `so-B` → cây `so-A`; `truong T1` + khóa đặt bởi `T1` → `'ALL'`; `truong T1` + khóa đặt bởi `so-A` → `['T1']`; `phong_vhxh P1` + khóa đặt bởi `so-A` → cây `P1`.
- [ ] **Step 2:** Run `npm test -- scope.service` → FAIL (hàm chưa có).
- [ ] **Step 3:** Implement 2 hàm (1 `findMany` với `OR`, `select: { id: true }`, `distinct` không cần vì theo khóa).
- [ ] **Step 4:** Run `npm test -- scope.service` → PASS.
- [ ] **Step 5:** Commit `feat(scope): pham vi xem khoa theo don vi dat hang va tham gia` + push.

### Task 3: Khóa — đường ghi chỉ Quản trị, bỏ luồng duyệt và theo dõi

**Files:**
- Modify: `backend/src/khoa-boi-duong/khoa-boi-duong.controller.ts` (mọi `@Roles('truong','quan_tri')` → `@Roles('quan_tri')`; xóa route `nop-duyet`, `duyet`, `don-vi-theo-doi` POST/DELETE)
- Modify: `backend/src/khoa-boi-duong/khoa-boi-duong.service.ts` (`taoKhoa`, `capNhatKhoa`; xóa `nopDuyet`, `duyet`, `resolveDonViDuyetKhoa`, `themDonViTheoDoi`, `xoaDonViTheoDoi`, `assertChuKhoa` + mọi lời gọi)
- Modify: `backend/src/khoa-boi-duong/dto/create-khoa-boi-duong.dto.ts` (`don_vi_dat_hang_id` bắt buộc, `@IsUUID`), `dto/update-khoa-boi-duong.dto.ts` (`don_vi_dat_hang_id?`); xóa `dto/them-don-vi-theo-doi.dto.ts`, `DuyetKhoaDto`
- Modify: `backend/src/thong-bao/thong-bao.service.ts` (+ spec) — xóa `guiKhoaBoiDuongDuyet`
- Modify: các route ghi khác cùng module đang `@Roles('truong', …)` (ví dụ cập nhật kết quả `dang-ky-hoc`, import nhân sự lớp) → `quan_tri`
- Test: `backend/test/khoa-boi-duong.e2e-spec.ts`, `backend/src/khoa-boi-duong/khoa-boi-duong.service.spec.ts`

**Interfaces:**
- Produces: `private async validateDonViDatHang(id: string | undefined): Promise<{ id: string }>` trong service (dùng chung cho tạo + sửa).
- Consumes: không.

- [ ] **Step 1: Viết e2e fail** (describe "Đơn vị đặt hàng — ghi"):
  - `POST /khoa-boi-duong` (quan_tri) thiếu `don_vi_dat_hang_id` → 400, `fields[0] = { field: 'don_vi_dat_hang_id', message: 'Bắt buộc' }`.
  - id không tồn tại / đơn vị `ngung` → 400 "Không hợp lệ"; đơn vị `phong_vhxh` → 400 "Sai loại đơn vị".
  - Sở, trường, khác hợp lệ → 201, `trang_thai = 'da_duyet'`, `don_vi_dat_hang_id` đúng.
  - Tài khoản `truong`, `so_gddt`, `phong_vhxh` gọi `POST /khoa-boi-duong`, `PATCH /khoa-boi-duong/:id`, `POST /:id/giai-doan`, `POST /:id/lop`, `POST /:id/cum`, cập nhật kết quả → 403.
  - `POST /:id/nop-duyet`, `POST /:id/duyet`, `POST /:id/don-vi-theo-doi`, `DELETE /:id/don-vi-theo-doi/:x` → 404.
  - `PATCH /:id` (quan_tri) trên khóa `da_duyet` đổi `don_vi_dat_hang_id` sang Sở khác → 200; đổi sang `phong_vhxh` → 400 "Sai loại đơn vị".
- [ ] **Step 2:** Run `npm run test:e2e -- khoa-boi-duong` → các test mới FAIL.
- [ ] **Step 3:** Implement theo Files; xóa/sửa test cũ về nộp duyệt, duyệt, theo dõi, "không phải chủ khóa" (thay bằng 403 ở RolesGuard).
- [ ] **Step 4:** Run `npm run build && npm test && npm run test:e2e` → PASS.
- [ ] **Step 5:** Commit `feat(khoa): chi quan tri ghi, bo luong duyet khoa va don vi theo doi` + push.

### Task 4: Khóa — đường đọc theo R1/R2

**Files:**
- Modify: `backend/src/khoa-boi-duong/khoa-boi-duong.service.ts` (`findAll`, `findOne`, các chỗ còn gọi `getKhoaIdsTheoDoi`)
- Modify: `backend/src/khoa-boi-duong/dto/query-khoa-boi-duong.dto.ts` (`don_vi_dat_hang_id?`)
- Test: `backend/test/khoa-boi-duong.e2e-spec.ts`

**Interfaces:**
- Consumes: `getKhoaIdsXemDuoc`, `getHocVienScopeTrongKhoa` (Task 2).
- Produces: `GET /khoa-boi-duong/:id` trả thêm `pham_vi_hoc_vien: 'toan_bo' | 'don_vi'`; `lop_hoc[].si_so` chỉ đếm `dang_ky_hoc` của học viên trong `getHocVienScopeTrongKhoa`.

- [ ] **Step 1: Viết e2e fail** — fixture: Sở A (cây: Phòng P1 → Trường T1, T2), Sở B (Trường T3); khóa K1 đặt bởi Sở A có học viên T1, T3; khóa K2 đặt bởi đơn vị khác X có học viên T1; khóa K3 đặt bởi T2, chưa có học viên:
  - Sở A list → {K1, K2, K3}; `GET /K1` → `pham_vi_hoc_vien='toan_bo'`, sĩ số tính cả T3; `GET /K2` → `'don_vi'`, sĩ số chỉ T1.
  - Sở B list → {K1}; `GET /K1` → `'don_vi'`, sĩ số chỉ T3.
  - T1 list → {K1, K2}; `GET /K3` → 403.
  - T2 list → {K3}; `GET /K3` → `'toan_bo'`.
  - P1 list → {K1, K2, K3}.
  - Sở B `?don_vi_dat_hang_id=<Sở A>` → 200, chỉ {K1}; Sở B `?don_vi_dat_hang_id=<X>` → 200, rỗng.
  - Quản trị đổi K2 sang Sở B → Sở B list có K2, `GET /K2` → `'toan_bo'`.
  - Học viên list vẫn chỉ khóa `da_duyet` (không đổi).
- [ ] **Step 2:** Run `npm run test:e2e -- khoa-boi-duong` → FAIL.
- [ ] **Step 3:** Implement: `findAll` lọc `id ∈ getKhoaIdsXemDuoc` (khi không `'ALL'`), `don_vi_dat_hang_id` là bộ lọc thuần; `findOne` 403 nếu ngoài tập, tính `pham_vi_hoc_vien` và sĩ số theo scope.
- [ ] **Step 4:** Run `npm run test:e2e && npm test` → PASS.
- [ ] **Step 5:** Commit `feat(khoa): pham vi xem khoa theo R1/R2, tra pham_vi_hoc_vien` + push.

### Task 5: Báo cáo theo khóa theo R1/R2

**Files:**
- Modify: `backend/src/bao-cao/bao-cao.service.ts` (`tongHopTheoKhoa` ~L201, `baoCaoVanHanh` ~L472-530; nhận `caller` thay vì chỉ `scope` ở nhánh theo khóa)
- Test: `backend/test/bao-cao.e2e-spec.ts`

**Interfaces:**
- Consumes: `getKhoaIdsXemDuoc`, `getHocVienScopeTrongKhoa` (Task 2).

- [ ] **Step 1: Viết e2e fail** (tái dùng fixture kiểu Task 4):
  - `GET /bao-cao/tong-hop?theo=khoa` — Sở A: dòng K1 đếm cả học viên T3; dòng K2 chỉ đếm T1. Sở B: chỉ dòng K1, đếm chỉ T3.
  - `GET /bao-cao/van-hanh` — Sở B không `khoa_id` → chỉ lớp của K1, `si_so` chỉ T3; Sở A `khoa_id=K1` → `si_so` gồm T3; T1 `khoa_id=K3` → 403.
  - `GET /bao-cao/xuat-excel` theo khóa: tiêu đề cột "Đơn vị đặt hàng".
- [ ] **Step 2:** Run `npm run test:e2e -- bao-cao` → FAIL.
- [ ] **Step 3:** Implement: khóa lọc `id ∈ getKhoaIdsXemDuoc`; với mỗi khóa lấy `getHocVienScopeTrongKhoa` rồi lọc `dang_ky_hoc` theo `hoc_vien.don_vi_cong_tac_id` (select thêm field này); bỏ khối "chủ khóa HOẶC theo dõi".
- [ ] **Step 4:** Run `npm run test:e2e && npm test` → PASS.
- [ ] **Step 5:** Commit `feat(bao-cao): bao cao theo khoa ap dung R1/R2` + push.

### Task 6: Migration dữ liệu, xóa `khoa_don_vi_theo_doi`, script kiểm tra

**Files:**
- Create: `scripts/kiem_tra_don_vi_dat_hang.sql` (chỉ đọc)
- Create: `backend/prisma/migrations/20261003130000_don_vi_dat_hang_du_lieu/migration.sql`
- Modify: `backend/prisma/schema.prisma` (xóa model `khoa_don_vi_theo_doi` + quan hệ ngược)
- Modify: `backend/src/auth/scope/scope.service.ts` (+ spec) — xóa `getKhoaIdsTheoDoi`, `collectAncestorIds` nếu không còn dùng
- Modify: `docs/database-ddl.sql`

- [ ] **Step 1:** Viết `kiem_tra_don_vi_dat_hang.sql` trả 3 tập: (a) khóa có đúng 1 đơn vị theo dõi — `ma_khoa`, đơn vị đặt hàng hiện tại, đơn vị sẽ đổi sang; (b) khóa có 0 hoặc ≥2 đơn vị theo dõi — `ma_khoa`, số đơn vị theo dõi; (c) khóa ở `nhap`/`cho_duyet`/`tu_choi`.
- [ ] **Step 2:** Viết migration đúng 3 lệnh spec §7 bước 2–4 (UPDATE từ theo dõi khi `COUNT(*) = 1`, `DROP TABLE khoa_don_vi_theo_doi`, UPDATE trạng thái → `da_duyet`).
- [ ] **Step 3:** Kiểm tra trên DB local: seed 3 khóa (1 theo dõi, 2 theo dõi, 0 theo dõi + `cho_duyet`), chạy script → đúng 3 tập; `npx prisma migrate dev` → khóa 1 đổi đơn vị, khóa 2 giữ nguyên, khóa 3 thành `da_duyet`, bảng theo dõi không còn.
- [ ] **Step 4:** Xóa model + `getKhoaIdsTheoDoi`; run `npm run build && npm test && npm run test:e2e` → PASS; `grep -r "theo_doi\|TheoDoi" backend/src` → 0 kết quả.
- [ ] **Step 5:** Commit `feat(db): chuyen don vi theo doi sang don vi dat hang, xoa bang theo doi` + push.

### Task 7: Frontend — API, mock, danh sách và form tạo khóa

**Files:**
- Modify: `frontend/src/api/types.ts`, `frontend/src/api/khoaBoiDuong.ts` (đổi field; `useDonViChoKhoa` lấy thêm `so_gddt`; xóa `useNopDuyetKhoa`/`useDuyetKhoa`/`useThemDonViTheoDoi`/`useXoaDonViTheoDoi`; type chi tiết khóa có `pham_vi_hoc_vien`)
- Modify: `frontend/src/test/mocks/db.ts`, `frontend/src/test/mocks/handlers.ts`
- Modify: `frontend/src/pages/Admin/AdminKhoaBoiDuong.tsx`
- Test: `frontend/src/pages/Admin/AdminKhoaBoiDuong.test.tsx`

**Interfaces:**
- Produces: `KhoaBoiDuong.don_vi_dat_hang_id: string`; `KhoaChiTiet.pham_vi_hoc_vien: 'toan_bo' | 'don_vi'`; `useDonViChoKhoa()` trả đơn vị loại `so_gddt | khac | truong`.

- [ ] **Step 1: Viết test fail** (dùng cách giả lập vai trò đang có trong file test):
  - Quản trị: thấy "+ Tạo khóa mới"; modal có Select "Đơn vị đặt hàng" bắt buộc, nút "Tạo khóa" disabled khi chưa chọn; không còn chữ "Đơn vị tổ chức" và "Bắt buộc khi tạo khóa với tài khoản Quản trị hệ thống".
  - API trả 400 `fields: [{ field: 'don_vi_dat_hang_id', message: 'Sai loại đơn vị' }]` → hiện dưới Select.
  - Vai trò `so_gddt` / `truong`: không thấy "+ Tạo khóa mới".
  - Bộ lọc trạng thái chỉ có "Tất cả trạng thái", "Đang mở", "Đóng đăng ký"; cột bảng "Đơn vị đặt hàng".
- [ ] **Step 2:** Run `npx vitest run src/pages/Admin/AdminKhoaBoiDuong.test.tsx` (trong `frontend/`) → FAIL.
- [ ] **Step 3:** Implement; Select nhóm theo loại theo thứ tự "Sở GD&ĐT", "Đơn vị khác", "Trường" (Mantine `data` dạng `{ group, items }`); bỏ `donViKhac` và nhánh tự điền.
- [ ] **Step 4:** Run `npx vitest run && npx tsc --noEmit` → PASS (các file còn tham chiếu hook đã xóa sửa ở Task 8 — nếu tsc lỗi ở `AdminKhoaChiTiet.tsx`, gộp Task 8 vào cùng commit).
- [ ] **Step 5:** Commit `feat(admin): don vi dat hang o danh sach va form tao khoa` + push.

### Task 8: Frontend — chi tiết khóa chỉ xem cho Sở/Phòng/Trường

**Files:**
- Modify: `frontend/src/pages/Admin/AdminKhoaChiTiet.tsx` (header ~L785; nút duyệt ~L794-803; tab + modal theo dõi ~L686-714, 815, 1174-1215, 1661-1720; hằng số L67-68)
- Test: `frontend/src/pages/Admin/AdminKhoaChiTiet.test.tsx`

**Interfaces:**
- Consumes: `KhoaChiTiet.pham_vi_hoc_vien`, `don_vi_dat_hang_id` (Task 7).

- [ ] **Step 1: Viết test fail:**
  - Header hiện "Đặt hàng: Sở GD&ĐT An Giang" và "Tổ chức: Trường ĐHSP TP.HCM".
  - Không có nút "Nộp duyệt", "✓ Duyệt khóa", tab "Đơn vị theo dõi" (mọi vai trò).
  - Vai trò `truong`: không có nút thêm giai đoạn/lớp/cụm/nhân sự, import, cập nhật kết quả, sửa khóa; quản trị thì có.
  - `pham_vi_hoc_vien='don_vi'` → hiện "Bạn đang xem các học viên thuộc đơn vị của mình trong khóa này."; `'toan_bo'` → không hiện.
  - Quản trị: form sửa khóa có Select "Đơn vị đặt hàng".
- [ ] **Step 2:** Run `npx vitest run src/pages/Admin/AdminKhoaChiTiet.test.tsx` → FAIL.
- [ ] **Step 3:** Implement: thay 2 hằng số bằng `const laQuanTri = nguoiDung?.vai_tro === 'quan_tri'`; xóa code duyệt/theo dõi.
- [ ] **Step 4:** Run `npx vitest run && npx tsc --noEmit && npm run build` → PASS.
- [ ] **Step 5:** Commit `feat(admin): chi tiet khoa chi xem cho So/Phong/Truong` + push.

### Task 9: Tài liệu

**Files:**
- Modify: `docs/api-contract.md` (mục 3 khóa bồi dưỡng: field, xóa 4 endpoint, bảng "Ai gọi", R1/R2, `pham_vi_hoc_vien`; mục báo cáo)
- Modify: `docs/mo-rong-nls-an-giang.md` (đánh dấu T2/QĐ2 "đã thay thế bởi ADR 0001"), `docs/validation-checklist.md` (rule `don_vi_dat_hang_id`)
- Create: `docs/adr/0001-don-vi-dat-hang.md` (bối cảnh, quyết định D1–D6, hệ quả)
- Modify/Create: `CONTEXT.md` (thuật ngữ "Đơn vị đặt hàng", "Đơn vị tổ chức (HCMUE)", "R1/R2")

- [ ] **Step 1:** Viết/sửa các file trên; `grep -rn "don_vi_to_chuc\|nop-duyet\|don-vi-theo-doi" docs/` → chỉ còn trong ADR/ghi chú lịch sử.
- [ ] **Step 2:** Commit `docs: don vi dat hang (ADR 0001), cap nhat api-contract` + push.

### Triển khai VPS (sau khi mọi task PASS — người dùng thực hiện/duyệt)

> **Sửa 2026-10-03 (fix #1 final-review):** thứ tự dưới đây đã đúng với cách
> `scripts/kiem_tra_don_vi_dat_hang.sql` hoạt động — script dùng tên cột/bảng
> CŨ (`don_vi_to_chuc_id`, `khoa_don_vi_theo_doi`) nên PHẢI chạy TRƯỚC
> `prisma migrate deploy` (chạy sau sẽ lỗi vì cột đã đổi tên); việc gán tay
> các khóa ở tập (b) thì ngược lại PHẢI làm SAU migrate (cột lúc đó mới mang
> tên `don_vi_dat_hang_id`). Xem thêm ADR 0001 mục "Triển khai".

- [ ] Sao lưu DB vào `backend/backups/`.
- [ ] Chạy `scripts/kiem_tra_don_vi_dat_hang.sql` trên DB thật **chưa migrate**, gửi kết quả cho người dùng duyệt — đặc biệt tập (b) (0 hoặc ≥2 đơn vị theo dõi).
- [ ] `prisma migrate deploy` (áp cả 2 migration `..._rename` + `..._du_lieu` trong 1 lần chạy).
- [ ] Với các khóa ở tập (b) mà đơn vị đặt hàng cần sửa lại — gán tay bằng `UPDATE khoa_boi_duong SET don_vi_dat_hang_id = '<id đơn vị đúng>' WHERE id = '<id khóa>'` (chạy sau migrate).
- [ ] Deploy backend và frontend cùng lúc.
