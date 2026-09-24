-- =====================================================================
-- Migration khởi tạo — dịch nguyên trạng từ docs/database-ddl.sql
-- (nguồn sự thật cho data model). Phần "CreateEnum/CreateTable/CreateIndex/
-- AddForeignKey" bên dưới do `prisma migrate diff` sinh từ prisma/schema.prisma.
-- Phần "Raw SQL bổ sung" ở cuối file chứa những gì Prisma schema DSL không
-- biểu diễn được: extension, CHECK constraint, GIN trgm index, trigger —
-- chép nguyên văn từ docs/database-ddl.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensions (phải chạy trước vì gen_random_uuid() dùng làm column default
-- và gin_trgm_ops dùng ở các index cuối file)
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "cap_dia_danh" AS ENUM ('tinh_thanh', 'phuong_xa_dac_khu');

-- CreateEnum
CREATE TYPE "loai_don_vi" AS ENUM ('so_gddt', 'phong_vhxh', 'truong', 'khac');

-- CreateEnum
CREATE TYPE "cap_hoc" AS ENUM ('mam_non', 'tieu_hoc', 'thcs', 'thpt');

-- CreateEnum
CREATE TYPE "trang_thai_active" AS ENUM ('active', 'ngung');

-- CreateEnum
CREATE TYPE "vai_tro_nguoi_dung" AS ENUM ('so_gddt', 'phong_vhxh', 'truong', 'hoc_vien', 'quan_tri');

-- CreateEnum
CREATE TYPE "trinh_do_chuyen_mon" AS ENUM ('trung_cap', 'cao_dang', 'dai_hoc', 'thac_si', 'tien_si', 'khac');

-- CreateEnum
CREATE TYPE "trang_thai_ho_so" AS ENUM ('nhap', 'cho_duyet', 'da_duyet', 'tu_choi', 'loi');

-- CreateEnum
CREATE TYPE "trang_thai_khoa" AS ENUM ('nhap', 'cho_duyet', 'da_duyet', 'tu_choi', 'dong_dang_ky');

-- CreateEnum
CREATE TYPE "hinh_thuc_giai_doan" AS ENUM ('truc_tiep', 'truc_tuyen', 'danh_gia', 'khac');

-- CreateEnum
CREATE TYPE "trang_thai_lich_hoc" AS ENUM ('chua_dien_ra', 'dang_dien_ra', 'ket_thuc');

-- CreateEnum
CREATE TYPE "vai_tro_nhan_su_lop" AS ENUM ('giang_vien', 'ho_tro');

-- CreateEnum
CREATE TYPE "trang_thai_dang_ky" AS ENUM ('cho_duyet', 'da_duyet', 'tu_choi', 'da_phan_lop');

-- CreateEnum
CREATE TYPE "ket_qua_hoc" AS ENUM ('dang_hoc', 'dat', 'khong_dat', 'vang');

-- CreateEnum
CREATE TYPE "nguon_tao_ho_so" AS ENUM ('tu_dang_ky', 'import_moet');

-- CreateEnum
CREATE TYPE "loai_danh_muc_import" AS ENUM ('dia_danh', 'don_vi_cong_tac', 'mon_hoc', 'phan_lop_hoc_vien', 'ho_so_nhan_su_moet');

-- CreateEnum
CREATE TYPE "trang_thai_import" AS ENUM ('dang_xu_ly', 'hoan_thanh', 'loi');

