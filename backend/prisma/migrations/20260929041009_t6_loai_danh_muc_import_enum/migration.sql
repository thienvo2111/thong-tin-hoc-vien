-- T6 (mo-rong-nls-an-giang.md, 2026-09-29): migration A — ALTER TYPE ... ADD
-- VALUE tách riêng khỏi migration B (thêm cột lop_hoc/lich_hoc_lop) theo đúng
-- pattern đã dùng ở T14/T15/T5 — Postgres không cho phép dùng giá trị enum
-- vừa ADD VALUE trong cùng transaction đã thêm nó, nên bất kỳ migration nào
-- sau này đọc/ghi nhat_ky_import.loai_danh_muc = 'lop_va_lich_hoc' phải chạy
-- SAU migration này.
--
-- Prisma tự sinh 4 câu "DROP INDEX" ở đây cho các GIN trgm index (tạo bằng
-- raw SQL, ngoài schema.prisma DSL) — ĐÃ GỠ BỎ, xem gotcha đã biết ở
-- migration 20260928065926_t14_loai_dot_xac_nhan_enum.

-- AlterEnum
ALTER TYPE "loai_danh_muc_import" ADD VALUE 'lop_va_lich_hoc';
