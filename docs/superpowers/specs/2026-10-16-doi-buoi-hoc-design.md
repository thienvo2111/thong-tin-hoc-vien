# Đặc tả — Học viên đề nghị đổi buổi học (2026-10-16)

Quyết định nền: [ADR 0007](../../adr/0007-hoc-vien-de-nghi-doi-buoi-hoc.md) (D1–D10). Ngôn ngữ domain: [CONTEXT.md](../../../CONTEXT.md). Khác và **không thay thế** đề nghị đổi lớp cả giai đoạn (ADR 0004 G14, bảng `de_nghi_doi_lop`).

## 0. Thuật ngữ

- **Buổi nguồn** — `lich_hoc_lop` của lớp học viên được phân (`phan_lop_giai_doan`) mà học viên không dự được.
- **Buổi đích** — `lich_hoc_lop` của lớp khác mà học viên muốn/được chốt học thay.
- **Buổi tương đương** — buổi đích hợp lệ với buổi nguồn: cùng `khoa_id`, cùng `giai_doan_id`, cùng `buoi_so`, lớp cùng `loai_lop` và cùng `muc_nang_luc` (lớp nguồn chưa đặt mức thì chỉ khớp lớp cũng chưa đặt mức), khác `lop_id`. Buổi đích phải đang `active` ở cấp lớp (`lop_hoc.trang_thai`).
- **Đổi buổi** — 1 dòng `doi_buoi_hoc`: học viên vẫn thuộc lớp gốc (`phan_lop_giai_doan` không đổi), riêng buổi đó học ở buổi đích.
- **Người duyệt** — `quan_tri` (mọi đề nghị) hoặc `ho_tro_hoc_vien` có `phan_cong_ho_tro` tới `dang_ky_hoc.cum_id` của học viên.

## 1. Schema (1 migration, chỉ thêm)

```sql
ALTER TABLE khoa_boi_duong ADD COLUMN so_buoi_doi_toi_da SMALLINT NOT NULL DEFAULT 0
  CHECK (so_buoi_doi_toi_da BETWEEN 0 AND 50);

CREATE TABLE doi_buoi_hoc (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dang_ky_hoc_id   uuid NOT NULL REFERENCES dang_ky_hoc(id) ON DELETE CASCADE,
  lich_nguon_id    uuid NOT NULL REFERENCES lich_hoc_lop(id) ON DELETE CASCADE,
  lich_de_nghi_id  uuid NOT NULL REFERENCES lich_hoc_lop(id) ON DELETE CASCADE,
  lich_chot_id     uuid NULL     REFERENCES lich_hoc_lop(id) ON DELETE CASCADE,
  ly_do            text NOT NULL,
  trang_thai       trang_thai_de_nghi NOT NULL DEFAULT 'cho_duyet',
  nguoi_tao        uuid NULL REFERENCES nguoi_dung(id) ON DELETE SET NULL,
  tao_luc          timestamptz NOT NULL DEFAULT now(),
  nguoi_xu_ly      uuid NULL REFERENCES nguoi_dung(id) ON DELETE SET NULL,
  xu_ly_luc        timestamptz NULL,
  ghi_chu_xu_ly    text NULL,
  CHECK (lich_de_nghi_id <> lich_nguon_id),
  -- Hủy duyệt giữ lại lich_chot_id để tra lịch sử, nên chỉ ràng buộc một chiều.
  CHECK (trang_thai <> 'da_duyet' OR lich_chot_id IS NOT NULL)
);
-- Mỗi buổi nguồn của 1 đăng ký: tối đa 1 đề nghị đang chờ hoặc đã duyệt.
CREATE UNIQUE INDEX uq_doi_buoi_hoat_dong ON doi_buoi_hoc (dang_ky_hoc_id, lich_nguon_id)
  WHERE trang_thai IN ('cho_duyet', 'da_duyet');
CREATE INDEX idx_doi_buoi_de_nghi ON doi_buoi_hoc (lich_de_nghi_id, trang_thai, tao_luc);
CREATE INDEX idx_doi_buoi_chot   ON doi_buoi_hoc (lich_chot_id) WHERE trang_thai = 'da_duyet';
CREATE INDEX idx_doi_buoi_nguon  ON doi_buoi_hoc (lich_nguon_id) WHERE trang_thai = 'da_duyet';
```

