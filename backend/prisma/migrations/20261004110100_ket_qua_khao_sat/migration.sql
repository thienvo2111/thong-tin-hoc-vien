-- Tình trạng + kết quả bài trên hệ thống khảo sát (2026-10-04).
-- Viết tay, KHÔNG để Prisma sinh kèm các câu DROP INDEX cho GIN trgm index
-- (xem gotcha ở migration 20260928065926_t14_loai_dot_xac_nhan_enum).

-- CreateEnum
CREATE TYPE "trang_thai_khao_sat" AS ENUM ('da_mo', 'dang_lam', 'hoan_thanh');

-- CreateTable
CREATE TABLE "ket_qua_khao_sat" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hoc_vien_id" UUID NOT NULL,
    "loai" VARCHAR(20) NOT NULL,
    "trang_thai" "trang_thai_khao_sat" NOT NULL,
    "so_lan_mo" INTEGER NOT NULL DEFAULT 0,
    "mo_lan_dau_luc" TIMESTAMPTZ(6),
    "mo_gan_nhat_luc" TIMESTAMPTZ(6),
    "bat_dau_luc" TIMESTAMPTZ(6),
    "hoan_thanh_luc" TIMESTAMPTZ(6),
    "muc" "muc_nang_luc",
    "diem" DECIMAL(6,2),
    "chi_tiet" JSONB,
    "nguon" VARCHAR(10) NOT NULL,
    "cap_nhat_luc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ket_qua_khao_sat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_ket_qua_khao_sat_hoc_vien_loai" ON "ket_qua_khao_sat"("hoc_vien_id", "loai");
CREATE INDEX "idx_ket_qua_khao_sat_loai_trang_thai" ON "ket_qua_khao_sat"("loai", "trang_thai");

ALTER TABLE "ket_qua_khao_sat" ADD CONSTRAINT "ket_qua_khao_sat_hoc_vien_id_fkey" FOREIGN KEY ("hoc_vien_id") REFERENCES "hoc_vien"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
