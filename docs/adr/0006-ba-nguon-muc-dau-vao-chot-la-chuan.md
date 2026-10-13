# ADR 0006 — Ba nguồn mức đầu vào; mức chốt là chuẩn duy nhất để xếp lớp

- Ngày: 2026-10-13
- Trạng thái: Đã chấp nhận
- Thay thế: quy tắc 2026-10-08/09 "mức học hiệu lực = `muc_hoc_chon ??` mốc" và quy tắc import `ket_qua_danh_gia` reset `muc_hoc_chon` (CONTEXT.md mục **DangKyHoc**)
- Liên quan: `backend/src/khoa-boi-duong/util/muc-hoc.util.ts`, import `ket_qua_danh_gia`, `phan_lop_hoc_vien`, Excel "Danh sách chia lớp"

## Bối cảnh

Trước đây một đăng ký học trộn ba thứ vào một "mức học hiệu lực": kết quả bài khảo sát đầu vào, mức học viên tự chọn và mức Quản trị chốt. Import kết quả đánh giá đầu vào lại tự xóa lựa chọn của học viên khi lệch. Kết quả là Quản trị không còn thấy học viên đã muốn học mức nào, và lớp có thể bị xếp theo mức chưa được chốt.

## Quyết định

| # | Quyết định |
|---|---|
| N1 | Mỗi `dang_ky_hoc` có **3 nguồn mức đầu vào** tách bạch: **Kết quả hệ thống** — bài `ket_qua_khao_sat` `loai='danh-gia'` đã hoàn thành (mã gốc M1..M4, quy đổi `mucTuKetQuaKhaoSat`); **Nhu cầu học viên** — `muc_hoc_chon` (+ `muc_hoc_chon_luc`); **Mức chính thức (chốt)** — `muc_dau_vao`, chỉ Quản trị đặt qua import `ket_qua_danh_gia`. |
| N2 | **Mức chốt là chuẩn duy nhất để xếp lớp** (`mucHocHieuLuc(muc_dau_vao)`). Chưa chốt = chưa có mức xếp lớp: Excel chia lớp để trống cột "# Mức chính thức (chốt)", import phân lớp cảnh báo "chưa có mức chốt đầu vào". |
| N3 | **Import `ket_qua_danh_gia` không xóa nhu cầu**: `dau_vao` chỉ ghi `muc_dau_vao` (vẫn ghi nhật ký), `muc_hoc_chon`/`muc_hoc_chon_luc` giữ nguyên. |
| N4 | **Khóa điều chỉnh khi đã chốt**: học viên (`PUT /hoc-vien/toi/khoa-hoc/{khoaId}/muc-hoc`) và Quản trị sửa hộ (`PATCH /dang-ky-hoc/{id}/muc-hoc`) đều nhận 400 "Đã có mức chính thức (chốt), không thể điều chỉnh mức". Trước khi chốt, mốc = kết quả hệ thống, giữ quy tắc bằng mốc hoặc thấp hơn đúng 1 mức. Trường `muc_hoc` trả về = mức chốt (có thể `null`). |
| N5 | Học viên và Quản trị **thấy đủ 3 giá trị** mỗi khóa: kết quả hệ thống (nhãn gốc + mức quy đổi), nhu cầu đã chọn (chưa chọn = "Học theo kết quả đánh giá"), mức chính thức (hoặc "Chưa chốt"). API `GET .../khoa-hoc` trả kết quả hệ thống độc lập với mức chốt (`muc_goc_danh_gia`, `nhan_muc_goc_danh_gia`, `muc_he_thong`); `muc_danh_gia`/`nguon_muc_danh_gia` giữ để tương thích. |
| N6 | Thống kê "Nhu cầu mức học" là báo cáo **nhu cầu** — giữ nguyên cách tính. |

## Phương án đã loại

- **Giữ "hiệu lực = chọn ?? mốc"** — lớp bị xếp theo mức chưa ai xác nhận; Quản trị không phân biệt được nguyện vọng và quyết định.
- **Import ghi đè/reset nhu cầu** — mất dữ liệu nhu cầu, không đối chiếu được nhu cầu với mức chốt.
- **Cho điều chỉnh tiếp sau khi chốt** — nhu cầu thay đổi sau chốt không còn tác dụng xếp lớp, chỉ gây hiểu nhầm.

## Hệ quả

- Không migration, không đổi schema; dữ liệu cũ không bị sửa.
- Học viên đã có `muc_dau_vao` không còn điều chỉnh được (kể cả khi khóa mở công tắc).
- Học viên chưa được chốt sẽ để trống mức chính thức trong Excel chia lớp và nhận cảnh báo khi nhập phân lớp — Quản trị cần nhập `ket_qua_danh_gia` trước khi chia lớp.
- Excel "Danh sách chia lớp" đổi cột tham khảo: "# Mức hệ thống (quy đổi)", "# Mức học viên chọn (nhu cầu)", "# Mức chính thức (chốt)" (bỏ "# Mức đánh giá (mốc)", "# Nguồn mức", "# Mức học"); file vẫn nhập lại được vì cột "#" bị bỏ qua.
