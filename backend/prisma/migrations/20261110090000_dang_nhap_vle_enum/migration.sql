-- Vào học VLE (external-login P.CNTT, 2026-11-10): ALTER TYPE ... ADD VALUE
-- phải nằm ở migration RIÊNG, chạy trước migration dùng giá trị mới.
ALTER TYPE "loai_danh_muc_import" ADD VALUE 'dang_nhap_vle';
