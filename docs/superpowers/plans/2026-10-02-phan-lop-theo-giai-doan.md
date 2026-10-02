# Phân lớp học viên theo giai đoạn — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay việc gán học viên "1 lớp mỗi loại" (`dang_ky_hoc_lop`) bằng gán "1 lớp mỗi giai đoạn" (`phan_lop_giai_doan`), kèm import dạng cột-theo-giai-đoạn, thông tin chung cho giai đoạn đánh giá, và màn hình học viên dạng dòng thời gian.

**Architecture:** Bảng mới `phan_lop_giai_doan (dang_ky_hoc_id, giai_doan_id) → lop_id` là nguồn sự thật duy nhất; dữ liệu cũ được chuyển bằng SQL trong migration. Ghi (import, API sửa tay, học bù) chuyển sang bảng mới trước; đọc (M7, báo cáo, email) chuyển sau; bảng cũ chỉ bị drop ở task cuối khi không còn tham chiếu. Logic thuần (đọc tiêu đề Excel, cảnh báo) tách thành util có unit test riêng.

**Tech Stack:** NestJS 10 + Prisma 6 (Postgres), ExcelJS, Jest (unit `npx jest`, e2e `npx jest --config ./test/jest-e2e.json --runInBand <file>`), React 18 + Mantine + TanStack Query, Vitest + MSW.

**Spec:** `docs/superpowers/specs/2026-10-02-phan-lop-theo-giai-doan-design.md`

## Global Constraints

- Mỗi (đăng ký học, giai đoạn) tối đa 1 lớp — unique `(dang_ky_hoc_id, giai_doan_id)`.
- Lớp, giai đoạn, đăng ký phải cùng `khoa_id` (kiểm ở service).
- Ô import: trống = giữ nguyên; `-` = gỡ; tên lớp = gán/thay.
- Cột giai đoạn nhận diện bằng tiền tố `^G[ĐD]\s*(\d+)` (không phân biệt hoa thường); phần tên sau tiền tố bỏ qua.
- File có cột `ten_lop` / `ten_lop_zoom` / `ten_lop_vle` → lỗi cả file "File theo mẫu cũ, vui lòng tải mẫu mới".
- Import `phan_lop_hoc_vien` và mẫu của nó **bắt buộc** `ma_khoa` (query).
- Gán lớp → đăng ký `da_phan_lop`; gỡ lớp **không** đổi trạng thái đăng ký.
- `giai_doan_khoa.link_hoac_dia_diem` ≤ 500 ký tự, `huong_dan` text, cả hai nullable.
- Email `dang_ky_hoc_phan_lop` chỉ kích hoạt khi dòng import gán ít nhất 1 lớp `truc_tiep` (giữ trigger cũ).
- Không đụng các file đang dở của session khác: `backend/src/import/util/moet-excel.util*.ts`, `backend/src/khoa-boi-duong/dto/diem-danh-row.dto.ts`, `backend/src/yeu-cau-ho-tro/*`, `frontend/src/pages/Admin/AdminYeuCauHoTro*`, `frontend/src/test/mocks/handlers.ts` (chỉ sửa đúng các handler nêu trong task, stage bằng hunk). Luôn `git add` theo đường dẫn cụ thể, không `git add -A`.
- Comment tiếng Việt, đúng mật độ comment hiện có; tên biến tiếng Việt không dấu như code xung quanh.
- Sau mỗi commit: `git push` (quy ước repo).

## Sai khác có chủ đích so với spec

- Spec 3.4 nói "script chuyển dữ liệu, sao lưu JSON, xuất CSV". Plan dùng **SQL trong migration** (chạy bằng `prisma migrate deploy` trên VPS, Prisma bọc transaction) + **script kiểm tra chỉ đọc** chạy trước (in bảng xung đột và lớp chưa có buổi). Không cần sao lưu JSON vì bảng nguồn `dang_ky_hoc_lop` còn nguyên tới Task 11.

## Review Focus

1. **Tên lớp có khoảng trắng/Unicode khác dạng (NFD từ Excel Mac)** — người dùng gõ "Lớp zoom 3" phải khớp lớp lưu bằng NFC. → Task 5 thêm test ô dạng NFD.
2. **Tiêu đề cột có khoảng trắng thừa hoặc chữ thường `gđ2`/`GD 2`** — phải nhận đúng giai đoạn. → Task 4 test.
3. **Một học viên được import lại với file chỉ có 1 cột GĐ** — các giai đoạn khác phải giữ nguyên. → Task 5 test.
4. **Giai đoạn bị vô hiệu hóa (`trang_thai = ngung`) nhưng file vẫn có cột của nó** — không được gán âm thầm; báo lỗi file như cột không tồn tại. → Task 5 test.
5. **Học viên chưa được gán lớp ở giai đoạn đánh giá và giai đoạn không có link/hướng dẫn** — M7 vẫn hiện thẻ giai đoạn (chỉ tiêu đề), không vỡ layout. → Task 8 test.

---

## File Structure

**Backend — tạo mới**
- `backend/prisma/migrations/20261002090000_phan_lop_giai_doan/migration.sql` — bảng mới + 2 cột giai đoạn.
- `backend/prisma/migrations/20261002090100_chuyen_dang_ky_hoc_lop_sang_giai_doan/migration.sql` — chuyển dữ liệu.
- `backend/src/khoa-boi-duong/util/chuyen-phan-lop.util.ts` (+ `.spec.ts` không cần — test e2e) — truy vấn kiểm tra trước khi chuyển (xung đột, lớp chưa có buổi).
- `backend/scripts/kiem-tra-chuyen-phan-lop.ts` — script chỉ đọc, in kết quả util trên.
- `backend/src/import/util/phan-lop-excel.util.ts` + `.spec.ts` — đọc tiêu đề/ dòng file phân lớp dạng cột theo giai đoạn.
- `backend/src/khoa-boi-duong/dto/gan-lop-giai-doan.dto.ts` — body `PUT .../giai-doan/:gdId/lop`.
- `backend/test/phan-lop-giai-doan.e2e-spec.ts` — e2e cho Task 1, 3, 5, 6.

**Backend — sửa**
- `backend/prisma/schema.prisma` — model `phan_lop_giai_doan`, 2 cột `giai_doan_khoa`.
- `backend/src/khoa-boi-duong/util/canh-bao-buoi-hoc.util.ts` (+ spec) — tách `canhBaoLoaiLopGiaiDoan`.
- `backend/src/khoa-boi-duong/dto/create-giai-doan.dto.ts`, `update-giai-doan.dto.ts`, `phan-lop-row.dto.ts`.
- `backend/src/khoa-boi-duong/khoa-boi-duong.service.ts` — `themGiaiDoan`/`capNhatGiaiDoan`, `ganLopGiaiDoan` (mới), `resolvePhanLopRow`/`commitPhanLop` (viết lại), `resolveDiemDanhRow` (học bù), `khoaHocTheoHocVienId`, `ketQuaCuaToi`, `findOne`, `capNhatLop`.
- `backend/src/khoa-boi-duong/dang-ky-hoc-thao-tac.controller.ts` — route PUT mới.
- `backend/src/import/import.service.ts`, `import.controller.ts`, `dto/mau-excel-query.dto.ts`.
- `backend/src/bao-cao/bao-cao.service.ts`, `backend/src/thong-bao/thong-bao.service.ts`.

**Frontend — sửa/tạo**
- `frontend/src/api/types.ts`, `frontend/src/api/khoaBoiDuong.ts`, `frontend/src/api/nhapDuLieu.ts`.
- `frontend/src/pages/M7/ThongTinLopHoc.tsx` (+ test), `frontend/src/test/mocks/db.ts` (`taoKhoaHocToiMau`).
- `frontend/src/pages/Admin/PhanLopTheoGiaiDoan.tsx` (mới, tách khỏi `AdminHocVienChiTiet.tsx`) + test.
- `frontend/src/pages/Admin/AdminKhoaChiTiet.tsx`, `ModalImportLopHoc.tsx`, `AdminNhapDuLieu.tsx` (+ tests).

---

### Task 1: Mô hình dữ liệu + chuyển dữ liệu cũ

**Files:**
- Modify: `backend/prisma/schema.prisma` (model `giai_doan_khoa` ~dòng 712, sau model `dang_ky_hoc_lop`)
- Create: `backend/prisma/migrations/20261002090000_phan_lop_giai_doan/migration.sql`
- Create: `backend/prisma/migrations/20261002090100_chuyen_dang_ky_hoc_lop_sang_giai_doan/migration.sql`
- Create: `backend/src/khoa-boi-duong/util/chuyen-phan-lop.util.ts`
- Create: `backend/scripts/kiem-tra-chuyen-phan-lop.ts`
- Test: `backend/test/phan-lop-giai-doan.e2e-spec.ts`

**Interfaces:**
- Produces: Prisma model `phan_lop_giai_doan` với unique input `dang_ky_hoc_id_giai_doan_id`; relation `dang_ky_hoc.phan_lop_giai_doan`, `giai_doan_khoa.phan_lop`, `lop_hoc.phan_lop_giai_doan`; cột `giai_doan_khoa.link_hoac_dia_diem: string | null`, `huong_dan: string | null`.
- Produces: `SQL_CHUYEN_PHAN_LOP: string`, `timXungDotChuyenPhanLop(prisma): Promise<{dang_ky_hoc_id: string; giai_doan_id: string; so_lop: number}[]>`, `timPhanLopChuaCoGiaiDoan(prisma): Promise<{dang_ky_hoc_id: string; lop_id: string; ten_lop: string}[]>`.

- [ ] **Step 1: Sửa schema**

Trong `model giai_doan_khoa`, sau `trang_thai`:

```prisma
  // Phân lớp theo giai đoạn (spec 2026-10-02): thông tin chung cho giai đoạn
  // không gán lớp (vd đánh giá đầu vào/đầu ra) — hiện cho toàn khóa ở M7.
  link_hoac_dia_diem String?             @db.VarChar(500)
  huong_dan          String?
```

và trong phần relation của `giai_doan_khoa` thêm `phan_lop phan_lop_giai_doan[]`. Trong `model lop_hoc` thêm `phan_lop_giai_doan phan_lop_giai_doan[]`; trong `model dang_ky_hoc` thêm `phan_lop_giai_doan phan_lop_giai_doan[]`. Thêm model mới ngay sau `model dang_ky_hoc_lop`:

```prisma
// Phân lớp theo giai đoạn (spec 2026-10-02-phan-lop-theo-giai-doan): mỗi
// (đăng ký học, giai đoạn) tối đa 1 lớp — thay thế dang_ky_hoc_lop (1 lớp
// mỗi loại). Bất biến cùng khoa_id kiểm ở KhoaBoiDuongService.
model phan_lop_giai_doan {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  dang_ky_hoc_id String   @db.Uuid
  giai_doan_id   String   @db.Uuid
  lop_id         String   @db.Uuid
  created_at     DateTime @default(now()) @db.Timestamptz(6)

  dang_ky_hoc dang_ky_hoc    @relation(fields: [dang_ky_hoc_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  giai_doan   giai_doan_khoa @relation(fields: [giai_doan_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  lop         lop_hoc        @relation(fields: [lop_id], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@unique([dang_ky_hoc_id, giai_doan_id], map: "uq_phan_lop_giai_doan")
  @@index([lop_id], map: "idx_phan_lop_giai_doan_lop")
  @@index([giai_doan_id], map: "idx_phan_lop_giai_doan_giai_doan")
}
```

- [ ] **Step 2: Sinh migration cấu trúc, gỡ DROP INDEX thừa**

Run (thư mục `backend`): `npx prisma migrate dev --create-only --name phan_lop_giai_doan`
Đổi tên thư mục sinh ra thành `20261002090000_phan_lop_giai_doan`. Mở `migration.sql`, **xóa mọi câu `DROP INDEX`** cho GIN trgm index (gotcha đã biết, xem `20260928065926_t14_loai_dot_xac_nhan_enum`). File còn lại phải chỉ gồm: `ALTER TABLE "giai_doan_khoa" ADD COLUMN ...` ×2, `CREATE TABLE "phan_lop_giai_doan"`, 3 `CREATE (UNIQUE) INDEX`, 3 `ADD CONSTRAINT ... FOREIGN KEY`. Thêm comment đầu file giải thích mục đích.

- [ ] **Step 3: Viết migration chuyển dữ liệu**

`backend/prisma/migrations/20261002090100_chuyen_dang_ky_hoc_lop_sang_giai_doan/migration.sql`:

```sql
-- Chuyển dang_ky_hoc_lop (1 lớp mỗi loại) sang phan_lop_giai_doan (1 lớp mỗi
-- giai đoạn): mỗi (đăng ký, lớp X) -> 1 dòng cho MỖI giai đoạn mà X có buổi.
-- Lớp chưa có buổi nào: không tạo dòng (chạy scripts/kiem-tra-chuyen-phan-lop.ts
-- để liệt kê, gán tay sau). Hai lớp của cùng đăng ký cùng có buổi trong 1 giai
-- đoạn: vi phạm uq_phan_lop_giai_doan -> migration FAIL và rollback (cố ý — chạy
-- script kiểm tra TRƯỚC khi deploy). Bảng cũ giữ nguyên tới task dọn dẹp.
INSERT INTO "phan_lop_giai_doan" ("dang_ky_hoc_id", "giai_doan_id", "lop_id")
SELECT DISTINCT dkl."dang_ky_hoc_id", lh."giai_doan_id", dkl."lop_id"
FROM "dang_ky_hoc_lop" dkl
JOIN "lich_hoc_lop" lh ON lh."lop_id" = dkl."lop_id";
```

- [ ] **Step 4: Viết util kiểm tra (dùng chung cho script và test)**

`backend/src/khoa-boi-duong/util/chuyen-phan-lop.util.ts`:

```ts
import { PrismaClient } from '@prisma/client';

// Chỉ đọc — chạy TRƯỚC migration 20261002090100 (xem
// scripts/kiem-tra-chuyen-phan-lop.ts). Cùng phép JOIN với migration đó.

// Câu INSERT của migration 20261002090100, giới hạn theo danh sách đăng ký —
// chỉ dùng trong test e2e (migration thật chạy không giới hạn).
export const SQL_CHUYEN_PHAN_LOP = `
INSERT INTO "phan_lop_giai_doan" ("dang_ky_hoc_id", "giai_doan_id", "lop_id")
SELECT DISTINCT dkl."dang_ky_hoc_id", lh."giai_doan_id", dkl."lop_id"
FROM "dang_ky_hoc_lop" dkl
JOIN "lich_hoc_lop" lh ON lh."lop_id" = dkl."lop_id"
WHERE dkl."dang_ky_hoc_id" = ANY($1::uuid[])`;

export function timXungDotChuyenPhanLop(prisma: PrismaClient) {
  return prisma.$queryRaw<
    { dang_ky_hoc_id: string; giai_doan_id: string; so_lop: number }[]
  >`
    SELECT dkl."dang_ky_hoc_id", lh."giai_doan_id",
           COUNT(DISTINCT dkl."lop_id")::int AS so_lop
    FROM "dang_ky_hoc_lop" dkl
    JOIN "lich_hoc_lop" lh ON lh."lop_id" = dkl."lop_id"
    GROUP BY dkl."dang_ky_hoc_id", lh."giai_doan_id"
    HAVING COUNT(DISTINCT dkl."lop_id") > 1`;
}

export function timPhanLopChuaCoGiaiDoan(prisma: PrismaClient) {
  return prisma.$queryRaw<
    { dang_ky_hoc_id: string; lop_id: string; ten_lop: string }[]
  >`
    SELECT dkl."dang_ky_hoc_id", dkl."lop_id", l."ten_lop"
    FROM "dang_ky_hoc_lop" dkl
    JOIN "lop_hoc" l ON l."id" = dkl."lop_id"
    WHERE NOT EXISTS (
      SELECT 1 FROM "lich_hoc_lop" lh WHERE lh."lop_id" = dkl."lop_id")`;
}
```

