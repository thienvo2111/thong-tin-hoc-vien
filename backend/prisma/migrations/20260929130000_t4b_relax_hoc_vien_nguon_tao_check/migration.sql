-- T4b (mo-rong-nls-an-giang.md, 2026-09-29): xác nhận mã định danh CSDL
-- ngành (MOET) và CCCD KHÔNG giả định trùng nhau, và một số trường không
-- cung cấp được mã định danh CSDL ngành khi báo danh sách học viên. Nới
-- lỏng constraint: hồ sơ import_moet giờ chỉ cần CÓ ÍT NHẤT 1 trong 2
-- (ma_dinh_danh_moet HOẶC so_dinh_danh_ca_nhan), không còn bắt buộc phải có
-- ma_dinh_danh_moet như trước.
ALTER TABLE "hoc_vien" DROP CONSTRAINT "chk_hoc_vien_nguon_tao";

ALTER TABLE "hoc_vien" ADD CONSTRAINT "chk_hoc_vien_nguon_tao" CHECK (
    (nguon_tao = 'tu_dang_ky' AND so_dinh_danh_ca_nhan IS NOT NULL)
    OR
    (nguon_tao = 'import_moet' AND (ma_dinh_danh_moet IS NOT NULL OR so_dinh_danh_ca_nhan IS NOT NULL))
);
