# Tài khoản đơn vị — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quản trị cấp tài khoản quản lý (1 tài khoản / đơn vị) cho Sở GD&ĐT, Phòng VHXH, Trường — tạo lẻ hoặc nhập Excel, mật khẩu tạm hoặc link kích hoạt qua email.

**Architecture:** Mở rộng thành phần sẵn có: `nguoi_dung` (không bảng mới), `token_xac_thuc` (thêm `nguoi_dung_id`), khung import (loại `tai_khoan_don_vi`), trang `/dat-lai-mat-khau`. Logic nghiệp vụ trong `TaiKhoanDonViService` (module `nguoi-dung`); tạo token/email qua hàm public mới của `AuthService`. Frontend: trang `/admin/nguoi-dung` chỉ Quản trị.

**Tech Stack:** NestJS + Prisma (PostgreSQL), Jest unit + e2e; React 18 + Mantine + TanStack Query, Vitest + MSW; exceljs.

**Spec:** `docs/superpowers/specs/2026-10-03-tai-khoan-don-vi-design.md`

## Global Constraints

- Vai trò cấp được: `so_gddt`, `phong_vhxh`, `truong`, khớp `don_vi_cong_tac.loai_don_vi` cùng tên; `khac` không cấp.
- 1 tài khoản / đơn vị — unique index `uq_nguoi_dung_don_vi_quan_ly ON nguoi_dung(don_vi_id) WHERE vai_tro IN ('so_gddt','phong_vhxh','truong')`.
- Tên đăng nhập tài khoản đơn vị: regex `^[a-z0-9][a-z0-9._-]{2,49}$`, lưu chữ thường; mặc định `lower(ma_don_vi)`; trùng kiểm tra **không phân biệt hoa/thường** trên toàn `nguoi_dung`.
- Email tùy chọn, lưu chữ thường; chỉ `quan_tri` bắt buộc email.
- Mật khẩu tạm: 10 ký tự, bảng chữ `ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789` (bỏ `0 O o 1 l I L`), ≥1 chữ và ≥1 số; chỉ trả trong response; `phai_doi_mat_khau = true`.
- Token `kich_hoat_tai_khoan`: hạn 72 giờ, dùng 1 lần; `dat_lai_mat_khau` giữ 30 phút.
- Message lỗi nguyên văn: "Đơn vị đã có tài khoản", "Loại đơn vị không được cấp tài khoản", "Không hợp lệ", "Chỉ gồm chữ thường không dấu, số, . _ - (3–50 ký tự)", "Tên đăng nhập đã được dùng", "Email không hợp lệ", "Email đã được dùng", "Cần email để gửi link kích hoạt".
- Chữ UI nguyên văn: "Tài khoản đơn vị", "+ Tạo tài khoản", "Nhập từ Excel", "Chưa đăng nhập", "Mật khẩu chỉ hiện một lần. Đóng cửa sổ này sẽ không xem lại được.", "Người dùng sẽ phải đăng nhập bằng tên mới", "Sao chép cả hai" → `Tài khoản: <x> / Mật khẩu: <y>`.
- Email tiêu đề `[HCMUE-BDNLS] Kích hoạt tài khoản`.
- Mọi endpoint `/nguoi-dung/don-vi*` là `@Roles('quan_tri')`.
- Mật khẩu tạm / file mật khẩu không bao giờ ghi log, không lưu đĩa, không cache TanStack (`gcTime: 0`).
- Sai lệch có chủ đích so với spec (ghi lại trong ADR 0002):
  - **Không** chạy `UPDATE nguoi_dung SET ten_dang_nhap = lower(...)` cho dữ liệu cũ (spec §7) — tránh đụng ~7.800 tên đăng nhập học viên mà các luồng import MOET có thể tra theo giá trị gốc. Thay bằng: tài khoản đơn vị lưu chữ thường; đăng nhập khớp chính xác **hoặc** `lower(ten_dang_nhap) = lower(input)` khi tài khoản là `so_gddt/phong_vhxh/truong`.
  - Nhãn ô đăng nhập M1 = "Tên đăng nhập, mã định danh hoặc số CCCD" (spec ghi "Tên đăng nhập / Mã định danh" nhưng nhãn hiện tại có CCCD — giữ gợi ý CCCD cho học viên).
