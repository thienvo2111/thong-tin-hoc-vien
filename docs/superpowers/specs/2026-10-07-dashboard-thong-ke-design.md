# Dashboard thống kê — Thiết kế (đợt 1)

Ngày: 2026-10-07 · Trạng thái: chờ duyệt

## 1. Mục tiêu

Thay trang `/admin/tong-quan` bằng dashboard chủ yếu là biểu đồ, lọc nhiều cấp
(tất cả khóa → 1 khóa → 1 đơn vị **hoặc** 1 cụm), tự thu hẹp dữ liệu theo vai trò
tài khoản. Trả lời được: bao nhiêu HV tham gia/truy cập/làm khảo sát, kết quả
khảo sát ra sao, bồi dưỡng có nâng mức không, HV có đi học không, đơn vị nào
làm tốt/kém, cần đôn đốc ai.

## 2. Quyết định đã chốt

| # | Quyết định |
|---|---|
| D1 | Lọc theo cụm: `quan_tri` (mọi cụm) + `ho_tro_hoc_vien` (chỉ cụm được phân công, không lọc đơn vị). |
| D2 | Phạm vi đợt 1: lõi + ma trận chuyển mức + tỷ lệ Đạt + xếp hạng đơn vị + danh sách cần đôn đốc. |
| D3 | "Tất cả khóa": KPI đếm HV duy nhất; có khối "So sánh khóa"; các khối khác gộp, đếm theo lượt `dang_ky_hoc`. |
| D4 | Tài khoản `truong` thấy thứ hạng của mình + trung bình Sở cha, không thấy tên trường khác. |
| D5 | Kiến trúc: mỗi khối một endpoint, dùng chung `ThongKeScopeService`. Không cache/snapshot. |
| D6 | "Cấp sở" gồm `so_gddt` và `phong_vhxh` (giữ nguyên ngữ nghĩa cây đơn vị hiện có). |

## 3. Phạm vi và bộ lọc

| Vai trò | Khóa chọn được | Đơn vị chọn được | Cụm chọn được |
|---|---|---|---|
| `quan_tri` | tất cả | tất cả | tất cả (khi đã chọn 1 khóa) |
| `so_gddt` / `phong_vhxh` | khóa xem được theo R1/R2 | đơn vị con (BFS `don_vi_cha_id`) | — |
| `truong` | khóa xem được theo R1/R2 | cố định trường mình | — |
| `ho_tro_hoc_vien` | khóa có cụm được phân công | — | cụm được phân công |

- DTO chung: `ThongKeQueryDto { khoa_id?, don_vi_id?, cum_id? }`. `cum_id` cần `khoa_id`.
  `don_vi_id` và `cum_id` loại trừ nhau.
- `ThongKeScopeService.resolve(user, dto)` → `Prisma.dang_ky_hocWhereInput`
  = giao (phạm vi tài khoản ∩ bộ lọc). Là **chỗ duy nhất** chứa logic phạm vi:
  cây đơn vị (`ScopeService.getAccessibleDonViIds`), R1/R2
  (`getKhoaIdsXemDuoc`, `getHocVienScopeTrongKhoa`), cụm hỗ trợ
  (`ho-tro-hoc-vien-scope.service.ts`). Tái sử dụng các service này, không viết lại.
- Bộ lọc chứa ID ngoài phạm vi → `403 ForbiddenException` (thông báo tiếng Việt).
- Endpoint `GET /thong-ke/bo-loc` trả danh sách khóa/đơn vị/cụm chọn được cho
  tài khoản hiện tại (FE dựng bộ lọc từ đây, không tự suy).

## 4. Các khối (thứ tự trên trang)

Module backend mới `backend/src/thong-ke/`. Roles mặc định của controller:
`quan_tri, so_gddt, phong_vhxh, truong, ho_tro_hoc_vien`.
Thư viện FE: `@mantine/charts`. Màu mức M1→M4 cố định toàn dashboard.

