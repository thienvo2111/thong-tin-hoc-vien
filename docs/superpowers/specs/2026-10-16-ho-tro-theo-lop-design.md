# Người hỗ trợ học viên theo lớp + xuất danh sách lớp — đặc tả

- Ngày: 2026-10-16
- Quyết định: [ADR 0008](../../adr/0008-nguoi-ho-tro-hoc-vien-theo-lop.md)
- Liên quan: ADR 0003 (hỗ trợ theo cụm), ADR 0007 (đổi buổi — đọc theo lớp giữ lớp gốc)

## 1. Bối cảnh

- Lớp Zoom có nhân sự hỗ trợ theo **lớp** (mở phòng, điểm danh, nhắc học viên vào học), khác nhóm Zalo theo **cụm** địa lý.
- Có người vừa hỗ trợ một cụm vừa hỗ trợ lớp Zoom; có người hỗ trợ nhiều lớp Zoom.
- Hiện phạm vi người hỗ trợ học viên chỉ là cụm → không tra cứu/sửa hồ sơ/cấp lại mật khẩu được cho học viên lớp mình ở cụm khác, không có danh sách lớp để đối chiếu.

## 2. Quyết định (tóm tắt ADR 0008)

| # | Nội dung |
|---|---|
| L1 | Bảng `phan_cong_ho_tro_lop` (nhiều–nhiều người ↔ lớp), cùng vai trò `ho_tro_hoc_vien`; 1 tài khoản giữ được cả cụm lẫn nhiều lớp |
| L2 | Phạm vi = cụm ∪ lớp gốc (`phan_lop_giai_doan`); đổi buổi không tính; vẫn `404` ngoài phạm vi |
| L3 | Với học viên của lớp: chi tiết, sửa hồ sơ, mật khẩu, báo vắng, đề nghị đổi lớp — như học viên trong cụm |
| L4 | Vẫn theo cụm: yêu cầu hỗ trợ, nhắc lịch, thống kê, duyệt đổi buổi, DS học viên hiện có, lịch học |
| L5 | Excel lớp có ngày sinh (người dùng chấp nhận rủi ro mật khẩu mặc định); (sửa 2026-10-17) có mã MOET ở DS/file lớp và buổi; không CCCD/nơi sinh; file cụm không đổi |
| L6 | Gán theo lớp, không theo buổi |
| L7 | (2026-10-17) Danh sách theo buổi = phân lớp − đổi ra + đổi vào qua `DoiBuoiHocQueryService`; đổi vào có trong DS/file buổi (cả ngày sinh) nhưng ngoài phạm vi sửa; đổi ra liệt kê riêng có ghi chú |
| L8 | (2026-10-17) DS buổi có điểm danh tại chính buổi (theo đăng ký của dòng) + tổng hợp; DS lớp có chuyên cần "có mặt / đã diễn ra" (đổi ra → tính buổi chốt) — §6c |

## 3. Dữ liệu

Migration `20261016200000_phan_cong_ho_tro_lop` — chỉ thêm bảng:

```sql
CREATE TABLE phan_cong_ho_tro_lop (
  id uuid PK DEFAULT gen_random_uuid(),
  nguoi_dung_id uuid NOT NULL → nguoi_dung ON DELETE CASCADE,
  lop_id uuid NOT NULL → lop_hoc ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (nguoi_dung_id, lop_id) uq_phan_cong_ho_tro_lop
);
CREATE INDEX idx_phan_cong_ho_tro_lop_lop ON phan_cong_ho_tro_lop(lop_id);
```

Rollback: `DROP TABLE "phan_cong_ho_tro_lop";`. Kiểm vai trò `ho_tro_hoc_vien` ở service (như cụm).

## 4. Phạm vi (`HoTroHocVienScopeService`)

- `lopIdsCuaToi(nguoiDungId)`; `whereDangKyTrongPhamVi(nguoiDungId)` → `{ OR: [{ cum_id in cụm }, { phan_lop_giai_doan some lop_id in lớp }] }` hoặc `null` khi chưa được gắn gì.
- `damBaoTrongPhamVi` dùng điều kiện trên (tự mở rộng cho chi tiết HV, sửa hồ sơ, gửi link/cấp mật khẩu tạm/mở khóa, hủy đề nghị đổi lớp).
- `VanHanhHocVienService.dangKyTrongCum` (báo vắng, đề nghị đổi lớp, lớp có thể đổi) chọn `dang_ky_hoc` theo cùng điều kiện.
- `damBaoLopCuaToi(nguoiDungId, lopId)` → `404` "Không tìm thấy lớp".
- Không đổi: yêu cầu hỗ trợ, nhắc lịch, thống kê, duyệt đổi buổi, `hoc-vien` + `hoc-vien/xuat`, `lich-hoc` (vẫn dùng `cumIdsCuaToi`).

