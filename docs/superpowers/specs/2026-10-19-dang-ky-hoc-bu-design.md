# Đặc tả — Đăng ký học bù buổi đã vắng (2026-10-19)

Quyết định nền: [ADR 0012](../../adr/0012-dang-ky-hoc-bu.md) (B1–B8), dựa trên [ADR 0007](../../adr/0007-hoc-vien-de-nghi-doi-buoi-hoc.md) và đặc tả [đổi buổi](2026-10-16-doi-buoi-hoc-design.md). Phần nào không nói ở đây thì giữ nguyên như đổi buổi.

## 0. Thuật ngữ

- **Đề nghị học bù** — dòng `doi_buoi_hoc` có `loai = 'hoc_bu'`. `lich_nguon_id` = buổi đã vắng; `lich_de_nghi_id`/`lich_chot_id` = buổi học bù.
- **Đổi buổi** — dòng `loai = 'doi_buoi'` (mọi dòng hiện có).
- **Không có mặt** — không có dòng `diem_danh` của (đăng ký, buổi), hoặc `trang_thai` ∈ {`vang`, `vang_co_phep`}.

## 1. Schema (1 migration `20261019120000_hoc_bu`, chỉ thêm)

```sql
CREATE TYPE "loai_doi_buoi" AS ENUM ('doi_buoi', 'hoc_bu');
ALTER TABLE "doi_buoi_hoc" ADD COLUMN "loai" "loai_doi_buoi" NOT NULL DEFAULT 'doi_buoi';
ALTER TABLE "khoa_boi_duong" ADD COLUMN "so_buoi_hoc_bu_toi_da" SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE "khoa_boi_duong" ADD CONSTRAINT "chk_khoa_so_buoi_hoc_bu" CHECK ("so_buoi_hoc_bu_toi_da" BETWEEN 0 AND 50);
```

- Hai index unique `uq_doi_buoi_cho`, `uq_doi_buoi_da_duyet` giữ nguyên (theo (đăng ký, buổi gốc), không theo loại — B6).
- Rollback: `ALTER TABLE ... DROP COLUMN` hai cột + `DROP TYPE` + xóa dòng `_prisma_migrations` (chỉ khi chưa có dòng `hoc_bu`).

## 2. Quy tắc thuần (`doi-buoi-hoc.rules.ts`)

`kiemTraGui` nhận thêm `loai`, `trang_thai_diem_danh_nguon: trang_thai_diem_danh | null`, `nguon_co_doi_buoi_da_duyet: boolean`, `so_buoi_hoc_bu_toi_da`, `so_luot_hoc_bu_da_dung`. Với `loai = 'hoc_bu'`, thứ tự kiểm:

| Mã | Điều kiện | HTTP | Thông điệp |
|---|---|---|---|
| `KHOA_TAT` | `so_buoi_hoc_bu_toi_da = 0` | 403 | Khóa học chưa mở đăng ký học bù |
| `HET_LUOT` | lượt học bù đã dùng ≥ tối đa (trừ buổi gốc đang gửi) | 400 | Thầy/Cô đã dùng hết {N} lượt học bù của khóa này |
| `KHONG_THUOC_LOP` | như đổi buổi | 400 | (như cũ) |
| `CHUA_DIEN_RA` (mới) | buổi gốc **chưa** bắt đầu | 400 | Buổi này chưa diễn ra — hãy dùng đổi buổi |
| `DA_CO_MAT` (mới) | điểm danh buổi gốc = `co_mat` | 400 | Thầy/Cô đã có mặt buổi này, không cần học bù |
| `DA_DOI_BUOI` (mới) | buổi gốc có đổi buổi `da_duyet` | 400 | Buổi này đã được đổi, liên hệ người hỗ trợ |
| `KHONG_TUONG_DUONG` | như đổi buổi | 400 | (như cũ) |
| `DA_BAT_DAU` | buổi học bù đã bắt đầu | 400 | Buổi học bù đã bắt đầu, hãy chọn buổi khác |
| `BUOI_DAY` / `LY_DO` | như đổi buổi | | |

`loai = 'doi_buoi'`: giữ nguyên toàn bộ logic hiện tại (D2, D12).

