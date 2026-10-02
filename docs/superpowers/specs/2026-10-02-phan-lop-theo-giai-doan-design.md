# Phân lớp học viên theo giai đoạn — Thiết kế

- Ngày: 2026-10-02
- Trạng thái: chờ duyệt spec
- Phạm vi: backend (Prisma, import, khoa-boi-duong, bao-cao, thong-bao), frontend (M7, Admin chi tiết học viên, Admin chi tiết khóa, Nhập dữ liệu)

## 1. Bối cảnh và vấn đề

Một khóa bồi dưỡng có nhiều giai đoạn tùy thực tế, ví dụ khóa `2026-AG-NLS`:

| Thứ tự | Giai đoạn | Hình thức |
|---|---|---|
| 1 | Đánh giá đầu vào | Đánh giá |
| 2 | Học trực tuyến qua zoom | Trực tuyến |
| 3 | Học trực tuyến qua VLE | Trực tuyến |
| 4 | Học trực tiếp | Trực tiếp |
| 5 | Học trực tuyến qua VLE - lần 2 | Trực tuyến |
| 6 | Đánh giá đầu ra | Đánh giá |

Mô hình hiện tại gán học viên vào **tối đa 1 lớp mỗi loại** (`dang_ky_hoc_lop`, unique `(dang_ky_hoc_id, loai_lop)`); giai đoạn chỉ suy ra gián tiếp từ buổi học của lớp. Hệ quả:

- Không gán được học viên vào lớp khác nhau của cùng một loại ở các giai đoạn khác nhau (vd GĐ3 học Lớp VLE 3, GĐ5 học Lớp VLE 5).
- Giai đoạn đánh giá không có chỗ chứa thông tin cho học viên (thời gian, link làm bài).
- File import `phan_lop_hoc_vien` (cột `ten_lop`, `ten_lop_zoom`, `ten_lop_vle`) không diễn đạt được phân lớp theo giai đoạn.

## 2. Yêu cầu đã chốt

| # | Yêu cầu | Nguồn |
|---|---|---|
| R1 | Tùy khóa: học viên có thể giữ 1 lớp suốt khóa, hoặc đổi lớp/nhóm giữa các giai đoạn | Trả lời "C" |
| R2 | Giai đoạn đánh giá chỉ cần thông tin chung cho cả giai đoạn (khoảng thời gian + link/hướng dẫn), không chia ca | Trả lời "A" |
| R3 | File import: mỗi học viên 1 dòng, mỗi giai đoạn 1 cột | Trả lời "A" |
| R4 | Mô hình: mỗi (học viên, giai đoạn) → tối đa 1 lớp, thay thế `dang_ky_hoc_lop` | Chọn hướng 1 |
| R5 | Mỗi giai đoạn chỉ 1 lớp cho 1 học viên | Xác nhận phần 1 |
| R6 | Ô trống = giữ nguyên; `-` = gỡ; tên lớp = gán/thay | Xác nhận phần 2 |
| R7 | Không hỗ trợ song song file mẫu cũ | Xác nhận phần 2 |

Ngoài phạm vi: chia ca/phòng thi cho giai đoạn đánh giá; nhiều lớp cùng lúc trong 1 giai đoạn; hỗ trợ file mẫu cũ.

## 3. Mô hình dữ liệu

### 3.1 Bảng mới `phan_lop_giai_doan`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid PK | |
| `dang_ky_hoc_id` | uuid FK → `dang_ky_hoc` | `onDelete: Cascade` |
| `giai_doan_id` | uuid FK → `giai_doan_khoa` | `onDelete: Cascade` |
| `lop_id` | uuid FK → `lop_hoc` | `onDelete: NoAction` (như `dang_ky_hoc_lop`) |
| `created_at` | timestamptz | default now() |

- Unique `(dang_ky_hoc_id, giai_doan_id)` — R5.
- Index `lop_id`, `giai_doan_id`.
- Bất biến kiểm ở service (không biểu diễn được bằng FK): `lop.khoa_id = giai_doan.khoa_id = dang_ky_hoc.khoa_id`.

### 3.2 Thêm cột vào `giai_doan_khoa`

