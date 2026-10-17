# Email lịch giảng dạy theo giai đoạn – khóa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Người hỗ trợ giảng viên chọn khóa và giai đoạn, tích chọn giảng viên rồi bấm nút; mỗi giảng viên nhận 1 email (mẫu 5a, hoặc 5b nếu là bản cập nhật) gồm mọi buổi mình dạy trong giai đoạn đó.

**Architecture:** Hàm thuần `mauLichGiangDay` dựng HTML trên khung `bo-cuc.ts`. `EmailLichDayService` (module `nhac-lich`) gom dữ liệu, chọn 5a/5b, rồi trong 1 transaction cho mỗi người: xếp hàng `hang_doi_email` và ghi `nhat_ky_nhac_lich` (cột mới `hang_doi_email_id`). Ba endpoint mới đặt trong `HoTroGiangVienController`. Trang mới `/ho-tro-gv/gui-lich-day`.

**Tech Stack:** NestJS + Prisma (Postgres), Jest; React + Mantine + TanStack Query, Vitest + MSW.

**Spec:** `docs/superpowers/specs/2026-10-17-email-lich-giang-day-design.md` (ADR 0009). Mẫu đã duyệt: `design/mau-email/5a-lich-day-giang-vien.html`, `5b-lich-day-giang-vien-cap-nhat.html`.

## Global Constraints

- Migration chỉ thêm: `ALTER TYPE loai_su_kien_thong_bao ADD VALUE 'nhac_lich_giang_vien'` (migration riêng) + `nhat_ky_nhac_lich.hang_doi_email_id uuid NULL REFERENCES hang_doi_email(id) ON DELETE SET NULL` + index `idx_nhac_lich_hang_doi`. Không UPDATE/DELETE dữ liệu.
- Mọi dữ liệu động trong HTML qua `e()`; `href` chỉ nhận chuỗi qua `laLienKet()`.
- Giờ/ngày hiển thị theo giờ VN, dùng `ngayVn`/`gioVn` (`nhac-lich.util.ts`).
- Tiêu đề: `[BDNLS] Lịch giảng dạy <tên giai đoạn> – khóa <mã khóa>` / `[BDNLS] Cập nhật lịch giảng dạy <tên giai đoạn> – khóa <mã khóa>`.
- Nhãn trên dải đầu email: `LỊCH GIẢNG DẠY` / `CẬP NHẬT LỊCH GIẢNG DẠY`; huy hiệu `Có thay đổi`; nút `Xem lịch dạy trên Cổng giảng viên` → `layFrontendUrl() + '/giang-day'`.
- Endpoint: `@Roles('ho_tro_giang_vien')`; khóa ngoài nhóm hoặc giai đoạn không thuộc khóa → `404` (`NotFoundAppException`).
- Test: backend `npx jest <file> --forceExit`, frontend `npx vitest run <file>` — không chạy watch, luôn đặt timeout của lệnh, không chạy lặp (bộ test hay bị treo).
- Worktree có thể dùng chung `node_modules` qua junction: chạy `npx prisma generate` trong worktree sẽ ghi đè client dùng chung — chỉ chạy sau khi đã thêm schema, và nhớ chạy lại ở checkout chính sau khi merge.
- Tài liệu cập nhật trong task sở hữu tính năng: `docs/database-ddl.sql` (Task 1), `docs/api-contract.md` (Task 4), `docs/huong-dan-doi-buoi-ho-tro.md` hoặc hướng dẫn hỗ trợ GV hiện có (Task 5).
- Commit xong là push ngay (không force-push).

## Review Focus

1. **Một giảng viên có vai trò khác nhau ở từng lớp** (lớp này dạy chính, lớp kia hỗ trợ) → vai trò hiển thị theo từng lớp, lấy từ `phan_cong_giang_day.vai_tro` của buổi trong lớp đó. Test ở Task 3.
2. **Buổi bắt đầu sau 17:00 UTC** (tức sau 0:00 giờ VN hôm sau) → hiện đúng thứ/ngày giờ VN. Test ở Task 2.
3. **Email có khoảng trắng hoặc chỉ toàn khoảng trắng** → `trim()`; rỗng thì `bo_qua: khong_co_email`, không xếp hàng địa chỉ rỗng. Test ở Task 3.
4. **Một người lỗi giữa lô** (transaction của người thứ k bị lỗi) → những người khác vẫn được xếp hàng; người lỗi vào `bo_qua` với `ly_do: 'loi_he_thong'` (giá trị thứ 3 bổ sung so với spec). Test ở Task 3.
5. **Bấm "Gửi" 2 lần liên tiếp** → nút bị tắt khi mutation đang chạy và modal đóng ngay, nên không có lô thứ hai. Test ở Task 5.

