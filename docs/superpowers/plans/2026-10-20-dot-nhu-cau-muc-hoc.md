# Đợt nhu cầu mức học — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Học viên tự chọn nhu cầu bồi dưỡng (bằng hoặc thấp hơn mức lớp đang học) trong một đợt có giờ mở/đóng. Dữ liệu lưu riêng theo đợt để phân tích, không ghi đè `muc_hoc_chon` và không đổi lớp.

**Architecture:** Module backend mới `nhu-cau-muc` có 2 bảng `dot_nhu_cau_muc` và `nhu_cau_muc_hoc_vien`. Hàm thuần `tinhMocNhuCau` tính mốc từ lớp đang phân công, nếu không có thì lấy `muc_dau_vao`. Thống kê và Excel đặt trong `thong-ke`, dùng lại `ThongKeScopeService`. Frontend gồm: thẻ trên `/toi`, trang `/toi/nhu-cau-muc`, khối quản lý đợt trong AdminKhoaChiTiet và tab trong DashboardThongKe.

**Tech Stack:** NestJS + Prisma (PostgreSQL), Jest e2e; React 18 + Mantine + TanStack Query, Vitest + MSW; exceljs.

**Spec:** `docs/adr/0013-dot-nhu-cau-muc-hoc.md`. Mọi mã D1–D10 bên dưới trỏ về ADR này.

## Global Constraints

- **Không ghi** `dang_ky_hoc.muc_dau_vao`, `muc_hoc_chon`, `muc_hoc_chon_luc`, `phan_lop_giai_doan` (D1).
- Migration **chỉ thêm**. Tên migration: `20261020100000_dot_nhu_cau_muc`. CHECK viết raw SQL trong `migration.sql`.
- Thứ tự mức dùng `THU_TU_MUC` (`backend/src/khoa-boi-duong/util/muc-hoc.util.ts:9`): co_ban=1, thanh_thao=2, nang_cao=3. Được chọn **mọi mức ≤ mốc**; không dùng `duocChonMuc`, vì hàm đó chỉ cho xuống 1 mức.
- Lỗi theo dạng `{ error: { code, message, fields? } }`. Mã mới: `DOT_NHU_CAU_DONG` (403), message "Đợt nhu cầu mức học đã đóng".
- Loại nhân viên bằng `HOC_VIEN_PHAI_XEP_LOP` (`backend/src/common/utils/doi-tuong-khao-sat.util.ts:36`). `doi_tuong` NULL vẫn tham gia.
- Trạng thái đăng ký đủ điều kiện: `da_duyet`, `da_phan_lop`.
- "Hôm nay" khi so với cột `@db.Date` của giai đoạn = ngày theo `Asia/Ho_Chi_Minh`. So `mo_luc`/`dong_luc` (timestamptz) với `new Date()` của server.
- Giao diện tiếng Việt, xưng "Thầy/Cô", mobile-first 360px. Giờ hiển thị bằng `dinhDangNgayGio` (`frontend/src/lib/ngay.ts:13`).
- Test: `npm run test:e2e -- <file>` (đã có `--forceExit`), `npx vitest run <file>`. Luôn đặt timeout, không chạy watch.
- Mỗi task: commit rồi `git push` ngay. Commit message ghi "(CO migration)" hoặc "(khong migration)".

## Review Focus

1. **Học viên đã qua hết các giai đoạn.** Mốc phải lấy lớp của giai đoạn gần nhất đã qua, không được báo "chưa có mốc". Test `tinhMocNhuCau` case "mọi giai đoạn đã kết thúc" ở Task 2.
2. **Mốc bị hạ sau khi học viên đã chọn** (chuyển lớp). GET vẫn trả lựa chọn cũ; PUT lại với mức cũ bị 400. e2e "mốc giảm sau khi chọn" ở Task 4.
3. **Hai request PUT đồng thời của cùng học viên** không được tạo 2 dòng. Dùng `upsert` trên UNIQUE (dot_id, dang_ky_hoc_id). Có e2e `Promise.all` 2 PUT ở Task 4.
4. **Sửa giờ đợt làm chồng lên đợt khác**, hoặc dời `dong_luc` về quá khứ khi đợt đã có dữ liệu. PATCH phải kiểm tra chồng chéo, trừ chính đợt đó, và vẫn cho phép đóng. e2e ở Task 3.
5. **Học viên mở link `?dot=` của khóa mình không học**, hoặc của đợt không tồn tại → 404, không lộ thông tin đợt. e2e ở Task 4.

---

### Task 1: Schema + migration 2 bảng mới

**Files:**
- Modify: `backend/prisma/schema.prisma`: thêm 2 model và enum `nguon_moc_nhu_cau { lop muc_chot }`; thêm relation ngược trên `khoa_boi_duong`, `dang_ky_hoc`, `lop_hoc`, `nguoi_dung` (created_by).
- Create: `backend/prisma/migrations/20261020100000_dot_nhu_cau_muc/migration.sql`
- Modify: `docs/database-ddl.sql`: thêm 2 bảng, đặt sau `dot_xac_nhan` (khoảng L463).

