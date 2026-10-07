# Dashboard thống kê — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay `/admin/tong-quan` bằng dashboard 9 khối biểu đồ, lọc Khóa → Đơn vị|Cụm, tự thu hẹp theo vai trò; thêm `/ho-tro/thong-ke` cho người hỗ trợ học viên.

**Architecture:** Module NestJS mới `backend/src/thong-ke/`: một `ThongKeScopeService` dịch (user + bộ lọc) → `Prisma.dang_ky_hocWhereInput` (điểm phạm vi DUY NHẤT), mỗi khối một service method + endpoint dùng where đó. FE: một trang `DashboardThongKe` dựng bộ lọc từ `/thong-ke/bo-loc`, giữ lọc trên URL, mỗi khối một component + một TanStack query.

**Tech Stack:** NestJS + Prisma (Postgres), jest (unit `*.spec.ts`, e2e `backend/test/*.e2e-spec.ts`); React 18 + Mantine 7 + `@mantine/charts`, TanStack Query 5, vitest + msw.

**Spec:** `docs/superpowers/specs/2026-10-07-dashboard-thong-ke-design.md`

## Global Constraints

- Mọi chuỗi giao diện + thông báo lỗi tiếng Việt có dấu.
- Không thêm thư viện mới (biểu đồ dùng `@mantine/charts`; heatmap dựng CSS grid).
- Mọi endpoint `/thong-ke/*` lấy phạm vi CHỈ qua `ThongKeScopeService.resolve`; không service nào tự gọi `ScopeService` để lọc.
- Roles controller: `@Roles('quan_tri','so_gddt','phong_vhxh','truong','ho_tro_hoc_vien')`.
- Bộ lọc ngoài phạm vi → `ForbiddenAppException` (403). Bộ lọc sai dạng → `ValidationException` (400).
- `cum_id` bắt buộc kèm `khoa_id`; `don_vi_id` và `cum_id` loại trừ nhau; `ho_tro_hoc_vien` không được gửi `don_vi_id`; `so_gddt/phong_vhxh/truong` không được gửi `cum_id` (→ 400).
- `ket_qua_khao_sat` là theo học viên (unique `hoc_vien_id, loai`), KHÔNG theo khóa: "kết quả khảo sát trong khóa X" = kết quả của học viên có `dang_ky_hoc` khớp where.
- Loại khảo sát: `khao-sat` (kỹ năng số, không hiện mức), `danh-gia` (đầu vào), `dau-ra` (đầu ra). Hoàn thành = `trang_thai = 'hoan_thanh'`. Mức = `muc_goc` (M1..M4) đọc nhãn từ `ThangMucService.thang()`.
- `dang_ky_hoc.ket_qua = null` tính là `dang_hoc`.
- Ngưỡng: đơn vị < 5 HV bỏ khỏi xếp hạng; vắng ≥ 2 buổi (chỉ `trang_thai='vang'`, không tính `vang_co_phep`); VLE < 50.
- Khoảng VLE: `[0,25) [25,50) [50,75) [75,100]` — biên thuộc khoảng trên.
- Mẫu số 0 → tỷ lệ `null` ở API, "—" ở FE.
- Index cần thiết đã có (`uq_diem_danh(dang_ky_hoc_id,…)`, `uq_ket_qua_khao_sat_hoc_vien_loai`, `idx_dang_ky_khoa`, `idx_dang_ky_cum`) → không migration.
- Không phá API cũ: `/bao-cao/tong-quan` + `/xuat-excel` giữ nguyên shape và tham số.

## Review Focus

1. **Người dùng đơn vị có `don_vi_id = null`** (dữ liệu lỗi) → `resolve` phải trả phạm vi rỗng (mọi khối rỗng), không phải 'ALL'. Test ở Task 1.
2. **Người hỗ trợ chưa được phân công cụm nào** → mọi khối rỗng, `/bo-loc` trả `khoa: []`; không lỗi 500. Test ở Task 1.
3. **Khóa chưa có buổi học / chưa import điểm danh / chưa import VLE** → khối 7 trả mảng rỗng + FE hiện trạng thái rỗng đúng câu chữ. Test ở Task 5 và Task 12.
4. **Học viên có `muc_goc` ngoài thang (ví dụ 'M5' hoặc null)** → đếm vào "chưa xếp mức", không văng/không tạo ô ma trận lạ. Test ở Task 3.
5. **Tài khoản `truong` gọi `/xep-hang`** → response tuyệt đối không có tên/ID đơn vị khác. Test e2e ở Task 8.

---

## File Structure

**Backend — tạo mới `backend/src/thong-ke/`**
- `thong-ke.module.ts` — import PrismaModule, AuthModule (ScopeService), HoTroHocVienModule (scope cụm), SsoModule (ThangMucService).
- `thong-ke.controller.ts` — 9 route GET.
- `dto/thong-ke-query.dto.ts` — `ThongKeQueryDto`, `XepHangQueryDto`, `CanDonDocQueryDto`.
- `thong-ke-scope.service.ts` (+ `.spec.ts`) — phạm vi + bộ lọc.
- `thong-ke.service.ts` (+ `.spec.ts`) — khối 1–7.
- `xep-hang.service.ts` (+ `.spec.ts`) — khối 8.
- `can-don-doc.service.ts` (+ `.spec.ts`) — khối 9 + Excel.
- `thong-ke.types.ts` — mọi kiểu response.
- `backend/test/thong-ke.e2e-spec.ts`.