---

### Task 1: Migration + Prisma schema

**Files:**
- Create: `backend/prisma/migrations/20261017100000_su_kien_nhac_lich_giang_vien/migration.sql`
- Create: `backend/prisma/migrations/20261017100100_nhac_lich_hang_doi_email/migration.sql`
- Modify: `backend/prisma/schema.prisma` (enum `loai_su_kien_thong_bao` ~dòng 200; `model hang_doi_email` ~1212; `model nhat_ky_nhac_lich` ~1567)
- Modify: `docs/database-ddl.sql` (enum + bảng `nhat_ky_nhac_lich`)

**Interfaces:**
- Produces: enum value `nhac_lich_giang_vien`; field `nhat_ky_nhac_lich.hang_doi_email_id: string | null`, relation `nhat_ky_nhac_lich.hang_doi_email` ↔ `hang_doi_email.nhac_lich[]`.

- [ ] **Step 1:** Viết 2 file migration. Đầu mỗi file có comment theo mẫu `20261016200000_phan_cong_ho_tro_lop` (ngày, ADR 0009, "chỉ thêm", dòng Rollback). File 2 dùng SQL của spec §3, FK tên `nhat_ky_nhac_lich_hang_doi_email_id_fkey`, `ON UPDATE NO ACTION`.
- [ ] **Step 2:** Sửa schema: thêm `nhac_lich_giang_vien` vào **cuối** enum, kèm comment ADR 0009 + "migration riêng". Thêm `hang_doi_email_id String? @db.Uuid`, relation `hang_doi_email hang_doi_email? @relation(fields: [hang_doi_email_id], references: [id], onDelete: SetNull, onUpdate: NoAction)` và `@@index([hang_doi_email_id], map: "idx_nhac_lich_hang_doi")`; thêm `nhac_lich nhat_ky_nhac_lich[]` vào `hang_doi_email`.
- [ ] **Step 3:** Chạy `cd backend && npx prisma validate && npx prisma migrate deploy && npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` (DB dev = container Docker `localhost:5432`). Expected: validate OK, 2 migration được áp, diff rỗng (`-- This is an empty migration.`).
- [ ] **Step 4:** `npx prisma generate && npx tsc --noEmit -p tsconfig.json` → không lỗi.
- [ ] **Step 5:** Cập nhật `docs/database-ddl.sql`, rồi commit `feat(email-lich-day): migration su kien + hang_doi_email_id (ADR 0009)` và push.

### Task 2: Mẫu email `mauLichGiangDay`

**Files:**
- Modify: `backend/src/thong-bao/mau-email/mau-email.ts` (thêm mục "5. Lịch giảng dạy" sau `mauLichHoc`)
- Test: `backend/src/thong-bao/mau-email/mau-email.spec.ts`
- Modify: `design/mau-email/render-preview.ts` (sinh lại 5a/5b từ hàm thật, thay bản phác)

**Interfaces:**
- Consumes: `boCucEmail, bangThongTin, khoiNoiBat, huyHieu, nutBam, tieuDeMuc, doanVan, chuNho, e, laLienKet, MAU` (`bo-cuc.ts`); `ngayVn, gioVn, lienKetBanDo` (`nhac-lich/nhac-lich.util.ts`); `LOAI_LOP_LABEL`, `VAI_TRO_LABEL`, `HINH_THUC_LABEL`, `EmailDaDung` (cùng file).
- Produces:
```ts
export type BuoiLichDay = {
  buoiSo: number; batDau: Date; ketThuc: Date;
  diemHoc: { ten: string; diaChi: string } | null;
  phong: string | null; diaDiemHoacLink: string | null;
  coThayDoi: boolean;
};
export type LopLichDay = {
  tenLop: string; loaiLop: loai_lop_hoc; vaiTro: vai_tro_nhan_su_lop;
  buoi: BuoiLichDay[];
  hauCan: { noiOTen: string | null; noiODiaChi: string | null; nhanPhong: Date | null; traPhong: Date | null;
            phuongTien: string | null; donLuc: Date | null; diemDon: string | null; lienHeDon: string | null } | null;
  thucDia: { hoTen: string; soDienThoai: string }[];
};
export type MauLichGiangDayInput = {
  hoTen: string; tenKhoa: string; maKhoa: string;
  giaiDoan: { ten: string; hinhThuc: hinh_thuc_giai_doan; tuNgay: Date; denNgay: Date };
  lop: LopLichDay[];                      // đã sắp theo thứ tự hiển thị
  nhomHoTro: { hoTen: string; email: string | null }[];
  linkCongGiangVien: string | null;       // null → không có nút
  capNhat: { guiLucTruoc: Date; buoiGo: { tenLop: string; buoiSo: number; batDau: Date }[] } | null;
};
export function mauLichGiangDay(p: MauLichGiangDayInput): EmailDaDung & { tomTat: string };
```

