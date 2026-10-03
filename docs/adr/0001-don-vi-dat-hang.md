# ADR 0001: Đơn vị đặt hàng thay cho Đơn vị tổ chức khóa bồi dưỡng

- Ngày: 2026-10-03
- Trạng thái: đã chấp nhận, đã triển khai code (chưa deploy VPS)
- Thay thế: T2/QĐ2 (2026-09-29) trong `docs/mo-rong-nls-an-giang.md` — "Quản trị tạo khóa cho đơn vị loại khác" + bảng `khoa_don_vi_theo_doi`
- Đặc tả chi tiết: [`docs/superpowers/specs/2026-10-03-don-vi-dat-hang-design.md`](../superpowers/specs/2026-10-03-don-vi-dat-hang-design.md)

## Bối cảnh

T2/QĐ2 cho `khoa_boi_duong.don_vi_to_chuc_id` mang nghĩa "đơn vị tổ chức khóa", thiết kế cho kịch bản Trường tự tạo khóa → Phòng/Sở duyệt. Quản trị (HCMUE) tạo khóa cho đơn vị loại `khac` thì gán thêm đơn vị khác vào bảng `khoa_don_vi_theo_doi` để Sở/Phòng/Trường liên quan XEM được khóa — nhưng danh sách này chỉ mở rộng phạm vi xem, tách rời khỏi dữ liệu học viên.

Thực tế vận hành khác với thiết kế đó:

- Mọi khóa **luôn do Trường ĐHSP TP.HCM (HCMUE) tổ chức** theo đặt hàng — không có khóa nào do Trường/Sở/Phòng tự tổ chức và tự duyệt.
- Mỗi khóa có **đúng 1 đơn vị đặt hàng**: một Sở GD&ĐT, một đơn vị khác (đặt hàng cho nhiều Sở), hoặc một trường phổ thông.
- Sắp tới cần cấp tài khoản cho **Sở** (xem toàn bộ khóa mình đặt hàng và kết quả của mọi học viên trong khóa đó) và **Trường** (chỉ xem khóa có giáo viên trường mình tham gia, và chỉ kết quả của giáo viên trường mình).

Bảng `khoa_don_vi_theo_doi` (nhiều-nhiều, không giới hạn số lượng) không diễn tả được "đúng 1 đơn vị đặt hàng", và việc tách phạm vi XEM khóa khỏi phạm vi dữ liệu học viên khiến không thể cho Sở xem toàn bộ học viên của khóa mình đặt hàng.

## Quyết định

| # | Quyết định |
|---|---|
| D1 | Chỉ Quản trị (HCMUE) tạo khóa. Bỏ hẳn luồng nộp duyệt/duyệt khóa; khóa chuyển trạng thái `da_duyet` ngay khi tạo. |
| D2 | Mỗi khóa đúng 1 đơn vị đặt hàng, loại `so_gddt`, `truong` hoặc `khac` (không nhận `phong_vhxh`). |
| D3 | Đơn vị đặt hàng (và cấp trên của nó trong cây đơn vị) xem **toàn bộ** học viên của khóa. |
| D4 | Chưa cấp tài khoản cho đơn vị loại `khac` (YAGNI) — họ nhận báo cáo do HCMUE xuất, không tự đăng nhập xem. |
| D5 | Đổi tên cột `don_vi_to_chuc_id` → `don_vi_dat_hang_id` (DB + API), xóa hẳn bảng `khoa_don_vi_theo_doi`. |
| D6 | Sở/Phòng/Trường chỉ xem (mọi endpoint ghi của module khóa bồi dưỡng chỉ `quan_tri`). |

Kèm 2 quy tắc phạm vi xem mới, áp dụng cho `so_gddt`/`phong_vhxh`/`truong` (thay hẳn cơ chế "đơn vị theo dõi" của T2/QĐ2):

- **R1 — đặt hàng:** `khoa.don_vi_dat_hang_id` nằm trong phạm vi (`scope`, suy ra từ cây `don_vi_cong_tac` qua `ScopeService`) của người gọi → thấy khóa và **toàn bộ** học viên của khóa.
- **R2 — tham gia:** có ít nhất 1 `dang_ky_hoc` của khóa mà `hoc_vien.don_vi_cong_tac_id` nằm trong phạm vi người gọi → thấy khóa, nhưng chỉ thấy học viên có `don_vi_cong_tac_id` trong phạm vi đó.
- Thỏa cả R1 và R2 → áp theo R1 (xem toàn bộ).

Cài đặt ở `backend/src/auth/scope/scope.service.ts`: `getKhoaIdsXemDuoc(caller)` (hợp R1 ∪ R2, thay `getKhoaIdsTheoDoi` cũ) và `getHocVienScopeTrongKhoa(caller, khoa)` (R1 → `'ALL'`, ngược lại → phạm vi của caller).

## Hệ quả

**Xóa 4 endpoint** (không còn luồng nộp duyệt/duyệt khóa, không còn danh sách đơn vị theo dõi):

