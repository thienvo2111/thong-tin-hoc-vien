# Khớp mã MOET bỏ số 0 đầu + đăng nhập bằng SĐT + Quản trị sửa mã MOET

Ngày: 2026-10-09. Trạng thái: đã chốt qua phỏng vấn (grill-me), chưa code.

## Bối cảnh

Sở gửi danh sách mã định danh MOET có số 0 đầu; trường gửi lại xác nhận thì mất số 0 (Excel đổi ô thành số). Học viên gõ mã theo danh sách trường → không khớp `ten_dang_nhap` (khớp chính xác) → không đăng nhập được. Hệ thống đã khảo sát > 50% học viên.

Số liệu production (2026-10-09, `scripts/kiem-tra-ma-moet.sql`):

- 7.666 HV, 100% có mã MOET, 100% chỉ chữ số. 11 số có 1 số 0 đầu: 6.462; 12 số có 1 số 0: 1.152; 10 số không có 0: 39 (mã 11 số mất 0); 13 mã độ dài bất thường (5/8/10/13 số, 1 mã `000…`).
- `ltrim(ma, '0')` **không tạo nhóm trùng nào** → khớp bỏ số 0 đầu an toàn.
- `ten_dang_nhap` HV: 7.092 = mã MOET nguyên văn, 574 = CCCD (hệ thống tự đổi khi HV bổ sung CCCD — `hoc-vien.service.ts` ~dòng 571).
- 111 TK có lần sai, 4 TK đang khóa, 2.154 TK chưa từng đăng nhập.
- `ket_qua_khao_sat` ~9.700 bản ghi, gắn `hoc_vien_id`; hệ thống khảo sát nhận `ma_dinh_danh_moet` qua `/sso/doi-ma` và có thể báo kết quả về theo mã.
- SĐT: 7.627 HV có, đều 10 số sau chuẩn hóa; 8 SĐT dùng chung bởi 16 HV.

## Ràng buộc tối thượng

**KHÔNG thay đổi bất kỳ dữ liệu đã lưu nào** khi deploy. Không migration, không UPDATE dữ liệu, không index mới. Chỉ đổi **logic so khớp**. Giá trị lưu khi import mới giữ nguyên như trong file. Mã gửi sang khảo sát (`/sso/doi-ma`) = giá trị đang lưu, không thêm/bớt số 0.

## Quyết định

### Q-A. Hàm khớp mã MOET dùng chung

- Một helper duy nhất (vd `backend/src/common/ma-moet.util.ts`): `chuanHoaMaMoet(raw)` = bỏ khoảng trắng/dấu chấm/gạch, `ltrim` **toàn bộ** số 0 đầu. Chuỗi rỗng sau chuẩn hóa → không khớp gì.
- Tìm HV theo mã: **ưu tiên khớp chính xác** `hoc_vien.ma_dinh_danh_moet = input`; không có → khớp `ltrim(ma_dinh_danh_moet,'0') = chuanHoaMaMoet(input)` (raw SQL / `$queryRaw` hoặc tương đương). Kết quả phải là **đúng 1** HV; ≥ 2 → coi như không xác định được (không đoán).
- Tìm trên **`hoc_vien.ma_dinh_danh_moet`**, KHÔNG trên `ten_dang_nhap` (574 TK có tên đăng nhập = CCCD vẫn phải đăng nhập được bằng mã MOET).
- Áp dụng ở: đăng nhập + quên mật khẩu (chế độ mã), kiểm tra trùng khi import `ho_so_nhan_su_moet` (mã mới trùng-bỏ-số-0 với hồ sơ có sẵn → lỗi dòng, thông báo rõ "trùng với hồ sơ đã có (khác số 0 đầu)"; trùng trong cùng file cũng theo khóa chuẩn hóa), `resolveHocVienImportRow` (mọi loại import tìm HV theo mã), `POST /sso/ket-qua` khi xác định HV bằng mã, `POST /sso/ma-thu`, ô tìm kiếm quản trị (`contains` với chuỗi đã bỏ số 0 đầu).
- Mã `000…` (1 HV) hay 5/8 số: vẫn khớp theo cùng quy tắc; không xử lý đặc biệt.

