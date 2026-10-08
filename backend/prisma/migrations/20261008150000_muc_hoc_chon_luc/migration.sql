-- 2026-10-08: thời điểm học viên/Quản trị điều chỉnh mức lớp học gần nhất
-- (hiển thị "Đã điều chỉnh lúc ..."). NULL = chưa điều chỉnh / đã reset khi
-- import ket_qua_danh_gia hạ muc_dau_vao. Chỉ thêm cột nullable, không đụng dữ liệu cũ.
ALTER TABLE "dang_ky_hoc" ADD COLUMN "muc_hoc_chon_luc" TIMESTAMPTZ(6);
