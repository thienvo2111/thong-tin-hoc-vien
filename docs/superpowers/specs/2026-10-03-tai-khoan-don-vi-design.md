# Đặc tả: Cấp tài khoản quản lý cho Sở, Phòng VHXH, Trường

- Ngày: 2026-10-03
- Trạng thái: chờ duyệt
- Liên quan: ADR 0001 (Đơn vị đặt hàng, R1/R2) — tài khoản cấp ở đây xem dữ liệu theo R1/R2.

## 1. Bối cảnh và mục tiêu

Hệ thống đã có vai trò `so_gddt`, `phong_vhxh`, `truong` và phạm vi xem R1/R2, nhưng **chưa có cách tạo tài khoản** cho các vai trò này: module `nguoi-dung` chỉ có tìm kiếm và đặt lại mật khẩu học viên; trang admin "Người dùng" đang là placeholder.

Tiêu chí hoàn thành:

1. Quản trị tạo được tài khoản cho 1 đơn vị (form) hoặc hàng loạt (Excel), không bắt buộc có email.
2. Tài khoản đăng nhập bằng mã đơn vị hoặc tên gợi nhớ; nhận mật khẩu tạm (Quản trị tự gửi) hoặc link kích hoạt qua email.
3. Quản trị sửa, khóa/mở, cấp lại mật khẩu tạm, gửi lại link cho từng tài khoản.
4. Luồng đăng nhập / quên mật khẩu của học viên không đổi hành vi.

## 2. Quyết định đã chốt

| # | Quyết định |
|---|---|
| A1 | Cấp tài khoản cho 3 loại đơn vị: `so_gddt`, `phong_vhxh`, `truong`. Không cấp cho `khac`. |
| A2 | Đúng **1 tài khoản / đơn vị**. Đổi người phụ trách = sửa chính tài khoản đó. |
| A3 | Hai cách tạo: form tạo lẻ + nhập Excel hàng loạt (khung import sẵn có). |
| A4 | Email **không bắt buộc**. Mặc định cấp **mật khẩu tạm**; có email thì có thể chọn **link kích hoạt** (72 giờ, dùng 1 lần). Hai cách loại trừ nhau. |
| A5 | Tên đăng nhập = mã đơn vị (mặc định) hoặc **tên gợi nhớ** do Quản trị đặt (vd. `sgd-angiang`); lưu chữ thường, đăng nhập không phân biệt hoa/thường. |
| A6 | Import Excel: dòng không email → mật khẩu tạm trả trong **file Excel kết quả tải 1 lần** (không lưu trên server); dòng có email → link kích hoạt qua hàng đợi email. |
| A7 | Phương án 1: mở rộng thành phần sẵn có (`nguoi_dung`, `token_xac_thuc`, khung import, trang `/dat-lai-mat-khau`), không làm module song song. |

## 3. Dữ liệu

### 3.1 Tài khoản đơn vị (bảng `nguoi_dung`, không thêm bảng)

| Cột | Giá trị |
|---|---|
| `vai_tro` | theo `don_vi_cong_tac.loai_don_vi`: `so_gddt`→`so_gddt`, `phong_vhxh`→`phong_vhxh`, `truong`→`truong` |
| `don_vi_id` | đơn vị được cấp |
| `ten_dang_nhap` | tên gợi nhớ nếu có, ngược lại `lower(ma_don_vi)`; luôn chữ thường |
| `ho_ten` | người phụ trách; trống → `ten_don_vi` |
| `email` | tùy chọn, unique (như hiện tại), lưu chữ thường |
| `mat_khau_hash` | lúc tạo bằng link: hash của chuỗi ngẫu nhiên không ai biết |
| `phai_doi_mat_khau` | `true` khi cấp mật khẩu tạm; `false` sau khi đặt qua link hoặc đổi mật khẩu |

Quy tắc:

