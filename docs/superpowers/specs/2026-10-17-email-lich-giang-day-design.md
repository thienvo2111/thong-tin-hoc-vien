# Email lịch giảng dạy theo giai đoạn – khóa — đặc tả

- Ngày: 2026-10-17
- Quyết định: [ADR 0009](../../adr/0009-email-lich-giang-day-theo-giai-doan.md)
- Liên quan: ADR 0004 G10/G11 (nhắc lịch, cần nhắc lại), M9 (hàng đợi email), `design/mau-email/5a-*.html`, `5b-*.html` (mẫu đã duyệt)

## 1. Bối cảnh

- Nhắc giảng viên hiện là tin nhắn Zalo soạn sẵn cho mỗi (lớp × giai đoạn trực tiếp × giảng viên), cán bộ phải sao chép rồi bấm "Đã gửi" (`nhac-lich.service.ts`, `soanTinNhanGiangVien`).
- Mục tiêu: mỗi giảng viên nhận **một email chính thức** gồm toàn bộ lịch dạy của mình trong một giai đoạn của khóa, qua mọi lớp. Email chỉ gửi khi cán bộ bấm nút.
- Hạ tầng đã có: khung email `thong-bao/mau-email/bo-cuc.ts`, hàng đợi `hang_doi_email` + `HangDoiEmailProcessor` (cron mỗi phút, hạn mức/ngày), nhật ký `nhat_ky_nhac_lich`.

## 2. Quyết định (tóm tắt ADR 0009)

| # | Tóm tắt |
|---|---|
| E1 | Một email cho mỗi (khóa × giai đoạn × giảng viên), gom mọi buổi có phân công qua mọi lớp, nhóm theo lớp. |
| E2 | Chỉ `ho_tro_giang_vien` của khóa bấm gửi. Không cron. |
| E3 | Gửi qua làn hàng loạt `hang_doi_email`, sự kiện mới `nhac_lich_giang_vien`. |
| E4 | Mỗi email ghi 1 dòng `nhat_ky_nhac_lich` (+ `hang_doi_email_id`), dùng chung cờ nhắc và bảng kiểm. |
| E5 | Đã từng gửi thì dùng mẫu cập nhật 5b, có huy hiệu "Có thay đổi" và khối buổi bị gỡ. |
| E6 | Không có email thì bỏ qua và báo lại. Nút Cổng giảng viên chỉ hiện khi đã có tài khoản. |

## 3. Dữ liệu

Hai migration, đều chỉ thêm, **không đụng dữ liệu hiện có**:

1. `20261017xxxxxx_su_kien_nhac_lich_giang_vien`: `ALTER TYPE loai_su_kien_thong_bao ADD VALUE 'nhac_lich_giang_vien';` — để riêng vì Postgres không dùng được giá trị enum mới trong cùng transaction.
2. `20261017yyyyyy_nhac_lich_hang_doi_email`:
   ```sql
   ALTER TABLE nhat_ky_nhac_lich ADD COLUMN hang_doi_email_id uuid NULL
     REFERENCES hang_doi_email(id) ON DELETE SET NULL;
   CREATE INDEX idx_nhac_lich_hang_doi ON nhat_ky_nhac_lich(hang_doi_email_id);
   ```
   `NULL` = kênh tin nhắn (Zalo/SMS, như cũ); có giá trị = kênh email.

Prisma: thêm relation `hang_doi_email?` vào `nhat_ky_nhac_lich` (chiều ngược `nhac_lich nhat_ky_nhac_lich[]` vào `hang_doi_email`). Cập nhật `docs/database-ddl.sql`.

## 4. Gom dữ liệu một email (`EmailLichDayService.duLieu(khoaId, gdId, gvId)`)