## 5. API

Người hỗ trợ (`ho_tro_hoc_vien`; vai trò khác → `403`):

| Method | Path | Kết quả |
|---|---|---|
| GET | `/ho-tro-hoc-vien/lop-cua-toi` | `[{ lop_id, ten_lop, loai_lop, muc_nang_luc, nhom_hoc_vien, khoa: { id, ma_khoa, ten_khoa }, so_hoc_vien }]` sắp khóa → loại → tên |
| GET | `/ho-tro-hoc-vien/lop/xuat?lop_id=` | `.xlsx` 1 lớp hoặc mọi lớp; lớp không được gắn → `404` |
| GET | `/ho-tro-hoc-vien/lop/{lopId}/hoc-vien` | `{ lop, hoc_vien: [{ hoc_vien_id, ho_ten, ma_dinh_danh_moet, ngay_sinh, don_vi_cong_tac_ten, doi_tuong, so_dien_thoai_lien_he, email_lien_he, cum, giai_doan, day_du, dang_nhap_lan_cuoi, khao_sat, chuyen_can: { co_mat, da_dien_ra } }] }`; không được gắn → `404` |
| GET | `/ho-tro-hoc-vien/lop/{lopId}/buoi` | (L7) `[{ lich_id, giai_doan: { id, thu_tu, ten_giai_doan }, buoi_so, thoi_gian_bat_dau, thoi_gian_ket_thuc, si_so, so_doi_vao, so_doi_ra }]` sắp giai đoạn → buổi; `si_so` = phân lớp − ra + vào |
| GET | `/ho-tro-hoc-vien/lop/{lopId}/buoi/{lichId}/hoc-vien` | (L7) `{ lop, buoi (+ tong_diem_danh — L8), hoc_vien: [dòng lớp (không giai_doan/chuyen_can) + doi_buoi (null \| 'vao') + ghi_chu + diem_danh (L8)], doi_ra: [... doi_buoi 'ra', diem_danh null] }`; buổi không thuộc lớp → `404` "Không tìm thấy buổi học" |
| GET | `/ho-tro-hoc-vien/lop/{lopId}/buoi/xuat?lich_id=` | (L7) `.xlsx` 1 buổi hoặc mọi buổi của lớp (1 sheet/buổi) |

Quản trị:

| Method | Path | Kết quả |
|---|---|---|
| PUT | `/khoa-boi-duong/{id}/lop/{lopId}/nguoi-ho-tro` | `{ nguoi_dung_ids }` thay toàn bộ → `{ lop_id, nguoi_ho_tro: [{ id, ho_ten }] }`; id không phải `ho_tro_hoc_vien` → `400`; lớp khác khóa → `404`; vai trò khác → `403` |
| GET | `/khoa-boi-duong/{id}` | thêm `lop_hoc[].nguoi_ho_tro` (chỉ Quản trị) |
| GET | `/nguoi-dung/ho-tro` | thêm `lop_phu_trach: [{ lop_id, ten_lop, loai_lop, ma_khoa }]` |

## 6. Excel lớp

- 1 sheet/lớp, tên sheet = tên lớp (≤ 31 ký tự, bỏ ký tự cấm, trùng tên giữa các khóa → " (2)"); không có lớp → 1 sheet "Danh sách".
- Dòng 1: `Khóa <mã> – <tên khóa> · Lớp <loại>: <tên lớp>`; dòng 2 tiêu đề; cố định 2 dòng đầu.
- Cột: STT, Họ tên, Mã MOET (sửa 2026-10-17, ô văn bản), Ngày sinh (dd/mm/yyyy), Đơn vị công tác, Đối tượng, Số điện thoại, Email, Cụm hỗ trợ, Hồ sơ đầy đủ, Đã đăng nhập, Khảo sát (cách hiển thị như file cụm; nhân viên → "Không áp dụng"), Có mặt / đã diễn ra (L8, "x/y").
- Không CCCD/số định danh, nơi sinh. Tên file `ds-lop-ho-tro-<yyyymmdd>.xlsx`, `Cache-Control: no-store`, nhật ký `ho_tro_xuat_danh_sach_lop`.

## 6b. Danh sách theo buổi (L7, 2026-10-17)

