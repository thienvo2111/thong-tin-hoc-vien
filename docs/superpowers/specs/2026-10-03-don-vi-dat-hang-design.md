# Đặc tả: Đơn vị đặt hàng thay cho Đơn vị tổ chức khóa bồi dưỡng

- Ngày: 2026-10-03
- Trạng thái: chờ duyệt
- Thay thế: T2/QĐ2 (2026-09-29) — "Quản trị tạo khóa cho đơn vị loại khac" + bảng `khoa_don_vi_theo_doi`

## 1. Bối cảnh và mục tiêu

Hiện `khoa_boi_duong.don_vi_to_chuc_id` mang nghĩa "đơn vị tổ chức khóa", thiết kế cho kịch bản Trường tự tạo khóa → Phòng/Sở duyệt. Thực tế:

- Mọi khóa **luôn do Trường ĐHSP TP.HCM (HCMUE) tổ chức** theo đặt hàng.
- Mỗi khóa có **đúng 1 đơn vị đặt hàng**: một Sở GD&ĐT, một đơn vị khác (đặt cho nhiều Sở), hoặc một trường phổ thông.
- Sắp tới cần cấp tài khoản **Sở** (xem toàn bộ khóa mình đặt hàng và kết quả) và **Trường** (xem khóa có giáo viên trường mình tham gia và kết quả của giáo viên đó).

Tiêu chí hoàn thành:

1. Form tạo khóa hỏi "Đơn vị đặt hàng" (bắt buộc), không còn "Đơn vị tổ chức".
2. Tài khoản Sở thấy đúng các khóa mình đặt hàng, với toàn bộ học viên.
3. Tài khoản Trường chỉ thấy khóa có giáo viên trường mình, chỉ thấy giáo viên trường mình.
4. Sở/Phòng/Trường chỉ xem; mọi thao tác ghi chỉ Quản trị (HCMUE).

## 2. Quyết định đã chốt

| # | Quyết định |
|---|---|
| D1 | Chỉ Quản trị (HCMUE) tạo khóa. Bỏ luồng nộp duyệt/duyệt khóa; khóa `da_duyet` ngay khi tạo. |
| D2 | Mỗi khóa đúng 1 đơn vị đặt hàng, loại `so_gddt`, `truong` hoặc `khac` (không nhận `phong_vhxh`). |
| D3 | Đơn vị đặt hàng (và cấp trên của nó trong cây) xem **toàn bộ** học viên của khóa. |
| D4 | Chưa cấp tài khoản cho đơn vị loại `khac` (YAGNI); họ nhận báo cáo do HCMUE xuất. |
| D5 | Phương án 1: đổi tên cột `don_vi_to_chuc_id` → `don_vi_dat_hang_id` (DB + API), xóa `khoa_don_vi_theo_doi`. |
| D6 | Sở/Phòng/Trường chỉ xem; ghi chỉ `quan_tri`. |

## 3. Dữ liệu

- `khoa_boi_duong.don_vi_to_chuc_id` → `don_vi_dat_hang_id` (NOT NULL, FK `don_vi_cong_tac`). Đổi tên luôn FK/index liên quan; quan hệ Prisma `don_vi_to_chuc` → `don_vi_dat_hang`.
- Xóa model/bảng `khoa_don_vi_theo_doi`.
- Enum `trang_thai_khoa` giữ nguyên (không đổi kiểu DB); khóa mới chỉ dùng `da_duyet` và `dong_dang_ky`.
- Các cột `nguoi_duyet_id`, `cap_duyet_thuc_te`, `ngay_duyet` giữ nguyên (dữ liệu lịch sử), không ghi mới ngoài lúc tạo.
- "Đơn vị tổ chức = HCMUE" là hằng số hiển thị, **không** lưu trong DB.

## 4. Quyền ghi

- Mọi endpoint ghi của module khóa bồi dưỡng (tạo/sửa khóa, giai đoạn, lớp, cụm, nhân sự lớp, import nhân sự, cập nhật kết quả `dang_ky_hoc`) → `@Roles('quan_tri')`. Bỏ `assertChuKhoa`.
- `PATCH /khoa-boi-duong/{id}`: Quản trị sửa được ở mọi trạng thái (bỏ ràng buộc chỉ `nhap`/`tu_choi`); cho phép sửa `don_vi_dat_hang_id` (cùng validate như lúc tạo).
- Xóa endpoint: `POST /khoa-boi-duong/{id}/nop-duyet`, `POST /khoa-boi-duong/{id}/duyet`, `POST /khoa-boi-duong/{id}/don-vi-theo-doi`, `DELETE /khoa-boi-duong/{id}/don-vi-theo-doi/{donViId}`.
- Xóa email "Kết quả duyệt khóa bồi dưỡng" (`thongBaoService.guiKhoaBoiDuongDuyet`) và `resolveDonViDuyetKhoa`.
- `POST /khoa-boi-duong` validate `don_vi_dat_hang_id`:
  - thiếu → 400 `VALIDATION_ERROR`, field `don_vi_dat_hang_id`, "Bắt buộc";
  - không tồn tại hoặc `trang_thai != active` → 400, "Không hợp lệ";
  - `loai_don_vi = phong_vhxh` → 400, "Sai loại đơn vị".