- [ ] **Step 1: Test thất bại** — trong `describe('mauLichGiangDay')`, các case dùng 1 fixture 2 lớp (TT-03 trực tiếp 3 buổi có hậu cần + thực địa, Zoom-07 2 buổi link `https://zoom.us/j/1`):
  - `tieuDe` = `'[BDNLS] Lịch giảng dạy Giai đoạn 2 – khóa AG-2026-01'`; html chứa `LỊCH GIẢNG DẠY`, `5 buổi · 2 lớp`, `Vai trò: Giảng viên`.
  - Thứ tự buổi trong lớp theo `batDau` kể cả khi input bị đảo.
  - `batDau = 2026-10-24T17:30:00Z` → html chứa `Chủ nhật, 25/10/2026` và `00:30` (Review Focus 2).
  - Địa điểm: `diemHoc` → chứa tên, địa chỉ, `phòng A2.05`, `google.com/maps`; lớp zoom + link https → `Vào phòng Zoom` + `href="https://zoom.us/j/1"`; lớp trực tiếp + link https → `Mở liên kết`; chuỗi `Hội trường B` → hiện nguyên văn; `javascript:alert(1)` → không có `href="javascript`; mọi trường null → `Đang cập nhật`.
  - Lớp không có `hauCan` và `thucDia` rỗng → không có `Chỗ ở`/`Đưa đón`/`Hỗ trợ tại điểm học`.
  - `linkCongGiangVien: null` → không có `Xem lịch dạy trên Cổng giảng viên`; có link → `href` đúng link.
  - `capNhat` → tiêu đề `[BDNLS] Cập nhật lịch giảng dạy …`, html chứa `CẬP NHẬT LỊCH GIẢNG DẠY`, giờ gửi trước dạng `09:15 ngày 17/10/2026`, `Có thay đổi` xuất hiện đúng số buổi `coThayDoi`, khối `Không còn trong lịch của Thầy/Cô` liệt kê `TT-03 – Buổi 2`; `buoiGo` rỗng → không có khối đó.
  - `hoTen: '<script>x</script>'` → html chứa `&lt;script&gt;`, không chứa `<script>x`.
  - `tomTat` không chứa `<`, có dòng `TT-03 – Buổi 1: Thứ bảy, 24/10/2026, 07:30–11:30`.
- [ ] **Step 2:** `cd backend && npx jest src/thong-bao/mau-email/mau-email.spec.ts --forceExit` → FAIL (`mauLichGiangDay` is not a function / không import được).
- [ ] **Step 3:** Cài đặt theo bố cục đã duyệt: khối cảnh báo (5b) → khối buổi gỡ (5b) → lời chào → `bangThongTin` (Khóa / Giai đoạn `HINH_THUC_LABEL · dd/mm/yyyy – dd/mm/yyyy` / Lịch dạy của Thầy/Cô) → `tieuDeMuc('Lịch dạy chi tiết')` → từng lớp (tiêu đề, dòng phụ `LOAI_LOP_LABEL · Vai trò: VAI_TRO_LABEL · n buổi`, bảng Thời gian | Địa điểm, rồi `bangThongTin` hậu cần + thực địa nếu có) → `Liên hệ nhóm hỗ trợ giảng viên` (bỏ qua nếu rỗng) → khối thông tin "Lịch có thể được điều chỉnh…" → nút (nếu có link). Câu chữ lấy nguyên văn từ `5a`/`5b`. Dòng `chuNho` "Nút trên chỉ hiện khi…" của bản phác **không** đưa vào email thật.
- [ ] **Step 4:** Chạy lại lệnh Step 2 → PASS (cả các test cũ trong file).
- [ ] **Step 5:** Sửa `render-preview.ts` cho sinh 5a/5b từ `mauLichGiangDay` với fixture như bản phác; chạy `cd backend && npx ts-node -O "{\"module\":\"commonjs\",\"moduleResolution\":\"node\"}" --transpile-only ../design/mau-email/render-preview.ts`, mở 2 file html để so mắt với bản đã duyệt. Commit `feat(email-lich-day): mau email lich giang day 5a/5b` + push.

