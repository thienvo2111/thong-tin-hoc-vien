# Đặc tả — Người hỗ trợ học viên theo cụm (2026-10-06)

Quyết định nền: [ADR 0003](../../adr/0003-nguoi-ho-tro-hoc-vien.md) (H1–H14). File này mô tả **cái gì** cần làm theo 4 lát cắt dọc; mỗi lát deploy được riêng. Ngôn ngữ domain: [CONTEXT.md](../../../CONTEXT.md).

## 0. Thuật ngữ

- **Người hỗ trợ học viên** — `nguoi_dung.vai_tro = 'ho_tro_hoc_vien'`, cán bộ HCMUE.
- **Cụm của tôi** — các `cum_hoc_vien` có dòng `phan_cong_ho_tro` với `nguoi_dung_id = caller.id`.
- **Học viên trong phạm vi** — học viên có ≥ 1 `dang_ky_hoc` với `cum_id ∈ Cụm của tôi`.

## 1. Lát 1 — Tài khoản & phân công

### Schema (chỉ thêm)
1. Migration riêng: `ALTER TYPE vai_tro_nguoi_dung ADD VALUE 'ho_tro_hoc_vien'`.
2. Bảng `phan_cong_ho_tro`: `id uuid PK`, `nguoi_dung_id uuid FK nguoi_dung` (ON DELETE CASCADE), `cum_id uuid FK cum_hoc_vien` (ON DELETE CASCADE), `created_at`; `UNIQUE (nguoi_dung_id, cum_id)`, index `cum_id`.
3. CHECK trên `nguoi_dung`: thêm nhánh `ho_tro_hoc_vien` (`don_vi_id`/`hoc_vien_id` NULL) vào `chk_nguoi_dung_scope` có sẵn, và đưa `ho_tro_hoc_vien` vào `chk_nguoi_dung_email_bat_buoc` (cùng quan_tri).
4. Ứng dụng chặn: chỉ gán phân công cho `nguoi_dung` có vai trò `ho_tro_hoc_vien` (400 nếu khác).