- Buổi L (lớp C, giai đoạn G): học viên có `phan_lop_giai_doan (C, G)` − đổi ra của L + đổi vào L, lấy từ `DoiBuoiHocQueryService.dieuChinhTheoBuoi` (chỉ bản ghi `da_duyet` còn hiệu lực — phân lớp hiện tại ở giai đoạn buổi nguồn vẫn là lớp nguồn).
- Dòng đổi vào: `doi_buoi='vao'`, `ghi_chu='Đổi buổi – từ lớp <lớp nguồn>'`; vẫn ngoài phạm vi (L2) → giao diện không có link chi tiết.
- Dòng đổi ra: không tính vào danh sách, trả riêng `doi_ra` với `ghi_chu='Đã chuyển sang lớp <lớp chốt> – không học buổi này'`.
- Sắp xếp: thường + đổi vào chung theo họ tên (vi); đổi ra riêng theo họ tên.
- Excel: 1 sheet/buổi, tên `GĐ<thứ tự> B<buổi> dd-mm`; dòng 1 khóa · lớp, dòng 2 buổi + giờ (giờ VN) + số học viên, dòng 3 tổng hợp điểm danh (L8), dòng 4 tiêu đề (cột cơ bản của file lớp — không có cột chuyên cần — + **Điểm danh**, **Giờ tự điểm danh**, **Ghi chú**), cố định 4 dòng đầu. Có người đổi ra → 1 dòng trống, dòng đậm "Đã chuyển sang lớp khác (không học buổi này)", rồi các dòng đó (STT đánh lại). Tên file `ds-buoi-<yyyymmdd>.xlsx`, `no-store`, nhật ký `ho_tro_xuat_danh_sach_buoi`.

## 6c. Điểm danh & chuyên cần (L8, 2026-10-17)

- `diem_danh` mỗi dòng DS buổi = `{ ma, nhan, tu_diem_danh_luc, nguon_tinh, lop_tinh }` theo `dang_ky_hoc_id` của dòng (đổi vào: đăng ký của họ). **Sửa 2026-10-19 (ADR 0010 T7):** trạng thái = kết quả `tinhChuyenCan` (ADR 0005 Z8, như dashboard) cho `(giai_doan, buoi_so)` của buổi, trên mọi dòng `diem_danh` của đăng ký (mọi lớp; đổi buổi tính ở buổi chốt; học bù ở lớp trực tiếp khác luôn tính, ở lớp Zoom khác / lớp cũ chỉ khi khóa `cong_nhan_lop_cu`; trạng thái tốt nhất thắng, hòa → lớp hiện tại):
  - có kết quả từ lớp hiện tại (`nguon_tinh = 'lop_hien_tai'`): `co_mat` → "Có mặt – tự điểm danh HH:mm" (giờ VN) nếu có `tu_diem_danh_luc`, ngược lại "Có mặt (Zoom|Ký tên|QR|Thủ công)"; `vang` → "Vắng"; `vang_co_phep` → "Vắng có phép";
  - có kết quả từ lớp khác (`nguon_tinh = 'lop_khac'` — học bù hoặc lớp cũ, không tách được vì không lưu lịch sử phân lớp): "Có mặt – ở lớp X", "Vắng có phép – ở lớp X", "Vắng";
  - `lop_tinh = { id, ten_lop }` = lớp thật của dòng được dùng (`null` khi chưa có);
  - không có kết quả nhưng có `bao_vang` (đăng ký, buổi) → `da_bao_vang` "Đã báo vắng: <lý do>";
  - không có gì: buổi chưa bắt đầu → `chua_den_gio` "Chưa đến giờ", đã bắt đầu → `chua_diem_danh` "Chưa điểm danh".
- Đổi ra: `diem_danh = null`. `buoi.tong_diem_danh = { co_mat, vang, vang_co_phep, da_bao_vang, chua_diem_danh, chua_den_gio }` trên DS buổi. File buổi: cột "Điểm danh" = `nhan` (kèm lớp khi học bù / lớp cũ).
- `chuyen_can` mỗi dòng DS lớp: với mỗi buổi L của lớp ở giai đoạn đăng ký được phân vào lớp này, E = buổi chốt nếu đổi buổi `da_duyet` còn hiệu lực ra khỏi L (`doiBuoiDaDuyetCuaDangKy`), ngược lại L. `da_dien_ra` += 1 khi E đã bắt đầu; `co_mat` += 1 khi `tinhChuyenCan` của `(giai_doan, buoi_so)` của L = `co_mat`.
- ~~Khác `tinhChuyenCan`~~ — từ 2026-10-19 không còn lệch dashboard; chỉ khác ở mẫu số (buổi đã diễn ra của lớp đang xem).
- Truy vấn tập hợp (không N+1): buổi của lớp, đổi buổi hiệu lực, buổi chốt (`lichTomTat`); `napChuyenCan` (`backend/src/doi-buoi-hoc/nap-chuyen-can.ts`) = 1 SQL điểm danh mọi lớp + 1 SQL phân lớp cho mọi đăng ký; DS buổi thêm 1 truy vấn `bao_vang` mỗi buổi.

