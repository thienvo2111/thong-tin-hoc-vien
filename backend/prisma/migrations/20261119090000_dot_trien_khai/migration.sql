-- ADR 0015 M1/M2/S4/S6/T1 (issue #56): đợt triển khai của Cổng đơn vị.
-- Chỉ thêm (1 enum, 1 bảng, index, FK, CHECK) — không đụng bảng/dữ liệu cũ.

-- CreateEnum
CREATE TYPE "chuong_trinh_boi_duong" AS ENUM ('nls', 'hsg');

-- CreateTable
CREATE TABLE "dot_trien_khai" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chuong_trinh" "chuong_trinh_boi_duong" NOT NULL,
    "ten" VARCHAR(255) NOT NULL,
    "don_gia" INTEGER,
    "ngay_qd_tu" DATE,
    "ngay_qd_den" DATE,
    "han_nop" TIMESTAMPTZ(6) NOT NULL,
    "so_gddt_id" UUID NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dot_trien_khai_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_dot_trien_khai_chuong_trinh" ON "dot_trien_khai"("chuong_trinh");

-- CreateIndex
CREATE INDEX "idx_dot_trien_khai_so_gddt" ON "dot_trien_khai"("so_gddt_id");

-- AddForeignKey
ALTER TABLE "dot_trien_khai" ADD CONSTRAINT "dot_trien_khai_so_gddt_id_fkey" FOREIGN KEY ("so_gddt_id") REFERENCES "don_vi_cong_tac"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dot_trien_khai" ADD CONSTRAINT "dot_trien_khai_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "nguoi_dung"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Raw SQL bổ sung (không biểu diễn được bằng Prisma DSL)
ALTER TABLE "dot_trien_khai" ADD CONSTRAINT "chk_dot_trien_khai_don_gia" CHECK ("don_gia" IS NULL OR "don_gia" >= 0);
ALTER TABLE "dot_trien_khai" ADD CONSTRAINT "chk_dot_trien_khai_ngay_qd" CHECK (
  ("ngay_qd_tu" IS NULL AND "ngay_qd_den" IS NULL)
  OR ("ngay_qd_tu" IS NOT NULL AND "ngay_qd_den" IS NOT NULL AND "ngay_qd_den" >= "ngay_qd_tu"));
