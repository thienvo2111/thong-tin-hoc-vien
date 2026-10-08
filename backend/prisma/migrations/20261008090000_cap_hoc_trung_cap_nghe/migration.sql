-- 2026-10-08: thêm cấp học "Trung cấp nghề". Migration RIÊNG vì giá trị enum
-- vừa ADD VALUE không dùng được trong cùng transaction (seed ở migration sau).
ALTER TYPE "cap_hoc" ADD VALUE 'trung_cap_nghe';
