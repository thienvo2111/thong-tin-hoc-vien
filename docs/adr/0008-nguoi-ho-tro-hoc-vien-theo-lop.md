# ADR 0008 — Người hỗ trợ học viên được gắn vào lớp (ngoài cụm) + xuất danh sách lớp

- Ngày: 2026-10-16
- Trạng thái: Đã chấp nhận
- Bổ sung (không thay thế): ADR 0003 — phân công theo **cụm** (`phan_cong_ho_tro`) giữ nguyên
- Đặc tả: [2026-10-16-ho-tro-theo-lop-design.md](../superpowers/specs/2026-10-16-ho-tro-theo-lop-design.md)

## Bối cảnh

Lớp Zoom có nhân sự hỗ trợ riêng theo lớp (mở phòng, điểm danh, nhắn học viên vào học), không theo cụm Zalo địa lý. Có người vừa hỗ trợ một cụm vừa hỗ trợ lớp Zoom; có người hỗ trợ nhiều lớp Zoom cùng lúc. Hiện người hỗ trợ học viên chỉ thấy học viên trong cụm của mình (ADR 0003 H1/H3), nên với học viên lớp mình phụ trách nhưng ở cụm khác thì không tra cứu, không sửa hồ sơ, không cấp lại mật khẩu được, và không có danh sách lớp để đối chiếu khi điểm danh.

## Quyết định

| # | Quyết định |
|---|---|
| L1 | **Bảng phân công lớp, cùng vai trò `ho_tro_hoc_vien`.** Bảng mới `phan_cong_ho_tro_lop (nguoi_dung_id, lop_id)` nhiều–nhiều, song song `phan_cong_ho_tro` (cụm). Chỉ nhận tài khoản `vai_tro = 'ho_tro_hoc_vien'`. Không tạo vai trò/tài khoản mới — 1 người vừa giữ cụm vừa giữ lớp dùng 1 tài khoản. Quản trị gán qua `PUT /khoa-boi-duong/{id}/lop/{lopId}/nguoi-ho-tro` (thay toàn bộ, rỗng = gỡ hết) ở bảng Lớp học của chi tiết khóa. |
| L2 | **Phạm vi = cụm ∪ lớp gốc.** Học viên thuộc phạm vi khi có `dang_ky_hoc` thuộc cụm của tôi **hoặc** có `phan_lop_giai_doan` vào lớp được gắn. **Đổi buổi không tính** (nhất quán ADR 0007: đọc theo lớp giữ lớp gốc). `HoTroHocVienScopeService` vẫn là điểm kiểm tra duy nhất, truy vấn động mỗi request (gỡ phân công có hiệu lực ngay); ngoài phạm vi vẫn `404`. |
| L3 | **Quyền với học viên của lớp = như học viên trong cụm**: tra cứu chi tiết, sửa hồ sơ (bắt buộc lý do), gửi link đặt lại/cấp mật khẩu tạm/mở khóa, báo vắng, đề nghị đổi lớp (đăng ký học được chọn khi thuộc cụm của tôi **hoặc** có phân lớp vào lớp của tôi). |
| L4 | **Vẫn chỉ theo cụm**: định tuyến yêu cầu hỗ trợ, nhắc lịch cụm, thống kê, duyệt đổi buổi, danh sách học viên hiện có (`GET /ho-tro-hoc-vien/hoc-vien` + `/xuat`), lịch học. Người hỗ trợ lớp xem học viên lớp qua trang riêng `/ho-tro/lop`. |
| L5 | **Excel lớp có NGÀY SINH** theo yêu cầu người dùng (đối chiếu khi hỗ trợ Zoom). Rủi ro: ngày sinh là mật khẩu mặc định, file có thể bị chuyển qua Zalo — người dùng **chấp nhận**. Vẫn **không** có CCCD/số định danh, mã MOET, nơi sinh. ADR 0003 H6 (không ngày sinh) chỉ áp cho file **cụm**. Mỗi lần xuất ghi nhật ký `ho_tro_xuat_danh_sach_lop`. |
| L6 | **Gán theo lớp, không theo buổi.** Một lớp có thể nhiều người hỗ trợ; một người nhiều lớp. |

## Phương án đã loại

- **Gắn theo từng buổi (`lich_hoc_lop`)** — Quản trị phải gán quá nhiều (lớp Zoom nhiều buổi × nhiều giai đoạn), dễ sót.
- **Nối `lop_hoc_nhan_su` (vai trò hỗ trợ, chữ tự do từ import) với tài khoản** — dữ liệu nhập tay không khóa, khớp theo tên dễ sai, trộn thông tin liên hệ với phân quyền.
- **Tài khoản/vai trò riêng cho hỗ trợ Zoom** — người làm cả cụm lẫn lớp phải có 2 tài khoản, 2 lần đăng nhập, quyền tách rời trên cùng một học viên.

## Hệ quả

- 1 migration chỉ thêm bảng (`20261016200000_phan_cong_ho_tro_lop`), không đụng dữ liệu cũ; sau deploy chưa ai được gắn lớp — hành vi hiện có không đổi.
- `GET /khoa-boi-duong/{id}` trả thêm `lop_hoc[].nguoi_ho_tro` (chỉ Quản trị); `GET /nguoi-dung/ho-tro` thêm `lop_phu_trach`.
- API mới cho người hỗ trợ: `GET /ho-tro-hoc-vien/lop-cua-toi`, `GET /ho-tro-hoc-vien/lop/{lopId}/hoc-vien`, `GET /ho-tro-hoc-vien/lop/xuat`.
- Người hỗ trợ lớp thấy được hồ sơ học viên ở cụm khác — chấp nhận vì cùng là cán bộ HCMUE hỗ trợ học viên đó trong lớp.
- Học viên đổi buổi **vào** lớp của tôi không nằm trong danh sách/phạm vi của tôi; người hỗ trợ cụm của học viên đó vẫn xử lý.
