# ADR 0015 — Cổng đơn vị: Danh sách tham gia và Hợp đồng bồi dưỡng cho nhiều chương trình

- Ngày: 2026-11-17
- Trạng thái: đã chấp nhận (thiết kế), chưa code
- Nguồn: map [#43](https://github.com/thienvo2111/thong-tin-hoc-vien/issues/43), ticket [#45](https://github.com/thienvo2111/thong-tin-hoc-vien/issues/45); research [#50](https://github.com/thienvo2111/thong-tin-hoc-vien/issues/50) (nhánh `research/ten-mien-thu-hai`)
- Liên quan: ADR 0001 (đơn vị đặt hàng, R1/R2), ADR 0002 (tài khoản đơn vị)

## Bối cảnh

HCMUE cần các trường phổ thông **xác nhận danh sách GV tham gia** và **khai thông tin làm hợp đồng** (thay Google Form "Thông tin làm hợp đồng bồi dưỡng NLS An Giang 2026"). Ngoài NLS còn chương trình **Bồi dưỡng HSG cho GV THCS** (HSG An Giang 2026: 682 GV, 43 trường, đã học xong), danh sách đang nằm ở Excel ngoài hệ thống. Trường tham gia cả hai phải khai thông tin đơn vị **một lần**; trường mới chỉ có HSG sau này vào NLS dùng lại được. HSG **không** được xuất hiện trên trang boiduongnls, nhưng lý do chỉ là tên miền/thương hiệu.

## Quyết định

| # | Quyết định |
|---|---|
| C1 | **Một hệ thống** (1 codebase, 1 DB, 1 bộ tài khoản). Không tách NLS/HSG, không SSO. |
| C2 | Tách theo tên miền: **boiduongnls** = học viên NLS + cán bộ HCMUE; **Cổng đơn vị** (tên miền trung tính) = trường/Sở/Phòng (mọi màn của đơn vị, chuyển hết khỏi boiduongnls) + Quản trị làm phần hợp đồng. |
| M1 | Bảng mới **`dot_trien_khai`** (chương trình, tên, đơn giá, khoảng ngày hợp lệ của QĐ chỉ định thầu). NLS: `khoa_boi_duong.dot_trien_khai_id` (NULL được, 1 đợt nhiều khóa). HSG: đợt không có khóa. **Không** biến HSG thành `khoa_boi_duong`. |
| M2 | Chương trình = enum **`chuong_trinh_boi_duong` (`nls`, `hsg`)**, không bảng danh mục. |
| M3 | **Một bảng Danh sách tham gia chung**: mỗi dòng = 1 người trong (đợt, trường) — họ tên, ngày sinh, giới tính, mã gốc, `don_vi_id` (trường tính suất), `ty_le_suat` (1 / 0,5), ghi chú, `hoc_vien_id` (NULL được). HSG nạp Excel; NLS do Quản trị **chụp** từ `dang_ky_hoc` ("Lấy danh sách từ khóa"), không đọc sống. Người bị thay **trước khi khóa bắt đầu** không là dòng (chỉ nằm trong ghi chú người thay); bị thay **giữa chừng** thì vẫn là dòng (xem S2). GV HSG **không** ghi vào `hoc_vien`. |
| S1 | Học đủ mọi giai đoạn = 1 suất; học ≥ 1 nhưng chưa đủ = 0,5 suất (đối xứng: chỉ GĐ1 hay chỉ GĐ2 đều 0,5). |
| S2 | Thay thế giữa chừng: người cũ và người mới mỗi người 0,5 (người cũ giữ dòng, ghi chú "đã được thay"); thay trước khi bắt đầu: người thay nhận 1. |
| S3 | Nguồn "giai đoạn tham gia": HSG = cột Excel "Giai đoạn tham gia" (Cả 2 / Chỉ GĐ1 / Chỉ GĐ2, trống = cả 2) do HCMUE điền; NLS = `phan_lop_giai_doan` (không theo điểm danh). Quản trị sửa tay `ty_le_suat` từng dòng, bắt buộc lý do. |
| S4 | Một đơn giá / đợt (số nguyên VNĐ), Quản trị nhập (được để trống tới khi có); **không** ghi đè giá trị từng hợp đồng. Đơn giá trống → hợp đồng chưa có giá trị, chưa nộp được. |
| S5 | Giá trị = Σ `ty_le_suat` × đơn giá, làm tròn đến đồng; ≥ 50.000.000 (không cộng thuế GTGT — dịch vụ đào tạo không chịu thuế) → bắt buộc Phần 4. |
| S6 | Khoảng ngày QĐ chỉ định thầu (từ–đến, tính cả hai đầu) cấu hình theo đợt; ngày ngoài khoảng **chặn nộp**. |
| M4 | Bảng **`ho_so_don_vi`**, 1–1 với `don_vi_cong_tac`, cột có kiểu cho Phần 1, 2, 5 và hậu cần CSVC. |
| M5 | Bảng **`hop_dong_boi_duong`**, UNIQUE (đợt, trường): trạng thái xác nhận danh sách + trạng thái hợp đồng (2 cột), Phần 3–4, cờ điểm học trực tiếp, **bản chụp Hồ sơ đơn vị JSONB** lúc nộp. Số lượng/giá trị tính từ danh sách khi nháp, chụp lại khi nộp. |
| M6 | Mọi dòng danh sách **bắt buộc** gắn `don_vi_cong_tac` loại `truong` có sẵn; nạp Excel chặn dòng không khớp trường. |

## Lựa chọn đã loại

- **Tách 2 hệ thống + trang hợp đồng riêng có SSO**: nhân đôi codebase, phải đồng bộ danh mục trường/tài khoản giữa các DB và dựng SSO — giá quá đắt cho vấn đề chỉ là thương hiệu.
- **HSG là một `khoa_boi_duong`**: HSG hiện lẫn vào mọi màn/thống kê khóa NLS.
- **GV HSG ghi vào `hoc_vien`**: nhiễm mọi thống kê NLS đếm `hoc_vien` theo trường, tạo trùng người có cả hồ sơ NLS.
- **Danh sách NLS đọc sống từ `dang_ky_hoc`**: danh sách trường đã xác nhận tự đổi khi Quản trị sửa ghi danh; 2 đường tính giá trị hợp đồng.

## Hệ quả

- Giá trị hợp đồng = Σ `ty_le_suat` × đơn giá của đợt — một đường tính cho mọi chương trình (quy tắc gán `ty_le_suat`: ticket #46).
- Xóa cứng học viên (PRD #29) không được xóa dòng danh sách đã chụp: FK `hoc_vien_id` để `SET NULL`.
- Phạm vi Sở/Phòng trên danh sách/hợp đồng suy từ `don_vi_id` qua `ScopeService` sẵn có.
- Thêm migration (bảng mới + cột `dot_trien_khai_id` NULL được, enum mới) — chỉ thêm, không sửa dữ liệu cũ.
- Hợp nhất GV HSG với hồ sơ NLS để sau: `hoc_vien_id` trên dòng HSG là chỗ cắm khi khớp được.