`backend/scripts/kiem-tra-chuyen-phan-lop.ts`:

```ts
// Chạy TRƯỚC khi deploy migration 20261002090100 (chỉ đọc):
//   npx ts-node scripts/kiem-tra-chuyen-phan-lop.ts
import { PrismaClient } from '@prisma/client';
import {
  timPhanLopChuaCoGiaiDoan,
  timXungDotChuyenPhanLop,
} from '../src/khoa-boi-duong/util/chuyen-phan-lop.util';

(async () => {
  const prisma = new PrismaClient();
  const xungDot = await timXungDotChuyenPhanLop(prisma);
  const chuaCoGiaiDoan = await timPhanLopChuaCoGiaiDoan(prisma);
  console.log(`Xung đột (migration sẽ FAIL nếu > 0): ${xungDot.length}`);
  console.table(xungDot);
  console.log(`Gán lớp chưa có buổi (sẽ KHÔNG được chuyển): ${chuaCoGiaiDoan.length}`);
  console.table(chuaCoGiaiDoan);
  await prisma.$disconnect();
  process.exit(xungDot.length > 0 ? 1 : 0);
})();
```

- [ ] **Step 5: Viết e2e thất bại cho chuyển dữ liệu**

Tạo `backend/test/phan-lop-giai-doan.e2e-spec.ts` (khung dùng chung cho các task sau; helper giống `test/lop-va-lich-hoc.e2e-spec.ts`: `taoKhoa`, `taoGiaiDoan(khoaId, thuTu, overrides?)`, `taoLop(khoaId, loai, ten)`, `taoBuoi(lopId, giaiDoanId, buoiSo)`, `taoHocVienMoet(suf)` trả `{hocVien, tenDangNhap}`, `ghiDanh(hocVienId, khoaId)` tạo `dang_ky_hoc` trạng thái `da_duyet`; `afterAll` xóa `phan_lop_giai_doan`, `dang_ky_hoc_lop`, `diem_danh`, `dang_ky_hoc`, `lich_hoc_lop`, `lop_hoc`, `giai_doan_khoa`, `nhat_ky_import`, `khoa_boi_duong` theo `khoaIds`, rồi học viên/người dùng như file mẫu). `taoGiaiDoan(khoaId, thuTu, overrides = {})` tạo **thẳng bằng Prisma** (`prisma.giai_doan_khoa.create`, để đặt được cả `trang_thai: 'ngung'`), mặc định `ten_giai_doan: `Giai đoạn ${thuTu}``, `hinh_thuc: 'truc_tuyen'`, ngày `new Date('2026-01-01')`→`new Date('2026-12-31')`, rồi spread `overrides`; `taoBuoi(lopId, giaiDoanId, buoiSo)` tạo `lich_hoc_lop` ngày `2026-10-10T01:00Z`→`04:00Z`. Thêm `buildXlsx(rows: string[][])` (dòng đầu là tiêu đề), `dangNhap(tenDangNhap, matKhau)` như các file e2e khác.

```ts
describe('Chuyển dang_ky_hoc_lop -> phan_lop_giai_doan', () => {
  it('lớp có buổi ở 2 giai đoạn -> 2 dòng; lớp không có buổi -> 0 dòng và nằm trong danh sách chưa có giai đoạn', async () => {
    const khoa = await taoKhoa();
    const gd1 = await taoGiaiDoan(khoa.id, 1);
    const gd2 = await taoGiaiDoan(khoa.id, 2);
    const lopZoom = await taoLop(khoa.id, 'zoom', 'Zoom chuyển');
    const lopVle = await taoLop(khoa.id, 'vle', 'VLE chưa buổi');
    await taoBuoi(lopZoom.id, gd1.id, 1);
    await taoBuoi(lopZoom.id, gd2.id, 1);
    const { hocVien } = await taoHocVienMoet(uniqueSuffix());
    const dk = await ghiDanh(hocVien.id, khoa.id);
    await prisma.dang_ky_hoc_lop.createMany({
      data: [
        { dang_ky_hoc_id: dk.id, lop_id: lopZoom.id, loai_lop: 'zoom' },
        { dang_ky_hoc_id: dk.id, lop_id: lopVle.id, loai_lop: 'vle' },
      ],
    });

    const chuaCo = await timPhanLopChuaCoGiaiDoan(prisma);
    expect(chuaCo).toContainEqual(
      expect.objectContaining({ dang_ky_hoc_id: dk.id, lop_id: lopVle.id }),
    );
    await prisma.$executeRawUnsafe(SQL_CHUYEN_PHAN_LOP, [dk.id]);

    const rows = await prisma.phan_lop_giai_doan.findMany({
      where: { dang_ky_hoc_id: dk.id },
    });
    expect(rows.map((r) => [r.giai_doan_id, r.lop_id]).sort()).toEqual(
      [[gd1.id, lopZoom.id], [gd2.id, lopZoom.id]].sort(),
    );
  });

  it('2 lớp của cùng đăng ký có buổi chung 1 giai đoạn -> được báo xung đột, INSERT thất bại', async () => {
    const khoa = await taoKhoa();
    const gd1 = await taoGiaiDoan(khoa.id, 1);
    const lopA = await taoLop(khoa.id, 'zoom', 'Zoom A');
    const lopB = await taoLop(khoa.id, 'vle', 'VLE B');
    await taoBuoi(lopA.id, gd1.id, 1);
    await taoBuoi(lopB.id, gd1.id, 1);
    const { hocVien } = await taoHocVienMoet(uniqueSuffix());
    const dk = await ghiDanh(hocVien.id, khoa.id);
    await prisma.dang_ky_hoc_lop.createMany({
      data: [
        { dang_ky_hoc_id: dk.id, lop_id: lopA.id, loai_lop: 'zoom' },
        { dang_ky_hoc_id: dk.id, lop_id: lopB.id, loai_lop: 'vle' },
      ],
    });

    expect(await timXungDotChuyenPhanLop(prisma)).toContainEqual({
      dang_ky_hoc_id: dk.id,
      giai_doan_id: gd1.id,
      so_lop: 2,
    });
    await expect(
      prisma.$executeRawUnsafe(SQL_CHUYEN_PHAN_LOP, [dk.id]),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 6: Chạy test, xác nhận FAIL**

Run: `npx jest --config ./test/jest-e2e.json --runInBand test/phan-lop-giai-doan.e2e-spec.ts`
Expected: FAIL — bảng `phan_lop_giai_doan` chưa tồn tại (chưa áp migration) / import util lỗi.

- [ ] **Step 7: Áp migration + generate**

Run: `npx ts-node scripts/kiem-tra-chuyen-phan-lop.ts` (DB local) — ghi lại số xung đột (phải 0) và số dòng chưa có giai đoạn.
Run: `npx prisma migrate deploy && npx prisma generate`
(Nếu `prisma generate` báo EPERM vì dev server giữ file `.dll`: dừng dev server rồi chạy lại.)

- [ ] **Step 8: Chạy test, xác nhận PASS**

Run: `npx jest --config ./test/jest-e2e.json --runInBand test/phan-lop-giai-doan.e2e-spec.ts`
Expected: PASS 2/2. Kiểm tra thêm DB local: `phan_lop_giai_doan` của khóa `2026-AG-NLS` có học viên `08901059055` ở GĐ2/3/4.

- [ ] **Step 9: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20261002090000_phan_lop_giai_doan backend/prisma/migrations/20261002090100_chuyen_dang_ky_hoc_lop_sang_giai_doan backend/src/khoa-boi-duong/util/chuyen-phan-lop.util.ts backend/scripts/kiem-tra-chuyen-phan-lop.ts backend/test/phan-lop-giai-doan.e2e-spec.ts
git commit -m "feat(phan-lop): bang phan_lop_giai_doan + chuyen du lieu tu dang_ky_hoc_lop"
git push
```

---

### Task 2: Link/hướng dẫn cho giai đoạn (API)

**Files:**
- Modify: `backend/src/khoa-boi-duong/dto/create-giai-doan.dto.ts`, `update-giai-doan.dto.ts`
- Modify: `backend/src/khoa-boi-duong/khoa-boi-duong.service.ts` (`themGiaiDoan` ~586, `capNhatGiaiDoan` ~624)
- Test: `backend/test/phan-lop-giai-doan.e2e-spec.ts`

**Interfaces:**
- Produces: body POST/PATCH giai đoạn nhận `link_hoac_dia_diem?: string | null` (≤500), `huong_dan?: string | null`; response giai đoạn có 2 field này.

- [ ] **Step 1: Test thất bại**

```ts
describe('Giai đoạn: link_hoac_dia_diem + huong_dan', () => {
  it('tạo kèm link/hướng dẫn, sửa thành null, link > 500 ký tự -> 400', async () => {
    const khoa = await taoKhoa();
    const tao = await request(app.getHttpServer())
      .post(`/khoa-boi-duong/${khoa.id}/giai-doan`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .send({
        thu_tu: 1, ten_giai_doan: 'Đánh giá đầu vào', hinh_thuc: 'danh_gia',
        thoi_gian_bat_dau: '2026-10-06', thoi_gian_ket_thuc: '2026-10-10',
        link_hoac_dia_diem: 'https://vle.hcmue.edu.vn/danh-gia',
        huong_dan: 'Làm bài trong 60 phút',
      })
      .expect(201);
    expect(tao.body.link_hoac_dia_diem).toBe('https://vle.hcmue.edu.vn/danh-gia');
    expect(tao.body.huong_dan).toBe('Làm bài trong 60 phút');

    const sua = await request(app.getHttpServer())
      .patch(`/khoa-boi-duong/${khoa.id}/giai-doan/${tao.body.id}`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .send({ link_hoac_dia_diem: null, huong_dan: null })
      .expect(200);
    expect(sua.body.link_hoac_dia_diem).toBeNull();
    expect(sua.body.huong_dan).toBeNull();

    await request(app.getHttpServer())
      .patch(`/khoa-boi-duong/${khoa.id}/giai-doan/${tao.body.id}`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .send({ link_hoac_dia_diem: 'x'.repeat(501) })
      .expect(400);
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL** (`-t "link_hoac_dia_diem"`) — field bị whitelist loại bỏ, `link_hoac_dia_diem` undefined.

- [ ] **Step 3: Cài đặt**

Thêm vào **cả hai** DTO (import thêm `IsOptional`, `ValidateIf` nếu chưa có):

```ts
  // Phân lớp theo giai đoạn (spec 2026-10-02): thông tin chung hiện cho toàn
  // khóa ở M7 khi học viên không được gán lớp ở giai đoạn này. null = xóa.
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(500)
  link_hoac_dia_diem?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  huong_dan?: string | null;
```

Trong `themGiaiDoan` và `capNhatGiaiDoan`, ở object `data` gửi vào Prisma, thêm:

```ts
        link_hoac_dia_diem: dto.link_hoac_dia_diem?.trim() || dto.link_hoac_dia_diem,
        huong_dan: dto.huong_dan,
```

(`undefined` = không đổi; `null` = xóa; chuỗi = lưu đã trim.) Nếu `capNhatGiaiDoan` gọi `assertCoTruongSua(dto)`, kiểm tra hàm đó đếm `null` là "có trường" — nếu không, sửa để coi key có mặt (kể cả `null`) là có trường sửa.

- [ ] **Step 4: Chạy lại, PASS.** Chạy thêm `npx jest --config ./test/jest-e2e.json --runInBand test/khoa-boi-duong.e2e-spec.ts -t "giai đoạn"` để chắc không vỡ.

- [ ] **Step 5: Commit + push**

```bash
git add backend/src/khoa-boi-duong/dto/create-giai-doan.dto.ts backend/src/khoa-boi-duong/dto/update-giai-doan.dto.ts backend/src/khoa-boi-duong/khoa-boi-duong.service.ts backend/test/phan-lop-giai-doan.e2e-spec.ts
git commit -m "feat(giai-doan): link_hoac_dia_diem + huong_dan"
git push
```

---

### Task 3: Gán lớp theo giai đoạn (service + `PUT /dang-ky-hoc/:id/giai-doan/:gdId/lop`)

**Files:**
- Modify: `backend/src/khoa-boi-duong/util/canh-bao-buoi-hoc.util.ts` (+ spec)
- Create: `backend/src/khoa-boi-duong/dto/gan-lop-giai-doan.dto.ts`
- Modify: `backend/src/khoa-boi-duong/khoa-boi-duong.service.ts` (sau `xoaLopDangKy` ~1242)
- Modify: `backend/src/khoa-boi-duong/dang-ky-hoc-thao-tac.controller.ts`
- Test: util spec + `backend/test/phan-lop-giai-doan.e2e-spec.ts`

**Interfaces:**
- Produces: `canhBaoLoaiLopGiaiDoan(loaiLop: loai_lop_hoc, hinhThuc: hinh_thuc_giai_doan): string | undefined` (trả lý do, không kèm tiền tố).
- Produces: `KhoaBoiDuongService.canhBaoGanLopGiaiDoan(lop: {id; ten_lop; loai_lop}, giaiDoan: {id; thu_tu; ten_giai_doan; hinh_thuc}): Promise<string | undefined>` — dùng lại ở Task 5.
- Produces: `KhoaBoiDuongService.ganLopGiaiDoan(dangKyHocId: string, giaiDoanId: string, lopId: string | null, caller: AuthenticatedUser): Promise<{ phan_lop: phan_lop_giai_doan | null; canh_bao?: string }>`.
- Produces: route `PUT /dang-ky-hoc/:id/giai-doan/:giaiDoanId/lop` body `{ lop_id: string | null }`.

- [ ] **Step 1: Unit test thất bại cho util tách**

Thêm vào `canh-bao-buoi-hoc.util.spec.ts`:

```ts
describe('canhBaoLoaiLopGiaiDoan', () => {
  it.each([
    ['zoom', 'truc_tuyen', undefined],
    ['truc_tiep', 'truc_tiep', undefined],
    ['truc_tiep', 'khac', undefined],
    ['truc_tiep', 'truc_tuyen', 'lớp trực tiếp nhưng giai đoạn là trực tuyến'],
    ['vle', 'truc_tiep', 'lớp vle nhưng giai đoạn là trực tiếp'],
    ['zoom', 'danh_gia', 'giai đoạn là đánh giá, không phải giai đoạn học'],
  ] as const)('%s + %s -> %s', (loai, hinhThuc, mongDoi) => {
    expect(canhBaoLoaiLopGiaiDoan(loai, hinhThuc)).toBe(mongDoi);
  });
});
```

Run: `npx jest src/khoa-boi-duong/util` → FAIL (chưa export).

- [ ] **Step 2: Tách hàm**

Trong `canh-bao-buoi-hoc.util.ts` thêm và dùng lại trong `canhBaoBuoiHocGiaiDoan` (thay khối `if (giaiDoan.hinh_thuc === 'danh_gia') ... else if ...` bằng `const lech = canhBaoLoaiLopGiaiDoan(loaiLop, giaiDoan.hinh_thuc); if (lech) lyDo.push(lech);`):

```ts
// Loại lớp không khớp hình thức giai đoạn — dùng chung cho import lịch học,
// import phân lớp và gán tay (spec phân lớp theo giai đoạn, mục 4.5).
export function canhBaoLoaiLopGiaiDoan(
  loaiLop: loai_lop_hoc,
  hinhThuc: hinh_thuc_giai_doan,
): string | undefined {
  if (hinhThuc === 'danh_gia') {
    return 'giai đoạn là đánh giá, không phải giai đoạn học';
  }
  if (loaiLop === 'truc_tiep' && hinhThuc === 'truc_tuyen') {
    return 'lớp trực tiếp nhưng giai đoạn là trực tuyến';
  }
  if (loaiLop !== 'truc_tiep' && hinhThuc === 'truc_tiep') {
    return `lớp ${loaiLop} nhưng giai đoạn là trực tiếp`;
  }
  return undefined;
}
```

Run `npx jest src/khoa-boi-duong/util` → PASS (cả 8 test cũ).

- [ ] **Step 3: e2e thất bại cho API**

```ts
describe('PUT /dang-ky-hoc/:id/giai-doan/:gdId/lop', () => {
  let khoa: { id: string; ma_khoa: string };
  let gd2: { id: string };
  let lopZoom: { id: string };
  let lopTT: { id: string };
  let dkId: string;

  beforeAll(async () => {
    khoa = await taoKhoa();
    await taoGiaiDoan(khoa.id, 1, { hinh_thuc: 'danh_gia' });
    gd2 = await taoGiaiDoan(khoa.id, 2);
    lopZoom = await taoLop(khoa.id, 'zoom', 'Zoom gán tay');
    lopTT = await taoLop(khoa.id, 'truc_tiep', 'TT gán tay');
    await taoBuoi(lopZoom.id, gd2.id, 1);
    const { hocVien } = await taoHocVienMoet(uniqueSuffix());
    dkId = (await ghiDanh(hocVien.id, khoa.id)).id;
  });

  const put = (gdId: string, lop_id: string | null, token = tokenQuanTri) =>
    request(app.getHttpServer())
      .put(`/dang-ky-hoc/${dkId}/giai-doan/${gdId}/lop`)
      .set('Authorization', `Bearer ${token}`)
      .send({ lop_id });

  it('gán -> 200, đăng ký thành da_phan_lop, không cảnh báo', async () => {
    const res = await put(gd2.id, lopZoom.id).expect(200);
    expect(res.body.phan_lop.lop_id).toBe(lopZoom.id);
    expect(res.body.canh_bao).toBeUndefined();
    const dk = await prisma.dang_ky_hoc.findUniqueOrThrow({ where: { id: dkId } });
    expect(dk.trang_thai).toBe('da_phan_lop');
  });

  it('thay bằng lớp không có buổi trong GĐ + sai hình thức -> 200 kèm canh_bao, vẫn 1 dòng', async () => {
    const res = await put(gd2.id, lopTT.id).expect(200);
    expect(res.body.canh_bao).toContain('không có buổi nào trong giai đoạn');
    expect(res.body.canh_bao).toContain('lớp trực tiếp nhưng giai đoạn là trực tuyến');
    expect(
      await prisma.phan_lop_giai_doan.count({ where: { dang_ky_hoc_id: dkId } }),
    ).toBe(1);
  });

  it('lop_id null -> gỡ, trạng thái đăng ký giữ da_phan_lop', async () => {
    const res = await put(gd2.id, null).expect(200);
    expect(res.body.phan_lop).toBeNull();
    expect(
      await prisma.phan_lop_giai_doan.count({ where: { dang_ky_hoc_id: dkId } }),
    ).toBe(0);
    const dk = await prisma.dang_ky_hoc.findUniqueOrThrow({ where: { id: dkId } });
    expect(dk.trang_thai).toBe('da_phan_lop');
  });

  it('lớp hoặc giai đoạn của khóa khác -> 400', async () => {
    const khoaKhac = await taoKhoa();
    const gdKhac = await taoGiaiDoan(khoaKhac.id, 1);
    const lopKhac = await taoLop(khoaKhac.id, 'zoom', 'Zoom khóa khác');
    await put(gd2.id, lopKhac.id).expect(400);
    await put(gdKhac.id, lopZoom.id).expect(400);
  });

  it('Trường không phải chủ khóa -> 403', async () => {
    // tạo tài khoản truong thuộc đơn vị khác (taoDonViTest + taoNguoiDungTest vai_tro 'truong'), đăng nhập
    const donViKhac = await taoDonViTest('pl-khac');
    const truongKhac = await taoNguoiDungTest({ vai_tro: 'truong', don_vi_id: donViKhac.donVi.id, mat_khau: 'MatKhau123' });
    const token = await dangNhap(truongKhac.ten_dang_nhap, 'MatKhau123');
    await put(gd2.id, lopZoom.id, token).expect(403);
    await xoaNguoiDungTest(truongKhac.nguoiDung.id);
    await xoaDonViTest([donViKhac.donVi.id], [donViKhac.diaDanhXa.id, donViKhac.diaDanhTinh.id]);
  });
});
```

Run → FAIL 404 (route chưa có).

- [ ] **Step 4: DTO + service + route**

`dto/gan-lop-giai-doan.dto.ts`:

```ts
import { IsUUID, ValidateIf } from 'class-validator';

