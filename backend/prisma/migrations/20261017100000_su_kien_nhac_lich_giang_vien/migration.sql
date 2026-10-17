-- 2026-10-17, ADR 0009 (email lịch giảng dạy): chỉ thêm giá trị enum, không đụng dữ liệu.
-- Migration RIÊNG: Postgres không dùng được giá trị enum mới trong cùng transaction.
-- Rollback: không gỡ được giá trị enum (Postgres) — để nguyên, vô hại.
ALTER TYPE "loai_su_kien_thong_bao" ADD VALUE 'nhac_lich_giang_vien';
