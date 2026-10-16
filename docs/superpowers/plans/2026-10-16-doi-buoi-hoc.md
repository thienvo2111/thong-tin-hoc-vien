# Học viên đề nghị đổi buổi học — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Học viên tự đề nghị đổi 1 buổi sang buổi tương đương của lớp khác; Quản trị / người hỗ trợ cụm duyệt theo sĩ số buổi và hàng đợi thời điểm gửi.

**Architecture:** Bảng mới `doi_buoi_hoc` (không đụng `phan_lop_giai_doan`). Mọi nhánh nghiệp vụ là hàm thuần trong `doi-buoi-hoc.rules.ts`; `DoiBuoiHocQueryService` (module không phụ thuộc, import được từ mọi nơi) tính sĩ số buổi và danh sách đổi ra/vào; `DoiBuoiHocService` + 2 controller (học viên, người duyệt) đọc → gọi hàm thuần → ghi. Các màn đọc theo **buổi** gọi query service.

**Tech Stack:** NestJS + Prisma 5 + PostgreSQL; React + TanStack Query + Vitest; Jest/ts-jest.

**Spec:** `docs/superpowers/specs/2026-10-16-doi-buoi-hoc-design.md` · ADR: `docs/adr/0007-hoc-vien-de-nghi-doi-buoi-hoc.md`

## Global Constraints

- Migration **chỉ thêm**: bảng `doi_buoi_hoc`, cột `khoa_boi_duong.so_buoi_doi_toi_da SMALLINT NOT NULL DEFAULT 0 CHECK (0..50)`, unique một phần `uq_doi_buoi_hoat_dong` — SQL đúng như spec §1.
- `so_buoi_doi_toi_da = 0` = tắt; endpoint học viên trả 403 "Khóa học chưa mở đề nghị đổi buổi".
- `ly_do` / `ghi_chu` bắt buộc: `normalize('NFC').trim()`, 5–500 ký tự.
- "Đã bắt đầu" = `thoi_gian_bat_dau <= now`.
- Mọi chuyển trạng thái = `updateMany` có điều kiện trạng thái cũ; 0 dòng → `ConflictAppException('Đề nghị đã được xử lý')`.
- Ngoài phạm vi cụm → `NotFoundAppException('Không tìm thấy đề nghị')` (404, không 403).
- Nhật ký: `hanh_dong` `de_nghi_doi_buoi` và `duyet_doi_buoi`, nhóm `hoc_tap`.
- Test: chạy **đúng file**, `--forceExit` cho jest, `vitest run` (không watch); không chạy toàn bộ e2e.
- Mỗi commit kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` rồi `git push` ngay.

## Review Focus

1. **Phân lớp gốc đổi sau khi đã duyệt đổi buổi** (Quản trị import phân lớp lại): bản ghi `da_duyet` có buổi nguồn không còn thuộc lớp được phân → phải bị bỏ qua khi tính sĩ số/danh sách, không trừ nhầm lớp cũ. Test ở Task 3.
2. **Hai tab gửi cùng buổi nguồn** → vi phạm `uq_doi_buoi_hoat_dong` (Prisma `P2002`) phải thành 409, không 500. Test ở Task 4.
3. **Hai đề nghị cho 2 buổi nguồn khác nhau gửi đồng thời khi còn 1 lượt** → không được vượt N: POST/PUT khóa `pg_advisory_xact_lock(hashtext('doi_buoi_dk:'||dang_ky_hoc_id))` trước khi đếm lượt. Test ở Task 4.
4. **Lớp đích bị ngưng (`trang_thai = inactive`) sau khi gửi** → duyệt trả 400 "không tương đương", không 500. Test ở Task 1 (`laBuoiTuongDuong`) + Task 5.
5. **Học viên mở link Zalo khi khóa đang tắt hoặc không có khóa nào** → trang hiện thông báo, không trắng trang/lỗi. Test ở Task 8.

---

## File structure

**Backend — tạo mới `backend/src/doi-buoi-hoc/`**
- `doi-buoi-hoc.rules.ts` — kiểu dữ liệu + hàm thuần (Task 1).
- `doi-buoi-hoc-query.service.ts`, `doi-buoi-hoc-query.module.ts` — sĩ số/đổi ra-vào theo buổi; module chỉ có provider này, không import gì (PrismaModule là `@Global`) để tránh vòng phụ thuộc (Task 3).
- `doi-buoi-hoc.service.ts` — nghiệp vụ gửi/sửa/hủy/duyệt/từ chối/hủy duyệt (Task 4, 5).
- `doi-buoi-hoc-hoc-vien.controller.ts` (`@Controller('hoc-vien/toi')`), `doi-buoi-hoc.controller.ts` (`@Controller('doi-buoi-hoc')`), `dto/doi-buoi-hoc.dto.ts`, `doi-buoi-hoc.module.ts`.

**Backend — sửa**: `prisma/schema.prisma`, migration mới, `app.module.ts`, `khoa-boi-duong/dto/update-khoa-boi-duong.dto.ts`, `nhat-ky/nhat-ky.service.ts`, `trang-lop/trang-lop.service.ts`, `diem-danh/diem-danh.service.ts`, `khoa-boi-duong/khoa-boi-duong.service.ts`, `ho-tro-hoc-vien/ho-tro-hoc-vien.service.ts`, `nhac-lich/nhac-lich.service.ts`.

**Frontend**: `api/doiBuoi.ts` (mới), `pages/HocVien/DeNghiDoiBuoi.tsx` (mới), `pages/HoTro/DuyetDoiBuoi.tsx` (mới, dùng chung cho Quản trị), sửa `M3/TheBuoiSapToi.tsx`, `M7/ThongTinLopHoc.tsx`, `Admin/AdminKhoaChiTiet.tsx`, `Admin/AdminVanHanh.tsx`, `router.tsx`, menu khu hỗ trợ + admin.

> Lệch spec §6 (đã cập nhật spec): `BaoVangDoiLop.tsx` là component trong chi tiết học viên, không có tab — màn duyệt là **trang mới** `/ho-tro/doi-buoi` (menu "Đổi buổi" + badge) và `/admin/doi-buoi`.

---

### Task 1: Hàm thuần nghiệp vụ

**Files:**
- Create: `backend/src/doi-buoi-hoc/doi-buoi-hoc.rules.ts`
- Test: `backend/src/doi-buoi-hoc/doi-buoi-hoc.rules.spec.ts`

**Interfaces — Produces:**
```ts
export interface LichTomTat {
  id: string; lop_id: string; giai_doan_id: string; buoi_so: number;
  thoi_gian_bat_dau: Date;
  lop: { khoa_id: string; loai_lop: loai_lop_hoc; muc_nang_luc: muc_nang_luc | null;
         trang_thai: trang_thai_active; si_so_toi_da: number | null; ten_lop: string };
}
export type MaLoiDoiBuoi =
  | 'KHOA_TAT' | 'HET_LUOT' | 'KHONG_THUOC_LOP' | 'KHONG_TUONG_DUONG'
  | 'DA_BAT_DAU' | 'BUOI_DAY' | 'LY_DO' | 'DA_XU_LY' | 'PHAN_LOP_DOI' | 'GIU_CHO';