- `link_hoac_dia_diem` `varchar(500)` nullable.
- `huong_dan` `text` nullable.

Dùng cho mọi giai đoạn mà học viên không được gán lớp (điển hình: đánh giá đầu vào/đầu ra) — R2.

### 3.3 Trạng thái đăng ký

Gán lớp ở bất kỳ giai đoạn nào → đăng ký chuyển `da_phan_lop` (như khi gán lớp hiện nay). Gỡ lớp **không** tự đổi trạng thái đăng ký — giữ đúng hành vi hiện tại của `xoaLopDangKy`.

### 3.4 Chuyển dữ liệu cũ

Hai migration riêng (quy ước repo: tách bước thêm cấu trúc và bước dùng dữ liệu):

1. Tạo `phan_lop_giai_doan`, thêm 2 cột giai đoạn.
2. Script chuyển dữ liệu (chạy trong transaction): với mỗi `dang_ky_hoc_lop (dk, X)` → tạo 1 dòng `(dk, gd, X)` cho **mỗi giai đoạn `gd` mà lớp `X` có ≥ 1 buổi**.
   - Lớp không có buổi nào: không tạo dòng; xuất danh sách `(học viên, lớp)` ra log + CSV để gán tay. Không đoán giai đoạn.
   - Xung đột (2 lớp của cùng đăng ký cùng có buổi trong 1 giai đoạn): **dừng, rollback, báo danh sách** — không tự chọn.
   - Sao lưu `dang_ky_hoc_lop` ra JSON trước khi chạy.

Bảng `dang_ky_hoc_lop` **giữ nguyên** cho tới bước dọn dẹp (mục 7, bước 6).

## 4. Import `phan_lop_hoc_vien` (định dạng mới)

### 4.1 File mẫu sinh theo khóa

- `GET /import/mau-excel?loai=phan_lop_hoc_vien&ma_khoa=<ma>` — **bắt buộc** `ma_khoa` cho loại này (thiếu → 400).
- Cột: `so_dinh_danh_ca_nhan`, `ma_dinh_danh_moet`, rồi 1 cột cho mỗi giai đoạn `trang_thai = active` theo `thu_tu`, tiêu đề `GĐ<thu_tu> - <ten_giai_doan>`, cuối cùng `ten_cum`.
- Ghi chú ô tiêu đề mỗi cột giai đoạn: danh sách tên lớp có buổi trong giai đoạn đó (gợi ý), và quy ước ô trống/`-`.
- Không còn cột `ma_khoa` (1 file = 1 khóa).

### 4.2 Đọc file

- `POST /import/phan_lop_hoc_vien?ma_khoa=<ma>` — bắt buộc `ma_khoa`.
- Cột giai đoạn nhận diện bằng regex tiền tố `^GĐ\s*(\d+)` (không phân biệt hoa thường, chấp nhận `GD`); phần tên sau tiền tố bị bỏ qua → đổi tên giai đoạn không làm hỏng file cũ.
- Cột giai đoạn vắng mặt → giai đoạn đó không bị đụng tới.
- Lỗi **cả file** (`trang_thai = loi`):
  - Có cột `ten_lop` / `ten_lop_zoom` / `ten_lop_vle` → "File theo mẫu cũ, vui lòng tải mẫu mới" — R7.
  - Cột `GĐ<n>` mà khóa không có giai đoạn thứ tự `n`.
  - Hai cột trỏ cùng một `GĐ<n>`.
  - Cột lạ khác (giữ hành vi khớp cột hiện có).

### 4.3 Ngữ nghĩa ô (R6)

| Giá trị ô | Hành động |
|---|---|
| trống | giữ nguyên gán hiện có của giai đoạn |
| `-` | xóa dòng `phan_lop_giai_doan` của giai đoạn (nếu có) |
| tên lớp | upsert `(dk, gd) → lop` |

Dòng mà mọi cột giai đoạn trống (và `ten_cum` tùy ý): chỉ ghi danh — giữ hành vi hiện tại.

### 4.4 Lỗi dòng (chặn dòng)