**Backend — sửa:** `src/app.module.ts` (đăng ký module), `src/bao-cao/bao-cao.service.ts` (tongQuan dùng scope mới), `src/bao-cao/bao-cao.module.ts`.

**Frontend — tạo mới**
- `src/api/thongKe.ts` — hooks query.
- `src/pages/ThongKe/DashboardThongKe.tsx` (+ `.test.tsx`) — khung trang, nhận prop `che_do: 'admin' | 'ho_tro'`.
- `src/pages/ThongKe/BoLocThongKe.tsx` (+ `.test.tsx`) — bộ lọc, đồng bộ URL.
- `src/pages/ThongKe/KhoiThongKe.tsx` — vỏ chung (tiêu đề, loading/rỗng/lỗi+thử lại).
- `src/pages/ThongKe/khoi/{KhoiKpiPheu,KhoiSoSanhKhoa,KhoiKhaoSat,KhoiChuyenMuc,KhoiKetQuaHoc,KhoiChuyenCan,KhoiXepHang,KhoiCanDonDoc}.tsx` (+ test cùng tên).
- `src/pages/ThongKe/mauMuc.ts` — màu M1–M4 cố định + `dinhDangTyLe(x: number|null): string`.
- `src/test/mocks/thongKe.ts` — fixture + handlers msw.

**Frontend — sửa:** `src/api/types.ts`, `src/router.tsx`, `src/pages/HoTro/HoTroLayout.tsx` (menu), `src/pages/Admin/AdminTongQuan.tsx` (render `<DashboardThongKe che_do="admin" />`), `src/pages/Admin/AdminTongQuan.test.tsx`, `src/test/mocks/handlers.ts`.

**Docs:** `docs/api-contract.md` §7, `CONTEXT.md`, spec §6.

---

### Task 1: ThongKeScopeService + DTO + `/thong-ke/bo-loc`

**Files:**
- Create: `backend/src/thong-ke/{thong-ke.module.ts, thong-ke.controller.ts, dto/thong-ke-query.dto.ts, thong-ke-scope.service.ts, thong-ke-scope.service.spec.ts, thong-ke.types.ts}`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `ScopeService.getAccessibleDonViIds`, `getKhoaIdsXemDuoc` (`backend/src/auth/scope/scope.service.ts`); `HoTroHocVienScopeService.cumIdsCuaToi(nguoiDungId)`.
- Produces:
  ```ts
  // dto/thong-ke-query.dto.ts (class-validator, @IsOptional @IsUUID)
  class ThongKeQueryDto { khoa_id?: string; don_vi_id?: string; cum_id?: string }
  // thong-ke-scope.service.ts
  interface PhamViThongKe {
    where: Prisma.dang_ky_hocWhereInput;   // đã gồm phạm vi ∩ bộ lọc
    rong: boolean;                          // true → service trả kết quả rỗng, không truy vấn
    khoaIds: string[] | 'ALL';              // khóa nằm trong where (sau lọc)
  }
  resolve(user: AuthenticatedUser, q: ThongKeQueryDto): Promise<PhamViThongKe>
  boLoc(user: AuthenticatedUser): Promise<BoLocResult>
  // thong-ke.types.ts
  interface BoLocResult {
    khoa: { id: string; ten_khoa: string }[];
    don_vi: { id: string; ten_don_vi: string; loai_don_vi: string }[] | null; // null = không hiện ô đơn vị
    cum: { id: string; ten_cum: string; khoa_id: string }[] | null;            // null = không hiện ô cụm
    don_vi_co_dinh: { id: string; ten_don_vi: string } | null;                 // truong
  }
  ```

**`resolve` — luật (where luôn là AND của các phần):**
- `quan_tri`: không giới hạn phạm vi.
- `so_gddt|phong_vhxh|truong`: `scope = getAccessibleDonViIds`; rỗng → `rong=true`. Áp R1/R2:
  `OR: [ { khoa: { don_vi_dat_hang_id: { in: scope } } }, { hoc_vien: { don_vi_cong_tac_id: { in: scope } } } ]`.
  (Tương đương `getHocVienScopeTrongKhoa` cho mọi khóa cùng lúc.)
- `ho_tro_hoc_vien`: `cumIds = cumIdsCuaToi(user.id)`; rỗng → `rong=true`; `cum_id: { in: cumIds }`.
- Lọc `khoa_id`: phải ∈ `getKhoaIdsXemDuoc` (đơn vị) / ∈ khóa của các cụm (hỗ trợ) → else 403; thêm `khoa_id`.
- Lọc `don_vi_id`: phải ∈ scope (quan_tri: bất kỳ) → else 403; thêm `hoc_vien: { don_vi_cong_tac_id: { in: collectDescendants(don_vi_id) } }` — dùng `getAccessibleDonViIds({vai_tro:'so_gddt', don_vi_id})` để lấy cây con.
- Lọc `cum_id`: quan_tri → cụm phải thuộc `khoa_id`; ho_tro → ∈ cumIds; else 403; thêm `cum_id`.