### Task 3: `EmailLichDayService`

**Files:**
- Create: `backend/src/nhac-lich/email-lich-day.service.ts`
- Test: `backend/src/nhac-lich/email-lich-day.service.spec.ts`
- Modify: `backend/src/nhac-lich/nhac-lich.module.ts` (providers/exports; `NhatKyService` inject được ngay vì `NhatKyModule` là `@Global`)
- Modify: `backend/src/nhat-ky/nhat-ky.service.ts` (thêm `'ho_tro_gv_gui_email_lich_day'` vào `HanhDongNhatKy` + nhãn `'Người hỗ trợ GV gửi email lịch giảng dạy'`)

**Interfaces:**
- Consumes: `mauLichGiangDay`, `MauLichGiangDayInput` (Task 2); `trangThaiNhac, gopTrangThaiNhac` (`nhac-lich.util.ts`); `layFrontendUrl` (`common/utils/token-xac-thuc.util`); `NhatKyService.ghi`.
- Produces:
```ts
export type LyDoBoQua = 'khong_co_email' | 'khong_co_buoi' | 'loi_he_thong';
export interface DongGiangVienEmail {
  id: string; ho_ten: string; email: string | null; so_buoi: number; so_lop: number;
  trang_thai_nhac: TrangThaiNhac;
  email_cuoi: { gui_luc: Date; trang_thai: trang_thai_hang_doi_email; loi: string | null } | null;
}
class EmailLichDayService {
  danhSach(khoaId: string, gdId: string): Promise<{
    giai_doan: { id: string; ten_giai_doan: string; hinh_thuc: hinh_thuc_giai_doan; thoi_gian_bat_dau: Date; thoi_gian_ket_thuc: Date };
    giang_vien: DongGiangVienEmail[] }>;
  xemTruoc(khoaId: string, gdId: string, gvId: string): Promise<{ tieu_de: string; html: string; la_cap_nhat: boolean; email: string | null }>;
  gui(user: AuthenticatedUser, khoaId: string, gdId: string, gvIds: string[]): Promise<{
    da_xep_hang: number; bo_qua: { giang_vien_id: string; ho_ten: string; ly_do: LyDoBoQua }[] }>;
}
```
- Private `dungEmail(khoaId, gdId, gvId): Promise<{ gv; lich_hoc_ids: string[]; mau: EmailDaDung & { tomTat: string }; la_cap_nhat: boolean } | null>` (null = không có buổi), dùng chung cho `xemTruoc` và `gui`. Mọi hàm public gọi trước `layGiaiDoan(khoaId, gdId)` (ném `NotFoundAppException('Không tìm thấy giai đoạn của khóa')` khi `giai_doan.khoa_id !== khoaId`).