// Body của PUT /dang-ky-hoc/{id}/giai-doan/{giaiDoanId}/lop — phân lớp theo
// giai đoạn (spec 2026-10-02). null = gỡ học viên khỏi lớp của giai đoạn.
export class GanLopGiaiDoanDto {
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  lop_id: string | null;
}
```

Service (đặt sau `xoaLopDangKy`; import `canhBaoLoaiLopGiaiDoan`):

```ts
  // Cảnh báo 🟡 khi gán lớp vào giai đoạn: lớp không có buổi nào trong giai
  // đoạn, hoặc loại lớp lệch hình thức — dùng chung gán tay + import.
  async canhBaoGanLopGiaiDoan(
    lop: { id: string; ten_lop: string; loai_lop: loai_lop_hoc },
    giaiDoan: { id: string; thu_tu: number; ten_giai_doan: string; hinh_thuc: hinh_thuc_giai_doan },
  ): Promise<string | undefined> {
    const lyDo: string[] = [];
    const soBuoi = await this.prisma.lich_hoc_lop.count({
      where: { lop_id: lop.id, giai_doan_id: giaiDoan.id },
    });
    if (soBuoi === 0) lyDo.push('lớp không có buổi nào trong giai đoạn này');
    const lech = canhBaoLoaiLopGiaiDoan(lop.loai_lop, giaiDoan.hinh_thuc);
    if (lech) lyDo.push(lech);
    if (lyDo.length === 0) return undefined;
    return `Lớp "${lop.ten_lop}" ở giai đoạn ${giaiDoan.thu_tu} "${giaiDoan.ten_giai_doan}": ${lyDo.join('; ')}`;
  }

  // PUT /dang-ky-hoc/{id}/giai-doan/{giaiDoanId}/lop — gán/thay/gỡ lớp của 1
  // giai đoạn. Gán -> da_phan_lop; gỡ KHÔNG đổi trạng thái (như xoaLopDangKy).
  async ganLopGiaiDoan(
    dangKyHocId: string,
    giaiDoanId: string,
    lopId: string | null,
    caller: AuthenticatedUser,
  ) {
    const dangKy = await this.getDangKyOrThrow(dangKyHocId);
    this.assertChuKhoa(dangKy.khoa, caller);
    const giaiDoan = await this.prisma.giai_doan_khoa.findUnique({
      where: { id: giaiDoanId },
    });
    if (!giaiDoan || giaiDoan.khoa_id !== dangKy.khoa_id) {
      throw new ValidationException('Giai đoạn không thuộc khóa của đăng ký này', [
        { field: 'giai_doan_id', message: 'Phải thuộc cùng khóa bồi dưỡng' },
      ]);
    }

    if (lopId === null) {
      await this.prisma.phan_lop_giai_doan.deleteMany({
        where: { dang_ky_hoc_id: dangKyHocId, giai_doan_id: giaiDoanId },
      });
      return { phan_lop: null };
    }

    const lop = await this.prisma.lop_hoc.findUnique({ where: { id: lopId } });
    if (!lop || lop.khoa_id !== dangKy.khoa_id) {
      throw new ValidationException('Lớp không thuộc khóa của đăng ký này', [
        { field: 'lop_id', message: 'Phải thuộc cùng khóa bồi dưỡng' },
      ]);
    }
    const phanLop = await this.prisma.phan_lop_giai_doan.upsert({
      where: {
        dang_ky_hoc_id_giai_doan_id: {
          dang_ky_hoc_id: dangKyHocId,
          giai_doan_id: giaiDoanId,
        },
      },
      create: { dang_ky_hoc_id: dangKyHocId, giai_doan_id: giaiDoanId, lop_id: lopId },
      update: { lop_id: lopId },
    });
    if (dangKy.trang_thai !== 'da_phan_lop') {
      await this.prisma.dang_ky_hoc.update({
        where: { id: dangKyHocId },
        data: { trang_thai: 'da_phan_lop' },
      });
    }
    const canhBao = await this.canhBaoGanLopGiaiDoan(lop, giaiDoan);
    return canhBao ? { phan_lop: phanLop, canh_bao: canhBao } : { phan_lop: phanLop };
  }
```

Controller (`dang-ky-hoc-thao-tac.controller.ts`, theo đúng decorator `@Roles`/`@CurrentUser` của các route PATCH sẵn có trong file; import `Put`, `GanLopGiaiDoanDto`):

```ts
  @Put(':id/giai-doan/:giaiDoanId/lop')
  ganLopGiaiDoan(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('giaiDoanId', ParseUUIDPipe) giaiDoanId: string,
    @Body() dto: GanLopGiaiDoanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khoaBoiDuongService.ganLopGiaiDoan(id, giaiDoanId, dto.lop_id, user);
  }
```

- [ ] **Step 5: Chạy lại e2e → PASS 5/5.** `npx tsc --noEmit -p tsconfig.json` sạch.

- [ ] **Step 6: Commit + push**

```bash
git add backend/src/khoa-boi-duong/util/canh-bao-buoi-hoc.util.ts backend/src/khoa-boi-duong/util/canh-bao-buoi-hoc.util.spec.ts backend/src/khoa-boi-duong/dto/gan-lop-giai-doan.dto.ts backend/src/khoa-boi-duong/khoa-boi-duong.service.ts backend/src/khoa-boi-duong/dang-ky-hoc-thao-tac.controller.ts backend/test/phan-lop-giai-doan.e2e-spec.ts
git commit -m "feat(phan-lop): PUT /dang-ky-hoc/:id/giai-doan/:gdId/lop"
git push
```

---

### Task 4: Đọc file Excel phân lớp dạng cột theo giai đoạn (util thuần)

**Files:**
- Create: `backend/src/import/util/phan-lop-excel.util.ts`
- Test: `backend/src/import/util/phan-lop-excel.util.spec.ts`

**Interfaces:**
- Consumes: `cellToImportText` từ `./excel.util`; `ValidationException` từ `../../common/exceptions/app.exceptions`.
- Produces:
  - `COT_CO_DINH_PHAN_LOP = ['so_dinh_danh_ca_nhan', 'ma_dinh_danh_moet', 'ten_cum'] as const`
  - `parseThuTuCotGiaiDoan(header: string): number | null`
  - `tieuDeCotGiaiDoan(gd: { thu_tu: number; ten_giai_doan: string }): string` → `"GĐ2 - Học trực tuyến qua zoom"`
  - `readPhanLopWorkbook(buffer: Buffer, thuTuHopLe: Set<number>): Promise<{ headers: string[]; rows: { dong: number; values: Record<string, string> }[] }>` — `values` gồm 3 cột cố định + key `gd:<thu_tu>` cho mỗi cột giai đoạn có trong file.

- [ ] **Step 1: Test thất bại**

```ts
import * as ExcelJS from 'exceljs';
import {
  parseThuTuCotGiaiDoan,
  readPhanLopWorkbook,
  tieuDeCotGiaiDoan,
} from './phan-lop-excel.util';