- Dùng lại enum `trang_thai_de_nghi` (`cho_duyet | da_duyet | tu_choi | da_huy`). "Quá hạn" **không** là trạng thái lưu (D7).
- `so_buoi_doi_toi_da = 0` = tắt chức năng ở khóa đó (mặc định, mọi khóa hiện có đều tắt).
- Không sửa/xóa dữ liệu cũ. Rollback = `DROP TABLE doi_buoi_hoc; ALTER TABLE khoa_boi_duong DROP COLUMN so_buoi_doi_toi_da;`.

## 2. Module dùng chung `backend/src/doi-buoi-hoc/`

Mọi nơi cần "ai học buổi nào" hoặc "sĩ số buổi" đi qua module này, không tự viết lại công thức.

### 2.1 `DoiBuoiHocQueryService`

- `dieuChinhTheoBuoi(lichIds: string[])` → `Map<lichId, { ra: DangKyRef[], vao: (DangKyRef & { lich_nguon_id, lop_nguon })[] }>` — chỉ tính `trang_thai = 'da_duyet'`.
- `siSoBuoi(lichIds: string[])` → `Map<lichId, { si_so, si_so_toi_da, so_cho_duyet }>`:
  - `si_so` = số `phan_lop_giai_doan` (lop của buổi, giai_doan của buổi) − số `da_duyet` có `lich_nguon_id` = buổi + số `da_duyet` có `lich_chot_id` = buổi.
  - `si_so_toi_da` = `lop_hoc.si_so_toi_da` (NULL = không giới hạn).
  - `so_cho_duyet` = số `cho_duyet` có `lich_de_nghi_id` = buổi và buổi chưa bắt đầu.
- `buoiCuaDangKy(dangKyId, giaiDoanId?)` → các buổi học viên thực sự học: buổi của lớp được phân, thay buổi nguồn đã đổi bằng buổi chốt.

### 2.2 Quy tắc thuần (`doi-buoi-hoc.rules.ts`, unit test không cần DB)

- `laBuoiTuongDuong(nguon, dich)` — §0.
- `daBatDau(lich, now)` — `thoi_gian_bat_dau <= now`.
- `conChoChoDeNghi({ si_so, si_so_toi_da, so_truoc })` — `si_so_toi_da == null || si_so_toi_da - si_so > so_truoc` (D5).
- `soLuotDaDung(ds)` — đếm `cho_duyet` + `da_duyet`.

## 3. API

### 3.1 Học viên (`@Controller('hoc-vien/toi')`, vai trò `hoc_vien`)

Mọi endpoint: `dang_ky_hoc` phải của caller; khóa có `so_buoi_doi_toi_da = 0` → 403 "Khóa học chưa mở đề nghị đổi buổi".

| Endpoint | Hành vi |
|---|---|
| `GET /hoc-vien/toi/doi-buoi?khoa_id=` | `{ so_buoi_doi_toi_da, so_luot_da_dung, buoi_sap_toi: [{ lich_nguon, de_nghi? }], de_nghi: [...] }` — `buoi_sap_toi` là buổi chưa bắt đầu của lớp được phân; mỗi đề nghị `cho_duyet` kèm `thu_tu_hang` ("Bạn đang xếp thứ k"). |
| `GET /hoc-vien/toi/doi-buoi/lua-chon/{lichNguonId}` | Các buổi tương đương chưa bắt đầu: `{ lich, lop: {ten_lop}, si_so, si_so_toi_da, so_cho_duyet, da_du }`. Buổi nguồn đã bắt đầu → 400. |
| `POST /hoc-vien/toi/doi-buoi` | `{ lich_nguon_id, lich_de_nghi_id, ly_do }`. Kiểm: buổi nguồn thuộc lớp được phân của caller ở đúng giai đoạn; buổi đích tương đương; cả hai chưa bắt đầu; buổi đích **chưa đầy** (`si_so < si_so_toi_da`, không tính hàng chờ); `ly_do` 5–500 ký tự sau trim; còn lượt (`so_luot_da_dung < so_buoi_doi_toi_da`); không có đề nghị hoạt động cho buổi nguồn (409). Ghi nhật ký `de_nghi_doi_buoi`. |
| `PUT /hoc-vien/toi/doi-buoi/{id}` | **Sửa** (D6) — chỉ khi `cho_duyet`, body như POST với cùng `lich_nguon_id`. 1 transaction: UPDATE có điều kiện `cho_duyet` → `da_huy` (0 dòng → 409), rồi INSERT mới (`tao_luc = now()`, về cuối hàng). Lượt: đề nghị cũ đã hủy nên không tính hai lần. |
| `POST /hoc-vien/toi/doi-buoi/{id}/huy` | UPDATE có điều kiện `cho_duyet` → `da_huy`; 0 dòng → 409. |

