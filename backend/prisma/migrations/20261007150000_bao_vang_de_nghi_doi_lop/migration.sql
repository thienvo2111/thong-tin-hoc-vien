-- ADR 0004 G13/G14 (issue #18, 2026-10-07): báo vắng + đề nghị đổi lớp.
CREATE TYPE "trang_thai_de_nghi" AS ENUM ('cho_duyet', 'da_duyet', 'tu_choi', 'da_huy');

CREATE TABLE "bao_vang" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dang_ky_hoc_id" UUID NOT NULL,
    "lich_hoc_id" UUID NOT NULL,
    "ly_do" TEXT NOT NULL,
    "nguoi_ghi" UUID,
    "ghi_luc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bao_vang_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_bao_vang_ly_do" CHECK (length(btrim("ly_do")) > 0)
);
CREATE UNIQUE INDEX "uq_bao_vang" ON "bao_vang"("dang_ky_hoc_id", "lich_hoc_id");
CREATE INDEX "idx_bao_vang_lich_hoc" ON "bao_vang"("lich_hoc_id");
ALTER TABLE "bao_vang" ADD CONSTRAINT "bao_vang_dang_ky_hoc_id_fkey"
    FOREIGN KEY ("dang_ky_hoc_id") REFERENCES "dang_ky_hoc"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "bao_vang" ADD CONSTRAINT "bao_vang_lich_hoc_id_fkey"
    FOREIGN KEY ("lich_hoc_id") REFERENCES "lich_hoc_lop"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "bao_vang" ADD CONSTRAINT "bao_vang_nguoi_ghi_fkey"
    FOREIGN KEY ("nguoi_ghi") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE TABLE "de_nghi_doi_lop" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dang_ky_hoc_id" UUID NOT NULL,
    "giai_doan_id" UUID NOT NULL,
    "lop_hien_tai_id" UUID,
    "lop_de_nghi_id" UUID NOT NULL,
    "ly_do" TEXT NOT NULL,
    "trang_thai" "trang_thai_de_nghi" NOT NULL DEFAULT 'cho_duyet',
    "nguoi_tao" UUID,
    "tao_luc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nguoi_xu_ly" UUID,
    "xu_ly_luc" TIMESTAMPTZ(6),
    "ghi_chu_xu_ly" TEXT,

    CONSTRAINT "de_nghi_doi_lop_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_de_nghi_ly_do" CHECK (length(btrim("ly_do")) > 0),
    CONSTRAINT "chk_de_nghi_khac_lop" CHECK ("lop_hien_tai_id" IS NULL OR "lop_hien_tai_id" <> "lop_de_nghi_id")
);
CREATE INDEX "idx_de_nghi_doi_lop_gd" ON "de_nghi_doi_lop"("giai_doan_id", "trang_thai");
CREATE INDEX "idx_de_nghi_doi_lop_dk" ON "de_nghi_doi_lop"("dang_ky_hoc_id");
-- G14: chỉ 1 đề nghị đang chờ cho mỗi (đăng ký học, giai đoạn).
CREATE UNIQUE INDEX "uq_de_nghi_doi_lop_cho" ON "de_nghi_doi_lop"("dang_ky_hoc_id", "giai_doan_id") WHERE "trang_thai" = 'cho_duyet';
ALTER TABLE "de_nghi_doi_lop" ADD CONSTRAINT "de_nghi_doi_lop_dang_ky_hoc_id_fkey"
    FOREIGN KEY ("dang_ky_hoc_id") REFERENCES "dang_ky_hoc"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "de_nghi_doi_lop" ADD CONSTRAINT "de_nghi_doi_lop_giai_doan_id_fkey"
    FOREIGN KEY ("giai_doan_id") REFERENCES "giai_doan_khoa"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "de_nghi_doi_lop" ADD CONSTRAINT "de_nghi_doi_lop_lop_hien_tai_id_fkey"
    FOREIGN KEY ("lop_hien_tai_id") REFERENCES "lop_hoc"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "de_nghi_doi_lop" ADD CONSTRAINT "de_nghi_doi_lop_lop_de_nghi_id_fkey"
    FOREIGN KEY ("lop_de_nghi_id") REFERENCES "lop_hoc"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "de_nghi_doi_lop" ADD CONSTRAINT "de_nghi_doi_lop_nguoi_tao_fkey"
    FOREIGN KEY ("nguoi_tao") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "de_nghi_doi_lop" ADD CONSTRAINT "de_nghi_doi_lop_nguoi_xu_ly_fkey"
    FOREIGN KEY ("nguoi_xu_ly") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Bảng kiểm (issue #17): thêm quy tắc khong_de_nghi_cho vào bộ mặc định.
INSERT INTO "muc_kiem_tra" ("khoa_id", "thu_tu", "ten", "loai", "ma_quy_tac", "han_truoc_ngay")
SELECT NULL, COALESCE(MAX("thu_tu"), 0) + 1, 'Không còn đề nghị đổi lớp chờ duyệt', 'tu_dong', 'khong_de_nghi_cho', 3
FROM "muc_kiem_tra" WHERE "khoa_id" IS NULL;