- [ ] **Step 1: Test thất bại** — mock `PrismaService` theo kiểu `nhac-lich.service.spec.ts` (`jest.fn()` cho từng delegate, `$transaction: jest.fn((fn) => fn(tx))`). Các case:
  - `danhSach`: 2 giảng viên; GV A dạy 3 buổi ở 2 lớp → `so_buoi: 3, so_lop: 2`; `where` của `lich_hoc_lop.findMany` có `giai_doan_id`, `lop: { khoa_id, trang_thai: 'active' }`. `trang_thai_nhac` gộp đúng từ nhật ký (một buổi sửa sau lần gửi → `can_nhac_lai`). `email_cuoi` lấy từ nhật ký mới nhất có `hang_doi_email_id`, cùng trạng thái dòng hàng đợi.
  - `layGiaiDoan`: giai đoạn thuộc khóa khác → `NotFoundAppException`.
  - Vai trò theo lớp: GV là `giang_vien` ở TT-03 và `ho_tro` ở Zoom-07 → input của mẫu có `vaiTro` đúng theo từng lớp (spy `mauLichGiangDay` qua `jest.mock` hoặc kiểm html chứa `Vai trò: Hỗ trợ`) — Review Focus 1.
  - 5a/5b: không có nhật ký email → `la_cap_nhat: false`; chỉ có nhật ký Zalo (`hang_doi_email_id: null`) → vẫn `false`; có nhật ký email → `true`, buổi có `cap_nhat_luc > gui_luc` hoặc không nằm trong `lich_hoc_ids` cũ → `coThayDoi: true`; buổi cũ còn tồn tại trong giai đoạn nhưng không còn phân công → nằm trong `buoiGo`.
  - `linkCongGiangVien`: tài khoản `trang_thai: 'active'` → có link `/giang-day`; không có tài khoản hoặc `inactive` → null.
  - `gui` happy path: 2 GV → `tx.hang_doi_email.create` gọi 2 lần với `loai_su_kien: 'nhac_lich_giang_vien'`, `hoc_vien_id: null`, `email_nguoi_nhan` đã trim; `tx.nhat_ky_nhac_lich.create` có `hang_doi_email_id` = id vừa tạo, `doi_tuong: 'giang_vien'`, `nguoi_gui: user.id`, `noi_dung` bắt đầu bằng tiêu đề; trả `{ da_xep_hang: 2, bo_qua: [] }`; `nhatKy.ghi` gọi 1 lần với `hanh_dong: 'ho_tro_gv_gui_email_lich_day'`, `chi_tiet: { khoa_id, giai_doan_id, so_nguoi: 2 }`.
  - `gui` bỏ qua: email `null` và `'   '` → `khong_co_email` (Review Focus 3); không có buổi → `khong_co_buoi`; các GV khác vẫn gửi.
  - `gui` lỗi giữa lô: `$transaction` của GV thứ 2 ném lỗi → GV 1 và 3 vẫn được xếp hàng, GV 2 vào `bo_qua` với `loi_he_thong` (Review Focus 4). Lỗi ở `nhat_ky_nhac_lich.create` nằm trong cùng transaction → không còn `hang_doi_email` ngoài transaction (kiểm bằng việc create chỉ gọi qua `tx`, không qua `prisma`).
- [ ] **Step 2:** `cd backend && npx jest src/nhac-lich/email-lich-day.service.spec.ts --forceExit` → FAIL (không tìm thấy module).
- [ ] **Step 3:** Cài đặt theo spec §4–§5. Mỗi GV một `this.prisma.$transaction(async (tx) => …)` riêng, chạy tuần tự, bọc try/catch; ghi `nhatKy.ghi` một lần sau vòng lặp (chỉ khi `da_xep_hang > 0`). Lấy nhóm hỗ trợ từ `phan_cong_ho_tro_gv` (`nguoi_dung: { ho_ten, email }`), thứ tự lớp theo buổi sớm nhất.
- [ ] **Step 4:** Chạy lại lệnh Step 2 + `npx jest src/nhac-lich --forceExit` → PASS.
- [ ] **Step 5:** Commit `feat(email-lich-day): EmailLichDayService gom lich, chon 5a/5b, xep hang` + push.

### Task 4: Endpoint + DTO

**Files:**
- Modify: `backend/src/ho-tro-giang-vien/ho-tro-giang-vien.controller.ts` (thêm khối `// ADR 0009: email lịch giảng dạy`)
- Modify: `backend/src/ho-tro-giang-vien/ho-tro-giang-vien-scope.service.ts` (đổi `khoaIdsCuaToi` từ `private` sang public)
- Create: `backend/src/nhac-lich/email-lich-day.dto.ts`
- Test: Create `backend/src/ho-tro-giang-vien/ho-tro-giang-vien.controller.spec.ts` (chưa có; mock service) + `backend/src/nhac-lich/email-lich-day.dto.spec.ts`
- Modify: `docs/api-contract.md` (mục hỗ trợ giảng viên)