-- CreateTable
CREATE TABLE "nhat_ky_import" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "loai_danh_muc" "loai_danh_muc_import" NOT NULL,
    "ten_file_goc" VARCHAR(255) NOT NULL,
    "nguoi_import_id" UUID NOT NULL,
    "thoi_gian_import" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tong_so_dong" INTEGER NOT NULL DEFAULT 0,
    "so_dong_thanh_cong" INTEGER NOT NULL DEFAULT 0,
    "so_dong_loi" INTEGER NOT NULL DEFAULT 0,
    "file_loi_url" TEXT,
    "trang_thai" "trang_thai_import" NOT NULL DEFAULT 'dang_xu_ly',

    CONSTRAINT "nhat_ky_import_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dia_danh" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ma" VARCHAR(20) NOT NULL,
    "ten" VARCHAR(255) NOT NULL,
    "cap" "cap_dia_danh" NOT NULL,
    "parent_id" UUID,
    "trang_thai" "trang_thai_active" NOT NULL DEFAULT 'active',
    "nguon_import_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dia_danh_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "don_vi_cong_tac" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ma_don_vi" VARCHAR(30),
    "ten_don_vi" VARCHAR(255) NOT NULL,
    "loai_don_vi" "loai_don_vi" NOT NULL,
    "dia_ban_id" UUID NOT NULL,
    "don_vi_cha_id" UUID,
    "trang_thai" "trang_thai_active" NOT NULL DEFAULT 'active',
    "nguon_import_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "don_vi_cong_tac_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mon_hoc" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ten_mon" VARCHAR(255) NOT NULL,
    "cap_hoc" "cap_hoc" NOT NULL,
    "trang_thai" "trang_thai_active" NOT NULL DEFAULT 'active',
    "nguon_import_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mon_hoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nguoi_dung" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ho_ten" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "ten_dang_nhap" VARCHAR(50) NOT NULL,
    "vai_tro" "vai_tro_nguoi_dung" NOT NULL,
    "don_vi_id" UUID,
    "hoc_vien_id" UUID,
    "mat_khau_hash" VARCHAR(255) NOT NULL,
    "phai_doi_mat_khau" BOOLEAN NOT NULL DEFAULT true,
    "trang_thai" "trang_thai_active" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nguoi_dung_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hoc_vien" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nguon_tao" "nguon_tao_ho_so" NOT NULL DEFAULT 'tu_dang_ky',
    "ho_ten" VARCHAR(255) NOT NULL,
    "so_dinh_danh_ca_nhan" CHAR(12),
    "ma_dinh_danh_moet" VARCHAR(20),
    "ngay_sinh" SMALLINT NOT NULL,
    "thang_sinh" SMALLINT NOT NULL,
    "nam_sinh" SMALLINT NOT NULL,
    "gioi_tinh" VARCHAR(20),
    "chuc_vu" VARCHAR(100),
    "noi_sinh_id" UUID,
    "phuong_xa_id" UUID,
    "don_vi_cong_tac_id" UUID NOT NULL,
    "so_dien_thoai_lien_he" VARCHAR(20) NOT NULL,
    "email_lien_he" VARCHAR(255),
    "trinh_do_chuyen_mon" "trinh_do_chuyen_mon",
    "trinh_do_chuyen_mon_khac" VARCHAR(255),
    "cap_giang_day" "cap_hoc",
    "mon_giang_day_id" UUID,
    "ghi_chu" TEXT,
    "trang_thai" "trang_thai_ho_so" NOT NULL DEFAULT 'nhap',
    "nguoi_duyet_id" UUID,
    "cap_duyet_thuc_te" "vai_tro_nguoi_dung",
    "ngay_duyet" TIMESTAMPTZ(6),
    "email_ban_sao_da_gui_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "hoc_vien_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hoc_vien_chuyen_mon" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hoc_vien_id" UUID NOT NULL,
    "chuyen_mon" VARCHAR(255) NOT NULL,

    CONSTRAINT "hoc_vien_chuyen_mon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "khoa_boi_duong" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ma_khoa" VARCHAR(30) NOT NULL,
    "ten_khoa" VARCHAR(255) NOT NULL,
    "don_vi_to_chuc_id" UUID NOT NULL,
    "dia_diem" VARCHAR(255),
    "thoi_gian_bat_dau" DATE NOT NULL,
    "thoi_gian_ket_thuc" DATE NOT NULL,
    "trang_thai" "trang_thai_khoa" NOT NULL DEFAULT 'nhap',
    "nguoi_duyet_id" UUID,
    "cap_duyet_thuc_te" "vai_tro_nguoi_dung",
    "ngay_duyet" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "khoa_boi_duong_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "giai_doan_khoa" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "khoa_id" UUID NOT NULL,
    "thu_tu" INTEGER NOT NULL,
    "ten_giai_doan" VARCHAR(255) NOT NULL,
    "hinh_thuc" "hinh_thuc_giai_doan" NOT NULL,
    "thoi_gian_bat_dau" DATE NOT NULL,
    "thoi_gian_ket_thuc" DATE NOT NULL,
    "trang_thai" "trang_thai_active" NOT NULL DEFAULT 'active',

    CONSTRAINT "giai_doan_khoa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lop_hoc" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "khoa_id" UUID NOT NULL,
    "ten_lop" VARCHAR(255) NOT NULL,
    "si_so_toi_da" INTEGER,
    "trang_thai" "trang_thai_active" NOT NULL DEFAULT 'active',

    CONSTRAINT "lop_hoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lich_hoc_lop" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lop_id" UUID NOT NULL,
    "giai_doan_id" UUID NOT NULL,
    "thoi_gian_bat_dau" TIMESTAMPTZ(6) NOT NULL,
    "thoi_gian_ket_thuc" TIMESTAMPTZ(6) NOT NULL,
    "dia_diem_hoac_link" VARCHAR(500),
    "trang_thai" "trang_thai_lich_hoc" NOT NULL DEFAULT 'chua_dien_ra',

    CONSTRAINT "lich_hoc_lop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lop_hoc_nhan_su" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lop_id" UUID NOT NULL,
    "ho_ten" VARCHAR(255) NOT NULL,
    "vai_tro" "vai_tro_nhan_su_lop" NOT NULL,
    "so_dien_thoai" VARCHAR(20),

    CONSTRAINT "lop_hoc_nhan_su_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dang_ky_hoc" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hoc_vien_id" UUID NOT NULL,
    "khoa_id" UUID NOT NULL,
    "lop_id" UUID,
    "ngay_dang_ky" DATE NOT NULL DEFAULT CURRENT_DATE,
    "trang_thai" "trang_thai_dang_ky" NOT NULL DEFAULT 'cho_duyet',
    "ket_qua" "ket_qua_hoc",
    "ngay_hoan_thanh" DATE,

    CONSTRAINT "dang_ky_hoc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_import_nguoi" ON "nhat_ky_import"("nguoi_import_id");

