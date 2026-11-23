-- ADR 0015 T1, T3 (issue #66): hạn riêng từng trường — gia hạn riêng 1 trường trong đợt.
-- Hạn hiệu lực = han_rieng ?? dot_trien_khai.han_nop (tính ở quy tắc thuần, không lưu).
-- Chỉ thêm 1 cột NULL được — không backfill, không đổi dữ liệu; lý do gia hạn nằm trong nhật ký.

-- AlterTable
ALTER TABLE "hop_dong_boi_duong" ADD COLUMN "han_rieng" TIMESTAMPTZ(6);
