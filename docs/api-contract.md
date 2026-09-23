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
Mã lỗi chuẩn: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409 — trùng ĐDCN, trùng mã danh mục...), `INTERNAL` (500).

### Phân trang
`?page=1&page_size=20` (mặc định), response bọc `{ "data": [...], "total": N, "page": 1, "page_size": 20 }`.

---

## 1. Auth & Phân quyền

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| POST | `/auth/dang-nhap` | `{ ten_dang_nhap, mat_khau }` → `{ token, phai_doi_mat_khau, nguoi_dung }`. `ten_dang_nhap` = email (Sở/Phòng/Trường/QuảnTrị) hoặc ĐDCN (Học viên). | Công khai |
| POST | `/auth/dang-xuat` | Vô hiệu hóa token hiện tại | Đã đăng nhập |
| POST | `/auth/doi-mat-khau` | `{ mat_khau_cu, mat_khau_moi }` — bắt buộc nếu `phai_doi_mat_khau=true` | Đã đăng nhập |
| GET | `/auth/toi` | Thông tin tài khoản hiện tại + phạm vi quyền suy ra | Đã đăng nhập |

---

## 2. Dịch vụ Học viên

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| POST | `/hoc-vien` | Tự đăng ký. Body = toàn bộ field khai báo (xem `database-ddl.sql#hoc_vien`). **Side effect**: tạo `hoc_vien` (trang_thai=`nhap`) VÀ `nguoi_dung` (vai_tro=`hoc_vien`, mật khẩu mặc định = ngày sinh) trong 1 transaction — xem chi tiết ở mục "Luồng đăng ký". | Công khai |
| GET | `/hoc-vien/toi` | Hồ sơ của chính mình | Học viên |
| PATCH | `/hoc-vien/toi` | Sửa hồ sơ — chỉ cho phép khi `trang_thai='nhap'` (đã `cho_duyet` thì khóa sửa, trừ khi bị `tu_choi` thì mở lại `nhap`) | Học viên |
| POST | `/hoc-vien/toi/kiem-tra-truoc-xac-nhan` | Dry-run validate toàn bộ hồ sơ, trả danh sách lỗi (chặn) + cảnh báo (không chặn) — dùng cho màn `XacNhanThongTin.dc.html` | Học viên |
| POST | `/hoc-vien/toi/xac-nhan` | Chuyển `nhap` → `cho_duyet`. **Side effect**: gọi Dịch vụ Thông báo gửi email bản sao dữ liệu, set `email_ban_sao_da_gui_at` | Học viên |
| GET | `/hoc-vien` | Danh sách hồ sơ trong phạm vi quyền (query: `trang_thai`, `don_vi_cong_tac_id`, `cap_giang_day`, `q` tìm theo tên/ĐDCN) | Trường, Phòng VHXH, Sở, QuảnTrị |
| GET | `/hoc-vien/{id}` | Chi tiết 1 hồ sơ (phải trong phạm vi quyền) | Trường, Phòng VHXH, Sở, QuảnTrị |
| POST | `/hoc-vien/{id}/duyet` | `{ ket_qua: "da_duyet" \| "tu_choi", ly_do? }`. Đơn vị duyệt xác định theo `cap_giang_day` của hồ sơ (xem bảng routing dưới) | Trường (nếu được phân công xác minh nội bộ), Phòng VHXH, Sở |
| GET | `/hoc-vien/kiem-tra-trung?so_dinh_danh_ca_nhan=` | Kiểm tra ĐDCN đã tồn tại chưa (gọi trước khi submit form, tránh lỗi 409 muộn) | Công khai |

### Routing đơn vị duyệt (theo `cap_giang_day` của hồ sơ)
```
THPT               → Sở GD&ĐT quản lý tỉnh chứa dia_ban_id của đơn vị công tác
MN / TH / THCS     → Phòng Văn hóa - Xã hội quản lý đúng xã/phường đó
```
Sở luôn được phép duyệt thay Phòng VHXH (escalation trong scope-based). Chiều ngược lại — Phòng VHXH duyệt hồ sơ THPT — bị từ chối `403`.

