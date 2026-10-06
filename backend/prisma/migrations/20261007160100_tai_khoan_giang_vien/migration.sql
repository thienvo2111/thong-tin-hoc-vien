-- ADR 0004 G8 (issue #20): tài khoản giảng viên gắn 1–1 với hồ sơ giang_vien.
ALTER TABLE "nguoi_dung" ADD COLUMN "giang_vien_id" UUID;
CREATE UNIQUE INDEX "uq_nguoi_dung_giang_vien" ON "nguoi_dung"("giang_vien_id");
ALTER TABLE "nguoi_dung" ADD CONSTRAINT "fk_nguoi_dung_giang_vien"
    FOREIGN KEY ("giang_vien_id") REFERENCES "giang_vien"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- vai trò giang_vien ⇔ có giang_vien_id; không gắn đơn vị/hồ sơ học viên; luôn có email.
ALTER TABLE "nguoi_dung" ADD CONSTRAINT "chk_nguoi_dung_giang_vien"
    CHECK (("vai_tro" = 'giang_vien') = ("giang_vien_id" IS NOT NULL));

ALTER TABLE "nguoi_dung" DROP CONSTRAINT "chk_nguoi_dung_scope";
ALTER TABLE "nguoi_dung" ADD CONSTRAINT "chk_nguoi_dung_scope" CHECK (
    (vai_tro = 'hoc_vien' AND don_vi_id IS NULL AND hoc_vien_id IS NOT NULL)
    OR
    (vai_tro = 'quan_tri' AND hoc_vien_id IS NULL)
    OR
    (vai_tro IN ('ho_tro_hoc_vien', 'ho_tro_giang_vien', 'giang_vien') AND don_vi_id IS NULL AND hoc_vien_id IS NULL)
    OR
    (vai_tro NOT IN ('hoc_vien', 'quan_tri', 'ho_tro_hoc_vien', 'ho_tro_giang_vien', 'giang_vien') AND don_vi_id IS NOT NULL AND hoc_vien_id IS NULL)
);

ALTER TABLE "nguoi_dung" DROP CONSTRAINT "chk_nguoi_dung_email_bat_buoc";
ALTER TABLE "nguoi_dung" ADD CONSTRAINT "chk_nguoi_dung_email_bat_buoc"
    CHECK ("vai_tro" NOT IN ('quan_tri', 'ho_tro_hoc_vien', 'ho_tro_giang_vien', 'giang_vien') OR "email" IS NOT NULL);

-- Bảng kiểm mặc định: quy tắc giang_vien_co_tai_khoan nay đọc tài khoản thật.
UPDATE "muc_kiem_tra" SET "ten" = 'Giảng viên đã được cấp tài khoản'
WHERE "khoa_id" IS NULL AND "ma_quy_tac" = 'giang_vien_co_tai_khoan';