async function xlsx(rows: (string | undefined)[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Mau');
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('parseThuTuCotGiaiDoan', () => {
  it.each([
    ['GĐ2 - Học trực tuyến qua zoom', 2],
    ['  gđ 10 -  tên khác ', 10],
    ['GD3', 3],
    ['gd 4 - Học trực tiếp', 4],
    ['ten_cum', null],
    ['Giai đoạn 2', null],
  ])('%s -> %s', (h, kq) => expect(parseThuTuCotGiaiDoan(h)).toBe(kq));
});

it('tieuDeCotGiaiDoan', () => {
  expect(tieuDeCotGiaiDoan({ thu_tu: 2, ten_giai_doan: 'Zoom' })).toBe('GĐ2 - Zoom');
});

describe('readPhanLopWorkbook', () => {
  const hopLe = new Set([1, 2, 3]);

  it('đọc cột cố định + cột GĐ (thứ tự tùy ý, thiếu GĐ được), bỏ dòng trống', async () => {
    const buf = await xlsx([
      ['ma_dinh_danh_moet', 'GĐ3 - VLE', 'so_dinh_danh_ca_nhan', 'GD 2 - tên cũ', 'ten_cum'],
      ['0890', 'Lớp VLE 3', '', '-', 'Cụm 1'],
      [],
    ]);
    const { rows } = await readPhanLopWorkbook(buf, hopLe);
    expect(rows).toEqual([
      {
        dong: 2,
        values: {
          ma_dinh_danh_moet: '0890', so_dinh_danh_ca_nhan: '', ten_cum: 'Cụm 1',
          'gd:3': 'Lớp VLE 3', 'gd:2': '-',
        },
      },
    ]);
  });

  it('thiếu ten_cum -> vẫn đọc, ten_cum = ""', async () => {
    const buf = await xlsx([['so_dinh_danh_ca_nhan', 'ma_dinh_danh_moet', 'GĐ1 - x'], ['', '1', 'A']]);
    const { rows } = await readPhanLopWorkbook(buf, hopLe);
    expect(rows[0].values.ten_cum).toBe('');
  });

  it.each([
    [['so_dinh_danh_ca_nhan', 'ma_dinh_danh_moet', 'ten_lop'], 'mẫu cũ'],
    [['so_dinh_danh_ca_nhan', 'ma_dinh_danh_moet', 'ten_lop_zoom'], 'mẫu cũ'],
    [['so_dinh_danh_ca_nhan', 'ma_dinh_danh_moet', 'GĐ9 - x'], 'GĐ9'],
    [['so_dinh_danh_ca_nhan', 'ma_dinh_danh_moet', 'GĐ2 - a', 'GD2 - b'], 'trùng'],
    [['so_dinh_danh_ca_nhan', 'ma_dinh_danh_moet', 'cot_la'], 'cot_la'],
    [['ma_dinh_danh_moet', 'GĐ2 - a'], 'so_dinh_danh_ca_nhan'],
  ])('tiêu đề %j -> lỗi chứa "%s"', async (header, chua) => {
    const buf = await xlsx([header as string[], ['1', '2', '3']]);
    await expect(readPhanLopWorkbook(buf, hopLe)).rejects.toThrow(chua);
  });
});
```

Run: `npx jest src/import/util/phan-lop-excel` → FAIL (module không tồn tại).

- [ ] **Step 2: Cài đặt**

```ts
import * as ExcelJS from 'exceljs';
import { ValidationException } from '../../common/exceptions/app.exceptions';
import { cellToImportText } from './excel.util';

// Import phan_lop_hoc_vien dạng mỗi học viên 1 dòng, mỗi giai đoạn 1 cột
// (spec 2026-10-02-phan-lop-theo-giai-doan mục 4). Cột giai đoạn nhận diện
// bằng tiền tố "GĐ<số>" — phần tên phía sau bỏ qua để đổi tên giai đoạn không
// làm hỏng file đã tải. Cột cố định đọc theo TÊN (không theo vị trí).
export const COT_CO_DINH_PHAN_LOP = [
  'so_dinh_danh_ca_nhan',
  'ma_dinh_danh_moet',
  'ten_cum',
] as const;
const COT_MAU_CU = ['ten_lop', 'ten_lop_zoom', 'ten_lop_vle', 'ma_khoa'];

export function parseThuTuCotGiaiDoan(header: string): number | null {
  const m = /^\s*g[đd]\s*(\d+)/i.exec(header);
  return m ? Number(m[1]) : null;
}

export function tieuDeCotGiaiDoan(gd: { thu_tu: number; ten_giai_doan: string }): string {
  return `GĐ${gd.thu_tu} - ${gd.ten_giai_doan}`;
}

export async function readPhanLopWorkbook(
  buffer: Buffer,
  thuTuHopLe: Set<number>,
): Promise<{ headers: string[]; rows: { dong: number; values: Record<string, string> }[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ValidationException('File Excel không có sheet dữ liệu nào');

  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = String(cell.value ?? '').trim();
  });

  // key đọc ra cho từng cột (cột trống tiêu đề -> null, bỏ qua)
  const keys: (string | null)[] = [];
  const daGap = new Set<string>();
  for (const h of headers) {
    if (!h) { keys.push(null); continue; }
    const thuong = h.toLowerCase();
    if (COT_MAU_CU.includes(thuong)) {
      throw new ValidationException(
        `File theo mẫu cũ (có cột "${h}"), vui lòng tải mẫu mới theo giai đoạn của khóa`,
      );
    }
    const thuTu = parseThuTuCotGiaiDoan(h);
    let key: string;
    if (thuTu !== null) {
      if (!thuTuHopLe.has(thuTu)) {
        throw new ValidationException(
          `Cột "${h}": khóa không có giai đoạn đang hoạt động GĐ${thuTu}`,
        );
      }
      key = `gd:${thuTu}`;
    } else if ((COT_CO_DINH_PHAN_LOP as readonly string[]).includes(thuong)) {
      key = thuong;
    } else {
      throw new ValidationException(
        `Cột lạ "${h}". Cột hợp lệ: ${COT_CO_DINH_PHAN_LOP.join(', ')} và các cột "GĐ<số> - <tên giai đoạn>"`,
      );
    }
    if (daGap.has(key)) {
      throw new ValidationException(`Cột "${h}" trùng với cột khác cùng ${key.startsWith('gd:') ? 'giai đoạn' : 'tên'}`);
    }
    daGap.add(key);
    keys.push(key);
  }
  for (const bat of ['so_dinh_danh_ca_nhan', 'ma_dinh_danh_moet']) {
    if (!daGap.has(bat)) throw new ValidationException(`Thiếu cột "${bat}"`);
  }

  const rows: { dong: number; values: Record<string, string> }[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: Record<string, string> = { ten_cum: '' };
    keys.forEach((key, i) => {
      if (key) values[key] = cellToImportText(row.getCell(i + 1).value);
    });
    if (Object.values(values).some((v) => v !== '')) rows.push({ dong: rowNumber, values });
  });
  return { headers: headers.filter(Boolean), rows };
}
```

- [ ] **Step 3: Chạy → PASS.** `npx eslint src/import/util/phan-lop-excel.util*.ts --fix`.

- [ ] **Step 4: Commit + push**

```bash
git add backend/src/import/util/phan-lop-excel.util.ts backend/src/import/util/phan-lop-excel.util.spec.ts
git commit -m "feat(import): doc file phan lop dang cot theo giai doan"
git push
```

---

### Task 5: Import `phan_lop_hoc_vien` định dạng mới

**Files:**
- Modify: `backend/src/khoa-boi-duong/dto/phan-lop-row.dto.ts`
- Modify: `backend/src/khoa-boi-duong/khoa-boi-duong.service.ts` (`resolvePhanLopRow` ~1299, `commitPhanLop` ~1424 — viết lại)
- Modify: `backend/src/import/import.service.ts`, `import.controller.ts`, `dto/mau-excel-query.dto.ts`
- Modify: `backend/test/khoa-boi-duong.e2e-spec.ts`, `backend/test/lop-va-lich-hoc.e2e-spec.ts` (các ca import `phan_lop_hoc_vien` dùng cột cũ → chuyển sang mẫu mới, giữ nguyên ý nghĩa kiểm thử), `backend/src/khoa-boi-duong/khoa-boi-duong.service.spec.ts` (mock `commitPhanLop`/`resolvePhanLopRow` nếu có)
- Test: `backend/test/phan-lop-giai-doan.e2e-spec.ts`

**Interfaces:**
- Consumes: `readPhanLopWorkbook`, `tieuDeCotGiaiDoan`, `COT_CO_DINH_PHAN_LOP` (Task 4); `canhBaoGanLopGiaiDoan` (Task 3).
- Produces DTO:

```ts
export class PhanLopHocVienRowDto {
  @IsUUID() hoc_vien_id: string;
  @IsUUID() khoa_id: string;
  @IsOptional() @IsUUID() cum_id?: string;
  // gán theo giai đoạn: lop_id null = gỡ ("-"); giai đoạn không có mặt = giữ nguyên
  gan: { giai_doan_id: string; lop_id: string | null }[];
}
```
- Produces: `resolvePhanLopRow(raw: Record<string,string>, khoa: { id: string; ma_khoa: string }, dupKeys?: Set<string>): Promise<RowBuildResult<PhanLopHocVienRowDto>>`; `commitPhanLop(dto): Promise<{ hocVienChuaCoEmail: boolean }>`.
- Produces: `GET /import/mau-excel?loai=phan_lop_hoc_vien&ma_khoa=` và `POST /import/phan_lop_hoc_vien?ma_khoa=` (cả hai bắt buộc `ma_khoa`).

- [ ] **Step 1: e2e thất bại**

Thêm vào `phan-lop-giai-doan.e2e-spec.ts` (helper `taiLenPhanLop(maKhoa, rows: string[][])` build xlsx với `rows[0]` là tiêu đề, POST `/import/phan_lop_hoc_vien?ma_khoa=…`, trả `{importId, ketQua}` như `importVaKetQua` trong `test/nhan-su-lop-import.e2e-spec.ts`; `xacNhan(importId)`):

```ts
describe('Import phan_lop_hoc_vien theo giai đoạn', () => {
  let khoa: { id: string; ma_khoa: string };
  let gd: Record<number, { id: string }>;
  let hv: { hocVien: { id: string }; tenDangNhap: string };
  const H = ['so_dinh_danh_ca_nhan', 'ma_dinh_danh_moet'];

  beforeAll(async () => {
    khoa = await taoKhoa();
    gd = {
      1: await taoGiaiDoan(khoa.id, 1, { hinh_thuc: 'danh_gia' }),
      2: await taoGiaiDoan(khoa.id, 2),
      3: await taoGiaiDoan(khoa.id, 3),
      4: await taoGiaiDoan(khoa.id, 4, { trang_thai: 'ngung' }),
    };
    const z3 = await taoLop(khoa.id, 'zoom', 'Lớp zoom 3');
    const v3 = await taoLop(khoa.id, 'vle', 'Lớp VLE 3');
    await taoLop(khoa.id, 'vle', 'Lớp VLE 5');
    await taoBuoi(z3.id, gd[2].id, 1);
    await taoBuoi(v3.id, gd[3].id, 1);
    await taoLop(khoa.id, 'zoom', 'Trùng tên');
    await taoLop(khoa.id, 'vle', 'Trùng tên');
    await prisma.cum_hoc_vien.create({ data: { khoa_id: khoa.id, ten_cum: 'Cụm 1' } });
    hv = await taoHocVienMoet(uniqueSuffix());
  });

  // Tải mẫu và trả dòng tiêu đề (như test mẫu nhan_su_lop: .buffer(true) + parser nhị phân).
  const taiMauHeader = async (maKhoa: string) => {
    const res = await request(app.getHttpServer())
      .get(`/import/mau-excel?loai=phan_lop_hoc_vien&ma_khoa=${encodeURIComponent(maKhoa)}`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .buffer(true)
      .parse((r, cb) => { const c: Buffer[] = []; r.on('data', (x: Buffer) => c.push(x)); r.on('end', () => cb(null, Buffer.concat(c))); })
      .expect(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as unknown as ExcelJS.Buffer);
    return (wb.worksheets[0].getRow(1).values as unknown[]).slice(1);
  };

  const phanLop = () =>
    prisma.phan_lop_giai_doan.findMany({
      where: { dang_ky_hoc: { hoc_vien_id: hv.hocVien.id, khoa_id: khoa.id } },
      include: { lop: true, giai_doan: true },
    }).then((r) => Object.fromEntries(r.map((x) => [x.giai_doan.thu_tu, x.lop.ten_lop])));

  it('mẫu: chỉ GĐ active, đúng thứ tự, có ten_cum; thiếu ma_khoa -> 400', async () => {
    // GET mẫu kèm ma_khoa, đọc header (như test mẫu nhan_su_lop)
    expect(await taiMauHeader(khoa.ma_khoa)).toEqual([
      'so_dinh_danh_ca_nhan', 'ma_dinh_danh_moet',
      'GĐ1 - Giai đoạn 1', 'GĐ2 - Giai đoạn 2', 'GĐ3 - Giai đoạn 3', 'ten_cum',
    ]);
    await request(app.getHttpServer())
      .get('/import/mau-excel?loai=phan_lop_hoc_vien')
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .expect(400);
  });

  it('gán GĐ2 + GĐ3 + cụm (tên lớp dạng NFD vẫn khớp) -> da_phan_lop', async () => {
    const { importId, ketQua } = await taiLenPhanLop(khoa.ma_khoa, [
      [...H, 'GĐ2 - x', 'GĐ3 - y', 'ten_cum'],
      ['', hv.tenDangNhap, 'Lớp zoom 3'.normalize('NFD'), 'Lớp VLE 3', 'Cụm 1'],
    ]);
    expect(ketQua.so_dong_loi).toBe(0);
    expect(ketQua.danh_sach_canh_bao).toEqual([]);
    await xacNhan(importId);
    expect(await phanLop()).toEqual({ 2: 'Lớp zoom 3', 3: 'Lớp VLE 3' });
  });

  it('file chỉ có cột GĐ3 đổi lớp -> GĐ2 giữ nguyên; lớp không có buổi trong GĐ -> cảnh báo', async () => {
    const { importId, ketQua } = await taiLenPhanLop(khoa.ma_khoa, [
      [...H, 'GĐ3'],
      ['', hv.tenDangNhap, 'Lớp VLE 5'],
    ]);
    expect(ketQua.danh_sach_canh_bao[0].ly_do).toContain('không có buổi nào trong giai đoạn');
    await xacNhan(importId);
    expect(await phanLop()).toEqual({ 2: 'Lớp zoom 3', 3: 'Lớp VLE 5' });
  });

  it('ô "-" gỡ, ô trống giữ, trạng thái đăng ký không đổi', async () => {
    const { importId } = await taiLenPhanLop(khoa.ma_khoa, [
      [...H, 'GĐ2', 'GĐ3'],
      ['', hv.tenDangNhap, '-', ''],
    ]);
    await xacNhan(importId);
    expect(await phanLop()).toEqual({ 3: 'Lớp VLE 5' });
  });

  it.each([
    ['lớp không tồn tại', 'Lớp ma', 'không tồn tại'],
    ['tên trùng nhiều loại lớp', 'Trùng tên', 'nhiều loại lớp'],
  ])('%s -> dòng lỗi', async (_t, tenLop, chua) => {
    const { ketQua } = await taiLenPhanLop(khoa.ma_khoa, [[...H, 'GĐ2'], ['', hv.tenDangNhap, tenLop]]);
    expect(ketQua.so_dong_loi).toBe(1);
    expect(ketQua.danh_sach_loi[0].ly_do).toContain(chua);
  });

  it('học viên lặp 2 dòng -> dòng sau lỗi', async () => {
    const { ketQua } = await taiLenPhanLop(khoa.ma_khoa, [
      [...H, 'GĐ2'], ['', hv.tenDangNhap, ''], ['', hv.tenDangNhap, ''],
    ]);
    expect(ketQua.so_dong_loi).toBe(1);
    expect(ketQua.danh_sach_loi[0].ly_do).toContain('trùng');
  });

  it('cột GĐ4 (giai đoạn đã ngừng) hoặc mẫu cũ -> lỗi cả file (400)', async () => {
    for (const header of [[...H, 'GĐ4'], [...H, 'ma_khoa', 'ten_lop']]) {
      const res = await request(app.getHttpServer())
        .post(`/import/phan_lop_hoc_vien?ma_khoa=${khoa.ma_khoa}`)
        .set('Authorization', `Bearer ${tokenQuanTri}`)
        .attach('file', await buildXlsx([header, ['', hv.tenDangNhap, 'x', 'y']]), 'pl.xlsx');
      expect(res.status).toBe(400);
    }
  });

  it('POST thiếu ma_khoa -> 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/import/phan_lop_hoc_vien')
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .attach('file', await buildXlsx([[...H, 'GĐ2'], ['', hv.tenDangNhap, '']]), 'pl.xlsx');
    expect(res.status).toBe(400);
  });
});
```

Run → FAIL.

- [ ] **Step 2: Viết lại `resolvePhanLopRow`**

```ts
  // Import phan_lop_hoc_vien theo giai đoạn (spec 2026-10-02 mục 4): raw gồm
  // so_dinh_danh_ca_nhan, ma_dinh_danh_moet, ten_cum và key "gd:<thu_tu>" cho
  // mỗi cột giai đoạn có trong file. Ô trống = giữ nguyên; "-" = gỡ; tên lớp
  // = gán/thay. Tên lớp tra trong cả khóa (không theo loại) — trùng tên giữa
  // các loại lớp là lỗi, buộc đổi tên để không đoán.
  async resolvePhanLopRow(
    raw: Record<string, string>,
    khoa: { id: string; ma_khoa: string },
    dupKeys?: Set<string>,
  ): Promise<RowBuildResult<PhanLopHocVienRowDto>> {
    const resolved = await resolveHocVienImportRow(this.prisma, {
      so_dinh_danh_ca_nhan: raw.so_dinh_danh_ca_nhan,
      ma_dinh_danh_moet: raw.ma_dinh_danh_moet,
    });
    if (resolved.error || !resolved.hocVien) {
      return { error: resolved.error ?? 'Không xác định được học viên' };
    }
    const hocVien = resolved.hocVien;
    const ma = raw.so_dinh_danh_ca_nhan?.trim() || raw.ma_dinh_danh_moet?.trim();
    if (hocVien.trang_thai !== 'da_duyet') {
      return { error: `Học viên "${ma}" chưa được duyệt (trang_thai hiện tại: "${hocVien.trang_thai}")` };
    }
    if (dupKeys) {
      if (dupKeys.has(hocVien.id)) {
        return { error: `Dòng trùng học viên "${ma}" với dòng khác trong cùng file` };
      }
      dupKeys.add(hocVien.id);
    }

    const giaiDoanList = await this.prisma.giai_doan_khoa.findMany({
      where: { khoa_id: khoa.id, trang_thai: 'active' },
    });
    const gan: { giai_doan_id: string; lop_id: string | null }[] = [];
    const canhBaoList: string[] = [];
    for (const gd of giaiDoanList) {
      const o = raw[`gd:${gd.thu_tu}`]?.trim();
      if (!o) continue;
      if (o === '-') {
        gan.push({ giai_doan_id: gd.id, lop_id: null });
        continue;
      }
      const lops = await this.prisma.lop_hoc.findMany({
        where: { khoa_id: khoa.id, ten_lop: normalizeNfcName(o) },
      });
      if (lops.length === 0) {
        return { error: `GĐ${gd.thu_tu}: lớp "${o}" không tồn tại trong khóa "${khoa.ma_khoa}"` };
      }
      if (lops.length > 1) {
        return { error: `GĐ${gd.thu_tu}: tên lớp "${o}" có ở nhiều loại lớp (${lops.map((l) => l.loai_lop).join(', ')}) — đổi tên lớp cho khác nhau` };
      }
      gan.push({ giai_doan_id: gd.id, lop_id: lops[0].id });
      const cb = await this.canhBaoGanLopGiaiDoan(lops[0], gd);
      if (cb) canhBaoList.push(cb);
      const mucCb = await this.canhBaoMucNangLuc(hocVien.id, khoa.id, lops[0], ma ?? '');
      if (mucCb) canhBaoList.push(mucCb);
    }

    let cumId: string | undefined;
    const tenCum = raw.ten_cum?.trim();
    if (tenCum) {
      const cum = await this.prisma.cum_hoc_vien.findUnique({
        where: { khoa_id_ten_cum: { khoa_id: khoa.id, ten_cum: tenCum } },
      });
      if (!cum) return { error: `Không tìm thấy cụm học viên "${tenCum}" trong khóa "${khoa.ma_khoa}"` };
      cumId = cum.id;
    }

    return {
      dto: { hoc_vien_id: hocVien.id, khoa_id: khoa.id, cum_id: cumId, gan },
      canhBao: canhBaoList.length ? canhBaoList.join('; ') : undefined,
    };
  }

  // T6 (QĐ3/QĐ4), giữ nguyên ý nghĩa cũ: mức năng lực lớp khác mức đầu vào
  // của học viên -> cảnh báo 🟡.
  private async canhBaoMucNangLuc(
    hocVienId: string,
    khoaId: string,
    lop: { ten_lop: string; muc_nang_luc: muc_nang_luc | null },
    ma: string,
  ): Promise<string | undefined> {
    if (!lop.muc_nang_luc) return undefined;
    const dk = await this.prisma.dang_ky_hoc.findUnique({
      where: { hoc_vien_id_khoa_id: { hoc_vien_id: hocVienId, khoa_id: khoaId } },
    });
    if (dk?.muc_dau_vao && dk.muc_dau_vao !== lop.muc_nang_luc) {
      return `Học viên "${ma}" có mức đầu vào "${dk.muc_dau_vao}" khác mức năng lực "${lop.muc_nang_luc}" của lớp "${lop.ten_lop}" — kiểm tra lại phân lớp`;
    }
    return undefined;
  }