`quyetDinhDuyet` nhận `loai`: với `hoc_bu` **bỏ** kiểm "buổi gốc đã bắt đầu" và D12 ở buổi gốc; vẫn kiểm `DA_CO_MAT` (học viên có thể được ghi có mặt sau khi gửi), buổi chốt chưa bắt đầu, tương đương, phân lớp, sĩ số/giữ chỗ, D12 ở buổi chốt cũ khi đổi lại.

`soLuotDaDung` đếm theo **loại**: số buổi gốc khác nhau có `cho_duyet|da_duyet` cùng loại.

## 3. API

### Học viên (`/hoc-vien/toi/doi-buoi`)
- `GET ?khoa_id=` (tổng quan): thêm `so_buoi_hoc_bu_toi_da`, `so_luot_hoc_bu_da_dung`, `buoi_co_the_hoc_bu: [{ lich_nguon, trang_thai_diem_danh, de_nghi }]` (buổi đã qua của lớp được phân, không có mặt, không có đổi buổi đã duyệt; tối đa 30 gần nhất). Mỗi đề nghị có `loai`.
- `GET lua-chon/:lichNguonId?loai=hoc_bu` — ứng viên như đổi buổi (tương đương, chưa bắt đầu, `trung_lich`); với `hoc_bu` buổi gốc phải đã bắt đầu (ngược với đổi buổi).
- `POST` / `PUT :id` — body thêm `loai` (mặc định `doi_buoi`); sửa không đổi được loại.
- `GET /hoc-vien/toi/khoa-hoc`: mỗi khóa thêm `so_buoi_hoc_bu_toi_da`; mỗi buổi đã qua thêm `hoc_bu_duoc: boolean` (khóa bật, không có mặt, chưa có đổi buổi đã duyệt, chưa có học bù đang chờ/đã duyệt); buổi học bù đã duyệt được **thêm** vào `lich_hoc` của giai đoạn với `hoc_bu: true`, `lich_goc_id`, `lop_goc_ten`, `lop_chot_ten` (sắp theo thời gian; buổi gốc vẫn ở chỗ cũ).

### Người duyệt (`/doi-buoi-hoc`)
- Danh sách, đếm, lựa chọn, duyệt, từ chối, hủy duyệt: không đổi route; mỗi đề nghị có `loai`; `GET /doi-buoi-hoc` + `dem-cho-duyet` nhận lọc `loai`.
- Thống kê: lọc `loai[]`; dòng/Excel thêm tách số theo loại (cột "Học bù vào" = đổi vào loại học bù) và cột "Loại" ở sheet Học viên.

### Quản trị
- `PATCH /khoa-boi-duong/:id` nhận `so_buoi_hoc_bu_toi_da` (0–50). Ô ở trang khóa: "Số buổi học bù tối đa mỗi học viên (0 = tắt)".

## 4. Duyệt — khác đổi buổi ở đâu

Giữ nguyên §4 đổi buổi (lock buổi chốt → đọc → giữ chỗ → hạ bản cũ nếu đổi lại → nâng bản mới). Khác: bỏ kiểm "buổi gốc chưa bắt đầu" và D12-buổi-gốc; thêm `DA_CO_MAT` (đọc `diem_danh` buổi gốc trong tx). Nhật ký `duyet_doi_buoi` ghi thêm `loai`.

## 5. Các chỗ đọc đổi buổi đã duyệt — xử lý `loai`

Query service (`doi-buoi-hoc-query.service.ts`) trả thêm `loai` ở `doiBuoiDaDuyetCuaDangKy`, `dieuChinhTheoBuoi` (ra/vào), dùng trong `siSoBuoi`.