export type KetQuaKiemTra = { ok: true } | { ok: false; ma: MaLoiDoiBuoi; thong_diep: string };

laBuoiTuongDuong(nguon: LichTomTat, dich: LichTomTat): boolean
daBatDau(lich: { thoi_gian_bat_dau: Date }, now: Date): boolean
tinhSiSoBuoi(x: { so_phan_lop: number; so_doi_ra: number; so_doi_vao: number }): number
conChoChoDeNghi(x: { si_so: number; si_so_toi_da: number | null; so_truoc: number }): boolean
soLuotDaDung(ds: { trang_thai: trang_thai_de_nghi }[]): number
chuanHoaLyDo(s: string | undefined): string | null        // NFC+trim; null nếu ngoài 5..500
kiemTraGui(x: {
  so_buoi_doi_toi_da: number; so_luot_da_dung: number;
  buoi_nguon: LichTomTat; buoi_dich: LichTomTat; lop_phan_hien_tai: string | null;
  si_so_dich: number; ly_do: string | undefined;
}, now: Date): KetQuaKiemTra
quyetDinhDuyet(x: {
  vai_tro: 'quan_tri' | 'ho_tro_hoc_vien'; trang_thai: trang_thai_de_nghi;
  buoi_nguon: LichTomTat; buoi_chot: LichTomTat; lop_phan_hien_tai: string | null;
  si_so: number; so_truoc: number;
}, now: Date): { ket_qua: 'duyet' | 'chan'; ma?: MaLoiDoiBuoi; thong_diep?: string; canh_bao: string[] }
thuTuHang(deNghi: { id: string; tao_luc: Date }, dsCho: { id: string; tao_luc: Date }[]): { k: number; n: number }
HTTP_THEO_MA: Record<MaLoiDoiBuoi, 400 | 403 | 409>
```

- [ ] **Step 1: Viết test bảng (`it.each`)** — tạo factory `lich(over?: Partial<...>)` mặc định: khóa K, gđ G, buổi 2, `truc_tiep`, `co_ban`, active, tối đa 30, bắt đầu `now + 1 ngày`. Kịch bản bắt buộc:
  - `laBuoiTuongDuong`: cùng lớp → false; khác `buoi_so` / `giai_doan_id` / `khoa_id` / `loai_lop` / `muc_nang_luc` → false; nguồn `null` + đích `null` → true; nguồn `null` + đích `co_ban` → false; đích `inactive` → false; hợp lệ → true.
  - `daBatDau`: `now − 1ms` → true; đúng `now` → true; `now + 1 phút` → false.
  - `tinhSiSoBuoi({so_phan_lop:28, so_doi_ra:2, so_doi_vao:3})` → 29.
  - `conChoChoDeNghi`: `{si_so:28,toi_da:30,so_truoc:1}` → true; `{29,30,1}` → false; `{30,30,0}` → false; `{100,null,50}` → true.
  - `soLuotDaDung([cho_duyet, da_duyet, tu_choi, da_huy])` → 2.
  - `chuanHoaLyDo`: `'  abcd '` → null; `'a'.repeat(501)` → null; `' Bận họp '` → `'Bận họp'`.
  - `kiemTraGui` — mỗi mã lỗi 1 dòng, theo thứ tự kiểm: `KHOA_TAT` (toi_da 0) → `HET_LUOT` (đã dùng = N) → `KHONG_THUOC_LOP` (`lop_phan_hien_tai !== buoi_nguon.lop_id`) → `KHONG_TUONG_DUONG` → `DA_BAT_DAU` (nguồn hoặc đích) → `BUOI_DAY` (`si_so_dich >= toi_da`, toi_da khác null) → `LY_DO`; hợp lệ → `{ok:true}`.
  - `quyetDinhDuyet`: `trang_thai≠cho_duyet` → chan `DA_XU_LY`; buổi đã bắt đầu → `DA_BAT_DAU`; không tương đương → `KHONG_TUONG_DUONG`; `lop_phan_hien_tai≠buoi_nguon.lop_id` → `PHAN_LOP_DOI`; hỗ trợ cụm + đầy (`si_so>=toi_da`, so_truoc 0) → `BUOI_DAY` thông điệp `'Buổi đã đủ sĩ số 30/30 — chọn buổi khác'`; hỗ trợ cụm + còn 1 chỗ + so_truoc 1 → `GIU_CHO` thông điệp `'Còn 1 chỗ, có 1 đề nghị gửi trước đang chờ — cần xử lý trước'`; quản trị cùng 2 tình huống → `duyet` với `canh_bao.length === 1`; hợp lệ → `duyet`, `canh_bao: []`.
  - `thuTuHang`: 3 đề nghị `tao_luc` t1<t2<t3, hỏi t2 → `{k:2,n:3}`.
  - `HTTP_THEO_MA`: `KHOA_TAT`→403; `DA_XU_LY`,`PHAN_LOP_DOI`,`BUOI_DAY`,`GIU_CHO`→409; còn lại →400.

- [ ] **Step 2: Chạy, xác nhận FAIL** — `cd backend && npx jest src/doi-buoi-hoc/doi-buoi-hoc.rules.spec.ts --forceExit` → "Cannot find module './doi-buoi-hoc.rules'".
- [ ] **Step 3: Cài đặt** các hàm trên. Thông điệp lỗi tiếng Việt cho mã còn lại: `KHOA_TAT` "Khóa học chưa mở đề nghị đổi buổi"; `HET_LUOT` "Bạn đã dùng hết {N} lượt đổi buổi của khóa"; `KHONG_THUOC_LOP` "Buổi này không thuộc lớp của bạn"; `KHONG_TUONG_DUONG` "Buổi chọn không tương đương với buổi của bạn"; `DA_BAT_DAU` "Buổi đã bắt đầu, không thể đổi"; `BUOI_DAY` (gửi) "Buổi đã đủ sĩ số, hãy chọn buổi khác"; `LY_DO` "Lý do phải từ 5 đến 500 ký tự"; `PHAN_LOP_DOI` "Phân lớp của học viên đã thay đổi — hãy từ chối"; `DA_XU_LY` "Đề nghị đã được xử lý". Cảnh báo quản trị: `'Vượt sĩ số {si_so+1}/{toi_da}'` / `'Vượt thứ tự: {so_truoc} đề nghị gửi trước đang chờ'`.
- [ ] **Step 4: Chạy lại → PASS** (< 3 giây).
- [ ] **Step 5: Commit** `feat(doi-buoi): ham thuan kiem tra gui va duyet doi buoi` + push.

---

### Task 2: Migration, schema, cấu hình khóa, nhật ký

**Files:**
- Create: `backend/prisma/migrations/20261016120000_doi_buoi_hoc/migration.sql`
- Modify: `backend/prisma/schema.prisma` (model `doi_buoi_hoc`; quan hệ ngược trên `dang_ky_hoc`, `lich_hoc_lop` ×3 tên quan hệ `doi_buoi_nguon`/`doi_buoi_de_nghi`/`doi_buoi_chot`, `nguoi_dung` ×2 `doi_buoi_nguoi_tao`/`doi_buoi_nguoi_xu_ly`; cột `so_buoi_doi_toi_da Int @default(0) @db.SmallInt` trên `khoa_boi_duong`)
- Modify: `backend/src/khoa-boi-duong/dto/update-khoa-boi-duong.dto.ts` (`@IsOptional() @IsInt() @Min(0) @Max(50) so_buoi_doi_toi_da?: number`), chỗ `select` khóa trả về trường này (tìm cùng chỗ trả `mo_dieu_chinh_muc`)
- Modify: `backend/src/nhat-ky/nhat-ky.service.ts` — thêm `'de_nghi_doi_buoi' | 'duyet_doi_buoi'`, nhãn "Đề nghị đổi buổi"/"Duyệt đổi buổi", nhóm `hoc_tap`
- Modify: `frontend/src/pages/Admin/AdminKhoaChiTiet.tsx` + test — ô số "Số buổi tối đa học viên được đề nghị đổi (0 = tắt)" cạnh công tắc `mo_dieu_chinh_muc`, PATCH `{ so_buoi_doi_toi_da }`

- [ ] **Step 1: Viết migration** — SQL đúng spec §1 (bảng, 2 CHECK, `uq_doi_buoi_hoat_dong`, 3 index, cột khóa). Đầu file comment: ngày, ADR 0007, "chỉ thêm, không đụng dữ liệu cũ".
- [ ] **Step 2: Cập nhật schema.prisma** (partial index và CHECK chỉ có trong SQL, như các migration trước), chạy `cd backend && npx prisma validate && npx prisma migrate deploy && npx prisma generate` trên DB dev (container Docker) → áp dụng thành công; `npx prisma migrate status` báo "Database schema is up to date".
- [ ] **Step 3: Test FE trước** — trong `AdminKhoaChiTiet.test.tsx`: `it('quan_tri: nhập 3 → PATCH khóa so_buoi_doi_toi_da=3')` assert body `[{ so_buoi_doi_toi_da: 3 }]`. Chạy `cd frontend && npx vitest run src/pages/Admin/AdminKhoaChiTiet.test.tsx` → FAIL.
- [ ] **Step 4: Cài DTO + select + ô nhập FE**; chạy lại → PASS; `cd backend && npx tsc --noEmit -p tsconfig.json` sạch.
- [ ] **Step 5: Commit** `feat(doi-buoi): migration doi_buoi_hoc + cau hinh so buoi doi toi da` + push. Message ghi rõ "CÓ migration 20261016120000 (chỉ thêm)".

---

### Task 3: `DoiBuoiHocQueryService`

**Files:**
- Create: `backend/src/doi-buoi-hoc/doi-buoi-hoc-query.service.ts`, `doi-buoi-hoc-query.module.ts`
- Test: `backend/src/doi-buoi-hoc/doi-buoi-hoc-query.service.spec.ts` (Prisma giả bằng object `jest.fn()`)

**Interfaces:**
- Consumes: `LichTomTat`, `tinhSiSoBuoi`, `daBatDau` (Task 1).
- Produces:
```ts
type Db = PrismaService | Prisma.TransactionClient;
lichTomTat(ids: string[], db?: Db): Promise<Map<string, LichTomTat>>
siSoBuoi(lichIds: string[], now: Date, db?: Db):
  Promise<Map<string, { si_so: number; si_so_toi_da: number | null; so_cho_duyet: number }>>
