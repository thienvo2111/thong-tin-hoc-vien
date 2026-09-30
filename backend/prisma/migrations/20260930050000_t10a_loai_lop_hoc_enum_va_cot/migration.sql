-- QĐ10 (mo-rong-nls-an-giang.md, 2026-09-30): tách 3 loại "lớp" ĐỘC LẬP
-- nhau trong cùng 1 khóa (trực tiếp/zoom/vle — không phải lớp cha chứa lớp
-- con). Enum loai_lop_hoc là enum MỚI hoàn toàn nên CREATE TYPE dùng được
-- ngay trong cùng migration với cột dùng nó (không bị ràng buộc "ALTER TYPE
-- ADD VALUE khác transaction" như các enum mở rộng — xem comment đầu
-- schema.prisma).

-- CreateEnum
CREATE TYPE "loai_lop_hoc" AS ENUM ('truc_tiep', 'zoom', 'vle');

-- AlterTable: thêm cột nullable trước, backfill dữ liệu cũ, rồi mới ép NOT
-- NULL — cách an toàn để thêm cột NOT NULL trên bảng đã có dữ liệu mà không
-- cần DEFAULT vĩnh viễn.
ALTER TABLE "lop_hoc" ADD COLUMN "loai_lop" "loai_lop_hoc";

-- Backfill: toàn bộ lớp hiện có (trước QĐ10) coi là lớp trực tiếp — mặc
-- định an toàn nhất vì dữ liệu cũ đều là lớp dùng chung duy nhất cho 1
-- đăng ký học (chưa có khái niệm zoom/vle tách riêng).
UPDATE "lop_hoc" SET "loai_lop" = 'truc_tiep' WHERE "loai_lop" IS NULL;

ALTER TABLE "lop_hoc" ALTER COLUMN "loai_lop" SET NOT NULL;

-- Đổi UNIQUE (khoa_id, ten_lop) -> (khoa_id, loai_lop, ten_lop): cho phép
-- trùng tên lớp GIỮA các loại lớp khác nhau trong cùng khóa (vd "Lớp 1" vừa
-- có ở trực tiếp vừa có ở zoom). uq_lop_ten_trong_khoa được tạo dưới dạng
-- UNIQUE CONSTRAINT (không phải index trần) ở migration khởi tạo — phải
-- DROP CONSTRAINT, không thể DROP INDEX trực tiếp.
ALTER TABLE "lop_hoc" DROP CONSTRAINT "uq_lop_ten_trong_khoa";
ALTER TABLE "lop_hoc" ADD CONSTRAINT "uq_lop_ten_trong_khoa" UNIQUE ("khoa_id", "loai_lop", "ten_lop");
