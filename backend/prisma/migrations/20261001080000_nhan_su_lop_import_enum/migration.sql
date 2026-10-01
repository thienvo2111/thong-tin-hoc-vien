-- Import nhân sự lớp (lop_hoc_nhan_su) qua Excel — ALTER TYPE ... ADD VALUE
-- tách migration riêng theo đúng pattern T6/T12/T14/T15: Postgres không cho
-- dùng giá trị enum vừa ADD VALUE trong cùng transaction đã thêm nó.
-- Viết tay, KHÔNG để Prisma sinh kèm các câu DROP INDEX cho GIN trgm index
-- (xem gotcha ở migration 20260928065926_t14_loai_dot_xac_nhan_enum).

-- AlterEnum
ALTER TYPE "loai_danh_muc_import" ADD VALUE 'nhan_su_lop';
