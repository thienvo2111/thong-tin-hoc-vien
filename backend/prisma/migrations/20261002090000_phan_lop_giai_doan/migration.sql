-- Phân lớp theo giai đoạn (spec 2026-10-02-phan-lop-theo-giai-doan): bảng
-- phan_lop_giai_doan (1 lớp mỗi đăng ký mỗi giai đoạn) + 2 cột thông tin chung
-- của giai đoạn. Prisma tự sinh 4 câu DROP INDEX cho GIN trgm index (tạo bằng
-- raw SQL ngoài schema) — ĐÃ GỠ, xem 20260928065926_t14_loai_dot_xac_nhan_enum.

-- AlterTable
ALTER TABLE "giai_doan_khoa" ADD COLUMN     "huong_dan" TEXT,
ADD COLUMN     "link_hoac_dia_diem" VARCHAR(500);

-- CreateTable
CREATE TABLE "phan_lop_giai_doan" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dang_ky_hoc_id" UUID NOT NULL,
    "giai_doan_id" UUID NOT NULL,
    "lop_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phan_lop_giai_doan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_phan_lop_giai_doan_lop" ON "phan_lop_giai_doan"("lop_id");

-- CreateIndex
CREATE INDEX "idx_phan_lop_giai_doan_giai_doan" ON "phan_lop_giai_doan"("giai_doan_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_phan_lop_giai_doan" ON "phan_lop_giai_doan"("dang_ky_hoc_id", "giai_doan_id");

-- AddForeignKey
ALTER TABLE "phan_lop_giai_doan" ADD CONSTRAINT "phan_lop_giai_doan_dang_ky_hoc_id_fkey" FOREIGN KEY ("dang_ky_hoc_id") REFERENCES "dang_ky_hoc"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "phan_lop_giai_doan" ADD CONSTRAINT "phan_lop_giai_doan_giai_doan_id_fkey" FOREIGN KEY ("giai_doan_id") REFERENCES "giai_doan_khoa"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "phan_lop_giai_doan" ADD CONSTRAINT "phan_lop_giai_doan_lop_id_fkey" FOREIGN KEY ("lop_id") REFERENCES "lop_hoc"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