Học viên **không** hủy được đề nghị đã duyệt (liên hệ người hỗ trợ cụm).

### 3.2 Người duyệt (`@Controller('doi-buoi-hoc')`, vai trò `quan_tri`, `ho_tro_hoc_vien`)

Phạm vi: `ho_tro_hoc_vien` chỉ thấy/xử lý đề nghị có `dang_ky_hoc.cum_id ∈ Cụm của tôi` (ngoài phạm vi → 404, như ADR 0003). `quan_tri` thấy tất cả.

| Endpoint | Hành vi |
|---|---|
| `GET /doi-buoi-hoc?trang_thai=&khoa_id=` | Danh sách: học viên (họ tên, đơn vị, cụm), buổi nguồn, buổi đề nghị, buổi chốt, lý do, `tao_luc`, `qua_han` (buổi nguồn hoặc buổi đề nghị đã bắt đầu, chỉ với `cho_duyet`), `thu_tu_hang` (`k/n` trong hàng chờ của buổi đề nghị), `si_so`/`si_so_toi_da`/`so_cho_duyet` của buổi đề nghị. `cho_duyet` sắp `tao_luc` tăng dần; trạng thái khác sắp `xu_ly_luc` giảm dần. `take: 500`. |
| `GET /doi-buoi-hoc/dem-cho-duyet` | Số `cho_duyet` chưa quá hạn trong phạm vi — cho badge menu. |
| `GET /doi-buoi-hoc/{id}/lua-chon` | Các buổi tương đương với buổi nguồn, chưa bắt đầu, kèm `si_so`, `si_so_toi_da`, `so_cho_duyet`, `so_truoc` (số `cho_duyet` vào buổi đó có `tao_luc` < đề nghị này), `duyet_duoc` (theo D5). |
| `POST /doi-buoi-hoc/{id}/duyet` | `{ lich_chot_id?, ghi_chu? }` — mặc định `lich_chot_id = lich_de_nghi_id`. Xem §4. |
| `POST /doi-buoi-hoc/{id}/tu-choi` | `{ ghi_chu }` bắt buộc (5–500). UPDATE có điều kiện `cho_duyet`; 0 dòng → 409. |
| `POST /doi-buoi-hoc/{id}/huy-duyet` | `{ ghi_chu }` bắt buộc. Chỉ khi `da_duyet` và cả buổi nguồn lẫn buổi chốt chưa bắt đầu (400 nếu đã bắt đầu). UPDATE có điều kiện `da_duyet` → `da_huy`. Lượt được trả lại. |

### 3.3 Quản trị — cấu hình khóa

- `PATCH /khoa-boi-duong/{id}` nhận thêm `so_buoi_doi_toi_da` (0–50). `GET` khóa trả trường này.

## 4. Duyệt — thuật toán

Trong **một** transaction:

1. `SELECT pg_advisory_xact_lock(hashtext('doi_buoi:' || lich_chot_id))` — tuần tự hóa mọi lần duyệt vào cùng buổi chốt.
2. Đọc đề nghị; `trang_thai <> 'cho_duyet'` → 409 "Đề nghị đã được xử lý".
3. Buổi nguồn hoặc buổi chốt đã bắt đầu → 400 "Buổi đã bắt đầu, không thể duyệt".
4. Buổi chốt phải tương đương buổi nguồn → 400.
5. Học viên vẫn được phân vào lớp của buổi nguồn ở giai đoạn đó (`phan_lop_giai_doan`); khác → 409 "Phân lớp của học viên đã thay đổi — hãy từ chối".
6. Tính `si_so` buổi chốt (§2.1) và `so_truoc` = số `cho_duyet` có `lich_de_nghi_id = lich_chot_id`, `tao_luc` < `tao_luc` của đề nghị này, buổi chưa bắt đầu.
7. `conChoChoDeNghi` sai:
   - `ho_tro_hoc_vien` → 409 với thông điệp: đầy ("Buổi đã đủ sĩ số {si_so}/{toi_da} — chọn buổi khác") hoặc giữ chỗ ("Còn {k} chỗ, có {so_truoc} đề nghị gửi trước đang chờ — cần xử lý trước").
   - `quan_tri` → vẫn duyệt, trả `canh_bao`.