| # | Khối | Endpoint | Biểu đồ | Ghi chú |
|---|---|---|---|---|
| 1 | KPI | `/thong-ke/pheu` | 4 thẻ: Tham gia · Đã truy cập · Đã làm KS đầu vào · Đã làm KS đầu ra, kèm % so với thẻ trước | "Tất cả khóa": đếm HV duy nhất. Truy cập = `nguoi_dung.dang_nhap_lan_cuoi` not null. Thẻ "Hồ sơ chờ duyệt" giữ cho vai trò có quyền duyệt. |
| 2 | Phễu tham gia | (cùng `/pheu`) | Cột ngang: Tham gia → Truy cập → KS kỹ năng số → Đánh giá đầu vào → Đầu ra | Hiện số + % rơi rụng mỗi bước. Hoàn thành = `ket_qua_khao_sat.trang_thai = hoan_thanh` theo `loai` (`khao-sat`, `danh-gia`, `dau-ra`). |
| 3 | So sánh khóa | `/thong-ke/so-sanh-khoa` | Cột nhóm theo khóa: % truy cập, % hoàn thành KS đầu vào, % Đạt | Chỉ hiện khi không chọn khóa. |
| 4 | Kết quả khảo sát | `/thong-ke/khao-sat` | 2 donut: phân bố `muc_goc` M1–M4 đầu vào / đầu ra + "chưa xếp mức" | KS kỹ năng số chỉ đếm hoàn thành/chưa, không hiện mức (giữ hành vi commit be46730). Thang mức đọc từ `thang-muc.service.ts`. |
| 5 | Ma trận chuyển mức | `/thong-ke/chuyen-muc` | Heatmap 4×4 (dòng = mức đầu vào, cột = mức đầu ra), CSS grid tự dựng | Chỉ HV có cả 2 kết quả hoàn thành. Dòng tóm tắt "X% tăng · Y% giữ · Z% giảm". |
| 6 | Kết quả học tập | `/thong-ke/ket-qua` | Cột chồng 100%: Đạt / Không đạt / Vắng / Đang học (`dang_ky_hoc.ket_qua`) | "Tất cả khóa": mỗi khóa 1 cột. |
| 7 | Chuyên cần | `/thong-ke/chuyen-can` | Tab **Trực tiếp/Zoom**: cột chồng theo `buoi_so` (Có mặt/Vắng có phép/Vắng) + đường % có mặt. Tab **VLE**: phân bố `ket_qua_giai_doan.ty_le_hoan_thanh` theo 0–25/25–50/50–75/75–100 + "chưa có dữ liệu" | Tab Trực tiếp/Zoom yêu cầu chọn 1 khóa. Chưa import VLE → thông báo "Chưa có dữ liệu tiến trình VLE". |
| 8 | Xếp hạng đơn vị | `/thong-ke/xep-hang?chi_so=truy_cap\|khao_sat\|dat` | Cột ngang top 10 / bottom 10 | `quan_tri`: xếp hạng Sở/Phòng, chọn 1 Sở/Phòng → xếp hạng trường con. `so_gddt`/`phong_vhxh`: các trường con. `truong`: chỉ trả `{thu_hang, tong_so, gia_tri, trung_binh_so}` — **không** trả tên đơn vị khác. Bỏ đơn vị < 5 HV. Không áp dụng cho `ho_tro_hoc_vien` (ẩn khối). |
| 9 | Cần đôn đốc | `/thong-ke/can-don-doc?loai=chua_truy_cap\|chua_khao_sat\|vang_nhieu\|vle_thap&page` (+ `/xuat-excel`) | Bảng phân trang, tab theo `loai` | Ngưỡng hằng số: vắng ≥ 2 buổi, VLE < 50%. |

## 5. Xử lý lỗi và trạng thái

- Mỗi khối là một query TanStack độc lập: loading / rỗng / lỗi (nút "Thử lại") riêng.
- Mẫu số 0 → hiển thị "—", không `NaN%`.
- 403 do bộ lọc → thông báo + reset bộ lọc về mặc định.
- Khối cần 1 khóa khi chưa chọn → "Chọn một khóa để xem".

## 6. Hiệu năng