**Interfaces:**
- Produces:
  - `dot_nhu_cau_muc { id uuid, khoa_id uuid FK→khoa_boi_duong ON DELETE CASCADE, ten_dot varchar(255), mo_luc timestamptz, dong_luc timestamptz, created_by uuid? FK→nguoi_dung, created_at, updated_at }`, có index `(khoa_id)`.
  - `nhu_cau_muc_hoc_vien { id uuid, dot_id FK ON DELETE CASCADE, dang_ky_hoc_id FK→dang_ky_hoc ON DELETE CASCADE, muc_chon muc_nang_luc, muc_moc muc_nang_luc, nguon_moc nguon_moc_nhu_cau, lop_id_luc_chon uuid? FK→lop_hoc ON DELETE SET NULL, chon_luc timestamptz default now(), cap_nhat_luc timestamptz default now() }`, có `@@unique([dot_id, dang_ky_hoc_id])` và index `(dang_ky_hoc_id)`.

- [ ] **Step 1:** Thêm model vào schema, theo mẫu `dot_xac_nhan` (schema.prisma:681).
- [ ] **Step 2:** Chạy `cd backend && npx prisma migrate dev --create-only --name dot_nhu_cau_muc`, đổi tên thư mục thành `20261020100000_dot_nhu_cau_muc`. Nối thêm SQL vào cuối file:
  ```sql
  ALTER TABLE "dot_nhu_cau_muc" ADD CONSTRAINT "chk_dot_nhu_cau_muc_thoi_gian" CHECK ("dong_luc" > "mo_luc");
  ALTER TABLE "nhu_cau_muc_hoc_vien" ADD CONSTRAINT "chk_nhu_cau_muc_chon_le_moc" CHECK (
    array_position(ARRAY['co_ban','thanh_thao','nang_cao']::muc_nang_luc[], "muc_chon")
    <= array_position(ARRAY['co_ban','thanh_thao','nang_cao']::muc_nang_luc[], "muc_moc"));
  ```
  Kiểm tra: file chỉ có `CREATE TYPE`, `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE ... ADD CONSTRAINT`; không có `DROP` hay `ALTER COLUMN`.
- [ ] **Step 3:** Chạy `npx prisma migrate dev` trên DB dev (localhost, **không** dùng `--shadow-database-url`), rồi `npx prisma generate`. Kỳ vọng: "Applied migration 20261020100000_dot_nhu_cau_muc".
- [ ] **Step 4:** Chạy `npx tsc --noEmit -p backend`. Kỳ vọng: không lỗi.
- [ ] **Step 5:** Commit `feat(nhu-cau-muc): schema 2 bang dot_nhu_cau_muc + nhu_cau_muc_hoc_vien (CO migration, chi them bang)`, rồi push.

### Task 2: Hàm thuần tính mốc và mức được chọn

**Files:**
- Create: `backend/src/nhu-cau-muc/util/moc-nhu-cau.util.ts`
- Test: `backend/src/nhu-cau-muc/util/moc-nhu-cau.util.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export type GiaiDoanPhanLop = { giai_doan_id: string; ten_giai_doan: string; thu_tu: number;
    bat_dau: string /*YYYY-MM-DD*/; ket_thuc: string;
    lop: { id: string; ten_lop: string; muc_nang_luc: muc_nang_luc | null } | null };
  export type MocNhuCau = { muc: muc_nang_luc; nguon: nguon_moc_nhu_cau;
    lop: { id: string; ten_lop: string } | null; giai_doan: { id: string; ten_giai_doan: string } | null };
  export function chonLopDangPhanCong(gds: GiaiDoanPhanLop[], homNay: string): GiaiDoanPhanLop | null;
  export function tinhMocNhuCau(gds: GiaiDoanPhanLop[], mucDauVao: muc_nang_luc | null, homNay: string): MocNhuCau | null;
  export function cacMucNhuCauDuocChon(moc: muc_nang_luc): muc_nang_luc[]; // thấp → cao, gồm cả moc
  export function duocChonNhuCau(moc: muc_nang_luc, chon: muc_nang_luc): boolean;
  export function homNayVN(now?: Date): string; // 'YYYY-MM-DD' theo Asia/Ho_Chi_Minh
  ```
  Chỉ xét các giai đoạn có `lop != null`. `chonLopDangPhanCong` chọn theo thứ tự ưu tiên:
  1. Giai đoạn có `bat_dau ≤ homNay ≤ ket_thuc`; nếu nhiều thì lấy `thu_tu` nhỏ nhất.
  2. Nếu không có, lấy giai đoạn sắp tới gần nhất (`bat_dau` nhỏ nhất mà > homNay).
  3. Nếu không có, lấy giai đoạn đã qua gần nhất (`ket_thuc` lớn nhất).

  `tinhMocNhuCau`: nếu lớp chọn được có `muc_nang_luc` thì trả `{muc: lop.muc_nang_luc, nguon:'lop', lop, giai_doan}`. Nếu không, khi `mucDauVao` có giá trị thì trả `{muc: mucDauVao, nguon:'muc_chot', lop (có thể null), giai_doan}`. Còn lại trả `null`.

