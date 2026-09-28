-- AlterEnum
ALTER TYPE "loai_danh_muc_import" ADD VALUE 'tai_khoan_vle';

-- Prisma tự sinh 4 câu "DROP INDEX" ở đây cho các GIN trgm index (tạo bằng
-- raw SQL, ngoài schema.prisma DSL) — ĐÃ GỠ BỎ, xem gotcha đã biết ở
-- migration 20260928065926_t14_loai_dot_xac_nhan_enum.