- Tên đăng nhập: regex `^[a-z0-9][a-z0-9._-]{2,49}$` (3–50 ký tự, chữ thường không dấu, số, `.`, `_`, `-`), unique trên toàn bảng `nguoi_dung` (kể cả học viên).
- Đơn vị phải `trang_thai = 'active'` và `loai_don_vi ∈ {so_gddt, phong_vhxh, truong}`.
- "Đã đăng nhập" ⇔ `dang_nhap_lan_cuoi IS NOT NULL` (không thêm cột).
- Khóa tài khoản = `trang_thai = 'ngung'`; `JwtAuthGuard` đã từ chối user không `active` ở mỗi request (`jwt-auth.guard.ts:53`) nên phiên đang mở bị chặn ngay.

### 3.2 Token (bảng `token_xac_thuc`)

- Thêm cột `nguoi_dung_id uuid NULL REFERENCES nguoi_dung(id) ON DELETE CASCADE`, index.
- `hoc_vien_id` → nullable.
- `CHECK (num_nonnulls(hoc_vien_id, nguoi_dung_id) = 1)`.
- Enum `loai_token_xac_thuc` thêm `kich_hoat_tai_khoan` (hạn 72 giờ). `dat_lai_mat_khau` giữ nguyên hạn.
- Token vẫn băm SHA-256; tạo token mới vô hiệu mọi token chưa dùng cùng loại của cùng chủ thể.

### 3.3 Mật khẩu tạm

- Sinh ngẫu nhiên 10 ký tự từ bảng chữ không gây nhầm (bỏ `0 O o 1 l I`), có ít nhất 1 chữ và 1 số; đạt quy tắc độ phức tạp hiện có (`AuthService.kiemTraDoPhucTapMatKhauMoi`).
- Chỉ trả trong response tạo/cấp; DB chỉ lưu bcrypt hash; `phai_doi_mat_khau = true`.
- Cấp mật khẩu tạm ⇒ vô hiệu mọi token `kich_hoat_tai_khoan`/`dat_lai_mat_khau` chưa dùng của tài khoản. Gửi link ⇒ đặt `mat_khau_hash` thành hash ngẫu nhiên mới (vô hiệu mật khẩu tạm cũ).
- Mỗi lần cấp mật khẩu tạm / gửi link ghi 1 dòng `nhat_ky_dat_lai_mat_khau` (`nguoi_dung_id`, `thuc_hien_boi`).

### 3.4 Ràng buộc DB

- Unique một phần: `CREATE UNIQUE INDEX uq_nguoi_dung_don_vi_quan_ly ON nguoi_dung(don_vi_id) WHERE vai_tro IN ('so_gddt','phong_vhxh','truong')`.
- Nới CHECK email: chỉ `quan_tri` bắt buộc email (thay `vai_tro = 'hoc_vien' OR email IS NOT NULL` bằng `vai_tro <> 'quan_tri' OR email IS NOT NULL`).
- `chk_nguoi_dung_scope` giữ nguyên (đã yêu cầu `don_vi_id NOT NULL` cho 3 vai trò này).

## 4. API (tất cả `@Roles('quan_tri')`, module `nguoi-dung`)

| Endpoint | Mô tả |
|---|---|
| `GET /nguoi-dung/don-vi` | Phân trang (`page`, `page_size`). Lọc `vai_tro`, `trang_thai`, `da_dang_nhap` (true/false), `q` (tên/mã đơn vị, tên đăng nhập, email). Dòng: `id, ten_dang_nhap, ho_ten, email, vai_tro, trang_thai, dang_nhap_lan_cuoi, don_vi: { id, ma_don_vi, ten_don_vi, loai_don_vi }`. |
| `GET /nguoi-dung/don-vi/chua-cap` | Đơn vị active loại hợp lệ chưa có tài khoản; lọc `loai_don_vi`, `q`; tối đa 50 dòng. |
| `POST /nguoi-dung/don-vi` | Body `{ don_vi_id, ten_dang_nhap?, ho_ten?, email?, cach_cap: 'mat_khau_tam' \| 'email' }` (mặc định `mat_khau_tam`). 201 → tài khoản + `mat_khau_tam` (chỉ khi `cach_cap = mat_khau_tam`). |
| `PATCH /nguoi-dung/don-vi/:id` | `{ ten_dang_nhap?, ho_ten?, email?, trang_thai? }`. Email rỗng `""` = xóa email. |
| `POST /nguoi-dung/don-vi/:id/cap-mat-khau-tam` | → `{ ten_dang_nhap, mat_khau_tam }`. |
| `POST /nguoi-dung/don-vi/:id/gui-email-kich-hoat` | → `{ da_gui: true }`; 400 nếu không có email. |

