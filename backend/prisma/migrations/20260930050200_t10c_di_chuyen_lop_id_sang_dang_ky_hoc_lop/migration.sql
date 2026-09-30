-- QĐ10 (mo-rong-nls-an-giang.md, 2026-09-30): di chuyển dữ liệu
-- dang_ky_hoc.lop_id (cột cũ, 1 lớp/đăng ký) sang dang_ky_hoc_lop
-- (loai_lop='truc_tiep', vì lop_hoc hiện có đã được backfill
-- loai_lop='truc_tiep' ở migration t10a) — PHẢI chạy trước khi xóa cột cũ.
INSERT INTO "dang_ky_hoc_lop" ("id", "dang_ky_hoc_id", "lop_id", "loai_lop", "created_at")
SELECT gen_random_uuid(), "id", "lop_id", 'truc_tiep', CURRENT_TIMESTAMP
FROM "dang_ky_hoc"
WHERE "lop_id" IS NOT NULL;

-- Gỡ trigger + CHECK gắn với dang_ky_hoc.lop_id — hết ý nghĩa sau khi cột bị
-- xóa; việc kiểm tra "lớp thuộc đúng khóa" (và nay thêm "đúng loại lớp")
-- chuyển hẳn sang tầng service (xem
-- KhoaBoiDuongService.assertLopThuocKhoaVaLoai), không còn DB trigger cho
-- việc này.
DROP TRIGGER IF EXISTS "trg_dang_ky_hoc_kiem_tra_lop" ON "dang_ky_hoc";
DROP FUNCTION IF EXISTS trg_dang_ky_lop_thuoc_khoa();
ALTER TABLE "dang_ky_hoc" DROP CONSTRAINT IF EXISTS "chk_dang_ky_lop_thuoc_khoa";

-- Xóa FK/index/cột lop_id cũ — đã thay thế bằng dang_ky_hoc_lop.
ALTER TABLE "dang_ky_hoc" DROP CONSTRAINT "dang_ky_hoc_lop_id_fkey";
DROP INDEX "idx_dang_ky_lop";
ALTER TABLE "dang_ky_hoc" DROP COLUMN "lop_id";