### API (chỉ `quan_tri`)
- `GET /nguoi-dung/ho-tro` — danh sách tài khoản + các cụm đang phân công (`[{cum_id, ten_cum, khoa_id, ten_khoa}]`).
- `POST /nguoi-dung/ho-tro` — `{ho_ten, email, ten_dang_nhap?, cach_cap: 'link_kich_hoat' | 'mat_khau_tam'}`; mặc định `link_kich_hoat`; `ten_dang_nhap` theo regex A5 (ADR 0002), bỏ trống = phần trước `@` của email (chuẩn hóa về regex). Trả mật khẩu tạm 1 lần nếu `cach_cap = mat_khau_tam`.
- `PATCH /nguoi-dung/ho-tro/{id}` — sửa `ho_ten`, `email`, `trang_thai` (khóa/mở khóa).
- `POST /nguoi-dung/ho-tro/{id}/cap-mat-khau-tam`, `POST /nguoi-dung/ho-tro/{id}/gui-email-kich-hoat` — như tài khoản đơn vị.
- `PUT /khoa-boi-duong/{khoaId}/cum/{cumId}/nguoi-ho-tro` — `{nguoi_dung_ids: uuid[]}` thay toàn bộ phân công của cụm (rỗng = gỡ hết). Cụm phải thuộc khóa (404).
- `GET /khoa-boi-duong/{id}/cum` (đã có hoặc mở rộng) — mỗi cụm trả thêm `nguoi_ho_tro: [{id, ho_ten}]`.
- ~~Import `tai_khoan_ho_tro`~~ — **hoãn (2026-10-06, khi làm #10)**: vận hành 1 người/1 cụm, ~9 cụm → tạo lẻ đủ nhanh; import cần thêm giá trị enum `loai_danh_muc_import` + migration riêng mà chưa có nhu cầu (YAGNI). Làm khi số người hỗ trợ tăng.

### Đăng nhập
- `ho_tro_hoc_vien` đăng nhập như tài khoản đơn vị (khớp không phân biệt hoa/thường), buộc đổi mật khẩu lần đầu, về `/ho-tro`.
- `POST /auth/quen-mat-khau` áp dụng cho `ho_tro_hoc_vien` (luôn có email).

### Frontend
- Trang riêng **`/admin/nguoi-ho-tro`** (mục menu "Người hỗ trợ", chỉ quan_tri — sửa 2026-10-06: không làm tab trong `/admin/nguoi-dung`, cùng kiểu với mục "Tài khoản học viên"): bảng (họ tên, tên đăng nhập, email, cụm phụ trách, trạng thái, đăng nhập lần cuối), tạo lẻ, import, khóa/mở, cấp lại.
- Màn chi tiết khóa → mục **Cụm**: cột "Người hỗ trợ" (multi-select tài khoản `ho_tro_hoc_vien` active); cụm chưa có ai → nhãn cảnh báo đỏ.
- Route guard: `/ho-tro/*` chỉ `ho_tro_hoc_vien`; khung layout riêng với menu Học viên / Lịch học / Yêu cầu hỗ trợ.

## 2. Lát 2 — Tra cứu & xuất

### Backend
- `HoTroHocVienScopeService` (`backend/src/ho-tro-hoc-vien/`):
  - `cumIdsCuaToi(caller): Promise<string[]>`
  - `whereHocVienTrongPhamVi(caller): Prisma.hoc_vienWhereInput` (`dang_ky_hoc: { some: { cum_id: { in } } }`)
  - `damBaoTrongPhamVi(caller, hocVienId)` → `NotFoundAppException` nếu ngoài phạm vi (không 403, không lộ tồn tại).
  - Không có phân công → danh sách rỗng, không lỗi.
- `GET /ho-tro/cum-cua-toi` — `[{cum_id, ten_cum, link_zalo, khoa_id, ten_khoa, so_hoc_vien, so_yeu_cau_cho_xu_ly}]`.
- `GET /ho-tro/hoc-vien?tu_khoa=&cum_id=&don_vi_cong_tac_id=&day_du=&da_dang_nhap=&trang_thai_khao_sat=&page=` — tìm không dấu theo họ tên, CCCD, mã MOET, tên đăng nhập. `cum_id` ngoài phạm vi → 404.
- `GET /ho-tro/hoc-vien/{id}` — hồ sơ (kèm `_ten`), `tai_khoan` (`ten_dang_nhap`, `dang_nhap_lan_cuoi`, `dang_bi_khoa`, `khoa_den`, `email_da_xac_minh`, `phai_doi_mat_khau`), `hoc_tap` (theo từng `dang_ky_hoc`: khóa, cụm, lớp theo giai đoạn, lịch buổi + `dia_diem_hoac_link`, `nhan_su_lop`, điểm danh, kết quả khảo sát), `yeu_cau_ho_tro` (tóm tắt), `lich_su_thay_doi` (kèm `ly_do`, người sửa).
- `GET /ho-tro/lich-hoc?tu_ngay=&den_ngay=&cum_id=` — buổi của mọi lớp có ≥1 học viên trong phạm vi (được phân lớp ở đúng giai đoạn của buổi), kèm giảng viên/trợ giảng, số học viên của cụm trong lớp. Mặc định 14 ngày tới.
- `GET /ho-tro/hoc-vien/xuat?<cùng bộ lọc>` — `.xlsx`, 1 sheet/cụm, cột theo ADR H6; ghi `nhat_ky_hoat_dong` (`hanh_dong = 'ho_tro_xuat_danh_sach'`, `chi_tiet = {cum_ids, bo_loc, so_dong}`).

### Frontend
- `/ho-tro/hoc-vien` (danh sách + bộ lọc + nút Xuất), `/ho-tro/hoc-vien/:id` (chi tiết, các tab Hồ sơ / Tài khoản / Học tập / Yêu cầu & lịch sử), `/ho-tro/lich-hoc`.

## 3. Lát 3 — Can thiệp hồ sơ & tài khoản

### Schema
- `lich_su_thay_doi_ho_so.ly_do text NULL`.

### Backend
- `PATCH /ho-tro/hoc-vien/{id}` — DTO riêng `SuaHoSoHoTroDto` = `UpdateHocVienDto` **bỏ** `so_dinh_danh_ca_nhan` (whitelist, `forbidNonWhitelisted` → 400 nếu gửi), **thêm** `ly_do` bắt buộc (trim, 5–500 ký tự). Gọi lõi `suaHoSo` như `suaHoSoByAdmin` (bỏ qua cổng đợt, đợt mở trùng → hủy xác nhận), ghi `ly_do` vào mọi dòng lịch sử của lần sửa, `vai_tro_nguoi_sua = 'ho_tro_hoc_vien'`.
- Quy tắc H8 (trong lõi, áp cho cả `quan_tri`): `email_lien_he` đổi giá trị bởi người không phải chính học viên → `email_da_xac_minh = false`.
- `POST /ho-tro/hoc-vien/{id}/gui-link-dat-lai-mat-khau` — 409 nếu `email_da_xac_minh = false`; tái dùng việc tạo token `dat_lai_mat_khau` + vô hiệu token cũ của `AuthService.quenMatKhau` (tách hàm dùng chung), luôn gửi (không giả vờ "đã gửi" như luồng công khai).
- `POST /ho-tro/hoc-vien/{id}/cap-mat-khau-tam` — sinh 10 ký tự (hàm của ADR 0002), `phai_doi_mat_khau = true`, reset `so_lan_dang_nhap_sai`/`khoa_den`, ghi `nhat_ky_dat_lai_mat_khau` (`thuc_hien_boi = caller`), trả `{mat_khau_tam}` 1 lần.
- `POST /ho-tro/hoc-vien/{id}/mo-khoa-tam` — như endpoint quản trị đã có.
- Mọi endpoint: `damBaoTrongPhamVi` trước tiên.

### Frontend
- Tab Hồ sơ: nút Sửa → form các trường cho phép + ô **Lý do điều chỉnh** bắt buộc; CCCD/mã MOET chỉ đọc.
- Tab Tài khoản: 3 nút; "Gửi link" disabled + gợi ý khi email chưa xác minh; mật khẩu tạm hiện trong hộp thoại có nút Sao chép, cảnh báo "chỉ hiện 1 lần".

## 4. Lát 4 — Yêu cầu hỗ trợ theo cụm

### Schema
- Migration riêng: `ALTER TYPE loai_su_kien_thong_bao ADD VALUE 'yeu_cau_ho_tro_cap_nhat_tra_loi'`.
- `yeu_cau_ho_tro`: `thoi_gian_sua_tra_loi timestamptz NULL`, `sua_tra_loi_boi uuid NULL FK nguoi_dung`.

### Backend
- **Sửa `traLoi`** (dùng chung `quan_tri` + `ho_tro_hoc_vien`): `updateMany where {id, trang_thai: 'cho_xu_ly'}`; `count = 0` → nạp lại ticket, 404 nếu không có, ngược lại 409 kèm `{noi_dung_tra_loi, nguoi_tra_loi_ten, thoi_gian_phan_hoi}` hiện tại. Email học viên chỉ gửi khi update thành công.
- `GET /ho-tro/yeu-cau-ho-tro?trang_thai=&cum_id=` — ticket của học viên trong phạm vi; mỗi dòng kèm `ten_cum`(các cụm), `hoi_lai`, `da_sua_boi_quan_tri`. `GET /ho-tro/yeu-cau-ho-tro/{id}` kèm các ticket trước của cùng học viên. `PATCH /ho-tro/yeu-cau-ho-tro/{id}/tra-loi`.
- `GET /ho-tro/yeu-cau-ho-tro/dem` — `{cho_xu_ly: n}` cho số đếm trên menu.
- Quản trị: `GET /yeu-cau-ho-tro` thêm lọc `chua_co_cum=true` và trả `ten_cum`; `PATCH /yeu-cau-ho-tro/{id}/sua-tra-loi` `{noi_dung_tra_loi}` — 409 nếu chưa có câu trả lời; ghi nội dung cũ vào `nhat_ky_hoat_dong` (`hanh_dong = 'sua_tra_loi_ho_tro'`), set `thoi_gian_sua_tra_loi`/`sua_tra_loi_boi`, `danh_gia = NULL`, nếu `da_dong` thì về `da_phan_hoi`; enqueue email `yeu_cau_ho_tro_cap_nhat_tra_loi`.
- `tinhDaDongHieuLuc`: mốc = `thoi_gian_sua_tra_loi ?? thoi_gian_phan_hoi`. `hoi_lai` giữ mốc `thoi_gian_phan_hoi`.
- Response phía học viên: `nguoi_tra_loi_hien_thi` = tên cụm của học viên (nhiều cụm → cụm của khóa mới nhất); người trả lời là `quan_tri` hoặc không có cụm → "Ban tổ chức (HCMUE)". Không trả họ tên cán bộ. Thêm `thoi_gian_sua_tra_loi`.
- `GET /hoc-vien/toi/cum-ho-tro` — `[{ten_cum, link_zalo, ten_khoa}]` cho thẻ cổng.

### Frontend
- `/ho-tro/yeu-cau-ho-tro`: hàng chờ (mặc định `cho_xu_ly`, cũ nhất trước), chi tiết + ô trả lời; 409 → giữ nội dung đang soạn, hiện câu trả lời đã có.
- Menu `/ho-tro` hiện số đếm, tải lại khi chuyển trang.
- Admin: lọc "Chưa có cụm", nút "Sửa câu trả lời".
- Cổng học viên: nhãn "Đã cập nhật lúc HH:mm dd/mm"; ký tên "Cụm hỗ trợ N"; thẻ "Cụm hỗ trợ của bạn + Vào nhóm Zalo" ở trang chủ.

## 5. Kịch bản kiểm thử bắt buộc (theo yêu cầu, không theo cài đặt)

| # | Kịch bản | Kỳ vọng |
|---|---|---|
| T1 | Người hỗ trợ cụm A xem/sửa/reset học viên cụm B | 404 mọi endpoint |
| T2 | Người hỗ trợ không có phân công | Danh sách rỗng, đếm 0 |
| T3 | Gỡ phân công khi đang đăng nhập | Request kế tiếp 404 |
| T4 | Học viên ở 2 khóa, 2 cụm | Cả 2 người hỗ trợ thấy |
| T5 | Học viên chưa có cụm gửi ticket | Không người hỗ trợ nào thấy; Quản trị thấy với lọc `chua_co_cum` |
| T6 | Sửa hồ sơ thiếu/rỗng lý do | 400 |
| T7 | Gửi `so_dinh_danh_ca_nhan` khi sửa | 400 |
| T8 | Sửa ngày sinh ngoài đợt | Thành công, lịch sử có `ly_do` + `vai_tro_nguoi_sua` |
| T9 | Sửa khi có đợt mở và đã xác nhận | Xác nhận bị hủy |
| T10 | Sửa email | `email_da_xac_minh = false`; gửi link → 409 |
| T11 | Cấp mật khẩu tạm | Đăng nhập được bằng mật khẩu tạm, buộc đổi; có nhật ký |
| T12 | 2 người cùng trả lời 1 ticket (song song) | Đúng 1 thành công, 1 nhận 409; nội dung không bị ghi đè; 1 email |
| T13 | Quản trị trả lời ticket `da_phan_hoi` | 409 (hành vi mới) |
| T14 | Quản trị sửa câu trả lời (kể cả ticket đã đóng) | Email cập nhật, `danh_gia = NULL`, hạn tự đóng tính lại, nội dung cũ trong nhật ký |
| T15 | Học viên xem câu trả lời | Ký "Cụm hỗ trợ N", không có họ tên cán bộ |
| T16 | Xuất danh sách | Không có CCCD/ngày sinh/mã MOET; theo bộ lọc; có nhật ký |
| T17 | Tạo tài khoản hỗ trợ thiếu email / gắn `don_vi_id` | 400 / CHECK chặn |
| T18 | Phân công cho tài khoản vai trò khác hoặc cụm không thuộc khóa | 400 / 404 |
| T19 | Vai trò khác gọi `/ho-tro/*` | 403 |

## 6. Kiểm tra trước triển khai

```sql
-- Học viên của khóa đang triển khai chưa có cụm (ticket chỉ tới Quản trị)
SELECT k.ma_khoa, count(*) FROM dang_ky_hoc d JOIN khoa_boi_duong k ON k.id = d.khoa_id
WHERE d.cum_id IS NULL GROUP BY k.ma_khoa;
-- Cụm chưa có người hỗ trợ (sau Lát 1)
SELECT c.ten_cum FROM cum_hoc_vien c LEFT JOIN phan_cong_ho_tro p ON p.cum_id = c.id WHERE p.id IS NULL;
```

## 7. Ngoài phạm vi

Khóa mềm "đang trả lời"; email từng ticket / tóm tắt hằng ngày; hội thoại nhiều lượt; báo cáo thống kê cụm; người hỗ trợ giảng viên; đa vai trò.
