-- ADR 0003 (2026-10-06): phân công người hỗ trợ học viên vào cụm (nhiều–nhiều).
CREATE TABLE "phan_cong_ho_tro" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nguoi_dung_id" UUID NOT NULL,
    "cum_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phan_cong_ho_tro_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_phan_cong_ho_tro" ON "phan_cong_ho_tro"("nguoi_dung_id", "cum_id");
CREATE INDEX "idx_phan_cong_ho_tro_cum" ON "phan_cong_ho_tro"("cum_id");

ALTER TABLE "phan_cong_ho_tro" ADD CONSTRAINT "phan_cong_ho_tro_nguoi_dung_id_fkey"
    FOREIGN KEY ("nguoi_dung_id") REFERENCES "nguoi_dung"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "phan_cong_ho_tro" ADD CONSTRAINT "phan_cong_ho_tro_cum_id_fkey"
    FOREIGN KEY ("cum_id") REFERENCES "cum_hoc_vien"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Người hỗ trợ học viên là cán bộ HCMUE: không gắn đơn vị/hồ sơ học viên
-- (thêm nhánh vào chk_nguoi_dung_scope) và luôn có email.
ALTER TABLE "nguoi_dung" DROP CONSTRAINT "chk_nguoi_dung_scope";
ALTER TABLE "nguoi_dung" ADD CONSTRAINT "chk_nguoi_dung_scope" CHECK (
    (vai_tro = 'hoc_vien' AND don_vi_id IS NULL AND hoc_vien_id IS NOT NULL)
    OR
    (vai_tro = 'quan_tri' AND hoc_vien_id IS NULL)
    OR
    (vai_tro = 'ho_tro_hoc_vien' AND don_vi_id IS NULL AND hoc_vien_id IS NULL)
    OR
    (vai_tro NOT IN ('hoc_vien', 'quan_tri', 'ho_tro_hoc_vien') AND don_vi_id IS NOT NULL AND hoc_vien_id IS NULL)
);

ALTER TABLE "nguoi_dung" DROP CONSTRAINT "chk_nguoi_dung_email_bat_buoc";
ALTER TABLE "nguoi_dung" ADD CONSTRAINT "chk_nguoi_dung_email_bat_buoc"
    CHECK ("vai_tro" NOT IN ('quan_tri', 'ho_tro_hoc_vien') OR "email" IS NOT NULL);