```

- [ ] **Step 3: Viết lại `commitPhanLop`**

```ts
  // Ghi danh (upsert dang_ky_hoc) + áp từng gán theo giai đoạn. Gán ≥ 1 lớp ->
  // da_phan_lop; gỡ không đổi trạng thái. Email dang_ky_hoc_phan_lop chỉ khi
  // dòng gán ≥ 1 lớp TRỰC TIẾP (giữ trigger cũ).
  async commitPhanLop(dto: PhanLopHocVienRowDto): Promise<{ hocVienChuaCoEmail: boolean }> {
    const coGanLop = dto.gan.some((g) => g.lop_id);
    const dangKy = await this.prisma.dang_ky_hoc.upsert({
      where: { hoc_vien_id_khoa_id: { hoc_vien_id: dto.hoc_vien_id, khoa_id: dto.khoa_id } },
      create: {
        hoc_vien_id: dto.hoc_vien_id,
        khoa_id: dto.khoa_id,
        trang_thai: coGanLop ? 'da_phan_lop' : 'da_duyet',
        cum_id: dto.cum_id,
      },
      update: {
        ...(coGanLop ? { trang_thai: 'da_phan_lop' as const } : {}),
        ...(dto.cum_id !== undefined ? { cum_id: dto.cum_id } : {}),
      },
    });

    for (const g of dto.gan) {
      if (g.lop_id === null) {
        await this.prisma.phan_lop_giai_doan.deleteMany({
          where: { dang_ky_hoc_id: dangKy.id, giai_doan_id: g.giai_doan_id },
        });
        continue;
      }
      await this.prisma.phan_lop_giai_doan.upsert({
        where: { dang_ky_hoc_id_giai_doan_id: { dang_ky_hoc_id: dangKy.id, giai_doan_id: g.giai_doan_id } },
        create: { dang_ky_hoc_id: dangKy.id, giai_doan_id: g.giai_doan_id, lop_id: g.lop_id },
        update: { lop_id: g.lop_id },
      });
    }

    const lopIds = dto.gan.flatMap((g) => (g.lop_id ? [g.lop_id] : []));
    const coLopTrucTiep =
      lopIds.length > 0 &&
      (await this.prisma.lop_hoc.count({ where: { id: { in: lopIds }, loai_lop: 'truc_tiep' } })) > 0;
    if (coLopTrucTiep) {
      const { chuaCoEmail } = await this.thongBaoService.guiDangKyHocPhanLop(dangKy.id);
      return { hocVienChuaCoEmail: chuaCoEmail };
    }
    return { hocVienChuaCoEmail: false };
  }
```

Cập nhật `phan-lop-row.dto.ts` theo Interfaces (bỏ 3 field `lop_*_id`, thêm `gan`; comment đầu file mô tả định dạng mới).

- [ ] **Step 4: Nối ImportService**

1. `taiMauExcel(loaiRaw, maKhoa?)`: nếu `loai === 'phan_lop_hoc_vien'` → `const { columns } = await this.cotPhanLop(maKhoa)`; ghi chú từng cột GĐ = `'Ô trống = giữ nguyên lớp hiện có; "-" = gỡ khỏi lớp của giai đoạn; tên lớp = gán/thay. Lớp có buổi trong giai đoạn: ' + tênLớp.join(', ')`. Controller `taiMauExcel` truyền `query.ma_khoa`; `MauExcelQueryDto` thêm `@IsOptional() @IsString() @MaxLength(50) ma_khoa?: string;`.
2. Helper mới:

```ts
  // phan_lop_hoc_vien: cột phụ thuộc giai đoạn ACTIVE của khóa -> bắt buộc ma_khoa.
  private async cotPhanLop(maKhoaRaw?: string) {
    const maKhoa = maKhoaRaw?.trim();
    if (!maKhoa) {
      throw new ValidationException('Import phân lớp học viên bắt buộc chọn khóa (tham số ma_khoa)', [
        { field: 'ma_khoa', message: 'Bắt buộc' },
      ]);
    }
    const khoa = await this.prisma.khoa_boi_duong.findUnique({
      where: { ma_khoa: maKhoa },
      include: {
        giai_doan: { where: { trang_thai: 'active' }, orderBy: { thu_tu: 'asc' } },
      },
    });
    if (!khoa) throw new NotFoundAppException(`Khóa "${maKhoa}" không tồn tại`);
    const columns = [
      'so_dinh_danh_ca_nhan',
      'ma_dinh_danh_moet',
      ...khoa.giai_doan.map(tieuDeCotGiaiDoan),
      'ten_cum',
    ];
    return { khoa, columns, thuTuHopLe: new Set(khoa.giai_doan.map((g) => g.thu_tu)) };
  }
