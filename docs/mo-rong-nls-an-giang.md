# Mở rộng backend cho khóa Bồi dưỡng năng lực số — An Giang

> Tài liệu giao việc cho Claude Code. Đặt tại `docs/mo-rong-nls-an-giang.md`.
> Nguồn sự thật vẫn là `docs/database-ddl.sql`, `docs/api-contract.md`, `docs/validation-checklist.md` — **mỗi task phải cập nhật cả 3 file này** trong cùng commit với code, đúng quy ước hiện hành của repo.
> Ngày lập: 2026-09-28.

## 0. Bối cảnh vận hành

- 1 khóa, khoảng 9.000 lượt học viên (giáo viên An Giang), 180 lớp × ~50 HV.
- Trình tự: đánh giá đầu vào (06–11/10) → phân mức, phân lớp (12–15/10) → 3 nhóm HV gối đầu, mỗi nhóm học Zoom (nhiều buổi/lớp) rồi VLE → 9 đợt trực tiếp, mỗi đợt 3 ngày, ~20 lớp (13/11/2026–17/01/2027) → VLE lần 2 → đánh giá đầu ra → chứng nhận.
- Đơn vị tổ chức: Trường ĐHSP TP.HCM (HCMUE) — **không** thuộc cây đơn vị của An Giang.
- Học viên vào hệ thống qua import `ho_so_nhan_su_moet` (hồ sơ thiếu CCCD, email…). **Luồng xác nhận (chốt 2026-09-28):** Đợt 1 — học viên đăng nhập kiểm tra, sửa, bổ sung hồ sơ → hết đợt 1, dữ liệu chuyển Phòng CNTT tạo tài khoản VLE → Đợt 2 — ngay trước đánh giá đầu vào, học viên kiểm tra lại và xác nhận; **chỉ hồ sơ đầy đủ và đã xác nhận đợt 2 mới thấy link/tài khoản làm bài đánh giá**. Cổng học viên phải chạy trước khi mở đợt 1.
- **Điều chỉnh luồng giai đoạn 1 (2026-10-02, thay luồng đợt 1/đợt 2 ở trên cho An Giang):** chưa mở đăng nhập cho học viên. Học viên làm tuần tự 2 phiếu ngoài hệ thống — *Phiếu khảo sát kĩ năng số* rồi *Phiếu đánh giá năng lực số* — và kê khai/bổ sung thông tin ngay trong phiếu (link quản trị nhập ở `/admin/cau-hinh-khao-sat`, hiện ở trang chủ). Chưa chốt tách phiếu theo đối tượng GV/CBQL (cấu hình đã hỗ trợ nhiều link/phiếu). Sau khảo sát, Quản trị đổ dữ liệu bổ sung + kết quả đánh giá + phân lớp qua import; học viên đăng nhập **chỉ xem** (không mở Đợt xác nhận); điều chỉnh hồ sơ mở lại ở giai đoạn kết quả cuối. Luồng đợt 1/đợt 2 + T15 vẫn giữ nguyên trong code cho địa phương khác — chuyển chế độ ở `/admin/cau-hinh-khao-sat` (xem `docs/dac-ta-cong-hoc-vien.md` mục "Chế độ triển khai").
- Học liệu và học tập nằm trên VLE; lớp đồng bộ trên Zoom; hậu cần giảng viên (xe, khách sạn) và sổ giám sát hỗ trợ nằm trên Google Sheets — **ngoài phạm vi hệ thống**.

## 1. Quyết định thiết kế (đã chốt 2026-09-28)

| # | Quyết định | Thay đổi so với thiết kế hiện hành |
|---|---|---|
| QĐ1 | Ghi danh vào khóa không đòi hồ sơ đầy đủ. Điều kiện "hồ sơ đầy đủ (T9) + đã xác nhận đợt 2" áp dụng tại **cổng làm đánh giá đầu vào** (T15) và lại được kiểm tra khi **cấp chứng nhận** (T13). | Sửa rule #36d |
| QĐ2 | HCMUE là `don_vi_cong_tac` loại `khac`. **Quản trị** tạo khóa cho đơn vị này; khóa do Quản trị tạo được `da_duyet` ngay. Sở/Phòng VHXH/Trường được **xem khóa** qua danh sách "đơn vị theo dõi" gắn với khóa; dữ liệu cấp học viên vẫn lọc theo phạm vi hồ sơ như cũ. | Sửa rule #47, thêm bảng `khoa_don_vi_theo_doi` |
| QĐ3 | Một lớp có **nhiều buổi** trong cùng một giai đoạn (Zoom nhiều buổi; trực tiếp 3 ngày = 3 buổi). | Bỏ `uq_lich_hoc_lop_giai_doan`, thêm `buoi_so` |
| QĐ4 | Mô hình giai đoạn = **hình thức × nhóm**, ví dụ "Zoom – nhóm 1", "VLE – nhóm 2", "Trực tiếp – đợt 5". Mỗi lớp thuộc 1 nhóm, chỉ có lịch ở giai đoạn của nhóm mình. Không thêm thực thể "đợt". | Không đổi schema giai đoạn |
| QĐ5 | Chưa làm cổng đăng nhập cho giảng viên trong khóa này. Hệ thống lưu giảng viên + phân công để tổng hợp giờ dạy và xuất danh sách. | Không thêm vai trò mới |
| QĐ7 | Học viên **tự sửa được cả các trường lấy từ MOET** (họ tên, ngày sinh, đơn vị, chức vụ, SĐT, chuyên môn) trong thời gian đợt xác nhận đang mở — trừ `ma_dinh_danh_moet` (là tên đăng nhập). Mọi thay đổi ghi vào `lich_su_thay_doi_ho_so`; thay đổi trường gốc MOET được đánh dấu để N1 rà soát. Sửa sau khi đã xác nhận → xác nhận của đợt đó bị hủy, phải xác nhận lại. Ngoài thời gian đợt mở, chỉ Quản trị sửa được. | Sửa rule #27 cho `import_moet` |
| QĐ8 | Cổng làm đánh giá theo **cách B**: Phòng CNTT tạo tài khoản VLE cho tất cả; hệ thống chỉ hiện link + tài khoản VLE cho học viên đủ điều kiện. | Thêm T15 |
| QĐ9 | Không hoàn thiện hồ sơ trước khi đóng đợt 2 → **không được làm đánh giá**, đưa vào danh sách xử lý riêng. | Thêm T15 |
| QĐ6 | File nguồn không có email/CCCD (đã xác nhận) → ban đầu **không học viên nào có email**. Không gửi email và **không ghi nhật ký thất bại** cho người chưa có email; kết quả import/gửi trả số người bị bỏ qua. Kênh thông báo giai đoạn đầu: Zalo qua lớp trưởng + đơn vị. | Sửa hành vi Dịch vụ Thông báo |
| QĐ10 | Tách 3 loại "lớp" **độc lập hoàn toàn** với nhau (trực tiếp/zoom/vle — không phải lớp cha chứa lớp con): 1 học viên có thể đồng thời ở 1 lớp trực tiếp, 1 lớp zoom, 1 "lớp" vle mà không liên quan gì nhau về thành viên, gán qua **1 bảng nối** `dang_ky_hoc_lop` (dễ mở rộng loại lớp thứ 4/5 sau này mà không sửa lại schema/API) thay vì thêm 3-4 cột FK riêng trên `dang_ky_hoc`. Thêm **cụm học viên** (`cum_hoc_vien`, nhóm Zalo hỗ trợ theo địa lý) — khái niệm mới, độc lập với cây đơn vị công tác, chứa **học viên trực tiếp** (`dang_ky_hoc.cum_id`), không qua lớp nào. | Xóa `dang_ky_hoc.lop_id`, thêm enum `loai_lop_hoc`, bảng `dang_ky_hoc_lop`/`cum_hoc_vien`, đổi UNIQUE `lop_hoc` |

