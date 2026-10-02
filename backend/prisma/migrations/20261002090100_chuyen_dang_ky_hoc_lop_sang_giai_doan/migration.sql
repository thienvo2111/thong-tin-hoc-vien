-- Chuyển dang_ky_hoc_lop (1 lớp mỗi loại) sang phan_lop_giai_doan (1 lớp mỗi
-- giai đoạn): mỗi (đăng ký, lớp X) -> 1 dòng cho MỖI giai đoạn mà X có buổi.
-- Lớp chưa có buổi nào: không tạo dòng (chạy scripts/kiem-tra-chuyen-phan-lop.ts
-- để liệt kê, gán tay sau). Hai lớp của cùng đăng ký cùng có buổi trong 1 giai
-- đoạn: vi phạm uq_phan_lop_giai_doan -> migration FAIL và rollback (cố ý — chạy
-- script kiểm tra TRƯỚC khi deploy). Bảng cũ giữ nguyên tới task dọn dẹp.
INSERT INTO "phan_lop_giai_doan" ("dang_ky_hoc_id", "giai_doan_id", "lop_id")
SELECT DISTINCT dkl."dang_ky_hoc_id", lh."giai_doan_id", dkl."lop_id"
FROM "dang_ky_hoc_lop" dkl
JOIN "lich_hoc_lop" lh ON lh."lop_id" = dkl."lop_id";