- [ ] **Step 1: Viết test fail**, các case sau (dữ liệu `homNay='2026-10-20'`):
  - `chonLopDangPhanCong`: chọn giai đoạn đang diễn ra khi có 1 đã qua, 1 đang diễn ra, 1 sắp tới; chọn sắp tới gần nhất khi chưa tới giai đoạn nào; **chọn giai đoạn đã qua gần nhất khi mọi giai đoạn đã kết thúc** (Review Focus 1); bỏ qua giai đoạn không có lớp; trả `null` khi mảng rỗng.
  - `tinhMocNhuCau`: lớp `thanh_thao` và `mucDauVao='nang_cao'` → `{muc:'thanh_thao', nguon:'lop'}`; lớp `muc_nang_luc=null` và `mucDauVao='co_ban'` → `{muc:'co_ban', nguon:'muc_chot', lop:{...}}`; không có lớp và có `mucDauVao` → `nguon:'muc_chot', lop:null`; không có lớp và không có `mucDauVao` → `null`.
  - `cacMucNhuCauDuocChon('nang_cao')` toEqual `['co_ban','thanh_thao','nang_cao']`; `('co_ban')` toEqual `['co_ban']`.
  - `duocChonNhuCau('nang_cao','co_ban')` true; `('thanh_thao','nang_cao')` false; `('co_ban','co_ban')` true.
  - `homNayVN(new Date('2026-10-19T17:30:00Z'))` === `'2026-10-20'`.
- [ ] **Step 2:** Chạy `cd backend && npx jest src/nhu-cau-muc/util/moc-nhu-cau.util.spec.ts --forceExit`. Kỳ vọng: FAIL (module not found).
- [ ] **Step 3:** Cài đặt các hàm. `homNayVN` dùng `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })`.
- [ ] **Step 4:** Chạy lại. Kỳ vọng: PASS.
- [ ] **Step 5:** Commit `feat(nhu-cau-muc): ham tinh moc nhu cau (khong migration)`, rồi push.

### Task 3: Quản trị CRUD đợt

**Files:**
- Create: `backend/src/nhu-cau-muc/nhu-cau-muc.module.ts`, `dot-nhu-cau-muc.controller.ts`, `dot-nhu-cau-muc.service.ts`, `dto/tao-dot-nhu-cau-muc.dto.ts`, `dto/sua-dot-nhu-cau-muc.dto.ts`
- Modify: `backend/src/app.module.ts` (đăng ký `NhuCauMucModule`), `backend/src/common/exceptions/app.exceptions.ts` (thêm `DotNhuCauDongException` theo mẫu `DieuChinhMucDongException` L82)
- Test: `backend/test/dot-nhu-cau-muc.e2e-spec.ts`

**Interfaces:**
- Produces (mọi route có `@Roles('quan_tri')`):
  - `GET /khoa-boi-duong/:khoaId/dot-nhu-cau-muc` → `DotNhuCauMuc[]` = `{ id, khoa_id, ten_dot, mo_luc, dong_luc, trang_thai: 'chua_mo'|'dang_mo'|'da_dong', so_ban_ghi: number }`, sắp `mo_luc` giảm dần.
  - `POST /khoa-boi-duong/:khoaId/dot-nhu-cau-muc` body `{ ten_dot (1–255, trim), mo_luc ISO, dong_luc ISO }` → `DotNhuCauMuc` (201).
  - `PATCH /dot-nhu-cau-muc/:id` body partial cùng các field.
  - `POST /dot-nhu-cau-muc/:id/dong` → đặt `dong_luc = now()` nếu đợt đang mở; nếu đợt chưa mở hoặc đã đóng thì 400.
  - `DELETE /dot-nhu-cau-muc/:id` → 204 khi `so_ban_ghi = 0`; nếu không thì 409 "Đợt đã có dữ liệu nhu cầu, không thể xóa".
  - `DotNhuCauMucService.kiemTraChongCheo(tx, khoaId, moLuc, dongLuc, excludeId?)` theo mẫu `dot-xac-nhan.service.ts:101`. Hàm chạy trong `$transaction`, sau `SELECT ... FROM khoa_boi_duong WHERE id=$1 FOR UPDATE`. Nếu chồng thì ném `ConflictAppException('Thời gian trùng với đợt "<ten>"', [{field:'mo_luc'}])`.
  - `DotNhuCauDongException`: 403, code `DOT_NHU_CAU_DONG`.

- [ ] **Step 1: Viết e2e fail**, dùng `createTestApp`, `taoNguoiDungTest({vai_tro:'quan_tri'})`, khóa tạo bằng `prisma.khoa_boi_duong.create`:
  - Tạo đợt hợp lệ → 201, `trang_thai` đúng theo giờ.
  - `dong_luc <= mo_luc` → 400 `VALIDATION_ERROR`, có field `dong_luc`.
  - Tạo đợt thứ 2 chồng giờ cùng khóa → 409; khác khóa thì được.
  - PATCH dời đợt A chồng lên đợt B → 409; PATCH chính A, không chồng ai → 200 (Review Focus 4).
  - `POST /:id/dong` → `dong_luc ≤ now`, `trang_thai='da_dong'`.
  - DELETE đợt rỗng → 204; DELETE đợt có 1 dòng `nhu_cau_muc_hoc_vien` (insert bằng prisma) → 409.
  - Gọi bằng vai trò `hoc_vien` → 403.