## 5. Phạm vi xem

Định nghĩa: `scope(caller)` = `ScopeService.getAccessibleDonViIds(caller)` (giữ nguyên: Trường = chính nó; Phòng/Sở = cây con; Quản trị = ALL).

Hai quy tắc, áp dụng cho `so_gddt`, `phong_vhxh`, `truong`:

- **R1 — đặt hàng:** `khoa.don_vi_dat_hang_id ∈ scope(caller)` → thấy khóa và **toàn bộ** học viên của khóa.
- **R2 — tham gia:** tồn tại `dang_ky_hoc` của khóa có `hoc_vien.don_vi_cong_tac_id ∈ scope(caller)` → thấy khóa, chỉ thấy học viên có `don_vi_cong_tac_id ∈ scope(caller)`.
- Thỏa cả R1 và R2 → theo R1.

Hàm mới trong `ScopeService` (thay `getKhoaIdsTheoDoi`):

- `getKhoaIdsXemDuoc(caller): Promise<'ALL' | string[]>` — `quan_tri` → `'ALL'`; `hoc_vien` → không dùng (giữ logic hiện có); còn lại → hợp R1 ∪ R2.
- `getHocVienScopeTrongKhoa(caller, khoa): Promise<'ALL' | string[]>` — `quan_tri` hoặc R1 → `'ALL'`; ngược lại → `scope(caller)`.

Áp dụng:

| Chỗ | Thay đổi |
|---|---|
| `GET /khoa-boi-duong` | Lọc `id ∈ getKhoaIdsXemDuoc`. Query `don_vi_to_chuc_id` → `don_vi_dat_hang_id` (lọc thuần, không còn 403 khi ngoài scope — kết quả giao với tập xem được). |
| `GET /khoa-boi-duong/{id}` | 403 nếu không thuộc tập xem được. Trả thêm `pham_vi_hoc_vien: 'toan_bo' \| 'don_vi'`; sĩ số lớp đếm theo `getHocVienScopeTrongKhoa`. |
| `GET /bao-cao/tong-hop` (theo khóa) | Khóa ∈ tập xem được; đếm đăng ký theo phạm vi học viên của từng khóa. |
| `GET /bao-cao/van-hanh` (+ xuất Excel) | Thay khối "chủ khóa HOẶC theo dõi" bằng `getKhoaIdsXemDuoc`; đếm học viên theo `getHocVienScopeTrongKhoa` từng khóa. |
| Báo cáo theo `khoa_id` khác (`xac-nhan`, `sua-truong-moet`, `xuat-cho-vle`, `dieu-kien-danh-gia` + xuất Excel) | Endpoint nào hiện mở cho Sở/Phòng/Trường thì áp 2 quy tắc như trên; endpoint chỉ `quan_tri` giữ nguyên. |
| Excel báo cáo | Cột "Đơn vị tổ chức" → "Đơn vị đặt hàng". |

Ngoài phạm vi: `/hoc-vien` (hồ sơ) và `/bao-cao/tong-quan` giữ lọc theo đơn vị công tác.

## 6. Giao diện (`frontend/src/pages/Admin`)

- `AdminKhoaBoiDuong.tsx`: cột + bộ lọc "Đơn vị đặt hàng"; nút "+ Tạo khóa mới" chỉ `quan_tri`; bộ lọc trạng thái còn "Đang mở" (`da_duyet`) và "Đóng đăng ký"; form tạo khóa có Select "Đơn vị đặt hàng" bắt buộc, tìm kiếm, nhóm theo loại (Sở GD&ĐT → Đơn vị khác → Trường), bỏ description cũ và nhánh tự điền `donViKhac.length === 1`.
- `useDonViChoKhoa` (`api/khoaBoiDuong.ts`): lấy thêm loại `so_gddt`.
- `AdminKhoaChiTiet.tsx`: header "Đặt hàng: …" + "Tổ chức: Trường ĐHSP TP.HCM"; bỏ nút Nộp duyệt/Duyệt khóa, tab + modal Đơn vị theo dõi, hook `useThemDonViTheoDoi`/`useXoaDonViTheoDoi`; gộp `VAI_TRO_QUAN_LY_KHOA`/`VAI_TRO_DUYET` thành kiểm tra `quan_tri`; ẩn mọi nút ghi với vai trò khác; khi `pham_vi_hoc_vien === 'don_vi'` hiện Alert "Bạn đang xem các học viên thuộc đơn vị của mình trong khóa này."
- Form sửa khóa (Quản trị) cho sửa đơn vị đặt hàng.
- `api/types.ts`, MSW `test/mocks/{db,handlers}.ts`: đổi tên field, bỏ endpoint đã xóa.
- Ngoài phạm vi: màn hình cấp tài khoản ("Người dùng").

## 7. Migration và vận hành

