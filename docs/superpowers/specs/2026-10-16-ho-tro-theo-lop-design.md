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
| L5 | Excel lớp có ngày sinh (người dùng chấp nhận rủi ro mật khẩu mặc định); không CCCD/MOET/nơi sinh |
| L6 | Gán theo lớp, không theo buổi |

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
| GET | `/ho-tro-hoc-vien/lop/{lopId}/hoc-vien` | `{ lop, hoc_vien: [{ hoc_vien_id, ho_ten, ngay_sinh, don_vi_cong_tac_ten, doi_tuong, so_dien_thoai_lien_he, email_lien_he, cum, giai_doan, day_du, dang_nhap_lan_cuoi, khao_sat }] }`; không được gắn → `404` |

Quản trị:

| Method | Path | Kết quả |
|---|---|---|
| PUT | `/khoa-boi-duong/{id}/lop/{lopId}/nguoi-ho-tro` | `{ nguoi_dung_ids }` thay toàn bộ → `{ lop_id, nguoi_ho_tro: [{ id, ho_ten }] }`; id không phải `ho_tro_hoc_vien` → `400`; lớp khác khóa → `404`; vai trò khác → `403` |
| GET | `/khoa-boi-duong/{id}` | thêm `lop_hoc[].nguoi_ho_tro` (chỉ Quản trị) |
| GET | `/nguoi-dung/ho-tro` | thêm `lop_phu_trach: [{ lop_id, ten_lop, loai_lop, ma_khoa }]` |

## 6. Excel lớp

- 1 sheet/lớp, tên sheet = tên lớp (≤ 31 ký tự, bỏ ký tự cấm, trùng tên giữa các khóa → " (2)"); không có lớp → 1 sheet "Danh sách".
- Dòng 1: `Khóa <mã> – <tên khóa> · Lớp <loại>: <tên lớp>`; dòng 2 tiêu đề; cố định 2 dòng đầu.
- Cột: STT, Họ tên, Ngày sinh (dd/mm/yyyy), Đơn vị công tác, Đối tượng, Số điện thoại, Email, Cụm hỗ trợ, Hồ sơ đầy đủ, Đã đăng nhập, Khảo sát (cách hiển thị như file cụm; nhân viên → "Không áp dụng").
- Không CCCD/số định danh, mã MOET, nơi sinh. Tên file `ds-lop-ho-tro-<yyyymmdd>.xlsx`, `Cache-Control: no-store`, nhật ký `ho_tro_xuat_danh_sach_lop`.

## 7. Giao diện

- Người hỗ trợ: menu **Lớp hỗ trợ** `/ho-tro/lop` — bảng Khóa, Loại lớp, Tên lớp, Mức, Sĩ số; nút "Xuất tất cả lớp", mỗi dòng "Xem danh sách" + "Xuất Excel". Rỗng: "Thầy/Cô chưa được gắn hỗ trợ lớp nào. Liên hệ Quản trị để được phân công."
- `/ho-tro/lop/:lopId`: đầu trang (khóa, loại, tên lớp), "Xuất Excel lớp này", bảng Họ tên (link chi tiết học viên), Ngày sinh, Đơn vị, SĐT, Email, Cụm, Giai đoạn. `404` → "Không tìm thấy lớp".
- Quản trị: cột **Người hỗ trợ lớp** (chọn nhiều, lưu ngay) ở bảng Lớp học của chi tiết khóa — dùng chung thành phần chọn với cụm; trang Người hỗ trợ thêm cột **Lớp phụ trách**.

## 8. Kiểm thử

- Unit `ho-tro-hoc-vien-scope.service.spec.ts`: trong phạm vi qua cụm / qua lớp / cả hai; ngoài phạm vi → 404; chỉ liên quan qua đổi buổi → ngoài phạm vi; gỡ lớp → ra ngay.
- Unit `xuat-danh-sach-lop.util.spec.ts`: cột có Ngày sinh dd/mm/yyyy, không MOET/CCCD, 1 sheet/lớp, rỗng → sheet chờ.
- E2E `test/ho-tro-theo-lop.e2e-spec.ts`: lop-cua-toi chỉ lớp của tôi; lớp khác → 404; xuất xlsx; sửa/xem học viên ngoài cụm qua lớp; học viên lớp không gắn/đổi buổi → 404; PUT gán/gỡ, 400 sai vai trò, 404 lớp khóa khác, 403 không phải Quản trị; `ho_tro_giang_vien` → 403.
- Frontend: `HoTroLop.test.tsx`, `ChonNguoiHoTroCum.test.tsx` (phần lớp), `AdminNguoiHoTro.test.tsx` (cột Lớp phụ trách).