```

3. `taoImport`: với `phan_lop_hoc_vien` → bỏ qua `kiemTraMaKhoaMacDinh` và `apDungMaKhoaMacDinh`; gọi `cotPhanLop(maKhoaMacDinh)`; đọc bằng `readPhanLopWorkbook(file.buffer, thuTuHopLe)`; `columns` dùng cho file lỗi = `headers` đọc được (map ngược `gd:<n>` → tiêu đề gốc khi build file lỗi: lưu `headers` và dùng `values` theo thứ tự `keys`). Đơn giản nhất: `readPhanLopWorkbook` đã trả `headers`; build file lỗi bằng `buildLoiWorkbook(headers, rows.map(... values theo headers ...))` — thêm vào util Task 4 một hàm `valuesTheoTieuDe(headers, values)` trả `Record<header,string>` (map `gd:n` theo `parseThuTuCotGiaiDoan(header)`), kèm 1 unit test trong `phan-lop-excel.util.spec.ts`. Lưu `ma_khoa_mac_dinh: khoa.ma_khoa` vào kết quả như các loại khác.
4. `buildDto` case `'phan_lop_hoc_vien'`: `return this.khoaBoiDuongService.resolvePhanLopRow(raw, khoaPhanLop, dupKeys)` — `khoaPhanLop` truyền qua tham số mới tùy chọn `ngữCảnh?: { khoa: { id: string; ma_khoa: string } }` của `buildDto` (taoImport và xacNhan đều có sau khi gọi `cotPhanLop`).
5. `xacNhan`: với `phan_lop_hoc_vien`, đọc lại file bằng `readPhanLopWorkbook` với `cotPhanLop(ketQuaCu.ma_khoa_mac_dinh)`.
6. `getColumns('phan_lop_hoc_vien')` (sync, dùng ở chỗ khác) trả `['so_dinh_danh_ca_nhan', 'ma_dinh_danh_moet', 'ten_cum']` kèm comment "cột giai đoạn sinh động — xem cotPhanLop"; `getColumnNotes` cho loại này bỏ ghi chú `ten_lop*`, giữ ghi chú 2 mã học viên + `ten_cum`.

- [ ] **Step 5: Sửa các e2e cũ dùng mẫu cũ**

`grep -n "phan_lop_hoc_vien" backend/test/*.ts` — với mỗi ca: đổi header thành `['so_dinh_danh_ca_nhan','ma_dinh_danh_moet','GĐ<n>', ..., 'ten_cum']`, URL thêm `?ma_khoa=`, bảo đảm khóa trong test có giai đoạn và lớp có buổi ở giai đoạn đó; assertion trên `dang_ky_hoc_lop` đổi sang `phan_lop_giai_doan`. Ca cảnh báo mức năng lực ở `lop-va-lich-hoc.e2e-spec.ts` giữ nguyên kỳ vọng chuỗi `co_ban`/`nang_cao`.

- [ ] **Step 6: Chạy**

Run: `npx jest --config ./test/jest-e2e.json --runInBand test/phan-lop-giai-doan.e2e-spec.ts test/khoa-boi-duong.e2e-spec.ts test/lop-va-lich-hoc.e2e-spec.ts test/import.e2e-spec.ts` và `npx jest src/import src/khoa-boi-duong`.
Expected: các ca mới PASS; không phát sinh fail mới so với baseline (baseline đã biết: 8 fail `ho_so_nhan_su_moet` ở `import.e2e`/`import-moet`/`khoa-boi-duong` — ghi rõ nếu còn).

- [ ] **Step 7: Commit + push**

```bash
git add backend/src/khoa-boi-duong/dto/phan-lop-row.dto.ts backend/src/khoa-boi-duong/khoa-boi-duong.service.ts backend/src/import/import.service.ts backend/src/import/import.controller.ts backend/src/import/dto/mau-excel-query.dto.ts backend/src/import/util/phan-lop-excel.util.ts backend/src/import/util/phan-lop-excel.util.spec.ts backend/test/phan-lop-giai-doan.e2e-spec.ts backend/test/khoa-boi-duong.e2e-spec.ts backend/test/lop-va-lich-hoc.e2e-spec.ts backend/src/khoa-boi-duong/khoa-boi-duong.service.spec.ts
git commit -m "feat(import): phan_lop_hoc_vien moi hoc vien 1 dong, moi giai doan 1 cot"
git push
```

---

### Task 6: Học bù trong import điểm danh theo giai đoạn

**Files:**
- Modify: `backend/src/khoa-boi-duong/khoa-boi-duong.service.ts` (`resolveDiemDanhRow`, khối "Rule 🟡" ~2100)
- Test: `backend/test/phan-lop-giai-doan.e2e-spec.ts`

**Interfaces:** Consumes `phan_lop_giai_doan` (Task 1).

- [ ] **Step 1: e2e thất bại**

```ts
describe('diem_danh: học bù so với lớp được gán ở giai đoạn của buổi', () => {
  it('đúng lớp GĐ -> không cần ghi chú; lớp khác cùng GĐ hoặc chưa gán GĐ -> bắt buộc ghi chú', async () => {
    const khoa = await taoKhoa();
    const gd2 = await taoGiaiDoan(khoa.id, 2);
    const gd3 = await taoGiaiDoan(khoa.id, 3);
    const zA = await taoLop(khoa.id, 'zoom', 'Zoom A');
    const zB = await taoLop(khoa.id, 'zoom', 'Zoom B');
    await taoBuoi(zA.id, gd2.id, 1);
    await taoBuoi(zB.id, gd2.id, 1);
    await taoBuoi(zA.id, gd3.id, 1);
    const hv = await taoHocVienMoet(uniqueSuffix());
    const dk = await ghiDanh(hv.hocVien.id, khoa.id);
    await prisma.phan_lop_giai_doan.create({ data: { dang_ky_hoc_id: dk.id, giai_doan_id: gd2.id, lop_id: zA.id } });

    const dong = (lop: string, gd: number, ghiChu = '') =>
      ['', hv.tenDangNhap, khoa.ma_khoa, lop, 'zoom', String(gd), '1', 'co_mat', 'zoom', ghiChu];
    const { ketQua } = await taiLenDiemDanh([
      dong('Zoom A', 2),          // đúng lớp GĐ2 -> OK
      dong('Zoom B', 2),          // lớp khác cùng GĐ, thiếu ghi chú -> lỗi
      dong('Zoom A', 3),          // chưa gán GĐ3, thiếu ghi chú -> lỗi
      dong('Zoom B', 2, 'học bù'),// có ghi chú -> OK + cảnh báo
    ]);
    expect(ketQua.danh_sach_loi.map((l) => l.dong)).toEqual([3, 4]);
    expect(ketQua.danh_sach_canh_bao.map((c) => c.dong)).toEqual([5]);
  });
});
```

(`taiLenDiemDanh(rows)` build xlsx với 10 cột của `diem_danh` theo `import.service.ts#getColumns('diem_danh')`, POST `/import/diem_danh`, trả `ketQua`.)

Run → FAIL (logic cũ so theo `dang_ky_hoc_lop`).

- [ ] **Step 2: Sửa khối học bù**

Thay `dang_ky_hoc_lop.findUnique(...)` bằng:

```ts
    // Phân lớp theo giai đoạn (spec mục 4.6): so với lớp học viên được gán ở
    // ĐÚNG giai đoạn của buổi này; chưa gán ở giai đoạn đó cũng tính học bù.
    const phanLop = await this.prisma.phan_lop_giai_doan.findUnique({
      where: {
        dang_ky_hoc_id_giai_doan_id: {
          dang_ky_hoc_id: dangKy.id,
          giai_doan_id: giaiDoan.id,
        },
      },
    });
    let canhBao: string | undefined;
    if (!phanLop || phanLop.lop_id !== lop.id) {
```

(phần còn lại của khối giữ nguyên; sửa comment "Rule 🟡" cho đúng.)

- [ ] **Step 3: Chạy → PASS.** Chạy thêm các e2e `diem_danh` hiện có (`grep -ln "diem_danh" backend/test`) — ca nào dựng dữ liệu bằng `dang_ky_hoc_lop` thì đổi sang tạo `phan_lop_giai_doan` cho giai đoạn của buổi.

- [ ] **Step 4: Commit + push**

```bash
git add backend/src/khoa-boi-duong/khoa-boi-duong.service.ts backend/test/phan-lop-giai-doan.e2e-spec.ts
git commit -m "feat(diem-danh): hoc bu so voi lop duoc gan o giai doan cua buoi"
git push
```

---

### Task 7: Đường đọc backend (M7, kết quả, chi tiết khóa, đổi loại lớp, báo cáo, email)

**Files:**
- Modify: `backend/src/khoa-boi-duong/khoa-boi-duong.service.ts` (`khoaHocTheoHocVienId` ~1002, `ketQuaCuaToi` ~1140, `findOne` ~539, `capNhatLop` ~699)
- Modify: `backend/src/bao-cao/bao-cao.service.ts` (~534–590, ~660), `bao-cao.service.spec.ts`
- Modify: `backend/src/thong-bao/thong-bao.service.ts` (`guiDangKyHocPhanLop` ~243), `thong-bao.service.spec.ts`
- Test: `backend/test/phan-lop-giai-doan.e2e-spec.ts`, `backend/test/bao-cao.e2e-spec.ts`

**Interfaces:**
- Produces response `GET /hoc-vien/toi/khoa-hoc` và `GET /hoc-vien/:id/khoa-hoc`: mỗi phần tử bỏ `lop_truc_tiep`, `lop_zoom`, `lop_vle`, `tien_do_giai_doan`; thêm

```ts
giai_doan: {
  id: string; thu_tu: number; ten_giai_doan: string; hinh_thuc: hinh_thuc_giai_doan;
  thoi_gian_bat_dau: Date; thoi_gian_ket_thuc: Date;
  link_hoac_dia_diem: string | null; huong_dan: string | null;
  lop: null | { id; ten_lop; loai_lop; si_so_toi_da; nhom_hoc_vien; muc_nang_luc;
    nhan_su: { id; ho_ten; vai_tro; so_dien_thoai }[];
    lich_hoc: (lich_hoc_lop & { trang_thai_diem_danh: trang_thai_diem_danh | null })[] };
  tien_do: { ty_le_hoan_thanh: number | null; diem: number | null } | null;
}[]
```
- Produces `GET /hoc-vien/toi/ket-qua`: bỏ 3 trường `lop_*`, thêm `phan_lop: { thu_tu: number; ten_giai_doan: string; lop: { id: string; ten_lop: string } }[]`.
- Produces `GET /khoa-boi-duong/:id`: mỗi `lop_hoc[]` có thêm `si_so_hien_tai: number`.

- [ ] **Step 1: e2e thất bại**

```ts
describe('Đường đọc theo giai đoạn', () => {
  it('khoa-hoc của học viên: mọi GĐ active theo thứ tự; GĐ có lớp chỉ kèm buổi của GĐ đó; GĐ không lớp có link/hướng dẫn; tiến độ ghép đúng GĐ', async () => {
    const khoa = await taoKhoa();
    const gd1 = await taoGiaiDoan(khoa.id, 1, { hinh_thuc: 'danh_gia', link_hoac_dia_diem: 'https://x/dg', huong_dan: 'Làm bài' });
    const gd2 = await taoGiaiDoan(khoa.id, 2);
    const gd3 = await taoGiaiDoan(khoa.id, 3);
    const z = await taoLop(khoa.id, 'zoom', 'Zoom đọc');
    await taoBuoi(z.id, gd2.id, 1);
    await taoBuoi(z.id, gd3.id, 1); // buổi GĐ3 KHÔNG được hiện dưới GĐ2
    const hv = await taoHocVienMoet(uniqueSuffix());
    const dk = await ghiDanh(hv.hocVien.id, khoa.id);
    await prisma.phan_lop_giai_doan.create({ data: { dang_ky_hoc_id: dk.id, giai_doan_id: gd2.id, lop_id: z.id } });
    await prisma.ket_qua_giai_doan.create({ data: { dang_ky_hoc_id: dk.id, giai_doan_id: gd2.id, ty_le_hoan_thanh: 80 } });
    const token = await dangNhap(hv.tenDangNhap, 'x');

    const res = await request(app.getHttpServer()).get('/hoc-vien/toi/khoa-hoc').set('Authorization', `Bearer ${token}`).expect(200);
    const entry = res.body.find((r: { khoa_id: string }) => r.khoa_id === khoa.id);
    expect(entry.lop_zoom).toBeUndefined();
    expect(entry.giai_doan.map((g: { thu_tu: number }) => g.thu_tu)).toEqual([1, 2, 3]);
    const [g1, g2, g3] = entry.giai_doan;
    expect(g1).toMatchObject({ lop: null, link_hoac_dia_diem: 'https://x/dg', huong_dan: 'Làm bài', tien_do: null });
    expect(g2.lop.ten_lop).toBe('Zoom đọc');
    expect(g2.lop.lich_hoc).toHaveLength(1);
    expect(g2.lop.lich_hoc[0].giai_doan_id).toBe(gd2.id);
    expect(g2.tien_do).toEqual({ ty_le_hoan_thanh: 80, diem: null });
    expect(g3.lop).toBeNull();
  });

  it('chi tiết khóa: si_so_hien_tai đếm đăng ký khác nhau (1 học viên ở 2 GĐ cùng lớp = 1)', async () => {
    const khoa = await taoKhoa();
    const gd2 = await taoGiaiDoan(khoa.id, 2);
    const gd3 = await taoGiaiDoan(khoa.id, 3);
    const v = await taoLop(khoa.id, 'vle', 'VLE sĩ số');
    const hv = await taoHocVienMoet(uniqueSuffix());
    const dk = await ghiDanh(hv.hocVien.id, khoa.id);
    await prisma.phan_lop_giai_doan.createMany({ data: [
      { dang_ky_hoc_id: dk.id, giai_doan_id: gd2.id, lop_id: v.id },
      { dang_ky_hoc_id: dk.id, giai_doan_id: gd3.id, lop_id: v.id },
    ] });
    const res = await request(app.getHttpServer()).get(`/khoa-boi-duong/${khoa.id}`).set('Authorization', `Bearer ${tokenQuanTri}`).expect(200);
    expect(res.body.lop_hoc.find((l: { id: string }) => l.id === v.id).si_so_hien_tai).toBe(1);
  });

  it('đổi loai_lop của lớp đang có học viên -> 200 kèm canh_bao đếm theo đăng ký', async () => {
    const khoa = await taoKhoa();
    const gd2 = await taoGiaiDoan(khoa.id, 2);
    const gd3 = await taoGiaiDoan(khoa.id, 3);
    const v = await taoLop(khoa.id, 'vle', 'VLE đổi loại');
    const hv = await taoHocVienMoet(uniqueSuffix());
    const dk = await ghiDanh(hv.hocVien.id, khoa.id);
    await prisma.phan_lop_giai_doan.createMany({ data: [
      { dang_ky_hoc_id: dk.id, giai_doan_id: gd2.id, lop_id: v.id },
      { dang_ky_hoc_id: dk.id, giai_doan_id: gd3.id, lop_id: v.id },
    ] });
    const res = await request(app.getHttpServer())
      .patch(`/khoa-boi-duong/${khoa.id}/lop/${v.id}`)
      .set('Authorization', `Bearer ${tokenQuanTri}`)
      .send({ loai_lop: 'zoom' })
      .expect(200);
    expect(res.body.canh_bao).toContain('1 đăng ký học');
  });
});
```

Run → FAIL.

- [ ] **Step 2: `khoaHocTheoHocVienId`**

Thay include `dang_ky_hoc_lop` bằng:

```ts
        khoa: {
          include: {
            giai_doan: { where: { trang_thai: 'active' }, orderBy: { thu_tu: 'asc' } },
          },
        },
        cum: true,
        phan_lop_giai_doan: {
          include: {
            lop: {
              include: {
                nhan_su: true,
                lich_hoc: {
                  include: { giai_doan: true },
                  orderBy: [{ buoi_so: 'asc' }, { thoi_gian_bat_dau: 'asc' }],
                },
              },
            },
          },
        },
```

và phần map:

```ts
    return dangKyList.map((dk) => {
      const { phan_lop_giai_doan, khoa, ...rest } = dk;
      const { giai_doan: dsGiaiDoan, ...khoaGon } = khoa;
      const tienDo = new Map(
        ketQuaGiaiDoanList
          .filter((kq) => kq.dang_ky_hoc_id === dk.id)
          .map((kq) => [kq.giai_doan_id, {
            ty_le_hoan_thanh: kq.ty_le_hoan_thanh == null ? null : Number(kq.ty_le_hoan_thanh),
            diem: kq.diem == null ? null : Number(kq.diem),
          }]),
      );
      return {
        ...rest,
        khoa: khoaGon,
        giai_doan: dsGiaiDoan.map((gd) => {
          const lop = phan_lop_giai_doan.find((p) => p.giai_doan_id === gd.id)?.lop;
          return {
            id: gd.id, thu_tu: gd.thu_tu, ten_giai_doan: gd.ten_giai_doan,
            hinh_thuc: gd.hinh_thuc, thoi_gian_bat_dau: gd.thoi_gian_bat_dau,
            thoi_gian_ket_thuc: gd.thoi_gian_ket_thuc,
            link_hoac_dia_diem: gd.link_hoac_dia_diem, huong_dan: gd.huong_dan,
            lop: lop
              ? {
                  ...lop,
                  lich_hoc: lop.lich_hoc
                    .filter((b) => b.giai_doan_id === gd.id)
                    .map((b) => ({ ...b, trang_thai_diem_danh: diemDanhMap.get(`${dk.id}|${b.id}`) ?? null })),
                }
              : null,
            tien_do: tienDo.get(gd.id) ?? null,
          };
        }),
      };
    });
```

(Bỏ `tienDoTheoDangKy`; `ketQuaGiaiDoanList` không cần include `giai_doan` nữa. Cập nhật comment đầu hàm: response đổi cấu trúc theo spec 2026-10-02.)

- [ ] **Step 3: `ketQuaCuaToi`, `findOne`, `capNhatLop`**

`ketQuaCuaToi`: thay select `dang_ky_hoc_lop` bằng

```ts
        phan_lop_giai_doan: {
          select: {
            giai_doan: { select: { thu_tu: true, ten_giai_doan: true } },
            lop: { select: { id: true, ten_lop: true } },
          },
          orderBy: { giai_doan: { thu_tu: 'asc' } },
        },
```

và map `({ phan_lop_giai_doan, ...rest }) => ({ ...rest, phan_lop: phan_lop_giai_doan.map((p) => ({ thu_tu: p.giai_doan.thu_tu, ten_giai_doan: p.giai_doan.ten_giai_doan, lop: p.lop })) })`.

`findOne`: trong include `lop_hoc` thêm `_count: { select: { phan_lop_giai_doan: true } }` là KHÔNG đúng (đếm dòng, không đếm đăng ký). Thay vào đó, sau khi lấy `khoa`:

```ts
    // Sĩ số hiện tại = số đăng ký khác nhau đang được gán vào lớp ở bất kỳ
    // giai đoạn nào (1 học viên học cùng lớp ở 2 giai đoạn chỉ tính 1).
    const siSo = await this.prisma.phan_lop_giai_doan.groupBy({
      by: ['lop_id', 'dang_ky_hoc_id'],
      where: { lop: { khoa_id: id } },
    });
    const siSoTheoLop = new Map<string, number>();
    for (const r of siSo) siSoTheoLop.set(r.lop_id, (siSoTheoLop.get(r.lop_id) ?? 0) + 1);
    return {
      ...khoa,
      lop_hoc: khoa.lop_hoc.map((l) => ({ ...l, si_so_hien_tai: siSoTheoLop.get(l.id) ?? 0 })),
    };
```

(đặt sau khối kiểm quyền, thay `return khoa;`).

`capNhatLop`: đổi `dang_ky_hoc_lop.count({ where: { lop_id: lopId } })` thành đếm đăng ký khác nhau:

```ts
      const soDangKy = (
        await this.prisma.phan_lop_giai_doan.groupBy({ by: ['dang_ky_hoc_id'], where: { lop_id: lopId } })
      ).length;
```

và thông điệp cảnh báo: `` `Lớp này đang có ${soDangKy} đăng ký học được phân vào — đổi loại lớp sang "${dto.loai_lop}" không tự cập nhật phân lớp theo giai đoạn, cần rà soát lại` ``.

- [ ] **Step 4: Báo cáo**

`bao-cao.service.ts` khối sĩ số theo lớp: đổi select `dang_ky_hoc_lop` → `phan_lop_giai_doan` (cùng `where`/`select` lồng `dang_ky_hoc`), rồi **khử trùng theo `dang_ky_hoc_id`** trước khi đếm (thêm `id: true` vào select `dang_ky_hoc`):

```ts
      const daDem = new Set<string>();
      for (const pl of lop.phan_lop_giai_doan) {
        const dk = pl.dang_ky_hoc;
        if (daDem.has(dk.id)) continue;
        daDem.add(dk.id);
        row.si_so += 1;
        // ... phần còn lại giữ nguyên
      }
```

Khối `ket_qua_theo_hinh_thuc`: thay query `dang_ky_hoc_lop.findMany` bằng

```ts
      this.prisma.phan_lop_giai_doan.findMany({
        where: { dang_ky_hoc: where },
        select: {
          dang_ky_hoc_id: true,
          lop: { select: { loai_lop: true } },
          dang_ky_hoc: { select: { ket_qua: true } },
        },
      }),
```

rồi trước khi gọi `demKetQuaTheoHinhThuc`, khử trùng theo cặp `(dang_ky_hoc_id, loai_lop)` và map về `{ loai_lop, dang_ky_hoc }` (giữ chữ ký hàm). Cập nhật `bao-cao.service.spec.ts` mock tương ứng; `bao-cao.e2e-spec.ts` dựng dữ liệu bằng `phan_lop_giai_doan`. Thêm unit test: 1 đăng ký có 2 dòng cùng lớp zoom → `si_so` 1, `ket_qua_theo_hinh_thuc.zoom` đếm 1.

- [ ] **Step 5: Email `guiDangKyHocPhanLop`**

Kiểm tra `git status backend/src/thong-bao` sạch (session khác đã commit). Đổi include `dang_ky_hoc_lop` → `phan_lop_giai_doan: { include: { lop: { include: { nhan_su: true, lich_hoc: true } } } }`; `coLopTrucTiep = dangKy.phan_lop_giai_doan.some((p) => p.lop.loai_lop === 'truc_tiep')`; `dsLop` = các lớp **khác nhau** (khử trùng theo `lop.id`), sắp theo `thuTuLop[lop.loai_lop]`; `buoiHoc` chỉ lấy buổi có `giai_doan_id` khớp giai đoạn mà học viên được gán lớp đó:

```ts
    const ganTheoGiaiDoan = new Map(dangKy.phan_lop_giai_doan.map((p) => [p.giai_doan_id, p.lop_id]));
    const buoiHoc = dsLop.flatMap((lop) =>
      lop.lich_hoc
        .filter((l) => ganTheoGiaiDoan.get(l.giai_doan_id) === lop.id)
        .map((l) => ({ giaiDoanId: l.giai_doan_id, loaiLop: lop.loai_lop, buoiSo: l.buoi_so,
          batDau: l.thoi_gian_bat_dau, ketThuc: l.thoi_gian_ket_thuc, diaDiemHoacLink: l.dia_diem_hoac_link })),
    );
```

Cập nhật `thong-bao.service.spec.ts` (mock `phan_lop_giai_doan` thay `dang_ky_hoc_lop`) + 1 ca: buổi của lớp ở giai đoạn KHÔNG được gán không xuất hiện trong email.

- [ ] **Step 6: Chạy toàn bộ backend**

Run: `npx tsc --noEmit -p tsconfig.json && npx jest && npx jest --config ./test/jest-e2e.json --runInBand test/phan-lop-giai-doan.e2e-spec.ts test/bao-cao.e2e-spec.ts test/khoa-boi-duong.e2e-spec.ts test/lop-va-lich-hoc.e2e-spec.ts test/thong-bao.e2e-spec.ts`
Expected: PASS ngoài baseline đã biết.

- [ ] **Step 7: Commit + push**

```bash
git add backend/src/khoa-boi-duong/khoa-boi-duong.service.ts backend/src/bao-cao/bao-cao.service.ts backend/src/bao-cao/bao-cao.service.spec.ts backend/src/thong-bao/thong-bao.service.ts backend/src/thong-bao/thong-bao.service.spec.ts backend/test/phan-lop-giai-doan.e2e-spec.ts backend/test/bao-cao.e2e-spec.ts
git commit -m "feat(phan-lop): duong doc M7/bao cao/email theo phan_lop_giai_doan"
git push
```

---

### Task 8: Frontend — kiểu dữ liệu + M7 dòng thời gian

**Files:**
- Modify: `frontend/src/api/types.ts` (`GiaiDoanKhoa`, `KhoaHocDangKy`, `LopHocToi`, `LopHoc`)
- Modify: `frontend/src/pages/M7/ThongTinLopHoc.tsx`, `ThongTinLopHoc.test.tsx`
- Modify: `frontend/src/test/mocks/db.ts` (`taoKhoaHocToiMau` + giai đoạn mẫu của khóa)

**Interfaces:**
- Produces types:

```ts
export interface GiaiDoanKhoa { /* field cũ */ link_hoac_dia_diem: string | null; huong_dan: string | null; }
export interface LopHoc { /* field cũ */ si_so_hien_tai?: number; }
export interface LopHocToi { id: string; ten_lop: string; loai_lop: LoaiLop; si_so_toi_da: number | null;
  nhom_hoc_vien: number | null; muc_nang_luc: MucNangLuc | null; nhan_su: NhanSuLopToi[]; lich_hoc: LichHocLopToi[]; }
