# Hệ thống thu thập thông tin học viên

Công cụ phối hợp giữa Sở Giáo dục & Đào tạo, Phòng Văn hóa - Xã hội (UBND cấp Xã), Trường/đơn vị đào tạo và học viên để thu thập, quản lý thông tin học viên tham gia các khóa bồi dưỡng.

## Trạng thái

Đang ở giai đoạn **thiết kế** (chưa có code triển khai). Bản thiết kế đầy đủ (kiến trúc hệ thống, mô hình dữ liệu, sơ đồ use case, wireframe màn hình, lộ trình triển khai) nằm ở:

- **Canvas thiết kế (bản sống, chỉnh sửa được):** https://claude.ai/artifact/7RrH2dCcRYi6VsUgqVNRoc
- **Bản export tĩnh (snapshot):** thư mục [`design/`](design/) trong repo này — mỗi file `.dc.html` là một board của canvas, `canvas.json` là bố cục.

## Nội dung thiết kế

| Board | Nội dung |
|---|---|
| `Main.dc.html` | Kiến trúc hệ thống (4 tầng: người dùng, frontend, backend services, dữ liệu) |
| `MoHinhDuLieu.dc.html` | ERD: HocVien, DiaDanh, DonViCongTac, NguoiDung, MonHoc, NhatKyImport |
| `MoHinhKhoaHoc.dc.html` | ERD: KhoaBoiDuong, GiaiDoanKhoa, LopHoc, LichHocLop, LopHoc_NhanSu, DangKyHoc |
| `SoDoUseCase.dc.html` | Sơ đồ use case theo tác nhân (Trường, Sở, Phòng VHXH, Học viên, Quản trị hệ thống) |
| `FormNhapThongTin.dc.html` | Wireframe: form học viên tự khai báo thông tin |
| `XacNhanThongTin.dc.html` | Wireframe: màn hình xem lại & xác nhận trước khi lưu chính thức |
| `QuanLyDanhMuc.dc.html` | Wireframe: quản trị & import danh mục dùng chung |
| `LoTrinhTrienKhai.dc.html` | Lộ trình triển khai đề xuất (~11 tuần, 5 giai đoạn) |

## Các quyết định thiết kế chính

Xem chi tiết đầy đủ trong các board ở trên. Tóm tắt:

- **Chính quyền 2 cấp:** không còn Phòng Giáo dục cấp huyện. Sở GD&ĐT quản lý trực tiếp Trường THPT; Phòng Văn hóa - Xã hội (thuộc UBND cấp Xã) quản lý Trường Mầm non/Tiểu học/THCS trên địa bàn.
- **Duyệt hồ sơ theo cấp giảng dạy của từng học viên** (`HocVien.cap_giang_day`), không theo trường — đúng cho cả trường liên cấp.
- **Phân quyền scope-based:** suy ra động qua cây `DonViCongTac.don_vi_cha_id`, không có bảng phân quyền riêng. Cấp trên (Sở) duyệt thay được cấp dưới (Phòng VHXH).
- **Khóa bồi dưỡng do Trường tự tạo & quản lý**, Sở/Phòng VHXH chỉ duyệt danh sách & xem thống kê.
- **Học viên là tác nhân tự phục vụ:** tự đăng ký, tài khoản tự sinh (tên đăng nhập = ĐDCN, mật khẩu mặc định = ngày sinh) — bắt buộc đổi mật khẩu lần đầu.
- **Màn hình xác nhận bắt buộc** trước khi lưu chính thức + gửi email bản sao dữ liệu ngay sau khi lưu.
- **Phân lớp học viên do Quản trị hệ thống thực hiện qua Import** (Excel/CSV), không thao tác tay từng người.
- **Mọi dữ liệu chọn lựa** (địa danh, đơn vị công tác, môn học) đều là khóa ngoại vào danh mục dùng chung, import được qua Excel/CSV có validate theo dòng — không nhập tự do.
- **Chuyên môn đào tạo** là text tự do có gợi ý autocomplete (không phải danh mục do admin quản lý) — chấp nhận dữ liệu không đồng nhất 100%, chưa cần bước chuẩn hóa thủ công.

## Bước tiếp theo

Soạn tài liệu kỹ thuật chính thức từ bộ thiết kế này: API contract (REST endpoints theo từng dịch vụ), DDL PostgreSQL đầy đủ (constraints, index, enum), checklist quy tắc ràng buộc/validate — rồi triển khai.
