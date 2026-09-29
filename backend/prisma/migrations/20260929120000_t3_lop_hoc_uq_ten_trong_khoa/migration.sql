-- T3 (mo-rong-nls-an-giang.md): tên lớp phải duy nhất trong cùng 1 khóa.
-- Đã kiểm tra dữ liệu hiện có (dev) trước khi thêm — 0 lớp, không có dòng vi
-- phạm.
ALTER TABLE "lop_hoc" ADD CONSTRAINT "uq_lop_ten_trong_khoa" UNIQUE ("khoa_id", "ten_lop");