dieuChinhTheoBuoi(lichIds: string[]): Promise<Map<string, {
  ra:  { dang_ky_hoc_id: string; lop_chot: { id: string; ten_lop: string } }[];
  vao: { dang_ky_hoc_id: string; lich_nguon_id: string; lop_nguon: { id: string; ten_lop: string } }[];
}>>
doiBuoiDaDuyetCuaDangKy(dangKyIds: string[]): Promise<{ dang_ky_hoc_id: string; lich_nguon_id: string; lich_chot_id: string }[]>
```
- Bản ghi `da_duyet` **chỉ hiệu lực** khi `phan_lop_giai_doan` hiện tại của đăng ký ở giai đoạn buổi nguồn = lớp của buổi nguồn (Review Focus 1). Lọc bằng 1 truy vấn `phan_lop_giai_doan` theo các cặp `(dang_ky_hoc_id, giai_doan_id)` rồi so trong bộ nhớ.
- `so_cho_duyet` không tính khi buổi đã bắt đầu (`daBatDau`).

- [ ] **Step 1: Test** — `siSoBuoi`: phân lớp 28, 2 `da_duyet` ra, 3 vào → 29; 1 bản ghi ra của học viên đã bị phân sang lớp khác → bị bỏ qua (si_so = 28 − 1 + 3 = 30 với 1 ra hiệu lực); `so_cho_duyet` đếm đúng; `dieuChinhTheoBuoi` trả `ra`/`vao` với tên lớp; bản ghi mất hiệu lực không xuất hiện.
- [ ] **Step 2: Chạy** `npx jest src/doi-buoi-hoc/doi-buoi-hoc-query.service.spec.ts --forceExit` → FAIL.
- [ ] **Step 3: Cài đặt**; module `@Module({ providers: [DoiBuoiHocQueryService], exports: [DoiBuoiHocQueryService] })`.
- [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** `feat(doi-buoi): query service si so va doi ra/vao theo buoi` + push.

---

### Task 4: API học viên

**Files:**
- Create: `backend/src/doi-buoi-hoc/dto/doi-buoi-hoc.dto.ts`, `doi-buoi-hoc.service.ts` (phần học viên), `doi-buoi-hoc-hoc-vien.controller.ts`, `doi-buoi-hoc.module.ts`
- Modify: `backend/src/app.module.ts` (thêm `DoiBuoiHocModule`)
- Test: `backend/src/doi-buoi-hoc/doi-buoi-hoc.service.spec.ts`

**Interfaces:**
- Consumes: Task 1 rules, Task 3 query service, `NhatKyService` (global).
- DTO: `GuiDoiBuoiDto { @IsUUID() lich_nguon_id; @IsUUID() lich_de_nghi_id; @IsString() ly_do }` (độ dài kiểm bằng `chuanHoaLyDo`).
- Produces (service, `user: AuthenticatedUser`, dùng `user.hoc_vien_id`):
```ts
tongQuanHocVien(user, khoaId: string): Promise<{ so_buoi_doi_toi_da: number; so_luot_da_dung: number;
  buoi_sap_toi: { lich_nguon: LichTomTat; de_nghi: DeNghiHocVien | null }[]; de_nghi: DeNghiHocVien[] }>