export interface GiaiDoanCuaToi {
  id: string; thu_tu: number; ten_giai_doan: string; hinh_thuc: HinhThucGiaiDoan;
  thoi_gian_bat_dau: string; thoi_gian_ket_thuc: string;
  link_hoac_dia_diem: string | null; huong_dan: string | null;
  lop: LopHocToi | null;
  tien_do: { ty_le_hoan_thanh: number | null; diem: number | null } | null;
}
// KhoaHocDangKy: bỏ lop_truc_tiep, lop_zoom, lop_vle, tien_do_giai_doan; thêm giai_doan: GiaiDoanCuaToi[]
```
(`TienDoGiaiDoan` bị xóa nếu không còn nơi dùng.)

- [ ] **Step 1: Cập nhật mock `taoKhoaHocToiMau`** theo shape mới: đăng ký 1 có 3 giai đoạn — GĐ1 đánh giá (`lop: null`, link `https://vle.example/danh-gia`, hướng dẫn `Làm bài trong 60 phút`), GĐ2 zoom (`lop` = lớp hiện có trong mock với 2 buổi thuộc GĐ2, nhân sự `giang_vien` Nguyễn Văn Long 0909123456 + `ho_tro` Trần Thị Mai), GĐ3 không lớp, không link, không hướng dẫn (Review Focus #5); `tien_do` GĐ2 `{ ty_le_hoan_thanh: 75, diem: null }`. Giữ đăng ký thứ hai hiện có (đổi sang shape mới tương tự).

- [ ] **Step 2: Test thất bại** (thay các test phụ thuộc `lop_*`; giữ test trạng thái tải/lỗi):

```tsx
it('hiện mỗi giai đoạn 1 thẻ theo thứ tự, kèm hình thức', async () => {
  renderTrang();
  const the = await screen.findAllByTestId('the-giai-doan');
  expect(the.map((t) => within(t).getByRole('heading').textContent)).toEqual([
    'GĐ1 · Đánh giá đầu vào', 'GĐ2 · Học trực tuyến qua zoom', 'GĐ3 · Học trực tuyến qua VLE',
  ]);
});

it('giai đoạn có lớp: tên lớp, nhân sự đã dịch nhãn, buổi, tiến độ', async () => {
  renderTrang();
  const gd2 = (await screen.findAllByTestId('the-giai-doan'))[1];
  expect(within(gd2).getByText('Lớp 01 – Nhóm cơ bản A')).toBeInTheDocument();
  expect(within(gd2).getByText(/Giảng viên: Nguyễn Văn Long — 0909123456/)).toBeInTheDocument();
  expect(within(gd2).getByText(/Hỗ trợ: Trần Thị Mai/)).toBeInTheDocument();
  expect(within(gd2).getAllByText(/^Buổi \d$/)).toHaveLength(2);
  expect(within(gd2).getByText('Hoàn thành: 75%')).toBeInTheDocument();
});

it('giai đoạn không lớp: hiện link + hướng dẫn chung', async () => {
  renderTrang();
  const gd1 = (await screen.findAllByTestId('the-giai-doan'))[0];
  expect(within(gd1).getByRole('link', { name: 'Mở liên kết' })).toHaveAttribute('href', 'https://vle.example/danh-gia');
  expect(within(gd1).getByText('Làm bài trong 60 phút')).toBeInTheDocument();
});

it('giai đoạn không lớp, không link, không hướng dẫn: chỉ còn tiêu đề + ngày, không lỗi', async () => {
  renderTrang();
  const gd3 = (await screen.findAllByTestId('the-giai-doan'))[2];
  expect(within(gd3).queryByRole('link')).not.toBeInTheDocument();
  expect(within(gd3).getByText(/Chưa được phân lớp ở giai đoạn này/)).toBeInTheDocument();
});
```

Run: `npx vitest run src/pages/M7` → FAIL.

- [ ] **Step 3: Cài đặt** — trong `ThongTinLopHoc.tsx`: `KhoiKhoaHoc` render `cum` (giữ), rồi `dangKy.giai_doan.map((gd) => <TheGiaiDoan key={gd.id} gd={gd} />)`, rồi "Kết quả đánh giá" (giữ). Xóa `KhoiTienDoGiaiDoan`, `BuoiHocTheoGiaiDoan` (nhóm theo GĐ không còn cần), giữ phần render từng buổi thành `DanhSachBuoi`:

```tsx
function TheGiaiDoan({ gd }: { gd: GiaiDoanCuaToi }) {
  const coLink = !!gd.link_hoac_dia_diem;
  const laLink = coLink && /^https?:\/\//.test(gd.link_hoac_dia_diem as string);
  return (
    <Paper p="md" radius="md" withBorder data-testid="the-giai-doan">
      <Group gap="xs" mb={4} wrap="wrap">
        <Title order={3} size="h5">{`GĐ${gd.thu_tu} · ${gd.ten_giai_doan}`}</Title>
        <Badge size="sm" color={MAU_HINH_THUC[gd.hinh_thuc] ?? 'gray'}>{NHAN_HINH_THUC[gd.hinh_thuc] ?? gd.hinh_thuc}</Badge>
      </Group>
      <Text size="sm" c="dimmed" mb="sm">{dinhDangNgay(gd.thoi_gian_bat_dau)} – {dinhDangNgay(gd.thoi_gian_ket_thuc)}</Text>

      {gd.lop ? (
        <Stack gap="sm">
          <Text fw={700}>{gd.lop.ten_lop}</Text>
          {gd.lop.nhan_su.map((ns) => (
            <Text size="sm" key={ns.id}>
              {NHAN_VAI_TRO_NHAN_SU[ns.vai_tro] ?? ns.vai_tro}: {ns.ho_ten}{ns.so_dien_thoai ? ` — ${ns.so_dien_thoai}` : ''}
            </Text>
          ))}
          <DanhSachBuoi lichHoc={gd.lop.lich_hoc} />
        </Stack>
      ) : (
        <Stack gap="xs">
          {gd.huong_dan && <Text size="sm" style={{ whiteSpace: 'pre-line' }}>{gd.huong_dan}</Text>}
          {coLink && (laLink
            ? <Button component="a" href={gd.link_hoac_dia_diem as string} size="xs" style={{ alignSelf: 'flex-start' }}>Mở liên kết</Button>
            : <Text size="sm">Địa điểm: {gd.link_hoac_dia_diem}</Text>)}
          {!gd.huong_dan && !coLink && <Text size="sm" c="dimmed">Chưa được phân lớp ở giai đoạn này.</Text>}
        </Stack>
      )}

      {gd.tien_do && (
        <Group gap="xs" mt="sm">
          <Badge variant="light" color="blue" size="sm">
            Hoàn thành: {gd.tien_do.ty_le_hoan_thanh == null ? 'Chưa có' : `${gd.tien_do.ty_le_hoan_thanh}%`}
          </Badge>
          {gd.tien_do.diem != null && <Badge variant="light" color="gray" size="sm">Điểm: {gd.tien_do.diem}</Badge>}
        </Group>
      )}
    </Paper>
  );
}
```

(`DanhSachBuoi` = phần `giaiDoan.buoi.map(...)` cũ, nhận `lichHoc: LichHocLopToi[]`. `dinhDangNgay` import từ `@/lib/ngay`. Banner "Chưa được phân vào lớp nào" hiện khi `giai_doan.every((g) => !g.lop)`.)

- [ ] **Step 4: Chạy → PASS;** `npx tsc -b` (sẽ báo lỗi ở `AdminHocVienChiTiet.tsx` vì `lop_*` mất — sửa ở Task 9; tạm thời để Task 8 và Task 9 commit **cùng nhau** nếu tsc chặn build. Ghi chú: chạy Step 1–4 của Task 9 trước khi commit Task 8.)

- [ ] **Step 5: Commit (gộp với Task 9 — xem Task 9 Step 5).**

---

### Task 9: Frontend — Admin chi tiết học viên: bảng phân lớp theo giai đoạn

**Files:**
- Create: `frontend/src/pages/Admin/PhanLopTheoGiaiDoan.tsx`, `PhanLopTheoGiaiDoan.test.tsx`
- Modify: `frontend/src/pages/Admin/AdminHocVienChiTiet.tsx` (`KhoiDangKy` ~127)
- Modify: `frontend/src/api/khoaBoiDuong.ts` (thêm hook mới; giữ hook cũ tới Task 11)
- Modify: `frontend/src/test/mocks/handlers.ts` — **chỉ** thêm handler `PUT /dang-ky-hoc/:id/giai-doan/:gdId/lop`; stage riêng hunk này (file có thay đổi của session khác).

**Interfaces:**
- Produces: `ganLopGiaiDoan(dangKyHocId, giaiDoanId, lopId: string | null): Promise<{ phan_lop: unknown; canh_bao?: string }>`, `useGanLopGiaiDoan(hocVienId: string)` (invalidate `khoaHocCuaHocVienKey(hocVienId)`).
- Produces: `<PhanLopTheoGiaiDoan hocVienId dangKy khoa />` với `khoa: KhoaBoiDuongChiTiet`.

- [ ] **Step 1: API**

```ts
export function ganLopGiaiDoan(dangKyHocId: string, giaiDoanId: string, lopId: string | null) {
  return apiFetch<{ phan_lop: unknown; canh_bao?: string }>(
    `/dang-ky-hoc/${dangKyHocId}/giai-doan/${giaiDoanId}/lop`,
    { method: 'PUT', body: JSON.stringify({ lop_id: lopId }) },
  );
}

export function useGanLopGiaiDoan(hocVienId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dangKyHocId, giaiDoanId, lopId }: { dangKyHocId: string; giaiDoanId: string; lopId: string | null }) =>
      ganLopGiaiDoan(dangKyHocId, giaiDoanId, lopId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: khoaHocCuaHocVienKey(hocVienId) }),
  });
}
```

Handler MSW: lưu vào `db` rồi trả `{ phan_lop: {...}, canh_bao: lopId === 'lop-khong-buoi' ? 'Lớp "X" ở giai đoạn 2 "...": lớp không có buổi nào trong giai đoạn này' : undefined }`.

- [ ] **Step 2: Test thất bại**

```tsx
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db, taoKhoaHocToiMau } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { PhanLopTheoGiaiDoan } from './PhanLopTheoGiaiDoan';

function render(yeuCau: { url: string; body: unknown }[], canhBao?: string) {
  server.use(
    http.put('/dang-ky-hoc/:id/giai-doan/:gdId/lop', async ({ request }) => {
      yeuCau.push({ url: new URL(request.url).pathname, body: await request.json() });
      return HttpResponse.json({ phan_lop: null, canh_bao: canhBao });
    }),
  );
  const dangKy = taoKhoaHocToiMau()[0];
  const khoa = db.khoaChiTiet['khoa-1']; // khoa mock có giai_doan gd-1..gd-3 + lop_hoc lop-1, lop-2
  return renderVoiRouter(
    [{ path: '/', element: <PhanLopTheoGiaiDoan hocVienId="hv-1" dangKy={dangKy} khoa={khoa} /> }],
    { initialEntries: ['/'] },
  );
}

describe('PhanLopTheoGiaiDoan', () => {
  it('1 dòng/giai đoạn, chọn sẵn lớp đang gán; đổi lớp + Lưu gọi PUT đúng URL/body', async () => {
    const yeuCau: { url: string; body: unknown }[] = [];
    const user = userEvent.setup();
    render(yeuCau);
    expect(screen.getByRole('textbox', { name: /^GĐ1/ })).toHaveValue('-- Bỏ gán --');
    expect(screen.getByRole('textbox', { name: /^GĐ2/ })).toHaveValue('Lớp 01 – Nhóm cơ bản A (Zoom)');
    await user.click(screen.getByRole('textbox', { name: /^GĐ2/ }));
    await user.click(await screen.findByRole('option', { name: /^Lớp 02/ }));
    await user.click(screen.getAllByRole('button', { name: 'Lưu' })[1]);
    expect(yeuCau).toEqual([{ url: '/dang-ky-hoc/dk-1/giai-doan/gd-2/lop', body: { lop_id: 'lop-2' } }]);
  });

  it('chọn "-- Bỏ gán --" + Lưu gửi lop_id null', async () => {
    const yeuCau: { url: string; body: unknown }[] = [];
    const user = userEvent.setup();
    render(yeuCau);
    await user.click(screen.getByRole('textbox', { name: /^GĐ2/ }));
    await user.click(await screen.findByRole('option', { name: '-- Bỏ gán --' }));
    await user.click(screen.getAllByRole('button', { name: 'Lưu' })[1]);
    expect(yeuCau[0].body).toEqual({ lop_id: null });
  });

  it('API trả canh_bao -> notification hiện nội dung cảnh báo', async () => {
    const user = userEvent.setup();
    render([], 'Lớp "Lớp 02" ở giai đoạn 2: lớp không có buổi nào trong giai đoạn này');
    await user.click(screen.getAllByRole('button', { name: 'Lưu' })[1]);
    expect(await screen.findByText(/lớp không có buổi nào trong giai đoạn này/)).toBeInTheDocument();
  });
});
```

Id giai đoạn trong `db.khoaChiTiet['khoa-1'].giai_doan` và `taoKhoaHocToiMau()[0].giai_doan` phải trùng nhau (`gd-1..gd-3`) — bổ sung ở Task 8 Step 1. Tên biến mock thật lấy theo `src/test/mocks/db.ts`.

- [ ] **Step 3: Cài đặt `PhanLopTheoGiaiDoan.tsx`**

```tsx
/** Phân lớp theo giai đoạn (spec 2026-10-02 mục 5.3) — 1 dòng/giai đoạn active, lưu từng dòng. */
export function PhanLopTheoGiaiDoan({ hocVienId, dangKy, khoa }: {
  hocVienId: string; dangKy: KhoaHocDangKy; khoa: KhoaBoiDuongChiTiet;
}) {
  const gan = useGanLopGiaiDoan(hocVienId);
  const giaiDoan = khoa.giai_doan.filter((g) => g.trang_thai === 'active');
  const [chon, setChon] = useState<Record<string, string>>(() =>
    Object.fromEntries(dangKy.giai_doan.map((g) => [g.id, g.lop?.id ?? ''])),
  );
  const tuyChonLop = [
    { value: '', label: '-- Bỏ gán --' },
    ...khoa.lop_hoc.map((l) => ({ value: l.id, label: `${l.ten_lop} (${NHAN_LOAI_LOP[l.loai_lop]})` })),
  ];

  function luu(giaiDoanId: string) {
    gan.mutate(
      { dangKyHocId: dangKy.id, giaiDoanId, lopId: chon[giaiDoanId] || null },
      {
        onSuccess: (res) => notifications.show(res.canh_bao
          ? { color: 'yellow', message: res.canh_bao }
          : { color: 'green', message: 'Đã lưu phân lớp' }),
        onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
      },
    );
  }

  return (
    <Stack gap="sm">
      {giaiDoan.map((gd) => (
        <Group key={gd.id} gap="sm" wrap="wrap" align="flex-end">
          <Select label={`GĐ${gd.thu_tu} · ${gd.ten_giai_doan}`} data={tuyChonLop}
            value={chon[gd.id] ?? ''} onChange={(v) => setChon((c) => ({ ...c, [gd.id]: v ?? '' }))}
            allowDeselect={false} searchable w={320} />
          <Button size="xs" loading={gan.isPending && gan.variables?.giaiDoanId === gd.id} onClick={() => luu(gd.id)}>Lưu</Button>
        </Group>
      ))}
    </Stack>
  );
}
```

