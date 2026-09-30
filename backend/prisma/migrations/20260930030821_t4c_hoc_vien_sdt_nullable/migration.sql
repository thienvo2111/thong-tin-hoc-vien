-- T4c (2026-09-30): danh sách tiếp nhận MOET thực tế có dòng THIẾU số điện
-- thoại liên hệ — luồng import_moet giờ chấp nhận thiếu, bổ sung sau qua
-- PATCH /hoc-vien/toi (validate bắt buộc ở validateHocVien requireFull=true
-- khi xác nhận). Luồng tu_dang_ky (POST /hoc-vien) không đổi, vẫn bắt buộc
-- ở tầng ứng dụng (CreateHocVienDto).
ALTER TABLE "hoc_vien" ALTER COLUMN "so_dien_thoai_lien_he" DROP NOT NULL;