- Không xác định được học viên (dùng chung `HocVienResolver`, giữ nguyên quy tắc ≥ 1 mã).
- Tên lớp không tồn tại trong khóa.
- Tên lớp tồn tại ở **nhiều loại lớp** trong khóa → yêu cầu đổi tên lớp cho khác nhau.
- Học viên xuất hiện ở 2 dòng trong cùng file.
- Các quy tắc ghi danh hiện có (trạng thái hồ sơ, …) giữ nguyên.

### 4.5 Cảnh báo (không chặn dòng)

- Lớp không có buổi nào trong giai đoạn được gán.
- Loại lớp không khớp hình thức giai đoạn — dùng lại `canhBaoBuoiHocGiaiDoan` (phần hình thức) hoặc tách hàm con dùng chung.
- Học viên chưa có email (giữ nguyên, đếm `so_hoc_vien_chua_co_email`).

### 4.6 Import `diem_danh`

Cột không đổi. Quy tắc học bù: so lớp của buổi điểm danh với lớp học viên được gán **ở giai đoạn của buổi đó** (`phan_lop_giai_doan` theo `(dk, buoi.giai_doan_id)`), thay vì lớp theo `loai_lop`. Chưa được gán lớp ở giai đoạn đó → coi như học bù (bắt buộc `ghi_chu`).

## 5. API và màn hình

### 5.1 `GET /hoc-vien/toi/khoa-hoc` (M7)

Thay 3 trường `lop_truc_tiep`, `lop_zoom`, `lop_vle` bằng:

```ts
giai_doan: {
  id; thu_tu; ten_giai_doan; hinh_thuc;
  thoi_gian_bat_dau; thoi_gian_ket_thuc;
  link_hoac_dia_diem; huong_dan;
  lop: { id; ten_lop; loai_lop; nhan_su[]; lich_hoc[] /* chỉ buổi thuộc giai đoạn này */ } | null;
  tien_do: { ty_le_hoan_thanh; diem } | null;
}[] // sắp theo thu_tu, chỉ giai đoạn active
```

Các trường khác (khóa, cụm, mức đầu vào/đầu ra) giữ nguyên. Backend + frontend deploy cùng lúc (SPA, không có client khác).

### 5.2 M7 "Thông tin lớp học"

Dòng thời gian theo giai đoạn: mỗi thẻ = tên giai đoạn, badge hình thức, khoảng ngày; có lớp → tên lớp, nhân sự (nhãn "Giảng viên"/"Hỗ trợ"), danh sách buổi; không có lớp → link/hướng dẫn của giai đoạn (ẩn nếu cả hai trống); có tiến độ → hiển thị. Cụm Zalo và kết quả đánh giá giữ nguyên vị trí.

### 5.3 Admin — chi tiết học viên

Thay 3 ô chọn lớp bằng bảng "Phân lớp theo giai đoạn": 1 dòng/giai đoạn, Select lớp của khóa (để trống = không gán).

- `PUT /dang-ky-hoc/{id}/giai-doan/{giai_doan_id}/lop` body `{ lop_id: string | null }` — `null` xóa gán.
- Quyền: như API gán lớp hiện tại (Trường chủ khóa + Quản trị).
- Cảnh báo tại chỗ khi lớp không có buổi trong giai đoạn.
- API gán theo loại cũ (`capNhatLopDangKy`) bị gỡ ở bước dọn dẹp.

### 5.4 Admin — chi tiết khóa

- Tab Giai đoạn: form tạo/sửa thêm "Link hoặc địa điểm", "Hướng dẫn" (DTO create/update giai đoạn thêm 2 field tùy chọn).
- Tab Lớp học: thêm cột "Sĩ số hiện tại" = số `dang_ky_hoc` khác nhau có dòng `phan_lop_giai_doan` trỏ tới lớp (trả kèm trong chi tiết khóa).
- Modal "Import Excel": thêm loại "Phân lớp học viên"; tải mẫu và tải lên đều gửi `ma_khoa`.

### 5.5 Nhập dữ liệu

Chọn loại "Phân lớp học viên" → hiện Select khóa (bắt buộc); tải mẫu và tải lên gửi `ma_khoa`.

### 5.6 Backend khác