| Nơi | `doi_buoi` (giữ nguyên) | `hoc_bu` |
|---|---|---|
| `siSoBuoi` — đổi ra ở buổi gốc | trừ | **không trừ** (buổi đã qua, học viên vẫn thuộc buổi đó) |
| `siSoBuoi` — đổi vào ở buổi chốt | cộng | cộng |
| Trang lớp / bảng điểm danh — buổi gốc | nhãn "Đổi sang {lớp}" | nhãn "Học bù tại {lớp}" |
| Trang lớp / bảng điểm danh — buổi chốt | "Từ {lớp}" | "Học bù từ {lớp}" |
| Lịch học viên (`khoaHocTheoHocVienId`) | **thay** buổi gốc bằng buổi chốt | **thêm** buổi chốt (nhãn Học bù), buổi gốc giữ nguyên |
| Trùng lịch (`lichThucTe`) | thay | **thêm** buổi chốt như một slot riêng |
| Vào học Zoom, báo vắng, sửa ô điểm danh ở buổi chốt | cho phép | cho phép |
| Nạp điểm danh — không báo học bù ở buổi chốt | có | có |
| Chốt vắng Zoom — buổi gốc | bỏ qua người đổi ra | **không bỏ qua** (buổi đã qua, đã chốt trước đó) |
| Chốt vắng Zoom — buổi chốt | gồm người đổi vào | gồm |
| Chuyên cần (`nap-chuyen-can`, `doi_tu`) | có mặt ở chốt tính thay buổi gốc | **như nhau** |
| Tình hình đi học (ADR 0010) | như chuyên cần | như chuyên cần |
| Nhắc lịch cụm | buổi chốt vào lịch cụm; bỏ buổi gốc | buổi chốt vào lịch cụm (nhãn học bù); buổi gốc không đổi |
| Phạm vi lớp hỗ trợ (ADR 0008/0011) | học viên đổi vào thuộc lớp chốt | như nhau |
| Thống kê | như cũ | tách theo loại |

Mỗi nơi phải có test cho nhánh `hoc_bu`.

## 6. Giao diện

- **Học viên**
  - Trang Lớp học + thẻ Buổi học sắp tới: dưới buổi đã qua có `hoc_bu_duoc` → dòng chữ nhỏ **"Đăng ký học bù buổi này?"** → `/de-nghi-doi-buoi?khoa=…&lich=…&loai=hoc_bu`. Buổi học bù đã duyệt: nhãn **Học bù** + "Học bù cho buổi {n} của {lớp gốc}".
  - Trang `/de-nghi-doi-buoi`: `loai=hoc_bu` → tiêu đề "Đăng ký học bù", "Còn x/N lượt học bù", mục "Buổi đã vắng" thay cho "Buổi sắp tới"; đề nghị hiện badge **Học bù**. Form, cảnh báo trùng lịch, sửa/hủy/đổi lại như đổi buổi.
- **Người duyệt** (màn Đổi buổi): badge **Học bù** trên thẻ, khối gốc ghi "Buổi đã vắng" (thay "Buổi gốc"), bộ lọc Loại (Tất cả / Đổi buổi / Học bù).
- **Quản trị**: ô số học bù ở trang khóa cạnh ô đổi buổi.
- Gọn như các màn hiện có (KhoiBuoi, ThanhSiSo, CanhBaoTrungLich).

## 7. Kiểm thử

- Rules: bảng `kiemTraGui`/`quyetDinhDuyet` cho `hoc_bu` (từng mã lỗi mới, thứ tự), `soLuotDaDung` tách loại; đổi buổi không đổi (chạy lại test cũ).
- Service: gửi học bù đọc `diem_danh` buổi gốc trong tx; duyệt học bù không chặn vì buổi gốc đã qua; `DA_CO_MAT` khi có mặt được ghi sau khi gửi; lượt tách loại; tổng quan `buoi_co_the_hoc_bu`.
- Từng nơi ở §5: 1 test nhánh `hoc_bu`.
- E2E: học viên vắng buổi 1 (import vắng) → đăng ký học bù buổi 1 lớp khác → duyệt → lịch có thêm buổi học bù, buổi 1 gốc vẫn vắng → nạp có mặt ở buổi học bù → chuyên cần buổi 1 = có mặt; sĩ số buổi gốc không giảm.
- FE: link học bù đúng điều kiện; trang `loai=hoc_bu`; badge và lọc ở màn duyệt; ô cấu hình khóa.

## 8. Deploy

1 migration chỉ thêm (enum + 2 cột default). Không đổi dữ liệu cũ (mọi dòng = `doi_buoi`). Sau deploy học bù tắt ở mọi khóa; Quản trị bật bằng ô "Số buổi học bù tối đa".