Lỗi (`{ error: { code, message, fields } }`):

| Trường hợp | Mã | field / message |
|---|---|---|
| Đơn vị đã có tài khoản | 409 CONFLICT | `don_vi_id` / "Đơn vị đã có tài khoản" |
| Đơn vị không tồn tại / ngừng / loại không hợp lệ | 400 | `don_vi_id` / "Không hợp lệ" hoặc "Loại đơn vị không được cấp tài khoản" |
| Tên đăng nhập sai định dạng | 400 | `ten_dang_nhap` / "Chỉ gồm chữ thường không dấu, số, . _ - (3–50 ký tự)" |
| Tên đăng nhập trùng | 409 | `ten_dang_nhap` / "Tên đăng nhập đã được dùng" |
| Email sai định dạng | 400 | `email` / "Email không hợp lệ" |
| Email trùng | 409 | `email` / "Email đã được dùng" |
| `cach_cap = email` mà không có email | 400 | `email` / "Cần email để gửi link kích hoạt" |
| `:id` không phải tài khoản đơn vị | 404 | — |

### 4.1 Thay đổi luồng auth sẵn có

- `AuthService.timTaiKhoanTheoTenDangNhap`: so khớp `ten_dang_nhap` không phân biệt hoa/thường (giữ nhánh tìm theo CCCD hiện có).
- `POST /auth/dat-lai-mat-khau`: nhận token loại `dat_lai_mat_khau` **hoặc** `kich_hoat_tai_khoan`; tìm `nguoi_dung` theo `token.nguoi_dung_id` hoặc (như cũ) theo `token.hoc_vien_id`.
- `POST /auth/quen-mat-khau`: thêm nhánh tài khoản đơn vị có email (`active`) → gửi link `dat_lai_mat_khau` gắn `nguoi_dung_id`. Response giữ nguyên `{ da_gui: true }` cho mọi trường hợp.
- `ThongBaoService`: thêm email "Kích hoạt tài khoản quản lý" (dùng khung mẫu email hiện có, tiêu đề `[HCMUE-BDNLS] Kích hoạt tài khoản`), nội dung có tên đơn vị, tên đăng nhập, link, hạn 72 giờ. Thêm giá trị `loai_su_kien_thong_bao` tương ứng nếu cần ghi nhật ký.

### 4.2 Import `tai_khoan_don_vi`

- Enum `loai_danh_muc_import` thêm `tai_khoan_don_vi`.
- Cột: `ma_don_vi` (bắt buộc), `ten_dang_nhap`, `ho_ten`, `email` (tùy chọn). File mẫu qua `GET /import/mau-excel?loai=tai_khoan_don_vi`.
- Kiểm tra từng dòng theo quy tắc §3–§4, thêm lỗi trùng `ma_don_vi` / `ten_dang_nhap` / `email` **trong cùng file**.
- `POST /import/:id/xac-nhan` với loại này: tạo tài khoản các dòng hợp lệ trong 1 transaction; dòng có email → token + email kích hoạt vào hàng đợi; dòng không email → sinh mật khẩu tạm. Response trả **file `.xlsx`** (cột: Mã đơn vị, Tên đơn vị, Tên đăng nhập, Mật khẩu tạm, Cách cấp), `Content-Disposition: attachment; filename="mat-khau-tam-<id>.xlsx"`. File không ghi ra `storage/import/`. Gọi xác nhận lần 2 → 409 như các loại import khác.

## 5. Giao diện (`frontend/src/pages/Admin`)