-- CreateIndex
CREATE INDEX "idx_import_loai" ON "nhat_ky_import"("loai_danh_muc");

-- CreateIndex
CREATE UNIQUE INDEX "uq_dia_danh_ma" ON "dia_danh"("ma");

-- CreateIndex
CREATE INDEX "idx_dia_danh_parent" ON "dia_danh"("parent_id");

-- CreateIndex
CREATE INDEX "idx_dia_danh_cap" ON "dia_danh"("cap");

-- CreateIndex
CREATE UNIQUE INDEX "uq_don_vi_ma" ON "don_vi_cong_tac"("ma_don_vi");

-- CreateIndex
CREATE INDEX "idx_don_vi_loai" ON "don_vi_cong_tac"("loai_don_vi");

-- CreateIndex
CREATE INDEX "idx_don_vi_dia_ban" ON "don_vi_cong_tac"("dia_ban_id");

-- CreateIndex
CREATE INDEX "idx_don_vi_cha" ON "don_vi_cong_tac"("don_vi_cha_id");

-- CreateIndex
CREATE INDEX "idx_mon_hoc_cap" ON "mon_hoc"("cap_hoc");

-- CreateIndex
CREATE UNIQUE INDEX "uq_mon_hoc" ON "mon_hoc"("ten_mon", "cap_hoc");

-- CreateIndex
CREATE UNIQUE INDEX "uq_nguoi_dung_email" ON "nguoi_dung"("email");

-- CreateIndex
CREATE UNIQUE INDEX "uq_nguoi_dung_ten_dang_nhap" ON "nguoi_dung"("ten_dang_nhap");

