-- Cấu hình vận hành dạng khóa-giá trị (cấu hình khảo sát đầu vào, 2026-10-02).
-- Viết tay, KHÔNG để Prisma sinh kèm các câu DROP INDEX cho GIN trgm index
-- (xem gotcha ở migration 20260928065926_t14_loai_dot_xac_nhan_enum).

-- CreateTable
CREATE TABLE "cau_hinh_he_thong" (
    "khoa" VARCHAR(100) NOT NULL,
    "gia_tri" JSONB NOT NULL,
    "cap_nhat_luc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cap_nhat_boi" UUID,

    CONSTRAINT "cau_hinh_he_thong_pkey" PRIMARY KEY ("khoa")
);
