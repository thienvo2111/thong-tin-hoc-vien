-- Kết quả khảo sát (2026-10-04) — ALTER TYPE ... ADD VALUE tách migration riêng
-- theo đúng pattern T6/T12/T14/T15: Postgres không cho dùng giá trị enum vừa
-- ADD VALUE trong cùng transaction đã thêm nó.
-- Viết tay, KHÔNG để Prisma sinh kèm các câu DROP INDEX cho GIN trgm index.

ALTER TYPE "loai_danh_muc_import" ADD VALUE 'ket_qua_khao_sat';