- Mỗi commit kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` và push ngay (không force).

## Review Focus

1. Quản trị nhập tên gợi nhớ có chữ hoa/khoảng trắng đầu cuối (`" SGD-AnGiang "`) → được trim + chuyển thường, không báo lỗi định dạng. Test: Task 3 (`chuanHoaTenDangNhap`).
2. Tên gợi nhớ trùng một mã định danh học viên khác hoa/thường → 409, không tạo 2 tài khoản đăng nhập cùng chuỗi. Test: Task 5.
3. Đơn vị bị ngừng hoạt động sau khi đã có tài khoản → tài khoản vẫn đăng nhập theo trạng thái tài khoản (không tự khóa), danh sách vẫn hiển thị. Test: Task 5 (list trả đơn vị `ngung`).
4. File Excel có dòng trống cuối hoặc mã đơn vị có khoảng trắng → bỏ dòng trống, trim mã. Test: Task 6.
5. Đổi email sang rỗng trong khi có link kích hoạt còn hạn → link cũ vẫn dùng được? Không: xóa email ⇒ vô hiệu token `kich_hoat_tai_khoan` chưa dùng. Test: Task 5.

---

### Task 1: DB e2e riêng (`.env.test`)

**Files:**
- Create: `backend/.env.test.example` (DATABASE_URL trỏ `thong_tin_hoc_vien_test`, các biến khác như `.env.example`)
- Modify: `backend/test/setup-e2e-env.ts` (nạp `backend/.env.test` bằng `dotenv` với `override: true` nếu file tồn tại, TRƯỚC khi đặt `SMTP_HOST = ''`)
- Modify: `.gitignore` (thêm `backend/.env.test` nếu chưa bị `*.env*` che)
- Modify: `README.md` hoặc `backend/README` mục chạy e2e: tạo DB test + `DATABASE_URL=… npx prisma migrate deploy`

- [ ] **Step 1:** Tạo `backend/.env.test` local (không commit) trỏ DB `thong_tin_hoc_vien_test`; tạo DB và `prisma migrate deploy` + `npm run seed` vào đó (URL override trong biến môi trường lệnh).
- [ ] **Step 2:** Sửa `setup-e2e-env.ts`; chạy `npx jest --config ./test/jest-e2e.json --runInBand --forceExit test/auth.e2e-spec.ts` → PASS, và kiểm tra bằng truy vấn rằng `thong_tin_hoc_vien` (DB dev) không có bản ghi `e2e-%@test.local` mới sau lượt chạy.
- [ ] **Step 3:** Commit `chore(test): e2e dung DB rieng qua .env.test` + push.

### Task 2: Migration + schema

**Files:**
- Create: `backend/prisma/migrations/<ts>_tai_khoan_don_vi_enum/migration.sql` — `ALTER TYPE loai_token_xac_thuc ADD VALUE 'kich_hoat_tai_khoan'`; `ALTER TYPE loai_danh_muc_import ADD VALUE 'tai_khoan_don_vi'`; `ALTER TYPE loai_su_kien_thong_bao ADD VALUE 'kich_hoat_tai_khoan'`.
- Create: `backend/prisma/migrations/<ts+1>_tai_khoan_don_vi/migration.sql` — cột `token_xac_thuc.nguoi_dung_id uuid NULL REFERENCES nguoi_dung(id) ON DELETE CASCADE` + index `idx_token_xac_thuc_nguoi_dung`; `hoc_vien_id DROP NOT NULL`; `CHECK (num_nonnulls(hoc_vien_id, nguoi_dung_id) = 1)` tên `chk_token_xac_thuc_chu_the`; unique index `uq_nguoi_dung_don_vi_quan_ly`; thay CHECK email (tra tên constraint thật trong migration init) bằng `vai_tro <> 'quan_tri' OR email IS NOT NULL`.
- Modify: `backend/prisma/schema.prisma` (enum values, `token_xac_thuc.nguoi_dung_id` + relation, `hoc_vien_id String?`), `docs/database-ddl.sql`.

- [ ] **Step 1:** Viết 2 migration; `npx prisma migrate dev --create-only` không sinh thêm diff (lưu ý gotcha pg_trgm trong README gốc: nếu Prisma đề xuất DROP INDEX trgm thì bỏ, không trả lời prompt thứ 2).
- [ ] **Step 2:** Áp dụng vào DB test; `npx prisma generate`; `npm run build` → PASS (sửa chỗ TypeScript báo `hoc_vien_id` nay nullable trong `auth.service.ts` bằng guard tường minh, không đổi hành vi).
- [ ] **Step 3:** `npm test` + e2e `auth`, `hoc-vien` từng file → PASS.
- [ ] **Step 4:** Commit `feat(db): tai khoan don vi - token theo nguoi_dung, 1 tai khoan/don vi` + push.

### Task 3: Hàm thuần

**Files:**
- Create: `backend/src/nguoi-dung/tai-khoan-don-vi.util.ts`
- Test: `backend/src/nguoi-dung/tai-khoan-don-vi.util.spec.ts`

**Interfaces — Produces:**
- `sinhMatKhauTam(): string`
- `chuanHoaTenDangNhap(raw: string): string` — trim + lowercase.
- `laTenDangNhapHopLe(s: string): boolean` — regex Global Constraints.
- `vaiTroTheoLoaiDonVi(loai: loai_don_vi): 'so_gddt' | 'phong_vhxh' | 'truong' | null`
- `MAT_KHAU_TAM_KY_TU`, `THOI_HAN_KICH_HOAT_MS = 72 * 60 * 60 * 1000`

- [ ] **Step 1: Test fail:** `sinhMatKhauTam` — length 10, mọi ký tự ∈ bảng chữ, có `/[A-Za-z]/` và `/[0-9]/`, 1000 lần không trùng. `chuanHoaTenDangNhap(' SGD-AnGiang ') === 'sgd-angiang'`. `laTenDangNhapHopLe`: true cho `sgd-angiang`, `tr-ag-032`, `abc`; false cho `ab`, `có-dấu`, `a b`, `-abc`, `'a'.repeat(51)`. `vaiTroTheoLoaiDonVi`: 3 loại → cùng tên; `khac` → null.
- [ ] **Step 2:** `npm test -- tai-khoan-don-vi.util` → FAIL.
- [ ] **Step 3:** Implement (dùng `crypto.randomInt`; nếu chuỗi sinh ra thiếu chữ hoặc số thì sinh lại).
- [ ] **Step 4:** → PASS. Commit `feat(nguoi-dung): ham thuan cho tai khoan don vi` + push.

### Task 4: Auth — token theo người dùng, đăng nhập, quên/đặt lại mật khẩu, email kích hoạt

**Files:**
- Modify: `backend/src/auth/auth.service.ts` (`timTaiKhoanTheoTenDangNhap` ~L70, `quenMatKhau` ~L282, `taoVaGuiTokenDatLaiMatKhau` ~L302, `datLaiMatKhau` ~L350)
- Modify: `backend/src/thong-bao/thong-bao.service.ts` + mẫu email cạnh `mauDatLaiMatKhau` (thêm `mauKichHoatTaiKhoan`)
- Test: `backend/src/auth/auth.service.spec.ts`, `backend/test/auth.e2e-spec.ts`

**Interfaces — Produces:**
- `AuthService.taoTokenChoNguoiDung(nguoiDungId: string, loai: 'kich_hoat_tai_khoan' | 'dat_lai_mat_khau', tx?: Prisma.TransactionClient): Promise<string>` — vô hiệu token chưa dùng cùng loại của người dùng, tạo token mới (hạn theo loại), trả token gốc.
- `AuthService.voHieuTokenNguoiDung(nguoiDungId: string, tx?): Promise<void>` — vô hiệu mọi token chưa dùng của người dùng.
- `ThongBaoService.guiKichHoatTaiKhoan(params: { email: string; hoTen: string; tenDonVi: string; tenDangNhap: string; link: string }): Promise<void>` — qua hàng đợi email, `loaiSuKien: 'kich_hoat_tai_khoan'`, `hocVienId` null.
- Link: `${layFrontendUrl()}/dat-lai-mat-khau?token=<token>`.

- [ ] **Step 1: Test fail (e2e `auth.e2e-spec.ts`)**, fixture: đơn vị `truong` + `nguoi_dung` vai trò `truong` tên `tk-e2e-<suf>` có email, tạo qua Prisma:
  - đăng nhập `TK-E2E-<SUF>` (chữ hoa) đúng mật khẩu → 200.
  - `POST /auth/quen-mat-khau` tên đó → `{ da_gui: true }`, 1 `token_xac_thuc` `dat_lai_mat_khau` có `nguoi_dung_id`; tài khoản đơn vị không email → `{ da_gui: true }`, 0 token.
  - token `kich_hoat_tai_khoan` (tạo bằng `taoTokenChoNguoiDung`) → `POST /auth/dat-lai-mat-khau` → 200, `phai_doi_mat_khau = false`, đăng nhập mật khẩu mới OK; dùng lại → 400 "Liên kết không hợp lệ hoặc đã hết hạn"; token có `het_han_luc` quá khứ → 400.
  - **Hồi quy:** học viên đăng nhập bằng mã định danh + ngày sinh; quên/đặt lại mật khẩu học viên → như các test hiện có (giữ nguyên, phải PASS).
- [ ] **Step 2:** Chạy file e2e → các test mới FAIL.
- [ ] **Step 3:** Implement; đăng nhập: `findFirst({ where: { OR: [ { ten_dang_nhap: input }, { vai_tro: { in: [...] }, ten_dang_nhap: { equals: input, mode: 'insensitive' } }, <nhánh CCCD sẵn có> ] } })`; `datLaiMatKhau` chấp nhận 2 loại token, tìm người dùng theo `nguoi_dung_id ?? hoc_vien_id`.
- [ ] **Step 4:** `npm run build`, `npm test`, e2e `auth`, `hoc-vien`, `thong-bao` từng file → PASS. Commit `feat(auth): token kich hoat va dat lai mat khau cho tai khoan don vi` + push.

### Task 5: `TaiKhoanDonViService` + API `/nguoi-dung/don-vi`

**Files:**
- Create: `backend/src/nguoi-dung/tai-khoan-don-vi.service.ts`, `backend/src/nguoi-dung/tai-khoan-don-vi.controller.ts`, DTO trong `backend/src/nguoi-dung/dto/` (`tao-tai-khoan-don-vi.dto.ts`, `sua-tai-khoan-don-vi.dto.ts`, `query-tai-khoan-don-vi.dto.ts`, `query-don-vi-chua-cap.dto.ts`)
- Modify: `backend/src/nguoi-dung/nguoi-dung.module.ts` (imports `AuthModule`, `ThongBaoModule`; providers/exports `TaiKhoanDonViService`)
- Test: `backend/test/tai-khoan-don-vi.e2e-spec.ts`

**Interfaces — Consumes:** Task 3 utils; Task 4 `taoTokenChoNguoiDung`, `voHieuTokenNguoiDung`, `guiKichHoatTaiKhoan`.
**Produces:**
- `TaiKhoanDonViService.taoTaiKhoan(dto: { don_vi_id: string; ten_dang_nhap?: string; ho_ten?: string; email?: string; cach_cap?: 'mat_khau_tam' | 'email' }, caller: AuthenticatedUser, tx?: Prisma.TransactionClient): Promise<{ tai_khoan: TaiKhoanDonViView; mat_khau_tam?: string }>`
- `kiemTraDuLieuTao(dto, opts?: { boQuaTrungTrongFile?: Set<string> }): Promise<FieldMessage[]>` — dùng chung cho import (Task 6).
- `TaiKhoanDonViView = { id, ten_dang_nhap, ho_ten, email, vai_tro, trang_thai, dang_nhap_lan_cuoi, don_vi: { id, ma_don_vi, ten_don_vi, loai_don_vi, trang_thai } }`
- Controller `@Controller('nguoi-dung/don-vi')`, `@Roles('quan_tri')` ở class: `GET /`, `GET /chua-cap`, `POST /`, `PATCH /:id`, `POST /:id/cap-mat-khau-tam`, `POST /:id/gui-email-kich-hoat`.

- [ ] **Step 1: Test fail (e2e)** — fixture: Sở S, Phòng P (con S), Trường T (con P), đơn vị `khac` X, Trường ngừng N, Trường T2, học viên có `ten_dang_nhap` `hv-<suf>`; token quan_tri và token truong/so_gddt/phong_vhxh:
  - `POST` {don_vi_id: S} → 201, `ten_dang_nhap = lower(ma_don_vi)`, `vai_tro = so_gddt`, `ho_ten = ten_don_vi`, có `mat_khau_tam` 10 ký tự; đăng nhập được, `phai_doi_mat_khau = true`; đổi mật khẩu → `GET /khoa-boi-duong` 200.
  - `POST` {don_vi_id: P, ten_dang_nhap: ' Phong-Test ', email: 'A@B.VN', cach_cap: 'email'} → 201, không có `mat_khau_tam`, `ten_dang_nhap = 'phong-test'`, `email = 'a@b.vn'`, 1 dòng `hang_doi_email` tiêu đề `[HCMUE-BDNLS] Kích hoạt tài khoản`; token trong DB dùng được qua `/auth/dat-lai-mat-khau`.
  - Lỗi: lại S → 409 `don_vi_id` "Đơn vị đã có tài khoản"; X → 400 "Loại đơn vị không được cấp tài khoản"; N → 400 "Không hợp lệ"; `ten_dang_nhap: 'a b'` → 400 message định dạng; `ten_dang_nhap: 'HV-<SUF>'` → 409 "Tên đăng nhập đã được dùng"; email trùng → 409 "Email đã được dùng"; `cach_cap: 'email'` không email → 400 "Cần email để gửi link kích hoạt".
  - Mỗi endpoint với token truong/so_gddt/phong_vhxh → 403.
  - `cap-mat-khau-tam` khi đang có token kích hoạt còn hạn → token đó bị vô hiệu; `gui-email-kich-hoat` → mật khẩu tạm cũ không đăng nhập được.
  - `PATCH {trang_thai: 'ngung'}` → đăng nhập bị từ chối, JWT cũ gọi `GET /auth/toi` → 401; mở lại → đăng nhập OK.
  - `PATCH {ten_dang_nhap: 'so-moi'}` → tên cũ không đăng nhập được, `SO-MOI` được.
  - `PATCH {email: ''}` khi có token kích hoạt còn hạn → `email = null`, token bị vô hiệu (Review Focus 5).
  - `GET /` lọc `vai_tro=truong`, `da_dang_nhap=false`, `q=<mã>` đúng; đơn vị của tài khoản bị chuyển `ngung` vẫn xuất hiện với `don_vi.trang_thai = 'ngung'` (Review Focus 3). `GET /chua-cap?loai_don_vi=truong` chứa T2, không chứa T (đã cấp) và N.
  - Tài khoản Sở S, nếu S là đơn vị đặt hàng của một khóa có học viên → `GET /khoa-boi-duong/:id` → `pham_vi_hoc_vien = 'toan_bo'`.
- [ ] **Step 2:** Chạy file → FAIL.
- [ ] **Step 3:** Implement. Tạo tài khoản bằng `cach_cap = email`: `mat_khau_hash` = bcrypt của `sinhMatKhauTam()` bỏ đi, `phai_doi_mat_khau = true`. Mỗi lần cấp mật khẩu tạm / gửi link: 1 dòng `nhat_ky_dat_lai_mat_khau { nguoi_dung_id, thuc_hien_boi: caller.id }`. Bắt lỗi unique Prisma (P2002) → 409 đúng field. Kiểm tra trùng tên đăng nhập bằng `mode: 'insensitive'`.
- [ ] **Step 4:** `npm run build`, `npm test`, e2e `tai-khoan-don-vi`, `auth`, `nguoi-dung` → PASS. Commit `feat(nguoi-dung): API tai khoan don vi` + push.

### Task 6: Import `tai_khoan_don_vi`

**Files:**
- Modify: `backend/src/import/import.service.ts` (`getColumns`, `getColumnNotes`, `readRows` switch, `buildDto` switch, `commitRow`, `xacNhan` ~L341-472), `backend/src/import/import.types.ts`, `backend/src/import/import.controller.ts` (`xacNhan` ~L87), `backend/src/import/import.module.ts` (import `NguoiDungModule`)
- Test: `backend/test/import-tai-khoan-don-vi.e2e-spec.ts`

**Interfaces — Consumes:** Task 5 `taoTaiKhoan(dto, caller, tx)`, `kiemTraDuLieuTao`.
**Produces:**
- Cột: `ma_don_vi` (bắt buộc), `ten_dang_nhap`, `ho_ten`, `email`.
- `ImportService.xacNhan(id, caller)` trả `{ nhat_ky: nhat_ky_import; file_mat_khau?: Buffer }`; controller: có `file_mat_khau` → `@Res({ passthrough: true })` đặt `Content-Type` xlsx + `Content-Disposition: attachment; filename="mat-khau-tam-<id>.xlsx"` + header `X-So-Dong-Thanh-Cong`, trả `StreamableFile`; không có → JSON `nhat_ky` như cũ.
- File: sheet "Mật khẩu tạm", cột "Mã đơn vị", "Tên đơn vị", "Tên đăng nhập", "Mật khẩu tạm", "Cách cấp" (giá trị "Mật khẩu tạm" | "Email kích hoạt"); chỉ dòng không email có mật khẩu.

- [ ] **Step 1: Test fail (e2e)**: file 5 dòng (T1 không email; T2 có email; P1 với `ten_dang_nhap` `phong-x`; dòng mã không tồn tại; dòng trùng mã T1) + 1 dòng trống cuối + mã có khoảng trắng `' <ma T3> '`:
  - `POST /import/tai_khoan_don_vi` → lỗi đúng dòng (không tồn tại, trùng trong file), dòng trống bị bỏ qua, mã có khoảng trắng hợp lệ (Review Focus 4).
  - `POST /import/:id/xac-nhan` → content-type xlsx; đọc bằng exceljs (dùng binary parser như `bao-cao.e2e-spec.ts`): chứa T1 và T3 có mật khẩu, T2 ghi "Email kích hoạt" không mật khẩu; mật khẩu T1 đăng nhập được; 1 dòng `hang_doi_email` cho T2; `nhat_ky_import.so_dong_thanh_cong = 4`.
  - Xác nhận lần 2 → 409.
  - Các loại import khác: `xac-nhan` vẫn trả JSON (chạy lại e2e `import`).
  - Thư mục `storage/import/<id>/` không có file mật khẩu.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Implement; mỗi dòng gọi `taoTaiKhoan` trong transaction của dòng; gom mật khẩu vào mảng trong bộ nhớ; `redactChoFileLoi` không cần (không có cột mật khẩu đầu vào).
- [ ] **Step 4:** build, unit, e2e `import-tai-khoan-don-vi`, `import`, `import-moet` → PASS. Commit `feat(import): nhap tai khoan don vi tu Excel` + push.

### Task 7: Frontend — trang Người dùng

**Files:**
- Create: `frontend/src/api/taiKhoanDonVi.ts`, `frontend/src/pages/Admin/ModalMatKhauTam.tsx`, `frontend/src/auth/RequireQuanTri.tsx`
- Modify: `frontend/src/pages/Admin/AdminNguoiDung.tsx` (thay placeholder), `frontend/src/pages/Admin/menu.ts` (thêm `chiQuanTri?: boolean`, mục Người dùng `chiQuanTri: true`, bỏ `sapRaMat`), `frontend/src/pages/Admin/AdminSidebar.tsx` (lọc mục `chiQuanTri` theo `useToi()`), `frontend/src/router.tsx` (bọc route `/admin/nguoi-dung` bằng `RequireQuanTri`), `frontend/src/api/types.ts`, `frontend/src/test/mocks/{db,handlers}.ts`
- Test: `frontend/src/pages/Admin/AdminNguoiDung.test.tsx`

**Interfaces — Produces:** hooks `useDanhSachTaiKhoanDonVi(params)`, `useDonViChuaCap(params)`, `useTaoTaiKhoanDonVi()`, `useSuaTaiKhoanDonVi()`, `useCapMatKhauTam()`, `useGuiEmailKichHoat()` (mutations có `gcTime: 0`); `RequireQuanTri` redirect `/admin/tong-quan` khi `vai_tro !== 'quan_tri'`.

- [ ] **Step 1: Test fail:**
  - `so_gddt`: sidebar không có "Người dùng"; vào `/admin/nguoi-dung` → về Tổng quan. `quan_tri`: có.
  - Bảng hiện cột Đơn vị · Loại · Tên đăng nhập · Người phụ trách · Email · Lần đăng nhập cuối · Trạng thái; tài khoản `dang_nhap_lan_cuoi = null` hiện "Chưa đăng nhập"; đổi bộ lọc gửi đúng query.
  - Modal tạo: Select chỉ đơn vị từ `/chua-cap`, nhóm "Sở GD&ĐT"/"Phòng VHXH"/"Trường"; chọn đơn vị → ô tên đăng nhập điền `lower(ma_don_vi)`; radio "Gửi email kích hoạt" disabled khi email trống; API 409 `ten_dang_nhap` → lỗi dưới ô.
  - Tạo thành công (mật khẩu tạm) → modal hiện mật khẩu + cảnh báo nguyên văn; "Sao chép cả hai" ghi clipboard `Tài khoản: <x> / Mật khẩu: <y>`; đóng rồi mở lại danh sách → không còn mật khẩu trong DOM.
  - Menu ⋯: "Gửi email kích hoạt" chỉ hiện khi có email; "Cấp mật khẩu tạm" hỏi xác nhận trước khi gọi API; sửa tên đăng nhập hiện "Người dùng sẽ phải đăng nhập bằng tên mới".
- [ ] **Step 2:** `npx vitest run src/pages/Admin/AdminNguoiDung.test.tsx` → FAIL.
- [ ] **Step 3:** Implement theo spec §5.
- [ ] **Step 4:** `npx vitest run`, `npx tsc --noEmit`, `npm run build` → PASS. Commit `feat(admin): trang Nguoi dung - tai khoan don vi` + push.

### Task 8: Frontend — nhập Excel loại tài khoản + nhãn đăng nhập

**Files:**
- Modify: `frontend/src/api/client.ts` (`apiFetchBlob(path: string, init?: RequestInit)`), `frontend/src/api/nhapDuLieu.ts` (xác nhận loại `tai_khoan_don_vi` trả Blob), `frontend/src/pages/Admin/AdminNhapDuLieu.tsx` (`NHAN_LOAI_IMPORT.tai_khoan_don_vi = 'Tài khoản đơn vị'`; đọc `?loai=`; xác nhận loại này → `taiFileTuBlob(blob, 'mat-khau-tam-<id>.xlsx')` ngay, sau đó refetch `GET /import/:id` hiện tóm tắt + nút "Tải file mật khẩu tạm" dùng Blob giữ trong state), `frontend/src/api/types.ts` (`LoaiDanhMucImport`), `frontend/src/pages/M1/DangNhap.tsx:126` (nhãn "Tên đăng nhập, mã định danh hoặc số CCCD"), nút "Nhập từ Excel" trong `AdminNguoiDung.tsx` → `/admin/nhap-du-lieu?loai=tai_khoan_don_vi`
- Test: `frontend/src/pages/Admin/AdminNhapDuLieu.test.tsx`, `frontend/src/pages/M1/DangNhap.test.tsx`

- [ ] **Step 1: Test fail:** `/admin/nhap-du-lieu?loai=tai_khoan_don_vi` chọn sẵn "Tài khoản đơn vị"; xác nhận → `URL.createObjectURL` được gọi với Blob, tóm tắt hiện; loại khác vẫn nhận JSON như cũ; M1 có label "Tên đăng nhập, mã định danh hoặc số CCCD".
- [ ] **Step 2:** → FAIL. **Step 3:** Implement. **Step 4:** `npx vitest run`, `npx tsc --noEmit`, `npm run build` → PASS. Commit `feat(admin): nhap tai khoan don vi tu Excel, nhan dang nhap` + push.

### Task 9: Tài liệu

**Files:** `docs/api-contract.md` (mục nguoi-dung, auth quên/đặt lại mật khẩu + đăng nhập, import loại mới + response xlsx), `docs/validation-checklist.md` (rule tên đăng nhập, email, 1 TK/đơn vị), `CONTEXT.md` (thuật ngữ "Tài khoản đơn vị", "Mật khẩu tạm", "Link kích hoạt"), Create `docs/adr/0002-tai-khoan-don-vi.md` (A1–A7 + 2 sai lệch ở Global Constraints + rủi ro JWT spec §8), `docs/database-ddl.sql` (nếu Task 2 chưa đủ).

- [ ] **Step 1:** Viết/sửa; đối chiếu với code thật (controller, DTO, migration).
- [ ] **Step 2:** Commit `docs: tai khoan don vi (ADR 0002), cap nhat api-contract` + push.

### Triển khai VPS (sau khi merge — người dùng thực hiện)

- [ ] `bash scripts/vps/06-deploy.sh` (tự sao lưu + migrate; không cần script kiểm tra trước).
- [ ] Tạo tài khoản Sở An Giang ở `/admin/nguoi-dung`, gửi mật khẩu tạm, đăng nhập thử.
- [ ] (Tùy chọn) Điền SMTP thật trong `backend/.env` VPS để link kích hoạt gửi được.