- [ ] **Step 2:** Chạy `cd backend && npm run test:e2e -- test/dot-nhu-cau-muc.e2e-spec.ts`. Kỳ vọng: FAIL (404 route).
- [ ] **Step 3:** Cài đặt module, service và controller. DTO validate bằng `@IsISO8601` và `@IsString @Length(1,255)`. Kiểm tra `dong_luc > mo_luc` ở service: ném `ValidationException` kèm field.
- [ ] **Step 4:** Chạy lại. Kỳ vọng: PASS.
- [ ] **Step 5:** Commit `feat(nhu-cau-muc): quan tri tao/sua/dong/xoa dot (khong migration)`, rồi push.

### Task 4: API học viên xem và chọn nhu cầu

**Files:**
- Create: `backend/src/nhu-cau-muc/nhu-cau-muc-hoc-vien.controller.ts`, `nhu-cau-muc-hoc-vien.service.ts`, `dto/chon-nhu-cau-muc.dto.ts`
- Modify: `backend/src/nhu-cau-muc/nhu-cau-muc.module.ts`
- Test: `backend/test/nhu-cau-muc-hoc-vien.e2e-spec.ts`

**Interfaces:**
- Consumes: `tinhMocNhuCau`, `cacMucNhuCauDuocChon`, `duocChonNhuCau`, `homNayVN` (Task 2); `DotNhuCauDongException` (Task 3).
- Produces (`@Controller('hoc-vien/toi/nhu-cau-muc')`, `@Roles('hoc_vien')`, lấy id học viên qua `caller.hoc_vien_id` với guard giống `assertHocVienId`):
  ```ts
  type NhuCauMucCuaToi = {
    dot: { id; ten_dot; mo_luc; dong_luc; trang_thai: 'chua_mo'|'dang_mo'|'da_dong' };
    khoa: { id; ten_khoa };
    du_dieu_kien: boolean;
    ly_do_khong_du: 'nhan_vien' | 'trang_thai_dang_ky' | 'chua_co_moc' | null;
    moc: MocNhuCau | null;          // tính tại thời điểm GET
    cac_muc_duoc_chon: muc_nang_luc[]; // [] khi không đủ điều kiện
    lua_chon: { muc_chon; muc_moc; nguon_moc; chon_luc; cap_nhat_luc } | null;
  };
  ```
  - `GET /hoc-vien/toi/nhu-cau-muc` → `NhuCauMucCuaToi[]`. Chỉ trả đợt `dang_mo` thuộc các khóa học viên có `dang_ky_hoc`, **và** `du_dieu_kien = true`. Nhân viên nhận mảng rỗng, nên thẻ không hiện (D6, D8).
  - `GET /hoc-vien/toi/nhu-cau-muc/:dotId` → `NhuCauMucCuaToi` cho mọi trạng thái đợt. Trả 404 nếu đợt không tồn tại hoặc học viên không có `dang_ky_hoc` của khóa đó (Review Focus 5).
  - `PUT /hoc-vien/toi/nhu-cau-muc/:dotId` body `{ muc: muc_nang_luc }` (bắt buộc, `@IsIn`). Xử lý theo thứ tự:
    1. 404 như GET.
    2. Đợt không `dang_mo` → `DotNhuCauDongException`.
    3. Không đủ điều kiện → 400 `VALIDATION_ERROR` (thông điệp theo lý do).
    4. Tính lại mốc; nếu `!duocChonNhuCau(moc.muc, muc)` → 400 "Chỉ được chọn mức bằng hoặc thấp hơn mức hiện tại (<nhãn mốc>)", field `muc`.
    5. `upsert` theo `dot_id_dang_ky_hoc_id`: create thì set `chon_luc` và `cap_nhat_luc` = now; update thì set `muc_chon`, `muc_moc`, `nguon_moc`, `lop_id_luc_chon`, `cap_nhat_luc` = now (giữ `chon_luc`).
    6. Trả `NhuCauMucCuaToi`.
  - Nạp giai đoạn: `khoa.giai_doan` `trang_thai:'active'` + `dang_ky_hoc.phan_lop_giai_doan.lop`, ánh xạ sang `GiaiDoanPhanLop[]` như `khoaHocTheoHocVienId` (khoa-boi-duong.service.ts:1484).

