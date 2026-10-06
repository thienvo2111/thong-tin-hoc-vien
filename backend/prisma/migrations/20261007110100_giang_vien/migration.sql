-- T11 (issue #3) + ADR 0004 (G1/G12, 2026-10-07): danh mục giảng viên và
-- phân công giảng viên vào từng buổi học. lop_hoc_nhan_su giữ nguyên.
CREATE TABLE "giang_vien" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ho_ten" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "so_dien_thoai" VARCHAR(20) NOT NULL,
    "don_vi_cong_tac" VARCHAR(255),
    "ghi_chu" TEXT,
    "trang_thai" "trang_thai_active" NOT NULL DEFAULT 'active',
    "tao_boi" UUID,
    "nguon_import_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "giang_vien_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_giang_vien_email" ON "giang_vien"("email");
CREATE UNIQUE INDEX "uq_giang_vien_sdt" ON "giang_vien"("so_dien_thoai");

ALTER TABLE "giang_vien" ADD CONSTRAINT "giang_vien_tao_boi_fkey"
    FOREIGN KEY ("tao_boi") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "giang_vien" ADD CONSTRAINT "giang_vien_nguon_import_id_fkey"
    FOREIGN KEY ("nguon_import_id") REFERENCES "nhat_ky_import"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE TABLE "phan_cong_giang_day" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lich_hoc_id" UUID NOT NULL,
    "giang_vien_id" UUID NOT NULL,
    "vai_tro" "vai_tro_nhan_su_lop" NOT NULL,
    "so_gio" DECIMAL(4,1),
    "da_xac_nhan_gio" BOOLEAN NOT NULL DEFAULT false,
    "xac_nhan_luc" TIMESTAMPTZ(6),
    "nguoi_xac_nhan_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phan_cong_giang_day_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_phan_cong_so_gio" CHECK ("so_gio" IS NULL OR "so_gio" > 0),
    CONSTRAINT "chk_phan_cong_xac_nhan" CHECK (
        ("da_xac_nhan_gio" AND "xac_nhan_luc" IS NOT NULL AND "nguoi_xac_nhan_id" IS NOT NULL)
        OR NOT "da_xac_nhan_gio")
);

CREATE UNIQUE INDEX "uq_phan_cong" ON "phan_cong_giang_day"("lich_hoc_id", "giang_vien_id");
CREATE INDEX "idx_phan_cong_gv" ON "phan_cong_giang_day"("giang_vien_id");

ALTER TABLE "phan_cong_giang_day" ADD CONSTRAINT "phan_cong_giang_day_lich_hoc_id_fkey"
    FOREIGN KEY ("lich_hoc_id") REFERENCES "lich_hoc_lop"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "phan_cong_giang_day" ADD CONSTRAINT "phan_cong_giang_day_giang_vien_id_fkey"
    FOREIGN KEY ("giang_vien_id") REFERENCES "giang_vien"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "phan_cong_giang_day" ADD CONSTRAINT "phan_cong_giang_day_nguoi_xac_nhan_id_fkey"
    FOREIGN KEY ("nguoi_xac_nhan_id") REFERENCES "nguoi_dung"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