## 2. Quy tắc chung cho mọi task

1. Mỗi task = 1 hoặc nhiều Prisma migration riêng. **`ALTER TYPE ... ADD VALUE` đặt trong migration riêng**, trước migration dùng giá trị mới (Postgres không cho dùng giá trị enum vừa thêm trong cùng transaction).
2. Mọi import mới đi theo luồng import hiện có: upload → preview (`dang_xu_ly` → `hoan_thanh`) → `POST /import/{id}/xac-nhan`; báo lỗi theo dòng; file mẫu qua `GET /import/mau-excel?loai=`.
3. **Bộ giải định danh học viên dùng chung** (`HocVienResolver`) cho mọi import có cột học viên: nhận `so_dinh_danh_ca_nhan` và/hoặc `ma_dinh_danh_moet`; phải có ít nhất 1; nếu có cả 2 thì phải trỏ cùng một hồ sơ, không thì là dòng lỗi.
4. Thời gian trong file import nhập theo giờ Việt Nam (`dd/mm/yyyy hh:mm`), lưu UTC.
5. Chuẩn hóa NFC cho mọi cột tên mới (`ten`, `ho_ten`, `dia_chi`…), như quy ước hiện hành.
6. Giữ nguyên 248 test hiện có; mỗi task thêm unit + e2e cho mọi tiêu chí nghiệm thu bên dưới.

## 3. Danh sách task theo mức ưu tiên

| Mức | Hạn | Task |
|---|---|---|
| **P0** | **Ngày mở đợt 1 (mục tiêu 01/10)** | T1 Bảo mật đăng nhập · T4 Import MOET · T9 Hồ sơ đầy đủ · T14 phần lõi (đợt xác nhận, sửa hồ sơ có lịch sử, xác nhận, báo cáo tiến độ xác nhận) |
| **P0b** | **04/10** (hết đợt 1) | T14 phần còn lại (báo cáo sửa trường MOET, xuất file cho Phòng CNTT) · T15 Cổng điều kiện làm đánh giá |
| P1 | 12–16/10 | T2 HCMUE tổ chức khóa · T3 Ghi danh/phân lớp bằng mã MOET · T5 Phân mức · T6 Lớp, lịch nhiều buổi · T7 Báo cáo vận hành |
| P2 | 30/10 | T8 Thông báo hàng loạt |
| P3 | 06/11 | T10 Điểm học · T11 Giảng viên & phân công · T12 Điểm danh & kết quả giai đoạn |
| P4 | 15/01 | T13 Chứng nhận & tra cứu công khai |

**Rút gọn để kịp P0 (quyết định 28/09):** đợt xác nhận **không gắn khóa** (`dot_xac_nhan.khoa_id` cho phép NULL = áp dụng mọi hồ sơ `import_moet`), nên P0 không cần tạo khóa/ghi danh. Thao tác quản trị trong P0 (import, tạo đợt, xuất báo cáo) chạy qua **Swagger UI** (`@nestjs/swagger`, chỉ mở ở mạng nội bộ hoặc sau Basic Auth của reverse proxy) — chưa làm giao diện quản trị.

Ngoài code, trước ngày mở đợt 1 phải có: máy chủ, HTTPS, **SMTP thật** (email bản sao dữ liệu sau khi xác nhận), backup đã thử khôi phục.

---|---|---|
| P0 | 05/10 | T1 Bảo mật đăng nhập · T2 HCMUE tổ chức khóa · T3 Ghi danh/phân lớp bằng mã MOET · T4 Import MOET chịu định dạng file thực tế |
| P1 | 16/10 | T5 Phân mức · T6 Lớp, lịch nhiều buổi, import hàng loạt · T7 Báo cáo vận hành |
| P2 | 30/10 | T8 Thông báo hàng loạt · T9 Mức độ đầy đủ hồ sơ |
| P3 | 06/11 | T10 Điểm học · T11 Giảng viên & phân công · T12 Điểm danh & kết quả giai đoạn |
| P4 | 15/01 | T13 Chứng nhận & tra cứu công khai |

---

## T1 — Bảo mật đăng nhập (P0)

> Bổ sung: thêm `nguoi_dung.dang_nhap_lan_cuoi timestamptz`, cập nhật mỗi lần đăng nhập thành công (dùng cho báo cáo "chưa đăng nhập" ở T14).

**Lý do:** mật khẩu mặc định = ngày sinh (dễ đoán), hệ thống chứa CCCD của ~9.000 người.

```sql
ALTER TABLE nguoi_dung
    ADD COLUMN so_lan_dang_nhap_sai smallint NOT NULL DEFAULT 0,
    ADD COLUMN khoa_den timestamptz;
```

**Hành vi**
- Sai mật khẩu 5 lần liên tiếp → `khoa_den = now() + 15 phút`; đăng nhập đúng → reset bộ đếm.
- Trong thời gian khóa, `POST /auth/dang-nhap` trả **423** với mã lỗi mới `ACCOUNT_LOCKED` (kèm thời điểm mở khóa), **không** kiểm tra mật khẩu.
- `POST /auth/doi-mat-khau`: mật khẩu mới ≥ 8 ký tự, có cả chữ và số, **khác** chuỗi ngày sinh `ddmmyyyy`, khác mật khẩu cũ → nếu vi phạm trả `VALIDATION_ERROR` có `fields`.
- Giới hạn tần suất theo IP cho `POST /auth/dang-nhap` và `GET /hoc-vien/kiem-tra-trung` (gợi ý `@nestjs/throttler`: 10 request/phút/IP). Cấu hình `trust proxy` để lấy đúng IP sau reverse proxy.
- Không tiết lộ tài khoản có tồn tại hay không: sai tên đăng nhập và sai mật khẩu trả cùng một thông báo.
- **Đặt lại mật khẩu (P0 — chưa có trong API hiện hành):** `POST /nguoi-dung/{id}/dat-lai-mat-khau` (`quan_tri`) → mật khẩu về ngày sinh `ddmmyyyy` của hồ sơ, `phai_doi_mat_khau=true`, xóa `khoa_den` và bộ đếm sai; ghi nhật ký (ai đặt lại, lúc nào). `GET /nguoi-dung?q=` (`quan_tri`) tìm theo mã định danh/họ tên/SĐT để N4 tra tài khoản khi học viên gọi hỗ trợ. Quy trình vận hành: N4 xác minh người gọi (họ tên + ngày sinh + đơn vị + SĐT khớp hồ sơ) trước khi yêu cầu đặt lại.