**`boLoc`:** quan_tri → mọi khóa, mọi đơn vị loai ≠ 'khac' (sắp theo tên), mọi cụm. so/phong → khóa xem được, đơn vị trong scope, `cum: null`. truong → khóa xem được, `don_vi: null`, `don_vi_co_dinh`. ho_tro → khóa của cụm phân công, `don_vi: null`, cụm phân công.

- [ ] **Step 1: Write failing tests `thong-ke-scope.service.spec.ts`** (mock Prisma + ScopeService + HoTroHocVienScopeService như pattern `bao-cao.service.spec.ts`):
  - `quan_tri không lọc → where {}` và `rong=false`.
  - `truong không lọc → where.OR chứa don_vi_dat_hang_id in [T1] và don_vi_cong_tac_id in [T1]`.
  - `so lọc don_vi_id con → where.AND chứa don_vi_cong_tac_id in cây con`.
  - `so lọc don_vi_id ngoài cây → ForbiddenAppException`.
  - `truong lọc khoa_id không thuộc getKhoaIdsXemDuoc → ForbiddenAppException`.
  - `ho_tro lọc cum_id không được phân công → ForbiddenAppException`.
  - `ho_tro gửi don_vi_id → ValidationException`; `truong gửi cum_id → ValidationException`.
  - `cum_id thiếu khoa_id → ValidationException`; `don_vi_id + cum_id → ValidationException`.
  - `quan_tri cum_id thuộc khóa khác khoa_id → ForbiddenAppException`.
  - `truong có don_vi_id null → rong=true` (Review Focus 1).
  - `ho_tro chưa phân công cụm → rong=true; boLoc().khoa = []` (Review Focus 2).
  - `boLoc truong → don_vi null, cum null, don_vi_co_dinh = {id:T1,…}`; `boLoc so → cum null`.
- [ ] **Step 2:** `cd backend && npx jest src/thong-ke/thong-ke-scope.service.spec.ts` → FAIL (module không tồn tại).
- [ ] **Step 3:** Implement DTO, service, module (đăng ký `app.module.ts`), controller với `GET /thong-ke/bo-loc` → `boLoc(user)`.
- [ ] **Step 4:** Chạy lại → PASS. `npx tsc --noEmit -p .` sạch.
- [ ] **Step 5:** Commit `feat(thong-ke): ThongKeScopeService + /thong-ke/bo-loc`.

---

### Task 2: Khối 1+2 — `/thong-ke/pheu`

**Files:** Modify `thong-ke.controller.ts`, `thong-ke.types.ts`; Create `thong-ke.service.ts`, `thong-ke.service.spec.ts`.

**Interfaces:**
- Consumes: `ThongKeScopeService.resolve`.
- Produces:
  ```ts
  interface PheuResult {
    tham_gia: number; da_truy_cap: number;
    khao_sat_ky_nang_so: number; danh_gia_dau_vao: number; danh_gia_dau_ra: number;
    ho_so_cho_duyet: number | null; // null nếu vai trò không duyệt (ho_tro_hoc_vien)
  }
  ThongKeService.pheu(user, q: ThongKeQueryDto): Promise<PheuResult>
  ```
- Mọi số đếm là **học viên phân biệt**: `prisma.hoc_vien.count({ where: { dang_ky_hoc: { some: where } , ... } })`.
  - `da_truy_cap`: thêm `nguoi_dung_account: { dang_nhap_lan_cuoi: { not: null } }`.
  - 3 khảo sát: thêm `ket_qua_khao_sat: { some: { loai, trang_thai: 'hoan_thanh' } }`.
  - `ho_so_cho_duyet`: tái dùng điều kiện hồ sơ chờ duyệt mà `AdminTongQuan` hiện lấy (đọc `frontend/src/pages/Admin/AdminTongQuan.tsx` để biết filter trạng thái đang dùng), giao với phạm vi.

