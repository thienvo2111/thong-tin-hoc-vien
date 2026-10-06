-- T10 (issue #2, mo-rong-nls-an-giang.md + ADR 0004 G12/P0, 2026-10-07):
-- danh mục điểm học trực tiếp, gắn vào từng buổi học (lich_hoc_lop).
CREATE TABLE "diem_hoc" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ma_diem_hoc" VARCHAR(30) NOT NULL,
    "ten" VARCHAR(255) NOT NULL,
    "dia_chi" VARCHAR(500) NOT NULL,
    "dia_ban_id" UUID NOT NULL,
    "don_vi_id" UUID,
    "suc_chua" INTEGER,
    "so_phong" SMALLINT,
    "nguoi_lien_he" VARCHAR(255),
    "sdt_lien_he" VARCHAR(20),
    "ghi_chu_csvc" TEXT,
    "trang_thai" "trang_thai_active" NOT NULL DEFAULT 'active',
    "tao_boi" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diem_hoc_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_diem_hoc_suc_chua" CHECK ("suc_chua" IS NULL OR "suc_chua" > 0),
    CONSTRAINT "chk_diem_hoc_so_phong" CHECK ("so_phong" IS NULL OR "so_phong" > 0)
);

CREATE UNIQUE INDEX "uq_diem_hoc_ma" ON "diem_hoc"("ma_diem_hoc");
CREATE INDEX "idx_diem_hoc_dia_ban" ON "diem_hoc"("dia_ban_id");

ALTER TABLE "diem_hoc" ADD CONSTRAINT "diem_hoc_dia_ban_id_fkey"
    FOREIGN KEY ("dia_ban_id") REFERENCES "dia_danh"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "diem_hoc" ADD CONSTRAINT "diem_hoc_don_vi_id_fkey"
    FOREIGN KEY ("don_vi_id") REFERENCES "don_vi_cong_tac"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "diem_hoc" ADD CONSTRAINT "diem_hoc_tao_boi_fkey"
    FOREIGN KEY ("tao_boi") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Buổi học: điểm học, phòng, và mốc cập nhật (phát hiện "cần nhắc lại" sau
-- khi đổi lịch — ADR 0004 G11). Chỉ thêm cột; dữ liệu cũ: diem_hoc_id/phong
-- NULL, cap_nhat_luc = thời điểm migrate.
ALTER TABLE "lich_hoc_lop" ADD COLUMN "diem_hoc_id" UUID;
ALTER TABLE "lich_hoc_lop" ADD COLUMN "phong" VARCHAR(100);
ALTER TABLE "lich_hoc_lop" ADD COLUMN "cap_nhat_luc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "idx_lich_hoc_diem_hoc" ON "lich_hoc_lop"("diem_hoc_id");
ALTER TABLE "lich_hoc_lop" ADD CONSTRAINT "lich_hoc_lop_diem_hoc_id_fkey"
    FOREIGN KEY ("diem_hoc_id") REFERENCES "diem_hoc"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
