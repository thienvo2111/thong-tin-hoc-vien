-- Bỏ 4 DROP INDEX mà `prisma migrate dev` tự sinh (nhắm vào GIN trgm index
-- chỉ tồn tại dưới dạng raw SQL, không khai báo trong schema.prisma) — cùng
-- gotcha đã ghi trong README.md gốc repo, mục "Gotcha khi thêm migration mới".

-- CreateTable
CREATE TABLE "nhat_ky_dat_lai_mat_khau" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nguoi_dung_id" UUID NOT NULL,
    "thuc_hien_boi" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nhat_ky_dat_lai_mat_khau_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_nhat_ky_dlmk_nguoi_dung" ON "nhat_ky_dat_lai_mat_khau"("nguoi_dung_id");

-- AddForeignKey
ALTER TABLE "nhat_ky_dat_lai_mat_khau" ADD CONSTRAINT "nhat_ky_dat_lai_mat_khau_nguoi_dung_id_fkey" FOREIGN KEY ("nguoi_dung_id") REFERENCES "nguoi_dung"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nhat_ky_dat_lai_mat_khau" ADD CONSTRAINT "nhat_ky_dat_lai_mat_khau_thuc_hien_boi_fkey" FOREIGN KEY ("thuc_hien_boi") REFERENCES "nguoi_dung"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
