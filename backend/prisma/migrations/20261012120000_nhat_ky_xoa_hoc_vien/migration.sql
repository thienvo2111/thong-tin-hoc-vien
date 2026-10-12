-- 2026-10-12 (issue #30, PRD #29): nhật ký Quản trị xóa cứng học viên. Chỉ
-- TẠO bảng mới + index + FK tới người xóa; không đụng dữ liệu cũ. Không FK tới
-- hoc_vien/don_vi_cong_tac (snapshot — bản ghi gốc đã bị xóa). Không lưu
-- CCCD/SĐT/email.
CREATE TABLE "nhat_ky_xoa_hoc_vien" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hoc_vien_id_cu" UUID NOT NULL,
    "ho_ten" VARCHAR(255) NOT NULL,
    "ma_dinh_danh_moet" VARCHAR(20),
    "don_vi_cong_tac_id" UUID,
    "ten_don_vi" VARCHAR(255) NOT NULL,
    "so_dang_ky_da_xoa" INTEGER NOT NULL,
    "ten_dang_nhap_vle" VARCHAR(100),
    "ly_do" TEXT NOT NULL,
    "nguoi_xoa_id" UUID NOT NULL,
    "thoi_gian" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nhat_ky_xoa_hoc_vien_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_nhat_ky_xoa_hv_thoi_gian" ON "nhat_ky_xoa_hoc_vien"("thoi_gian");
CREATE INDEX "idx_nhat_ky_xoa_hv_ma_moet" ON "nhat_ky_xoa_hoc_vien"("ma_dinh_danh_moet");

ALTER TABLE "nhat_ky_xoa_hoc_vien" ADD CONSTRAINT "nhat_ky_xoa_hoc_vien_nguoi_xoa_id_fkey"
    FOREIGN KEY ("nguoi_xoa_id") REFERENCES "nguoi_dung"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
