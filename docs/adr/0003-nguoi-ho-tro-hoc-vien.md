# ADR 0003 — Tài khoản Người hỗ trợ học viên theo cụm hỗ trợ Zalo

- Ngày: 2026-10-06
- Trạng thái: Đã chấp nhận — Lát 1 (#10), Lát 2 (#11), Lát 4 (yêu cầu hỗ trợ theo cụm, #13) đã code 2026-10-06; Lát 3 (sửa hồ sơ + mật khẩu, #12) chưa
- Đặc tả: [`docs/superpowers/specs/2026-10-06-ho-tro-hoc-vien-design.md`](../superpowers/specs/2026-10-06-ho-tro-hoc-vien-design.md)
- Liên quan: ADR 0002 (tài khoản đơn vị — tái dùng luồng cấp tài khoản), QĐ10 (`cum_hoc_vien`), M8 (`yeu_cau_ho_tro`)

## Bối cảnh

Học viên An Giang phải **đăng nhập cổng mới làm được khảo sát** (quy tắc đã điều chỉnh, thay ghi chú cũ "GĐ1 học viên không đăng nhập"), nên lượng hỗ trợ dồn về: quên mật khẩu, sai thông tin khi đã hết đợt tự sửa, hỏi lịch/link học. Hiện chỉ Quản trị trả lời yêu cầu hỗ trợ và can thiệp tài khoản. HCMUE đã chia học viên thành **cụm hỗ trợ Zalo** (đã gán qua `dang_ky_hoc.cum_id`), mỗi cụm do 1 cán bộ HCMUE phụ trách — cần cho cán bộ đó tài khoản làm việc trên đúng học viên của cụm mình. Sau này sẽ có nhóm hỗ trợ cho giảng viên.

## Quyết định

| # | Quyết định |
|---|---|
| H1 | Phạm vi = **cụm hỗ trợ** `cum_hoc_vien`; học viên thuộc cụm qua `dang_ky_hoc.cum_id` (đúng cụm Zalo Quản trị đã gán). Không suy cụm từ đơn vị công tác. |
| H2 | Vai trò mới **`ho_tro_hoc_vien`** (không phải `ho_tro` — tránh lẫn với `vai_tro_nhan_su_lop.ho_tro` = trợ giảng của lớp, không có tài khoản). `don_vi_id` và `hoc_vien_id` đều NULL. Người hỗ trợ là **cán bộ HCMUE**. |
| H3 | Bảng **`phan_cong_ho_tro (nguoi_dung_id, cum_id)`** nhiều–nhiều. Vận hành thực tế 1 người/1 cụm, schema không ép. Phạm vi kiểm tra **động mỗi request** (không nhét vào JWT) → gỡ phân công có hiệu lực ngay. |
| H4 | Cấp tài khoản tái dùng ADR 0002: trang riêng `/admin/nguoi-ho-tro` (menu "Người hỗ trợ"), tạo lẻ (import Excel hoãn — YAGNI với ~9 cụm); **email bắt buộc**, mặc định link kích hoạt, mật khẩu tạm dự phòng. **Phân công ở màn chi tiết khóa → mục Cụm.** Cụm chưa có người hỗ trợ → nhãn cảnh báo. |
| H5 | Tra cứu (chỉ trong cụm, khu `/ho-tro` riêng, không dùng `/admin`): danh sách học viên, chi tiết (hồ sơ, tài khoản, lớp theo giai đoạn, lịch buổi + giảng viên/trợ giảng của lớp từ `lop_hoc_nhan_su`, điểm danh, khảo sát, ticket, lịch sử sửa), lịch học theo cụm. Học viên ngoài cụm → 404, không lộ "thuộc cụm khác". |
| H6 | **Xuất danh sách cụm** `.xlsx` theo bộ lọc đang áp dụng, 1 sheet/cụm; có họ tên, đơn vị, đối tượng, SĐT, email, lớp theo giai đoạn, tình trạng hồ sơ/đăng nhập/khảo sát; **không có** CCCD, ngày sinh, mã MOET, nơi sinh. Mỗi lần xuất ghi `nhat_ky_hoat_dong`. |
| H7 | **Sửa hồ sơ** qua lõi `suaHoSo` (như `suaHoSoByAdmin`, bỏ qua cổng đợt). Trường được sửa = các trường học viên tự sửa ở M4, **gồm ngày sinh**; **không** sửa số định danh/CCCD, mã MOET, ghi danh/phân lớp/cụm/kết quả. **Bắt buộc lý do** (cột mới `lich_su_thay_doi_ho_so.ly_do`). Đang có đợt mở → hủy xác nhận như hiện tại. |
| H8 | Sửa email (bởi bất kỳ ai không phải chính học viên xác minh) → `email_da_xac_minh = false`. |
| H9 | 3 thao tác tài khoản: (1) gửi link đặt lại mật khẩu — **chỉ tới email đã xác minh**; (2) cấp mật khẩu tạm 10 ký tự hiện 1 lần, buộc đổi lần đầu, ghi `nhat_ky_dat_lai_mat_khau`; (3) mở khóa tạm. **Không** có "đặt lại về ngày sinh" (mật khẩu đoán được, và ngày sinh là trường người hỗ trợ sửa được) — Quản trị giữ thao tác này. |
| H10 | Ticket đi theo cụm **tính động** từ `dang_ky_hoc.cum_id` (không lưu cụm trên ticket); nhiều cụm → mọi người hỗ trợ của các cụm đó đều thấy. Học viên chưa có cụm → chỉ hàng chờ Quản trị (nhãn "Chưa có cụm"). Quản trị vẫn thấy tất cả. |
| H11 | **Trả lời = UPDATE có điều kiện `trang_thai = 'cho_xu_ly'`** cho mọi người (kể cả Quản trị); 0 dòng → 409, frontend giữ nguyên nội dung đang soạn + hiện câu trả lời đã có. **Không** có khóa mềm "đang trả lời" (1 người/1 cụm). Giữ mô hình 1 hỏi – 1 đáp, hỏi tiếp = ticket mới (cờ `hoi_lai`). |
| H12 | Chỉ **Quản trị** "Sửa câu trả lời" (kể cả ticket đã đóng): lưu `thoi_gian_sua_tra_loi`/`sua_tra_loi_boi`, nội dung cũ vào `nhat_ky_hoat_dong`; email học viên (sự kiện mới `yeu_cau_ho_tro_cap_nhat_tra_loi`, hàng đợi thường); cổng hiện "Đã cập nhật lúc …"; **reset `danh_gia` về NULL**; hạn tự đóng tính lại từ lúc sửa, `hoi_lai` vẫn tính từ `thoi_gian_phan_hoi` gốc. Người hỗ trợ thấy nhãn "Quản trị đã sửa". |
| H13 | Báo ticket mới cho người hỗ trợ = **số đếm `cho_xu_ly` trên menu**, không email từng ticket (bảo vệ `EMAIL_DAILY_LIMIT` dùng chung). |
| H14 | Học viên thấy câu trả lời ký **"Cụm hỗ trợ N"** (tên cụm), không thấy họ tên/SĐT/email cán bộ. Cổng có thẻ "Cụm hỗ trợ của bạn + Vào nhóm Zalo" lấy từ DB. Khi đã đăng nhập, **DB là nguồn sự thật**; `frontend/src/content/nhomZaloTheoCum.ts` chỉ là bản tra cứu công khai cho người chưa đăng nhập — Quản trị giữ 2 nguồn khớp nhau. |

## Chuẩn bị cho Người hỗ trợ giảng viên (chưa làm — YAGNI)

- Mẫu vai trò `ho_tro_<doi_tuong>`; mỗi vai trò 1 bảng phân công riêng theo đơn vị phạm vi của đối tượng (vd. lớp/khóa cho giảng viên) + **1 service phạm vi riêng** (`HoTroHocVienScopeService` là mẫu) — không thêm nhánh vào `ScopeService` của cây đơn vị.
- **1 tài khoản = 1 vai trò**: cán bộ vừa hỗ trợ học viên vừa hỗ trợ giảng viên dùng **2 tài khoản** (đã chấp nhận). Không làm đa vai trò.
- Nợ có chủ đích: `yeu_cau_ho_tro.hoc_vien_id NOT NULL` — khi giảng viên gửi được yêu cầu thì tổng quát thành người gửi (`nguoi_dung`). Tiên quyết: thực thể `GiangVien` (T10/T11).

## Hệ quả

- Thay đổi hành vi Quản trị: **không còn trả lời đè** ticket `da_phan_hoi` (trước đây `traLoi` ghi đè, chỉ chặn `da_dong`) — coi là sửa lỗi mất dữ liệu; đính chính dùng "Sửa câu trả lời".
- Migration: enum `ho_tro_hoc_vien` và `yeu_cau_ho_tro_cap_nhat_tra_loi` mỗi giá trị **migration riêng** (quy ước `ALTER TYPE ADD VALUE`), rồi bảng `phan_cong_ho_tro`, cột `lich_su_thay_doi_ho_so.ly_do`, `yeu_cau_ho_tro.thoi_gian_sua_tra_loi`/`sua_tra_loi_boi`, CHECK vai trò ↔ `don_vi_id`/`hoc_vien_id`. Chỉ thêm, không sửa dữ liệu cũ.
- Trước khi bàn giao: đếm học viên chưa có `cum_id` trong khóa đang triển khai (ticket của họ chỉ tới Quản trị).

## Rủi ro / giới hạn

- Mật khẩu tạm / link mới không thu hồi JWT đang mở của học viên (giống ADR 0002).
- Tài khoản người hỗ trợ bị lộ → sửa được hồ sơ cả cụm; giảm thiểu: H8 + H9(1) chặn chiếm tài khoản qua email, mọi thao tác có lý do/nhật ký, Quản trị Khóa tài khoản chặn ngay.
- File xuất nằm trên máy cá nhân — đã tối thiểu hóa cột (H6).