**Nghiệm thu**
- 5 lần sai → lần 6 trả 423 dù mật khẩu đúng; sau 15 phút đăng nhập được.
- Đặt lại mật khẩu → đăng nhập được bằng ngày sinh, bị buộc đổi mật khẩu; tài khoản đang bị khóa được mở ngay.
- Request thứ 11 trong 1 phút từ cùng IP trả 429.

---

## T2 — HCMUE là đơn vị tổ chức khóa — QĐ2

> **(P1, trước 12/10) — tách 2 phần:** T2a = Quản trị tạo khóa cho đơn vị `khac` + tự duyệt + quyền chủ khóa cho Quản trị. T2b = bảng `khoa_don_vi_theo_doi` và phạm vi xem cho Sở/Phòng/Trường.

```sql
CREATE TABLE khoa_don_vi_theo_doi (
    khoa_id     uuid NOT NULL REFERENCES khoa_boi_duong(id) ON DELETE CASCADE,
    don_vi_id   uuid NOT NULL REFERENCES don_vi_cong_tac(id),
    PRIMARY KEY (khoa_id, don_vi_id)
);
CREATE INDEX idx_khoa_theo_doi_don_vi ON khoa_don_vi_theo_doi(don_vi_id);
```

**API**
- `POST /khoa-boi-duong`: cho phép thêm vai trò `quan_tri`. Khi `quan_tri` gọi, body bắt buộc có `don_vi_to_chuc_id` (đơn vị `active`, loại `khac` hoặc `truong`). Khóa tạo với `trang_thai='da_duyet'`, `nguoi_duyet_id` = người gọi, `cap_duyet_thuc_te='quan_tri'`, `ngay_duyet=now()`, `created_by` = người gọi.
- Mọi endpoint "chủ khóa" (sửa khóa, thêm giai đoạn/lớp/lịch/nhân sự, nhập kết quả) chấp nhận thêm `quan_tri`.
- `POST /khoa-boi-duong/{id}/don-vi-theo-doi` `{ don_vi_id }` và `DELETE /khoa-boi-duong/{id}/don-vi-theo-doi/{don_vi_id}` — chỉ `quan_tri`.
- **Phạm vi xem khóa** (bổ sung vào `ScopeService`): người dùng `so_gddt`/`phong_vhxh`/`truong` xem được khóa (metadata, giai đoạn, lớp, lịch) nếu đơn vị của họ **là hoặc nằm dưới** một đơn vị trong `khoa_don_vi_theo_doi`. Dữ liệu cấp học viên (`dang_ky_hoc`, kết quả, báo cáo) vẫn chỉ gồm học viên trong phạm vi hồ sơ của họ.
- Đơn vị loại `khac` không xuất hiện trong danh sách chọn đơn vị công tác của học viên (rule #18 đã chặn — thêm test xác nhận).

**Checklist:** sửa #47 → "Trường tạo khóa cho đơn vị mình; Quản trị tạo khóa cho bất kỳ đơn vị `khac`/`truong`. Khóa do Quản trị tạo được duyệt ngay."

**Nghiệm thu**
- Quản trị tạo khóa cho HCMUE → `da_duyet`; thêm Sở An Giang vào theo dõi → tài khoản Sở và tài khoản Phòng VHXH dưới Sở thấy khóa; tài khoản Sở tỉnh khác không thấy (403/không có trong danh sách).
- Phòng VHXH xã A chỉ thấy `dang_ky_hoc` của học viên trường thuộc xã A.

---

## T3 — Ghi danh/phân lớp bằng mã MOET; sửa rule #36d (P1, trước 12/10) — QĐ1, QĐ6

```sql
ALTER TABLE lop_hoc ADD CONSTRAINT uq_lop_ten_trong_khoa UNIQUE (khoa_id, ten_lop);
-- Kiểm tra trùng tên lớp trong cùng khóa trước khi chạy migration.
```

**Import `phan_lop_hoc_vien`** — cột mới: `so_dinh_danh_ca_nhan` (tùy chọn), `ma_dinh_danh_moet` (tùy chọn), `ma_khoa`, `ten_lop` (tùy chọn). Dùng `HocVienResolver` (mục 2.3). Giữ nguyên hành vi upsert và 2 nhánh (chỉ ghi danh / ghi danh + phân lớp).

**Bỏ chặn "hồ sơ chưa đầy đủ" khi ghi danh/phân lớp** . Kiểm tra đầy đủ chuyển sang cổng đánh giá (T15) và cấp chứng nhận (T13).

**Thông báo `dang_ky_hoc_phan_lop`:** học viên không có `email_lien_he` → bỏ qua, không ghi `nhat_ky_thong_bao`. Kết quả import (`GET /import/{id}`) trả thêm `so_hoc_vien_chua_co_email`.

**Checklist:** sửa #36d → "Hồ sơ `import_moet` chưa đầy đủ vẫn được ghi danh. Hồ sơ phải đầy đủ (T9) và đã xác nhận ở đợt `xac_nhan_truoc_danh_gia` (T14) mới được làm đánh giá đầu vào (T15); điều kiện đầy đủ được kiểm tra lại khi cấp chứng nhận (T13)." Sửa #45 theo cột mới.

**Nghiệm thu**
- File chỉ có `ma_dinh_danh_moet` → ghi danh thành công cho hồ sơ `import_moet` có CCCD `NULL`.
- Dòng có cả 2 mã trỏ 2 hồ sơ khác nhau → dòng lỗi có lý do rõ ràng.
- Phân lớp 100 học viên, trong đó 60 người không có email → 40 email gửi, 0 dòng `that_bai`, `so_hoc_vien_chua_co_email=60`.

---

## T4 — Import MOET chịu được định dạng file thực tế (P0)

**Bối cảnh (xác nhận 2026-09-28):** file học viên thực tế đúng bộ cột của mẫu MOET (`STT`, `Đơn vị`, `Mã định danh (CDSL moet)`, `Họ và tên`, `Ngày`/`Tháng`/`Năm`, `Chức vụ`, `Chuyên môn`, `Số điện thoại`, `Ghi chú`) — **không có CCCD, không có email**. File có vài dòng tiêu đề phía trên và tiêu đề 2 tầng ("Ngày tháng năm sinh" gộp ô trên 3 cột con).

**Parser `ho_so_nhan_su_moet`**
- Tự dò dòng tiêu đề: bỏ qua các dòng phía trên dòng chứa đồng thời "Đơn vị" và "Mã định danh"; nhận tiêu đề 2 tầng (lấy tên cột con `Ngày`, `Tháng`, `Năm` ở dòng dưới ô gộp). Khớp tên cột không phân biệt hoa thường, bỏ khoảng trắng thừa, bỏ phần trong ngoặc.
- Ô số bị Excel lưu dạng number: chuyển về chuỗi không có `.0`, không ký hiệu khoa học (mã MOET `9115131060`).
- Số điện thoại mất số 0 đầu (9 chữ số, bắt đầu 3/5/7/8/9) → tự thêm `0` và ghi **cảnh báo 🟡** vào preview; các trường hợp sai khác vẫn là lỗi theo rule #20.
- Ngày/tháng dạng `08` hoặc `8` đều hợp lệ.
- Cột tùy chọn mới **`Mã đơn vị`**: nếu có giá trị thì khớp `don_vi_cong_tac.ma_don_vi` (ưu tiên hơn tên); nếu trống thì khớp tên như rule #36e. Lý do: sau sáp nhập An Giang – Kiên Giang, tên trường dễ trùng giữa 2 tỉnh cũ (ví dụ cùng mang địa danh "Châu Thành") → khớp theo tên sẽ ra nhiều kết quả và thành dòng lỗi.

**Không làm:** không thêm cột Email/CCCD vào luồng import (file nguồn không có). Học viên bổ sung sau qua cổng học viên (T9).

**Nghiệm thu:** import nguyên file mẫu thực tế (có dòng tiêu đề trên cùng, tiêu đề gộp ô, SĐT/mã MOET lưu dạng number) → không lỗi định dạng; 2 trường trùng tên + có `Mã đơn vị` → khớp đúng; trùng tên + không có `Mã đơn vị` → dòng lỗi nêu rõ các đơn vị trùng.

---

## T14 — Đợt xác nhận & lịch sử thay đổi hồ sơ (P0) — QĐ7

```sql
-- migration A
CREATE TYPE loai_dot_xac_nhan AS ENUM ('kiem_tra_bo_sung', 'xac_nhan_truoc_danh_gia');
-- migration B
CREATE TABLE dot_xac_nhan (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    khoa_id         uuid REFERENCES khoa_boi_duong(id),   -- NULL = áp dụng mọi hồ sơ import_moet (P0); gắn khóa về sau nếu cần
    ten             varchar(255) NOT NULL,
    loai            loai_dot_xac_nhan NOT NULL,
    mo_luc          timestamptz NOT NULL,
    dong_luc        timestamptz NOT NULL,
    created_by      uuid REFERENCES nguoi_dung(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_dot_xac_nhan_thoi_gian CHECK (dong_luc > mo_luc)
);
CREATE TABLE xac_nhan_ho_so (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dot_id              uuid NOT NULL REFERENCES dot_xac_nhan(id) ON DELETE CASCADE,
    hoc_vien_id         uuid NOT NULL REFERENCES hoc_vien(id),
    xac_nhan_luc        timestamptz NOT NULL DEFAULT now(),
    du_lieu             jsonb NOT NULL,          -- bản chụp hồ sơ tại thời điểm xác nhận
    con_hieu_luc        boolean NOT NULL DEFAULT true,
    vo_hieu_luc_luc     timestamptz,
    CONSTRAINT chk_xac_nhan_hieu_luc CHECK (con_hieu_luc OR vo_hieu_luc_luc IS NOT NULL)
);
CREATE UNIQUE INDEX uq_xac_nhan_con_hieu_luc ON xac_nhan_ho_so(dot_id, hoc_vien_id) WHERE con_hieu_luc;
CREATE TABLE lich_su_thay_doi_ho_so (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hoc_vien_id         uuid NOT NULL REFERENCES hoc_vien(id),
    truong              varchar(64) NOT NULL,
    gia_tri_cu          text,
    gia_tri_moi         text,
    la_truong_goc_moet  boolean NOT NULL DEFAULT false,
    nguoi_sua_id        uuid NOT NULL REFERENCES nguoi_dung(id),
    vai_tro_nguoi_sua   vai_tro_nguoi_dung NOT NULL,
    dot_id              uuid REFERENCES dot_xac_nhan(id),
    sua_luc             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lich_su_hv ON lich_su_thay_doi_ho_so(hoc_vien_id);
CREATE INDEX idx_lich_su_goc_moet ON lich_su_thay_doi_ho_so(la_truong_goc_moet) WHERE la_truong_goc_moet;
```

**Quy tắc** (thay rule #27, #28 cho hồ sơ `import_moet`)
- "Đợt đang mở" của học viên = đợt có `mo_luc <= now() < dong_luc` và (`khoa_id IS NULL` hoặc học viên đã ghi danh khóa đó). Các đợt không được chồng thời gian trong cùng phạm vi (🔴, API).
- `PATCH /hoc-vien/toi`, `POST/DELETE /hoc-vien/toi/chuyen-mon`: với `import_moet`, **chỉ cho phép khi có đợt đang mở**, bất kể `trang_thai`. Sửa được mọi trường khai báo, kể cả `ho_ten`, ngày sinh, `don_vi_cong_tac_id`, `chuc_vu`, `so_dien_thoai_lien_he`; **không** sửa `ma_dinh_danh_moet`, `nguon_tao`, trạng thái. Validate đầy đủ như luồng `tu_dang_ky`.
- Mỗi trường thay đổi → 1 dòng `lich_su_thay_doi_ho_so` (cùng transaction). `la_truong_goc_moet=true` cho: `ho_ten`, `ngay_sinh`, `thang_sinh`, `nam_sinh`, `don_vi_cong_tac_id`, `chuc_vu`, `so_dien_thoai_lien_he`, chuyên môn. Giá trị CCCD trong lịch sử chỉ Quản trị xem được.
- Nếu học viên đã có xác nhận còn hiệu lực ở đợt đang mở mà sửa tiếp → xác nhận đó `con_hieu_luc=false`; response trả `xac_nhan_bi_huy: true`.
- Đổi ngày sinh **không** đổi mật khẩu (mật khẩu đã đổi ở lần đăng nhập đầu, rule #35).
- `POST /hoc-vien/toi/xac-nhan` với `import_moet`: bắt buộc có đợt đang mở và `day_du=true` (T9), nếu không trả 400 kèm danh sách thiếu; tạo `xac_nhan_ho_so` có bản chụp; gửi email bản sao (sự kiện `hoc_vien_xac_nhan` như cũ).
- Ngoài thời gian đợt: học viên chỉ xem. Quản trị sửa qua endpoint mới `PATCH /hoc-vien/{id}` (ghi lịch sử với `vai_tro_nguoi_sua='quan_tri'`).

**API mới**
- `POST /dot-xac-nhan`, `PATCH /dot-xac-nhan/{id}` (gia hạn `dong_luc`), `GET /dot-xac-nhan?khoa_id=` — `quan_tri`.
- `GET /hoc-vien/toi/dot-xac-nhan` → đợt đang mở/sắp mở, `da_xac_nhan`, `day_du`, `thieu[]`.
- `GET /bao-cao/xac-nhan?dot_id=&trang_thai=chua_dang_nhap|dang_bo_sung|da_xac_nhan&don_vi_cong_tac_id=` + xuất Excel — theo phạm vi (Trường/Phòng/Sở đôn đốc giáo viên của mình). `chua_dang_nhap` dựa trên `dang_nhap_lan_cuoi` (T1).
- `GET /bao-cao/sua-truong-moet?khoa_id=` + xuất Excel — `quan_tri`: danh sách thay đổi trường gốc MOET để N1 rà soát.
- `GET /bao-cao/xuat-cho-vle?khoa_id=` — `quan_tri`: mã MOET, họ tên, email (nếu có), đơn vị, trạng thái đợt 1 — file chuyển Phòng CNTT tạo tài khoản VLE.

**Nghiệm thu**
- Ngoài thời gian đợt → `PATCH /hoc-vien/toi` trả 403 với mã `DOT_XAC_NHAN_DONG`.
- Sửa họ tên → 1 dòng lịch sử `la_truong_goc_moet=true`; sửa sau khi xác nhận → xác nhận cũ hết hiệu lực, `GET /hoc-vien/toi/dot-xac-nhan` trả `da_xac_nhan=false`.
- Xác nhận khi thiếu email → 400 liệt kê `email_lien_he`.
- Tài khoản Trường chỉ thấy báo cáo xác nhận của giáo viên trường mình.

---

## T15 — Cổng điều kiện làm đánh giá đầu vào & tài khoản VLE (P0b) — QĐ8, QĐ9

```sql
-- migration A
ALTER TYPE loai_danh_muc_import ADD VALUE 'tai_khoan_vle';
-- migration B
CREATE TABLE tai_khoan_vle (
    hoc_vien_id             uuid PRIMARY KEY REFERENCES hoc_vien(id),
    ten_dang_nhap_vle       varchar(100) NOT NULL,
    mat_khau_tam_ma_hoa     bytea,          -- AES-256-GCM ở tầng ứng dụng, khóa trong env VLE_SECRET_KEY
    duong_dan               varchar(500) NOT NULL,
    lan_dau_xem_luc         timestamptz,
    nguon_import_id         uuid REFERENCES nhat_ky_import(id),
    cap_nhat_luc            timestamptz NOT NULL DEFAULT now()
);
```

- Import `tai_khoan_vle` (file Phòng CNTT trả về): mã học viên (resolver), `ten_dang_nhap_vle`, `mat_khau_tam` (tùy chọn), `duong_dan`. Mật khẩu mã hóa trước khi lưu; **không bao giờ** trả mật khẩu trong API quản trị hay file lỗi import.
- `GET /hoc-vien/toi/danh-gia-dau-vao` →
  - Đủ điều kiện (có xác nhận **còn hiệu lực** ở đợt `xac_nhan_truoc_danh_gia` áp dụng cho học viên **và** `day_du=true` tại thời điểm gọi): `{ du_dieu_kien: true, duong_dan, ten_dang_nhap_vle, mat_khau_tam }`; ghi `lan_dau_xem_luc` nếu đang NULL.
  - Chưa đủ: `{ du_dieu_kien: false, ly_do: [...], dot: {...} }` — không trả bất kỳ thông tin VLE nào.
  - Đợt đã đóng mà chưa đủ: `{ du_dieu_kien: false, het_han: true }` (QĐ9).
- `GET /bao-cao/dieu-kien-danh-gia?khoa_id=` + xuất Excel — `quan_tri`: đủ điều kiện / không đủ (kèm lý do) / đã xem thông tin VLE. Danh sách "không đủ" sau khi đóng đợt 2 là đầu vào xử lý riêng (QĐ9).
- T5 (import `ket_qua_danh_gia`): học viên có kết quả nhưng **không** đủ điều kiện → cảnh báo 🟡 trong preview (phát hiện trường hợp lách cổng — cách B là chặn "mềm", tài khoản VLE vẫn tồn tại cho tất cả).

**Nghiệm thu:** hồ sơ đủ nhưng chưa xác nhận đợt 2 → không có thông tin VLE; xác nhận xong → có; sửa hồ sơ sau đó → mất quyền xem cho tới khi xác nhận lại; DB không chứa mật khẩu dạng rõ.

---

## T5 — Phân mức đầu vào/đầu ra (P1)

```sql
-- migration A
CREATE TYPE muc_nang_luc AS ENUM ('co_ban', 'thanh_thao', 'nang_cao');
ALTER TYPE loai_danh_muc_import ADD VALUE 'ket_qua_danh_gia';
-- migration B
ALTER TABLE dang_ky_hoc
    ADD COLUMN muc_dau_vao muc_nang_luc,
    ADD COLUMN muc_dau_ra  muc_nang_luc;
```

**Import `ket_qua_danh_gia`** — cột: `so_dinh_danh_ca_nhan`/`ma_dinh_danh_moet`, `ma_khoa`, `loai` (`dau_vao` | `dau_ra`), `muc`. Dòng lỗi nếu học viên chưa được ghi danh vào khóa (phải chạy ghi danh T3 trước). Upsert: chạy lại ghi đè.

**API:** `GET /hoc-vien/toi/khoa-hoc` trả thêm `muc_dau_vao`, `muc_dau_ra`.

**Trình tự vận hành:** import MOET → ghi danh (không `ten_lop`) → import `ket_qua_danh_gia` → tạo lớp (T6) → phân lớp.

**Nghiệm thu:** import mức cho học viên chưa ghi danh → dòng lỗi; chạy lại cùng file đổi mức → giá trị mới.

---

## T6 — Thuộc tính lớp, lịch nhiều buổi, tạo hàng loạt (P1) — QĐ3, QĐ4

```sql
-- migration A
ALTER TYPE loai_danh_muc_import ADD VALUE 'lop_va_lich_hoc';
-- migration B
ALTER TABLE lop_hoc
    ADD COLUMN nhom_hoc_vien smallint CHECK (nhom_hoc_vien BETWEEN 1 AND 20),
    ADD COLUMN muc_nang_luc  muc_nang_luc;

ALTER TABLE lich_hoc_lop DROP CONSTRAINT uq_lich_hoc_lop_giai_doan;
ALTER TABLE lich_hoc_lop
    ADD COLUMN buoi_so smallint NOT NULL DEFAULT 1 CHECK (buoi_so >= 1),
    ADD CONSTRAINT uq_lich_hoc_lop_giai_doan_buoi UNIQUE (lop_id, giai_doan_id, buoi_so);
```

**Import `lop_va_lich_hoc`** — mỗi dòng = 1 buổi: `ma_khoa`, `ten_lop`, `nhom_hoc_vien`, `muc_nang_luc`, `si_so_toi_da`, `giai_doan_thu_tu`, `buoi_so`, `bat_dau`, `ket_thuc`, `dia_diem_hoac_link`, `ma_diem_hoc` (tùy chọn, dùng khi có T10). Upsert lớp theo `(khoa_id, ten_lop)`, lịch theo `(lop_id, giai_doan_id, buoi_so)`. Áp dụng rule #49, #50.

**API**
- `POST /lop/{id}/lich-hoc` nhận thêm `buoi_so`.
- `GET /hoc-vien/toi/khoa-hoc` trả danh sách buổi của lớp (sắp theo thời gian): giai đoạn, buổi, thời gian, địa điểm/link.

**Cảnh báo 🟡 khi phân lớp (T3):** `lop_hoc.muc_nang_luc` khác `dang_ky_hoc.muc_dau_vao` → cảnh báo trong preview, không chặn.

**Nghiệm thu:** 1 file tạo 180 lớp × nhiều buổi; chạy lại file sửa giờ 1 buổi → chỉ buổi đó đổi; 2 dòng cùng `(lớp, giai đoạn, buổi)` trong 1 file → dòng lỗi.

---

## T7 — Báo cáo vận hành (P1)

`GET /bao-cao/van-hanh?khoa_id=&nhom_hoc_vien=&lop_id=` và `GET /bao-cao/van-hanh/xuat-excel` (cùng query). Phạm vi theo T2.

Mỗi dòng = 1 lớp: `ten_lop`, `nhom_hoc_vien`, `muc_nang_luc`, `si_so`, `so_co_email`, `so_ho_so_day_du` (T9), phân bố `muc_dau_vao`, và (khi có T12) `ty_le_hien_dien_zoom`, `ty_le_hien_dien_truc_tiep`, `ty_le_hoan_thanh_vle`, phân bố `ket_qua`. Có dòng tổng.

**Nghiệm thu:** tài khoản Sở thấy đủ 180 lớp; tài khoản Phòng VHXH chỉ đếm học viên thuộc xã mình.

---

## T8 — Thông báo hàng loạt (P2) — QĐ6

```sql
-- migration A
ALTER TYPE loai_su_kien_thong_bao ADD VALUE 'thong_bao_tuy_chinh';
-- migration B
ALTER TABLE nhat_ky_thong_bao ADD COLUMN lo_gui_id uuid;
CREATE INDEX idx_thong_bao_lo_gui ON nhat_ky_thong_bao(lo_gui_id);
```

`POST /thong-bao/gui-hang-loat` (chỉ `quan_tri`):
```json
{ "khoa_id": "...", "bo_loc": { "nhom_hoc_vien": 1, "lop_ids": [], "muc_dau_vao": null },
  "tieu_de": "...", "noi_dung": "Chào {ho_ten}, lớp {ten_lop}...", "xem_truoc": true }
```
- `xem_truoc=true` → trả `{ so_nguoi_nhan, so_khong_co_email, mau: [3 bản đã điền] }`, không gửi.
- `xem_truoc=false` → tạo `lo_gui_id`, đưa vào hàng đợi, gửi có giới hạn tốc độ (cấu hình `SMTP_RATE_PER_SEC`); trả `{ lo_gui_id }`.
- Placeholder hợp lệ: `{ho_ten}`, `{ten_lop}`, `{ten_dang_nhap}`, `{ten_khoa}`; placeholder lạ → 400.
- `GET /thong-bao/lo-gui/{lo_gui_id}` → tổng / thành công / thất bại.

**Nghiệm thu:** xem trước không ghi `nhat_ky_thong_bao`; gửi 1 lô → mỗi người có email đúng 1 dòng nhật ký gắn `lo_gui_id`.

---

## T9 — Hồ sơ đầy đủ (P0) — QĐ1

**Hồ sơ đầy đủ** = hồ sơ **qua toàn bộ quy tắc của luồng `tu_dang_ky`** trong `validation-checklist.md` (không chỉ "không NULL"): họ tên hợp lệ (#1–2), CCCD 12 số không trùng (#6–7), ngày sinh hợp lệ (#9–12), nơi sinh + phường xã đúng cấp và khớp nhau (#13–16), đơn vị `active` loại `truong` (#17–18), SĐT + email hợp lệ (#19–21), trình độ (#22–23), ≥1 chuyên môn (#24). Cảnh báo 🟡 không làm hồ sơ "chưa đầy đủ".

- Cài đặt thành 1 hàm service thuần `danhGiaDayDu(hocVien)` → `{ day_du, thieu: [{field, message}] }`, dùng lại bộ quy tắc của Dịch vụ Kiểm tra dữ liệu; không lưu cột tính sẵn.
- `GET /hoc-vien/toi/muc-do-day-du` — cổng học viên hiển thị danh sách còn thiếu.
- `GET /hoc-vien?day_du=false` — lọc cho Quản trị/Sở/Phòng/Trường đôn đốc (theo phạm vi).

**Nghiệm thu:** hồ sơ MOET vừa import → `day_du=false`, liệt kê đủ các trường thiếu; bổ sung đủ → `true`; nhập `phuong_xa_id` không thuộc `noi_sinh_id` → vẫn `false` kèm lý do.

---

## T10 — Điểm học trực tiếp (P3)

```sql
CREATE TABLE diem_hoc (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ma_diem_hoc     varchar(30)  NOT NULL,
    ten             varchar(255) NOT NULL,
    dia_chi         varchar(500) NOT NULL,
    dia_ban_id      uuid NOT NULL REFERENCES dia_danh(id),
    don_vi_id       uuid REFERENCES don_vi_cong_tac(id),   -- trường sở tại (nếu có)
    suc_chua        integer CHECK (suc_chua IS NULL OR suc_chua > 0),
    so_phong        smallint CHECK (so_phong IS NULL OR so_phong > 0),
    nguoi_lien_he   varchar(255),
    sdt_lien_he     varchar(20),
    ghi_chu_csvc    text,
    trang_thai      trang_thai_active NOT NULL DEFAULT 'active',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_diem_hoc_ma UNIQUE (ma_diem_hoc)
);
ALTER TABLE lich_hoc_lop ADD COLUMN diem_hoc_id uuid REFERENCES diem_hoc(id);
CREATE INDEX idx_lich_hoc_diem_hoc ON lich_hoc_lop(diem_hoc_id);
```

- CRUD `/diem-hoc` (ghi: `quan_tri`; đọc: theo phạm vi T2). Không xóa cứng (rule #40).
- Rule mới 🔴: lịch thuộc giai đoạn `hinh_thuc='truc_tiep'` phải có `diem_hoc_id`.
- Rule mới 🟡: số lớp học cùng lúc tại 1 điểm học vượt `so_phong` → cảnh báo.
- `GET /hoc-vien/toi/khoa-hoc` trả tên, địa chỉ, người liên hệ của điểm học cho buổi trực tiếp.

---

## T11 — Giảng viên & phân công (P3) — QĐ5

```sql
-- migration A
ALTER TYPE loai_danh_muc_import ADD VALUE 'giang_vien';
ALTER TYPE loai_danh_muc_import ADD VALUE 'phan_cong_giang_day';
-- migration B
CREATE TABLE giang_vien (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ho_ten          varchar(255) NOT NULL,
    email           varchar(255),
    so_dien_thoai   varchar(20) NOT NULL,
    don_vi_cong_tac varchar(255),
    ghi_chu         text,
    trang_thai      trang_thai_active NOT NULL DEFAULT 'active',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_giang_vien_email UNIQUE (email),
    CONSTRAINT uq_giang_vien_sdt UNIQUE (so_dien_thoai)
);
CREATE TABLE phan_cong_giang_day (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lich_hoc_id         uuid NOT NULL REFERENCES lich_hoc_lop(id) ON DELETE CASCADE,
    giang_vien_id       uuid NOT NULL REFERENCES giang_vien(id),
    vai_tro             vai_tro_nhan_su_lop NOT NULL,
    so_gio              numeric(4,1) CHECK (so_gio IS NULL OR so_gio > 0),
    da_xac_nhan_gio     boolean NOT NULL DEFAULT false,
    xac_nhan_luc        timestamptz,
    nguoi_xac_nhan_id   uuid REFERENCES nguoi_dung(id),
    CONSTRAINT uq_phan_cong UNIQUE (lich_hoc_id, giang_vien_id),
    CONSTRAINT chk_phan_cong_xac_nhan CHECK (
        (da_xac_nhan_gio AND xac_nhan_luc IS NOT NULL AND nguoi_xac_nhan_id IS NOT NULL)
        OR NOT da_xac_nhan_gio)
);
CREATE INDEX idx_phan_cong_gv ON phan_cong_giang_day(giang_vien_id);
```

- Import `giang_vien` (khóa khớp: email, nếu trống thì SĐT) và `phan_cong_giang_day` (`ma_khoa`, `ten_lop`, `giai_doan_thu_tu`, `buoi_so`, `email`/`so_dien_thoai` GV, `vai_tro`, `so_gio`).
- Rule mới 🔴: một giảng viên không được phân công vào 2 buổi có thời gian chồng nhau.
- `GET /giang-vien`, `GET /giang-vien/{id}/lich-day`, `PATCH /phan-cong/{id}/xac-nhan-gio`, `GET /bao-cao/gio-day?khoa_id=&tu_ngay=&den_ngay=` (+ xuất Excel theo giảng viên × buổi) — chỉ `quan_tri` (dữ liệu cá nhân giảng viên).
- `lop_hoc_nhan_su` giữ nguyên để tương thích. `GET /hoc-vien/toi/khoa-hoc` ưu tiên giảng viên từ `phan_cong_giang_day` của từng buổi; chỉ trả họ tên và vai trò (không trả SĐT/email giảng viên cho học viên).

**Nghiệm thu:** phân công 1 giảng viên vào 2 buổi chồng giờ → dòng lỗi; báo cáo giờ dạy chỉ cộng buổi `da_xac_nhan_gio`.

---

## T12 — Điểm danh & kết quả giai đoạn (P3)

```sql
-- migration A
CREATE TYPE trang_thai_diem_danh AS ENUM ('co_mat', 'vang', 'vang_co_phep');
CREATE TYPE nguon_diem_danh AS ENUM ('zoom', 'ky_ten', 'qr', 'thu_cong');
ALTER TYPE loai_danh_muc_import ADD VALUE 'diem_danh';
ALTER TYPE loai_danh_muc_import ADD VALUE 'ket_qua_giai_doan';
-- migration B
CREATE TABLE diem_danh (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dang_ky_hoc_id  uuid NOT NULL REFERENCES dang_ky_hoc(id) ON DELETE CASCADE,
    lich_hoc_id     uuid NOT NULL REFERENCES lich_hoc_lop(id) ON DELETE CASCADE,
    trang_thai      trang_thai_diem_danh NOT NULL,
    nguon           nguon_diem_danh NOT NULL,
    ghi_chu         text,
    nguon_import_id uuid REFERENCES nhat_ky_import(id),
    cap_nhat_luc    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_diem_danh UNIQUE (dang_ky_hoc_id, lich_hoc_id)
);
CREATE TABLE ket_qua_giai_doan (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dang_ky_hoc_id      uuid NOT NULL REFERENCES dang_ky_hoc(id) ON DELETE CASCADE,
    giai_doan_id        uuid NOT NULL REFERENCES giai_doan_khoa(id) ON DELETE CASCADE,
    ty_le_hoan_thanh    numeric(5,2) CHECK (ty_le_hoan_thanh BETWEEN 0 AND 100),
    diem                numeric(5,2),
    ghi_chu             text,
    nguon_import_id     uuid REFERENCES nhat_ky_import(id),
    cap_nhat_luc        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_ket_qua_giai_doan UNIQUE (dang_ky_hoc_id, giai_doan_id)
);
```

- Import `diem_danh`: mã học viên (resolver), `ma_khoa`, `ten_lop`, `giai_doan_thu_tu`, `buoi_so`, `trang_thai`, `nguon`. Upsert (lần import sau ghi đè).
- Import `ket_qua_giai_doan`: mã học viên, `ma_khoa`, `giai_doan_thu_tu`, `ty_le_hoan_thanh`, `diem` — dùng cho tiến độ VLE và điểm đánh giá.
- Rule 🟡: học viên điểm danh ở buổi của lớp khác lớp mình (học bù) → cảnh báo, vẫn lưu, bắt buộc `ghi_chu`.
- `GET /hoc-vien/toi/khoa-hoc` trả trạng thái điểm danh từng buổi và tiến độ từng giai đoạn.
- **Lưu ý vận hành (không phải code):** log Zoom không chứa mã học viên. Cần quy ước tên hiển thị Zoom `Mã – Họ tên` hoặc dùng đăng ký Zoom; N2/N4 chuyển log thành file import có mã học viên.

---

## T13 — Chứng nhận & tra cứu công khai (P4) — QĐ1

```sql
CREATE TYPE trang_thai_chung_nhan AS ENUM ('hieu_luc', 'thu_hoi');
CREATE TABLE chung_nhan (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dang_ky_hoc_id      uuid NOT NULL REFERENCES dang_ky_hoc(id),
    so_hieu             varchar(50) NOT NULL,
    ma_tra_cuu          varchar(16) NOT NULL,
    so_quyet_dinh       varchar(100) NOT NULL,
    ngay_quyet_dinh     date NOT NULL,
    ngay_cap            date NOT NULL,
    trang_thai          trang_thai_chung_nhan NOT NULL DEFAULT 'hieu_luc',
    ly_do_thu_hoi       text,
    created_by          uuid REFERENCES nguoi_dung(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_chung_nhan_dang_ky UNIQUE (dang_ky_hoc_id),
    CONSTRAINT uq_chung_nhan_so_hieu UNIQUE (so_hieu),
    CONSTRAINT uq_chung_nhan_ma_tra_cuu UNIQUE (ma_tra_cuu),
    CONSTRAINT chk_chung_nhan_thu_hoi CHECK (trang_thai = 'hieu_luc' OR ly_do_thu_hoi IS NOT NULL)
);
```

- `POST /khoa-boi-duong/{id}/chung-nhan/kiem-tra` (dry-run, `quan_tri`) → danh sách đủ điều kiện và bị chặn kèm lý do. Điều kiện: `ket_qua='dat'` **và** hồ sơ đầy đủ (T9) **và** chưa có chứng nhận.
- `POST /khoa-boi-duong/{id}/chung-nhan/cap` `{ so_quyet_dinh, ngay_quyet_dinh, ngay_cap, tien_to_so_hieu }` → cấp cho mọi người đủ điều kiện; `so_hieu` = tiền tố + số thứ tự; `ma_tra_cuu` = chuỗi ngẫu nhiên base32 12 ký tự (sinh bằng CSPRNG, không suy ra từ id).
- `POST /chung-nhan/{id}/thu-hoi` `{ ly_do }` (`quan_tri`).
- `GET /hoc-vien/toi/chung-nhan` — học viên xem chứng nhận của mình.
- **Công khai** `GET /tra-cuu/chung-nhan/{ma_tra_cuu}` (`@Public()`, áp throttler T1): chỉ trả họ tên, năm sinh, tên khóa, kết quả, số hiệu, số quyết định, ngày cấp, trạng thái. **Không** trả CCCD, ngày/tháng sinh đầy đủ, đơn vị, liên hệ.
- Mã QR trên chứng nhận trỏ tới trang tra cứu của frontend với `ma_tra_cuu`.

**Checklist:** thêm rule "Chứng nhận chỉ cấp khi hồ sơ đầy đủ (T9) và `ket_qua='dat'`".

**Nghiệm thu:** học viên `dat` nhưng thiếu CCCD → nằm trong danh sách bị chặn với lý do "thiếu so_dinh_danh_ca_nhan"; tra cứu mã sai → 404; chứng nhận bị thu hồi → tra cứu trả `trang_thai='thu_hoi'`.

---

## 4. Trình tự vận hành dữ liệu (không phải code)

**Biến thể "khảo sát trước" (An Giang GĐ1, 2026-10-02)** — thay các bước 5–11 bên dưới:
1. Vào `/admin/cau-hinh-khao-sat`: chọn chế độ "Khảo sát", tắt "Đánh giá đầu vào" trong cổng, nhập đường dẫn 2 phiếu → Lưu (không cần deploy).
2. Gửi link trang chủ qua Sở → trường → giáo viên; học viên làm Phiếu 1 rồi Phiếu 2.
3. Đóng khảo sát → import `ho_so_nhan_su_moet` (thông tin đã bổ sung) → tạo khóa → import `ket_qua_danh_gia` → `lop_va_lich_hoc` → `phan_lop_hoc_vien`.
4. Ở `/admin/cau-hinh-khao-sat`: chọn "Đăng nhập cổng học viên", tắt khối khảo sát → Lưu → thông báo học viên đăng nhập xem hồ sơ/lớp. **Không mở Đợt xác nhận** ở giai đoạn này.
5. Giai đoạn kết quả cuối: mở Đợt xác nhận để học viên kiểm tra, điều chỉnh hồ sơ trước khi cấp chứng nhận.

**Trước khi mở đợt 1**
1. Import `dia_danh`: An Giang (sau sáp nhập) + TP.HCM.
2. Import `don_vi_cong_tac`: Sở GD&ĐT An Giang, các Phòng VHXH, các trường (`don_vi_cha_id` đúng cây), HCMUE loại `khac`. Tên đơn vị phải khớp cột "Đơn vị" của file học viên; trường trùng tên phải có `ma_don_vi` và file học viên có cột `Mã đơn vị`.
3. Import `mon_hoc` (dropdown môn giảng dạy).
4. Import `ho_so_nhan_su_moet` (T4). Cột Mã định danh và Số điện thoại định dạng **Text**.
5. Tạo Đợt 1 (`kiem_tra_bo_sung`) và Đợt 2 (`xac_nhan_truoc_danh_gia`), `khoa_id=NULL` (T14).
6. Thử toàn luồng với 5–10 tài khoản thật (đăng nhập → đổi mật khẩu → bổ sung → xác nhận → nhận email bản sao).
7. Gửi hướng dẫn đăng nhập (mã MOET + ngày sinh `ddmmyyyy`) qua Sở → trường → giáo viên.

**Trong đợt 1**
8. Xuất `bao-cao/xac-nhan` mỗi sáng → gửi trường và N4 đôn đốc; N1 rà `bao-cao/sua-truong-moet`.

**Hết đợt 1 → đợt 2**
9. Xuất `bao-cao/xuat-cho-vle` → Phòng CNTT tạo tài khoản VLE cho tất cả → import `tai_khoan_vle` (T15).
10. Đợt 2 (song song thời gian đánh giá): học viên xác nhận lần cuối → thấy link + tài khoản VLE → làm bài.
11. Đóng đợt 2: xuất `bao-cao/dieu-kien-danh-gia` → danh sách không đủ điều kiện chuyển xử lý riêng.

**Sau đánh giá (P1)**
12. Quản trị tạo khóa (T2) → ghi danh (T3) → import `ket_qua_danh_gia` (T5) → import `lop_va_lich_hoc` (T6) → import `phan_lop_hoc_vien` có `ten_lop`.
