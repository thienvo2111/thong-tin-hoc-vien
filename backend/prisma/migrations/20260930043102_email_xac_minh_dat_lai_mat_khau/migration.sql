-- Không đại diện trong schema.prisma (xem comment đầu file): GIN trgm index
-- idx_dia_danh_ten_trgm, idx_don_vi_ten_trgm, idx_hoc_vien_ho_ten_trgm,
-- idx_hoc_vien_chuyen_mon_trgm được thêm bằng raw SQL ở migration init và
-- PHẢI giữ nguyên — `prisma migrate dev` sinh DROP INDEX cho cả 4 vì không
-- thấy chúng trong schema; đã bỏ các DROP INDEX đó khỏi migration này (cùng
-- cách xử lý với migration 20260928010120_add_token_thu_hoi).

-- CreateEnum
CREATE TYPE "loai_token_xac_thuc" AS ENUM ('xac_minh_email', 'dat_lai_mat_khau');

-- AlterTable
ALTER TABLE "hoc_vien" ADD COLUMN     "email_da_xac_minh" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "token_xac_thuc" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hoc_vien_id" UUID NOT NULL,
    "loai" "loai_token_xac_thuc" NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "het_han_luc" TIMESTAMPTZ(6) NOT NULL,
    "da_dung_luc" TIMESTAMPTZ(6),
    "tao_luc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_xac_thuc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_token_xac_thuc_hash" ON "token_xac_thuc"("token_hash");

-- CreateIndex
CREATE INDEX "idx_token_xac_thuc_hoc_vien" ON "token_xac_thuc"("hoc_vien_id");

-- AddForeignKey
ALTER TABLE "token_xac_thuc" ADD CONSTRAINT "token_xac_thuc_hoc_vien_id_fkey" FOREIGN KEY ("hoc_vien_id") REFERENCES "hoc_vien"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
