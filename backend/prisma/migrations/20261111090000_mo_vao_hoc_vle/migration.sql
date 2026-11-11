-- 2026-11-11: công tắc "Vào học VLE" theo khóa — Quản trị bật/tắt nút
-- "Vào học VLE" của học viên (mặc định tắt: sau deploy mọi khóa đều TẮT).
-- VLE_LOGIN_KEY vẫn là công tắc tổng của cả hệ thống.
ALTER TABLE "khoa_boi_duong" ADD COLUMN "mo_vao_hoc_vle" BOOLEAN NOT NULL DEFAULT false;