**Interfaces:**
- Consumes: `EmailLichDayService` (Task 3), `HoTroGiangVienScopeService.damBaoKhoaTrongPhamVi`, `khoaIdsCuaToi`.
- Produces (HTTP, tiền tố `/ho-tro-giang-vien`):
  - `GET khoa` → `{ id, ma_khoa, ten_khoa, giai_doan: { id, thu_tu, ten_giai_doan, hinh_thuc, thoi_gian_bat_dau, thoi_gian_ket_thuc }[] }[]` — các khóa trong nhóm, giai đoạn `trang_thai: active` xếp theo `thu_tu`.
  - `GET khoa/:khoaId/giai-doan/:gdId/email-lich-day` → `danhSach`.
  - `GET khoa/:khoaId/giai-doan/:gdId/email-lich-day/:gvId/xem-truoc` → `xemTruoc`.
  - `POST khoa/:khoaId/giai-doan/:gdId/email-lich-day/gui` body `GuiEmailLichDayDto { giang_vien_ids: string[] }` → `gui`.
  - Các tham số qua `ParseUUIDPipe`; mọi route gọi `damBaoKhoaTrongPhamVi(user.id, khoaId)` trước.

- [ ] **Step 1: Test thất bại** — DTO (`validate(plainToInstance(...))`): `[]` → lỗi; 201 phần tử → lỗi; `['x']` → lỗi; 2 uuid trùng → lỗi (`@ArrayUnique()`); 1 uuid → hợp lệ. Controller: khóa ngoài phạm vi (`damBaoKhoaTrongPhamVi` ném) → service không được gọi; `GET khoa` chỉ trả khóa thuộc `khoaIdsCuaToi`.
- [ ] **Step 2:** `cd backend && npx jest src/nhac-lich/email-lich-day.dto.spec.ts src/ho-tro-giang-vien/ho-tro-giang-vien.controller.spec.ts --forceExit` → FAIL.
- [ ] **Step 3:** Viết DTO (`@IsArray @ArrayMinSize(1) @ArrayMaxSize(200) @ArrayUnique() @IsUUID('all', { each: true })`) và 4 route; inject `EmailLichDayService` vào controller (module đã import `NhacLichModule`).
- [ ] **Step 4:** Chạy lại lệnh Step 2 + `npx jest src/ho-tro-giang-vien --forceExit` + `npx tsc --noEmit` → PASS.
- [ ] **Step 5:** Cập nhật `docs/api-contract.md` (4 endpoint, body, `bo_qua.ly_do` gồm cả `loi_he_thong`). Commit `feat(email-lich-day): endpoint gui email lich giang day` + push.

### Task 5: Trang "Gửi lịch dạy"

**Files:**
- Create: `frontend/src/api/emailLichDay.ts`
- Create: `frontend/src/pages/HoTroGv/HoTroGvGuiLichDay.tsx`
- Test: `frontend/src/pages/HoTroGv/HoTroGvGuiLichDay.test.tsx`
- Modify: `frontend/src/test/mocks/handlers.ts` (handler 4 endpoint)
- Modify: `frontend/src/router.tsx` (route `/ho-tro-gv/gui-lich-day`, lazy như `/ho-tro-gv/lich-day`)
- Modify: `frontend/src/pages/HoTroGv/HoTroGvLayout.tsx` (thêm `{ to: '/ho-tro-gv/gui-lich-day', nhan: 'Gửi lịch dạy', end: false }` vào `MENU`, sau "Lịch dạy")
- Modify: hướng dẫn cho người hỗ trợ GV trong `docs/` (mục "Gửi lịch dạy qua email": các bước, ý nghĩa trạng thái, gửi lại sau khi đổi lịch)

**Interfaces:**
- Consumes: 4 endpoint của Task 4; nhãn/màu trạng thái nhắc hiện có (`frontend/src/api/nhacLich.ts` `TrangThaiNhac` + component huy hiệu đang dùng ở `HoTroGvViecCanLam`/`ModalTinNhanNhac` — dùng lại, không định nghĩa nhãn mới).
- Produces: `useKhoaCuaToiGv()`, `useDanhSachEmailLichDay(khoaId, gdId)`, `useXemTruocEmailLichDay(khoaId, gdId, gvId | null)`, `useGuiEmailLichDay(khoaId, gdId)` (invalidate danh sách khi thành công).