- Báo cáo sĩ số/điểm danh theo lớp: đếm qua `phan_lop_giai_doan`, distinct theo `dang_ky_hoc_id`.
- Chặn đổi `loai_lop` khi lớp có học viên: đếm trên `phan_lop_giai_doan`.
- Email thông báo phân lớp (`thong-bao.service.ts`): liệt kê lớp theo giai đoạn. **Làm sau khi thay đổi đang dở của session khác ở `thong-bao` đã được commit.**

## 6. Kiểm thử (theo yêu cầu)

| Yêu cầu | Ca kiểm thử |
|---|---|
| Chuyển dữ liệu (3.4) | lớp có buổi ở 1 GĐ → 1 dòng; nhiều GĐ → nhiều dòng; không buổi → vào danh sách gán tay; xung đột → rollback + báo; M7 trước/sau chuyển cho cùng học viên giống nhau |
| Mẫu (4.1) | đúng cột theo GĐ active và thứ tự; thiếu `ma_khoa` → 400 |
| Đọc file (4.2) | nhận `GĐ2`, `GD2 - tên khác`; thiếu cột GĐ → giữ nguyên; cột `GĐ9` không tồn tại → lỗi file; mẫu cũ → lỗi file; 2 cột cùng GĐ → lỗi file |
| Ngữ nghĩa ô (4.3) | trống giữ nguyên; `-` gỡ (trạng thái đăng ký không đổi); tên khác thay; mọi ô trống → chỉ ghi danh; gán → `da_phan_lop` |
| Lỗi dòng (4.4) | lớp không tồn tại; tên trùng giữa loại; học viên lặp; học viên không tìm thấy |
| Cảnh báo (4.5) | lớp không có buổi trong GĐ; loại lớp lệch hình thức |
| Học bù (4.6) | điểm danh lớp khác lớp gán cùng GĐ → bắt buộc ghi chú; khớp → không; chưa gán ở GĐ → bắt buộc ghi chú |
| M7 (5.1–5.2) | buổi chỉ của đúng GĐ; GĐ không lớp hiện link/hướng dẫn; GĐ không lớp và không link → thẻ chỉ có tiêu đề |
| Admin (5.3–5.5) | PUT gán/thay/xóa; Trường khóa khác → 403; sĩ số hiện tại đúng; form GĐ lưu 2 field mới; Nhập dữ liệu bắt chọn khóa |
| Dữ liệu thật | chuyển 3 file Excel của khóa `2026-AG-NLS` sang mẫu mới, import, so màn hình học viên `08901059055` |

## 7. Thứ tự triển khai

Mỗi bước 1 commit, hệ thống chạy được sau mỗi bước:

1. Migration bảng mới + 2 cột giai đoạn + script chuyển dữ liệu (bảng cũ giữ nguyên).
2. Đường ghi: import `phan_lop_hoc_vien` mới, `PUT .../giai-doan/{id}/lop`, học bù trong `diem_danh` — chỉ ghi bảng mới.
3. Đường đọc: API M7, báo cáo, chặn đổi loại lớp, sĩ số lớp, DTO giai đoạn.
4. Frontend: M7, Admin chi tiết học viên, tab Giai đoạn, modal import, Nhập dữ liệu.
5. Email thông báo (sau khi `thong-bao` của session khác đã commit).
6. Dọn dẹp: grep xác nhận không còn tham chiếu `dang_ky_hoc_lop` → migration drop bảng (hỏi trước khi chạy trên DB); cập nhật `CONTEXT.md` (DangKyHocLop → PhanLopGiaiDoan, thêm link/hướng dẫn giai đoạn).

## 8. Rủi ro

- Phạm vi lớn (~6 service, 3 màn hình) — giảm bằng hai bảng song song tới bước 6.
- Xung đột với session đang sửa `thong-bao` — dời sang bước 5.
- File mẫu cũ trên máy người dùng bị từ chối — thông báo lỗi chỉ rõ cách tải mẫu mới.
- Tài liệu `docs/` đang lệch so với code (đã ghi trong `CONTEXT.md`) — chỉ cập nhật `CONTEXT.md` trong đợt này.
