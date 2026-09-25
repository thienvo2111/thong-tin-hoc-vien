-- CreateEnum
CREATE TYPE "loai_su_kien_thong_bao" AS ENUM ('hoc_vien_xac_nhan', 'hoc_vien_duyet', 'khoa_boi_duong_duyet', 'dang_ky_hoc_phan_lop', 'dang_ky_hoc_ket_qua');

-- CreateEnum
CREATE TYPE "trang_thai_gui_thong_bao" AS ENUM ('thanh_cong', 'that_bai');

-- LƯU Ý: `prisma migrate dev` tự sinh thêm 4 dòng "DROP INDEX" cho các GIN
-- trgm index (idx_dia_danh_ten_trgm, idx_don_vi_ten_trgm,
-- idx_hoc_vien_ho_ten_trgm, idx_hoc_vien_chuyen_mon_trgm) vì các index này
-- được thêm bằng raw SQL nối vào migration khởi tạo, không có trong
-- schema.prisma (xem comment đầu schema.prisma) — Prisma coi đó là "drift"
-- và muốn xóa. Đã LOẠI BỎ các dòng đó khỏi file này để không phá autocomplete
-- gần đúng đang dùng — không phải lỗi gõ thiếu.

-- CreateTable
CREATE TABLE "nhat_ky_thong_bao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "loai_su_kien" "loai_su_kien_thong_bao" NOT NULL,
    "hoc_vien_id" UUID,
    "email_nguoi_nhan" VARCHAR(255) NOT NULL,
    "tieu_de" VARCHAR(255) NOT NULL,
    "gui_luc" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trang_thai" "trang_thai_gui_thong_bao" NOT NULL,
    "loi" TEXT,

    CONSTRAINT "nhat_ky_thong_bao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_thong_bao_hoc_vien" ON "nhat_ky_thong_bao"("hoc_vien_id");

-- CreateIndex
CREATE INDEX "idx_thong_bao_loai_su_kien" ON "nhat_ky_thong_bao"("loai_su_kien");

-- CreateIndex
CREATE INDEX "idx_thong_bao_gui_luc" ON "nhat_ky_thong_bao"("gui_luc");

-- AddForeignKey
ALTER TABLE "nhat_ky_thong_bao" ADD CONSTRAINT "nhat_ky_thong_bao_hoc_vien_id_fkey" FOREIGN KEY ("hoc_vien_id") REFERENCES "hoc_vien"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Raw SQL bổ sung: CHECK constraint không biểu diễn được bằng Prisma DSL
-- (cùng cách làm với migration khởi tạo, xem docs/database-ddl.sql PHẦN 4).
ALTER TABLE "nhat_ky_thong_bao" ADD CONSTRAINT "chk_thong_bao_loi"
    CHECK ( (trang_thai = 'that_bai' AND loi IS NOT NULL)
         OR (trang_thai = 'thanh_cong') );
