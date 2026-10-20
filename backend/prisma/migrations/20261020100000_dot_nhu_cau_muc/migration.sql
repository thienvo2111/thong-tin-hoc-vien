-- ADR 0013: đợt nhu cầu mức học. Chỉ thêm (1 enum, 2 bảng, index, FK, CHECK).

-- CreateEnum
CREATE TYPE "nguon_moc_nhu_cau" AS ENUM ('lop', 'muc_chot');

-- CreateTable
CREATE TABLE "dot_nhu_cau_muc" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "khoa_id" UUID NOT NULL,
    "ten_dot" VARCHAR(255) NOT NULL,
    "mo_luc" TIMESTAMPTZ(6) NOT NULL,
    "dong_luc" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dot_nhu_cau_muc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nhu_cau_muc_hoc_vien" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dot_id" UUID NOT NULL,
    "dang_ky_hoc_id" UUID NOT NULL,
    "muc_chon" "muc_nang_luc" NOT NULL,
    "muc_moc" "muc_nang_luc" NOT NULL,
    "nguon_moc" "nguon_moc_nhu_cau" NOT NULL,
    "lop_id_luc_chon" UUID,
    "chon_luc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cap_nhat_luc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nhu_cau_muc_hoc_vien_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_dot_nhu_cau_muc_khoa" ON "dot_nhu_cau_muc"("khoa_id");

-- CreateIndex
CREATE INDEX "idx_nhu_cau_muc_dang_ky" ON "nhu_cau_muc_hoc_vien"("dang_ky_hoc_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_nhu_cau_muc_dot_dang_ky" ON "nhu_cau_muc_hoc_vien"("dot_id", "dang_ky_hoc_id");

-- AddForeignKey
ALTER TABLE "dot_nhu_cau_muc" ADD CONSTRAINT "dot_nhu_cau_muc_khoa_id_fkey" FOREIGN KEY ("khoa_id") REFERENCES "khoa_boi_duong"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dot_nhu_cau_muc" ADD CONSTRAINT "dot_nhu_cau_muc_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "nguoi_dung"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nhu_cau_muc_hoc_vien" ADD CONSTRAINT "nhu_cau_muc_hoc_vien_dot_id_fkey" FOREIGN KEY ("dot_id") REFERENCES "dot_nhu_cau_muc"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nhu_cau_muc_hoc_vien" ADD CONSTRAINT "nhu_cau_muc_hoc_vien_dang_ky_hoc_id_fkey" FOREIGN KEY ("dang_ky_hoc_id") REFERENCES "dang_ky_hoc"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nhu_cau_muc_hoc_vien" ADD CONSTRAINT "nhu_cau_muc_hoc_vien_lop_id_luc_chon_fkey" FOREIGN KEY ("lop_id_luc_chon") REFERENCES "lop_hoc"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Raw SQL bổ sung (không biểu diễn được bằng Prisma DSL)
ALTER TABLE "dot_nhu_cau_muc" ADD CONSTRAINT "chk_dot_nhu_cau_muc_thoi_gian" CHECK ("dong_luc" > "mo_luc");
ALTER TABLE "nhu_cau_muc_hoc_vien" ADD CONSTRAINT "chk_nhu_cau_muc_chon_le_moc" CHECK (
  array_position(ARRAY['co_ban','thanh_thao','nang_cao']::muc_nang_luc[], "muc_chon")
  <= array_position(ARRAY['co_ban','thanh_thao','nang_cao']::muc_nang_luc[], "muc_moc"));
