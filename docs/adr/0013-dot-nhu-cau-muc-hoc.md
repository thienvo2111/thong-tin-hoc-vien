# ADR 0013 — Đợt nhu cầu mức học (thu nhu cầu sau xếp lớp, không ghi đè)

- Ngày: 2026-10-20
- Trạng thái: Đề xuất (đã chốt qua phỏng vấn thiết kế, chưa triển khai)
- Liên quan: ADR 0006 (ba nguồn mức, mức chốt là chuẩn), `dang_ky_hoc.muc_hoc_chon`, `phan_lop_giai_doan`, `lop_hoc.muc_nang_luc`, `common/utils/doi-tuong-khao-sat.util.ts`

## Bối cảnh

Sau khi đã chốt mức (`muc_dau_vao`) và xếp lớp, cần thu lại nhu cầu bồi dưỡng của học viên (cơ bản / thành thạo / nâng cao) để phân tích riêng. Nhu cầu lần 1 (`muc_hoc_chon`) không được ghi đè. ADR 0006 N4 khóa điều chỉnh mức khi đã chốt, nên dữ liệu mới phải là nguồn riêng, không tác động vận hành.

## Quyết định

| # | Quyết định |
|---|---|
| D1 | **Chỉ ghi nhận để phân tích.** Không đổi `muc_dau_vao`, `muc_hoc_chon`, `muc_hoc_chon_luc`, không tự chuyển lớp, không tạo đề nghị đổi lớp. ADR 0006 giữ nguyên; đây là nguồn thứ 4 tách bạch. |
| D2 | **Mốc** (mức tối đa được chọn) = `lop_hoc.muc_nang_luc` của lớp đang phân công (giai đoạn đang diễn ra; chưa tới thì giai đoạn có gán lớp gần nhất sắp tới; qua `phan_lop_giai_doan`). Lớp không có mức hoặc chưa xếp lớp → `muc_dau_vao`. Cả hai trống → không được chọn ("Chưa có mức/lớp"). Đổi buổi / học bù không ảnh hưởng mốc. |
| D3 | **Lưu theo đợt**, 2 bảng mới (chỉ thêm): `dot_nhu_cau_muc` (khoa_id, ten_dot, mo_luc, dong_luc timestamptz, created_by, CHECK dong_luc > mo_luc) và `nhu_cau_muc_hoc_vien` (dot_id, dang_ky_hoc_id, muc_chon, muc_moc, nguon_moc `lop`/`muc_chot`, lop_id_luc_chon, chon_luc, cap_nhat_luc; UNIQUE (dot_id, dang_ky_hoc_id)). Mỗi khóa nhiều đợt, **không chồng thời gian** (kiểm tra trong service, transaction khóa dòng khóa học). Giờ mở/đóng theo giờ server. |
| D4 | **3 lựa chọn gồm "giữ nguyên"** (muc_chon = mốc); mức cao hơn mốc bị **ẩn**. Backend chặn `muc_chon > muc_moc` (400, nêu mức hiện tại). |
| D5 | **Sửa nhiều lần khi đợt mở**, lần cuối là kết quả (`chon_luc` lần đầu, `cap_nhat_luc` lần cuối); không lưu lịch sử từng lần. Mốc tính lại mỗi lần lưu; bản ghi cũ vượt mốc mới vẫn giữ. Đợt đóng → chỉ xem, lỗi `DOT_NHU_CAU_DONG`. |
| D6 | **Đối tượng**: `dang_ky_hoc.trang_thai` ∈ {`da_duyet`, `da_phan_lop`}, có mốc, `phaiXepLop(doi_tuong)` (loại `nhan_vien`; NULL vẫn tham gia). Mẫu số tỷ lệ trả lời = toàn bộ đối tượng đủ điều kiện. |
| D7 | **Quản trị không sửa hộ** (v1). Quản trị (cùng quyền sửa khóa / bật `mo_dieu_chinh_muc`) tạo, sửa tên/giờ, đóng sớm (`dong_luc = now()`) đợt; chỉ xóa được đợt chưa có bản ghi. |
| D8 | **Giao diện học viên**: thẻ nổi bật đầu `/toi` khi có đợt mở và đủ điều kiện (tên đợt, hạn chót, trạng thái Chưa chọn/Đã chọn; mỗi đợt một thẻ). Trang `/toi/nhu-cau-muc?dot=<id>` (gửi được qua Zalo) gồm theo thứ tự: Thông tin Thầy/Cô → Mức – lớp đang được phân công (mốc + nguồn, lớp, giai đoạn) → Nhu cầu (radio lớn, nút Lưu + modal xác nhận). Không có trường lý do. Thẻ ChonMucLopHoc cũ ở `/toi/lop-hoc` giữ nguyên. |
| D9 | **Giao diện quản trị**: mục "Đợt nhu cầu mức học" trong AdminKhoaChiTiet; tab thống kê theo đợt (KPI đủ điều kiện/đã chọn/chưa chọn/%, ma trận Mốc × Chọn, bảng theo trường, lọc trường/Sở); Excel từng người (toàn bộ/1/nhiều trường, có PII): thông tin cơ bản, mốc, nguồn mốc, lớp lúc chọn, lớp hiện tại, mức chọn, chọn lúc, cập nhật lúc, tham khảo `muc_dau_vao` và `muc_hoc_chon`; chưa chọn vẫn có dòng "Chưa chọn". Không làm màn người hỗ trợ/giảng viên (v1). |
| D10 | `nhu_cau_muc_hoc_vien.dang_ky_hoc_id` và `dot_id` **ON DELETE CASCADE** (luồng xóa học viên xóa thẳng `dang_ky_hoc`). |

## Phương án đã loại

- **Ghi vào `muc_hoc_chon`** — ghi đè nhu cầu lần 1, mất dữ liệu đối chiếu.
- **Cột mở/đóng gắn thẳng vào khóa** — lần thu sau lại phải thêm cột hoặc ghi đè.
- **Nhu cầu kéo theo chuyển lớp / đề nghị đổi lớp** — trái ADR 0006 N2; nếu cần làm tính năng riêng.
- **Mốc = luôn mức chốt** — không phản ánh lớp học viên thực sự đang học.
- **Quản trị sửa hộ, lưu lịch sử từng lần sửa, trường lý do** — YAGNI ở v1.

## Hệ quả

- **Một migration chỉ thêm 2 bảng** (+ CHECK, FK cascade); không sửa dữ liệu cũ. Deploy vẫn backup theo quy trình.
- Cập nhật CONTEXT.md, `docs/api-contract.md`, `docs/database-ddl.sql`.
- Test e2e: chọn hợp lệ; chọn lên mức cao bị chặn; đợt đóng; nhân viên bị loại; không có mốc; sửa lại lựa chọn; đợt chồng thời gian; xóa học viên có bản ghi nhu cầu.