- **Buổi**: `lich_hoc_lop` có `giai_doan_id = gdId`, `lop.khoa_id = khoaId`, `lop.trang_thai = active`, và có `phan_cong_giang_day` với `giang_vien_id = gvId`. Lấy kèm `lop (ten_lop, loai_lop)`, `diem_hoc (ten, dia_chi)`, `phong`, `dia_diem_hoac_link`, `cap_nhat_luc`, `phan_cong.vai_tro`. Gồm **mọi buổi** của giai đoạn, kể cả buổi đã qua (đây là lịch của cả giai đoạn).
- **Nhóm theo lớp**: thứ tự lớp theo buổi sớm nhất. Trong lớp, xếp theo `thoi_gian_bat_dau`, rồi `buoi_so`.
- **Hậu cần**: `hau_can_giang_vien (lop_id, gdId, gvId)` cho từng lớp — gồm chỗ ở (tên, địa chỉ, nhận/trả phòng) và đưa đón (phương tiện, giờ đón, điểm đón, liên hệ). Lớp không có hậu cần thì không có khối này.
- **Thực địa**: `nhan_su_thuc_dia (lop_id, gdId)`, hiện ở dòng "Hỗ trợ tại điểm học" trong khối hậu cần của lớp.
- **Nhóm hỗ trợ GV**: `phan_cong_ho_tro_gv` của khóa → `nguoi_dung (ho_ten, email)`.
- **Địa điểm buổi**: có `diem_hoc` → tên, địa chỉ, phòng, kèm link "Xem bản đồ" (`lienKetBanDo`). Không có thì xét `dia_diem_hoac_link`: là `http(s)` → link "Vào phòng Zoom" (lớp `zoom`) hoặc "Mở liên kết" (lớp khác); là chữ thường → hiện nguyên văn; rỗng → "Đang cập nhật".
- **Cổng giảng viên**: chỉ hiện nút khi `giang_vien.tai_khoan` tồn tại và `trang_thai = active`. Link = `layFrontendUrl() + '/giang-day'`.
- **Bản cập nhật (E5)**: `lanCuoi` = dòng `nhat_ky_nhac_lich` mới nhất có `giang_vien_id = gvId`, `hang_doi_email_id IS NOT NULL` và `lich_hoc_ids` chứa ≥1 buổi của **giai đoạn này** (kể cả buổi đã gỡ phân công — xét theo `lich_hoc_lop.giai_doan_id`).
  - Không có `lanCuoi` → mẫu 5a.
  - Có → mẫu 5b: khối cảnh báo "thay thế email gửi lúc HH:mm ngày dd/mm/yyyy". Buổi được gắn "Có thay đổi" khi `cap_nhat_luc > lanCuoi.gui_luc` hoặc id buổi không có trong `lanCuoi.lich_hoc_ids`.
  - Buổi có trong `lanCuoi.lich_hoc_ids`, vẫn tồn tại, thuộc giai đoạn này nhưng giảng viên **không còn phân công** → khối "Không còn trong lịch của Thầy/Cô: <lớp> – Buổi n (<thứ, ngày>)" ngay dưới khối cảnh báo. (Phần này mẫu 5b chưa vẽ.)
- **Tiêu đề**: 5a `[BDNLS] Lịch giảng dạy <tên giai đoạn> – khóa <mã khóa>`; 5b `[BDNLS] Cập nhật lịch giảng dạy <tên giai đoạn> – khóa <mã khóa>`.

Phần dựng HTML là **hàm thuần** `mauLichGiangDay(p)` trong `thong-bao/mau-email/mau-email.ts`, tái dùng `boCucEmail`, `bangThongTin`, `khoiNoiBat`, `huyHieu`, `nutBam`, `e`, `laLienKet`. Hàm trả về `{ tieuDe, html }`, kèm `tomTat` (text thuần: các dòng "Lớp – Buổi n: thứ ngày, giờ", dùng làm `nhat_ky_nhac_lich.noi_dung`).

## 5. API (`/ho-tro-giang-vien`, `@Roles('ho_tro_giang_vien')`)

Mọi endpoint đều gọi `scope.damBaoKhoaTrongPhamVi(user.id, khoaId)` trước, và kiểm `giai_doan.khoa_id = khoaId`. Sai thì trả `404`.

| Method | Path | Kết quả |
|---|---|---|
| GET | `khoa/:khoaId/giai-doan/:gdId/email-lich-day` | `{ giai_doan, giang_vien: [{ id, ho_ten, email, so_buoi, so_lop, trang_thai_nhac, email_cuoi: { gui_luc, trang_thai: 'cho_gui'\|'thanh_cong'\|'that_bai', loi } \| null }] }` — mọi giảng viên có ≥1 phân công trong giai đoạn. `trang_thai_nhac` gộp qua `gopTrangThaiNhac` trên mọi kênh (dùng lại `trangThaiNhac`). |
| GET | `khoa/:khoaId/giai-doan/:gdId/email-lich-day/:gvId/xem-truoc` | `{ tieu_de, html, la_cap_nhat, email }` — `404` nếu giảng viên không có buổi nào. Không ghi gì vào DB. |
| POST | `khoa/:khoaId/giai-doan/:gdId/email-lich-day/gui` body `{ giang_vien_ids: uuid[] }` (1–200, không trùng) | `{ da_xep_hang: number, bo_qua: [{ giang_vien_id, ho_ten, ly_do: 'khong_co_email' \| 'khong_co_buoi' }] }` |

**POST** — với mỗi giảng viên hợp lệ, trong **một transaction** cho mỗi người: dựng email, rồi `hang_doi_email.create` (`loai_su_kien = nhac_lich_giang_vien`, `hoc_vien_id = null`), rồi `nhat_ky_nhac_lich.create` (`hang_doi_email_id`, `lich_hoc_ids`, `noi_dung = tieuDe + '\n' + tomTat`, `nguoi_gui`). Không đi qua `themVaoHangDoiEmail` vì hàm đó nuốt lỗi; ở đây lỗi phải trả về để cán bộ biết. Giảng viên không thuộc phân công trong giai đoạn thì vào `bo_qua` (`khong_co_buoi`), không làm hỏng cả lô. Ghi `nhat_ky_hoat_dong` một dòng `ho_tro_gv_gui_email_lich_day` (chi_tiet: khóa, giai đoạn, số người). Hành động này cần thêm vào union kiểu và bảng nhãn trong `nhat-ky.service.ts`.

