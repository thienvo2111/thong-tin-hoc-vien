-- T6 (mo-rong-nls-an-giang.md, 2026-09-29, QĐ3/QĐ4): migration B — thuộc
-- tính lớp (nhom_hoc_vien, muc_nang_luc — dùng lại enum muc_nang_luc đã tạo
-- ở T5) + lịch nhiều buổi/giai đoạn (buoi_so). Chạy SAU migration A
-- (20260929041009_t6_loai_danh_muc_import_enum).
--
-- File này viết tay từ `prisma migrate diff --from-url ... --to-schema-
-- datamodel prisma/schema.prisma --script` (môi trường không tương tác nên
-- không dùng được `migrate dev --create-only` trực tiếp — cùng cách "migrate
-- diff thủ công" mà tài liệu task đã gợi ý). 1 chỗ đã sửa tay so với output
-- gốc của migrate diff: bỏ 4 câu "DROP INDEX" cho GIN trgm index (tạo bằng
-- raw SQL, ngoài schema.prisma DSL) — cùng gotcha đã biết ở migration
-- 20260928065926_t14_loai_dot_xac_nhan_enum. Câu "DROP INDEX
-- uq_lich_hoc_lop_giai_doan" GIỮ NGUYÊN như migrate diff sinh ra — đây là
-- UNIQUE INDEX thuần (tạo bằng CREATE UNIQUE INDEX ở migration init, không
-- phải table CONSTRAINT), nên DROP INDEX là đúng cú pháp (không phải DROP
-- CONSTRAINT).
--
-- Đã kiểm tra dữ liệu hiện có (dev) trước khi thêm — 0 lịch_hoc_lop, không có
-- dòng vi phạm ràng buộc UNIQUE mới.

-- DropIndex (QĐ3: bỏ giới hạn 1 lịch/giai đoạn mỗi lớp)
DROP INDEX "uq_lich_hoc_lop_giai_doan";

-- AlterTable
ALTER TABLE "lich_hoc_lop" ADD COLUMN     "buoi_so" SMALLINT NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "lop_hoc" ADD COLUMN     "muc_nang_luc" "muc_nang_luc",
ADD COLUMN     "nhom_hoc_vien" SMALLINT;

-- CreateIndex
CREATE UNIQUE INDEX "uq_lich_hoc_lop_giai_doan_buoi" ON "lich_hoc_lop"("lop_id", "giai_doan_id", "buoi_so");

-- Raw SQL bổ sung — CHECK constraint không biểu diễn được bằng Prisma DSL
-- (xem comment đầu prisma/schema.prisma).
ALTER TABLE "lop_hoc" ADD CONSTRAINT "chk_lop_hoc_nhom"
    CHECK (nhom_hoc_vien BETWEEN 1 AND 20);
ALTER TABLE "lich_hoc_lop" ADD CONSTRAINT "chk_lich_hoc_lop_buoi"
    CHECK (buoi_so >= 1);