- Phần lớn khối tổng hợp trong DB (`groupBy`/`count`). Khối 5 và 8 lấy cột tối thiểu qua `findMany` theo `where` phạm vi rồi gộp trong Node (không dùng `$queryRaw`).
- Index cần thiết đã có (`uq_diem_danh`, `uq_ket_qua_khao_sat_hoc_vien_loai`, `idx_dang_ky_khoa`, `idx_dang_ky_cum`) — không migration.
- FE `staleTime: 60s`. Không cache phía server.

## 7. Frontend

- Thay nội dung `frontend/src/pages/Admin/AdminTongQuan.tsx` bằng
  `pages/ThongKe/DashboardThongKe.tsx` + mỗi khối một component trong
  `pages/ThongKe/khoi/`. Bộ lọc là component `BoLocThongKe` đọc `/thong-ke/bo-loc`;
  trạng thái lọc giữ trên URL query (chia sẻ link được).
- Route: `/admin/tong-quan` (giữ nguyên) và `/ho-tro/thong-ke` (mới, trong cổng
  `RequireHoTro`, thêm mục menu hỗ trợ).
- API client: `frontend/src/api/thongKe.ts`; types trong `api/types.ts`.

## 8. Tương thích ngược

- Giữ `GET /bao-cao/tong-quan` và `/bao-cao/tong-quan/xuat-excel` (AdminBaoCao dùng
  Excel), giữ tham số `tu_ngay`/`den_ngay`. Bên trong chuyển sang
  `ThongKeScopeService` → vá thiếu R1/R2 hiện có.
- Cập nhật `docs/api-contract.md` §7 (thêm mục `/thong-ke/*`) và thêm thuật ngữ
  "Dashboard thống kê" vào `CONTEXT.md`.

## 9. Test (theo yêu cầu)

**Backend**
- `ThongKeScopeService`: ma trận 5 vai trò × {không lọc, lọc trong phạm vi, lọc
  ngoài phạm vi → 403, khóa bị loại theo R1, HV bị giới hạn theo R2, cụm không
  được phân công → 403, `cum_id` không kèm `khoa_id` → 400, `don_vi_id`+`cum_id` → 400}.
- Mỗi endpoint trên fixture có số đếm biết trước:
  - phễu: các bước không tăng, đếm đúng;
  - KPI "Tất cả khóa": HV học 2 khóa đếm 1;
  - chuyển mức: bỏ HV thiếu một đầu; tổng ô = số HV đủ hai đầu;
  - kết quả học tập: đủ 4 trạng thái;
  - chuyên cần: theo `buoi_so`; VLE đúng khoảng, biên 25/50/75 thuộc khoảng trên;
  - xếp hạng: loại đơn vị < 5 HV; response cho `truong` không chứa tên/ID đơn vị khác;
  - cần đôn đốc: đúng ngưỡng (vắng đúng 2 buổi được tính, 1 buổi không).
- `/bao-cao/tong-quan`: số liệu cũ không đổi với `quan_tri`; tài khoản đơn vị bị lọc theo R1/R2.

**Frontend (vitest + msw)**
- Bộ lọc hiện đúng trường theo vai trò (cụm chỉ cho `quan_tri`/`ho_tro_hoc_vien`;
  `truong` không có chọn đơn vị); chọn cụm bị khóa khi chưa chọn khóa.
- Mỗi khối: loading, rỗng, lỗi + thử lại, có dữ liệu.
- Khối 3 chỉ hiện khi "Tất cả khóa"; khối 8 hiện thẻ thứ hạng cho `truong`, ẩn với `ho_tro_hoc_vien`.
- Mẫu số 0 hiển thị "—".

## 10. Ngoài phạm vi (đợt sau)

Nhóm hỗ trợ (yêu cầu hỗ trợ, thời gian phản hồi, hài lòng, báo vắng, đổi lớp);
tiến độ theo thời gian (lũy kế đăng nhập/khảo sát); heatmap lớp × buổi;
tích hợp API VLE (giữ import vào `ket_qua_giai_doan`); ngưỡng cấu hình được;
cache/snapshot.
