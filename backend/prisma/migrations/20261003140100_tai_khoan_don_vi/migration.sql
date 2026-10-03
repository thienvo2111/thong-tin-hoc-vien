-- Tài khoản đơn vị (spec 2026-10-03-tai-khoan-don-vi-design.md §3.2, §3.4).

-- Token kích hoạt / đặt lại mật khẩu gắn với nguoi_dung (tài khoản đơn vị,
-- không có hồ sơ học viên) — mỗi token gắn đúng 1 chủ thể.
ALTER TABLE "token_xac_thuc" ALTER COLUMN "hoc_vien_id" DROP NOT NULL;
ALTER TABLE "token_xac_thuc" ADD COLUMN "nguoi_dung_id" UUID;
ALTER TABLE "token_xac_thuc" ADD CONSTRAINT "token_xac_thuc_nguoi_dung_id_fkey"
    FOREIGN KEY ("nguoi_dung_id") REFERENCES "nguoi_dung"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE INDEX "idx_token_xac_thuc_nguoi_dung" ON "token_xac_thuc"("nguoi_dung_id");
ALTER TABLE "token_xac_thuc" ADD CONSTRAINT "chk_token_xac_thuc_chu_the"
    CHECK (num_nonnulls("hoc_vien_id", "nguoi_dung_id") = 1);

-- 1 tài khoản / đơn vị cho 3 vai trò quản lý.
CREATE UNIQUE INDEX "uq_nguoi_dung_don_vi_quan_ly" ON "nguoi_dung"("don_vi_id")
    WHERE "vai_tro" IN ('so_gddt', 'phong_vhxh', 'truong');

-- Email không bắt buộc cho tài khoản đơn vị; chỉ quan_tri bắt buộc.
ALTER TABLE "nguoi_dung" DROP CONSTRAINT "chk_nguoi_dung_email_bat_buoc";
ALTER TABLE "nguoi_dung" ADD CONSTRAINT "chk_nguoi_dung_email_bat_buoc"
    CHECK ("vai_tro" <> 'quan_tri' OR "email" IS NOT NULL);
