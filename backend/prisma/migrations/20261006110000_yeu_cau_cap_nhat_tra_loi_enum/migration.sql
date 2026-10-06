-- ADR 0003 H12 (2026-10-06): email báo học viên câu trả lời được Quản trị cập nhật.
-- ALTER TYPE ... ADD VALUE phải nằm ở migration RIÊNG, chạy trước migration dùng giá trị mới.
ALTER TYPE "loai_su_kien_thong_bao" ADD VALUE 'yeu_cau_ho_tro_cap_nhat_tra_loi';
