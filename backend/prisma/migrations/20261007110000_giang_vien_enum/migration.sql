-- T11 (issue #3, 2026-10-07): 2 loại import mới. ALTER TYPE ... ADD VALUE
-- phải nằm ở migration RIÊNG, chạy trước migration dùng giá trị mới.
ALTER TYPE "loai_danh_muc_import" ADD VALUE 'giang_vien';
ALTER TYPE "loai_danh_muc_import" ADD VALUE 'phan_cong_giang_day';
