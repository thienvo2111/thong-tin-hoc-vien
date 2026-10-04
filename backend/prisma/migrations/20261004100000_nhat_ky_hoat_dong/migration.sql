-- Nhật ký hoạt động (2026-10-04) — bảng chỉ thêm, phục vụ đối chiếu khiếu nại.
CREATE TABLE "nhat_ky_hoat_dong" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "thoi_gian" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hanh_dong" VARCHAR(50) NOT NULL,
    "hoc_vien_id" UUID,
    "nguoi_dung_id" UUID,
    "vai_tro" "vai_tro_nguoi_dung",
    "chi_tiet" JSONB,
    "ip" VARCHAR(64),
    "thiet_bi" VARCHAR(300),

    CONSTRAINT "nhat_ky_hoat_dong_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_nhat_ky_hd_hoc_vien" ON "nhat_ky_hoat_dong"("hoc_vien_id", "thoi_gian");
CREATE INDEX "idx_nhat_ky_hd_nguoi_dung" ON "nhat_ky_hoat_dong"("nguoi_dung_id", "thoi_gian");
CREATE INDEX "idx_nhat_ky_hd_hanh_dong" ON "nhat_ky_hoat_dong"("hanh_dong", "thoi_gian");

-- Chặn sửa/xóa ở tầng DB (kể cả lỗi code hoặc thao tác tay qua psql). Muốn dọn log cũ
-- phải chủ động DROP/ALTER trigger này — cố ý để không xảy ra vô tình.
CREATE FUNCTION "chan_sua_nhat_ky_hoat_dong"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'nhat_ky_hoat_dong chỉ cho phép thêm, không sửa/xóa';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_chan_sua_nhat_ky_hoat_dong"
    BEFORE UPDATE OR DELETE ON "nhat_ky_hoat_dong"
    FOR EACH ROW EXECUTE FUNCTION "chan_sua_nhat_ky_hoat_dong"();