- [ ] **Step 1: Failing tests** `describe('ThongKeService.pheu')`:
  - `rong=true → mọi số 0, không gọi prisma`.
  - `gọi hoc_vien.count 5 lần với where chứa dang_ky_hoc.some = where của scope` (assert argument).
  - `da_truy_cap where có nguoi_dung_account.dang_nhap_lan_cuoi not null`.
  - `ho_tro_hoc_vien → ho_so_cho_duyet null`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement + route `GET /thong-ke/pheu`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(thong-ke): khoi KPI + pheu tham gia`.

---

### Task 3: Khối 4+5 — `/thong-ke/khao-sat`, `/thong-ke/chuyen-muc`

**Files:** Modify `thong-ke.service.ts`, `.spec.ts`, controller, types. Module import `ThangMucService`.

**Interfaces:**
```ts
interface MucDem { ma: string; nhan: string; so_luong: number }
interface KhaoSatResult {
  ky_nang_so: { hoan_thanh: number; chua: number };
  dau_vao: { theo_muc: MucDem[]; chua_xep_muc: number; chua_lam: number };
  dau_ra:  { theo_muc: MucDem[]; chua_xep_muc: number; chua_lam: number };
}
interface ChuyenMucResult {
  thang: { ma: string; nhan: string }[];
  o: { tu: string; den: string; so_luong: number }[]; // mọi cặp trong thang×thang, kể cả 0
  tong: number; tang: number; giu: number; giam: number; // tỷ lệ tính ở FE
}
ThongKeService.khaoSat(user, q): Promise<KhaoSatResult>
ThongKeService.chuyenMuc(user, q): Promise<ChuyenMucResult>
```
- `khaoSat`: `ket_qua_khao_sat.groupBy({ by: ['loai','muc_goc'], where: { trang_thai:'hoan_thanh', hoc_vien: { dang_ky_hoc: { some: where } } }, _count })`; `chua_lam = tong HV (như pheu.tham_gia) − hoàn thành của loại đó`. `muc_goc` không thuộc thang hoặc null → `chua_xep_muc`.
- `chuyenMuc`: `findMany` `{hoc_vien_id, loai, muc_goc}` cho `loai in ['danh-gia','dau-ra']` hoàn thành trong phạm vi; ghép theo HV; chỉ HV có **cả hai** `muc_goc` thuộc thang. Thứ tự mức = chỉ số trong `thang` → tang/giu/giam.

- [ ] **Step 1: Failing tests:**
  - `khaoSat: muc_goc 'M5' và null rơi vào chua_xep_muc` (Review Focus 4).
  - `khaoSat: theo_muc luôn đủ 4 mức theo thứ tự thang, mức không có dữ liệu = 0`.
  - `chuyenMuc: HV chỉ có danh-gia bị loại; tong = số HV đủ hai đầu`.
  - `chuyenMuc: M2→M3 tăng, M3→M3 giữ, M3→M2 giảm; o có đủ 16 phần tử; tổng so_luong = tong`.
  - `chuyenMuc: HV có dau-ra muc_goc 'M5' bị loại`.
- [ ] **Step 2–4:** Run FAIL → implement + 2 route → PASS.
- [ ] **Step 5:** Commit `feat(thong-ke): khoi ket qua khao sat + ma tran chuyen muc`.

---

### Task 4: Khối 3+6 — `/thong-ke/ket-qua`, `/thong-ke/so-sanh-khoa`

**Interfaces:**
```ts
interface KetQuaHocCot { khoa_id: string; ten_khoa: string; dat: number; khong_dat: number; vang: number; dang_hoc: number }
ThongKeService.ketQuaHoc(user, q): Promise<KetQuaHocCot[]>   // groupBy ['khoa_id','ket_qua']; null→dang_hoc
interface SoSanhKhoaCot { khoa_id: string; ten_khoa: string; tham_gia: number;
  ty_le_truy_cap: number|null; ty_le_dau_vao: number|null; ty_le_dat: number|null }
ThongKeService.soSanhKhoa(user, q): Promise<SoSanhKhoaCot[]>
```
- `soSanhKhoa`: nếu `q.khoa_id` có → `ValidationException('So sánh khóa chỉ dùng khi chọn Tất cả khóa')`. Với mỗi khóa trong phạm vi: gọi lại logic `pheu` với where `AND [where, {khoa_id}]`; `ty_le_dat = dat / tham_gia`. Mẫu số 0 → null. Sắp theo `ten_khoa`.

- [ ] **Step 1: Failing tests:** `ketQuaHoc: ket_qua null đếm vào dang_hoc`; `ketQuaHoc: 2 khóa → 2 cột`; `soSanhKhoa có khoa_id → ValidationException`; `soSanhKhoa khóa 0 HV → các tỷ lệ null`.
- [ ] **Step 2–4:** FAIL → implement (tách hàm private `demPheu(where)` dùng chung với Task 2) → PASS.
- [ ] **Step 5:** Commit `feat(thong-ke): khoi ket qua hoc tap + so sanh khoa`.

---

### Task 5: Khối 7 — `/thong-ke/chuyen-can`

**Interfaces:**
```ts
interface BuoiChuyenCan { nhan: string; giai_doan_thu_tu: number; buoi_so: number;
  co_mat: number; vang_co_phep: number; vang: number; ty_le_co_mat: number|null }
