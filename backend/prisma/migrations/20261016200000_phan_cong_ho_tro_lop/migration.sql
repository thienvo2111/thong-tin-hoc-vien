-- 2026-10-16, ADR 0008 (người hỗ trợ học viên theo lớp): chỉ thêm bảng, không đụng dữ liệu cũ.
-- Phân công người hỗ trợ học viên (vai trò ho_tro_hoc_vien) vào LỚP, song song
-- với phan_cong_ho_tro (cụm). Kiểm vai trò ở KhoaBoiDuongService.ganNguoiHoTroLop.
-- Rollback: DROP TABLE "phan_cong_ho_tro_lop";
CREATE TABLE "phan_cong_ho_tro_lop" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nguoi_dung_id" UUID NOT NULL,
    "lop_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phan_cong_ho_tro_lop_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_phan_cong_ho_tro_lop" ON "phan_cong_ho_tro_lop"("nguoi_dung_id", "lop_id");
CREATE INDEX "idx_phan_cong_ho_tro_lop_lop" ON "phan_cong_ho_tro_lop"("lop_id");

ALTER TABLE "phan_cong_ho_tro_lop" ADD CONSTRAINT "phan_cong_ho_tro_lop_nguoi_dung_id_fkey"
    FOREIGN KEY ("nguoi_dung_id") REFERENCES "nguoi_dung"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "phan_cong_ho_tro_lop" ADD CONSTRAINT "phan_cong_ho_tro_lop_lop_id_fkey"
    FOREIGN KEY ("lop_id") REFERENCES "lop_hoc"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