- [ ] **Step 1: Viết e2e fail.** Fixture học viên theo mẫu `test/dieu-chinh-muc-hoc.e2e-spec.ts` (`taoHocVien`, `dangNhap`). Thêm `lop_hoc` có `muc_nang_luc`, `giai_doan_khoa` bao trùm hôm nay, `phan_lop_giai_doan`. Các case:
  - Lớp `nang_cao`, đợt mở: GET list có 1 phần tử với `cac_muc_duoc_chon` = 3 mức; PUT `co_ban` → 200, `lua_chon.muc_chon='co_ban'`, `muc_moc='nang_cao'`, `nguon_moc='lop'`.
  - Lớp `thanh_thao`: PUT `nang_cao` → 400, field `muc`.
  - PUT 2 lần (`thanh_thao` rồi `co_ban`) → 1 dòng duy nhất, `chon_luc` không đổi, `cap_nhat_luc` tăng.
  - `Promise.all` 2 PUT → 1 dòng duy nhất (Review Focus 3).
  - Đổi `phan_lop_giai_doan` sang lớp `co_ban` sau khi đã chọn `thanh_thao`: GET vẫn có `lua_chon.muc_chon='thanh_thao'` và `moc.muc='co_ban'`; PUT `thanh_thao` → 400 (Review Focus 2).
  - Không có lớp, `muc_dau_vao='thanh_thao'` → `moc.nguon='muc_chot'`. Không có lớp và không có `muc_dau_vao` → GET `/:dotId` trả `du_dieu_kien=false, ly_do_khong_du='chua_co_moc'`, list rỗng, PUT → 400.
  - `hoc_vien.doi_tuong='nhan_vien'` → list rỗng, `/:dotId` trả `ly_do_khong_du='nhan_vien'`. `doi_tuong=null` → được tham gia.
  - `dang_ky_hoc.trang_thai='cho_duyet'` → `ly_do_khong_du='trang_thai_dang_ky'`.
  - Đợt đã đóng: PUT → 403 `DOT_NHU_CAU_DONG`; GET `/:dotId` → 200 với `lua_chon` cũ.
  - Đợt của khóa khác hoặc uuid ngẫu nhiên → 404.
  - **Không ghi đè dữ liệu cũ:** sau PUT, `dang_ky_hoc.muc_hoc_chon`, `muc_hoc_chon_luc`, `muc_dau_vao` không đổi so với trước (D1).
  - **Xóa học viên:** gọi endpoint xóa học viên hiện có (`hoc-vien.service.ts:1011`) cho học viên đã có bản ghi → 200, và `nhu_cau_muc_hoc_vien` của học viên đó bị xóa (D10).
- [ ] **Step 2:** Chạy `npm run test:e2e -- test/nhu-cau-muc-hoc-vien.e2e-spec.ts`. Kỳ vọng: FAIL.
- [ ] **Step 3:** Cài đặt service và controller. Điều kiện đủ dùng `trang_thai in ['da_duyet','da_phan_lop']` và `HOC_VIEN_PHAI_XEP_LOP`.
- [ ] **Step 4:** Chạy lại. Kỳ vọng: PASS. Chạy thêm `npm run test:e2e -- test/dieu-chinh-muc-hoc.e2e-spec.ts` để chắc tính năng cũ không đổi.
- [ ] **Step 5:** Commit `feat(nhu-cau-muc): hoc vien xem/chon nhu cau theo dot (khong migration)`, rồi push.

### Task 5: Thống kê theo đợt và Excel từng người

**Files:**
- Create: `backend/src/thong-ke/nhu-cau-muc-dot.service.ts`, `backend/src/thong-ke/nhu-cau-muc-dot-excel.util.ts`, `backend/src/thong-ke/dto/nhu-cau-muc-dot-query.dto.ts`
- Modify: `backend/src/thong-ke/thong-ke.controller.ts`, `thong-ke.module.ts` (import `NhuCauMucModule` nếu cần dùng loader), `thong-ke.types.ts`
- Test: `backend/src/thong-ke/nhu-cau-muc-dot.service.spec.ts`, `backend/src/thong-ke/nhu-cau-muc-dot-excel.util.spec.ts`, `backend/test/thong-ke-nhu-cau-muc-dot.e2e-spec.ts`

