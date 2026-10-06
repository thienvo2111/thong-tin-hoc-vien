-- ADR 0004 G10/G11 (issue #21, 2026-10-07): nhật ký "Đã gửi" tin nhắn nhắc
-- lịch (giảng viên hoặc nhóm Zalo cụm). Không email, không cron.
CREATE TYPE "doi_tuong_nhac" AS ENUM ('giang_vien', 'cum');

CREATE TABLE "nhat_ky_nhac_lich" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "doi_tuong" "doi_tuong_nhac" NOT NULL,
    "giang_vien_id" UUID,
    "cum_id" UUID,
    "lich_hoc_ids" UUID[] NOT NULL,
    "noi_dung" TEXT NOT NULL,
    "nguoi_gui" UUID,
    "gui_luc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nhat_ky_nhac_lich_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_nhac_lich_doi_tuong" CHECK (
        ("doi_tuong" = 'giang_vien' AND "giang_vien_id" IS NOT NULL AND "cum_id" IS NULL)
        OR ("doi_tuong" = 'cum' AND "cum_id" IS NOT NULL AND "giang_vien_id" IS NULL)
    ),
    CONSTRAINT "chk_nhac_lich_co_buoi" CHECK (cardinality("lich_hoc_ids") > 0)
);
CREATE INDEX "idx_nhac_lich_buoi" ON "nhat_ky_nhac_lich" USING GIN ("lich_hoc_ids");
CREATE INDEX "idx_nhac_lich_giang_vien" ON "nhat_ky_nhac_lich"("giang_vien_id");
CREATE INDEX "idx_nhac_lich_cum" ON "nhat_ky_nhac_lich"("cum_id");
ALTER TABLE "nhat_ky_nhac_lich" ADD CONSTRAINT "nhat_ky_nhac_lich_giang_vien_id_fkey"
    FOREIGN KEY ("giang_vien_id") REFERENCES "giang_vien"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "nhat_ky_nhac_lich" ADD CONSTRAINT "nhat_ky_nhac_lich_cum_id_fkey"
    FOREIGN KEY ("cum_id") REFERENCES "cum_hoc_vien"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "nhat_ky_nhac_lich" ADD CONSTRAINT "nhat_ky_nhac_lich_nguoi_gui_fkey"
    FOREIGN KEY ("nguoi_gui") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Bảng kiểm mặc định (issue #17): thêm quy tắc da_nhac_giang_vien (hạn 3 ngày).
INSERT INTO "muc_kiem_tra" ("khoa_id", "thu_tu", "ten", "loai", "ma_quy_tac", "han_truoc_ngay")
SELECT NULL, COALESCE(MAX("thu_tu"), 0) + 1, 'Đã nhắc lịch giảng viên', 'tu_dong', 'da_nhac_giang_vien', 3
FROM "muc_kiem_tra" WHERE "khoa_id" IS NULL;
