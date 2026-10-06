-- ADR 0004 L1 (issue #14, 2026-10-07): vai trò người hỗ trợ giảng viên.
-- ALTER TYPE ... ADD VALUE phải nằm ở migration RIÊNG.
ALTER TYPE "vai_tro_nguoi_dung" ADD VALUE 'ho_tro_giang_vien';