Migration Prisma mới (2 file migration triển khai cùng lúc — không phải 1 transaction, do Postgres không có aggregate `MIN`/`MAX` cho kiểu `uuid` nên bước 2 phải ép qua `text`):

1. `RENAME COLUMN don_vi_to_chuc_id TO don_vi_dat_hang_id` (+ đổi tên FK/index).
2. `UPDATE khoa_boi_duong k SET don_vi_dat_hang_id = t.don_vi_id FROM (SELECT khoa_id, MIN(don_vi_id::text)::uuid don_vi_id FROM khoa_don_vi_theo_doi GROUP BY khoa_id HAVING COUNT(*) = 1) t WHERE t.khoa_id = k.id`.
3. `DROP TABLE khoa_don_vi_theo_doi`.
4. `UPDATE khoa_boi_duong SET trang_thai = 'da_duyet' WHERE trang_thai IN ('nhap','cho_duyet','tu_choi')`.

Trước khi deploy VPS:

- Sao lưu DB (`backend/backups/`).
- Chạy script chỉ đọc `scripts/kiem_tra_don_vi_dat_hang.sql` **trên DB chưa migrate** (script dùng tên cột/bảng cũ `don_vi_to_chuc_id`/`khoa_don_vi_theo_doi` — chạy sau khi migrate sẽ lỗi vì cột đã đổi tên) liệt kê: khóa sẽ đổi đơn vị đặt hàng (bước 2), khóa có 0 hoặc ≥2 đơn vị theo dõi (cần gán tay), khóa sẽ đổi trạng thái (bước 4). Người dùng duyệt danh sách trước khi migrate; việc gán tay các khóa (b) làm SAU khi `prisma migrate deploy` (lúc đó cột mới mang tên `don_vi_dat_hang_id`) bằng `UPDATE khoa_boi_duong SET don_vi_dat_hang_id = ...`.
- Rollback: SQL đảo bước 1; bảng theo dõi và trạng thái cũ khôi phục từ bản sao lưu.

## 8. Tài liệu

- `docs/api-contract.md`: đổi field, xóa 4 endpoint, cập nhật bảng "Ai gọi", mô tả R1/R2 và `pham_vi_hoc_vien`.
- `docs/database-ddl.sql`, `docs/mo-rong-nls-an-giang.md` (đánh dấu T2/QĐ2 bị thay thế), `docs/validation-checklist.md`.
- ADR mới `docs/adr/0001-don-vi-dat-hang.md`; thêm thuật ngữ "Đơn vị đặt hàng", "Đơn vị tổ chức (HCMUE)" vào `CONTEXT.md`.

## 9. Kiểm thử

Unit — `ScopeService`:

1. Sở là đơn vị đặt hàng → khóa ∈ tập xem; phạm vi học viên `ALL`.
2. Sở không đặt hàng, có giáo viên trong khóa → khóa ∈ tập xem; phạm vi = cây Sở.
3. Trường có giáo viên tham gia → khóa ∈ tập xem; phạm vi = trường.
4. Trường không có giáo viên → khóa ∉ tập xem.
5. Trường là đơn vị đặt hàng → phạm vi `ALL`.
6. Phòng VHXH có trường con tham gia → khóa ∈ tập xem; phạm vi = cây Phòng.
7. Quản trị → `ALL`.
8. Khóa không có đăng ký nào, caller không đặt hàng → không thấy.

E2E — backend:

- Tạo khóa: thiếu / không tồn tại / loại `phong_vhxh` → 400; hợp lệ (Sở, khác, trường) → 201, `da_duyet`.
- Sở/Phòng/Trường gọi từng endpoint ghi → 403.
- Endpoint đã xóa → 404.
- `GET /khoa-boi-duong` và `/{id}` theo R1/R2 cho từng vai trò; `pham_vi_hoc_vien` đúng.
- Từng báo cáo theo khóa: số học viên đúng theo R1 (toàn bộ) và R2 (chỉ trong phạm vi).
- Migration: khóa có 1 đơn vị theo dõi được chuyển; khóa có ≥2 giữ nguyên.
- Sửa các e2e hiện có dùng `don_vi_to_chuc_id`, nộp duyệt/duyệt, theo dõi.

Frontend (Vitest + MSW):

- Form tạo khóa: bắt buộc đơn vị đặt hàng; hiện lỗi field từ API.
- Vai trò Sở/Trường: không thấy "+ Tạo khóa mới" và các nút ghi ở chi tiết khóa.
- Không còn nút Duyệt/Nộp duyệt và tab Đơn vị theo dõi.
- Alert phạm vi hiện khi `pham_vi_hoc_vien = 'don_vi'`, ẩn khi `'toan_bo'`.

## 10. Rủi ro

- Đổi tên field API phá mọi client cũ — chỉ có frontend của dự án; deploy backend + frontend cùng lúc.
- Bước 4 migration không đảo được nếu thiếu bản sao lưu.
- R2 cần truy vấn `dang_ky_hoc ⋈ hoc_vien`; kiểm tra index `hoc_vien.don_vi_cong_tac_id` khi lập kế hoạch.