## 7. Giao diện

- Người hỗ trợ: menu **Lớp hỗ trợ** `/ho-tro/lop` — bảng Khóa, Loại lớp, Tên lớp, Mức, Sĩ số; nút "Xuất tất cả lớp", mỗi dòng "Xem danh sách" + "Xuất Excel". Rỗng: "Thầy/Cô chưa được gắn hỗ trợ lớp nào. Liên hệ Quản trị để được phân công."
- `/ho-tro/lop/:lopId`: đầu trang (khóa, loại, tên lớp), "Xuất Excel lớp này", bảng Họ tên (link chi tiết học viên), Mã MOET, Ngày sinh, Đơn vị, SĐT, Email, Cụm, Giai đoạn, Có mặt / đã diễn ra (L8). `404` → "Không tìm thấy lớp".
  - (L7) 2 tab: **Cả lớp** (bảng trên) và **Theo buổi**: chọn buổi (`GĐ<n> – Buổi <b> · dd/mm HH:mm · <sĩ số> HV`, mặc định buổi gần nhất chưa kết thúc), badge số đổi vào/ra, dòng tổng hợp "Có mặt x · Vắng y · Có phép z · Báo vắng b · Chưa điểm danh w" (L8), bảng có cột Mã MOET, Điểm danh (badge: có mặt xanh, vắng đỏ, có phép/báo vắng cam, còn lại xám), Ghi chú (dòng đổi vào tô nền + badge "Đổi vào", không link), mục "Đã chuyển sang lớp khác (không học buổi này)", nút "Xuất buổi này" / "Xuất tất cả buổi".
- Quản trị: cột **Người hỗ trợ lớp** (chọn nhiều, lưu ngay) ở bảng Lớp học của chi tiết khóa — dùng chung thành phần chọn với cụm; trang Người hỗ trợ thêm cột **Lớp phụ trách**.

## 8. Kiểm thử

- Unit `ho-tro-hoc-vien-scope.service.spec.ts`: trong phạm vi qua cụm / qua lớp / cả hai; ngoài phạm vi → 404; chỉ liên quan qua đổi buổi → ngoài phạm vi; gỡ lớp → ra ngay.
- Unit `xuat-danh-sach-lop.util.spec.ts`: cột có Ngày sinh dd/mm/yyyy, không MOET/CCCD, 1 sheet/lớp, rỗng → sheet chờ.
- E2E `test/ho-tro-theo-lop.e2e-spec.ts`: lop-cua-toi chỉ lớp của tôi; lớp khác → 404; xuất xlsx; sửa/xem học viên ngoài cụm qua lớp; học viên lớp không gắn/đổi buổi → 404; PUT gán/gỡ, 400 sai vai trò, 404 lớp khóa khác, 403 không phải Quản trị; `ho_tro_giang_vien` → 403.
- (L7) Unit `ho-tro-theo-buoi.service.spec.ts`, `xuat-danh-sach-buoi.util.spec.ts`; E2E `test/ho-tro-theo-buoi.e2e-spec.ts` (số buổi, đổi vào/ra, chờ duyệt/từ chối/mất hiệu lực không đổi DS, 404 buổi lớp khác/lớp không gắn, xuất 1/tất cả, đổi vào → chi tiết 404).
- (L8) Unit `diem-danh-lop-buoi.util.spec.ts` (nhãn mọi trường hợp, tổng hợp, chuyên cần: thường / đổi ra tính buổi chốt / bỏ buổi tương lai / chỉ giai đoạn phân vào lớp), bổ sung `ho-tro-theo-buoi.service.spec.ts`, 2 spec Excel (MOET, cột điểm danh/chuyên cần; file cụm vẫn không MOET); E2E `test/ho-tro-diem-danh-lop.e2e-spec.ts`.
- Frontend: `HoTroLop.test.tsx` (cả tab Theo buổi; L8: MOET 2 tab, badge điểm danh + dòng tổng hợp, cột Có mặt / đã diễn ra), `ChonNguoiHoTroCum.test.tsx` (phần lớp), `AdminNguoiHoTro.test.tsx` (cột Lớp phụ trách).