**Interfaces:**
- Consumes: `tinhMocNhuCau`, `homNayVN` (Task 2); `ThongKeScopeService.resolve(user, q)` (thong-ke-scope.service.ts:50).
- Produces:
  - `NhuCauMucDotQueryDto extends ThongKeQueryDto { dot_id: string (@IsUUID, bắt buộc) }`. `khoa_id` lấy theo đợt, bỏ qua giá trị client gửi.
  - `DongNhuCauMucDot = { dang_ky_hoc_id; hoc_vien: { ho_ten; ma_moet; so_dien_thoai; don_vi: {id; ten}; truong: {id; ten} | null }; moc_hien_tai: MocNhuCau | null; lop_hien_tai: string | null; muc_dau_vao; muc_hoc_chon; lua_chon: { muc_chon; muc_moc; nguon_moc; lop_luc_chon: string | null; chon_luc; cap_nhat_luc } | null }`. Chỉ gồm đăng ký **đủ điều kiện** (D6) hoặc đã có `lua_chon`.
  - `export function tongHopNhuCauMucDot(rows: DongNhuCauMucDot[]): NhuCauMucDotResult` (thuần), với:
    `NhuCauMucDotResult = { tong_du_dieu_kien; da_chon; chua_chon; ty_le_da_chon /*0–100, 1 chữ số thập phân*/; ma_tran: { muc_moc; muc_chon; so_luong }[]; theo_truong: { don_vi_id; ten; tong; da_chon; chua_chon; ha_muc }[] }`.
    - `ma_tran` dùng `lua_chon.muc_moc` (mốc lúc chọn).
    - `ha_muc` = số dòng có `muc_chon < muc_moc`.
    - Dòng có `moc_hien_tai=null` nhưng có `lua_chon` vẫn tính vào `da_chon` và `tong`.
  - `GET /thong-ke/nhu-cau-muc-dot` → `{ dot, ...NhuCauMucDotResult }`.
  - `GET /thong-ke/nhu-cau-muc-dot/xuat-excel` (thêm `don_vi_ids`; rỗng = toàn phạm vi) → xlsx `nhu-cau-muc-<ma_khoa>-<yyyymmdd>.xlsx`.
  - `buildNhuCauMucDotWorkbook(dot, rows, moTa: MoTaBieuMau): Promise<Buffer>`, gồm:
    - Sheet "Tổng hợp" (KPI, ma trận, theo trường).
    - Sheet "Danh sách" có cột: STT, Họ tên, Mã MOET, SĐT, Đơn vị, Trường, Lớp hiện tại, Mức hiện tại, Nguồn mốc, Lớp lúc chọn, Mức lúc chọn, Nhu cầu chọn, Chọn lúc, Cập nhật lúc, # Mức chốt, # Nhu cầu lần 1. Chưa chọn thì cột "Nhu cầu chọn" ghi "Chưa chọn". Giờ theo giờ Việt Nam, định dạng `dd/mm/yyyy HH:mm`.
  - Vai trò: giữ nguyên `@Roles` cấp class của `ThongKeController`; phạm vi dữ liệu do `ThongKeScopeService` quyết định, giống `danh-sach-hoc-vien/xuat-excel`.

- [ ] **Step 1: Viết unit test fail cho `tongHopNhuCauMucDot`:**
  - 3 dòng (nang_cao→co_ban, thanh_thao→thanh_thao, chưa chọn) → `tong_du_dieu_kien=3, da_chon=2, chua_chon=1, ty_le_da_chon=66.7`; `ma_tran` chứa `{muc_moc:'nang_cao', muc_chon:'co_ban', so_luong:1}`; `ha_muc=1`.
  - Mảng rỗng → `ty_le_da_chon=0`, không chia cho 0.
  - Dòng có `moc_hien_tai=null` nhưng có `lua_chon` → tính vào `da_chon`.
- [ ] **Step 2: Viết unit test fail cho workbook:** đọc lại buffer bằng exceljs. Sheet "Danh sách" có header đúng thứ tự như trên; dòng chưa chọn có ô "Nhu cầu chọn" = "Chưa chọn".
- [ ] **Step 3: Viết e2e fail:** quan_tri GET với `dot_id` → số liệu khớp fixture; nhân viên không nằm trong `tong_du_dieu_kien`; `dot_id` sai → 404; xuất Excel với `don_vi_ids=<1 trường>` chỉ có học viên của trường đó.
- [ ] **Step 4:** Chạy `npx jest src/thong-ke/nhu-cau-muc-dot --forceExit` và `npm run test:e2e -- test/thong-ke-nhu-cau-muc-dot.e2e-spec.ts`. Kỳ vọng: FAIL.
- [ ] **Step 5:** Cài đặt. Truy vấn `dang_ky_hoc` bằng `where` của scope `AND { khoa_id: dot.khoa_id }`, include `hoc_vien` (đơn vị), `phan_lop_giai_doan.lop`, `nhu_cau_muc_hoc_vien where dot_id`. Tính mốc trong JS bằng `tinhMocNhuCau`, theo cách `nhu-cau-muc-hoc.service.ts:191`.
- [ ] **Step 6:** Chạy lại tất cả. Kỳ vọng: PASS.
- [ ] **Step 7:** Commit `feat(thong-ke): thong ke + excel nhu cau muc theo dot (khong migration)`, rồi push.

### Task 6: Frontend học viên — thẻ ở `/toi` và trang `/toi/nhu-cau-muc`

**Files:**
- Create: `frontend/src/api/nhuCauMuc.ts`, `frontend/src/pages/M9/NhuCauMuc.tsx`, `frontend/src/pages/M9/NhuCauMuc.test.tsx`, `frontend/src/pages/M3/TheNhuCauMuc.tsx`, `frontend/src/pages/M3/TheNhuCauMuc.test.tsx`
- Modify: `frontend/src/api/types.ts` (type `NhuCauMucCuaToi`, `MocNhuCau` khớp Task 4), `frontend/src/router.tsx` (route `/toi/nhu-cau-muc` trong `ProtectedLayout`), `frontend/src/pages/M3/TrangChinh.tsx` (render `<TheNhuCauMuc />` ngay sau hộp chào mừng, trước `ThongBaoCapNhat`), `frontend/src/test/mocks/handlers.ts` + `db.ts` (mock 3 route học viên), `docs/dac-ta-cong-hoc-vien.md` (thêm mục M9)

