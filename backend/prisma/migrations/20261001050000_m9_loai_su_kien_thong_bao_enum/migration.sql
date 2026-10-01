-- M9 (2026-10-01, hàng đợi email): migration A — ALTER TYPE ... ADD VALUE
-- nằm trong migration RIÊNG, chạy trước migration nào dùng giá trị mới
-- (cùng lý do với tai_khoan_vle/ket_qua_danh_gia/yeu_cau_ho_tro_tra_loi ở
-- các enum khác — xem comment đầu schema.prisma). guiXacMinhEmail/
-- guiDatLaiMatKhau chuyển sang ghi nhat_ky_thong_bao bằng 2 giá trị mới
-- này để hạn mức/ngày đếm được toàn bộ email gửi qua tài khoản.

-- AlterEnum
ALTER TYPE "loai_su_kien_thong_bao" ADD VALUE 'email_xac_minh';
ALTER TYPE "loai_su_kien_thong_bao" ADD VALUE 'dat_lai_mat_khau';