- Menu "Người dùng" + route `/admin/nguoi-dung`: chỉ `quan_tri` (ẩn mục menu, route chặn vai trò khác).
- `AdminNguoiDung.tsx`: header "Tài khoản đơn vị", nút "+ Tạo tài khoản", "Nhập từ Excel" (điều hướng `/admin/nhap-du-lieu?loai=tai_khoan_don_vi`); bộ lọc (q, loại, trạng thái, đăng nhập); bảng cột Đơn vị · Loại · Tên đăng nhập · Người phụ trách · Email · Lần đăng nhập cuối ("Chưa đăng nhập" badge vàng) · Trạng thái · menu `⋯` (Sửa, Cấp mật khẩu tạm, Gửi email kích hoạt [khi có email], Khóa/Mở khóa); phân trang.
- Modal "Tạo tài khoản": Đơn vị (Select tìm kiếm, nguồn `chua-cap`, nhóm "Sở GD&ĐT" / "Phòng VHXH" / "Trường") → Tên đăng nhập (gợi ý `lower(ma_don_vi)`) → Người phụ trách (gợi ý tên đơn vị) → Email → Radio "Sinh mật khẩu tạm" (mặc định) / "Gửi email kích hoạt" (disabled khi email trống); lỗi field từ API.
- Modal "Mật khẩu tạm": tên đăng nhập + mật khẩu, nút Sao chép từng dòng và "Sao chép cả hai" (`Tài khoản: <x> / Mật khẩu: <y>`); cảnh báo đỏ "Mật khẩu chỉ hiện một lần. Đóng cửa sổ này sẽ không xem lại được."; mật khẩu chỉ trong state cục bộ, mutation không cache (`gcTime: 0`).
- Modal "Sửa tài khoản" (cảnh báo khi đổi tên đăng nhập: "Người dùng sẽ phải đăng nhập bằng tên mới"); hộp thoại xác nhận trước Khóa và Cấp mật khẩu tạm.
- `AdminNhapDuLieu`: thêm loại "Tài khoản đơn vị"; nhận `?loai=` để chọn sẵn; với loại này nút xác nhận nạp tải file kết quả ngay (`apiFetchBlob` + `taiFileTuBlob` sẵn có), sau đó hiện tóm tắt + nút "Tải file mật khẩu tạm" chỉ dùng được 1 lần trong phiên màn hình (giữ Blob trong state, không cache).
- Trang đăng nhập M1: nhãn ô → "Tên đăng nhập / Mã định danh".

## 6. Kiểm thử

Unit (backend):

1. `sinhMatKhauTam()`: 10 ký tự, có chữ và số, không chứa ký tự gây nhầm, đạt `kiemTraDoPhucTapMatKhauMoi`, 1000 lần sinh không trùng.
2. `chuanHoaTenDangNhap()` / validate: chữ hoa → thường; `sgd-angiang` hợp lệ; `ab`, `có-dấu`, `a b`, 51 ký tự → không hợp lệ.
3. `vaiTroTheoLoaiDonVi()`: 3 loại hợp lệ ánh xạ đúng; `khac` → lỗi.

E2E (backend, DB e2e riêng — §7):

4. Tạo lẻ mặc định → `mat_khau_tam` trả về → đăng nhập được, `phai_doi_mat_khau = true` → đổi mật khẩu → `GET /auth/toi` OK.
5. Tạo lẻ `cach_cap=email` → 1 dòng `hang_doi_email` → token đặt mật khẩu thành công; dùng lại → lỗi; token quá 72 giờ (chỉnh `het_han_luc`) → lỗi.
6. Lỗi tạo: đơn vị đã có TK (409), đơn vị `khac` (400), đơn vị ngừng (400), tên đăng nhập sai định dạng (400) / trùng với học viên hoặc TK khác (409), email trùng (409), `cach_cap=email` không email (400).
7. `so_gddt`/`phong_vhxh`/`truong` gọi từng endpoint §4 → 403.
8. Cấp mật khẩu tạm làm vô hiệu link còn hạn; gửi link làm vô hiệu mật khẩu tạm.
9. Khóa → đăng nhập 401/403 và JWT cũ bị từ chối; mở khóa → đăng nhập lại được.
10. Đổi `ten_dang_nhap` → tên cũ không đăng nhập được, tên mới được; đăng nhập `SGD-ANGIANG` khớp `sgd-angiang`.
11. Quên mật khẩu: TK đơn vị có email → email đặt lại; không email / không tồn tại → vẫn `{ da_gui: true }`, không tạo token.
12. Hồi quy học viên: đăng nhập bằng mã định danh + mật khẩu mặc định; quên/đặt lại mật khẩu học viên như cũ.
13. Import: lỗi từng dòng (thiếu mã, mã không tồn tại, loại sai, trùng trong file, đã có TK); xác nhận → đúng số TK, email xếp hàng cho dòng có email, file `.xlsx` chỉ chứa dòng không email và mật khẩu trong file đăng nhập được; xác nhận lần 2 → 409.
14. TK Sở vừa tạo (đơn vị đặt hàng của 1 khóa) đăng nhập → thấy khóa đó với `pham_vi_hoc_vien = 'toan_bo'` (R1).