-- CreateIndex
CREATE UNIQUE INDEX "uq_nguoi_dung_hoc_vien" ON "nguoi_dung"("hoc_vien_id");

-- CreateIndex
CREATE INDEX "idx_nguoi_dung_vai_tro" ON "nguoi_dung"("vai_tro");

-- CreateIndex
CREATE INDEX "idx_nguoi_dung_don_vi" ON "nguoi_dung"("don_vi_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_hoc_vien_ddcn" ON "hoc_vien"("so_dinh_danh_ca_nhan");

-- CreateIndex
CREATE UNIQUE INDEX "uq_hoc_vien_ma_moet" ON "hoc_vien"("ma_dinh_danh_moet");

-- CreateIndex
CREATE INDEX "idx_hoc_vien_don_vi" ON "hoc_vien"("don_vi_cong_tac_id");

-- CreateIndex
CREATE INDEX "idx_hoc_vien_trang_thai" ON "hoc_vien"("trang_thai");

-- CreateIndex
CREATE INDEX "idx_hoc_vien_cap_giang_day" ON "hoc_vien"("cap_giang_day");

-- CreateIndex
CREATE INDEX "idx_hoc_vien_phuong_xa" ON "hoc_vien"("phuong_xa_id");

-- CreateIndex
CREATE INDEX "idx_hoc_vien_ma_moet" ON "hoc_vien"("ma_dinh_danh_moet");

-- CreateIndex
CREATE INDEX "idx_hoc_vien_chuyen_mon_hv" ON "hoc_vien_chuyen_mon"("hoc_vien_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_hoc_vien_chuyen_mon" ON "hoc_vien_chuyen_mon"("hoc_vien_id", "chuyen_mon");

-- CreateIndex
CREATE UNIQUE INDEX "uq_khoa_ma" ON "khoa_boi_duong"("ma_khoa");

-- CreateIndex
CREATE INDEX "idx_khoa_don_vi" ON "khoa_boi_duong"("don_vi_to_chuc_id");

-- CreateIndex
CREATE INDEX "idx_khoa_trang_thai" ON "khoa_boi_duong"("trang_thai");

-- CreateIndex
CREATE INDEX "idx_giai_doan_khoa" ON "giai_doan_khoa"("khoa_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_giai_doan_thu_tu" ON "giai_doan_khoa"("khoa_id", "thu_tu");

-- CreateIndex
CREATE INDEX "idx_lop_khoa" ON "lop_hoc"("khoa_id");

-- CreateIndex
CREATE INDEX "idx_lich_hoc_lop" ON "lich_hoc_lop"("lop_id");

-- CreateIndex
CREATE INDEX "idx_lich_hoc_giai_doan" ON "lich_hoc_lop"("giai_doan_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_lich_hoc_lop_giai_doan" ON "lich_hoc_lop"("lop_id", "giai_doan_id");

-- CreateIndex
CREATE INDEX "idx_nhan_su_lop" ON "lop_hoc_nhan_su"("lop_id");

-- CreateIndex
CREATE INDEX "idx_dang_ky_hoc_vien" ON "dang_ky_hoc"("hoc_vien_id");

-- CreateIndex
CREATE INDEX "idx_dang_ky_khoa" ON "dang_ky_hoc"("khoa_id");

-- CreateIndex
CREATE INDEX "idx_dang_ky_lop" ON "dang_ky_hoc"("lop_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_dang_ky_hoc_vien_khoa" ON "dang_ky_hoc"("hoc_vien_id", "khoa_id");

-- AddForeignKey
ALTER TABLE "nhat_ky_import" ADD CONSTRAINT "fk_import_nguoi_import" FOREIGN KEY ("nguoi_import_id") REFERENCES "nguoi_dung"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dia_danh" ADD CONSTRAINT "dia_danh_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "dia_danh"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dia_danh" ADD CONSTRAINT "dia_danh_nguon_import_id_fkey" FOREIGN KEY ("nguon_import_id") REFERENCES "nhat_ky_import"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "don_vi_cong_tac" ADD CONSTRAINT "don_vi_cong_tac_dia_ban_id_fkey" FOREIGN KEY ("dia_ban_id") REFERENCES "dia_danh"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "don_vi_cong_tac" ADD CONSTRAINT "don_vi_cong_tac_don_vi_cha_id_fkey" FOREIGN KEY ("don_vi_cha_id") REFERENCES "don_vi_cong_tac"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "don_vi_cong_tac" ADD CONSTRAINT "don_vi_cong_tac_nguon_import_id_fkey" FOREIGN KEY ("nguon_import_id") REFERENCES "nhat_ky_import"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mon_hoc" ADD CONSTRAINT "mon_hoc_nguon_import_id_fkey" FOREIGN KEY ("nguon_import_id") REFERENCES "nhat_ky_import"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nguoi_dung" ADD CONSTRAINT "nguoi_dung_don_vi_id_fkey" FOREIGN KEY ("don_vi_id") REFERENCES "don_vi_cong_tac"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nguoi_dung" ADD CONSTRAINT "fk_nguoi_dung_hoc_vien" FOREIGN KEY ("hoc_vien_id") REFERENCES "hoc_vien"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hoc_vien" ADD CONSTRAINT "hoc_vien_noi_sinh_id_fkey" FOREIGN KEY ("noi_sinh_id") REFERENCES "dia_danh"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hoc_vien" ADD CONSTRAINT "hoc_vien_phuong_xa_id_fkey" FOREIGN KEY ("phuong_xa_id") REFERENCES "dia_danh"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hoc_vien" ADD CONSTRAINT "hoc_vien_don_vi_cong_tac_id_fkey" FOREIGN KEY ("don_vi_cong_tac_id") REFERENCES "don_vi_cong_tac"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hoc_vien" ADD CONSTRAINT "hoc_vien_mon_giang_day_id_fkey" FOREIGN KEY ("mon_giang_day_id") REFERENCES "mon_hoc"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hoc_vien" ADD CONSTRAINT "hoc_vien_nguoi_duyet_id_fkey" FOREIGN KEY ("nguoi_duyet_id") REFERENCES "nguoi_dung"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hoc_vien" ADD CONSTRAINT "hoc_vien_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "nguoi_dung"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hoc_vien_chuyen_mon" ADD CONSTRAINT "hoc_vien_chuyen_mon_hoc_vien_id_fkey" FOREIGN KEY ("hoc_vien_id") REFERENCES "hoc_vien"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "khoa_boi_duong" ADD CONSTRAINT "khoa_boi_duong_don_vi_to_chuc_id_fkey" FOREIGN KEY ("don_vi_to_chuc_id") REFERENCES "don_vi_cong_tac"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "khoa_boi_duong" ADD CONSTRAINT "khoa_boi_duong_nguoi_duyet_id_fkey" FOREIGN KEY ("nguoi_duyet_id") REFERENCES "nguoi_dung"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "giai_doan_khoa" ADD CONSTRAINT "giai_doan_khoa_khoa_id_fkey" FOREIGN KEY ("khoa_id") REFERENCES "khoa_boi_duong"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lop_hoc" ADD CONSTRAINT "lop_hoc_khoa_id_fkey" FOREIGN KEY ("khoa_id") REFERENCES "khoa_boi_duong"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lich_hoc_lop" ADD CONSTRAINT "lich_hoc_lop_lop_id_fkey" FOREIGN KEY ("lop_id") REFERENCES "lop_hoc"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lich_hoc_lop" ADD CONSTRAINT "lich_hoc_lop_giai_doan_id_fkey" FOREIGN KEY ("giai_doan_id") REFERENCES "giai_doan_khoa"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lop_hoc_nhan_su" ADD CONSTRAINT "lop_hoc_nhan_su_lop_id_fkey" FOREIGN KEY ("lop_id") REFERENCES "lop_hoc"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dang_ky_hoc" ADD CONSTRAINT "dang_ky_hoc_hoc_vien_id_fkey" FOREIGN KEY ("hoc_vien_id") REFERENCES "hoc_vien"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dang_ky_hoc" ADD CONSTRAINT "dang_ky_hoc_khoa_id_fkey" FOREIGN KEY ("khoa_id") REFERENCES "khoa_boi_duong"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dang_ky_hoc" ADD CONSTRAINT "dang_ky_hoc_lop_id_fkey" FOREIGN KEY ("lop_id") REFERENCES "lop_hoc"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;


-- =====================================================================
-- Raw SQL bổ sung — không biểu diễn được bằng Prisma schema DSL.
-- Chép nguyên văn từ docs/database-ddl.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- CHECK constraints
-- ---------------------------------------------------------------------

ALTER TABLE "nhat_ky_import" ADD CONSTRAINT "chk_import_dong_hop_le"
    CHECK (so_dong_thanh_cong + so_dong_loi <= tong_so_dong);

ALTER TABLE "dia_danh" ADD CONSTRAINT "chk_dia_danh_parent"
    CHECK ( (cap = 'tinh_thanh' AND parent_id IS NULL)
         OR (cap = 'phuong_xa_dac_khu' AND parent_id IS NOT NULL) );

ALTER TABLE "don_vi_cong_tac" ADD CONSTRAINT "chk_don_vi_khong_tu_lam_cha"
    CHECK (id IS DISTINCT FROM don_vi_cha_id);

ALTER TABLE "nguoi_dung" ADD CONSTRAINT "chk_nguoi_dung_scope" CHECK (
    (vai_tro = 'hoc_vien' AND don_vi_id IS NULL AND hoc_vien_id IS NOT NULL)
    OR
    (vai_tro <> 'hoc_vien' AND don_vi_id IS NOT NULL AND hoc_vien_id IS NULL)
);

ALTER TABLE "nguoi_dung" ADD CONSTRAINT "chk_nguoi_dung_email_bat_buoc"
    CHECK (vai_tro = 'hoc_vien' OR email IS NOT NULL);

ALTER TABLE "hoc_vien" ADD CONSTRAINT "chk_hoc_vien_ddcn_12_so"
    CHECK (so_dinh_danh_ca_nhan IS NULL OR so_dinh_danh_ca_nhan ~ '^[0-9]{12}$');

ALTER TABLE "hoc_vien" ADD CONSTRAINT "chk_hoc_vien_nguon_tao" CHECK (
    (nguon_tao = 'tu_dang_ky' AND so_dinh_danh_ca_nhan IS NOT NULL)
    OR
    (nguon_tao = 'import_moet' AND ma_dinh_danh_moet IS NOT NULL)
);

ALTER TABLE "hoc_vien" ADD CONSTRAINT "chk_hoc_vien_ngay_sinh"
    CHECK (ngay_sinh BETWEEN 1 AND 31);

ALTER TABLE "hoc_vien" ADD CONSTRAINT "chk_hoc_vien_thang_sinh"
    CHECK (thang_sinh BETWEEN 1 AND 12);

-- độ tuổi tối thiểu 15 — xác nhận đúng quy định (2026-09-23)
ALTER TABLE "hoc_vien" ADD CONSTRAINT "chk_hoc_vien_nam_sinh"
    CHECK (nam_sinh BETWEEN 1940 AND date_part('year', now())::int - 15);

-- bắt lỗi 31/04, 30/02, 29/02 năm không nhuận, v.v. Postgres tự raise lỗi khi
-- make_date() nhận ngày không tồn tại; ràng buộc này chủ yếu để tài liệu hóa
-- ý định — chặn thật sự nên làm ở tầng ứng dụng để trả thông báo lỗi rõ ràng
-- thay vì lỗi SQL khó hiểu.
ALTER TABLE "hoc_vien" ADD CONSTRAINT "chk_hoc_vien_ngay_sinh_hop_le"
    CHECK (make_date(nam_sinh, thang_sinh, ngay_sinh) IS NOT NULL);

ALTER TABLE "hoc_vien" ADD CONSTRAINT "chk_hoc_vien_trinh_do_khac"
    CHECK ( trinh_do_chuyen_mon IS DISTINCT FROM 'khac'
         OR trinh_do_chuyen_mon_khac IS NOT NULL );

ALTER TABLE "hoc_vien" ADD CONSTRAINT "chk_hoc_vien_duyet_dong_bo"
    CHECK ( (trang_thai IN ('da_duyet', 'tu_choi') AND nguoi_duyet_id IS NOT NULL)
         OR (trang_thai NOT IN ('da_duyet', 'tu_choi')) );

ALTER TABLE "khoa_boi_duong" ADD CONSTRAINT "chk_khoa_thoi_gian"
    CHECK (thoi_gian_ket_thuc >= thoi_gian_bat_dau);

ALTER TABLE "giai_doan_khoa" ADD CONSTRAINT "chk_giai_doan_thoi_gian"
    CHECK (thoi_gian_ket_thuc >= thoi_gian_bat_dau);

ALTER TABLE "lop_hoc" ADD CONSTRAINT "chk_lop_si_so"
    CHECK (si_so_toi_da IS NULL OR si_so_toi_da > 0);

ALTER TABLE "lich_hoc_lop" ADD CONSTRAINT "chk_lich_hoc_thoi_gian"
    CHECK (thoi_gian_ket_thuc > thoi_gian_bat_dau);

-- lop_id (nếu có) phải thuộc đúng khoa_id — thực thi bằng trigger bên dưới
-- (không biểu diễn được bằng CHECK đơn thuần vì cần tra cứu bảng lop_hoc).
ALTER TABLE "dang_ky_hoc" ADD CONSTRAINT "chk_dang_ky_lop_thuoc_khoa"
    CHECK (true);

-- ---------------------------------------------------------------------
-- GIN trgm indexes (autocomplete gần đúng)
-- ---------------------------------------------------------------------

CREATE INDEX "idx_dia_danh_ten_trgm" ON "dia_danh" USING gin (ten gin_trgm_ops);
CREATE INDEX "idx_don_vi_ten_trgm" ON "don_vi_cong_tac" USING gin (ten_don_vi gin_trgm_ops);
CREATE INDEX "idx_hoc_vien_ho_ten_trgm" ON "hoc_vien" USING gin (ho_ten gin_trgm_ops);
CREATE INDEX "idx_hoc_vien_chuyen_mon_trgm" ON "hoc_vien_chuyen_mon" USING gin (chuyen_mon gin_trgm_ops);

-- ---------------------------------------------------------------------
-- Trigger: lop_id (nếu có) trong dang_ky_hoc phải thuộc đúng khoa_id
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trg_dang_ky_lop_thuoc_khoa() RETURNS trigger AS $$
BEGIN
    IF NEW.lop_id IS NOT NULL THEN
        PERFORM 1 FROM lop_hoc WHERE id = NEW.lop_id AND khoa_id = NEW.khoa_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'lop_id % không thuộc khoa_id %', NEW.lop_id, NEW.khoa_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dang_ky_hoc_kiem_tra_lop
    BEFORE INSERT OR UPDATE ON dang_ky_hoc
    FOR EACH ROW EXECUTE FUNCTION trg_dang_ky_lop_thuoc_khoa();

-- ---------------------------------------------------------------------
-- Trigger: updated_at dùng chung
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dia_danh_updated_at BEFORE UPDATE ON dia_danh
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER trg_don_vi_updated_at BEFORE UPDATE ON don_vi_cong_tac
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER trg_mon_hoc_updated_at BEFORE UPDATE ON mon_hoc
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER trg_nguoi_dung_updated_at BEFORE UPDATE ON nguoi_dung
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER trg_hoc_vien_updated_at BEFORE UPDATE ON hoc_vien
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER trg_khoa_updated_at BEFORE UPDATE ON khoa_boi_duong
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