- [ ] **Step 1: Test thất bại** (MSW, render trong router test hiện có):
  - Fixture 4 GV: A (có email, `chua_nhac`), B (có email, `can_nhac_lai`), C (có email, `da_nhac`), D (`email: null`). Mặc định A, B được tích, C không; ô của D bị `disabled` và có chữ `Chưa có email`; nút `Gửi email (2)`.
  - Tích thêm C → `Gửi email (3)`; bỏ hết → nút bị tắt.
  - Bấm `Xem trước` của A → modal có `iframe` với `srcdoc` chứa tiêu đề trả về, và có thuộc tính `sandbox`.
  - Bấm `Gửi email (2)` → modal xác nhận có `cho 2 giảng viên` → bấm xác nhận → body POST đúng `{ giang_vien_ids: [A, B] }`; trả `bo_qua: [{ ho_ten: 'B', ly_do: 'khong_co_email' }]` → thông báo chứa `Đã xếp hàng 1 email` và `Bỏ qua 1`; danh sách được tải lại (handler GET được gọi lần 2).
  - Khi POST đang chờ (handler `delay`), nút xác nhận ở trạng thái loading/disabled và bấm lần nữa không gọi POST thêm (Review Focus 5).
  - Đổi giai đoạn trong select → gọi GET với `gdId` mới, query string có `gd=`; danh sách rỗng → `Giai đoạn này chưa phân công giảng viên`.
  - Cột Email gần nhất: `cho_gui` → `Đang chờ gửi`; `that_bai` → `Lỗi`.
- [ ] **Step 2:** `cd frontend && npx vitest run src/pages/HoTroGv/HoTroGvGuiLichDay.test.tsx` → FAIL.
- [ ] **Step 3:** Cài đặt hooks + trang theo spec §6 (Mantine `Select`, `Table`, `Checkbox`, `Modal`, `notifications`). Mặc định chọn khóa đầu tiên và giai đoạn đang diễn ra hoặc sắp diễn ra gần nhất. Lưu `khoa`/`gd` trên query string.
- [ ] **Step 4:** Chạy lại lệnh Step 2 + `npx vitest run src/pages/HoTroGv` + `npx tsc --noEmit` → PASS.
- [ ] **Step 5:** Viết mục hướng dẫn. Commit `feat(email-lich-day): trang gui lich day cho ho tro GV` + push.

### Task 6: Kiểm tra cuối trên DB dev

**Files:** không có file mới (chỉ sửa nếu phát hiện lỗi).

- [ ] **Step 1:** `cd backend && npx jest src/nhac-lich src/thong-bao src/ho-tro-giang-vien src/bang-kiem --forceExit` và `cd frontend && npx vitest run src/pages/HoTroGv` → PASS.
- [ ] **Step 2:** Chạy app ở dev (skill `run`), đăng nhập tài khoản `ho_tro_giang_vien` có khóa. Gửi cho 1 giảng viên có email test. Kiểm: dòng `hang_doi_email` `cho_gui` → `thanh_cong` sau ≤1 phút (SMTP dev/ethereal); email hiển thị như mẫu 5a; mục bảng kiểm `da_nhac_giang_vien` của đợt đó chuyển sang đạt. Sửa giờ 1 buổi → trạng thái `Cần nhắc lại` → gửi lại → nhận được bản 5b có huy hiệu ở đúng buổi.
- [ ] **Step 3:** Ghi tóm tắt deploy vào ADR 0009 (§Hệ quả: 2 migration chỉ thêm, cần backup `pg_dump` trước `migrate deploy`, không đổi dữ liệu). Đổi trạng thái ADR thành "Đã chấp nhận". Commit `docs(email-lich-day): chot ADR 0009` + push.

## Ghi chú lệch so với spec

- Spec §6 mục cuối ("nhãn Email ở nhật ký nhắc trên Hồ sơ chuẩn bị lớp"): bỏ — giao diện hiện **không có** danh sách nhật ký nhắc (`trang-lop.service.ts` chỉ dùng nhật ký để tính cờ). Cờ nhắc vẫn tự cập nhật qua E4.
- Thêm `GET /ho-tro-giang-vien/khoa` (spec không có) vì trang cần danh sách khóa + giai đoạn trong nhóm và hiện chưa có endpoint nào trả dữ liệu này.
- Thêm `ly_do: 'loi_he_thong'` (Review Focus 4).
