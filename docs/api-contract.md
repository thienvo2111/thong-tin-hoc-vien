# API Contract — Hệ thống thu thập thông tin học viên

Sinh từ bộ thiết kế: [canvas](https://claude.ai/artifact/7RrH2dCcRYi6VsUgqVNRoc) (board `Main.dc.html` — kiến trúc 7 dịch vụ backend). Tham chiếu bảng dữ liệu: [`database-ddl.sql`](database-ddl.sql). Quy tắc validate chi tiết: [`validation-checklist.md`](validation-checklist.md).

Định dạng chung: REST + JSON, `Content-Type: application/json` trừ endpoint upload file (`multipart/form-data`). Mọi timestamp là ISO 8601 UTC. Mọi id là UUID v4.

## Quy ước chung

### Auth
Mọi endpoint (trừ `POST /auth/dang-nhap` và `POST /hoc-vien` — đăng ký) yêu cầu header `Authorization: Bearer <token>`.

### Phân quyền scope-based (không bảng phân quyền riêng)
Middleware xác định phạm vi truy cập của mỗi request bằng cách đi lên cây `don_vi_cong_tac.don_vi_cha_id` từ `nguoi_dung.don_vi_id` của người gọi:

| `vai_tro` | Phạm vi mặc định |
|---|---|
| `quan_tri` | Toàn hệ thống |
| `so_gddt` | Đơn vị mình + mọi đơn vị con trong cây (kể cả Phòng VHXH, Trường mọi cấp trong tỉnh) |
| `phong_vhxh` | Đơn vị mình + Trường MN/Tiểu học/THCS trên địa bàn xã mình |
| `truong` | Chỉ đơn vị mình |
| `hoc_vien` | Chỉ hồ sơ của chính mình (qua `nguoi_dung.hoc_vien_id`) |

Endpoint trả **403** nếu tài nguyên yêu cầu nằm ngoài phạm vi trên. Không có bảng ACL riêng — thay đổi phạm vi = thay đổi `don_vi_cha_id` trong cây.

### Lỗi
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": [ { "field": "so_dinh_danh_ca_nhan", "message": "Phải gồm đúng 12 chữ số" } ] } }
```
Mã lỗi chuẩn: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409 — trùng ĐDCN, trùng mã danh mục...), `ACCOUNT_LOCKED` (423 — tài khoản tạm khóa sau nhiều lần đăng nhập sai, xem mục T1 `mo-rong-nls-an-giang.md`; body kèm `khoa_den` ISO), `RATE_LIMITED` (429 — vượt giới hạn tần suất theo IP), `INTERNAL` (500).

### Phân trang
`?page=1&page_size=20` (mặc định), response bọc `{ "data": [...], "total": N, "page": 1, "page_size": 20 }`.

---

## 1. Auth & Phân quyền

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| POST | `/auth/dang-nhap` | `{ ten_dang_nhap, mat_khau }` → `{ token, phai_doi_mat_khau, nguoi_dung }`. `ten_dang_nhap` = `nguoi_dung.ten_dang_nhap`, gán 1 lần lúc tạo tài khoản và **không đổi theo dữ liệu hồ sơ về sau**: ĐDCN (Học viên tự đăng ký), Mã định danh CSDL MOET (Học viên do Quản trị import), hoặc email (Sở/Phòng/Trường/QuảnTrị). **T1 (2026-09-28):** sai tên đăng nhập và sai mật khẩu trả cùng thông báo (không lộ tài khoản tồn tại); sai 5 lần liên tiếp → khóa 15 phút, các lần gọi trong lúc khóa trả `423 ACCOUNT_LOCKED` (không kiểm tra mật khẩu); giới hạn 20 request/phút cho mỗi cặp IP + `ten_dang_nhap` (`429 RATE_LIMITED`; 2026-10-07 đổi từ 10/phút theo IP vì người dùng sau proxy HCMUE/NAT chung IP) **ADR 0002 (2026-10-03):** tài khoản đơn vị (`so_gddt`/`phong_vhxh`/`truong`) khớp `ten_dang_nhap` **không phân biệt hoa/thường** (lưu chữ thường); học viên/Quản trị vẫn khớp chính xác như cũ. | Công khai |
| POST | `/auth/dang-xuat` | Vô hiệu hóa token hiện tại. **Làm rõ 2026-09-28**: JWT vốn stateless, "vô hiệu hóa" nghĩa là ghi `jti` của token vào bảng thu hồi (`token_thu_hoi`, xem `database-ddl.sql`) tới hết hạn tự nhiên của nó; `JwtAuthGuard` phải tra bảng này trên mọi request, không chỉ giải mã chữ ký | Đã đăng nhập |
| POST | `/auth/doi-mat-khau` | `{ mat_khau_cu, mat_khau_moi }` — bắt buộc nếu `phai_doi_mat_khau=true`. **T1 (2026-09-28):** `mat_khau_moi` phải ≥8 ký tự, có cả chữ và số, khác `mat_khau_cu`, và (nếu tài khoản gắn hồ sơ học viên) khác chuỗi ngày sinh `ddmmyyyy` — vi phạm trả `400 VALIDATION_ERROR` kèm `fields` | Đã đăng nhập |
| GET | `/auth/toi` | Thông tin tài khoản hiện tại + phạm vi quyền suy ra | Đã đăng nhập |
| POST | `/auth/quen-mat-khau` | **Thêm 2026-09-30**: `{ ten_dang_nhap }` (chấp nhận `ten_dang_nhap` hoặc `so_dinh_danh_ca_nhan`, cùng logic tìm tài khoản với `POST /auth/dang-nhap`). Chỉ thực sự tạo token + gửi email khi tìm thấy tài khoản `vai_tro='hoc_vien'` **và** có `email_lien_he` **và** `hoc_vien.email_da_xac_minh=true`; **LUÔN** trả `{ da_gui: true }` bất kể có thỏa điều kiện hay không — không tiết lộ tài khoản có tồn tại/có email đã xác minh hay không (cùng nguyên tắc rule #9/#55). Giới hạn 20 request/phút cho mỗi cặp IP + `ten_dang_nhap` (`429 RATE_LIMITED`, dùng chung `TaiKhoanThrottlerGuard` với `/auth/dang-nhap`). Xem mục "Xác minh email liên hệ & quên/đặt lại mật khẩu" bên dưới **ADR 0002 (2026-10-03):** thêm nhánh tài khoản đơn vị `active` **có `email`** → token `dat_lai_mat_khau` gắn `nguoi_dung_id` (30 phút, chặn tạo lại trong 60 giây) + email đặt lại mật khẩu; response vẫn luôn `{ da_gui: true }`. | Công khai |
| POST | `/auth/dat-lai-mat-khau` | **Thêm 2026-09-30**: `{ token, mat_khau_moi }`. `token` phải hợp lệ, đúng loại `dat_lai_mat_khau`, chưa hết hạn, chưa dùng — sai bất kỳ điều kiện nào trả chung `400 VALIDATION_ERROR` với 1 thông báo (không tiết lộ lý do cụ thể). `mat_khau_moi` theo cùng độ phức tạp rule #56 (`POST /auth/doi-mat-khau`), riêng "khác mật khẩu cũ" so bằng `bcrypt.compare` (không có mật khẩu cũ dạng chữ rõ). Thành công: cập nhật `mat_khau_hash`, `phai_doi_mat_khau=false`, đánh dấu token đã dùng, vô hiệu mọi token `dat_lai_mat_khau` chưa dùng khác của cùng học viên **ADR 0002 (2026-10-03):** nhận cả token loại `kich_hoat_tai_khoan` (link kích hoạt tài khoản đơn vị, 72 giờ); token gắn `hoc_vien_id` (học viên, như cũ) hoặc `nguoi_dung_id` (tài khoản đơn vị); thành công vô hiệu mọi token chưa dùng **cùng loại** của cùng chủ thể. | Công khai |
| POST | `/auth/xac-minh-email` | **Thêm 2026-09-30**: `{ token }`. `token` phải hợp lệ, đúng loại `xac_minh_email`, chưa hết hạn, chưa dùng — sai trả chung `400 VALIDATION_ERROR` với 1 thông báo (không tiết lộ lý do). Thành công: `hoc_vien.email_da_xac_minh=true`, đánh dấu token đã dùng | Công khai |

### Quản lý tài khoản (T1, 2026-09-28 — mới, không thuộc 7 dịch vụ gốc của canvas)

Thao tác Quản trị lên tài khoản **người khác** (khác `/auth/*`, luôn thao tác lên chính tài khoản đang đăng nhập) — hỗ trợ N4 khi học viên gọi hỗ trợ quên mật khẩu/bị khóa.

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| POST | `/nguoi-dung/{id}/dat-lai-mat-khau` | Đặt lại mật khẩu về ngày sinh `ddmmyyyy` của hồ sơ, `phai_doi_mat_khau=true`, xóa `khoa_den`/bộ đếm sai (mở khóa ngay nếu đang khóa). Chỉ áp dụng tài khoản `vai_tro='hoc_vien'` (mật khẩu mặc định suy từ ngày sinh hồ sơ — không có khái niệm này cho Sở/Phòng/Trường/QuảnTrị) — gọi cho tài khoản khác trả `400 VALIDATION_ERROR`. Ghi 1 dòng `nhat_ky_dat_lai_mat_khau` (ai đặt lại, cho ai, lúc nào). Quy trình vận hành: N4 xác minh người gọi (họ tên + ngày sinh + đơn vị + SĐT khớp hồ sơ) trước khi gọi endpoint này | Quản trị |
| GET | `/nguoi-dung?q=` | Tìm tài khoản theo mã định danh đăng nhập (`ten_dang_nhap`)/họ tên/SĐT (SĐT tra qua hồ sơ học viên liên kết). Trả tối đa 20 kết quả, kèm dữ liệu hồ sơ học viên (họ tên/ngày sinh/SĐT/đơn vị) để N4 đối chiếu xác minh danh tính. **Improvised** — `api-contract.md` không có sẵn shape response cho endpoint này | Quản trị |
| GET | `/nguoi-dung/hoc-vien` | Tài khoản `vai_tro='hoc_vien'`, phân trang (`page`, `page_size` mặc định 20, tối đa 100), sắp `created_at` giảm dần. Lọc `trang_thai` (`active`/`ngung`), `tinh_trang` (`tam_khoa` = `khoa_den > now`, `chua_dang_nhap` = `dang_nhap_lan_cuoi` null, `phai_doi_mat_khau`), `q` (tên đăng nhập/họ tên không phân biệt hoa thường, CCCD, SĐT). Dòng: `{ id, ten_dang_nhap, trang_thai, phai_doi_mat_khau, so_lan_dang_nhap_sai, khoa_den, dang_nhap_lan_cuoi, created_at, hoc_vien: { id, ho_ten, so_dinh_danh_ca_nhan, ngay_sinh, thang_sinh, nam_sinh, so_dien_thoai_lien_he, email_lien_he, don_vi_cong_tac: { id, ten_don_vi } \| null } \| null }` | Quản trị |
| PATCH | `/nguoi-dung/hoc-vien/{id}` | `{ trang_thai: 'active' \| 'ngung' }` → dòng như trên. `active` đồng thời xóa `khoa_den` + bộ đếm sai. `404` không có tài khoản, `400` nếu không phải tài khoản học viên | Quản trị |
| POST | `/nguoi-dung/hoc-vien/{id}/mo-khoa-tam` | `200` → dòng như trên; xóa `khoa_den`, `so_lan_dang_nhap_sai=0`, mật khẩu giữ nguyên. `404`/`400` như PATCH | Quản trị |

---

### Tài khoản đơn vị (ADR 0002, 2026-10-03)

Tài khoản quản lý cho Sở GD&ĐT / Phòng VHXH / Trường — **1 tài khoản / đơn vị**, vai trò cùng tên `loai_don_vi` (`khac` không được cấp). Tên đăng nhập = `lower(ma_don_vi)` hoặc tên gợi nhớ (`^[a-z0-9][a-z0-9._-]{2,49}$`, lưu chữ thường, không trùng — kể cả khác hoa/thường — với bất kỳ tài khoản nào). Email tùy chọn (lưu chữ thường). Cấp mật khẩu lần đầu bằng **mật khẩu tạm** (mặc định; 10 ký tự không gồm `0 O o 1 l I L`, chỉ trả trong response, `phai_doi_mat_khau=true`) **hoặc** **link kích hoạt** qua email (token `kich_hoat_tai_khoan` 72 giờ, `FRONTEND_URL/dat-lai-mat-khau?token=...`, email `[HCMUE-BDNLS] Kích hoạt tài khoản` qua hàng đợi) — 2 cách loại trừ nhau. Mỗi lần cấp ghi `nhat_ky_dat_lai_mat_khau`.

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| GET | `/nguoi-dung/don-vi` | Phân trang (`page`, `page_size`). Lọc `vai_tro`, `trang_thai` (`active`/`ngung`), `da_dang_nhap` (`true`/`false` theo `dang_nhap_lan_cuoi`), `q` (tên/mã đơn vị, tên đăng nhập, email, họ tên). Dòng: `{ id, ten_dang_nhap, ho_ten, email, vai_tro, trang_thai, dang_nhap_lan_cuoi, don_vi: { id, ma_don_vi, ten_don_vi, loai_don_vi, trang_thai } }` | Quản trị |
| GET | `/nguoi-dung/don-vi/chua-cap` | Đơn vị `active` loại hợp lệ **chưa có** tài khoản; lọc `loai_don_vi`, `q` (mã/tên); tối đa 50 dòng `{ id, ma_don_vi, ten_don_vi, loai_don_vi }` | Quản trị |
| POST | `/nguoi-dung/don-vi` | `{ don_vi_id, ten_dang_nhap?, ho_ten?, email?, cach_cap?: 'mat_khau_tam' \| 'email' }` → `201 { tai_khoan, mat_khau_tam? }` (`mat_khau_tam` chỉ khi cấp bằng mật khẩu tạm). `ho_ten` trống = tên đơn vị | Quản trị |
| PATCH | `/nguoi-dung/don-vi/{id}` | `{ ten_dang_nhap?, ho_ten?, email?, trang_thai? }` → tài khoản. `email: ""` = xóa email; đổi hoặc xóa email đều vô hiệu mọi link kích hoạt/đặt lại còn hạn (link đã gửi tới email cũ). `trang_thai: 'ngung'` = khóa — JWT đang mở bị từ chối ngay (guard kiểm tra `trang_thai` mỗi request) | Quản trị |
| POST | `/nguoi-dung/don-vi/{id}/cap-mat-khau-tam` | → `{ ten_dang_nhap, mat_khau_tam }`; mở khóa tạm do nhập sai; vô hiệu mọi link còn hạn | Quản trị |
| POST | `/nguoi-dung/don-vi/{id}/gui-email-kich-hoat` | → `{ da_gui: true }`; mật khẩu hiện tại mất hiệu lực. `400` (field `email`, "Cần email để gửi link kích hoạt") nếu chưa có email | Quản trị |

Lỗi (`fields[].message` nguyên văn): đơn vị đã có tài khoản → `409` `don_vi_id` "Đơn vị đã có tài khoản"; đơn vị không tồn tại/ngừng → `400` "Không hợp lệ"; loại không cấp → `400` "Loại đơn vị không được cấp tài khoản"; tên đăng nhập sai định dạng → `400` "Chỉ gồm chữ thường không dấu, số, . _ - (3–50 ký tự)", trùng → `409` "Tên đăng nhập đã được dùng"; email sai → `400` "Email không hợp lệ", trùng → `409` "Email đã được dùng"; `cach_cap='email'` thiếu email → `400` "Cần email để gửi link kích hoạt". Có cả lỗi định dạng lẫn lỗi trùng → trả `400` kèm mọi field. `:id` không phải tài khoản đơn vị → `404`.

**Giới hạn:** cấp mật khẩu/link mới không thu hồi JWT đang mở của người cũ — muốn cắt ngay: khóa → cấp mới → mở khóa.

### Người hỗ trợ học viên (ADR 0003, 2026-10-06)

Vai trò `ho_tro_hoc_vien` — cán bộ HCMUE, `don_vi_id`/`hoc_vien_id` luôn NULL, **email bắt buộc**. Đăng nhập khớp tên không phân biệt hoa/thường và tự lấy lại mật khẩu qua `POST /auth/quen-mat-khau` (như tài khoản đơn vị). Gọi mọi API quản trị/đơn vị → `403`. Phạm vi làm việc = các cụm được phân công (`PUT .../nguoi-ho-tro`, mục 3).

| Method | Path | Mô tả | Quyền |
|---|---|---|---|
| GET | `/nguoi-dung/ho-tro` | Phân trang; lọc `trang_thai`, `q` (họ tên, tên đăng nhập, email). Dòng: `{ id, ten_dang_nhap, ho_ten, email, vai_tro, trang_thai, dang_nhap_lan_cuoi, cum: [{ cum_id, ten_cum, khoa_id, ma_khoa, ten_khoa }] }` | Quản trị |
| POST | `/nguoi-dung/ho-tro` | `{ ho_ten, email, ten_dang_nhap?, cach_cap?: 'email' \| 'mat_khau_tam' }` → `201 { tai_khoan, mat_khau_tam? }`. **Mặc định `email`** (link kích hoạt 72 giờ). `ten_dang_nhap` trống = phần trước `@` của email (chuẩn hóa chữ thường, phải khớp regex tài khoản đơn vị) | Quản trị |
| PATCH | `/nguoi-dung/ho-tro/{id}` | `{ ho_ten?, email?, trang_thai? }` — email không được xóa; đổi email vô hiệu link còn hạn | Quản trị |
| POST | `/nguoi-dung/ho-tro/{id}/cap-mat-khau-tam` | → `{ ten_dang_nhap, mat_khau_tam }` | Quản trị |
| POST | `/nguoi-dung/ho-tro/{id}/gui-email-kich-hoat` | → `{ da_gui: true }` | Quản trị |

Lỗi: như tài khoản đơn vị (tên đăng nhập/email sai định dạng `400`, trùng `409`); thiếu email → `400` field `email` "Người hỗ trợ học viên bắt buộc có email"; `:id` không phải người hỗ trợ → `404`.

#### Khu làm việc người hỗ trợ — API `/ho-tro-hoc-vien/*` (ADR 0003 Lát 2, 2026-10-06)

**Tiền tố API là `/ho-tro-hoc-vien`, KHÔNG phải `/ho-tro`** (sửa 2026-10-06 sau deploy): `/ho-tro/*` là route TRANG của frontend; Nginx chỉ proxy tiền tố liệt kê trong `scripts/vps/05-install-nginx.sh`, tiền tố trùng route trang sẽ làm F5 trang rơi vào backend. `backend/src/nginx-prefix.spec.ts` kiểm tra cả 2 điều.

Chỉ `ho_tro_hoc_vien` (vai trò khác → `403`, kể cả Quản trị). Phạm vi = cụm trong `phan_cong_ho_tro` của người gọi, kiểm tra **mỗi request**; học viên thuộc cụm khi có `dang_ky_hoc.cum_id` thuộc các cụm đó. Học viên/cụm ngoài phạm vi → `404` (không `403`). Chưa được phân công → danh sách rỗng.

| Method | Path | Mô tả |
|---|---|---|
| GET | `/ho-tro-hoc-vien/cum-cua-toi` | `[{ cum_id, ten_cum, link_zalo, trang_thai, khoa_id, ma_khoa, ten_khoa, so_hoc_vien }]` |
| GET | `/ho-tro-hoc-vien/hoc-vien` | Phân trang. Lọc `q` (họ tên không dấu, CCCD, mã MOET, tên đăng nhập), `cum_id` (ngoài phạm vi → 404), `don_vi_cong_tac_id`, `da_dang_nhap`, `day_du`. Dòng: `{ id, ho_ten, ma_dinh_danh_moet, ten_dang_nhap, dang_nhap_lan_cuoi, don_vi_cong_tac_ten, doi_tuong, so_dien_thoai_lien_he, email_lien_he, day_du, cum: [{ cum_id, ten_cum }], lop_theo_giai_doan: { [giai_doan_id]: ten_lop }, khao_sat: [{ loai, trang_thai, muc }] }` — `cum` chỉ gồm cụm trong phạm vi người gọi. Sắp theo họ tên |
| GET | `/ho-tro-hoc-vien/hoc-vien/xuat` | Cùng bộ lọc (bỏ phân trang) → `.xlsx`, 1 sheet/cụm (`Content-Disposition: attachment; filename="ds-cum-ho-tro-<yyyymmdd>.xlsx"`, `Cache-Control: no-store`). Cột: STT, Họ tên, Đơn vị công tác, Đối tượng, Số điện thoại, Email, `GĐ<n> - <tên giai đoạn>` (lớp được gán), Hồ sơ đầy đủ, Đã đăng nhập, Khảo sát. **Không** có CCCD, ngày sinh, mã MOET, nơi sinh. Ghi `nhat_ky_hoat_dong` `ho_tro_xuat_danh_sach` |
| GET | `/ho-tro-hoc-vien/hoc-vien/{id}` | `{ ho_so (như GET /hoc-vien/{id} + day_du, thieu), tai_khoan: { ten_dang_nhap, trang_thai, dang_nhap_lan_cuoi, phai_doi_mat_khau, khoa_den, dang_bi_khoa, email_da_xac_minh } \| null, hoc_tap (cùng cấu trúc GET /hoc-vien/{id}/khoa-hoc), khao_sat, yeu_cau_ho_tro (20 gần nhất, tóm tắt), lich_su_thay_doi (50 gần nhất, kèm nguoi_sua_ten, ly_do) }` |
| GET | `/ho-tro-hoc-vien/lich-hoc` | `tu_ngay`/`den_ngay` (`YYYY-MM-DD` giờ VN; mặc định đầu hôm nay → hết 14 ngày sau), `cum_id`. Buổi (`lich_hoc_lop`) của cặp (lớp, giai đoạn) có ≥1 học viên của cụm được phân lớp, kèm `lop`, `giai_doan`, `khoa`, `nhan_su`, `so_hoc_vien_cum`; tối đa 500 buổi |
| PATCH | `/ho-tro-hoc-vien/hoc-vien/{id}` | **Lát 3 (ADR 0003 H7)**: body như `PATCH /hoc-vien/toi` + `ly_do` (bắt buộc, 5–500 ký tự sau trim). Gửi `so_dinh_danh_ca_nhan` → `400`. Bỏ qua cổng đợt (như Quản trị); đợt đang mở và học viên đã xác nhận → hủy xác nhận (`xac_nhan_bi_huy: true`). **Luôn** ghi `lich_su_thay_doi_ho_so` kèm `ly_do` (kể cả hồ sơ `tu_dang_ky`), `vai_tro_nguoi_sua = 'ho_tro_hoc_vien'`. Đổi `email_lien_he` → `email_da_xac_minh = false` + gửi email xác minh tới địa chỉ mới |
| POST | `/ho-tro-hoc-vien/hoc-vien/{id}/gui-link-dat-lai-mat-khau` | H9(1) → `{ da_gui: true, email }`. Chỉ tới email **đã xác minh** (chưa → `409`); tài khoản bị khóa → `409`; vừa gửi trong 60 giây → `429`. Token `dat_lai_mat_khau` cũ chưa dùng bị vô hiệu |
| POST | `/ho-tro-hoc-vien/hoc-vien/{id}/cap-mat-khau-tam` | H9(2) → `{ ten_dang_nhap, mat_khau_tam }` (10 ký tự, trả 1 lần). `phai_doi_mat_khau = true`, xóa khóa tạm/bộ đếm sai, vô hiệu link đặt lại còn hạn, ghi `nhat_ky_dat_lai_mat_khau`. Không có thao tác "về ngày sinh" |
| POST | `/ho-tro-hoc-vien/hoc-vien/{id}/mo-khoa-tam` | H9(3) → `{ ten_dang_nhap, dang_bi_khoa: false }` |

#### Yêu cầu hỗ trợ (M8 2026-10-01; theo cụm — ADR 0003 Lát 4, 2026-10-06)

Mô hình 1 hỏi – 1 đáp; hỏi tiếp = ticket mới (cờ `hoi_lai`). **Trả lời = UPDATE có điều kiện `trang_thai = 'cho_xu_ly'`** cho MỌI người trả lời: ticket đã có câu trả lời → `409` "Yêu cầu này đã có người trả lời" (đã đóng → `409` "Ticket đã đóng…"), không ghi đè; email `yeu_cau_ho_tro_tra_loi` chỉ gửi khi ghi thành công. Hạn tự đóng (`da_dong_hieu_luc`, 7 ngày) tính từ `thoi_gian_sua_tra_loi ?? thoi_gian_phan_hoi`.

| Method | Path | Mô tả | Quyền |
|---|---|---|---|
| POST | `/yeu-cau-ho-tro/toi` | `{ tinh_huong, noi_dung_hoi }` | Học viên |
| GET | `/yeu-cau-ho-tro/toi` | Ticket của tôi. Mỗi dòng có `nguoi_tra_loi_hien_thi`: tên cụm của học viên khi người hỗ trợ trả lời, `"Ban tổ chức (HCMUE)"` khi Quản trị trả lời, `null` khi chưa trả lời; `thoi_gian_sua_tra_loi`. **Không** có `tra_loi_boi`/`sua_tra_loi_boi` (H14) | Học viên |
| POST | `/yeu-cau-ho-tro/toi/{id}/dong`, `/toi/{id}/danh-gia` | Đóng / đánh giá (`hai_long`\|`chua_hai_long`) ticket đã trả lời | Học viên |
| GET | `/yeu-cau-ho-tro` | Phân trang; lọc `trang_thai`, `loai_van_de_id`, **`chua_co_cum=true`** (học viên không có `dang_ky_hoc` nào có cụm — chỉ Quản trị xử lý). Dòng thêm `hoc_vien_ho_ten`, `nguoi_tra_loi_ten`, `hoi_lai`, `ten_cum: string[]`, `da_sua_boi_quan_tri` | Quản trị |
| GET | `/yeu-cau-ho-tro/{id}` | Như 1 dòng ở trên | Quản trị |
| PATCH | `/yeu-cau-ho-tro/{id}/tra-loi` | `{ noi_dung_tra_loi }` — có điều kiện, xem trên | Quản trị |
| PATCH | `/yeu-cau-ho-tro/{id}/sua-tra-loi` | `{ noi_dung_tra_loi }` — đính chính câu trả lời (kể cả ticket đã đóng): `409` nếu chưa có câu trả lời; ghi nội dung cũ vào `nhat_ky_hoat_dong` (`sua_tra_loi_ho_tro`), set `thoi_gian_sua_tra_loi`/`sua_tra_loi_boi`, `danh_gia = null`, `trang_thai = 'da_phan_hoi'`, email `yeu_cau_ho_tro_cap_nhat_tra_loi` | Quản trị |
| GET | `/ho-tro-hoc-vien/yeu-cau-ho-tro` | Ticket của học viên trong cụm của tôi (tính động). Lọc `trang_thai`, `cum_id` (ngoài phạm vi → 404). `cho_xu_ly` xếp cũ nhất trước. Dòng như phía Quản trị, `ten_cum` chỉ gồm cụm trong phạm vi | Người hỗ trợ |
| GET | `/ho-tro-hoc-vien/yeu-cau-ho-tro/dem` | `{ cho_xu_ly }` cho số đếm trên menu | Người hỗ trợ |
| GET | `/ho-tro-hoc-vien/yeu-cau-ho-tro/{id}` | Như 1 dòng + `ticket_truoc` (10 ticket khác gần nhất của cùng học viên). Ngoài phạm vi → 404 | Người hỗ trợ |
| PATCH | `/ho-tro-hoc-vien/yeu-cau-ho-tro/{id}/tra-loi` | `{ noi_dung_tra_loi }` — có điều kiện; ngoài phạm vi → 404 | Người hỗ trợ |

Frontend khi nhận `409` lúc trả lời: KHÔNG làm mới danh sách ngay, tải lại ticket (`GET .../{id}`) để hiện câu trả lời đã có, giữ nguyên nội dung đang soạn (`components/KhungTraLoiTicket.tsx`).

### Người hỗ trợ giảng viên (ADR 0004 L1, issue #14, 2026-10-07)

Vai trò `ho_tro_giang_vien` — cán bộ HCMUE, không gắn đơn vị, email bắt buộc (CHECK `chk_nguoi_dung_scope`, `chk_nguoi_dung_email_bat_buoc`); đăng nhập như tài khoản đơn vị (khớp không phân biệt hoa/thường, quên mật khẩu qua email). Trang frontend ở **`/ho-tro-gv`** — tiền tố API là `/ho-tro-giang-vien` (không trùng, xem bài học `/ho-tro` của ADR 0003).

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| GET / POST / PATCH | `/nguoi-dung/ho-tro` | Như ADR 0003, thêm `vai_tro` (`ho_tro_hoc_vien` \| `ho_tro_giang_vien`): POST nhận `vai_tro` (mặc định `ho_tro_hoc_vien`); GET lọc `?vai_tro=` (**mặc định `ho_tro_hoc_vien`** — giữ hành vi cũ của ô chọn người hỗ trợ cụm); mỗi dòng kèm `khoa: [{ khoa_id, ma_khoa, ten_khoa }]` (nhóm hỗ trợ GV) | QuảnTrị |
| PUT | `/khoa-boi-duong/{id}/nhom-ho-tro-gv` | `{ nguoi_dung_ids: uuid[] }` (≤ 50) **thay toàn bộ** nhóm người hỗ trợ giảng viên của khóa (rỗng = gỡ hết) → `{ khoa_id, nhom_ho_tro_gv: [{ id, ho_ten }] }`. Tài khoản không phải `ho_tro_giang_vien` đang hoạt động → `400`. `GET /khoa-boi-duong/{id}` (Quản trị) kèm `nhom_ho_tro_gv` | QuảnTrị |
| GET | `/ho-tro-giang-vien/lop-cua-toi` | Lớp trong phạm vi = mọi lớp của các khóa có người gọi trong nhóm (`{ id, ten_lop, loai_lop, trang_thai, khoa, _count.lich_hoc }`); chưa phân công → `[]` | `ho_tro_giang_vien` |

**Thêm L2 (issue #15, 2026-10-07)** — "Trang lớp" dùng chung (`TrangLopService` + hàm thuần `locTheoVaiTro` theo ma trận §3 đặc tả):

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| GET | `/ho-tro-giang-vien/lop/{lopId}/dot` | `{ lop, dot: [{ id, thu_tu, ten_giai_doan, thoi_gian_*, so_buoi }] }` — các giai đoạn `truc_tiep` có buổi của lớp | `ho_tro_giang_vien` |
| GET | `/ho-tro-giang-vien/lop/{lopId}/giai-doan/{gdId}` | Hồ sơ chuẩn bị lớp (bản đọc): `{ lop, giai_doan, buoi: [{ …, phong, diem_hoc, giang_vien: [{ ho_ten, vai_tro, so_dien_thoai, email, so_gio, da_xac_nhan_gio }] }], hoc_vien: [{ ho_ten, gioi_tinh, don_vi, doi_tuong, chuc_vu, muc_dau_vao, muc_hoc_chon, so_dien_thoai, email, cum: { ten_cum, nguoi_ho_tro }, diem_danh, ket_qua }], nhom_ho_tro_gv }` — **không** CCCD/ngày sinh/mã MOET. Giai đoạn không trực tiếp / lớp ngoài phạm vi → `404` | `ho_tro_giang_vien` |
| GET | `/ho-tro-giang-vien/lich-day?tu_ngay=&den_ngay=` | Buổi của mọi lớp trong phạm vi (mặc định hôm nay + 14 ngày, giờ VN) kèm lớp, giai đoạn, điểm học, giảng viên (họ tên, vai trò) | `ho_tro_giang_vien` |

**Thêm L3 (issue #16, 2026-10-07)** — vận hành lớp/đợt (mọi endpoint kiểm phạm vi trước):

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| PATCH | `/ho-tro-giang-vien/lich-hoc/{id}` | `{ thoi_gian_bat_dau?, thoi_gian_ket_thuc?, diem_hoc_id?, phong?, ly_do }` — `ly_do` **bắt buộc** 5–500 ký tự. Chỉ buổi **chưa diễn ra** và **chưa có điểm danh** (ngược lại `400`). Đi qua đúng luật của Quản trị (`capNhatLichHoc`: #49, điểm học bắt buộc với GĐ trực tiếp, giảng viên không trùng giờ, cảnh báo số phòng) → nhật ký `sua_lich_hoc` có lý do + vai trò người sửa. Không có thêm/xóa buổi, đổi buổi số/trạng thái | `ho_tro_giang_vien` |
| PUT | `/ho-tro-giang-vien/lich-hoc/{id}/giang-vien` | Như `PUT /lop/{id}/lich-hoc/{lich_hoc_id}/giang-vien` của Quản trị (cùng `PhanCongGiangDayService`) | `ho_tro_giang_vien` |
| PUT | `/ho-tro-giang-vien/lop/{lopId}/giai-doan/{gdId}/hau-can/{giangVienId}` | Upsert hậu cần `{ cap_nhat_luc?, noi_o_ten, noi_o_dia_chi, nhan_phong, tra_phong (YYYY-MM-DD), phuong_tien, don_luc, diem_don, lien_he_don, ghi_chu, da_xac_nhan_noi_o, da_xac_nhan_di_chuyen }` (null = xóa). **Khóa lạc quan:** sửa bản đã có phải gửi `cap_nhat_luc` vừa đọc — lệch → `409`, không ghi đè. Giảng viên không có phân công trong đợt → `400`; trả phòng trước nhận phòng → `400` | `ho_tro_giang_vien` |
| PUT | `/ho-tro-giang-vien/lop/{lopId}/giai-doan/{gdId}/thuc-dia` | `{ nhan_su: [{ ho_ten, so_dien_thoai, nhiem_vu?, ghi_chu? }] }` (≤ 20) **thay toàn bộ** người hỗ trợ thực địa của đợt (Q4: theo đợt – lớp); SĐT chuẩn hóa như giảng viên | `ho_tro_giang_vien` |
| GET / POST / PATCH | `/ho-tro-giang-vien/diem-hoc(/{id})`, `/ho-tro-giang-vien/giang-vien(/{id})` | Như danh mục của Quản trị (ghi `tao_boi`), thấy toàn bộ danh mục; gửi `trang_thai` (ngưng) → `403` — ngưng/gộp trùng là việc của Quản trị | `ho_tro_giang_vien` |

`GET /ho-tro-giang-vien/lop/{lopId}/giai-doan/{gdId}` thêm `hau_can: [...]` (kèm `nguoi_sua`) và `thuc_dia: [...]`. **Thực địa** cũng có ở `GET /ho-tro-hoc-vien/lich-hoc` (mỗi buổi `thuc_dia`) và `GET /hoc-vien/toi/khoa-hoc` (mỗi giai đoạn có lớp: `thuc_dia: [{ ho_ten, so_dien_thoai, nhiem_vu }]`). Hậu cần **không** có ở 2 nơi này.

**Thêm L4 (issue #17, 2026-10-07) — bảng kiểm chuẩn bị** (`muc_kiem_tra`: `khoa_id NULL` = bộ mặc định, seed 7 quy tắc tự động + 1 mục thủ công; khóa có mục riêng thì chỉ dùng mục riêng):

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| GET | `/bang-kiem/quy-tac` | Danh mục quy tắc tự động trong code `[{ ma, ten }]` (`co_diem_hoc`, `co_giang_vien`, `khong_vuot_so_phong`, `co_hoc_vien`, `giang_vien_co_tai_khoan`, `hau_can_da_xac_nhan`, `co_thuc_dia`, `khong_de_nghi_cho` — L5) | QuảnTrị |
| GET | `/bang-kiem/mac-dinh`, `/bang-kiem/khoa/{khoaId}` | `{ nguon: 'mac_dinh' \| 'rieng', muc: [...] }` (kèm mục đã ngưng) | QuảnTrị |
| POST | `/bang-kiem/khoa/{khoaId}/tuy-chinh` | Sao chép bộ mặc định thành bộ riêng của khóa; đã có bộ riêng → `409` | QuảnTrị |
| POST | `/bang-kiem/mac-dinh/muc`, `/bang-kiem/khoa/{khoaId}/muc` | `{ ten, loai: 'tu_dong'\|'thu_cong', ma_quy_tac? (bắt buộc với tự động, phải có trong danh mục), han_truoc_ngay? (0–365), thu_tu? }`; khóa chưa tùy chỉnh → `409` | QuảnTrị |
| PATCH | `/bang-kiem/muc/{id}` | Sửa tên/hạn/thứ tự/quy tắc, `trang_thai='ngung'` để ẩn (trạng thái đã đánh dấu giữ trong DB); không đổi loại (`400`) | QuảnTrị |
| GET | `/ho-tro-giang-vien/lop/{lopId}/giai-doan/{gdId}/bang-kiem` | `{ lop, giai_doan, buoi_dau, nguon, mau: 'xanh'\|'vang'\|'do', muc: [{ muc_id, ten, loai, ma_quy_tac, han, trang_thai: 'dat'\|'chua_dat'\|'qua_han', ly_do, ghi_chu, cap_nhat_boi, cap_nhat_luc }] }` — hạn = buổi đầu − `han_truoc_ngay`; đỏ = có mục quá hạn, vàng = có mục chưa đạt, xanh = đạt hết | `ho_tro_giang_vien` |
| PUT | `/ho-tro-giang-vien/lop/{lopId}/giai-doan/{gdId}/bang-kiem/{mucId}` | `{ da_xong, ghi_chu? }` — chỉ mục **thủ công** (tự động → `400`; mục không thuộc bộ của khóa → `404`) | `ho_tro_giang_vien` |
| GET | `/ho-tro-giang-vien/viec-can-lam?so_ngay=21`, `/viec-can-lam/dem` | Đợt trực tiếp trong phạm vi có buổi từ nay tới N ngày, kèm màu + mục chưa đạt, sắp theo buổi đầu; `/dem` → `{ do }` (số đợt đỏ, hiện trên menu) | `ho_tro_giang_vien` |

Nginx: thêm tiền tố `/bang-kiem`.

**Thêm L5 (issue #18, 2026-10-07) — báo vắng + đề nghị đổi lớp** (ADR 0004 G13/G14; ngoài cụm/khóa của mình → `404`):

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| POST | `/ho-tro-hoc-vien/hoc-vien/{id}/bao-vang` | `{ lich_hoc_id, ly_do (2–500) }` — buổi phải thuộc lớp học viên được phân ở giai đoạn đó và **chưa kết thúc** (`400`); ghi lại = cập nhật lý do. Nhật ký `bao_vang` | `ho_tro_hoc_vien` |
| DELETE | `/ho-tro-hoc-vien/hoc-vien/{id}/bao-vang/{lichHocId}` | Hủy báo vắng (buổi chưa kết thúc) → `204`; chưa có → `404` | `ho_tro_hoc_vien` |
| GET | `/ho-tro-hoc-vien/hoc-vien/{id}/lop-co-the-doi?giai_doan_id=` | `{ lop_hien_tai_id, lop: [{ id, ten_lop, loai_lop, si_so_toi_da, si_so }] }` — lớp cùng khóa, active, có buổi ở giai đoạn | `ho_tro_hoc_vien` |
| POST | `/ho-tro-hoc-vien/hoc-vien/{id}/de-nghi-doi-lop` | `{ giai_doan_id, lop_de_nghi_id, ly_do (5–500) }` — lớp không hợp lệ / đang ở lớp đó → `400`; đã có đề nghị **chờ duyệt** cùng (học viên, giai đoạn) → `409` | `ho_tro_hoc_vien` |
| POST | `/ho-tro-hoc-vien/de-nghi-doi-lop/{id}/huy` | Chỉ người tạo (`403`), chỉ khi `cho_duyet` (`409`) → `204` | `ho_tro_hoc_vien` |
| GET | `/ho-tro-hoc-vien/hoc-vien/{id}` | **Thêm** `bao_vang: [{ lich_hoc_id, ly_do, ghi_luc, nguoi_ghi }]`, `de_nghi_doi_lop: [...]` | `ho_tro_hoc_vien` |
| GET | `/ho-tro-giang-vien/de-nghi-doi-lop?trang_thai=` | Đề nghị có lớp đề nghị thuộc khóa của nhóm, kèm `si_so_lop_de_nghi` | `ho_tro_giang_vien` |
| POST | `/ho-tro-giang-vien/de-nghi-doi-lop/{id}/duyet` | `{ ghi_chu? }` → `{ trang_thai: 'da_duyet', canh_bao: string[] }`. UPDATE có điều kiện `cho_duyet` (người thứ 2 → `409`); phân lớp hiện tại khác `lop_hien_tai_id` → `409` (đề nghị vẫn chờ); cập nhật `phan_lop_giai_doan` + nhật ký `duyet_doi_lop`; vượt `si_so_toi_da` chỉ cảnh báo | `ho_tro_giang_vien` |
| POST | `/ho-tro-giang-vien/de-nghi-doi-lop/{id}/tu-choi` | `{ ghi_chu (3–500, bắt buộc) }`; đã xử lý → `409` | `ho_tro_giang_vien` |
| GET | `/ho-tro-giang-vien/viec-can-lam/dem` | **Thêm** `de_nghi` (số đề nghị chờ duyệt) | `ho_tro_giang_vien` |

Trang lớp (`GET /ho-tro-giang-vien/lop/{lopId}/giai-doan/{gdId}`) thêm `hoc_vien[].bao_vang` (`lich_hoc_id → ly_do`) và `de_nghi_cho` (đề nghị chờ ra/vào lớp; giảng viên không thấy). Hàm thuần `hopNhatDiemDanh` (dùng ở L6): `vang` + có báo vắng → `vang_co_phep`, `co_mat` luôn thắng.

**Thêm L9 (issue #22, 2026-10-07) — màn giám sát Vận hành** (ADR 0004 G15, Quản trị giám sát thay vì làm thay). Nginx thêm tiền tố `/van-hanh`; trang `/admin/van-hanh`.

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| GET | `/van-hanh` | `{ dot_do, de_nghi_cho_lau, thay_doi_lich, khoa_chua_nhom_gv, cum_chua_ho_tro, danh_muc_moi: { diem_hoc, giang_vien } }` — đợt trực tiếp 21 ngày tới màu đỏ (+ mục quá hạn, nhóm hỗ trợ GV); đề nghị đổi lớp `cho_duyet` quá 48 giờ; nhật ký `sua_lich_hoc` 7 ngày qua (ai, vai trò, lý do, trước → sau, lớp); khóa chưa kết thúc có giai đoạn trực tiếp nhưng chưa có nhóm hỗ trợ GV; cụm active của khóa chưa kết thúc chưa có người hỗ trợ HV (+ số học viên); điểm học / giảng viên do người hỗ trợ tạo 7 ngày qua. Khối mẫu biểu (L6) chưa có. Mỗi khối tối đa 200 dòng | QuảnTrị |

**Thêm L8 (issue #21, 2026-10-07) — tin nhắn nhắc lịch** (ADR 0004 G10/G11): hệ thống soạn sẵn nội dung, cán bộ sao chép gửi qua Zalo/SMS rồi bấm **Đã gửi** → ghi `nhat_ky_nhac_lich` (lưu nội dung đã gửi). **Không email, không cron.** Cờ theo (buổi, người nhận): chưa có lần gửi chứa buổi → `chua_nhac`; `lich_hoc_lop.cap_nhat_luc` > lần gửi cuối → `can_nhac_lai`; ngược lại `da_nhac`.

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| GET | `/ho-tro-giang-vien/lop/{lopId}/giai-doan/{gdId}/tin-nhan-nhac/{giangVienId}` | `{ giang_vien, lich_hoc_ids, noi_dung, trang_thai_nhac, lan_gui_cuoi }` — chỉ buổi + hậu cần của **chính** giảng viên đó (lớp, buổi, điểm học + địa chỉ + link bản đồ, phòng, chỗ ở, đưa đón, thực địa, nhóm hỗ trợ GV); không dạy buổi nào trong đợt → `404` | `ho_tro_giang_vien` |
| POST | `/ho-tro-giang-vien/nhac-lich` | `{ giang_vien_id, lich_hoc_ids[1..200], noi_dung (≤5000) }` — mọi buổi phải trong phạm vi và có phân công của GV (`404`) → `201 { id, gui_luc }` | `ho_tro_giang_vien` |
| GET | `/ho-tro-hoc-vien/cum/{cumId}/tin-nhan-nhac?ngay=YYYY-MM-DD` | Buổi trong ngày (giờ VN) của các lớp có học viên cụm được phân ở đúng giai đoạn: `{ cum, ngay, buoi[], lich_hoc_ids, noi_dung \| null, trang_thai_nhac }`; cụm ngoài phạm vi → `404` | `ho_tro_hoc_vien` |
| POST | `/ho-tro-hoc-vien/nhac-lich` | `{ cum_id, lich_hoc_ids, noi_dung }` — buổi không thuộc lớp của học viên cụm → `400` | `ho_tro_hoc_vien` |
| GET | `/ho-tro-hoc-vien/nhac-lich/dem` | `{ can_nhac }` = số (buổi, cụm) từ bây giờ tới hết 2 ngày tới chưa nhắc / cần nhắc lại (số đếm menu Lịch học) | `ho_tro_hoc_vien` |

Bổ sung: trang lớp `buoi[].giang_vien[].nhac`; `GET /ho-tro-hoc-vien/lich-hoc` mỗi buổi thêm `nhac_cum: [{ cum_id, trang_thai }]`; `viec-can-lam` mỗi đợt thêm `nhac_gv` (GV chưa nhắc / cần nhắc lại). Quy tắc bảng kiểm `da_nhac_giang_vien` (bộ mặc định: hạn 3 ngày). Cổng học viên: thẻ **Buổi học sắp tới** (≤ 7 ngày) dùng dữ liệu `GET /hoc-vien/toi/khoa-hoc` sẵn có.

**Thêm L7 (issue #20, 2026-10-07) — vai trò `giang_vien` (chỉ đọc) + cổng giảng viên** (ADR 0004 G8). Trang frontend `/giang-day`; API tiền tố **`/cong-giang-vien`** (Nginx thêm tiền tố) — `/giang-vien` vẫn là API danh mục của Quản trị. `nguoi_dung.giang_vien_id` (1–1), CHECK vai trò `giang_vien` ⇔ có `giang_vien_id`, email bắt buộc. Đăng nhập như tài khoản cấp (tên đăng nhập = phần trước @ của email, trùng thì thêm số).

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| POST | `/giang-vien/{id}/gui-link-kich-hoat` | Tạo tài khoản `giang_vien` (lần đầu) hoặc gửi lại link (mật khẩu cũ mất hiệu lực) → `{ da_gui, tao_moi, email }`. Không email → `400`; GV ngưng → `400`; tài khoản bị khóa → `409`; email trùng tài khoản khác → `409` | QuảnTrị |
| POST | `/ho-tro-giang-vien/giang-vien/{id}/gui-link-kich-hoat` | Như trên, chỉ GV có phân công ở lớp trong khóa của nhóm (ngoài → `404`) | `ho_tro_giang_vien` |
| PATCH | `/giang-vien/{id}/tai-khoan` | `{ trang_thai: 'active' \| 'ngung' }` — khóa/mở tài khoản; chưa có → `404` | QuảnTrị |
| GET | `/giang-vien` | Mỗi dòng **thêm** `tai_khoan: { ten_dang_nhap, trang_thai, phai_doi_mat_khau, dang_nhap_lan_cuoi } \| null` | QuảnTrị |
| GET | `/cong-giang-vien/lich-day?tu_ngay&den_ngay` | Buổi mình được phân công (mặc định 60 ngày tới, gồm buổi đang diễn ra): giờ, lớp, giai đoạn, điểm học (tên, địa chỉ, liên hệ), phòng, `vai_tro`, `giang_vien_khac`, `hau_can` (của mình), `thuc_dia`, `nhom_ho_tro_gv` | `giang_vien` |
| GET | `/cong-giang-vien/lop/{lopId}/giai-doan/{gdId}` | Trang lớp lọc theo ma trận §3 (không SĐT/email/cụm học viên, không liên hệ/số giờ/tài khoản GV khác, hậu cần chỉ của mình, không đề nghị đổi lớp). Lớp không có buổi của mình → `404` | `giang_vien` |

Trang lớp của hỗ trợ GV: `buoi[].giang_vien[].tai_khoan` = `chua_co | chua_kich_hoat | hoat_dong | bi_khoa`. Quy tắc bảng kiểm `giang_vien_co_tai_khoan` nay đọc trạng thái thật: đạt khi mọi GV của đợt đã được cấp (kể cả chưa kích hoạt) và không bị khóa. Giảng viên không có route ghi nào (mọi PATCH/PUT/POST khác → `403`).


Liên thông sang người hỗ trợ học viên: `GET /ho-tro-hoc-vien/lich-hoc` mỗi buổi thêm `phong`, `diem_hoc { ten, dia_chi, nguoi_lien_he, sdt_lien_he }`, `nhom_ho_tro_gv [{ ho_ten, email }]` — **không** có hậu cần hay liên hệ giảng viên.

Phạm vi kiểm tra động mỗi request qua `HoTroGiangVienScopeService` — **điểm duy nhất** đọc `phan_cong_ho_tro_gv`, chỉ lộ API cấp lớp/khóa (`whereLopTrongPhamVi`, `lopIdsCuaToi`, `damBaoLopTrongPhamVi`, `damBaoKhoaTrongPhamVi`) để sau này thu hẹp về lớp mà không sửa nơi khác. Ngoài phạm vi → `404`.

## 2. Dịch vụ Học viên

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| POST | `/hoc-vien` | Tự đăng ký (`nguon_tao='tu_dang_ky'`). Body = toàn bộ field khai báo (xem `database-ddl.sql#hoc_vien`). **Side effect**: tạo `hoc_vien` (trang_thai=`nhap`) VÀ `nguoi_dung` (vai_tro=`hoc_vien`, `ten_dang_nhap`=ĐDCN, mật khẩu mặc định = ngày sinh) trong 1 transaction — xem chi tiết ở mục "Luồng đăng ký". | Công khai |
| GET | `/hoc-vien/toi` | Hồ sơ của chính mình, kèm `chuyen_mon: string[]`. **Thêm 2026-09-28**: kèm sẵn tên đã join cho FK chọn-từ-danh-mục — `don_vi_cong_tac_ten`, `mon_giang_day_ten` — để màn "Xem lại & xác nhận" hiển thị tên thay vì UUID mà không phải gọi thêm request. **Sửa 2026-09-30 (xem "Nơi sinh & Cư trú" bên dưới)**: `noi_sinh` giờ là text tự do (không còn FK); thêm `cu_tru_tinh_id`/`cu_tru_phuong_xa_id` kèm `cu_tru_tinh_ten`/`cu_tru_phuong_xa_ten`. `noi_sinh_ten`/`phuong_xa_ten` (deprecated, từ `noi_sinh_id`/`phuong_xa_id` cũ) vẫn trả về nếu hồ sơ còn dữ liệu cũ. Áp dụng tương tự cho `GET /hoc-vien/{id}` (mục "Ai gọi" khác) | Học viên |
| PATCH | `/hoc-vien/toi` | Sửa hồ sơ. `nguon_tao='tu_dang_ky'`: chỉ khi `trang_thai='nhap'` (đã `cho_duyet` thì khóa sửa, trừ khi bị `tu_choi` thì mở lại `nhap`) — **không đổi** so với trước. `nguon_tao='import_moet'` **(T14, 2026-09-28 — thay đổi hành vi)**: chỉ sửa được khi có **đợt xác nhận đang mở** (bất kể `trang_thai`, luôn `da_duyet`), ngoài giờ đợt trả `403 DOT_XAC_NHAN_DONG`; sửa được mọi trường khai báo kể cả `ho_ten`/ngày sinh/`don_vi_cong_tac_id` (không sửa `ma_dinh_danh_moet`); mỗi trường đổi ghi 1 dòng `lich_su_thay_doi_ho_so`; nếu đang có xác nhận còn hiệu lực ở đợt đó thì bị hủy, response thêm `xac_nhan_bi_huy: boolean`. Xem mục "Đợt xác nhận & lịch sử thay đổi hồ sơ" bên dưới. **Thêm 2026-09-30**: đổi `email_lien_he` (giá trị mới khác giá trị cũ) → tự `email_da_xac_minh=false` + tạo token + gửi email xác minh tới địa chỉ MỚI (hết hạn sau 24 giờ) — xem mục "Xác minh email liên hệ & quên/đặt lại mật khẩu" bên dưới. **Sửa 2026-09-30**: body dùng `noi_sinh` (string, text tự do), `cu_tru_tinh_id`/`cu_tru_phuong_xa_id` (uuid, tùy chọn) — xem mục "Nơi sinh & Cư trú" bên dưới | Học viên |
| POST / DELETE | `/hoc-vien/toi/chuyen-mon` | Thêm / xóa 1 giá trị trong `hoc_vien_chuyen_mon` (nhiều chuyên môn/người). **T14**: với `import_moet`, cùng gate + ghi lịch sử (`truong='chuyen_mon'`) + hủy xác nhận như PATCH ở trên | Học viên |
| POST | `/hoc-vien/toi/kiem-tra-truoc-xac-nhan` | Dry-run validate toàn bộ hồ sơ, trả danh sách lỗi (chặn) + cảnh báo (không chặn) — dùng cho màn `XacNhanThongTin.dc.html` | Học viên |
| POST | `/hoc-vien/toi/gui-lai-xac-minh-email` | **Thêm 2026-09-30**: gửi lại email xác minh cho `email_lien_he` hiện tại → `{ da_gui: true }`. Chưa có `email_lien_he` → `400 VALIDATION_ERROR`; đã `email_da_xac_minh=true` → `409 CONFLICT`; vừa gửi trong 60 giây gần nhất (chặn spam) → `429 RATE_LIMITED`. Xem mục "Xác minh email liên hệ & quên/đặt lại mật khẩu" bên dưới | Học viên |
| POST | `/hoc-vien/toi/xac-nhan` | `tu_dang_ky`: chuyển `nhap` → `cho_duyet` (không đổi). `import_moet` **(T14 — thay đổi hành vi, trước đây chỉ resend email)**: bắt buộc có đợt đang mở (không thì `403 DOT_XAC_NHAN_DONG`) và hồ sơ đầy đủ (T9, không thì `400 VALIDATION_ERROR` kèm `fields`=danh sách thiếu); **2026-10-05: đã có xác nhận còn hiệu lực ở đợt đang mở → `409 CONFLICT`** (chỉ xác nhận lại sau khi sửa hồ sơ — sửa tự hủy xác nhận) → tạo `xac_nhan_ho_so` (bản chụp hồ sơ). **Side effect** (cả 2 luồng): gọi Dịch vụ Thông báo gửi email bản sao dữ liệu, set `email_ban_sao_da_gui_at` | Học viên |
| GET | `/hoc-vien` | Danh sách hồ sơ trong phạm vi quyền (query: `trang_thai`, `don_vi_cong_tac_id`, `cap_giang_day`, `nguon_tao`, `q` tìm theo tên/ĐDCN/Mã MOET, `day_du` — T1/T9 2026-09-28, xem mục "Hồ sơ đầy đủ" bên dưới). **Thêm 2026-10-01**: phần `q` khớp theo tên (`ho_ten`) tìm không phân biệt dấu/hoa-thường (unaccent); khớp theo ĐDCN/Mã MOET vẫn là chuỗi con chính xác như trước | Trường, Phòng VHXH, Sở, QuảnTrị |
| GET | `/hoc-vien/{id}` | Chi tiết 1 hồ sơ (phải trong phạm vi quyền) | Trường, Phòng VHXH, Sở, QuảnTrị |
| PATCH | `/hoc-vien/{id}` | **Thêm T14 (2026-09-28)**: Quản trị sửa hồ sơ `import_moet` NGOÀI thời gian đợt (học viên lúc đó chỉ xem) — cùng field/hành vi ghi lịch sử như `PATCH /hoc-vien/toi` (`vai_tro_nguoi_sua='quan_tri'`), nhưng **không** bị chặn bởi đợt đang mở | QuảnTrị |
| POST | `/hoc-vien/{id}/duyet` | `{ ket_qua: "da_duyet" \| "tu_choi", ly_do? }`. Đơn vị duyệt xác định theo `cap_giang_day` của hồ sơ (xem bảng routing dưới). Chỉ áp dụng hồ sơ `nguon_tao='tu_dang_ky'` — hồ sơ `import_moet` bỏ qua bước này | Trường (nếu được phân công xác minh nội bộ), Phòng VHXH, Sở |
| GET | `/hoc-vien/kiem-tra-trung?so_dinh_danh_ca_nhan=` | Kiểm tra ĐDCN đã tồn tại chưa (gọi trước khi submit form, tránh lỗi 409 muộn). **T1 (2026-09-28):** giới hạn 10 request/phút/IP (`429 RATE_LIMITED`) | Công khai |
| GET | `/hoc-vien/toi/muc-do-day-du` | T9 (2026-09-28): `{ day_du: boolean, thieu: [{field, message}] }` — cổng học viên xem còn thiếu gì để hồ sơ được coi là "đầy đủ" (xem mục "Hồ sơ đầy đủ" bên dưới) | Học viên |
| GET | `/hoc-vien/toi/dot-xac-nhan` | **Thêm T14, sửa 2026-10-05**: `{ dot: {id, ten, loai, mo_luc, dong_luc} \| null, dot_sap_mo: {ten, mo_luc} \| null, dang_mo, da_xac_nhan, xac_nhan_luc, can_xac_nhan_lai, dieu_chinh_luc, xac_nhan_gan_nhat: {dot_ten, xac_nhan_luc} \| null, ap_dung_dot, day_du, thieu: [...] }`. **`dot` chỉ là đợt ĐANG MỞ** (trước 2026-10-05 `dot` gộp cả đợt sắp mở — FE hiểu nhầm là đang mở); đợt sắp mở gần nhất ở `dot_sap_mo`. `da_xac_nhan`/`xac_nhan_luc` = xác nhận còn hiệu lực ở đợt đang mở. `can_xac_nhan_lai` = đã từng xác nhận ở đợt đang mở nhưng sửa hồ sơ làm hủy (thời điểm ở `dieu_chinh_luc`). Không có đợt mở → `xac_nhan_gan_nhat` = xác nhận còn hiệu lực gần nhất ở đợt trước. `ap_dung_dot=false` với `tu_dang_ky` (không áp dụng khái niệm đợt, các trường đợt rỗng) | Học viên |
| GET | `/hoc-vien/toi/danh-gia-dau-vao` | **Thêm T15 (2026-09-28)**: cổng điều kiện làm đánh giá đầu vào — xem mục "Cổng điều kiện làm đánh giá đầu vào & tài khoản VLE" bên dưới | Học viên |

### Nơi sinh & Cư trú (sửa 2026-09-30, T16; tách 3 trường 2026-10-01, T17)

Quyết định nghiệp vụ chốt 2026-09-30: giấy khai sinh có thể ghi nơi sinh theo địa giới hành chính **CŨ** (thời điểm sinh), khác địa giới **HIỆN TẠI** mà `dia_danh` đang quản lý (chỉ còn 46 tỉnh/thành `active`) — DB không có bộ dữ liệu địa giới cũ để chọn.

**T17 (2026-10-01) — tách `noi_sinh` (1 ô text tự do) thành 3 trường riêng biệt**, vẫn là text tự do (không FK `dia_danh`, cùng lý do địa giới cũ ở trên):
- **`noi_sinh_tinh`** (string, tối đa 255 ký tự, **tùy chọn**): Tỉnh/Thành nơi sinh.
- **`noi_sinh_huyen`** (string, tối đa 255 ký tự, **tùy chọn**): Quận/Huyện nơi sinh.
- **`noi_sinh_xa`** (string, tối đa 255 ký tự, **tùy chọn**): Phường/Xã nơi sinh.
- Cả 3 **hoàn toàn tùy chọn** — để trống cả 3 vẫn lưu được (`PATCH`/`POST` không chặn), **KHÔNG tính vào "Hồ sơ đầy đủ"** (sửa quyết định 2026-09-30 — trước đó `noi_sinh` còn bắt buộc ở `tu_dang_ky`, giờ bỏ hẳn khỏi điều kiện đầy đủ, xử lý giống `cu_tru_*` bên dưới).
- Thay thế hoàn toàn `noi_sinh` (cột text 500 ký tự, thêm 2026-09-30 — xem `database-ddl.sql` về việc cột này được giữ lại deprecated hay xóa hẳn tùy dữ liệu đã có lúc migrate).
- **`cu_tru_tinh_id`/`cu_tru_phuong_xa_id`** (uuid, **tùy chọn**, không đổi): "Cư trú" — dùng đúng địa giới hành chính HIỆN TẠI (`dia_danh`, cấp `tinh_thanh` → `phuong_xa_dac_khu`, `cu_tru_phuong_xa_id.parent_id` phải khớp `cu_tru_tinh_id` nếu cả 2 cùng gửi). KHÔNG bắt buộc, KHÔNG tính vào "Hồ sơ đầy đủ" — nhưng nếu gửi kèm giá trị sai (không tồn tại/không đúng cấp/không khớp tỉnh) vẫn báo lỗi `VALIDATION_ERROR`.
- **Deprecated (giữ để không mất dữ liệu cũ, KHÔNG dùng trong luồng mới)**: `noi_sinh_id`/`phuong_xa_id` (FK `dia_danh`, thay bởi `noi_sinh` rồi `noi_sinh_tinh/huyen/xa` — xem rule #13-16 cũ trong `validation-checklist.md`, đã bị **thay thế** bởi rule mới). Response `GET /hoc-vien/toi`/`{id}` vẫn trả `noi_sinh_ten`/`phuong_xa_ten` nếu hồ sơ còn dữ liệu cũ nhất (từ FK, chưa từng migrate).

### Hồ sơ đầy đủ (T9, 2026-09-28)

"Đầy đủ" = qua **toàn bộ** quy tắc của luồng `tu_dang_ky` trong `validation-checklist.md` (không chỉ "không NULL"): họ tên hợp lệ, CCCD 12 số không trùng, ngày sinh hợp lệ, đơn vị `active` loại `truong`, SĐT + email hợp lệ, trình độ, ≥1 chuyên môn. **Sửa 2026-10-01 (T17)**: `noi_sinh_tinh`/`noi_sinh_huyen`/`noi_sinh_xa` (như `cu_tru_tinh_id`/`cu_tru_phuong_xa_id`) KHÔNG tính vào "đầy đủ" — hoàn toàn tùy chọn. Cảnh báo 🟡 **không** làm hồ sơ "chưa đầy đủ". Tính động qua `HocVienService.danhGiaDayDu()` (tái dùng đúng bộ quy tắc của `validateHocVien`/Dịch vụ Kiểm tra dữ liệu) — **không lưu cột tính sẵn**, luôn tính lại từ dữ liệu hiện tại. `GET /hoc-vien?day_du=false` lọc theo giá trị tính động này ở tầng ứng dụng (không phải điều kiện `WHERE` trên DB) — chấp nhận đánh đổi hiệu năng ở quy mô hiện tại (~9.000 hồ sơ).

### Đợt xác nhận & lịch sử thay đổi hồ sơ (T14, 2026-09-28)

Áp dụng riêng cho hồ sơ `nguon_tao='import_moet'` (thay rule #27/#28 cũ cho nguồn này — `tu_dang_ky` không đổi). Luồng nghiệp vụ (mo-rong-nls-an-giang.md mục 0): Đợt 1 (`kiem_tra_bo_sung`) — học viên đăng nhập kiểm tra/sửa/bổ sung hồ sơ; hết đợt 1, dữ liệu chuyển Phòng CNTT tạo tài khoản VLE (T15); Đợt 2 (`xac_nhan_truoc_danh_gia`) — ngay trước đánh giá đầu vào, học viên xác nhận lần cuối.

- **"Đợt đang mở"** của 1 học viên = đợt (bất kỳ `loai`) có `mo_luc <= now() < dong_luc` và (`khoa_id IS NULL` — áp dụng mọi hồ sơ import_moet, kịch bản P0 — hoặc học viên đã ghi danh đúng `khoa_id` đó qua `dang_ky_hoc`). Các đợt không được chồng thời gian trong cùng phạm vi (`khoa_id`) — kiểm tra khi `POST`/`PATCH /dot-xac-nhan`.
- `PATCH /hoc-vien/toi`, `POST`/`DELETE /hoc-vien/toi/chuyen-mon`: chỉ cho phép khi có đợt đang mở. Mỗi trường thay đổi (không phải mỗi request) → 1 dòng `lich_su_thay_doi_ho_so`; sửa tiếp sau khi đã xác nhận trong đợt đó → xác nhận cũ `con_hieu_luc=false` (response trả `xac_nhan_bi_huy: true`).
- `POST /hoc-vien/toi/xac-nhan`: bắt buộc đợt đang mở + hồ sơ đầy đủ (T9) → tạo `xac_nhan_ho_so` (bản chụp `du_lieu` = response của `GET /hoc-vien/toi` tại thời điểm xác nhận).
- Ngoài giờ đợt: học viên chỉ xem (`GET` không bị chặn). Quản trị sửa qua `PATCH /hoc-vien/{id}` (không bị chặn bởi đợt).

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| POST | `/dot-xac-nhan` | `{ khoa_id?, ten, loai, mo_luc, dong_luc }` (ISO datetime). `khoa_id` bỏ trống = áp dụng toàn cục | QuảnTrị |
| PATCH | `/dot-xac-nhan/{id}` | `{ dong_luc }` — gia hạn (chỉ sửa `dong_luc`, không sửa `mo_luc`/`loai`/`khoa_id`) | QuảnTrị |
| GET | `/dot-xac-nhan?khoa_id=` | Danh sách đợt | QuảnTrị |
| GET | `/bao-cao/xac-nhan?dot_id=&trang_thai=chua_dang_nhap\|dang_bo_sung\|da_xac_nhan&don_vi_cong_tac_id=` + `/xuat-excel` | Tiến độ xác nhận của 1 đợt cụ thể (`dot_id` bắt buộc — improvised, xem `bao-cao.service.ts`). **Phạm vi (sửa 2026-10-03, fix #2 final-review ADR 0001):** nếu đợt gắn `khoa_id` và caller thỏa **R1** cho khóa đó (`khoa.don_vi_dat_hang_id` ∈ phạm vi caller) → thấy **toàn bộ** học viên ghi danh khóa, `?don_vi_cong_tac_id=` chỉ là bộ lọc thuần (không 403 khi ngoài phạm vi); các trường hợp khác (đợt không gắn khóa, hoặc không thỏa R1) → giữ hành vi cũ, lọc theo đơn vị công tác của caller (tương đương R2), `?don_vi_cong_tac_id=` ngoài phạm vi → 403. `chua_dang_nhap` dựa trên `nguoi_dung.dang_nhap_lan_cuoi` (T1) | Trường, Phòng VHXH, Sở, QuảnTrị |
| GET | `/bao-cao/sua-truong-moet?khoa_id=` + `/xuat-excel` | Danh sách thay đổi trường gốc MOET (`la_truong_goc_moet=true`) để N1 rà soát | QuảnTrị |
| GET | `/bao-cao/xuat-cho-vle?khoa_id=` | File Excel trực tiếp: mã MOET, họ tên, email (nếu có), đơn vị, trạng thái đợt 1 (đợt `kiem_tra_bo_sung` gần nhất khớp `khoa_id`) — chuyển Phòng CNTT tạo tài khoản VLE (T15) | QuảnTrị |

### Cổng điều kiện làm đánh giá đầu vào & tài khoản VLE (T15, 2026-09-28) — QĐ8, QĐ9

> **2026-10-02 — 2 kênh, chọn ở cấu hình khảo sát (`kenh_danh_gia`, mục 9).** Response `GET /hoc-vien/toi/danh-gia-dau-vao` luôn có thêm `kenh: 'sso' | 'vle'`. Kênh `vle` = toàn bộ quy tắc T15 bên dưới (mặc định, kể cả khi chưa lưu cấu hình). Kênh `sso`: **đủ điều kiện = chỉ cần hồ sơ đầy đủ (T9)** — không cần đợt 2, xác nhận hay tài khoản VLE; trả `{ kenh: 'sso', du_dieu_kien: true }` (KHÔNG kèm link — link cấp lúc bấm qua `POST /sso/cap-ma`, mục 10) hoặc `{ kenh: 'sso', du_dieu_kien: false, ly_do: string[] }`. **2026-10-07 — đối tượng `nhan_vien`:** khảo sát chưa triển khai → endpoint này (mọi kênh) và `GET /hoc-vien/toi/khao-sat-dau-ra` (khi đã mở) trả thêm `chua_trien_khai: true`, `du_dieu_kien: false`, `ly_do` = 1 câu thông báo (năm 2027); `POST /sso/cap-ma` trả 403 với cùng câu đó.

Cách B (QĐ8): Phòng CNTT tạo tài khoản VLE cho **TẤT CẢ** học viên `import_moet` (import `tai_khoan_vle`, xem mục 5) — hệ thống chỉ **ẩn/hiện** thông tin đường dẫn + tài khoản, không chặn việc tạo tài khoản (chặn "mềm").

- **Đủ điều kiện** = có `xac_nhan_ho_so` **còn hiệu lực** (`con_hieu_luc=true`) ở 1 đợt `loai='xac_nhan_truoc_danh_gia'` áp dụng cho học viên **VÀ** hồ sơ đầy đủ (T9, `danhGiaDayDu`) **tại thời điểm gọi** — không phải tại lúc xác nhận. Sửa hồ sơ sau khi xác nhận sẽ hủy xác nhận đó (T14) nên tự động mất điều kiện; **không cần đợt đang mở** để vẫn được coi là đủ (chỉ cần xác nhận CÒN HIỆU LỰC, đợt đã đóng hay chưa không quan trọng).
- `GET /hoc-vien/toi/danh-gia-dau-vao`:
  - Đủ điều kiện: `{ du_dieu_kien: true, duong_dan, ten_dang_nhap_vle, mat_khau_tam }` (`mat_khau_tam` giải mã tức thời từ `mat_khau_tam_ma_hoa`, `null` nếu dòng import không có mật khẩu tạm) — ghi `tai_khoan_vle.lan_dau_xem_luc=now()` nếu đang `NULL`.
  - Chưa đủ, đợt 2 chưa đóng (hoặc chưa từng tạo đợt 2): `{ du_dieu_kien: false, ly_do: string[], dot: {id, ten, loai, mo_luc, dong_luc} | null }` — **không** trả bất kỳ trường VLE nào.
  - Chưa đủ **và** đợt 2 áp dụng cho học viên **đã đóng** (`dong_luc <= now()`) — QĐ9: `{ du_dieu_kien: false, het_han: true }` (không trả `ly_do`/`dot`) — vào danh sách xử lý riêng.
- `GET /bao-cao/dieu-kien-danh-gia?khoa_id=` + `/xuat-excel` (QuảnTrị): mỗi dòng 1 học viên `import_moet` — `du_dieu_kien`, `ly_do` (rỗng nếu đủ), `da_xem_vle` (`tai_khoan_vle.lan_dau_xem_luc IS NOT NULL`). Cùng logic "đủ điều kiện" ở trên, tính lại cho từng hồ sơ (chấp nhận đánh đổi hiệu năng ở tầng ứng dụng như `GET /hoc-vien?day_du=`).
- Bảo mật `mat_khau_tam`: mã hóa AES-256-GCM tại `mat_khau_tam_ma_hoa` (xem mục 5, import `tai_khoan_vle`) — chỉ giải mã đúng lúc trả cho **chính học viên đó** qua `GET /hoc-vien/toi/danh-gia-dau-vao` khi đủ điều kiện; không endpoint quản trị nào khác trả giá trị này (kể cả báo cáo `dieu-kien-danh-gia`).

### Xác minh email liên hệ & quên/đặt lại mật khẩu (2026-09-30)

Học viên đăng nhập bằng `ten_dang_nhap` (ĐDCN hoặc Mã định danh CSDL MOET) — **không phải email**. Vì vậy "quên mật khẩu" cần biết email nào đáng tin để gửi link, nên **chỉ hoạt động với hồ sơ đã có `email_lien_he` VÀ email đó đã được xác minh** (`hoc_vien.email_da_xac_minh=true`) — đây là lý do cần xây xác minh email trước/cùng lúc.

- Bảng `token_xac_thuc` (`id, hoc_vien_id, loai ('xac_minh_email'|'dat_lai_mat_khau'), token_hash, het_han_luc, da_dung_luc, tao_luc`): token dùng 1 lần, **không dùng JWT** (JWT không thu hồi sớm được, cùng lý do với `token_thu_hoi` của đăng nhập). Token gốc = 32 byte ngẫu nhiên (hex), chỉ tồn tại trong email gửi đi; DB chỉ lưu `token_hash` (SHA-256 hex) — tra cứu theo hash, không bao giờ lưu bản rõ.
- **Xác minh email**: đổi `email_lien_he` (qua `PATCH /hoc-vien/toi` hoặc `PATCH /hoc-vien/{id}`) → `email_da_xac_minh=false` + tạo token `xac_minh_email` (hết hạn 24 giờ) + gửi email chứa link `FRONTEND_URL/xac-minh-email?token=...`. Học viên có thể tự gửi lại qua `POST /hoc-vien/toi/gui-lai-xac-minh-email` (chặn spam: không gửi lại nếu còn token hiệu lực tạo dưới 60 giây trước). Xác nhận qua `POST /auth/xac-minh-email` (công khai, chỉ cần `token`).
- **Quên mật khẩu**: `POST /auth/quen-mat-khau` — **luôn** trả `{ da_gui: true }`, không phân biệt tài khoản có tồn tại/là học viên/có email đã xác minh hay không (nguyên tắc không tiết lộ enumeration, rule #9/#55). Chỉ khi đủ điều kiện (học viên + email đã xác minh) mới thật sự tạo token `dat_lai_mat_khau` (hết hạn 30 phút, vô hiệu các token `dat_lai_mat_khau` chưa dùng trước đó của cùng học viên) và gửi email chứa link `FRONTEND_URL/dat-lai-mat-khau?token=...`.
- **Đặt lại mật khẩu**: `POST /auth/dat-lai-mat-khau` (công khai) — verify token (đúng loại, chưa hết hạn, chưa dùng; sai bất kỳ điều kiện nào → 1 thông báo lỗi chung, không tiết lộ chi tiết), validate `mat_khau_moi` theo cùng rule #56 (`POST /auth/doi-mat-khau`), cập nhật `mat_khau_hash` + `phai_doi_mat_khau=false`, đánh dấu token đã dùng + vô hiệu các token `dat_lai_mat_khau` chưa dùng khác.
- Token sai/hết hạn/đã dùng (cả 2 loại) dùng **chung 1 thông báo lỗi**, không phân biệt lý do cụ thể — tránh dò trạng thái token.

### Routing đơn vị duyệt (theo `cap_giang_day` của hồ sơ)
```
THPT               → Sở GD&ĐT quản lý tỉnh chứa dia_ban_id của đơn vị công tác
MN / TH / THCS     → Phòng Văn hóa - Xã hội quản lý đúng xã/phường đó
NULL (không có)    → Sở GD&ĐT quản lý tỉnh (mặc định an toàn cho nhân viên
                     không trực tiếp giảng dạy — họ vẫn có thể để trống
                     cap_giang_day vĩnh viễn, không chỉ tạm thời)
```
Sở luôn được phép duyệt thay Phòng VHXH (escalation trong scope-based). Chiều ngược lại — Phòng VHXH duyệt hồ sơ THPT — bị từ chối `403`.

### Luồng đăng ký (chi tiết transaction của `POST /hoc-vien`)

**Thứ tự tạo bảng ĐÃ SỬA (2026-09-25):** bản đầu ghi tạo `nguoi_dung` trước `hoc_vien` — nhưng vậy vi phạm ngay `chk_nguoi_dung_scope` (`vai_tro='hoc_vien'` đòi `hoc_vien_id IS NOT NULL` tại chính câu `INSERT`, mà lúc đó `hoc_vien` chưa tồn tại nên không thể có id để gán). Thứ tự đúng là tạo `hoc_vien` trước, `nguoi_dung` sau (đã có sẵn `hoc_vien.id` để gán ngay), rồi backfill `hoc_vien.created_by` — phát hiện khi implement thật, xem `backend/src/hoc-vien/hoc-vien.service.ts`.

1. Validate toàn bộ body (xem `validation-checklist.md`).
2. `INSERT INTO hoc_vien (..., created_by=NULL)` → lấy `hoc_vien.id`.
3. `INSERT INTO nguoi_dung (vai_tro='hoc_vien', ten_dang_nhap=so_dinh_danh_ca_nhan, mat_khau_hash=hash(ngay_sinh dạng ddmmyyyy), phai_doi_mat_khau=true, hoc_vien_id=hoc_vien.id)` → lấy `nguoi_dung.id`. Thỏa `chk_nguoi_dung_scope` ngay từ câu lệnh này vì `hoc_vien_id` đã có giá trị thật.
4. `UPDATE hoc_vien SET created_by = nguoi_dung.id WHERE id = hoc_vien.id`.
5. Commit. Trả về `{ hoc_vien_id, ten_dang_nhap: so_dinh_danh_ca_nhan, luu_y: "Mật khẩu mặc định là ngày sinh — bắt buộc đổi khi đăng nhập lần đầu" }`.

### Luồng import nhân sự từ CSDL MOET (`POST /import/ho-so-nhan-su-moet`, xem mục 5)

File nhận từ Sở/Bộ theo mẫu: `Đơn vị`, `Mã đơn vị` (tùy chọn, T4 2026-09-28), `Mã định danh (CDSL moet)` (tùy chọn — xem T4b 2026-09-29), `Số định danh cá nhân`/CCCD (tùy chọn, T4b 2026-09-29), `Họ và tên`, `Ngày`, `Tháng`, `Năm` (3 cột riêng), `Chức vụ`, `Chuyên môn` (có thể nhiều giá trị/dòng, phân tách bằng `;`), `Số điện thoại`, `Ghi chú`.

**T4b (2026-09-29) — mã định danh CSDL ngành và CCCD KHÔNG phải lúc nào cũng trùng nhau, xác nhận một số trường không cung cấp được mã định danh CSDL ngành khi báo danh sách.** Cả 2 cột `Mã định danh (CDSL moet)` và `Số định danh cá nhân` đều tùy chọn ở cấp file, nhưng **mỗi dòng bắt buộc có ít nhất 1 trong 2** (dòng thiếu cả 2 → lỗi). Dò dòng tiêu đề vẫn neo vào cột `Đơn vị` (luôn bắt buộc) thay vì `Mã định danh`.

**T4 (2026-09-28) — chịu định dạng file thực tế:** parser (`readMoetWorkbookRows`, `backend/src/import/util/moet-excel.util.ts`) tự dò dòng tiêu đề thật (bỏ qua dòng tiêu đề/ghi chú phía trên), nhận tiêu đề gộp ô 2 tầng ("Ngày tháng năm sinh" gộp 3 cột con `Ngày`/`Tháng`/`Năm` ở dòng ngay dưới), khớp tên cột không phân biệt hoa/thường, khoảng trắng thừa, bỏ phần trong ngoặc. Ô số Excel lưu dạng number (mã MOET, SĐT) được đọc về chuỗi không `.0`/ký hiệu khoa học. `Ngày`/`Tháng` dạng `08` hoặc `8` đều hợp lệ (đã hỗ trợ sẵn qua `class-transformer`).

Với mỗi dòng hợp lệ (cùng thứ tự tạo bảng đã sửa như "Luồng đăng ký" ở trên — `hoc_vien` trước `nguoi_dung`):
1. Nếu có cột `Mã đơn vị` (giá trị khác trống): khớp `don_vi_cong_tac.ma_don_vi` — **ưu tiên hơn** khớp theo tên (cần thiết sau sáp nhập An Giang – Kiên Giang, tên trường dễ trùng giữa 2 tỉnh cũ). Không khớp được → dòng lỗi. Nếu để trống: khớp cột `Đơn vị` với `don_vi_cong_tac.ten_don_vi` (chỉ trong phạm vi quyền của người chạy import). Không khớp được / khớp nhiều hơn 1 → dòng lỗi (thông báo liệt kê `ma_don_vi` của các đơn vị trùng, gợi ý thêm cột `Mã đơn vị`).
1b. `Số điện thoại` đúng 9 chữ số, bắt đầu bằng `3/5/7/8/9` (thiếu số 0 đầu do Excel lưu dạng number) → tự thêm `0`, ghi **cảnh báo 🟡** vào preview (`GET /import/{id}` trả thêm `danh_sach_canh_bao: [{dong, ly_do}]`, không chặn dòng). Các sai định dạng khác vẫn là dòng lỗi theo rule #20. **T4c (2026-09-30)**: nếu ô để trống, KHÔNG còn là dòng lỗi — lưu `NULL`, học viên tự bổ sung sau (chỉ validate định dạng khi ô CÓ giá trị).
1c. **T4c (2026-09-30)** — xác nhận danh sách tiếp nhận MOET thực tế có dòng thiếu SĐT và/hoặc thiếu hẳn `Chuyên môn`: cả 2 cột hết bắt buộc phải có giá trị ở mỗi dòng (trước đây SĐT bắt buộc theo rule #19-20 dùng chung cho mọi nguồn, `Chuyên môn` bắt buộc ≥1 giá trị) — **chỉ áp dụng cho `import_moet`**, luồng `tu_dang_ky` (`POST /hoc-vien` tự đăng ký) không đổi, 2 field này vẫn bắt buộc như cũ. Cột vẫn phải TỒN TẠI trong file (`REQUIRED_CANONICAL` không đổi), chỉ nới ở cấp GIÁ TRỊ từng ô/dòng.
2. `INSERT INTO hoc_vien (nguon_tao='import_moet', ma_dinh_danh_moet, so_dinh_danh_ca_nhan, ho_ten, ngay_sinh, thang_sinh, nam_sinh, chuc_vu, don_vi_cong_tac_id, so_dien_thoai_lien_he, ghi_chu, trang_thai='da_duyet', nguoi_duyet_id=<tài khoản đang chạy import>, cap_duyet_thuc_te='quan_tri', ngay_duyet=now(), created_by=NULL)` → lấy `hoc_vien.id`. **T4b**: `ma_dinh_danh_moet`/`so_dinh_danh_ca_nhan` lấy từ cột tương ứng nếu dòng có cung cấp (mỗi dòng có ít nhất 1 trong 2, có thể có cả 2). **T4c**: `so_dien_thoai_lien_he` = `NULL` nếu ô trống (không còn `NOT NULL` ở DB cho hồ sơ `import_moet` — xem `database-ddl.sql`). Mọi field khác chưa có ở luồng này (nơi sinh, phường xã, email, trình độ, cấp giảng dạy, môn giảng dạy) để `NULL`.
3. `INSERT INTO nguoi_dung (vai_tro='hoc_vien', ten_dang_nhap=(ma_dinh_danh_moet ?? so_dinh_danh_ca_nhan), mat_khau_hash=hash(ngay_sinh dạng ddmmyyyy), phai_doi_mat_khau=true, email=NULL, hoc_vien_id=hoc_vien.id)` → lấy `nguoi_dung.id`. **T4b**: ưu tiên mã MOET làm `ten_dang_nhap` khi dòng có cả 2; chỉ dùng CCCD khi dòng không có mã MOET.
4. Tách `Chuyên môn` theo `;` nếu ô có giá trị (**T4c**: có thể để trống, khi đó `hoc_vien_chuyen_mon` không có dòng nào cho học viên này lúc import), `INSERT` từng giá trị vào `hoc_vien_chuyen_mon`.
5. `UPDATE hoc_vien SET created_by = nguoi_dung.id WHERE id = hoc_vien.id`.
6. Dòng lỗi điển hình: `Mã định danh`/CCCD trùng đã tồn tại (`uq_hoc_vien_ma_moet`/`uq_hoc_vien_ddcn`), thiếu cả 2 mã, thiếu `Đơn vị`/không khớp, ngày sinh không hợp lệ. **T4d (2026-09-30)**: cũng báo lỗi nếu `Mã định danh (CDSL moet)`/`Số định danh cá nhân` **trùng với dòng khác trong CÙNG FILE** (không chỉ trùng dữ liệu đã có trong DB) — kiểm tra bằng `dupKeys` (cùng cơ chế `lop_va_lich_hoc` dùng phát hiện trùng lớp/giai đoạn/buổi), báo NGAY ở bước preview (`POST /import/ho-so-nhan-su-moet`) thay vì chỉ lộ ra ở `POST /import/{id}/xac-nhan` sau khi dòng đầu đã ghi vào DB.

**T4b (2026-09-29, sửa lại quyết định trước đó) — xác nhận mã định danh CSDL ngành và CCCD KHÔNG giả định trùng nhau, và không phải trường nào cũng cung cấp được mã định danh CSDL ngành.** Vì vậy:
- Học viên nhận tài khoản đăng nhập bằng **mã định danh CSDL MOET HOẶC CCCD (tùy dòng import có mã nào) + ngày sinh**.
- `POST /auth/dang-nhap`: `ten_dang_nhap` khớp theo **1 trong 2** — hoặc đúng `nguoi_dung.ten_dang_nhap`, hoặc đúng `hoc_vien.so_dinh_danh_ca_nhan` của hồ sơ liên kết (kể cả khi tài khoản đã tạo bằng mã MOET nhưng học viên đã tự bổ sung CCCD sau đó qua `PATCH /hoc-vien/toi` — lúc đó đăng nhập được bằng CẢ 2 giá trị). Không tiết lộ giá trị nào khớp trong thông báo lỗi (vẫn dùng chung 1 câu lỗi như rule #9).
- Sau khi đăng nhập lần đầu, học viên tự bổ sung CCCD (nếu import chưa có) và các thông tin còn thiếu qua `PATCH /hoc-vien/toi` — hồ sơ đã `da_duyet` sẵn nên không cần Trường/Sở/Phòng duyệt lại.

---

## 3. Dịch vụ Khóa bồi dưỡng & Lớp học

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| POST | `/khoa-boi-duong` | **Sửa 2026-10-03 (ADR 0001, thay T2/QĐ2)**: chỉ Quản trị (HCMUE) tạo khóa — bỏ hẳn Trường tự tạo + luồng nộp duyệt/duyệt (D1). Body bắt buộc `don_vi_dat_hang_id` (D2 — đơn vị `active`, loại `so_gddt`/`truong`/`khac`, **không nhận** `phong_vhxh`): thiếu → `400 VALIDATION_ERROR` field `don_vi_dat_hang_id` message `"Bắt buộc"`; không tồn tại hoặc `trang_thai != active` → `400` message `"Không hợp lệ"`; `loai_don_vi = phong_vhxh` → `400` message `"Sai loại đơn vị"`. Khóa tạo ra `trang_thai='da_duyet'` ngay (`nguoi_duyet_id`=quan_tri, `cap_duyet_thuc_te='quan_tri'`, `ngay_duyet=now()`) | QuảnTrị |
| PATCH | `/khoa-boi-duong/{id}` | **Sửa 2026-10-03 (ADR 0001)**: Quản trị sửa được ở **mọi** trạng thái (bỏ ràng buộc chỉ `nhap`/`tu_choi`). `don_vi_dat_hang_id` tùy chọn — không gửi = giữ nguyên, có gửi = validate lại đúng quy tắc như `POST` ở trên. **Thêm 2026-10-08**: `mo_dieu_chinh_muc` (boolean, tùy chọn) — công tắc cho học viên tự điều chỉnh mức lớp học; `GET /khoa-boi-duong/{id}` trả cột này | QuảnTrị |
| GET | `/khoa-boi-duong` | Danh sách. **Sửa 2026-10-03 (ADR 0001, thay T2/QĐ2)**: với Trường/Phòng VHXH/Sở, khóa hiện ra khi `id` nằm trong tập xem được theo **R1/R2** (xem mục "Phạm vi xem khóa bồi dưỡng (R1/R2)" bên dưới). Query `don_vi_dat_hang_id` là bộ lọc thuần (giao với tập xem được) — không còn `403` khi lọc ra ngoài phạm vi, chỉ trả rỗng | Trường, Phòng VHXH, Sở, QuảnTrị, Học viên (chỉ khóa đã `da_duyet`) |
| GET | `/khoa-boi-duong/{id}` | Chi tiết khóa kèm giai đoạn + lớp. **Thêm 2026-09-30 (QĐ10)**: kèm thêm danh sách `cum_hoc_vien` của khóa. **Thêm 2026-10-03 (ADR 0001)**: `403` nếu khóa ngoài tập xem được (R1/R2); trả thêm `pham_vi_hoc_vien: 'toan_bo' \| 'don_vi'` — `'toan_bo'` nếu caller thỏa R1 (hoặc là Quản trị/Học viên), `'don_vi'` nếu chỉ thỏa R2; sĩ số từng lớp (`si_so_hien_tai`) đếm theo đúng phạm vi đó | Theo phạm vi |
| POST | `/khoa-boi-duong/{id}/giai-doan` | Thêm 1 `GiaiDoanKhoa` `{ thu_tu, ten_giai_doan, hinh_thuc, thoi_gian_bat_dau, thoi_gian_ket_thuc }` | QuảnTrị |
| PATCH | `/khoa-boi-duong/{id}/giai-doan/{giai_doan_id}` | **Thêm 2026-09-30**: sửa một phần `{ thu_tu?, ten_giai_doan?, hinh_thuc?, thoi_gian_bat_dau?, thoi_gian_ket_thuc?, trang_thai? }` (`trang_thai='ngung'` để vô hiệu hóa — không xóa cứng). Body rỗng/không có trường hợp lệ → `400 VALIDATION_ERROR`. `giai_doan_id` không thuộc đúng `khoa_id` trên URL → `404`. Không cho đổi `khoa_id` | QuảnTrị |
| POST | `/khoa-boi-duong/{id}/lop` | Tạo `LopHoc` `{ loai_lop, ten_lop, si_so_toi_da? }`. **Thêm 2026-09-30 (QĐ10)**: `loai_lop` (`truc_tiep`\|`zoom`\|`vle`) **bắt buộc** — 3 loại lớp độc lập hoàn toàn nhau (không phải lớp cha/con), tên lớp chỉ duy nhất TRONG cùng 1 loại lớp của 1 khóa (`uq_lop_ten_trong_khoa` đổi thành `(khoa_id, loai_lop, ten_lop)`) | QuảnTrị |
| PATCH | `/khoa-boi-duong/{id}/lop/{lop_id}` | **Thêm 2026-09-30**: sửa một phần `{ ten_lop?, si_so_toi_da?, loai_lop?, nhom_hoc_vien?, muc_nang_luc?, trang_thai? }` (`trang_thai='ngung'` để vô hiệu hóa). Body rỗng/không có trường hợp lệ → `400 VALIDATION_ERROR`. `lop_id` không thuộc đúng `khoa_id` trên URL → `404`. Trùng `(khoa_id, loai_lop, ten_lop)` → `409 CONFLICT`. Đổi `loai_lop` khi lớp đang có đăng ký (`phan_lop_giai_doan` trỏ tới) **không bị chặn** — response trả kèm `canh_bao` (không tự động sửa/xóa các dòng `phan_lop_giai_doan` cũ). Không cho đổi `khoa_id` | QuảnTrị |
| POST | `/khoa-boi-duong/{id}/cum` | **Thêm 2026-09-30 (QĐ10)**: `{ ten_cum, link_zalo?, ghi_chu? }` — tạo 1 **cụm học viên** (nhóm Zalo hỗ trợ theo địa lý), khái niệm độc lập hoàn toàn với cây đơn vị công tác VÀ với 3 loại lớp. Cụm chứa học viên trực tiếp (`dang_ky_hoc.cum_id`), không qua lớp nào. `link_zalo` thiếu scheme (vd `zalo.me/g/abc`) tự thêm `https://`; chỉ chấp nhận `http`/`https` hợp lệ, còn lại → `400 VALIDATION_ERROR` | QuảnTrị |
| PATCH | `/khoa-boi-duong/{id}/cum/{cum_id}` | **Thêm 2026-09-30**: sửa một phần `{ ten_cum?, link_zalo?, ghi_chu?, trang_thai? }` (`trang_thai='ngung'` để vô hiệu hóa). Body rỗng/không có trường hợp lệ → `400 VALIDATION_ERROR`. `cum_id` không thuộc đúng `khoa_id` trên URL → `404`. Trùng `(khoa_id, ten_cum)` → `409 CONFLICT`. Không cho đổi `khoa_id`. `link_zalo` chuẩn hóa/validate như ở POST trên | QuảnTrị |
| PUT | `/khoa-boi-duong/{id}/cum/{cum_id}/nguoi-ho-tro` | **Thêm 2026-10-06 (ADR 0003)**: `{ nguoi_dung_ids: uuid[] }` (tối đa 50) **thay toàn bộ** người hỗ trợ của cụm, rỗng = gỡ hết → `{ cum_id, nguoi_ho_tro: [{ id, ho_ten }] }`. Có id không phải `ho_tro_hoc_vien` → `400`; cụm không thuộc khóa → `404`. `GET /khoa-boi-duong/{id}` trả thêm `cum_hoc_vien[].nguoi_ho_tro` **chỉ khi người gọi là Quản trị** | QuảnTrị |
| POST | `/lop/{id}/lich-hoc` | Thêm `LichHocLop` `{ giai_doan_id, buoi_so?, thoi_gian_bat_dau, thoi_gian_ket_thuc, dia_diem_hoac_link }` — **thêm 2026-09-29 (T6, QĐ3)**: `buoi_so` (tùy chọn, mặc định `1`) — 1 lớp có nhiều buổi trong cùng 1 giai đoạn, ràng buộc duy nhất chuyển từ `(lop_id, giai_doan_id)` sang `(lop_id, giai_doan_id, buoi_so)` **Thêm 2026-10-07 (T10, issue #2)**: `diem_hoc_id?` (bắt buộc khi giai đoạn `hinh_thuc='truc_tiep'` → thiếu `400`; điểm học phải `active` → ngược lại `400`), `phong?` (≤ 100 ký tự). Response thêm `canh_bao: string[]` — cảnh báo 🟡 vượt `so_phong` của điểm học (không chặn). | QuảnTrị |
| PATCH | `/lop/{id}/lich-hoc/{lich_hoc_id}` | **Thêm 2026-09-30**: sửa một phần `{ thoi_gian_bat_dau?, thoi_gian_ket_thuc?, dia_diem_hoac_link?, buoi_so?, trang_thai? }`. Body rỗng/không có trường hợp lệ → `400 VALIDATION_ERROR`. `lich_hoc_id` không thuộc đúng `lop_id` trên URL → `404`. Trùng `(lop_id, giai_doan_id, buoi_so)` → `409 CONFLICT`. **`trang_thai` chỉ nhận 3 giá trị đã có** của `trang_thai_lich_hoc` (`chua_dien_ra`\|`dang_dien_ra`\|`ket_thuc`) — enum này CHƯA có giá trị "hủy/vô hiệu", nên endpoint chưa dùng để hủy hẳn 1 buổi học. Không cho đổi `giai_doan_id` **Thêm 2026-10-07 (T10, issue #2)**: `diem_hoc_id?` (`null` = gỡ — không được với giai đoạn trực tiếp), `phong?` (`null` = xóa), `ly_do?` (ghi nhật ký). Sau khi sửa, buổi giai đoạn trực tiếp phải có điểm học (`400`), trừ PATCH chỉ đổi `trang_thai`. Đổi giờ/địa điểm/điểm học/phòng → cập nhật `cap_nhat_luc` + ghi `nhat_ky_hoat_dong` `sua_lich_hoc` `{truoc, sau, ly_do}`. Response thêm `canh_bao`. | QuảnTrị |
| POST | `/lop/{id}/nhan-su` | Thêm giảng viên/hỗ trợ `{ ho_ten, vai_tro, so_dien_thoai? }` | QuảnTrị |
| DELETE | `/lop/{id}/nhan-su/{nhan_su_id}` | Gỡ 1 nhân sự khỏi lớp | QuảnTrị |
| PUT | `/dang-ky-hoc/{id}/giai-doan/{giai_doan_id}/lop` | Phân lớp theo giai đoạn (spec 2026-10-02): `{ lop_id }` (`lop_id=null` để gỡ) — gán/thay/gỡ lớp của 1 giai đoạn cho 1 đăng ký học (upsert bảng `phan_lop_giai_doan`) | QuảnTrị |
| PATCH | `/dang-ky-hoc/{id}/muc-hoc` | **Thêm 2026-10-08**: `{ muc }` (`co_ban`\|`thanh_thao`\|`nang_cao`\|`null`) — Quản trị sửa hộ mức lớp học, **bỏ qua** công tắc `mo_dieu_chinh_muc` nhưng vẫn chỉ cho mức ≤ `muc_dau_vao`. Cùng quy tắc + response như `PUT /hoc-vien/toi/khoa-hoc/{khoaId}/muc-hoc` | QuảnTrị |
| PUT | `/hoc-vien/toi/khoa-hoc/{khoaId}/muc-hoc` | **Thêm 2026-10-08**: học viên tự điều chỉnh mức lớp học. Body `{ muc }` (`co_ban`\|`thanh_thao`\|`nang_cao`\|`null` = quay về theo mức đánh giá). Chọn bằng `muc_dau_vao` → lưu `null`. Có hiệu lực ngay, ghi nhật ký `dieu_chinh_muc_hoc` khi giá trị đổi (`chi_tiet` có thêm `{ khoa_id, muc_cu, muc_moi }`, mức hiệu lực trước/sau). Response `{ muc_dau_vao, muc_hoc_chon, muc_hoc, muc_hoc_chon_luc }` — **thêm 2026-10-08 (migration `20261008150000_muc_hoc_chon_luc`)**: `muc_hoc_chon_luc` = thời điểm điều chỉnh gần nhất (UTC ISO; chỉ đổi khi giá trị thật sự đổi, lưu lại cùng mức thì giữ nguyên; `null` = chưa điều chỉnh). `PATCH /dang-ky-hoc/{id}/muc-hoc` (Quản trị) cùng quy tắc và cùng response. Lỗi: không có đăng ký học ở khóa → `404`; khóa `mo_dieu_chinh_muc=false` → `403` code `DIEU_CHINH_MUC_DONG`; chưa có `muc_dau_vao` → `400` field `muc` "Chưa có kết quả đánh giá đầu vào"; `muc` cao hơn `muc_dau_vao` → `400` field `muc` "Chỉ được chọn mức bằng hoặc thấp hơn mức đánh giá" | Học viên |
| PATCH | `/dang-ky-hoc/{id}/cum` | **Thêm 2026-09-30 (QĐ10)**: `{ cum_id }` (`cum_id=null` để gỡ gán) — gán/đổi cụm học viên cho 1 đăng ký học. `cum_id` phải thuộc cùng `khoa_id` với đăng ký học | QuảnTrị |
| GET | `/hoc-vien/toi/khoa-hoc` | Học viên xem khóa/lớp mình đã đăng ký/được phân — **thêm 2026-09-29 (T5)**: mỗi dòng có thêm `muc_dau_vao`, `muc_dau_ra` (`co_ban`\|`thanh_thao`\|`nang_cao`, `null` nếu chưa có kết quả đánh giá). **Thêm 2026-09-29 (T6)**: danh sách buổi (`lich_hoc`) sắp xếp theo giai đoạn (`thu_tu`), buổi (`buoi_so`), thời gian bắt đầu, địa điểm/link. **Sửa 2026-09-30 (QĐ10) — THAY ĐỔI CẤU TRÚC RESPONSE**: trường `lop` (1 lớp duy nhất) đã bị thay bằng 3 trường độc lập `lop_truc_tiep`, `lop_zoom`, `lop_vle` (mỗi trường `{ id, ten_lop, si_so_toi_da, nhan_su, lich_hoc } \| null`) + `cum` (`{ id, ten_cum, link_zalo, ghi_chu } \| null`). **Thêm 2026-09-30 (T12)**: mỗi buổi trong `lich_hoc` (cả 3 khối `lop_truc_tiep`/`lop_zoom`/`lop_vle`) có thêm `trang_thai_diem_danh` (`co_mat`\|`vang`\|`vang_co_phep`\|`null` nếu chưa điểm danh, nhập qua import `diem_danh`). Mỗi dòng đăng ký học có thêm `tien_do_giai_doan: [{ giai_doan_id, ten_giai_doan, ty_le_hoan_thanh, diem }]` (nhập qua import `ket_qua_giai_doan`, mảng rỗng nếu chưa có dữ liệu) **Thêm 2026-10-07 (T10)**: mỗi buổi kèm `phong` và `diem_hoc: { id, ma_diem_hoc, ten, dia_chi, nguoi_lien_he, sdt_lien_he } | null`. **Thêm 2026-10-08**: mỗi dòng có `muc_hoc_chon` (mức lớp học tự chọn, `null` = theo mức đánh giá), `muc_hoc_chon_luc` (thời điểm điều chỉnh gần nhất, UTC ISO \| `null`) và `khoa.mo_dieu_chinh_muc`. | Học viên |
| GET | `/hoc-vien/{id}/khoa-hoc` | **Thêm 2026-09-30 (QĐ10)**: cùng cấu trúc response như `GET /hoc-vien/toi/khoa-hoc` ở trên nhưng cho `hocVienId` truyền qua param thay vì lấy từ token đăng nhập — dùng để admin/Trường/Sở/Phòng xem lại và chuẩn bị đổi lớp/cụm cho 1 học viên cụ thể qua `PATCH`/`DELETE /dang-ky-hoc/{id}/lop`, `PATCH /dang-ky-hoc/{id}/cum`. Phạm vi tái dùng đúng cơ chế `GET /hoc-vien/{id}` (theo `don_vi_cong_tac_id` của hồ sơ) — ngoài phạm vi trả `403`, không tồn tại trả `404` | Trường, Phòng VHXH, Sở, QuảnTrị |
| GET | `/hoc-vien/toi/ket-qua` | Học viên xem `ket_qua`, `ngay_hoan_thanh` từng `DangKyHoc`. **Sửa 2026-09-30 (QĐ10)**: cùng đổi cấu trúc `lop` → `lop_truc_tiep`/`lop_zoom`/`lop_vle` như `GET /hoc-vien/toi/khoa-hoc` ở trên (hệ quả bắt buộc từ việc xóa `dang_ky_hoc.lop_id`) | Học viên |
| PATCH | `/dang-ky-hoc/{id}/ket-qua` | **Sửa 2026-10-03 (ADR 0001)**: chỉ Quản trị (D6 — bỏ escalation Trường/Phòng VHXH/Sở trước đó). `{ ket_qua, ngay_hoan_thanh? }`. **Side effect**: kích hoạt sự kiện thông báo `dang_ky_hoc_ket_qua` (mục 8) | QuảnTrị |

### Phạm vi xem khóa bồi dưỡng (R1/R2, ADR 0001 — thay T2/QĐ2)

Mọi endpoint ghi của module này (tạo/sửa khóa, giai đoạn, lớp, cụm, lịch học, nhân sự, phân lớp theo giai đoạn, cụm học viên, kết quả) chỉ Quản trị (D6). Sở/Phòng VHXH/Trường chỉ xem, theo 2 quy tắc áp dụng cho `GET /khoa-boi-duong`, `GET /khoa-boi-duong/{id}` và các báo cáo theo khóa ở mục 7 — thay hẳn cơ chế "đơn vị theo dõi" (`khoa_don_vi_theo_doi`) đã xóa:

- **R1 — đặt hàng:** `khoa.don_vi_dat_hang_id` nằm trong phạm vi (`ScopeService.getAccessibleDonViIds`) của caller → thấy khóa, xem **toàn bộ** học viên của khóa (`pham_vi_hoc_vien: 'toan_bo'`).
- **R2 — tham gia:** không thỏa R1, nhưng có học viên thuộc phạm vi caller đã ghi danh (`dang_ky_hoc`) vào khóa → thấy khóa, chỉ xem học viên thuộc phạm vi mình (`pham_vi_hoc_vien: 'don_vi'`).
- Thỏa cả R1 và R2 → theo R1.

Cài đặt: `ScopeService.getKhoaIdsXemDuoc(caller)` (tập `id` khóa xem được — `'ALL'` nếu Quản trị) và `ScopeService.getHocVienScopeTrongKhoa(caller, khoa)` (phạm vi đếm/lọc học viên trong 1 khóa cụ thể).

**Lưu ý (QĐ10, 2026-09-30):** 3 loại lớp (`truc_tiep`/`zoom`/`vle`) hoàn toàn độc lập nhau — 1 học viên có thể đồng thời thuộc 1 lớp trực tiếp (~50 người), 1 lớp zoom (~500 người), 1 "lớp" vle (quy mô khác, có thể thay đổi), gán qua bảng nối `dang_ky_hoc_lop` (không phải 3-4 cột FK riêng trên `dang_ky_hoc`, để dễ mở rộng loại lớp thứ 4/5 sau này). **Cụm học viên** (`cum_hoc_vien`) là khái niệm khác hẳn — nhóm Zalo hỗ trợ theo địa lý, độc lập với cây đơn vị công tác, chứa **học viên trực tiếp** qua `dang_ky_hoc.cum_id`, không qua lớp nào.

---

## 4. Dịch vụ Danh mục dùng chung

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| GET | `/danh-muc/dia-danh` | `?cap=&parent_id=&q=&trang_thai=&phien_ban=`. **Thêm 2026-10-01**: `q` tìm không phân biệt dấu/hoa-thường (unaccent) | Mọi vai trò đã đăng nhập |
| POST / PATCH | `/danh-muc/dia-danh(/{id})` | Sửa/thêm thủ công (ngoài import) | QuảnTrị |
| GET | `/danh-muc/don-vi-cong-tac` | `?loai_don_vi=&dia_ban_id=&q=` (autocomplete dùng `q`). **Thêm 2026-10-01**: query `tinh_id` (lọc theo tỉnh — join qua `dia_ban.parent_id`, AND với `dia_ban_id` nếu truyền cả hai); mỗi item trả về kèm 3 field mới `dia_ban_ten`, `tinh_id`, `tinh_ten` (null nếu phường/xã không có parent) bên cạnh các field gốc. `q` tìm không phân biệt dấu/hoa-thường (unaccent) | Mọi vai trò đã đăng nhập |
| POST / PATCH | `/danh-muc/don-vi-cong-tac(/{id})` | Sửa/thêm thủ công | QuảnTrị |
| GET | `/danh-muc/mon-hoc?cap_hoc=` | Lọc theo cấp học — dùng cho dropdown phụ thuộc "Môn giảng dạy" | Mọi vai trò đã đăng nhập |
| POST / PATCH | `/danh-muc/mon-hoc(/{id})` | Sửa/thêm thủ công | QuảnTrị |
| GET | `/danh-muc/chuyen-mon-dao-tao/goi-y?q=` | **Sửa 2026-09-28** (bản trước còn tham chiếu cột `hoc_vien.chuyen_mon_dao_tao` cũ, đã tách thành bảng `hoc_vien_chuyen_mon` 1-nhiều từ đợt MOET): `SELECT DISTINCT chuyen_mon FROM hoc_vien_chuyen_mon WHERE chuyen_mon ILIKE '%q%' LIMIT 10` — **không phải danh mục quản lý**, chỉ gợi ý từ dữ liệu đã có | Học viên (khi điền form) |

### Giảng viên & phân công (T11, issue #3, 2026-10-07)

Dữ liệu cá nhân giảng viên → mọi endpoint dưới đây chỉ **Quản trị** (người hỗ trợ giảng viên thêm sau — ADR 0004 G12). QĐ5 "không làm cổng giảng viên" đã được ADR 0004 G8 đảo một phần (làm ở lát L7, không thuộc mục này).

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| GET | `/giang-vien` | `?q=&trang_thai=&khoa_id=&page=&page_size=` — `q` tìm họ tên/SĐT/email/đơn vị; `khoa_id` = chỉ GV có phân công trong khóa; mỗi dòng kèm `so_buoi` | QuảnTrị |
| POST | `/giang-vien` | `{ ho_ten, so_dien_thoai, email?, don_vi_cong_tac?, ghi_chu? }` — SĐT chuẩn hóa (bỏ khoảng trắng, 9 số tự thêm `0`), email chữ thường; trùng SĐT/email → `409` (kèm `fields`); ghi `tao_boi` | QuảnTrị |
| PATCH | `/giang-vien/{id}` | Sửa một phần (`email: null` = xóa), `trang_thai='ngung'` để ngưng — không có DELETE | QuảnTrị |
| GET | `/giang-vien/{id}/lich-day` | `?tu_ngay=&den_ngay=` → `{ giang_vien, phan_cong: [{ id, vai_tro, so_gio, da_xac_nhan_gio, lich_hoc: { buoi_so, thoi_gian_*, giai_doan, lop: { ten_lop, khoa }, diem_hoc } }] }` sắp theo giờ | QuảnTrị |
| PATCH | `/giang-vien/phan-cong/{id}/xac-nhan-gio` | `{ da_xac_nhan_gio, so_gio? }` — chốt (ghi `xac_nhan_luc`, `nguoi_xac_nhan_id`) hoặc bỏ chốt; chốt khi chưa có số giờ → `400`. (Issue ghi `/phan-cong/{id}/...` — đặt dưới `/giang-vien` để không mở thêm tiền tố Nginx.) | QuảnTrị |
| PUT | `/lop/{id}/lich-hoc/{lich_hoc_id}/giang-vien` | `{ phan_cong: [{ giang_vien_id, vai_tro, so_gio? }] }` (≤ 20) **thay toàn bộ** phân công của buổi → danh sách sau khi lưu. Trùng giảng viên / giảng viên ngưng / **trùng giờ buổi khác** → `400`; gỡ hoặc đổi số giờ phân công **đã xác nhận giờ** → `409`; buổi không thuộc lớp → `404`. Dùng chung luật với import (`PhanCongGiangDayService`) | QuảnTrị |

Đổi giờ buổi (`PATCH /lop/{id}/lich-hoc/{lich_hoc_id}` và import `lop_va_lich_hoc`) làm giảng viên đã phân công của buổi trùng giờ buổi khác của họ → `400` / dòng lỗi.

`GET /khoa-boi-duong/{id}`: mỗi buổi kèm `phan_cong: [{ id, vai_tro, so_gio, da_xac_nhan_gio, giang_vien: { id, ho_ten } }]` (không SĐT/email). `GET /hoc-vien/toi/khoa-hoc`: mỗi buổi kèm `giang_vien: [{ ho_ten, vai_tro }]` — **không** SĐT/email.

**Import** (mục 5): `giang_vien` — cột `ho_ten, so_dien_thoai, email, don_vi_cong_tac, ghi_chu`; khớp giảng viên đã có theo **email trước, rồi SĐT** (upsert); email thuộc GV A mà SĐT thuộc GV B → dòng lỗi; trùng email/SĐT trong file → dòng lỗi. `phan_cong_giang_day` — cột `ma_khoa, ten_lop, loai_lop, giai_doan_thu_tu, buoi_so, email, so_dien_thoai, vai_tro, so_gio` (thêm `loai_lop` so với spec gốc vì lớp duy nhất theo `(khoa, loai_lop, ten_lop)`); buổi và giảng viên phải đã có; trùng giờ với buổi khác trong DB hoặc trong cùng file → dòng lỗi; upsert theo `(lich_hoc_id, giang_vien_id)`.

### Điểm học trực tiếp (T10, issue #2, 2026-10-07)

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| GET | `/diem-hoc` | `?q=&dia_ban_id=&trang_thai=&page=&page_size=` — `q` tìm theo tên/mã/địa chỉ; mỗi dòng kèm `dia_ban {id, ten}`, `don_vi {id, ten_don_vi}`. Phạm vi: Quản trị thấy hết; Sở/Phòng VHXH/Trường thấy điểm học có `don_vi_id` trong phạm vi **hoặc** đang dùng cho buổi học của khóa mình xem được (R1/R2) | QuảnTrị, Sở, Phòng VHXH, Trường |
| GET | `/diem-hoc/{id}` | Chi tiết; ngoài phạm vi → `404` | như trên |
| POST | `/diem-hoc` | `{ ma_diem_hoc, ten, dia_chi, dia_ban_id, don_vi_id?, suc_chua?, so_phong?, nguoi_lien_he?, sdt_lien_he?, ghi_chu_csvc? }`; trùng mã → `409`; ghi `tao_boi` | QuảnTrị |
| PATCH | `/diem-hoc/{id}` | Sửa một phần (null ở trường tùy chọn = xóa); `trang_thai='ngung'` để ngưng — **không có DELETE** (rule #40) | QuảnTrị |

Nginx: tiền tố `/diem-hoc` đã thêm vào `scripts/vps/05-install-nginx.sh`.

**Thêm 2026-09-30 — `dia_danh.phien_ban`**: cột mới phân loại từng dòng `dia_danh` sau đợt sáp nhập hành chính 2025 (34 tỉnh/thành):
- `hien_tai` (mặc định): xã/phường theo địa giới HIỆN TẠI.
- `lich_su`: mã xã/phường CŨ trước sáp nhập — vẫn giữ lại (không xoá) vì `don_vi_cong_tac.dia_ban_id` có thể trỏ tới để lưu đúng lịch sử công tác của giáo viên tại thời điểm chưa sáp nhập.
- `dac_biet`: các dòng placeholder không phải địa giới hành chính thật (ví dụ nhóm "Khu vực đặc biệt..." của An Giang dùng khi không có xã cụ thể, hoặc sentinel "Xã chưa xác định (...)").

Tham số `?phien_ban=` ở `GET /danh-muc/dia-danh` là **tuỳ chọn**: không truyền thì KHÔNG lọc (trả về tất cả như trước — dùng cho Admin quản lý danh mục địa danh, cần thấy cả `lich_su`/`dac_biet` để sửa); truyền `phien_ban=hien_tai` để chỉ lấy xã/phường hiện hành (dùng cho màn hình "Cư trú" ở hồ sơ học viên).

---

## 5. Dịch vụ Import

Dùng chung 1 luồng cho cả 10 loại (`loai_danh_muc_import`): `dia_danh`, `don_vi_cong_tac`, `mon_hoc`, `phan_lop_hoc_vien`, `ho_so_nhan_su_moet` (`POST /import/ho-so-nhan-su-moet` — chi tiết ở mục "Luồng import nhân sự từ CSDL MOET", mục 2), `tai_khoan_vle` (T15, 2026-09-28 — chi tiết ở mục "Cổng điều kiện làm đánh giá đầu vào & tài khoản VLE", mục 2), `ket_qua_danh_gia` (T5, 2026-09-29), `lop_va_lich_hoc` (T6, 2026-09-29 — chi tiết ngay dưới), `diem_danh`, `ket_qua_giai_doan` (T12, 2026-09-30 — chi tiết ngay dưới), `tai_khoan_don_vi` (ADR 0002, 2026-10-03 — chi tiết ngay dưới), `ket_qua_khao_sat` (2026-10-04 — chi tiết ngay dưới).

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| GET | `/import/mau-excel?loai=` | Tải file mẫu đúng cột cho loại đã chọn | QuảnTrị |
| POST | `/import/{loai}` | `multipart/form-data`, field `file`. Trả ngay `{ import_id, trang_thai: "dang_xu_ly" }` — xử lý bất đồng bộ (job queue) | QuảnTrị |
| GET | `/import/{id}` | Kết quả: `{ tong_so_dong, so_dong_thanh_cong, so_dong_loi, trang_thai, danh_sach_loi: [{dong, ly_do}], danh_sach_canh_bao: [{dong, ly_do}], so_hoc_vien_chua_co_email }` — `danh_sach_canh_bao` thêm T4 (2026-09-28): cảnh báo 🟡 không chặn dòng (`ho_so_nhan_su_moet`, xem "Luồng import nhân sự từ CSDL MOET"; `ket_qua_danh_gia` T5 "lách cổng"; `phan_lop_hoc_vien` T6 lệch mức năng lực — xem mục "`lop_va_lich_hoc`" bên dưới). `so_hoc_vien_chua_co_email` thêm T3 (2026-09-29, QĐ6): số học viên được phân lớp (`phan_lop_hoc_vien`, nhánh gán `lop_id`) không có `email_lien_he` nên bị bỏ qua gửi `dang_ky_hoc_phan_lop` — tính lúc `POST /import/{id}/xac-nhan`, luôn `0` cho các loại import khác/trước khi xác nhận | QuảnTrị |
| GET | `/import/{id}/file-loi` | Tải file Excel chỉ chứa các dòng lỗi kèm cột "Lý do" | QuảnTrị |
| POST | `/import/{id}/xac-nhan` | Nạp chính thức các dòng hợp lệ (bước riêng sau khi xem preview, đề phòng import nhầm file) | QuảnTrị |
| GET | `/import` | Nhật ký import `?loai=&tu_ngay=&den_ngay=` | QuảnTrị |

Riêng `phan_lop_hoc_vien`: cột file = `so_dinh_danh_ca_nhan`, `ma_dinh_danh_moet` (**T3, 2026-09-29 — cả 2 tùy chọn, xem dưới**), `ma_khoa`, `ten_lop` (**tùy chọn** — lớp TRỰC TIẾP), `ten_lop_zoom` (**tùy chọn, thêm QĐ10 2026-09-30** — lớp Zoom), `ten_lop_vle` (**tùy chọn, thêm QĐ10** — "lớp" VLE), `ten_cum` (**tùy chọn, thêm QĐ10** — cụm học viên). Đây là **cơ chế duy nhất** để ghi danh học viên vào khóa — **đã sửa 2026-09-25**: `dang_ky_hoc.khoa_id` KHÔNG tự gán khi hồ sơ học viên `da_duyet` (bản trước ghi vậy nhưng vô nghĩa — không có cơ sở để biết tự động ghi danh vào khóa nào), toàn bộ việc gán khóa cho học viên do Quản trị hệ thống chủ động thực hiện qua import này, học viên không tự chọn/đăng ký khóa. Xác định học viên bằng **HocVienResolver dùng chung** (mục 2 quy tắc chung của `mo-rong-nls-an-giang.md`, cùng cơ chế với `tai_khoan_vle` ở dưới): phải có ít nhất 1 trong 2 cột `so_dinh_danh_ca_nhan`/`ma_dinh_danh_moet`; có cả 2 thì phải trỏ cùng 1 hồ sơ, không thì là dòng lỗi — **T3 (QĐ1)**: trước đây chỉ nhận `so_dinh_danh_ca_nhan` (CCCD), khiến học viên `import_moet` chưa có CCCD (đa số, xem T4) không ghi danh được; nay dùng `ma_dinh_danh_moet` là đủ, và **hồ sơ chưa đầy đủ không còn là điều kiện ghi danh** (điều kiện "đầy đủ" chuyển hẳn sang cổng đánh giá đầu vào T15 + cấp chứng nhận T13, xem `validation-checklist.md` #36d). Với mỗi dòng: học viên xác định được phải có hồ sơ `da_duyet`; tạo (hoặc lấy nếu đã có) `dang_ky_hoc` cho `(hoc_vien_id, khoa_id)`. **QĐ10 (2026-09-30)**: mỗi cột lớp trong 3 cột `ten_lop`/`ten_lop_zoom`/`ten_lop_vle` **độc lập hoàn toàn** với nhau — có giá trị thì khớp `lop_hoc` đúng `(khoa_id, loai_lop, ten_lop)` tương ứng và upsert dòng `dang_ky_hoc_lop` cho đúng `loai_lop` đó; `ten_cum` có giá trị thì khớp `cum_hoc_vien` theo `(khoa_id, ten_cum)` và gán `dang_ky_hoc.cum_id`. `trang_thai` chuyển `da_phan_lop` nếu **ít nhất 1** trong 3 cột lớp có giá trị hợp lệ; nếu cả 3 cột lớp đều trống (kể cả khi có `ten_cum`) thì chỉ ghi danh (`trang_thai='da_duyet'`) — cho phép chạy import nhiều lần tách biệt (ghi danh trước, phân lớp/gán cụm sau, từng loại một). Dòng lỗi điển hình: không xác định được học viên (thiếu cả 2 mã, hoặc 2 mã trỏ 2 hồ sơ khác nhau), học viên chưa được duyệt, mã khóa không tồn tại, tên lớp/cụm không tồn tại trong đúng khóa và đúng loại lớp đó. **Chỉ nhánh gán lớp TRỰC TIẾP** (`ten_lop`) kích hoạt sự kiện `dang_ky_hoc_phan_lop` (mục 8) — chưa mở rộng sang zoom/vle ở lượt QĐ10 này; học viên không có `email_lien_he` bị bỏ qua (không ghi `nhat_ky_thong_bao`), đếm vào `so_hoc_vien_chua_co_email` của `GET /import/{id}` (mục trên, QĐ6).

**T15 (2026-09-28) — `tai_khoan_vle`** (`POST /import/tai_khoan_vle`, file Phòng CNTT trả về sau khi tạo tài khoản VLE cho toàn bộ học viên): cột file = `so_dinh_danh_ca_nhan`, `ma_dinh_danh_moet`, `ten_dang_nhap_vle`, `mat_khau_tam`, `duong_dan`. Xác định học viên bằng **HocVienResolver dùng chung** (mục 2 quy tắc chung của `mo-rong-nls-an-giang.md`): phải có ít nhất 1 trong 2 cột `so_dinh_danh_ca_nhan`/`ma_dinh_danh_moet`; có cả 2 thì phải trỏ cùng 1 hồ sơ, không thì là dòng lỗi. `mat_khau_tam` **tùy chọn** — nếu có, mã hóa AES-256-GCM (`vle-crypto.util.ts`, khóa `VLE_SECRET_KEY`) trước khi lưu `tai_khoan_vle.mat_khau_tam_ma_hoa`; **không bao giờ** trả lại mật khẩu dạng rõ qua API quản trị hay file lỗi import (file lỗi tự động ẩn cột này). Upsert theo `hoc_vien_id` (PK) — chạy lại file ghi đè `ten_dang_nhap_vle`/`duong_dan`; nếu dòng KHÔNG có `mat_khau_tam` thì giữ nguyên mật khẩu mã hóa cũ (không tự xóa về NULL).

**T5 (2026-09-29) — `ket_qua_danh_gia`** (`POST /import/ket_qua_danh_gia`): cột file = `so_dinh_danh_ca_nhan`, `ma_dinh_danh_moet` (**HocVienResolver dùng chung**, phải có ít nhất 1 trong 2, có cả 2 thì phải trỏ cùng 1 hồ sơ), `ma_khoa`, `loai` (`dau_vao`\|`dau_ra`), `muc` (`co_ban`\|`thanh_thao`\|`nang_cao`). Học viên xác định được phải **đã ghi danh vào khóa đó** (`dang_ky_hoc` cho `(hoc_vien_id, khoa_id)` đã tồn tại, tạo qua import `phan_lop_hoc_vien`, mục "T3" ở trên) — nếu chưa, dòng lỗi rõ ràng yêu cầu chạy ghi danh trước, import này **không** tự tạo `dang_ky_hoc`. Ghi đè theo cột: `loai=dau_vao` → cập nhật `dang_ky_hoc.muc_dau_vao`; `loai=dau_ra` → cập nhật `dang_ky_hoc.muc_dau_ra`; cột còn lại giữ nguyên. Chạy lại file với `muc` khác cho cùng học viên/khóa/loai → ghi đè giá trị mới (upsert theo cột, không phải theo dòng). **2026-10-08**: `loai=dau_vao` hạ mức xuống ≤ `muc_hoc_chon` hiện có → reset `muc_hoc_chon = null` (và `muc_hoc_chon_luc = null`) cùng lần cập nhật. **Trình tự vận hành**: import MOET (`ho_so_nhan_su_moet`) → ghi danh (`phan_lop_hoc_vien` chỉ với mã định danh + `ma_khoa`, để trống mọi cột lớp `GĐ<n> - …` — tạo `dang_ky_hoc` không phân lớp) → import `ket_qua_danh_gia` → tạo lớp (T6) → phân lớp (import lại `phan_lop_hoc_vien` cùng khóa, điền cột `GĐ<n>`; ô trống giữ, `-` gỡ). **2026-10-02: nên ghi danh NGAY sau import MOET** (trước khảo sát/khai báo) để học viên thuộc khóa từ đầu → nhận đúng cấu hình khảo sát riêng của khóa (mục 9). **Cảnh báo 🟡 "lách cổng"**: nếu học viên có kết quả nhưng KHÔNG đủ điều kiện làm đánh giá đầu vào tại thời điểm import (cùng 2 điều kiện của `GET /hoc-vien/toi/danh-gia-dau-vao` — xác nhận đợt `xac_nhan_truoc_danh_gia` còn hiệu lực VÀ hồ sơ đầy đủ), dòng vẫn nhập bình thường (không chặn — cách B là chặn "mềm", tài khoản VLE tồn tại cho mọi học viên) nhưng thêm vào `danh_sach_canh_bao` của `GET /import/{id}` để N1 phát hiện trường hợp bất thường.

**T6 (2026-09-29) — `lop_va_lich_hoc`** (`POST /import/lop_va_lich_hoc`, QĐ3/QĐ4): mỗi dòng = **1 buổi học** của 1 lớp. Cột file = `ma_khoa`, `ten_lop`, `loai_lop` (**tùy chọn, thêm QĐ10 2026-09-30** — `truc_tiep`\|`zoom`\|`vle`, mặc định `truc_tiep` nếu để trống), `nhom_hoc_vien` (tùy chọn, số nguyên 1-20), `muc_nang_luc` (tùy chọn, `co_ban`\|`thanh_thao`\|`nang_cao`), `si_so_toi_da` (tùy chọn), `giai_doan_thu_tu` (khớp `giai_doan_khoa.thu_tu` trong đúng khóa), `buoi_so`, `bat_dau`, `ket_thuc` (giờ Việt Nam `dd/mm/yyyy hh:mm`, lưu UTC), `dia_diem_hoac_link` (tùy chọn), `ma_diem_hoc` (**T10, 2026-10-07**: mã điểm học `active`; **bắt buộc** với buổi thuộc giai đoạn `truc_tiep`, trừ khi buổi đã có điểm học — ô trống = giữ), `phong` (**thêm 2026-10-07, cột CUỐI, tùy chọn** — file mẫu cũ không có cột này vẫn import được; ô trống = giữ). Chạy lại file: buổi chỉ đổi `cap_nhat_luc` + ghi nhật ký `sua_lich_hoc` khi giờ/địa điểm/điểm học/phòng thật sự đổi; cảnh báo 🟡 vượt số phòng nối vào `danh_sach_canh_bao`. Upsert `lop_hoc` theo `(khoa_id, loai_lop, ten_lop)` (`uq_lop_ten_trong_khoa`, **đổi QĐ10** — trước đó chỉ `(khoa_id, ten_lop)`); upsert `lich_hoc_lop` theo `(lop_id, giai_doan_id, buoi_so)` (`uq_lich_hoc_lop_giai_doan_buoi`, T6) — chạy lại file sửa giờ 1 buổi chỉ cập nhật đúng buổi đó, các buổi khác không đổi. Dòng lỗi điển hình: `ma_khoa`/`giai_doan_thu_tu` không tồn tại, `loai_lop` sai giá trị, `bat_dau`/`ket_thuc` sai định dạng hoặc `ket_thuc <= bat_dau` (rule #49), và **2 dòng cùng `(loai_lop, lớp, giai đoạn, buổi)` trong CÙNG FILE** (phát hiện ở bước preview, trước khi lớp/lịch thực sự tồn tại trong DB). **Cảnh báo 🟡 khi phân lớp** (import `phan_lop_hoc_vien`, T3, áp dụng cho cả 3 loại lớp từ QĐ10): nếu `lop_hoc.muc_nang_luc` (đặt qua import này) khác **mức học hiệu lực** của học viên được gán vào lớp đó (**sửa 2026-10-08**: `muc_hoc_chon ?? muc_dau_vao`; đã tự điều chỉnh thì câu cảnh báo ghi thêm "(học viên tự điều chỉnh từ …)"), thêm cảnh báo vào `danh_sach_canh_bao` — **không chặn** dòng phân lớp.

**T12 (2026-09-30) — `diem_danh`** (`POST /import/diem_danh`): điểm danh nhập qua **IMPORT EXCEL**, **không có** giao diện chấm tay từng buổi. Mỗi dòng = điểm danh của 1 học viên tại 1 buổi học cụ thể. Cột file = `so_dinh_danh_ca_nhan`, `ma_dinh_danh_moet` (**HocVienResolver dùng chung**), `ma_khoa`, `ten_lop`, `loai_lop` (**BẮT BUỘC**, khác `lop_va_lich_hoc` — `truc_tiep`\|`zoom`\|`vle`, không có mặc định vì điểm danh phải khớp đúng 1 buổi cụ thể trong số có thể nhiều lớp trùng tên khác loại, QĐ10), `giai_doan_thu_tu`, `buoi_so`, `trang_thai` (`co_mat`\|`vang`\|`vang_co_phep`), `nguon` (`zoom`\|`ky_ten`\|`qr`\|`thu_cong`), `ghi_chu` (tùy chọn — xem cảnh báo học bù dưới). Học viên xác định được phải đã ghi danh vào khóa đó; xác định buổi qua `(khoa_id, loai_lop, ten_lop)` → lớp, rồi `(lop_id, giai_doan_id, buoi_so)` → buổi — không tìm thấy thì dòng lỗi. Upsert theo `(dang_ky_hoc_id, lich_hoc_id)` (`uq_diem_danh`) — chạy lại file ghi đè. **Cảnh báo 🟡 "học bù"**: nếu buổi điểm danh thuộc lớp **KHÁC** lớp học viên đang được gán cho đúng `loai_lop` đó (kể cả khi chưa được gán lớp nào), dòng vẫn được lưu (không chặn) và thêm vào `danh_sach_canh_bao`, nhưng **bắt buộc** phải có `ghi_chu` trong trường hợp này — thiếu `ghi_chu` thì là **dòng lỗi 🔴** (chặn), không phải cảnh báo.

**2026-10-04 — `ket_qua_khao_sat`** (`POST /import/ket_qua_khao_sat`): dự phòng cho `POST /sso/ket-qua` (mục 10.1) khi hệ thống khảo sát chỉ xuất được file. Cột = `so_dinh_danh_ca_nhan`, `ma_dinh_danh_moet` (**HocVienResolver dùng chung**), `loai` (`khao-sat`\|`danh-gia`\|`dau-ra`), `trang_thai` (`dang_lam`\|`hoan_thanh`), `thoi_diem` (tùy chọn, `dd/mm/yyyy hh:mm` giờ VN), `muc` (tùy chọn), `diem` (tùy chọn, chấp nhận dấu phẩy thập phân), `diem_toi_da`, `muc_goc` (mã `M1`–`M4`), `url_ket_qua` (tùy chọn, thêm 2026-10-05 — cùng quy tắc API). Không cần ghi danh khóa. Cùng quy tắc gộp với API; ghi `nguon = 'import'`. 2 dòng cùng học viên + loại trong 1 file → dòng sau lỗi. **Không** đổi `muc_dau_vao`.

**T12 (2026-09-30) — `ket_qua_giai_doan`** (`POST /import/ket_qua_giai_doan`): kết quả/tiến độ theo từng giai đoạn của khóa (vd tiến độ VLE, điểm đánh giá giai đoạn). Cột file = `so_dinh_danh_ca_nhan`, `ma_dinh_danh_moet` (**HocVienResolver dùng chung**), `ma_khoa`, `giai_doan_thu_tu`, `ty_le_hoan_thanh` (tùy chọn, 0–100), `diem` (tùy chọn). Học viên xác định được phải đã ghi danh vào khóa đó (cùng quy tắc `ket_qua_danh_gia`, T5) — nếu chưa, dòng lỗi yêu cầu chạy ghi danh trước. Upsert theo `(dang_ky_hoc_id, giai_doan_id)` (`uq_ket_qua_giai_doan`) — chạy lại file ghi đè.

---

**ADR 0002 (2026-10-03) — `tai_khoan_don_vi`**: cột file = `ma_don_vi` (bắt buộc, trim, không phân biệt hoa/thường), `ten_dang_nhap`, `ho_ten`, `email` (tùy chọn). Mỗi dòng chạy cùng bộ quy tắc với `POST /nguoi-dung/don-vi` (mục 1 "Tài khoản đơn vị") + lỗi trùng mã đơn vị/tên đăng nhập/email **trong cùng file**. `POST /import/{id}/xac-nhan` với loại này tạo tài khoản từng dòng (dòng có email → link kích hoạt vào hàng đợi; dòng không email → mật khẩu tạm) và **trả file `.xlsx`** thay vì JSON: `Content-Disposition: attachment; filename="mat-khau-tam-<id>.xlsx"`, `Cache-Control: no-store`, header `X-So-Dong-Thanh-Cong`; sheet "Mật khẩu tạm", cột "Mã đơn vị", "Tên đơn vị", "Tên đăng nhập", "Mật khẩu tạm" (trống với dòng email), "Cách cấp" ("Mật khẩu tạm" | "Email kích hoạt"). File **không** được lưu ở `storage/import` — mất là cấp lại từng tài khoản bằng `cap-mat-khau-tam`. Các loại import khác vẫn trả JSON `nhat_ky_import` như cũ.

## 6. Dịch vụ Kiểm tra dữ liệu

Không phải REST service độc lập cho FE gọi trực tiếp — là **thư viện quy tắc dùng chung**, được gọi nội bộ bởi:
- `POST /hoc-vien` và `POST /hoc-vien/toi/kiem-tra-truoc-xac-nhan` (validate 1 hồ sơ)
- Dịch vụ Import, mỗi dòng file (validate hàng loạt, cùng bộ quy tắc)

Chi tiết quy tắc: [`validation-checklist.md`](validation-checklist.md). Endpoint duy nhất expose ra ngoài:

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/validate/hoc-vien` | Dry-run, không lưu. Trả `{ loi: [...], canh_bao: [...] }` — `loi` chặn submit, `canh_bao` không chặn (vd cảnh báo viết hoa tên) |

---

## 7. Dịch vụ Báo cáo

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| GET | `/bao-cao/tong-hop?theo=don_vi\|dia_ban\|khoa&tu_ngay=&den_ngay=` | Số liệu tổng hợp trong phạm vi quyền. **Sửa 2026-10-03 (ADR 0001)**: `theo=khoa` áp R1/R2 (xem ghi chú dưới) — khóa hiện ra theo `getKhoaIdsXemDuoc`, `tong_dang_ky`/`theo_trang_thai_dang_ky`/`theo_ket_qua` của mỗi khóa đếm theo `getHocVienScopeTrongKhoa` của chính khóa đó (R1 → toàn bộ, R2 → chỉ đăng ký của học viên trong phạm vi); trả thêm `don_vi_dat_hang` (tên đơn vị) | Trường, Phòng VHXH, Sở, QuảnTrị |
| GET | `/bao-cao/xuat-excel?...` (cùng query) | Xuất Excel/CSV UTF-8 (BOM), cùng bộ lọc | Trường, Phòng VHXH, Sở, QuảnTrị |
| GET | `/bao-cao/van-hanh?khoa_id=&nhom_hoc_vien=&lop_id=` + `/xuat-excel` | **Thêm 2026-09-29 (T7)**: mỗi dòng 1 `lop_hoc` — `ten_lop`, `nhom_hoc_vien`, `muc_nang_luc`, `si_so`, `so_co_email`, `so_ho_so_day_du` (T9, `danhGiaDayDu`), `theo_muc_dau_vao` (đếm `dang_ky_hoc.muc_dau_vao`, kể cả `NULL`) + dòng `tong` cộng dồn kết quả đã lọc. Cả 3 query đều tùy chọn; bỏ `khoa_id` = gộp mọi khóa trong phạm vi xem. **Sửa 2026-10-03 (ADR 0001)**: áp R1/R2 — xem ghi chú dưới | Trường, Phòng VHXH, Sở, QuảnTrị |
| GET | `/bao-cao/gio-day?khoa_id=&tu_ngay=&den_ngay=` + `/xuat-excel` | **Thêm 2026-10-07 (T11, issue #3)**: mỗi dòng = giảng viên × lớp — `ho_ten`, `ma_khoa`, `ten_lop`, `so_buoi`, `so_buoi_da_xac_nhan`, `tong_gio_da_xac_nhan` (**chỉ cộng** phân công `da_xac_nhan_gio`) + `tong`. Phạm vi khóa theo R1/R2 (`getKhoaIdsXemDuoc`), `khoa_id` ngoài phạm vi → `403`. Chỉ **Quản trị** có thêm `so_dien_thoai`, `email` (cả Excel) | Trường, Phòng VHXH, Sở, QuảnTrị |
| GET | `/bao-cao/tong-quan?khoa_id=&don_vi_cong_tac_id=&tu_ngay=&den_ngay=` + `/xuat-excel` | **Thêm 2026-09-30, sửa 2026-10-07**: dashboard "Tổng quan hệ thống" — `tong_hoc_vien_tham_gia` (số dòng `dang_ky_hoc` khớp bộ lọc), `da_dang_nhap`/`da_chinh_sua_ho_so` (tính trên tập `hoc_vien` phân biệt rút ra từ chính các dòng đó). `khao_sat.{dau_vao,dau_ra}` = `{ da_lam, theo_muc: [{ma,nhan,so_luong}], chua_xep_muc }` — mức lấy từ `ket_qua_khao_sat.muc_goc` (hoàn thành; đầu vào = loại `danh-gia`, đầu ra = `dau-ra`), theo đúng thang quản trị cấu hình (`ThangMucService`, **không quy đổi** sang `muc`, quyết định 2026-10-05); mã lạ ngoài thang nối cuối `theo_muc` với `nhan` = chính mã đó. `tham_gia_hoc` (**sửa 2026-10-07**, thay `ket_qua_theo_hinh_thuc` cũ dựa `dang_ky_hoc_lop` đã bỏ): mảng theo GIAI ĐOẠN — `{ giai_doan_id, ma_khoa, thu_tu, ten_giai_doan, so_buoi, co_mat, vang_co_phep, vang }`, tính từ `diem_danh` thật (lượt điểm danh của các đăng ký khớp bộ lọc) nhóm theo `lich_hoc_id` rồi gộp lên giai đoạn chứa buổi đó; `so_buoi` = số buổi (`lich_hoc_lop`) có ít nhất 1 lượt điểm danh. Tất cả query tùy chọn; `tu_ngay`/`den_ngay` lọc theo `dang_ky_hoc.ngay_dang_ky`. Improvised (chưa có trong đặc tả gốc) | Trường, Phòng VHXH, Sở, QuảnTrị |

**Lưu ý (T7, sửa 2026-10-03 — ADR 0001):** 2 lớp phạm vi tách biệt, cùng cơ chế R1/R2 với `GET /khoa-boi-duong` (mục 3, thay hẳn cơ chế "đơn vị theo dõi" `khoa_don_vi_theo_doi` cũ của T2): lớp nào **hiện ra** theo phạm vi XEM khóa (`id ∈ getKhoaIdsXemDuoc`); nhưng học viên **đếm bên trong mỗi lớp** (`si_so`, `so_co_email`, `so_ho_so_day_du`, `theo_muc_dau_vao`) lọc theo `getHocVienScopeTrongKhoa` CỦA KHÓA chứa lớp đó — R1 (khóa do đơn vị trong phạm vi caller đặt hàng) đếm TOÀN BỘ; R2 (chỉ có học viên trong phạm vi tham gia) chỉ đếm đúng học viên thuộc phạm vi đó, không đếm nhầm học viên đơn vị khác trong cùng lớp/khóa.

**`/bao-cao/tong-quan` (cập nhật 2026-10-07):** nay áp R1/R2 qua `ThongKeScopeService`; bộ lọc `don_vi_cong_tac_id` bao gồm cả cây đơn vị con của đơn vị đó. Shape và tham số giữ nguyên.

### Dashboard thống kê `/thong-ke/*` (2026-10-07)

Spec: `docs/superpowers/specs/2026-10-07-dashboard-thong-ke-design.md`. Kiểu response: `backend/src/thong-ke/thong-ke.types.ts`. Ai gọi: `quan_tri`, `so_gddt`, `phong_vhxh`, `truong`, `ho_tro_hoc_vien` (vai trò khác, gồm `hoc_vien` → `403`). Phạm vi chỉ lấy qua `ThongKeScopeService.resolve`.

Query chung (tùy chọn): `khoa_id`, `don_vi_id`, `cum_id` (UUID) và `doi_tuong` = `giao_vien` \| `can_bo_quan_ly` \| `nhan_vien` \| `chua_xac_dinh` (`hoc_vien.doi_tuong` null). `doi_tuong` chỉ thu hẹp thêm (AND vào phạm vi), áp cho mọi endpoint `/thong-ke/*` kể cả xuất Excel và tập so sánh của `xep-hang` vai trò `truong`; không gửi = tính mọi đối tượng. Giá trị khác → `400`.
- Bộ lọc ngoài phạm vi quyền → `403`. Bộ lọc sai dạng → `400`.
- `cum_id` bắt buộc kèm `khoa_id`; `don_vi_id` và `cum_id` loại trừ nhau; `ho_tro_hoc_vien` không được gửi `don_vi_id`; `so_gddt`/`phong_vhxh`/`truong` không được gửi `cum_id` (→ `400`).
- Phạm vi rỗng (người dùng đơn vị thiếu `don_vi_id`, người hỗ trợ chưa có cụm) → mọi khối rỗng, không lỗi.
- Mẫu số 0 → tỷ lệ `null`.

| Method | Endpoint | Query thêm | Response |
|---|---|---|---|
| GET | `/thong-ke/bo-loc` | — | `BoLocResult`: `khoa[{id,ten_khoa}]`, `don_vi[{id,ten_don_vi,loai_don_vi}] \| null` (null = không hiện ô), `cum[{id,ten_cum,khoa_id}] \| null`, `don_vi_co_dinh {id,ten_don_vi} \| null` (vai trò `truong`) |
| GET | `/thong-ke/pheu` | — | `PheuResult`: `tham_gia`, `da_truy_cap`, `khao_sat_ky_nang_so`, `danh_gia_dau_vao`, `danh_gia_dau_ra`, `ho_so_cho_duyet` (`null` với `ho_tro_hoc_vien`) |
| GET | `/thong-ke/khao-sat` | — | `KhaoSatResult`: `ky_nang_so {hoan_thanh,chua}`, `dau_vao` / `dau_ra` = `{ theo_muc[{ma,nhan,so_luong}], chua_xep_muc, chua_lam }` |
| GET | `/thong-ke/chuyen-muc` | — | `ChuyenMucResult`: `thang[{ma,nhan}]`, `o[{tu,den,so_luong}]` (mọi cặp, kể cả 0), `tong`, `tang`, `giu`, `giam` |
| GET | `/thong-ke/ket-qua` | — | `KetQuaHocCot[]`: `{ khoa_id, ten_khoa, dat, khong_dat, vang, dang_hoc }` (`ket_qua = null` tính `dang_hoc`) |
| GET | `/thong-ke/ket-qua-theo-truong` | `khoa_id` (bắt buộc, thiếu → `400`) | `KetQuaHocTruongDong[]`: `{ don_vi_id, ten_don_vi, dat, khong_dat, vang, dang_hoc }` đếm lượt đăng ký theo đơn vị công tác của học viên (`ket_qua = null` tính `dang_hoc`), sắp theo `ten_don_vi`; phạm vi như `/ket-qua` (tài khoản trường chỉ ra 1 dòng của mình) |
| GET | `/thong-ke/so-sanh-khoa` | — | `SoSanhKhoaCot[]`: `{ khoa_id, ten_khoa, tham_gia, ty_le_truy_cap, ty_le_dau_vao, ty_le_dat }` (tỷ lệ `null` khi mẫu số 0) |
| GET | `/thong-ke/chuyen-can` | — | `ChuyenCanResult`: `truc_tiep: BuoiChuyenCan[] \| null` (null khi không chọn khóa; mỗi buổi `{nhan, giai_doan_thu_tu, buoi_so, co_mat, vang_co_phep, vang, ty_le_co_mat}`), `vle { khoang[{khoang: '0-25'\|'25-50'\|'50-75'\|'75-100', so_luong}], chua_co_du_lieu }` (khoảng `[0,25) [25,50) [50,75) [75,100]`) |
| GET | `/thong-ke/xep-hang` | `chi_so=truy_cap\|khao_sat\|dat` (bắt buộc) | `XepHangResult`: `{ kieu:'bang', top[], bottom[], tong_so }` (dòng `{don_vi_id,ten_don_vi,so_hv,gia_tri 0..1}`; đơn vị < 5 học viên bị bỏ) hoặc `{ kieu:'vi_tri', thu_hang, tong_so, gia_tri, trung_binh }` (vai trò `truong` — không lộ tên/ID đơn vị khác). Vai trò `quan_tri` không có `don_vi_id`: xếp theo Sở/Phòng gốc, trừ khi có `khoa_id` hoặc số nhóm gốc đủ điều kiện (≥ 5 học viên) ≤ 1 thì xếp theo từng trường (mọi đơn vị `truong`) |
| GET | `/thong-ke/can-don-doc` | `loai=chua_truy_cap\|chua_ky_nang_so\|chua_khao_sat\|vang_nhieu\|vle_thap` (bắt buộc; `chua_ky_nang_so` = chưa hoàn thành phiếu khảo sát kĩ năng số (`loai='khao-sat'`); `chua_khao_sat` = chưa hoàn thành phiếu đánh giá NLS đầu vào (`loai='danh-gia'`)), `page` (số nguyên ≥ 1) | `CanDonDocResult`: `{ tong, page, items[{hoc_vien_id,ho_ten,ten_don_vi,ten_khoa,so_dien_thoai,email,chi_tiet}] }`. Ngưỡng: vắng ≥ 2 buổi (chỉ `trang_thai='vang'`), VLE < 50 |
| GET | `/thong-ke/can-don-doc/xuat-excel` | `loai` (bắt buộc) | File Excel toàn bộ danh sách khớp (không phân trang) |
| GET | `/thong-ke/bieu-mau/dang-ky-truy-cap/xuat-excel` | query chung (`khoa_id`, `don_vi_id`, `cum_id`, `doi_tuong`; đều tùy chọn) | File Excel `bieu-mau-dang-ky-truy-cap.xlsx` "Thống kê đăng ký và truy cập hệ thống". **ĐK** = số học viên phân biệt có `dang_ky_hoc` khớp phạm vi/bộ lọc (học 2 khóa đếm 1); **Đã truy cập** = trong số đó `nguoi_dung_account.dang_nhap_lan_cuoi` khác null; **Tỷ lệ (%)** = đã truy cập / ĐK × 100 (1 chữ số thập phân; ĐK = 0 để trống). Nhóm đối tượng: Giáo viên, Cán bộ quản lý, Nhân viên, Chưa xác định (`doi_tuong` null); nhóm cấp: Mầm non, Tiểu học, THCS, THPT, Trung cấp nghề, Chưa xác định (`cap_giang_day` null). 3 sheet theo thứ tự: **Tổng hợp** (dòng đối tượng + Tổng cộng × cột cấp + Tổng), **Theo đối tượng** (mỗi trường: STT, Trường, Đơn vị quản lý; nhóm Tổng + 4 đối tượng; dòng Tổng cộng), **Theo cấp** (như trên, nhóm Tổng + 6 cấp). Mỗi nhóm có 3 cột ĐK / Đã truy cập / Tỷ lệ (%); 4 dòng tiêu đề (tên biểu mẫu, Khóa, Phạm vi · Đối tượng, Ngày xuất giờ Asia/Ho_Chi_Minh). Phạm vi rỗng vẫn trả đủ 3 sheet với số 0, không tra cứu tên khóa/đơn vị/cụm (tiêu đề dùng nhãn chung). |
| GET | `/thong-ke/chat-luong-ho-so` | query chung (`khoa_id`, `don_vi_id`, `cum_id`, `doi_tuong`; đều tùy chọn) | `{ tong, theo_truong[] }`. Đếm trên học viên PHÂN BIỆT có `dang_ky_hoc` khớp phạm vi/bộ lọc (học 2 khóa đếm 1): `so_hv`; `thieu_doi_tuong` (`doi_tuong` null); `thieu_cap` (`cap_giang_day` null); `thieu_email` (`email_lien_he` null/rỗng/chỉ khoảng trắng); `thieu_sdt` (`so_dien_thoai_lien_he` null/rỗng/chỉ khoảng trắng); `du_ho_so` (không thiếu mục nào trong 4 mục); `ty_le_du` = `du_ho_so`/`so_hv` (0..1, `so_hv` = 0 → null). `theo_truong[]` thêm `don_vi_id`, `ten_don_vi`, `ten_don_vi_cha`, sắp theo `ten_don_vi`; `tong` = tổng các trường. Mọi vai trò dashboard dùng được; tài khoản trường chỉ thấy dòng trường mình. Phạm vi rỗng → `tong` toàn 0 (`ty_le_du` null), `theo_truong` rỗng. |
| GET | `/thong-ke/chat-luong-ho-so/xuat-excel` | query chung như trên | File Excel `chat-luong-ho-so.xlsx` "BÁO CÁO CHẤT LƯỢNG HỒ SƠ HỌC VIÊN" (4 dòng tiêu đề như biểu mẫu ĐK & truy cập). 2 sheet: **Theo trường** (STT, Trường, Đơn vị quản lý, Số HV, Thiếu đối tượng, Thiếu cấp giảng dạy, Thiếu email, Thiếu SĐT, Đủ hồ sơ, Tỷ lệ đủ (%) 0..100 1 chữ số; dòng Tổng cộng), **Cần bổ sung** (mọi HV thiếu ≥ 1 mục: STT, Họ tên, Trường, Đơn vị quản lý, Đối tượng, Cấp giảng dạy, Email, SĐT, Còn thiếu = các mục thiếu nối bằng "; "; sắp theo Trường rồi Họ tên). Phạm vi rỗng vẫn trả đủ 2 sheet, không tra cứu tên khóa/đơn vị/cụm. |
| GET | `/thong-ke/muc-nls` | query chung (`khoa_id`, `don_vi_id`, `cum_id`, `doi_tuong`) + `loai` = `dau_vao` (mặc định, phiếu `danh-gia`) \| `dau_ra` (phiếu `dau-ra`); giá trị khác → 400 | `{ loai, thang[{ma,nhan}], tong, theo_truong[] }`. Học viên = HV PHÂN BIỆT có `dang_ky_hoc` khớp phạm vi/bộ lọc. **Đã làm** = HV có `ket_qua_khao_sat` đúng loại `trang_thai='hoan_thanh'`; **Chưa làm** = `so_hv` − `da_lam`. Mỗi dòng: `so_hv`, `da_lam`, `chua_lam`, `theo_muc[{ma,nhan,so_luong}]` (theo thứ tự thang mức đang cấu hình, đủ mọi mức kể cả 0), `chua_xep_muc` (đã làm nhưng `muc_goc` null hoặc không thuộc thang). % (FE/Excel tự tính): mỗi mức và Chưa xếp mức trên `da_lam`; Đã làm và Chưa làm trên `so_hv`; mẫu 0 → không hiện. `theo_truong[]` thêm `don_vi_id`, `ten_don_vi`, `ten_don_vi_cha`, sắp `ten_don_vi`; `tong` = tổng các trường. Mọi vai trò dashboard dùng được; tài khoản trường chỉ thấy dòng trường mình. Phạm vi rỗng → toàn 0, `theo_truong` rỗng. |
| GET | `/thong-ke/muc-nls/xuat-excel` | query như trên (kể cả `loai`) | File `muc-nls-dau-vao.xlsx` / `muc-nls-dau-ra.xlsx`, dòng 1 "BÁO CÁO KẾT QUẢ ĐÁNH GIÁ NĂNG LỰC SỐ ĐẦU VÀO (hoặc ĐẦU RA) THEO MỨC" + 3 dòng tiêu đề như biểu mẫu ĐK & truy cập. 4 sheet: **Tổng hợp** (bảng "Theo đối tượng" và bảng "Theo cấp giảng dạy" — dòng + Tổng cộng, nhóm "Chưa xác định" cho giá trị null; cột Số HV, Đã làm, Chưa làm, mỗi mức, Chưa xếp mức, mỗi nhóm có SL và %), **Theo trường** (STT, Trường, Đơn vị quản lý, Số HV + các nhóm SL/% như trên; dòng Tổng cộng), **Danh sách học viên** (chỉ HV đã làm: STT, Họ tên, Trường, Đơn vị quản lý, Đối tượng, Cấp giảng dạy, Mức, Ngày hoàn thành dd/MM/yyyy giờ VN; sắp Trường rồi Họ tên), **Chưa làm** (HV chưa làm: STT, Họ tên, Trường, Đơn vị quản lý, Đối tượng, Cấp giảng dạy). % là số 0..100 một chữ số thập phân. Phạm vi rỗng vẫn trả đủ 4 sheet, không tra cứu tên khóa/đơn vị/cụm. |

---

## 8. Dịch vụ Thông báo

Nội bộ, không có endpoint public cho FE trừ 2 mục xem lịch sử/hàng đợi. Mỗi lần **thực sự gửi** (kể cả thất bại) ghi 1 dòng vào `nhat_ky_thong_bao` (`database-ddl.sql` PHẦN 4, thêm 2026-09-25 — bản trước có endpoint `lich-su` nhưng không có bảng nào để đọc) — **ngoại lệ (QĐ6, T3 2026-09-29)**: học viên chưa có `email_lien_he` → bỏ qua hoàn toàn (không gửi, không ghi dòng nào, chỉ log cảnh báo nội bộ), khác với thất bại gửi SMTP (vẫn ghi `trang_thai='that_bai'`). Sự kiện kích hoạt gửi email — cột "Sự kiện" khớp trực tiếp với enum `loai_su_kien_thong_bao`:

**M9 (2026-10-01) — 2 LÀN gửi, tách theo mức độ nhạy cảm thời gian** (tài khoản gửi thật: Google Workspace `boiduongnls@hcmue.edu.vn`, hạn mức SMTP thông thường ~2000 email/ngày — quy mô ~8000 học viên nên 1 đợt phân lớp hàng loạt có thể vượt xa hạn mức này nếu gửi dồn dập):

- **Ưu tiên cao** (`email_xac_minh`, `dat_lai_mat_khau`) — bảo mật quan trọng hơn hạn mức: gửi **NGAY**, không qua hàng đợi, không bị chặn bởi hạn mức/ngày dù đã hết.
- **Hàng loạt** (`hoc_vien_xac_nhan`, `hoc_vien_duyet`, `dang_ky_hoc_phan_lop`, `dang_ky_hoc_ket_qua`) — chỉ **insert vào hàng đợi** (`hang_doi_email`, trạng thái `cho_gui`), trả về ngay; một cron job (`HangDoiEmailProcessor`, mỗi phút) rút tối đa `min(hạn mức còn lại hôm nay, 20)` dòng/lượt theo FIFO (`created_at` tăng dần) để gửi thật — tự trải việc gửi qua nhiều ngày khi vượt hạn mức, tránh bị Google tạm khóa/quarantine tài khoản. Hạn mức/ngày đọc từ biến môi trường `EMAIL_DAILY_LIMIT` (mặc định 2000), tính theo số dòng `nhat_ky_thong_bao.trang_thai='thanh_cong'` có `gui_luc` rơi vào "hôm nay" theo giờ Việt Nam (UTC+7) — **đếm cả 2 làn** (làn ưu tiên cao từ M9 cũng ghi `nhat_ky_thong_bao`, trước đây không ghi) để không đếm thiếu. 1 dòng hàng đợi gửi lỗi được thử lại tối đa 3 lần (tăng `so_lan_thu`, giữ `cho_gui`); lỗi lần thứ 3 thì chuyển `that_bai` + ghi `nhat_ky_thong_bao` (`trang_thai='that_bai'`).

| Sự kiện | Làn | Người nhận | Nội dung |
|---|---|---|---|
| `hoc_vien_xac_nhan` | Hàng loạt | Học viên | Bản sao toàn bộ dữ liệu vừa khai báo |
| `hoc_vien_duyet` | Hàng loạt | Học viên | Kết quả duyệt hồ sơ (đã duyệt / từ chối + lý do) |
| `khoa_boi_duong_duyet` | — | — | **Đã bỏ 2026-10-03 (ADR 0001)**: không còn luồng nộp duyệt/duyệt khóa (D1) nên không còn kích hoạt — `thongBaoService.guiKhoaBoiDuongDuyet` đã xóa khỏi code. Giá trị enum `loai_su_kien_thong_bao` vẫn còn trong DB (Postgres không cho xóa giá trị enum), chỉ không còn dòng nào ghi mới |
| `dang_ky_hoc_phan_lop` | Hàng loạt | Học viên | Thông báo lớp, lịch học, giảng viên — kích hoạt khi import `phan_lop_hoc_vien` gán `lop_id` (không kích hoạt ở nhánh chỉ ghi danh, `lop_id` vẫn NULL) |
| `dang_ky_hoc_ket_qua` | Hàng loạt | Học viên | Kết quả khóa học — kích hoạt bởi `PATCH /dang-ky-hoc/{id}/ket-qua` (mục 3) |
| `email_xac_minh` | Ưu tiên cao | Học viên (email vừa cập nhật) | Link xác minh email liên hệ, hiệu lực 24 giờ |
| `dat_lai_mat_khau` | Ưu tiên cao | Học viên (qua tài khoản `nguoi_dung`) | Link đặt lại mật khẩu, hiệu lực 30 phút |

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| GET | `/thong-bao/lich-su?hoc_vien_id=&loai_su_kien=` | Lịch sử gửi cho 1 hồ sơ (đối chiếu khi học viên báo không nhận được), lọc thêm theo loại sự kiện nếu cần | QuảnTrị |
| GET | `/thong-bao/hang-doi` | **Thêm M9**: đếm `hang_doi_email` theo từng `trang_thai` (`cho_gui`/`thanh_cong`/`that_bai`) + số email đã gửi thành công hôm nay (giờ Việt Nam) + hạn mức còn lại | QuảnTrị |

## 9. Cấu hình khảo sát đầu vào & chế độ triển khai (2026-10-02)

**Cấu hình chung** (khóa `khao_sat_dau_vao` trong `cau_hinh_he_thong`, `database-ddl.sql` PHẦN 5) làm mặc định + **cấu hình riêng tùy chọn theo khóa** (2026-10-02, bảng `cau_hinh_khao_sat_khoa`, PHẦN 7) khi tỉnh/khóa đó chọn phương án khác. Cách chọn cấu hình: **học viên đã đăng nhập** → khóa **đã duyệt** mà học viên đã ghi danh và có cấu hình riêng (nhiều khóa → khóa có `ngay_duyet` gần nhất; không có → chung) — áp dụng cho M6, SSO, menu, M3; **trang chủ công khai** → tỉnh người xem chọn ở ô "Thầy/Cô công tác tại tỉnh/thành nào?" (hoặc link `/?tinh=<dia_danh.id>`), tỉnh không gắn khóa → chung. Mỗi tỉnh gắn tối đa 1 khóa. Quản trị sửa ở `/admin/cau-hinh-khao-sat` (ô "Áp dụng cho"). Có hiệu lực ngay, không cần deploy lại. Mọi response cấu hình có thêm `pham_vi`: `{ loai: 'chung' }` hoặc `{ loai: 'khoa', khoa_id, ma_khoa, ten_khoa, tinh_id, ten_tinh }`.

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| GET | `/cau-hinh-khao-sat?tinh=` | Trả `{ cau_hinh, cap_nhat_luc, pham_vi }`. Không `tinh` → cấu hình chung; có `tinh` (uuid, sai định dạng → 400) → cấu hình khóa gắn tỉnh đó (khóa đã duyệt), không có → chung. `cau_hinh = null` khi chưa lưu → frontend dùng mặc định trong `frontend/src/content/trienKhai.ts` | **Công khai** |
| GET | `/cau-hinh-khao-sat/tinh` | `[{ tinh_id, ten_tinh }]` — các tỉnh có khóa đã duyệt dùng cấu hình riêng, sắp theo tên (rỗng → trang chủ không hiện ô chọn tỉnh) | **Công khai** |
| GET | `/cau-hinh-khao-sat/cua-toi` | Cấu hình áp dụng cho học viên đang đăng nhập (theo khóa đã ghi danh, xem trên) | HọcViên |
| PUT | `/cau-hinh-khao-sat` | Ghi đè toàn bộ cấu hình **chung**, trả cùng shape với GET | QuảnTrị |
| GET | `/cau-hinh-khao-sat/khoa/{khoaId}` | Cấu hình riêng của khóa; chưa có → `cau_hinh: null` (khóa đang dùng chung), `pham_vi` vẫn kèm thông tin khóa. 404 nếu khóa không tồn tại | QuảnTrị |
| PUT | `/cau-hinh-khao-sat/khoa/{khoaId}` | Body = body PUT cấu hình chung + `tinh_id?: uuid \| null` (tỉnh hiển thị ở trang chủ; null = chỉ áp dụng cho học viên đã ghi danh). Cùng quy tắc kiểm tra. 400 nếu `tinh_id` không phải cấp tỉnh/thành; **409** nếu tỉnh đã gắn khóa khác | QuảnTrị |
| DELETE | `/cau-hinh-khao-sat/khoa/{khoaId}` | Xóa cấu hình riêng → khóa quay về dùng cấu hình chung. 204 | QuảnTrị |

Body `PUT` (cũng là shape `cau_hinh` của `GET`):

```json
{
  "che_do_hoc_vien": "khao_sat",
  "danh_gia_dau_vao_trong_cong": false,
  "hien_khao_sat": true,
  "kenh_danh_gia": "vle",
  "phieu": [
    { "ten": "Phiếu khảo sát kĩ năng số", "mo_ta": "…", "lien_ket": [{ "nhan": "Mở phiếu khảo sát", "url": "https://…" }] },
    { "ten": "Phiếu đánh giá năng lực số", "mo_ta": "…", "lien_ket": [
      { "nhan": "Dành cho giáo viên", "url": "https://…" },
      { "nhan": "Dành cho cán bộ quản lý", "url": "" }
    ] }
  ]
}
```

- `che_do_hoc_vien`: `khao_sat` = học viên không đăng nhập, làm tuần tự các phiếu ở trang chủ; `dang_nhap` = mời đăng nhập cổng học viên (quyền sửa hồ sơ vẫn do Đợt xác nhận quyết định).
- `danh_gia_dau_vao_trong_cong`: hiện/ẩn menu "Đánh giá đầu vào" (M6) trong cổng học viên.
- `kenh_danh_gia` (2026-10-02, **bắt buộc khi PUT**): `sso` = M6 chuyển sang hệ thống khảo sát bằng mã dùng 1 lần (mục 10); `vle` = luồng T15 (tài khoản VLE). Cấu hình lưu trước ngày này không có trường → đọc là `vle`.
- `khao_sat_dau_vao_mo` (2026-10-05, tùy chọn): khối "Khảo sát đầu vào" trên trang chủ học viên **đã đăng nhập** (M3) — tách khỏi `hien_khao_sat`, nay `hien_khao_sat` chỉ điều khiển khối khảo sát trên trang giới thiệu công khai (M0). Thiếu (cấu hình lưu trước) = `hien_khao_sat || danh_gia_dau_vao_trong_cong` (giữ hành vi cũ); khi lưu, server điền giá trị suy ra này nếu không gửi.
- `khao_sat_dau_ra_mo` (2026-10-02, tùy chọn, thiếu = `false`): mở khảo sát đầu ra — trang chủ cổng học viên hiện khối "Khảo sát đầu ra" và cho cấp mã SSO `target=dau-ra` (mục 10). Điều kiện học viên: chỉ cần hồ sơ đầy đủ (T9), không phụ thuộc `kenh_danh_gia`.
- `phieu`: thứ tự mảng = thứ tự làm. `url` rỗng = chưa có đường dẫn (trang chủ hiện nút bị khóa). Ràng buộc chi tiết: `validation-checklist.md` mục "Cấu hình khảo sát đầu vào".

## 10. SSO sang hệ thống khảo sát (2026-10-02)

Mục đích: học viên đã đăng nhập cổng bồi dưỡng sang hệ thống khảo sát (`khaosatnls.hcmue.edu.vn`, **chưa triển khai**) **không phải đăng nhập lại**. Trên URL chỉ có mã ngẫu nhiên dùng 1 lần — **không có CCCD, mật khẩu hay mã định danh**.

**Luồng**

1. Học viên (hồ sơ đầy đủ, `kenh_danh_gia = sso`) bấm nút ở M6 → FE gọi `POST /sso/cap-ma`.
2. Cổng tạo mã 32 byte ngẫu nhiên (base64url, 43 ký tự), lưu **SHA-256** của mã (`ma_sso_mot_lan`, DDL PHẦN 6), hết hạn sau **5 phút**, trả URL. FE chuyển trang **cùng tab** tới:
   `{SSO_KHAO_SAT_URL}?code={MA_MOT_LAN}&target={khao-sat|danh-gia|dau-ra}` — bỏ `target` thì bên khảo sát hiện danh sách bài cần làm. Mặc định `SSO_KHAO_SAT_URL = https://khaosatnls.hcmue.edu.vn/sso/start`.
3. **Máy chủ** khảo sát (không phải trình duyệt) gọi `POST /sso/doi-ma` kèm header `X-API-Key` → nhận thông tin học viên → tự tạo phiên đăng nhập bên mình → mở đúng bài.

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| POST | `/sso/cap-ma` | Body `{ target?: 'khao-sat' \| 'danh-gia' \| 'dau-ra' }` → `201 { url, het_han }`. `khao-sat`/`danh-gia`/bỏ trống: 403 nếu kênh không phải `sso` hoặc hồ sơ chưa đầy đủ (dùng chung cổng điều kiện M6). `dau-ra`: 403 nếu `khao_sat_dau_ra_mo` chưa bật hoặc hồ sơ chưa đầy đủ. 400 nếu `target` khác 3 giá trị trên | HọcViên (JWT) |
| POST | `/sso/ma-thu` | **Mã thử để tích hợp.** Body `{ ma_dinh_danh_moet, target? }` → `201 { url, code, het_han, hoc_vien: { id, ho_ten, ma_dinh_danh_moet, doi_tuong } }`. Cố ý BỎ QUA điều kiện kênh/hồ sơ đầy đủ; mã hoạt động y hệt mã thật (5 phút, 1 lần). 404 nếu không có học viên mang mã định danh đó. Giao diện: admin Cấu hình khảo sát → "Thử tích hợp SSO". Không mở thêm quyền: quản trị vốn xem được mọi hồ sơ, đổi mã vẫn cần API key | QuảnTrị |
| POST | `/sso/doi-ma` | Body `{ code }` + header `X-API-Key` → `200` thông tin học viên (dưới đây). Mỗi mã đổi được **đúng 1 lần** | Máy chủ khảo sát (không JWT) |

Response `POST /sso/doi-ma`:

```json
{
  "hoc_vien_id": "uuid — định danh ổn định trong cổng (dùng khi không có mã MOET)",
  "ho_ten": "Nguyễn Văn A",
  "so_dinh_danh_ca_nhan": "089123456789",
  "email": "a@example.com",
  "gioi_tinh": "Nam",
  "dia_chi": "Phường Long Xuyên, Tỉnh An Giang",
  "ma_dinh_danh_moet": "9115131060",
  "vai_tro": "giao_vien",
  "ma_don_vi": "DV01",
  "ma_khoa": "2026-AG-NLS",
  "ten_don_vi": "Trường THPT …",
  "target": "danh-gia",
  "lop": [{ "ma_khoa": "NLS-AG", "ten_lop": "Lớp 1", "loai_lop": "zoom", "giai_doan": "Zoom – nhóm 1" }]
}
```

- `ma_dinh_danh_moet`: mã định danh CSDL ngành — `null` với hồ sơ tự đăng ký không có mã MOET (dùng `hoc_vien_id`).
- `vai_tro`: `giao_vien` | `can_bo_quan_ly` (học viên tự chọn ở hồ sơ, trường `doi_tuong`; `nhan_vien` không bao giờ được cấp mã — xem dưới). Kênh `sso` chỉ cấp mã cho hồ sơ đầy đủ nên trường này luôn có giá trị.
- `ma_khoa` (2026-10-02): khóa **đã duyệt** mới nhất học viên đã ghi danh — để bên khảo sát biết người làm bài thuộc tỉnh/khóa nào; `null` nếu chưa ghi danh.
- `ma_don_vi`: có thể `null` nếu đơn vị chưa có mã. `lop`: rỗng nếu chưa được phân lớp (thường gặp ở giai đoạn đánh giá đầu vào).
- `ho_ten` (thêm 2026-10-07): họ tên học viên theo hồ sơ — để bên khảo sát hiển thị/đối chiếu người làm bài.
- `so_dinh_danh_ca_nhan` (CCCD), `email` (email liên hệ), `gioi_tinh`, `dia_chi` (thêm 2026-10-08, theo yêu cầu bên khảo sát): `null` nếu hồ sơ chưa có. `dia_chi` = nơi cư trú `"Phường/xã, Tỉnh"` (thiếu cấp nào bỏ cấp đó). CCCD chỉ đi qua kênh máy chủ–máy chủ này, **không** bao giờ nằm trên URL.
- **Vẫn KHÔNG trả** ngày sinh, SĐT.

Lỗi `POST /sso/doi-ma` (cùng thân lỗi chung `{ error: { code, message } }`):

| HTTP | `code` | Khi nào |
|---|---|---|
| 401 | `UNAUTHORIZED` | Thiếu/sai `X-API-Key` (so khớp thời gian hằng) — mã **không** bị đốt |
| 400 | `SSO_MA_KHONG_HOP_LE` | Mã không tồn tại, đã dùng, hoặc hết hạn — gộp 1 thông báo, không tiết lộ trường hợp nào |
| 400 | `VALIDATION_ERROR` | Thiếu `code` hoặc độ dài ngoài 20–100 |
| 503 | `SSO_CHUA_CAU_HINH` | Máy chủ cổng chưa đặt `SSO_KHAO_SAT_API_KEY` |

Quy tắc bảo mật: đánh dấu đã dùng **nguyên tử** (`UPDATE … WHERE da_dung_luc IS NULL AND het_han > now()` — 2 lần đổi đồng thời chỉ 1 lần thắng); DB không lưu mã gốc; API key là bí mật dùng chung, đặt bằng biến môi trường ở **cả 2 phía**, đổi khóa = đổi biến môi trường rồi reload. Nginx phải proxy prefix `/sso` (đã có trong `scripts/vps/05-install-nginx.sh`).

### 10.1 Báo trạng thái / kết quả về cổng (2026-10-04)

Mục đích: học viên nhìn cổng biết từng bài **chưa làm / đã vào nhưng chưa nộp / đang làm / đã hoàn thành + mức**; quản trị rà soát người "đã vào mà chưa nộp". Lưu ở `ket_qua_khao_sat` (DDL PHẦN 8), mỗi học viên × loại bài 1 dòng. Loại bài (`loai`) = đúng giá trị `target` của SSO: `khao-sat` | `danh-gia` | `dau-ra`.

3 nguồn ghi:

1. **Cổng tự ghi `da_mo`** khi `POST /sso/doi-ma` thành công **và mã có `target`** (học viên đã thực sự tới trang khảo sát): tạo dòng `da_mo` hoặc tăng `so_lan_mo`; **không bao giờ hạ** trạng thái đang làm/hoàn thành. Lỗi ghi không làm hỏng đổi mã.
2. **Hệ thống khảo sát báo về** — `POST /sso/ket-qua` (dưới đây). Khuyến nghị: báo `dang_lam` khi học viên bắt đầu, `hoan_thanh` khi nộp bài.
3. **Quản trị import Excel** `ket_qua_khao_sat` (dự phòng khi bên khảo sát chưa gọi được API) — mục 5.

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| POST | `/sso/ket-qua` | Header `X-API-Key` (cùng khóa với `/sso/doi-ma`). Body `{ hoc_vien_id? \| ma_dinh_danh_moet?, loai, trang_thai: 'dang_lam' \| 'hoan_thanh', thoi_diem?, muc?, muc_goc?, diem?, diem_toi_da?, url_ket_qua?, chi_tiet? }` → `200 { hoc_vien_id, loai, trang_thai, muc, muc_goc, bo_qua? }` (trạng thái **sau khi gộp**; `bo_qua` = tên các trường lạ đã bị bỏ qua, chỉ có khi khác rỗng — 2026-10-05). Lỗi: 401 sai key, 503 chưa cấu hình key, 400 thiếu cả 2 định danh / giá trị sai, 404 không tìm thấy học viên | Máy chủ khảo sát (không JWT) |
| GET | `/sso/tinh-trang` | Đủ 3 loại bài: `[{ loai, trang_thai: 'chua_lam'\|'da_mo'\|'dang_lam'\|'hoan_thanh', can_kiem_tra, mo_gan_nhat_luc, hoan_thanh_luc, muc, muc_goc, nhan_muc_goc, url_ket_qua }]`. **Không** trả `diem`/`chi_tiet` | HọcViên (JWT) |
| GET | `/sso/thang-muc` | (2026-10-05) Thang mức kết quả: `{ thang: [{ ma, nhan }], cap_nhat_luc }`. Chưa cấu hình → mặc định M1 Chưa đạt, M2 Cơ bản, M3 Thành thạo, M4 Nâng cao (lưu `cau_hinh_he_thong` khóa `thang_muc_khao_sat`) | QuảnTrị |
| PUT | `/sso/thang-muc` | Body `{ muc: [{ ma, nhan }] }` — 1–10 mức; `ma` chữ không dấu + số ≤ 10 ký tự (tự viết hoa), không trùng; `nhan` 1–40 ký tự. Giao diện: admin Cấu hình khảo sát → "Thang mức kết quả khảo sát" | QuảnTrị |
| GET | `/sso/ket-qua/thong-ke?khoa_id=` | `{ tong_hoc_vien, theo_loai: [{ loai, chua_lam, da_mo, dang_lam, hoan_thanh, can_kiem_tra, theo_muc: { co_ban, thanh_thao, nang_cao, chua_xep_muc } }] }`. Bỏ `khoa_id` = mọi học viên; có = học viên đã ghi danh khóa đó | QuảnTrị |
| GET | `/sso/ket-qua?khoa_id=&loai=&trang_thai=&q=&page=&page_size=` | Danh sách **học viên** (kể cả chưa làm) kèm `ket_qua: [{ loai, trang_thai, can_kiem_tra, so_lan_mo, mo_gan_nhat_luc, hoan_thanh_luc, muc, muc_goc, nhan_muc_goc, url_ket_qua, diem, diem_toi_da, chi_tiet, nguon, cap_nhat_luc }]`. `trang_thai` lọc ∈ `chua_lam`\|`da_mo`\|`dang_lam`\|`hoan_thanh`\|`can_kiem_tra`, áp cho `loai` (mặc định `khao-sat`); `q` tìm họ tên / mã định danh. Phân trang chuẩn | QuảnTrị |

Trường body `POST /sso/ket-qua`: `muc` ∈ `co_ban`\|`thanh_thao`\|`nang_cao` (tùy chọn — mức 3 bậc của cổng, dùng cho quản trị xếp lớp); **`muc_goc`** (2026-10-05, tùy chọn) = **mã** mức theo thang của hệ thống khảo sát, chỉ nhận mã có trong **thang mức do quản trị cấu hình** (mặc định `"M1"`\|`"M2"`\|`"M3"`\|`"M4"`; tha hoa/thường, khoảng trắng; mã lạ hoặc gửi kèm chữ như `"M1 – Chưa đạt"` → 400). Cổng tự ghép nhãn (`nhan_muc_goc`, vd **"M1 – Chưa đạt"**) trả cho học viên/quản trị (ưu tiên hơn `muc`); đổi nhãn có hiệu lực ngay với kết quả đã nhận. Tạm thời **chỉ ghi nhận**, cổng **không** tự quy đổi M1–M4 sang `muc` — xếp lớp xử lý sau (quyết định 2026-10-05); `diem` số 0–9999, tối đa 2 chữ số thập phân (chỉ quản trị xem); **`diem_toi_da`** (2026-10-05, tùy chọn, > 0, ≥ `diem`) để hiển thị "13,75 / 44 (31,25%)"; **`url_ket_qua`** (2026-10-05, tùy chọn, ≤ 500) = trang kết quả chi tiết bên khảo sát (miền, năng lực, khuyến nghị) — chỉ nhận http(s) **cùng tên miền `SSO_KHAO_SAT_URL`**, học viên và quản trị có nút "Xem kết quả chi tiết"; cổng **không** lưu/hiển thị chi tiết miền–năng lực (quyết định 2026-10-05: chỉ lưu đường dẫn); `chi_tiet` object JSON tùy ý (điểm từng miền…, chỉ lưu, chỉ quản trị dùng); `thoi_diem` ISO 8601, mặc định lúc nhận.

Quy tắc gộp (dùng chung API + import):
- `dang_lam` đến sau `hoan_thanh` → **bỏ qua** (báo trễ/trùng).
- `hoan_thanh` **ghi đè** mức/điểm/chi tiết (cho phép làm lại), **trừ khi** `thoi_diem` cũ hơn lần hoàn thành đã ghi (gói tin đến lệch thứ tự).
- Gọi lại cùng nội dung là an toàn (idempotent theo `(hoc_vien_id, loai)`).
- `can_kiem_tra = true` khi `da_mo`/`dang_lam` mà **quá 24 giờ** không có cập nhật — học viên được nhắc "vào lại kiểm tra và bấm nộp bài".
- Mức ở đây **chỉ để hiển thị/theo dõi**: **không** tự đổi `dang_ky_hoc.muc_dau_vao` — quản trị chốt mức qua import `ket_qua_danh_gia` (mục 5, T5).

Giao diện: M6 hiện từng bài kèm nhãn trạng thái + nút "Làm bài"/"Làm tiếp"/"Mở lại trang khảo sát"; M3 hiện tóm tắt; admin `/admin/tinh-hinh-khao-sat` (thống kê theo loại, bấm ô để lọc, danh sách có điểm + nguồn). Mã mẫu phía khảo sát: `scripts/sso-demo/trang-khao-sat-gia-lap.mjs` bước [4].

**Chưa làm (khi bên khảo sát cần):** dọn định kỳ bản ghi mã đã hết hạn (hiện chỉ tích lũy, mỗi lượt bấm 1 dòng nhỏ); giới hạn tần suất cấp mã theo học viên.

## 11. Nhật ký hoạt động (2026-10-04)

Mục đích: đối chiếu khi học viên phản ánh ("đã cập nhật", "đã làm khảo sát", "sao bị đổi lớp"…).

**Bảng `nhat_ky_hoat_dong`** — chỉ thêm; trigger DB chặn `UPDATE`/`DELETE`. Chỉ ghi những gì bảng khác chưa lưu, kèm IP + thiết bị (User-Agent) lấy tự động từ request:

| `hanh_dong` | Ghi khi |
|---|---|
| `dang_nhap_thanh_cong` / `dang_nhap_sai_mat_khau` / `dang_nhap_bi_khoa` | `POST /auth/dang-nhap` (tài khoản tồn tại; sai MK kèm số lần sai liên tiếp) |
| `doi_mat_khau` / `dat_lai_mat_khau_qua_email` | `POST /auth/doi-mat-khau`, `POST /auth/dat-lai-mat-khau` |
| `chuyen_sang_khao_sat` | `POST /sso/cap-ma` (đầu vào hoặc đầu ra) |
| `cap_nhat_muc_danh_gia` | Import `ket_qua_danh_gia` khi mức **thay đổi** (cũ → mới) |
| `cap_nhat_ket_qua_hoc` | `PATCH /dang-ky-hoc/{id}/ket-qua` khi kết quả thay đổi |
| `phan_lop` / `doi_cum` | Gán/gỡ lớp, đổi cụm — thủ công hoặc import `phan_lop_hoc_vien` (cũ → mới, chỉ khi thay đổi) |

Lỗi ghi nhật ký **không** làm hỏng thao tác chính (chỉ log lỗi phía server).

**`GET /hoc-vien/{id}/nhat-ky`** (`quan_tri`) — dòng thời gian của 1 học viên, mới nhất trước, gộp: `nhat_ky_hoat_dong`, `lich_su_thay_doi_ho_so` (sửa hồ sơ từng trường), `xac_nhan_ho_so`, `ma_sso_mot_lan` (hệ thống khảo sát đã tiếp nhận), `tai_khoan_vle.lan_dau_xem_luc`, `nhat_ky_thong_bao` (email), `nhat_ky_dat_lai_mat_khau`, `yeu_cau_ho_tro`. Tối đa 300 bản ghi mỗi nguồn.

```json
{
  "hoc_vien": { "id": "uuid", "ho_ten": "Nguyễn Văn A" },
  "muc": [
    {
      "id": "uuid",
      "thoi_gian": "2026-10-04T03:00:00.000Z",
      "nhom": "tai_khoan | ho_so | khao_sat | hoc_tap | thong_bao | ho_tro",
      "tieu_de": "Đăng nhập thành công",
      "noi_dung": "Khóa A — GĐ2 \"Zoom\": Lớp 01 → Lớp 02 (nhập file)",
      "truong": "so_dien_thoai_lien_he",
      "nguoi_thuc_hien": "Nguyễn Văn A (học viên)",
      "ip": "113.161.1.1",
      "thiet_bi": "Mozilla/5.0 … Zalo"
    }
  ]
}
```

`truong` chỉ có ở mục "Sửa hồ sơ" (tên field backend — frontend đổi sang nhãn). Lỗi: 403 nếu không phải `quan_tri`, 404 nếu học viên không tồn tại.

**Chưa làm:** "đã làm xong khảo sát" cần bên khảo sát gửi kết quả về (import hoặc API); lưu hồ sơ thất bại (lỗi validate) chưa ghi.