### Q-B. Đăng nhập + quên mật khẩu: 2 chế độ

- API `POST /auth/dang-nhap` và `POST /auth/quen-mat-khau`: thêm field **tùy chọn** `kieu_dang_nhap: 'ma' | 'sdt'`, mặc định `'ma'`. Giữ field `ten_dang_nhap` mang giá trị nhập (mã hoặc SĐT) → `TaiKhoanThrottlerGuard` (IP + tên) không đổi. Client cũ không gửi field → hành vi y như cũ + thêm khớp bỏ số 0.
- **Chế độ `ma`**: thứ tự — (1) logic cũ nguyên vẹn (`ten_dang_nhap` khớp chính xác; tài khoản cấp đơn vị/hỗ trợ khớp không phân biệt hoa thường; CCCD); không thấy → (2) khớp mã MOET bỏ số 0 (chỉ tài khoản vai trò `hoc_vien`, qua `hoc_vien_id`). Không ảnh hưởng tài khoản đơn vị/quản trị.
- **Chế độ `sdt`**: chỉ tài khoản `hoc_vien`. Chuẩn hóa: bỏ ký tự không phải số; `84xxxxxxxxx` (11 số) → `0` + 9 số cuối; 9 số không bắt đầu 0 → thêm `0`. So với `hoc_vien.so_dien_thoai_lien_he` chuẩn hóa cùng quy tắc (làm trong SQL bằng `regexp_replace`). Đúng 1 HV → tiếp tục kiểm tra mật khẩu như cũ. 0 hoặc ≥ 2 HV → **cùng lỗi 401 chung** như sai mật khẩu (không lộ SĐT tồn tại/trùng). SĐT trùng = không đăng nhập được bằng SĐT.
- Khóa 5 lần sai / 15 phút, đếm sai, nhật ký giữ nguyên, tính trên tài khoản tìm được.
- Quên mật khẩu: cùng logic tìm; phản hồi chung như hiện tại; chỉ gửi link tới email đã xác minh (không đổi).

### Q-C. Giao diện đăng nhập / quên mật khẩu

- `SegmentedControl` 2 lựa chọn phía trên ô nhập: **"Mã định danh MOET"** | **"Số điện thoại"** (KHÔNG có chữ CCCD trên giao diện). Mặc định "Mã định danh MOET"; nhớ lựa chọn gần nhất trong `localStorage` (try/catch).
- Chế độ mã — gợi ý: "Nhập mã định danh MOET, có hoặc không có số 0 ở đầu đều được." Chế độ SĐT — nhãn "Số điện thoại", gợi ý: "Số điện thoại Thầy/Cô đã cung cấp cho nhà trường, ví dụ 0912345678."
- Khung lỗi đăng nhập thất bại: giữ gợi ý ngày sinh; thêm gợi ý chéo — chế độ mã: "Thử chọn 'Số điện thoại'"; chế độ SĐT: "Nếu số điện thoại dùng chung với người khác hoặc đã thay đổi, hãy chọn 'Mã định danh MOET'."
- Quên mật khẩu: cùng thanh chọn + ghi chú "Chưa xác minh email? Liên hệ nhóm Zalo hỗ trợ của trường để được cấp mật khẩu tạm."
- Validation schema FE theo chế độ (SĐT: 9–12 chữ số sau khi bỏ ký tự lạ).

### Q-D. Hướng dẫn học viên

- Cập nhật `frontend/src/content/huongDan.ts` (mục `#dang-nhap`) và `docs/huong-dan-hoc-vien.html` theo 2 chế độ.
- Tin nhắn mẫu Zalo `docs/tin-nhan-zalo-dang-nhap-moet-sdt.md` (user tự gửi).