luaChonHocVien(user, lichNguonId: string): Promise<LuaChonBuoi[]>
gui(user, dto: GuiDoiBuoiDto): Promise<{ id: string }>
sua(user, id: string, dto: GuiDoiBuoiDto): Promise<{ id: string }>
huyHocVien(user, id: string): Promise<{ trang_thai: 'da_huy' }>
// DeNghiHocVien = { id, trang_thai, lich_nguon_id, lich_de_nghi_id, lich_chot_id, ly_do, tao_luc, ghi_chu_xu_ly, qua_han: boolean, thu_tu_hang: {k,n} | null }
// LuaChonBuoi   = { lich: LichTomTat; si_so: number; si_so_toi_da: number | null; so_cho_duyet: number; da_du: boolean }
```
- Routes (`@Roles('hoc_vien')`): `GET doi-buoi?khoa_id=`, `GET doi-buoi/lua-chon/:lichNguonId`, `POST doi-buoi`, `PUT doi-buoi/:id`, `POST doi-buoi/:id/huy`.
- `gui`/`sua`: trong `$transaction`, **đầu tiên** `SELECT pg_advisory_xact_lock(hashtext('doi_buoi_dk:' || $1))` với `dang_ky_hoc_id`; đếm lượt; `kiemTraGui`; lỗi → exception theo `HTTP_THEO_MA`; `create`. `P2002` → `ConflictAppException('Buổi này đã có đề nghị đang chờ hoặc đã duyệt')`. `sua`: `updateMany({id, trang_thai:'cho_duyet', dang_ky_hoc_id}) → da_huy` (0 → 409) rồi `create` với cùng `lich_nguon_id` (khác → 400). Nhật ký `de_nghi_doi_buoi` sau transaction.
- Đăng ký không phải của caller → 404.

- [ ] **Step 1: Test service (mock Prisma, `$transaction` gọi callback với tx giả)** — `it('gui: khoa tat -> 403')`; `it('gui: goi advisory lock truoc khi dem luot')` (thứ tự `tx.$executeRaw`/`$queryRaw` trước `tx.doi_buoi_hoc.count`); `it('gui: P2002 -> 409')`; `it('sua: updateMany 0 dong -> 409, khong create')`; `it('sua: tao_luc moi, luot khong tang')` (count lượt trả 1 với N=1 vẫn qua vì bản cũ đã hủy trong cùng tx); `it('huy: dang ky cua nguoi khac -> 404')`.
- [ ] **Step 2: FAIL** — `npx jest src/doi-buoi-hoc/doi-buoi-hoc.service.spec.ts --forceExit`.
- [ ] **Step 3: Cài service + controller + module + app.module.**
- [ ] **Step 4: PASS**; `npx tsc --noEmit` sạch.
- [ ] **Step 5: Commit** `feat(doi-buoi): API hoc vien gui/sua/huy de nghi doi buoi` + push.

---

### Task 5: API người duyệt

**Files:**
- Create: `backend/src/doi-buoi-hoc/doi-buoi-hoc.controller.ts`
- Modify: `doi-buoi-hoc.service.ts`, `doi-buoi-hoc.module.ts` (import `HoTroHocVienModule` để lấy `HoTroHocVienScopeService`)
- Test: `doi-buoi-hoc.service.spec.ts` (thêm `describe('nguoi duyet')`)

**Interfaces:**
- Consumes: `HoTroHocVienScopeService.cumIdsCuaToi(nguoiDungId)`, Task 1, Task 3.
- Produces:
```ts
danhSach(user, q: { trang_thai?: trang_thai_de_nghi; khoa_id?: string }): Promise<DeNghiDuyet[]>   // take 500
demChoDuyet(user): Promise<number>                    // cho_duyet, chưa quá hạn
luaChonDuyet(user, id): Promise<(LuaChonBuoi & { so_truoc: number; duyet_duoc: boolean })[]>
duyet(user, id, dto: { lich_chot_id?: string; ghi_chu?: string }): Promise<{ trang_thai: 'da_duyet'; canh_bao: string[] }>
tuChoi(user, id, dto: { ghi_chu: string }): Promise<{ trang_thai: 'tu_choi' }>
huyDuyet(user, id, dto: { ghi_chu: string }): Promise<{ trang_thai: 'da_huy' }>
// DeNghiDuyet = DeNghiHocVien + { hoc_vien: { id, ho_ten, don_vi, cum }, buoi_nguon, buoi_de_nghi, buoi_chot, si_so, si_so_toi_da, so_cho_duyet, nguoi_xu_ly }
```
- Routes `@Roles('quan_tri', 'ho_tro_hoc_vien')`: `GET /doi-buoi-hoc`, `GET /doi-buoi-hoc/dem-cho-duyet`, `GET /doi-buoi-hoc/:id/lua-chon`, `POST /doi-buoi-hoc/:id/duyet|tu-choi|huy-duyet`.
- Phạm vi: `ho_tro_hoc_vien` → `where.dang_ky_hoc.cum_id in cumIdsCuaToi`; đề nghị ngoài phạm vi → 404.
- `duyet` theo đúng spec §4: lock `hashtext('doi_buoi:' || lich_chot_id)` **trước** `siSoBuoi(..., tx)`; `so_truoc` = đếm `cho_duyet` có `lich_de_nghi_id = lich_chot_id`, `tao_luc <` đề nghị, buổi chưa bắt đầu; `quyetDinhDuyet`; `updateMany` có điều kiện; nhật ký `duyet_doi_buoi` với `chi_tiet { de_nghi_id, lich_nguon_id, lich_de_nghi_id, lich_chot_id, vuot_si_so, vuot_thu_tu }`.
- `huyDuyet`: buổi nguồn hoặc buổi chốt đã bắt đầu → 400.

- [ ] **Step 1: Test** — `duyet: lock truoc khi doc si so`; `duyet: ho tro cum + day -> 409 BUOI_DAY`; `duyet: quan tri + day -> da_duyet + canh_bao`; `duyet: chot buoi khac -> updateMany data.lich_chot_id = buoi khac`; `duyet: cum khac -> 404`; `duyet: lop dich inactive -> 400` (Review Focus 4); `tuChoi: ghi chu 3 ky tu -> 400`; `huyDuyet: buoi da bat dau -> 400`; `demChoDuyet: khong dem qua han`.
- [ ] **Step 2: FAIL** → **Step 3: cài** → **Step 4: PASS** (`npx jest src/doi-buoi-hoc --forceExit`, cả thư mục < 10 giây).
- [ ] **Step 5: Commit** `feat(doi-buoi): API duyet/tu choi/huy duyet doi buoi` + push.

---

### Task 6: E2E (1 file, 3 test)

**Files:**
- Create: `backend/test/doi-buoi-hoc.e2e-spec.ts` — theo khuôn `test/bao-vang-doi-lop.e2e-spec.ts` (`createTestApp`, `taoDonViTest`, `uniqueSuffix`, dọn ở `afterAll`).

- [ ] **Step 1: Seed 1 lần trong `beforeAll`**: khóa `so_buoi_doi_toi_da = 2`; giai đoạn; lớp A, B cùng `truc_tiep`/`co_ban`, mỗi lớp buổi 1 bắt đầu `now + 2 ngày`; lớp B có P học viên được phân và `si_so_toi_da = P + 2`; 3 học viên HV1–HV3 phân vào A, cùng 1 cụm, có tài khoản `hoc_vien`; 1 `ho_tro_hoc_vien` phân công cụm.
- [ ] **Step 2: Viết 3 test** (chạy tuần tự, dùng chung dữ liệu):
  - (a) HV1 `POST /hoc-vien/toi/doi-buoi` → 201; hỗ trợ cụm `POST /doi-buoi-hoc/:id/duyet` → 201 (buổi B còn 1 chỗ). Hai kiểm tra phụ thuộc Task 7 viết `it.todo` cho tới Task 7: trang lớp B buổi 1 có HV1 nhãn "Từ lớp A"; nạp 1 dòng điểm danh HV1 ở buổi B không `ghi_chu` → không lỗi, không cảnh báo học bù.
  - (b) HV2 gửi vào buổi B, rồi HV3 gửi sau. Hỗ trợ cụm duyệt HV3 → 409 (giữ chỗ cho HV2). Sau đó `Promise.all` duyệt HV2 và HV3 → đúng 1 phản hồi 201, 1 phản hồi 409.
  - (c) HV2 gửi lần 2 cho cùng buổi nguồn → 409.
- [ ] **Step 3: Chạy** `cd backend && npx jest --config ./test/jest-e2e.json --runInBand --forceExit test/doi-buoi-hoc.e2e-spec.ts` → PASS (< 60 giây).
- [ ] **Step 4: Commit** `test(doi-buoi): e2e luong chinh, duyet song song, unique` + push.

---

### Task 7: Tích hợp các màn đọc theo buổi (backend)

**Files (Modify) + test cùng file spec sẵn có của từng service:**
- `trang-lop/trang-lop.service.ts` (`layTrangLop`): mỗi buổi thêm `si_so` (từ `siSoBuoi`), học viên đổi ra có `doi_buoi: { loai: 'ra', lop: ten_lop }`, đổi vào được thêm với `doi_buoi: { loai: 'vao', lop: ten_lop_nguon }`.
- `diem-danh/diem-danh.service.ts`: `bangDiemDanh` thêm dòng người đổi vào cho đúng buổi; `suaO` coi học viên có đổi buổi `da_duyet` vào buổi đó là thuộc lớp (hiện chặn ở đếm `phan_lop_giai_doan`).
- `khoa-boi-duong/khoa-boi-duong.service.ts`:
  - `resolveDiemDanhRow`: trước nhánh học bù, nếu `doiBuoiDaDuyetCuaDangKy([dangKy.id])` có `lich_chot_id === lichHoc.id` (và còn hiệu lực) → không cảnh báo, không bắt buộc `ghi_chu`.
  - `khoaHocTheoHocVienId`: buổi nguồn đã đổi được thay bằng buổi chốt (giữ quy tắc `giauLinkZoom`), kèm `da_doi_buoi: true`, `lop_goc_ten`.
- `ho-tro-hoc-vien/ho-tro-hoc-vien.service.ts` (`lichHoc`): buổi chốt của học viên trong cụm được tính là buổi của cụm.
- `nhac-lich/nhac-lich.service.ts`: `capDotCuaCum` + `tinNhanCum` thêm buổi chốt (dòng "{họ tên} học buổi {n} tại {lớp}"); `demCanNhacCum` / `trangThaiCumTheoBuoi` coi `doi_buoi_hoc.xu_ly_luc > lần gửi cuối` là cần nhắc lại.
- Các module tương ứng import `DoiBuoiHocQueryModule`.

- [ ] **Step 1: Mỗi service thêm 1–2 test** trong spec hiện có (mock query service trả 1 đổi buổi): trang lớp có nhãn ra/vào; `resolveDiemDanhRow` không cảnh báo khi có đổi buổi đã duyệt, vẫn cảnh báo khi đổi buổi đã bị hủy; `khoaHocTheoHocVienId` trả buổi chốt; nhắc lịch cụm có dòng học buổi đổi.
- [ ] **Step 2: FAIL** — chạy từng file: `npx jest src/trang-lop --forceExit`, `npx jest src/diem-danh --forceExit`, `npx jest src/khoa-boi-duong/khoa-boi-duong.service.spec.ts --forceExit`, `npx jest src/nhac-lich src/ho-tro-hoc-vien --forceExit`.
- [ ] **Step 3: Cài đặt.**
- [ ] **Step 4: PASS** từng file; gỡ `it.todo` ở Task 6 (a) và chạy lại đúng file e2e đó.
- [ ] **Step 5: Commit** `feat(doi-buoi): trang lop, diem danh, lich/nhac cum, lich hoc vien tinh doi buoi` + push.

---

### Task 8: Frontend học viên

**Files:**
- Create: `frontend/src/api/doiBuoi.ts` (hooks: `useTongQuanDoiBuoi(khoaId)`, `useLuaChonDoiBuoi(lichNguonId)`, `useGuiDoiBuoi()`, `useSuaDoiBuoi()`, `useHuyDoiBuoi()`, và phía duyệt cho Task 9: `useDsDoiBuoi(q)`, `useDemDoiBuoi()`, `useLuaChonDuyet(id)`, `useDuyetDoiBuoi()`, `useTuChoiDoiBuoi()`, `useHuyDuyetDoiBuoi()`) — kiểu khớp Task 4/5.
- Create: `frontend/src/pages/HocVien/DeNghiDoiBuoi.tsx` + `DeNghiDoiBuoi.test.tsx`; route `/de-nghi-doi-buoi` trong `router.tsx` (cùng nhóm route học viên, **không** thêm menu); query `?lich=<lichNguonId>` chọn sẵn buổi.
- Modify: `M3/TheBuoiSapToi.tsx`, `M7/ThongTinLopHoc.tsx` — link chữ nhỏ "Không tham gia được buổi này?" → `/de-nghi-doi-buoi?lich=…`, chỉ khi khóa `so_buoi_doi_toi_da > 0` (thêm trường này vào response `GET /hoc-vien/toi/khoa-hoc` ở Task 7 nếu chưa có) và buổi chưa bắt đầu; buổi `da_doi_buoi` hiện nhãn "Đã đổi buổi".

- [ ] **Step 1: Test** — `TheBuoiSapToi`: khóa 0 → không có link; khóa 2 + buổi tương lai → có link đúng href; buổi đã bắt đầu → không link. `DeNghiDoiBuoi`: lựa chọn `da_du` bị `disabled` và có chữ "Đã đủ"; hiện "28/30" và "+2 đang chờ"; hiện "Còn 1/2 lượt đổi"; bấm Sửa hiện cảnh báo "Sửa sẽ đưa bạn về cuối hàng chờ"; API trả 403 (khóa tắt) → hiện "Khóa học chưa mở đề nghị đổi buổi", không lỗi (Review Focus 5); không có khóa → hiện thông báo rỗng.
- [ ] **Step 2: FAIL** — `cd frontend && npx vitest run src/pages/M3/TheBuoiSapToi.test.tsx src/pages/HocVien/DeNghiDoiBuoi.test.tsx`.
- [ ] **Step 3: Cài đặt** (shadcn/Tailwind sẵn có, spacing bội số 4).
- [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** `feat(doi-buoi): trang hoc vien de nghi doi buoi + link nho` + push.

---

### Task 9: Frontend người duyệt

**Files:**
- Create: `frontend/src/pages/HoTro/DuyetDoiBuoi.tsx` + `DuyetDoiBuoi.test.tsx` — 2 tab "Chờ duyệt" (sắp `tao_luc` tăng, cột `k/n`, sĩ số buổi đề nghị, nhãn "Quá hạn") / "Đã xử lý" (nút Hủy duyệt); modal Duyệt: danh sách `luaChonDuyet`, buổi đề nghị chọn sẵn, lựa chọn `duyet_duoc=false` disabled với `ho_tro_hoc_vien`, enabled kèm cảnh báo vàng với `quan_tri`; modal Từ chối ghi chú bắt buộc.
- Modify: `router.tsx` (`/ho-tro/doi-buoi`, `/admin/doi-buoi` cùng component), menu khu hỗ trợ ("Đổi buổi" + badge `useDemDoiBuoi`) và menu admin, `Admin/AdminVanHanh.tsx` (khối "Đề nghị đổi buổi chờ duyệt": số chờ + link).
- [ ] **Step 1: Test** — hỗ trợ cụm: lựa chọn không duyệt được bị disabled; quản trị: enabled + có chữ "Vượt"; Từ chối không ghi chú → nút gửi disabled; badge hiện số từ `dem-cho-duyet`; 409 khi duyệt → toast thông điệp server.
- [ ] **Step 2: FAIL** — `npx vitest run src/pages/HoTro/DuyetDoiBuoi.test.tsx src/pages/Admin/AdminVanHanh.test.tsx`.
- [ ] **Step 3: Cài đặt.** → **Step 4: PASS.**
- [ ] **Step 5: Commit** `feat(doi-buoi): man duyet doi buoi cho ho tro cum va quan tri` + push.

---

### Task 10: Tài liệu và kiểm tra cuối

**Files:** `docs/api-contract.md` (mục đổi buổi: 5 route học viên + 6 route duyệt, mã lỗi), `CONTEXT.md` (thuật ngữ **Đổi buổi**, **Buổi tương đương**), `docs/deploy/2026-10-xx-doi-buoi-hoc.md` (backup, `prisma migrate deploy`, kiểm tra sau deploy: `SELECT count(*) FROM doi_buoi_hoc` = 0, mọi khóa `so_buoi_doi_toi_da = 0`).

- [ ] **Step 1: Viết tài liệu.**
- [ ] **Step 2: Kiểm tra** — `cd backend && npx tsc --noEmit && npx jest src/doi-buoi-hoc src/trang-lop src/diem-danh src/nhac-lich --forceExit`; `cd frontend && npx tsc --noEmit && npx vitest run src/pages/HocVien src/pages/HoTro/DuyetDoiBuoi.test.tsx`; e2e đúng 1 file của Task 6. Tất cả PASS.
- [ ] **Step 3: Commit** `docs(doi-buoi): api-contract, CONTEXT, huong dan deploy` + push. ADR 0007 đổi "Trạng thái: Đã chấp nhận".
