-- Cấu hình khảo sát riêng theo khóa bồi dưỡng (2026-10-02).
-- Viết tay, KHÔNG để Prisma sinh kèm các câu DROP INDEX cho GIN trgm index
-- (xem gotcha ở migration 20260928065926_t14_loai_dot_xac_nhan_enum).

-- CreateTable
CREATE TABLE "cau_hinh_khao_sat_khoa" (
    "khoa_id" UUID NOT NULL,
    "tinh_id" UUID,
    "gia_tri" JSONB NOT NULL,
    "cap_nhat_luc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cap_nhat_boi" UUID,

    CONSTRAINT "cau_hinh_khao_sat_khoa_pkey" PRIMARY KEY ("khoa_id")
);

-- Mỗi tỉnh hiển thị ở trang chủ gắn tối đa 1 khóa (NULL được lặp).
CREATE UNIQUE INDEX "uq_cau_hinh_khao_sat_khoa_tinh" ON "cau_hinh_khao_sat_khoa"("tinh_id");

ALTER TABLE "cau_hinh_khao_sat_khoa" ADD CONSTRAINT "cau_hinh_khao_sat_khoa_khoa_id_fkey" FOREIGN KEY ("khoa_id") REFERENCES "khoa_boi_duong"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "cau_hinh_khao_sat_khoa" ADD CONSTRAINT "cau_hinh_khao_sat_khoa_tinh_id_fkey" FOREIGN KEY ("tinh_id") REFERENCES "dia_danh"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