Hàng đợi tự giãn qua nhiều ngày nếu vượt `EMAIL_DAILY_LIMIT`, nên không chặn thêm ở đây.

## 6. Giao diện

- Trang mới **`/ho-tro-gv/gui-lich-day`** ("Gửi lịch dạy"), thêm vào menu `HoTroGvLayout`.
- Đầu trang có 2 ô chọn: **Khóa** (các khóa trong nhóm) và **Giai đoạn** (của khóa đó, mặc định giai đoạn đang/sắp diễn ra gần nhất). Ghi nhớ lựa chọn bằng query string.
- Bảng giảng viên gồm các cột: ô chọn · Họ tên · Email · Số buổi / số lớp · Trạng thái nhắc (huy hiệu Chưa nhắc / Cần nhắc lại / Đã nhắc, dùng chung nhãn hiện có) · Email gần nhất ("Đang chờ gửi" / "Đã gửi HH:mm dd/mm" / "Lỗi" kèm tooltip lỗi) · nút **Xem trước**.
- Mặc định tích những người **có email** và trạng thái ≠ `da_nhac`. Người không có email thì không tích được, kèm ghi chú "Chưa có email — cập nhật ở Danh mục giảng viên".
- **Xem trước**: modal hiển thị tiêu đề + `<iframe srcDoc sandbox>` chứa `html`.
- Nút chính **"Gửi email (N)"** (tắt khi N = 0) → modal xác nhận: "Gửi lịch giảng dạy <giai đoạn> cho N giảng viên? Email sẽ vào hàng đợi và gửi dần trong vài phút." → POST → toast "Đã xếp hàng N email" (+ "Bỏ qua M: …" nếu có), rồi tải lại bảng.
- Trang Hồ sơ chuẩn bị lớp hiện nhật ký nhắc của đợt. Dòng nào là email thì có nhãn "Email" (`hang_doi_email_id != null`).

## 7. Không làm (YAGNI)

- Không có cron hay hẹn giờ gửi. Không gửi bản sao cho nhóm hỗ trợ. Không đính kèm file (ICS/Excel).
- Quản trị không có nút ở v1.
- Không cho sửa câu chữ email trên giao diện.

## 8. Kiểm thử

**Mẫu email (`mau-email.spec.ts`, hàm thuần)**
- 5a: có tiêu đề, khóa, giai đoạn, tổng số buổi/lớp, từng lớp với buổi đúng thứ tự giờ, vai trò.
- Khối hậu cần/thực địa chỉ hiện khi có dữ liệu.
- Địa điểm: có `diem_hoc` (kèm link bản đồ) / link `https` lớp Zoom → "Vào phòng Zoom" / chữ thường → nguyên văn / `javascript:` → không tạo `href` / rỗng → "Đang cập nhật".
- Nút Cổng giảng viên: có tài khoản thì hiện, không có thì ẩn.
- 5b: có nhãn cập nhật, giờ lần gửi trước, huy hiệu đúng buổi đổi/buổi mới, khối buổi bị gỡ.
- Dữ liệu chứa `<script>` / `"` bị escape. `tomTat` là text thuần.

**Service (`email-lich-day.service.spec.ts`)**
- Gom buổi qua 2 lớp cùng giai đoạn. Không lấy buổi của giai đoạn khác, của khóa khác, của giảng viên khác, hay của lớp đã ngưng.
- Chọn 5a/5b theo `lanCuoi`. Nhật ký tin nhắn Zalo (`hang_doi_email_id` null) **không** làm email thành 5b.
- POST: mỗi người tạo đúng 1 `hang_doi_email` + 1 `nhat_ky_nhac_lich` có liên kết. Không email / không buổi → `bo_qua`, các người khác vẫn gửi. Nếu insert nhật ký lỗi thì không còn sót dòng hàng đợi (rollback).
- Phạm vi: khóa ngoài nhóm → 404; giai đoạn không thuộc khóa → 404. DTO: mảng rỗng, quá 200, id trùng, không phải uuid → 400.
- Sau POST: `trangThaiNhac` của các buổi = `da_nhac`; đổi giờ 1 buổi → `can_nhac_lai`; mục bảng kiểm `da_nhac_giang_vien` đạt.

**Frontend (`HoTroGvGuiLichDay.test.tsx`, MSW)**
- Mặc định tích đúng người. Người không có email thì ô chọn bị khóa. Số N trên nút đúng.
- Xem trước mở modal có iframe.
- Xác nhận → POST đúng `giang_vien_ids` → toast có số bỏ qua, bảng tải lại.
- Đổi giai đoạn → tải lại danh sách. Danh sách rỗng → thông báo "Giai đoạn này chưa phân công giảng viên".

## 9. Triển khai

- Hai migration chỉ thêm (enum value + cột nullable): không đổi hay xóa dòng nào. Vẫn backup `pg_dump` trước khi `migrate deploy` theo quy trình thường lệ.
- Cập nhật `docs/api-contract.md` (3 endpoint) và hướng dẫn hỗ trợ giảng viên (mục "Gửi lịch dạy qua email").
