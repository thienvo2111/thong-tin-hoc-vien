-- Prisma tự sinh 4 câu "DROP INDEX" ở đây cho các GIN trgm index (tạo bằng
-- raw SQL, ngoài schema.prisma DSL) — ĐÃ GỠ BỎ, xem gotcha đã biết ở
-- migration 20260928065926_t14_loai_dot_xac_nhan_enum.

-- CreateTable
CREATE TABLE "dot_xac_nhan" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "khoa_id" UUID,
    "ten" VARCHAR(255) NOT NULL,
    "loai" "loai_dot_xac_nhan" NOT NULL,
    "mo_luc" TIMESTAMPTZ(6) NOT NULL,
    "dong_luc" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dot_xac_nhan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xac_nhan_ho_so" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dot_id" UUID NOT NULL,
    "hoc_vien_id" UUID NOT NULL,
    "xac_nhan_luc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "du_lieu" JSONB NOT NULL,
    "con_hieu_luc" BOOLEAN NOT NULL DEFAULT true,
    "vo_hieu_luc_luc" TIMESTAMPTZ(6),

    CONSTRAINT "xac_nhan_ho_so_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lich_su_thay_doi_ho_so" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hoc_vien_id" UUID NOT NULL,
    "truong" VARCHAR(64) NOT NULL,
    "gia_tri_cu" TEXT,
    "gia_tri_moi" TEXT,
    "la_truong_goc_moet" BOOLEAN NOT NULL DEFAULT false,
    "nguoi_sua_id" UUID NOT NULL,
    "vai_tro_nguoi_sua" "vai_tro_nguoi_dung" NOT NULL,
    "dot_id" UUID,
    "sua_luc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lich_su_thay_doi_ho_so_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_dot_xac_nhan_khoa" ON "dot_xac_nhan"("khoa_id");

-- CreateIndex
CREATE INDEX "idx_xac_nhan_hv" ON "xac_nhan_ho_so"("hoc_vien_id");

-- CreateIndex
CREATE INDEX "idx_xac_nhan_dot" ON "xac_nhan_ho_so"("dot_id");

-- CreateIndex
CREATE INDEX "idx_lich_su_hv" ON "lich_su_thay_doi_ho_so"("hoc_vien_id");

-- AddForeignKey
ALTER TABLE "dot_xac_nhan" ADD CONSTRAINT "dot_xac_nhan_khoa_id_fkey" FOREIGN KEY ("khoa_id") REFERENCES "khoa_boi_duong"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dot_xac_nhan" ADD CONSTRAINT "dot_xac_nhan_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "nguoi_dung"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "xac_nhan_ho_so" ADD CONSTRAINT "xac_nhan_ho_so_dot_id_fkey" FOREIGN KEY ("dot_id") REFERENCES "dot_xac_nhan"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "xac_nhan_ho_so" ADD CONSTRAINT "xac_nhan_ho_so_hoc_vien_id_fkey" FOREIGN KEY ("hoc_vien_id") REFERENCES "hoc_vien"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lich_su_thay_doi_ho_so" ADD CONSTRAINT "lich_su_thay_doi_ho_so_hoc_vien_id_fkey" FOREIGN KEY ("hoc_vien_id") REFERENCES "hoc_vien"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lich_su_thay_doi_ho_so" ADD CONSTRAINT "lich_su_thay_doi_ho_so_nguoi_sua_id_fkey" FOREIGN KEY ("nguoi_sua_id") REFERENCES "nguoi_dung"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lich_su_thay_doi_ho_so" ADD CONSTRAINT "lich_su_thay_doi_ho_so_dot_id_fkey" FOREIGN KEY ("dot_id") REFERENCES "dot_xac_nhan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Raw SQL bổ sung (không biểu diễn được bằng Prisma schema DSL) — xem
-- docs/mo-rong-nls-an-giang.md mục T14 cho định nghĩa gốc.
ALTER TABLE "dot_xac_nhan"
    ADD CONSTRAINT "chk_dot_xac_nhan_thoi_gian" CHECK ("dong_luc" > "mo_luc");

ALTER TABLE "xac_nhan_ho_so"
    ADD CONSTRAINT "chk_xac_nhan_hieu_luc" CHECK ("con_hieu_luc" OR "vo_hieu_luc_luc" IS NOT NULL);

-- 1 xác nhận CÒN HIỆU LỰC cho mỗi (dot_id, hoc_vien_id) — sửa hồ sơ sau khi
-- đã xác nhận sẽ set con_hieu_luc=false cho dòng cũ TRƯỚC khi tạo dòng mới
-- (xem DotXacNhanService), nên unique index có điều kiện này không bao giờ
-- xung đột trong luồng bình thường.
CREATE UNIQUE INDEX "uq_xac_nhan_con_hieu_luc" ON "xac_nhan_ho_so"("dot_id", "hoc_vien_id") WHERE "con_hieu_luc";

-- Lọc nhanh cho GET /bao-cao/sua-truong-moet (chỉ quan tâm thay đổi trường
-- gốc MOET để N1 rà soát).
CREATE INDEX "idx_lich_su_goc_moet" ON "lich_su_thay_doi_ho_so"("la_truong_goc_moet") WHERE "la_truong_goc_moet";