### Luồng đăng ký (chi tiết transaction của `POST /hoc-vien`)
1. Validate toàn bộ body (xem `validation-checklist.md`).
2. `INSERT INTO nguoi_dung (vai_tro='hoc_vien', email=email_lien_he, mat_khau_hash=hash(ngay_sinh dạng ddmmyyyy), phai_doi_mat_khau=true, hoc_vien_id=NULL)` → lấy `nguoi_dung.id`.
3. `INSERT INTO hoc_vien (..., created_by = nguoi_dung.id)` → lấy `hoc_vien.id`.
4. `UPDATE nguoi_dung SET hoc_vien_id = hoc_vien.id WHERE id = nguoi_dung.id`.
5. Commit. Trả về `{ hoc_vien_id, ten_dang_nhap: so_dinh_danh_ca_nhan, luu_y: "Mật khẩu mặc định là ngày sinh — bắt buộc đổi khi đăng nhập lần đầu" }`.

---

## 3. Dịch vụ Khóa bồi dưỡng & Lớp học

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| POST | `/khoa-boi-duong` | Trường tạo khóa (trang_thai=`nhap`) | Trường |
| PATCH | `/khoa-boi-duong/{id}` | Sửa khóa — chỉ khi `trang_thai` ∈ {`nhap`, `tu_choi`} | Trường (chủ khóa) |
| POST | `/khoa-boi-duong/{id}/nop-duyet` | `nhap`/`tu_choi` → `cho_duyet` | Trường (chủ khóa) |
| POST | `/khoa-boi-duong/{id}/duyet` | `{ ket_qua, ly_do? }` — routing giống hồ sơ học viên, theo `don_vi_cha_id` của Trường tổ chức | Phòng VHXH, Sở |
| GET | `/khoa-boi-duong` | Danh sách trong phạm vi quyền | Trường, Phòng VHXH, Sở, QuảnTrị, Học viên (chỉ khóa đã `da_duyet`) |
| GET | `/khoa-boi-duong/{id}` | Chi tiết khóa kèm giai đoạn + lớp | Theo phạm vi |
| POST | `/khoa-boi-duong/{id}/giai-doan` | Thêm 1 `GiaiDoanKhoa` `{ thu_tu, ten_giai_doan, hinh_thuc, thoi_gian_bat_dau, thoi_gian_ket_thuc }` | Trường (chủ khóa) |
| POST | `/khoa-boi-duong/{id}/lop` | Tạo `LopHoc` `{ ten_lop, si_so_toi_da? }` | Trường (chủ khóa) |
| POST | `/lop/{id}/lich-hoc` | Thêm `LichHocLop` `{ giai_doan_id, thoi_gian_bat_dau, thoi_gian_ket_thuc, dia_diem_hoac_link }` | Trường (chủ khóa) |
| POST | `/lop/{id}/nhan-su` | Thêm giảng viên/hỗ trợ `{ ho_ten, vai_tro, so_dien_thoai? }` | Trường (chủ khóa) |
| DELETE | `/lop/{id}/nhan-su/{nhan_su_id}` | Gỡ 1 nhân sự khỏi lớp | Trường (chủ khóa) |
| GET | `/hoc-vien/toi/khoa-hoc` | Học viên xem khóa/lớp mình đã đăng ký/được phân | Học viên |
| GET | `/hoc-vien/toi/ket-qua` | Học viên xem `ket_qua`, `ngay_hoan_thanh` từng `DangKyHoc` | Học viên |

---

