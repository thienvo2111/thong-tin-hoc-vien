-- Không đại diện trong schema.prisma (xem comment đầu file): GIN trgm index
-- idx_dia_danh_ten_trgm, idx_don_vi_ten_trgm, idx_hoc_vien_ho_ten_trgm,
-- idx_hoc_vien_chuyen_mon_trgm được thêm bằng raw SQL ở migration init và
-- PHẢI giữ nguyên — `prisma migrate dev` sinh DROP INDEX cho cả 4 vì không
-- thấy chúng trong schema; đã bỏ các DROP INDEX đó khỏi migration này.

-- AlterTable
ALTER TABLE "khoa_boi_duong" ADD COLUMN     "created_by" UUID;

-- CreateTable
CREATE TABLE "token_thu_hoi" (
    "jti" UUID NOT NULL,
    "nguoi_dung_id" UUID NOT NULL,
    "het_han" TIMESTAMPTZ(6) NOT NULL,
    "thu_hoi_luc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_thu_hoi_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE INDEX "idx_token_thu_hoi_nguoi_dung" ON "token_thu_hoi"("nguoi_dung_id");

-- CreateIndex
CREATE INDEX "idx_token_thu_hoi_het_han" ON "token_thu_hoi"("het_han");

-- AddForeignKey
ALTER TABLE "token_thu_hoi" ADD CONSTRAINT "token_thu_hoi_nguoi_dung_id_fkey" FOREIGN KEY ("nguoi_dung_id") REFERENCES "nguoi_dung"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "khoa_boi_duong" ADD CONSTRAINT "khoa_boi_duong_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "nguoi_dung"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
