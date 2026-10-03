# ADR 0002 — Tài khoản quản lý cho Sở, Phòng VHXH, Trường

- Ngày: 2026-10-03
- Trạng thái: Đã chấp nhận
- Đặc tả: `docs/superpowers/specs/2026-10-03-tai-khoan-don-vi-design.md`
- Kế hoạch: `docs/superpowers/plans/2026-10-03-tai-khoan-don-vi.md`
- Liên quan: ADR 0001 (Đơn vị đặt hàng, R1/R2) — tài khoản cấp ở đây xem dữ liệu theo R1/R2.

## Bối cảnh

Hệ thống đã có vai trò `so_gddt`, `phong_vhxh`, `truong` và phạm vi xem R1/R2 (ADR 0001) nhưng **không có cách tạo tài khoản** cho các vai trò này: module `nguoi-dung` chỉ có tra cứu và đặt lại mật khẩu học viên; trang admin "Người dùng" là placeholder. Nhiều đơn vị chưa có email người phụ trách — giống học viên (đăng nhập bằng mã, mật khẩu mặc định), Quản trị cần có thể tự tạo và gửi thông tin đăng nhập qua Zalo/công văn.

## Quyết định

| # | Quyết định |
|---|---|
| A1 | Cấp tài khoản cho 3 loại đơn vị: `so_gddt`, `phong_vhxh`, `truong` (vai trò cùng tên với `loai_don_vi`). Không cấp cho `khac` (giữ D4 của ADR 0001). |
| A2 | Đúng **1 tài khoản / đơn vị** (unique index một phần `uq_nguoi_dung_don_vi_quan_ly`). Đổi người phụ trách = sửa chính tài khoản đó. |
| A3 | Hai cách tạo: form tạo lẻ (`POST /nguoi-dung/don-vi`) + nhập Excel hàng loạt (import `tai_khoan_don_vi`, khung import sẵn có). |
| A4 | Email **không bắt buộc**. Mặc định cấp **mật khẩu tạm** (10 ký tự, bỏ ký tự dễ nhầm, chỉ trả 1 lần, buộc đổi lần đầu); có email thì có thể chọn **link kích hoạt** (72 giờ, dùng 1 lần). Hai cách loại trừ nhau: cấp cách này vô hiệu đường vào của cách kia. |
| A5 | Tên đăng nhập = `lower(ma_don_vi)` hoặc **tên gợi nhớ** do Quản trị đặt (vd. `sgd-angiang`), regex `^[a-z0-9][a-z0-9._-]{2,49}$`, lưu chữ thường, trùng kiểm tra không phân biệt hoa/thường trên toàn `nguoi_dung`. |
| A6 | Import Excel: dòng không email → mật khẩu tạm trong **file .xlsx trả về 1 lần** ở response `POST /import/{id}/xac-nhan` (server không lưu); dòng có email → link kích hoạt qua hàng đợi email. |
| A7 | Mở rộng thành phần sẵn có thay vì module song song: `token_xac_thuc` thêm `nguoi_dung_id` (CHECK đúng 1 chủ thể), trang `/dat-lai-mat-khau` dùng chung cho kích hoạt, `ThongBaoService` thêm email "Kích hoạt tài khoản". |

## Sai lệch có chủ đích so với đặc tả

- **Không** chuyển `ten_dang_nhap` cũ sang chữ thường bằng migration (đặc tả §7): tránh đụng ~7.800 tên đăng nhập học viên mà luồng import MOET có thể tra theo giá trị gốc. Thay vào đó chỉ tài khoản đơn vị lưu chữ thường, và đăng nhập khớp chính xác **hoặc** không phân biệt hoa/thường riêng cho `so_gddt`/`phong_vhxh`/`truong`. Học viên/Quản trị đăng nhập như cũ.
- Nhãn ô đăng nhập (M1) và ô quên mật khẩu là "Tên đăng nhập, mã định danh hoặc số CCCD" (đặc tả ghi "Tên đăng nhập / Mã định danh") — giữ gợi ý CCCD cho học viên.

## Hệ quả

- Endpoint mới (chỉ `quan_tri`): `GET /nguoi-dung/don-vi`, `GET /nguoi-dung/don-vi/chua-cap`, `POST /nguoi-dung/don-vi`, `PATCH /nguoi-dung/don-vi/{id}`, `POST /nguoi-dung/don-vi/{id}/cap-mat-khau-tam`, `POST /nguoi-dung/don-vi/{id}/gui-email-kich-hoat`.
- `POST /auth/quen-mat-khau`: tài khoản đơn vị **có email** tự lấy lại mật khẩu; `POST /auth/dat-lai-mat-khau` nhận cả token `kich_hoat_tai_khoan`.
- `POST /import/{id}/xac-nhan` với loại `tai_khoan_don_vi` trả file `.xlsx` thay vì JSON.
- Migration `20261003140000_tai_khoan_don_vi_enum` + `20261003140100_tai_khoan_don_vi` (chỉ thêm/nới ràng buộc, không sửa dữ liệu cũ) — triển khai bằng `scripts/vps/06-deploy.sh` như thường lệ, không cần script kiểm tra trước.
- e2e chạy trên DB riêng qua `backend/.env.test` (không còn ghi dữ liệu test vào DB dev).

## Rủi ro / giới hạn

- Cấp mật khẩu tạm mới / gửi link mới **không** thu hồi JWT đang mở của người phụ trách cũ (JWT không lưu trạng thái; guard chỉ kiểm tra `trang_thai`). Muốn cắt quyền ngay khi đổi người: **Khóa** tài khoản (chặn ngay ở mọi request), cấp mật khẩu mới, rồi **Mở khóa**.
- File mật khẩu tạm tải về máy Quản trị là dữ liệu nhạy cảm — xóa sau khi gửi.
- Link kích hoạt chỉ tới người nhận khi SMTP thật được cấu hình trên VPS; thiếu SMTP vẫn dùng được mật khẩu tạm (email nằm trong hàng đợi).
