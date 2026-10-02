-- SSO sang hệ thống khảo sát + trường "Đối tượng" của học viên (2026-10-02).
-- Viết tay, KHÔNG để Prisma sinh kèm các câu DROP INDEX cho GIN trgm index
-- (xem gotcha ở migration 20260928065926_t14_loai_dot_xac_nhan_enum).

-- CreateEnum
CREATE TYPE "doi_tuong_hoc_vien" AS ENUM ('giao_vien', 'can_bo_quan_ly');

-- AlterTable: NULL = học viên chưa chọn (hồ sơ cũ) -> chưa "đầy đủ"
ALTER TABLE "hoc_vien" ADD COLUMN "doi_tuong" "doi_tuong_hoc_vien";

-- CreateTable
CREATE TABLE "ma_sso_mot_lan" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ma_hash" CHAR(64) NOT NULL,
    "hoc_vien_id" UUID NOT NULL,
    "target" VARCHAR(20),
    "het_han" TIMESTAMPTZ(6) NOT NULL,
    "da_dung_luc" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ma_sso_mot_lan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_ma_sso_hash" ON "ma_sso_mot_lan"("ma_hash");
CREATE INDEX "idx_ma_sso_hoc_vien" ON "ma_sso_mot_lan"("hoc_vien_id");

ALTER TABLE "ma_sso_mot_lan" ADD CONSTRAINT "ma_sso_mot_lan_hoc_vien_id_fkey" FOREIGN KEY ("hoc_vien_id") REFERENCES "hoc_vien"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