8. UPDATE có điều kiện `cho_duyet` → `da_duyet`, `lich_chot_id`, `nguoi_xu_ly`, `xu_ly_luc`, `ghi_chu_xu_ly`.
9. Ghi nhật ký `duyet_doi_buoi` (`chi_tiet`: `de_nghi_id`, `lich_nguon_id`, `lich_de_nghi_id`, `lich_chot_id`, `vuot_si_so`, `vuot_thu_tu`).

Chốt sang buổi khác buổi đề nghị: hàng đợi và sĩ số tính theo **buổi chốt**; đề nghị này rời hàng chờ của buổi đề nghị.

## 5. Các chỗ phải tính đổi buổi

| Chỗ | Thay đổi |
|---|---|
| Trang lớp (`trang-lop.service.ts`, danh sách theo buổi) | Gọi `dieuChinhTheoBuoi`: người đổi ra hiện nhãn "Đổi sang {lớp}", người đổi vào thêm vào buổi với nhãn "Từ {lớp}". Sĩ số buổi hiện theo `siSoBuoi`. |
| Mẫu điểm danh (xuất theo buổi) | Buổi đích có thêm dòng người đổi vào; buổi nguồn ghi chú "Đã đổi sang {lớp}" cho người đổi ra. |
| Nạp điểm danh (`resolveDiemDanhRow`, quy tắc học bù) | Có `doi_buoi_hoc` `da_duyet` với `lich_chot_id` = buổi của dòng và cùng `dang_ky_hoc` → **không** cảnh báo học bù, không bắt buộc `ghi_chu`. |
| Lịch học hỗ trợ cụm (`ho-tro-hoc-vien.service.ts` `lichHoc`) | Buổi chốt của học viên trong cụm được tính là buổi của cụm. |
| Nhắc lịch cụm (`nhac-lich.service.ts` `capDotCuaCum` + nội dung tin) | Buổi chốt thêm vào lịch nhắc của cụm; nội dung ghi "{họ tên} học buổi {n} tại {lớp}". Đổi buổi được duyệt **sau** lần nhắc cuối → cờ "Cần nhắc lại" như G11 (so `xu_ly_luc` với lần gửi cuối). |
| Trang học viên (`M7/ThongTinLopHoc.tsx`, `M3/TheBuoiSapToi.tsx`) | Buổi đã đổi hiện giờ/địa điểm/link của buổi chốt, nhãn "Đã đổi buổi". |
| **Giữ nguyên** | Sĩ số lớp ở trang khóa, báo cáo theo lớp, email thông báo xếp lớp, SSO, Excel chia lớp — vẫn theo lớp gốc. |

## 6. Giao diện

### Học viên
- Trong chi tiết từng buổi (thẻ buổi sắp tới, trang thông tin lớp): dòng chữ nhỏ màu phụ "Không tham gia được buổi này?" → mở trang đổi buổi đã chọn sẵn buổi nguồn. Chỉ hiện khi khóa `so_buoi_doi_toi_da > 0` và buổi chưa bắt đầu.
- Trang `/de-nghi-doi-buoi` (route có, **không** có mục menu; người hỗ trợ gửi link qua Zalo): chọn khóa → danh sách buổi sắp tới; với mỗi buổi chọn buổi tương đương (bảng: lớp, thời gian, địa điểm/link, `si_so/si_so_toi_da`, "+n đang chờ"; buổi đầy mờ, nhãn "Đã đủ", không chọn được), nhập lý do, gửi. Hiện "Còn {x}/{N} lượt đổi". Đề nghị đang chờ: "Bạn đang xếp thứ k", nút Sửa (cảnh báo "Sửa sẽ đưa bạn về cuối hàng chờ") và Hủy.

### Người hỗ trợ cụm
- Màn `BaoVangDoiLop.tsx` thêm tab **"Đổi buổi"** (badge = `dem-cho-duyet`): bảng chờ duyệt sắp theo thời điểm gửi, cột thứ tự hàng `k/n`, sĩ số buổi đề nghị, nhãn "Quá hạn". Nút Duyệt mở modal: buổi đề nghị chọn sẵn + danh sách buổi tương đương (sĩ số, đang chờ, số gửi trước, `duyet_duoc`), ghi chú tùy chọn. Nút Từ chối (ghi chú bắt buộc). Tab "Đã xử lý" có nút Hủy duyệt.