### Q-E. Quản trị sửa mã MOET

- `PATCH /hoc-vien/:id/ma-dinh-danh-moet` — chỉ `quan_tri`. Body `{ ma_dinh_danh_moet, ly_do }` (lý do bắt buộc, không rỗng).
- Validate: chỉ chữ số; khác mã hiện tại; **không trùng** (khớp chính xác hoặc bỏ số 0 đầu) với HV khác → 409; độ dài ≠ 11/12 chỉ là cảnh báo FE.
- **Chặn hẳn (409)** khi HV có **bất kỳ** bản ghi `ket_qua_khao_sat` (kể cả `da_mo`): "Học viên đã vào hệ thống khảo sát, không thể đổi mã định danh MOET."
- Transaction: cập nhật `hoc_vien.ma_dinh_danh_moet`; nếu `nguoi_dung.ten_dang_nhap` == mã cũ → đổi sang mã mới (nếu mã mới đã là `ten_dang_nhap` của TK khác → 409); TK có tên đăng nhập = CCCD giữ nguyên. Mật khẩu không đổi. Ghi `lich_su_thay_doi_ho_so` (`truong='ma_dinh_danh_moet'`, cũ/mới, `la_truong_goc_moet=true`, `ly_do`, người sửa) + nhật ký hoạt động theo pattern sẵn có.
- FE: nút "Sửa mã MOET" + modal ở `AdminHocVienChiTiet.tsx`; khi HV đã có khảo sát → nút lưu disabled kèm lý do (BE vẫn chặn).
- Đây là thao tác runtime do quản trị chủ động — không vi phạm ràng buộc "không đổi dữ liệu khi deploy".

### Ngoài phạm vi

- Không sửa 39 mã không có số 0 (quyết định 3a — chờ bên khảo sát xác nhận lưu theo `hoc_vien_id`).
- 13 mã bất thường: 8 HV đã đăng nhập + đã có khảo sát → giữ nguyên; 5 HV chưa đăng nhập/chưa khảo sát → quản trị sửa tay qua Q-E sau khi có mã đúng từ Sở.
- Không unique index (ràng buộc không migration) — chặn trùng ở tầng ứng dụng.
- Không SMS/OTP.

## Kiểm thử (requirement-driven)

Backend e2e/unit: có/không số 0 đầu; mã 12 số; mã `000…`; mã có khoảng trắng; chuỗi toàn số 0; TK tên đăng nhập = CCCD đăng nhập bằng mã MOET; TK đơn vị/quản trị không đổi hành vi; client không gửi `kieu_dang_nhap`; SĐT dạng `0…`, `+84…`, `84…`, có dấu cách/chấm, thiếu số 0; SĐT trùng → 401; SĐT không tồn tại → 401; SĐT của TK không phải học viên → 401; khóa sau 5 lần sai ở chế độ SĐT; quên mật khẩu 2 chế độ; import `ho_so_nhan_su_moet` mã trùng-bỏ-số-0 → lỗi dòng, không tạo HV; import khác tìm HV khi lệch số 0; `/sso/ket-qua` khớp lệch số 0; `/sso/doi-ma` vẫn trả mã nguyên văn; sửa mã: thành công + đồng bộ tên đăng nhập; TK tên = CCCD không đổi tên; thiếu lý do 400; không phải số 400; trùng 409; đã có `ket_qua_khao_sat` (`da_mo`) 409; không phải quan_tri 403; lịch sử được ghi.
FE (vitest): chuyển chế độ đổi nhãn/gợi ý; gửi `kieu_dang_nhap`; gợi ý chéo khi lỗi; nhớ chế độ; modal sửa mã (disabled khi có khảo sát).

## Deploy

Không migration, không đổi dữ liệu. Backup `pg_dump` theo thói quen, `06-deploy.sh` như thường.
