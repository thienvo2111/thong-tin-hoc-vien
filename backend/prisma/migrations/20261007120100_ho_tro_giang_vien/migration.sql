-- ADR 0004 G3 (issue #14): nhóm hỗ trợ giảng viên theo KHÓA (nhiều–nhiều).
-- Chỉ HoTroGiangVienScopeService đọc bảng này (điểm mở rộng thu hẹp về lớp).
CREATE TABLE "phan_cong_ho_tro_gv" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nguoi_dung_id" UUID NOT NULL,
    "khoa_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phan_cong_ho_tro_gv_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_phan_cong_ho_tro_gv" ON "phan_cong_ho_tro_gv"("nguoi_dung_id", "khoa_id");
CREATE INDEX "idx_phan_cong_ho_tro_gv_khoa" ON "phan_cong_ho_tro_gv"("khoa_id");

ALTER TABLE "phan_cong_ho_tro_gv" ADD CONSTRAINT "phan_cong_ho_tro_gv_nguoi_dung_id_fkey"
    FOREIGN KEY ("nguoi_dung_id") REFERENCES "nguoi_dung"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "phan_cong_ho_tro_gv" ADD CONSTRAINT "phan_cong_ho_tro_gv_khoa_id_fkey"
    FOREIGN KEY ("khoa_id") REFERENCES "khoa_boi_duong"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Cán bộ HCMUE: không gắn đơn vị/hồ sơ học viên, luôn có email (như ho_tro_hoc_vien).
ALTER TABLE "nguoi_dung" DROP CONSTRAINT "chk_nguoi_dung_scope";
ALTER TABLE "nguoi_dung" ADD CONSTRAINT "chk_nguoi_dung_scope" CHECK (
    (vai_tro = 'hoc_vien' AND don_vi_id IS NULL AND hoc_vien_id IS NOT NULL)
    OR
    (vai_tro = 'quan_tri' AND hoc_vien_id IS NULL)
    OR
    (vai_tro IN ('ho_tro_hoc_vien', 'ho_tro_giang_vien') AND don_vi_id IS NULL AND hoc_vien_id IS NULL)
    OR
    (vai_tro NOT IN ('hoc_vien', 'quan_tri', 'ho_tro_hoc_vien', 'ho_tro_giang_vien') AND don_vi_id IS NOT NULL AND hoc_vien_id IS NULL)
);

ALTER TABLE "nguoi_dung" DROP CONSTRAINT "chk_nguoi_dung_email_bat_buoc";
ALTER TABLE "nguoi_dung" ADD CONSTRAINT "chk_nguoi_dung_email_bat_buoc"
    CHECK ("vai_tro" NOT IN ('quan_tri', 'ho_tro_hoc_vien', 'ho_tro_giang_vien') OR "email" IS NOT NULL);