**Interfaces:**
- Consumes: 3 route học viên ở Task 4.
- Produces:
  - `layNhuCauMucToi()`, `nhuCauMucToiKey = ['hoc-vien','toi','nhu-cau-muc'] as const`, `useNhuCauMucToi()`.
  - `layNhuCauMucDot(dotId)`, `useNhuCauMucDot(dotId)` với key `[...nhuCauMucToiKey, dotId]`.
  - `chonNhuCauMuc(dotId, muc)`, `useChonNhuCauMuc(dotId)`: invalidate `nhuCauMucToiKey`.

- [ ] **Step 1: Viết test fail cho `TheNhuCauMuc`:**
  - Mock trả 1 đợt chưa chọn → hiện tên đợt, "Hạn chót: <dinhDangNgayGio(dong_luc)>", "Chưa chọn", link "Chọn nhu cầu" trỏ `/toi/nhu-cau-muc?dot=<id>`.
  - Đã chọn → "Đã chọn: Cơ bản".
  - Mảng rỗng → không render gì.
  - 2 đợt → 2 thẻ.
- [ ] **Step 2: Viết test fail cho `NhuCauMuc`:**
  - Thứ tự heading: "Thông tin của Thầy/Cô" → "Mức – lớp đang được phân công" → "Nhu cầu bồi dưỡng" (D8).
  - Mốc `thanh_thao`: chỉ có radio "Cơ bản" và "Thành thạo", **không có** "Nâng cao" trong DOM; có dòng "Thầy/Cô chỉ có thể chọn bằng hoặc thấp hơn mức hiện tại".
  - Bấm Lưu → modal xác nhận → bấm Xác nhận → gọi PUT, hiện thông báo thành công.
  - API trả 400 field `muc` → hiện lỗi.
  - Đợt `da_dong` → không có nút Lưu, hiện "Đợt đã đóng lúc …" và lựa chọn cuối; PUT trả 403 `DOT_NHU_CAU_DONG` → chuyển sang chỉ xem.
  - `du_dieu_kien=false, ly_do_khong_du='chua_co_moc'` → "Chưa có mức/lớp, chưa thể đăng ký nhu cầu".
  - Thiếu `?dot=` hoặc API 404 → "Không tìm thấy đợt".
- [ ] **Step 3:** Chạy `cd frontend && npx vitest run src/pages/M3/TheNhuCauMuc.test.tsx src/pages/M9/NhuCauMuc.test.tsx`. Kỳ vọng: FAIL.
- [ ] **Step 4:** Cài đặt.
  - Khối "Thông tin" dùng `useHoSoToi()` (họ tên, đơn vị) và `khoa.ten_khoa`.
  - Radio dạng thẻ lớn và modal theo mẫu `ChonMucLopHoc.tsx`; nhãn mức dùng `nhanMucNangLuc`.
  - Nguồn mốc hiển thị "theo lớp đang học" hoặc "theo mức chính thức (chốt)".
  - Thẻ ở `/toi`: màu cam khi chưa chọn, xanh khi đã chọn.
- [ ] **Step 5:** Chạy lại 2 file và `npx vitest run src/pages/M3 src/pages/M7`. Kỳ vọng: PASS.
- [ ] **Step 6:** Commit `feat(nhu-cau-muc): giao dien hoc vien the /toi + trang chon nhu cau (khong migration)`, rồi push.

### Task 7: Frontend quản trị — quản lý đợt trong AdminKhoaChiTiet

**Files:**
- Create: `frontend/src/pages/Admin/KhoiDotNhuCauMuc.tsx`, `frontend/src/pages/Admin/KhoiDotNhuCauMuc.test.tsx`
- Modify: `frontend/src/api/nhuCauMuc.ts` (hook admin), `frontend/src/pages/Admin/AdminKhoaChiTiet.tsx` (render `{laQuanTri && <KhoiDotNhuCauMuc khoaId={khoaId} />}` ngay sau Paper công tắc `mo_dieu_chinh_muc`, khoảng L880), `frontend/src/test/mocks/handlers.ts`

**Interfaces:**
- Consumes: các route quản trị ở Task 3.
- Produces: `dotNhuCauMucKey(khoaId) = ['admin','dot-nhu-cau-muc',khoaId]`, `useDotNhuCauMuc(khoaId)`, `useTaoDotNhuCauMuc(khoaId)`, `useSuaDotNhuCauMuc(khoaId)`, `useDongDotNhuCauMuc(khoaId)`, `useXoaDotNhuCauMuc(khoaId)`.

- [ ] **Step 1: Viết test fail:**
  - Bảng hiện tên đợt, mở/đóng (`dinhDangNgayGio`), badge trạng thái và số bản ghi.
  - Form tạo đợt gửi đúng body ISO.
  - 409 chồng giờ → hiện lỗi ở ô `mo_luc`.
  - Nút "Đóng ngay" chỉ hiện khi `dang_mo`, và mở modal xác nhận trước khi gọi.
  - Nút "Xóa" bị vô hiệu hóa khi `so_ban_ghi > 0`, kèm tooltip/nhãn "Đã có dữ liệu".
