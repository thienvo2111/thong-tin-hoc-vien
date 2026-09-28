-- Prisma tự sinh 4 câu "DROP INDEX" ở đây cho các GIN trgm index (tạo bằng
-- raw SQL, ngoài schema.prisma DSL) — ĐÃ GỠ BỎ, xem gotcha đã biết ở
-- migration 20260928065926_t14_loai_dot_xac_nhan_enum.

-- CreateTable
CREATE TABLE "tai_khoan_vle" (
    "hoc_vien_id" UUID NOT NULL,
    "ten_dang_nhap_vle" VARCHAR(100) NOT NULL,
    "mat_khau_tam_ma_hoa" BYTEA,
    "duong_dan" VARCHAR(500) NOT NULL,
    "lan_dau_xem_luc" TIMESTAMPTZ(6),
    "nguon_import_id" UUID,
    "cap_nhat_luc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tai_khoan_vle_pkey" PRIMARY KEY ("hoc_vien_id")
);

-- AddForeignKey
ALTER TABLE "tai_khoan_vle" ADD CONSTRAINT "tai_khoan_vle_hoc_vien_id_fkey" FOREIGN KEY ("hoc_vien_id") REFERENCES "hoc_vien"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tai_khoan_vle" ADD CONSTRAINT "tai_khoan_vle_nguon_import_id_fkey" FOREIGN KEY ("nguon_import_id") REFERENCES "nhat_ky_import"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
