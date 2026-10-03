-- Yêu cầu hỗ trợ gắn tình huống chọn từ mục "Lỗi thường gặp" thay cho danh mục loại vấn đề (2026-10-03).
-- Ticket cũ vẫn giữ loai_van_de_id; ticket mới chỉ có tinh_huong.
-- Viết tay, KHÔNG để Prisma sinh kèm các câu DROP INDEX cho GIN trgm index
-- (xem gotcha ở migration 20260928065926_t14_loai_dot_xac_nhan_enum).

ALTER TABLE "yeu_cau_ho_tro" ADD COLUMN "tinh_huong" VARCHAR(255);
ALTER TABLE "yeu_cau_ho_tro" ALTER COLUMN "loai_van_de_id" DROP NOT NULL;