interface VleKhoang { khoang: '0-25'|'25-50'|'50-75'|'75-100'; so_luong: number }
interface ChuyenCanResult { truc_tiep: BuoiChuyenCan[] | null; vle: { khoang: VleKhoang[]; chua_co_du_lieu: number } }
ThongKeService.chuyenCan(user, q): Promise<ChuyenCanResult>
```
- `truc_tiep`: `null` khi không có `q.khoa_id`. Ngược lại `diem_danh.groupBy({ by:['lich_hoc_id','trang_thai'], where: { dang_ky_hoc: where, lich_hoc: { lop: { loai_lop: { in: ['truc_tiep','zoom'] } } } } })`, rồi `lich_hoc_lop.findMany` lấy `buoi_so`, `giai_doan.thu_tu` → gộp theo khóa `(thu_tu, buoi_so)`, sắp tăng; `nhan = 'GĐ{thu_tu} · Buổi {buoi_so}'`.
- `vle`: `ket_qua_giai_doan.findMany({ where: { dang_ky_hoc: where, ty_le_hoan_thanh: { not: null } }, select: { ty_le_hoan_thanh } })` → chia khoảng (biên thuộc khoảng trên, 100 thuộc '75-100'). `chua_co_du_lieu = dang_ky_hoc.count({ where: { AND:[where, { ket_qua_giai_doan: { none: { ty_le_hoan_thanh: { not: null } } } }] } })`.

- [ ] **Step 1: Failing tests:** `không khoa_id → truc_tiep null`; `gộp 2 lớp cùng (GĐ1,B1) vào một cột`; `ty_le_co_mat = co_mat/(co_mat+vang+vang_co_phep)`; `VLE 25 → '25-50', 50 → '50-75', 75 → '75-100', 100 → '75-100', 0 → '0-25'`; `không có điểm danh → truc_tiep = []` (Review Focus 3).
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(thong-ke): khoi chuyen can (diem danh + VLE)`.

---

### Task 6: Khối 8 — `/thong-ke/xep-hang`

**Files:** Create `xep-hang.service.ts` + `.spec.ts`; DTO `XepHangQueryDto extends ThongKeQueryDto { chi_so: 'truy_cap'|'khao_sat'|'dat' }` (`@IsIn`).

**Interfaces:**
```ts
interface XepHangDong { don_vi_id: string; ten_don_vi: string; so_hv: number; gia_tri: number } // gia_tri 0..1
type XepHangResult =
  | { kieu: 'bang'; top: XepHangDong[]; bottom: XepHangDong[]; tong_so: number }
  | { kieu: 'vi_tri'; thu_hang: number | null; tong_so: number; gia_tri: number | null; trung_binh: number | null };
XepHangService.xepHang(user, q: XepHangQueryDto): Promise<XepHangResult>
```
- Nhóm xếp hạng:
  - `quan_tri`, không `don_vi_id` → đơn vị gốc (`don_vi_cha_id = null`), HV gộp theo cả cây con.
  - `quan_tri` có `don_vi_id`, hoặc `so_gddt/phong_vhxh` → mọi đơn vị `loai_don_vi='truong'` trong cây con của (`don_vi_id` ?? `user.don_vi_id`).
  - `truong` → các trường trong cây con của `don_vi_cha_id` của trường mình; trả `kieu:'vi_tri'`. **Lưu ý:** tập so sánh nằm ngoài phạm vi thường của trường — chỉ trả số tổng hợp, không trả `don_vi_id`/`ten_don_vi` nào.
  - `ho_tro_hoc_vien` → `ForbiddenAppException`.
- Dữ liệu: `dang_ky_hoc.findMany({ where: <khoa_id lọc nếu có, KHÔNG áp OR R1/R2 cho nhánh truong — chỉ giới hạn theo tập trường so sánh>, select: { hoc_vien_id, ket_qua, hoc_vien: { select: { don_vi_cong_tac_id, nguoi_dung_account: { select: { dang_nhap_lan_cuoi } }, ket_qua_khao_sat: { where: { loai:'danh-gia', trang_thai:'hoan_thanh' }, select: { id: true } } } } } })` → gộp trong Node theo đơn vị (map con→nhóm). Với các vai trò khác dùng `resolve().where`.
- `gia_tri`: truy_cap = HV đã đăng nhập/HV; khao_sat = HV có danh-gia hoàn thành/HV; dat = lượt `ket_qua='dat'`/lượt đăng ký. Bỏ đơn vị `so_hv < 5`. Sắp giảm dần; `top` 10 đầu, `bottom` 10 cuối (đảo thứ tự, không trùng khi `tong_so ≤ 10` → bottom `[]`). `thu_hang` 1-based; `null` nếu trường mình < 5 HV. `trung_binh` = trung bình `gia_tri` các đơn vị hợp lệ.

- [ ] **Step 1: Failing tests:** `đơn vị 4 HV bị loại, 5 HV được giữ`; `top giảm dần, tối đa 10`; `tong_so ≤ 10 → bottom rỗng`; `truong → kieu vi_tri, JSON.stringify(result) không chứa id/tên trường khác` (Review Focus 5); `truong < 5 HV → thu_hang null nhưng trung_binh có`; `quan_tri không don_vi_id → gộp HV của phòng/trường con vào Sở gốc`; `ho_tro → Forbidden`.
- [ ] **Step 2–4:** FAIL → implement + route → PASS.
- [ ] **Step 5:** Commit `feat(thong-ke): khoi xep hang don vi`.

---

### Task 7: Khối 9 — `/thong-ke/can-don-doc` (+ Excel)

**Files:** Create `can-don-doc.service.ts` + `.spec.ts`. DTO `CanDonDocQueryDto extends ThongKeQueryDto { loai: 'chua_truy_cap'|'chua_khao_sat'|'vang_nhieu'|'vle_thap'; page?: number (≥1, mặc định 1) }`; page size cố định 20.

