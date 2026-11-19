-- ADR 0015 M3/M6/S1/S3/T7 (issue #58): Danh sách tham gia của Cổng đơn vị.
-- Chỉ thêm (1 enum, 1 bảng, index, FK, CHECK) — không đụng bảng/dữ liệu cũ.
-- GV HSG KHÔNG ghi vào hoc_vien; hoc_vien_id NULL được, xóa hồ sơ → SET NULL.

-- CreateEnum
CREATE TYPE "giai_doan_tham_gia" AS ENUM ('ca_hai', 'chi_gd1', 'chi_gd2');

-- CreateTable
CREATE TABLE "danh_sach_tham_gia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dot_trien_khai_id" UUID NOT NULL,
    "don_vi_id" UUID NOT NULL,
    "ho_ten" VARCHAR(255) NOT NULL,
    "ngay_sinh" DATE,
    "gioi_tinh" VARCHAR(20),
    "ma_goc" VARCHAR(50),
    "lop" VARCHAR(100),
    "giai_doan" "giai_doan_tham_gia" NOT NULL DEFAULT 'ca_hai',
    "ty_le_suat" DECIMAL(2,1) NOT NULL,
    "ghi_chu" TEXT,
    "y_kien_truong" TEXT,
    "hoc_vien_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "danh_sach_tham_gia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_ds_tham_gia_dot_don_vi" ON "danh_sach_tham_gia"("dot_trien_khai_id", "don_vi_id");

-- CreateIndex
CREATE INDEX "idx_ds_tham_gia_hoc_vien" ON "danh_sach_tham_gia"("hoc_vien_id");

-- AddForeignKey
ALTER TABLE "danh_sach_tham_gia" ADD CONSTRAINT "danh_sach_tham_gia_dot_trien_khai_id_fkey" FOREIGN KEY ("dot_trien_khai_id") REFERENCES "dot_trien_khai"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "danh_sach_tham_gia" ADD CONSTRAINT "danh_sach_tham_gia_don_vi_id_fkey" FOREIGN KEY ("don_vi_id") REFERENCES "don_vi_cong_tac"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "danh_sach_tham_gia" ADD CONSTRAINT "danh_sach_tham_gia_hoc_vien_id_fkey" FOREIGN KEY ("hoc_vien_id") REFERENCES "hoc_vien"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "danh_sach_tham_gia" ADD CONSTRAINT "danh_sach_tham_gia_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "nguoi_dung"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Raw SQL bổ sung (không biểu diễn được bằng Prisma DSL) — ADR 0015 S1: 1 suất hoặc 0,5 suất.
ALTER TABLE "danh_sach_tham_gia" ADD CONSTRAINT "chk_ds_tham_gia_ty_le_suat" CHECK ("ty_le_suat" IN (0.5, 1.0));
