-- ADR 0004 G8 (issue #20, 2026-10-07): vai trò giảng viên (chỉ đọc).
-- ALTER TYPE ... ADD VALUE phải nằm ở migration RIÊNG.
ALTER TYPE "vai_tro_nguoi_dung" ADD VALUE 'giang_vien';