**Interfaces:**
```ts
interface CanDonDocDong { hoc_vien_id: string; ho_ten: string; ten_don_vi: string; ten_khoa: string;
  so_dien_thoai: string|null; email: string|null; chi_tiet: string } // "Vắng 3 buổi", "VLE 42%", ""
interface CanDonDocResult { tong: number; page: number; items: CanDonDocDong[] }
CanDonDocService.danhSach(user, q): Promise<CanDonDocResult>
CanDonDocService.xuatExcel(user, q): Promise<Buffer>  // mọi dòng, không phân trang
```
- Đơn vị dòng = `dang_ky_hoc` (một HV hai khóa → hai dòng).
- `chua_truy_cap`: `hoc_vien.nguoi_dung_account` null hoặc `dang_nhap_lan_cuoi` null.
- `chua_khao_sat`: không có `ket_qua_khao_sat` `loai='danh-gia'` hoàn thành.
- `vang_nhieu`: `diem_danh.groupBy({ by:['dang_ky_hoc_id'], where:{ trang_thai:'vang', dang_ky_hoc: where }, having: { dang_ky_hoc_id: { _count: { gte: 2 } } } })`.
- `vle_thap`: có `ket_qua_giai_doan.ty_le_hoan_thanh < 50`; `chi_tiet` = mức thấp nhất.
- Excel: dùng helper/style trong `bao-cao/util/report-excel.util.ts` (đọc file chọn hàm tạo workbook phù hợp); cột: STT, Họ tên, Đơn vị, Khóa, SĐT, Email, Chi tiết. Route `GET /thong-ke/can-don-doc/xuat-excel` trả `Content-Disposition` như các route Excel trong `bao-cao.controller.ts`.

- [ ] **Step 1: Failing tests:** `vang_nhieu: đúng 2 buổi 'vang' → có; 1 'vang' + 1 'vang_co_phep' → không`; `vle_thap: 49.99 có, 50 không`; `chua_truy_cap: không có tài khoản → có`; `page 2 → skip 20`; `xuatExcel trả Buffer có header 'Họ tên'` (đọc lại bằng exceljs).
- [ ] **Step 2–4:** FAIL → implement + 2 route → PASS.
- [ ] **Step 5:** Commit `feat(thong-ke): khoi can don doc + xuat Excel`.

---

### Task 8: E2E `/thong-ke/*`

**Files:** Create `backend/test/thong-ke.e2e-spec.ts` (theo pattern `bao-cao.e2e-spec.ts` + tạo người hỗ trợ/cụm theo `ho-tro-hoc-vien.e2e-spec.ts`).

Fixture: Sở → Phòng → {T1 (6 HV), T2 (5 HV), T3 (3 HV)}; Sở → TruongKhac (5 HV). Khóa A đặt hàng bởi Phòng; Khóa B đặt hàng bởi TruongKhac, có 1 HV của T1. Cụm C1 (khóa A) gán người hỗ trợ H; 1 HV ở T1 học cả A và B.

- [ ] **Step 1: Write tests:**
  - `quan_tri GET /thong-ke/pheu (không lọc) → tham_gia = 24 HV phân biệt` (HV học 2 khóa đếm 1).
  - `truong T1 GET /pheu?khoa_id=B → tham_gia = 1` (R2: chỉ HV của mình trong khóa đơn vị khác đặt).
  - `phong GET /pheu?khoa_id=A → toàn bộ HV khóa A` (R1).
  - `truong T1 GET /pheu?don_vi_id=T2 → 403`; `truong T1 ?cum_id=… → 400`.
  - `ho_tro H GET /pheu → chỉ HV cụm C1`; `ho_tro H ?cum_id=<cụm khác> → 403`; `ho_tro H GET /xep-hang → 403`.
  - `truong T1 GET /xep-hang?chi_so=truy_cap → kieu 'vi_tri', tong_so = 2 (T3 < 5 bị loại), body không chứa id T2/T3/TruongKhac` (Review Focus 5).
  - `hoc_vien GET /thong-ke/pheu → 403`.
  - `GET /thong-ke/can-don-doc/xuat-excel → 200, content-type xlsx`.
- [ ] **Step 2:** `cd backend && npm run test:e2e -- thong-ke` → PASS (sửa code nếu fail; lưu ý memory: DB dev có đợt 1 mở tới 05/10 có thể làm fail e2e khác — chỉ xét file này).
- [ ] **Step 3:** Commit `test(thong-ke): e2e pham vi va du lieu dashboard`.

---

### Task 9: `/bao-cao/tong-quan` dùng scope mới (vá R1/R2)

**Files:** Modify `backend/src/bao-cao/bao-cao.service.ts:673-762`, `bao-cao.module.ts`, `bao-cao.service.spec.ts`, `backend/test/bao-cao.e2e-spec.ts`.

**Interfaces:** Consumes `ThongKeScopeService.resolve(user, { khoa_id, don_vi_id: query.don_vi_cong_tac_id })`. Export `ThongKeScopeService` từ `ThongKeModule`, import vào `BaoCaoModule`.

