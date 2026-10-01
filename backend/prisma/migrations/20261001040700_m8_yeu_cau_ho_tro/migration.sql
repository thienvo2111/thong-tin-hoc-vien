-- CreateEnum
CREATE TYPE "trang_thai_yeu_cau_ho_tro" AS ENUM ('cho_xu_ly', 'da_phan_hoi', 'da_dong');

-- CreateEnum
CREATE TYPE "danh_gia_yeu_cau_ho_tro" AS ENUM ('hai_long', 'chua_hai_long');

-- CreateTable
CREATE TABLE "loai_van_de_ho_tro" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ten" VARCHAR(255) NOT NULL,
    "noi_dung_goi_y" TEXT NOT NULL,
    "trang_thai" "trang_thai_active" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loai_van_de_ho_tro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yeu_cau_ho_tro" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hoc_vien_id" UUID NOT NULL,
    "loai_van_de_id" UUID NOT NULL,
    "noi_dung_hoi" TEXT NOT NULL,
    "noi_dung_tra_loi" TEXT,
    "trang_thai" "trang_thai_yeu_cau_ho_tro" NOT NULL DEFAULT 'cho_xu_ly',
    "danh_gia" "danh_gia_yeu_cau_ho_tro",
    "tra_loi_boi" UUID,
    "thoi_gian_tao" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "thoi_gian_phan_hoi" TIMESTAMPTZ(6),
    "thoi_gian_dong" TIMESTAMPTZ(6),

    CONSTRAINT "yeu_cau_ho_tro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_loai_van_de_ho_tro_ten" ON "loai_van_de_ho_tro"("ten");

-- CreateIndex
CREATE INDEX "idx_yeu_cau_ho_tro_trang_thai" ON "yeu_cau_ho_tro"("trang_thai");

-- CreateIndex
CREATE INDEX "idx_yeu_cau_ho_tro_hoc_vien" ON "yeu_cau_ho_tro"("hoc_vien_id");

-- CreateIndex
CREATE INDEX "idx_yeu_cau_ho_tro_loai_trang_thai" ON "yeu_cau_ho_tro"("loai_van_de_id", "trang_thai");

-- AddForeignKey
ALTER TABLE "yeu_cau_ho_tro" ADD CONSTRAINT "yeu_cau_ho_tro_hoc_vien_id_fkey" FOREIGN KEY ("hoc_vien_id") REFERENCES "hoc_vien"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "yeu_cau_ho_tro" ADD CONSTRAINT "yeu_cau_ho_tro_loai_van_de_id_fkey" FOREIGN KEY ("loai_van_de_id") REFERENCES "loai_van_de_ho_tro"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "yeu_cau_ho_tro" ADD CONSTRAINT "yeu_cau_ho_tro_tra_loi_boi_fkey" FOREIGN KEY ("tra_loi_boi") REFERENCES "nguoi_dung"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