(`NHAN_LOAI_LOP` export từ một chỗ dùng chung — nếu đang khai báo cục bộ trong `AdminHocVienChiTiet.tsx`, chuyển sang `src/lib/nhanLoaiLop.ts` và import ở cả hai.) Trong `AdminHocVienChiTiet.tsx#KhoiDangKy`: xóa state `chonLop`, `luuLop`, hook `useCapNhatLopDangKy`/`useXoaLopDangKy` và khối `(Object.keys(NHAN_LOAI_LOP)...)`; thay bằng `<PhanLopTheoGiaiDoan hocVienId={hocVienId} dangKy={dangKy} khoa={khoa} />`. Giữ khối cụm.

- [ ] **Step 4: Chạy** `npx vitest run src/pages/Admin src/pages/M7 && npx tsc -b && npx eslint src/pages/Admin/PhanLopTheoGiaiDoan.tsx src/pages/M7/ThongTinLopHoc.tsx` → PASS/sạch.

- [ ] **Step 5: Commit Task 8 + 9 + push** (stage handler bằng hunk như cách đã làm với `types.ts`: tạo blob từ `HEAD` + đúng phần thêm, `git update-index --cacheinfo`; hoặc `git add -p` nếu terminal tương tác có sẵn)

```bash
git add frontend/src/api/types.ts frontend/src/api/khoaBoiDuong.ts frontend/src/pages/M7/ThongTinLopHoc.tsx frontend/src/pages/M7/ThongTinLopHoc.test.tsx frontend/src/test/mocks/db.ts frontend/src/pages/Admin/PhanLopTheoGiaiDoan.tsx frontend/src/pages/Admin/PhanLopTheoGiaiDoan.test.tsx frontend/src/pages/Admin/AdminHocVienChiTiet.tsx frontend/src/lib/nhanLoaiLop.ts
# + hunk handler PUT trong frontend/src/test/mocks/handlers.ts
git commit -m "feat(fe): M7 dong thoi gian theo giai doan + phan lop theo giai doan o admin"
git push
```

---

### Task 10: Frontend — chi tiết khóa (giai đoạn, sĩ số, import) + Nhập dữ liệu chọn khóa

**Files:**
- Modify: `frontend/src/pages/Admin/AdminKhoaChiTiet.tsx` (form giai đoạn `FormGiaiDoan`, bảng lớp), `AdminKhoaChiTiet.test.tsx`
- Modify: `frontend/src/pages/Admin/ModalImportLopHoc.tsx`
- Modify: `frontend/src/pages/Admin/AdminNhapDuLieu.tsx`, `AdminNhapDuLieu.test.tsx`
- Modify: `frontend/src/api/nhapDuLieu.ts` (`taiMauExcel(loai, maKhoa?)`), `frontend/src/api/khoaBoiDuong.ts` (`CreateGiaiDoanDto`/`UpdateGiaiDoanDto` thêm 2 field)

**Interfaces:**
- Consumes: `GiaiDoanKhoa.link_hoac_dia_diem/huong_dan`, `LopHoc.si_so_hien_tai` (Task 8).
- Produces: `taiMauExcel(loai: LoaiDanhMucImport, maKhoa?: string)` → `/import/mau-excel?loai=…&ma_khoa=…`.

- [ ] **Step 1: Test thất bại**

```tsx
// AdminKhoaChiTiet.test.tsx (dùng renderTrang/ghiLaiUrl đã có trong file)
it('bảng lớp có cột "Sĩ số hiện tại" lấy từ si_so_hien_tai', async () => {
  db.nguoiDung.vai_tro = 'quan_tri';
  renderTrang('khoa-1'); // mock lop-1 có si_so_hien_tai: 12 (thêm ở db.ts)
  await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');
  expect(screen.getByRole('columnheader', { name: 'Sĩ số hiện tại' })).toBeInTheDocument();
  const dong = screen.getByText('Lớp 01 – Nhóm cơ bản A').closest('tr') as HTMLElement;
  expect(within(dong).getByText('12')).toBeInTheDocument();
});

it('tạo giai đoạn kèm link + hướng dẫn -> body gửi đúng 2 field', async () => {
  db.nguoiDung.vai_tro = 'quan_tri';
  const bodies: unknown[] = [];
  server.use(
    http.post('/khoa-boi-duong/:id/giai-doan', async ({ request }) => {
      bodies.push(await request.clone().json());
      return undefined;
    }),
  );
  const user = userEvent.setup();
  renderTrang('khoa-1');
  await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');
  await user.click(screen.getByRole('tab', { name: 'Giai đoạn' }));
  await user.click(screen.getByRole('button', { name: /Tạo giai đoạn/ }));
  // các ô bắt buộc: điền đúng như test "tạo giai đoạn mới" sẵn có trong file (copy nguyên các dòng user.type/click đó)
  await user.type(screen.getByLabelText('Link hoặc địa điểm'), 'https://vle.example/dg');
  await user.type(screen.getByLabelText('Hướng dẫn'), 'Làm bài 60 phút');
  await user.click(screen.getByRole('button', { name: 'Tạo giai đoạn' }));
  await waitFor(() => expect(bodies).toHaveLength(1));
  expect(bodies[0]).toMatchObject({ link_hoac_dia_diem: 'https://vle.example/dg', huong_dan: 'Làm bài 60 phút' });
});

it('modal import "Phân lớp học viên": mẫu và upload đều kèm ma_khoa', async () => {
  db.nguoiDung.vai_tro = 'quan_tri';
  const urlMau: string[] = [];
  const urlUp: string[] = [];
  ghiLaiUrl('get', '/import/mau-excel', urlMau);
  ghiLaiUrl('post', '/import/:loai', urlUp);
  const user = userEvent.setup();
  renderTrang('khoa-1');
  await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');
  await user.click(screen.getByRole('button', { name: '⇪ Import Excel' }));
  const modal = await screen.findByRole('dialog', { name: 'Import lớp học từ Excel' });
  await user.click(within(modal).getByText('Phân lớp học viên'));
  await user.click(within(modal).getByRole('button', { name: '⇩ Tải file mẫu Excel' }));
  await user.upload(modal.querySelector('input[type="file"]') as HTMLInputElement, new File(['x'], 'pl.xlsx'));
  await user.click(within(modal).getByRole('button', { name: 'Tải lên & kiểm tra' }));
  await screen.findByText('Kết quả kiểm tra');
  expect(new URL(urlMau[0]).searchParams.get('loai')).toBe('phan_lop_hoc_vien');
  expect(new URL(urlMau[0]).searchParams.get('ma_khoa')).toBe('AG-2026-014');
  expect(new URL(urlUp[0]).pathname).toBe('/import/phan_lop_hoc_vien');
  expect(new URL(urlUp[0]).searchParams.get('ma_khoa')).toBe('AG-2026-014');
});

// AdminNhapDuLieu.test.tsx
it('loại "Phân lớp học viên": bắt chọn khóa trước khi tải; upload gửi ?ma_khoa', async () => {
  const urls: string[] = [];
  server.use(http.post('/import/:loai', ({ request }) => { urls.push(request.url); return undefined; }));
  const user = userEvent.setup();
  const { container } = renderTrang();
  await screen.findByRole('table');
  await user.click(screen.getByRole('textbox', { name: 'Loại dữ liệu' }));
  await user.click(await screen.findByRole('option', { name: 'Phân lớp học viên (MOET)' }));
  await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, new File(['x'], 'pl.xlsx'));
  expect(screen.getByRole('button', { name: 'Tải lên & kiểm tra' })).toBeDisabled();
  await user.click(screen.getByRole('textbox', { name: /Khóa bồi dưỡng/ }));
  await user.click(await screen.findByRole('option', { name: /AG-2026-014/ }));
  await user.click(screen.getByRole('button', { name: 'Tải lên & kiểm tra' }));
  await screen.findByText('Kết quả kiểm tra');
  expect(new URL(urls[0]).searchParams.get('ma_khoa')).toBe('AG-2026-014');
});
```

Option của Select khóa hiển thị `"<ma_khoa> – <ten_khoa>"`. Run → FAIL.

- [ ] **Step 2: Cài đặt**
  1. `FormGiaiDoan` thêm `link_hoac_dia_diem: string`, `huong_dan: string`; form tạo/sửa thêm `TextInput label="Link hoặc địa điểm"` và `Textarea label="Hướng dẫn" autosize minRows={2}`; khi gửi: chuỗi rỗng → `null` ở PATCH, bỏ qua ở POST.
  2. Bảng lớp: thêm `<Table.Th>Sĩ số hiện tại</Table.Th>` sau "Sĩ số tối đa", ô `{lop.si_so_hien_tai ?? 0}`.
  3. `ModalImportLopHoc`: `TUY_CHON_LOAI` thêm `{ value: 'phan_lop_hoc_vien', label: 'Phân lớp học viên' }` (mở rộng `LoaiImportLop`), gợi ý riêng cho loại này: "Mỗi học viên 1 dòng, mỗi giai đoạn 1 cột. Ô trống = giữ nguyên, \"-\" = gỡ lớp."; `taiMau` gọi `taiMauExcel(loai, maKhoa)` cho mọi loại.
  4. `nhapDuLieu.ts#taiMauExcel(loai, maKhoa?)` dùng `xayQueryString({ loai, ma_khoa: maKhoa })`.
  5. `AdminNhapDuLieu`: khi `loai === 'phan_lop_hoc_vien'` hiện `Select label="Khóa bồi dưỡng" required` (dữ liệu `useDanhSachKhoa({})`, value = `ma_khoa`); nút tải mẫu và tải lên `disabled` khi chưa chọn; truyền `maKhoa`.

- [ ] **Step 3: Chạy** `npx vitest run && npx tsc -b && npx eslint <các file đã sửa>` → PASS/sạch.

- [ ] **Step 4: Commit + push**

```bash
git add frontend/src/pages/Admin/AdminKhoaChiTiet.tsx frontend/src/pages/Admin/AdminKhoaChiTiet.test.tsx frontend/src/pages/Admin/ModalImportLopHoc.tsx frontend/src/pages/Admin/AdminNhapDuLieu.tsx frontend/src/pages/Admin/AdminNhapDuLieu.test.tsx frontend/src/api/nhapDuLieu.ts frontend/src/api/khoaBoiDuong.ts
git commit -m "feat(fe): link/huong dan giai doan, si so hien tai, import phan lop theo khoa"
git push
```

---

### Task 11: Dọn dẹp — gỡ `dang_ky_hoc_lop`

**Files:**
- Modify: `backend/src/khoa-boi-duong/dang-ky-hoc-thao-tac.controller.ts` (xóa `PATCH :id/lop`, `DELETE :id/lop/:loaiLop`), `khoa-boi-duong.service.ts` (xóa `capNhatLopDangKy`, `xoaLopDangKy`, `assertLopThuocKhoaVaLoai` nếu không còn dùng), xóa `dto/capnhat-lop-dang-ky.dto.ts`, `update-lop-hoc.dto.ts` (comment nhắc `dang_ky_hoc_lop`)
- Modify: `frontend/src/api/khoaBoiDuong.ts` (xóa `capNhatLopDangKy`, `useCapNhatLopDangKy`, `xoaLopDangKy`, `useXoaLopDangKy`, `CapNhatLopDangKyDto`)
- Modify: `backend/prisma/schema.prisma` (xóa model `dang_ky_hoc_lop` + relation)
- Create: `backend/prisma/migrations/20261002100000_drop_dang_ky_hoc_lop/migration.sql`
- Modify: `CONTEXT.md`
- Test: e2e/unit còn tham chiếu route cũ → xóa ca đó (đã được thay bằng ca PUT ở Task 3)

- [ ] **Step 1: Xác nhận không còn tham chiếu**

Run: `grep -rn "dang_ky_hoc_lop\|capNhatLopDangKy\|xoaLopDangKy\|lop_truc_tiep\|lop_zoom\|lop_vle" backend/src backend/test frontend/src`
Expected: chỉ còn trong code sắp xóa ở task này. Nếu còn chỗ khác → quay lại task tương ứng.

- [ ] **Step 2: Xóa code + chạy toàn bộ test**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json && npx jest && npx jest --config ./test/jest-e2e.json --runInBand`; `cd frontend && npx tsc -b && npx vitest run`
Expected: PASS ngoài baseline đã biết.

- [ ] **Step 3: Migration drop (viết tay)**

```sql
-- Dọn dẹp phân lớp theo giai đoạn (spec 2026-10-02): mọi đọc/ghi đã chuyển
-- sang phan_lop_giai_doan (migration 20261002090100 đã chép dữ liệu).
DROP TABLE "dang_ky_hoc_lop";
```

Xóa model khỏi `schema.prisma`, `npx prisma generate`. **Hỏi người dùng trước khi `npx prisma migrate deploy`** trên DB local (xóa bảng). Sau khi được đồng ý: deploy, chạy lại e2e `phan-lop-giai-doan` (ca Task 1 dùng `dang_ky_hoc_lop` → xóa ca đó cùng `chuyen-phan-lop.util.ts` + script, vì bảng nguồn không còn).

- [ ] **Step 4: Cập nhật `CONTEXT.md`** — mục DangKyHocLop thay bằng:

```markdown
- **PhanLopGiaiDoan** (spec 2026-10-02) — gán 1 `DangKyHoc` vào tối đa 1 `LopHoc` **cho mỗi `GiaiDoanKhoa`**, unique `(dang_ky_hoc_id, giai_doan_id)`. Thay hoàn toàn `DangKyHocLop` (1 lớp mỗi loại, đã xóa). Import `phan_lop_hoc_vien`: mỗi học viên 1 dòng, mỗi giai đoạn 1 cột `GĐ<n> - <tên>`, ô trống = giữ, `-` = gỡ; bắt buộc `ma_khoa`.
- **GiaiDoanKhoa.link_hoac_dia_diem / huong_dan** — thông tin chung hiện cho học viên ở giai đoạn không gán lớp (vd đánh giá đầu vào/đầu ra).
```

- [ ] **Step 5: Commit + push**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20261002100000_drop_dang_ky_hoc_lop backend/src/khoa-boi-duong backend/test frontend/src/api/khoaBoiDuong.ts CONTEXT.md
git commit -m "refactor(phan-lop): go dang_ky_hoc_lop sau khi chuyen sang phan_lop_giai_doan"
git push
```

(`git add backend/src/khoa-boi-duong` chỉ an toàn nếu `git status` cho thấy thư mục đó không có thay đổi của session khác — `diem-danh-row.dto.ts` đang dở; nếu vẫn dở thì add từng file.)

---

## Kiểm chứng cuối với dữ liệu thật

- [ ] Tải mẫu phân lớp của khóa `2026-AG-NLS` từ trang chi tiết khóa; điền lại 10 học viên trong `mau-phan_lop_hoc_vien (1).xlsx` (cột GĐ2 = Lớp zoom n, GĐ3 = Lớp VLE n, GĐ4 = Lớp trực tiếp n, `ten_cum`); import → 0 lỗi, 0 cảnh báo.
- [ ] Đặt link/hướng dẫn cho GĐ1, GĐ6 ở tab Giai đoạn.
- [ ] Mở `/toi/lop-hoc` của `08901059055`: 6 thẻ GĐ; GĐ2/3/4 đúng lớp và chỉ buổi của GĐ đó; GĐ1/GĐ6 hiện link/hướng dẫn; GĐ5 "Chưa được phân lớp ở giai đoạn này".
