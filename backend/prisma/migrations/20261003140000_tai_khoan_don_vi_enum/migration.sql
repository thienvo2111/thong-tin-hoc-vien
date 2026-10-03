-- Tài khoản đơn vị (spec 2026-10-03-tai-khoan-don-vi-design.md §3, §7).
-- ALTER TYPE ... ADD VALUE phải nằm ở migration RIÊNG, chạy trước migration
-- dùng giá trị mới (cùng quy ước với tai_khoan_vle/ket_qua_danh_gia).
ALTER TYPE "loai_token_xac_thuc" ADD VALUE 'kich_hoat_tai_khoan';
ALTER TYPE "loai_danh_muc_import" ADD VALUE 'tai_khoan_don_vi';
ALTER TYPE "loai_su_kien_thong_bao" ADD VALUE 'kich_hoat_tai_khoan';
