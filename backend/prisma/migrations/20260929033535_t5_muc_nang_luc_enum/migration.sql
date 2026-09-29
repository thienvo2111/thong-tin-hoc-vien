-- T5 (mo-rong-nls-an-giang.md, 2026-09-29): migration A — enum mới +
-- ALTER TYPE ... ADD VALUE. Tách riêng khỏi migration B (thêm cột
-- dang_ky_hoc.muc_dau_vao/muc_dau_ra) theo đúng pattern đã dùng ở T14
-- (loai_dot_xac_nhan_enum / dot_xac_nhan_tables) và T15
-- (loai_danh_muc_import_tai_khoan_vle / tai_khoan_vle_table) — Postgres
-- không cho phép dùng giá trị enum vừa ADD VALUE trong cùng transaction đã
-- thêm nó, nên bất kỳ migration nào sau này dùng giá trị 'ket_qua_danh_gia'
-- (vd đọc/ghi nhat_ky_import.loai_danh_muc) phải chạy SAU migration này.
--
-- Prisma tự sinh 4 câu "DROP INDEX" ở đây cho các GIN trgm index (tạo bằng
-- raw SQL, ngoài schema.prisma DSL) — ĐÃ GỠ BỎ, xem gotcha đã biết ở
-- migration 20260928065926_t14_loai_dot_xac_nhan_enum.

-- CreateEnum
CREATE TYPE "muc_nang_luc" AS ENUM ('co_ban', 'thanh_thao', 'nang_cao');

-- AlterEnum
ALTER TYPE "loai_danh_muc_import" ADD VALUE 'ket_qua_danh_gia';
