-- ADR 0003 (2026-10-06): vai trò người hỗ trợ học viên. ALTER TYPE ... ADD
-- VALUE phải nằm ở migration RIÊNG, chạy trước migration dùng giá trị mới.
ALTER TYPE "vai_tro_nguoi_dung" ADD VALUE 'ho_tro_hoc_vien';
