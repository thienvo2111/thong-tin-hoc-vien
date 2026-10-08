-- 2026-10-08: thêm cấp học "Trung cấp nghề". Migration RIÊNG vì giá trị enum
-- vừa ADD VALUE không dùng được trong cùng transaction (seed ở migration sau).
-- IF NOT EXISTS: an toàn nếu đã thêm tay trên VPS bằng psql trước khi deploy.
ALTER TYPE "cap_hoc" ADD VALUE IF NOT EXISTS 'trung_cap_nghe';
