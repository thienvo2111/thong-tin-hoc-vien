-- CreateEnum
CREATE TYPE "loai_dot_xac_nhan" AS ENUM ('kiem_tra_bo_sung', 'xac_nhan_truoc_danh_gia');

-- Prisma tự sinh 4 câu "DROP INDEX" cho các GIN trgm index bên dưới ở đây —
-- chúng được tạo bằng raw SQL nối vào migration khởi tạo (không nằm trong
-- schema.prisma DSL, xem comment đầu schema.prisma) nên Prisma không "thấy"
-- chúng và tưởng là index thừa cần xóa. ĐÃ GỠ BỎ theo đúng gotcha đã biết
-- (mo-rong-nls-an-giang.md, section chỉ dẫn phiên làm việc): idx_dia_danh_ten_trgm,
-- idx_don_vi_ten_trgm, idx_hoc_vien_ho_ten_trgm, idx_hoc_vien_chuyen_mon_trgm.
