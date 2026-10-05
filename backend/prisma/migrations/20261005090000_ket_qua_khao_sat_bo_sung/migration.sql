-- 2026-10-05: bổ sung theo trang kết quả thật của hệ thống khảo sát (thang M1–M4,
-- "13,75 / 44", trang kết quả chi tiết riêng). Đều tùy chọn.
ALTER TABLE "ket_qua_khao_sat"
    ADD COLUMN "diem_toi_da" DECIMAL(6,2),
    ADD COLUMN "muc_goc" VARCHAR(50),
    ADD COLUMN "url_ket_qua" VARCHAR(500);