### Quản trị
- Chi tiết khóa: ô số "Số buổi tối đa học viên được đề nghị đổi (0 = tắt)".
- Trang Vận hành (`AdminVanHanh.tsx`): khối "Đề nghị đổi buổi chờ duyệt" (số chờ, số chờ > 48 giờ, theo cụm) + màn danh sách như hỗ trợ cụm, có thêm cảnh báo khi duyệt vượt sĩ số/thứ tự.

## 7. Nhật ký

Thêm `hanh_dong` vào `NhatKyService`: `de_nghi_doi_buoi` (tạo/sửa/hủy, nhóm `hoc_tap`), `duyet_doi_buoi` (duyệt/từ chối/hủy duyệt, nhóm `hoc_tap`). `hanh_dong` là `VarChar(50)` — không migration.

## 8. Kiểm thử

### Unit (rules + service, mock Prisma)
- Buổi tương đương: khác `buoi_so` / `giai_doan` / `loai_lop` / `muc_nang_luc` / cùng lớp → loại; `muc_nang_luc` NULL chỉ khớp NULL.
- Đã bắt đầu: đúng mốc `thoi_gian_bat_dau` (bằng = đã bắt đầu).
- Sĩ số: phân lớp − ra + vào; `si_so_toi_da` NULL = không giới hạn.
- Giữ chỗ (D5): còn 2 chỗ, 1 người trước → duyệt được; còn 1 chỗ, 1 người trước → chặn; người trước quá hạn không tính.
- Lượt: `cho_duyet` + `da_duyet` tính; `tu_choi`/`da_huy` không; sửa không tốn thêm lượt; hết lượt → 400.
- Khóa tắt (`0`) → 403 cả 5 endpoint học viên.
- Phạm vi: hỗ trợ cụm khác → 404; quan_tri thấy tất cả.
- Quản trị duyệt vượt sĩ số / vượt thứ tự → thành công kèm `canh_bao`.
- Chốt sang buổi khác → `lich_chot_id` ≠ `lich_de_nghi_id`, sĩ số tính theo buổi chốt.
- Phân lớp đổi sau khi gửi → 409.
- Hủy duyệt khi buổi đã bắt đầu → 400; trước đó → `da_huy`, sĩ số giảm.

### E2E (`backend/test/doi-buoi-hoc.e2e-spec.ts`, DB dev)
1. Học viên gửi → hỗ trợ cụm duyệt → trang lớp buổi đích có học viên, buổi nguồn có nhãn đổi ra → nạp điểm danh buổi đích không báo học bù.
2. Hai người duyệt song song cùng buổi còn 1 chỗ → đúng 1 thành công, 1 nhận 409.
3. Sửa đề nghị → `tao_luc` mới, thứ tự hàng về cuối, số lượt không đổi.
4. Unique hoạt động: gửi 2 đề nghị cùng buổi nguồn → 409.

### Frontend (vitest)
- Link nhỏ chỉ hiện khi khóa bật và buổi chưa bắt đầu.
- Buổi đầy không chọn được; hiện sĩ số và "+n đang chờ".
- Modal duyệt: lựa chọn `duyet_duoc = false` bị vô hiệu với hỗ trợ cụm, bật với quản trị kèm cảnh báo.

## 9. Lát cắt triển khai

1. **Schema + module truy vấn + API học viên** (kèm cấu hình khóa) — deploy được, chưa ai duyệt.
2. **API + màn duyệt** (hỗ trợ cụm, Quản trị).
3. **Tích hợp §5** (trang lớp, điểm danh, lịch/nhắc cụm, trang học viên).

Lát 1–2 deploy cùng nhau mới có giá trị; lát 3 phải có trước khi bật `so_buoi_doi_toi_da > 0` cho khóa đầu tiên.

## 10. Deploy

- 1 migration chỉ thêm (bảng + cột default 0), không đổi dữ liệu. Backup trước deploy như thường lệ.
- Sau deploy mọi khóa đều tắt; Quản trị bật từng khóa bằng ô cấu hình.