- `POST /khoa-boi-duong/{id}/nop-duyet`
- `POST /khoa-boi-duong/{id}/duyet`
- `POST /khoa-boi-duong/{id}/don-vi-theo-doi`
- `DELETE /khoa-boi-duong/{id}/don-vi-theo-doi/{donViId}`

Cùng với đó: bỏ email "Kết quả duyệt khóa bồi dưỡng" (`thongBaoService.guiKhoaBoiDuongDuyet`) và hàm `resolveDonViDuyetKhoa`.

**Di chuyển dữ liệu** qua 2 migration Prisma triển khai cùng lúc (không phải 1 transaction — Postgres không có aggregate `MIN`/`MAX` cho kiểu `uuid`):

1. `20261003120000_don_vi_dat_hang_rename` — `RENAME COLUMN don_vi_to_chuc_id TO don_vi_dat_hang_id` + đổi tên FK.
2. `20261003130000_don_vi_dat_hang_du_lieu` — gán `don_vi_dat_hang_id` từ đơn vị theo dõi duy nhất của mỗi khóa có đúng 1 dòng trong `khoa_don_vi_theo_doi` (`MIN(don_vi_id::text)::uuid`, dùng `text` vì không ép kiểu `uuid` trực tiếp được), `DROP TABLE khoa_don_vi_theo_doi`, và chuyển mọi khóa `nhap`/`cho_duyet`/`tu_choi` còn lại sang `da_duyet`.

Khóa có 0 hoặc ≥2 đơn vị theo dõi không tự chuyển được — cần rà soát bằng `scripts/kiem_tra_don_vi_dat_hang.sql` và gán tay sau khi migrate (xem "Triển khai" ngay dưới và mục "Triển khai VPS" trong kế hoạch).

### Triển khai (sửa 2026-10-03, fix #1 final-review — thứ tự đúng)

`scripts/kiem_tra_don_vi_dat_hang.sql` dùng tên cột/bảng CŨ (`don_vi_to_chuc_id`, `khoa_don_vi_theo_doi`) vì nó phải chạy TRƯỚC khi migration đổi tên cột và xóa bảng — chạy sau khi đã `migrate deploy` sẽ lỗi `column "don_vi_to_chuc_id" does not exist`. Thứ tự triển khai đúng:

1. Sao lưu DB (`backend/backups/`).
2. Chạy `scripts/kiem_tra_don_vi_dat_hang.sql` trên DB **chưa migrate** (schema cũ, cột vẫn là `don_vi_to_chuc_id`) — liệt kê (a) khóa sẽ tự đổi đơn vị đặt hàng, (b) khóa có 0 hoặc ≥2 đơn vị theo dõi (migration GIỮ NGUYÊN đơn vị đặt hàng hiện tại của các khóa này), (c) khóa sẽ đổi trạng thái sang `da_duyet`. Người dùng duyệt danh sách (b) trước khi đi tiếp.
3. `prisma migrate deploy` (áp cả 2 migration — không tách bước, Postgres không hỗ trợ `MIN`/`MAX(uuid)` nên bước 2 (gán dữ liệu) phải nằm trong 1 migration riêng chạy ngay sau bước 1 (đổi tên cột), nhưng cả 2 vẫn nằm trong cùng 1 lần `migrate deploy`).
4. Với các khóa ở tập (b) mà đơn vị đặt hàng giữ nguyên là SAI (Quản trị xác định qua danh sách ở bước 2) — gán tay bằng `UPDATE khoa_boi_duong SET don_vi_dat_hang_id = '<id đơn vị đúng>' WHERE id = '<id khóa>'` (chạy SAU migrate, vì lúc này cột đã mang tên mới).
5. Deploy backend + frontend cùng lúc (đổi tên field API, xem "Rủi ro").

**Đổi tên field API** phá mọi client cũ dùng `don_vi_to_chuc_id` — chỉ có frontend của chính dự án này dùng, nên **phải deploy backend và frontend cùng lúc**, không rolling deploy từng phần.

**Chi tiết API đổi** (xem `docs/api-contract.md` mục 3 và mục 7 để biết đầy đủ): `don_vi_dat_hang_id` bắt buộc khi tạo khóa, tùy chọn khi sửa; `GET /khoa-boi-duong` và `GET /khoa-boi-duong/{id}` áp R1/R2 qua `getKhoaIdsXemDuoc`; `GET /khoa-boi-duong/{id}` trả thêm `pham_vi_hoc_vien: 'toan_bo' | 'don_vi'`; báo cáo theo khóa (`bao-cao/tong-hop?theo=khoa`, `bao-cao/van-hanh`) đếm học viên theo `getHocVienScopeTrongKhoa` của từng khóa.

## Thay thế

Thay thế hoàn toàn T2/QĐ2 (2026-09-29) trong `docs/mo-rong-nls-an-giang.md` — mục đó được đánh dấu "Đã thay thế bởi ADR 0001 (2026-10-03)" và giữ lại nguyên văn làm lịch sử, không xóa.
