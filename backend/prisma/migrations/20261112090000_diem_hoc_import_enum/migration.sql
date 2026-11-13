-- Import danh mục điểm học (2026-11-12): ALTER TYPE ... ADD VALUE phải nằm ở
-- migration RIÊNG, chạy trước migration dùng giá trị mới.
ALTER TYPE "loai_danh_muc_import" ADD VALUE 'diem_hoc';
