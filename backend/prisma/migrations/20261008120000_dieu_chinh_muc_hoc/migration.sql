-- 2026-10-08: học viên tự điều chỉnh mức lớp học (chỉ xuống mức bằng/thấp hơn
-- muc_dau_vao). muc_hoc_chon NULL = học theo mức đánh giá; công tắc
-- mo_dieu_chinh_muc do Quản trị bật/tắt theo khóa (mặc định tắt).
ALTER TABLE "dang_ky_hoc" ADD COLUMN "muc_hoc_chon" "muc_nang_luc";
ALTER TABLE "khoa_boi_duong" ADD COLUMN "mo_dieu_chinh_muc" BOOLEAN NOT NULL DEFAULT false;
