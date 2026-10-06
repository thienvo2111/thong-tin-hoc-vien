-- ADR 0004 G4/G5 (issue #16, 2026-10-07): hậu cần giảng viên theo đợt (lớp ×
-- giai đoạn) và người hỗ trợ thực địa theo đợt – lớp (không tài khoản).
CREATE TABLE "hau_can_giang_vien" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lop_id" UUID NOT NULL,
    "giai_doan_id" UUID NOT NULL,
    "giang_vien_id" UUID NOT NULL,
    "noi_o_ten" VARCHAR(255),
    "noi_o_dia_chi" VARCHAR(500),
    "nhan_phong" DATE,
    "tra_phong" DATE,
    "phuong_tien" VARCHAR(255),
    "don_luc" TIMESTAMPTZ(6),
    "diem_don" VARCHAR(500),
    "lien_he_don" VARCHAR(255),
    "ghi_chu" TEXT,
    "da_xac_nhan_noi_o" BOOLEAN NOT NULL DEFAULT false,
    "da_xac_nhan_di_chuyen" BOOLEAN NOT NULL DEFAULT false,
    "cap_nhat_boi" UUID,
    "cap_nhat_luc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hau_can_giang_vien_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_hau_can_ngay" CHECK ("tra_phong" IS NULL OR "nhan_phong" IS NULL OR "tra_phong" >= "nhan_phong")
);
CREATE UNIQUE INDEX "uq_hau_can_gv" ON "hau_can_giang_vien"("lop_id", "giai_doan_id", "giang_vien_id");
ALTER TABLE "hau_can_giang_vien" ADD CONSTRAINT "hau_can_giang_vien_lop_id_fkey"
    FOREIGN KEY ("lop_id") REFERENCES "lop_hoc"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "hau_can_giang_vien" ADD CONSTRAINT "hau_can_giang_vien_giai_doan_id_fkey"
    FOREIGN KEY ("giai_doan_id") REFERENCES "giai_doan_khoa"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "hau_can_giang_vien" ADD CONSTRAINT "hau_can_giang_vien_giang_vien_id_fkey"
    FOREIGN KEY ("giang_vien_id") REFERENCES "giang_vien"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "hau_can_giang_vien" ADD CONSTRAINT "hau_can_giang_vien_cap_nhat_boi_fkey"
    FOREIGN KEY ("cap_nhat_boi") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE TABLE "nhan_su_thuc_dia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lop_id" UUID NOT NULL,
    "giai_doan_id" UUID NOT NULL,
    "ho_ten" VARCHAR(255) NOT NULL,
    "so_dien_thoai" VARCHAR(20) NOT NULL,
    "nhiem_vu" VARCHAR(255),
    "ghi_chu" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nhan_su_thuc_dia_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_thuc_dia_dot" ON "nhan_su_thuc_dia"("lop_id", "giai_doan_id");
ALTER TABLE "nhan_su_thuc_dia" ADD CONSTRAINT "nhan_su_thuc_dia_lop_id_fkey"
    FOREIGN KEY ("lop_id") REFERENCES "lop_hoc"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "nhan_su_thuc_dia" ADD CONSTRAINT "nhan_su_thuc_dia_giai_doan_id_fkey"
    FOREIGN KEY ("giai_doan_id") REFERENCES "giai_doan_khoa"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