- `tongQuanDangKyHocWhere` → `AND: [phamVi.where, <lọc ngày ngay_dang_ky như cũ>]`; `phamVi.rong` → `emptyTongQuan()`. Shape `TongQuanResult` không đổi.

- [ ] **Step 1: Failing test e2e** trong `bao-cao.e2e-spec.ts`: `truong gọi /bao-cao/tong-quan?khoa_id=<khóa đơn vị khác đặt có HV mình> → chỉ đếm HV của mình`; và test hiện có của quan_tri vẫn đúng số.
- [ ] **Step 2:** Run → FAIL (hiện tính khóa theo đơn vị HV nhưng không áp R1 — phong không thấy toàn bộ khóa mình đặt).
- [ ] **Step 3:** Implement; cập nhật mock trong `bao-cao.service.spec.ts` (thay `scopeService` bằng mock `ThongKeScopeService.resolve`).
- [ ] **Step 4:** `npx jest src/bao-cao && npm run test:e2e -- bao-cao` → PASS.
- [ ] **Step 5:** Commit `fix(bao-cao): tong-quan ap R1/R2 qua ThongKeScopeService`.

---

### Task 10: FE — API, mocks, bộ lọc, khung dashboard, khối KPI/phễu

**Files:** Create `src/api/thongKe.ts`, `src/test/mocks/thongKe.ts`, `src/pages/ThongKe/{DashboardThongKe,BoLocThongKe,KhoiThongKe,mauMuc}.tsx|ts`, `khoi/KhoiKpiPheu.tsx` + tests. Modify `src/api/types.ts` (copy types Task 1–7 nguyên tên), `src/test/mocks/handlers.ts` (spread handlers từ `thongKe.ts`).

**Interfaces:**
```ts
// src/api/thongKe.ts — mỗi khối một hook, queryKey ['thong-ke', khoi, loc], staleTime 60_000
type LocThongKe = { khoa_id?: string; don_vi_id?: string; cum_id?: string };
useBoLocThongKe(): UseQueryResult<BoLocResult>
usePheu(loc), useKhaoSat(loc), useChuyenMuc(loc), useKetQuaHoc(loc), useSoSanhKhoa(loc, enabled),
useChuyenCan(loc), useXepHang(loc & {chi_so}, enabled), useCanDonDoc(loc & {loai, page}); xuatCanDonDoc(loc&{loai}): Promise<void>
// BoLocThongKe: đọc/ghi URLSearchParams (khoa_id, don_vi_id, cum_id); đổi khóa → xóa cum_id; chọn đơn vị ↔ xóa cụm và ngược lại
function useLocTuUrl(): [LocThongKe, (l: LocThongKe) => void]
// KhoiThongKe props
{ tieu_de: string; query: UseQueryResult<unknown>; rong: boolean; thong_bao_rong?: string; children: ReactNode }
// mauMuc.ts
export const MAU_MUC: Record<'M1'|'M2'|'M3'|'M4', string>; // đỏ.6, cam.6, xanh dương.6, xanh lá.7 (Mantine)
export function dinhDangTyLe(x: number | null): string; // null → '—', 0.783 → '78,3%'
```
- 403 từ bất kỳ khối → notification "Bộ lọc nằm ngoài phạm vi quyền" + `setLoc({})`.
- `DashboardThongKe({ che_do })`: render bộ lọc + các khối theo thứ tự spec §4; `che_do='ho_tro'` không render khối Xếp hạng.

- [ ] **Step 1: Failing tests:**
  - `BoLocThongKe`: `quan_tri: ô cụm disabled khi chưa chọn khóa`; `truong: không có ô đơn vị, hiện tên trường cố định`; `so: không có ô cụm`; `chọn khóa ghi khoa_id lên URL`; `đổi khóa xóa cum_id`.
  - `KhoiThongKe`: `loading → skeleton`; `lỗi → nút 'Thử lại' gọi refetch`; `rong → thong_bao_rong`.
  - `KhoiKpiPheu`: `hiện 4 thẻ đúng số fixture`; `% so với thẻ trước`; `tham_gia 0 → '—'`.
  - `mauMuc`: `dinhDangTyLe(null)='—'`, `dinhDangTyLe(0.783)='78,3%'`.
- [ ] **Step 2:** `cd frontend && npx vitest run src/pages/ThongKe` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS; `npx tsc --noEmit` sạch.
- [ ] **Step 5:** Commit `feat(fe-thong-ke): bo loc, khung dashboard, khoi KPI/pheu`.

---

### Task 11: FE — khối So sánh khóa, Khảo sát, Chuyển mức, Kết quả học

**Files:** Create `khoi/{KhoiSoSanhKhoa,KhoiKhaoSat,KhoiChuyenMuc,KhoiKetQuaHoc}.tsx` + tests.

