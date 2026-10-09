# ADR 0005 — Điểm danh lớp Zoom bằng cú bấm "Điểm danh & vào Zoom"

- Ngày: 2026-10-09
- Trạng thái: Đã chấp nhận — chưa code
- Đặc tả: [`docs/superpowers/specs/2026-10-09-diem-danh-zoom-design.md`](../superpowers/specs/2026-10-09-diem-danh-zoom-design.md)
- Liên quan: T12 (`diem_danh`), ADR 0004 (G8 giảng viên chỉ đọc, G12 hỗ trợ GV nạp điểm danh, G13 báo vắng "có mặt luôn thắng", G14 đổi lớp), spec phân lớp theo giai đoạn 2026-10-02

## Bối cảnh

Lớp Zoom có nhiều buổi; điểm danh hiện chỉ nhập bằng import Excel sau buổi học, nặng cho vận hành. Cổng đã có nút vào Zoom từng buổi. Muốn dùng chính cú bấm đó làm điểm danh, có cửa sổ thời gian, mà không phá dữ liệu import, quy tắc báo vắng và phân quyền ADR 0004.

## Quyết định

| # | Quyết định |
|---|---|
| Z1 | Chỉ lớp `zoom`, bật **theo khóa** (`khoa_boi_duong.bat_diem_danh_zoom_luc`). Tắt = hành vi cũ. Lớp trực tiếp vẫn giấy + import. |
| Z2 | Cửa sổ = `[bắt đầu − mo_truoc, bắt đầu + dong_sau]`, mặc định 30'/120', **cấu hình theo khóa**, tính theo giờ máy chủ, không cắt theo giờ kết thúc. Sớm → **không mở Zoom**; muộn → vẫn mở Zoom kèm cảnh báo không ghi nhận. |
| Z3 | Cú bấm chỉ **tạo** `co_mat`/`zoom` khi chưa có dòng, lưu `tu_diem_danh_luc`. **Import Excel luôn ghi đè** trạng thái (giữ `tu_diem_danh_luc`). |
| Z4 | **Giấu link Zoom với học viên** khi khóa bật (API trang lớp, email lịch học, nút cấp giai đoạn); link chỉ trả qua `POST /lich-hoc/:id/vao-hoc` khi đang mở hoặc đã đóng. Nhân sự vẫn thấy link. Chấp nhận không chặn được chia sẻ link sau khi vào phòng — cú bấm là tín hiệu tự khai, báo cáo Zoom (import) là nguồn đối chiếu. |
| Z5 | Mỗi buổi bấm riêng — kể cả sáng/chiều chung phòng Zoom; không suy "đã vào sáng ⇒ có mặt chiều". |
| Z6 | Hết cửa sổ → cron **chốt vắng** (`vang`, hoặc `vang_co_phep` nếu có báo vắng) cho học viên của lớp ở giai đoạn đó chưa có dòng; đánh dấu `lich_hoc_lop.chot_diem_danh_luc`. Không chốt buổi chưa có link, buổi bắt đầu trước mốc bật, không chốt lại buổi đã chốt. |
| Z7 | Sửa nhanh từng ô: **giữ ADR 0004** — `ho_tro_giang_vien` trong khóa (≤ 3 ngày sau buổi) và `quan_tri` (mọi lúc); `giang_vien` chỉ đọc; `ho_tro_hoc_vien` chỉ báo vắng. Ghi `nguon = thu_cong`, `nguoi_sua`. |
| Z8 | **Chuyển lớp không xóa điểm danh lớp cũ.** Chuyên cần tính theo `(giai_doan, buoi_so)` bằng 1 hàm, chế độ theo khóa `che_do_chuyen_can`: `theo_lop_hien_tai` (mặc định — học lại toàn bộ) hoặc `cong_nhan_lop_cu` (lấy kết quả tốt nhất giữa các lớp cùng giai đoạn). Giả định: các lớp Zoom cùng giai đoạn dạy cùng nội dung theo `buoi_so`. |

## Phương án đã loại

- **Không chốt vắng, để trống** — thống kê chuyên cần (chỉ đếm dòng đã có) sẽ báo ~100% có mặt.
- **Mở Zoom ngay sau POST** (không hộp thoại) — bị chặn trên Safari iOS/trình duyệt Zalo; học viên không thấy xác nhận.
- **Cho giảng viên sửa điểm danh** — trái G8 ADR 0004; hỗ trợ GV đã có quyền và thường có mặt trong phòng.
- **Cấu hình cửa sổ bằng `.env` hoặc theo buổi** — `.env` cần deploy để đổi; theo buổi quá chi tiết (YAGNI).
- **Xóa điểm danh lớp cũ khi chuyển lớp** — mất bằng chứng, không đổi được chính sách về sau.

## Hệ quả

- Migration chỉ thêm: 2 cột `diem_danh`, 1 cột `lich_hoc_lop`, 4 cột `khoa_boi_duong` + enum mới `che_do_chuyen_can`.
- Thêm 1 cron (5 phút) — khác G10 ADR 0004 (G10 chỉ cấm cron **nhắc lịch**).
- G12: buổi có điểm danh không đổi giờ được → với tự điểm danh, buổi bị khóa giờ từ lần bấm đầu tiên (~30' trước giờ học).
- Dashboard chuyên cần đổi sang hàm chuyên cần → sửa lỗi đếm 1 học viên 2 lần khi có dòng ở 2 lớp cùng buổi số.
- Phụ thuộc đồng hồ máy chủ: phải bật NTP trên VPS trước khi bật tính năng.
