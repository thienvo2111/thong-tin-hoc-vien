-- 2026-10-16, ADR 0007: học viên đề nghị đổi buổi học. Chỉ thêm (1 bảng + 1 cột
-- mặc định 0 = tắt), không đụng dữ liệu cũ.
-- Rollback: DROP TABLE "doi_buoi_hoc"; ALTER TABLE "khoa_boi_duong" DROP COLUMN "so_buoi_doi_toi_da";

ALTER TABLE "khoa_boi_duong" ADD COLUMN "so_buoi_doi_toi_da" SMALLINT NOT NULL DEFAULT 0
    CONSTRAINT "chk_khoa_so_buoi_doi_toi_da" CHECK ("so_buoi_doi_toi_da" BETWEEN 0 AND 50);

CREATE TABLE "doi_buoi_hoc" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dang_ky_hoc_id" UUID NOT NULL,
    "lich_nguon_id" UUID NOT NULL,
    "lich_de_nghi_id" UUID NOT NULL,
    "lich_chot_id" UUID,
    "ly_do" TEXT NOT NULL,
    "trang_thai" "trang_thai_de_nghi" NOT NULL DEFAULT 'cho_duyet',
    "nguoi_tao" UUID,
    "tao_luc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nguoi_xu_ly" UUID,
    "xu_ly_luc" TIMESTAMPTZ(6),
    "ghi_chu_xu_ly" TEXT,

    CONSTRAINT "doi_buoi_hoc_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_doi_buoi_khac_buoi" CHECK ("lich_de_nghi_id" <> "lich_nguon_id"),
    -- Hủy duyệt giữ lại lich_chot_id để tra lịch sử, nên chỉ ràng buộc một chiều.
    CONSTRAINT "chk_doi_buoi_da_duyet_co_chot" CHECK ("trang_thai" <> 'da_duyet' OR "lich_chot_id" IS NOT NULL)
);

-- Mỗi buổi nguồn của 1 đăng ký: tối đa 1 đề nghị đang chờ hoặc đã duyệt.
CREATE UNIQUE INDEX "uq_doi_buoi_hoat_dong" ON "doi_buoi_hoc"("dang_ky_hoc_id", "lich_nguon_id")
    WHERE "trang_thai" IN ('cho_duyet', 'da_duyet');
CREATE INDEX "idx_doi_buoi_de_nghi" ON "doi_buoi_hoc"("lich_de_nghi_id", "trang_thai", "tao_luc");
CREATE INDEX "idx_doi_buoi_chot" ON "doi_buoi_hoc"("lich_chot_id") WHERE "trang_thai" = 'da_duyet';
CREATE INDEX "idx_doi_buoi_nguon" ON "doi_buoi_hoc"("lich_nguon_id") WHERE "trang_thai" = 'da_duyet';

ALTER TABLE "doi_buoi_hoc" ADD CONSTRAINT "doi_buoi_hoc_dang_ky_hoc_id_fkey"
    FOREIGN KEY ("dang_ky_hoc_id") REFERENCES "dang_ky_hoc"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "doi_buoi_hoc" ADD CONSTRAINT "doi_buoi_hoc_lich_nguon_id_fkey"
    FOREIGN KEY ("lich_nguon_id") REFERENCES "lich_hoc_lop"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "doi_buoi_hoc" ADD CONSTRAINT "doi_buoi_hoc_lich_de_nghi_id_fkey"
    FOREIGN KEY ("lich_de_nghi_id") REFERENCES "lich_hoc_lop"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "doi_buoi_hoc" ADD CONSTRAINT "doi_buoi_hoc_lich_chot_id_fkey"
    FOREIGN KEY ("lich_chot_id") REFERENCES "lich_hoc_lop"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "doi_buoi_hoc" ADD CONSTRAINT "doi_buoi_hoc_nguoi_tao_fkey"
    FOREIGN KEY ("nguoi_tao") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "doi_buoi_hoc" ADD CONSTRAINT "doi_buoi_hoc_nguoi_xu_ly_fkey"
    FOREIGN KEY ("nguoi_xu_ly") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