- `KhoiSoSanhKhoa`: `BarChart` nhóm (3 series tỷ lệ ×100); chỉ render khi `!loc.khoa_id` (query `enabled` cùng điều kiện).
- `KhoiKhaoSat`: hai `DonutChart` (màu `MAU_MUC`) + chú thích "Chưa xếp mức"; dòng Kỹ năng số "x/y hoàn thành" (không mức).
- `KhoiChuyenMuc`: CSS grid (n+1)×(n+1), nền ô `alpha(MAU chính, so_luong/max)`, `aria-label="Từ {tu} sang {den}: {so_luong} học viên"`; dòng "X% tăng mức · Y% giữ nguyên · Z% giảm" (`dinhDangTyLe`). `tong = 0` → rỗng "Chưa có học viên đủ kết quả đầu vào và đầu ra".
- `KhoiKetQuaHoc`: `BarChart type="percent"` 4 series Đạt/Không đạt/Vắng/Đang học.

- [ ] **Step 1: Failing tests:** `so sánh khóa ẩn khi có khoa_id trên URL`; `khảo sát hiện 'Chưa xếp mức: 2'` (fixture); `chuyển mức: ô M2→M3 có aria-label đúng số`; `chuyển mức tong 0 → câu rỗng`; `kết quả học: chú thích đủ 4 nhãn`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(fe-thong-ke): khoi so sanh khoa, khao sat, chuyen muc, ket qua hoc`.

---

### Task 12: FE — khối Chuyên cần, Xếp hạng, Cần đôn đốc

**Files:** Create `khoi/{KhoiChuyenCan,KhoiXepHang,KhoiCanDonDoc}.tsx` + tests.

- `KhoiChuyenCan`: `Tabs` "Trực tiếp / Zoom" | "VLE".
  - Trực tiếp: `truc_tiep === null` → "Chọn một khóa để xem"; `[]` → "Chưa có dữ liệu điểm danh"; else `CompositeChart` (3 bar stack + line `ty_le_co_mat`).
  - VLE: tổng khoảng = 0 → "Chưa có dữ liệu tiến trình VLE"; else `BarChart` 4 khoảng + text "Chưa có dữ liệu: n".
- `KhoiXepHang`: `SegmentedControl` chỉ số (Truy cập / Khảo sát / Đạt). `kieu='bang'` → 2 `BarChart orientation="vertical"` Top/Bottom; `kieu='vi_tri'` → thẻ "Thứ {thu_hang}/{tong_so} · Trường bạn {gia_tri} · Trung bình {trung_binh}" (`thu_hang null` → "Chưa đủ 5 học viên để xếp hạng").
- `KhoiCanDonDoc`: `Tabs` 4 loại; `Table` + `Pagination` (20/trang); nút "Xuất Excel" gọi `xuatCanDonDoc`.

- [ ] **Step 1: Failing tests:** `chuyên cần không khoa → 'Chọn một khóa để xem'`; `điểm danh rỗng → 'Chưa có dữ liệu điểm danh'`; `VLE rỗng → 'Chưa có dữ liệu tiến trình VLE'` (Review Focus 3); `xếp hạng vi_tri hiện 'Thứ 3/12'`; `xếp hạng thu_hang null → câu chưa đủ 5`; `đổi chỉ số gọi API với chi_so mới`; `cần đôn đốc: đổi tab gọi loai mới, page reset 1`; `nút Xuất Excel gọi endpoint xuat-excel`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(fe-thong-ke): khoi chuyen can, xep hang, can don doc`.

---

### Task 13: Gắn route, menu, docs

**Files:** Modify `src/pages/Admin/AdminTongQuan.tsx` (thay toàn bộ nội dung bằng `<AdminPageHeader …/>` + `<DashboardThongKe che_do="admin" />`), `AdminTongQuan.test.tsx` (viết lại: render được, có bộ lọc, có khối KPI), `src/router.tsx` (thêm `/ho-tro/thong-ke` → `pages/HoTro/HoTroThongKe.tsx` = `<DashboardThongKe che_do="ho_tro" />`), `HoTroLayout.tsx` (menu `{ to: '/ho-tro/thong-ke', nhan: 'Thống kê', end: false }`), `src/test/mocks/db.ts`+`handlers.ts` (giữ mock `/bao-cao/tong-quan` cho AdminBaoCao). Docs: `docs/api-contract.md` §7 thêm mục `/thong-ke/*` (bảng endpoint + query + shape từ `thong-ke.types.ts`), `CONTEXT.md` thêm "Dashboard thống kê", spec §6 sửa câu `$queryRaw` → "khối 5, 8 lấy cột tối thiểu qua `findMany` theo where phạm vi rồi gộp trong Node; index đã đủ, không migration".

- [ ] **Step 1: Failing tests:** `AdminTongQuan render bộ lọc + thẻ 'Tham gia'`; `HoTroThongKe không có khối 'Xếp hạng đơn vị'`; menu hỗ trợ có link "Thống kê".
- [ ] **Step 2–4:** FAIL → implement → PASS. Chạy toàn bộ: `cd frontend && npx vitest run` và `cd backend && npx jest` → PASS.
- [ ] **Step 5:** Kiểm tra trực quan: chạy dev server qua preview, đăng nhập bằng tài khoản seed quan_tri và một tài khoản trường, chụp màn hình dashboard (light + mobile 375px).
- [ ] **Step 6:** Commit `feat(thong-ke): gan dashboard vao /admin/tong-quan va /ho-tro/thong-ke; docs` rồi `git push`.
