-- 2026-10-09 (issue #23, ADR 0005): điểm danh lớp Zoom bằng cú bấm "Điểm danh
-- & vào Zoom". Chỉ THÊM: enum che_do_chuyen_can (Z8), 4 cột khoa_boi_duong
-- (mốc bật — NULL = tắt; cửa sổ mở trước/đóng sau giờ bắt đầu buổi), mốc chốt
-- vắng lich_hoc_lop (Z6), lúc tự điểm danh + người sửa tay trên diem_danh (Z3,
-- Z7). Không sửa/xóa dữ liệu cũ; mặc định tắt nên không ảnh hưởng khóa nào.
CREATE TYPE "che_do_chuyen_can" AS ENUM ('theo_lop_hien_tai', 'cong_nhan_lop_cu');

ALTER TABLE "khoa_boi_duong" ADD COLUMN "bat_diem_danh_zoom_luc" TIMESTAMPTZ(6);
ALTER TABLE "khoa_boi_duong" ADD COLUMN "diem_danh_mo_truoc_phut" SMALLINT NOT NULL DEFAULT 30;
ALTER TABLE "khoa_boi_duong" ADD COLUMN "diem_danh_dong_sau_phut" SMALLINT NOT NULL DEFAULT 120;
ALTER TABLE "khoa_boi_duong" ADD COLUMN "che_do_chuyen_can" "che_do_chuyen_can" NOT NULL DEFAULT 'theo_lop_hien_tai';

-- CHECK không biểu diễn được bằng Prisma DSL — giữ khớp @Min/@Max của UpdateKhoaBoiDuongDto.
ALTER TABLE "khoa_boi_duong" ADD CONSTRAINT "chk_khoa_diem_danh_mo_truoc"
    CHECK ("diem_danh_mo_truoc_phut" BETWEEN 0 AND 180);
ALTER TABLE "khoa_boi_duong" ADD CONSTRAINT "chk_khoa_diem_danh_dong_sau"
    CHECK ("diem_danh_dong_sau_phut" BETWEEN 15 AND 720);

ALTER TABLE "lich_hoc_lop" ADD COLUMN "chot_diem_danh_luc" TIMESTAMPTZ(6);

ALTER TABLE "diem_danh" ADD COLUMN "tu_diem_danh_luc" TIMESTAMPTZ(6);
ALTER TABLE "diem_danh" ADD COLUMN "nguoi_sua" UUID;
ALTER TABLE "diem_danh" ADD CONSTRAINT "diem_danh_nguoi_sua_fkey"
    FOREIGN KEY ("nguoi_sua") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