Frontend (Vitest + MSW):

15. Menu/route "Người dùng" chỉ `quan_tri`.
16. Bảng + bộ lọc gọi đúng query.
17. Modal tạo: Select chỉ đơn vị chưa cấp; radio email disabled khi email trống; lỗi field API hiện dưới ô.
18. Modal mật khẩu tạm: hiện 1 lần, sao chép, đóng xong mở lại không còn mật khẩu.
19. Nhập dữ liệu loại "Tài khoản đơn vị": chọn sẵn từ `?loai=`, xác nhận tải file.
20. M1 hiện nhãn "Tên đăng nhập / Mã định danh".

## 7. Migration, môi trường test, triển khai

Migration (2 file, chỉ thêm/nới ràng buộc):

1. `..._tai_khoan_don_vi_enum`: `ALTER TYPE loai_token_xac_thuc ADD VALUE 'kich_hoat_tai_khoan'`; `ALTER TYPE loai_danh_muc_import ADD VALUE 'tai_khoan_don_vi'` (+ `loai_su_kien_thong_bao` nếu thêm).
2. `..._tai_khoan_don_vi`: cột `token_xac_thuc.nguoi_dung_id` + index + CHECK, `hoc_vien_id` nullable; unique index `uq_nguoi_dung_don_vi_quan_ly`; nới CHECK email; `UPDATE nguoi_dung SET ten_dang_nhap = lower(ten_dang_nhap)` — trước đó `DO $$ … RAISE EXCEPTION` nếu `lower()` tạo trùng.

Môi trường test: thêm `backend/.env.test` (gitignored) + `.env.test.example`; `test/setup-e2e-env.ts` nạp `.env.test` khi có, để e2e chạy trên DB `thong_tin_hoc_vien_test`, không đụng DB dev.

Triển khai: sau khi "Đơn vị đặt hàng" đã lên VPS, deploy tính năng này bằng `bash scripts/vps/06-deploy.sh` (sao lưu tự động trước migrate). SMTP thật (`SMTP_HOST/USER/PASS/FROM` trong `backend/.env` VPS) chỉ cần cho link kích hoạt; thiếu SMTP vẫn dùng được mật khẩu tạm.

Cập nhật tài liệu: `docs/api-contract.md` (mục nguoi-dung, auth, import), `docs/database-ddl.sql`, `docs/validation-checklist.md`, `CONTEXT.md` (thuật ngữ "Tài khoản đơn vị", "Mật khẩu tạm"), ADR `docs/adr/0002-tai-khoan-don-vi.md`.

## 8. Rủi ro và giới hạn

- Đổi mật khẩu/cấp mật khẩu tạm không thu hồi JWT đang mở của người phụ trách cũ (chỉ khóa tài khoản mới chặn ngay); muốn cắt ngay khi đổi người → Khóa rồi Mở lại sau khi cấp mới.
- Sửa luồng `dat-lai-mat-khau`/`quen-mat-khau` đang chạy cho học viên — kiểm soát bằng test hồi quy #12.
- File mật khẩu tạm tải về máy Quản trị là dữ liệu nhạy cảm; xóa sau khi gửi.
- Chuyển `ten_dang_nhap` hiện có sang chữ thường: tên đăng nhập học viên là chữ số, Quản trị là email chữ thường — không đổi thực tế; migration dừng nếu có trùng.