- [ ] **Step 2:** Chạy `npx vitest run src/pages/Admin/KhoiDotNhuCauMuc.test.tsx`. Kỳ vọng: FAIL.
- [ ] **Step 3:** Cài đặt. Form nhập ngày giờ theo cùng cách `AdminDotXacNhan.tsx`.
- [ ] **Step 4:** Chạy lại file đó và `src/pages/Admin/AdminKhoaChiTiet.test.tsx`. Kỳ vọng: PASS.
- [ ] **Step 5:** Commit `feat(nhu-cau-muc): quan tri quan ly dot trong chi tiet khoa (khong migration)`, rồi push.

### Task 8: Frontend thống kê — tab "Nhu cầu theo đợt" + Excel

**Files:**
- Create: `frontend/src/pages/ThongKe/khoi/KhoiNhuCauMucDot.tsx`, `frontend/src/pages/ThongKe/khoi/KhoiNhuCauMucDot.test.tsx`
- Modify: `frontend/src/api/thongKe.ts` (`useNhuCauMucDot(loc, dotId)`, `xuatNhuCauMucDot(loc, dotId, donViIds)`), `frontend/src/pages/ThongKe/DashboardThongKe.tsx` (thêm `'nhu_cau_dot'` vào `TAB_VALUES` L31, nhãn "Nhu cầu theo đợt", chỉ hiện khi `loc.khoa_id` có giá trị), `frontend/src/test/mocks/thongKe.ts`

**Interfaces:**
- Consumes: `GET /thong-ke/nhu-cau-muc-dot` và `.../xuat-excel` (Task 5), `useDotNhuCauMuc(khoaId)` (Task 7) để chọn đợt.

- [ ] **Step 1: Viết test fail:**
  - Chưa chọn khóa → "Chọn khóa để xem nhu cầu theo đợt".
  - Có khóa → Select đợt, mặc định đợt mới nhất.
  - Hiện KPI (đủ điều kiện / đã chọn / chưa chọn / %).
  - Ma trận 3×3 với nhãn mức, ô 0 hiện "0".
  - Bảng theo trường.
  - Nút "Xuất Excel" mở chọn toàn bộ / 1 / nhiều trường giống `xuatDanhSachHocVien`, rồi gọi API với `don_vi_ids`.
- [ ] **Step 2:** Chạy `npx vitest run src/pages/ThongKe/khoi/KhoiNhuCauMucDot.test.tsx`. Kỳ vọng: FAIL.
- [ ] **Step 3:** Cài đặt. Dùng lại component chọn trường của luồng xuất danh sách học viên.
- [ ] **Step 4:** Chạy lại và `npx vitest run src/pages/ThongKe`. Kỳ vọng: PASS.
- [ ] **Step 5:** Commit `feat(thong-ke): tab nhu cau theo dot + xuat excel (khong migration)`, rồi push.

### Task 9: Tài liệu + runbook deploy

**Files:**
- Modify: `CONTEXT.md` (thuật ngữ **Đợt nhu cầu mức học**, **Mốc nhu cầu**; ghi rõ khác `muc_hoc_chon`), `docs/api-contract.md` (10 route mới: 5 quản trị, 3 học viên, 2 thống kê; mã `DOT_NHU_CAU_DONG`)
- Create: `docs/deploy/2026-10-20-dot-nhu-cau-muc.md`

- [ ] **Step 1:** Viết runbook theo mẫu `docs/deploy/2026-10-19-hoc-bu.md`. Runbook phải nêu:
  - **CÓ 1 migration chỉ thêm 2 bảng + 1 enum**, không sửa dữ liệu cũ.
  - Lệnh backup `pg_dump`, lấy pass từ `DATABASE_URL` trong `backend/.env`.
  - Các lệnh `npx prisma migrate deploy`, build và restart.
  - Câu SQL kiểm tra sau deploy: `SELECT count(*) FROM dot_nhu_cau_muc;` = 0, và số dòng `dang_ky_hoc` không đổi.
  - Cách quay lui: `DROP TABLE nhu_cau_muc_hoc_vien, dot_nhu_cau_muc; DROP TYPE nguon_moc_nhu_cau;`, xóa dòng `_prisma_migrations` tương ứng, rồi quay lui code.
  - Tính năng tắt cho tới khi quản trị tạo đợt.
  - Người chạy runbook là user, không phải Claude.
- [ ] **Step 2:** Chạy toàn bộ kiểm thử liên quan: backend `npx jest src/nhu-cau-muc src/thong-ke --forceExit` và 3 file e2e của Task 3/4/5; frontend `npx vitest run`. Kỳ vọng: tất cả PASS. Nếu có fail không liên quan (DB dev có đợt mở sẵn) thì ghi lại, không sửa.
- [ ] **Step 3:** Commit `docs(nhu-cau-muc): context, api-contract, runbook deploy (CO migration o task 1)`, rồi push.
