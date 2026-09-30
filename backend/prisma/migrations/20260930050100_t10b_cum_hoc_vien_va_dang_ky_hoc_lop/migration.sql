-- QĐ10 (mo-rong-nls-an-giang.md, 2026-09-30): cụm học viên (nhóm Zalo hỗ
-- trợ theo địa lý) — KHÁI NIỆM MỚI hoàn toàn, độc lập với cây đơn vị công
-- tác VÀ độc lập với 3 loại lớp. Chứa HỌC VIÊN TRỰC TIẾP (dang_ky_hoc.cum_id
-- ở dưới), không qua trung gian lớp nào.

-- CreateTable
CREATE TABLE "cum_hoc_vien" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "khoa_id" UUID NOT NULL,
    "ten_cum" VARCHAR(255) NOT NULL,
    "link_zalo" VARCHAR(500),
    "ghi_chu" TEXT,
    "trang_thai" "trang_thai_active" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cum_hoc_vien_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_cum_ten_trong_khoa" ON "cum_hoc_vien"("khoa_id", "ten_cum");

-- CreateIndex
CREATE INDEX "idx_cum_khoa" ON "cum_hoc_vien"("khoa_id");

-- AddForeignKey
ALTER TABLE "cum_hoc_vien" ADD CONSTRAINT "cum_hoc_vien_khoa_id_fkey" FOREIGN KEY ("khoa_id") REFERENCES "khoa_boi_duong"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- QĐ10: bảng NỐI thay cho việc thêm 3-4 cột FK riêng trên dang_ky_hoc — dễ
-- mở rộng thêm loại lớp thứ 4/5 sau này mà không phải sửa lại schema/API.
-- loai_lop trên mỗi dòng là BẢN SAO của lop_hoc.loai_lop tại thời điểm gán
-- (để làm được UNIQUE bên dưới mà không cần trigger) — PHẢI luôn khớp
-- lop_hoc.loai_lop của lop_id tương ứng, kiểm tra ở TẦNG SERVICE khi
-- tạo/sửa (không dùng DB trigger, xem
-- KhoaBoiDuongService.assertLopThuocKhoaVaLoai), từ chối nếu không khớp.

-- CreateTable
CREATE TABLE "dang_ky_hoc_lop" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dang_ky_hoc_id" UUID NOT NULL,
    "lop_id" UUID NOT NULL,
    "loai_lop" "loai_lop_hoc" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dang_ky_hoc_lop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: mỗi đăng ký chỉ có 1 lớp cho mỗi loại lớp.
CREATE UNIQUE INDEX "uq_dang_ky_hoc_lop_loai" ON "dang_ky_hoc_lop"("dang_ky_hoc_id", "loai_lop");

-- CreateIndex
CREATE INDEX "idx_dang_ky_hoc_lop_lop" ON "dang_ky_hoc_lop"("lop_id");

-- AddForeignKey
ALTER TABLE "dang_ky_hoc_lop" ADD CONSTRAINT "dang_ky_hoc_lop_dang_ky_hoc_id_fkey" FOREIGN KEY ("dang_ky_hoc_id") REFERENCES "dang_ky_hoc"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dang_ky_hoc_lop" ADD CONSTRAINT "dang_ky_hoc_lop_lop_id_fkey" FOREIGN KEY ("lop_id") REFERENCES "lop_hoc"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- QĐ10: cụm học viên gán trực tiếp trên dang_ky_hoc — NULL = chưa gán cụm.

-- AlterTable
ALTER TABLE "dang_ky_hoc" ADD COLUMN "cum_id" UUID;

-- CreateIndex
CREATE INDEX "idx_dang_ky_cum" ON "dang_ky_hoc"("cum_id");

-- AddForeignKey
ALTER TABLE "dang_ky_hoc" ADD CONSTRAINT "dang_ky_hoc_cum_id_fkey" FOREIGN KEY ("cum_id") REFERENCES "cum_hoc_vien"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