## 4. Dịch vụ Danh mục dùng chung

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| GET | `/danh-muc/dia-danh` | `?cap=&parent_id=&q=&trang_thai=` | Mọi vai trò đã đăng nhập |
| POST / PATCH | `/danh-muc/dia-danh(/{id})` | Sửa/thêm thủ công (ngoài import) | QuảnTrị |
| GET | `/danh-muc/don-vi-cong-tac` | `?loai_don_vi=&dia_ban_id=&q=` (autocomplete dùng `q`) | Mọi vai trò đã đăng nhập |
| POST / PATCH | `/danh-muc/don-vi-cong-tac(/{id})` | Sửa/thêm thủ công | QuảnTrị |
| GET | `/danh-muc/mon-hoc?cap_hoc=` | Lọc theo cấp học — dùng cho dropdown phụ thuộc "Môn giảng dạy" | Mọi vai trò đã đăng nhập |
| POST / PATCH | `/danh-muc/mon-hoc(/{id})` | Sửa/thêm thủ công | QuảnTrị |
| GET | `/danh-muc/chuyen-mon-dao-tao/goi-y?q=` | `SELECT DISTINCT chuyen_mon_dao_tao FROM hoc_vien WHERE chuyen_mon_dao_tao ILIKE '%q%' LIMIT 10` — **không phải danh mục quản lý**, chỉ gợi ý từ dữ liệu đã có | Học viên (khi điền form) |

---

## 5. Dịch vụ Import

Dùng chung 1 luồng cho cả 4 loại (`loai_danh_muc_import`): `dia_danh`, `don_vi_cong_tac`, `mon_hoc`, `phan_lop_hoc_vien`.

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| GET | `/import/mau-excel?loai=` | Tải file mẫu đúng cột cho loại đã chọn | QuảnTrị |
| POST | `/import/{loai}` | `multipart/form-data`, field `file`. Trả ngay `{ import_id, trang_thai: "dang_xu_ly" }` — xử lý bất đồng bộ (job queue) | QuảnTrị |
| GET | `/import/{id}` | Kết quả: `{ tong_so_dong, so_dong_thanh_cong, so_dong_loi, trang_thai, danh_sach_loi: [{dong, ly_do}] }` | QuảnTrị |
| GET | `/import/{id}/file-loi` | Tải file Excel chỉ chứa các dòng lỗi kèm cột "Lý do" | QuảnTrị |
| POST | `/import/{id}/xac-nhan` | Nạp chính thức các dòng hợp lệ (bước riêng sau khi xem preview, đề phòng import nhầm file) | QuảnTrị |
| GET | `/import` | Nhật ký import `?loai=&tu_ngay=&den_ngay=` | QuảnTrị |

Riêng `phan_lop_hoc_vien`: cột file = `so_dinh_danh_ca_nhan`, `ma_khoa`, `ten_lop`. Dòng lỗi điển hình: ĐDCN không tồn tại/chưa được duyệt, khóa/lớp không tồn tại, học viên đã ở lớp khác trong cùng khóa.

---

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
| GET | `/bao-cao/tong-hop?theo=don_vi\|dia_ban\|khoa&tu_ngay=&den_ngay=` | Số liệu tổng hợp trong phạm vi quyền | Trường, Phòng VHXH, Sở, QuảnTrị |
| GET | `/bao-cao/xuat-excel?...` (cùng query) | Xuất Excel/CSV UTF-8 (BOM), cùng bộ lọc | Trường, Phòng VHXH, Sở, QuảnTrị |

---

## 8. Dịch vụ Thông báo

Nội bộ, không có endpoint public cho FE trừ 1 mục xem lịch sử. Sự kiện kích hoạt gửi email:

| Sự kiện | Người nhận | Nội dung |
|---|---|---|
| `hoc_vien.xac_nhan` | Học viên | Bản sao toàn bộ dữ liệu vừa khai báo |
| `hoc_vien.duyet` | Học viên | Kết quả duyệt hồ sơ (đã duyệt / từ chối + lý do) |
| `khoa_boi_duong.duyet` | Trường (người tạo khóa) | Kết quả duyệt khóa |
| `dang_ky_hoc.phan_lop` | Học viên | Thông báo lớp, lịch học, giảng viên |
| `dang_ky_hoc.ket_qua` | Học viên | Kết quả khóa học |

| Method | Endpoint | Mô tả | Ai gọi |
|---|---|---|---|
| GET | `/thong-bao/lich-su?hoc_vien_id=` | Lịch sử email đã gửi cho 1 hồ sơ (đối chiếu khi học viên báo không nhận được) | QuảnTrị |
